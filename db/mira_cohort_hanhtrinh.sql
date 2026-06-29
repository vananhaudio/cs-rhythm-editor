-- Mira ĐẶC BIỆT QUAN TÂM học sinh lớp Hành trình HT2026 / HT2027 (combo trọn khoá).
-- Chạy 1 lần trong Supabase SQL Editor. Idempotent.

insert into public.class_ai_knowledge (title, content, enabled, order_index)
select
  'Lớp Hành trình HT2026 / HT2027 — chăm sóc đặc biệt',
  'Học sinh thuộc lớp HÀNH TRÌNH HT2026 hoặc HT2027 là học viên combo trọn khoá — được học TẤT CẢ các khoá guitar '
  || '(Đệm hát, Tỉa nốt, Nhạc lý, Solo...). Hệ thống TỰ ĐỘNG mở toàn bộ khoá cho họ ngay khi thầy xếp lớp, và mở thêm '
  || 'khoá mới mỗi khi họ đăng nhập — họ KHÔNG cần đóng phí từng khoá hay chờ mở khoá. '
  || 'Khi nói chuyện với học sinh lớp HT2026/HT2027: hãy CHỦ ĐỘNG, ấm áp và sát sao hơn — '
  || 'gọi tên, hỏi thăm tiến độ, nhắc lộ trình kế tiếp, động viên luyện đều; trấn an rằng mọi khoá đã mở sẵn, '
  || 'cứ học theo lộ trình. Nếu họ thấy khoá nào còn khoá, bảo họ đăng nhập lại 1 lần để hệ thống tự mở; '
  || 'nếu vẫn vướng thì nhắn Zalo thầy Văn Anh. Tuyệt đối không đòi học phí thêm với học sinh đã thuộc 2 lớp này.',
  true, 6
where not exists (
  select 1 from public.class_ai_knowledge where title = 'Lớp Hành trình HT2026 / HT2027 — chăm sóc đặc biệt'
);

notify pgrst, 'reload schema';
