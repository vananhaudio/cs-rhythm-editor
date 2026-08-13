-- ============================================================================
-- QR links — TÁCH slug cho các bài "chơi & chấm" / bài thưởng (2026-08).
-- Chạy trên Supabase SQL editor. Idempotent (chạy lại bao nhiêu lần cũng được).
--
-- Bối cảnh: trước đây 5 hộp QR trong sách dùng CHUNG slug (baihat / thitau /
-- totnghiep) nên quét ra SAI bài — tất cả rơi về Happy Birthday / Thị tấu Đô
-- trưởng / Ode to Joy. App vốn CÓ sẵn lesson id riêng cho từng bài; file này
-- đăng ký 5 slug mới trỏ đúng bài.
--
-- LƯU Ý: SQL này chỉ sửa TẦNG ĐÍCH. Mã QR đang IN vẫn mã hoá slug cũ
-- (baihat/thitau/totnghiep). Để QR quét ra đúng, còn phải sửa nguồn sách
-- (_build/qrgen.py + _build/fullbook2.py: đổi qr="..." của 5 hộp) rồi BUILD LẠI PDF.
-- Tất cả target dưới đây trỏ LESSON id — LessonViewerPage tự resolve lesson→course
-- và mở đúng bài (xác nhận trong qr_links_update.sql).
-- ============================================================================

INSERT INTO qr_links (slug, target, note) VALUES
  ('mary',        '/course?id=a7720000-0000-4000-8000-000000000004', 'Chặng 6 Bài 9  ↔ Mary Had a Little Lamb (chơi & chấm)'),
  ('buomvang',    '/course?id=a7720000-0000-4000-8000-000000000005', 'Chặng 6 Bài 10 ↔ Kìa con bướm vàng (có nhạc nền)'),
  ('jingle',      '/course?id=a7720000-0000-4000-8000-000000000006', 'Chặng 6 Bài 11 ↔ Jingle Bells (chơi & chấm)'),
  ('oncaodo',     '/course?id=a7720000-0000-4000-8000-000000000001', 'Chặng 7 Bài 1  ↔ Ôn cao độ — đọc nốt khắp cần đàn'),
  ('conduongxua', '/course?id=a7720000-0000-4000-8000-000000000007', 'Chặng 7 Bài 11 ↔ Con đường xưa em đi (bài thưởng, Am)')
ON CONFLICT (slug) DO UPDATE SET target = EXCLUDED.target, note = EXCLUDED.note;

NOTIFY pgrst, 'reload schema';

-- Kiểm tra nhanh sau khi chạy:
-- SELECT slug, target, note FROM qr_links
--   WHERE slug IN ('mary','buomvang','jingle','oncaodo','conduongxua') ORDER BY slug;
