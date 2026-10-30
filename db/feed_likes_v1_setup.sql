-- ═══════════════════════════════════════════════════════════════════════════
-- CLASS SOCIAL — FEED LIKES V1 (Thích) cho ba nguồn Feed: bài Social, Learning Thread, bài TeamLab đã xuất bản.
-- ADDITIVE: 1 bảng + 2 RPC + 1 hàm kiểm quyền thấy. KHÔNG sửa social_feed / social_feed_scoped / lt_* / RLS bảng hiện có.
--   • Định danh mục tiêu (target_kind, target_id): 'post' = class_posts.id · 'learning_thread' = learning_threads.id ·
--     'teamlab_publication' = teamlab_publications.id (đúng id trong payload Feed). Không FK (đa hình); mồ côi vô hại vì
--     RPC chỉ trả mục còn THẤY ĐƯỢC.
--   • Mỗi tài khoản tối đa MỘT lượt/mục (PK). Ghi theo TRẠNG THÁI MONG MUỐN (set), không toggle → bấm đúp/retry mạng idempotent.
--   • Bảng không policy, không quyền cho anon/authenticated: mọi đường đi qua RPC security definer có kiểm quyền thấy mục.
--   • Kiểm quyền thấy = đúng luật Feed hiện hành (class_posts_member_read; thread community chưa ẩn/lưu trữ; publication published).
-- Rollback: db/feed_likes_v1_rollback.sql (xoá cả lượt thích). CHẠY: prod-db.py (file KHÔNG có begin/commit).
-- ═══════════════════════════════════════════════════════════════════════════

do $gate$
declare v_miss text[] := '{}';
begin
  if to_regclass('public.class_posts') is null then v_miss := v_miss || 'class_posts'; end if;
  if to_regclass('public.learning_threads') is null then v_miss := v_miss || 'learning_threads'; end if;
  if to_regclass('public.teamlab_publications') is null then v_miss := v_miss || 'teamlab_publications'; end if;
  if to_regprocedure('public.is_class_member()') is null then v_miss := v_miss || 'is_class_member()'; end if;
  if to_regprocedure('public.is_teacher()') is null then v_miss := v_miss || 'is_teacher()'; end if;
  if to_regprocedure('public.is_friend_of(uuid)') is null then v_miss := v_miss || 'is_friend_of(uuid)'; end if;
  if cardinality(v_miss) > 0 then
    raise exception 'FEED_LIKES_GATE_FAIL: thiếu %', array_to_string(v_miss, ', ');
  end if;
end
$gate$;

create table if not exists public.feed_likes (
  target_kind text        not null,
  target_id   uuid        not null,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default clock_timestamp(),
  constraint feed_likes_pk primary key (target_kind, target_id, user_id),
  constraint feed_likes_kind_check check (target_kind in ('post', 'learning_thread', 'teamlab_publication'))
);
create index if not exists feed_likes_user_idx on public.feed_likes (user_id, created_at desc);

alter table public.feed_likes enable row level security;
-- Production có default privileges cấp mọi quyền cho anon/authenticated → thu hồi tường minh.
revoke all on table public.feed_likes from public, anon, authenticated;

-- Người đang gọi có THẤY mục này trên Feed không (và do đó được thích)?
create or replace function public.feed_target_visible(p_kind text, p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
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
    else false end;
$$;
revoke all on function public.feed_target_visible(text, uuid) from public, anon, authenticated;

-- Đặt trạng thái Thích của TÔI cho một mục. Trả {liked, count}. Không thấy mục → FEED_NOT_VISIBLE (không lộ lý do).
create or replace function public.feed_like_set(p_kind text, p_id uuid, p_liked boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_count int;
begin
  if v_me is null then raise exception 'FEED_AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_kind is null or p_id is null or p_liked is null then raise exception 'FEED_BAD_ARGS' using errcode = '22023'; end if;
  if not public.feed_target_visible(p_kind, p_id) then raise exception 'FEED_NOT_VISIBLE' using errcode = '42501'; end if;
  if p_liked then
    insert into public.feed_likes (target_kind, target_id, user_id) values (p_kind, p_id, v_me) on conflict do nothing;
  else
    delete from public.feed_likes where target_kind = p_kind and target_id = p_id and user_id = v_me;
  end if;
  select count(*)::int into v_count from public.feed_likes where target_kind = p_kind and target_id = p_id;
  return jsonb_build_object('liked', p_liked, 'count', v_count);
end;
$$;
revoke all on function public.feed_like_set(text, uuid, boolean) from public, anon;
grant execute on function public.feed_like_set(text, uuid, boolean) to authenticated;

-- Tóm tắt Thích theo LÔ (một lần gọi cho cả trang Feed). Mục không thấy được → không có hàng. Tối đa 100 mục/lần.
create or replace function public.feed_like_summary(p_kinds text[], p_ids uuid[])
returns table(target_kind text, target_id uuid, like_count int, liked boolean)
language sql stable security definer set search_path = '' as $$
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
  where r.kind in ('post', 'learning_thread', 'teamlab_publication') and public.feed_target_visible(r.kind, r.id);
$$;
revoke all on function public.feed_like_summary(text[], uuid[]) from public, anon;
grant execute on function public.feed_like_summary(text[], uuid[]) to authenticated;
