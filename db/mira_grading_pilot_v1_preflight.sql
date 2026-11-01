-- Preflight MIRA GRADING PILOT V1.1 — CHỈ ĐỌC (prod-db.py query). GATE = PASS mới dryrun/migrate.
-- Xác nhận production đang đúng bản V1 đã nghiệm thu (md5 thân hàm) và chưa có đối tượng pilot.
with checks(item, ok) as (
  select 'có 2 bảng V1 (khoá, vé)', to_regclass('public.mira_grading_keys') is not null and to_regclass('public.mira_grading_tickets') is not null
  union all select 'có 3 hàm V1', (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('mira_grading_ticket','mira_grading_end','mira_grading_context')) = 3
  union all select 'thân mira_grading_ticket = bản V1 đã nghiệm thu', (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.mira_grading_ticket(uuid)')) = 'b21ea3384d940448694b1fcc80a486ce'
  union all select 'thân mira_grading_context = bản V1 đã nghiệm thu', (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.mira_grading_context(text,text)')) = '32741fd4dc1a4e8ec9903d4c00e90895'
  union all select 'chưa có bảng mira_grading_pilot', to_regclass('public.mira_grading_pilot') is null
  union all select 'chưa có hàm mira_grading_pilot_enabled', to_regprocedure('public.mira_grading_pilot_enabled()') is null
  union all select 'có is_teacher()', to_regprocedure('public.is_teacher()') is not null
)
select 'CHECK' as section, (case when ok then 'OK   ' else 'FAIL ' end) || item as item from checks
union all select 'GATE', case when (select bool_and(coalesce(ok, false)) from checks) then 'PASS' else 'STOP' end;
