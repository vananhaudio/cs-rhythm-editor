-- ═══════════════════════════════════════════════════════════════════════════
-- 1001 CÂU CHUYỆN — THÍCH + BÌNH LUẬN (Lát 3): loại mục 'story' trong CHÍNH feed_likes / feed_comments.
-- Không bảng mới. target_id = stories.id → Feed và trang đọc dùng chung một nguồn. Kiểm duyệt, chặn, báo cáo: cơ chế sẵn có.
-- Cần story_privacy_v1 trước. Hoàn tác: story_engagement_v1_rollback.sql (giữ dữ liệu người dùng, KHÔNG đụng bản vá riêng tư).
-- Hàm dựng từ định nghĩa ĐANG CHẠY trên production. CHẠY: prod-db.py dryrun → migrate. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '3s';

do $need$ begin
  if to_regprocedure('public.story_owner_id(uuid)') is null then raise exception 'STORY_ENGAGE_GATE: chạy story_privacy_v1 trước'; end if;
end $need$;

do $gate$
declare r record;
begin
  for r in select * from (values
    ('feed_target_visible', 'a5a4c37461b2021546afe8de470eaa56'),
    ('feed_like_summary', '11b8e852c79e2c0b151a432142c6d317'),
    ('feed_comment_add', 'f46b8b72395a8d0963906b4283f2b744'),
    ('feed_comment_list', '922aada7d303eefa31402c9fef60de38'),
    ('feed_comment_page', '7dfa1267ad7aad5d365760b8191f817a'),
    ('feed_comment_counts', 'cf855eee034e9ec06dc8d04fafec3d2d'),
    ('feed_comment_edit', 'ffdb37e7adf11dde9a390cfd32b3c04a'),
    ('feed_comment_delete', '05c50d3ee9910ce4236dd64087754474')
  ) v(fn, h) loop
    if not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = r.fn
                   and (md5(p.prosrc) = r.h or position('''story''' in p.prosrc) > 0)) then
      raise exception 'STORY_ENGAGE_GATE: % đã đổi so với bản dùng để viết migration. Dựng lại từ bản mới.', r.fn;
    end if;
  end loop;
end
$gate$;

alter table public.feed_likes drop constraint if exists feed_likes_kind_check;
alter table public.feed_likes add constraint feed_likes_kind_check
  check (target_kind in ('post', 'learning_thread', 'teamlab_publication', 'story'));
alter table public.feed_comments drop constraint if exists feed_comments_kind_check;
alter table public.feed_comments add constraint feed_comments_kind_check
  check (target_kind in ('learning_thread', 'teamlab_publication', 'story'));

