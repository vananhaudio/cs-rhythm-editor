-- ═══════════════════════════════════════════════════════════════════════════
-- JOIN CLASS BY CODE V1 + LỐI VÀO HỌC CỦA LỚP. Cần Class Membership Canonical V1 (docs/CLASS-MEMBERSHIP-CANONICAL.md).
--   Mã tham gia = token trong edu_group_claim_tokens (hạ tầng claim-link sẵn có) gắn NHÓM CANONICAL của lớp.
--   • 8 ký tự ngẫu nhiên A–Z/2–9 (bỏ I, L, O, 0, 1 dễ nhầm), lưu IN HOA, không dấu. KHÔNG dùng mã lớp làm bí mật.
--   • class_join(code): server tự lấy auth.uid(), resolve code → nhóm → lớp, ghi vào nhóm canonical. Client không
--     gửi user_id / class_id / group_id. Idempotent. Lớp huỷ/gộp/nháp/đã kết thúc → không nhận. Người Admin đã bỏ khỏi
--     lớp → không tự vào lại bằng mã (liên hệ Thầy).
--   • admin_class_join_code(class, rotate): Thầy/Admin lấy (hoặc đổi) mã; đổi mã chỉ tắt mã tham gia cũ, không đụng
--     link claim khác của nhóm.
--   • class_learning_entry(class): thành viên/Thầy thấy khoá chính của lớp + mình đã có quyền học chưa (has_course_access)
--     + Giáo trình lớp (class_curriculum_access) — để trang lớp trỏ vào route học SẴN CÓ (/course?id=, màn Giáo trình).
-- Rollback: db/class_join_code_v1_rollback.sql. File KHÔNG có begin/commit. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';

do $gate$
begin
  if to_regclass('tva_private.class_memberships') is null
     or not exists (select 1 from pg_constraint where conname = 'class_schedule_one_member_group') then
    raise exception 'DỪNG — cần Class Membership Canonical V1 trước';
  end if;
  if to_regprocedure('public.has_course_access(uuid, uuid)') is null then
    raise exception 'DỪNG — thiếu public.has_course_access(uuid, uuid)';
  end if;
end $gate$;

