-- ═══ TEST Band Chat V1.1 — vai trò theo TeamLab (db/band_chat_v1_1_roles_setup.sql) ═══
-- Chạy qua scripts/test-band-chat-v1-db.sh (helper schema t do runner nối vào đầu file; chỉ cluster TẠM).
-- A = Trưởng Band X · B = Phó Band X · D vào X sau · C = thành viên Band Y (không có Trưởng) · T = Thầy ngoài Band · N = ngoài Class
\set ON_ERROR_STOP on
create function t.band(k text) returns uuid language sql immutable as $$
  select case k when 'X' then '11111111-0000-4000-8000-0000000000a1'::uuid
                when 'Y' then '11111111-0000-4000-8000-0000000000a2'::uuid
                when 'W' then '11111111-0000-4000-8000-0000000000a9'::uuid end
$$;
-- vai trò của từng người trong p_band (gọi với danh tính hiện tại), dạng "A:owner,B:admin,…"
create function t.rolemap(p_band uuid) returns text language sql as $$
  select coalesce(string_agg(l, ',' order by l), '') from (
    select case m.user_id when t.u('A') then 'A' when t.u('B') then 'B' when t.u('D') then 'D'
                          when t.u('C') then 'C' when t.u('E') then 'E' else '?' end || ':' || m.group_role l
      from public.bandchat_members(p_band) m) z
$$;
grant execute on all functions in schema t to anon, authenticated;
create function t.admin_flag(k text, p_band uuid) returns boolean language plpgsql security definer as $$
declare r boolean;
begin   -- hàm nội bộ không grant cho client → gọi bằng chủ sở hữu, nhưng auth.uid() vẫn là người k
  perform set_config('request.jwt.claims', json_build_object('sub', t.u(k), 'role', 'authenticated')::text, true);
  select public.bandchat_can_admin(p_band) into r;
  perform set_config('request.jwt.claims', '{}', true);
  return r;
end $$;
grant execute on function t.admin_flag(text, uuid) to authenticated;

-- ── 1. Vai trò đọc từ TeamLab: Trưởng → owner, Phó → admin, còn lại → member ──
do $$ begin
  perform t.reset();
  insert into public.teamlab_band_roles (band_id, project_id, user_id, role) values
    (t.band('X'), '11111111-0000-4000-8000-0000000000b1', t.u('A'), 'leader'),
    (t.band('X'), '11111111-0000-4000-8000-0000000000b1', t.u('B'), 'deputy');
  insert into public.teamlab_band_members (band_id, user_id) values (t.band('X'), t.u('D'));
  perform t.as_user('D');
  perform t.ok(t.rolemap(t.band('X')) = 'A:owner,B:admin,D:member', '1a Trưởng Band = Chủ nhóm, Phó = Quản trị viên, người còn lại = Thành viên ('||t.rolemap(t.band('X'))||')');
  perform t.ok((select array_agg(m.group_role) from public.bandchat_members(t.band('X')) m) = array['owner','admin','member'], '1b thứ tự: chủ nhóm → quản trị viên → thành viên');
  perform t.reset();
end $$;

-- ── 2. Đổi Trưởng/Phó trên TeamLab → vai trò đổi ngay; người cũ mất quyền quản trị ──
do $$ begin
  perform t.ok(t.admin_flag('A', t.band('X')) and t.admin_flag('B', t.band('X')) and not t.admin_flag('D', t.band('X')), '2a trước đổi: A, B quản trị được; D không');
  perform t.reset();
  -- cách TeamLab làm thật: bỏ dòng cũ rồi gán dòng mới (PK band, user, role + một leader/một deputy mỗi Band)
  delete from public.teamlab_band_roles where band_id = t.band('X') and role in ('leader', 'deputy');
  insert into public.teamlab_band_roles (band_id, project_id, user_id, role) values
    (t.band('X'), '11111111-0000-4000-8000-0000000000b1', t.u('B'), 'leader'),
    (t.band('X'), '11111111-0000-4000-8000-0000000000b1', t.u('D'), 'deputy');
  perform t.as_user('A');
  perform t.ok(t.rolemap(t.band('X')) = 'A:member,B:owner,D:admin', '2b sau đổi: A→Thành viên, B→Chủ nhóm, D→Quản trị viên ('||t.rolemap(t.band('X'))||')');
  perform t.reset();
  perform t.ok(not t.admin_flag('A', t.band('X')), '2c A (Trưởng cũ) mất quyền quản trị ngay');
  perform t.ok(t.admin_flag('B', t.band('X')) and t.admin_flag('D', t.band('X')), '2d B, D có quyền quản trị');
end $$;

-- ── 3. Rời/bị gỡ khỏi Band: mất vai trò dù dòng vai trò còn sót; tin cũ giữ nguyên ──
do $$ begin
  perform t.as_user('D'); perform public.bandchat_send(t.band('X'), 'Tin của D');
  perform t.reset();
  delete from public.teamlab_band_members where band_id = t.band('X') and user_id = t.u('D');   -- dòng deputy của D CÒN
  perform t.ok(not t.admin_flag('D', t.band('X')), '3a D rời Band: dòng vai trò còn sót nhưng KHÔNG còn quyền quản trị');
  perform t.as_user('D');
  perform t.ok(t.err($q$select * from public.bandchat_members(t.band('X'))$q$) like 'P0002:%',
               '3b D không còn xem được nhóm/thành viên');
  perform t.reset();
  perform t.as_user('A');
  perform t.ok(t.rolemap(t.band('X')) = 'A:member,B:owner', '3c danh sách không còn D ('||t.rolemap(t.band('X'))||')');
  perform t.ok((select count(*) from public.bandchat_messages(t.band('X')) where body = 'Tin của D') = 1, '3d tin D đã gửi vẫn còn trong lịch sử');
  perform t.reset();
