-- ============================================================================
-- ĐỆM HÁT TRÌNH ĐỘ 2 — CHẠY TẤT CẢ (khung + nội dung text). Idempotent.
-- Thứ tự: dựng khung TRƯỚC (tạo bài), rồi UPDATE nội dung. Chạy 1 lần.
-- ============================================================================

-- ==================== db/dh2_full.sql ====================
-- ============================================================================
-- ĐỆM HÁT TRÌNH ĐỘ 2 (DH2) — KHUNG ĐẦY ĐỦ 8 CHƯƠNG (mạch: Chùm nốt → Tiết tấu →
--   Ballad → Bolero → Slowrock → Valse → Bố cục → Áp dụng thực tế).
-- SINH TỰ ĐỘNG từ db/gen_dh2.cjs — đừng sửa tay. Course DH2: c7ab2fcb-aff1-4485-a381-4edc83e4a62b
-- Bài mới = placeholder (text, ⏳) — điền nội dung sau. Bài cũ chỉ đổi chương/thứ tự.
-- Idempotent: ON CONFLICT của bài mới KHÔNG đè nội dung đã điền (chỉ chỉnh module/order).
-- ============================================================================

-- ===== Chương 1: Chùm nốt =====
INSERT INTO edu_modules (id, course_id, name, order_index) VALUES ('067ae3bb-7812-4485-8fa2-077fccaea2bf', 'c7ab2fcb-aff1-4485-a381-4edc83e4a62b', 'Chương 1: Chùm nốt', 0)
ON CONFLICT (id) DO UPDATE SET course_id = EXCLUDED.course_id, name = EXCLUDED.name, order_index = EXCLUDED.order_index;
UPDATE edu_course_lessons SET module_id = '067ae3bb-7812-4485-8fa2-077fccaea2bf', order_index = 0 WHERE id = 'aca3b657-b2c8-46dd-ac1e-5fe8b7828158';
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00101-0000-4000-8000-000000000000', '067ae3bb-7812-4485-8fa2-077fccaea2bf', 'Ôn nhanh: Phách & Nhịp — cầu nối từ Trình độ 1', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài ôn / quiz 📝</p>', 1, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00102-0000-4000-8000-000000000000', '067ae3bb-7812-4485-8fa2-077fccaea2bf', 'Từ nốt đen sang chùm nốt', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng ngắn (text/slide)</p>', 2, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00103-0000-4000-8000-000000000000', '067ae3bb-7812-4485-8fa2-077fccaea2bf', 'Chùm nốt là gì — chia 1 phách thành nhiều tiếng', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text/slide)</p>', 3, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
UPDATE edu_course_lessons SET module_id = '067ae3bb-7812-4485-8fa2-077fccaea2bf', order_index = 4 WHERE id = '1bc21a87-d39f-48ee-a62c-a753902631cf';
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00105-0000-4000-8000-000000000000', '067ae3bb-7812-4485-8fa2-077fccaea2bf', 'Cách đếm chùm 2: 1 & 2 & 3 & 4 &', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text) + tiếng đếm mẫu</p>', 5, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00106-0000-4000-8000-000000000000', '067ae3bb-7812-4485-8fa2-077fccaea2bf', 'Xưởng gõ chùm 2', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> công cụ app 🎛 (metronome / gõ theo)</p>', 6, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00107-0000-4000-8000-000000000000', '067ae3bb-7812-4485-8fa2-077fccaea2bf', 'Xưởng quạt chùm 2 — xuống/lên đều', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> video thầy quay 🎬</p>', 7, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00108-0000-4000-8000-000000000000', '067ae3bb-7812-4485-8fa2-077fccaea2bf', 'Nghe thử chùm 3 và liên 3 — biết trước, học kỹ sau', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng + audio mẫu</p>', 8, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00109-0000-4000-8000-000000000000', '067ae3bb-7812-4485-8fa2-077fccaea2bf', 'Checkpoint Chương 1', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> quiz 📝</p>', 9, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;

-- ===== Chương 2: Tiết tấu quạt =====
INSERT INTO edu_modules (id, course_id, name, order_index) VALUES ('46e55dbe-dd8f-40b5-a8ec-6464219f7155', 'c7ab2fcb-aff1-4485-a381-4edc83e4a62b', 'Chương 2: Tiết tấu quạt', 1)
ON CONFLICT (id) DO UPDATE SET course_id = EXCLUDED.course_id, name = EXCLUDED.name, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00200-0000-4000-8000-000000000000', '46e55dbe-dd8f-40b5-a8ec-6464219f7155', 'Tiết tấu là gì — mẫu lặp trong âm nhạc', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text/slide)</p>', 0, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00201-0000-4000-8000-000000000000', '46e55dbe-dd8f-40b5-a8ec-6464219f7155', 'Ký hiệu quạt: xuống ↓ và lên ↑', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text)</p>', 1, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00202-0000-4000-8000-000000000000', '46e55dbe-dd8f-40b5-a8ec-6464219f7155', 'Tay phải: đều, nhẹ, cổ tay thả lỏng', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> video thầy quay 🎬</p>', 2, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
UPDATE edu_course_lessons SET module_id = '46e55dbe-dd8f-40b5-a8ec-6464219f7155', order_index = 3 WHERE id = 'df4ddd1b-768b-4d74-8b9a-40a310ac99e9';
UPDATE edu_course_lessons SET module_id = '46e55dbe-dd8f-40b5-a8ec-6464219f7155', order_index = 4 WHERE id = 'd76e8798-76bd-485e-b0fb-4fadb6b98458';
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00205-0000-4000-8000-000000000000', '46e55dbe-dd8f-40b5-a8ec-6464219f7155', 'Ứng dụng chùm 2 vào nhịp 4/4', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> video / bài giảng</p>', 5, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00206-0000-4000-8000-000000000000', '46e55dbe-dd8f-40b5-a8ec-6464219f7155', 'Nền tập quạt — tập với trống + bass', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> công cụ app 🎛 (Groove Lab nền tập)</p>', 6, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
UPDATE edu_course_lessons SET module_id = '46e55dbe-dd8f-40b5-a8ec-6464219f7155', order_index = 7 WHERE id = '2f6b416d-7d4f-4bd0-8c13-0e4ad2e11829';
UPDATE edu_course_lessons SET module_id = '46e55dbe-dd8f-40b5-a8ec-6464219f7155', order_index = 8 WHERE id = '4692e092-3591-4dda-99d6-265b82e0d34c';
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00209-0000-4000-8000-000000000000', '46e55dbe-dd8f-40b5-a8ec-6464219f7155', 'Gảy theo: 1 bài Việt đơn giản', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> gảy theo 🎸 (Strum Score) — chọn bài sau</p>', 9, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00210-0000-4000-8000-000000000000', '46e55dbe-dd8f-40b5-a8ec-6464219f7155', 'Checkpoint Chương 2', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> quiz 📝</p>', 10, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;

