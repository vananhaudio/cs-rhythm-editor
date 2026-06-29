-- Hoán đổi Chương 3 và Chương 4 của khoá "Khởi đầu đam mê - Đệm hát cơ bản".
--
-- TRƯỚC:
--   Chương 3: Rải hợp âm                                  (order 3, rỗng)
--   Chương 4: Luyện tập vòng hoà âm trên nền trống - bass (order 4)
-- SAU:
--   Chương 3: Luyện tập vòng hoà âm trên nền trống - bass (order 3)
--   Chương 4: Rải hợp âm                                  (order 4)
--
-- Đổi cả order_index lẫn tên (số chương nằm trong tên). Idempotent: lookup theo id.

-- Vòng hoà âm  →  thành Chương 3
UPDATE edu_modules
SET order_index = 3,
    name = 'Chương 3: Luyện tập vòng hoà âm trên nền trống - bass'
WHERE id = '319654a9-f926-4b68-8adb-d5a1f566718d';

-- Rải hợp âm  →  thành Chương 4
UPDATE edu_modules
SET order_index = 4,
    name = 'Chương 4: Rải hợp âm'
WHERE id = 'f9fb42d8-df87-4636-839f-3e1d6d338012';
