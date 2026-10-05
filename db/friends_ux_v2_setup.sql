-- FRIENDS UX V2 — trang Bạn bè quản lý đủ 3 nhóm (Lời mời kết bạn · Lời mời đã gửi · Tất cả bạn bè) theo mô hình Facebook.
-- Chạy bằng scripts/prod-db.py (một transaction; file không có begin/commit). Idempotent. ADDITIVE:
--   • KHÔNG sửa/xoá hàng friendships nào — cổng cuối file so dấu vân tay toàn bảng trước/sau trong cùng transaction.
--   • Bảng friendships vẫn khoá hoàn toàn (không grant, không policy); mọi thao tác vẫn qua RPC SECURITY DEFINER + auth.uid().
--   • Quyền xem tường (is_friend_of / can_view_wall: chỉ 'accepted') KHÔNG đổi.
--
-- Thay đổi:
--   1) RPC mới outgoing_friend_requests(): lời mời CHÍNH MÌNH đã gửi mà chưa thành bạn (khuôn y hệt incoming_friend_requests).
--      Gồm cả hàng 'declined' cũ (nếu có) — friendship_status vẫn báo 'outgoing' cho người gửi những hàng đó, nên
--      danh sách và nút trên trang cá nhân luôn khớp; "Huỷ lời mời" (unfriend) xoá được chúng như lời mời thường.
--   2) respond_friend_request(p_user, false) = "Xóa" lời mời như Facebook: XOÁ hàng pending (trước: giữ hàng 'declined'
--      và người gửi thấy "Đã gửi lời mời" mãi). Lời mời biến mất ở cả hai phía; hai bên đều gửi lại được.
--      Chấp nhận (p_accept = true) giữ nguyên.

-- 0) Cổng drift + dấu vân tay dữ liệu (trước mọi thay đổi)
do $gate$
declare
  v_respond text := (select md5(p.prosrc) from pg_proc p where p.oid = 'public.respond_friend_request(uuid,boolean)'::regprocedure);
  v_out_comment text := (select coalesce(obj_description(p.oid, 'pg_proc'), '') from pg_proc p join pg_namespace s on s.oid = p.pronamespace
                           where s.nspname = 'public' and p.proname = 'outgoing_friend_requests');
begin
  if v_respond not in ('a09b7ad5f7f402a2a35a7b262f3dd40a', '8f03c840dc8ab3607851c824d40d566e') then
    raise exception 'DỪNG — respond_friend_request trên production khác repo (md5 %)', v_respond;
  end if;
  if v_out_comment is not null and v_out_comment not like 'friends_ux_v2:%' then
    raise exception 'DỪNG — đã có hàm outgoing_friend_requests không thuộc Friends UX V2';
  end if;
  perform set_config('friends_ux_v2.fingerprint', (
    select count(*)::text || ':' || md5(coalesce(string_agg(
             f.id::text || f.requester_id::text || f.addressee_id::text || f.status || f.created_at::text || coalesce(f.responded_at::text, '-'),
             ',' order by f.id), ''))
    from public.friendships f), true);
end $gate$;

-- 1) Lời mời mình đã gửi (chưa thành bạn)
create or replace function public.outgoing_friend_requests()
returns table(user_id uuid, name text, avatar_url text, role text, requested_at timestamptz)
language sql security definer set search_path = '' stable as $$
  select f.addressee_id, idn.name, idn.avatar_url, idn.role, f.created_at
  from public.friendships f
  cross join lateral public.class_public_identity(f.addressee_id) idn
  where public.is_class_member()
    and f.requester_id = auth.uid() and f.status in ('pending', 'declined')
  order by f.created_at desc;
$$;
comment on function public.outgoing_friend_requests() is 'friends_ux_v2: lời mời kết bạn mình đã gửi, chưa được chấp nhận';
revoke all on function public.outgoing_friend_requests() from public, anon;
grant execute on function public.outgoing_friend_requests() to authenticated;

-- 2) Xác nhận / Xóa lời mời đến mình
create or replace function public.respond_friend_request(p_user uuid, p_accept boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_id uuid;
begin
  if v_me is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  if p_accept is null then raise exception 'Thiếu lựa chọn' using errcode = '22023'; end if;
  if p_accept then
    update public.friendships set status = 'accepted', responded_at = now()
     where requester_id = p_user and addressee_id = v_me and status = 'pending'
    returning id into v_id;
  else
    -- "Xóa" như Facebook: lời mời biến mất ở cả hai phía, ai cũng gửi lại được
    delete from public.friendships
     where requester_id = p_user and addressee_id = v_me and status = 'pending'
    returning id into v_id;
  end if;
  if v_id is null then raise exception 'Không có lời mời kết bạn này' using errcode = 'P0002'; end if;
  return case when p_accept then 'friends' else 'none' end;
end $$;
revoke all on function public.respond_friend_request(uuid, boolean) from public, anon;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

-- 3) Cổng cuối: migration không được đụng một hàng friendships nào
do $after$
declare v_now text := (
  select count(*)::text || ':' || md5(coalesce(string_agg(
           f.id::text || f.requester_id::text || f.addressee_id::text || f.status || f.created_at::text || coalesce(f.responded_at::text, '-'),
           ',' order by f.id), ''))
  from public.friendships f);
begin
  if v_now is distinct from current_setting('friends_ux_v2.fingerprint', true) then
    raise exception 'DỪNG — dữ liệu friendships đổi trong migration (% → %)', current_setting('friends_ux_v2.fingerprint', true), v_now;
  end if;
end $after$;

notify pgrst, 'reload schema';
