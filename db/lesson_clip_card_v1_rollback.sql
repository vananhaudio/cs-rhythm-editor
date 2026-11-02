-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK lesson_clip_card_v1: khôi phục NGUYÊN VĂN hai hàm Feed về bản production đã xác minh 01/11
-- (social_feed md5 2697eb50daaf7c085da22adaddc2baa2 · social_feed_scoped md5 47bf0f5f3382086d19ad6d0b184644cc), rồi gỡ hai hàm nội bộ.
-- Ưu tiên rollback FRONTEND trước (thẻ biến mất ngay, DB vô hại). KHÔNG mất dữ liệu (migration không ghi dữ liệu). Idempotent.
-- CỔNG: chỉ chạy khi hai hàm đang đúng bản G3 (md5 91e32e8ba809cda3b28c6a8964d43efa / f79d95d5d7ce80a7a044513b2d1e086d) hoặc đã là bản gốc.
--   Nếu dự án khác đã đổi hai hàm sau G3 ⇒ DỪNG, KHÔNG ghi đè (báo Owner, gộp tay).
-- CHẠY: scripts/prod-db.py dryrun|migrate (file KHÔNG có begin/commit).
-- ═══════════════════════════════════════════════════════════════════════════
do $gate$
declare v_feed text; v_scoped text; v_bad text[] := '{}';
begin
  select string_agg(md5(p.prosrc), ',') into v_feed from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'social_feed';
  select string_agg(md5(p.prosrc), ',') into v_scoped from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'social_feed_scoped';
  if v_feed is null or not (v_feed = any (array['91e32e8ba809cda3b28c6a8964d43efa', '2697eb50daaf7c085da22adaddc2baa2'])) then v_bad := v_bad || format('social_feed md5 %s lạ', v_feed); end if;
  if v_scoped is null or not (v_scoped = any (array['f79d95d5d7ce80a7a044513b2d1e086d', '47bf0f5f3382086d19ad6d0b184644cc'])) then v_bad := v_bad || format('social_feed_scoped md5 %s lạ', v_scoped); end if;
  if array_length(v_bad, 1) > 0 then raise exception 'LESSON_CLIP_ROLLBACK_GATE_FAIL (không ghi đè hàm đã đổi): %', array_to_string(v_bad, '; '); end if;
end
$gate$;

create or replace function public.social_feed(
  p_before     timestamptz default null,
  p_before_key text        default null,
  p_limit      int         default 20
)
returns table(kind text, sort_at timestamptz, sort_key text, post jsonb, thread jsonb)
language sql stable security definer set search_path = '' as $$
  with items as (
    select 'post'::text as kind, p.created_at as sort_at, 'p:' || p.id::text as sort_key, p.id, null::uuid as tid
    from public.class_posts p
    where (p.audience = 'class' and (p.hidden_at is null or public.is_teacher()))
       or (p.audience = 'friends' and p.hidden_at is null
           and (p.author_user_id = auth.uid() or public.is_friend_of(p.author_user_id)))
    union all
    select 'learning_thread', t.last_event_at, 't:' || t.id::text, null::uuid, t.id
    from public.learning_threads t
    where t.visibility = 'community' and t.hidden_at is null and t.archived_at is null and t.last_event_at is not null
    union all
    select 'teamlab_publication', pb.published_at, 'u:' || pb.id::text, pb.id, null::uuid
    from public.teamlab_publications pb
    where pb.status = 'published' and pb.published_at is not null and pb.public_slug is not null
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
         end,
         case when pg.kind = 'learning_thread' then public.lt_thread_card(pg.tid) end
  from page pg
  order by pg.sort_at desc, pg.sort_key desc;
$$;
grant execute on function public.social_feed(timestamptz, text, int) to authenticated;

create or replace function public.social_feed_scoped(
  p_scope      text,
  p_before     timestamptz default null,
  p_before_key text        default null,
  p_limit      int         default 20
)
returns table(kind text, sort_at timestamptz, sort_key text, post jsonb, thread jsonb)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare v_me uuid := auth.uid();
begin
  if p_scope = 'for_you' then
    return query select * from public.social_feed(p_before, p_before_key, p_limit);
    return;
  end if;
  if p_scope is null or p_scope not in ('my_classes', 'friends') then
    raise exception 'SF_BAD_SCOPE' using errcode = '22023';
  end if;
  if v_me is null or not public.is_class_member() then return; end if;

  return query
  with my_class as (          -- lớp HIỆN TẠI của tôi: đúng luật social_my_classes
    select cs.id from public.class_schedule cs
    where p_scope = 'my_classes' and coalesce(cs.status, '') not in ('cancelled', 'merged', 'draft')
      and public.social_class_is_member(cs.id, v_me)
  ),
  friend as (                 -- bạn bè ĐÃ CHẤP NHẬN (không pending/declined; không chính mình)
    select case when f.requester_id = v_me then f.addressee_id else f.requester_id end as uid
    from public.friendships f
    where p_scope = 'friends' and f.status = 'accepted' and v_me in (f.requester_id, f.addressee_id)
  ),
  items as (
    select 'learning_thread'::text as k, t.last_event_at as at, 't:' || t.id::text as sk, null::uuid as pid, t.id as tid
    from public.learning_threads t
    where t.visibility = 'community' and t.hidden_at is null and t.archived_at is null and t.last_event_at is not null
      and ((p_scope = 'my_classes' and t.class_schedule_id in (select id from my_class))
        or (p_scope = 'friends' and t.learner_user_id in (select uid from friend)))
    union all
    select 'post', p.created_at, 'p:' || p.id::text, p.id, null::uuid
    from public.class_posts p
    where p_scope = 'friends' and p.author_user_id in (select uid from friend)
      and ((p.audience = 'class' and (p.hidden_at is null or public.is_teacher()))
        or (p.audience = 'friends' and p.hidden_at is null))
  ),
  page as (
    select * from items i
    where p_before is null or (i.at, i.sk) < (p_before, coalesce(p_before_key, ''))
    order by i.at desc, i.sk desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
  )
  select pg.k, pg.at, pg.sk,
         case when pg.k = 'post' then public.social_post_card(pg.pid) end,
         case when pg.k = 'learning_thread' then public.lt_thread_card(pg.tid) end
  from page pg
  order by pg.at desc, pg.sk desc;
end $$;
revoke all on function public.social_feed_scoped(text, timestamptz, text, int) from public, anon;
grant execute on function public.social_feed_scoped(text, timestamptz, text, int) to authenticated;

drop function if exists public.social_feed_clip_items(uuid[]);
drop function if exists public.social_clip_added_at(text);

do $verify$
begin
  if (select string_agg(md5(p.prosrc), ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'social_feed') <> '2697eb50daaf7c085da22adaddc2baa2'
     or (select string_agg(md5(p.prosrc), ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'social_feed_scoped') <> '47bf0f5f3382086d19ad6d0b184644cc' then
    raise exception 'LESSON_CLIP_ROLLBACK_VERIFY_FAIL: md5 sau rollback không khớp bản gốc';
  end if;
end
$verify$;
notify pgrst, 'reload schema';
