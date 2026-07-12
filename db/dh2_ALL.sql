-- ĐỆM HÁT TRÌNH ĐỘ 2 — CHẠY TẤT CẢ. Idempotent.

-- ==================== db/dh2_full.sql ====================
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

-- ==================== db/dh2_videos.sql ====================
-- ============================================================================
-- DH2 — CỤM VIDEO 🎬 (thầy quay). Mỗi bài: content = "điều cần chú ý khi xem"
-- (soạn trước, chạy được ngay); khi có link → đổi lesson_type='video' + content_url.
-- ============================================================================

-- ── Ch3 Ballad · Mẫu quạt Ballad cơ bản  (d2c00302) ─────────────────────────
-- Video "Quạt ballad chùm 2 — Thầy Văn Anh Guitar" (PwSGfSGeuaE)
UPDATE edu_course_lessons SET lesson_type = 'video', content_url = 'https://www.youtube.com/watch?v=PwSGfSGeuaE', content =
'<h2>Mẫu quạt Ballad — xem thầy đàn</h2>
<p>Đây là lúc chùm 2 biến thành một điệu Ballad hoàn chỉnh. Hãy xem kỹ tay phải của thầy, để ý cái <em>đều đặn, êm ái</em> rất đặc trưng của Ballad — không cú nào bật gắt lên phá vỡ sự dịu dàng.</p>
<h3>Ba điều hãy để ý khi xem</h3>
<ul>
<li><strong>Nhịp đều như hơi thở</strong> — chùm 2 chạy ↓↑ ↓↑ mượt mà, gần bằng nhịp tim, khiến người nghe dễ chịu.</li>
<li><strong>Nhấn phách 1 &amp; 3 thật khẽ</strong> — đủ để giữ nhịp, KHÔNG đủ để làm giật. Đây là bí quyết giữ chất &ldquo;lãng mạn&rdquo;.</li>
<li><strong>Đổi hợp âm gọn</strong> — tay trái chuyển hợp âm đúng đầu ô nhịp, tay phải vẫn quạt đều không khựng.</li>
</ul>
<h3>Cách luyện</h3>
<p>Xem một lượt cảm cái &ldquo;êm&rdquo; của điệu. Sau đó quạt theo thật chậm, giữ đều tuyệt đối, rồi mới tăng dần tốc độ. Khi đã đều, hãy thử đệm cho một câu hát bạn thuộc — bạn sẽ nghe ra ngay: <em>nó ra Ballad thật rồi!</em></p>'
WHERE id = 'd2c00302-0000-4000-8000-000000000000';

NOTIFY pgrst, 'reload schema';

-- ==================== db/dh2_gaytheo.sql ====================
-- ============================================================================
-- DH2 — CỤM GẢY THEO 🎸 (Strum Score / ChordStrumPlayer, native lesson).
-- Gắn bài đã dựng trong src/elearn/strumSongs.ts + nativeLessons.tsx vào chương.
-- Idempotent.
-- ============================================================================

-- Ch3 Ballad · Gảy theo: Ode to Joy (d2c00304) → Strum Score 'song-ode-ballad'
-- (tiêu đề do generator đặt số; ở đây chỉ gắn công cụ)
UPDATE edu_course_lessons SET lesson_type = 'native', content_url = 'song-ode-ballad'
  WHERE id = 'd2c00304-0000-4000-8000-000000000000';

-- Ch2 Valse · Gảy theo: Scarborough Fair (d2c00607) → Strum Score 'song-scarborough' (tiết tấu trộn)
UPDATE edu_course_lessons SET lesson_type = 'native', content_url = 'song-scarborough'
  WHERE id = 'd2c00607-0000-4000-8000-000000000000';

-- Ch2 Valse · Gảy theo: Amazing Grace (d2c00606) → Strum Score 'song-amazing'
UPDATE edu_course_lessons SET lesson_type = 'native', content_url = 'song-amazing',
       title = 'Bài 2.4 — Gảy theo: Amazing Grace — nốt đen'
  WHERE id = 'd2c00606-0000-4000-8000-000000000000';

NOTIFY pgrst, 'reload schema';

