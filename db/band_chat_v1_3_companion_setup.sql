-- BAND CHAT V1.3 — "Thầy đồng hành": tài khoản Thầy (vananhaudio@gmail.com) ĐỌC + GỬI tin ở mọi nhóm Band hiện có, không cần là thành viên Band.
-- Chạy bằng scripts/prod-db.py SAU band_chat_v1_setup.sql (một transaction; KHÔNG begin/commit). Idempotent.
--   • Chỉ thay thân bandchat_access (cùng chữ ký/grant) + thêm hàm nội bộ bandchat_is_companion(). KHÔNG bảng, KHÔNG dữ liệu, KHÔNG backfill.
--   • Quyền gửi chỉ mở cho ĐÚNG tài khoản Thầy (role teacher/admin VÀ app_users.email khớp) — Thầy/Admin khác vẫn chỉ ĐỌC.
--   • Chỉ cho Band còn tồn tại (teamlab_bands) và chưa lưu trữ. Band lưu trữ vẫn chỉ đọc.
--   • KHÔNG thêm Thầy vào teamlab_band_members (luật một người một Band không đụng tới); không là Chủ nhóm/Quản trị viên
--     (bandchat_can_admin cần bandchat_group_role, mà vai trò đòi là thành viên Band) → không quản lý nhóm/thành viên/tin người khác.
--   • Người gửi hiển thị đúng tên Thầy (class_public_identity(sender_id) như mọi thành viên).

do $gate$
begin
  if to_regprocedure('public.bandchat_access(uuid)') is null or to_regprocedure('public.bandchat_send(uuid, text)') is null
     or to_regclass('public.teamlab_bands') is null or to_regclass('public.app_users') is null then
    raise exception 'DỪNG — chưa cài Band Chat V1 (thiếu bandchat_access/bandchat_send/teamlab_bands/app_users)';
  end if;
end $gate$;

-- Một chỗ duy nhất quyết "ai là Thầy đồng hành" (đổi người = sửa hàm này). Nội bộ, không grant.
create or replace function public.bandchat_is_companion()
returns boolean language sql security definer set search_path = '' stable as $$
  select auth.uid() is not null and exists (
    select 1 from public.app_users au
     where au.id = auth.uid() and au.role in ('teacher', 'admin') and lower(au.email) = 'vananhaudio@gmail.com')
$$;
comment on function public.bandchat_is_companion() is 'bandchat_v1: người gọi là tài khoản Thầy đồng hành (đọc+gửi mọi nhóm Band) — nội bộ';
revoke all on function public.bandchat_is_companion() from public, anon, authenticated;

create or replace function public.bandchat_access(p_band uuid)
returns text language plpgsql security definer set search_path = '' stable as $$
begin
  if auth.uid() is null or p_band is null then return null; end if;
  if exists (select 1 from public.bandchat_rooms r where r.band_id = p_band and r.archived_at is not null) then
    if exists (select 1 from public.bandchat_frozen f where f.band_id = p_band and f.user_id = auth.uid()) or public.is_teacher() then return 'read'; end if;
    return null;
  end if;
  if exists (select 1 from public.teamlab_band_members m where m.band_id = p_band and m.user_id = auth.uid()) then return 'send'; end if;
  if public.is_teacher() then
    if public.bandchat_is_companion() and exists (select 1 from public.teamlab_bands b where b.id = p_band) then return 'send'; end if;
    return 'read';
  end if;
  return null;
end $$;
comment on function public.bandchat_access(uuid) is 'bandchat_v1: quyền của người gọi với nhóm (null|read|send); V1.3: Thầy đồng hành gửi được mọi Band còn tồn tại';
revoke all on function public.bandchat_access(uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';
