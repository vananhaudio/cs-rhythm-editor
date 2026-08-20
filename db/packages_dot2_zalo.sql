-- =====================================================================
-- PACKAGES — ĐỢT 2: nhóm Zalo chung + welcome info (DONG_HANH_396K)
-- Idempotent — chạy trong Supabase SQL Editor SAU db/packages_setup.sql.
--
-- Nguyên tắc:
--  • Auto-join CHỈ nhóm có code IS NULL → trigger grant_class_courses_on_join
--    (đọc edu_groups.code trùng class_schedule.code) KHÔNG thể mở khoá nhầm.
--  • Không tạo bảng mới, không đụng class_schedule, edu_course_access vẫn
--    là source of truth duy nhất.
-- =====================================================================

-- 1) Config: thêm 3 key (merge, không đụng key cũ).
--    zalo_group_id      → uuid của nhóm Zalo chung trong edu_groups (điền sau khi tạo nhóm thật)
--    zalo_teacher_url   → link Zalo Thầy (Hỏi Thầy)
--    practice_schedule  → thông tin lịch thực hành (CHƯA tạo practice_sessions)
update public.packages
set config = config
  || '{"zalo_group_id": null, "zalo_teacher_url": null, "practice_schedule": "Thứ 2 – Thứ 6 · 20:30"}'
where package_code = 'DONG_HANH_396K'
  and not (config ? 'zalo_group_id');

-- 2) activate_student_package — bổ sung: tự vào nhóm Zalo chung + trả welcome info.
--    Giữ nguyên: guard is_teacher, gia hạn/kích hoạt, apply quyền, idempotent.
create or replace function public.activate_student_package(
  p_student uuid,
  p_package_code text,
  p_course_codes text[] default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pkg_id   uuid;
  v_renew    int;
  v_cfg      jsonb;
  v_perm     jsonb;
  v_active   bigint;
  v_codes    text[];
  v_gid      uuid;
  v_zalo_url text;
  v_uid2     uuid;
begin
  if not public.is_teacher() then
    raise exception 'Chỉ Thầy mới được kích hoạt gói';
  end if;

  select id, config, coalesce((config ->> 'renew_months')::int, 1)
    into v_pkg_id, v_cfg, v_renew
    from public.packages
    where package_code = p_package_code and status = 'active';
  if v_pkg_id is null then
    raise exception 'Gói % không tồn tại hoặc chưa kích hoạt', p_package_code;
  end if;

  -- Đã có gói active → GIA HẠN; chưa có → kích hoạt mới
  update public.student_packages
    set renews_at = now() + make_interval(months => v_renew),
        updated_at = now()
    where student_id = p_student and package_id = v_pkg_id and status = 'active'
    returning id into v_active;

  if v_active is null then
    insert into public.student_packages (student_id, package_id, status, starts_at, renews_at)
      values (p_student, v_pkg_id, 'active', now(), now() + make_interval(months => v_renew))
      on conflict do nothing
      returning id into v_active;
    if v_active is null then
      raise exception 'Kích hoạt thất bại — vui lòng thử lại';
    end if;
  end if;

  v_perm := public.apply_package_permissions(p_student, p_package_code, p_course_codes);

  select array(select jsonb_array_elements_text(v_perm -> 'granted_codes')) into v_codes;
  update public.student_packages
    set granted_course_codes = v_codes,
        updated_at = now()
    where id = v_active;

  -- ── ĐỢT 2: tự vào nhóm Zalo chung của gói ──────────────────────────
  -- CHỈ join nhóm đang active và code IS NULL (không gắn mã lớp) —
  -- tránh trigger tg_grant_class_courses mở khoá qua class_schedule.
  v_gid := nullif(v_cfg ->> 'zalo_group_id', '')::uuid;
  if v_gid is not null then
    select zalo_url into v_zalo_url
      from public.edu_groups
      where id = v_gid and is_active and code is null;
    if v_zalo_url is not null then
      select user_id into v_uid2 from public.edu_students where id = p_student;
      if v_uid2 is not null then
        insert into public.edu_group_members (user_id, group_id, source, status)
          values (v_uid2, v_gid, 'package', 'active')
          on conflict (user_id, group_id) do update set status = 'active';
      end if;
    end if;
  end if;

  return v_perm || jsonb_build_object(
    'student_package_id', v_active,
    'renews_at', (select renews_at from public.student_packages where id = v_active),
    'zalo_url', v_zalo_url,
    'zalo_teacher_url', v_cfg ->> 'zalo_teacher_url',
    'practice_schedule', v_cfg ->> 'practice_schedule'
  );
end; $$;

-- Giữ nguyên phân quyền: activate → authenticated (có guard bên trong);
-- apply KHÔNG đổi (vẫn revoke authenticated như Đợt 1).
revoke all on function public.activate_student_package(uuid, text, text[]) from public, anon;
grant execute on function public.activate_student_package(uuid, text, text[]) to authenticated;

notify pgrst, 'reload schema';
