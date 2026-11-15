-- ═══ TEST Broadcast V1 (db/broadcast_v1_setup.sql) ═══ chỉ chạy trên cluster PostgreSQL TẠM (scripts/test-broadcast-v1-db.sh).
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
-- ── Quyền: chỉ admin ──
select t.as_user('A');
select t.fails($q$select * from public.broadcast_preview('notice','all',null)$q$, 'học viên không xem trước được');
select t.fails($q$select public.broadcast_confirm('k','notice','all',null,'t','b',null,1)$q$, 'học viên không xác nhận gửi được');
select t.fails($q$select * from public.broadcast_campaigns()$q$, 'học viên không xem lịch sử');
select t.fails($q$select * from public.broadcast_audiences()$q$, 'học viên không xem danh sách lớp/Band');
select t.fails($q$select public.broadcast_tick()$q$, 'học viên không gọi worker');
select t.fails($q$select public.broadcast_classify('chat','all',gen_random_uuid(),gen_random_uuid())$q$, 'học viên không gọi hàm nội bộ');
select t.fails($q$select * from public.broadcast_recipients$q$, 'không đọc thẳng bảng người nhận');
select t.as_user('T');
select t.fails($q$select * from public.broadcast_preview('notice','all',null)$q$, 'Thầy (teacher) không phải admin → chặn');
select t.as_anon();
select t.fails($q$select * from public.broadcast_preview('notice','all',null)$q$, 'anon bị chặn');

-- ── Xem trước ──
select t.as_user('Z');
select t.ok((select eligible from public.broadcast_preview('notice','all',null)) = 5, 'Tất cả (Thông báo): 5 hợp lệ (A,B,C,D,T)');
select t.ok((select reasons from public.broadcast_preview('notice','all',null)) = '{"self":1,"inactive":1,"suspended":1,"disabled":1,"deleted":1,"not_class_member":2}'::jsonb,
            'lý do loại trừ đầy đủ: self, inactive, suspended, disabled, deleted, not_class_member×2');
select t.ok((select eligible + excluded from public.broadcast_preview('notice','all',null)) = t.nusers(), 'hợp lệ + loại trừ = TOÀN BỘ tài khoản (không bỏ sót)');
select t.ok((select eligible from public.broadcast_preview('notice','students',null)) = 4, 'Học viên: 4 (Thầy không tính)');
select t.ok((select reasons->>'not_student' from public.broadcast_preview('notice','students',null)) is null, 'phạm vi học viên chỉ xét người có hồ sơ học viên');
select t.ok((select eligible from public.broadcast_preview('notice','class','c1000000-0000-4000-8000-000000000001')) = 2, 'Lớp: A,B (E nghỉ bị loại)');
select t.ok((select reasons from public.broadcast_preview('notice','class','c1000000-0000-4000-8000-000000000001')) = '{"inactive":1}'::jsonb, 'Lớp: lý do inactive');
select t.ok((select eligible from public.broadcast_preview('notice','band','11111111-0000-4000-8000-0000000000a1')) = 2, 'Band: A,C');
-- A thuộc nhiều lớp + Band: vẫn chỉ MỘT lần
select t.ok(t.scope_a() = 1, 'một người chỉ một dòng trong phạm vi');
select t.fails($q$select * from public.broadcast_preview('sms','all',null)$q$, 'kênh lạ bị chặn');
select t.fails($q$select * from public.broadcast_preview('notice','class',gen_random_uuid())$q$, 'lớp không tồn tại bị chặn');
select t.fails($q$select * from public.broadcast_preview('notice','class',null)$q$, 'thiếu lớp bị chặn');
select t.ok((select count(*) from public.broadcast_audiences() where kind='class') = 1, 'danh sách lớp bỏ lớp huỷ');
-- Chat: B chặn Z
select t.reset(); insert into public.class_user_blocks (blocker_id, blocked_id) values (t.u('B'), t.u('Z'));
select t.as_user('Z');
select t.ok((select eligible from public.broadcast_preview('chat','all',null)) = 4, 'Chat: B chặn Owner → loại (4)');
select t.ok((select reasons->>'blocked' from public.broadcast_preview('chat','all',null)) = '1', 'Chat: lý do blocked');
select t.ok((select eligible from public.broadcast_preview('notice','all',null)) = 5, 'Thông báo: người chặn Chat vẫn nhận thông báo hệ thống');

-- Chưa gửi gì
select t.reset();
select t.ok((select count(*) from public.broadcast_campaigns) = 0 and (select count(*) from public.class_system_notices) = 0, 'xem trước KHÔNG tạo chiến dịch/thông báo');
select t.as_user('Z');

