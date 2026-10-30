-- Rollback P2b: khôi phục thân student_360_add_fact về bản P1 (mặc định 'student_and_teacher' cho mục không-suy-luận). Idempotent.
-- Thứ tự: rollback P2b TRƯỚC, rồi P2, rồi P1. Không đổi dữ liệu, quyền hay chữ ký.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$ begin
  if to_regprocedure('public.student_360_add_fact(uuid, text, text, text, text, text, text)') is null then
    raise notice 'student_360_p2b_rollback: không có student_360_add_fact — bỏ qua';
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
    v_vis := coalesce(p_visibility, case when v_origin = 'inferred' then 'teacher' else 'student_and_teacher' end);
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

revoke all on function public.student_360_add_fact(uuid, text, text, text, text, text, text) from public, anon;
grant execute on function public.student_360_add_fact(uuid, text, text, text, text, text, text) to authenticated;
