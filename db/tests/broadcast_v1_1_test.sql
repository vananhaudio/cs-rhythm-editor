-- ═══ TEST Broadcast V1.1 (db/broadcast_v1_1_setup.sql): phản hồi có giới hạn vào hội thoại Broadcast Chat ═══ chỉ chạy trên cluster TẠM.
-- Z = admin (Owner) · T = Thầy · A,B,C,D = học viên · E = đã nghỉ (is_active=false) · F = bị đình chỉ · G = bị vô hiệu hoá (auth banned)
-- H = có app_users nhưng không phải thành viên Class · N = ngoài Class
\set ON_ERROR_STOP on
do $$ begin
  if exists (select 1 from auth.users where email not like '%@test.local') then raise exception 'DỪNG: có user thật'; end if;
end $$;

insert into auth.users (id, email) values
  ('0d0d0d0d-0000-4000-8000-0000000000d4','d@test.local'),('0e0e0e0e-0000-4000-8000-0000000000e5','e@test.local'),
  ('0f0f0f0f-0000-4000-8000-0000000000f6','f@test.local'),('0a0a0a0a-0000-4000-8000-0000000000a7','g@test.local'),
  ('0b0b0b0b-0000-4000-8000-0000000000b8','h@test.local'),('abcdabcd-0000-4000-8000-0000000000a1','z@test.local'),
  ('9a9a9a9a-0000-4000-8000-0000000000a9','j@test.local');
update auth.users set banned_until = now() + interval '1 year' where id = '0a0a0a0a-0000-4000-8000-0000000000a7';
update auth.users set deleted_at = now() where id = '9a9a9a9a-0000-4000-8000-0000000000a9';
insert into public.app_users (id, role, name, email) values
  ('0d0d0d0d-0000-4000-8000-0000000000d4','student','Dũng','d@test.local'),('0e0e0e0e-0000-4000-8000-0000000000e5','student','Em','e@test.local'),
  ('0f0f0f0f-0000-4000-8000-0000000000f6','student','F','f@test.local'),('0a0a0a0a-0000-4000-8000-0000000000a7','student','G','g@test.local'),
  ('0b0b0b0b-0000-4000-8000-0000000000b8','student','H','h@test.local'),('abcdabcd-0000-4000-8000-0000000000a1','admin','Owner','z@test.local'),
  ('9a9a9a9a-0000-4000-8000-0000000000a9','student','J','j@test.local');
insert into public.edu_students (user_id, full_name, display_name, email, level) values
  ('0d0d0d0d-0000-4000-8000-0000000000d4','Phạm Dũng','Dũng','d@test.local','beginner'),
  ('0e0e0e0e-0000-4000-8000-0000000000e5','Em','Em','e@test.local','beginner'),
  ('0f0f0f0f-0000-4000-8000-0000000000f6','F','F','f@test.local','beginner'),
  ('0a0a0a0a-0000-4000-8000-0000000000a7','G','G','g@test.local','beginner'),
  ('9a9a9a9a-0000-4000-8000-0000000000a9','J','J','j@test.local','beginner');
update public.edu_students set is_active = false where user_id = '0e0e0e0e-0000-4000-8000-0000000000e5';
update public.edu_students set blocked_at = now() where user_id = '0f0f0f0f-0000-4000-8000-0000000000f6';
insert into public.class_schedule values ('c1000000-0000-4000-8000-000000000001','Guitar Solo 01','active'), ('c2000000-0000-4000-8000-000000000002','Lớp đã huỷ','cancelled');
insert into tva_private.class_memberships values
  ('c1000000-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-00000000000a'),
  ('c1000000-0000-4000-8000-000000000001','bbbbbbbb-0000-4000-8000-00000000000b'),
  ('c1000000-0000-4000-8000-000000000001','0e0e0e0e-0000-4000-8000-0000000000e5'),
  ('c2000000-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-00000000000a');
create schema t;
grant usage on schema t to anon, authenticated;
create function t.u(k text) returns uuid language sql immutable as $$
  select case k when 'A' then 'aaaaaaaa-0000-4000-8000-00000000000a'::uuid
                when 'B' then 'bbbbbbbb-0000-4000-8000-00000000000b'::uuid
                when 'C' then 'cccccccc-0000-4000-8000-00000000000c'::uuid
                when 'D' then '0d0d0d0d-0000-4000-8000-0000000000d4'::uuid
                when 'Z' then 'abcdabcd-0000-4000-8000-0000000000a1'::uuid
                when 'E' then '0e0e0e0e-0000-4000-8000-0000000000e5'::uuid
                when 'F' then '0f0f0f0f-0000-4000-8000-0000000000f6'::uuid
                when 'G' then '0a0a0a0a-0000-4000-8000-0000000000a7'::uuid
                when 'H' then '0b0b0b0b-0000-4000-8000-0000000000b8'::uuid
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

grant execute on all functions in schema t to anon, authenticated;
create function t.chat_ids(k text) returns bigint language sql security definer as $$
  select count(*) from public.dm_conversations c where c.user_lo = least(t.u('Z'), t.u(k)) and c.user_hi = greatest(t.u('Z'), t.u(k)) $$;