-- ==================== db/dh2_nentap_valse.sql ====================
-- ============================================================================
-- DH2 Chương 2 (Valse) — Bài "Nền tập Valse" (n:5 → id d2c00605)
-- Strum Score tự sinh (lesson_type='strum', config JSON ở cột content):
--   nền synth Valse + vòng C–F–G–C, kiểu quạt NỐT ĐEN, nhịp 3/4, tempo 96, loop.
-- Idempotent. LƯU Ý: cần chạy db/dh2_ALL.sql (khung 7 chương) trước nếu chưa chạy.
-- ============================================================================

UPDATE edu_course_lessons
   SET lesson_type = 'strum',
       content_url = NULL,
       content     = '{"styleId":"valse","tempo":96,"patternId":"den","timeSignature":3,"chords":["C","F","G","C"]}',
       description = 'Bật nền trống–bass Valse rồi quạt mẫu nốt đen theo khuông: Bùm – chát – chát. Vững rồi thì tự tăng tempo dần lên 110–120, và thử đổi phách 2–3 sang chùm 2 như bài trước.'
 WHERE id = 'd2c00605-0000-4000-8000-000000000000';

NOTIFY pgrst, 'reload schema';

-- ==================== db/dh2_ch1_don.sql ====================
-- ============================================================================
-- DH2 Chương 1 — chuốt lại (2026-07-12). Idempotent.
-- 1) BỎ Bài 'Thực hành gõ chùm 2' (d2c00106) — thầy chốt: thừa, slide 1.3 +
--    bài quạt có mic (1.5) đã ôm phần cảm nhịp. Generator cũng đã gỡ.
-- 2) Bài 'Nền tập Ballad' (d2c00303) = Strum Score tự sinh (như Nền tập Valse):
--    nền Ballad + quạt CHÙM 2, vòng C–Am–F–G, 4/4, tempo 70, loop.
-- 3) Dọn content '⏳' còn sót trên các bài đã gắn Strum Score (native).
-- Chạy SAU db/dh2_ALL.sql. Chạy lại dh2_full.sql sau đó sẽ đánh lại số bài 1.x.
-- ============================================================================

-- (1) Xoá bài gõ chùm 2
DELETE FROM edu_course_lessons WHERE id = 'd2c00106-0000-4000-8000-000000000000';

-- (2) Nền tập Ballad = strum config
UPDATE edu_course_lessons
   SET lesson_type = 'strum',
       content_url = NULL,
       content     = '{"styleId":"ballad","tempo":70,"patternId":"chum2","timeSignature":4,"chords":["C","Am","F","G"]}',
       description = 'Bật nền trống–bass Ballad rồi quạt chùm 2 (xuống–lên) theo khuông, đều và êm như video mẫu. Vững rồi thì tự tăng tempo dần lên 80–90.'
 WHERE id = 'd2c00303-0000-4000-8000-000000000000';

-- (3) Dọn placeholder '⏳' trên bài native đã hoạt động
UPDATE edu_course_lessons SET content = NULL
 WHERE id IN ('d2c00304-0000-4000-8000-000000000000',   -- 1.11 Ode to Joy
              'd2c00606-0000-4000-8000-000000000000',   -- 2.4 Amazing Grace
              'd2c00607-0000-4000-8000-000000000000')   -- 2.7 Scarborough Fair
   AND lesson_type = 'native' AND content LIKE '%⏳%';

NOTIFY pgrst, 'reload schema';

-- ==================== db/dh2_quiz_ch1.sql ====================
-- ============================================================================
-- DH2 — Bài 1.11 Checkpoint Chương 1 (d2c00109) = QUIZ 6 câu (thầy duyệt 2026-07-12).
-- Schema JSON theo src/components/QuizViewer.tsx (multiple_choice: answer.correct
-- = chuỗi option; true_false: answer.correct = boolean). Đạt 70% là qua.
-- Idempotent.
-- ============================================================================

