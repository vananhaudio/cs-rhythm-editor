-- ═══════════════════════════════════════════════════════════════════════════
-- BAND — TUYỂN THÀNH VIÊN V1 (Band → Tuyển thành viên → Đơn ứng tuyển → Duyệt).
-- Thiết kế: docs/BAND-RECRUIT-V1.md. Rollback: db/band_recruit_v1_rollback.sql.
-- Preflight/postflight (read-only): db/band_recruit_v1_{preflight,postflight}.sql.
-- Test (cluster PostgreSQL tạm, KHÔNG production): scripts/test-band-recruit-db.sh.
--
-- Nguyên tắc:
--   • MỌI thứ riêng của một Band (tên, gu, lịch, bài tham chiếu, vị trí, câu hỏi, Rule) là DỮ LIỆU ở đây,
--     không nằm trong component. Band mới = INSERT dữ liệu (xem db/band_la_mua_thu_seed.sql), không viết code.
--   • Rule có PHIÊN BẢN BẤT BIẾN (band_rule_versions): sửa Rule = thêm version mới; đơn lưu rule_version_id
--     + rule_version + rules_accepted_at (giờ máy chủ) → luôn biết ứng viên đã đồng ý bản nào.
--   • Khách (anon) xem landing và gửi đơn KHÔNG cần đăng nhập — chỉ qua 2 RPC SECURITY DEFINER kiểm tra theo
--     config (giống tinh thần leads, nhưng chặt hơn: không INSERT thẳng bảng). Đã đăng nhập → server tự gắn
--     applicant_user_id = auth.uid() (client không gửi danh tính).
--   • Quản lý (đọc đơn / đổi trạng thái) = band_can_manage(band): Thầy/admin (is_teacher) HOẶC leader_user_id
--     của chính Band đó → mở đường cho Band Leader tự vận hành Band của mình sau này.
--   • Mở rộng sau (CHƯA làm, không bị chặn): band_members (application_id → thành viên), band_roles,
--     band_sessions/attendance, band_guests — đều treo vào bands.id; đơn ACCEPTED là nguồn tạo thành viên.
--
-- ⚠ Production cấp mặc định MỌI quyền bảng + EXECUTE hàm mới cho anon/authenticated (default privileges)
--   → mọi bảng/hàm dưới đây REVOKE tường minh. 4 bảng nằm trong self_managed của db/rls_setup.sql.
-- Chỉ TẠO MỚI — không sửa/thay bảng, hàm hay policy sẵn có. Idempotent.
-- CHẠY bằng scripts/prod-db.py (prod-db sở hữu transaction — file KHÔNG có begin/commit).
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';

-- ── 0) Cổng: phụ thuộc đúng như repo đã kiểm; tên mới chưa bị object lạ chiếm ─────────────────
do $gate$
declare n int;
begin
  -- is_teacher() là cổng quyền duy nhất dùng lại; md5 = bản production (preflight 29/09, test LT P1)
  if (select md5(prosrc) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
       where s.nspname = 'public' and p.proname = 'is_teacher') is distinct from '19b164504b4ce59b9bbdb4b0b64e48ad' then
    raise exception 'GATE: public.is_teacher() khác bản repo — dừng';
  end if;
  -- Tên hàm band_* đã có mà KHÔNG phải do file này tạo (comment đánh dấu) → dừng, không ghi đè
  select count(*) into n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname like 'band\_%'
     and coalesce(obj_description(p.oid, 'pg_proc'), '') not like 'band_recruit_v1:%';
  if n > 0 then raise exception 'GATE: đã có % hàm band_* lạ — dừng', n; end if;
  select count(*) into n from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relname in ('bands', 'band_recruitments', 'band_rule_versions', 'band_applications')
     and coalesce(obj_description(c.oid, 'pg_class'), '') not like 'band_recruit_v1:%';
  if n > 0 then raise exception 'GATE: đã có % bảng bands/band_* lạ — dừng', n; end if;
end $gate$;

