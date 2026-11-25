-- APP UPDATE MANAGER V1 — chính sách cập nhật app TVA Guitar, riêng iOS và Android.
-- Chạy bằng scripts/prod-db.py (một transaction; file KHÔNG có begin/commit). Idempotent. ADDITIVE: chỉ thêm 2 bảng + 3 hàm.
--   • Migration tạo 2 dòng ở trạng thái TẮT (enabled=false, force_enabled=false): chạy xong KHÔNG máy nào thấy gì.
--   • Chạy lại không ghi đè chính sách Owner đã đặt.
--   • Client chỉ đọc qua app_update_policy_get(); không ai đọc/ghi thẳng bảng. Ghi: chỉ is_admin(), mọi lần lưu có nhật ký.
--   • KHÔNG lưu địa chỉ kho ứng dụng: link gắn cứng trong app.
--   • Đây mới là Ý ĐỊNH của Owner. Máy chỉ báo khi chính kho ứng dụng cũng xác nhận có bản mới (kiểm ở app).

do $gate$
begin
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'DỪNG — thiếu public.is_admin()';
  end if;
  if to_regclass('public.app_update_policy') is not null
     and coalesce(obj_description(to_regclass('public.app_update_policy'), 'pg_class'), '') not like 'app_update_v1:%' then
    raise exception 'DỪNG — đã có bảng app_update_policy không thuộc App Update V1';
  end if;
end $gate$;

-- '1.7.0' → {1,7,0}; so sánh theo SỐ (1.10.0 > 1.9.0)
create or replace function public.app_version_key(p text)
returns int[] language sql immutable set search_path = '' as $$
  select case when p ~ '^[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,4}$' then string_to_array(p, '.')::int[] end
$$;
comment on function public.app_version_key(text) is 'app_update_v1: khoá so sánh phiên bản';
revoke all on function public.app_version_key(text) from public, anon, authenticated;

create table if not exists public.app_update_policy (
  platform       text primary key check (platform in ('ios', 'android')),
  enabled        boolean not null default false,
  latest_version text check (latest_version is null or latest_version ~ '^[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,4}$'),
  latest_build   int check (latest_build is null or latest_build > 0),
  min_version    text check (min_version is null or min_version ~ '^[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,4}$'),
  min_build      int check (min_build is null or min_build > 0),
  force_enabled  boolean not null default false,
  notes          text check (notes is null or char_length(notes) <= 300),
  updated_at     timestamptz not null default now(),
  updated_by     uuid
);
comment on table public.app_update_policy is 'app_update_v1: chính sách cập nhật theo nền tảng';

create table if not exists public.app_update_policy_log (
  id         bigint generated always as identity primary key,
  platform   text not null,
  before_row jsonb not null,
  after_row  jsonb not null,
  changed_by uuid not null,
  changed_at timestamptz not null default now()
);
comment on table public.app_update_policy_log is 'app_update_v1: nhật ký đổi chính sách (chỉ thêm)';

alter table public.app_update_policy enable row level security;
alter table public.app_update_policy_log enable row level security;
revoke all on public.app_update_policy, public.app_update_policy_log from public, anon, authenticated;

insert into public.app_update_policy (platform) values ('ios'), ('android') on conflict (platform) do nothing;

-- Đọc công khai (phải chạy được cả khi chưa đăng nhập). Đang tắt → null. Chỉ trả trường app cần.
create or replace function public.app_update_policy_get(p_platform text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
           'latestVersion', p.latest_version, 'latestBuild', p.latest_build,
           'minVersion', case when p.force_enabled then p.min_version end,
           'minBuild', case when p.force_enabled then p.min_build end,
           'force', p.force_enabled, 'notes', p.notes)
    from public.app_update_policy p
   where p.platform = p_platform and p.enabled
$$;
comment on function public.app_update_policy_get(text) is 'app_update_v1: app đọc chính sách';
revoke all on function public.app_update_policy_get(text) from public;
grant execute on function public.app_update_policy_get(text) to anon, authenticated;

