-- ═══ TEST Class Chat V1b — Share nội bộ (db/dm_share_v1_setup.sql) ═══
-- CHỈ chạy trên cluster PostgreSQL TẠM qua scripts/test-dm-share-v1-db.sh (nạp SAU fixture + … + BMS/Nhịp&Phách + dm_v1_setup + dm_share_v1_setup).
-- A, B, C = học sinh · T = Thầy · N = tài khoản ngoài Class.
\set ON_ERROR_STOP on

do $$ begin
  if exists (select 1 from auth.users where email not like '%@test.local') then
    raise exception 'DỪNG: cơ sở dữ liệu có user thật — test này chỉ dành cho cluster tạm';
  end if;
end $$;

create schema t;
grant usage on schema t to anon, authenticated;
create function t.u(k text) returns uuid language sql immutable as $$
  select case k when 'A' then 'aaaaaaaa-0000-4000-8000-00000000000a'::uuid
                when 'B' then 'bbbbbbbb-0000-4000-8000-00000000000b'::uuid
                when 'C' then 'cccccccc-0000-4000-8000-00000000000c'::uuid
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
  begin execute q; exception when others then raise notice 'PASS: % (bị chặn: %)', msg, sqlerrm; return; end;
  raise exception 'FAIL: % — câu lệnh lẽ ra phải bị chặn: %', msg, q;
end $$;
create function t.err(q text) returns text language plpgsql as $$ begin
  execute q; return 'OK';
exception when others then return sqlstate || ':' || sqlerrm;
end $$;
create function t.friends(x text, y text, st text) returns void language sql security definer as $$
  insert into public.friendships (requester_id, addressee_id, status, responded_at)
  values (t.u(x), t.u(y), st, case when st = 'pending' then null else now() end)
$$;
create function t.unfriend_row(x text, y text) returns void language sql security definer as $$
  delete from public.friendships where least(requester_id, addressee_id) = least(t.u(x), t.u(y))
                                    and greatest(requester_id, addressee_id) = greatest(t.u(x), t.u(y))
$$;
create function t.mkart(p_id uuid, p_owner text, p_tool text, p_kind text, p_vis text default 'class') returns void language sql security definer as $$
  insert into public.tool_artifacts (id, owner_id, tool, kind, schema_version, title, data, visibility, client_key, content, content_sha256)
  values (p_id, t.u(p_owner), p_tool, p_kind, 1, 'Bài thử ' || left(p_id::text, 4), '{}'::jsonb, p_vis, gen_random_uuid(),
          case when p_tool = 'nhipphach' then '<score-partwise/>' end, case when p_tool = 'nhipphach' then repeat('0', 64) end)
$$;
create function t.dmrows() returns text language sql security definer as $$
  select (select count(*) from public.dm_conversations) || '/' || (select count(*) from public.dm_participants) || '/' || (select count(*) from public.dm_messages)
$$;
grant execute on all functions in schema t to anon, authenticated;

-- Artifact mẫu (test riêng được phép nới CHECK visibility để dựng ca "không có quyền xem")
alter table public.tool_artifacts drop constraint tool_artifacts_visibility_check;
select t.mkart('a1111111-0000-4000-8000-000000000001', 'A', 'bms', 'song');
select t.mkart('a2222222-0000-4000-8000-000000000002', 'C', 'bms', 'song');
select t.mkart('a3333333-0000-4000-8000-000000000003', 'C', 'bms', 'song', 'private');   -- chủ C, KHÔNG ai khác đọc được
select t.mkart('a4444444-0000-4000-8000-000000000004', 'A', 'nhipphach', 'score');
select t.mkart('a5555555-0000-4000-8000-000000000005', 'A', 'bms', 'song');

