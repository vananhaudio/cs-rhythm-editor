-- ═══ TEST Friends V3 (db/friends_v3_setup.sql) ═══ chỉ chạy trên cluster PostgreSQL TẠM (scripts/test-friends-v3-db.sh).
-- A = tôi · B,D = bạn cùng lớp · C = cùng Band · E = không tín hiệu · F,G = tên có dấu · H = bạn của B (bạn chung) · T = Thầy · N = ngoài Class
\set ON_ERROR_STOP on
do $$ begin
  if exists (select 1 from auth.users where email not like '%@test.local') then raise exception 'DỪNG: có user thật'; end if;
end $$;
insert into auth.users (id, email) values
  ('0d0d0d0d-0000-4000-8000-0000000000d4','d@test.local'),('0e0e0e0e-0000-4000-8000-0000000000e5','e@test.local'),
  ('0f0f0f0f-0000-4000-8000-0000000000f6','f@test.local'),('0a0a0a0a-0000-4000-8000-0000000000a7','g@test.local'),
  ('0b0b0b0b-0000-4000-8000-0000000000b8','h@test.local');
insert into public.app_users (id, role, name, email) values
  ('0d0d0d0d-0000-4000-8000-0000000000d4','student','Dũng','d@test.local'),('0e0e0e0e-0000-4000-8000-0000000000e5','student','Em','e@test.local'),
  ('0f0f0f0f-0000-4000-8000-0000000000f6','student','F','f@test.local'),('0a0a0a0a-0000-4000-8000-0000000000a7','student','G','g@test.local'),
  ('0b0b0b0b-0000-4000-8000-0000000000b8','student','H','h@test.local');
insert into public.edu_students (user_id, full_name, display_name, email, level) values
  ('0d0d0d0d-0000-4000-8000-0000000000d4','Phạm Dũng','Dũng','d@test.local','beginner'),
  ('0e0e0e0e-0000-4000-8000-0000000000e5','Em','Em','e@test.local','beginner'),
  ('0f0f0f0f-0000-4000-8000-0000000000f6','Đỗ Thái Nguyên','Đỗ Thái Nguyên','f@test.local','beginner'),
  ('0a0a0a0a-0000-4000-8000-0000000000a7','Quyên','ĐẶNG QUYÊN','g@test.local','beginner'),
  ('0b0b0b0b-0000-4000-8000-0000000000b8','Hoàng Hà','Hoàng Hà','h@test.local','beginner');
insert into public.class_schedule values ('c1000000-0000-4000-8000-000000000001','Guitar Solo 01','active'),
  ('c2000000-0000-4000-8000-000000000002','Lớp đã huỷ','cancelled');
insert into tva_private.class_memberships values
  ('c1000000-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-00000000000a'),
  ('c1000000-0000-4000-8000-000000000001','bbbbbbbb-0000-4000-8000-00000000000b'),
  ('c1000000-0000-4000-8000-000000000001','0d0d0d0d-0000-4000-8000-0000000000d4'),
  ('c1000000-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-00000000000d'),
  ('c2000000-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-00000000000a'),
  ('c2000000-0000-4000-8000-000000000002','0e0e0e0e-0000-4000-8000-0000000000e5');   -- chỉ chung lớp ĐÃ HUỶ → không tính
update public.edu_students set display_name = display_name;
create schema t;
grant usage on schema t to anon, authenticated;
create function t.u(k text) returns uuid language sql immutable as $$
  select case k when 'A' then 'aaaaaaaa-0000-4000-8000-00000000000a'::uuid
                when 'B' then 'bbbbbbbb-0000-4000-8000-00000000000b'::uuid
                when 'C' then 'cccccccc-0000-4000-8000-00000000000c'::uuid
                when 'D' then '0d0d0d0d-0000-4000-8000-0000000000d4'::uuid
                when 'F' then '0f0f0f0f-0000-4000-8000-0000000000f6'::uuid
                when 'G' then '0a0a0a0a-0000-4000-8000-0000000000a7'::uuid
                when 'H' then '0b0b0b0b-0000-4000-8000-0000000000b8'::uuid
                when 'E' then '0e0e0e0e-0000-4000-8000-0000000000e5'::uuid
                when 'T' then 'dddddddd-0000-4000-8000-00000000000d'::uuid
                when 'N' then 'eeeeeeee-0000-4000-8000-00000000000e'::uuid end
