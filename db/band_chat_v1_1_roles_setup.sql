-- BAND CHAT V1.1 — vai trò quản trị của nhóm Band ĐỌC TRỰC TIẾP từ TeamLab (không bản sao, không đồng bộ):
--   Trưởng Band (teamlab_band_roles.role = 'leader')  → Chủ nhóm   ('owner')
--   Phó Band    (teamlab_band_roles.role = 'deputy')  → Quản trị viên ('admin')
--   thành viên Band còn lại                           → Thành viên  ('member')
-- Chạy bằng scripts/prod-db.py SAU band_chat_v1_setup.sql (một transaction; KHÔNG begin/commit). Idempotent.
-- Chỉ tạo/thay HÀM — không bảng, không policy, không dữ liệu, không đụng tin nhắn.
--   • Vai trò chỉ có hiệu lực khi người đó CÒN là thành viên Band (hoặc nằm trong ảnh chụp khi Band lưu trữ).
--     Người rời/bị gỡ mà dòng vai trò còn sót → không hiện, không có quyền quản trị.
--   • Biên tập âm nhạc (music_editor) và Trưởng Team KHÔNG sinh quyền quản trị chat.
--   • Tính ở thời điểm gọi → đổi Trưởng/Phó ở TeamLab có hiệu lực ngay ở lần gọi tiếp theo.
--   • bandchat_group_role / bandchat_can_admin là hàm NỘI BỘ (không grant) — nền để mở rộng quyền quản trị về sau.
--     V1.1 chưa có thao tác quản trị nội dung nào dùng chúng.

do $gate$
begin
  if to_regprocedure('public.bandchat_members(uuid)') is null or to_regprocedure('public.bandchat_access(uuid)') is null then
    raise exception 'DỪNG — chưa cài Band Chat V1 (thiếu bandchat_members/bandchat_access)';
  end if;
  if to_regclass('public.teamlab_band_roles') is null
     or (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'teamlab_band_roles'
            and column_name in ('band_id', 'user_id', 'role')) <> 3 then
    raise exception 'DỪNG — thiếu bảng nguồn vai trò teamlab_band_roles (band_id, user_id, role)';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname in ('bandchat_group_role', 'bandchat_can_admin')
                and coalesce(obj_description(p.oid, 'pg_proc'), '') not like 'bandchat_v1:%') then
    raise exception 'DỪNG — đã có hàm bandchat_group_role/bandchat_can_admin không thuộc Band Chat';
  end if;
end $gate$;

-- Vai trò trong nhóm của p_user: 'owner' | 'admin' | 'member' | null (không thuộc nhóm). MỘT chỗ duy nhất quyết vai trò.
create or replace function public.bandchat_group_role(p_band uuid, p_user uuid)
returns text language plpgsql security definer set search_path = '' stable as $$
declare v_archived boolean; v_in boolean;
begin
  if p_band is null or p_user is null then return null; end if;
  select (r.archived_at is not null) into v_archived from public.bandchat_rooms r where r.band_id = p_band;
  if coalesce(v_archived, false) then
    v_in := exists (select 1 from public.bandchat_frozen f where f.band_id = p_band and f.user_id = p_user);
  else
    v_in := exists (select 1 from public.teamlab_band_members m where m.band_id = p_band and m.user_id = p_user);
  end if;
  if not v_in then return null; end if;
  if exists (select 1 from public.teamlab_band_roles x where x.band_id = p_band and x.user_id = p_user and x.role = 'leader') then return 'owner'; end if;
  if exists (select 1 from public.teamlab_band_roles x where x.band_id = p_band and x.user_id = p_user and x.role = 'deputy') then return 'admin'; end if;
  return 'member';
end $$;
comment on function public.bandchat_group_role(uuid, uuid) is 'bandchat_v1: vai trò trong nhóm theo TeamLab (owner|admin|member|null) — nội bộ';
revoke all on function public.bandchat_group_role(uuid, uuid) from public, anon, authenticated;

-- Người GỌI có quyền quản trị nhóm không: chủ nhóm/quản trị viên VÀ đang gửi được (Band hoạt động). Nội bộ — nền cho quản trị về sau.
create or replace function public.bandchat_can_admin(p_band uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select coalesce(auth.uid() is not null
                  and public.bandchat_access(p_band) = 'send'
                  and public.bandchat_group_role(p_band, auth.uid()) in ('owner', 'admin'), false)
$$;
comment on function public.bandchat_can_admin(uuid) is 'bandchat_v1: người gọi là chủ nhóm/quản trị viên (theo TeamLab) — nội bộ';
revoke all on function public.bandchat_can_admin(uuid) from public, anon, authenticated;

-- Thành viên nhóm + vai trò. Thêm cột group_role (cột cũ giữ nguyên nghĩa). Chủ nhóm → quản trị viên → thành viên, rồi theo tên.
drop function if exists public.bandchat_members(uuid);
create function public.bandchat_members(p_band uuid)
returns table(user_id uuid, name text, avatar_url text, role text, group_role text)
language plpgsql security definer set search_path = '' stable as $$
declare v_archived boolean;
begin
  if auth.uid() is null or public.bandchat_access(p_band) is null then
    raise exception 'Không tìm thấy cuộc trò chuyện' using errcode = 'P0002';
  end if;
  select (r.archived_at is not null) into v_archived from public.bandchat_rooms r where r.band_id = p_band;
  return query
  select u.uid, i.name, i.avatar_url, i.role, public.bandchat_group_role(p_band, u.uid)
    from (select m.user_id uid from public.teamlab_band_members m where m.band_id = p_band and not coalesce(v_archived, false)
          union select f.user_id from public.bandchat_frozen f where f.band_id = p_band and coalesce(v_archived, false)) u
    cross join lateral public.class_public_identity(u.uid) i
   order by case public.bandchat_group_role(p_band, u.uid) when 'owner' then 0 when 'admin' then 1 else 2 end, i.name, u.uid
   limit 200;
end $$;
comment on function public.bandchat_members(uuid) is 'bandchat_v1: thành viên nhóm + vai trò theo TeamLab';
revoke all on function public.bandchat_members(uuid) from public, anon;
grant execute on function public.bandchat_members(uuid) to authenticated;
