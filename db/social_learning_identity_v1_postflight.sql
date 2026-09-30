/*
POSTFLIGHT LEARNING IDENTITY V1 — READ-ONLY. Chạy SAU migrate: scripts/prod-db.py query <file này> (BEGIN READ ONLY … ROLLBACK).
Không ghi gì. Đóng vai một thành viên Class (Trần Tiến Hải) CHỈ trong transaction chỉ-đọc để gọi hàm như Social gọi.
Kết quả: (1) hàm + quyền + kiểu trả về · (2) hàng thô cho các nhóm acceptance (user_id + memberships — KHÔNG tên/email)
→ nhãn được dựng bằng ĐÚNG helper client (src/class-social/identity/learningIdentity.ts) để đối chiếu
· (3) danh tính LỊCH SỬ của 2 thread thật không đổi (md5 identity + class_schedule_id).
*/
select 'function' as section, 'social_learning_identities' as item,
       case when to_regprocedure('public.social_learning_identities(uuid[])') is null then 'MISSING' else 'present' end as detail;
select 'result_type' as section, pg_get_function_result('public.social_learning_identities(uuid[])'::regprocedure) as detail;
select 'grant' as section, grantee as item, privilege_type as detail
from information_schema.routine_privileges where routine_name = 'social_learning_identities' order by grantee;

-- Nhóm acceptance (tính bằng quyền quản trị TRƯỚC khi đổi vai; lưu vào biến phiên — transaction chỉ-đọc không tạo bảng)
select set_config('tva.targets', coalesce((
  select json_agg(json_build_object('user_id', x.user_id, 'via', x.via) order by x.via, x.user_id)::text
  from (
    select distinct gm.user_id, cs.code as via
    from public.class_schedule cs
    join public.edu_groups g on g.id = cs.cohort_group_id or g.id = cs.group_id or (g.code is not null and cs.code is not null and upper(g.code) = upper(cs.code))
    join public.edu_group_members gm on gm.group_id = g.id and gm.status = 'active'
    where cs.code in ('DH2.KD0826', 'DH1.KD17', 'DH2.KD1516', 'TN3.GL10', 'TN3.GL11', 'CB2.T3', 'HT2027.TH01')
    union
    -- Nhóm KIỂM (không phải nguồn nhãn): người có cờ legacy ht_member → phải KHÔNG có Hành trình nếu không thuộc lớp HT
    select h.user_id, 'ht_member_flag' from (
      select distinct on (es.user_id) es.user_id, es.ht_member from public.edu_students es
      where es.user_id is not null order by es.user_id, es.enrolled_at desc nulls last) h
    where h.ht_member
  ) x), '[]'), true) is not null as targets_set;

-- Người đóng vai (chỉ trong transaction chỉ-đọc): Trần Tiến Hải — thành viên Class thật (có dấu hoặc không dấu)
select set_config('request.jwt.claims',
  json_build_object('sub', (select es.user_id from public.edu_students es
                            where es.user_id is not null and lower(coalesce(es.display_name, es.full_name, '')) like '%tiến hải%'
                            order by es.enrolled_at desc nulls last limit 1), 'role', 'authenticated')::text, true) is not null as viewer_set;
select (current_setting('request.jwt.claims')::json ->> 'sub') is not null as viewer_found;
set local role authenticated;

with t as (
  select (e ->> 'user_id')::uuid as user_id, e ->> 'via' as via
  from json_array_elements(current_setting('tva.targets')::json) e
)
select 'row' as section, t.via, r.user_id, r.memberships
from public.social_learning_identities((select array_agg(distinct user_id) from t)) r
join t on t.user_id = r.user_id
order by t.via, r.user_id;

reset role;
-- Danh tính LỊCH SỬ của thread thật: không đổi (so với trước migration)
select 'thread' as section, left(t.id::text, 8) as item,
       coalesce(t.identity #>> '{lesson,title}', '?') || ' · lớp ' || coalesce(t.identity #>> '{class,code}', 'Tự học')
       || ' · md5 ' || md5(t.identity::text) || ' · class_schedule_id ' || coalesce(t.class_schedule_id::text, 'null') as detail
from public.learning_threads t
where t.identity #>> '{lesson,title}' ~ '^Bài 4\.(3|4) '
order by t.created_at;
