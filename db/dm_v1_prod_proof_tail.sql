-- ── Chứng minh quyền trong dryrun production (đuôi nối SAU dm_v1_setup.sql → db/dm_v1_prod_dryrun.sql). KHÔNG commit gì: prod-db.py dryrun luôn ROLLBACK.
-- Dùng tài khoản THẬT nhưng chỉ tạo tin 'proof' trong transaction bị huỷ; id không in ra; không đọc nội dung hội thoại của ai.
do $s$
declare a uuid; b uuid; c uuid; t uuid;
begin
  -- Cặp bạn bè accepted giữa hai học sinh (a, b)
  select f.requester_id, f.addressee_id into a, b from public.friendships f
   where f.status = 'accepted'
     and exists (select 1 from public.app_users u where u.id = f.requester_id and u.role = 'student')
     and exists (select 1 from public.app_users u where u.id = f.addressee_id and u.role = 'student')
     and public.is_class_member_user(f.requester_id) and public.is_class_member_user(f.addressee_id)
   order by f.id limit 1;
  -- Học sinh c: không là bạn của a, b
  select s.user_id into c from public.edu_students s join public.app_users u on u.id = s.user_id and u.role = 'student'
   where s.user_id not in (a, b)
     and not exists (select 1 from public.friendships f where least(f.requester_id, f.addressee_id) = least(a, s.user_id) and greatest(f.requester_id, f.addressee_id) = greatest(a, s.user_id))
     and not exists (select 1 from public.friendships f where least(f.requester_id, f.addressee_id) = least(b, s.user_id) and greatest(f.requester_id, f.addressee_id) = greatest(b, s.user_id))
   order by s.user_id limit 1;
  -- Thầy t: không là bạn của c
  select u.id into t from public.app_users u where u.role = 'teacher'
     and not exists (select 1 from public.friendships f where least(f.requester_id, f.addressee_id) = least(u.id, c) and greatest(f.requester_id, f.addressee_id) = greatest(u.id, c))
   order by u.id limit 1;
  if a is null or b is null or c is null or t is null then raise exception 'proof setup: thiếu actor (a=% b=% c=% t=%)', a is not null, b is not null, c is not null, t is not null; end if;
  perform set_config('proof.a', a::text, true); perform set_config('proof.b', b::text, true);
  perform set_config('proof.c', c::text, true); perform set_config('proof.t', t::text, true);
  raise notice 'PROOF setup OK: học sinh a–b là bạn accepted, c không là bạn của a/b, Thầy t không là bạn của c (id không in ra)';
end $s$;

-- Phase 1 — a: bảng khoá, luật quyền, tạo hội thoại bằng tin đầu
do $c$ begin perform set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('proof.a'), 'role', 'authenticated')::text, true), set_config('request.jwt.claim.sub', current_setting('proof.a'), true); end $c$;
set local role authenticated;
do $p$
declare r record; n bigint; e text; conv uuid;
begin
  foreach e in array array['select count(*) from public.dm_messages', 'select count(*) from public.dm_conversations', 'select count(*) from public.dm_participants',
                           'insert into public.dm_messages(conversation_id, seq, sender_id, body) values (gen_random_uuid(), 1, gen_random_uuid(), ''x'')',
                           'delete from public.dm_conversations', 'update public.dm_participants set last_read_seq = 9',
                           'select public.dm_rule(gen_random_uuid(), gen_random_uuid())', 'select public.dm_append(gen_random_uuid(), gen_random_uuid(), ''x'')'] loop
    begin execute e; raise exception 'PROOF FAIL a: lẽ ra bị chặn: %', e;
    exception when insufficient_privilege then null; end;
  end loop;
  raise notice 'PROOF PASS a: không CRUD thẳng 3 bảng dm_*, không gọi được hàm nội bộ (permission denied)';
  if not public.dm_can_message(current_setting('proof.b')::uuid) then raise exception 'PROOF FAIL: bạn accepted phải nhắn được'; end if;
  if public.dm_can_message(current_setting('proof.c')::uuid) then raise exception 'PROOF FAIL: không bạn mà nhắn được'; end if;
  begin perform * from public.dm_start(current_setting('proof.c')::uuid, 'x'); raise exception 'PROOF FAIL: dm_start tới người không bạn thành công';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.dm_conversations()) <> 0 then raise exception 'PROOF FAIL: hội thoại rác'; end if;
  raise notice 'PROOF PASS a: bạn accepted → nhắn được; không bạn → bị từ chối (42501) và KHÔNG sinh hội thoại';
  select * into r from public.dm_start(current_setting('proof.b')::uuid, 'proof');
  conv := r.conversation_id;
  if r.seq <> 1 or public.dm_send(conv, 'proof 2') <> 2 then raise exception 'PROOF FAIL: seq'; end if;
  perform set_config('proof.conv', conv::text, true);
  raise notice 'PROOF PASS a: dm_start tạo hội thoại + tin seq 1; dm_send seq 2';
end $p$;
reset role;