-- ===== Chương 3: Điệu Ballad =====
INSERT INTO edu_modules (id, course_id, name, order_index) VALUES ('2a3011f7-750e-49e6-9b55-ea0af1725d0d', 'c7ab2fcb-aff1-4485-a381-4edc83e4a62b', 'Chương 3: Điệu Ballad', 2)
ON CONFLICT (id) DO UPDATE SET course_id = EXCLUDED.course_id, name = EXCLUDED.name, order_index = EXCLUDED.order_index;
UPDATE edu_course_lessons SET module_id = '2a3011f7-750e-49e6-9b55-ea0af1725d0d', order_index = 0 WHERE id = '2b73cd3b-cc6e-4ba9-baff-9ef6acc984ac';
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00301-0000-4000-8000-000000000000', '2a3011f7-750e-49e6-9b55-ea0af1725d0d', 'Ballad dùng chùm 2 như thế nào', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text)</p>', 1, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00302-0000-4000-8000-000000000000', '2a3011f7-750e-49e6-9b55-ea0af1725d0d', 'Mẫu quạt Ballad cơ bản', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> video thầy quay 🎬</p>', 2, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00303-0000-4000-8000-000000000000', '2a3011f7-750e-49e6-9b55-ea0af1725d0d', 'Mẫu rải Ballad đơn giản', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> video thầy quay 🎬</p>', 3, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00304-0000-4000-8000-000000000000', '2a3011f7-750e-49e6-9b55-ea0af1725d0d', 'Nền tập Ballad', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> công cụ app 🎛 (Groove Lab điệu Ballad)</p>', 4, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00305-0000-4000-8000-000000000000', '2a3011f7-750e-49e6-9b55-ea0af1725d0d', 'Gảy theo: 1 bài Ballad (chọn bài sau)', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> gảy theo 🎸 (Strum Score)</p>', 5, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;

-- ===== Chương 4: Điệu Bolero =====
INSERT INTO edu_modules (id, course_id, name, order_index) VALUES ('d2000044-0000-4000-8000-000000000044', 'c7ab2fcb-aff1-4485-a381-4edc83e4a62b', 'Chương 4: Điệu Bolero', 3)
ON CONFLICT (id) DO UPDATE SET course_id = EXCLUDED.course_id, name = EXCLUDED.name, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00400-0000-4000-8000-000000000000', 'd2000044-0000-4000-8000-000000000044', 'Tính chất Bolero', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text)</p>', 0, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
UPDATE edu_course_lessons SET module_id = 'd2000044-0000-4000-8000-000000000044', order_index = 1, title = 'Chùm 3 lệch phải (đơn – kép – kép) — đặc trưng Bolero' WHERE id = '12bb1218-6dcd-447c-8145-7f7f0302482b';
UPDATE edu_course_lessons SET module_id = 'd2000044-0000-4000-8000-000000000044', order_index = 2 WHERE id = '5f7acacd-9214-48f3-9349-93cc382649fb';
UPDATE edu_course_lessons SET module_id = 'd2000044-0000-4000-8000-000000000044', order_index = 3 WHERE id = 'a85592d5-b519-470d-84d0-4d9182d224b3';
UPDATE edu_course_lessons SET module_id = 'd2000044-0000-4000-8000-000000000044', order_index = 4 WHERE id = 'aec7a2a0-3b49-4902-891d-22c52759d71f';
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00405-0000-4000-8000-000000000000', 'd2000044-0000-4000-8000-000000000044', 'Nền tập Bolero', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> công cụ app 🎛 (Groove Lab điệu Bolero)</p>', 5, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00406-0000-4000-8000-000000000000', 'd2000044-0000-4000-8000-000000000044', 'Gảy theo: Con đường xưa em đi', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> gảy theo 🎸 (Strum Score) — Bolero</p>', 6, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;

-- ===== Chương 5: Điệu Slowrock =====
INSERT INTO edu_modules (id, course_id, name, order_index) VALUES ('d2000055-0000-4000-8000-000000000055', 'c7ab2fcb-aff1-4485-a381-4edc83e4a62b', 'Chương 5: Điệu Slowrock', 4)
ON CONFLICT (id) DO UPDATE SET course_id = EXCLUDED.course_id, name = EXCLUDED.name, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00500-0000-4000-8000-000000000000', 'd2000055-0000-4000-8000-000000000055', 'Tính chất Slowrock', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text)</p>', 0, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00501-0000-4000-8000-000000000000', 'd2000055-0000-4000-8000-000000000055', 'Liên 3 là gì trong đệm hát', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text)</p>', 1, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
UPDATE edu_course_lessons SET module_id = 'd2000055-0000-4000-8000-000000000055', order_index = 2 WHERE id = 'db6fddb4-7d3b-4a3b-9a01-f143928f02e5';
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00503-0000-4000-8000-000000000000', 'd2000055-0000-4000-8000-000000000055', 'Cảm giác dàn trải của Slowrock', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text) + audio</p>', 3, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00504-0000-4000-8000-000000000000', 'd2000055-0000-4000-8000-000000000055', 'Mẫu Slowrock cơ bản', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> video thầy quay 🎬</p>', 4, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00505-0000-4000-8000-000000000000', 'd2000055-0000-4000-8000-000000000055', 'Nền tập Slowrock', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> công cụ app 🎛 (Groove Lab điệu Slowrock)</p>', 5, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00506-0000-4000-8000-000000000000', 'd2000055-0000-4000-8000-000000000055', 'Gảy theo: Diễm Xưa', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> gảy theo 🎸 (Strum Score) — Slowrock</p>', 6, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;

-- ===== Chương 6: Điệu Valse =====
INSERT INTO edu_modules (id, course_id, name, order_index) VALUES ('271e9988-0e3b-4171-a829-139a6b399263', 'c7ab2fcb-aff1-4485-a381-4edc83e4a62b', 'Chương 6: Điệu Valse', 5)
ON CONFLICT (id) DO UPDATE SET course_id = EXCLUDED.course_id, name = EXCLUDED.name, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00600-0000-4000-8000-000000000000', '271e9988-0e3b-4171-a829-139a6b399263', 'Tính chất Valse', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text)</p>', 0, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00601-0000-4000-8000-000000000000', '271e9988-0e3b-4171-a829-139a6b399263', 'Nhịp 3/4: mạnh — nhẹ — nhẹ', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text)</p>', 1, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00602-0000-4000-8000-000000000000', '271e9988-0e3b-4171-a829-139a6b399263', 'Mẫu Valse nốt đen', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> video thầy quay 🎬</p>', 2, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00603-0000-4000-8000-000000000000', '271e9988-0e3b-4171-a829-139a6b399263', 'Mẫu Valse có chùm 2', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> video thầy quay 🎬</p>', 3, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00604-0000-4000-8000-000000000000', '271e9988-0e3b-4171-a829-139a6b399263', 'Trộn nốt đen và chùm 2 trong Valse', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> video / bài giảng</p>', 4, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00605-0000-4000-8000-000000000000', '271e9988-0e3b-4171-a829-139a6b399263', 'Nền tập Valse', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> công cụ app 🎛 (Groove Lab điệu Valse)</p>', 5, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00606-0000-4000-8000-000000000000', '271e9988-0e3b-4171-a829-139a6b399263', 'Gảy theo: 1 bài Valse (chọn bài sau)', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> gảy theo 🎸 (Strum Score)</p>', 6, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;

