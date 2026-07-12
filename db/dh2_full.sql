-- ============================================================================
-- ĐỆM HÁT TRÌNH ĐỘ 2 (DH2) — SINH TỰ ĐỘNG từ db/gen_dh2.cjs (đừng sửa tay).
-- Tổ chức theo BƯỚC ĐI & THÀNH QUẢ (mỗi chương → chơi được bài). Course: c7ab2fcb-aff1-4485-a381-4edc83e4a62b
-- Tiêu đề "Bài <chương>.<thứ tự> — <tên>". Bài mới placeholder (text ⏳).
-- Idempotent: ON CONFLICT bài mới KHÔNG đè nội dung (chỉ module/order/title).
-- ============================================================================

-- ===== Chương 1: Quạt chùm 2 (điệu Ballad) & chơi bài đầu tiên =====
INSERT INTO edu_modules (id, course_id, name, order_index) VALUES ('067ae3bb-7812-4485-8fa2-077fccaea2bf', 'c7ab2fcb-aff1-4485-a381-4edc83e4a62b', 'Chương 1: Quạt chùm 2 (điệu Ballad) & chơi bài đầu tiên', 0)
ON CONFLICT (id) DO UPDATE SET course_id = EXCLUDED.course_id, name = EXCLUDED.name, order_index = EXCLUDED.order_index;
UPDATE edu_course_lessons SET module_id = '067ae3bb-7812-4485-8fa2-077fccaea2bf', order_index = 0, title = 'Bài 1.1 — Chào mừng Trình độ 2' WHERE id = 'aca3b657-b2c8-46dd-ac1e-5fe8b7828158';
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00103-0000-4000-8000-000000000000', '067ae3bb-7812-4485-8fa2-077fccaea2bf', 'Bài 1.2 — Chùm nốt là gì — chia nhỏ phách', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text)</p>', 1, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
UPDATE edu_course_lessons SET module_id = '067ae3bb-7812-4485-8fa2-077fccaea2bf', order_index = 2, title = 'Bài 1.3 — Chùm 2 — nốt móc đơn' WHERE id = '1bc21a87-d39f-48ee-a62c-a753902631cf';
UPDATE edu_course_lessons SET module_id = '067ae3bb-7812-4485-8fa2-077fccaea2bf', order_index = 3, title = 'Bài 1.4 — Thực hành quạt chùm 2 (xuống–lên)' WHERE id = 'df4ddd1b-768b-4d74-8b9a-40a310ac99e9';
UPDATE edu_course_lessons SET module_id = '067ae3bb-7812-4485-8fa2-077fccaea2bf', order_index = 4, title = 'Bài 1.5 — Gảy theo: Happy Birthday — quạt chùm 2' WHERE id = '2f6b416d-7d4f-4bd0-8c13-0e4ad2e11829';
UPDATE edu_course_lessons SET module_id = '067ae3bb-7812-4485-8fa2-077fccaea2bf', order_index = 5, title = 'Bài 1.6 — Gảy theo: Jingle Bells — quạt chùm 2' WHERE id = '4692e092-3591-4dda-99d6-265b82e0d34c';
UPDATE edu_course_lessons SET module_id = '067ae3bb-7812-4485-8fa2-077fccaea2bf', order_index = 6, title = 'Bài 1.7 — Điệu Ballad là gì' WHERE id = '2b73cd3b-cc6e-4ba9-baff-9ef6acc984ac';
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00302-0000-4000-8000-000000000000', '067ae3bb-7812-4485-8fa2-077fccaea2bf', 'Bài 1.8 — Mẫu quạt Ballad cơ bản', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> video thầy quay 🎬</p>', 7, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00303-0000-4000-8000-000000000000', '067ae3bb-7812-4485-8fa2-077fccaea2bf', 'Bài 1.9 — Nền tập Ballad', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> Strum Score tự sinh (nền Ballad + chùm 2) — db/dh2_ch1_don.sql</p>', 8, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00304-0000-4000-8000-000000000000', '067ae3bb-7812-4485-8fa2-077fccaea2bf', 'Bài 1.10 — Gảy theo: Ode to Joy', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> gảy theo 🎸 (Strum Score) — native song-ode-ballad</p>', 9, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00109-0000-4000-8000-000000000000', '067ae3bb-7812-4485-8fa2-077fccaea2bf', 'Bài 1.11 — Checkpoint Chương 1', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> quiz 📝</p>', 10, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;