-- ── 1) Bảng ────────────────────────────────────────────────────────────────────────────────
create table if not exists public.bands (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  name            text not null check (length(btrim(name)) between 1 and 120),
  leader_name     text,                                   -- tên hiển thị của Band Leader
  leader_user_id  uuid references auth.users(id) on delete set null,   -- Leader có tài khoản → được quản lý Band
  tagline         text,                                   -- một câu giới thiệu
  music_style     text,                                   -- gu nhạc
  schedule_text   text,                                   -- lịch dự kiến (chữ, ví dụ "19:00 Thứ Tư hàng tuần")
  reference_songs jsonb not null default '[]' check (jsonb_typeof(reference_songs) = 'array'),   -- [{title, artist?, url?}]
  highlights      jsonb not null default '[]' check (jsonb_typeof(highlights) = 'array'),        -- [{label, value}]
  description     text,
  status          text not null default 'active' check (status in ('draft', 'active', 'archived')),
  teamlab_team_id uuid,                                   -- nối TeamLab (teams.id) sau này — V1 không dùng
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on table public.bands is 'band_recruit_v1: Band (hồ sơ công khai + cấu hình). Gốc của tuyển thành viên/thành viên/vai trò/điểm danh sau này.';

-- Rule có phiên bản. BẤT BIẾN sau khi tạo (trigger bên dưới): đổi Rule = thêm version mới.
create table if not exists public.band_rule_versions (
  id           uuid primary key default gen_random_uuid(),
  band_id      uuid not null references public.bands(id) on delete restrict,
  version      int  not null check (version >= 1),
  title        text not null default 'Rule của Band',
  items        jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 30),   -- [text]
  agree_label  text not null default 'Tôi đã đọc và đồng ý thực hiện',
  created_at   timestamptz not null default now(),
  unique (band_id, version)
);
comment on table public.band_rule_versions is 'band_recruit_v1: Rule của Band theo phiên bản — bất biến; đơn ứng tuyển tham chiếu đúng bản đã đồng ý.';

-- Một đợt tuyển của Band: vị trí + câu hỏi + Rule đang áp dụng. Band có thể có nhiều đợt (mỗi slug một đợt mở).
create table if not exists public.band_recruitments (
  id               uuid primary key default gen_random_uuid(),
  band_id          uuid not null references public.bands(id) on delete restrict,
  title            text not null default 'Tuyển thành viên',
  intro            text,
  positions        jsonb not null check (jsonb_typeof(positions) = 'array' and jsonb_array_length(positions) between 1 and 30),   -- [{key, label}]
  questions        jsonb not null default '[]' check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) <= 20),
                   -- [{key, label, type:'single', required, options:[{value,label}]}]
  reason_label     text not null default 'Vì sao bạn muốn tham gia?',
  success_message  text,
  rule_version_id  uuid not null references public.band_rule_versions(id) on delete restrict,
  status           text not null default 'open' check (status in ('draft', 'open', 'closed')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.band_recruitments is 'band_recruit_v1: Đợt tuyển thành viên của Band — form lấy toàn bộ cấu hình từ đây.';
-- Mỗi Band chỉ một đợt đang mở (landing /band/<slug> trỏ đúng đợt đó)
create unique index if not exists band_recruitments_one_open on public.band_recruitments (band_id) where status = 'open';

create table if not exists public.band_applications (
  id                 uuid primary key default gen_random_uuid(),
  band_id            uuid not null references public.bands(id) on delete restrict,
  recruitment_id     uuid not null references public.band_recruitments(id) on delete restrict,
  applicant_user_id  uuid references auth.users(id) on delete set null,   -- có khi gửi lúc đã đăng nhập
  full_name          text not null check (length(btrim(full_name)) between 2 and 80),
  phone              text not null check (phone ~ '^0[0-9]{8,10}$'),           -- đã chuẩn hoá (0xxxxxxxxx)
  position_key       text not null,
  position_other     text check (position_other is null or length(position_other) <= 80),
  answers            jsonb not null default '{}' check (jsonb_typeof(answers) = 'object'),
  reason             text not null check (length(btrim(reason)) between 1 and 2000),
  rule_version_id    uuid not null references public.band_rule_versions(id) on delete restrict,
  rule_version       int  not null,
  rules_accepted_at  timestamptz not null,
  status             text not null default 'NEW' check (status in ('NEW', 'REVIEWING', 'ACCEPTED', 'REJECTED')),
  status_changed_at  timestamptz,
  status_changed_by  uuid references auth.users(id) on delete set null,
  client_key         text not null check (length(client_key) between 8 and 64),
  created_at         timestamptz not null default now(),
  unique (recruitment_id, client_key)
);
comment on table public.band_applications is 'band_recruit_v1: Đơn ứng tuyển — ghi CHỈ qua band_apply(); đọc/duyệt CHỈ qua band_admin_*.';
create index if not exists band_applications_band_idx on public.band_applications (band_id, created_at desc);
create index if not exists band_applications_phone_idx on public.band_applications (recruitment_id, phone);

-- ── 2) Bất biến của Rule ─────────────────────────────────────────────────────────────────────
create or replace function public.band_rule_versions_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Rule đã phát hành là bất biến — hãy tạo phiên bản mới' using errcode = 'check_violation';
end $$;
comment on function public.band_rule_versions_immutable() is 'band_recruit_v1: chặn UPDATE/DELETE phiên bản Rule';
drop trigger if exists band_rule_versions_immutable on public.band_rule_versions;
create trigger band_rule_versions_immutable before update or delete on public.band_rule_versions
  for each row execute function public.band_rule_versions_immutable();