-- ── 0. Quyền gọi + bảng vẫn đóng ──
do $$ begin
  perform t.as_user('A');
  perform t.fails($q$select public.dm_open(t.u('A'), t.u('B'))$q$, '0 dm_open là nội bộ');
  perform t.fails($q$select public.dm_append(gen_random_uuid(), t.u('A'), null, 'tool_artifact', 'a1111111-0000-4000-8000-000000000001')$q$, '0 dm_append (5 tham số) là nội bộ');
  perform t.fails($q$select * from public.dm_messages$q$, '0 vẫn KHÔNG đọc thẳng bảng dm_messages');
  perform t.fails($q$insert into public.dm_messages (conversation_id, seq, sender_id, body, ref_type, ref_key) values (gen_random_uuid(), 1, t.u('A'), 'x', 'tool_artifact', 'a1111111-0000-4000-8000-000000000001')$q$, '0 KHÔNG chèn thẳng tin share');
  perform t.as_anon();
  perform t.fails($q$select * from public.dm_share(t.u('B'), 'tool_artifact', 'a1111111-0000-4000-8000-000000000001')$q$, '0 anon không gọi được dm_share');
  perform t.reset();
  perform t.ok(not exists (select 1 from pg_proc where proname = 'dm_append' and pronargs = 3), '0 dm_append 3 tham số đã được thay (không còn overload cũ)');
  perform t.ok((select count(*) from information_schema.role_table_grants where table_name = 'dm_messages' and grantee in ('anon', 'authenticated', 'PUBLIC')) = 0, '0 bảng dm_messages vẫn không cấp quyền cho client');
  perform t.ok((select count(*) from pg_policies where tablename like 'dm\_%') = 0, '0 vẫn không có policy trên dm_*');
end $$;

-- ── 1. Không phải bạn accepted → không share được, không sinh hội thoại rác ──
do $$ begin
  perform t.as_user('A');
  perform t.ok(t.err($q$select * from public.dm_share(t.u('B'), 'tool_artifact', 'a1111111-0000-4000-8000-000000000001')$q$) like '42501:%', '1 người lạ: dm_share bị chặn (42501)');
  perform t.ok(t.err($q$select * from public.dm_share(t.u('N'), 'tool_artifact', 'a1111111-0000-4000-8000-000000000001')$q$) like '42501:%', '1 ngoài Class: bị chặn');
  perform t.ok(t.err($q$select * from public.dm_share(t.u('A'), 'tool_artifact', 'a1111111-0000-4000-8000-000000000001')$q$) like '42501:%', '1 tự gửi cho mình: bị chặn');
  perform t.reset();
  perform t.friends('A', 'B', 'pending');
  perform t.as_user('A');
  perform t.ok(t.err($q$select * from public.dm_share(t.u('B'), 'tool_artifact', 'a1111111-0000-4000-8000-000000000001')$q$) like '42501:%', '1 PENDING: bị chặn');
  perform t.as_user('N');
  perform t.ok(t.err($q$select * from public.dm_share(t.u('A'), 'tool_artifact', 'a1111111-0000-4000-8000-000000000001')$q$) like '42501:%', '1 tài khoản ngoài Class gọi: bị chặn');
  perform t.reset();
  perform t.unfriend_row('A', 'B');
  perform t.ok(t.dmrows() = '0/0/0', '1 mọi ca bị chặn KHÔNG sinh hội thoại/tin');
end $$;

