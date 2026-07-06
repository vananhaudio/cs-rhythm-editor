-- ĐỆM HÁT TRÌNH ĐỘ 2 — CHẠY TẤT CẢ (khung + text + video + gảy theo). Idempotent.

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
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00106-0000-4000-8000-000000000000', '067ae3bb-7812-4485-8fa2-077fccaea2bf', 'Bài 1.4 — Thực hành gõ chùm 2', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> công cụ app 🎛 (đếm 1&2& + gõ theo)</p>', 3, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
UPDATE edu_course_lessons SET module_id = '067ae3bb-7812-4485-8fa2-077fccaea2bf', order_index = 4, title = 'Bài 1.5 — Thực hành quạt chùm 2 (xuống–lên)' WHERE id = 'df4ddd1b-768b-4d74-8b9a-40a310ac99e9';
UPDATE edu_course_lessons SET module_id = '067ae3bb-7812-4485-8fa2-077fccaea2bf', order_index = 5, title = 'Bài 1.6 — Gảy theo: Happy Birthday — quạt chùm 2' WHERE id = '2f6b416d-7d4f-4bd0-8c13-0e4ad2e11829';
UPDATE edu_course_lessons SET module_id = '067ae3bb-7812-4485-8fa2-077fccaea2bf', order_index = 6, title = 'Bài 1.7 — Gảy theo: Jingle Bells — quạt chùm 2' WHERE id = '4692e092-3591-4dda-99d6-265b82e0d34c';
UPDATE edu_course_lessons SET module_id = '067ae3bb-7812-4485-8fa2-077fccaea2bf', order_index = 7, title = 'Bài 1.8 — Điệu Ballad là gì' WHERE id = '2b73cd3b-cc6e-4ba9-baff-9ef6acc984ac';
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00302-0000-4000-8000-000000000000', '067ae3bb-7812-4485-8fa2-077fccaea2bf', 'Bài 1.9 — Mẫu quạt Ballad cơ bản', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> video thầy quay 🎬</p>', 8, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00303-0000-4000-8000-000000000000', '067ae3bb-7812-4485-8fa2-077fccaea2bf', 'Bài 1.10 — Nền tập Ballad', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> công cụ app 🎛 (Groove Lab điệu Ballad)</p>', 9, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00304-0000-4000-8000-000000000000', '067ae3bb-7812-4485-8fa2-077fccaea2bf', 'Bài 1.11 — Gảy theo: Ode to Joy', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> gảy theo 🎸 (Strum Score) — native song-ode-ballad</p>', 10, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00109-0000-4000-8000-000000000000', '067ae3bb-7812-4485-8fa2-077fccaea2bf', 'Bài 1.12 — Checkpoint Chương 1', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> quiz 📝</p>', 11, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;

-- ===== Chương 2: Điệu Valse =====
INSERT INTO edu_modules (id, course_id, name, order_index) VALUES ('271e9988-0e3b-4171-a829-139a6b399263', 'c7ab2fcb-aff1-4485-a381-4edc83e4a62b', 'Chương 2: Điệu Valse', 1)
ON CONFLICT (id) DO UPDATE SET course_id = EXCLUDED.course_id, name = EXCLUDED.name, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00600-0000-4000-8000-000000000000', '271e9988-0e3b-4171-a829-139a6b399263', 'Bài 2.1 — Tính chất Valse', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text)</p>', 0, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00601-0000-4000-8000-000000000000', '271e9988-0e3b-4171-a829-139a6b399263', 'Bài 2.2 — Nhịp 3/4: mạnh — nhẹ — nhẹ', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text)</p>', 1, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00602-0000-4000-8000-000000000000', '271e9988-0e3b-4171-a829-139a6b399263', 'Bài 2.3 — Mẫu Valse nốt đen', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> video thầy quay 🎬</p>', 2, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00603-0000-4000-8000-000000000000', '271e9988-0e3b-4171-a829-139a6b399263', 'Bài 2.4 — Mẫu Valse có chùm 2', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> video thầy quay 🎬</p>', 3, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00604-0000-4000-8000-000000000000', '271e9988-0e3b-4171-a829-139a6b399263', 'Bài 2.5 — Trộn nốt đen và chùm 2 trong Valse', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> video / bài giảng</p>', 4, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00605-0000-4000-8000-000000000000', '271e9988-0e3b-4171-a829-139a6b399263', 'Bài 2.6 — Nền tập Valse', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> công cụ app 🎛 (Groove Lab điệu Valse)</p>', 5, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00606-0000-4000-8000-000000000000', '271e9988-0e3b-4171-a829-139a6b399263', 'Bài 2.7 — Gảy theo: 1 bài Valse (mọi lứa tuổi — chọn sau)', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> gảy theo 🎸 (Strum Score)</p>', 6, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;

-- ===== Chương 3: Điệu Slowrock =====
INSERT INTO edu_modules (id, course_id, name, order_index) VALUES ('d2000055-0000-4000-8000-000000000055', 'c7ab2fcb-aff1-4485-a381-4edc83e4a62b', 'Chương 3: Điệu Slowrock', 2)
ON CONFLICT (id) DO UPDATE SET course_id = EXCLUDED.course_id, name = EXCLUDED.name, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00108-0000-4000-8000-000000000000', 'd2000055-0000-4000-8000-000000000055', 'Bài 3.1 — Nghe thử chùm 3 và liên 3 — làm quen', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng + audio mẫu</p>', 0, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00501-0000-4000-8000-000000000000', 'd2000055-0000-4000-8000-000000000055', 'Bài 3.2 — Tính chất Slowrock', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text)</p>', 1, false, 'free')
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
    'd2c00106-0000-4000-8000-000000000000',
    'd2c00302-0000-4000-8000-000000000000',
    'd2c00303-0000-4000-8000-000000000000',
    'd2c00304-0000-4000-8000-000000000000',
    'd2c00109-0000-4000-8000-000000000000',
    'd2c00600-0000-4000-8000-000000000000',
    'd2c00601-0000-4000-8000-000000000000',
    'd2c00602-0000-4000-8000-000000000000',
    'd2c00603-0000-4000-8000-000000000000',
    'd2c00604-0000-4000-8000-000000000000',
    'd2c00605-0000-4000-8000-000000000000',
    'd2c00606-0000-4000-8000-000000000000',
    'd2c00108-0000-4000-8000-000000000000',
    'd2c00501-0000-4000-8000-000000000000',
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

