-- ═══ TEST Band — Tuyển thành viên V1 — cluster PostgreSQL TẠM (scripts/test-band-recruit-db.sh) ═══
-- Nạp SAU fixture + community_setup + band_recruit_v1_setup + band_la_mua_thu_seed.
-- A, B, C = học viên · T = thầy · khách = anon
\set ON_ERROR_STOP on
\o /dev/null
-- MỘT transaction: set_config(..., true) của t.as_* giữ qua các câu lệnh
begin;
do $$ begin
  if exists (select 1 from auth.users where email not like '%@test.local') then raise exception 'DỪNG: có user thật'; end if;
end $$;

create schema t;
grant usage on schema t to anon, authenticated;
create function t.u(k text) returns uuid language sql immutable as $$
  select case k when 'A' then 'aaaaaaaa-0000-4000-8000-00000000000a'::uuid when 'B' then 'bbbbbbbb-0000-4000-8000-00000000000b'::uuid
                when 'C' then 'cccccccc-0000-4000-8000-00000000000c'::uuid when 'T' then 'dddddddd-0000-4000-8000-00000000000d'::uuid end $$;
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
-- Đơn hợp lệ cho Lá Mùa Thu (ghi đè từng trường bằng ||)
create function t.app(extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('full_name', 'Nguyễn Văn Khách', 'phone', '+84 912 345 678', 'position_key', 'vocal',
    'answers', jsonb_build_object('level', 'basic', 'taste_fit', 'very', 'schedule', 'yes'),
    'reason', 'Em mê tình ca', 'rules_accepted', true, 'client_key', 'key-' || md5(random()::text),
    'rule_version_id', (public.band_recruitment_public('la-mua-thu')->'rules'->>'id')) || extra $$;
create function t.rid(slug text default 'la-mua-thu') returns uuid language sql as $$
  select (public.band_recruitment_public(slug)->'recruitment'->>'id')::uuid $$;
grant execute on all functions in schema t to anon, authenticated;

-- ── 1) Landing công khai (khách) ──────────────────────────────────────────────
select t.as_anon();
select t.ok(public.band_recruitment_public('la-mua-thu')->'band'->>'name' = 'Lá Mùa Thu', 'khách đọc được hồ sơ Band');
select t.ok(public.band_recruitment_public(' LA-MUA-THU ')->'band'->>'slug' = 'la-mua-thu', 'slug không phân biệt hoa/thường, bỏ khoảng trắng');
select t.ok(jsonb_array_length(public.band_recruitment_public('la-mua-thu')->'recruitment'->'positions') = 7, '7 vị trí tuyển từ config');
select t.ok(jsonb_array_length(public.band_recruitment_public('la-mua-thu')->'recruitment'->'questions') = 3, '3 câu hỏi từ config');
select t.ok((public.band_recruitment_public('la-mua-thu')->'rules'->>'version')::int = 1
  and jsonb_array_length(public.band_recruitment_public('la-mua-thu')->'rules'->'items') = 5, 'Rule V1: 5 điều');
select t.ok(public.band_recruitment_public('khong-co') is null, 'slug lạ → null');
select t.ok(public.band_recruitment_public('la-mua-thu')::text !~ 'phone|full_name|leader_user_id', 'landing không lộ dữ liệu ứng viên / user id Leader');
select t.fails('select * from public.bands', 'khách KHÔNG đọc thẳng bảng bands', 'permission denied');
select t.fails('select * from public.band_applications', 'khách KHÔNG đọc bảng đơn', 'permission denied');
select t.fails($q$insert into public.band_applications (band_id) values (gen_random_uuid())$q$, 'khách KHÔNG INSERT thẳng bảng đơn', 'permission denied');
select t.fails('select public.band_admin_bands()', 'khách KHÔNG gọi được admin', 'permission denied');
select t.fails($q$select public.band_admin_applications('la-mua-thu')$q$, 'khách KHÔNG xem đơn', 'permission denied');