-- ── 2. Bạn accepted: share dùng CÙNG hội thoại + seq với text; body cố định; unread/read như text ──
do $$ declare c uuid; r record; begin
  perform t.friends('A', 'B', 'accepted');
  perform t.as_user('A');
  select * into r from public.dm_share(t.u('B'), 'tool_artifact', 'A1111111-0000-4000-8000-000000000001');   -- hoa/thường đều nhận
  c := r.conversation_id;
  perform t.ok(r.seq = 1, '2 share đầu tiên tạo hội thoại, seq = 1');
  perform t.ok((select count(*) from public.dm_messages(c)) = 1, '2 hội thoại có 1 tin');
  perform t.ok((select body = 'Đã chia sẻ một nội dung' and ref_type = 'tool_artifact' and ref_key = 'a1111111-0000-4000-8000-000000000001' and mine from public.dm_messages(c) where seq = 1),
               '2 tin share: body CỐ ĐỊNH, ref_type/ref_key đúng (chữ thường), mine');
  perform t.ok(public.dm_send(c, 'Bài này hay lắm') = 2, '2 text sau share dùng CÙNG hội thoại, seq = 2');
  select * into r from public.dm_share(t.u('B'), 'tool_artifact', 'a5555555-0000-4000-8000-000000000005');
  perform t.ok(r.conversation_id = c and r.seq = 3, '2 share thứ hai: cùng hội thoại canonical, seq = 3');
  perform t.ok(public.dm_unread_count() = 0, '2 người gửi: không chưa đọc');
  perform t.as_user('B');
  perform t.ok(public.dm_unread_count() = 1, '2 B thấy 1 hội thoại chưa đọc (badge) do tin share');
  perform t.ok((select unread = 3 and last_body = 'Đã chia sẻ một nội dung' and not last_mine from public.dm_conversations()), '2 danh sách của B: unread=3, preview = "Đã chia sẻ một nội dung"');
  perform t.ok((select count(*) from public.dm_messages(c) where ref_type is null) = 1 and (select count(*) from public.dm_messages(c) where ref_type is not null) = 2, '2 B đọc: 1 text + 2 share, ref null ở tin text');
  perform t.ok((select count(*) from public.dm_messages(c, 2)) = 1, '2 polling after=2 trả đúng tin share mới (seq 3) kèm ref');
  perform t.ok(public.dm_mark_read(c, 3) = 3, '2 mark_read qua tin share');
  perform t.ok(public.dm_unread_count() = 0, '2 mở hội thoại/đọc tới tin share → badge hết');
  perform public.dm_send(c, 'cảm ơn');
  perform t.as_user('A');
  perform t.ok((select count(*) from public.dm_messages(c)) = 4 and public.dm_unread_count() = 1, '2 text sau share vẫn hoạt động hai chiều');
  perform t.reset();
  perform t.ok(t.dmrows() = '1/2/4', '2 đúng 1 hội thoại, 2 người, 4 tin');
  -- lời gọi dm_append 3 tham số kiểu V1a vẫn chạy (backward-compatible)
  perform public.dm_append(c, t.u('A'), '  text qua đường cũ ');
  perform t.ok((select body from public.dm_messages where conversation_id = c and seq = 5) = 'text qua đường cũ' , '2 dm_append gọi kiểu V1a (3 tham số) vẫn trim + ghi text');
  -- tin share từ phía B (hội thoại canonical hai chiều)
  perform t.as_user('B');
  perform t.ok((select conversation_id from public.dm_share(t.u('A'), 'tool_artifact', 'a2222222-0000-4000-8000-000000000002')) = c, '2 B share cho A: vào CÙNG hội thoại');
  perform t.reset();
  perform t.ok((select count(*) from public.dm_conversations) = 1, '2 vẫn đúng 1 hội thoại cho cặp A–B');
end $$;