UPDATE edu_course_lessons
   SET lesson_type = 'quiz',
       content_url = NULL,
       description = NULL,
       content = '{
  "quiz_title": "Checkpoint Chương 1 — Chùm 2 & Ballad",
  "description": "Kiểm tra nhanh trước khi sang Chương 2. Đạt 70% là qua — sai câu nào, đọc phần giải thích để nắm lại.",
  "mode": "practice",
  "passing_score": 70,
  "questions": [
    {
      "id": "ch1-q1", "type": "multiple_choice", "skill": "chum-not", "difficulty": 1, "points": 1,
      "question": "Chùm 2 chia một phách thành gì?",
      "data": { "options": ["2 nốt móc đơn", "3 nốt bằng nhau", "4 nốt móc kép", "Không chia — vẫn là 1 nốt đen"] },
      "answer": { "correct": "2 nốt móc đơn" },
      "explanation": "Chùm 2 = chia đôi một phách thành 2 nốt móc đơn, đọc là \"1 – và\"."
    },
    {
      "id": "ch1-q2", "type": "true_false", "skill": "quat-chum2", "difficulty": 1, "points": 1,
      "question": "Chùm 2 BẮT BUỘC phải quạt xuống–lên.",
      "data": {},
      "answer": { "correct": false },
      "explanation": "Xuống–lên là cách thông thường và thuận tay nhất, nhưng không bắt buộc."
    },
    {
      "id": "ch1-q3", "type": "true_false", "skill": "chum-not", "difficulty": 2, "points": 1,
      "question": "Hai nốt trong chùm 2 giống hệt nhau cả về độ dài lẫn độ mạnh.",
      "data": {},
      "answer": { "correct": false },
      "explanation": "Chúng chỉ bằng nhau về THỜI GIAN. Về lực thì nốt rơi vào phách đánh MẠNH, nốt \"và\" đánh NHẸ — chính cái mạnh–nhẹ đó làm câu quạt có hồn."
    },
    {
      "id": "ch1-q4", "type": "multiple_choice", "skill": "doc-nhip", "difficulty": 1, "points": 1,
      "question": "Đọc miệng một ô nhịp 4/4 quạt chùm 2 là gì?",
      "data": { "options": ["1-và-2-và-3-và-4-và", "1-2-3-4", "1-2-3", "và-và-và-và"] },
      "answer": { "correct": "1-và-2-và-3-và-4-và" },
      "explanation": "Mỗi phách = \"số – và\": số là nhát xuống, \"và\" là nhát lên. Đủ 4 phách thành 1-và-2-và-3-và-4-và."
    },
    {
      "id": "ch1-q5", "type": "multiple_choice", "skill": "dieu-ballad", "difficulty": 1, "points": 1,
      "question": "Tính chất của điệu Ballad là gì?",
      "data": { "options": ["Êm ái, đều đặn, tình cảm", "Dồn dập, mạnh mẽ", "Nhún nhảy kiểu nhịp 3/4", "Chỉ dùng nốt đen"] },
      "answer": { "correct": "Êm ái, đều đặn, tình cảm" },
      "explanation": "Ballad là điệu 4/4 êm, đều, hợp các bài tâm tình — đúng cái bạn vừa quạt bằng chùm 2."
    },
    {
      "id": "ch1-q6", "type": "multiple_choice", "skill": "dieu-ballad", "difficulty": 2, "points": 1,
      "question": "Bài nào bạn vừa chơi đúng chất Ballad chùm 2 nhịp 4/4?",
      "data": { "options": ["Jingle Bells", "Happy Birthday", "Cả hai bài", "Không bài nào"] },
      "answer": { "correct": "Jingle Bells" },
      "explanation": "Happy Birthday là nhịp 3/4 — sang Chương 2 bạn sẽ gặp lại nó với đúng điệu của nhịp 3/4: Valse."
    }
  ]
}'
 WHERE id = 'd2c00109-0000-4000-8000-000000000000';

NOTIFY pgrst, 'reload schema';

-- ==================== db/dh2_dot2.sql ====================
-- ============================================================================
-- DH2 — ĐỢT 2 (2026-07-12). Idempotent. Gồm:
--   (A) Nền tập Slowrock (3.7) + Bolero (4.7) = Strum Score tự sinh
--   (B) Quiz Checkpoint Chương 2 (2.8)
--   (C) Chương 5: điền 7 bài rỗng (5.1, 5.3, 5.7, 5.8, 5.9, 5.10, 5.11)
--   (D) Chuẩn hoá tier: học thử FREE = Bài 1.1–1.6, còn lại BASIC
-- ============================================================================

-- ─── (A) NỀN TẬP ─────────────────────────────────────────────────────────────

-- 3.7 Nền tập Slowrock (d2c00505) — liên 3 dàn trải, vòng Am buồn, tempo 66
UPDATE edu_course_lessons
   SET lesson_type = 'strum', content_url = NULL,
       content = '{"styleId":"slowrock","tempo":66,"patternId":"lien3","timeSignature":4,"chords":["Am","Dm","E","Am"]}',
       description = 'Bật nền rồi quạt liên 3 (3 nhát xuống đều nhau mỗi phách) — thả lỏng cổ tay, để tiếng đàn dàn trải như sóng. Chưa quen thì đọc miệng "1-2-3, 1-2-3" theo từng phách trước.'
 WHERE id = 'd2c00505-0000-4000-8000-000000000000';

