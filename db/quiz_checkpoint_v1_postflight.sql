/*
POSTFLIGHT QUIZ CHECKPOINT V1 — READ-ONLY (một câu SELECT). Chạy SAU db/quiz_checkpoint_v1_setup.sql.
GATE PASS = đủ object · 2 hàm đã là bản QUIZ_CHECKPOINT_V1 · 2 bảng bật RLS, không policy, không grant cho anon/authenticated
· RPC chỉ authenticated · mọi checkpoint trắc nghiệm đã xuất bản đều có đáp án hợp lệ (đúng mode, đáp án ⊂ lựa chọn).
*/
with quiz as (
  select s.id as session_id, c.status, x.b ->> 'id' as cp, x.b -> 'quiz' ->> 'mode' as mode,
         array(select o ->> 'id' from jsonb_array_elements(case when jsonb_typeof(x.b -> 'quiz' -> 'options') = 'array' then x.b -> 'quiz' -> 'options' else '[]'::jsonb end) o) as opts
  from public.class_sessions s join public.class_lesson_content c on c.session_id = s.id and c.status = 'published'
  cross join lateral jsonb_array_elements(c.blocks) x(b)
  where jsonb_typeof(x.b) = 'object' and x.b ->> 'kind' = 'checkpoint' and jsonb_typeof(x.b -> 'accepts') = 'array'
    and x.b -> 'accepts' ? 'quiz' and jsonb_typeof(x.b -> 'quiz') = 'object'
), checks as (
  select 'object'::text as section, x.name as item,
         case when to_regprocedure(x.name) is not null then 'present' else 'absent' end as detail,
         case when to_regprocedure(x.name) is not null then 'OK' else 'STOP' end as status
  from (values ('public.lt_answer_checkpoint(uuid,integer,text,text[])'), ('public.lsp_try_complete(uuid,text,integer,uuid)'),
               ('public.class_learning_state(uuid)')) x(name)
  union all
  select 'object', 'table ' || x.t, coalesce(to_regclass('public.' || x.t)::text, 'absent'),
         case when to_regclass('public.' || x.t) is not null
               and (select relrowsecurity from pg_class where oid = to_regclass('public.' || x.t))
               and not exists (select 1 from pg_policies where tablename = x.t) then 'OK' else 'STOP' end
  from (values ('class_checkpoint_keys'), ('learning_checkpoint_passes')) x(t)
  union all
  select 'quiz_v1', p.proname, case when position('QUIZ_CHECKPOINT_V1' in p.prosrc) > 0 then 'QUIZ_V1' else 'OLD md5 ' || md5(p.prosrc) end,
         case when position('QUIZ_CHECKPOINT_V1' in p.prosrc) > 0 then 'OK' else 'STOP' end
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('lsp_try_complete', 'class_learning_state', 'lt_answer_checkpoint')
  union all
  select 'grant', 'bảng quiz cấp cho anon/authenticated',
         (select count(*) from information_schema.role_table_grants where table_name in ('class_checkpoint_keys', 'learning_checkpoint_passes')
            and grantee in ('anon', 'authenticated', 'PUBLIC'))::text,
         case when exists (select 1 from information_schema.role_table_grants where table_name in ('class_checkpoint_keys', 'learning_checkpoint_passes')
            and grantee in ('anon', 'authenticated', 'PUBLIC')) then 'STOP' else 'OK' end
  union all
  select 'grant', 'lt_answer_checkpoint: anon ✗ · authenticated ✓',
         coalesce((select (has_function_privilege('anon', to_regprocedure('public.lt_answer_checkpoint(uuid,integer,text,text[])'), 'execute'))::text || ' / '
                       || (has_function_privilege('authenticated', to_regprocedure('public.lt_answer_checkpoint(uuid,integer,text,text[])'), 'execute'))::text), 'absent'),
         case when to_regprocedure('public.lt_answer_checkpoint(uuid,integer,text,text[])') is not null
               and not has_function_privilege('anon', to_regprocedure('public.lt_answer_checkpoint(uuid,integer,text,text[])'), 'execute')
               and has_function_privilege('authenticated', to_regprocedure('public.lt_answer_checkpoint(uuid,integer,text,text[])'), 'execute') then 'OK' else 'STOP' end
  union all
  select 'grant', 'lsp_try_complete cấp cho anon/authenticated',
         (has_function_privilege('anon', to_regprocedure('public.lsp_try_complete(uuid,text,integer,uuid)'), 'execute')
          or has_function_privilege('authenticated', to_regprocedure('public.lsp_try_complete(uuid,text,integer,uuid)'), 'execute'))::text,
         case when has_function_privilege('anon', to_regprocedure('public.lsp_try_complete(uuid,text,integer,uuid)'), 'execute')
               or has_function_privilege('authenticated', to_regprocedure('public.lsp_try_complete(uuid,text,integer,uuid)'), 'execute') then 'STOP' else 'OK' end
  union all
  select 'quiz_key', q.cp || ' @ ' || q.session_id,
         coalesce(k.mode || ' ' || array_to_string(k.correct, ','), 'THIẾU đáp án') ,
         case when k.session_id is not null and k.mode = q.mode and k.correct <@ q.opts and cardinality(q.opts) >= 2 then 'OK' else 'STOP' end
  from quiz q left join public.class_checkpoint_keys k on k.session_id = q.session_id and k.checkpoint_id = q.cp
  union all
  select 'counts', 'quiz checkpoints xuất bản / đáp án / lượt ĐẠT', (select count(*) from quiz)::text || ' / '
         || (select count(*) from public.class_checkpoint_keys)::text || ' / '
         || (select count(*) from public.learning_checkpoint_passes where passed_at is not null)::text, 'INFO'
)
select section, item, detail, status from checks
union all
select 'GATE', case when exists (select 1 from checks where status = 'STOP') then 'STOP - DO NOT USE' else 'PASS' end, '', ''
order by 1, 2;