end $$;

-- ── 4. Biên tập âm nhạc / Trưởng Team không sinh quyền quản trị chat ──
do $$ begin
  perform t.reset();
  insert into public.teamlab_band_roles (band_id, project_id, user_id, role) values
    (t.band('X'), '11111111-0000-4000-8000-0000000000b1', t.u('A'), 'music_editor');
  perform t.as_user('A');
  perform t.ok(t.rolemap(t.band('X')) like 'A:member%', '4a A có vai trò Biên tập âm nhạc → vẫn là Thành viên nhóm');
  perform t.reset();
  perform t.ok(not t.admin_flag('A', t.band('X')), '4b Biên tập âm nhạc không có quyền quản trị chat');
end $$;

-- ── 5. Band không có Trưởng: không tự chọn người thay thế ──
do $$ begin
  perform t.as_user('C');
  perform t.ok(t.rolemap(t.band('Y')) = 'C:member' and (select count(*) from public.bandchat_members(t.band('Y')) where group_role in ('owner', 'admin')) = 0,
               '5a Band Y chưa có Trưởng/Phó: chỉ có Thành viên (không ai bị tự gán chủ nhóm)');
  perform t.reset();
  perform t.ok(not t.admin_flag('C', t.band('Y')), '5b C không quản trị được');
end $$;

-- ── 6. Không giả quyền bằng request trực tiếp ──
do $$ begin
  perform t.as_user('A');
  perform t.fails($q$select public.bandchat_group_role(t.band('X'), t.u('A'))$q$, '6a bandchat_group_role là hàm nội bộ');
  perform t.fails($q$select public.bandchat_can_admin(t.band('X'))$q$, '6b bandchat_can_admin là hàm nội bộ');
  perform t.reset();
end $$;

-- ── 7. Người ngoài Band / Thầy / ngoài Class ──
do $$ begin
  perform t.as_user('C');
  perform t.ok(t.err($q$select * from public.bandchat_members(t.band('X'))$q$) <> 'OK', '7b người Band khác KHÔNG xem được thành viên Band X');
  perform t.as_user('T');
  perform t.ok((select count(*) from public.bandchat_members(t.band('X'))) = 2, '7c Thầy ngoài Band xem được danh sách + vai trò (chỉ đọc)');
  perform t.ok(t.err($q$select public.bandchat_send(t.band('X'), 'x')$q$) like '42501:%', '7d Thầy ngoài Band vẫn KHÔNG gửi được');
  perform t.reset();
  perform t.ok(not t.admin_flag('T', t.band('X')), '7e Thầy ngoài Band không có quyền quản trị chat (chỉ đọc)');
  perform t.as_user('N');
  perform t.ok(t.err($q$select * from public.bandchat_members(t.band('X'))$q$) <> 'OK', '7f tài khoản ngoài Class không xem được');
  perform t.reset();
end $$;

-- ── 8. Band mới hiện nhóm khi chưa có tin, không tạo phòng; đổi tên/ảnh phản ánh ngay ──
do $$ declare n0 text; r record; begin
  perform t.reset();
  insert into public.teamlab_bands (id, project_id, name, cover_path) values (t.band('W'), '11111111-0000-4000-8000-0000000000b2', 'Band Mới', null);
  insert into public.teamlab_band_members (band_id, user_id) values (t.band('W'), t.u('E'));
  n0 := t.rows();
  perform t.as_user('E');
  select * into r from public.bandchat_rooms() where band_id = t.band('W');
  perform t.ok(r.band_name = 'Band Mới' and r.can_send and r.last_seq = 0 and r.member_count = 1, '8a Band mới hiện nhóm dù chưa có tin');
  perform t.reset();
  perform t.ok(t.rows() = n0, '8b liệt kê/mở nhóm KHÔNG tạo phòng vật lý ('||t.rows()||')');
  update public.teamlab_bands set name = 'Band Đổi Tên', cover_path = 'w/cover.jpg' where id = t.band('W');
  perform t.as_user('E');
  select * into r from public.bandchat_rooms() where band_id = t.band('W');
  perform t.ok(r.band_name = 'Band Đổi Tên' and r.cover_path = 'w/cover.jpg', '8c đổi tên + ảnh Band phản ánh ngay ở lần gọi sau');
  perform public.bandchat_send(t.band('W'), 'Tin đầu');
  perform public.bandchat_send(t.band('W'), 'Tin hai');
  perform t.reset();
  perform t.ok((select count(*) from public.bandchat_rooms where band_id = t.band('W')) = 1, '8d gửi tin → đúng một phòng cho Band');
end $$;

-- ── 9. Chat không hồi quy: vai trò không đổi quyền gửi/đọc ──
do $$ begin
  perform t.as_user('B');
  perform t.ok(public.bandchat_send(t.band('X'), 'Chủ nhóm gửi như thành viên') > 0, '9a Chủ nhóm gửi tin bình thường');
  perform t.as_user('A');
  perform t.ok((select count(*) from public.bandchat_messages(t.band('X'))) >= 2, '9b thành viên thường đọc đủ lịch sử');
  perform t.reset();
end $$;
