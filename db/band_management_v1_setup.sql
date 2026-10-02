-- ═══════════════════════════════════════════════════════════════════════════
-- BAND — QUẢN LÝ V1: ỨNG TUYỂN → DUYỆT → THÀNH VIÊN → VỊ TRÍ ÂM NHẠC + VAI TRÒ VẬN HÀNH (Bộ máy).
-- Nền: db/band_recruit_v1_setup.sql (phải có trước). Thiết kế: docs/BAND-MANAGEMENT-V1.md.
-- Rollback: db/band_management_v1_rollback.sql (chạy TRƯỚC rollback của Recruit V1).
-- Preflight/postflight (read-only): db/band_management_v1_{preflight,postflight}.sql.
-- Test (cluster PostgreSQL tạm, KHÔNG production): scripts/test-band-recruit-db.sh.
--
-- Nguyên tắc:
--   • ADDITIVE: 4 bảng Recruit V1 giữ nguyên, chỉ THÊM 2 cột danh mục vào bands (có DEFAULT) + 2 bảng mới.
--     Thay đúng 2 hàm V1 (band_can_manage, band_admin_set_status) — rollback trả lại NGUYÊN VĂN bản V1.
--   • Danh mục vị trí âm nhạc (bands.position_catalog) và vai trò vận hành (bands.role_catalog) là DỮ LIỆU
--     của từng Band: Band khác có Saxophone/Violin/Cajon = UPDATE dữ liệu, không sửa schema/component.
--     DEFAULT = bộ chuẩn (7 vị trí, 6 vai trò) → mọi Band hiện có/sắp tạo tự có, không seed riêng Lá Mùa Thu.
--   • Thành viên KHÔNG cần tài khoản Class (user_id null được). Một người = một dòng mỗi Band: khớp theo
--     application → SĐT → tài khoản. Có tài khoản sau này → đơn mới (đã đăng nhập) được duyệt sẽ GẮN user_id
--     vào đúng hồ sơ cũ (cùng SĐT), không tạo hồ sơ thứ hai.
--   • ACCEPTED luôn đi qua band_admin_accept: đổi trạng thái + tạo/khớp thành viên trong MỘT transaction,
--     idempotent (bấm lại/retry không tạo trùng). band_admin_set_status(…, 'ACCEPTED') cũng gọi nó.
--   • Quyền: band_can_manage = Thầy/admin · leader_user_id của Band · thành viên ACTIVE có tài khoản giữ vai trò
--     có cờ "manage": true trong role_catalog của CHÍNH Band đó (mặc định: Band Leader). Leader Band A không
--     chạm được Band B. Khách: không hàm nào đọc thành viên.
--   • Ngoài phạm vi V1 (KHÔNG làm): điểm danh, buổi tập, khách mời, repertoire, TeamLab, nhiệm kỳ, KPI.
--
-- ⚠ Production cấp mặc định mọi quyền cho anon/authenticated → REVOKE tường minh. 2 bảng mới nằm trong
--   self_managed của db/rls_setup.sql. Idempotent. CHẠY bằng scripts/prod-db.py (file KHÔNG có begin/commit).
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';

-- ── 0) Cổng ─────────────────────────────────────────────────────────────────────────────────
do $gate$
declare n int;
begin
  if (select md5(prosrc) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
       where s.nspname = 'public' and p.proname = 'is_teacher') is distinct from '19b164504b4ce59b9bbdb4b0b64e48ad' then
    raise exception 'GATE: public.is_teacher() khác bản repo — dừng';
  end if;
  -- Recruit V1 phải có đủ 4 bảng (do chính file V1 tạo)
  select count(*) into n from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relname in ('bands', 'band_recruitments', 'band_rule_versions', 'band_applications')
     and obj_description(c.oid, 'pg_class') like 'band_recruit_v1:%';
  if n <> 4 then raise exception 'GATE: chưa có đủ 4 bảng Band Recruit V1 — chạy band_recruit_v1_setup.sql trước'; end if;
  -- Không ghi đè object lạ trùng tên
  select count(*) into n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname like 'band\_%'
     and coalesce(obj_description(p.oid, 'pg_proc'), '') not like 'band_recruit_v1:%'
     and coalesce(obj_description(p.oid, 'pg_proc'), '') not like 'band_management_v1:%';
  if n > 0 then raise exception 'GATE: đã có % hàm band_* lạ — dừng', n; end if;
  select count(*) into n from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relname in ('band_members', 'band_member_roles')
     and coalesce(obj_description(c.oid, 'pg_class'), '') not like 'band_management_v1:%';
  if n > 0 then raise exception 'GATE: đã có % bảng band_members/band_member_roles lạ — dừng', n; end if;
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'bands' and column_name in ('position_catalog', 'role_catalog')
     and coalesce(col_description('public.bands'::regclass, ordinal_position::int), '') not like 'band_management_v1:%';
  if n > 0 then raise exception 'GATE: bands đã có cột position_catalog/role_catalog lạ — dừng'; end if;