-- ===== Chương 7: Bố cục bài hát =====
INSERT INTO edu_modules (id, course_id, name, order_index) VALUES ('a844e611-71a9-48c1-84cf-a645b8c79d08', 'c7ab2fcb-aff1-4485-a381-4edc83e4a62b', 'Chương 7: Bố cục bài hát', 6)
ON CONFLICT (id) DO UPDATE SET course_id = EXCLUDED.course_id, name = EXCLUDED.name, order_index = EXCLUDED.order_index;
UPDATE edu_course_lessons SET module_id = 'a844e611-71a9-48c1-84cf-a645b8c79d08', order_index = 0 WHERE id = 'd3624d28-47e2-48d3-a1d3-ee7ead6c3de2';
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00701-0000-4000-8000-000000000000', 'a844e611-71a9-48c1-84cf-a645b8c79d08', 'Intro — Phiên khúc — Điệp khúc — Cầu nối — Kết', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text) + nghe ví dụ</p>', 1, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
UPDATE edu_course_lessons SET module_id = 'a844e611-71a9-48c1-84cf-a645b8c79d08', order_index = 2 WHERE id = 'c2a2a5eb-411e-4e0a-a2ed-2a891b5ac970';
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00703-0000-4000-8000-000000000000', 'a844e611-71a9-48c1-84cf-a645b8c79d08', 'Chọn điệu theo tính chất bài hát', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text)</p>', 3, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00704-0000-4000-8000-000000000000', 'a844e611-71a9-48c1-84cf-a645b8c79d08', 'Chọn sắc thái theo từng đoạn', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text)</p>', 4, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00705-0000-4000-8000-000000000000', 'a844e611-71a9-48c1-84cf-a645b8c79d08', 'Phiên khúc đánh nhẹ — điệp khúc bung hơn', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text)</p>', 5, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00706-0000-4000-8000-000000000000', 'a844e611-71a9-48c1-84cf-a645b8c79d08', 'Bố cục mẫu Ballad', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text)</p>', 6, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
UPDATE edu_course_lessons SET module_id = 'a844e611-71a9-48c1-84cf-a645b8c79d08', order_index = 7 WHERE id = '21b2be1b-533a-4d2d-9610-a698e01b31d5';
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00708-0000-4000-8000-000000000000', 'a844e611-71a9-48c1-84cf-a645b8c79d08', 'Bố cục mẫu Slowrock', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text)</p>', 8, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00709-0000-4000-8000-000000000000', 'a844e611-71a9-48c1-84cf-a645b8c79d08', 'Bố cục mẫu Valse', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text)</p>', 9, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
UPDATE edu_course_lessons SET module_id = 'a844e611-71a9-48c1-84cf-a645b8c79d08', order_index = 10 WHERE id = 'a3a059a1-7b85-4505-962a-aba56892d28f';

-- ===== Chương 8: Áp dụng vào bài hát thực tế =====
INSERT INTO edu_modules (id, course_id, name, order_index) VALUES ('974b0073-61d3-4b76-857a-e4f01c738d42', 'c7ab2fcb-aff1-4485-a381-4edc83e4a62b', 'Chương 8: Áp dụng vào bài hát thực tế', 7)
ON CONFLICT (id) DO UPDATE SET course_id = EXCLUDED.course_id, name = EXCLUDED.name, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00800-0000-4000-8000-000000000000', '974b0073-61d3-4b76-857a-e4f01c738d42', 'Quy trình đệm 1 bài mới — 5 bước', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text/slide): tông → điệu → bố cục → tập đoạn → ghép</p>', 0, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00801-0000-4000-8000-000000000000', '974b0073-61d3-4b76-857a-e4f01c738d42', 'Thực hành 1 — bài Ballad (chọn bài sau)', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> gảy theo 🎸 + phân tích bố cục</p>', 1, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00802-0000-4000-8000-000000000000', '974b0073-61d3-4b76-857a-e4f01c738d42', 'Thực hành 2 — Con đường xưa em đi (Bolero)', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> gảy theo 🎸 + phân tích bố cục</p>', 2, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00803-0000-4000-8000-000000000000', '974b0073-61d3-4b76-857a-e4f01c738d42', 'Thực hành 3 — Diễm Xưa (Slowrock)', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> gảy theo 🎸 + phân tích bố cục</p>', 3, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00804-0000-4000-8000-000000000000', '974b0073-61d3-4b76-857a-e4f01c738d42', 'Thực hành 4 — bài Valse (chọn bài sau)', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> gảy theo 🎸 + phân tích bố cục</p>', 4, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00805-0000-4000-8000-000000000000', '974b0073-61d3-4b76-857a-e4f01c738d42', 'Dự án cuối khoá: tự chọn 1 bài, tự đệm và thu lại nộp', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài nộp (submit_video)</p>', 5, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00806-0000-4000-8000-000000000000', '974b0073-61d3-4b76-857a-e4f01c738d42', 'Tổng kết Đệm hát Trình độ 2', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text)</p>', 6, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00807-0000-4000-8000-000000000000', '974b0073-61d3-4b76-857a-e4f01c738d42', 'Lộ trình lên Đệm hát Trình độ 3', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text)</p>', 7, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;

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
-- DH2 — Nội dung CỤM TEXT, Chương 1: Chùm nốt (5 bài giảng nền)
-- Phong cách "dài mà cuốn" (hook + mở vòng + ẩn dụ + câu khai thông). Xưng "bạn".
-- UPDATE content theo id placeholder (từ db/dh2_full.sql). Idempotent.
-- ============================================================================

-- 1) Ôn nhanh: Phách & Nhịp — cầu nối từ Trình độ 1  (d2c00101)
UPDATE edu_course_lessons SET content =
'<h2>Ôn nhanh: Phách &amp; Nhịp — hành trang bước sang Trình độ 2</h2>
<p>Hãy tưởng tượng bạn đang đứng ở một ngưỡng cửa. Phía sau là Trình độ 1 — nơi bạn đã đổ mồ hôi để bấm cho sạch, quạt cho đều, hát cho khớp. Phía trước là Trình độ 2, với những điệu đàn rộn ràng đang chờ. Nhưng trước khi bước qua, ta hãy quay lại nhìn <strong>hai người bạn đồng hành</strong> đã cõng bạn tới tận đây. Vì thật ra, mọi thứ sắp học đều chỉ là trò chơi mới trên chính hai nền tảng cũ này.</p>

