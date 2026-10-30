-- ═══════════════════════════════════════════════════════════════════════════
-- STUDENT 360° P2b — MẶC ĐỊNH AN TOÀN PHÍA MÁY CHỦ cho student_360_add_fact. CHƯA CHẠY production. Idempotent.
-- Rollback: db/student_360_p2b_rollback.sql (khôi phục thân hàm P1). Preflight: db/student_360_p2b_preflight.sql.
-- Test: scripts/test-student-360-db.sh (cluster PostgreSQL tạm).
--
-- Vì sao: P1 để Thầy gọi add_fact KHÔNG truyền p_visibility thì mục không-suy-luận mặc định 'student_and_teacher' (học viên thấy ngay).
-- Owner chốt 30/10: mọi fact Thầy thêm mặc định chỉ Thầy thấy; chia sẻ chỉ qua hành động tường minh (p_visibility hoặc set_visibility).
-- Phạm vi: CHỈ đổi mặc định nhánh Thầy. KHÔNG đổi chữ ký (create or replace, không overload), quyền EXECUTE, RLS, dữ liệu đã có.
-- Nhánh HỌC VIÊN giữ nguyên: học viên tự thêm mục của mình thì luôn hiển thị cho chính họ và Thầy (đó là dữ liệu họ tự nhập).
-- CHẠY: qua scripts/prod-db.py (file KHÔNG có begin/commit).
-- ═══════════════════════════════════════════════════════════════════════════

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$ declare n int; src text; begin
  select count(*), max(prosrc) into n, src from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'student_360_add_fact';
  if n <> 1 then raise exception 'student_360_p2b: student_360_add_fact có % bản (cần đúng 1) — dừng', n; end if;
  if md5(src) <> 'a42fa03906e06e2cb3c49331701edd05' and src not like '%p2b-safe-default%' then
    raise exception 'student_360_p2b: thân student_360_add_fact không phải bản P1 đã biết (có thể phiên khác đã sửa) — dừng';
  end if;
end $$;

create or replace function public.student_360_add_fact(
  p_user uuid, p_category text, p_content text,
  p_origin text default 'self_reported', p_source_kind text default 'student',
  p_source_ref text default null, p_visibility text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.student_360_need_uid();
  v_target uuid := coalesce(p_user, v_uid);
  v_teacher boolean := public.is_teacher();
  v_content text := btrim(coalesce(p_content, ''));
  v_origin text; v_kind text; v_ref text; v_vis text; v_row public.student_360_facts;
begin
  if v_target <> v_uid and not v_teacher then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_content = '' then raise exception 'content_required' using errcode = '22023'; end if;

  if v_teacher then
    v_origin := coalesce(p_origin, 'self_reported'); v_kind := coalesce(p_source_kind, 'teacher'); v_ref := p_source_ref;
    v_vis := coalesce(p_visibility, 'teacher');   -- p2b-safe-default: Thầy thêm mà không nói rõ → chỉ Thầy thấy; chia sẻ phải là hành động chủ động
  else
    v_origin := 'self_reported'; v_kind := 'student'; v_ref := null; v_vis := 'student_and_teacher';
    if (select count(*) from public.student_360_facts where user_id = v_target and status = 'active') >= 50 then
      raise exception 'too_many_facts' using errcode = '54000';
    end if;
  end if;

  insert into public.student_360_facts (user_id, category, content, origin, source_kind, source_ref, visibility, created_by)
  values (v_target, p_category, v_content, v_origin, v_kind, v_ref, v_vis, v_uid)
  returning * into v_row;
  perform public.student_360_log(v_row.id, v_target, 'create', null, to_jsonb(v_row));
  return public.student_360_fact_json(v_row, v_teacher);
end $$;

-- Giữ nguyên quyền như P1 (create or replace không đổi ACL; khai báo lại để rõ ràng và idempotent).
revoke all on function public.student_360_add_fact(uuid, text, text, text, text, text, text) from public, anon;
grant execute on function public.student_360_add_fact(uuid, text, text, text, text, text, text) to authenticated;