end $gate$;

-- ── 1) Danh mục của từng Band (DỮ LIỆU — DEFAULT là bộ chuẩn, Band nào cũng sửa được) ──────────────
alter table public.bands add column if not exists position_catalog jsonb not null default
  '[{"key": "vocal", "label": "Vocal"},
    {"key": "guitar_dem", "label": "Guitar đệm"},
    {"key": "guitar_lead", "label": "Guitar tỉa / Lead"},
    {"key": "keyboard", "label": "Keyboard"},
    {"key": "bass", "label": "Bass"},
    {"key": "drums", "label": "Trống / Percussion"},
    {"key": "other", "label": "Khác", "other": true}]'::jsonb
  check (jsonb_typeof(position_catalog) = 'array' and jsonb_array_length(position_catalog) between 1 and 40);
alter table public.bands add column if not exists role_catalog jsonb not null default
  '[{"key": "band_leader", "label": "Band Leader", "max": 1, "manage": true},
    {"key": "music_leader", "label": "Music Leader"},
    {"key": "membership", "label": "Membership"},
    {"key": "schedule", "label": "Lịch & điều phối"},
    {"key": "teamlab", "label": "TeamLab / Recording"},
    {"key": "media", "label": "Performance / Media"}]'::jsonb
  check (jsonb_typeof(role_catalog) = 'array' and jsonb_array_length(role_catalog) between 1 and 30);
comment on column public.bands.position_catalog is 'band_management_v1: vị trí âm nhạc của Band [{key, label, other?}] — key của vị trí tuyển nên trùng để thành viên kế thừa';
comment on column public.bands.role_catalog is 'band_management_v1: vai trò vận hành (Bộ máy) [{key, label, max?, manage?}] — max = số người tối đa (vắng = không giới hạn), manage = được quản trị Band';

-- ── 2) Thành viên ────────────────────────────────────────────────────────────────────────────
create table if not exists public.band_members (
  id             uuid primary key default gen_random_uuid(),
  band_id        uuid not null references public.bands(id) on delete restrict,
  application_id uuid unique references public.band_applications(id) on delete restrict,   -- đơn đã đưa người này vào Band
  user_id        uuid references auth.users(id) on delete set null,                          -- tài khoản Class (nếu đã resolve)
  full_name      text not null check (length(btrim(full_name)) between 2 and 80),
  phone          text check (phone is null or phone ~ '^0[0-9]{8,10}$'),                     -- SĐT/Zalo đã chuẩn hoá
  status         text not null default 'ACTIVE' check (status in ('ACTIVE', 'PAUSED', 'LEFT')),
  joined_at      timestamptz not null default now(),
  left_at        timestamptz,
  positions      text[] not null default '{}' check (cardinality(positions) <= 20),          -- key trong bands.position_catalog
  position_note  text check (position_note is null or length(position_note) <= 80),          -- mô tả "Khác"/nhạc cụ riêng
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.band_members is 'band_management_v1: thành viên Band (một người một dòng mỗi Band) — ghi/đọc CHỈ qua band_admin_*.';
create unique index if not exists band_members_phone_uq on public.band_members (band_id, phone) where phone is not null;
create unique index if not exists band_members_user_uq on public.band_members (band_id, user_id) where user_id is not null;
create index if not exists band_members_band_idx on public.band_members (band_id, status);

-- Vai trò vận hành: một người nhiều vai trò, một vai trò nhiều người (tối đa theo role_catalog.max)
create table if not exists public.band_member_roles (
  id          uuid primary key default gen_random_uuid(),
  band_id     uuid not null references public.bands(id) on delete restrict,
  member_id   uuid not null references public.band_members(id) on delete cascade,
  role_key    text not null check (role_key ~ '^[a-z0-9_]{1,40}$'),
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id) on delete set null,
  unique (member_id, role_key)
);
comment on table public.band_member_roles is 'band_management_v1: vai trò vận hành của thành viên (Bộ máy) — ghi/đọc CHỈ qua band_admin_*.';
create index if not exists band_member_roles_band_idx on public.band_member_roles (band_id, role_key);

