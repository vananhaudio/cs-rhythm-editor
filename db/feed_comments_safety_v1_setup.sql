-- FEED COMMENTS SAFETY V1 — bình luận Thread/TeamLab (feed_comments) theo cơ chế kiểm duyệt UGC có sẵn (Apple 1.2).
-- Chạy bằng scripts/prod-db.py (MỘT transaction; không begin/commit). Idempotent. Không sửa hàm/bảng của class_ugc_safety_v1.
--  1) feed_comment_list / feed_comment_counts: ẩn bình luận của người có chặn nhau với mình (và trả lời dưới bình luận bị ẩn vì chặn).
--  2) feed_comment_report: Báo cáo bình luận → class_reports (kind 'comment', cùng hàng đợi của Thầy; trùng/giới hạn/không tự báo cáo như class_report_submit).
--  3) Trigger trên class_reports: Thầy xử lý "hide"/"hide_and_block" một báo cáo comment → ẩn feed_comments tương ứng
--     (class_report_resolve chỉ ẩn bảng class_post_comments; id feed_comments không có ở đó nên nó bỏ qua êm).
do $gate$
declare m text[] := '{}';
begin
  if to_regclass('public.feed_comments') is null then m := m || 'bảng feed_comments (Feed Comments V2)'; end if;
  if to_regclass('public.class_reports') is null then m := m || 'bảng class_reports (UGC Safety V1)'; end if;
  if to_regprocedure('public.class_ugc_pair_blocked(uuid,uuid)') is null then m := m || 'hàm class_ugc_pair_blocked'; end if;
  if to_regprocedure('public.feed_target_visible(text,uuid)') is null then m := m || 'hàm feed_target_visible'; end if;
  if to_regprocedure('public.class_public_identity(uuid)') is null then m := m || 'hàm class_public_identity'; end if;
  if array_length(m, 1) > 0 then raise exception 'DỪNG — thiếu: %', array_to_string(m, '; '); end if;
end $gate$;

create or replace function public.feed_comment_list(p_kind text, p_id uuid, p_limit int default 100)
returns table(id uuid, parent_comment_id uuid, body text, created_at timestamptz, edited_at timestamptz,
              author_user_id uuid, author_name text, author_avatar_url text, author_role text, is_mine boolean, is_hidden boolean)
language sql stable security definer set search_path = '' as $$
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
    and p_kind in ('learning_thread', 'teamlab_publication')
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
           where c.target_kind = r.kind and c.target_id = r.id and (c.hidden_at is null or public.is_teacher())
             and not public.class_ugc_pair_blocked(auth.uid(), c.author_user_id)
             and (c.parent_comment_id is null or not exists (
                   select 1 from public.feed_comments pc
                   where pc.id = c.parent_comment_id and public.class_ugc_pair_blocked(auth.uid(), pc.author_user_id))))
  from req r
  where r.kind in ('learning_thread', 'teamlab_publication') and public.feed_target_visible(r.kind, r.id);
$$;
revoke all on function public.feed_comment_counts(text[], uuid[]) from public, anon;
grant execute on function public.feed_comment_counts(text[], uuid[]) to authenticated;

-- Báo cáo bình luận feed_comments (người báo cáo phải THẤY được bình luận; lỗi chung, không lộ sự tồn tại)
create or replace function public.feed_comment_report(p_comment uuid, p_reason text, p_note text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid(); v_reason text := lower(btrim(coalesce(p_reason, ''))); v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_tid text := lower(p_comment::text); c record; v_id bigint; v_n int;
begin
  if v_me is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  if v_reason not in ('spam', 'harassment', 'inappropriate', 'hate', 'sexual', 'violence', 'other') then raise exception 'Lý do không hợp lệ' using errcode = '22023'; end if;
  if v_note is not null and char_length(v_note) > 500 then raise exception 'Ghi chú quá dài (tối đa 500 ký tự)' using errcode = '22023'; end if;
  select x.author_user_id, left(x.body, 200) as excerpt into c
    from public.feed_comments x
   where x.id = p_comment and (x.hidden_at is null or public.is_teacher()) and public.feed_target_visible(x.target_kind, x.target_id);
  if not found then raise exception 'Không tìm thấy nội dung cần báo cáo' using errcode = 'P0002'; end if;
  if c.author_user_id = v_me then raise exception 'Không thể báo cáo chính mình' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_me::text || '|comment|' || v_tid, 21));
  select r.id into v_id from public.class_reports r where r.reporter_id = v_me and r.kind = 'comment' and r.target_id = v_tid and r.status = 'new';
  if v_id is not null then return v_id; end if;
  select count(*) into v_n from public.class_reports r where r.reporter_id = v_me and r.created_at > now() - interval '1 hour';
  if v_n >= 20 then raise exception 'Bạn gửi báo cáo quá nhanh. Hãy thử lại sau.' using errcode = '54000'; end if;
  insert into public.class_reports (reporter_id, kind, target_id, target_user_id, reason, note, excerpt)
  values (v_me, 'comment', v_tid, c.author_user_id, v_reason, v_note, c.excerpt) returning id into v_id;
  return v_id;
end $$;
comment on function public.feed_comment_report(uuid, text, text) is 'feed_comments_safety_v1: báo cáo bình luận Thread/TeamLab';
revoke all on function public.feed_comment_report(uuid, text, text) from public, anon;
grant execute on function public.feed_comment_report(uuid, text, text) to authenticated;

-- Thầy xử lý báo cáo bằng hide/hide_and_block → ẩn bình luận feed_comments (nếu đối tượng là bình luận của bảng này)
create or replace function public.feed_comment_report_apply()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'comment' and new.status = 'handled' and new.handled_action in ('hide', 'hide_and_block')
     and old.status is distinct from 'handled' then
    update public.feed_comments c set hidden_at = coalesce(c.hidden_at, now()), hidden_by = coalesce(c.hidden_by, new.handled_by)
     where c.id::text = new.target_id and c.hidden_at is null;
  end if;
  return new;
end $$;
revoke all on function public.feed_comment_report_apply() from public, anon, authenticated;
drop trigger if exists feed_comment_report_apply on public.class_reports;
create trigger feed_comment_report_apply after update of status on public.class_reports
  for each row execute function public.feed_comment_report_apply();