-- ==================== db/dh2_content_ch1.sql ====================
-- ============================================================================
-- DH2 — Nội dung TEXT còn lại của Chương 1 sau khi gộp/bỏ rườm rà.
-- Chỉ còn: "Chùm nốt là gì" (gộp cả phần 'từ nốt đen') + "Nghe thử chùm 3" (đã dời sang Slowrock).
-- Phong cách "dài mà cuốn" nhưng gọn. Xưng "bạn". Idempotent.
-- ============================================================================

-- Chùm nốt là gì — chia nhỏ phách  (d2c00103) — gộp motivation "từ nốt đen" + định nghĩa
UPDATE edu_course_lessons SET content =
'<h2>Chùm nốt là gì?</h2>
<p>Bạn còn nhớ cảm giác lần đầu đệm trọn một bài ở Trình độ 1 chứ? Tay phải quạt đều &ldquo;chát – chát – chát&rdquo;, và bạn thấy tự hào: <em>&ldquo;Mình đệm được rồi!&rdquo;</em> Nhưng nghe lại, có gì đó… hơi trống, hơi đều đều, hơi <strong>phẳng</strong>. Đúng, mà chưa <em>đã</em>.</p>
<p>Cái &ldquo;phẳng&rdquo; ấy đến từ một điều đơn giản: ở Trình độ 1, <strong>mỗi phách bạn chỉ chơi một tiếng</strong> — một cú quạt. Như đi bộ từng bước đều, chắc, nhưng đơn điệu.</p>
<blockquote>Bí quyết để tiếng đàn &ldquo;đầy&rdquo; và rộn ràng hơn — <em>mà nhịp vẫn không loạn</em> — là <strong>chia nhỏ mỗi phách thành nhiều tiếng đều nhau</strong>. Nhóm nhiều tiếng nhỏ ấy gọi là <strong>chùm nốt</strong>.</blockquote>

<h3>Định nghĩa gọn</h3>
<p><strong>Chùm nốt</strong> = một nhóm nốt nhỏ, <strong>đều nhau</strong>, cùng nằm gọn trong <strong>một phách</strong>. Hãy hình dung mỗi phách là một chiếc hộp cố định: thay vì bỏ vào 1 viên bi, ta bỏ vào 2 hoặc 3 viên nhỏ hơn, xếp thật đều. Hộp không to ra — chỉ bên trong dày hơn.</p>
<table>
<thead><tr><th>Loại</th><th>Số tiếng / phách</th><th>Đếm</th></tr></thead>
<tbody>
<tr><td><strong>Chùm 2</strong> (móc đơn)</td><td>2 tiếng</td><td>&ldquo;1 và&rdquo;</td></tr>
<tr><td><strong>Chùm 3</strong> (liên 3)</td><td>3 tiếng</td><td>&ldquo;1 2 3&rdquo;</td></tr>
</tbody>
</table>
<p>Điểm mấu chốt: dù chia 2 hay 3, cả chùm vẫn <strong>chỉ chiếm đúng một phách</strong> — nhịp của bài <em>không hề nhanh lên</em>. Đây là chỗ nhiều người tự học vấp: chia phách rồi vô thức đàn nhanh dần, loạn nhịp. Bạn thì đã biết trước cái bẫy đó.</p>
<blockquote>Ở Trình độ 2 này ta bắt đầu với <strong>chùm 2</strong> — và chỉ vài bước nữa thôi, bạn sẽ quạt được một bài thật bằng chính nó.</blockquote>'
WHERE id = 'd2c00103-0000-4000-8000-000000000000';

-- Nghe thử chùm 3 và liên 3 — làm quen  (d2c00108) — nay là bài MỞ ĐẦU chương Slowrock
UPDATE edu_course_lessons SET content =
'<h2>Làm quen với chùm 3</h2>
<p>Suốt phần đầu khoá, bạn đã thân với <strong>chùm 2</strong> — chia một phách làm đôi, tươi tắn như bước đi trái‑phải. Giờ ta gặp người anh em của nó: <strong>chùm 3</strong> — chia mỗi phách thành <strong>ba tiếng đều nhau</strong>, nhạc lý gọi là <strong>liên 3</strong>. Đây chính là trái tim của điệu Slowrock.</p>
<table>
<thead><tr><th></th><th>Chia mấy phần</th><th>Đếm</th><th>Cảm giác</th></tr></thead>
<tbody>
<tr><td><strong>Chùm 2</strong></td><td>2</td><td>&ldquo;1 và&rdquo;</td><td>bước đi, tươi, dứt khoát</td></tr>
<tr><td><strong>Chùm 3</strong></td><td>3</td><td>&ldquo;1 2 3&rdquo;</td><td>lắc lư, dàn trải, đung đưa</td></tr>
</tbody>
</table>
<p>Thử ngay: đọc &ldquo;<strong>một‑và, hai‑và</strong>&rdquo; — nghe thẳng thớm như sải bước. Giờ đổi sang &ldquo;<strong>một‑hai‑ba, một‑hai‑ba</strong>&rdquo; — lập tức có gì đó <em>tròn hơn, mềm hơn</em>, như con thuyền dập dềnh, như đưa võng.</p>
<blockquote>Bài này bạn chỉ cần <strong>nghe và cảm</strong> ra &ldquo;chia hai&rdquo; khác &ldquo;chia ba&rdquo; ở đâu — thế là đủ. Các bài kế trong chương sẽ luyện chùm 3 tới nơi tới chốn để bạn chơi được điệu Slowrock đong đưa.</blockquote>'
WHERE id = 'd2c00108-0000-4000-8000-000000000000';

NOTIFY pgrst, 'reload schema';

-- ==================== db/dh2_content_dieu.sql ====================
-- ============================================================================
-- DH2 — Nội dung CỤM TEXT: Tính chất & kỹ thuật các điệu (theo ý chính của thầy)
-- Ballad · Bolero · Slowrock (tính chất + liên 3 + dàn trải) · Valse (tính chất + trộn chùm 2)
-- Phong cách "dài mà cuốn". Xưng "bạn". Idempotent.
-- ============================================================================