-- ── 2) Gửi đơn — khách, không đăng nhập ───────────────────────────────────────
select t.ok(public.band_apply(t.rid(), t.app('{"client_key": "khach-0001"}')) = '{"ok": true}', 'khách gửi đơn hợp lệ → ok');
select t.ok(public.band_apply(t.rid(), t.app('{"client_key": "khach-0001"}')) = '{"ok": true}', 'bấm đúp cùng client_key → ok, không tạo đơn mới');
select t.ok(public.band_apply(t.rid(), t.app('{"phone": "0912345678"}'))->>'duplicate' = 'true', 'cùng SĐT (dạng khác) trong đợt → duplicate, không tạo đơn mới');
select t.ok(public.band_apply(t.rid(), t.app('{"rules_accepted": false}'))->>'code' = 'rules', 'chưa tick Rule → chặn');
select t.ok(public.band_apply(t.rid(), t.app('{"rules_accepted": "true"}'))->>'code' = 'rules', 'rules_accepted phải là boolean true');
select t.ok(public.band_apply(t.rid(), t.app('{"rule_version_id": null}'))->>'code' = 'rule_changed', 'không gửi rule_version_id → chặn');
select t.ok(public.band_apply(t.rid(), t.app('{"reason": "   "}'))->>'code' = 'reason', 'lý do bắt buộc');
select t.ok(public.band_apply(t.rid(), t.app(jsonb_build_object('reason', repeat('x', 2001))))->>'code' = 'reason', 'lý do tối đa 2000');
select t.ok(public.band_apply(t.rid(), t.app('{"full_name": "A"}'))->>'code' = 'full_name', 'họ tên bắt buộc');
select t.ok(public.band_apply(t.rid(), t.app('{"phone": "12345"}'))->>'code' = 'phone', 'SĐT sai → chặn');
select t.ok(public.band_apply(t.rid(), t.app('{"position_key": "kèn"}'))->>'code' = 'position_key', 'vị trí ngoài config → chặn');
select t.ok(public.band_apply(t.rid(), t.app('{"answers": {"level": "basic", "taste_fit": "very"}}'))->>'code' = 'schedule', 'câu hỏi bắt buộc chưa trả lời → chặn');
select t.ok(public.band_apply(t.rid(), t.app('{"answers": {"level": "pro", "taste_fit": "very", "schedule": "yes"}}'))->>'code' = 'level', 'giá trị ngoài option → chặn');
select t.ok(public.band_apply(t.rid(), t.app('{"client_key": "x"}'))->>'code' = 'client_key', 'client_key quá ngắn → chặn');
select t.ok(public.band_apply(t.rid(), t.app('{"website": "http://spam", "phone": "0900000001"}')) = '{"ok": true}', 'bẫy bot: trả ok giả');
select t.ok(public.band_apply(gen_random_uuid(), t.app())->>'code' = 'closed', 'đợt tuyển không tồn tại → closed');
select t.ok(public.band_apply(t.rid(), t.app('{"phone": "0900000002", "position_key": "other", "position_other": "Sáo trúc", "answers": {"level": "beginner", "taste_fit": "fair", "schedule": "unsure", "la": "rác"}}'))
  = '{"ok": true}', 'vị trí Khác + mô tả; câu trả lời ngoài config bị loại');

select t.reset();
select t.ok((select count(*) from public.band_applications) = 2, 'chỉ 2 đơn thật được ghi (đúp/duplicate/bot/lỗi không ghi)');
select t.ok((select phone from public.band_applications where client_key = 'khach-0001') = '0912345678', '+84 912 345 678 → 0912345678');
select t.ok((select applicant_user_id is null and status = 'NEW' and rule_version = 1 and rules_accepted_at is not null
               and rule_version_id = (select id from public.band_rule_versions where version = 1)
             from public.band_applications where client_key = 'khach-0001'), 'đơn khách: không user, NEW, Rule v1 + thời điểm chấp thuận');