<h3>Phách — trái tim thầm lặng của bài hát</h3>
<p>Bạn có để ý, khi nghe một bài hát mình thích, chân bạn tự nhiên giậm, tay tự nhiên vỗ? Cái mà cơ thể bạn bắt được — không cần ai dạy — chính là <strong>phách</strong>. Phách là những cú đập đều đặn chạy ngầm bên dưới mọi giai điệu, như <em>nhịp tim</em>, như tiếng tích-tắc của chiếc đồng hồ treo tường.</p>
<p>Phách không nhanh, không chậm, không cảm xúc. Nó chỉ đều. Và chính cái đều tuyệt đối ấy là điểm tựa để mọi thứ hoa mỹ phía trên được phép bay bổng mà không rơi.</p>

<h3>Nhịp — cách sắp phách thành từng ô</h3>
<p>Nếu phách là những bước chân, thì <strong>nhịp</strong> là cách ta gom các bước ấy thành từng nhóm đều nhau. Nhịp <strong>2/4</strong> gom 2 phách một ô, <strong>3/4</strong> gom 3 phách, <strong>4/4</strong> gom 4 phách. Và trong mỗi ô, phách đầu tiên luôn được nhấn hơn một chút — ta gọi là <strong>phách mạnh</strong>. Nó giống như trọng âm của một câu nói: có nó, câu mới có hồn.</p>
<div style="background:#F4F4F5;border-radius:8px;padding:12px 16px;margin:14px 0;font-size:15px"><b>Mạnh</b>-nhẹ-nhẹ-nhẹ &nbsp;|&nbsp; <b>Mạnh</b>-nhẹ-nhẹ-nhẹ &nbsp;→&nbsp; đó là cảm giác của nhịp 4/4</div>

<h3>Vậy Trình độ 2 sẽ khác ở đâu?</h3>
<p>Ở Trình độ 1, bạn học <em>đi cho đều</em>: mỗi phách một cú quạt, chắc nịch. Đó là điều đúng đắn phải làm đầu tiên — không ai chạy được khi chưa đứng vững.</p>
<blockquote>Trình độ 2 không dạy bạn đi nhanh hơn. Nó dạy bạn <strong>nhảy múa</strong> trên chính nền phách đều đặn ấy. Mà muốn múa đẹp, cái nền bên dưới phải càng vững, càng đều.</blockquote>
<p>Cho nên, nếu ngay lúc này bạn còn thấy tay mình quạt chưa thật đều, đừng ngại quay lại luyện thêm vài buổi. Đó không phải là lùi — đó là đang <em>gia cố móng</em> cho toà nhà sắp xây. Khi cái đều đã nằm trong máu, ta bước tiếp.</p>'
WHERE id = 'd2c00101-0000-4000-8000-000000000000';

-- 2) Từ nốt đen sang chùm nốt  (d2c00102) — bản đã thầy duyệt
UPDATE edu_course_lessons SET content =
'<h2>Từ nốt đen sang chùm nốt</h2>
<p>Bạn còn nhớ cảm giác lần đầu đệm trọn một bài ở Trình độ 1 không? Tay phải quạt đều &ldquo;chát – chát – chát&rdquo;, giọng hát bắt được nhịp, và trong lòng bạn vang lên một câu: <em>&ldquo;Mình đệm được rồi!&rdquo;</em> Đó là một cột mốc thật sự — và bạn xứng đáng tự hào về nó.</p>
<p>Nhưng rồi, có thể chỉ vài hôm sau, bạn thu âm lại và ngồi nghe. Một cảm giác lạ len vào: <strong>hình như còn thiếu cái gì đó.</strong> Tiếng đàn đúng nhịp, đúng hợp âm, không hề sai — nhưng nghe hơi trống, hơi đều đều, hơi &ldquo;phẳng&rdquo;. Đúng, nhưng chưa <em>đã</em>.</p>
<p>Nếu bạn từng thấy vậy, xin đừng lo. Cảm giác đó không phải dấu hiệu bạn kém đi.</p>
<blockquote>Nó là dấu hiệu <strong>tai nhạc của bạn đang lớn lên</strong> — và nó bắt đầu đòi hỏi nhiều hơn những gì đôi tay hiện giờ mang lại.</blockquote>

<h3>Cái &ldquo;phẳng&rdquo; ấy đến từ đâu?</h3>
<p>Hãy hình dung bạn đang đi bộ trên một con đường, mỗi bước cách nhau đúng một nhịp: <em>bước… bước… bước… bước…</em> Đều đặn, chắc chắn, nhưng đơn điệu. Đó chính là cách đệm ở Trình độ 1: <strong>mỗi phách một tiếng</strong>, một cú quạt xuống.</p>
<div style="background:#F4F4F5;border-radius:8px;padding:12px 16px;margin:14px 0;font-size:15px">Nốt đen — <b>1 phách = 1 tiếng</b> → tay quạt: <b>↓ &nbsp; ↓ &nbsp; ↓ &nbsp; ↓</b></div>
<p>Không có gì sai với những bước chân đều ấy. Chúng là nền móng. Nhưng âm nhạc, giống như cảm xúc con người, cần có <em>chỗ dồn, chỗ nhặt, chỗ rộn ràng</em>. Một tiếng cho mỗi phách thì… hơi ít để kể một câu chuyện.</p>
<p>Vậy các nghệ sĩ đệm hát làm gì để tiếng đàn &ldquo;đầy&rdquo; lên, rộn ràng lên — <strong>mà nhịp vẫn không hề loạn?</strong></p>

<h3>Bí mật hoá ra rất giản dị</h3>
<p>Họ không đổi nhịp. Họ không đàn nhanh hơn. Họ chỉ làm một việc: <strong>chia nhỏ mỗi phách ra thành nhiều tiếng đều nhau.</strong></p>
<p>Thay vì một bước dài, hãy tưởng tượng bạn bước <em>hai bước nhỏ</em> gọn trong đúng khoảng thời gian của một bước cũ. Con đường vẫn dài y như thế, bạn vẫn đến đích đúng lúc — nhưng nhịp chân giờ rộn ràng hẳn.</p>
<div style="background:#EEF2FF;border-radius:8px;padding:12px 16px;margin:14px 0;font-size:15px">Chia đôi — <b>1 phách = 2 tiếng</b> → tay quạt: <b>↓↑ &nbsp; ↓↑ &nbsp; ↓↑ &nbsp; ↓↑</b></div>
<p>Chỉ vậy thôi. Tiếng đàn lập tức &ldquo;dày&rdquo; và tươi hơn hẳn, trong khi người nghe vẫn cảm thấy đúng cái nhịp cũ, quen thuộc, vững vàng.</p>

