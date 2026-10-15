-- PLAY SCROLL VIDEO V1 — Cổng C: kiểm quyền XUẤT video (clip 14 giây / Full). Chạy bằng scripts/prod-db.py (một transaction; KHÔNG begin/commit).
-- Chính sách Owner: mọi thành viên HIỆN TẠI của Band xuất bài của chính Band đó (14 giây); bài không Band và Full chỉ Admin (is_admin()).
-- Mặc định MỞ cho mọi Band; công tắc tổng khẩn cấp = tool_capabilities(chordlib, <role>, export_video).allowed — Admin không bị ảnh hưởng.
--   (1) public.chord_video_export_eval(uid, version, mode): lõi quyết định, KHÔNG cấp cho ai (kiểm thử và gọi từ hàm (2)).
--   (2) public.chord_video_export_ok(version, mode): cổng cho trình duyệt; danh tính chỉ từ auth.uid().
--   (3) 2 dòng tool_capabilities export_video = true (student, teacher).
-- KHÔNG đổi: chord_sheet_get, chord_share_ok, dm_share, RLS, bảng/cột. Không ghi bảng nào khi gọi.
-- Giới hạn: video dựng trên máy người dùng từ dữ liệu họ đã xem — cổng này kiểm soát CHỨC NĂNG XUẤT, không ngăn ghi màn hình.

do $gate$
begin
  if to_regprocedure('public.chord_share_ok(uuid)') is null or to_regprocedure('public.is_admin()') is null
     or to_regclass('public.teamlab_band_members') is null or to_regclass('public.chord_sheets') is null
     or to_regclass('public.chord_sheet_versions') is null or to_regclass('public.tool_capabilities') is null or to_regclass('public.app_users') is null then
    raise exception 'DỪNG — thiếu nền (chord_share_ok, is_admin, teamlab_band_members, chord_sheets, tool_capabilities, app_users)';
  end if;
  if to_regprocedure('public.chord_video_export_ok(uuid,text)') is not null or to_regprocedure('public.chord_video_export_eval(uuid,uuid,text)') is not null then
    raise exception 'DỪNG — hàm chord_video_export đã tồn tại';
  end if;
  if exists (select 1 from public.tool_capabilities where tool_id = 'chordlib' and capability = 'export_video') then
    raise exception 'DỪNG — capability export_video đã tồn tại';
  end if;
end $gate$;

-- 1) Lõi quyết định. Không tin bất kỳ thứ gì từ người gọi ngoài uid do hàm (2) truyền vào.
create or replace function public.chord_video_export_eval(p_uid uuid, p_version uuid, p_mode text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_role text; v_status text; v_band uuid; v_admin boolean; v_cap boolean;
  v_max int;
begin
  if p_mode is null or p_mode not in ('clip', 'full') then
    return jsonb_build_object('ok', false, 'mode', p_mode, 'max_seconds', 0, 'reason', 'bad_mode');
  end if;
  if p_uid is null then
    return jsonb_build_object('ok', false, 'mode', p_mode, 'max_seconds', 0, 'reason', 'auth');
  end if;
  select au.role, au.status into v_role, v_status from public.app_users au where au.id = p_uid;
  if v_role is null or v_status is distinct from 'active' then
    return jsonb_build_object('ok', false, 'mode', p_mode, 'max_seconds', 0, 'reason', 'account');
  end if;
  select s.band_id into v_band
    from public.chord_sheet_versions v join public.chord_sheets s on s.id = v.sheet_id
   where v.id = p_version and v.review_status = 'approved' and s.archived_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'mode', p_mode, 'max_seconds', 0, 'reason', 'not_shareable');
  end if;
  v_admin := v_role = 'admin';
  v_max := case p_mode when 'full' then 360 else 14 end;
  if v_admin then
    return jsonb_build_object('ok', true, 'mode', p_mode, 'max_seconds', v_max, 'reason', null);
  end if;
  if p_mode = 'full' then
    return jsonb_build_object('ok', false, 'mode', p_mode, 'max_seconds', 0, 'reason', 'full_admin_only');
  end if;
  if v_band is null then
    return jsonb_build_object('ok', false, 'mode', p_mode, 'max_seconds', 0, 'reason', 'no_band');
  end if;
  if not exists (select 1 from public.teamlab_band_members m where m.band_id = v_band and m.user_id = p_uid) then
    return jsonb_build_object('ok', false, 'mode', p_mode, 'max_seconds', 0, 'reason', 'not_member');
  end if;
  select tc.allowed into v_cap from public.tool_capabilities tc
   where tc.tool_id = 'chordlib' and tc.capability = 'export_video'
     and tc.role = case when v_role in ('teacher', 'admin') then 'teacher' else 'student' end;
  if coalesce(v_cap, false) is not true then
    return jsonb_build_object('ok', false, 'mode', p_mode, 'max_seconds', 0, 'reason', 'disabled');
  end if;
  return jsonb_build_object('ok', true, 'mode', p_mode, 'max_seconds', v_max, 'reason', null);
end $$;
comment on function public.chord_video_export_eval(uuid, uuid, text) is 'chord_video_export_v1: lõi quyết định xuất video (không cấp cho client)';
revoke all on function public.chord_video_export_eval(uuid, uuid, text) from public, anon, authenticated;

-- 2) Cổng cho trình duyệt: danh tính CHỈ từ phiên; vẫn đi qua chord_share_ok (quyền xem + approved + chưa lưu trữ).
create or replace function public.chord_video_export_ok(p_version uuid, p_mode text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'mode', p_mode, 'max_seconds', 0, 'reason', 'auth');
  end if;
  if not public.chord_share_ok(p_version) then
    return jsonb_build_object('ok', false, 'mode', p_mode, 'max_seconds', 0, 'reason', 'not_shareable');
  end if;
  return public.chord_video_export_eval(v_uid, p_version, p_mode);
end $$;
comment on function public.chord_video_export_ok(uuid, text) is 'chord_video_export_v1: người gọi được xuất video clip/full của phiên bản này không';
revoke all on function public.chord_video_export_ok(uuid, text) from public, anon;
grant execute on function public.chord_video_export_ok(uuid, text) to authenticated;

-- 3) Công tắc tổng (mặc định MỞ). Tắt khẩn cấp: update ... set allowed=false.
insert into public.tool_capabilities (tool_id, role, capability, allowed)
values ('chordlib', 'student', 'export_video', true), ('chordlib', 'teacher', 'export_video', true);

notify pgrst, 'reload schema';