$$;
create function t.as_user(k text) returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', t.u(k), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function t.as_anon() returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;
create function t.reset() returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{}', true);
end $$;
create function t.ok(cond boolean, msg text) returns void language plpgsql as $$ begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if;
  raise notice 'PASS: %', msg;
end $$;
create function t.fails(q text, msg text) returns void language plpgsql as $$ begin
  begin
    execute q;
  exception when others then
    raise notice 'PASS: % (bị chặn: %)', msg, sqlerrm;
    return;
  end;
  raise exception 'FAIL: % — câu lệnh lẽ ra phải bị chặn: %', msg, q;
end $$;

create function t.names(q text) returns text language sql as $$ select coalesce(string_agg(name, ',' order by name), '') from public.friend_search(q) $$;
create function t.sugg() returns text language sql as $$ select coalesce(string_agg(user_id::text, ',' order by user_id), '') from public.friend_suggestions() $$;

grant execute on all functions in schema t to anon, authenticated;
begin;
-- ── Tìm kiếm
select t.as_user('A');
select t.ok(t.names('dung') = 'Dũng', 'tìm "dung" (không dấu) ra Dũng');
select t.ok(t.names('DŨNG') = 'Dũng', 'tìm "DŨNG" (có dấu, hoa) ra Dũng');
select t.ok(t.names('do thai') = 'Đỗ Thái Nguyên', 'tìm "do thai" ra Đỗ Thái Nguyên (đ→d, nhiều từ)');
select t.ok(t.names('nguyên đỗ') = 'Đỗ Thái Nguyên', 'từ khoá thứ tự bất kỳ, có dấu');
select t.ok(t.names('dang quyen') = 'ĐẶNG QUYÊN', 'chữ HOA có dấu tiếng Việt khớp không dấu');
select t.ok(t.names('d') = '', 'chỉ 1 ký tự → rỗng');
select t.ok(t.names('   ') = '', 'toàn khoảng trắng → rỗng');
select t.ok(t.names('zzzz') = '', 'không khớp → rỗng');
select t.ok(not exists (select 1 from public.friend_search('an') where user_id = t.u('A')), 'không tự tìm ra mình');
select t.ok(t.names('van anh') like '%Thầy Văn Anh%', 'tìm được Thầy theo tên không dấu');
select t.ok((select relationship from public.friend_search('dung') limit 1) = 'none', 'quan hệ trả về = none');
select t.ok((select same_class from public.friend_search('dung') limit 1), 'Dũng: cùng lớp');
select t.ok((select same_band from public.friend_search('chi') where name = 'Chi'), 'Chi: cùng Band');
select t.ok(not (select same_class from public.friend_search('em') where name = 'Em'), 'Em: chung lớp ĐÃ HUỶ không tính cùng lớp');
select t.ok((select count(*) from public.friend_search('a', 5)) = 0, 'giới hạn/ngắn không lỗi');
select t.ok(t.names('%%') = '' and t.names('__') = '', 'ký tự đặc biệt LIKE không khớp bừa');

-- ── Gợi ý
select t.ok(t.sugg() = (select string_agg(x::text, ',' order by x) from unnest(array[t.u('B'), t.u('D'), t.u('C')]) x),
            'gợi ý A = lớp (B, D) + Band (C); không có E, F, G, H, Thầy');
