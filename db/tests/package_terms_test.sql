-- Chạy cùng migration trong transaction ROLLBACK. Không sửa học sinh thật.
do $$
declare s uuid:=gen_random_uuid(); teacher uuid; pkg uuid:=gen_random_uuid(); rec bigint; rec2 bigint; ent bigint;
 course_id uuid; course_code text; lesson_id uuid; deadline timestamptz; st jsonb; n int; old_legacy int; v_progress int;
begin
 select id into teacher from public.app_users where role in ('teacher','admin') limit 1;
 if teacher is null then raise exception 'Teacher fixture missing'; end if;
 select count(*) into old_legacy from public.student_entitlements where source='legacy_99_lifetime' and status='active';
 insert into public.edu_students(id,full_name,email,is_active,level) values(s,'TEST package terms','package-terms@example.test',true,'beginner');
 insert into public.packages(id,package_code,name,status,config) values(pkg,'TEST_TERMS_'||s,'TEST terms','active','{"renew_months":1,"entitlement_tier":"can_ban_396"}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',teacher,'role','authenticated')::text,true);
 rec:=public.manage_student_package(s,'grant',pkg,null,1,'web');
 if not exists(select 1 from public.student_packages p where p.id=rec and public.package_term_valid(p.status,p.starts_at,p.renews_at)) then raise exception 'A'; end if;
 select renews_at into deadline from public.student_packages where id=rec;
 if public.package_term_valid('active',now(),deadline,deadline) then raise exception 'B boundary'; end if;
 if not public.package_term_valid('active',now(),deadline,deadline-interval '1 microsecond') then raise exception 'B before'; end if;
 rec2:=public.manage_student_package(s,'renew',null,rec,1,'web');
 if (select renews_at from public.student_packages where id=rec2)<>((deadline at time zone 'Asia/Ho_Chi_Minh')+interval '1 month') at time zone 'Asia/Ho_Chi_Minh' then raise exception 'C'; end if;
 if not exists(select 1 from public.student_packages where id=rec and status='superseded' and renews_at=deadline) then raise exception 'C history'; end if;
 update public.student_packages set starts_at=now()-interval '2 months',renews_at=now()-interval '1 day' where id=rec2;
 rec:=public.manage_student_package(s,'renew',null,rec2,1,'web');
 if (select starts_at from public.student_packages where id=rec)<>now() then raise exception 'D'; end if;
 select l.id,m.course_id,c.code into lesson_id,course_id,course_code from public.edu_course_lessons l join public.edu_modules m on m.id=l.module_id join public.edu_courses c on c.id=m.course_id where c.code is not null limit 1;
 insert into public.edu_lesson_progress(student_id,lesson_id,status,completed_at) values(s,lesson_id,'completed',now());
 update public.student_packages set granted_course_codes=array[course_code] where id=rec;
 if not public.has_course_access(s,course_id) then raise exception 'G course grant missing'; end if;
 select count(*) into v_progress from public.edu_lesson_progress where student_id=s;
 perform public.manage_student_package(s,'end',null,rec);
 if (select effective_tier from public.get_effective_student_entitlement(s))<>'free' then raise exception 'G entitlement'; end if;
 if public.has_course_access(s,course_id) then raise exception 'G course still open'; end if;
 if (select count(*) from public.edu_lesson_progress where student_id=s)<>v_progress then raise exception 'G progress'; end if;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 insert into public.student_entitlements(student_id,tier,source,source_ref,starts_at,ends_at,status)
 values(s,'can_ban_396','apple_subscription','test-apple:'||s,now(),now()+interval '1 month','active') returning id into ent;
 if not exists(select 1 from public.student_packages where entitlement_id=ent and source='apple' and renews_at=now()+interval '1 month') then raise exception 'E mirror'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',teacher,'role','authenticated')::text,true);
 if (select effective_tier from public.get_effective_student_entitlement(s))<>'can_ban_396' then raise exception 'E'; end if;
 begin
 perform public.manage_student_package(s,'end',null,(select id from public.student_packages where entitlement_id=ent));
 raise exception 'Store admin guard failed' using errcode='XX999';
 exception when raise_exception then null; end;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 update public.student_entitlements set status='revoked' where id=ent;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',teacher,'role','authenticated')::text,true);
 if (select effective_tier from public.get_effective_student_entitlement(s))<>'free' then raise exception 'F'; end if;
 rec:=public.manage_student_package(s,'grant',pkg,null,1,'admin');
 insert into public.student_entitlements(student_id,tier,source,is_lifetime) values(s,'khoi_dau_99','legacy_99_lifetime',true);
 if (select effective_tier from public.get_effective_student_entitlement(s))<>'can_ban_396' then raise exception 'H'; end if;
 perform public.manage_student_package(s,'end',null,rec);
 if (select effective_tier from public.get_effective_student_entitlement(s))<>'khoi_dau_99' then raise exception 'H fallback'; end if;
 if (select count(*) from public.student_entitlements where source='legacy_99_lifetime' and status='active')<>old_legacy+1 then raise exception 'I'; end if;
 if public.package_term_valid('active','2026-09-05 00:00+07','2026-10-05 00:00+07','2026-10-04 17:00Z') then raise exception 'J'; end if;
 if public.package_term_valid('active',now()+interval '1 day',now()+interval '1 month') then raise exception 'Future start'; end if;
 -- RPC union compile + authorization.
 st:=public.admin_student_packages(s);
 if jsonb_array_length(st->'records')<4 then raise exception 'Admin records'; end if;
 if jsonb_array_length(st->'history')<4 then raise exception 'History missing'; end if;
 perform set_config('request.jwt.claims','{}',true);
 begin
 perform public.manage_student_package(s,'grant',pkg,null,1,'admin');
 raise exception 'Anon guard failed' using errcode='XX999';
 exception when raise_exception then null; end;
end $$;
select 'PASS package terms A–J + Store/Admin guards + history' as result;
