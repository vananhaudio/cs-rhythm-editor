-- PREFLIGHT (read-only) cho db/teacher_all_classes_v1_setup.sql — GATE = PASS mới được migrate.
-- Chỉ số đếm gộp + md5 hàm. Dòng 'dữ liệu lớp' phải GIỐNG HỆT ở postflight (migration không ghi dữ liệu).
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
  union all select 3, 'CHECK', 'lớp theo status: ' || (select string_agg(st || '=' || n, ', ' order by st)
     from (select coalesce(status, '∅') st, count(*) n from public.class_schedule group by 1) z)
  union all select 4, 'CHECK', 'tài khoản teacher/admin: ' || (select count(*) from public.app_users where role in ('teacher', 'admin'))
  union all select 9, 'GATE', case when
       (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.is_teacher()')) = '19b164504b4ce59b9bbdb4b0b64e48ad'
   and to_regprocedure('public.social_class_card(uuid)') is not null
   and not exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
         where s.nspname = 'public' and p.proname = 'social_all_classes'
           and coalesce(obj_description(p.oid, 'pg_proc'), '') not like 'teacher_all_classes_v1:%')
  then 'PASS' else 'FAIL' end
) z order by o;
