-- Guard schema ↔ form landing: anon ghi được lead với ĐÚNG các cột CLASS_LEAD_FIELDS
-- (src/lib/classLead.ts), và leads không có cột bắt buộc nào ngoài các cột đó.
-- Chạy trong transaction ROLLBACK: scripts/run-class-membership-test.sh lead
do $$
declare missing text;
begin
  select string_agg(column_name, ', ') into missing from information_schema.columns
   where table_schema = 'public' and table_name = 'leads' and is_nullable = 'NO' and column_default is null
     and is_identity = 'NO'
     and column_name not in ('name', 'email', 'class_name', 'path', 'intent', 'note', 'source', 'status');
  if missing is not null then raise exception 'LEAD GUARD: leads có cột bắt buộc form không gửi: %', missing; end if;
end $$;
set local role anon;
insert into public.leads (name, email, class_name, path, intent, note, source, status)
values ('LEAD GUARD', 'lead-guard@example.test', 'Đệm hát căn bản · DH1.KD20', 'dem_hat', 'dang_ky',
        '[public-product:dem_hat_can_ban][plan:monthly]', 'landing', 'Mới đăng ký');
reset role;
select 'CLASS LEAD INSERT TEST: PASS' as result;
