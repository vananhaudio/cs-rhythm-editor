-- ═══════════════════════════════════════════════════════════════════════════
-- 1001 CÂU CHUYỆN — LÁT 0.1: người kể lưu được thật + quyền riêng tư tác giả
-- Chạy SAU story_security_lat0_setup.sql. Phần bảo mật ở đây KHÔNG hoàn tác cùng tính năng khác.
-- Không xoá dữ liệu · không đổi trạng thái bài nào · không đổi slug/số bài/ngày đăng/nội dung.
-- Client cũ (kể cả app native đã cài) không phải đổi gì.
-- CHẠY: prod-db.py dryrun → migrate (file KHÔNG có begin/commit). Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

set local lock_timeout = '3s';

do $gate$
begin
  if to_regclass('public.story_private') is null then raise exception 'LAT01_GATE: chưa chạy Lát 0'; end if;
  if not exists (select 1 from pg_policy where polrelid = 'public.stories'::regclass and polname = 'stories_own_read') then
    raise exception 'LAT01_GATE: thiếu stories_own_read'; end if;
end
$gate$;

-- ── 1) Cột của Ban biên tập: người kể (client) không tự đặt, không tự đổi ───
-- SECURITY INVOKER (mặc định) để current_user là vai đang gọi; service_role/postgres đi qua.
create or replace function public.stories_guard_editorial()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.story_number := null; new.slug := null; new.published_at := null;
      new.ai_review := null;    new.featured := false;
    else
      new.story_number := old.story_number; new.slug := old.slug; new.published_at := old.published_at;
      new.ai_review := old.ai_review;       new.featured := old.featured;
      new.created_at := old.created_at;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists stories_guard_editorial on public.stories;
create trigger stories_guard_editorial before insert or update on public.stories
  for each row execute function public.stories_guard_editorial();

-- ── 2) Người kể sửa / gửi / xoá bài CỦA MÌNH khi bài còn trong tay mình ─────
-- Trước đây stories_own_update là FOR ALL không có USING → không cho phép gì, giao diện hỏng âm thầm.
drop policy if exists stories_own_update on public.stories;
create policy stories_own_update on public.stories for update to authenticated
  using (user_id = auth.uid() and status in ('telling','collecting_photos','writing','user_review'))
  with check (user_id = auth.uid() and status in ('telling','collecting_photos','writing','user_review','submitted'));
-- Xoá: nháp và bài đã gửi nhưng chưa đăng. Bài đã đăng / đã gỡ do Ban biên tập xử lý (giữ đường dẫn).
drop policy if exists stories_own_delete on public.stories;
create policy stories_own_delete on public.stories for delete to authenticated
  using (user_id = auth.uid() and status in ('telling','collecting_photos','writing','user_review','submitted'));

-- ── 3) "Đôi nét về người kể": chưa đồng ý công khai thì không nằm trong bài công khai ──
-- Chuyển sang bảng đóng (không xoá); bật đồng ý thì trả lại. Ban biên tập vẫn xem/sửa qua story-ai.
alter table public.story_private add column if not exists author_bio jsonb;

create or replace function public.stories_seal_author_bio()
returns trigger language plpgsql security definer set search_path = '' as $$
declare cur record; kept jsonb;
begin
  -- Đọc lại dòng hiện tại: trigger khác có thể đã sửa nó trong cùng lệnh.
  select * into cur from public.stories where id = new.id;
  if not found or cur.status <> 'published' then return null; end if;

  if cur.consent_bio_publish is not true then
    if cur.author_full_name is null and cur.author_age is null and cur.author_hometown is null
       and cur.author_living_in is null and cur.author_job is null and cur.author_bio is null
       and cur.author_portrait_url is null then return null; end if;
    insert into public.story_private as p (story_id, author_bio)
      values (cur.id, jsonb_strip_nulls(jsonb_build_object(
        'author_full_name', cur.author_full_name, 'author_age', cur.author_age,
        'author_hometown', cur.author_hometown, 'author_living_in', cur.author_living_in,
        'author_job', cur.author_job, 'author_bio', cur.author_bio,
        'author_portrait_url', cur.author_portrait_url)))
      on conflict (story_id) do update
        set author_bio = coalesce(p.author_bio, '{}'::jsonb) || excluded.author_bio, updated_at = now();
    update public.stories set author_full_name = null, author_age = null, author_hometown = null,
      author_living_in = null, author_job = null, author_bio = null, author_portrait_url = null
     where id = cur.id;
  else
    select author_bio into kept from public.story_private where story_id = cur.id;
    if kept is null then return null; end if;
    update public.story_private set author_bio = null, updated_at = now() where story_id = cur.id;
    update public.stories set
      author_full_name    = coalesce(author_full_name,    kept->>'author_full_name'),
      author_age          = coalesce(author_age,          (kept->>'author_age')::int),
      author_hometown     = coalesce(author_hometown,     kept->>'author_hometown'),
      author_living_in    = coalesce(author_living_in,    kept->>'author_living_in'),
      author_job          = coalesce(author_job,          kept->>'author_job'),
      author_bio          = coalesce(author_bio,          kept->>'author_bio'),
      author_portrait_url = coalesce(author_portrait_url, kept->>'author_portrait_url')
     where id = cur.id;
  end if;
  return null;
end $$;
revoke all on function public.stories_seal_author_bio() from public, anon, authenticated;
drop trigger if exists stories_seal_author_bio on public.stories;
create trigger stories_seal_author_bio
  after insert or update of status, consent_bio_publish, author_full_name, author_age, author_hometown,
    author_living_in, author_job, author_bio, author_portrait_url on public.stories
  for each row execute function public.stories_seal_author_bio();

-- Áp cho bài đang đăng mà chưa đồng ý (chỉ chuyển 7 cột giới thiệu tác giả).
update public.stories set consent_bio_publish = consent_bio_publish
 where status = 'published' and consent_bio_publish is not true
   and num_nonnulls(author_full_name, author_age, author_hometown, author_living_in, author_job, author_bio, author_portrait_url) > 0;

notify pgrst, 'reload schema';
