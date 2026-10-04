-- ═══ TEST ACCOUNT AVATAR V1 (class_set_my_avatar + class_public_identity) — cluster PostgreSQL TẠM ═══
-- Nạp SAU fixture + social baseline + account_avatar_v1_setup. KHÔNG chạy production.
\set ON_ERROR_STOP on
do $$ begin
  if exists (select 1 from auth.users where email not like '%@test.local') then raise exception 'DỪNG: có user thật'; end if;
end $$;

-- M = admin không có hồ sơ học sinh (như tài khoản Owner); T = thầy không hồ sơ; A, B = học sinh
insert into auth.users (id, email) values ('ffffffff-0000-4000-8000-00000000000f', 'm@test.local');
insert into public.app_users (id, role, name, email) values ('ffffffff-0000-4000-8000-00000000000f', 'admin', 'Admin', 'm@test.local');
-- tài khoản đăng nhập nhưng không có app_users
insert into auth.users (id, email) values ('99999999-0000-4000-8000-000000000009', 'x@test.local');

create schema t;
grant usage on schema t to anon, authenticated;
create function t.u(k text) returns uuid language sql immutable as $$
  select case k when 'A' then 'aaaaaaaa-0000-4000-8000-00000000000a'::uuid when 'B' then 'bbbbbbbb-0000-4000-8000-00000000000b'::uuid
                when 'T' then 'dddddddd-0000-4000-8000-00000000000d'::uuid when 'M' then 'ffffffff-0000-4000-8000-00000000000f'::uuid
                when 'X' then '99999999-0000-4000-8000-000000000009'::uuid end $$;
create function t.url(k text, ms text default '1759580000000') returns text language sql immutable as $$
  select 'https://wojmdilyflffvdtpovmq.supabase.co/storage/v1/object/public/avatars/' || t.u(k)::text || '-' || ms || '.jpg' $$;
create function t.as_user(k text) returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', t.u(k), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function t.as_anon() returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '{"role":"anon"}', true); perform set_config('role', 'anon', true);
end $$;
create function t.reset() returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '{}', true);
end $$;
create function t.ok(cond boolean, msg text) returns void language plpgsql as $$ begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if; raise notice 'PASS: %', msg;
end $$;
create function t.fails(q text, msg text, p_expect text default null) returns void language plpgsql as $$ begin
  begin execute q; exception when others then
    if p_expect is not null and position(p_expect in sqlerrm) = 0 then raise exception 'FAIL: % — sai lý do: %', msg, sqlerrm; end if;
    raise notice 'PASS: % (bị chặn: %)', msg, sqlerrm; return; end;
  raise exception 'FAIL: % — lẽ ra phải bị chặn', msg;
end $$;
create function t.av(k text) returns text language sql security definer set search_path = '' as $$
  select i.avatar_url from public.class_public_identity(t.u(k)) i $$;
create function t.role_of(k text) returns text language sql security definer set search_path = '' as $$
  select au.role from public.app_users au where au.id = t.u(k) $$;
grant execute on all functions in schema t to anon, authenticated;

-- set_config(..., true) chỉ sống trong transaction → chạy phần test trong MỘT transaction; ẩn bảng kết quả, giữ NOTICE
\o /dev/null
begin;

-- Học sinh A có ảnh sẵn (luồng cũ)
update public.edu_students set avatar_url = 'https://wojmdilyflffvdtpovmq.supabase.co/storage/v1/object/public/avatars/stu-a-1.jpg'
 where user_id = t.u('A');

select t.ok(t.av('M') is null, 'trước khi đổi: admin M chưa có ảnh');

-- ── Admin tự đổi ảnh của mình
select t.as_user('M');
select t.ok(public.class_set_my_avatar(t.url('M')) = t.url('M'), 'admin M tự đổi ảnh (RPC trả URL)');
select t.reset();
select t.ok(t.av('M') = t.url('M'), 'class_public_identity(M) trả ảnh mới (nguồn chuẩn)');
select t.ok(t.role_of('M') = 'admin', 'role admin GIỮ NGUYÊN');
select t.ok(not exists (select 1 from public.edu_students where user_id = t.u('M')), 'không tạo hồ sơ học sinh cho admin');
select t.as_user('M');
select t.ok(public.class_set_my_avatar(t.url('M', '1759580000999')) is not null, 'đổi lần 2 (thay ảnh)');
select t.reset();
select t.ok(t.av('M') = t.url('M', '1759580000999'), 'refresh → ảnh lần 2');