-- 4.7 Nền tập Bolero (d2c00406) — đơn–kép–kép (chùm 3 lệch phải), tempo 75
UPDATE edu_course_lessons
   SET lesson_type = 'strum', content_url = NULL,
       content = '{"styleId":"bolero","tempo":75,"patternId":"donkepkep","timeSignature":4,"chords":["Am","Dm","E","Am"]}',
       description = 'Quạt đơn–kép–kép theo nền: nhát đầu DÀI, hai nhát sau NGẮN (xuống–xuống–lên). Đây không phải liên 3 chia đều — cái "lệch" này chính là chất Bolero. Vững rồi hãy thử vừa quạt vừa đếm "chậm–nhanh-nhanh".'
 WHERE id = 'd2c00406-0000-4000-8000-000000000000';

-- ─── (B) QUIZ CHECKPOINT CHƯƠNG 2 (d2c00608) ────────────────────────────────

UPDATE edu_course_lessons
   SET lesson_type = 'quiz', content_url = NULL, description = NULL,
       content = '{
  "quiz_title": "Checkpoint Chương 2 — Điệu Valse",
  "description": "Kiểm tra nhanh trước khi sang Slowrock. Đạt 70% là qua — sai câu nào, đọc giải thích để nắm lại.",
  "mode": "practice",
  "passing_score": 70,
  "questions": [
    {
      "id": "ch2-q1", "type": "multiple_choice", "skill": "nhip-34", "difficulty": 1, "points": 1,
      "question": "Nhịp 3/4 có mấy phách trong một ô nhịp?",
      "data": { "options": ["3 phách", "4 phách", "2 phách", "6 phách"] },
      "answer": { "correct": "3 phách" },
      "explanation": "3/4 = mỗi ô nhịp có 3 phách, mỗi phách bằng một nốt đen."
    },
    {
      "id": "ch2-q2", "type": "multiple_choice", "skill": "nhip-34", "difficulty": 1, "points": 1,
      "question": "Trọng âm của nhịp 3/4 đi theo thứ tự nào?",
      "data": { "options": ["Mạnh — nhẹ — nhẹ", "Nhẹ — nhẹ — mạnh", "Mạnh — mạnh — nhẹ", "Cả 3 phách đều nhau"] },
      "answer": { "correct": "Mạnh — nhẹ — nhẹ" },
      "explanation": "Phách 1 mạnh, phách 2–3 nhẹ — đọc \"MỘT-hai-ba\" là nghe ra ngay cái xoay tròn của Valse."
    },
    {
      "id": "ch2-q3", "type": "true_false", "skill": "mau-valse", "difficulty": 1, "points": 1,
      "question": "Trong mẫu Valse nốt đen, phách 1 là tiếng bass (Bùm), phách 2 và 3 là hai nhát quạt nhẹ (chát – chát).",
      "data": {},
      "answer": { "correct": true },
      "explanation": "Đúng — Bùm chát chát. Bass phách 1 làm trụ, hai nhát sau nhẹ tay hơn."
    },
    {
      "id": "ch2-q4", "type": "multiple_choice", "skill": "dieu-valse", "difficulty": 1, "points": 1,
      "question": "Tính chất của điệu Valse là gì?",
      "data": { "options": ["Chắc chắn, rắn rỏi, xoay tròn", "Êm ái, dàn trải như sóng", "Dồn dập, lệch phách", "Buồn sâu lắng kiểu chùm 3"] },
      "answer": { "correct": "Chắc chắn, rắn rỏi, xoay tròn" },
      "explanation": "Valse chắc và rắn rỏi trên 3 phách — khác cái êm dàn trải của Ballad hay chất chùm 3 của Slowrock."
    },
    {
      "id": "ch2-q5", "type": "multiple_choice", "skill": "tiet-tau-tron", "difficulty": 2, "points": 1,
      "question": "Tiết tấu trộn \"Đen – đon đon – đon đon\" trong một ô 3/4 gồm những gì?",
      "data": { "options": ["1 nốt đen + 2 chùm 2", "3 nốt đen", "3 chùm 2", "1 chùm 2 + 2 nốt đen"] },
      "answer": { "correct": "1 nốt đen + 2 chùm 2" },
      "explanation": "Phách 1 là nốt đen chắc (Đen), phách 2–3 mỗi phách một chùm 2 (đon đon) — Valse vừa vững vừa nhún nhảy."
    },
    {
      "id": "ch2-q6", "type": "multiple_choice", "skill": "dieu-valse", "difficulty": 2, "points": 1,
      "question": "Ở Chương 1 bạn biết Happy Birthday KHÔNG phải Ballad vì nó nhịp 3/4. Vậy nó hợp điệu gì?",
      "data": { "options": ["Valse", "Ballad", "Slowrock", "Không điệu nào"] },
      "answer": { "correct": "Valse" },
      "explanation": "Chính xác — Happy Birthday nhịp 3/4 đệm Valse là hợp nhất. Giờ bạn đã đủ đồ nghề: thử quay lại đệm nó bằng Bùm chát chát xem!"
    }
  ]
}'
 WHERE id = 'd2c00608-0000-4000-8000-000000000000';

