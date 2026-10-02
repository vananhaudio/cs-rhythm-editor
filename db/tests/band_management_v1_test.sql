-- ═══ TEST Band — Quản lý V1 — cluster PostgreSQL TẠM (scripts/test-band-recruit-db.sh) ═══
-- Nạp SAU band_recruit_v1_test.sql (dùng lại schema t + dữ liệu của nó: Lá Mùa Thu có đơn, một đơn đã ACCEPTED
-- từ thời V1 chưa có thành viên; Band 2 "acoustic-chu-nhat" Leader = B) rồi band_management_v1_setup.sql.
-- A, B, C = học viên (B = leader_user_id Band 2) · T = thầy · khách = anon
-- t.app_id / t.mem là SECURITY DEFINER (tra id cho test) — không cấp quyền gì cho hàm band_* đang kiểm.
\set ON_ERROR_STOP on
\o /dev/null
begin;
create function t.app_id(p_phone text) returns uuid language sql security definer as $$
  select id from public.band_applications where phone = p_phone order by created_at desc limit 1 $$;
create function t.mem(p_phone text) returns public.band_members language sql security definer as $$
  select * from public.band_members where phone = p_phone $$;
create function t.ov(slug text default 'la-mua-thu') returns jsonb language sql as $$ select public.band_admin_overview(slug) $$;
grant execute on all functions in schema t to anon, authenticated;

-- ── 0) Dữ liệu V1 còn nguyên sau migration ────────────────────────────────────────
select t.ok((select count(*) from public.band_applications) = 7, 'migration không làm mất đơn (7 đơn V1 còn nguyên)');
select t.ok((select status from public.band_applications where phone = '0912345678') = 'ACCEPTED'
  and not exists (select 1 from public.band_members), 'đơn ACCEPTED thời V1 còn nguyên, chưa có thành viên');
select t.ok((select jsonb_array_length(position_catalog) || '/' || jsonb_array_length(role_catalog) from public.bands where slug = 'la-mua-thu') = '7/6',
  'Band hiện có tự có danh mục chuẩn: 7 vị trí / 6 vai trò (DEFAULT, không seed riêng)');

-- ── 1) Khách / học viên: không chạm dữ liệu nội bộ ─────────────────────────────────
select t.as_anon();
select t.fails($q$select public.band_admin_overview('la-mua-thu')$q$, 'khách KHÔNG xem bàn điều hành', 'permission denied');
select t.fails($q$select public.band_admin_accept(gen_random_uuid())$q$, 'khách KHÔNG chấp nhận đơn', 'permission denied');
select t.fails($q$select public.band_admin_add_member('la-mua-thu', '{}')$q$, 'khách KHÔNG thêm thành viên', 'permission denied');
select t.fails($q$select public.band_admin_update_member(gen_random_uuid(), '{}')$q$, 'khách KHÔNG sửa thành viên', 'permission denied');
select t.fails($q$select public.band_admin_set_role(gen_random_uuid(), 'membership', true)$q$, 'khách KHÔNG gán vai trò', 'permission denied');
select t.fails('select * from public.band_members', 'khách KHÔNG đọc bảng thành viên', 'permission denied');
select t.fails('select * from public.band_member_roles', 'khách KHÔNG đọc bảng vai trò', 'permission denied');
select t.fails($q$select public.band_positions_from(gen_random_uuid(), '[]')$q$, 'khách KHÔNG gọi hàm nội bộ', 'permission denied');
select t.ok(public.band_recruitment_public('la-mua-thu')::text !~ 'catalog|members|role', 'landing công khai không lộ thành viên/vai trò');
select t.as_user('A');
select t.fails($q$select public.band_admin_overview('la-mua-thu')$q$, 'học viên KHÔNG xem bàn điều hành', 'Không có quyền');
select t.fails($q$select public.band_admin_accept(t.app_id('0912345678'))$q$, 'học viên KHÔNG chấp nhận đơn', 'Không có quyền');
select t.fails($q$insert into public.band_members (band_id, full_name) select id, 'Lén' from public.bands limit 1$q$, 'học viên KHÔNG ghi thẳng bảng', 'permission denied');
select t.fails($q$select public.band_can_manage(gen_random_uuid())$q$, 'band_can_manage không gọi trực tiếp được', 'permission denied');

