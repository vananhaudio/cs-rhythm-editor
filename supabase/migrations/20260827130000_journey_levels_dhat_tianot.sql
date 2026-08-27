-- ── Map COURSE CŨ → LEVEL cho 2 hành trình: Đệm hát + Tỉa nốt ──
-- Course cũ chỉ còn là container nội bộ; student journey hiểu course = 1 Level.
-- Toàn bộ module trong course → cùng edu_modules.level. Idempotent (UPDATE theo course_id rõ ràng).
-- KHÔNG đụng: module title/order, lesson order/data, course title. KHÔNG map level=tier.

-- ĐỆM HÁT: Đệm hát 1 → L1, Trình Độ 2 → L2, Trình Độ 3 → L3
update public.edu_modules set level = 1 where course_id = '65bccb3e-4740-4103-b1fa-c2009fe67921'; -- Khởi đầu đam mê - Đệm hát cơ bản
update public.edu_modules set level = 2 where course_id = 'c7ab2fcb-aff1-4485-a381-4edc83e4a62b'; -- Đệm Hát Trình Độ 2
update public.edu_modules set level = 3 where course_id = 'd5f963ac-bcd7-45e2-b002-7970ba33e710'; -- Đệm Hát Trình Độ 3

-- TỈA NỐT: Nhập Môn → L1, Tỉa nốt 1 → L2, Tỉa Nốt 2 → L3, Tỉa Nốt 3 → L4
update public.edu_modules set level = 1 where course_id = 'fd23a7a2-bfce-44c6-8bde-6d76289a3625'; -- Khởi Đầu Đam Mê — Nhập Môn
update public.edu_modules set level = 2 where course_id = '4e80d7ec-3b99-426a-a090-990d37eb24c0'; -- Tỉa nốt 1 - Guitar căn bản
update public.edu_modules set level = 3 where course_id = '41e08930-d8ca-4519-9ca5-f4c0aaf62662'; -- Tỉa Nốt 2 (Thị Tấu)
update public.edu_modules set level = 4 where course_id = 'efeababa-fdad-4eab-a88a-a80dab1da2af'; -- Tỉa Nốt 3 (Cảm âm 1)

notify pgrst, 'reload schema';