-- ─── (C) CHƯƠNG 5 — 7 BÀI TEXT ──────────────────────────────────────────────

-- 5.1 Cấu trúc bài hát (Musical Form)
UPDATE edu_course_lessons SET content = $tva$
<h2>Bài hát cũng có bản thiết kế</h2>
<p>Nghe một bài hát quen, bạn luôn biết trước khoảnh khắc điệp khúc sắp bùng lên — dù chẳng ai báo. Vì sao? Vì bài hát không phải một dòng chảy tuỳ hứng: nó được <strong>xây từ những khối lặp lại theo sơ đồ</strong>, như một ngôi nhà có phòng khách, phòng ngủ, hành lang. Sơ đồ đó gọi là <strong>cấu trúc bài hát</strong> (musical form).</p>
<h3>Vì sao NGƯỜI ĐỆM phải nhìn thấy cấu trúc?</h3>
<p>Người nghe chỉ cần cảm. Nhưng người đệm là <em>người dẫn đường</em>: bạn phải biết trước &ldquo;sắp tới là đoạn gì&rdquo; để chuẩn bị — đoạn nào đánh nhẹ, đoạn nào bung, chỗ nào ngắt để người hát lấy hơi. Đệm mà không nhìn thấy cấu trúc thì như lái xe không biết đường: vẫn chạy được, nhưng giật cục ở mọi khúc cua.</p>
<p>Tin vui: số sơ đồ thông dụng <strong>ít một cách bất ngờ</strong>. Nắm được một sơ đồ là bạn tự nhiên &ldquo;đọc&rdquo; được hàng trăm bài.</p>
<h3>Thử ngay với đôi tai</h3>
<p>Mở một bài bạn thuộc, nghe và <strong>đếm số lần điệp khúc xuất hiện</strong>, để ý trước mỗi lần đó là gì. Bạn sẽ thấy bài hát tự &ldquo;lộ sơ đồ&rdquo; ra — và từ hôm nay, bạn sẽ không bao giờ nghe nhạc theo kiểu cũ nữa.</p>
<blockquote>Bài kế tiếp, ta gọi tên từng khối: Intro, Phiên khúc, Điệp khúc, Cầu nối, Kết.</blockquote>
$tva$ WHERE id = 'd3624d28-47e2-48d3-a1d3-ee7ead6c3de2' AND (content IS NULL OR content = '');