<h3>Khoảnh khắc &ldquo;à, ra thế&rdquo;</h3>
<p>Đây là điều tinh tế mà nhiều người học lâu năm vẫn nhầm: khi chia phách, <strong>nhịp của bài KHÔNG nhanh lên.</strong> Cái nhanh lên chỉ là <em>số tiếng bên trong mỗi phách</em>. Phách vẫn đập đúng tốc độ ấy — bạn chỉ lấp đầy khoảng trống giữa hai phách bằng những tiếng nhỏ.</p>
<p>Hiểu được điều này, bạn vừa chạm tay vào <strong>gốc rễ của mọi điệu đệm</strong>. Ballad, Bolero, Slowrock, Valse — nghe thì khác nhau một trời một vực, nhưng tất cả đều sinh ra từ một câu hỏi duy nhất: <em>ta chia mỗi phách thành mấy tiếng, và nhấn nhá vào đâu?</em></p>

<h3>Bạn sắp bước vào điều gì</h3>
<p>Cái nhóm nhiều tiếng nhỏ, đều nhau, nằm gọn trong một phách ấy — nó có một cái tên: <strong>chùm nốt</strong>. Đó là viên gạch đầu tiên, và cũng là viên gạch quan trọng nhất, của cả Trình độ 2.</p>
<blockquote>Cái cảm giác &ldquo;còn thiếu gì đó&rdquo; lúc nãy — nó chính là cánh cửa. Bước qua cánh cửa ấy, bạn không chỉ đệm <em>đúng</em> nữa, mà bắt đầu đệm cho <em>hay</em>. Bài kế tiếp, ta gọi đúng tên và mổ xẻ viên gạch đó.</blockquote>'
WHERE id = 'd2c00102-0000-4000-8000-000000000000';

-- 3) Chùm nốt là gì — chia 1 phách thành nhiều tiếng  (d2c00103)
UPDATE edu_course_lessons SET content =
'<h2>Chùm nốt là gì?</h2>
<p>Ở bài trước, ta đã hé lộ một viên gạch chưa gọi tên. Giờ là lúc gọi nó ra ánh sáng và nhìn cho kỹ. Bởi vì — nói không ngoa — nếu bạn thật sự thấm được điều trong bài này, bạn sẽ không bao giờ phải &ldquo;học vẹt&rdquo; một điệu đàn nào nữa.</p>
<p><strong>Chùm nốt</strong> là một nhóm nốt nhỏ, <strong>đều nhau</strong>, cùng nằm gọn trong <strong>một phách</strong>.</p>
<p>Hãy hình dung mỗi phách là một <em>chiếc hộp</em> có kích thước cố định. Ở Trình độ 1, bạn bỏ vào mỗi hộp đúng <em>một viên bi</em>. Chùm nốt đơn giản là: ta bỏ vào cùng chiếc hộp ấy <em>hai</em>, hoặc <em>ba</em> viên bi nhỏ hơn — xếp thật đều. Chiếc hộp không to ra, không nhỏ đi. Chỉ là bên trong nó giờ nhiều hơn.</p>

<h3>Hai loại chùm bạn sẽ dùng suốt Trình độ 2</h3>
<table>
<thead><tr><th>Loại</th><th>Số tiếng / phách</th><th>Cách đếm</th><th>Tên nhạc lý</th></tr></thead>
<tbody>
<tr><td><strong>Chùm 2</strong></td><td>2 tiếng</td><td>&ldquo;1 và&rdquo;</td><td>nốt móc đơn</td></tr>
<tr><td><strong>Chùm 3</strong></td><td>3 tiếng</td><td>&ldquo;1 2 3&rdquo;</td><td>liên 3</td></tr>
</tbody>
</table>
<p>Điểm mấu chốt — hãy đọc chậm câu này: dù chia thành 2 hay 3 tiếng, cả chùm vẫn <strong>chỉ chiếm đúng một phách</strong>. Nhịp đập của bài không hề nhanh lên. Đây là chỗ mà rất nhiều người tự học vấp phải: họ chia phách rồi vô thức… đàn nhanh dần, cuốn theo, loạn nhịp. Bạn thì đã biết trước cái bẫy đó.</p>

<h3>Vì sao đây là chiếc chìa khoá?</h3>
<p>Vì mỗi <strong>điệu đệm</strong> mà bạn từng nghe và mê — thực chất chỉ là một <em>công thức chia phách</em> được đặt tên:</p>
<ul>
<li><strong>Ballad</strong> êm đềm ư? Đó là <strong>chùm 2</strong> được sắp khéo.</li>
<li><strong>Slowrock</strong> dập dìu, <strong>Bolero</strong> da diết ư? Đó là <strong>chùm 3</strong>.</li>
<li>Và <strong>Valse</strong> xoay tròn? Cũng chỉ là chùm nốt, đặt trong nhịp 3/4.</li>
</ul>
<blockquote>Người học vẹt sẽ phải nhớ hàng chục &ldquo;mẫu quạt&rdquo; rời rạc và mau quên. Còn bạn, khi đã nắm chùm nốt, chỉ cần hỏi đúng một câu cho mọi điệu: <em>&ldquo;Phách này chia mấy, nhấn vào đâu?&rdquo;</em> — và tự mình dựng lại được điệu đàn. Đó là khác biệt giữa người <strong>thuộc bài</strong> và người <strong>hiểu bài</strong>.</blockquote>'
WHERE id = 'd2c00103-0000-4000-8000-000000000000';

-- 4) Cách đếm chùm 2: 1 & 2 & 3 & 4 &  (d2c00105)
UPDATE edu_course_lessons SET content =
'<h2>Đếm chùm 2 cho đều — bí quyết nằm ở cái miệng</h2>
<p>Có một sự thật hơi ngược đời mà những người thầy giỏi luôn nhắc: muốn tay quạt cho đều, việc đầu tiên <strong>đừng đụng vào cây đàn</strong>. Hãy để cái miệng học trước. Vì một khi miệng bạn đã đếm trơn tru, đôi tay chỉ việc bám theo — nhẹ tênh. Còn nếu miệng còn lúng túng mà tay đã quạt, bạn sẽ mãi vật lộn với một mớ bòng bong.</p>

<h3>Thêm một chữ nhỏ, mở ra cả thế giới</h3>
<p>Chùm 2 chia mỗi phách làm hai. Để đếm được cái nửa sau ấy, ta chèn thêm một chữ <strong>&ldquo;và&rdquo;</strong>:</p>
<div style="background:#F4F4F5;border-radius:8px;padding:16px;margin:14px 0;font-size:19px;text-align:center;letter-spacing:.04em"><b>1</b> và <b>2</b> và <b>3</b> và <b>4</b> và</div>
<p>Con số là <em>đầu phách</em>. Chữ &ldquo;và&rdquo; là <em>nửa sau</em>. Đọc lên, bạn sẽ nghe thấy nó rộn ràng gấp đôi cái &ldquo;một–hai–ba–bốn&rdquo; khô khan ngày trước.</p>

