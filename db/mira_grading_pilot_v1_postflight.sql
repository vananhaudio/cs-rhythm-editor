-- Postflight MIRA GRADING PILOT V1.1 — CHỈ ĐỌC (prod-db.py query). Thay postflight V1 (V1 đếm đúng 3 hàm; sau pilot có 4).
with checks(item, ok) as (
  select 'bảng pilot tồn tại, RLS BẬT', coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.mira_grading_pilot')), false)
  union all select 'không policy nào trên 3 bảng mira_grading_*', (select count(*) from pg_policies where schemaname = 'public' and tablename like 'mira\_grading\_%') = 0
  union all select 'anon/authenticated KHÔNG có quyền trực tiếp trên 3 bảng', not exists (
      select 1 from (values ('anon'), ('authenticated')) r(role), (values ('public.mira_grading_keys'), ('public.mira_grading_tickets'), ('public.mira_grading_pilot')) t(tbl),
             (values ('select'), ('insert'), ('update'), ('delete'), ('truncate'), ('references'), ('trigger')) p(priv) where has_table_privilege(r.role, t.tbl, p.priv))
  union all select 'không FK trên 3 bảng', (select count(*) from pg_constraint where contype = 'f' and conrelid in ('public.mira_grading_keys'::regclass, 'public.mira_grading_tickets'::regclass, 'public.mira_grading_pilot'::regclass)) = 0
  union all select 'đúng 4 hàm mira_grading_*', (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'mira\_grading\_%') = 4
  union all select '4 hàm: SECURITY DEFINER + search_path rỗng', (select bool_and(prosecdef and proconfig = array['search_path=""']) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'mira\_grading\_%')
  union all select 'ticket/end: chỉ authenticated', has_function_privilege('authenticated', 'public.mira_grading_ticket(uuid)', 'execute') and not has_function_privilege('anon', 'public.mira_grading_ticket(uuid)', 'execute')
        and has_function_privilege('authenticated', 'public.mira_grading_end(uuid)', 'execute') and not has_function_privilege('anon', 'public.mira_grading_end(uuid)', 'execute')
  union all select 'pilot_enabled: chỉ authenticated, STABLE', has_function_privilege('authenticated', 'public.mira_grading_pilot_enabled()', 'execute') and not has_function_privilege('anon', 'public.mira_grading_pilot_enabled()', 'execute')
        and (select provolatile = 's' from pg_proc where proname = 'mira_grading_pilot_enabled')
  union all select 'context: chỉ anon (đòi khoá + vé), STABLE', has_function_privilege('anon', 'public.mira_grading_context(text,text)', 'execute') and not has_function_privilege('authenticated', 'public.mira_grading_context(text,text)', 'execute')
        and (select provolatile = 's' from pg_proc where proname = 'mira_grading_context')
  union all select 'thân mira_grading_ticket = bản pilot đã nghiệm thu', (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.mira_grading_ticket(uuid)')) = 'a7b42c4eb698071ee49d4c6d65bce9ca'
  union all select 'thân mira_grading_context = bản pilot đã nghiệm thu', (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.mira_grading_context(text,text)')) = '485339e878064c693d5a7866ba6022ae'
  union all select 'student_360_* vẫn không gọi được bởi anon', not has_function_privilege('anon', 'public.student_360_get(uuid, boolean)', 'execute')
)
select 'CHECK' as section, (case when ok then 'OK   ' else 'FAIL ' end) || item as item from checks
union all select 'GATE', case when (select bool_and(coalesce(ok, false)) from checks) then 'PASS' else 'STOP' end
union all select 'KEY', case when exists (select 1 from public.mira_grading_keys where revoked_at is null) then 'khoá Mira V1 còn hiệu lực' else 'KHÔNG còn khoá Mira hiệu lực' end
union all select 'PILOT', (select count(*) from public.mira_grading_pilot)::text || ' tài khoản trong danh sách pilot';
