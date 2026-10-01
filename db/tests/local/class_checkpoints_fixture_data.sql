-- Dữ liệu fixture LỚP CỦA TÔI V1 (nạp SAU class_checkpoints_fixture.sql). KHÔNG chạy production.
-- A, B: SOLO01.TH01 (có quyền giáo trình) · C: SOLO01.TH02 · HT2027.TH01: có giáo trình nhưng CHƯA có checkpoint.
-- Lớp + nhóm cohort (mã nhóm 'CLASS.<mã lớp>' như production)
insert into public.edu_groups (id, name, group_type, code) values
  ('f1000000-0000-4000-8000-000000000001', 'CLASS.SOLO01.TH01', 'class', 'CLASS.SOLO01.TH01'),
  ('f1000000-0000-4000-8000-000000000002', 'CLASS.SOLO01.TH02', 'class', 'CLASS.SOLO01.TH02');
insert into public.class_schedule (id, code, name, program_code, stage, status, start_date, cohort_group_id) values
  ('b1000000-0000-4000-8000-000000000001', 'SOLO01.TH01', 'Solo Guitar Căn Bản', 'SOLO01', 'phat_trien', 'scheduled', current_date - 14, 'f1000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000002', 'SOLO01.TH02', 'Solo Guitar', 'SOLO01', null, 'scheduled', current_date - 7, 'f1000000-0000-4000-8000-000000000002');
insert into public.class_stages (id, class_id, stage_no, public_title, from_session, to_session) values
  (9101, 'b1000000-0000-4000-8000-000000000001', 1, 'TỪ GIAI ĐIỆU ĐẾN SOLO GUITAR', 1, 8);
insert into public.edu_group_members (user_id, group_id, source, status) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', 'f1000000-0000-4000-8000-000000000001', 'admin', 'active'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'f1000000-0000-4000-8000-000000000001', 'admin', 'active'),
  ('cccccccc-0000-4000-8000-00000000000c', 'f1000000-0000-4000-8000-000000000002', 'admin', 'active');
insert into public.class_curriculum_access (class_id, user_id, status) values
  ('b1000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-00000000000a', 'active'),
  ('b1000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-00000000000b', 'active'),
  ('b1000000-0000-4000-8000-000000000002', 'cccccccc-0000-4000-8000-00000000000c', 'active');