-- ── 2) Thầy: ACCEPTED → đúng 1 thành viên, kế thừa vị trí, idempotent ──────────────
select t.as_user('T');
select t.ok(jsonb_array_length(t.ov()->'members') = 0 and (t.ov()->'counts'->>'members')::int = 0, 'bàn điều hành: 0 thành viên');
select t.ok(t.ov()->'band'->>'leader_name' = 'Thầy Văn Anh' and t.ov()->'band'->>'schedule_text' = '19:00 Thứ Tư hàng tuần'
  and t.ov()->'band' ? 'music_style', 'đầu trang: tên, Leader, lịch, gu từ dữ liệu Band');
select t.ok((public.band_admin_accept(t.app_id('0912345678'))->>'created')::boolean, 'đơn ACCEPTED thời V1 → Chấp nhận lại tạo thành viên');
select t.ok(public.band_admin_accept(t.app_id('0912345678'))->>'created' = 'false', 'bấm lại → created=false');
select t.ok(public.band_admin_set_status(t.app_id('0912345678'), 'ACCEPTED')->>'created' = 'false', 'set_status ACCEPTED lần nữa → không tạo thêm');
select t.reset();
select t.ok((select count(*) from public.band_members where phone = '0912345678') = 1, 'retry ACCEPTED ×3 → đúng 1 thành viên');
select t.ok((t.mem('0912345678')).positions = '{vocal}' and (t.mem('0912345678')).status = 'ACTIVE'
  and (t.mem('0912345678')).application_id = t.app_id('0912345678') and (t.mem('0912345678')).full_name = 'Nguyễn Văn Khách',
  'thành viên kế thừa vị trí ứng tuyển (vocal), họ tên, SĐT, application_id; ACTIVE');

-- Đơn mới NEW → set_status ACCEPTED (nút trạng thái) cũng tạo thành viên — không bao giờ "chỉ đổi chữ"
select t.as_anon();
select t.ok(public.band_apply(t.rid(), t.app('{"phone": "0970000001", "full_name": "Hà Saxo", "position_key": "other", "position_other": "Saxophone"}')) = '{"ok": true}', 'ứng viên vị trí Khác: Saxophone');
select t.as_user('T');
select t.ok(public.band_admin_set_status(t.app_id('0970000001'), 'REVIEWING')->>'status' = 'REVIEWING', 'NEW → REVIEWING không tạo thành viên');
select t.reset();
select t.ok(t.mem('0970000001') is null or (t.mem('0970000001')).id is null, 'REVIEWING: chưa là thành viên');
select t.as_user('T');
select t.ok(public.band_admin_set_status(t.app_id('0970000001'), 'ACCEPTED')->>'member_id' is not null, 'REVIEWING → ACCEPTED qua set_status → có member_id');
select t.reset();
select t.ok((t.mem('0970000001')).positions = '{other}' and (t.mem('0970000001')).position_note = 'Saxophone'
  and (select status from public.band_applications where id = t.app_id('0970000001')) = 'ACCEPTED', 'kế thừa "Khác" + mô tả Saxophone; đơn = ACCEPTED');

-- ── 3) Leader sửa vị trí: nhiều vị trí, key ngoài danh mục bị chặn, retry không ghi đè ──
select t.as_user('T');
select t.ok(public.band_admin_update_member((t.mem('0912345678')).id, '{"positions": ["vocal", "guitar_dem", "vocal"]}') = '{"ok": true}', 'sửa vị trí: Vocal + Guitar đệm');
select t.ok(public.band_admin_update_member((t.mem('0912345678')).id, '{"positions": ["kèn"]}')->>'code' = 'positions', 'vị trí ngoài danh mục → chặn');
select t.ok(public.band_admin_update_member((t.mem('0912345678')).id, '{"status": "DONE"}')->>'code' = 'status', 'trạng thái lạ → chặn');
select t.ok(public.band_admin_accept(t.app_id('0912345678'))->>'created' = 'false', 'bấm Chấp nhận lại sau khi sửa');
select t.reset();
select t.ok((t.mem('0912345678')).positions = '{guitar_dem,vocal}', 'một người nhiều vị trí; retry Chấp nhận KHÔNG ghi đè vị trí Leader đã sửa');
select t.fails($q$update public.band_members set positions = '{tuba}' where phone = '0912345678'$q$, 'trigger: vị trí mới ngoài danh mục bị chặn cả khi ghi thẳng', 'không có trong danh mục');