-- ── Điệu Ballad là gì  (2b73cd3b, ex) — GỘP 'Ballad là gì' + 'Ballad dùng chùm 2'; đứng SAU khi đã chơi HBD/Jingle ──
UPDATE edu_course_lessons SET content =
'<h2>Điệu Ballad là gì? — Và bạn vừa chơi nó đấy!</h2>
<p>Bạn vừa quạt chùm 2 và chơi trọn <em>Happy Birthday</em>, <em>Jingle Bells</em> — xin chúc mừng! Nhưng có một bí mật nho nhỏ: <strong>bạn vừa đệm điệu Ballad mà không hề hay biết.</strong></p>
<p><strong>Ballad</strong> là điệu đệm <strong>dịu dàng, lãng mạn</strong> — điệu của những bản tình ca, của những tối ôm đàn hát khẽ. Và chính cái chùm 2 đều đều bạn vừa quạt — đó là Ballad ở dạng cơ bản nhất.</p>
<h3>Điều gì làm nên chất Ballad?</h3>
<ul>
<li><strong>Đều, không giật</strong> — chùm 2 chạy mượt như hơi thở: ↓↑ ↓↑ ↓↑ ↓↑, không cú nào bật gắt phá vỡ sự êm ả.</li>
<li><strong>Tempo gần bằng nhịp tim</strong> — khi tiếng đàn đập cùng nhịp trái tim người nghe, họ vô thức &ldquo;đồng bộ&rdquo; theo và thấy dễ chịu, thấy tình. Đó không phải phép màu, là sinh học.</li>
<li><strong>Nhấn phách 1 &amp; 3 thật khẽ</strong> — đủ giữ nhịp, không đủ làm giật.</li>
</ul>
<h3>Ta học kiểu Ballad nào?</h3>
<p>Có một điều ít ai nói: <strong>&ldquo;Ballad&rdquo; không phải một kiểu đàn cố định</strong> — người ta quạt kiểu này, rải kiểu kia, cả một họ hàng đông đúc. Ôm hết thì rối và nản. Nên khoá này ta khôn ngoan: chỉ chọn <strong>vài kiểu phổ biến, dễ dùng nhất</strong>, bắt đầu từ chùm 2 (bạn đã có). Các bài kế sẽ cho bạn xem thầy đàn mẫu và tập kỹ hơn.</p>
<blockquote>Ballad dạy bạn một chân lý người mới hay quên: <strong>đôi khi, đều đặn chính là đỉnh cao.</strong> Không phải lúc nào &ldquo;nhiều kỹ thuật&rdquo; cũng bằng một nhịp đều biết nâng niu người nghe.</blockquote>'
WHERE id = '2b73cd3b-cc6e-4ba9-baff-9ef6acc984ac';

-- ── Ch4 Bolero: Tính chất Bolero  (d2c00400) ──
UPDATE edu_course_lessons SET content =
'<h2>Tính chất Bolero: đậm đà và da diết</h2>
<p>Nếu Ballad là lời thủ thỉ bên tai, thì Bolero là <strong>tiếng lòng</strong> — đậm đà, chắc chắn, có chiều sâu của những câu chuyện đời. Đây là điệu đã ru bao thế hệ người Việt, thấm trong nhạc vàng, trong những đêm khuya ai đó ôm đàn hát về một mối tình dang dở.</p>
<h3>Bolero đứng trên nền chùm 3</h3>
<p>Còn nhớ người anh em &ldquo;đung đưa&rdquo; ta ghé thăm ở Chương 1 chứ? Bolero dựng trên nền <strong>chùm 3</strong> — mỗi phách chia ba. Nhưng Bolero không dùng chùm 3 một cách trơn tru bình thường. Nó có một cú &ldquo;bẻ&rdquo; rất riêng, và chính cú bẻ ấy làm nên chữ ký không thể lẫn của điệu này.</p>
<h3>Chữ ký âm thanh: &ldquo;Bùm… chát chát&rdquo;</h3>
<p>Đây là thứ khiến ai nghe cũng nhận ra ngay đó là Bolero. Ta gọi nó là <strong>chùm 3 lệch phải</strong>, và nếu đọc thành tiếng, nó nghe như thế này:</p>
<div style="background:#F4F4F5;border-radius:8px;padding:16px;margin:14px 0;font-size:19px;text-align:center;letter-spacing:.03em"><b>BÙM</b> &nbsp;……&nbsp; <b>chát&nbsp;chát</b></div>
<p>Đầu phách là một cú <strong>&ldquo;Bùm&rdquo;</strong> — tiếng bass trầm, chắc nịch, buông xuống rồi <em>ngân chờ</em> một nhịp. Cái khoảng lặng ngắn ngủi sau tiếng Bùm ấy — cái sự &ldquo;chờ&rdquo; — chính là chỗ da diết nhất. Rồi ngay sau đó, hai tiếng <strong>&ldquo;chát chát&rdquo;</strong> gảy dồn lại, gọn gàng, dứt điểm.</p>
<p><strong>Bùm</strong> (chờ…) <strong>chát chát</strong>. Nặng rồi nhẹ, chờ rồi dồn. Cái sức nặng dồn về <em>phía sau</em> của phách — đó là ý nghĩa của hai chữ &ldquo;lệch phải&rdquo; — tạo ra cảm giác <strong>nghẹn ngào, dùng dằng</strong> rất đặc trưng, như một tiếng thở dài.</p>
<blockquote>Chỉ cần bạn cảm được cái nhịp &ldquo;Bùm — chờ — chát chát&rdquo; ấy trong lồng ngực, bạn đã nắm được linh hồn Bolero. Bài kế tiếp ta sẽ mổ xẻ đúng cú lệch phải này trên cần đàn.</blockquote>'
WHERE id = 'd2c00400-0000-4000-8000-000000000000';