<h3>Gắn tiếng đếm vào bàn tay</h3>
<p>Giờ mới đến lượt bàn tay, và quy ước cực kỳ tự nhiên:</p>
<ul>
<li><strong>Số (1 2 3 4)</strong> → tay đưa <strong>xuống ↓</strong></li>
<li><strong>&ldquo;và&rdquo;</strong> → tay hất <strong>lên ↑</strong></li>
</ul>
<p>Ghép lại thành một dòng chảy không đứt: <strong>↓↑ ↓↑ ↓↑ ↓↑</strong>. Xuống rồi lên, xuống rồi lên — như hơi thở: <em>ra rồi vào</em>, không bao giờ dừng giữa chừng.</p>

<h3>Điều ít ai nói cho bạn</h3>
<p>Hãy để tay phải <strong>đung đưa đều như một con lắc</strong>, xuống ở &ldquo;số&rdquo; và lên ở &ldquo;và&rdquo; — <em>kể cả khi tay chưa chạm dây</em>. Nghĩa là con lắc ấy đưa liên tục, chỉ khi nào cần tiếng thì mới cho chạm vào dây, còn lại vẫn cứ đưa không.</p>
<blockquote>Đây là bí mật lớn nhất của tay phải: <strong>nhịp nằm ở cánh tay đung đưa, không nằm ở đầu ngón.</strong> Người mới cố &ldquo;gảy đúng lúc&rdquo; bằng ngón tay nên luôn giật cục. Người chơi hay để cả cánh tay lắc đều như con lắc đồng hồ, và dây đàn chỉ là thứ tình cờ nằm trên đường đi của nó.</blockquote>
<p>Hãy tập đếm to &ldquo;một-và-hai-và&rdquo; trong lúc đung đưa tay không, cho tới khi bạn <em>quên mất mình đang đếm</em>. Lúc đó, bạn đã sẵn sàng cho cây đàn.</p>'
WHERE id = 'd2c00105-0000-4000-8000-000000000000';

-- 5) Nghe thử chùm 3 và liên 3 — biết trước, học kỹ sau  (d2c00108)
UPDATE edu_course_lessons SET content =
'<h2>Ghé thăm người anh em: chùm 3</h2>
<p>Bạn vừa làm quen khá kỹ với <strong>chùm 2</strong> — cách chia một phách làm đôi, tươi tắn như bước đi trái-phải. Nhưng chùm 2 có một người anh em, mang tính cách hoàn toàn khác, và hôm nay ta chỉ <em>ghé thăm</em> thôi, chưa ở lại. Vì sao chỉ ghé thăm, cuối bài bạn sẽ hiểu.</p>
<p>Người anh em ấy là <strong>chùm 3</strong> — chia mỗi phách thành <strong>ba tiếng đều nhau</strong>. Nhạc lý gọi nó là <strong>liên 3</strong>.</p>

<h3>Hai tiếng &ldquo;bước đi&rdquo; và ba tiếng &ldquo;đung đưa&rdquo;</h3>
<table>
<thead><tr><th></th><th>Chia mấy phần</th><th>Đếm</th><th>Cảm giác gợi lên</th></tr></thead>
<tbody>
<tr><td><strong>Chùm 2</strong></td><td>2</td><td>&ldquo;1 và&rdquo;</td><td>bước chân, tươi, dứt khoát</td></tr>
<tr><td><strong>Chùm 3</strong></td><td>3</td><td>&ldquo;1 2 3&rdquo;</td><td>lắc lư, dàn trải, đung đưa</td></tr>
</tbody>
</table>
<p>Thử làm thí nghiệm nhỏ ngay bây giờ. Đọc đều &ldquo;<strong>một-và, hai-và</strong>&rdquo; — bạn nghe thấy cái gì đó thẳng thớm, như đang sải bước. Giờ đổi sang &ldquo;<strong>một-hai-ba, một-hai-ba</strong>&rdquo; — lập tức có cái gì đó <em>tròn hơn, mềm hơn</em>, như con thuyền dập dềnh trên sóng, như người ta đưa võng.</p>
<p>Chính cái &ldquo;đung đưa&rdquo; ấy là linh hồn của hai điệu rất được yêu ở Việt Nam: <strong>Slowrock</strong> dập dìu và <strong>Bolero</strong> da diết. Nghe một bản bolero buồn mà thấy lòng chùng xuống, đung đưa — đó chính là chùm 3 đang làm việc.</p>

<h3>Vì sao hôm nay chỉ ghé thăm?</h3>
<p>Bởi vì chùm 3 xứng đáng có cả một chương riêng để luyện cho tới nơi tới chốn. Nếu ta nhồi hết vào đây, bạn sẽ quá tải và cả chùm 2 lẫn chùm 3 đều nửa vời. Nên hôm nay, nhiệm vụ của bạn <em>nhẹ nhàng thôi</em>:</p>
<blockquote>Chỉ cần tai bạn <strong>nghe ra được</strong> rằng &ldquo;chia hai&rdquo; nghe khác &ldquo;chia ba&rdquo; — thế là đủ hành trang. Cái hạt giống nhận biết ấy, gieo xuống hôm nay, sẽ nảy mầm đúng lúc ta tới <strong>Chương 5 — Điệu Slowrock</strong>, nơi bạn sẽ gặp lại người anh em này và ở lại với nó thật lâu.</blockquote>
<p>Còn bây giờ, ta khép chương Chùm nốt lại với một sự tự tin mới: bạn đã hiểu <em>gốc rễ</em> của mọi điệu đàn. Từ đây, học điệu nào cũng chỉ là biến tấu trên nền tảng bạn vừa nắm.</p>'
WHERE id = 'd2c00108-0000-4000-8000-000000000000';

NOTIFY pgrst, 'reload schema';

-- ==================== db/dh2_content_ch2.sql ====================
-- ============================================================================
-- DH2 — Nội dung CỤM TEXT, Chương 2: Tiết tấu quạt (3 bài giảng)
-- Phong cách "dài mà cuốn". Xưng "bạn". UPDATE theo id placeholder. Idempotent.
-- ============================================================================

