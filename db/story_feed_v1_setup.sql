-- ═══════════════════════════════════════════════════════════════════════════
-- 1001 CÂU CHUYỆN → /me (Lát 1 + 2): Feed 'story', "Câu chuyện hôm nay", danh sách /me/stories.
-- Không bảng mới, không sao chép nội dung. Hoàn tác: story_feed_v1_rollback.sql (KHÔNG đụng bản vá bảo mật Lát 0 / 0.1).
-- social_feed dựng từ định nghĩa ĐANG CHẠY trên production. CHẠY: prod-db.py dryrun → migrate. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '3s';

do $gate$
declare h text; src text;
begin
  select md5(prosrc), prosrc into h, src from pg_proc where oid = 'public.social_feed(timestamptz,text,integer)'::regprocedure;
  if h <> '91e32e8ba809cda3b28c6a8964d43efa' and position('story_feed_card' in src) = 0 then
    raise exception 'STORY_FEED_GATE: social_feed đã đổi so với bản dùng để viết migration (%). Dựng lại từ bản mới.', h; end if;
  if to_regprocedure('public.class_ugc_pair_blocked(uuid,uuid)') is null then raise exception 'STORY_FEED_GATE: thiếu class_ugc_pair_blocked'; end if;
end
$gate$;

-- Thẻ truyện: CHỈ thông tin công khai. Không mã người dùng, hội thoại, Zalo. Tên: tôn trọng ẩn danh, không bao giờ lộ email.
create or replace function public.story_feed_card(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $fn$
  select jsonb_build_object(
    'story_id', s.id, 'slug', s.slug, 'title', s.title, 'story_number', s.story_number, 'published_at', s.published_at,
    'cover_url', s.photos -> 0 ->> 'url',
    'author_name', case when s.display_mode = 'anonymous' or nullif(btrim(s.pen_name), '') is null or s.pen_name like '%@%'
                        then 'Người kể chuyện' else btrim(s.pen_name) end,
    'excerpt', (
      -- bỏ dấu markdown, dòng tiêu đề '#', và dòng đầu lặp lại tên truyện; rồi gộp khoảng trắng, cắt 180 ký tự
      select case when length(t) > 180 then rtrim(left(t, 180)) || '…' else t end
      -- dòng đầu ngắn, không kết câu = tít (kể cả viết khác tên truyện) → bỏ khỏi đoạn trích
      from (select btrim(regexp_replace(case when position(E'\n' in body) > 0 and length(btrim(split_part(body, E'\n', 1), E' \t\r')) <= 90
                                              and btrim(split_part(body, E'\n', 1), E' \t\r') !~ '[.…!,;]$'
                                             then substr(body, length(split_part(body, E'\n', 1)) + 1) else body end, '\s+', ' ', 'g')) as t
            from (select btrim(regexp_replace(regexp_replace(regexp_replace(coalesce(s.content, ''),
                    '(^|\n)[ \t]*#[^\n]*', E'\n', 'g'), '(^|\n)[ \t]*[-*_]{3,}[ \t]*(?=\n|$)', E'\n', 'g'), '\*+', '', 'g'), E' \t\r\n') as body) b) x))
  from public.stories s
  where s.id = p_id and s.status = 'published' and s.slug is not null
$fn$;
revoke all on function public.story_feed_card(uuid) from public, anon, authenticated;

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
      and not coalesce(public.class_ugc_pair_blocked(auth.uid(), st.user_id), false)
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

-- "Câu chuyện hôm nay": đổi mỗi ngày (giờ Việt Nam), xoay vòng các truyện đã đăng quá 14 ngày (chưa đủ thì xoay tất cả).
create or replace function public.social_story_today()
returns jsonb language sql stable security definer set search_path = '' as $fn$
  with visible as (
    select s.id, s.published_at, s.story_number from public.stories s
    where s.status = 'published' and s.published_at is not null and s.slug is not null
      and not coalesce(public.class_ugc_pair_blocked(auth.uid(), s.user_id), false)
  ),
  older as (select * from visible where published_at < now() - interval '14 days'),
  pool as (select * from older union all select * from visible where not exists (select 1 from older)),
  ranked as (select id, row_number() over (order by published_at, story_number, id) - 1 as pos, count(*) over () as n from pool)
  select public.story_feed_card(r.id) from ranked r
  where public.is_class_member()
    and r.pos = ((((now() at time zone 'Asia/Ho_Chi_Minh')::date - date '2026-01-01') % r.n) + r.n) % r.n
$fn$;
revoke all on function public.social_story_today() from public, anon;
grant execute on function public.social_story_today() to authenticated;

-- Danh sách /me/stories: mới nhất trước, phân trang keyset (published_at, id).
create or replace function public.social_stories(p_before timestamptz default null, p_before_id uuid default null, p_limit integer default 12)
returns table(published_at timestamptz, story_id uuid, story jsonb) language sql stable security definer set search_path = '' as $fn$
  select s.published_at, s.id, public.story_feed_card(s.id)
  from public.stories s
  where auth.uid() is not null and s.status = 'published' and s.published_at is not null and s.slug is not null
    and not coalesce(public.class_ugc_pair_blocked(auth.uid(), s.user_id), false)
    and (p_before is null or (s.published_at, s.id) < (p_before, coalesce(p_before_id, '00000000-0000-0000-0000-000000000000'::uuid)))
  order by s.published_at desc, s.id desc
  limit least(greatest(coalesce(p_limit, 12), 1), 50)
$fn$;
revoke all on function public.social_stories(timestamptz, uuid, integer) from public, anon;
grant execute on function public.social_stories(timestamptz, uuid, integer) to authenticated;

notify pgrst, 'reload schema';