-- Phase 2 — b: thấy hội thoại + chưa đọc; đọc; trả lời
do $c$ begin perform set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('proof.b'), 'role', 'authenticated')::text, true), set_config('request.jwt.claim.sub', current_setting('proof.b'), true); end $c$;
set local role authenticated;
do $p$
declare conv uuid := current_setting('proof.conv')::uuid;
begin
  if public.dm_unread_count() <> 1 then raise exception 'PROOF FAIL b: unread_count'; end if;
  if not exists (select 1 from public.dm_conversations() x where x.conversation_id = conv and x.unread = 2 and x.can_send and not x.last_mine and x.last_body = 'proof 2') then
    raise exception 'PROOF FAIL b: danh sách hội thoại'; end if;
  if (select count(*) from public.dm_messages(conv)) <> 2 then raise exception 'PROOF FAIL b: đọc tin'; end if;
  if public.dm_mark_read(conv, 2) <> 2 then raise exception 'PROOF FAIL b: mark_read'; end if;
  if public.dm_unread_count() <> 0 then raise exception 'PROOF FAIL b: unread sau mark_read'; end if;   -- câu lệnh riêng: STABLE thấy snapshot mới
  if public.dm_send(conv, 'proof 3') <> 3 then raise exception 'PROOF FAIL b: trả lời'; end if;
  raise notice 'PROOF PASS b: thấy hội thoại (chưa đọc 2, tin cuối của a), đọc được, đánh dấu đã đọc → 0, trả lời seq 3';
end $p$;
reset role;

-- Phase 3 — c (không thuộc hội thoại): không đọc/ghi/đánh dấu; lỗi giống id không tồn tại
do $c$ begin perform set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('proof.c'), 'role', 'authenticated')::text, true), set_config('request.jwt.claim.sub', current_setting('proof.c'), true); end $c$;
set local role authenticated;
do $p$
declare conv uuid := current_setting('proof.conv')::uuid; e1 text; e2 text;
begin
  begin perform * from public.dm_messages(conv); e1 := 'OK'; exception when others then e1 := sqlstate || ':' || sqlerrm; end;
  begin perform * from public.dm_messages(gen_random_uuid()); e2 := 'OK'; exception when others then e2 := sqlstate || ':' || sqlerrm; end;
  if e1 is distinct from e2 or e1 not like 'P0002:%' then raise exception 'PROOF FAIL c: đọc % / %', e1, e2; end if;
  begin perform public.dm_send(conv, 'chen ngang'); e1 := 'OK'; exception when others then e1 := sqlstate || ':' || sqlerrm; end;
  begin perform public.dm_send(gen_random_uuid(), 'chen ngang'); e2 := 'OK'; exception when others then e2 := sqlstate || ':' || sqlerrm; end;
  if e1 is distinct from e2 or e1 not like 'P0002:%' then raise exception 'PROOF FAIL c: gửi % / %', e1, e2; end if;
  begin perform public.dm_mark_read(conv, 1); raise exception 'PROOF FAIL c: mark_read'; exception when sqlstate 'P0002' then null; end;
  if public.dm_unread_count() <> 0 or (select count(*) from public.dm_conversations()) <> 0 or public.dm_find(current_setting('proof.a')::uuid) is not null then
    raise exception 'PROOF FAIL c: thấy hội thoại của người khác'; end if;
  raise notice 'PROOF PASS c: người ngoài không đọc/gửi/đánh dấu được; lỗi hội thoại thật ≡ id không tồn tại (không lộ sự tồn tại); danh sách + badge = 0';
end $p$;
reset role;

-- Phase 4 — huỷ kết bạn (mô phỏng, rollback ngay): lịch sử vẫn đọc được, gửi mới bị chặn
do $p$
declare conv uuid := current_setting('proof.conv')::uuid; a uuid := current_setting('proof.a')::uuid; b uuid := current_setting('proof.b')::uuid;
begin
  begin
    delete from public.friendships where least(requester_id, addressee_id) = least(a, b) and greatest(requester_id, addressee_id) = greatest(a, b);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', a, 'role', 'authenticated')::text, true), set_config('request.jwt.claim.sub', a::text, true);
    set local role authenticated;
    begin perform public.dm_send(conv, 'sau khi huỷ'); raise exception 'PROOF FAIL: hết bạn mà vẫn gửi được';
    exception when insufficient_privilege then null; end;
    begin perform * from public.dm_start(b, 'cửa sau'); raise exception 'PROOF FAIL: hết bạn mà dm_start được';
    exception when insufficient_privilege then null; end;
    if (select count(*) from public.dm_messages(conv)) <> 3 then raise exception 'PROOF FAIL: mất lịch sử'; end if;
    if not exists (select 1 from public.dm_conversations() x where x.conversation_id = conv and not x.can_send) then raise exception 'PROOF FAIL: can_send'; end if;
    reset role;
    raise exception using errcode = 'PR001', message = 'proof-rollback';
  exception when sqlstate 'PR001' then null;
  end;
  raise notice 'PROOF PASS: huỷ kết bạn → vẫn ĐỌC lịch sử (3 tin), gửi mới và dm_start đều bị chặn, can_send = false (đã rollback)';
end $p$;

-- Phase 5 — Thầy ↔ học viên không bạn: nhánh quyền lớp CHƯA mở → bị từ chối (cả hai chiều)
do $c$ begin perform set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('proof.t'), 'role', 'authenticated')::text, true), set_config('request.jwt.claim.sub', current_setting('proof.t'), true); end $c$;
set local role authenticated;
do $p$ begin
  if public.dm_can_message(current_setting('proof.c')::uuid) then raise exception 'PROOF FAIL t: Thầy nhắn được học viên không bạn'; end if;
  begin perform * from public.dm_start(current_setting('proof.c')::uuid, 'x'); raise exception 'PROOF FAIL t'; exception when insufficient_privilege then null; end;
  raise notice 'PROOF PASS t: Thầy ↔ học viên không là bạn: chưa nhắn được (nhánh quyền lớp đang dừng, đúng thiết kế)';
end $p$;
reset role;
select 'DM_V1_PROD_DRYRUN_PROOF = PASS' as result;