select t.ok((select answers = '{"level": "beginner", "taste_fit": "fair", "schedule": "unsure"}' and position_other = 'Sáo trúc'
             from public.band_applications where phone = '0900000002'), 'answers chỉ giữ key có trong config');

-- ── 3) Học viên đã đăng nhập ─────────────────────────────────────────────────
select t.as_user('A');
select t.ok(public.band_apply(t.rid(), t.app('{"phone": "0933333333", "full_name": "An"}')) = '{"ok": true}', 'học viên A gửi đơn');
select t.ok(public.band_apply(t.rid(), t.app('{"phone": "0933333334", "applicant_user_id": "bbbbbbbb-0000-4000-8000-00000000000b"}')) = '{"ok": true}', 'A gửi kèm applicant_user_id giả');
select t.ok(public.band_admin_bands() = '[]', 'học viên: không quản lý Band nào');
select t.fails($q$select public.band_admin_applications('la-mua-thu')$q$, 'học viên KHÔNG xem đơn', 'Không có quyền');
select t.fails($q$select public.band_admin_set_status((select gen_random_uuid()), 'ACCEPTED')$q$, 'học viên KHÔNG duyệt', 'Không có quyền');
select t.fails('select * from public.band_applications', 'học viên KHÔNG đọc bảng đơn', 'permission denied');
select t.reset();
select t.ok((select count(*) from public.band_applications where applicant_user_id = t.u('A')) = 2, 'server gắn applicant_user_id = auth.uid() (bỏ qua id client gửi)');

-- ── 4) Thầy: danh sách + duyệt ───────────────────────────────────────────────
select t.as_user('T');
select t.ok(public.band_admin_bands()->0->>'slug' = 'la-mua-thu' and (public.band_admin_bands()->0->>'total')::int = 4
  and (public.band_admin_bands()->0->>'new')::int = 4, 'Thầy thấy Lá Mùa Thu: 4 đơn, 4 NEW');
select t.ok(jsonb_array_length(public.band_admin_applications('la-mua-thu')->'applications') = 4, 'Thầy xem 4 đơn');
select t.ok((public.band_admin_applications('la-mua-thu')->'applications'->-1) ?& array['full_name', 'phone', 'position_key', 'answers', 'reason',
  'rule_version', 'rules_accepted_at', 'status', 'created_at'], 'đơn có đủ trường Admin cần');
select t.ok(jsonb_array_length(public.band_admin_applications('la-mua-thu')->'recruitments'->0->'questions') = 3, 'kèm config để dịch nhãn');
select t.ok(public.band_admin_set_status((select (x->>'id')::uuid from jsonb_array_elements(public.band_admin_applications('la-mua-thu')->'applications') x where x->>'phone' = '0912345678'), 'REVIEWING')->>'status' = 'REVIEWING', 'NEW → REVIEWING');
select t.ok(public.band_admin_set_status((select (x->>'id')::uuid from jsonb_array_elements(public.band_admin_applications('la-mua-thu')->'applications') x where x->>'phone' = '0912345678'), 'ACCEPTED')->>'status' = 'ACCEPTED', 'REVIEWING → ACCEPTED');
select t.fails($q$select public.band_admin_set_status((select (x->>'id')::uuid from jsonb_array_elements(public.band_admin_applications('la-mua-thu')->'applications') x limit 1), 'DONE')$q$, 'trạng thái lạ → chặn', 'không hợp lệ');
select t.reset();
select t.ok((select status = 'ACCEPTED' and status_changed_by = t.u('T') and status_changed_at is not null from public.band_applications where phone = '0912345678'), 'lưu người + thời điểm đổi trạng thái');
-- đơn bị từ chối → SĐT đó được gửi lại
update public.band_applications set status = 'REJECTED' where phone = '0900000002';
select t.as_anon();
select t.ok(public.band_apply(t.rid(), t.app('{"phone": "0900000002"}')) = '{"ok": true}' , 'đơn cũ REJECTED → gửi lại được');
select t.reset();
select t.ok((select count(*) from public.band_applications where phone = '0900000002') = 2, 'gửi lại tạo đơn mới');