-- 5.3 Bố cục một bài hát thông dụng
UPDATE edu_course_lessons SET content = $tva$
<h2>Sơ đồ "kinh điển" — thuộc một, đọc được trăm bài</h2>
<p>Bạn đã biết tên từng khối. Giờ ghép chúng lại theo cách mà <strong>phần lớn bài nhạc nhẹ</strong> vẫn dùng:</p>
<p style="text-align:center"><strong>Intro → Phiên khúc 1 → Điệp khúc → Phiên khúc 2 → Điệp khúc → Cầu nối → Điệp khúc (bùng) → Kết</strong></p>
<h3>Logic cảm xúc đằng sau</h3>
<ul>
<li><strong>Intro</strong> mở cửa, gợi không khí — thường lấy vòng hợp âm của điệp khúc.</li>
<li><strong>Phiên khúc 1</strong> kể chuyện, cảm xúc còn kìm — đánh nhẹ.</li>
<li><strong>Điệp khúc</strong> lần đầu bung — nhưng chưa phải đỉnh.</li>
<li><strong>Phiên khúc 2</strong> hạ xuống kể tiếp — nhẹ lại, người nghe được &ldquo;thở&rdquo;.</li>
<li><strong>Cầu nối</strong> dồn nén, thường đổi màu hợp âm — chuẩn bị cho cú bùng cuối.</li>
<li><strong>Điệp khúc cuối</strong> là đỉnh của cả bài — đánh đầy đặn nhất, có khi lặp 2 lần.</li>
<li><strong>Kết</strong> hạ màn: chậm dần, thưa dần, một cú quạt cuối ngân hết.</li>
</ul>
<h3>Việc của bạn khi cầm một bài mới</h3>
<p>Đừng vội đàn. Nghe bản thu 1–2 lượt, <strong>vẽ sơ đồ ra giấy</strong> (viết tắt: I – PK1 – ĐK – PK2 – ĐK – CN – ĐK – K). Mất 3 phút, nhưng lúc đệm bạn sẽ luôn biết mình đang ở đâu và điều gì sắp tới — đó chính là sự khác biệt giữa người <em>đánh theo</em> và người <em>dẫn dắt</em>.</p>
$tva$ WHERE id = 'c2a2a5eb-411e-4e0a-a2ed-2a891b5ac970' AND (content IS NULL OR content = '');

-- 5.7 Bố cục mẫu Ballad
UPDATE edu_course_lessons SET content = $tva$
<h2>Bố cục mẫu cho một bài Ballad</h2>
<p>Ballad là điệu &ldquo;kể chuyện&rdquo; — êm, đều, tình cảm. Bí quyết đệm Ballad hay không nằm ở kiểu quạt khó, mà ở việc <strong>cùng một chùm 2, mỗi đoạn đánh một sắc thái</strong>:</p>
<ul>
<li><strong>Intro:</strong> quạt chùm 2 thật nhẹ, hoặc chỉ đánh bass + một nhát mỏng mỗi ô — như vén màn.</li>
<li><strong>Phiên khúc:</strong> chùm 2 nhẹ tay, đều đặn, nhường hoàn toàn cho lời hát. Tay phải nhỏ lại, đừng &ldquo;giành mic&rdquo;.</li>
<li><strong>Điệp khúc:</strong> vẫn chùm 2 nhưng <strong>bung đủ lực</strong> — biên độ quạt rộng hơn, chạm nhiều dây hơn. Người nghe phải cảm được cánh cửa mở ra.</li>
<li><strong>Cầu nối:</strong> kìm lại một nhịp (đánh thưa, thậm chí chỉ giữ bass) rồi <em>đẩy dần</em> — để điệp khúc cuối bùng thật đã.</li>
<li><strong>Kết:</strong> chậm dần ở 2 ô cuối, khép bằng <strong>một cú quạt duy nhất</strong> ngân hết trên hợp âm chủ.</li>
</ul>
<h3>Tập thế nào?</h3>
<p>Lấy vòng C – Am – F – G ở bài Nền tập Ballad, tự quy ước: 4 ô đầu là &ldquo;phiên khúc&rdquo; (nhẹ), 4 ô sau là &ldquo;điệp khúc&rdquo; (bung). Quạt liên tục không dừng tay, chỉ đổi <em>lực</em>. Khi cái nhẹ–mạnh này thành phản xạ, bạn đã có 80% chất Ballad.</p>
$tva$ WHERE id = 'd2c00706-0000-4000-8000-000000000000' AND (content IS NULL OR content = '' OR content LIKE '%⏳%');

