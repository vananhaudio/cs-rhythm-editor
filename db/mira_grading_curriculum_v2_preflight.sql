-- Preflight MIRA GRADING CURRICULUM V2 — CHỈ ĐỌC (prod-db.py query). GATE = PASS mới dryrun/migrate.
-- Xác nhận production đang đúng bản V1.1 đã nghiệm thu và chưa có hàm phụ của V2; nguồn published còn đúng hình dạng.
with checks(item, ok) as (
  select 'thân mira_grading_context = V1.1 đã nghiệm thu', (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.mira_grading_context(text,text)')) = '485339e878064c693d5a7866ba6022ae'
  union all select 'chưa có 3 hàm phụ V2', (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('mira_gc_s','mira_gc_strs','mira_grading_curriculum_data')) = 0
  union all select 'có bảng pilot + vé + khoá', to_regclass('public.mira_grading_pilot') is not null and to_regclass('public.mira_grading_tickets') is not null and to_regclass('public.mira_grading_keys') is not null
  union all select 'pilot vẫn đúng 1 dòng (không mở rộng ngoài Owner)', (select count(*) from public.mira_grading_pilot) = 1
  union all select 'context chỉ anon được gọi', has_function_privilege('anon', 'public.mira_grading_context(text,text)', 'execute') and not has_function_privilege('authenticated', 'public.mira_grading_context(text,text)', 'execute')
  union all select 'có class_lesson_content published (nguồn học viên đang học)', exists (select 1 from public.class_lesson_content where status = 'published')
  union all select 'mọi blocks published là mảng JSON', not exists (select 1 from public.class_lesson_content where status = 'published' and jsonb_typeof(blocks) <> 'array')
)
select 'CHECK' as section, (case when ok then 'OK   ' else 'FAIL ' end) || item as item from checks
union all select 'GATE', case when (select bool_and(coalesce(ok, false)) from checks) then 'PASS' else 'STOP' end;
