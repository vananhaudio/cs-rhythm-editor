-- ═══════════════════════════════════════════════════════════════════════════
-- 1001 CÂU CHUYỆN — VÁ QUYỀN LÁT 0 (quyền truy cập TRỰC TIẾP vào dữ liệu)
-- *** BẢN VÁ BẢO MẬT — KHÔNG hoàn tác cùng bất kỳ tính năng nào. Không có file rollback mở lại quyền. ***
-- Không xoá dữ liệu · không đổi slug/số bài/ngày đăng · client cũ (kể cả app native đã cài) không phải đổi gì.
-- CHẠY: prod-db.py dryrun → migrate (file KHÔNG có begin/commit). Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

-- Không xếp hàng chờ khoá (CREATE/DROP POLICY khoá lan sang auth.users) — bận thì dừng, chạy lại sau.
set local lock_timeout = '3s';

-- ── 0) Cổng ────────────────────────────────────────────────────────────────
do $gate$
begin
  if to_regclass('public.stories') is null or to_regclass('public.story_chunks') is null
     or to_regclass('public.story_comments') is null then raise exception 'LAT0_GATE: thiếu bảng story'; end if;
  if not exists (select 1 from pg_policy where polrelid = 'public.story_chunks'::regclass and polname = 'chunks_own_read') then
    raise exception 'LAT0_GATE: thiếu chunks_own_read — người kể sẽ mất quyền đọc lời kể của mình'; end if;
  if (select count(*) from public.story_comments) > 0 then
    raise exception 'LAT0_GATE: story_comments đã có dữ liệu — xem lại trước khi khoá ghi'; end if;
end
$gate$;

-- ── 1) Ngăn riêng tư: chỉ service role (Edge Function đã kiểm vai) đọc/ghi ──
create table if not exists public.story_private (
  story_id      uuid primary key references public.stories(id) on delete cascade,
  conversation  jsonb,       -- hội thoại với Mira của bài đã đăng
  original_names jsonb,      -- tên tác giả cũ trước khi che email
  updated_at    timestamptz not null default now()
);
alter table public.story_private enable row level security;
revoke all on table public.story_private from public, anon, authenticated;
grant all on table public.story_private to service_role;
comment on table public.story_private is 'story_security_lat0: bảng ĐÓNG (RLS bật, không policy). Đừng áp policy rộng.';

-- ── 2) Bài đã đăng không mang hội thoại riêng trong bảng công khai (chuyển, không xoá) ──
create or replace function public.stories_seal_conversation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'published' and new.conversation is distinct from '[]'::jsonb then
    insert into public.story_private as p (story_id, conversation) values (new.id, new.conversation)
      on conflict (story_id) do update set conversation = excluded.conversation, updated_at = now();
    update public.stories set conversation = '[]'::jsonb where id = new.id;
  end if;
  return null;
end $$;
revoke all on function public.stories_seal_conversation() from public, anon, authenticated;
drop trigger if exists stories_seal_conversation on public.stories;
create trigger stories_seal_conversation after insert or update of status, conversation on public.stories
  for each row execute function public.stories_seal_conversation();

update public.stories set conversation = conversation where status = 'published' and conversation <> '[]'::jsonb;

-- ── 3) Cột không giao diện nào đọc từ client ───────────────────────────────
revoke select (zalo, ai_review) on public.stories from anon, authenticated;

-- ── 4) Mẩu lời kể thô: chỉ chính người kể ──────────────────────────────────
drop policy if exists chunks_public_read on public.story_chunks;
revoke select on public.story_chunks from anon;

-- ── 5) story_comments không có giao diện: đóng đường ghi (mạo danh / spam qua REST) ──
drop policy if exists sc_own_insert on public.story_comments;
revoke insert, update on public.story_comments from anon, authenticated;

-- ── 6) Kho ảnh công khai: chỉ nhận ảnh, giới hạn dung lượng ─────────────────
update storage.buckets
   set allowed_mime_types = array['image/jpeg','image/png','image/webp'], file_size_limit = 15728640
 where id = 'story-photos';

-- ── 7) Tên tác giả đang lộ email → 'Người kể chuyện' (giữ bản cũ trong bảng đóng) ──
insert into public.story_private (story_id, original_names)
  select id, jsonb_build_object('pen_name', pen_name, 'author_name', author_name)
    from public.stories where status = 'published' and (pen_name like '%@%' or author_name like '%@%')
  on conflict (story_id) do update
    set original_names = coalesce(public.story_private.original_names, excluded.original_names), updated_at = now();
update public.stories
   set pen_name    = case when pen_name    like '%@%' then 'Người kể chuyện' else pen_name end,
       author_name = case when author_name like '%@%' then 'Người kể chuyện' else author_name end
 where status = 'published' and (pen_name like '%@%' or author_name like '%@%');

notify pgrst, 'reload schema';