-- ── 3. Object không hợp lệ / không được phép: MỘT thông báo chung, không rò tồn tại ──
do $$ declare base text; n_before text; e text; begin
  perform t.reset(); n_before := t.dmrows();
  perform t.as_user('A');
  base := t.err($q$select * from public.dm_share(t.u('B'), 'tool_artifact', 'a9999999-0000-4000-8000-000000000009')$q$);   -- không tồn tại
  perform t.ok(base like '22023:%', '3 artifact không tồn tại → lỗi 22023');
  perform t.ok(t.err($q$select * from public.dm_share(t.u('B'), 'tool_artifact', 'a3333333-0000-4000-8000-000000000003')$q$) = base, '3 artifact CÓ nhưng người gửi không đọc được ≡ không tồn tại (cùng lỗi, không leak)');
  -- Phạm vi theo phiên bản: V1b chỉ BMS (nhipphach ≡ cùng lỗi); từ Universal Share (có tool_artifact_save_for_share) Nhịp & Phách được phép gửi
  if to_regprocedure('public.tool_artifact_save_for_share(text,jsonb)') is null then
    perform t.ok(t.err($q$select * from public.dm_share(t.u('B'), 'tool_artifact', 'a4444444-0000-4000-8000-000000000004')$q$) = base, '3 artifact tool khác (nhipphach) ngoài phạm vi V1b ≡ cùng lỗi');
  else
    perform t.ok(true, '3 (Universal Share) nhipphach được phép gửi — kiểm ở universal_share_v1_test (ở đây không gửi để giữ đếm hàng)');
  end if;
  perform t.ok(t.err($q$select * from public.dm_share(t.u('B'), 'tool_artifact', 'khong-phai-uuid')$q$) = base, '3 khoá sai định dạng ≡ cùng lỗi');
  perform t.ok(t.err($q$select * from public.dm_share(t.u('B'), 'tool_artifact', null)$q$) = base, '3 khoá null ≡ cùng lỗi');
  perform t.ok(t.err($q$select * from public.dm_share(t.u('B'), 'post', 'a1111111-0000-4000-8000-000000000001')$q$) = base, '3 ref_type ngoài allowlist ≡ cùng lỗi');
  perform t.ok(t.err($q$select * from public.dm_share(t.u('B'), null, 'a1111111-0000-4000-8000-000000000001')$q$) = base, '3 ref_type null ≡ cùng lỗi');
  perform t.reset();
  perform t.ok(t.dmrows() = n_before, '3 mọi ca lỗi KHÔNG ghi gì');
end $$;

-- ── 4. Share KHÔNG cấp quyền object: tin còn, nhưng quyền xem do RLS tool_artifacts ──
do $$ declare c uuid; begin
  select id into c from public.dm_conversations limit 1;
  -- giả lập "object bị gỡ quyền": B chia sẻ-bằng-tay (postgres) một tham chiếu tới artifact private của C; và một artifact đã bị xoá
  insert into public.dm_messages (conversation_id, seq, sender_id, body, ref_type, ref_key)
  select c, last_seq + 1, t.u('A'), 'Đã chia sẻ một nội dung', 'tool_artifact', 'a3333333-0000-4000-8000-000000000003' from public.dm_conversations where id = c;
  update public.dm_conversations set last_seq = last_seq + 1 where id = c;
  perform t.as_user('B');
  perform t.ok((select count(*) from public.tool_artifacts where id = 'a3333333-0000-4000-8000-000000000003') = 0, '4 người nhận KHÔNG đọc được artifact private dù tin chat chứa tham chiếu (share không cấp quyền)');
  perform t.ok((select count(*) from public.dm_messages(c) where ref_key = 'a3333333-0000-4000-8000-000000000003') = 1, '4 tin vẫn còn trong hội thoại (client hiện "không còn khả dụng")');
  perform t.ok((select count(*) from public.tool_artifacts where id = 'a1111111-0000-4000-8000-000000000001') = 1, '4 artifact class-visible: B đọc được qua RLS hiện có');
  perform t.reset();
  delete from public.tool_artifacts where id = 'a1111111-0000-4000-8000-000000000001';
  perform t.as_user('B');
  perform t.ok((select count(*) from public.dm_messages(c) where ref_key = 'a1111111-0000-4000-8000-000000000001') = 1, '4 artifact bị XOÁ: tin share vẫn còn nguyên');
  perform t.ok((select count(*) from public.tool_artifacts where id = 'a1111111-0000-4000-8000-000000000001') = 0, '4 artifact bị xoá: resolve trả 0 dòng');
  -- người ngoài hội thoại không thấy tin share
  perform t.as_user('C');
  perform t.ok(t.err(format($q$select * from public.dm_messages(%L)$q$, c)) like 'P0002:%', '4 C (không thuộc hội thoại) không đọc được tin share');
  perform t.reset();
