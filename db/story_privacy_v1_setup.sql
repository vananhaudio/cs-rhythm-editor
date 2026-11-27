-- ═══════════════════════════════════════════════════════════════════════════
-- 1001 CÂU CHUYỆN — QUYỀN RIÊNG TƯ TÁC GIẢ V1 (bản vá bảo mật; KHÔNG hoàn tác khi hoàn tác tính năng khác)
-- Trước: người đã đăng nhập đọc được stories.user_id (nối được bài bút danh/ẩn danh với tài khoản) và author_name.
-- Sau:   bài ĐÃ ĐĂNG không còn mang mã tác giả trong bảng công khai — mã được CHUYỂN (không sao chép) sang
--        story_private.owner_id; rời trạng thái đã đăng thì trả lại để người kể thấy bài của mình.
--        Các cột tên thật / lựa chọn đồng ý đóng quyền đọc trực tiếp (không giao diện nào, kể cả bản app cũ, đọc chúng).
-- Không đổi nội dung, đường dẫn, số, ngày đăng, updated_at. CHẠY: prod-db.py dryrun → migrate. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '3s';

do $gate$
declare r record;
begin
  for r in select * from (values
    ('social_feed', '43fae0bc4c588360e43b293af780b931'),
    ('social_stories', '94e6db43acbd551f7f56a00087bb6fd6'),
    ('social_story_today', '53323cd2bad5df08f99d246f904ff0ef')
  ) v(fn, h) loop
    if not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = r.fn
                   and (md5(p.prosrc) = r.h or position('story_owner_id' in p.prosrc) > 0)) then
      raise exception 'STORY_PRIVACY_GATE: % đã đổi so với bản dùng để viết migration. Dựng lại từ bản mới.', r.fn;
    end if;
  end loop;
end
$gate$;

alter table public.story_private add column if not exists owner_id uuid;
create index if not exists story_private_owner_idx on public.story_private (owner_id) where owner_id is not null;
alter table public.stories alter column user_id drop not null;

-- Chủ bài thật, dùng TRONG server (lọc chặn, Ban biên tập). Không cấp cho client.
create or replace function public.story_owner_id(p_id uuid)
returns uuid language sql stable security definer set search_path = '' as $fn$
  select coalesce(s.user_id, p.owner_id) from public.stories s left join public.story_private p on p.story_id = s.id where s.id = p_id
$fn$;
revoke all on function public.story_owner_id(uuid) from public, anon, authenticated;

create or replace function public.stories_seal_owner()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  if new.status = 'published' then
    if new.user_id is not null then
      insert into public.story_private as p (story_id, owner_id) values (new.id, new.user_id)
        on conflict (story_id) do update set owner_id = excluded.owner_id, updated_at = now();
      update public.stories set user_id = null where id = new.id;
    end if;
  elsif new.user_id is null then
    update public.stories s set user_id = p.owner_id from public.story_private p
     where s.id = new.id and p.story_id = new.id and p.owner_id is not null and s.user_id is null;
  end if;
  return null;
end $fn$;
revoke all on function public.stories_seal_owner() from public, anon, authenticated;
drop trigger if exists stories_seal_owner on public.stories;
create trigger stories_seal_owner after insert or update of status, user_id on public.stories
  for each row execute function public.stories_seal_owner();

-- Chuyển mã tác giả của các bài đang đăng. Giữ nguyên updated_at.
alter table public.stories disable trigger stories_touch_updated_at;
update public.stories set user_id = user_id where status = 'published' and user_id is not null;
alter table public.stories enable trigger stories_touch_updated_at;

-- Bài ĐÃ ĐĂNG của chính tôi (Phòng viết ghép vào danh sách; chỉ trả của người gọi).
create or replace function public.my_published_stories()
returns table(id uuid, title text, status text, updated_at timestamptz)
language sql stable security definer set search_path = '' as $fn$
  select s.id, s.title, s.status, s.updated_at from public.stories s
  join public.story_private p on p.story_id = s.id
  where auth.uid() is not null and p.owner_id = auth.uid() and s.status = 'published'
  order by s.updated_at desc
$fn$;
revoke all on function public.my_published_stories() from public, anon;
grant execute on function public.my_published_stories() to authenticated;

revoke select (author_name, author_avatar_url, class_display, display_mode, consent_edit, consent_publish, consent_at, consent_bio_edit)
  on public.stories from anon, authenticated;