-- ── Ch5 Slowrock: Tính chất Slowrock  (d2c00500) ──
UPDATE edu_course_lessons SET content =
'<h2>Tính chất Slowrock: đong đưa và cuộn tròn</h2>
<p>Có những bài hát khiến bạn khẽ lắc lư người mà chẳng hay biết, mắt lim dim, như đang được ai đó đưa võng. Rất có thể đó là <strong>Slowrock</strong> đang làm việc.</p>
<h3>Cũng là chùm 3, nhưng một tính cách khác</h3>
<p>Điều thú vị: Slowrock cũng đứng trên nền <strong>chùm 3</strong> — giống Bolero. Cùng một nguyên liệu, vậy mà hai điệu nghe khác nhau một trời một vực. Vì sao?</p>
<p>Bolero <em>bẻ</em> chùm 3 cho nó chắc và da diết (Bùm — chát chát). Còn Slowrock để chùm 3 chạy <strong>tròn trịa và trôi chảy</strong>: ba tiếng đều nhau nối nhau liên tục, không bẻ, không giật, cuộn hết vòng này sang vòng khác.</p>
<div style="background:#EEF2FF;border-radius:8px;padding:16px;margin:14px 0;font-size:17px;text-align:center;letter-spacing:.03em">một-hai-ba &nbsp; một-hai-ba &nbsp; một-hai-ba …&nbsp;&nbsp;<span style="font-size:13px;color:#71717A">(cuộn không ngừng)</span></div>
<h3>Cảm giác: sóng và võng</h3>
<p>Cái vòng ba tiếng lặp lại đều đặn ấy tạo ra một chuyển động <strong>đong đưa, cuộn tròn</strong> — như sóng dập dềnh mạn thuyền, như cánh võng đưa qua đưa lại. Nó chậm, nó rộng, nó dàn trải, chừa nhiều khoảng cho tiếng ngân và cho cảm xúc thấm.</p>
<blockquote>Nếu Bolero là tiếng thở dài dùng dằng, thì Slowrock là sự buông mình êm ái. Cùng là chùm 3, một điệu dạy bạn cách &ldquo;nén&rdquo;, một điệu dạy bạn cách &ldquo;trôi&rdquo;. Nắm được cả hai, bạn nắm trọn sức mạnh biểu cảm của việc chia phách làm ba.</blockquote>'
WHERE id = 'd2c00500-0000-4000-8000-000000000000';

-- ── Ch5 Slowrock: Liên 3 là gì trong đệm hát  (d2c00501) ──
UPDATE edu_course_lessons SET content =
'<h2>Liên 3 — giờ ta ở lại thật lâu</h2>
<p>Ở Chương 1, ta mới chỉ <em>ghé thăm</em> chùm 3 rồi vội đi. Mình đã hứa sẽ quay lại. Bây giờ chính là lúc ấy — ta sẽ ở lại với nó cho tới khi nó nằm gọn trong đôi tay bạn.</p>
<p><strong>Liên 3</strong> (chính là chùm 3) nghĩa là chia <strong>một phách thành ba tiếng thật đều nhau</strong>. Không phải hai. Không phải bốn. Đúng ba — và ba tiếng ấy phải <em>đều tăm tắp</em>.</p>
<h3>Cái bẫy lớn nhất của người quen chùm 2</h3>
<p>Đây là chỗ gần như ai cũng vấp, nên bạn hãy đề phòng trước. Vì tai và tay bạn đã quen &ldquo;chia đôi&rdquo; (chùm 2), khi chuyển sang chia ba, chúng có xu hướng lén biến ba tiếng đều thành kiểu <strong>&ldquo;hai dài một ngắn&rdquo;</strong> hoặc &ldquo;một mạnh hai lí nhí&rdquo;. Nghe thì hao hao, nhưng nó <em>mất chất</em> — cái đong đưa tròn trịa biến thành khập khiễng.</p>
<h3>Cách luyện cho ba tiếng thật đều</h3>
<p>Hãy đếm thành tiếng, dàn ba âm tiết ra thật cân:</p>
<div style="background:#F4F4F5;border-radius:8px;padding:14px 16px;margin:14px 0;font-size:18px;text-align:center;letter-spacing:.05em"><b>một – hai – ba</b> &nbsp; <b>một – hai – ba</b></div>
<p>Mẹo hình dung: tưởng tượng bạn đang lăn một hòn bi tròn quanh vành một chiếc bát — nó lăn <em>đều</em>, không có góc, không khựng chỗ nào. Ba tiếng liên 3 phải trôi mượt như vậy. Hãy vỗ tay hoặc gõ đùi theo &ldquo;một-hai-ba&rdquo; đều đặn, thật chậm, trước khi đưa lên dây đàn.</p>
<blockquote>Ba tiếng đều nhau nghe thì nhỏ nhặt, nhưng nó là <strong>viên gạch chung</strong> của cả Slowrock lẫn Bolero. Đặt được viên gạch này cho vuông vức, bạn mở khoá được cả hai điệu da diết nhất mà người Việt yêu.</blockquote>'
WHERE id = 'd2c00501-0000-4000-8000-000000000000';

-- ── Ch5 Slowrock: Cảm giác dàn trải của Slowrock  (d2c00503) ──
UPDATE edu_course_lessons SET content =
'<h2>Vì sao Slowrock nghe &ldquo;rộng&rdquo; đến thế?</h2>
<p>Bạn đã đếm được liên 3 cho đều. Nhưng đếm đúng thôi chưa đủ để ra <em>chất</em> Slowrock. Có một thứ nữa — thứ khiến điệu này nghe mênh mông, dàn trải, như trải rộng ra một khoảng trời. Ta cùng chạm vào nó.</p>
<h3>Không quạt gắt — mà để tiếng dàn ra</h3>
<p>Bí mật đầu tiên: trong Slowrock, ba tiếng của liên 3 thường không bị quạt <em>chát chát</em> gọn lỏn. Thay vào đó, người ta hay <strong>rải</strong> chúng ra — buông từng tiếng cho ngân, cho lan. Mỗi tiếng như một vòng sóng loang trên mặt nước, chưa kịp tắt thì vòng sau đã tới.</p>
<h3>Chậm rãi tạo ra không gian</h3>
<p>Bí mật thứ hai: Slowrock <em>chậm</em>. Và cái chậm ấy không phải sự thiếu sót — nó là <strong>chủ đích</strong>. Giữa các tiếng đàn có nhiều khoảng ngân, nhiều &ldquo;chỗ trống&rdquo;. Nhưng khoảng trống trong âm nhạc không phải là sự im lặng vô nghĩa; nó là chỗ để cảm xúc <em>thở</em>, để lời hát thấm, để người nghe kịp chìm vào.</p>
<blockquote>Slowrock dạy bạn một bài học ngược đời mà sâu sắc: <strong>đôi khi, ít nốt hơn lại chứa nhiều cảm xúc hơn.</strong> Đừng vội lấp đầy mọi khoảng trống. Hãy để tiếng đàn dàn ra, cuộn tròn, và tin vào sức mạnh của sự chậm rãi.</blockquote>
<p>Khi bạn buông được đôi tay, thôi không &ldquo;cố&rdquo; nữa mà để tiếng đàn tự trôi — đó là lúc bạn thật sự chơi được Slowrock.</p>'
WHERE id = 'd2c00503-0000-4000-8000-000000000000';