-- ── 3) Bất biến ─────────────────────────────────────────────────────────────────────────────
-- Thành viên: đơn thuộc đúng Band; vị trí MỚI thêm phải có trong danh mục (vị trí cũ đã bị gỡ khỏi danh mục
-- vẫn giữ được — đổi danh mục sau không làm hỏng hồ sơ).
create or replace function public.band_members_check()
returns trigger language plpgsql set search_path = '' as $$
declare v_cat jsonb; v_bad text;
begin
  if tg_op = 'UPDATE' and (new.band_id <> old.band_id or new.application_id is distinct from old.application_id and old.application_id is not null) then
    raise exception 'Không chuyển thành viên sang Band/đơn khác' using errcode = 'check_violation';
  end if;
  if new.application_id is not null and not exists (
       select 1 from public.band_applications a where a.id = new.application_id and a.band_id = new.band_id) then
    raise exception 'application_id không thuộc Band này' using errcode = 'check_violation';
  end if;
  select position_catalog into v_cat from public.bands where id = new.band_id;
  select x into v_bad from unnest(new.positions) x
   where (tg_op = 'INSERT' or not x = any(old.positions))
     and not exists (select 1 from jsonb_array_elements(v_cat) c where c->>'key' = x) limit 1;
  if v_bad is not null then raise exception 'Vị trí "%" không có trong danh mục của Band', v_bad using errcode = 'check_violation'; end if;
  new.positions := coalesce((select array_agg(distinct x order by x) from unnest(new.positions) x), '{}');
  new.updated_at := now();
  return new;
end $$;
comment on function public.band_members_check() is 'band_management_v1: thành viên — đơn đúng Band, vị trí theo danh mục';
drop trigger if exists band_members_check on public.band_members;
create trigger band_members_check before insert or update on public.band_members
  for each row execute function public.band_members_check();

-- Vai trò: đúng Band của thành viên, thành viên chưa rời Band, key có trong danh mục, không quá max (khoá dòng Band
-- để hai lần gán đồng thời không vượt max).
create or replace function public.band_member_roles_check()
returns trigger language plpgsql set search_path = '' as $$
declare v_role jsonb; v_max int; n int;
begin
  perform 1 from public.bands where id = new.band_id for update;
  if not exists (select 1 from public.band_members m where m.id = new.member_id and m.band_id = new.band_id and m.status <> 'LEFT') then
    raise exception 'Thành viên không thuộc Band này hoặc đã rời Band' using errcode = 'check_violation';
  end if;
  select c into v_role from public.bands b, jsonb_array_elements(b.role_catalog) c where b.id = new.band_id and c->>'key' = new.role_key;
  if v_role is null then raise exception 'Vai trò "%" không có trong danh mục của Band', new.role_key using errcode = 'check_violation'; end if;
  v_max := nullif(v_role->>'max', '')::int;
  if v_max is not null then
    select count(*) into n from public.band_member_roles r where r.band_id = new.band_id and r.role_key = new.role_key and r.id <> new.id;
    if n >= v_max then raise exception 'Vai trò "%" đã đủ % người', v_role->>'label', v_max using errcode = 'check_violation'; end if;
  end if;
  return new;
end $$;
comment on function public.band_member_roles_check() is 'band_management_v1: vai trò — đúng Band, theo danh mục, không quá max';
drop trigger if exists band_member_roles_check on public.band_member_roles;
create trigger band_member_roles_check before insert or update on public.band_member_roles
  for each row execute function public.band_member_roles_check();

-- ── 4) RLS: bật, KHÔNG policy — mọi truy cập qua RPC ───────────────────────────────────────────
alter table public.band_members      enable row level security;
alter table public.band_member_roles enable row level security;
revoke all on table public.band_members, public.band_member_roles from public, anon, authenticated;

