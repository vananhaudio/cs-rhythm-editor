-- Bịt đường SELECT nội dung trực tiếp, vẫn giữ metadata mở/khóa qua RPC my_learning_state.
-- Không REVOKE cột: client cũ select('*') vẫn hoạt động cho bài được phép học.
-- InitPlan tính danh sách bài một lần, không gọi cả resolver cho từng row.
begin;
drop policy if exists lesson_entitlement_read on public.edu_course_lessons;
create policy lesson_entitlement_read on public.edu_course_lessons as restrictive
for select to anon,authenticated using (
 (select public.my_learning_state()->>'mode'='teacher') or id in (
  select (l->>'id')::uuid
  from jsonb_array_elements(public.my_learning_state()->'courses') c,
       jsonb_array_elements(c->'lessons') l
  where l->>'access'='open'
 )
);
notify pgrst,'reload schema';
commit;
