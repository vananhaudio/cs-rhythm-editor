-- =====================================================================
-- PACKAGES — gói đăng ký (Đợt 1: DONG_HANH_396K)
-- Package CHỈ là NGUỒN CẤP/THU quyền — edu_course_access vẫn là SOURCE OF
-- TRUTH duy nhất cho quyền học. Không tạo hệ thống permission song song.
--
-- Idempotent — chạy lại nhiều lần vô hại. Chạy trong Supabase SQL Editor.
-- ⚠️ 'packages' + 'student_packages' đã được thêm vào self_managed trong
--    db/rls_setup.sql → chạy lại rls_setup KHÔNG xoá policy hẹp dưới đây.
-- =====================================================================

-- ── 1) BẢNG packages — cấu hình gói ───────────────────────────────────
-- Thêm HANH_TRINH_9990K hay gói khác sau = 1 dòng seed, KHÔNG viết logic riêng.
create table if not exists public.packages (
  id           uuid primary key default gen_random_uuid(),
  package_code text not null unique,
  name         text not null,
  description  text,
  config       jsonb not null default '{}'::jsonb,
  status       text not null default 'draft',   -- draft | active | archived
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.packages enable row level security;
drop policy if exists pkgs_read  on public.packages;
drop policy if exists pkgs_write on public.packages;
create policy pkgs_read  on public.packages for select to authenticated using (true);
create policy pkgs_write on public.packages for all    to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

-- ── 2) BẢNG student_packages — gói của từng học sinh ──────────────────
create table if not exists public.student_packages (
  id                   bigint generated always as identity primary key,
  student_id           uuid not null references public.edu_students(id) on delete cascade,
  package_id           uuid not null references public.packages(id)    on delete cascade,
  status               text not null default 'active',  -- active | expired | cancelled
  starts_at            timestamptz not null default now(),
  renews_at            timestamptz,                     -- null = chưa/không gia hạn
  granted_course_codes text[]  not null default '{}',   -- snapshot mã khoá gói đã mở
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists sp_student_idx on public.student_packages (student_id);
-- Chặn kích hoạt trùng: mỗi học sinh chỉ 1 bản ghi ACTIVE cho cùng 1 package
create unique index if not exists sp_active_uq
  on public.student_packages (student_id, package_id) where status = 'active';

alter table public.student_packages enable row level security;
drop policy if exists sp_read  on public.student_packages;
drop policy if exists sp_write on public.student_packages;
create policy sp_read  on public.student_packages for select to authenticated using (true);
create policy sp_write on public.student_packages for all    to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

-- ── 3) SEED gói ĐỒNG HÀNH 396K ────────────────────────────────────────
-- config:
--   default_course_codes    → khoá nền tảng ai cũng mở (NM là nền chung của
--                             placement đã chốt; solo/chưa biết → chỉ default,
--                             vì cần Thầy xác nhận trước khi mở thêm)
--   placement_course_codes  → khoá mở thêm theo HƯỚNG (dem_hat → DH1, tia_not → TN1)
--   zalo_group_code         → mã nhóm Zalo chung của gói. Đợt 1 = null (chưa có
--                             nhóm thật) → hàm BỎ QUA. Thầy tạo nhóm rồi UPDATE config.
--   renew_months            → chu kỳ gia hạn (tháng)
insert into public.packages (package_code, name, description, config, status)
values (
  'DONG_HANH_396K',
  'ĐỒNG HÀNH — 396K/tháng',
  'Được đồng hành cùng Thầy: mở các khoá nền tảng theo điểm bắt đầu của học viên.',
  '{
     "default_course_codes": ["NM"],
     "placement_course_codes": {"dem-hat": ["DH1"], "tia-not": ["TN1"]},
     "zalo_group_code": null,
     "renew_months": 1
   }'::jsonb,
  'active'
) on conflict (package_code) do nothing;