-- ── 4) Vai trò vận hành (Bộ máy) ─────────────────────────────────────────────────
select t.as_user('T');
select t.ok(public.band_admin_set_role((t.mem('0912345678')).id, 'band_leader', true) = '{"ok": true}', 'gán Band Leader');
select t.ok(public.band_admin_set_role((t.mem('0912345678')).id, 'band_leader', true) = '{"ok": true}', 'gán lại cùng vai trò → ok, không trùng');
select t.ok(public.band_admin_set_role((t.mem('0970000001')).id, 'band_leader', true)->>'code' = 'full', 'Band Leader max 1 → người thứ 2 bị chặn');
select t.ok(public.band_admin_set_role((t.mem('0912345678')).id, 'membership', true) = '{"ok": true}'
  and public.band_admin_set_role((t.mem('0970000001')).id, 'membership', true) = '{"ok": true}', 'Membership: 2 người cùng giữ (không giới hạn)');
select t.ok(public.band_admin_set_role((t.mem('0912345678')).id, 'chu_quy', true)->>'code' = 'role', 'vai trò ngoài danh mục → chặn');
select t.ok((select jsonb_agg(x order by x) from jsonb_array_elements_text((select m->'roles' from jsonb_array_elements(t.ov()->'members') m where m->>'phone' = '0912345678')) x)
  = '["band_leader", "membership"]', 'một người nhiều vai trò (overview)');
select t.ok(public.band_admin_set_role((t.mem('0970000001')).id, 'membership', false) = '{"ok": true}', 'bỏ vai trò');
select t.reset();
select t.ok((select count(*) from public.band_member_roles where role_key = 'membership') = 1
  and (select count(*) from public.band_member_roles) = 2, 'sau khi bỏ: còn đúng 2 vai trò');
select t.fails($q$insert into public.band_member_roles (band_id, member_id, role_key) select id, (select id from public.band_members where phone = '0912345678'), 'media' from public.bands where slug = 'acoustic-chu-nhat'$q$,
  'trigger: gán vai trò Band A cho thành viên Band B bị chặn', 'không thuộc Band');
select t.fails($q$insert into public.band_member_roles (band_id, member_id, role_key) select band_id, id, 'band_leader' from public.band_members where phone = '0970000001'$q$,
  'trigger: vượt max bị chặn cả khi ghi thẳng', 'đã đủ');

-- ── 5) Một người một hồ sơ: thêm tay trước, có tài khoản sau → gắn vào hồ sơ cũ ──────
select t.as_user('T');
select t.ok(public.band_admin_add_member('la-mua-thu', '{"full_name": "An (sáng lập)", "phone": "+84 933 333 333", "positions": ["bass"]}')->>'ok' = 'true', 'thêm tay thành viên chưa có tài khoản');
select t.ok(public.band_admin_add_member('la-mua-thu', '{"full_name": "Trùng", "phone": "0933333333"}')->>'code' = 'duplicate', 'thêm tay trùng SĐT → báo đã là thành viên');
select t.ok(public.band_admin_add_member('la-mua-thu', '{"full_name": "Không SĐT", "positions": []}')->>'ok' = 'true', 'thêm tay không cần SĐT');
select t.ok(public.band_admin_add_member('la-mua-thu', '{"full_name": "X", "positions": ["sax"]}')->>'code' = 'full_name'
  and public.band_admin_add_member('la-mua-thu', '{"full_name": "Xuân", "positions": ["sax"]}')->>'code' = 'positions', 'thêm tay: validate tên + vị trí');
select t.reset();
select t.ok((t.mem('0933333333')).user_id is null, 'hồ sơ thêm tay: chưa có tài khoản');
select t.as_user('T');
select t.ok(public.band_admin_accept(t.app_id('0933333333'))->>'created' = 'false', 'đơn của A (đã đăng nhập, cùng SĐT) → khớp hồ sơ cũ, không tạo mới');
select t.reset();
select t.ok((select count(*) from public.band_members where phone = '0933333333') = 1 and (t.mem('0933333333')).user_id = t.u('A')
  and (t.mem('0933333333')).application_id = t.app_id('0933333333') and (t.mem('0933333333')).positions = '{bass,vocal}',
  'resolve: gắn user_id của A + application vào hồ sơ cũ, cộng vị trí ứng tuyển');