create or replace function public.app_update_policy_admin()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Chỉ quản trị viên được xem chính sách cập nhật' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'policies', (select jsonb_agg(to_jsonb(p) - 'updated_by' order by p.platform desc) from public.app_update_policy p),
    'log', coalesce((select jsonb_agg(to_jsonb(l) - 'changed_by' order by l.id desc)
                       from (select * from public.app_update_policy_log order by id desc limit 20) l), '[]'::jsonb));
end $$;
comment on function public.app_update_policy_admin() is 'app_update_v1: Owner xem';
revoke all on function public.app_update_policy_admin() from public, anon;
grant execute on function public.app_update_policy_admin() to authenticated;

create or replace function public.app_update_policy_save(
  p_platform text, p_enabled boolean, p_latest_version text, p_latest_build int,
  p_min_version text, p_min_build int, p_force boolean, p_notes text, p_expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_old public.app_update_policy;
  v_new public.app_update_policy;
  v_latest text := nullif(btrim(coalesce(p_latest_version, '')), '');
  v_min    text := nullif(btrim(coalesce(p_min_version, '')), '');
  v_notes  text := nullif(btrim(coalesce(p_notes, '')), '');
  v_on     boolean := coalesce(p_enabled, false);
  v_force  boolean := coalesce(p_force, false);
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Chỉ quản trị viên được đổi chính sách cập nhật' using errcode = '42501';
  end if;
  select * into v_old from public.app_update_policy where platform = p_platform for update;
  if not found then raise exception 'Nền tảng không hợp lệ' using errcode = '22023'; end if;
  if v_old.updated_at is distinct from p_expected_updated_at then
    raise exception 'Chính sách vừa được đổi ở nơi khác — tải lại trang rồi sửa tiếp' using errcode = '40001';
  end if;
  if (v_latest is not null and public.app_version_key(v_latest) is null) or (v_min is not null and public.app_version_key(v_min) is null) then
    raise exception 'Phiên bản phải có dạng 1.7.0' using errcode = '22023';
  end if;
  if char_length(coalesce(v_notes, '')) > 300 then raise exception 'Ghi chú tối đa 300 ký tự' using errcode = '22023'; end if;
  if v_on and (v_latest is null or (p_platform = 'android' and p_latest_build is null)) then
    raise exception 'Muốn bật thông báo phải có phiên bản mới nhất (Android cần thêm versionCode)' using errcode = '22023';
  end if;
  if v_force and not v_on then raise exception 'Cập nhật bắt buộc cần bật thông báo trước' using errcode = '22023'; end if;
  if v_force and ((p_platform = 'ios' and v_min is null) or (p_platform = 'android' and p_min_build is null)) then
    raise exception 'Cập nhật bắt buộc cần phiên bản tối thiểu (iOS: phiên bản; Android: versionCode)' using errcode = '22023';
  end if;
  if public.app_version_key(v_min) > public.app_version_key(v_latest) or p_min_build > p_latest_build then
    raise exception 'Phiên bản tối thiểu không được cao hơn phiên bản mới nhất' using errcode = '22023';
  end if;

  update public.app_update_policy set
    enabled = v_on, latest_version = v_latest, latest_build = p_latest_build,
    min_version = v_min, min_build = p_min_build, force_enabled = v_force, notes = v_notes,
    updated_at = clock_timestamp(), updated_by = auth.uid()
  where platform = p_platform
  returning * into v_new;

  insert into public.app_update_policy_log (platform, before_row, after_row, changed_by)
  values (p_platform, to_jsonb(v_old) - 'updated_by', to_jsonb(v_new) - 'updated_by', auth.uid());
  return to_jsonb(v_new) - 'updated_by';
end $$;
comment on function public.app_update_policy_save(text, boolean, text, int, text, int, boolean, text, timestamptz) is 'app_update_v1: Owner lưu';
revoke all on function public.app_update_policy_save(text, boolean, text, int, text, int, boolean, text, timestamptz) from public, anon;
grant execute on function public.app_update_policy_save(text, boolean, text, int, text, int, boolean, text, timestamptz) to authenticated;

notify pgrst, 'reload schema';