-- ── Ch6 Valse: Tính chất Valse  (d2c00600) ──
UPDATE edu_course_lessons SET content =
'<h2>Tính chất Valse: chắc chắn và rắn rỏi</h2>
<p>Bạn đã cảm được cái &ldquo;xoay&rdquo; của nhịp 3/4 — <strong>MẠNH</strong>-nhẹ-nhẹ. Giờ ta khoác cho cái nhịp xoay ấy một tính cách. Và tính cách của Valse có thể khiến bạn bất ngờ: nó không mềm oặt như ta tưởng về những điệu nhảy cổ điển, mà ngược lại — <strong>chắc chắn, rắn rỏi, dứt khoát</strong>.</p>
<h3>Hãy nhìn người ta nhảy Valse</h3>
<p>Muốn hiểu chất của một điệu, cứ nhìn người ta cử động theo nó. Người nhảy Valse di chuyển thế nào? <strong>Rất dứt khoát.</strong> Từng bước gọn gàng, rõ ràng, đặt xuống là chắc, nhấc lên là ngay — không nhoè, không lê. Trong âm nhạc, kiểu chuyển động sắc nét, tách bạch ấy có một cái tên: <strong>staccato</strong> — nốt gọn, ngắt rõ.</p>
<h3>Nên tiếng đàn Valse cơ bản cũng phải &ldquo;chắc&rdquo;</h3>
<p>Vì thế, mẫu Valse nền tảng thường dùng <strong>nốt đen</strong> — mỗi phách một tiếng, gọn và rõ — với phách 1 nhấn chắc như một cú giậm gót:</p>
<div style="background:#F4F4F5;border-radius:8px;padding:14px 16px;margin:14px 0;font-size:17px;text-align:center;letter-spacing:.04em"><b>BÙM</b> – chát – chát &nbsp;|&nbsp; <b>BÙM</b> – chát – chát &nbsp;<span style="font-size:13px;color:#71717A">(gọn, dứt khoát)</span></div>
<p>Bass chắc ở phách 1, hai cú gọn ở phách 2 và 3. Tất cả <em>sắc nét</em>, không nhoè vào nhau.</p>
<blockquote>Đây là nét duyên riêng của Valse: chính sự <strong>rắn rỏi, dứt khoát</strong> ấy lại tạo nên vẻ <em>sang trọng, quý phái</em> — khác hẳn cái mềm mại của Ballad hay cái dập dềnh của Slowrock. Ở Valse, chắc chắn chính là đẹp.</blockquote>'
WHERE id = 'd2c00600-0000-4000-8000-000000000000';

-- ── Ch6 Valse: Trộn nốt đen và chùm 2 trong Valse  (d2c00604) ──
UPDATE edu_course_lessons SET content =
'<h2>Cho Valse biết nhún nhảy</h2>
<p>Mẫu Valse nốt đen bạn vừa học rất chắc, rất rõ — nhưng nếu chơi <em>y hệt vậy</em> suốt cả bài, đôi lúc nó hơi &ldquo;cứng&rdquo;, hơi nghiêm nghị. Vậy làm sao để giữ được cái rắn rỏi sang trọng của Valse, mà vẫn cho nó đôi chút bay bổng, cuốn hút? Câu trả lời quay về đúng người bạn cũ của chúng ta: <strong>chùm 2</strong>.</p>
<h3>Thêm chùm 2, điệu liền &ldquo;mềm&rdquo; ra</h3>
<p>Thay vì mỗi phách chỉ một nốt đen gọn lỏn, ta chèn <strong>chùm 2</strong> vào một vài phách — chia đôi phách ấy thành ↓↑. Chỉ một thay đổi nhỏ, mà cả điệu đổi khác: nó <strong>nhún nhảy hơn, mềm hơn, cuốn hút hơn</strong>. Cái staccato dứt khoát được điểm thêm những cú vuốt nhẹ nhàng, khiến bước valse như <em>lượn</em> thay vì chỉ <em>bước</em>.</p>
<h3>Và đây là chỗ đắt giá nhất</h3>
<p>Bạn có nhớ bài học <em>chọn sắc thái theo từng đoạn</em> không? Đây chính là lúc dùng nó:</p>
<blockquote>Giữ mẫu <strong>nốt đen chắc chắn cho phiên khúc</strong> (khi cần sự vững vàng, kể chuyện), rồi <strong>chuyển sang chùm 2 nhún nhảy cho điệp khúc</strong> (khi cần bung ra, cuốn hút, dâng cảm xúc). Cùng một điệu Valse, hai sắc thái — và bài hát của bạn lập tức có tầng lớp, có chỗ ghìm chỗ bay.</blockquote>
<p>Đó là bí quyết để điệu Valse của bạn không đều đều một màu, mà biết <em>kể chuyện</em>: chắc chắn khi cần chững chạc, và nhún nhảy khi cần thăng hoa.</p>'
WHERE id = 'd2c00604-0000-4000-8000-000000000000';

NOTIFY pgrst, 'reload schema';

-- ==================== db/dh2_content_ch7_8.sql ====================
-- ============================================================================
-- DH2 — Nội dung CỤM TEXT (ít phụ thuộc gu điệu): Ch7 Bố cục (4) + Ch8 Áp dụng (3)
--        + bài nhạc lý nhịp 3/4 của Ch6 Valse (1). Phong cách "dài mà cuốn".
-- Các bài "tính chất điệu" và "bố cục mẫu theo bài" để dành khi có ý chính của thầy.
-- ============================================================================