-- ── 6) Band Leader theo vai trò: quản trị đúng Band mình, mất quyền khi tạm nghỉ ─────
select t.as_user('C');
select t.ok(public.band_apply(t.rid(), t.app('{"phone": "0970000003", "full_name": "Cường"}')) = '{"ok": true}', 'C (có tài khoản) ứng tuyển');
select t.fails($q$select public.band_admin_overview('la-mua-thu')$q$, 'C trước khi là Leader: không quản trị', 'Không có quyền');
select t.as_user('T');
select t.ok(public.band_admin_accept(t.app_id('0970000003'))->>'created' = 'true', 'Thầy chấp nhận C');
select t.ok(public.band_admin_set_role((t.mem('0912345678')).id, 'band_leader', false) = '{"ok": true}'
  and public.band_admin_set_role((t.mem('0970000003')).id, 'band_leader', true) = '{"ok": true}', 'chuyển Band Leader sang C');
select t.as_user('C');
select t.ok(t.ov()->'band'->>'slug' = 'la-mua-thu', 'C (Band Leader) mở được bàn điều hành Lá Mùa Thu');
select t.ok((select count(*) from jsonb_array_elements(public.band_admin_bands())) = 1, 'C thấy đúng 1 Band trong danh sách');
select t.ok(public.band_admin_set_role((t.mem('0970000001')).id, 'media', true) = '{"ok": true}', 'C gán vai trò trong Band mình');
select t.fails($q$select public.band_admin_overview('acoustic-chu-nhat')$q$, 'C KHÔNG quản trị Band 2', 'Không có quyền');
select t.as_user('T');
select t.ok(public.band_admin_update_member((t.mem('0970000003')).id, '{"status": "PAUSED"}') = '{"ok": true}', 'C tạm nghỉ');
select t.as_user('C');
select t.fails($q$select public.band_admin_overview('la-mua-thu')$q$, 'Leader tạm nghỉ → mất quyền quản trị', 'Không có quyền');
select t.as_user('T');
select t.ok(public.band_admin_update_member((t.mem('0970000003')).id, '{"status": "ACTIVE"}') = '{"ok": true}', 'C hoạt động lại');

-- ── 7) Rời Band → thôi vai trò; số liệu đầu trang ─────────────────────────────────
select t.ok(public.band_admin_update_member((t.mem('0970000001')).id, '{"status": "LEFT"}') = '{"ok": true}', 'Hà rời Band');
select t.ok(public.band_admin_set_role((t.mem('0970000001')).id, 'media', true)->>'code' = 'left', 'người đã rời không nhận vai trò');
select t.reset();
select t.ok(not exists (select 1 from public.band_member_roles r join public.band_members m on m.id = r.member_id where m.phone = '0970000001')
  and (t.mem('0970000001')).left_at is not null, 'rời Band → mọi vai trò bị gỡ, có left_at');
select t.as_user('T');
select t.ok((t.ov()->'counts'->>'members')::int = 4 and (t.ov()->'counts'->>'active')::int = 4
  and jsonb_array_length(t.ov()->'members') = 5, 'đếm thành viên không tính người đã rời (4/5 hồ sơ)');
select t.ok((t.ov()->'counts'->>'new_applications')::int = (select count(*) from jsonb_array_elements(public.band_admin_applications('la-mua-thu')->'applications') x
  where x->>'status' = 'NEW'), 'số đơn mới đúng');
select t.ok(t.ov()->'members'->-1->>'status' = 'LEFT', 'người đã rời xếp cuối danh sách');
select t.ok(not (t.ov()::text ~ 'user_id'), 'overview không lộ user_id');