-- Rule của đợt tuyển phải thuộc CHÍNH Band đó
create or replace function public.band_recruitments_check()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.band_rule_versions r where r.id = new.rule_version_id and r.band_id = new.band_id) then
    raise exception 'rule_version_id không thuộc Band này' using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end $$;
comment on function public.band_recruitments_check() is 'band_recruit_v1: Rule của đợt tuyển thuộc đúng Band';
drop trigger if exists band_recruitments_check on public.band_recruitments;
create trigger band_recruitments_check before insert or update on public.band_recruitments
  for each row execute function public.band_recruitments_check();

-- ── 3) RLS: bật, KHÔNG policy cho anon/authenticated — mọi truy cập qua RPC bên dưới ──────────
alter table public.bands              enable row level security;
alter table public.band_rule_versions enable row level security;
alter table public.band_recruitments  enable row level security;
alter table public.band_applications  enable row level security;
revoke all on table public.bands, public.band_rule_versions, public.band_recruitments, public.band_applications
  from public, anon, authenticated;

-- ── 4) Quyền quản lý một Band ─────────────────────────────────────────────────────────────────
create or replace function public.band_can_manage(p_band_id uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select auth.uid() is not null and (
    public.is_teacher()
    or exists (select 1 from public.bands b where b.id = p_band_id and b.leader_user_id = auth.uid()))
$$;
comment on function public.band_can_manage(uuid) is 'band_recruit_v1: Thầy/admin hoặc Leader của Band';

-- ── 5) Landing công khai: hồ sơ Band + đợt tuyển đang mở + Rule hiện hành (KHÔNG có dữ liệu ứng viên) ──
create or replace function public.band_recruitment_public(p_slug text)
returns jsonb language sql security definer set search_path = '' stable as $$
  select jsonb_build_object(
    'band', jsonb_build_object('id', b.id, 'slug', b.slug, 'name', b.name, 'leader_name', b.leader_name,
      'tagline', b.tagline, 'music_style', b.music_style, 'schedule_text', b.schedule_text,
      'reference_songs', b.reference_songs, 'highlights', b.highlights, 'description', b.description),
    'recruitment', case when r.id is null then null else jsonb_build_object('id', r.id, 'title', r.title, 'intro', r.intro,
      'positions', r.positions, 'questions', r.questions, 'reason_label', r.reason_label,
      'success_message', r.success_message) end,
    'rules', case when v.id is null then null else jsonb_build_object('id', v.id, 'version', v.version, 'title', v.title,
      'items', v.items, 'agree_label', v.agree_label) end)
  from public.bands b
  left join public.band_recruitments r on r.band_id = b.id and r.status = 'open'
  left join public.band_rule_versions v on v.id = r.rule_version_id
  where b.slug = lower(btrim(p_slug)) and b.status = 'active'
$$;
comment on function public.band_recruitment_public(text) is 'band_recruit_v1: dữ liệu landing tuyển thành viên (công khai)';