-- Lọc người bị chặn theo chủ bài thật (dựng từ định nghĩa đang chạy).
CREATE OR REPLACE FUNCTION public.social_feed(p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_key text DEFAULT NULL::text, p_limit integer DEFAULT 20)
 RETURNS TABLE(kind text, sort_at timestamp with time zone, sort_key text, post jsonb, thread jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with items as (
    select 'post'::text as kind, p.created_at as sort_at, 'p:' || p.id::text as sort_key, p.id, null::uuid as tid, null::jsonb as payload
    from public.class_posts p
    where (p.audience = 'class' and (p.hidden_at is null or public.is_teacher()))
       or (p.audience = 'friends' and p.hidden_at is null
           and (p.author_user_id = auth.uid() or public.is_friend_of(p.author_user_id)))
    union all
    select 'learning_thread', t.last_event_at, 't:' || t.id::text, null::uuid, t.id, null::jsonb
    from public.learning_threads t
    where t.visibility = 'community' and t.hidden_at is null and t.archived_at is null and t.last_event_at is not null
    union all
    select 'teamlab_publication', pb.published_at, 'u:' || pb.id::text, pb.id, null::uuid, null::jsonb
    from public.teamlab_publications pb
    where pb.status = 'published' and pb.published_at is not null and pb.public_slug is not null
    union all
    select 'lesson_clip', ci.sort_at, ci.sort_key, null::uuid, null::uuid, ci.payload
    from public.social_feed_clip_items(null) ci
    union all
    -- 1001 Câu Chuyện: đọc thẳng public.stories (không sao chép). Chỉ bài đăng TỪ KHI cộng đồng bắt đầu có bài —
    -- bài cũ hơn không dồn một khối ở cuối Feed mà luân phiên qua thẻ "Câu chuyện hôm nay" và /me/stories.
    -- Lọc người bị chặn NGAY TẠI ĐÂY vì thẻ không gửi mã tác giả cho social_feed_safe.
    select 'story', st.published_at, 's:' || st.id::text, st.id, null::uuid, null::jsonb
    from public.stories st
    where st.status = 'published' and st.published_at is not null and st.slug is not null
      and st.published_at >= (select min(cp.created_at) from public.class_posts cp where cp.audience = 'class' and cp.hidden_at is null)
      and not coalesce(public.class_ugc_pair_blocked(auth.uid(), public.story_owner_id(st.id)), false)
  ),
  page as (
    select * from items
    where public.is_class_member()
      and (p_before is null or (sort_at, sort_key) < (p_before, coalesce(p_before_key, '')))
    order by sort_at desc, sort_key desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
  )
  select pg.kind, pg.sort_at, pg.sort_key,
         case pg.kind
           when 'post' then (
             select jsonb_build_object(
               'id', p.id, 'type', p.type, 'body', p.body, 'media_type', p.media_type, 'media_provider', p.media_provider,
               'media_url', p.media_url, 'external_media_id', p.external_media_id, 'created_at', p.created_at,
               'updated_at', p.updated_at, 'author_user_id', p.author_user_id, 'author_name', idn.name,
               'author_avatar_url', idn.avatar_url, 'author_role', idn.role, 'author_ht_member', idn.ht_member,
               'is_mine', p.author_user_id = auth.uid(), 'is_hidden', p.hidden_at is not null,
               'comment_count', (select count(*)::int from public.class_post_comments c
                                 where c.post_id = p.id and (c.hidden_at is null or public.is_teacher())),
               'audience', p.audience)
             from public.class_posts p cross join lateral public.class_public_identity(p.author_user_id) idn
             where p.id = pg.id)
           when 'teamlab_publication' then (
             select jsonb_build_object(
               'publication_id', pb.id, 'project_id', pr.id, 'slug', pb.public_slug, 'title', t.name,
               'band_name', b.name, 'project_name', pr.name,
               'cover_path', pr.cover_path, 'avatar_path', pr.avatar_path, 'project_slug', pr.public_slug,
               'published_at', pb.published_at)
             from public.teamlab_publications pb
             join public.teams t on t.id = pb.song_id
             join public.projects pr on pr.id = pb.project_id
             left join public.teamlab_bands b on b.id = t.band_id
             where pb.id = pg.id)
           when 'lesson_clip' then pg.payload
           when 'story' then public.story_feed_card(pg.id)
         end,
         case when pg.kind = 'learning_thread' then public.lt_thread_card(pg.tid) end
  from page pg
  order by pg.sort_at desc, pg.sort_key desc;
$function$;

CREATE OR REPLACE FUNCTION public.social_stories(p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 12)
 RETURNS TABLE(published_at timestamp with time zone, story_id uuid, story jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select s.published_at, s.id, public.story_feed_card(s.id)
  from public.stories s
  where auth.uid() is not null and s.status = 'published' and s.published_at is not null and s.slug is not null
    and not coalesce(public.class_ugc_pair_blocked(auth.uid(), public.story_owner_id(s.id)), false)
    and (p_before is null or (s.published_at, s.id) < (p_before, coalesce(p_before_id, '00000000-0000-0000-0000-000000000000'::uuid)))
  order by s.published_at desc, s.id desc
  limit least(greatest(coalesce(p_limit, 12), 1), 50)
$function$;

CREATE OR REPLACE FUNCTION public.social_story_today()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with visible as (
    select s.id, s.published_at, s.story_number from public.stories s
    where s.status = 'published' and s.published_at is not null and s.slug is not null
      and not coalesce(public.class_ugc_pair_blocked(auth.uid(), public.story_owner_id(s.id)), false)
  ),
  older as (select * from visible where published_at < now() - interval '14 days'),
  pool as (select * from older union all select * from visible where not exists (select 1 from older)),
  ranked as (select id, row_number() over (order by published_at, story_number, id) - 1 as pos, count(*) over () as n from pool)
  select public.story_feed_card(r.id) from ranked r
  where public.is_class_member()
    and r.pos = ((((now() at time zone 'Asia/Ho_Chi_Minh')::date - date '2026-01-01') % r.n) + r.n) % r.n
$function$;

notify pgrst, 'reload schema';
