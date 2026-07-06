-- ============================================================================
-- ĐỆM HÁT TRÌNH ĐỘ 2 (DH2) — KHUNG 8 CHƯƠNG. QUẠT trước, MÓC cuối (nguyên tắc "It works").
--   Chùm nốt → Tiết tấu → Ballad → Valse → Slowrock → Bolero&móc → Bố cục → Áp dụng.
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
VALUES ('d2c00303-0000-4000-8000-000000000000', '2a3011f7-750e-49e6-9b55-ea0af1725d0d', 'Nền tập Ballad', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> công cụ app 🎛 (Groove Lab điệu Ballad)</p>', 3, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00304-0000-4000-8000-000000000000', '2a3011f7-750e-49e6-9b55-ea0af1725d0d', 'Gảy theo: 1 bài Ballad (chọn bài sau)', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> gảy theo 🎸 (Strum Score)</p>', 4, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;

-- ===== Chương 4: Điệu Valse =====
INSERT INTO edu_modules (id, course_id, name, order_index) VALUES ('271e9988-0e3b-4171-a829-139a6b399263', 'c7ab2fcb-aff1-4485-a381-4edc83e4a62b', 'Chương 4: Điệu Valse', 3)
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

-- ===== Chương 6: Điệu Bolero & kỹ thuật móc =====
INSERT INTO edu_modules (id, course_id, name, order_index) VALUES ('d2000044-0000-4000-8000-000000000044', 'c7ab2fcb-aff1-4485-a381-4edc83e4a62b', 'Chương 6: Điệu Bolero & kỹ thuật móc', 5)
ON CONFLICT (id) DO UPDATE SET course_id = EXCLUDED.course_id, name = EXCLUDED.name, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00400-0000-4000-8000-000000000000', 'd2000044-0000-4000-8000-000000000044', 'Tính chất Bolero', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> bài giảng (text)</p>', 0, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
UPDATE edu_course_lessons SET module_id = 'd2000044-0000-4000-8000-000000000044', order_index = 1, title = 'Chùm 3 lệch phải (đơn – kép – kép) — đặc trưng Bolero' WHERE id = '12bb1218-6dcd-447c-8145-7f7f0302482b';
UPDATE edu_course_lessons SET module_id = 'd2000044-0000-4000-8000-000000000044', order_index = 2 WHERE id = '5f7acacd-9214-48f3-9349-93cc382649fb';
UPDATE edu_course_lessons SET module_id = 'd2000044-0000-4000-8000-000000000044', order_index = 3 WHERE id = 'a85592d5-b519-470d-84d0-4d9182d224b3';
UPDATE edu_course_lessons SET module_id = 'd2000044-0000-4000-8000-000000000044', order_index = 4 WHERE id = 'aec7a2a0-3b49-4902-891d-22c52759d71f';
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00405-0000-4000-8000-000000000000', 'd2000044-0000-4000-8000-000000000044', 'Mẫu rải Ballad đơn giản (kỹ thuật móc)', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> video thầy quay 🎬 — rải/móc, để sau khi thạo quạt</p>', 5, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00406-0000-4000-8000-000000000000', 'd2000044-0000-4000-8000-000000000044', 'Nền tập Bolero', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> công cụ app 🎛 (Groove Lab điệu Bolero)</p>', 6, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)
VALUES ('d2c00407-0000-4000-8000-000000000000', 'd2000044-0000-4000-8000-000000000044', 'Gảy theo: Con đường xưa em đi', 'text', '<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> gảy theo 🎸 (Strum Score) — Bolero</p>', 7, false, 'free')
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

-- ===== Dọn bài placeholder mồ côi (khung cũ) =====
DELETE FROM edu_course_lessons WHERE id::text LIKE 'd2c00%'
  AND id NOT IN (
    'd2c00101-0000-4000-8000-000000000000',
    'd2c00102-0000-4000-8000-000000000000',
    'd2c00103-0000-4000-8000-000000000000',
    'd2c00105-0000-4000-8000-000000000000',
    'd2c00106-0000-4000-8000-000000000000',
    'd2c00107-0000-4000-8000-000000000000',
    'd2c00108-0000-4000-8000-000000000000',
    'd2c00109-0000-4000-8000-000000000000',
    'd2c00200-0000-4000-8000-000000000000',
    'd2c00201-0000-4000-8000-000000000000',
    'd2c00202-0000-4000-8000-000000000000',
    'd2c00205-0000-4000-8000-000000000000',
    'd2c00206-0000-4000-8000-000000000000',
    'd2c00209-0000-4000-8000-000000000000',
    'd2c00210-0000-4000-8000-000000000000',
    'd2c00301-0000-4000-8000-000000000000',
    'd2c00302-0000-4000-8000-000000000000',
    'd2c00303-0000-4000-8000-000000000000',
    'd2c00304-0000-4000-8000-000000000000',
    'd2c00600-0000-4000-8000-000000000000',
    'd2c00601-0000-4000-8000-000000000000',
    'd2c00602-0000-4000-8000-000000000000',
    'd2c00603-0000-4000-8000-000000000000',
    'd2c00604-0000-4000-8000-000000000000',
    'd2c00605-0000-4000-8000-000000000000',
    'd2c00606-0000-4000-8000-000000000000',
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
    'd2c00802-0000-4000-8000-000000000000',
    'd2c00803-0000-4000-8000-000000000000',
    'd2c00804-0000-4000-8000-000000000000',
    'd2c00805-0000-4000-8000-000000000000',
    'd2c00806-0000-4000-8000-000000000000',
    'd2c00807-0000-4000-8000-000000000000'
  );

-- ===== Chuyển cụm Bossa Nova sang Đệm Hát Trình Độ 3 =====
INSERT INTO edu_modules (id, course_id, name, order_index) VALUES ('d3000001-0000-4000-8000-000000000001', 'd5f963ac-bcd7-45e2-b002-7970ba33e710', 'Điệu Bossa Nova (chuyển từ Trình độ 2)', 0)
ON CONFLICT (id) DO UPDATE SET course_id = EXCLUDED.course_id, name = EXCLUDED.name, order_index = EXCLUDED.order_index;
UPDATE edu_course_lessons SET module_id = 'd3000001-0000-4000-8000-000000000001', order_index = 0 WHERE id = 'bbf87a30-8daf-46b3-9af7-796c5a330718';
UPDATE edu_course_lessons SET module_id = 'd3000001-0000-4000-8000-000000000001', order_index = 1 WHERE id = '1ec6e240-afe7-4589-a57f-a318e313bead';
UPDATE edu_course_lessons SET module_id = 'd3000001-0000-4000-8000-000000000001', order_index = 2 WHERE id = 'dbeedf1b-bf9e-4ef6-9413-dd4113255234';
UPDATE edu_course_lessons SET module_id = 'd3000001-0000-4000-8000-000000000001', order_index = 3 WHERE id = 'e2a39c7d-ce7e-4e06-9591-7c3f9b3eb27d';

NOTIFY pgrst, 'reload schema';