-- ===== Chương 2: Điệu Valse =====
INSERT INTO edu_modules (id, course_id, name, order_index) VALUES ('271e9988-0e3b-4171-a829-139a6b399263', 'c7ab2fcb-aff1-4485-a381-4edc83e4a62b', 'Chương 2: Điệu Valse', 1)
ON CONFLICT (id) DO UPDATE SET course_id = EXCLUDED.course_id, name = EXCLUDED.name, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00600-0000-4000-8000-000000000000', '271e9988-0e3b-4171-a829-139a6b399263', 'Bài 2.1 — Valse là gì — nhịp 3/4 chắc, rắn rỏi', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text)</p>', 0, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00602-0000-4000-8000-000000000000', '271e9988-0e3b-4171-a829-139a6b399263', 'Bài 2.2 — Mẫu Valse nốt đen (kiểu cơ bản)', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> video thầy quay 🎬</p>', 1, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00605-0000-4000-8000-000000000000', '271e9988-0e3b-4171-a829-139a6b399263', 'Bài 2.3 — Nền tập Valse', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> Strum Score tự sinh (nền Valse + nốt đen) — db/dh2_nentap_valse.sql</p>', 2, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00606-0000-4000-8000-000000000000', '271e9988-0e3b-4171-a829-139a6b399263', 'Bài 2.4 — Gảy theo: Amazing Grace — nốt đen', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> gảy theo 🎸 (Strum Score)</p>', 3, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00603-0000-4000-8000-000000000000', '271e9988-0e3b-4171-a829-139a6b399263', 'Bài 2.5 — Mẫu Valse có chùm 2 (mềm hơn — cho điệp khúc)', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> video thầy quay 🎬</p>', 4, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00604-0000-4000-8000-000000000000', '271e9988-0e3b-4171-a829-139a6b399263', 'Bài 2.6 — Tiết tấu trộn: Đen – đon đon – đon đon', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> video / bài giảng — 1 nốt đen + 2 chùm 2 trong 3/4</p>', 5, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00607-0000-4000-8000-000000000000', '271e9988-0e3b-4171-a829-139a6b399263', 'Bài 2.7 — Gảy theo: Scarborough Fair', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> gảy theo 🎸 (Strum Score) — áp dụng tiết tấu trộn</p>', 6, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00608-0000-4000-8000-000000000000', '271e9988-0e3b-4171-a829-139a6b399263', 'Bài 2.8 — Checkpoint Chương 2', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> quiz 📝</p>', 7, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;

-- ===== Chương 3: Điệu Slowrock =====
INSERT INTO edu_modules (id, course_id, name, order_index) VALUES ('d2000055-0000-4000-8000-000000000055', 'c7ab2fcb-aff1-4485-a381-4edc83e4a62b', 'Chương 3: Điệu Slowrock', 2)
ON CONFLICT (id) DO UPDATE SET course_id = EXCLUDED.course_id, name = EXCLUDED.name, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00108-0000-4000-8000-000000000000', 'd2000055-0000-4000-8000-000000000055', 'Bài 3.1 — Nghe thử chùm 3 và liên 3 — làm quen', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng + audio mẫu</p>', 0, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00500-0000-4000-8000-000000000000', 'd2000055-0000-4000-8000-000000000055', 'Bài 3.2 — Tính chất Slowrock', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text)</p>', 1, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00501-0000-4000-8000-000000000000', 'd2000055-0000-4000-8000-000000000055', 'Bài 3.3 — Liên 3 là gì trong đệm hát', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text)</p>', 2, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
UPDATE edu_course_lessons SET module_id = 'd2000055-0000-4000-8000-000000000055', order_index = 3, title = 'Bài 3.4 — Chùm 3 – Liên 3 (nền tảng Slowrock)' WHERE id = 'db6fddb4-7d3b-4a3b-9a01-f143928f02e5';
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00503-0000-4000-8000-000000000000', 'd2000055-0000-4000-8000-000000000055', 'Bài 3.5 — Cảm giác dàn trải của Slowrock', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text) + audio</p>', 4, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00504-0000-4000-8000-000000000000', 'd2000055-0000-4000-8000-000000000055', 'Bài 3.6 — Mẫu Slowrock cơ bản', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> video thầy quay 🎬</p>', 5, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00505-0000-4000-8000-000000000000', 'd2000055-0000-4000-8000-000000000055', 'Bài 3.7 — Nền tập Slowrock', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> công cụ app 🎛 (Groove Lab điệu Slowrock)</p>', 6, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00506-0000-4000-8000-000000000000', 'd2000055-0000-4000-8000-000000000055', 'Bài 3.8 — Gảy theo: 1 bài Slowrock (mọi lứa tuổi — chọn sau)', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> gảy theo 🎸 (Strum Score)</p>', 7, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;