create function t.nbc(cid uuid) returns bigint language sql security definer as $$ select count(*) from public.class_system_notices where ref_key = cid::text $$;
create function t.st(cid uuid, k text) returns text language sql security definer as $$ select status from public.broadcast_recipients where campaign_id = cid and user_id = t.u(k) $$;
create function t.err(cid uuid, k text) returns text language sql security definer as $$ select error from public.broadcast_recipients where campaign_id = cid and user_id = t.u(k) $$;
create function t.cs(cid uuid) returns text language sql security definer as $$ select status from public.broadcast_campaigns where id = cid $$;
create function t.nusers() returns bigint language sql security definer as $$ select count(*) from auth.users $$;
create function t.scope_a() returns bigint language sql security definer as $$ select count(*) from public.broadcast_scope('notice','all',null,t.u('Z')) where user_id = t.u('A') $$;
create function t.tick() returns int language plpgsql security definer as $$ begin return public.broadcast_tick(); end $$;
grant execute on all functions in schema t to anon, authenticated;

begin;
create temp table ctx (k text primary key, v uuid);
grant all on ctx to authenticated;
insert into public.class_user_blocks (blocker_id, blocked_id) values (t.u('B'), t.u('Z'));
-- Trước khi có chiến dịch: không ai nhắn được Owner (chưa là bạn)
select t.as_user('C');
select t.ok(not public.dm_can_message(t.u('Z')), 'trước Broadcast: C không nhắn được Owner');
select t.as_user('Z');
-- Chiến dịch THÔNG BÁO không mở quyền Chat
insert into ctx select 'n1', public.broadcast_confirm('k-n1','notice','students',null,'Tiêu đề','Thông báo thường',null,4);
select t.reset();
select t.ok(t.tick() = 4, 'worker phát thông báo cho 4 học viên');
select t.as_user('C');
select t.ok(not public.dm_can_message(t.u('Z')), 'nhận Thông báo KHÔNG mở quyền Chat');
select t.as_user('Z');
insert into ctx select 'c1', public.broadcast_confirm('k-c1','chat','students',null,null,'Tin Broadcast',null,3);
select t.reset();
select t.ok(t.tick() = 3, 'worker Chat phát 3 người (B chặn Owner → bỏ qua)');
-- C: được phản hồi
select t.as_user('C');
select t.ok((select can_send from public.dm_conversations()), 'C: can_send = true trong hội thoại Broadcast');
select t.ok(public.dm_can_message(t.u('Z')), 'C: nhắn được Owner');
select public.dm_send(public.dm_find(t.u('Z')), 'Em cảm ơn thầy ạ');
select t.ok((select count(*) from public.dm_messages(public.dm_find(t.u('Z')))) = 2, 'C: thấy tin Owner + tin phản hồi');
-- Không mở rộng: C vẫn không nhắn được học viên khác
select t.ok(not public.dm_can_message(t.u('A')), 'C vẫn KHÔNG nhắn được học viên khác');
select t.fails($q$select public.dm_start(t.u('A'), 'hi')$q$, 'C không bắt đầu hội thoại với học viên khác');
select t.fails($q$select public.dm_start(t.u('D'), 'hi')$q$, 'C không bắt đầu hội thoại với D');
-- Owner thấy phản hồi và trả lời được
select t.as_user('Z');
select t.ok((select count(*) from public.dm_messages(public.dm_find(t.u('C')))) = 2, 'Owner thấy phản hồi của C');
select t.ok(public.dm_can_message(t.u('C')), 'Owner nhắn lại được C');
select public.dm_send(public.dm_find(t.u('C')), 'Thầy nhận rồi nhé');
-- Người KHÔNG thuộc chiến dịch (Thầy T) không có quyền
select t.as_user('T');
select t.ok(not public.dm_can_message(t.u('Z')), 'T (không thuộc chiến dịch) không nhắn được Owner');
select t.fails($q$select public.dm_start(t.u('Z'), 'hi')$q$, 'T không tự mở hội thoại với Owner');
-- B (chặn Owner, bị bỏ qua) không có quyền
select t.as_user('B');
select t.ok(not public.dm_can_message(t.u('Z')), 'B: bị chặn → không có quyền');
-- Chặn có hiệu lực sau khi nhận: D chặn Owner → D không phản hồi được, Owner cũng không nhắn D
select t.as_user('D');
select t.ok(public.dm_can_message(t.u('Z')), 'D trước khi chặn: phản hồi được');
select t.reset(); insert into public.class_user_blocks (blocker_id, blocked_id) values (t.u('D'), t.u('Z'));
select t.as_user('D');
select t.ok(not public.dm_can_message(t.u('Z')), 'D chặn Owner → hết quyền phản hồi');
select t.fails($q$select public.dm_send(public.dm_find(t.u('Z')), 'x')$q$, 'D không gửi được sau khi chặn');
-- Chiến dịch chưa gửi (pending) / bị hủy không cấp quyền
select t.reset();
select t.as_user('Z');
insert into ctx select 'c2', public.broadcast_confirm('k-c2','chat','all',null,null,'Tin ba',null,(select eligible from public.broadcast_preview('chat','all',null)));
select t.reset();
select t.ok(not exists (select 1 from public.broadcast_recipients r where r.campaign_id = (select v from ctx where k='c2') and r.status = 'sent'), 'chiến dịch mới chưa gửi: không có hàng sent');
select t.as_user('T');
select t.ok(not public.dm_can_message(t.u('Z')), 'T chưa nhận (pending) → chưa có quyền');
-- Hàm bị khóa với client
select t.fails($q$select public.dm_rule(t.u('C'), t.u('Z'))$q$, 'client không gọi trực tiếp dm_rule');
select t.reset();
select t.ok((select count(*) from public.friendships) = 0, 'không đụng quan hệ bạn bè');
select t.ok((select count(*) from (select user_lo, user_hi from public.dm_conversations group by 1,2 having count(*) > 1) x) = 0, 'không hội thoại trùng');
commit;
