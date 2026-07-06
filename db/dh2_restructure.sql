-- ============================================================================
-- ĐỆM HÁT TRÌNH ĐỘ 2 (DH2) — Tái cấu trúc theo mạch học
-- Chùm nốt → Tiết tấu → Điệu → Bố cục đơn giản → Áp dụng vào bài hát thực tế
-- Course: c7ab2fcb-aff1-4485-a381-4edc83e4a62b
-- Bước 1: chỉ dựng KHUNG (chương + gán bài + thứ tự). Nội dung chi tiết làm sau.
-- Idempotent. KHÔNG đổi is_published.
-- ============================================================================

-- ── 5 CHƯƠNG (tái dùng module cũ, đổi tên + order) ──────────────────────────
UPDATE edu_modules SET name = 'Chương 1: Chùm nốt', order_index = 0 WHERE id = '067ae3bb-7812-4485-8fa2-077fccaea2bf'; -- was Tuần 1
UPDATE edu_modules SET name = 'Chương 2: Tiết tấu', order_index = 1 WHERE id = '46e55dbe-dd8f-40b5-a8ec-6464219f7155'; -- was Tuần 2 Ballad
UPDATE edu_modules SET name = 'Chương 3: Điệu (Ballad · Bolero · Bossa Nova)', order_index = 2 WHERE id = '2a3011f7-750e-49e6-9b55-ea0af1725d0d'; -- was Tuần 3 Bolero
UPDATE edu_modules SET name = 'Chương 4: Bố cục đơn giản', order_index = 3 WHERE id = 'a844e611-71a9-48c1-84cf-a645b8c79d08'; -- was Tuần 5
UPDATE edu_modules SET name = 'Chương 5: Áp dụng vào bài hát thực tế', order_index = 4 WHERE id = '974b0073-61d3-4b76-857a-e4f01c738d42'; -- was Tuần 6 (trống)

-- ── GÁN BÀI VÀO CHƯƠNG (module_id + order_index) ────────────────────────────
-- Chương 1: Chùm nốt
UPDATE edu_course_lessons SET module_id = '067ae3bb-7812-4485-8fa2-077fccaea2bf', order_index = 0 WHERE id = 'aca3b657-b2c8-46dd-ac1e-5fe8b7828158'; -- Chào mừng Trình độ 2
UPDATE edu_course_lessons SET module_id = '067ae3bb-7812-4485-8fa2-077fccaea2bf', order_index = 1 WHERE id = '1bc21a87-d39f-48ee-a62c-a753902631cf'; -- Chùm 2 nốt móc đơn
UPDATE edu_course_lessons SET module_id = '067ae3bb-7812-4485-8fa2-077fccaea2bf', order_index = 2 WHERE id = 'db6fddb4-7d3b-4a3b-9a01-f143928f02e5'; -- Chùm 3 – Liên 3 (nền tảng Slowrock)

-- Chương 2: Tiết tấu
UPDATE edu_course_lessons SET module_id = '46e55dbe-dd8f-40b5-a8ec-6464219f7155', order_index = 0 WHERE id = 'df4ddd1b-768b-4d74-8b9a-40a310ac99e9'; -- Tập quạt chùm 2
UPDATE edu_course_lessons SET module_id = '46e55dbe-dd8f-40b5-a8ec-6464219f7155', order_index = 1 WHERE id = 'd76e8798-76bd-485e-b0fb-4fadb6b98458'; -- Bài tập chùm nốt vào nhịp 2/4
UPDATE edu_course_lessons SET module_id = '46e55dbe-dd8f-40b5-a8ec-6464219f7155', order_index = 2 WHERE id = '2f6b416d-7d4f-4bd0-8c13-0e4ad2e11829'; -- Gảy theo: Happy Birthday
UPDATE edu_course_lessons SET module_id = '46e55dbe-dd8f-40b5-a8ec-6464219f7155', order_index = 3 WHERE id = '4692e092-3591-4dda-99d6-265b82e0d34c'; -- Gảy theo: Jingle Bells

