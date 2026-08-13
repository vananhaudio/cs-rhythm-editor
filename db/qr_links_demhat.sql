-- ============================================================================
-- QR links — sách "ĐỆM HÁT 1 — Bản chuẩn" (2026-08-12). Idempotent.
-- Chạy trên Supabase SQL editor (bảng qr_links đã tạo bởi qr_links_setup.sql).
--
-- Kiến trúc như Tỉa Nốt 1: sách in QR cố định class.vananhaudio.com/qr/<slug>;
-- route /qr/<slug> tra bảng này rồi chuyển hướng.
--
-- App CHƯA có bài Đệm hát → mọi slug tạm trỏ '/start' (portal). Cột note ghi rõ
-- asset cần dựng cho từng bài (đây cũng là checklist dựng app đợt đầu — xem
-- "Đệm hát 1/app/mapping.md"). Khi dựng xong bài nào:
--   UPDATE qr_links SET target='/course?id=<lesson_id>' WHERE slug='<slug>';
-- Khi thầy quay video đánh mẫu (các slug đánh dấu [VIDEO]): trỏ thẳng link video.
-- ============================================================================

INSERT INTO qr_links (slug, target, note) VALUES
  ('demhat1',  '/start', 'Trang "Sách đi cùng App" — khoá Đệm hát 1 (portal)'),

  -- Level 1 — một hợp âm Am, quạt đều, nghe chủ động
  ('dh11', '/start', 'Bài 1.1 [VIDEO bấm Am sạch] — audio Am sạch vs tịt; bài nghe tự chấm'),
  ('dh12', '/start', 'Bài 1.2 — metronome + Strum Score nốt đen; tự chấm khớp click'),
  ('dh13', '/start', 'Bài 1.3 — Am drone (ngân dài); đếm giây còn nghe'),
  ('dh14', '/start', 'Bài 1.4 — tách dây (dây 5, dây 1) + trong khối; bài "dây nào?"'),
  ('dh15', '/start', 'Bài 1.5 — drone bám giọng; cặp hợp/chỏi; ghi âm nghe lại'),
  ('dh16', '/start', 'Bài 1.6 — metronome + Strum Score + backing; thử thách 8 ô nhịp'),
  ('dh1check', '/start', 'Tự kiểm L1 — chuỗi tự chấm N1–N9, gợi ý quay lại bài yếu'),

  -- Level 2 — đổi 2 hợp âm, nhịp không vỡ
  ('dh21', '/start', 'Bài 2.1 [VIDEO ngón trụ Am↔C] — audio C sạch; nhận biết lực bấm'),
  ('dh22', '/start', 'Bài 2.2 [VIDEO ngón 3 bay sau phách 4] — Strum Score ô chuẩn bị + điểm đổi; đếm ngược'),
  ('dh23', '/start', 'Bài 2.3 — metronome; tự chấm "khựng ở điểm đổi?"'),
  ('dh24', '/start', 'Bài 2.4 — tách dây 1 (Mi hằng định) & bass (La→Đô); bài "bass đổi? dây 1 đều?"'),
  ('dh25', '/start', 'Bài 2.5 — bài chẩn đoán "lỗi tay phải / lỗi cách chuyển"'),
  ('dh26', '/start', 'Bài 2.6 — backing track Am–C; metronome + Strum Score; 8 lần đổi'),
  ('dh27', '/start', 'Bài 2.7 [VIDEO chặn ngón cái/thumb-mute — ƯU TIÊN SỐ 1] — audio C có/không dây 6; bass nhảy dây'),
  ('dh28', '/start', 'Bài 2.8 — tách bass; backing 3 cặp dây 6 (Am–E, C–G, C–G7)'),
  ('dh2check', '/start', 'Tự kiểm L2 — chuỗi tự chấm L2-N1–N9'),

  -- Level 3 — vòng 4 hợp âm
  ('dh30', '/start', 'Bài 3.0 [VIDEO phạm vi quạt dây 6] — audio E7; ôn thumb-mute'),
  ('dh31', '/start', 'Bài 3.1 — Strum Score theo vòng C–Am–Dm–G7; metronome'),
  ('dh32', '/start', 'Bài 3.2 — metronome; mốc chuẩn bị từng mối nối'),
  ('dh33', '/start', 'Bài 3.3 — bài "đang ở hợp âm thứ mấy / hợp âm kế là gì?"'),
  ('dh34', '/start', 'Bài 3.4 — bài "vòng này về đâu?"; so vòng về C vs về Am'),
  ('dh35', '/start', 'Bài 3.5 — backing 5 vòng; thu âm ngân "ầm ừ"'),
  ('dh36', '/start', 'Bài 3.6 — bài phát hiện lạc; "nghe 2 ô rồi vào lại đúng vòng"'),
  ('dh37', '/start', 'Bài 3.7 — loop + backing + tự chấm (capstone L3)'),
  ('dh3check', '/start', 'Tự kiểm L3 — chuỗi tự chấm L3-N1–N10'),

  -- Level 4 — nhịp & phách
  ('dh41', '/start', 'Bài 4.1 — metronome đa nhịp 2/4·3/4·4/4; Strum Score theo nhịp'),
  ('dh42', '/start', 'Bài 4.2 — metronome nhấn phách 1; bài "nghe trọng âm → nhịp gì?"'),
  ('dh43', '/start', 'Bài 4.3 — Strum Score đánh dấu phách đổi'),
  ('dh44', '/start', 'Bài 4.4 — Strum Score nổi phách đổi giữa ô (2 hợp âm/ô)'),
  ('dh45', '/start', 'Bài 4.5 — Strum Score 3 điểm đổi (3 hợp âm/ô)'),
  ('dh46', '/start', 'Bài 4.6 — bài "hợp âm vừa đổi ở phách mấy?"'),
  ('dh47', '/start', 'Bài 4.7 — đoạn mẫu; tự chấm nhịp/điểm đổi (capstone L4)'),
  ('dh4check', '/start', 'Tự kiểm L4 — chuỗi tự chấm L4-N1–N9'),

  -- Level 5 — tự chuẩn bị & đệm bài mới
  ('dh51', '/start', 'Bài 5.1 — nghe bản gốc vs đã dịch về Am/C'),
  ('dh52', '/start', 'Bài 5.2 [VIDEO capo] — nghe cùng bài ở vài vị trí capo'),
  ('dh53', '/start', 'Bài 5.3 — (bài trên giấy) trỏ trang khoá / mẫu bảng hợp âm'),
  ('dh54', '/start', 'Bài 5.4 — metronome; bài "đặt hợp âm đúng phách của lời"'),
  ('dh55', '/start', 'Bài 5.5 — metronome; thu âm hát + vỗ tay'),
  ('dh56', '/start', 'Bài 5.6 [VIDEO vào hát từ hợp âm] — quạt mẫu + nốt tựa'),
  ('dh57', '/start', 'Bài 5.7 — bài "bài này về đâu?"'),
  ('dh58', '/start', 'Bài 5.8 [VIDEO ghép đàn] — backing/metronome nền'),
  ('dh59', '/start', 'Bài 5.9 — bài hát mới để tự làm trọn quy trình 9 bước (capstone)'),
  ('dh5check', '/start', 'Tự kiểm L5 — chuỗi tự chấm L5-N1–N9')
ON CONFLICT (slug) DO UPDATE SET note = EXCLUDED.note;
-- Lưu ý: ON CONFLICT chỉ cập nhật NOTE, giữ nguyên TARGET — để chạy lại file này
-- không ghi đè các đích thật (bài app / video) đã gắn sau này.

NOTIFY pgrst, 'reload schema';

-- Kiểm tra nhanh:
-- SELECT slug, target, note FROM qr_links WHERE slug LIKE 'dh%' OR slug='demhat1' ORDER BY slug;