CREATE OR REPLACE FUNCTION public.feed_target_visible(p_kind text, p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select auth.uid() is not null and public.is_class_member() and case p_kind
    when 'post' then exists (
      select 1 from public.class_posts p
      where p.id = p_id and (p.hidden_at is null or public.is_teacher())
        and (p.audience = 'class' or p.author_user_id = auth.uid() or public.is_teacher() or public.is_friend_of(p.author_user_id)))
    when 'learning_thread' then exists (
      select 1 from public.learning_threads t
      where t.id = p_id and t.visibility = 'community' and t.hidden_at is null and t.archived_at is null)
    when 'teamlab_publication' then exists (
      select 1 from public.teamlab_publications pb
      where pb.id = p_id and pb.status = 'published' and pb.published_at is not null and pb.public_slug is not null)
    when 'story' then exists (   -- chỉ bài đang đăng; chặn nhau với người kể → không thấy
      select 1 from public.stories st
      where st.id = p_id and st.status = 'published' and st.slug is not null
        and not coalesce(public.class_ugc_pair_blocked(auth.uid(), public.story_owner_id(st.id)), false))
    else false end;
$function$;

CREATE OR REPLACE FUNCTION public.feed_like_summary(p_kinds text[], p_ids uuid[])
 RETURNS TABLE(target_kind text, target_id uuid, like_count integer, liked boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with req as (
    select distinct k.k as kind, i.i as id
    from unnest(p_kinds) with ordinality as k(k, n)
    join unnest(p_ids) with ordinality as i(i, n) using (n)
    where k.n <= 100
  )
  select r.kind, r.id,
         (select count(*)::int from public.feed_likes l where l.target_kind = r.kind and l.target_id = r.id),
         exists (select 1 from public.feed_likes l where l.target_kind = r.kind and l.target_id = r.id and l.user_id = auth.uid())
  from req r
  where r.kind in ('post', 'learning_thread', 'teamlab_publication', 'story') and public.feed_target_visible(r.kind, r.id);
$function$;

CREATE OR REPLACE FUNCTION public.feed_comment_add(p_kind text, p_id uuid, p_body text, p_parent uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_me uuid := auth.uid(); v_body text := btrim(coalesce(p_body, '')); v_new uuid;
begin
  if v_me is null then raise exception 'FEED_AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_kind not in ('learning_thread', 'teamlab_publication', 'story') then raise exception 'FEED_BAD_KIND' using errcode = '22023'; end if;
  if char_length(v_body) not between 1 and 2000 then raise exception 'FEED_BAD_BODY' using errcode = '23514'; end if;
  if not public.feed_target_visible(p_kind, p_id) then raise exception 'FEED_NOT_VISIBLE' using errcode = '42501'; end if;
  if p_parent is not null and not exists (   -- trả lời MỘT cấp: cha phải là bình luận gốc, cùng mục, đang hiển thị
    select 1 from public.feed_comments c
    where c.id = p_parent and c.target_kind = p_kind and c.target_id = p_id and c.parent_comment_id is null
      and (c.hidden_at is null or public.is_teacher())) then
    raise exception 'FEED_BAD_PARENT' using errcode = '23514';
  end if;
  perform public.feed_comment_guard(v_me, v_body);
  insert into public.feed_comments (target_kind, target_id, parent_comment_id, author_user_id, body)
  values (p_kind, p_id, p_parent, v_me, v_body) returning id into v_new;
  return v_new;
end $function$;

CREATE OR REPLACE FUNCTION public.feed_comment_list(p_kind text, p_id uuid, p_limit integer DEFAULT 100)
 RETURNS TABLE(id uuid, parent_comment_id uuid, body text, created_at timestamp with time zone, edited_at timestamp with time zone, author_user_id uuid, author_name text, author_avatar_url text, author_role text, is_mine boolean, is_hidden boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with ok as (
    select c.* from public.feed_comments c
    where c.target_kind = p_kind and c.target_id = p_id
      and (c.hidden_at is null or public.is_teacher())
      and not public.class_ugc_pair_blocked(auth.uid(), c.author_user_id)
      and (c.parent_comment_id is null or not exists (
            select 1 from public.feed_comments pc
            where pc.id = c.parent_comment_id and public.class_ugc_pair_blocked(auth.uid(), pc.author_user_id)))
  ), roots as (
    select o.id from ok o where o.parent_comment_id is null
    order by o.seq desc limit least(greatest(coalesce(p_limit, 100), 1), 200)
  )
  select c.id, c.parent_comment_id, c.body, c.created_at, c.edited_at, c.author_user_id, idn.name, idn.avatar_url, idn.role,
         c.author_user_id = auth.uid(), c.hidden_at is not null
  from ok c
  cross join lateral public.class_public_identity(c.author_user_id) idn
  where public.feed_target_visible(p_kind, p_id)
    and p_kind in ('learning_thread', 'teamlab_publication', 'story')
    and (c.id in (select id from roots) or c.parent_comment_id in (select id from roots))
  order by c.seq;
$function$;

CREATE OR REPLACE FUNCTION public.feed_comment_page(p_kind text, p_id uuid, p_before_seq bigint DEFAULT NULL::bigint, p_limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, parent_comment_id uuid, body text, created_at timestamp with time zone, edited_at timestamp with time zone, author_user_id uuid, author_name text, author_avatar_url text, author_role text, is_mine boolean, is_hidden boolean, seq bigint, root_seq bigint, older_roots integer, total_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with ok as (   -- cùng bộ lọc với feed_comment_list (Safety V1): ẩn, người chặn nhau, trả lời dưới bình luận bị chặn
    select c.* from public.feed_comments c
    where c.target_kind = p_kind and c.target_id = p_id
      and (c.hidden_at is null or public.is_teacher())
      and not public.class_ugc_pair_blocked(auth.uid(), c.author_user_id)
      and (c.parent_comment_id is null or not exists (
            select 1 from public.feed_comments pc
            where pc.id = c.parent_comment_id and public.class_ugc_pair_blocked(auth.uid(), pc.author_user_id)))
  ), roots as (
    select o.id, o.seq from ok o
    where o.parent_comment_id is null and (p_before_seq is null or o.seq < p_before_seq)
    order by o.seq desc limit least(greatest(coalesce(p_limit, 20), 1), 50)
  ), older as (
    select count(*)::int as n from ok o where o.parent_comment_id is null and o.seq < (select min(r.seq) from roots r)
  ), tot as (select count(*)::int as n from ok)
  select c.id, c.parent_comment_id, c.body, c.created_at, c.edited_at, c.author_user_id, idn.name, idn.avatar_url, idn.role,
         c.author_user_id = auth.uid(), c.hidden_at is not null,
         c.seq, r.seq, (select n from older), (select n from tot)
  from ok c
  join roots r on r.id = coalesce(c.parent_comment_id, c.id)
  cross join lateral public.class_public_identity(c.author_user_id) idn
  where public.feed_target_visible(p_kind, p_id)
    and p_kind in ('learning_thread', 'teamlab_publication', 'story')
  order by c.seq;
$function$;

CREATE OR REPLACE FUNCTION public.feed_comment_counts(p_kinds text[], p_ids uuid[])
 RETURNS TABLE(target_kind text, target_id uuid, comment_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with req as (
    select distinct k.k as kind, i.i as id
    from unnest(p_kinds) with ordinality as k(k, n) join unnest(p_ids) with ordinality as i(i, n) using (n)
    where k.n <= 100
  )
  select r.kind, r.id,
         (select count(*)::int from public.feed_comments c
           where c.target_kind = r.kind and c.target_id = r.id and (c.hidden_at is null or public.is_teacher())
             and not public.class_ugc_pair_blocked(auth.uid(), c.author_user_id)
             and (c.parent_comment_id is null or not exists (
                   select 1 from public.feed_comments pc
                   where pc.id = c.parent_comment_id and public.class_ugc_pair_blocked(auth.uid(), pc.author_user_id))))
  from req r
  where r.kind in ('learning_thread', 'teamlab_publication', 'story') and public.feed_target_visible(r.kind, r.id);
$function$;

CREATE OR REPLACE FUNCTION public.feed_comment_edit(p_kind text, p_comment uuid, p_body text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_me uuid := auth.uid(); v_body text := btrim(coalesce(p_body, '')); n int;
begin
  if v_me is null then raise exception 'FEED_AUTH_REQUIRED' using errcode = '28000'; end if;
  if char_length(v_body) not between 1 and 2000 then raise exception 'FEED_BAD_BODY' using errcode = '23514'; end if;
  if p_kind = 'post' then
    update public.class_post_comments c set body = v_body
     where c.id = p_comment and c.author_user_id = v_me and public.class_post_visible(c.post_id);
  elsif p_kind in ('learning_thread', 'teamlab_publication', 'story') then
    perform public.feed_comment_guard(v_me, v_body);
    update public.feed_comments c set body = v_body, edited_at = clock_timestamp()
     where c.id = p_comment and c.author_user_id = v_me and c.target_kind = p_kind and public.feed_target_visible(c.target_kind, c.target_id);
  else raise exception 'FEED_BAD_KIND' using errcode = '22023'; end if;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'FEED_NOT_FOUND' using errcode = 'P0002'; end if;
end $function$;

CREATE OR REPLACE FUNCTION public.feed_comment_delete(p_kind text, p_comment uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_me uuid := auth.uid(); n int;
begin
  if v_me is null then raise exception 'FEED_AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_kind = 'post' then
    delete from public.class_post_comments c where c.id = p_comment and c.author_user_id = v_me;
  elsif p_kind in ('learning_thread', 'teamlab_publication', 'story') then
    delete from public.feed_comments c where c.id = p_comment and c.author_user_id = v_me and c.target_kind = p_kind;
  else raise exception 'FEED_BAD_KIND' using errcode = '22023'; end if;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'FEED_NOT_FOUND' using errcode = 'P0002'; end if;
end $function$;

notify pgrst, 'reload schema';