-- ===== Chương 4: Điệu Bolero & kỹ thuật móc =====
INSERT INTO edu_modules (id, course_id, name, order_index) VALUES ('d2000044-0000-4000-8000-000000000044', 'c7ab2fcb-aff1-4485-a381-4edc83e4a62b', 'Chương 4: Điệu Bolero & kỹ thuật móc', 3)
ON CONFLICT (id) DO UPDATE SET course_id = EXCLUDED.course_id, name = EXCLUDED.name, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00400-0000-4000-8000-000000000000', 'd2000044-0000-4000-8000-000000000044', 'Bài 4.1 — Tính chất Bolero', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text)</p>', 0, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
UPDATE edu_course_lessons SET module_id = 'd2000044-0000-4000-8000-000000000044', order_index = 1, title = 'Bài 4.2 — Chùm 3 lệch phải (đơn – kép – kép) — đặc trưng Bolero' WHERE id = '12bb1218-6dcd-447c-8145-7f7f0302482b';
UPDATE edu_course_lessons SET module_id = 'd2000044-0000-4000-8000-000000000044', order_index = 2, title = 'Bài 4.3 — Bolero móc kiểu 1' WHERE id = '5f7acacd-9214-48f3-9349-93cc382649fb';
UPDATE edu_course_lessons SET module_id = 'd2000044-0000-4000-8000-000000000044', order_index = 3, title = 'Bài 4.4 — Bolero móc kiểu 2' WHERE id = 'a85592d5-b519-470d-84d0-4d9182d224b3';
UPDATE edu_course_lessons SET module_id = 'd2000044-0000-4000-8000-000000000044', order_index = 4, title = 'Bài 4.5 — Quạt ballad cho điệp khúc Bolero' WHERE id = 'aec7a2a0-3b49-4902-891d-22c52759d71f';
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00405-0000-4000-8000-000000000000', 'd2000044-0000-4000-8000-000000000044', 'Bài 4.6 — Mẫu rải Ballad đơn giản (kỹ thuật móc)', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> video thầy quay 🎬 — rải/móc</p>', 5, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00406-0000-4000-8000-000000000000', 'd2000044-0000-4000-8000-000000000044', 'Bài 4.7 — Nền tập Bolero', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> công cụ app 🎛 (Groove Lab điệu Bolero)</p>', 6, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00407-0000-4000-8000-000000000000', 'd2000044-0000-4000-8000-000000000044', 'Bài 4.8 — Gảy theo: 1 bài Bolero (mọi lứa tuổi — chọn sau)', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> gảy theo 🎸 (Strum Score)</p>', 7, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;