-- ── Chỉ sửa ảnh CỦA CHÍNH MÌNH
select t.as_user('M');
select t.fails($$select public.class_set_my_avatar(t.url('T'))$$, 'admin KHÔNG đặt được URL ảnh mang id người khác', 'invalid_avatar_url');
select t.fails($$select public.class_set_my_avatar(t.url('A'))$$, 'admin KHÔNG đặt được ảnh học sinh A', 'invalid_avatar_url');
select t.fails($$select public.class_set_my_avatar('https://evil.example/' || t.u('M')::text || '-1759580000000.jpg')$$, 'URL ngoài bucket avatars bị từ chối', 'invalid_avatar_url');
select t.fails($$select public.class_set_my_avatar('http://wojmdilyflffvdtpovmq.supabase.co/storage/v1/object/public/avatars/' || t.u('M')::text || '-1759580000000.jpg')$$, 'http (không https) bị từ chối', 'invalid_avatar_url');
select t.fails($$select public.class_set_my_avatar(null)$$, 'null bị từ chối', 'invalid_avatar_url');
-- RLS chỉ-đọc: UPDATE trực tiếp không lỗi nhưng không chạm hàng nào
update public.app_users set avatar_url = t.url('M', '1759580000111'), role = 'student' where id = t.u('M');
select t.reset();
select t.ok(t.role_of('M') = 'admin', 'UPDATE trực tiếp app_users (role/avatar) không có tác dụng — role vẫn admin');
select t.ok(t.av('M') = t.url('M', '1759580000999'), 'ảnh M không đổi sau các lần bị chặn');
select t.ok(t.av('T') is null, 'ảnh thầy T không bị đụng');

-- ── Học sinh: luồng cũ, không dùng RPC
select t.as_user('A');
select t.fails($$select public.class_set_my_avatar(t.url('A'))$$, 'học sinh có hồ sơ → RPC từ chối (ghi edu_students như cũ)', 'use_student_profile');
select t.reset();
select t.ok(t.av('A') = 'https://wojmdilyflffvdtpovmq.supabase.co/storage/v1/object/public/avatars/stu-a-1.jpg', 'ảnh học sinh A giữ nguyên');
select t.ok(t.av('B') is null, 'học sinh B không bị ảnh hưởng');
-- edu_students vẫn thắng nếu có cả hai
update public.app_users set avatar_url = t.url('A') where id = t.u('A');
select t.ok(t.av('A') like '%stu-a-1.jpg', 'edu_students.avatar_url ưu tiên hơn app_users.avatar_url');
update public.app_users set avatar_url = null where id = t.u('A');

-- ── Thầy T không hồ sơ cũng tự đổi được; tài khoản không app_users / khách bị chặn
select t.as_user('T');
select t.ok(public.class_set_my_avatar(t.url('T')) is not null, 'thầy T (không hồ sơ HS) tự đổi ảnh');
select t.reset();
select t.ok(t.av('T') = t.url('T') and t.av('M') = t.url('M', '1759580000999'), 'T và M mỗi người một ảnh riêng');
select t.as_user('X');
select t.fails($$select public.class_set_my_avatar(t.url('X'))$$, 'tài khoản không có app_users bị từ chối', 'no_account');
select t.as_anon();
select t.fails($$select public.class_set_my_avatar(t.url('M'))$$, 'khách (anon) không gọi được RPC');
select t.reset();

-- ── CHECK constraint
select t.fails($$update public.app_users set avatar_url = 'javascript:alert(1)' where id = t.u('M')$$, 'CHECK chặn URL không https (kể cả postgres)');

-- ── Feed/hồ sơ đọc qua class_public_identity → thấy ảnh admin
do $$ begin
  if to_regprocedure('public.get_user_profile(uuid)') is not null then
    perform set_config('role', 'postgres', true);
    perform set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-0000-4000-8000-00000000000a', 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    if (select g.avatar_url from public.get_user_profile('ffffffff-0000-4000-8000-00000000000f'::uuid) g) is distinct from
       'https://wojmdilyflffvdtpovmq.supabase.co/storage/v1/object/public/avatars/ffffffff-0000-4000-8000-00000000000f-1759580000999.jpg' then
      raise exception 'FAIL: get_user_profile(M) không trả ảnh mới';
    end if;
    perform set_config('role', 'postgres', true);
    raise notice 'PASS: học sinh A xem hồ sơ admin M qua get_user_profile → ảnh mới';
  end if;
end $$;
commit;
\o