create or replace function tva_private.normalize_join_code(p_code text) returns text
language sql immutable set search_path = '' as $$
  select nullif(regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g'), '');
$$;
revoke all on function tva_private.normalize_join_code(text) from public, anon, authenticated;

-- Lớp đang nhận người theo mã: một lớp còn sống có nhóm canonical là nhóm của token.
create or replace function tva_private.class_for_join_code(p_code text)
returns table(class_id uuid, group_id uuid, class_status text, n int)
language sql stable security definer set search_path = '' as $$
  with t as (
    select tk.group_id from public.edu_group_claim_tokens tk
    join public.edu_groups g on g.id = tk.group_id and g.is_active
    where tk.is_active and (tk.expires_at is null or tk.expires_at > now())
      and tk.token = tva_private.normalize_join_code(p_code)
      and tk.token ~ '^[A-HJ-KM-NP-Z2-9]{8}$'
    limit 1
  )
  select cs.id, t.group_id, cs.status, (count(*) over ())::int
  from t join public.class_schedule cs on cs.cohort_group_id = t.group_id
  order by (coalesce(cs.status, '') in ('cancelled', 'merged', 'draft', 'completed')), cs.start_date desc nulls last, cs.id;
$$;
revoke all on function tva_private.class_for_join_code(text) from public, anon, authenticated;

create or replace function public.class_join_preview(p_code text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r record; v_course jsonb; v_status text;
begin
  if auth.uid() is null then raise exception 'JOIN_NOT_AUTHENTICATED' using errcode = '42501'; end if;
  select * into r from tva_private.class_for_join_code(p_code) limit 1;
  if r.class_id is null then raise exception 'JOIN_INVALID' using errcode = '22023'; end if;
  if coalesce(r.class_status, '') in ('cancelled', 'merged', 'draft', 'completed') then raise exception 'JOIN_CLOSED' using errcode = '22023'; end if;
  select status into v_status from public.edu_group_members where group_id = r.group_id and user_id = auth.uid();
  select jsonb_build_object('code', c.code, 'name', c.name) into v_course
    from public.class_schedule cs join public.edu_courses c on c.id = cs.main_course_id where cs.id = r.class_id;
  return (select jsonb_build_object(
    'class_id', cs.id, 'code', cs.code, 'name', cs.name, 'status', cs.status, 'program_code', cs.program_code,
    'schedule', cs.schedule, 'start_date', cs.start_date, 'course', v_course,
    'member_count', tva_private.class_student_count(cs.id),
    'already_member', coalesce(v_status = 'active', false), 'removed', coalesce(v_status = 'removed', false))
    from public.class_schedule cs where cs.id = r.class_id);
end $$;

create or replace function public.class_join(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); r record; v_status text;
begin
  if v_uid is null then raise exception 'JOIN_NOT_AUTHENTICATED' using errcode = '42501'; end if;
  select * into r from tva_private.class_for_join_code(p_code) limit 1;
  if r.class_id is null then raise exception 'JOIN_INVALID' using errcode = '22023'; end if;
  if coalesce(r.class_status, '') in ('cancelled', 'merged', 'draft', 'completed') then raise exception 'JOIN_CLOSED' using errcode = '22023'; end if;
  if not exists (select 1 from public.edu_students s where s.user_id = v_uid and s.is_active) then
    raise exception 'JOIN_NO_PROFILE' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('class_join:' || v_uid::text || ':' || r.group_id::text, 0));
  select status into v_status from public.edu_group_members where group_id = r.group_id and user_id = v_uid;
  if v_status = 'removed' then raise exception 'JOIN_REMOVED' using errcode = '42501'; end if;
  if v_status is null or v_status <> 'active' then
    insert into public.edu_group_members (user_id, group_id, source, status)
    values (v_uid, r.group_id, 'join_code', 'active')
    on conflict (user_id, group_id) do update set status = 'active' where edu_group_members.status <> 'removed';
  end if;
  return jsonb_build_object('class_id', r.class_id, 'already_member', coalesce(v_status = 'active', false),
                            'member_count', tva_private.class_student_count(r.class_id));
end $$;

create or replace function public.admin_class_join_code(p_class uuid, p_rotate boolean default false)
returns text language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_status text; v_code text; i int := 0;
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  if auth.uid() is null or not public.is_teacher() then raise exception 'teacher/admin required' using errcode = '42501'; end if;
  select cohort_group_id, status into v_group, v_status from public.class_schedule where id = p_class for update;
  if not found then raise exception 'class not found'; end if;
  if v_group is null then raise exception 'class has no member group'; end if;
  if not coalesce(p_rotate, false) then
    select token into v_code from public.edu_group_claim_tokens
     where group_id = v_group and is_active and (expires_at is null or expires_at > now()) and token ~ '^[A-HJ-KM-NP-Z2-9]{8}$'
     order by created_at desc limit 1;
    if v_code is not null then return v_code; end if;
  end if;
  update public.edu_group_claim_tokens set is_active = false
   where group_id = v_group and is_active and token ~ '^[A-HJ-KM-NP-Z2-9]{8}$';
  loop
    i := i + 1;
    select string_agg(substr(alphabet, 1 + (get_byte(b, k) % length(alphabet)), 1), '' order by k)
      into v_code from (select decode(replace(gen_random_uuid()::text, '-', ''), 'hex') as b) x, generate_series(0, 7) k;
    begin
      insert into public.edu_group_claim_tokens (group_id, token, is_active) values (v_group, v_code, true);
      return v_code;
    exception when unique_violation then
      if i >= 5 then raise; end if;
    end;
  end loop;
end $$;

create or replace function public.class_learning_entry(p_class uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_teacher boolean; v_member boolean; v_sid uuid; cs public.class_schedule;
begin
  if v_uid is null then raise exception 'SC_NOT_MEMBER' using errcode = '42501'; end if;
  v_teacher := coalesce(public.is_teacher(), false);
  v_member := exists (select 1 from tva_private.class_memberships m where m.class_id = p_class and m.user_id = v_uid);
  if not (v_member or v_teacher) then raise exception 'SC_MEMBERS_ONLY' using errcode = '42501'; end if;
  select * into cs from public.class_schedule where id = p_class;
  if not found then raise exception 'SC_NOT_FOUND' using errcode = '22023'; end if;
  select id into v_sid from public.edu_students where user_id = v_uid order by is_active desc, enrolled_at desc nulls last limit 1;
  return jsonb_build_object(
    'class_id', cs.id, 'is_member', v_member,
    'course', (select jsonb_build_object('id', c.id, 'code', c.code, 'name', c.name,
                 'has_access', v_teacher or (v_sid is not null and public.has_course_access(v_sid, c.id)))
               from public.edu_courses c where c.id = cs.main_course_id),
    'curriculum', jsonb_build_object(
      'published', exists (select 1 from public.class_sessions s join public.class_lesson_content lc on lc.session_id = s.id
                           where s.class_id = cs.id and lc.status = 'published'),
      'has_access', v_teacher or exists (select 1 from public.class_curriculum_access a
                                         where a.class_id = cs.id and a.user_id = v_uid and a.status = 'active')));
end $$;

revoke all on function public.class_join_preview(text) from public, anon;
revoke all on function public.class_join(text) from public, anon;
revoke all on function public.admin_class_join_code(uuid, boolean) from public, anon;
revoke all on function public.class_learning_entry(uuid) from public, anon;
grant execute on function public.class_join_preview(text), public.class_join(text),
  public.admin_class_join_code(uuid, boolean), public.class_learning_entry(uuid) to authenticated;

notify pgrst, 'reload schema';