-- 5.8 Bố cục mẫu cho một bài Bolero
UPDATE edu_course_lessons SET content = $tva$
<h2>Bố cục mẫu cho một bài Bolero</h2>
<p>Bolero là điệu của <strong>tự sự</strong> — chậm, sâu, từng chữ rơi từng giọt. Cái hay của người đệm Bolero là biết <strong>đổi kiểu tay giữa các đoạn</strong>, và bạn đã học đủ đồ nghề rồi:</p>
<ul>
<li><strong>Intro:</strong> móc kiểu 1 chậm rãi trên vòng hợp âm chính — gợi không khí, có thể chỉ 2–4 ô.</li>
<li><strong>Phiên khúc 1:</strong> <strong>móc kiểu 1</strong> — thưa, để giọng hát kể chuyện.</li>
<li><strong>Phiên khúc 2:</strong> đổi sang <strong>móc kiểu 2</strong> — dày hơn một chút, câu chuyện đậm dần mà người nghe không biết vì sao.</li>
<li><strong>Điệp khúc:</strong> chuyển hẳn sang <strong>quạt</strong> (kiểu quạt ballad cho điệp khúc Bolero bạn đã học) — đây là lúc cảm xúc vỡ ra.</li>
<li><strong>Kết:</strong> quay về móc chậm dần, khép bằng một cú rải cuối ngân trên hợp âm chủ.</li>
</ul>
<h3>Mấu chốt: cú CHUYỂN móc → quạt</h3>
<p>Khoảnh khắc đắt nhất của Bolero là giây chuyển từ móc sang quạt ở điệp khúc. Hãy tập riêng cú chuyển này: 2 ô móc kiểu 2 → 2 ô quạt, lặp đi lặp lại cho tới khi không vấp. Chuyển mượt được cú đó, bài Bolero của bạn nghe &ldquo;có nghề&rdquo; ngay lập tức.</p>
$tva$ WHERE id = '21b2be1b-533a-4d2d-9610-a698e01b31d5' AND (content IS NULL OR content = '');

-- 5.9 Bố cục mẫu Slowrock
UPDATE edu_course_lessons SET content = $tva$
<h2>Bố cục mẫu cho một bài Slowrock</h2>
<p>Slowrock sống bằng <strong>liên 3 dàn trải</strong> — như sóng, lớp này chưa tan lớp khác đã tới. Vì kiểu quạt gần như không đổi suốt bài, sắc thái Slowrock nằm trọn ở <strong>lực tay và độ dày</strong>:</p>
<ul>
<li><strong>Intro:</strong> liên 3 rất nhẹ trên 2–4 ô, có thể chỉ chạm 3–4 dây trên — gợi cái đung đưa trước khi lời vào.</li>
<li><strong>Phiên khúc:</strong> liên 3 nhỏ tiếng, đều tăm tắp. Sức hút của Slowrock là sự <em>kiên nhẫn</em> — đừng vội to.</li>
<li><strong>Điệp khúc:</strong> vẫn liên 3 nhưng <strong>đầy đặn</strong> — quạt hết mặt dây, bass rõ hơn. Con sóng lúc này dâng cao nhất.</li>
<li><strong>Cầu nối:</strong> thu nhỏ lại đột ngột (nhẹ như intro) rồi lớn dần — cú &ldquo;rút sóng để đánh sóng to&rdquo; kinh điển.</li>
<li><strong>Kết:</strong> chậm dần, thưa dần, kết bằng một cú quạt ngân dài — để dư âm tự tắt.</li>
</ul>
<h3>Tập thế nào?</h3>
<p>Dùng bài Nền tập Slowrock (vòng Am – Dm – E – Am): quạt liên 3 liên tục, cứ 4 ô lại đổi lực nhẹ → đầy → nhẹ. Giữ được tiếng đều khi đổi lực — đó là kỹ năng ăn tiền của Slowrock.</p>
$tva$ WHERE id = 'd2c00708-0000-4000-8000-000000000000' AND (content IS NULL OR content = '' OR content LIKE '%⏳%');