-- ── Xác nhận (Thông báo) ──
select t.fails($q$select public.broadcast_confirm('k1','notice','all',null,'Tiêu đề','Nội dung',null,4)$q$, 'số người nhận đổi (4≠5) → bắt xem lại');
select t.fails($q$select public.broadcast_confirm('k1','notice','all',null,'Tiêu đề','   ',null,5)$q$, 'nội dung trống bị chặn');
select t.fails($q$select public.broadcast_confirm('k1','notice','all',null,'T','x','https://evil.example',5)$q$, 'link ngoài bị chặn');
select t.fails($q$select public.broadcast_confirm('k1','notice','all',null,'T','x','//evil.example',5)$q$, 'link // bị chặn');
select t.fails($q$select public.broadcast_confirm('','notice','all',null,'T','x',null,5)$q$, 'thiếu khoá idempotency bị chặn');
create temp table ctx (k text primary key, v uuid);
insert into ctx select 'n1', public.broadcast_confirm('k-n1','notice','all',null,'Chào lớp','Xin chào 🎸 Tiếng Việt có dấu\nDòng hai','/me/friends',5);
select t.reset();
select t.ok((select count(*) from public.broadcast_recipients where campaign_id = (select v from ctx where k='n1') and status = 'pending') = 5, '5 người ở trạng thái chờ');
select t.ok((select count(*) from public.broadcast_recipients where campaign_id = (select v from ctx where k='n1') and status = 'skipped') = 7, '7 người bị loại được GHI LẠI kèm lý do');
select t.ok(t.err((select v from ctx where k='n1'), 'E') = 'inactive' and t.err((select v from ctx where k='n1'), 'F') = 'suspended', 'lý do ghi đúng từng người');
select t.ok(t.nbc((select v from ctx where k='n1')) = 0, 'xác nhận chưa phân phối gì (chờ worker)');
select t.as_user('Z');
select t.ok(public.broadcast_confirm('k-n1','notice','all',null,'Chào lớp','Xin chào','/me/friends',5) = (select v from ctx where k='n1'), 'bấm lại cùng khoá → cùng chiến dịch (không tạo thêm)');
select t.ok((select count(*) from public.broadcast_campaigns()) = 1, 'chỉ 1 chiến dịch');
select t.reset();

-- ── Worker (Thông báo) ──
select t.ok(t.tick() = 5, 'worker phát 5 người');
select t.ok(t.tick() = 0, 'chạy lại: không phát thêm');
select t.ok(t.nbc((select v from ctx where k='n1')) = 5, 'đúng 5 thông báo, không trùng');
select t.ok(t.cs((select v from ctx where k='n1')) = 'completed', 'chiến dịch completed');
select t.ok(t.st((select v from ctx where k='n1'), 'A') = 'sent' and t.st((select v from ctx where k='n1'), 'E') = 'skipped', 'trạng thái từng người đúng');
select t.ok(not exists (select 1 from public.class_system_notices where user_id in (t.u('E'), t.u('F'), t.u('G'), t.u('H'), t.u('Z'))), 'người bị loại và chính Owner không nhận');
-- Người nhận
select t.as_user('A');
select t.ok((select count(*) from public.class_system_notices()) = 1, 'A thấy 1 thông báo');
select t.ok((select title from public.class_system_notices()) = 'Chào lớp' and (select link from public.class_system_notices()) = '/me/friends', 'title + link đúng');
select t.ok((select body from public.class_system_notices()) like E'%Tiếng Việt có dấu%', 'Unicode tiếng Việt giữ nguyên');
select t.ok((select unread from public.class_system_notices()), 'chưa đọc (không tự đánh dấu đã đọc)');
select t.ok((select unread from public.class_system_notice_summary()) = 1, 'badge = 1');
select t.ok(public.class_system_notice_mark_read((select seq from public.class_system_notices())) > 0, 'đánh dấu đã đọc');
select t.ok((select unread from public.class_system_notice_summary()) = 0, 'badge = 0 sau khi đọc');
select t.as_user('B');
select t.ok((select count(*) from public.class_system_notices()) = 1 and (select unread from public.class_system_notices()), 'B có thông báo riêng, chưa đọc');
select t.fails($q$select * from public.class_system_notices where user_id <> auth.uid()$q$, 'không đọc thẳng bảng thông báo');
select t.as_user('Z');
select t.ok((select (stats->>'sent')::int from public.broadcast_campaign((select v from ctx where k='n1'))) = 5, 'thống kê sent = 5');
select t.ok((select (stats->>'read')::int from public.broadcast_campaign((select v from ctx where k='n1'))) = 1, 'thống kê đã đọc = 1 (chỉ A)');
select t.ok((select count(*) from public.broadcast_recipients_page((select v from ctx where k='n1'), 'skipped')) = 7, 'kiểm toán: liệt kê từng người bị loại');
select t.reset();

