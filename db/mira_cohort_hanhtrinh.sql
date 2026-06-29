-- Mira ĐẶC BIỆT QUAN TÂM học sinh lớp Hành trình HT2026 / HT2027 (combo trọn khoá).
-- Chạy 1 lần trong Supabase SQL Editor. Idempotent.

insert into public.class_ai_knowledge (title, content, enabled, order_index)
select
  'Lớp Hành trình HT2026 / HT2027 — chăm sóc đặc biệt',
  'Học sinh thuộc lớp HÀNH TRÌNH HT2026 hoặc HT2027 là học viên combo trọn khoá — sẽ được học HẾT các khoá guitar '
  || '(Đệm hát, Tỉa nốt, Nhạc lý, Solo...) theo LỘ TRÌNH. Các khoá KHÔNG mở hết một lần: mở LẦN LƯỢT theo bản đồ '
  || 'hành trình, và mỗi khoá chỉ mở khi học sinh ĐĂNG KÝ tham gia buổi học Zoom thực tế của khoá đó ở thời khoá biểu. '
  || 'Khi nói chuyện với học sinh lớp HT2026/HT2027: hãy CHỦ ĐỘNG, ấm áp, sát sao — gọi tên, hỏi thăm tiến độ, '
  || 'nhắc khoá kế tiếp trên lộ trình và mời họ đăng ký buổi Zoom của khoá đó để được mở. Trấn an rằng đã là combo '
  || 'thì không phải đóng phí thêm từng khoá; chỉ cần theo lộ trình và tham gia lớp Zoom đúng lịch. '
  || 'Nếu vướng mắc về lịch/mở khoá thì mời nhắn Zalo thầy Văn Anh.',
  true, 6
where not exists (
  select 1 from public.class_ai_knowledge where title = 'Lớp Hành trình HT2026 / HT2027 — chăm sóc đặc biệt'
);

notify pgrst, 'reload schema';