-- ── Ch7: Intro — Phiên khúc — Điệp khúc — Cầu nối — Kết  (d2c00701) ──
UPDATE edu_course_lessons SET content =
'<h2>Bài hát nào cũng là một hành trình có bố cục</h2>
<p>Bạn hãy nhớ lại lần gần nhất nghe một bài mình yêu. Có phải mở đầu là một đoạn dạo êm êm, rồi giọng hát vào kể lể tâm tình, rồi bỗng tới một câu mà <em>cả phòng karaoke gào lên</em>, rồi lắng lại, rồi kết? Bạn vừa mô tả — mà không hề biết — <strong>bố cục</strong> của một bài hát. Ai cũng <em>cảm</em> được nó. Nhưng người biết đệm thì phải <em>gọi tên</em> được nó. Vì gọi tên được, bạn mới đệm chủ động thay vì chạy theo.</p>
<p>Một bài phổ thông thường có 5 phần, như 5 chặng của một chuyến đi:</p>
<h3>Intro — mở màn</h3>
<p>Đoạn dạo đầu, thường không lời. Nhiệm vụ của nó là <em>dựng không khí</em> và báo cho người nghe biết: sắp vào bài rồi đấy. Với người đệm, đây là chỗ bạn &ldquo;đặt nhịp&rdquo; cho cả bài.</p>
<h3>Phiên khúc — kể chuyện</h3>
<p>Đoạn hát chính đầu tiên (verse). Đây là lúc bài hát <em>thủ thỉ</em>, đưa thông tin, dẫn dắt. Cảm xúc còn ghìm lại, chưa bung. Người đệm ở đây nên <strong>nhẹ tay</strong>, nhường sân khấu cho giọng hát.</p>
<h3>Điệp khúc — cao trào</h3>
<p>Đoạn ai cũng thuộc, câu hát &ldquo;đắt&rdquo; nhất, nơi cảm xúc <em>vỡ oà</em> (chorus). Đây là đỉnh của con dốc. Người đệm phải <strong>bung ra</strong>: đầy hơn, mạnh hơn, chắc hơn — để nâng giọng hát bay lên.</p>
<h3>Cầu nối — đổi gió</h3>
<p>Một đoạn hơi &ldquo;lạ tai&rdquo; chèn vào giữa (bridge), thường trước điệp khúc cuối. Nó chống lại sự nhàm chán khi các đoạn cứ lặp, và tạo một bậc thang cảm xúc mới. Không phải bài nào cũng có.</p>
<h3>Kết — hạ màn</h3>
<p>Đoạn khép lại (outro), đưa cảm xúc về chỗ nghỉ. Có thể nhắc lại điệp khúc nhỏ dần, hoặc buông một hợp âm ngân dài.</p>
<blockquote>Khi bạn nhìn ra 5 chặng này trong một bài, bạn <strong>biết trước bài sẽ đi đâu</strong> — chỗ nào ghìm, chỗ nào bung. Người đệm giỏi không chạy theo bài hát; họ <em>đi cùng</em> nó, vì họ đã cầm sẵn tấm bản đồ.</blockquote>'
WHERE id = 'd2c00701-0000-4000-8000-000000000000';

-- ── Ch7: Chọn điệu theo tính chất bài hát  (d2c00703) ──
UPDATE edu_course_lessons SET content =
'<h2>Chọn điệu — quyết định đầu tiên, và quan trọng nhất</h2>
<p>Có một sự thật hơi phũ: bạn có thể bấm hợp âm sạch bong, quạt đều tăm tắp, nhưng nếu <strong>chọn sai điệu</strong>, cả bài vẫn hỏng. Đệm một bản tình ca da diết bằng điệu tưng bừng nhảy nhót thì… nghe như mặc vest đi tắm biển. Không sai kỹ thuật, chỉ sai <em>tinh thần</em>.</p>
<p>Vậy nên, trước khi chạm dây, hãy dừng lại vài giây và hỏi: <em>bài này mang tính chất gì?</em></p>
<h3>Lắng nghe cái &ldquo;chất&rdquo; của bài</h3>
<p>Bạn không cần lý thuyết cao siêu, chỉ cần <strong>hát nhẩm</strong> bài đó và cảm:</p>
<ul>
<li>Lời <strong>buồn, tâm sự, chậm rãi</strong>, giai điệu ngân dài → nghiêng về <strong>Ballad, Slowrock, Bolero</strong>.</li>
<li>Nhịp <strong>đung đưa, dập dìu như ru</strong> → chất của <strong>chùm 3</strong>: Slowrock, Bolero.</li>
<li>Giai điệu <strong>xoay tròn, nhịp nhàng ba phách</strong>, kiểu valse cổ điển → <strong>Valse</strong>.</li>
<li>Tươi tắn, đều đặn, dễ vỗ tay → <strong>Ballad</strong> nhịp 4/4 tươi.</li>
</ul>
<h3>Mẹo cực đơn giản mà hiệu quả</h3>
<p>Hát nhẩm câu điệp khúc, rồi thử <strong>gõ tay lên đùi</strong> theo hai ba kiểu điệu khác nhau. Kiểu nào khiến bạn thấy &ldquo;khớp&rdquo;, thấy đã, thấy đúng cảm xúc bài hát — đó là điệu của nó. Tai và cơ thể bạn thường biết câu trả lời trước cả cái đầu.</p>
<blockquote>Chọn điệu không phải là tra bảng, mà là <strong>lắng nghe</strong>. Càng nghe nhiều, cảm nhạc càng nhạy, và một ngày bạn sẽ chọn đúng điệu chỉ sau vài giây — như phản xạ.</blockquote>'
WHERE id = 'd2c00703-0000-4000-8000-000000000000';

-- ── Ch7: Chọn sắc thái theo từng đoạn  (d2c00704) ──
UPDATE edu_course_lessons SET content =
'<h2>Trong một bài, cảm xúc có lên có xuống</h2>
<p>Bạn đã chọn đúng điệu. Nhưng nếu từ câu đầu đến câu cuối bạn đệm <em>y hệt nhau</em> — cùng một độ mạnh, cùng một độ dày — thì dù đúng điệu, bài vẫn nghe <strong>phẳng lì, vô cảm</strong>, như một người kể chuyện đều đều một giọng suốt hai tiếng đồng hồ.</p>
<p>Vì một bài hát không phải đường thẳng. Nó là những ngọn đồi: chỗ trầm xuống thủ thỉ, chỗ dâng lên vỡ oà. Nhiệm vụ của người đệm là <strong>đi theo đường cong cảm xúc ấy</strong>.</p>
<h3>Quy tắc vàng: ghìm ở phiên khúc, bung ở điệp khúc</h3>
<p>Nhớ lại bố cục bạn vừa học. Cùng một điệu, nhưng:</p>
<ul>
<li><strong>Phiên khúc</strong> (đoạn kể chuyện) → đệm <em>nhẹ, thưa, kín đáo</em>. Đây là lúc lời hát cần được nghe rõ, tiếng đàn chỉ nên là tấm nền êm phía sau.</li>
<li><strong>Điệp khúc</strong> (cao trào) → đệm <em>đầy, mạnh, chắc</em>. Đây là lúc bạn được phép &ldquo;tung&rdquo;, đẩy năng lượng lên để nâng người hát.</li>
</ul>
<p>Chỉ riêng việc biết ghìm rồi bung đúng chỗ, tiếng đệm của bạn đã lập tức nghe <strong>chuyên nghiệp hơn hẳn</strong> — dù kỹ thuật tay chưa hề thay đổi.</p>
<blockquote>Đệm hát, xét cho cùng, là <strong>kể chuyện cùng người hát</strong>. Người kể chuyện hay biết chỗ nào hạ giọng cho người ta nghiêng tai, chỗ nào cao giọng cho người ta nổi da gà. Đàn của bạn cũng phải biết hai điều đó.</blockquote>'
WHERE id = 'd2c00704-0000-4000-8000-000000000000';