-- ── 5) Quyền quản lý (THAY bản V1: thêm vai trò có cờ manage của chính Band) ─────────────────────
create or replace function public.band_can_manage(p_band_id uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select auth.uid() is not null and (
    public.is_teacher()
    or exists (select 1 from public.bands b where b.id = p_band_id and b.leader_user_id = auth.uid())
    or exists (select 1 from public.band_member_roles r
                 join public.band_members m on m.id = r.member_id and m.band_id = r.band_id
                 join public.bands b on b.id = r.band_id
                where r.band_id = p_band_id and m.user_id = auth.uid() and m.status = 'ACTIVE'
                  and exists (select 1 from jsonb_array_elements(b.role_catalog) c
                               where c->>'key' = r.role_key and c->>'manage' = 'true')))
$$;
comment on function public.band_can_manage(uuid) is 'band_management_v1: Thầy/admin · Leader của Band · thành viên ACTIVE giữ vai trò manage của Band';

-- ── 6) Bàn điều hành: hồ sơ + danh mục + thành viên (kèm vai trò) + số liệu đầu trang ─────────────
create or replace function public.band_admin_overview(p_slug text)
returns jsonb language plpgsql security definer set search_path = '' stable as $$
declare b public.bands;
begin
  select * into b from public.bands where slug = lower(btrim(p_slug));
  if b.id is null or not public.band_can_manage(b.id) then
    raise exception 'Không có quyền quản trị Band này' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'band', jsonb_build_object('id', b.id, 'slug', b.slug, 'name', b.name, 'leader_name', b.leader_name,
      'schedule_text', b.schedule_text, 'music_style', b.music_style, 'status', b.status),
    'position_catalog', b.position_catalog,
    'role_catalog', b.role_catalog,
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'full_name', m.full_name, 'phone', m.phone,
        'status', m.status, 'joined_at', m.joined_at, 'positions', to_jsonb(m.positions), 'position_note', m.position_note,
        'application_id', m.application_id, 'has_account', m.user_id is not null,
        'roles', coalesce((select jsonb_agg(r.role_key order by r.assigned_at) from public.band_member_roles r where r.member_id = m.id), '[]'::jsonb))
        order by (m.status = 'LEFT'), m.joined_at, m.full_name)
      from public.band_members m where m.band_id = b.id), '[]'::jsonb),
    'counts', jsonb_build_object(
      'members', (select count(*) from public.band_members m where m.band_id = b.id and m.status <> 'LEFT'),
      'active', (select count(*) from public.band_members m where m.band_id = b.id and m.status = 'ACTIVE'),
      'new_applications', (select count(*) from public.band_applications a where a.band_id = b.id and a.status = 'NEW')));
end $$;
comment on function public.band_admin_overview(text) is 'band_management_v1: bàn điều hành Band (Thầy/Leader)';

