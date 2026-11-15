-- Broadcast V1.1 — người nhận được PHẢN HỒI trực tiếp vào hội thoại do Owner khởi tạo qua Broadcast Chat (kể cả chưa kết bạn).
-- Phạm vi hẹp: chỉ mở thêm MỘT nhánh trong dm_rule (luật nhắn tin nội bộ duy nhất) cho cặp (người gửi chiến dịch Chat, người nhận đã 'sent').
--   • KHÔNG cho học viên ↔ học viên nhắn nhau tự do; KHÔNG đổi friendships; KHÔNG đổi RLS/bảng; người chặn nhau vẫn bị chặn.
--   • Nhánh chỉ có hiệu lực khi tồn tại hàng broadcast_recipients.status='sent' của chiến dịch channel='chat' nối đúng hai người đó.
-- File không có begin/commit (prod-db.py migrate bọc giao dịch).
do $gate$
declare v_src text;
begin
  if to_regclass('public.broadcast_recipients') is null or to_regclass('public.broadcast_campaigns') is null
     or to_regprocedure('public.class_ugc_pair_blocked(uuid,uuid)') is null or to_regprocedure('public.dm_rule(uuid,uuid)') is null then
    raise exception 'DỪNG — thiếu nền Broadcast V1 / dm_rule / class_ugc_pair_blocked';
  end if;
  select p.prosrc into v_src from pg_proc p where p.oid = 'public.dm_rule(uuid,uuid)'::regprocedure;
  if v_src not like '%public.friendships%' then raise exception 'DỪNG — dm_rule khác dự kiến (không còn nhánh friendships)'; end if;
end $gate$;

create or replace function public.dm_rule(p_a uuid, p_b uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select p_a is not null and p_b is not null and p_a <> p_b
    and public.is_class_member_user(p_a) and public.is_class_member_user(p_b)
    and (
      exists (
        select 1 from public.friendships f
         where f.status = 'accepted'
           and least(f.requester_id, f.addressee_id) = least(p_a, p_b)
           and greatest(f.requester_id, f.addressee_id) = greatest(p_a, p_b)
      )
      -- Nhánh Thầy ↔ học viên (quyền thật với lớp): CHƯA triển khai, chờ Owner duyệt helper canonical.
      or (
        -- broadcast_v1_1: hội thoại do Broadcast Chat khởi tạo — người nhận được phản hồi người gửi (và ngược lại), chỉ khi không chặn nhau
        exists (
          select 1 from public.broadcast_recipients r
            join public.broadcast_campaigns c on c.id = r.campaign_id
           where c.channel = 'chat' and r.status = 'sent'
             and ((c.created_by = p_a and r.user_id = p_b) or (c.created_by = p_b and r.user_id = p_a))
        )
        and not public.class_ugc_pair_blocked(p_a, p_b)
      )
    );
$$;
comment on function public.dm_rule(uuid, uuid) is 'dm_v1: luật nhắn tin nội bộ (bạn accepted · broadcast_v1_1: người nhận Broadcast Chat phản hồi người gửi)';
revoke all on function public.dm_rule(uuid, uuid) from public, anon, authenticated;
