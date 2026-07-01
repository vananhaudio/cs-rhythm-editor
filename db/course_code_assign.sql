-- Gán MÃ NĂNG LỰC cho khoá theo Bộ luật Hành trình 2027 (theo id chính xác).
-- Chạy trong Supabase SQL Editor. Idempotent (chạy lại chỉ ghi đè mã, vô hại).

update public.edu_courses set code = 'NM'   where id = 'fd23a7a2-bfce-44c6-8bde-6d76289a3625'; -- Khởi Đầu Đam Mê — Nhập Môn
update public.edu_courses set code = 'DH1'  where id = '65bccb3e-4740-4103-b1fa-c2009fe67921'; -- Đệm hát cơ bản
update public.edu_courses set code = 'DH2'  where id = 'c7ab2fcb-aff1-4485-a381-4edc83e4a62b'; -- Đệm Hát Trình Độ 2
update public.edu_courses set code = 'DH3'  where id = 'd5f963ac-bcd7-45e2-b002-7970ba33e710'; -- Đệm Hát Trình Độ 3
update public.edu_courses set code = 'DHNC' where id = '0cb0c3c3-a6d7-4a73-8220-2fe446059af8'; -- Đệm Hát Nâng Cao
update public.edu_courses set code = 'TN1'  where id = '4e80d7ec-3b99-426a-a090-990d37eb24c0'; -- Tỉa nốt 1
update public.edu_courses set code = 'TN2'  where id = '41e08930-d8ca-4519-9ca5-f4c0aaf62662'; -- Tỉa Nốt Trình Độ 2
update public.edu_courses set code = 'TN3'  where id = 'efeababa-fdad-4eab-a88a-a80dab1da2af'; -- Tỉa Nốt 3 (Cảm âm)
update public.edu_courses set code = 'NL1'  where id = '79706056-ddf5-4741-8811-1f33f4ee0d48'; -- Nhạc Lý Cơ Bản
update public.edu_courses set code = 'NL3'  where id = 'ba3cfaf9-ce08-424a-8536-22bbfe29f825'; -- Hoà Âm – Cảm Âm
update public.edu_courses set code = 'SOLO' where id = 'fd4bbeb2-dca2-4d60-a263-8e9d355b74b9'; -- Solo Guitar

-- CHƯA gán (theo ý thầy):
--   NL2 = Chìa Khoá Nhạc Lý Nâng Cao (2f4a4fb1...) — chưa có nội dung → để trống, gán sau.
--   Không thuộc Hành trình: Nhập Môn Guitar - Guitar Căn Bản, Cảm nhận tông nhạc, Cảm nhận nhịp phách (Cánh Cửa), Nghệ Sĩ Guitar.

notify pgrst, 'reload schema';
