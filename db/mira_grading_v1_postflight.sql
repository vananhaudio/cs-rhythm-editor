-- Postflight MIRA CẠNH MÀN CHẤM BÀI V1 — CHỈ ĐỌC (prod-db.py query). GATE = PASS khi mọi quyền/cấu hình đúng thiết kế.
-- Dùng sau migration: chứng minh 2 bảng + 3 hàm đúng quyền, không FK, không policy, và không hàm Class nào bị đổi.
with checks(item, ok) as (
  select '2 bảng tồn tại, RLS BẬT', (select count(*) from pg_class where oid in ('public.mira_grading_keys'::regclass, 'public.mira_grading_tickets'::regclass) and relrowsecurity) = 2
  union all select 'không policy nào trên 2 bảng', (select count(*) from pg_policies where schemaname = 'public' and tablename like 'mira\_grading\_%') = 0
  union all select 'anon/authenticated/PUBLIC KHÔNG có quyền bảng', not exists (
      select 1 from (values ('anon'), ('authenticated')) r(role), (values ('public.mira_grading_keys'), ('public.mira_grading_tickets')) t(tbl),
             (values ('select'), ('insert'), ('update'), ('delete'), ('truncate'), ('references'), ('trigger')) p(priv) where has_table_privilege(r.role, t.tbl, p.priv))
  union all select 'không FK nào trên 2 bảng (không khoá auth.users / learning_threads)', (select count(*) from pg_constraint where contype = 'f' and conrelid in ('public.mira_grading_keys'::regclass, 'public.mira_grading_tickets'::regclass)) = 0
  union all select 'đúng 3 hàm mira_grading_*', (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'mira\_grading\_%') = 3
  union all select '3 hàm: SECURITY DEFINER + search_path rỗng', (select bool_and(prosecdef and proconfig = array['search_path=""']) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'mira\_grading\_%')
  union all select 'ticket/end: chỉ authenticated gọi được', has_function_privilege('authenticated', 'public.mira_grading_ticket(uuid)', 'execute') and not has_function_privilege('anon', 'public.mira_grading_ticket(uuid)', 'execute')
        and has_function_privilege('authenticated', 'public.mira_grading_end(uuid)', 'execute') and not has_function_privilege('anon', 'public.mira_grading_end(uuid)', 'execute')
  union all select 'context: chỉ anon gọi được (đòi khoá + vé)', has_function_privilege('anon', 'public.mira_grading_context(text,text)', 'execute') and not has_function_privilege('authenticated', 'public.mira_grading_context(text,text)', 'execute')
  union all select 'context khai báo STABLE (chỉ đọc)', (select provolatile = 's' from pg_proc where proname = 'mira_grading_context')
  union all select 'có ít nhất một khoá Mira còn hiệu lực (băm)', exists (select 1 from public.mira_grading_keys where revoked_at is null)
  union all select 'student_360_* vẫn không gọi được bởi anon', not has_function_privilege('anon', 'public.student_360_get(uuid, boolean)', 'execute')
)
select 'CHECK' as section, (case when ok then 'OK   ' else 'FAIL ' end) || item as item from checks
union all select 'GATE', case when (select bool_and(coalesce(ok, false)) from checks where item not like 'có ít nhất một khoá%') then 'PASS' else 'STOP' end
union all select 'KEY', case when exists (select 1 from public.mira_grading_keys where revoked_at is null) then 'đã đặt khoá Mira' else 'CHƯA đặt khoá Mira (bước cuối trước khi bật)' end;
