-- ═══════════════════════════════════════════════════════════════════════════
-- Class Phase 2 — Membership (09/2026). Idempotent. KHÔNG tạo hệ quyền mới.
--
--   Class/group      = lịch học + cohort (course_ids rỗng với lớp mô hình mới,
--                      xem db/class_funnel_no_course_ids.sql).
--   Package          = quyền nội dung CÓ HẠN (student_packages.granted_course_codes
--                      + renews_at) — has_course_access() đã đọc sẵn.
--   App tier         = packages.config.entitlement_tier → view student_entitlement_sources
--                      → get_effective_student_entitlement() (đã có, không đổi nghĩa tier).
--   membership_benefits = CHỈ catalog nhãn hiển thị, KHÔNG dùng để cấp/chặn quyền.
--   my_membership()  = RPC chỉ đọc, TỔNG HỢP từ nguồn thật cho /me (Phase 3).
--   activate_class_membership(lead) = Thầy xác nhận tiền → vào nhóm lớp + cấp gói (idempotent).
--
-- Không đụng: my_learning_state, IAP, billing_*, trigger lớp, ht_member, gói legacy
-- (chỉ THÊM key plan/plan_label vào config HT2027_* — không đổi mã, không đổi quyền).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Hai gói lớp mới ─────────────────────────────────────────────────────
insert into public.packages (package_code, name, description, status, config) values
 ('CLASS_MONTHLY', 'Học theo tháng', 'Học cùng Thầy hàng tuần, trả theo tháng', 'active',
  '{"plan":"monthly","plan_label":"Học theo tháng","renew_months":1,"price_vnd":499000,
    "benefits":["lop_hang_tuan","khoa_cua_lop","pdf_thang","app_co_ban"]}'),
 ('CLASS_SIXMONTH', 'Đồng hành 6 tháng', 'Học cùng Thầy hàng tuần + đầy đủ quyền lợi đồng hành', 'active',
  '{"plan":"six_month","plan_label":"Đồng hành 6 tháng","renew_months":6,"price_vnd":396000,"total_vnd":2376000,
    "entitlement_tier":"can_ban_396",
    "benefits":["lop_hang_tuan","kho_bai_giang","app_day_du","sach","hoi_thay","thuc_hanh","cong_dong"]}')
on conflict (package_code) do update set name = excluded.name, description = excluded.description,
  status = excluded.status, config = excluded.config, updated_at = now();

-- ── 2. Metadata plan cho gói HT2027 legacy (CHỈ thêm key hiển thị; không entitlement_tier) ──
update public.packages set config = config || '{"plan":"monthly","plan_label":"Học theo tháng"}', updated_at = now()
 where package_code = 'HT2027_MONTHLY' and coalesce(config->>'plan', '') <> 'monthly';
update public.packages set config = config || '{"plan":"six_month","plan_label":"Đồng hành 6 tháng"}', updated_at = now()
 where package_code = 'HT2027_SIXMONTH' and coalesce(config->>'plan', '') <> 'six_month';

-- ── 3. Catalog quyền lợi (hiển thị) ─────────────────────────────────────────
-- kind cho biết ACTIVE được SUY từ đâu (my_membership):
--   tier    → tier App thật ≥ min_tier            (quyền kỹ thuật)
--   package → gói còn hạn và có khoá được cấp     (quyền kỹ thuật)
--   class   → gói còn hạn và đang ở nhóm một lớp  (quyền kỹ thuật)
--   plan    → gói còn hạn và plan khai báo quyền lợi này (quyền VẬN HÀNH: Zalo, PDF, cộng đồng…)
create table if not exists public.membership_benefits (
  key        text primary key,
  label      text not null,
  kind       text not null check (kind in ('tier', 'package', 'class', 'plan')),
  min_tier   text check (min_tier in ('free', 'khoi_dau_99', 'can_ban_396', 'nang_cao_499')),
  sort_order int  not null default 0,
  note       text,
  check ((kind = 'tier') = (min_tier is not null))
);
insert into public.membership_benefits (key, label, kind, min_tier, sort_order, note) values
 ('lop_hang_tuan', 'Lớp học cùng Thầy hàng tuần', 'class',   null,          10, null),
 ('khoa_cua_lop',  'Bài giảng của lớp đang học',  'package', null,          20, 'Có hạn theo gói'),
 ('pdf_thang',     'Tài liệu PDF tháng này',      'plan',    null,          30, 'Gửi qua nhóm Zalo lớp'),
 ('app_co_ban',    'App cơ bản',                  'tier',    'free',        40, null),
 ('kho_bai_giang', 'Kho bài giảng',               'tier',    'khoi_dau_99', 50, null),
 ('app_day_du',    'App luyện tập đầy đủ',        'tier',    'can_ban_396', 60, null),
 ('sach',          'Sách & giáo trình',           'plan',    null,          70, null),
 ('hoi_thay',      'Hỏi Thầy qua Zalo',           'plan',    null,          80, null),
 ('thuc_hanh',     'Thực hành & hoạt động cùng Thầy', 'plan', null,         90, null),
 ('cong_dong',     'Cộng đồng học viên',          'plan',    null,         100, null)