-- ── 5) Rule versioning ───────────────────────────────────────────────────────
select t.fails($q$update public.band_rule_versions set items = '["sửa lén"]'$q$, 'Rule đã phát hành KHÔNG sửa được', 'bất biến');
select t.fails('delete from public.band_rule_versions', 'Rule đã phát hành KHÔNG xoá được', 'bất biến');
insert into public.band_rule_versions (band_id, version, items)
  select id, 2, '["Điều 1 mới", "Điều 2 mới", "Điều 3 mới"]' from public.bands where slug = 'la-mua-thu';
update public.band_recruitments set rule_version_id = (select id from public.band_rule_versions where version = 2) where status = 'open';
select t.as_anon();
select t.ok(public.band_recruitment_public('la-mua-thu')->'rules'->>'version' = '2', 'landing hiện Rule v2');
select t.ok(public.band_apply(t.rid(), t.app('{"phone": "0944444444"}' ::jsonb
  || jsonb_build_object('rule_version_id', (select null::text)))) ->>'code' = 'rule_changed', 'không có rule id → rule_changed');
select t.reset();
select t.ok(public.band_apply(t.rid(), t.app('{"phone": "0944444444"}'::jsonb
  || jsonb_build_object('rule_version_id', (select id from public.band_rule_versions where version = 1))))->>'code' = 'rule_changed',
  'form cũ (đã đọc Rule v1) gửi sau khi Rule đổi → rule_changed, buộc đọc lại');
select t.as_anon();
select t.ok(public.band_apply(t.rid(), t.app('{"phone": "0944444444"}')) = '{"ok": true}', 'gửi với Rule v2');
select t.reset();
select t.ok((select rule_version from public.band_applications where phone = '0944444444') = 2, 'đơn mới lưu rule_version 2');
select t.ok((select count(*) from public.band_applications where rule_version = 1) = 5, 'đơn cũ vẫn giữ Rule v1');

-- ── 6) REUSABILITY: Band thứ 2 = CHỈ dữ liệu (không code) ────────────────────
insert into public.bands (slug, name, leader_name, leader_user_id, music_style, schedule_text, reference_songs)
  values ('acoustic-chu-nhat', 'Acoustic Chủ Nhật', 'Bình', t.u('B'), 'Acoustic pop', '9:00 Chủ Nhật', '[{"title": "Ngày mai em đi"}]');
insert into public.band_rule_versions (band_id, version, items)
  select id, 1, '["Đến đúng giờ."]' from public.bands where slug = 'acoustic-chu-nhat';
insert into public.band_recruitments (band_id, positions, questions, reason_label, rule_version_id)
  select b.id, '[{"key": "cajon", "label": "Cajon"}, {"key": "ukulele", "label": "Ukulele"}]',
    '[{"key": "mic", "label": "Bạn có micro riêng?", "type": "single", "options": [{"value": "y", "label": "Có"}, {"value": "n", "label": "Không"}]}]',
    'Bạn mong gì ở Band?', v.id
  from public.bands b join public.band_rule_versions v on v.band_id = b.id where b.slug = 'acoustic-chu-nhat';
select t.fails($q$insert into public.band_recruitments (band_id, positions, rule_version_id)
  select (select id from public.bands where slug = 'acoustic-chu-nhat'), '[{"key":"x","label":"x"}]',
         (select id from public.band_rule_versions where version = 2)$q$, 'Rule của Band khác → chặn', 'không thuộc Band');
select t.fails($q$insert into public.band_recruitments (band_id, positions, rule_version_id)
  select b.id, '[{"key":"x","label":"x"}]', v.id from public.bands b join public.band_rule_versions v on v.band_id = b.id
  where b.slug = 'acoustic-chu-nhat'$q$, 'mỗi Band chỉ một đợt đang mở', 'band_recruitments_one_open');