-- ── 8) Band thứ 2: cùng hệ thống, danh mục riêng (Saxophone/Violin/Cajon) chỉ bằng dữ liệu ─
select t.as_user('B');
select t.ok(t.ov('acoustic-chu-nhat')->'band'->>'name' = 'Acoustic Chủ Nhật', 'Leader B mở bàn điều hành Band 2');
select t.ok(public.band_admin_accept(t.app_id('0955555555'))->>'created' = 'true', 'Leader B chấp nhận ứng viên Band 2');
select t.reset();
select t.ok((t.mem('0955555555')).positions = '{}' and (t.mem('0955555555')).position_note = 'Ukulele',
  'vị trí tuyển không có trong danh mục Band → giữ thành mô tả "Ukulele", không mất');
update public.bands set
  position_catalog = '[{"key": "vocal", "label": "Vocal"}, {"key": "ukulele", "label": "Ukulele"}, {"key": "cajon", "label": "Cajon"},
                       {"key": "saxophone", "label": "Saxophone"}, {"key": "violin", "label": "Violin"}]',
  role_catalog = '[{"key": "band_leader", "label": "Band Leader", "max": 1, "manage": true}, {"key": "sound", "label": "Âm thanh", "max": 2}]'
where slug = 'acoustic-chu-nhat';
select t.as_user('B');
select t.ok(public.band_admin_update_member((t.mem('0955555555')).id, '{"positions": ["ukulele", "saxophone", "violin"], "position_note": null}') = '{"ok": true}',
  'Band 2: Ukulele + Saxophone + Violin — chỉ đổi dữ liệu danh mục, không đổi schema/code');
select t.ok(public.band_admin_set_role((t.mem('0955555555')).id, 'sound', true) = '{"ok": true}', 'Band 2: vai trò riêng "Âm thanh"');
select t.ok(public.band_admin_set_role((t.mem('0955555555')).id, 'membership', true)->>'code' = 'role', 'Band 2: vai trò không có trong Bộ máy Band 2 → chặn');
select t.ok(jsonb_array_length(t.ov('acoustic-chu-nhat')->'role_catalog') = 2 and jsonb_array_length(t.ov('acoustic-chu-nhat')->'members') = 1,
  'Band 2: Bộ máy 2 vai trò, 1 thành viên — tách hẳn Lá Mùa Thu');
-- Leader Band 2 KHÔNG chạm Lá Mùa Thu
select t.fails($q$select public.band_admin_overview('la-mua-thu')$q$, 'Leader B KHÔNG xem Band 1', 'Không có quyền');
select t.fails($q$select public.band_admin_accept(t.app_id('0944444444'))$q$, 'Leader B KHÔNG chấp nhận đơn Band 1', 'Không có quyền');
select t.fails($q$select public.band_admin_update_member((t.mem('0912345678')).id, '{"status": "LEFT"}')$q$, 'Leader B KHÔNG sửa thành viên Band 1', 'Không có quyền');
select t.fails($q$select public.band_admin_set_role((t.mem('0912345678')).id, 'media', true)$q$, 'Leader B KHÔNG gán vai trò Band 1', 'Không có quyền');
select t.fails($q$select public.band_admin_add_member('la-mua-thu', '{"full_name": "Lén"}')$q$, 'Leader B KHÔNG thêm thành viên Band 1', 'Không có quyền');
select t.as_user('T');
select t.ok(t.ov('acoustic-chu-nhat') is not null and t.ov('la-mua-thu') is not null, 'Thầy quản trị được cả 2 Band');
select t.reset();
select t.ok((t.mem('0912345678')).status = 'ACTIVE', 'thành viên Band 1 không bị Leader B đụng');
-- Gỡ vị trí khỏi danh mục sau này: hồ sơ cũ vẫn giữ, vẫn đổi trạng thái được
update public.bands set position_catalog = '[{"key": "vocal", "label": "Vocal"}]' where slug = 'acoustic-chu-nhat';
select t.as_user('B');
select t.ok(public.band_admin_update_member((t.mem('0955555555')).id, '{"status": "PAUSED"}') = '{"ok": true}'
  and public.band_admin_update_member((t.mem('0955555555')).id, '{"positions": ["ukulele", "vocal"]}') = '{"ok": true}',
  'danh mục đổi sau: vị trí cũ vẫn giữ được, sửa hồ sơ không lỗi');
select t.reset();
drop function t.mem(text);   -- phụ thuộc kiểu band_members — gỡ để rollback được kiểm thật
do $$ begin raise notice 'ALL PASS'; end $$;
commit;
