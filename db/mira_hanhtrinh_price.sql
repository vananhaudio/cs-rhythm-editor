-- Sửa nhầm lẫn học phí: lớp HÀNH TRÌNH 2027 là combo 10 khoá = 9.990.000đ (KHÔNG phải 990k).
-- Thêm thẻ kiến thức cho Mira. Chạy 1 lần trong Supabase SQL Editor. Idempotent.

insert into public.class_ai_knowledge (title, content, enabled, order_index)
select
  'Học phí — lưu ý lớp Hành Trình 2027',
  'Học phí TỪNG KHÓA lẻ (Đệm hát, Tỉa nốt, Nhạc lý nâng cao...) là 990.000đ/khóa (2 tháng, 8 buổi Zoom). '
  || 'RIÊNG lớp HÀNH TRÌNH 2027 là COMBO trọn 10 khóa, học phí 9.990.000đ — KHÔNG phải 990.000đ. '
  || 'Khi khách hỏi học phí Hành Trình 2027 hoặc combo, phải nói rõ là 9.990.000đ cho trọn 10 khóa (tiết kiệm so với học lẻ), '
  || 'đừng để khách hiểu nhầm thành 990k. Muốn chắc về ưu đãi/trả góp combo thì mời khách nhắn Zalo thầy Văn Anh.',
  true, 5
where not exists (
  select 1 from public.class_ai_knowledge where title = 'Học phí — lưu ý lớp Hành Trình 2027'
);

notify pgrst, 'reload schema';