-- ── Ch7: Phiên khúc đánh nhẹ — điệp khúc bung hơn (kỹ thuật)  (d2c00705) ──
UPDATE edu_course_lessons SET content =
'<h2>Làm sao để &ldquo;nhẹ&rdquo; và &ldquo;bung&rdquo; bằng đôi tay?</h2>
<p>Bài trước ta đã thống nhất tinh thần: phiên khúc ghìm, điệp khúc bung. Nhưng &ldquo;ghìm&rdquo; với &ldquo;bung&rdquo; cụ thể là làm gì với mười ngón tay? Đây là những công cụ rất thật, bạn dùng được ngay hôm nay.</p>
<h3>Bộ công cụ làm NHẸ (cho phiên khúc)</h3>
<ul>
<li><strong>Quạt ít dây hơn</strong>: chỉ lướt qua 3–4 dây thay vì cả 6. Tiếng mỏng lại tức thì.</li>
<li><strong>Chuyển sang rải</strong>: thay vì quạt cả chùm, rải từng dây nhẹ nhàng — dịu và tình hơn.</li>
<li><strong>Nhẹ lực cổ tay</strong>: vẫn giữ nhịp đung đưa đều, nhưng chạm dây khẽ thôi.</li>
<li><strong>Bỏ bớt cú</strong>: lược đi vài cú &ldquo;lên&rdquo; cho thưa thoáng.</li>
</ul>
<h3>Bộ công cụ làm BUNG (cho điệp khúc)</h3>
<ul>
<li><strong>Quạt đủ 6 dây</strong>: cho hợp âm vang đầy, dày dặn.</li>
<li><strong>Nhấn sâu tay ở phách mạnh</strong>: dồn lực vào phách 1 (và 3) để tạo cú &ldquo;huỵch&rdquo;.</li>
<li><strong>Thêm cú, chặt nhịp</strong>: quạt đủ cả xuống-lên, không lược, cho rộn ràng liên tục.</li>
<li><strong>Cổ tay chắc hơn</strong>: biên độ rộng hơn, tiếng bật ra khoẻ khoắn.</li>
</ul>
<h3>Bí quyết nằm ở đường CHUYỂN</h3>
<p>Người mới hay bị &ldquo;giật cấp&rdquo;: đang nhẹ, vào điệp khúc thì đột ngột nện thình thình. Người chơi hay thì <em>dâng lên từ từ</em> ở câu cuối phiên khúc, như con sóng gom nước trước khi vỗ bờ, để khi vào điệp khúc, năng lượng đã sẵn sàng tuôn ra một cách <strong>tự nhiên, liền mạch</strong>.</p>
<blockquote>Hãy thử ngay: chọn một bài quen, đệm phiên khúc thật khẽ, rồi bung điệp khúc. Lần đầu có thể gượng, nhưng chỉ cần cảm được sự tương phản ấy một lần, bạn sẽ nghiện — vì đó là lúc cây đàn bắt đầu <em>biết nói</em>.</blockquote>'
WHERE id = 'd2c00705-0000-4000-8000-000000000000';

-- ── Ch6 (Valse): Nhịp 3/4 — mạnh, nhẹ, nhẹ  (d2c00601) ──
UPDATE edu_course_lessons SET content =
'<h2>Nhịp 3/4: một-hai-ba, một-hai-ba</h2>
<p>Suốt Trình độ 2 tới giờ, gần như mọi thứ ta làm đều nằm trong nhịp chẵn — 2/4, 4/4 — nơi các phách chia đôi ngăn nắp. Nhưng có cả một thế giới âm nhạc duyên dáng sống trong nhịp <strong>lẻ</strong>: nhịp <strong>3/4</strong>, ngôi nhà của điệu <strong>Valse</strong>.</p>
<p>3/4 nghĩa là mỗi ô nhịp có <strong>ba phách</strong>. Và cái hồn của nó nằm gọn trong một công thức bạn phải thuộc nằm lòng:</p>
<div style="background:#F4F4F5;border-radius:8px;padding:16px;margin:14px 0;font-size:19px;text-align:center;letter-spacing:.04em"><b>MẠNH</b> – nhẹ – nhẹ &nbsp;|&nbsp; <b>MẠNH</b> – nhẹ – nhẹ</div>
<p>Phách 1 được nhấn rõ, hai phách sau buông nhẹ, rồi lại nhấn, lại buông. Cứ thế xoay vòng.</p>
<h3>Vì sao 3/4 khiến người ta muốn xoay?</h3>
<p>Hãy thử đứng dậy và bước theo &ldquo;<strong>một</strong>-hai-ba, <strong>một</strong>-hai-ba&rdquo;, dồn trọng tâm vào chữ &ldquo;một&rdquo;. Bạn có cảm thấy cơ thể mình muốn <em>lượn, muốn xoay</em> không? Đó chính xác là lý do điệu Valse gắn liền với những vũ điệu xoay tròn trong các buổi dạ hội cổ điển. Cái nhịp ba phách ấy đẩy cơ thể đi thành vòng, khác hẳn cái &ldquo;trái-phải, trái-phải&rdquo; thẳng thớm của nhịp chẵn.</p>
<blockquote>Chỉ cần bạn cảm được cái &ldquo;xoay&rdquo; của <strong>MẠNH</strong>-nhẹ-nhẹ trong người, bạn đã nắm được linh hồn của Valse — phần còn lại chỉ là đưa nó xuống mười ngón tay.</blockquote>'
WHERE id = 'd2c00601-0000-4000-8000-000000000000';

