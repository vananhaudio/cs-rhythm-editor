-- ============================================================================
-- CHÌA KHOÁ NHẠC LÝ CƠ BẢN — Tái cấu trúc 13 bài thành 5 chương theo chủ đề
-- Course: 79706056-ddf5-4741-8811-1f33f4ee0d48
-- Idempotent: chạy lại nhiều lần OK. (KHÔNG publish/đổi ẩn-hiện ở đây.)
-- ============================================================================

-- ── 5 CHƯƠNG ────────────────────────────────────────────────────────────────
-- Chương 1: tái dùng module cũ (b64ad7f3), đổi tên + order 0
UPDATE edu_modules SET name = 'Chương 1: Âm thanh & Nhạc', order_index = 0
  WHERE id = 'b64ad7f3-0d4d-458a-a849-b76e4c746c57';

INSERT INTO edu_modules (id, course_id, name, order_index) VALUES
  ('b1000002-0000-4000-8000-000000000002', '79706056-ddf5-4741-8811-1f33f4ee0d48', 'Chương 2: Nốt nhạc & Khuông', 1),
  ('b1000003-0000-4000-8000-000000000003', '79706056-ddf5-4741-8811-1f33f4ee0d48', 'Chương 3: Trường độ', 2),
  ('b1000004-0000-4000-8000-000000000004', '79706056-ddf5-4741-8811-1f33f4ee0d48', 'Chương 4: Nhịp & Ô nhịp', 3),
  ('b1000005-0000-4000-8000-000000000005', '79706056-ddf5-4741-8811-1f33f4ee0d48', 'Chương 5: Thực hành đọc nhạc', 4)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, order_index = EXCLUDED.order_index, course_id = EXCLUDED.course_id;

-- ── GÁN 13 BÀI VÀO CHƯƠNG (module_id + order_index) ─────────────────────────
-- Chương 1: Âm thanh & Nhạc
UPDATE edu_course_lessons SET module_id = 'b64ad7f3-0d4d-458a-a849-b76e4c746c57', order_index = 0 WHERE id = '2957fb41-7b4a-418e-902d-c5bd27473d46'; -- Bài 1 Âm thanh
UPDATE edu_course_lessons SET module_id = 'b64ad7f3-0d4d-458a-a849-b76e4c746c57', order_index = 1 WHERE id = '45188585-dfcd-4f0d-a57d-80471ec0ce67'; -- Bài 2.1 Cao độ/Cung
UPDATE edu_course_lessons SET module_id = 'b64ad7f3-0d4d-458a-a849-b76e4c746c57', order_index = 2 WHERE id = '519f0fae-0968-4bfc-9224-0235d0e7bdd1'; -- Bài 2.2 Trường độ-Cường độ-Âm sắc
UPDATE edu_course_lessons SET module_id = 'b64ad7f3-0d4d-458a-a849-b76e4c746c57', order_index = 3 WHERE id = '6465455e-5704-4e0d-bd77-0fc0f3915d02'; -- Bài hát ôn (xen)

-- Chương 2: Nốt nhạc & Khuông
UPDATE edu_course_lessons SET module_id = 'b1000002-0000-4000-8000-000000000002', order_index = 0 WHERE id = '69998853-af2a-46c9-8431-2551cd9c7643'; -- Bài 3 Nốt & ký hiệu
UPDATE edu_course_lessons SET module_id = 'b1000002-0000-4000-8000-000000000002', order_index = 1 WHERE id = 'e3c677f6-4c8b-408a-976f-d838341129c2'; -- Bài 4 Khuông & khoá

-- Chương 3: Trường độ
UPDATE edu_course_lessons SET module_id = 'b1000003-0000-4000-8000-000000000003', order_index = 0 WHERE id = '80ba6209-6e68-490e-96c1-f9781b8c05b7'; -- Bài 5 Trường độ & lặng
UPDATE edu_course_lessons SET module_id = 'b1000003-0000-4000-8000-000000000003', order_index = 1 WHERE id = '4ec2e02e-b68e-4ad4-88b8-5df5ddca7403'; -- Bài 8 Dấu nối/chấm đôi/luyến

-- Chương 4: Nhịp & Ô nhịp
UPDATE edu_course_lessons SET module_id = 'b1000004-0000-4000-8000-000000000004', order_index = 0 WHERE id = 'a2c742e3-d671-4767-88b2-21cd0de28b0c'; -- Bài 6 Nhịp-phách-ô nhịp
UPDATE edu_course_lessons SET module_id = 'b1000004-0000-4000-8000-000000000004', order_index = 1 WHERE id = '132c6e92-932b-4ed0-b10f-450d68545f1f'; -- Bài 7 Các loại nhịp

-- Chương 5: Thực hành đọc nhạc
UPDATE edu_course_lessons SET module_id = 'b1000005-0000-4000-8000-000000000005', order_index = 0 WHERE id = '6650cfbe-8a71-4455-9150-358f0c023134'; -- Bài 9 Đọc nhạc đơn giản
UPDATE edu_course_lessons SET module_id = 'b1000005-0000-4000-8000-000000000005', order_index = 1 WHERE id = '2c083246-48b1-4d20-894b-ce3ee6f23311'; -- Bài 10 Game nốt
UPDATE edu_course_lessons SET module_id = 'b1000005-0000-4000-8000-000000000005', order_index = 2 WHERE id = '853bc817-2ee6-434b-946c-4a33acf39d01'; -- Giải trí: Bài hát (xen cuối)

NOTIFY pgrst, 'reload schema';