-- ── 6) Gửi đơn ─────────────────────────────────────────────────────────────────────────────────
-- Kiểm tra mọi thứ THEO CONFIG của đợt tuyển. Trả {ok, duplicate?} hoặc {ok:false, code, message} — không trả PII.
create or replace function public.band_apply(p_recruitment_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.band_recruitments;
  v public.band_rule_versions;
  q jsonb;
  v_name text := btrim(coalesce(p->>'full_name', ''));
  v_phone text := regexp_replace(coalesce(p->>'phone', ''), '[^0-9+]', '', 'g');
  v_pos text := coalesce(p->>'position_key', '');
  v_other text := nullif(btrim(coalesce(p->>'position_other', '')), '');
  v_reason text := btrim(coalesce(p->>'reason', ''));
  v_key text := coalesce(p->>'client_key', '');
  v_answers jsonb := coalesce(p->'answers', '{}'::jsonb);
  v_clean jsonb := '{}'::jsonb;
  v_ans text;
  v_id uuid;
begin
  if coalesce(p->>'website', '') <> '' then   -- bẫy bot (ô ẩn): giả như thành công, không ghi
    return jsonb_build_object('ok', true);
  end if;
  select * into r from public.band_recruitments where id = p_recruitment_id;
  if r.id is null or r.status <> 'open'
     or not exists (select 1 from public.bands b where b.id = r.band_id and b.status = 'active') then
    return jsonb_build_object('ok', false, 'code', 'closed', 'message', 'Đợt tuyển này đã đóng.');
  end if;
  select * into v from public.band_rule_versions where id = r.rule_version_id;
  if (p->>'rule_version_id') is distinct from v.id::text then
    return jsonb_build_object('ok', false, 'code', 'rule_changed', 'message', 'Rule của Band vừa được cập nhật. Vui lòng đọc lại Rule và xác nhận.');
  end if;
  if (p->'rules_accepted') is distinct from 'true'::jsonb then
    return jsonb_build_object('ok', false, 'code', 'rules', 'message', 'Bạn cần đọc và đồng ý Rule trước khi gửi đơn.');
  end if;
  if length(v_name) < 2 or length(v_name) > 80 then
    return jsonb_build_object('ok', false, 'code', 'full_name', 'message', 'Vui lòng nhập họ và tên (2–80 ký tự).');
  end if;
  if v_phone like '+84%' then v_phone := '0' || substr(v_phone, 4);
  elsif v_phone like '84%' and length(v_phone) >= 11 then v_phone := '0' || substr(v_phone, 3); end if;
  if v_phone !~ '^0[0-9]{8,10}$' then
    return jsonb_build_object('ok', false, 'code', 'phone', 'message', 'Số điện thoại/Zalo chưa đúng.');
  end if;
  if not exists (select 1 from jsonb_array_elements(r.positions) x where x->>'key' = v_pos) then
    return jsonb_build_object('ok', false, 'code', 'position_key', 'message', 'Vui lòng chọn vị trí muốn tham gia.');
  end if;
  if length(coalesce(v_other, '')) > 80 then
    return jsonb_build_object('ok', false, 'code', 'position_other', 'message', 'Mô tả vị trí tối đa 80 ký tự.');
  end if;
  if jsonb_typeof(v_answers) <> 'object' then v_answers := '{}'::jsonb; end if;
  -- Chỉ giữ câu trả lời của câu hỏi CÓ trong config, giá trị phải là một option hợp lệ
  for q in select * from jsonb_array_elements(r.questions) loop
    v_ans := v_answers->>(q->>'key');
    if v_ans is null or v_ans = '' then
      if coalesce((q->>'required')::boolean, true) then
        return jsonb_build_object('ok', false, 'code', q->>'key', 'message', 'Vui lòng trả lời: ' || (q->>'label'));
      end if;
    elsif not exists (select 1 from jsonb_array_elements(q->'options') o where o->>'value' = v_ans) then
      return jsonb_build_object('ok', false, 'code', q->>'key', 'message', 'Câu trả lời không hợp lệ: ' || (q->>'label'));
    else
      v_clean := v_clean || jsonb_build_object(q->>'key', v_ans);
    end if;
  end loop;
  if length(v_reason) < 1 or length(v_reason) > 2000 then
    return jsonb_build_object('ok', false, 'code', 'reason', 'message', 'Vui lòng cho biết lý do bạn muốn tham gia (tối đa 2000 ký tự).');
  end if;
  if length(v_key) < 8 or length(v_key) > 64 then
    return jsonb_build_object('ok', false, 'code', 'client_key', 'message', 'Phiên gửi đơn không hợp lệ — tải lại trang.');
  end if;

  -- Bấm đúp / mạng chập chờn: cùng client_key → coi như đã gửi
  if exists (select 1 from public.band_applications a where a.recruitment_id = r.id and a.client_key = v_key) then
    return jsonb_build_object('ok', true);
  end if;
  -- Một số điện thoại một đơn đang xét trong mỗi đợt (đơn đã bị từ chối thì được gửi lại)
  if exists (select 1 from public.band_applications a where a.recruitment_id = r.id and a.phone = v_phone and a.status <> 'REJECTED') then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  insert into public.band_applications (band_id, recruitment_id, applicant_user_id, full_name, phone, position_key, position_other,
    answers, reason, rule_version_id, rule_version, rules_accepted_at, client_key)
  values (r.band_id, r.id, auth.uid(), v_name, v_phone, v_pos, v_other, v_clean, v_reason, v.id, v.version, now(), v_key)
  on conflict (recruitment_id, client_key) do nothing
  returning id into v_id;
  return jsonb_build_object('ok', true);
end $$;
comment on function public.band_apply(uuid, jsonb) is 'band_recruit_v1: gửi đơn ứng tuyển (khách hoặc đã đăng nhập), kiểm tra theo config đợt tuyển';

-- ── 7) Admin: danh sách Band mình quản lý · đơn của một Band · đổi trạng thái ───────────────────
create or replace function public.band_admin_bands()
returns jsonb language sql security definer set search_path = '' stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'slug', b.slug, 'name', b.name, 'status', b.status,
           'recruitment_status', (select r.status from public.band_recruitments r where r.band_id = b.id
                                  order by (r.status = 'open') desc, r.created_at desc limit 1),
           'total', (select count(*) from public.band_applications a where a.band_id = b.id),
           'new', (select count(*) from public.band_applications a where a.band_id = b.id and a.status = 'NEW'))
         order by b.created_at), '[]'::jsonb)
  from public.bands b
  where public.band_can_manage(b.id)
