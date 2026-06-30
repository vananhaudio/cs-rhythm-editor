-- Đổi tên Chương 1 của môn "Tỉa nốt 1 - Guitar căn bản" cho khớp triết lý:
-- trục là NỐT/VÙNG NỐT, không lấy "dây" làm chủ đề.
--   Cũ:  "Chương 1: Nốt nhạc cơ bản ở 6 dây đàn"
--   Mới: "Chương 1: Vùng nốt đầu tiên"
-- Idempotent: lookup theo id cố định.

UPDATE edu_modules
SET name = 'Chương 1: Vùng nốt đầu tiên'
WHERE id = 'd2fa1b1f-b3bc-4084-a130-71beb14c98f2';
