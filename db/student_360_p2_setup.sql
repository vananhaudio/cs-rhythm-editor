-- ═══════════════════════════════════════════════════════════════════════════
-- STUDENT 360° P2 — RPC đổi phạm vi hiển thị một mục. CHƯA CHẠY production. Idempotent.
-- Rollback: db/student_360_p2_rollback.sql. Preflight: db/student_360_p2_preflight.sql.
-- Test: scripts/test-student-360-db.sh (cluster PostgreSQL tạm, dữ liệu giả lập).
--
-- Vì sao: P1 chưa có đường nào để Thầy cho học viên xem một mục (mặc định suy luận chỉ Thầy thấy).
-- Owner chốt 27/10: mặc định chỉ Thầy xem; Thầy CHỦ ĐỘNG quyết định mục nào học viên được xem; không mở thêm quyền cho Mira.
--
-- student_360_set_visibility(p_fact, p_visibility): CHỈ Thầy; chỉ mục đang hiệu lực; ghi nhật ký (before/after).
-- Không đổi verification/nội dung. Học viên không gọi được. Idempotent (cùng giá trị → không ghi nhật ký).
-- CHẠY: qua scripts/prod-db.py (script tự giữ giao dịch — file KHÔNG có begin/commit).
-- ═══════════════════════════════════════════════════════════════════════════

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$ begin
  if to_regclass('public.student_360_facts') is null or to_regprocedure('public.student_360_log(uuid, uuid, text, jsonb, jsonb)') is null
     or to_regprocedure('public.student_360_fact_json(public.student_360_facts, boolean)') is null then
    raise exception 'student_360_p2: thiếu P1 (student_360_facts / student_360_log / student_360_fact_json) — dừng';
  end if;
end $$;

create or replace function public.student_360_set_visibility(p_fact uuid, p_visibility text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.student_360_need_uid();
  v_old public.student_360_facts; v_row public.student_360_facts;
begin
  if not public.is_teacher() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_visibility is null or p_visibility not in ('teacher','student_and_teacher') then
    raise exception 'bad_visibility' using errcode = '22023';
  end if;
  select * into v_old from public.student_360_facts where id = p_fact for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v_old.status <> 'active' then raise exception 'revoked' using errcode = '22023'; end if;
  if v_old.visibility = p_visibility then return public.student_360_fact_json(v_old, true); end if;

  update public.student_360_facts set visibility = p_visibility, updated_at = now()
   where id = p_fact returning * into v_row;
  perform public.student_360_log(p_fact, v_row.user_id, 'visibility:' || p_visibility, to_jsonb(v_old), to_jsonb(v_row));
  return public.student_360_fact_json(v_row, true);
end $$;

revoke all on function public.student_360_set_visibility(uuid, text) from public, anon;
grant execute on function public.student_360_set_visibility(uuid, text) to authenticated;
