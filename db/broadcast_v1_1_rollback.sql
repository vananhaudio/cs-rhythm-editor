-- Rollback Broadcast V1.1: trả dm_rule về luật chỉ-bạn-bè (dm_v1). Tin nhắn đã gửi giữ nguyên.
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
    );
$$;
comment on function public.dm_rule(uuid, uuid) is 'dm_v1: luật nhắn tin nội bộ (bạn accepted)';
revoke all on function public.dm_rule(uuid, uuid) from public, anon, authenticated;
