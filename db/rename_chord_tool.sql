-- Đổi tên công cụ "Chord Seeing" → "Hợp âm" (phụ đề: Luyện tập bấm hợp âm)
-- Icon hiển thị đã được thay bằng SVG sơ đồ hợp âm trong app (special-case theo id),
-- nên trường icon trong DB chỉ là dự phòng — đặt 🎸 cho gọn.
UPDATE public.edu_tools
SET name        = 'Hợp âm',
    description = 'Luyện tập bấm hợp âm',
    icon        = '🎸'
WHERE id = 'chord-seeing';
