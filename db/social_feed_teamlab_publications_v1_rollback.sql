-- ROLLBACK: social_feed về bản production trước (class_posts + learning_threads). Không mất dữ liệu (hàm đọc).
-- Rollback frontend TRƯỚC (bỏ thẻ), rồi chạy file này. Nội dung = db/social_classes_v1_setup.sql (hàm social_feed).
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
  ),
  page as (
    select * from items
    where public.is_class_member()
      and (p_before is null or (sort_at, sort_key) < (p_before, coalesce(p_before_key, '')))
    order by sort_at desc, sort_key desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
  )
  select pg.kind, pg.sort_at, pg.sort_key,
         case when pg.kind = 'post' then (
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
           where p.id = pg.id) end,
         case when pg.kind = 'learning_thread' then public.lt_thread_card(pg.tid) end
  from page pg
  order by pg.sort_at desc, pg.sort_key desc;
$$;
grant execute on function public.social_feed(timestamptz, text, int) to authenticated;
notify pgrst, 'reload schema';