-- Chương 3: Điệu (Ballad · Bolero · Bossa Nova)
UPDATE edu_course_lessons SET module_id = '2a3011f7-750e-49e6-9b55-ea0af1725d0d', order_index = 0 WHERE id = '2b73cd3b-cc6e-4ba9-baff-9ef6acc984ac'; -- Ballad: lịch sử/tính chất/tiết tấu
UPDATE edu_course_lessons SET module_id = '2a3011f7-750e-49e6-9b55-ea0af1725d0d', order_index = 1 WHERE id = '12bb1218-6dcd-447c-8145-7f7f0302482b'; -- Bolero: Chùm 3 lệch trái đặc trưng
UPDATE edu_course_lessons SET module_id = '2a3011f7-750e-49e6-9b55-ea0af1725d0d', order_index = 2 WHERE id = '5f7acacd-9214-48f3-9349-93cc382649fb'; -- Bolero móc kiểu 1
UPDATE edu_course_lessons SET module_id = '2a3011f7-750e-49e6-9b55-ea0af1725d0d', order_index = 3 WHERE id = 'a85592d5-b519-470d-84d0-4d9182d224b3'; -- Bolero móc kiểu 2
UPDATE edu_course_lessons SET module_id = '2a3011f7-750e-49e6-9b55-ea0af1725d0d', order_index = 4 WHERE id = 'aec7a2a0-3b49-4902-891d-22c52759d71f'; -- Quạt ballad cho điệp khúc bolero
UPDATE edu_course_lessons SET module_id = '2a3011f7-750e-49e6-9b55-ea0af1725d0d', order_index = 5 WHERE id = 'bbf87a30-8daf-46b3-9af7-796c5a330718'; -- Bài giảng Bossa Nova
UPDATE edu_course_lessons SET module_id = '2a3011f7-750e-49e6-9b55-ea0af1725d0d', order_index = 6 WHERE id = '1ec6e240-afe7-4589-a57f-a318e313bead'; -- Mẫu đệm Bossa Nova tone Am
UPDATE edu_course_lessons SET module_id = '2a3011f7-750e-49e6-9b55-ea0af1725d0d', order_index = 7 WHERE id = 'dbeedf1b-bf9e-4ef6-9413-dd4113255234'; -- Triết lý dùng hợp âm Bossa Nova
UPDATE edu_course_lessons SET module_id = '2a3011f7-750e-49e6-9b55-ea0af1725d0d', order_index = 8 WHERE id = 'e2a39c7d-ce7e-4e06-9591-7c3f9b3eb27d'; -- Bài tập nâng cao (học sinh giỏi)

-- Chương 4: Bố cục đơn giản (bài giảng tổng quát LÊN ĐẦU)
UPDATE edu_course_lessons SET module_id = 'a844e611-71a9-48c1-84cf-a645b8c79d08', order_index = 0 WHERE id = 'd3624d28-47e2-48d3-a1d3-ee7ead6c3de2'; -- Bài giảng: Cấu trúc bài hát (Musical Form)
UPDATE edu_course_lessons SET module_id = 'a844e611-71a9-48c1-84cf-a645b8c79d08', order_index = 1 WHERE id = 'c2a2a5eb-411e-4e0a-a2ed-2a891b5ac970'; -- Bố cục một bài hát thông dụng
UPDATE edu_course_lessons SET module_id = 'a844e611-71a9-48c1-84cf-a645b8c79d08', order_index = 2 WHERE id = '21b2be1b-533a-4d2d-9610-a698e01b31d5'; -- Bố cục mẫu cho một bài Bolero
UPDATE edu_course_lessons SET module_id = 'a844e611-71a9-48c1-84cf-a645b8c79d08', order_index = 3 WHERE id = 'a3a059a1-7b85-4505-962a-aba56892d28f'; -- Bài tập tự luận: phân tích bố cục

-- Chương 5: Áp dụng vào bài hát thực tế — CHƯA CÓ BÀI (soạn sau)

-- ── Xoá module Tuần 4 (Bossanova) đã trống sau khi dời bài sang Chương 3 ─────
DELETE FROM edu_modules WHERE id = '271e9988-0e3b-4171-a829-139a6b399263';

NOTIFY pgrst, 'reload schema';