-- ===== Chương 5: Bố cục bài hát =====
INSERT INTO edu_modules (id, course_id, name, order_index) VALUES ('a844e611-71a9-48c1-84cf-a645b8c79d08', 'c7ab2fcb-aff1-4485-a381-4edc83e4a62b', 'Chương 5: Bố cục bài hát', 4)
ON CONFLICT (id) DO UPDATE SET course_id = EXCLUDED.course_id, name = EXCLUDED.name, order_index = EXCLUDED.order_index;
UPDATE edu_course_lessons SET module_id = 'a844e611-71a9-48c1-84cf-a645b8c79d08', order_index = 0, title = 'Bài 5.1 — Cấu trúc bài hát (Musical Form)' WHERE id = 'd3624d28-47e2-48d3-a1d3-ee7ead6c3de2';
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00701-0000-4000-8000-000000000000', 'a844e611-71a9-48c1-84cf-a645b8c79d08', 'Bài 5.2 — Intro — Phiên khúc — Điệp khúc — Cầu nối — Kết', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text) + nghe ví dụ</p>', 1, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
UPDATE edu_course_lessons SET module_id = 'a844e611-71a9-48c1-84cf-a645b8c79d08', order_index = 2, title = 'Bài 5.3 — Bố cục một bài hát thông dụng' WHERE id = 'c2a2a5eb-411e-4e0a-a2ed-2a891b5ac970';
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00703-0000-4000-8000-000000000000', 'a844e611-71a9-48c1-84cf-a645b8c79d08', 'Bài 5.4 — Chọn điệu theo tính chất bài hát', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text)</p>', 3, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00704-0000-4000-8000-000000000000', 'a844e611-71a9-48c1-84cf-a645b8c79d08', 'Bài 5.5 — Chọn sắc thái theo từng đoạn', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text)</p>', 4, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00705-0000-4000-8000-000000000000', 'a844e611-71a9-48c1-84cf-a645b8c79d08', 'Bài 5.6 — Phiên khúc đánh nhẹ — điệp khúc bung hơn', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text)</p>', 5, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00706-0000-4000-8000-000000000000', 'a844e611-71a9-48c1-84cf-a645b8c79d08', 'Bài 5.7 — Bố cục mẫu Ballad', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text)</p>', 6, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
UPDATE edu_course_lessons SET module_id = 'a844e611-71a9-48c1-84cf-a645b8c79d08', order_index = 7, title = 'Bài 5.8 — Bố cục mẫu cho một bài Bolero' WHERE id = '21b2be1b-533a-4d2d-9610-a698e01b31d5';
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00708-0000-4000-8000-000000000000', 'a844e611-71a9-48c1-84cf-a645b8c79d08', 'Bài 5.9 — Bố cục mẫu Slowrock', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text)</p>', 8, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00709-0000-4000-8000-000000000000', 'a844e611-71a9-48c1-84cf-a645b8c79d08', 'Bài 5.10 — Bố cục mẫu Valse', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text)</p>', 9, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
UPDATE edu_course_lessons SET module_id = 'a844e611-71a9-48c1-84cf-a645b8c79d08', order_index = 10, title = 'Bài 5.11 — Bài tập tự luận: phân tích bố cục bài hát' WHERE id = 'a3a059a1-7b85-4505-962a-aba56892d28f';

-- ===== Chương 6: Áp dụng vào bài hát thực tế =====
INSERT INTO edu_modules (id, course_id, name, order_index) VALUES ('974b0073-61d3-4b76-857a-e4f01c738d42', 'c7ab2fcb-aff1-4485-a381-4edc83e4a62b', 'Chương 6: Áp dụng vào bài hát thực tế', 5)
ON CONFLICT (id) DO UPDATE SET course_id = EXCLUDED.course_id, name = EXCLUDED.name, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00800-0000-4000-8000-000000000000', '974b0073-61d3-4b76-857a-e4f01c738d42', 'Bài 6.1 — Quy trình đệm 1 bài mới — 5 bước', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text/slide)</p>', 0, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00801-0000-4000-8000-000000000000', '974b0073-61d3-4b76-857a-e4f01c738d42', 'Bài 6.2 — Tự đệm bài bạn thích — công cụ Strum Builder', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> công cụ 🎛 (skill strum-builder, phần tự do)</p>', 1, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00805-0000-4000-8000-000000000000', '974b0073-61d3-4b76-857a-e4f01c738d42', 'Bài 6.3 — Dự án cuối khoá: tự chọn 1 bài, tự đệm và thu lại nộp', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài nộp (submit_video)</p>', 2, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00806-0000-4000-8000-000000000000', '974b0073-61d3-4b76-857a-e4f01c738d42', 'Bài 6.4 — Tổng kết Đệm hát Trình độ 2', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text)</p>', 3, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00807-0000-4000-8000-000000000000', '974b0073-61d3-4b76-857a-e4f01c738d42', 'Bài 6.5 — Lộ trình lên Đệm hát Trình độ 3', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text)</p>', 4, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;