-- 1) Tiết tấu là gì — mẫu lặp trong âm nhạc  (d2c00200)
UPDATE edu_course_lessons SET content =
'<h2>Tiết tấu là gì?</h2>
<p>Ở chương trước, bạn đã có trong tay một thứ nguyên liệu quý: <strong>chùm nốt</strong>. Nhưng hãy thành thật — có bột chưa chắc gột nên hồ. Một đống gạch đẹp chưa phải là ngôi nhà. Chùm nốt cũng vậy: nó là <em>nguyên liệu</em>, còn thứ biến nguyên liệu ấy thành âm nhạc có hồn, có cá tính — đó là <strong>tiết tấu</strong>.</p>
<p>Vậy tiết tấu là gì? Nói gọn nhất:</p>
<blockquote><strong>Tiết tấu là một mẫu nhấn nhá được lặp đi lặp lại.</strong> Cùng một nắm chùm nốt, nhưng cách bạn sắp xếp chỗ mạnh – chỗ nhẹ – chỗ nghỉ sẽ tạo ra những &ldquo;khuôn mặt&rdquo; hoàn toàn khác nhau.</blockquote>

<h3>Cùng nguyên liệu, khác linh hồn</h3>
<p>Đây là điều kỳ diệu bạn cần cảm cho được. Lấy đúng <strong>chùm 2</strong> mà bạn vừa học. Sắp nó một kiểu, ta có điệu <strong>Ballad</strong> êm đềm ru ngủ. Sắp lại theo kiểu khác — nhấn mạnh vào phách nghịch — ta có ngay chất <strong>Disco</strong> sôi động nhảy nhót. Cùng một nguyên liệu duy nhất!</p>
<p>Giống như 12 nốt nhạc tạo ra mọi bài hát trên đời, hay 24 chữ cái viết nên mọi cuốn sách — sự phong phú không nằm ở <em>số lượng nguyên liệu</em>, mà ở <strong>cách sắp xếp</strong> chúng.</p>

<h3>Vì sao &ldquo;mẫu lặp&rdquo; là một tin cực vui cho bạn</h3>
<p>Hãy để ý chữ <strong>lặp lại</strong>. Một điệu đệm không phải là hàng trăm động tác khác nhau bạn phải nhớ. Nó thường chỉ là <em>một ô nhịp</em> — một mẫu ngắn — được nhắc đi nhắc lại từ đầu đến cuối bài, chỉ thay hợp âm bên tay trái.</p>
<blockquote>Nghĩa là: nắm chắc <strong>một</strong> mẫu tiết tấu, bạn chơi được <strong>cả</strong> bài. Thậm chí cả trăm bài cùng điệu. Đó là lý do vì sao người biết đệm hát có thể ngồi xuống và chơi một bài họ chưa từng tập — họ không thuộc bài, họ thuộc <em>cái mẫu</em>.</blockquote>
<p>Trong chương này, ta sẽ học cách <em>đọc</em> và <em>dựng</em> những mẫu ấy. Và bước đầu tiên, như mọi ngôn ngữ, là học vài ký hiệu thật đơn giản. Bài kế tiếp.</p>'
WHERE id = 'd2c00200-0000-4000-8000-000000000000';

-- 2) Ký hiệu quạt: xuống và lên  (d2c00201)
UPDATE edu_course_lessons SET content =
'<h2>Ký hiệu quạt: xuống ↓ và lên ↑</h2>
<p>Âm nhạc truyền miệng có một nhược điểm chí mạng: nó bay đi mất. Thầy chỉ tay đàn cho bạn xem một mẫu quạt hay, về nhà vài hôm là quên sạch. Bởi vậy, loài người nghĩ ra <em>cách viết lại</em> tiết tấu — và tin vui là thứ &ldquo;chữ viết&rdquo; này gọn đến bất ngờ: chỉ cần <strong>hai mũi tên</strong>.</p>

<h3>Mũi tên xuống ↓ — cú quạt đầy đặn</h3>
<p>Dấu <strong>↓</strong> nghĩa là tay phải quét <strong>từ dây trầm xuống dây cao</strong> — từ trên xuống dưới theo hướng nhìn của bạn. Vì nó thuận theo trọng lực và thường quét qua <em>nhiều dây</em>, tiếng của cú xuống nghe <strong>đầy, chắc, mạnh mẽ</strong>. Đây là cú quạt xương sống, thường rơi vào các phách chính.</p>

<h3>Mũi tên lên ↑ — cú vuốt nhẹ nhàng</h3>
<p>Dấu <strong>↑</strong> là tay hất ngược <strong>từ dây cao lên dây trầm</strong>. Cú này thường chỉ lướt qua <em>vài dây cao</em>, nên tiếng nghe <strong>mỏng hơn, nhẹ hơn, tinh tế hơn</strong>. Nó khéo léo lấp vào những khoảng &ldquo;và&rdquo; giữa các phách, làm tiếng đàn liền lạc mà không nặng nề.</p>
<div style="background:#F4F4F5;border-radius:8px;padding:12px 16px;margin:14px 0;font-size:15px"><b>↓</b> = xuống, tiếng <b>đầy &amp; mạnh</b> &nbsp;·&nbsp; <b>↑</b> = lên, tiếng <b>mỏng &amp; nhẹ</b></div>
<p>Chính cái tương phản đầy–mỏng, mạnh–nhẹ này là thứ tạo nên <em>sức sống</em> cho tiết tấu. Một chuỗi toàn cú xuống nghe sẽ cứng đờ như máy; xen cú lên vào, nó lập tức &ldquo;thở&rdquo;.</p>

<h3>Đọc một dòng tiết tấu</h3>
<p>Giờ khi nhìn một dòng như thế này:</p>
<div style="background:#EEF2FF;border-radius:8px;padding:14px 16px;margin:14px 0;font-size:18px;text-align:center;letter-spacing:.08em"><b>↓ ↓↑ ↑ ↓↑</b></div>
<p>bạn không còn thấy một mớ ký hiệu khó hiểu nữa. Bạn <em>đọc</em> được nó: xuống — xuống-lên — lên — xuống-lên. Như đọc một câu chữ.</p>
<blockquote>Đây là bước ngoặt nhỏ mà quan trọng: từ giờ, mỗi điệu đàn không còn là thứ &ldquo;xem thầy làm rồi bắt chước&rdquo; nữa. Nó trở thành một dòng ký hiệu bạn <strong>đọc được, ghi được, và tự dựng lại được</strong> bất cứ lúc nào. Bạn vừa biết đọc chữ, trong ngôn ngữ của tay phải.</blockquote>'
WHERE id = 'd2c00201-0000-4000-8000-000000000000';

-- 3) Ứng dụng chùm 2 vào nhịp 4/4  (d2c00205)
UPDATE edu_course_lessons SET content =
'<h2>Ghép tất cả lại: chùm 2 trong một ô nhịp 4/4</h2>
<p>Đây là khoảnh khắc mọi mảnh ghép rời rạc bấy nay khớp vào nhau. Bạn đã có chùm 2, đã biết đếm &ldquo;1 và 2 và&rdquo;, đã đọc được ↓ và ↑. Giờ ta đặt tất cả vào một khung quen thuộc nhất của nhạc phổ thông: <strong>nhịp 4/4</strong> — bốn phách một ô.</p>

