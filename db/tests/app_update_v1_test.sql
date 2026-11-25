-- Test quyền + luật của App Update V1 (chạy bởi scripts/test-app-update-db.sh trên cụm tạm).
create or replace function pg_temp.as_user(p uuid, p_role text) returns void language plpgsql as $$
begin perform set_config('test.uid', coalesce(p::text, ''), false); perform set_config('role', p_role, false); end $$;
create or replace function pg_temp.save(p_platform text, p_enabled boolean, p_latest text, p_lb int, p_min text, p_mb int, p_force boolean)
returns text language plpgsql as $$
declare v_at timestamptz;
begin
  select (x->>'updated_at')::timestamptz into v_at from jsonb_array_elements(public.app_update_policy_admin()->'policies') x where x->>'platform' = p_platform;
  perform public.app_update_policy_save(p_platform, p_enabled, p_latest, p_lb, p_min, p_mb, p_force, 'ghi chú', v_at);
  return 'ok';
exception when others then return sqlstate;
end $$;
create or replace function pg_temp.expect(label text, got text, want text) returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAIL % — muốn %, được %', label, want, got; end if;
  raise notice 'PASS %', label;
end $$;
create or replace function pg_temp.try(q text) returns text language plpgsql as $$
begin execute q; return 'ok'; exception when others then return sqlstate; end $$;

-- khách
select pg_temp.as_user(null, 'anon');
select pg_temp.expect('mặc định tắt → khách đọc được null', coalesce(public.app_update_policy_get('ios')::text, 'null'), 'null');
select pg_temp.expect('khách không đọc thẳng bảng', pg_temp.try('select * from public.app_update_policy'), '42501');
select pg_temp.expect('khách không ghi thẳng bảng', pg_temp.try('update public.app_update_policy set enabled = true'), '42501');
select pg_temp.expect('khách không gọi được admin', pg_temp.try('select public.app_update_policy_admin()'), '42501');
select pg_temp.expect('khách không gọi được save', pg_temp.try($q$select public.app_update_policy_save('ios',true,'9.0.0',null,null,null,false,null,now())$q$), '42501');
-- học viên và giáo viên
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b', 'authenticated');
select pg_temp.expect('học viên không xem được trang quản trị', pg_temp.try('select public.app_update_policy_admin()'), '42501');
select pg_temp.expect('học viên không lưu được', pg_temp.try($q$select public.app_update_policy_save('ios',true,'9.0.0',null,null,null,false,null,now())$q$), '42501');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c', 'authenticated');
select pg_temp.expect('giáo viên (không phải admin) không lưu được', pg_temp.try($q$select public.app_update_policy_save('ios',true,'9.0.0',null,null,null,false,null,now())$q$), '42501');
-- admin
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a', 'authenticated');
select pg_temp.expect('bật mà thiếu phiên bản → chặn', pg_temp.save('ios', true, null, null, null, null, false), '22023');
select pg_temp.expect('phiên bản sai dạng → chặn', pg_temp.save('ios', true, '1.7', null, null, null, false), '22023');
select pg_temp.expect('android bật thiếu versionCode → chặn', pg_temp.save('android', true, '1.7.0', null, null, null, false), '22023');
select pg_temp.expect('bắt buộc khi chưa bật → chặn', pg_temp.save('ios', false, '1.7.0', null, '1.6.0', null, true), '22023');
select pg_temp.expect('bắt buộc thiếu tối thiểu → chặn', pg_temp.save('ios', true, '1.7.0', null, null, null, true), '22023');
select pg_temp.expect('tối thiểu > mới nhất → chặn', pg_temp.save('ios', true, '1.9.0', null, '1.10.0', null, false), '22023');
select pg_temp.expect('tối thiểu versionCode > mới nhất → chặn', pg_temp.save('android', true, '1.7.0', 18, null, 19, false), '22023');
select pg_temp.expect('so phiên bản theo số: 1.10.0 > 1.9.0', pg_temp.save('ios', true, '1.10.0', null, '1.9.0', null, false), 'ok');
select pg_temp.expect('lưu android hợp lệ', pg_temp.save('android', true, '1.7.0', 18, '1.6.1', 16, false), 'ok');
select pg_temp.expect('bản cũ (updated_at lệch) → chặn ghi đè', pg_temp.try($q$select public.app_update_policy_save('ios',true,'2.0.0',null,null,null,false,null,'2000-01-01')$q$), '40001');
select pg_temp.expect('nhật ký đúng 2 lần lưu thành công', jsonb_array_length(public.app_update_policy_admin()->'log')::text, '2');
-- app đọc
select pg_temp.as_user(null, 'anon');
select pg_temp.expect('khách thấy latest khi đã bật', public.app_update_policy_get('android')->>'latestBuild', '18');
select pg_temp.expect('chưa bật bắt buộc → không lộ minBuild', coalesce(public.app_update_policy_get('android')->>'minBuild', 'null'), 'null');
select pg_temp.expect('force = false', public.app_update_policy_get('android')->>'force', 'false');
select pg_temp.expect('nền tảng lạ → null', coalesce(public.app_update_policy_get('web')::text, 'null'), 'null');