-- ── 7) Chấp nhận ứng viên → thành viên (idempotent) ──────────────────────────────────────────────
create or replace function public.band_admin_accept(p_application_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a public.band_applications;
  m public.band_members;
  v_cat jsonb;
  v_positions text[] := '{}';
  v_note text;
  v_label text;
  v_created boolean := false;
begin
  select * into a from public.band_applications where id = p_application_id for update;   -- tuần tự hoá bấm đúp
  if a.id is null or not public.band_can_manage(a.band_id) then
    raise exception 'Không có quyền duyệt đơn này' using errcode = '42501';
  end if;
  -- Kế thừa vị trí ứng tuyển: key có trong danh mục Band → vị trí; không có → ghi thành mô tả, không mất thông tin
  select position_catalog into v_cat from public.bands where id = a.band_id;
  if exists (select 1 from jsonb_array_elements(v_cat) c where c->>'key' = a.position_key) then
    v_positions := array[a.position_key];
    v_note := a.position_other;
  else
    select x->>'label' into v_label from public.band_recruitments r, jsonb_array_elements(r.positions) x
     where r.id = a.recruitment_id and x->>'key' = a.position_key;
    v_note := left(concat_ws(': ', coalesce(v_label, a.position_key), a.position_other), 80);
  end if;

  -- Một người một hồ sơ mỗi Band: cùng đơn → cùng SĐT → cùng tài khoản
  select * into m from public.band_members where application_id = a.id for update;
  if m.id is null then select * into m from public.band_members where band_id = a.band_id and phone = a.phone for update; end if;
  if m.id is null and a.applicant_user_id is not null then
    select * into m from public.band_members where band_id = a.band_id and user_id = a.applicant_user_id for update;
  end if;

  if m.id is null then
    insert into public.band_members (band_id, application_id, user_id, full_name, phone, positions, position_note, created_by)
    values (a.band_id, a.id, a.applicant_user_id, a.full_name, a.phone, v_positions, v_note, auth.uid())
    on conflict do nothing
    returning * into m;
    if m.id is null then   -- lần duyệt song song khác vừa tạo xong → dùng lại
      select * into m from public.band_members
       where application_id = a.id or (band_id = a.band_id and phone = a.phone) order by created_at limit 1;
    else
      v_created := true;
    end if;
  elsif m.application_id is distinct from a.id then
    -- Người cũ quay lại / đơn thứ hai: gắn tài khoản nếu còn thiếu, mở lại nếu đã rời, cộng thêm vị trí mới
    update public.band_members set
      user_id = coalesce(user_id, case when a.applicant_user_id is not null and not exists (
                  select 1 from public.band_members x where x.band_id = a.band_id and x.user_id = a.applicant_user_id) then a.applicant_user_id end),
      application_id = coalesce(application_id, a.id),
      status = case when status = 'LEFT' then 'ACTIVE' else status end,
      joined_at = case when status = 'LEFT' then now() else joined_at end,
      left_at = case when status = 'LEFT' then null else left_at end,
      positions = positions || v_positions,
      position_note = coalesce(position_note, v_note)
    where id = m.id
    returning * into m;
  end if;
  -- (cùng đơn bấm lại → không đụng hồ sơ: vị trí Leader đã sửa không bị ghi đè)

  if a.status <> 'ACCEPTED' then
    update public.band_applications set status = 'ACCEPTED', status_changed_at = now(), status_changed_by = auth.uid() where id = a.id;
  end if;
  return jsonb_build_object('ok', true, 'status', 'ACCEPTED', 'member_id', m.id, 'created', v_created);
end $$;
comment on function public.band_admin_accept(uuid) is 'band_management_v1: chấp nhận ứng viên và thêm vào Band (idempotent)';

-- Đổi trạng thái đơn (THAY bản V1): ACCEPTED không bao giờ chỉ đổi chữ — luôn đi qua band_admin_accept
create or replace function public.band_admin_set_status(p_application_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.band_applications;
begin
  select * into a from public.band_applications where id = p_application_id;
  if a.id is null or not public.band_can_manage(a.band_id) then
    raise exception 'Không có quyền duyệt đơn này' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('NEW', 'REVIEWING', 'ACCEPTED', 'REJECTED') then
    raise exception 'Trạng thái không hợp lệ' using errcode = '22023';
  end if;
  if p_status = 'ACCEPTED' then return public.band_admin_accept(a.id); end if;
  if a.status <> p_status then
    update public.band_applications set status = p_status, status_changed_at = now(), status_changed_by = auth.uid()
     where id = a.id;
  end if;
  return jsonb_build_object('ok', true, 'status', p_status);
end $$;
comment on function public.band_admin_set_status(uuid, text) is 'band_management_v1: đổi trạng thái đơn; ACCEPTED → band_admin_accept';

-- ── 8) Thành viên: thêm tay · sửa vị trí/trạng thái · gán/bỏ vai trò ─────────────────────────────
-- Lỗi nhập liệu → {ok:false, code, message}; sai quyền → exception 42501.
create or replace function public.band_positions_from(p_band_id uuid, p jsonb)
returns text[] language plpgsql security definer set search_path = '' stable as $$
declare v text[]; v_bad text;
begin
  if p is null or jsonb_typeof(p) <> 'array' then return null; end if;
  select coalesce(array_agg(distinct x), '{}') into v from jsonb_array_elements_text(p) x;
  select x into v_bad from unnest(v) x
   where not exists (select 1 from public.bands b, jsonb_array_elements(b.position_catalog) c where b.id = p_band_id and c->>'key' = x) limit 1;
  if v_bad is not null then return null; end if;
  return v;
end $$;
comment on function public.band_positions_from(uuid, jsonb) is 'band_management_v1: mảng key vị trí hợp lệ theo danh mục Band (null = không hợp lệ)';

create or replace function public.band_admin_add_member(p_slug text, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  b public.bands;
  v_name text := btrim(coalesce(p->>'full_name', ''));
  v_phone text := nullif(regexp_replace(coalesce(p->>'phone', ''), '[^0-9+]', '', 'g'), '');
  v_pos text[];
  v_note text := nullif(btrim(coalesce(p->>'position_note', '')), '');
  v_dup public.band_members;
  v_id uuid;
begin
  select * into b from public.bands where slug = lower(btrim(p_slug));
  if b.id is null or not public.band_can_manage(b.id) then
    raise exception 'Không có quyền quản trị Band này' using errcode = '42501';
  end if;
  if length(v_name) < 2 or length(v_name) > 80 then
    return jsonb_build_object('ok', false, 'code', 'full_name', 'message', 'Vui lòng nhập họ và tên (2–80 ký tự).');
  end if;
  if v_phone like '+84%' then v_phone := '0' || substr(v_phone, 4);
  elsif v_phone like '84%' and length(v_phone) >= 11 then v_phone := '0' || substr(v_phone, 3); end if;
  if v_phone is not null and v_phone !~ '^0[0-9]{8,10}$' then
    return jsonb_build_object('ok', false, 'code', 'phone', 'message', 'Số điện thoại/Zalo chưa đúng.');
  end if;
  v_pos := public.band_positions_from(b.id, coalesce(p->'positions', '[]'::jsonb));
  if v_pos is null then return jsonb_build_object('ok', false, 'code', 'positions', 'message', 'Vị trí không hợp lệ.'); end if;
  if length(coalesce(v_note, '')) > 80 then
    return jsonb_build_object('ok', false, 'code', 'position_note', 'message', 'Mô tả vị trí tối đa 80 ký tự.');
  end if;
  if v_phone is not null then
    select * into v_dup from public.band_members where band_id = b.id and phone = v_phone;
    if v_dup.id is not null then
      return jsonb_build_object('ok', false, 'code', 'duplicate', 'member_id', v_dup.id,
        'message', 'Số này đã là thành viên: ' || v_dup.full_name || '.');
    end if;
  end if;
  insert into public.band_members (band_id, full_name, phone, positions, position_note, created_by)
  values (b.id, v_name, v_phone, v_pos, v_note, auth.uid())
  on conflict do nothing returning id into v_id;
  if v_id is null then return jsonb_build_object('ok', false, 'code', 'duplicate', 'message', 'Số này đã là thành viên.'); end if;
  return jsonb_build_object('ok', true, 'member_id', v_id);
end $$;
comment on function public.band_admin_add_member(text, jsonb) is 'band_management_v1: thêm thành viên không qua ứng tuyển (vd. Leader/thành viên sáng lập)';

-- p: {positions?: [key], position_note?: text|null, status?: ACTIVE|PAUSED|LEFT} — chỉ đổi trường có mặt
create or replace function public.band_admin_update_member(p_member_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m public.band_members; v_pos text[]; v_note text; v_status text;
begin
  select * into m from public.band_members where id = p_member_id for update;
  if m.id is null or not public.band_can_manage(m.band_id) then
    raise exception 'Không có quyền quản trị Band này' using errcode = '42501';
  end if;
  v_pos := m.positions; v_note := m.position_note; v_status := m.status;
  if p ? 'positions' then
    if jsonb_typeof(p->'positions') <> 'array' then
      return jsonb_build_object('ok', false, 'code', 'positions', 'message', 'Vị trí không hợp lệ.');
    end if;
    select coalesce(array_agg(distinct x), '{}') into v_pos from jsonb_array_elements_text(p->'positions') x;
    -- chỉ vị trí MỚI phải có trong danh mục (vị trí cũ đã bị gỡ khỏi danh mục vẫn giữ được)
    if exists (select 1 from unnest(v_pos) x where not x = any(m.positions)
                 and public.band_positions_from(m.band_id, jsonb_build_array(x)) is null) then
      return jsonb_build_object('ok', false, 'code', 'positions', 'message', 'Vị trí không hợp lệ.');
    end if;
  end if;
  if p ? 'position_note' then
    v_note := nullif(btrim(coalesce(p->>'position_note', '')), '');
    if length(coalesce(v_note, '')) > 80 then
      return jsonb_build_object('ok', false, 'code', 'position_note', 'message', 'Mô tả vị trí tối đa 80 ký tự.');
    end if;
  end if;
  if p ? 'status' then
    v_status := p->>'status';
    if v_status is null or v_status not in ('ACTIVE', 'PAUSED', 'LEFT') then
      return jsonb_build_object('ok', false, 'code', 'status', 'message', 'Trạng thái không hợp lệ.');
    end if;
  end if;
  update public.band_members set positions = v_pos, position_note = v_note, status = v_status,
    left_at = case when v_status = 'LEFT' then coalesce(left_at, now()) else null end
  where id = m.id;
  -- Rời Band → thôi mọi vai trò (Bộ máy luôn phản ánh người đang ở Band)
  if v_status = 'LEFT' then delete from public.band_member_roles where member_id = m.id; end if;
  return jsonb_build_object('ok', true);
end $$;
comment on function public.band_admin_update_member(uuid, jsonb) is 'band_management_v1: sửa vị trí/mô tả/trạng thái thành viên';

create or replace function public.band_admin_set_role(p_member_id uuid, p_role_key text, p_on boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m public.band_members; v_role jsonb; v_max int; n int;
begin
  select * into m from public.band_members where id = p_member_id;
  if m.id is null or not public.band_can_manage(m.band_id) then
    raise exception 'Không có quyền quản trị Band này' using errcode = '42501';
  end if;
  if not coalesce(p_on, false) then
    delete from public.band_member_roles where member_id = m.id and role_key = p_role_key;
    return jsonb_build_object('ok', true);
  end if;
  perform 1 from public.bands where id = m.band_id for update;   -- tuần tự hoá kiểm tra max
  select c into v_role from public.bands b, jsonb_array_elements(b.role_catalog) c where b.id = m.band_id and c->>'key' = p_role_key;
  if v_role is null then return jsonb_build_object('ok', false, 'code', 'role', 'message', 'Vai trò không có trong Bộ máy của Band.'); end if;
  if m.status = 'LEFT' then return jsonb_build_object('ok', false, 'code', 'left', 'message', m.full_name || ' đã rời Band.'); end if;
  if exists (select 1 from public.band_member_roles r where r.member_id = m.id and r.role_key = p_role_key) then
    return jsonb_build_object('ok', true);
  end if;
  v_max := nullif(v_role->>'max', '')::int;
  if v_max is not null then
    select count(*) into n from public.band_member_roles r where r.band_id = m.band_id and r.role_key = p_role_key;
    if n >= v_max then
      return jsonb_build_object('ok', false, 'code', 'full', 'message',
        (v_role->>'label') || ' chỉ có ' || v_max || ' người — bỏ người đang giữ trước.');
    end if;
  end if;
  insert into public.band_member_roles (band_id, member_id, role_key, assigned_by)
  values (m.band_id, m.id, p_role_key, auth.uid()) on conflict (member_id, role_key) do nothing;
  return jsonb_build_object('ok', true);
end $$;
comment on function public.band_admin_set_role(uuid, text, boolean) is 'band_management_v1: gán/bỏ vai trò vận hành';

-- ── 9) Quyền EXECUTE tường minh (KHÔNG hàm nào cho anon) ─────────────────────────────────────────
revoke all on function public.band_members_check(), public.band_member_roles_check(), public.band_can_manage(uuid),
  public.band_admin_overview(text), public.band_admin_accept(uuid), public.band_admin_set_status(uuid, text),
  public.band_positions_from(uuid, jsonb), public.band_admin_add_member(text, jsonb),
  public.band_admin_update_member(uuid, jsonb), public.band_admin_set_role(uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.band_admin_overview(text), public.band_admin_accept(uuid), public.band_admin_set_status(uuid, text),
  public.band_admin_add_member(text, jsonb), public.band_admin_update_member(uuid, jsonb), public.band_admin_set_role(uuid, text, boolean)
  to authenticated;

notify pgrst, 'reload schema';
