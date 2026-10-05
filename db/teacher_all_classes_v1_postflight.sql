-- POSTFLIGHT (read-only) sau db/teacher_all_classes_v1_setup.sql. Dòng 'dữ liệu lớp' + md5 các hàm cũ phải giống preflight.
select section, item from (
  select 1 o, 'CHECK' section, 'md5 hàm: ' || (select string_agg(p.proname || '=' || md5(p.prosrc), ', ' order by p.proname)
     from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname in
       ('is_teacher', 'social_class_card', 'social_my_classes', 'social_discover_classes', 'social_class_detail', 'social_all_classes')) item
  union all select 2, 'CHECK', 'dữ liệu lớp: class_schedule=' || (select count(*) from public.class_schedule)
     || ' · edu_group_members=' || (select count(*) from public.edu_group_members)
     || ' · class_curriculum_access=' || (select count(*) from public.class_curriculum_access)
     || ' · learning_session_progress=' || (select count(*) from public.learning_session_progress)
     || ' · learning_threads=' || (select count(*) from public.learning_threads)
     || ' · class_lesson_content=' || (select count(*) from public.class_lesson_content)
     || ' · edu_students=' || (select count(*) from public.edu_students)
  union all select 3, 'CHECK', 'EXECUTE social_all_classes: ' || coalesce((select string_agg(distinct grantee, ',' order by grantee)
     from information_schema.routine_privileges where routine_schema = 'public' and routine_name = 'social_all_classes'
       and grantee not in ('postgres', 'supabase_admin')), '-')
  union all select 9, 'GATE', case when
       (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.social_all_classes()')) = '57ca133bda20480b3fa69f4d6ddf73d3'
   and (select prosecdef from pg_proc where oid = to_regprocedure('public.social_all_classes()'))
   and (select proconfig from pg_proc where oid = to_regprocedure('public.social_all_classes()')) = array['search_path=""']
   and coalesce((select string_agg(distinct grantee, ',' order by grantee) from information_schema.routine_privileges
         where routine_schema = 'public' and routine_name = 'social_all_classes'
           and grantee in ('anon', 'authenticated', 'PUBLIC')), '') = 'authenticated'
   and (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.is_teacher()')) = '19b164504b4ce59b9bbdb4b0b64e48ad'
  then 'PASS' else 'FAIL' end
) z order by o;