on conflict (key) do update set label = excluded.label, kind = excluded.kind, min_tier = excluded.min_tier,
  sort_order = excluded.sort_order, note = excluded.note;

alter table public.membership_benefits enable row level security;
drop policy if exists mb_read on public.membership_benefits;
drop policy if exists mb_teacher_write on public.membership_benefits;
create policy mb_read on public.membership_benefits for select to anon, authenticated using (true);
create policy mb_teacher_write on public.membership_benefits for all to authenticated
  using (coalesce(public.is_teacher(), false)) with check (coalesce(public.is_teacher(), false));
-- NHỚ: bảng này nằm trong mảng self_managed của db/rls_setup.sql.

-- ── 4. my_membership(): TỔNG HỢP chỉ đọc cho "Quyền lợi của tôi" ───────────
create or replace function public.my_membership(p_student uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_sid uuid; v_uid uuid; v_teacher boolean := coalesce(public.is_teacher(), false);
  v_tier text := 'free'; v_tier_idx int; v_m record; v_valid boolean := false; v_plan_benefits jsonb := '[]';
  v_classes jsonb; v_benefits jsonb; v_history jsonb; v_membership jsonb := null;
  tiers constant text[] := array['free', 'khoi_dau_99', 'can_ban_396', 'nang_cao_499'];
begin
  if p_student is null then
    select id, user_id into v_sid, v_uid from public.edu_students where user_id = auth.uid() limit 1;
    if v_sid is null then return jsonb_build_object('student_id', null, 'membership', null); end if;
  else
    select id, user_id into v_sid, v_uid from public.edu_students where id = p_student;
    if v_sid is null then raise exception 'Không tìm thấy học viên'; end if;
    if not v_teacher and v_uid is distinct from auth.uid() then raise exception 'Không được xem quyền lợi của học viên khác'; end if;
  end if;

  -- Tier App thật (Store + gói + legacy) — cùng resolver với my_learning_state.
  select e.effective_tier into v_tier from public.get_effective_student_entitlement(v_sid) e;
  v_tier := coalesce(v_tier, 'free');
  v_tier_idx := coalesce(array_position(tiers, v_tier), 1) - 1;

  -- Membership = gói có config.plan (không phải gói Store). Ưu tiên gói đang hiệu lực,
  -- rồi six_month > monthly, rồi hạn xa hơn; không có gói hiệu lực → gói gần nhất (để hiện "đã hết hạn").
  select sp.*, p.package_code, p.name as pkg_name, p.config
    into v_m
    from public.student_packages sp join public.packages p on p.id = sp.package_id
   where sp.student_id = v_sid and p.config ? 'plan' and sp.entitlement_id is null
     and sp.status in ('active', 'trialing', 'expired', 'cancelled')
   order by public.package_term_valid(sp.status, sp.starts_at, sp.renews_at) desc,
            (p.config->>'plan' = 'six_month') desc, sp.renews_at desc nulls last, sp.starts_at desc
   limit 1;

  if v_m.id is not null then
    v_valid := public.package_term_valid(v_m.status, v_m.starts_at, v_m.renews_at);
    -- Quyền lợi vận hành theo plan: gói tự khai báo, thiếu thì lấy gói lớp chuẩn cùng plan.
    v_plan_benefits := coalesce(v_m.config->'benefits',
      (select p2.config->'benefits' from public.packages p2
        where p2.package_code in ('CLASS_MONTHLY', 'CLASS_SIXMONTH') and p2.config->>'plan' = v_m.config->>'plan'), '[]');
    v_membership := jsonb_build_object(
      'plan', v_m.config->>'plan',
      'label', coalesce(v_m.config->>'plan_label', v_m.pkg_name),
      'package_code', v_m.package_code,
      'status', case when v_valid then 'active'
                     when v_m.status in ('cancelled') then 'cancelled'
                     when v_m.starts_at > now() then 'scheduled'
                     else 'expired' end,
      'starts_at', v_m.starts_at,
      'ends_at', v_m.renews_at,
      'days_left', case when v_valid and v_m.renews_at is not null
                        then ceil(extract(epoch from (v_m.renews_at - now())) / 86400)::int end,
      'source', v_m.source,
      'renewal', case when coalesce(v_m.auto_renew, false) then 'auto' else 'manual' end,
      'course_codes', to_jsonb(coalesce(v_m.granted_course_codes, '{}'))
    );
  end if;

  -- Lớp đang theo: nhóm (≡ mã lớp) còn active, lớp chưa huỷ/kết thúc.
  select coalesce(jsonb_agg(jsonb_build_object(
           'code', c.code, 'name', c.name, 'public_product', c.public_product,
           'schedule', c.schedule, 'start_date', c.start_date, 'end_date', c.end_date,
           'next_session', (select jsonb_build_object('number', s.session_number, 'start_at', s.start_at, 'end_at', s.end_at)
                              from public.class_sessions s
                             where s.class_id = c.id and s.event_type = 'lesson' and s.status = 'scheduled' and s.end_at > now()
                             order by s.start_at limit 1))
         order by c.start_date nulls last), '[]')
    into v_classes
    from public.edu_group_members gm
    join public.edu_groups g on g.id = gm.group_id and g.code is not null
    join public.class_schedule c on upper(c.code) = upper(g.code)
   where gm.user_id = v_uid and gm.status = 'active'
     and coalesce(c.status, '') not in ('cancelled', 'merged', 'completed');

  select coalesce(jsonb_agg(jsonb_build_object(
           'key', b.key, 'label', b.label, 'kind', b.kind, 'note', b.note,
           'in_plan', v_plan_benefits ? b.key,
           'active', case b.kind
               when 'tier'    then v_tier_idx >= array_position(tiers, b.min_tier) - 1
               when 'package' then v_valid and coalesce(array_length(v_m.granted_course_codes, 1), 0) > 0
               when 'class'   then v_valid and jsonb_array_length(v_classes) > 0
               when 'plan'    then v_valid and v_plan_benefits ? b.key
             end,
           'reason', b.kind)
         order by b.sort_order), '[]')
    into v_benefits
    from public.membership_benefits b;

  select coalesce(jsonb_agg(jsonb_build_object(
           'package_code', p.package_code, 'plan', p.config->>'plan',
           'label', coalesce(p.config->>'plan_label', p.name), 'status', sp.status,
           'starts_at', sp.starts_at, 'ends_at', sp.renews_at, 'source', sp.source)
         order by sp.starts_at desc), '[]')
    into v_history
    from (select * from public.student_packages where student_id = v_sid and entitlement_id is null
          order by starts_at desc limit 12) sp
    join public.packages p on p.id = sp.package_id
   where p.config ? 'plan';

  return jsonb_build_object(
    'student_id', v_sid,
    'membership', v_membership,
    'classes', v_classes,
    'app_tier', v_tier,
    'benefits', v_benefits,
    'history', v_history,
    'generated_at', now());
end $$;
revoke all on function public.my_membership(uuid) from public, anon;
grant execute on function public.my_membership(uuid) to authenticated;

-- ── 5. Kích hoạt membership từ lead (Thầy bấm sau khi nhận tiền) ────────────
-- Idempotent theo lead: request_id suy từ lead.id → gọi lại/retry không cấp thêm kỳ.
-- Một transaction: vào nhóm lớp + cấp/gia hạn gói. KHÔNG ghi edu_course_access.
create or replace function public.activate_class_membership(p_lead bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_lead public.leads; v_plan text; v_code text; v_cls public.class_schedule; v_pkg public.packages;
  v_course text; v_uid uuid; v_req uuid; v_sp bigint; v_old public.student_packages; v_done boolean := false;
begin
  if not coalesce(public.is_teacher(), false) then raise exception 'Chỉ Thầy/Admin được kích hoạt'; end if;
  select * into v_lead from public.leads where id = p_lead for update;
  if v_lead.id is null then raise exception 'Không tìm thấy đăng ký #%', p_lead; end if;
  if v_lead.student_id is null then raise exception 'Đăng ký chưa gắn tài khoản học viên'; end if;
  v_plan := (regexp_match(coalesce(v_lead.note, ''), '\[plan:(monthly|six_month)\]'))[1];
  if v_plan is null then raise exception 'Đăng ký không có [plan:…] — không thuộc mô hình membership mới'; end if;
  v_code := upper((regexp_match(coalesce(v_lead.class_name, ''), '·\s*([A-Za-z0-9]+\.[A-Za-z0-9]+)\s*$'))[1]);
  if v_code is null then raise exception 'Không đọc được mã lớp trong đăng ký'; end if;
  select * into v_cls from public.class_schedule where upper(code) = v_code limit 1;
  if v_cls.id is null or v_cls.public_product is null then raise exception 'Lớp % không thuộc mô hình tuyển sinh mới', v_code; end if;
  if v_cls.group_id is null then raise exception 'Lớp % chưa có nhóm', v_code; end if;
  select code into v_course from public.edu_courses where id = v_cls.main_course_id;
  if v_course is null then raise exception 'Lớp % chưa có khoá chính', v_code; end if;
  select * into strict v_pkg from public.packages
   where package_code = case v_plan when 'monthly' then 'CLASS_MONTHLY' else 'CLASS_SIXMONTH' end and status = 'active';
  select user_id into v_uid from public.edu_students where id = v_lead.student_id;
  if v_uid is null then raise exception 'Học viên chưa có tài khoản đăng nhập'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_lead.student_id::text, 0));
  v_req := md5('class-membership:lead:' || p_lead)::uuid;
  select id into v_sp from public.student_packages
   where student_id = v_lead.student_id and external_transaction_id = 'admin-request:' || v_req;
  if v_sp is not null then
    v_done := true;
  else
    select * into v_old from public.student_packages
     where student_id = v_lead.student_id and package_id = v_pkg.id and status = 'active' and entitlement_id is null
     order by renews_at desc nulls last limit 1;
    if v_old.id is null then
      v_sp := public.manage_student_package(v_lead.student_id, 'grant', v_pkg.id, null, null, 'admin', array[v_course], v_req);
    else
      v_sp := public.manage_student_package(v_lead.student_id, 'renew', null, v_old.id, null, 'admin',
        array(select distinct unnest(coalesce(v_old.granted_course_codes, '{}') || array[v_course])), v_req);
    end if;
  end if;

  -- Vào nhóm lớp (xác định lớp). course_ids của lớp mới rỗng ⇒ trigger không cấp quyền vĩnh viễn.
  insert into public.edu_group_members (user_id, group_id, source, status)
  values (v_uid, v_cls.group_id, 'membership', 'active')
  on conflict (user_id, group_id) do update set status = 'active';

  update public.leads set status = 'Đã đóng phí' where id = p_lead and status is distinct from 'Đã đóng phí';

  return jsonb_build_object(
    'already_done', v_done, 'student_package_id', v_sp, 'package_code', v_pkg.package_code, 'plan', v_plan,
    'class_code', v_cls.code, 'course_code', v_course,
    'renews_at', (select renews_at from public.student_packages where id = v_sp),
    'granted_codes', (select to_jsonb(granted_course_codes) from public.student_packages where id = v_sp),
    'zalo_url', (select zalo_url from public.edu_groups where id = v_cls.group_id));
end $$;
revoke all on function public.activate_class_membership(bigint) from public, anon;
grant execute on function public.activate_class_membership(bigint) to authenticated;

notify pgrst, 'reload schema';