select t.ok((select reason from public.friend_suggestions() where user_id = t.u('B')) = 'class', 'B: lý do cùng lớp');
select t.ok((select shared_label from public.friend_suggestions() where user_id = t.u('B')) = 'Guitar Solo 01', 'B: nhãn tên lớp');
select t.ok((select reason from public.friend_suggestions() where user_id = t.u('C')) = 'band', 'C: lý do cùng Band');
select t.ok((select user_id from public.friend_suggestions() limit 1) in (t.u('B'), t.u('D')), 'cùng lớp xếp trước cùng Band');

-- Quan hệ: A kết bạn B; H là bạn của B → H = bạn chung
select t.reset(); insert into public.friendships (requester_id, addressee_id, status, responded_at) values
  (t.u('A'), t.u('B'), 'accepted', now()), (t.u('B'), t.u('H'), 'accepted', now());
select t.as_user('A');
select t.ok((select reason from public.friend_suggestions() where user_id = t.u('H')) = 'mutual', 'H gợi ý vì bạn chung');
select t.ok((select mutual_count from public.friend_suggestions() where user_id = t.u('H')) = 1, 'H: 1 bạn chung (B)');
select t.ok(not exists (select 1 from public.friend_suggestions() where user_id = t.u('B')), 'đã là bạn → không gợi ý nữa');
select t.ok((select relationship from public.friend_search('binh') where name = 'Bình') = 'friends', 'tìm Bình: relationship = friends');

-- Lời lẽ đang chờ: không gợi ý lại
select t.ok(public.send_friend_request(t.u('D')) = 'outgoing', 'gửi lời mời D');
select t.ok(not exists (select 1 from public.friend_suggestions() where user_id = t.u('D')), 'đã gửi lời mời → không gợi ý');
select t.ok((select relationship from public.friend_search('dung')) = 'outgoing', 'tìm Dũng: relationship = outgoing');
select t.reset(); insert into public.friendships (requester_id, addressee_id, status) values (t.u('C'), t.u('A'), 'pending');
select t.as_user('A');
select t.ok(not exists (select 1 from public.friend_suggestions() where user_id = t.u('C')), 'C đã gửi lời mời cho A → không gợi ý (đã ở Lời mời)');

-- Chặn: ẩn khỏi cả tìm kiếm lẫn gợi ý, hai chiều
select t.reset(); insert into public.class_user_blocks (blocker_id, blocked_id) values (t.u('H'), t.u('A'));
select t.as_user('A');
select t.ok(t.names('hoang') = '', 'H chặn A → A không tìm thấy H');
select t.ok(not exists (select 1 from public.friend_suggestions() where user_id = t.u('H')), 'H chặn A → không gợi ý');
select t.as_user('H');
select t.ok(not exists (select 1 from public.friend_search('an') where user_id = t.u('A')), 'A bị H chặn → H không tìm thấy A');

-- Thầy: không bị gợi ý cho học sinh, nhưng tìm được
select t.as_user('T');
select t.ok(exists (select 1 from public.friend_search('an')), 'Thầy tìm học sinh được');
select t.as_user('A');
select t.ok(not exists (select 1 from public.friend_suggestions() where user_id = t.u('T')), 'Thầy không nằm trong gợi ý');

-- Quyền
select t.as_user('N');
select t.fails($q$select * from public.friend_search('dung')$q$, 'tài khoản ngoài Class gọi friend_search bị chặn');
select t.fails($q$select * from public.friend_suggestions()$q$, 'tài khoản ngoài Class gọi friend_suggestions bị chặn');
select t.as_anon();
select t.fails($q$select * from public.friend_search('dung')$q$, 'anon không gọi được friend_search');
select t.fails($q$select * from public.friend_suggestions()$q$, 'anon không gọi được friend_suggestions');
select t.as_user('A');
select t.fails($q$select * from public.friends_ctx()$q$, 'authenticated không gọi trực tiếp friends_ctx');
select t.fails($q$select public.friends_fold('x')$q$, 'authenticated không gọi trực tiếp friends_fold');
select t.fails($q$select * from public.friendships$q$, 'bảng friendships vẫn khoá');
select t.reset();
commit;
