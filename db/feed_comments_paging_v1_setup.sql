-- FEED COMMENTS PAGING V1 — phân trang bình luận theo BÌNH LUẬN GỐC (con trỏ seq) cho Social + Thread/TeamLab.
-- Chạy bằng scripts/prod-db.py (MỘT transaction; không begin/commit). Idempotent. CHỈ THÊM hai hàm đọc, KHÔNG sửa bảng/policy/hàm cũ
-- (feed_comment_list, class_comments_for_posts[_safe] giữ nguyên → frontend cũ vẫn chạy; frontend mới tự lùi về hàm cũ nếu chưa có hàm này).
--  1) feed_comment_page(kind, id, before_seq, limit)  — bình luận Thread/TeamLab
--  2) class_comments_page_safe(post, before_seq, limit) — bình luận bài Social (lọc chặn như class_comments_for_posts_safe)
-- Mỗi trang = tối đa p_limit (mặc định 20, trần 50) bình luận GỐC mới hơn con trỏ + MỌI trả lời của chúng → trả lời không bị tách khỏi gốc.
-- Cột thêm: seq (thứ tự ghi), root_seq (seq của gốc), older_roots (số gốc CÒN CŨ HƠN trang này → hasMore), total_count/post_comment_count.
-- Con trỏ tiếp theo = min(root_seq) của trang. Giới hạn 200 cũ không còn ràng buộc.
do $gate$
declare m text[] := '{}';
begin
  if to_regclass('public.feed_comments') is null then m := m || 'bảng feed_comments (Feed Comments V2)'; end if;
  if to_regclass('public.class_post_comments') is null then m := m || 'bảng class_post_comments'; end if;
  if to_regprocedure('public.class_ugc_pair_blocked(uuid,uuid)') is null then m := m || 'hàm class_ugc_pair_blocked (UGC Safety V1)'; end if;
  if to_regprocedure('public.feed_target_visible(text,uuid)') is null then m := m || 'hàm feed_target_visible'; end if;
  if to_regprocedure('public.class_public_identity(uuid)') is null then m := m || 'hàm class_public_identity'; end if;
  if to_regprocedure('public.is_class_member()') is null then m := m || 'hàm is_class_member'; end if;
  if array_length(m, 1) > 0 then raise exception 'DỪNG — thiếu: %', array_to_string(m, '; '); end if;
end $gate$;

create or replace function public.feed_comment_page(p_kind text, p_id uuid, p_before_seq bigint default null, p_limit int default 20)
returns table(id uuid, parent_comment_id uuid, body text, created_at timestamptz, edited_at timestamptz,
              author_user_id uuid, author_name text, author_avatar_url text, author_role text, is_mine boolean, is_hidden boolean,
              seq bigint, root_seq bigint, older_roots int, total_count int)
language sql stable security definer set search_path = '' as $$
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
    and p_kind in ('learning_thread', 'teamlab_publication')
  order by c.seq;
$$;
revoke all on function public.feed_comment_page(text, uuid, bigint, int) from public, anon;
grant execute on function public.feed_comment_page(text, uuid, bigint, int) to authenticated;

create or replace function public.class_comments_page_safe(p_post_id uuid, p_before_seq bigint default null, p_limit int default 20)
returns table(
  id uuid, post_id uuid, parent_comment_id uuid, body text,
  created_at timestamptz, updated_at timestamptz,
  author_user_id uuid, author_name text, author_avatar_url text, author_role text,
  is_mine boolean, is_hidden boolean, tags jsonb, resources jsonb,
  post_comment_count int, seq bigint, root_seq bigint, older_roots int)
language sql stable security definer set search_path = '' as $$
  with recursive vis as (   -- bình luận người hỏi được thấy (ẩn chỉ Thầy thấy)
    select c.id, c.seq, c.parent_comment_id, c.author_user_id from public.class_post_comments c
    where c.post_id = p_post_id and (c.hidden_at is null or public.is_teacher())
  ), roots as (
    -- Gốc tính cả của người bị chặn để con trỏ ổn định; dòng của họ bị lọc ở đầu ra (trả lời của người khác dưới đó vẫn hiện, không mất)
    select v.id, v.seq from vis v
    where v.parent_comment_id is null and (p_before_seq is null or v.seq < p_before_seq)
    order by v.seq desc limit least(greatest(coalesce(p_limit, 20), 1), 50)
  ), older as (
    select count(*)::int as n from vis v where v.parent_comment_id is null and v.seq < (select min(r.seq) from roots r)
  ), tree as (   -- gốc + mọi hậu duệ (trả lời có thể trả lời trả lời) — đi qua cả nút bị chặn để không mất nhánh dưới
    select r.id, r.id as root_id, r.seq as root_seq, 0 as depth from roots r
    union all
    select v.id, t.root_id, t.root_seq, t.depth + 1 from vis v join tree t on v.parent_comment_id = t.id where t.depth < 20
  )
  select c.id, c.post_id, c.parent_comment_id, c.body, c.created_at, c.updated_at,
         c.author_user_id, idn.name, idn.avatar_url, idn.role,
         c.author_user_id = auth.uid(), c.hidden_at is not null,
         coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name) order by t.name)
                     from public.class_comment_tags ct join public.class_tags t on t.id = ct.tag_id
                    where ct.comment_id = c.id), '[]'::jsonb),
         coalesce((select jsonb_agg(jsonb_build_object(
                      'id', r.id, 'resource_type', r.resource_type, 'resource_id', r.resource_id, 'title', r.title_snapshot,
                      'start_seconds', r.start_seconds, 'end_seconds', r.end_seconds, 'excerpt', r.excerpt)
                    order by r.sort_order)
                     from public.class_comment_resources r where r.comment_id = c.id), '[]'::jsonb),
         (select count(*)::int from public.class_post_comments c2
           where c2.post_id = p.id and (c2.hidden_at is null or public.is_teacher())),
         c.seq, tr.root_seq, (select n from older)
  from tree tr
  join public.class_post_comments c on c.id = tr.id
  join public.class_posts p on p.id = c.post_id
  cross join lateral public.class_public_identity(c.author_user_id) idn
  where public.is_class_member()
    and (p.hidden_at is null or public.is_teacher())
    and not public.class_ugc_pair_blocked(auth.uid(), c.author_user_id)
  order by c.seq;
$$;
revoke all on function public.class_comments_page_safe(uuid, bigint, int) from public, anon;
grant execute on function public.class_comments_page_safe(uuid, bigint, int) to authenticated;

notify pgrst, 'reload schema';