select t.as_anon();
select t.ok(public.band_recruitment_public('acoustic-chu-nhat')->'recruitment'->'positions'->0->>'label' = 'Cajon', 'Band 2: config riêng qua cùng RPC');
select t.ok(public.band_apply(t.rid('acoustic-chu-nhat'), jsonb_build_object('full_name', 'Chi', 'phone', '0955555555', 'position_key', 'ukulele',
  'answers', '{"mic": "y"}'::jsonb, 'reason', 'Vui', 'rules_accepted', true, 'client_key', 'band2-0001',
  'rule_version_id', public.band_recruitment_public('acoustic-chu-nhat')->'rules'->>'id')) = '{"ok": true}', 'Band 2: gửi đơn bằng câu hỏi của Band 2');
select t.ok(public.band_apply(t.rid('acoustic-chu-nhat'), jsonb_build_object('full_name', 'Chi', 'phone', '0955555556', 'position_key', 'vocal',
  'answers', '{"mic": "y"}'::jsonb, 'reason', 'Vui', 'rules_accepted', true, 'client_key', 'band2-0002',
  'rule_version_id', public.band_recruitment_public('acoustic-chu-nhat')->'rules'->>'id'))->>'code' = 'position_key', 'Band 2: vị trí của Band 1 không hợp lệ');
select t.as_user('B');
select t.ok(public.band_admin_bands()->0->>'slug' = 'acoustic-chu-nhat' and jsonb_array_length(public.band_admin_bands()) = 1, 'Leader B chỉ quản lý Band của mình');
select t.ok(jsonb_array_length(public.band_admin_applications('acoustic-chu-nhat')->'applications') = 1, 'Leader B xem đơn Band 2');
select t.fails($q$select public.band_admin_applications('la-mua-thu')$q$, 'Leader B KHÔNG xem đơn Band 1', 'Không có quyền');
select t.fails($q$select public.band_admin_set_status((select (x->>'id')::uuid from jsonb_array_elements('[]'::jsonb) x limit 1), 'NEW')$q$, 'id rỗng → chặn', 'Không có quyền');
select t.as_user('T');
select t.ok(jsonb_array_length(public.band_admin_bands()) = 2, 'Thầy quản lý cả 2 Band');
select t.ok(jsonb_array_length(public.band_admin_applications('acoustic-chu-nhat')->'applications') = 1
  and jsonb_array_length(public.band_admin_applications('la-mua-thu')->'applications') = 6, 'đơn tách đúng theo band_id');

-- ── 7) Đóng tuyển / Band nháp ────────────────────────────────────────────────
select t.reset();
update public.band_recruitments set status = 'closed' where band_id = (select id from public.bands where slug = 'acoustic-chu-nhat');
update public.bands set status = 'draft' where slug = 'la-mua-thu';
select t.as_anon();
select t.ok(public.band_recruitment_public('acoustic-chu-nhat')->'recruitment' = 'null'::jsonb
  and public.band_recruitment_public('acoustic-chu-nhat')->'band'->>'name' = 'Acoustic Chủ Nhật', 'đóng tuyển: vẫn xem hồ sơ Band, không có form');
select t.ok(public.band_recruitment_public('la-mua-thu') is null, 'Band nháp: không công khai');
select t.reset();
select t.ok(public.band_apply((select id from public.band_recruitments where band_id = (select id from public.bands where slug = 'la-mua-thu')), t.app('{"phone": "0966666666"}'::jsonb
  || jsonb_build_object('rule_version_id', (select id from public.band_rule_versions where version = 2))))->>'code' = 'closed', 'Band nháp: không nhận đơn');
update public.bands set status = 'active' where slug = 'la-mua-thu';
do $$ begin raise notice 'ALL PASS'; end $$;
commit;