-- 5.10 Bố cục mẫu Valse
UPDATE edu_course_lessons SET content = $tva$
<h2>Bố cục mẫu cho một bài Valse</h2>
<p>Valse chắc và xoay tròn trên 3 phách. Bạn đã có trong tay <strong>hai mẫu</strong> — nốt đen (Bùm chát chát) và có chùm 2 — cộng tiết tấu trộn. Bố cục Valse chính là nghệ thuật <strong>xếp hai mẫu đó đúng chỗ</strong>:</p>
<ul>
<li><strong>Intro:</strong> Bùm chát chát gọn gàng 2–4 ô — đặt cái khung 3/4 vào tai người nghe ngay từ đầu.</li>
<li><strong>Phiên khúc:</strong> mẫu <strong>nốt đen</strong> — chắc, rắn rỏi, làm trụ cho lời hát.</li>
<li><strong>Điệp khúc:</strong> chuyển sang mẫu <strong>có chùm 2</strong> — câu nhạc lập tức mềm và nhún nhảy hơn, đúng cú &ldquo;mở&rdquo; mà bạn học ở bài Mẫu Valse chùm 2.</li>
<li><strong>Đoạn cao trào / lần điệp khúc cuối:</strong> dùng <strong>tiết tấu trộn</strong> Đen – đon đon – đon đon — vừa vững vừa bay.</li>
<li><strong>Kết:</strong> về lại Bùm chát chát chậm dần, khép bằng <strong>một cú quạt ở phách 1</strong> ngân hết — rất "Valse".</li>
</ul>
<h3>Tập thế nào?</h3>
<p>Trên bài Nền tập Valse (C – F – G – C): 4 ô nốt đen → 4 ô chùm 2 → 4 ô trộn, xoay vòng không dừng tay. Đổi mẫu mà nhịp không xô — bạn đã sẵn sàng đệm trọn một bài Valse có bố cục.</p>
$tva$ WHERE id = 'd2c00709-0000-4000-8000-000000000000' AND (content IS NULL OR content = '' OR content LIKE '%⏳%');

-- 5.11 Bài tập tự luận: phân tích bố cục bài hát
UPDATE edu_course_lessons SET content = $tva$
<h2>Bài tập: tự phân tích bố cục một bài hát</h2>
<p>Đến lượt bạn làm điều mà người đệm chuyên nghiệp nào cũng làm trước khi chơi một bài mới.</p>
<h3>Đề bài</h3>
<ol>
<li><strong>Chọn 1 bài hát bạn yêu thích</strong> (bất kỳ — miễn là bạn nghe đi nghe lại không chán).</li>
<li>Nghe trọn bài 2 lượt, <strong>vẽ sơ đồ bố cục</strong> ra giấy: I – PK1 – ĐK – PK2 – ĐK – CN – ĐK – K (bài của bạn có thể khác sơ đồ chuẩn — cứ ghi đúng cái bạn nghe thấy).</li>
<li>Xác định <strong>bài này hợp điệu gì</strong> (Ballad / Valse / Slowrock / Bolero) và vì sao — dùng mẹo gõ đùi ở bài Chọn điệu.</li>
<li>Với <strong>từng đoạn</strong>, ghi cách bạn định chơi: kiểu quạt/móc nào, nhẹ hay bung. Một dòng mỗi đoạn là đủ.</li>
</ol>
<h3>Nộp bài</h3>
<p>Chép sơ đồ + các ghi chú vào <strong>Nhật ký luyện tập</strong> (hoặc chụp tờ giấy gửi thầy qua nhóm lớp). Thầy sẽ xem và góp ý bố cục của bạn trước khi bạn đệm thật.</p>
<blockquote>Làm xong bài này, bạn đã có bản thiết kế hoàn chỉnh đầu tiên do chính mình vẽ — sang Chương 6, ta biến nó thành tiếng đàn thật.</blockquote>
$tva$ WHERE id = 'a3a059a1-7b85-4505-962a-aba56892d28f' AND (content IS NULL OR content = '');

-- ─── (D) TIER: học thử FREE = 1.1–1.6, còn lại BASIC ────────────────────────

UPDATE edu_course_lessons SET tier = 'basic'
 WHERE module_id IN ('067ae3bb-7812-4485-8fa2-077fccaea2bf','271e9988-0e3b-4171-a829-139a6b399263',
                     'd2000055-0000-4000-8000-000000000055','d2000044-0000-4000-8000-000000000044',
                     'a844e611-71a9-48c1-84cf-a645b8c79d08','974b0073-61d3-4b76-857a-e4f01c738d42');

UPDATE edu_course_lessons SET tier = 'free'
 WHERE id IN ('aca3b657-b2c8-46dd-ac1e-5fe8b7828158',  -- 1.1 Chào mừng
              'd2c00103-0000-4000-8000-000000000000',  -- 1.2 Chùm nốt là gì
              '1bc21a87-d39f-48ee-a62c-a753902631cf',  -- 1.3 Chùm 2
              'df4ddd1b-768b-4d74-8b9a-40a310ac99e9',  -- 1.4 Quạt chùm 2
              '2f6b416d-7d4f-4bd0-8c13-0e4ad2e11829',  -- 1.5 Happy Birthday
              '4692e092-3591-4dda-99d6-265b82e0d34c'); -- 1.6 Jingle Bells

NOTIFY pgrst, 'reload schema';