end $$;

-- ── 5. Huỷ kết bạn: đọc lịch sử vẫn được, share/gửi mới bị chặn; kết bạn lại thì gửi được ──
do $$ declare c uuid; begin
  select id into c from public.dm_conversations limit 1;
  perform t.unfriend_row('A', 'B');
  perform t.as_user('A');
  perform t.ok(t.err($q$select * from public.dm_share(t.u('B'), 'tool_artifact', 'a5555555-0000-4000-8000-000000000005')$q$) like '42501:%', '5 unfriend: dm_share bị chặn (42501)');
  perform t.ok((select count(*) from public.dm_messages(c)) > 0, '5 unfriend: vẫn ĐỌC được lịch sử (kể cả tin share)');
  perform t.ok((select not can_send from public.dm_conversations()), '5 unfriend: can_send = false');
  perform t.reset();
  perform t.friends('A', 'B', 'accepted');
  perform t.as_user('A');
  perform t.ok((select seq from public.dm_share(t.u('B'), 'tool_artifact', 'a5555555-0000-4000-8000-000000000005')) is not null, '5 kết bạn lại: share được');
  perform t.reset();
end $$;

-- ── 6. Giới hạn tốc độ áp dụng cho share (chung 30 tin/phút/hội thoại với text) ──
do $$ declare i int; c uuid; e text; begin
  select id into c from public.dm_conversations limit 1;
  delete from public.dm_messages;
  update public.dm_conversations set last_seq = 0;
  update public.dm_participants set last_read_seq = 0;
  perform t.as_user('A');
  for i in 1..15 loop perform public.dm_share(t.u('B'), 'tool_artifact', 'a5555555-0000-4000-8000-000000000005'); end loop;
  for i in 1..15 loop perform public.dm_send(c, 'x'); end loop;
  e := t.err($q$select * from public.dm_share(t.u('B'), 'tool_artifact', 'a5555555-0000-4000-8000-000000000005')$q$);
  perform t.ok(e like '54000:%', '6 tin thứ 31 trong 1 phút (15 share + 15 text) bị chặn khi SHARE (54000)');
  perform t.ok(t.err(format($q$select public.dm_send(%L, 'y')$q$, c)) like '54000:%', '6 …và khi gửi text (chung một bộ đếm)');
  perform t.reset();
  perform t.ok((select count(*) from public.dm_messages) = 30 and (select max(seq) from public.dm_messages) = 30 and (select count(distinct seq) from public.dm_messages) = 30, '6 đúng 30 tin, seq liên tục 1..30 (không lỗ, không trùng)');
end $$;

-- ── 7. Ràng buộc DB: cặp ref null/non-null, allowlist, định dạng ──
do $$ declare c uuid; begin
  select id into c from public.dm_conversations limit 1;
  perform t.fails(format($q$insert into public.dm_messages (conversation_id, seq, sender_id, body, ref_type) values (%L, 100, t.u('A'), 'x', 'tool_artifact')$q$, c), '7 ref_type không có ref_key bị CHECK chặn');
  perform t.fails(format($q$insert into public.dm_messages (conversation_id, seq, sender_id, body, ref_key) values (%L, 101, t.u('A'), 'x', 'a1111111-0000-4000-8000-000000000001')$q$, c), '7 ref_key không có ref_type bị CHECK chặn');
  perform t.fails(format($q$insert into public.dm_messages (conversation_id, seq, sender_id, body, ref_type, ref_key) values (%L, 102, t.u('A'), 'x', 'post', 'a1111111-0000-4000-8000-000000000001')$q$, c), '7 ref_type ngoài allowlist bị CHECK chặn');
  perform t.fails(format($q$insert into public.dm_messages (conversation_id, seq, sender_id, body, ref_type, ref_key) values (%L, 103, t.u('A'), 'x', 'tool_artifact', 'khong-phai-uuid')$q$, c), '7 ref_key sai định dạng bị CHECK chặn');
end $$;
