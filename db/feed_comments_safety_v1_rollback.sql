-- Rollback Feed Comments Safety V1: bỏ trigger + RPC báo cáo, trả feed_comment_list/counts về bản V2 (không lọc chặn). KHÔNG xoá báo cáo đã gửi.
drop trigger if exists feed_comment_report_apply on public.class_reports;
drop function if exists public.feed_comment_report_apply();
drop function if exists public.feed_comment_report(uuid, text, text);
-- Trả hai hàm về bản V2 (không lọc chặn):
create or replace function public.feed_comment_list(p_kind text, p_id uuid, p_limit int default 100)
returns table(id uuid, parent_comment_id uuid, body text, created_at timestamptz, edited_at timestamptz,
              author_user_id uuid, author_name text, author_avatar_url text, author_role text, is_mine boolean, is_hidden boolean)
language sql stable security definer set search_path = '' as $$
  with roots as (
    select c.id from public.feed_comments c
    where c.target_kind = p_kind and c.target_id = p_id and c.parent_comment_id is null and (c.hidden_at is null or public.is_teacher())
    order by c.seq desc limit least(greatest(coalesce(p_limit, 100), 1), 200)
  )
  select c.id, c.parent_comment_id, c.body, c.created_at, c.edited_at, c.author_user_id, idn.name, idn.avatar_url, idn.role,
         c.author_user_id = auth.uid(), c.hidden_at is not null
  from public.feed_comments c
  cross join lateral public.class_public_identity(c.author_user_id) idn
  where public.feed_target_visible(p_kind, p_id)
    and p_kind in ('learning_thread', 'teamlab_publication')
    and c.target_kind = p_kind and c.target_id = p_id
    and (c.hidden_at is null or public.is_teacher())
    and (c.id in (select id from roots) or c.parent_comment_id in (select id from roots))
  order by c.seq;
$$;
revoke all on function public.feed_comment_list(text, uuid, int) from public, anon;
grant execute on function public.feed_comment_list(text, uuid, int) to authenticated;

create or replace function public.feed_comment_counts(p_kinds text[], p_ids uuid[])
returns table(target_kind text, target_id uuid, comment_count int)
language sql stable security definer set search_path = '' as $$
  with req as (
    select distinct k.k as kind, i.i as id
    from unnest(p_kinds) with ordinality as k(k, n) join unnest(p_ids) with ordinality as i(i, n) using (n)
    where k.n <= 100
  )
  select r.kind, r.id,
         (select count(*)::int from public.feed_comments c
           where c.target_kind = r.kind and c.target_id = r.id and (c.hidden_at is null or public.is_teacher()))
  from req r
  where r.kind in ('learning_thread', 'teamlab_publication') and public.feed_target_visible(r.kind, r.id);
$$;
revoke all on function public.feed_comment_counts(text[], uuid[]) from public, anon;
grant execute on function public.feed_comment_counts(text[], uuid[]) to authenticated;