-- ── Ch8: Quy trình đệm 1 bài mới — 5 bước  (d2c00800) ──
UPDATE edu_course_lessons SET content =
'<h2>Cầm một bài lạ trên tay — bắt đầu từ đâu?</h2>
<p>Đây là khoảnh khắc thử thách nhất, và cũng đã đời nhất, của người đệm hát: ai đó đưa bạn một bài bạn <em>chưa từng tập</em>, và nói &ldquo;đệm giúp mình bài này với&rdquo;. Người chưa có phương pháp sẽ luống cuống. Còn bạn — sau chương này — sẽ có một <strong>tấm bản đồ 5 bước</strong> để không bao giờ đứng hình.</p>
<h3>Bước 1 — Chọn tông</h3>
<p>Tông phải hợp <em>giọng người hát</em>, không phải hợp tay bạn. Hát thử câu cao nhất của bài: nếu với không tới thì hạ tông xuống, nếu quá trầm thì nâng lên. Chọn tông đúng, mọi thứ sau đó nhẹ hẳn.</p>
<h3>Bước 2 — Chọn điệu</h3>
<p>Cảm cái &ldquo;chất&rdquo; của bài (buồn/vui, đung đưa/thẳng thớm, 3 phách hay 4 phách) rồi chọn điệu phù hợp — đúng như bạn đã luyện ở chương Bố cục.</p>
<h3>Bước 3 — Chia bố cục</h3>
<p>Đánh dấu đâu là intro, phiên khúc, điệp khúc, cầu nối, kết. Ghi luôn chỗ nào sẽ ghìm, chỗ nào sẽ bung.</p>
<h3>Bước 4 — Tập từng đoạn</h3>
<p>Đừng ôm cả bài một lúc. Tập <em>rời từng đoạn</em> cho nhuyễn — phiên khúc riêng, điệp khúc riêng — nhất là những chỗ đổi hợp âm khó.</p>
<h3>Bước 5 — Ghép cả bài</h3>
<p>Nối các đoạn lại, chạy trọn bài từ đầu đến cuối, giữ nhịp đều và chuyển sắc thái mượt. Vấp ở đâu, quay lại Bước 4 chỗ đó.</p>
<blockquote>Năm bước này không chỉ để đệm một bài. Nó là <strong>cách tư duy</strong> của người chơi nhạc trưởng thành: chia nhỏ điều lớn, chinh phục từng phần, rồi hợp nhất. Thuộc quy trình này, bạn tự tin cầm <em>bất kỳ</em> bài nào — kể cả bài chưa ai từng đệm.</blockquote>'
WHERE id = 'd2c00800-0000-4000-8000-000000000000';

-- ── Ch8: Tổng kết Đệm hát Trình độ 2  (d2c00806) ──
UPDATE edu_course_lessons SET content =
'<h2>Nhìn lại chặng đường bạn vừa đi</h2>
<p>Hãy dừng lại một nhịp và ngoảnh nhìn phía sau. Còn nhớ ngày đầu Trình độ 2, khi bạn thu âm lại tiếng đệm của mình và thấy nó &ldquo;hơi phẳng, còn thiếu gì đó&rdquo; không? Cái cảm giác mơ hồ ấy — giờ bạn đã biết chính xác nó là gì, và quan trọng hơn, <strong>biết cách khắc phục</strong>.</p>
<h3>Bạn đã đi qua những gì</h3>
<ul>
<li><strong>Chùm nốt</strong> — bạn học được bí mật chia nhỏ một phách, gốc rễ của mọi điệu.</li>
<li><strong>Tiết tấu quạt</strong> — bạn biết đọc, ghi và tự dựng một mẫu quạt bằng ↓ và ↑.</li>
<li><strong>Bốn điệu</strong> — Ballad, Bolero, Slowrock, Valse: bạn không học vẹt, bạn hiểu mỗi điệu sinh ra từ cách chia phách nào.</li>
<li><strong>Bố cục</strong> — bạn nhìn ra hành trình cảm xúc của bài, biết chỗ ghìm chỗ bung.</li>
<li><strong>Áp dụng</strong> — bạn có quy trình 5 bước để chinh phục bất kỳ bài mới nào.</li>
</ul>
<p>Nhưng điều quý nhất bạn mang ra khỏi Trình độ 2 không phải là mấy điệu đàn. Mà là một sự thay đổi trong <em>cách nghĩ</em>:</p>
<blockquote>Bạn đã bước từ người <strong>đệm cho đúng</strong> sang người bắt đầu <strong>đệm cho hay</strong> — người không thuộc bài, mà <em>hiểu bài</em>. Đó là ranh giới ngăn cách một người &ldquo;biết vài điệu&rdquo; với một người thật sự <strong>chơi được nhạc</strong>.</blockquote>
<p>Hãy tự hào. Bạn đã làm được một quãng đường dài.</p>'
WHERE id = 'd2c00806-0000-4000-8000-000000000000';

-- ── Ch8: Lộ trình lên Đệm hát Trình độ 3  (d2c00807) ──
UPDATE edu_course_lessons SET content =
'<h2>Phía trước có gì? — Trình độ 3</h2>
<p>Nếu Trình độ 2 dạy bạn <em>dựng</em> được các điệu từ gốc rễ, thì Trình độ 3 sẽ dạy bạn <strong>làm cho chúng đẹp và tinh tế</strong> — bước từ &ldquo;đệm được&rdquo; sang &ldquo;đệm có màu sắc riêng&rdquo;.</p>
<h3>Những điều đang chờ bạn</h3>
<ul>
<li><strong>Bossa Nova</strong> — điệu Latin sang trọng, dập dìu, với cách đặt hợp âm rất riêng (ta đã hẹn gặp nó ở đây).</li>
<li><strong>Kỹ thuật tay phải nâng cao</strong> — móc, chặn tiếng, đảo phách, làm cho tiết tấu &ldquo;có gân&rdquo; hơn.</li>
<li><strong>Màu hợp âm</strong> — thêm các hợp âm màu (7, sus, add…) để tiếng đệm giàu cảm xúc hơn.</li>
<li><strong>Chuyển tông, dạo đầu, dồn kết</strong> — những nét chấm phá khiến phần đệm của bạn nghe như một bản phối hoàn chỉnh.</li>
</ul>
<h3>Trước khi bước tiếp, một lời dặn</h3>
<p>Đừng vội. Trình độ 3 sẽ đợi bạn. Điều đáng làm nhất lúc này là <strong>đem những gì vừa học ra dùng thật nhiều</strong>: đệm cho mình hát, đệm cho bạn bè, ngồi ở một góc quán… Kỹ thuật chỉ thật sự là của bạn khi nó đã ngấm vào tay qua hàng trăm lần chơi thực tế.</p>
<blockquote>Hẹn gặp bạn ở Trình độ 3 — với một đôi tay đã dày dạn hơn, và một trái tim yêu cây đàn hơn nữa. Còn bây giờ: hãy đàn, và hãy hát.</blockquote>'
WHERE id = 'd2c00807-0000-4000-8000-000000000000';

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

NOTIFY pgrst, 'reload schema';
