/*
CHỌN TÀI KHOẢN TẠO LEARNING THREAD LỚP THẬT — READ-ONLY (một câu SELECT; set_config chỉ trong câu lệnh này).
Cho từng học sinh (không phải Thầy) của lớp DH2.KD0826 / DH2.KD1516:
  • tên hiển thị (KHÔNG email/SĐT) · lần đăng nhập gần nhất · các lớp đang học khác
  • với Bài 4.3 / 4.4 / 6.3: App có MỞ bài không (đúng hàm quyền lt_lesson_open_for_me = my_learning_state)
    và nếu Hỏi bài NGAY BÂY GIỜ thì thread sẽ đóng dấu LỚP NÀO (đúng hàm lt_identity_snapshot của P1)
  • đã có thread ở bài đó chưa (có rồi → gửi thêm sẽ vào thread cũ, không đóng dấu lại)
Kèm tài khoản đang có thread tự học (HS03) để so sánh. Chỉ chú thích khối (an toàn khi copy).
*/
with
target_classes as (
  select cs.id, cs.code from public.class_schedule cs where cs.code in ('DH2.KD0826', 'DH2.KD1516')
),
lessons(ord, id, label) as (values
  (1, '5f7acacd-9214-48f3-9349-93cc382649fb'::uuid, '4.3'),
  (2, 'a85592d5-b519-470d-84d0-4d9182d224b3'::uuid, '4.4'),
  (3, 'd2c00805-0000-4000-8000-000000000000'::uuid, '6.3')),
people as (
  select x.user_id, string_agg(distinct x.via, ', ') as via_class from (
    select m.user_id, 'lớp ' || tc.code as via
    from target_classes tc
    cross join lateral public.social_class_members_of(tc.id) m
    where not exists (select 1 from public.app_users a where a.id = m.user_id and a.role in ('teacher', 'admin'))
    union all
    select t.learner_user_id, 'đang có thread tự học' from public.learning_threads t
  ) x group by x.user_id
),
probe as (
  select p.user_id, p.via_class, l.ord, l.id as lesson_id, l.label,
         public.lt_lesson_open_for_me(case when s.c is not null then l.id end) as is_open,
         public.lt_identity_snapshot(case when s.c is not null then l.id end) #>> '{class,code}' as would_stamp,
         exists (select 1 from public.learning_threads t where t.learner_user_id = p.user_id
                 and t.content_key = 'L:' || l.id::text and t.archived_at is null) as has_thread
  from people p
  cross join lessons l
  cross join lateral (select set_config('request.jwt.claims',
                        json_build_object('sub', p.user_id, 'role', 'authenticated')::text, true) as c) s
),
rows_out as (
  select 1 as ord, 'student' as section,
         coalesce((select i.name from public.class_public_identity(p.user_id) i), '?') || ' · ' || p.via_class as item,
         'last_login=' || coalesce(left((select to_jsonb(a) ->> 'last_login_at' from public.app_users a where a.id = p.user_id), 10), 'chưa')
           || ' · có_hồ_sơ_học_sinh=' || exists (select 1 from public.edu_students s where s.user_id = p.user_id)
           || ' · lớp_đang_học=' || coalesce((
                select string_agg(distinct cs.code, ',')
                from public.class_schedule cs
                join public.edu_groups g on g.id = cs.cohort_group_id or g.id = cs.group_id
                     or (g.code is not null and cs.code is not null and upper(g.code) = upper(cs.code))
                join public.edu_group_members gm on gm.group_id = g.id and gm.status = 'active' and gm.user_id = p.user_id
                where coalesce(cs.status, '') not in ('cancelled', 'merged', 'draft')), 'none')
           || ' || ' || (select string_agg('Bài ' || pr.label || ': ' || case when pr.is_open then 'MỞ' else 'khoá' end
                                           || ' → đóng dấu ' || coalesce(pr.would_stamp, 'Tự học')
                                           || case when pr.has_thread then ' (ĐÃ có thread)' else '' end, ' · ' order by pr.ord)
                         from probe pr where pr.user_id = p.user_id) as detail,
         (select count(*) from probe pr where pr.user_id = p.user_id and pr.is_open and pr.would_stamp is not null and not pr.has_thread) as good
  from people p
)
select section, item, detail from rows_out
order by good desc, item;