-- Buổi TH01: 1, 2, (nghỉ), 3, 4 (nháp) · TH02: 1, 2
insert into public.class_sessions (id, class_id, session_number, title, start_at, event_type, status, stage_id) values
  ('51000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 1, 'Buổi 1 · Bản đồ nốt C–Am', now() - interval '14 days', 'lesson', 'scheduled', 9101),
  ('51000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 2, 'Buổi 2 · Ép ngón & Bass', now() - interval '7 days', 'lesson', 'scheduled', 9101),
  ('51000000-0000-4000-8000-0000000000b1', 'b1000000-0000-4000-8000-000000000001', null, 'Nghỉ giữa chặng', now(), 'break', 'holiday', null),
  ('51000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000001', 3, 'Buổi 3 · Slide', now() + interval '7 days', 'lesson', 'scheduled', 9101),
  ('51000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000001', 4, 'Buổi 4 · Xếp ngón', now() + interval '14 days', 'lesson', 'scheduled', 9101),
  ('52000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 1, 'Buổi 1 · Bản đồ nốt C–Am', now(), 'lesson', 'scheduled', null),
  ('52000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 2, 'Buổi 2 · Ép ngón & Bass', now() + interval '7 days', 'lesson', 'scheduled', null);
insert into public.class_lesson_content (session_id, status, blocks) values
  ('51000000-0000-4000-8000-000000000001', 'published', '[{"kind":"objectives","items":["x"]},
     {"kind":"checkpoint","id":"1.1","title":"Âm giai C–Am","prompt":"Gửi video chơi âm giai","required":true,"accepts":["text","video_link"]},
     {"kind":"note","text":"giữa"},
     {"kind":"checkpoint","id":"1.2","title":"Tự chọn","required":false},
     {"kind":"checkpoint","id":"bad id!","title":"id sai bị bỏ qua"}]'),
  ('51000000-0000-4000-8000-000000000002', 'published', '[{"kind":"checkpoint","id":"2.1","title":"Ép ngón"},
     {"kind":"checkpoint","id":"2.2","title":"Bass","required":"yes"}]'),
  ('51000000-0000-4000-8000-000000000003', 'published', '[{"kind":"checkpoint","id":"3.1","title":"Slide","accepts":["video_link"]},
     {"kind":"checkpoint","id":"3.2","title":"Quiz sau này","required":false,"accepts":["quiz"]}]'),
  ('51000000-0000-4000-8000-000000000004', 'draft', '[{"kind":"note","text":"đang soạn"}]'),
  ('52000000-0000-4000-8000-000000000001', 'published', '[{"kind":"checkpoint","id":"1.1","title":"Âm giai C–Am"}]'),
  ('52000000-0000-4000-8000-000000000002', 'published', '[{"kind":"note","text":"buổi không có checkpoint"}]');

-- Lớp có giáo trình xuất bản nhưng CHƯA có checkpoint (như HT2027.TH01 production): A là thành viên + có quyền
insert into public.edu_groups (id, name, group_type, code) values ('f1000000-0000-4000-8000-000000000003', 'CLASS.HT2027.TH01', 'class', 'CLASS.HT2027.TH01');
insert into public.class_schedule (id, code, name, program_code, status, start_date, cohort_group_id) values
  ('b1000000-0000-4000-8000-000000000003', 'HT2027.TH01', 'Hành trình 2027', 'HT2027', 'active', current_date - 30, 'f1000000-0000-4000-8000-000000000003');
insert into public.edu_group_members (user_id, group_id, source, status) values ('aaaaaaaa-0000-4000-8000-00000000000a', 'f1000000-0000-4000-8000-000000000003', 'admin', 'active');
insert into public.class_curriculum_access (class_id, user_id, status) values ('b1000000-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-00000000000a', 'active');
insert into public.class_sessions (id, class_id, session_number, title, event_type) values
  ('53000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000003', 1, 'Buổi 1 · Ôn tập', 'lesson');
insert into public.class_lesson_content (session_id, status, blocks) values
  ('53000000-0000-4000-8000-000000000001', 'published', '[{"kind":"study","title":"Ôn tập","blocks":[]}]');

-- Lớp CHƯA có bài trả nhưng có giáo trình (chế độ giáo trình của màn học): CUR01.TH01 — A (có quyền) · B (thành viên, KHÔNG quyền)
insert into public.edu_groups (id, name, group_type, code) values ('f1000000-0000-4000-8000-000000000004', 'CLASS.CUR01.TH01', 'class', 'CLASS.CUR01.TH01');
insert into public.class_schedule (id, code, name, program_code, status, start_date, cohort_group_id) values
  ('b1000000-0000-4000-8000-000000000004', 'CUR01.TH01', 'Giáo trình mẫu', 'CUR01', 'active', current_date - 14, 'f1000000-0000-4000-8000-000000000004');
insert into public.edu_group_members (user_id, group_id, source, status) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', 'f1000000-0000-4000-8000-000000000004', 'admin', 'active'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'f1000000-0000-4000-8000-000000000004', 'admin', 'active');
insert into public.class_curriculum_access (class_id, user_id, status) values ('b1000000-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-00000000000a', 'active');
insert into public.class_sessions (id, class_id, session_number, title, start_at, event_type, status) values
  ('54000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000004', 1, 'Buổi 1 · Mở đầu', now() - interval '14 days', 'lesson', 'scheduled'),
  ('54000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000004', 2, 'Buổi 2 · Tuần này', now() - interval '1 day', 'lesson', 'scheduled'),
  ('54000000-0000-4000-8000-0000000000b1', 'b1000000-0000-4000-8000-000000000004', null, 'Nghỉ giữa chặng – thời gian tự luyện', now() + interval '3 days', 'break', 'holiday'),
  ('54000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000004', 3, 'Buổi 3 · Đang soạn', now() + interval '7 days', 'lesson', 'scheduled'),
  ('54000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000004', 4, 'Buổi 4 · Chưa có', now() + interval '14 days', 'lesson', 'scheduled');
insert into public.class_lesson_content (session_id, status, blocks) values
  ('54000000-0000-4000-8000-000000000001', 'published', '[{"kind":"objectives","items":["Mục tiêu buổi 1"]},{"kind":"note","text":"Nội dung thật buổi 1"}]'),
  ('54000000-0000-4000-8000-000000000002', 'published', '[{"kind":"objectives","items":["Mục tiêu buổi 2"]},{"kind":"note","text":"Nội dung thật buổi 2"}]'),
  ('54000000-0000-4000-8000-000000000003', 'draft', '[{"kind":"note","text":"nháp"}]');
