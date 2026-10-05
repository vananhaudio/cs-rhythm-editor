-- ROLLBACK cho db/friends_ux_v2_setup.sql. Chạy SAU khi frontend đã về bản trước. Idempotent.
-- Không đụng hàng friendships nào. Lời mời đã "Xóa" trong thời gian V2 chạy là hàng đã xoá (không khôi phục được và
-- cũng không cần: hai phía đều về "Kết bạn").

-- respond_friend_request về đúng bản production trước (md5 prosrc a09b7ad5…: từ chối = giữ hàng 'declined')
create or replace function public.respond_friend_request(p_user uuid, p_accept boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_id uuid;
begin
  if v_me is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  if p_accept is null then raise exception 'Thiếu lựa chọn' using errcode = '22023'; end if;
  update public.friendships
     set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
   where requester_id = p_user and addressee_id = v_me and status = 'pending'
  returning id into v_id;
  if v_id is null then raise exception 'Không có lời mời kết bạn này' using errcode = 'P0002'; end if;
  return case when p_accept then 'friends' else 'none' end;
end $$;
revoke all on function public.respond_friend_request(uuid, boolean) from public, anon;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

drop function if exists public.outgoing_friend_requests();

notify pgrst, 'reload schema';