-- ── 4) apply_package_permissions — cấp quyền học theo gói (IDEMPOTENT) ─
-- Khoá xác định theo edu_courses.code (Bộ luật Hành trình 2027) — KHÔNG hard-code UUID.
create or replace function public.apply_package_permissions(
  p_student uuid,
  p_package_code text,
  p_course_codes text[] default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pkg_id   uuid;
  v_cfg      jsonb;
  v_codes    text[] := coalesce(p_course_codes, '{}');
  v_course   record;
  v_granted  text[] := '{}';
  v_skipped  text[] := '{}';
  v_uid      uuid   := auth.uid();
begin
  -- BẢO MẬT: chỉ Thầy được cấp quyền theo gói (defense in depth cùng REVOKE EXECUTE)
  if not public.is_teacher() then
    raise exception 'Chỉ Thầy mới được kích hoạt gói';
  end if;

  select id, config into v_pkg_id, v_cfg
    from public.packages
    where package_code = p_package_code and status = 'active';
  if v_pkg_id is null then
    raise exception 'Gói % không tồn tại hoặc chưa kích hoạt', p_package_code;
  end if;

  -- Không truyền mã khoá → dùng danh sách nền tảng mặc định của gói
  if v_codes is null or cardinality(v_codes) = 0 then
    v_codes := array(select jsonb_array_elements_text(v_cfg -> 'default_course_codes'));
  end if;
  v_codes := array(select c from unnest(v_codes) c where c is not null and btrim(c) <> '');

  -- Mở khoá: ghi 2 nguồn quyền hiện hữu (enrollments + access). Nếu đã có
  -- quyền (nguồn khác) chỉ bật active, KHÔNG xoá/ghi đè note nguồn cũ.
  for v_course in
    select c.id, c.code from public.edu_courses c
    where c.status = 'on' and c.code = any(v_codes)
  loop
    insert into public.edu_enrollments (student_id, course_id, is_active, enrolled_by)
      values (p_student, v_course.id, true, v_uid)
      on conflict (student_id, course_id) do update set is_active = true;

    insert into public.edu_course_access (student_id, course_id, active, note, granted_by)
      values (p_student, v_course.id, true, 'PKG ' || p_package_code, v_uid)
      on conflict (student_id, course_id) do update set active = true;
    v_granted := v_granted || v_course.code;
  end loop;

  -- Mã không khớp khoá nào đang mở → trả về để admin biết (không fail cứng)
  v_skipped := array(
    select c from unnest(v_codes) c
    where c not in (select c2.code from public.edu_courses c2 where c2.status = 'on' and c2.code = c)
  );

  return jsonb_build_object(
    'package',       p_package_code,
    'granted_codes', to_jsonb(v_granted),
    'skipped_codes', to_jsonb(v_skipped)
  );
end; $$;

-- ── 5) activate_student_package — kích hoạt/gia hạn gói cho 1 học sinh ──
create or replace function public.activate_student_package(
  p_student uuid,
  p_package_code text,
  p_course_codes text[] default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pkg_id   uuid;
  v_renew    int;
  v_perm     jsonb;
  v_active   bigint;
  v_codes    text[];
begin
  if not public.is_teacher() then
    raise exception 'Chỉ Thầy mới được kích hoạt gói';
  end if;

  select id, coalesce((config ->> 'renew_months')::int, 1)
    into v_pkg_id, v_renew
    from public.packages
    where package_code = p_package_code and status = 'active';
  if v_pkg_id is null then
    raise exception 'Gói % không tồn tại hoặc chưa kích hoạt', p_package_code;
  end if;

  -- Đã có gói active → GIA HẠN (không tạo bản ghi trùng); chưa có → kích hoạt mới
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

  return v_perm || jsonb_build_object(
    'student_package_id', v_active,
    'renews_at', (select renews_at from public.student_packages where id = v_active)
  );
end; $$;

-- Quyền thực thi: chỉ Thầy (authenticated) gọi activate qua app; owner (SQL Editor)
-- vẫn chạy trực tiếp được. apply_package_permissions không cấp cho ai (chỉ gọi nội bộ).
revoke all on function public.apply_package_permissions(uuid, text, text[]) from public, anon;
revoke all on function public.apply_package_permissions(uuid, text, text[]) from authenticated;
revoke all on function public.activate_student_package(uuid, text, text[])  from public, anon;
grant execute on function public.activate_student_package(uuid, text, text[]) to authenticated;

notify pgrst, 'reload schema';