<h3>Trải chùm 2 lên bốn phách</h3>
<p>Nhịp 4/4 có 4 phách. Cho mỗi phách một chùm 2 (một cú xuống, một cú lên), ta được một chuỗi liền mạch:</p>
<div style="background:#F4F4F5;border-radius:8px;padding:16px;margin:14px 0;font-size:17px;text-align:center;letter-spacing:.03em">
Đếm: &nbsp;<b>1</b> và &nbsp;<b>2</b> và &nbsp;<b>3</b> và &nbsp;<b>4</b> và<br/>
Tay: &nbsp;&nbsp;<b>↓ ↑ &nbsp; ↓ ↑ &nbsp; ↓ ↑ &nbsp; ↓ ↑</b>
</div>
<p>Tám cú quạt đều tăm tắp, gói gọn trong một ô nhịp. Nghe qua thì đơn giản, nhưng khoan — nếu chỉ quạt đều tăm tắp như máy, nó lại rơi vào cái bẫy &ldquo;phẳng&rdquo; mà ta đã nói ở Chương 1.</p>

<h3>Linh hồn nằm ở chỗ nhấn</h3>
<p>Hãy nhớ lại: mỗi ô nhịp có <strong>phách mạnh</strong>. Trong 4/4, phách <strong>1</strong> mạnh nhất, phách <strong>3</strong> mạnh vừa, còn 2 và 4 thì nhẹ. Bạn đưa cái quy luật mạnh–nhẹ đó vào tay phải: <em>nhấn hơi sâu tay ở phách 1 và 3, buông nhẹ ở phách 2 và 4.</em></p>
<div style="background:#EEF2FF;border-radius:8px;padding:14px 16px;margin:14px 0;font-size:16px;text-align:center"><b>Ⓓ</b>↑ &nbsp; ↓↑ &nbsp; <b>Ⓓ</b>↑ &nbsp; ↓↑ &nbsp;&nbsp;<span style="font-size:13px;color:#71717A">(Ⓓ = cú xuống nhấn sâu ở phách 1 &amp; 3)</span></div>
<p>Chỉ một chỉnh sửa nhỏ ấy thôi, chuỗi quạt cứng đờ lập tức có <em>nhịp thở</em>, có chỗ dồn chỗ buông. Và bạn có biết không —</p>
<blockquote>cái mẫu bạn vừa dựng nên chính là <strong>điệu Ballad căn bản nhất</strong>. Bạn chưa hề &ldquo;học điệu Ballad&rdquo;, vậy mà đã tự tay xây được nó từ những viên gạch nền. Đó chính xác là sức mạnh của việc hiểu gốc rễ.</blockquote>

<h3>Và đây là món quà</h3>
<p>Một ô nhịp 4/4 bạn đã quạt trơn tru. Cả bài hát thì sao? Nó chỉ là <em>ô nhịp ấy lặp lại</em>, mỗi lần tay trái đổi sang một hợp âm mới. Tập thật nhuyễn một ô — đều, có nhấn, không vấp — rồi nối vòng lặp lại, và bạn đã cầm trong tay chiếc chìa khoá để đệm hàng trăm bài. Ở các bài thực hành kế tiếp, ta sẽ tập đúng vòng lặp này cùng nền trống và những bài hát quen thuộc.</p>'
WHERE id = 'd2c00205-0000-4000-8000-000000000000';

NOTIFY pgrst, 'reload schema';

-- ==================== db/dh2_content_dieu.sql ====================
-- ============================================================================
-- DH2 — Nội dung CỤM TEXT: Tính chất & kỹ thuật các điệu (theo ý chính của thầy)
-- Ballad · Bolero · Slowrock (tính chất + liên 3 + dàn trải) · Valse (tính chất + trộn chùm 2)
-- Phong cách "dài mà cuốn". Xưng "bạn". Idempotent.
-- ============================================================================

-- ── Ch3 Ballad: Ballad dùng chùm 2 như thế nào  (d2c00301) ──
UPDATE edu_course_lessons SET content =
'<h2>Ballad dùng chùm 2 như thế nào?</h2>
<p>Ở Chương 2, bạn đã tự tay dựng nên một mẫu quạt chùm 2 trong nhịp 4/4 — và mình đã hé rằng nó chính là <strong>Ballad căn bản</strong>. Giờ hãy hiểu vì sao cái mẫu giản dị ấy lại có sức làm mềm lòng người đến thế.</p>
<h3>Chất của Ballad: lãng mạn và nhẹ nhàng</h3>
<p>Ballad là điệu của <strong>tình yêu</strong>, của những lời thủ thỉ. Nó không gào thét, không giật cục. Bí quyết nằm ở hai chữ: <strong>đều đặn</strong>. Tiết tấu Ballad chạy tương đối đều, mượt, <em>không giật</em> — và chính cái đều dịu dàng ấy là thứ ôm lấy người nghe.</p>
<h3>Bí mật nằm ở tempo</h3>
<p>Đây là điều tinh tế nhất, và cũng đẹp nhất, của Ballad:</p>
<blockquote>Tempo của Ballad thường <strong>gần bằng nhịp tim con người</strong>. Khi tiếng đàn đập cùng nhịp với trái tim người nghe, cơ thể họ vô thức &ldquo;đồng bộ&rdquo; theo — và họ thấy dễ chịu, thấy tình, thấy được vỗ về. Đó không phải phép màu, đó là sinh học.</blockquote>
<p>Vì thế, khi đệm Ballad, bạn đừng cố hoa mỹ. Hãy để chùm 2 chạy <strong>đều như hơi thở</strong>: ↓↑ ↓↑ ↓↑ ↓↑, các cú gần bằng nhau, không cú nào bật gắt lên phá vỡ sự êm ả. Nhấn phách mạnh chỉ <em>khẽ thôi</em>, đủ để giữ nhịp, không đủ để làm giật.</p>
<h3>Vì sao nên thạo Ballad đầu tiên</h3>
<p>Trong bốn điệu của Trình độ 2, Ballad là điệu <strong>bao dung nhất</strong>. Nó không đòi hỏi cú nhấn hiểm hóc hay đảo phách rắc rối. Chỉ cần bạn quạt <em>đều và nhẹ</em>, nó đã hay. Đó là lý do ta bắt đầu từ đây.</p>
<blockquote>Ballad dạy bạn một chân lý mà người mới hay quên: <strong>đôi khi, đều đặn chính là đỉnh cao.</strong> Không phải lúc nào &ldquo;nhiều kỹ thuật&rdquo; cũng bằng &ldquo;một nhịp đều biết nâng niu người nghe&rdquo;.</blockquote>'
WHERE id = 'd2c00301-0000-4000-8000-000000000000';

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