$$;
comment on function public.band_admin_bands() is 'band_recruit_v1: Band mà người gọi được quản lý + số đơn';

create or replace function public.band_admin_applications(p_slug text)
returns jsonb language plpgsql security definer set search_path = '' stable as $$
declare b public.bands;
begin
  select * into b from public.bands where slug = lower(btrim(p_slug));
  if b.id is null or not public.band_can_manage(b.id) then
    raise exception 'Không có quyền xem đơn của Band này' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'band', jsonb_build_object('id', b.id, 'slug', b.slug, 'name', b.name),
    -- cấu hình của MỌI đợt tuyển có đơn → giao diện tự dịch key → nhãn (không hardcode cột)
    'recruitments', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'title', r.title, 'status', r.status,
        'positions', r.positions, 'questions', r.questions, 'reason_label', r.reason_label) order by r.created_at)
      from public.band_recruitments r where r.band_id = b.id), '[]'::jsonb),
    'applications', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'recruitment_id', a.recruitment_id,
        'full_name', a.full_name, 'phone', a.phone, 'position_key', a.position_key, 'position_other', a.position_other,
        'answers', a.answers, 'reason', a.reason, 'rule_version', a.rule_version, 'rules_accepted_at', a.rules_accepted_at,
        'status', a.status, 'status_changed_at', a.status_changed_at, 'has_account', a.applicant_user_id is not null,
        'created_at', a.created_at) order by a.created_at desc)
      from public.band_applications a where a.band_id = b.id), '[]'::jsonb));
end $$;
comment on function public.band_admin_applications(text) is 'band_recruit_v1: đơn ứng tuyển của một Band (Thầy/Leader)';

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
  if a.status <> p_status then
    update public.band_applications set status = p_status, status_changed_at = now(), status_changed_by = auth.uid()
     where id = a.id;
  end if;
  return jsonb_build_object('ok', true, 'status', p_status);
end $$;
comment on function public.band_admin_set_status(uuid, text) is 'band_recruit_v1: đổi trạng thái đơn NEW/REVIEWING/ACCEPTED/REJECTED';

-- ── 8) Quyền EXECUTE tường minh ────────────────────────────────────────────────────────────────
revoke all on function public.band_rule_versions_immutable(), public.band_recruitments_check(),
  public.band_can_manage(uuid), public.band_recruitment_public(text), public.band_apply(uuid, jsonb),
  public.band_admin_bands(), public.band_admin_applications(text), public.band_admin_set_status(uuid, text)
  from public, anon, authenticated;
grant execute on function public.band_recruitment_public(text), public.band_apply(uuid, jsonb) to anon, authenticated;
grant execute on function public.band_admin_bands(), public.band_admin_applications(text), public.band_admin_set_status(uuid, text)
  to authenticated;

notify pgrst, 'reload schema';
