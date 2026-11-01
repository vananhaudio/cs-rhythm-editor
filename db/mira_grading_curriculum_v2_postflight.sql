-- Postflight MIRA GRADING CURRICULUM V2 — CHỈ ĐỌC (prod-db.py query). GATE = PASS mới coi là xong.
-- Không cần vé: gọi thẳng hàm thuần trên blocks published THẬT (quyền của Mira/vé/pilot đã có test riêng và được kiểm bằng hash + ACL ở đây).
with probe as (
  select s.id sid, c.blocks, public.mira_grading_curriculum_data(c.blocks, '1.1', s.title, c.updated_at) d
    from public.class_lesson_content c join public.class_sessions s on s.id = c.session_id
   where c.status = 'published' and s.session_number = 1 and s.event_type = 'lesson' and s.class_id = 'c9828885-8593-4377-9196-19b43dae90bc'
), checks(item, ok) as (
  select 'thân mira_grading_context = V2', (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.mira_grading_context(text,text)')) = 'dbd5b076cd47916dede475c6690f6e83'
  union all select 'có đủ 3 hàm phụ', (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('mira_gc_s','mira_gc_strs','mira_grading_curriculum_data')) = 3
  union all select '3 hàm phụ: public/anon/authenticated KHÔNG gọi được', not exists (select 1 from pg_proc p, (values ('public'),('anon'),('authenticated')) v(r) where p.proname in ('mira_gc_s','mira_gc_strs','mira_grading_curriculum_data') and p.pronamespace = 'public'::regnamespace and has_function_privilege(v.r, p.oid, 'execute'))
  union all select 'context: chỉ anon gọi được (không public/authenticated)', has_function_privilege('anon', 'public.mira_grading_context(text,text)', 'execute') and not has_function_privilege('authenticated', 'public.mira_grading_context(text,text)', 'execute') and not has_function_privilege('public', 'public.mira_grading_context(text,text)', 'execute')
  union all select 'context vẫn SECURITY DEFINER, STABLE, search_path rỗng', (select prosecdef and provolatile = 's' and coalesce(proconfig, '{}'::text[]) @> array['search_path=""'] from pg_proc where oid = to_regprocedure('public.mira_grading_context(text,text)'))
  union all select 'context vẫn kiểm khoá + vé + pilot', (select prosrc like '%mira_grading_keys%' and prosrc like '%mira_grading_tickets%' and prosrc like '%mira_grading_pilot%' and prosrc like '%forbidden%' from pg_proc where oid = to_regprocedure('public.mira_grading_context(text,text)'))
  union all select 'pilot vẫn đúng 1 dòng', (select count(*) from public.mira_grading_pilot) = 1
  union all select 'thử thật trên SOLO01.TH01 Buổi 1 (bài 1.1): có đề mới', (select d -> 'checkpoint' ->> 'prompt' like '%cùng cao độ%' from probe)
  union all select 'thử thật: có bản đồ nốt với C ở dây 3 ngăn 5 và dây 2 ngăn 1', (select (select count(*) from jsonb_array_elements(d -> 'fretboard' -> 0 -> 'dots') x where x ->> 'name' = 'C' and ((x ->> 'string', x ->> 'fret') in (('3','5'), ('2','1')))) = 2 from probe)
  union all select 'thử thật: có lời dặn (assignment) và checklist', (select d -> 'guide' @> '[{"kind":"assignment"}]'::jsonb and d -> 'guide' @> '[{"kind":"checklist"}]'::jsonb from probe)
  union all select 'thử thật: không lọt ký hiệu nhạc / quiz', (select d::text !~ '\\ts |"tex"|"quiz"' from probe)
)
select 'CHECK' as section, (case when ok then 'OK   ' else 'FAIL ' end) || item as item from checks
union all select 'GATE', case when (select bool_and(coalesce(ok, false)) from checks) then 'PASS' else 'STOP' end;