-- ── Chat ──
-- A đã có hội thoại với Z (kèm lịch sử); C chưa có
insert into public.dm_conversations (user_lo, user_hi) values (least(t.u('A'), t.u('Z')), greatest(t.u('A'), t.u('Z')));
insert into public.dm_participants (conversation_id, user_id) select c.id, x from public.dm_conversations c, unnest(array[t.u('A'), t.u('Z')]) x
  where c.user_lo = least(t.u('A'), t.u('Z')) and c.user_hi = greatest(t.u('A'), t.u('Z'));
select public.dm_append((select id from public.dm_conversations), t.u('Z'), 'Tin cũ');
select t.as_user('Z');
insert into ctx select 'c1', public.broadcast_confirm('k-c1','chat','all',null,'(bỏ qua)','Tin Broadcast',null,4);
select t.ok((select title from public.broadcast_campaign((select v from ctx where k='c1'))) is null, 'kênh Chat không lưu tiêu đề');
select t.reset();
select t.ok(t.chat_ids('C') = 0 and (select count(*) from public.dm_messages) = 1, 'xác nhận Chat chưa gửi tin nào');
select t.ok(t.tick() = 4, 'worker Chat phát 4 người');
select t.ok(t.tick() = 0, 'chạy lại không phát thêm');
select t.ok(t.chat_ids('A') = 1, 'A: dùng lại hội thoại cũ (không tạo trùng)');
select t.ok(t.chat_ids('C') = 1 and t.chat_ids('D') = 1 and t.chat_ids('T') = 1, 'C, D, T: đúng MỘT hội thoại mới');
select t.ok(t.chat_ids('B') = 0 and t.st((select v from ctx where k='c1'), 'B') = 'skipped' and t.err((select v from ctx where k='c1'), 'B') = 'blocked', 'B chặn Owner → không gửi, ghi blocked');
select t.ok((select count(*) from public.dm_messages where body = 'Tin Broadcast') = 4, 'đúng 4 tin Broadcast');
select t.ok((select count(*) from public.dm_messages m join public.dm_conversations c on c.id = m.conversation_id where c.user_lo = least(t.u('A'), t.u('Z')) and c.user_hi = greatest(t.u('A'), t.u('Z'))) = 2, 'A: tin cũ còn nguyên + tin mới');
select t.ok(t.cs((select v from ctx where k='c1')) = 'completed', 'chiến dịch Chat completed');
select t.as_user('C');
select t.ok((select count(*) from public.dm_conversations()) = 1 and (select unread from public.dm_conversations()) = 1, 'C thấy hội thoại, unread = 1');
select t.ok((select last_body from public.dm_conversations()) = 'Tin Broadcast' and not (select last_mine from public.dm_conversations()), 'tin hiển thị từ Owner');
select t.ok(not (select can_send from public.dm_conversations()), 'C không phải bạn → không trả lời được (luật Chat giữ nguyên)');
select t.fails($q$select public.dm_start(public.dm_find(t.u('Z')), 'x')$q$, 'C không dùng Chat để vượt luật bạn bè');
select t.ok(not public.dm_can_message(t.u('A')), 'C vẫn không nhắn được học viên khác (không mở rộng quyền)');
select t.ok((select count(*) from public.dm_messages(public.dm_find(t.u('Z')))) = 1, 'C đọc được tin');
select t.as_user('D');
select t.ok((select count(*) from public.dm_conversations()) = 1, 'D chỉ thấy hội thoại của mình (không lộ người nhận khác)');
select t.reset();

-- ── Retry / lỗi một người / backoff ──
create table public.t_fail (uid uuid primary key);
create function public.t_fail_trg() returns trigger language plpgsql as $$ begin
  if exists (select 1 from public.t_fail f join public.dm_conversations c on c.id = new.conversation_id where f.uid in (c.user_lo, c.user_hi)) then raise exception 'lỗi giả lập'; end if; return new; end $$;