-- ===== Dọn bài placeholder mồ côi + bài cũ đã bỏ =====
DELETE FROM edu_course_lessons WHERE id::text LIKE 'd2c00%'
  AND id NOT IN (
    'd2c00103-0000-4000-8000-000000000000',
    'd2c00302-0000-4000-8000-000000000000',
    'd2c00303-0000-4000-8000-000000000000',
    'd2c00304-0000-4000-8000-000000000000',
    'd2c00109-0000-4000-8000-000000000000',
    'd2c00600-0000-4000-8000-000000000000',
    'd2c00602-0000-4000-8000-000000000000',
    'd2c00605-0000-4000-8000-000000000000',
    'd2c00606-0000-4000-8000-000000000000',
    'd2c00603-0000-4000-8000-000000000000',
    'd2c00604-0000-4000-8000-000000000000',
    'd2c00607-0000-4000-8000-000000000000',
    'd2c00608-0000-4000-8000-000000000000',
    'd2c00108-0000-4000-8000-000000000000',
    'd2c00500-0000-4000-8000-000000000000',
    'd2c00501-0000-4000-8000-000000000000',
    'd2c00503-0000-4000-8000-000000000000',
    'd2c00504-0000-4000-8000-000000000000',
    'd2c00505-0000-4000-8000-000000000000',
    'd2c00506-0000-4000-8000-000000000000',
    'd2c00400-0000-4000-8000-000000000000',
    'd2c00405-0000-4000-8000-000000000000',
    'd2c00406-0000-4000-8000-000000000000',
    'd2c00407-0000-4000-8000-000000000000',
    'd2c00701-0000-4000-8000-000000000000',
    'd2c00703-0000-4000-8000-000000000000',
    'd2c00704-0000-4000-8000-000000000000',
    'd2c00705-0000-4000-8000-000000000000',
    'd2c00706-0000-4000-8000-000000000000',
    'd2c00708-0000-4000-8000-000000000000',
    'd2c00709-0000-4000-8000-000000000000',
    'd2c00800-0000-4000-8000-000000000000',
    'd2c00801-0000-4000-8000-000000000000',
    'd2c00805-0000-4000-8000-000000000000',
    'd2c00806-0000-4000-8000-000000000000',
    'd2c00807-0000-4000-8000-000000000000'
  );
DELETE FROM edu_course_lessons WHERE id = 'd76e8798-76bd-485e-b0fb-4fadb6b98458';
-- Xoá module cũ đã gộp vào Chương 1
DELETE FROM edu_modules WHERE id IN ('46e55dbe-dd8f-40b5-a8ec-6464219f7155', '2a3011f7-750e-49e6-9b55-ea0af1725d0d');

-- ===== Chuyển cụm Bossa Nova sang Đệm Hát Trình Độ 3 =====
INSERT INTO edu_modules (id, course_id, name, order_index) VALUES ('d3000001-0000-4000-8000-000000000001', 'd5f963ac-bcd7-45e2-b002-7970ba33e710', 'Điệu Bossa Nova (chuyển từ Trình độ 2)', 0)
ON CONFLICT (id) DO UPDATE SET course_id = EXCLUDED.course_id, name = EXCLUDED.name, order_index = EXCLUDED.order_index;
UPDATE edu_course_lessons SET module_id = 'd3000001-0000-4000-8000-000000000001', order_index = 0 WHERE id = 'bbf87a30-8daf-46b3-9af7-796c5a330718';
UPDATE edu_course_lessons SET module_id = 'd3000001-0000-4000-8000-000000000001', order_index = 1 WHERE id = '1ec6e240-afe7-4589-a57f-a318e313bead';
UPDATE edu_course_lessons SET module_id = 'd3000001-0000-4000-8000-000000000001', order_index = 2 WHERE id = 'dbeedf1b-bf9e-4ef6-9413-dd4113255234';
UPDATE edu_course_lessons SET module_id = 'd3000001-0000-4000-8000-000000000001', order_index = 3 WHERE id = 'e2a39c7d-ce7e-4e06-9591-7c3f9b3eb27d';

NOTIFY pgrst, 'reload schema';