create trigger t_fail_trg before insert on public.dm_messages for each row execute function public.t_fail_trg();
insert into public.t_fail values (t.u('D'));
select t.as_user('Z');
insert into ctx select 'c2', public.broadcast_confirm('k-c2','chat','students',null,null,'Tin hai',null,3);
select t.reset();
select t.ok(t.tick() = 2, 'D lỗi, 2 người còn lại vẫn gửi (lỗi không kéo cả lô)');
select t.ok(t.st((select v from ctx where k='c2'), 'D') = 'pending' and (select attempts from public.broadcast_recipients where campaign_id = (select v from ctx where k='c2') and user_id = t.u('D')) = 1, 'D: chờ thử lại, attempts = 1');
select t.ok(t.err((select v from ctx where k='c2'), 'D') like '%lỗi giả lập%', 'lý do lỗi được ghi');
select t.ok(t.tick() = 0, 'chưa tới giờ backoff → không thử lại ngay');
select t.ok(t.cs((select v from ctx where k='c2')) = 'sending', 'còn người chờ → vẫn sending');
update public.broadcast_recipients set next_attempt_at = now() where campaign_id = (select v from ctx where k='c2');
select t.ok(t.tick() = 0, 'tick lần 2');
select t.ok((select attempts from public.broadcast_recipients where campaign_id = (select v from ctx where k='c2') and user_id = t.u('D')) = 2, 'thử lại lần 2 vẫn lỗi (attempts = 2)');
update public.broadcast_recipients set next_attempt_at = now() where campaign_id = (select v from ctx where k='c2');
select t.ok(t.tick() = 0, 'tick lần 3');
select t.ok(t.st((select v from ctx where k='c2'), 'D') = 'failed', 'quá 3 lần → failed');
select t.ok(t.cs((select v from ctx where k='c2')) = 'partial_failed', 'chiến dịch partial_failed (có thành công + thất bại)');
select t.ok((select count(*) from public.dm_messages where body = 'Tin hai') = 2, 'không gửi đúp cho 2 người đã nhận');
delete from public.t_fail;

-- ── Kiểm lại điều kiện ngay trước khi phát ──
select t.as_user('Z');
insert into ctx select 'n2', public.broadcast_confirm('k-n2','notice','students',null,'Hai','Nội dung hai',null,4);
select t.reset();
update public.edu_students set blocked_at = now() where user_id = t.u('C');   -- bị đình chỉ SAU khi chụp danh sách
select t.ok(t.tick() = 4, 'tick xử lý 4 người');
select t.ok(t.st((select v from ctx where k='n2'), 'C') = 'skipped' and t.err((select v from ctx where k='n2'), 'C') = 'suspended', 'C đình chỉ sau khi chụp → bị bỏ qua, ghi lý do');
update public.edu_students set blocked_at = null where user_id = t.u('C');
select t.ok(t.nbc((select v from ctx where k='n2')) = 3, 'chỉ 3 thông báo được tạo');

-- ── Hủy ──
select t.as_user('Z');
insert into ctx select 'n3', public.broadcast_confirm('k-n3','notice','class','c1000000-0000-4000-8000-000000000001','Ba','Nội dung ba',null,2);
select t.ok((public.broadcast_cancel((select v from ctx where k='n3')))->>'cancelled' = '2', 'hủy: 2 người chưa gửi bị hủy');
select t.ok((public.broadcast_cancel((select v from ctx where k='n3')))->>'cancelled' = '0', 'hủy lần hai: không đổi');
select t.reset();
select t.ok(t.tick() = 0, 'sau hủy worker không có gì để phát');
select t.ok(t.nbc((select v from ctx where k='n3')) = 0, 'sau hủy không có thông báo nào');
select t.ok(t.cs((select v from ctx where k='n3')) = 'cancelled', 'trạng thái cancelled');
select t.as_user('Z');
select t.ok((public.broadcast_cancel((select v from ctx where k='n1')))->>'status' = 'completed', 'chiến dịch đã xong không hủy được (không thu hồi)');
select t.reset();

-- ── Bất biến ──
select t.ok((select count(*) from (select user_id, dedupe_key from public.class_system_notices group by 1,2 having count(*) > 1) x) = 0, 'không có thông báo trùng (user, dedupe_key)');
select t.ok((select count(*) from (select user_lo, user_hi from public.dm_conversations group by 1,2 having count(*) > 1) x) = 0, 'không có hội thoại trùng');
select t.ok((select count(*) from public.friendships) = 0, 'không đụng quan hệ bạn bè');
select t.ok(not exists (select 1 from public.dm_conversations c where not exists (select 1 from public.dm_messages m where m.conversation_id = c.id)), 'không có hội thoại mồ côi (rỗng)');
commit;
