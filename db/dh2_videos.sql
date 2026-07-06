-- ============================================================================
-- DH2 — CỤM VIDEO 🎬 (thầy quay). Mỗi bài: content = "điều cần chú ý khi xem"
-- (soạn trước, chạy được ngay); khi có link → đổi lesson_type='video' + content_url.
-- ============================================================================

-- ── Ch1 · Thực hành quạt chùm 2 — xuống/lên đều  (d2c00107) ──────────────────
-- Bài này dùng VIDEO HƯỚNG DẪN CHÙM 2 (tổng quát) đã có sẵn của thầy — CHỜ link.
-- (Video "Quạt ballad chùm 2" đã chuyển xuống mục Mẫu quạt Ballad ở Chương 3.)
UPDATE edu_course_lessons SET lesson_type = 'text', content_url = NULL, content =
'<h2>Xem thầy đàn — rồi bắt chước cho tới khi thành phản xạ</h2>
<p>Bạn đã hiểu <em>lý thuyết</em> của chùm 2 và cách đếm &ldquo;1 và 2 và&rdquo;. Nhưng đàn là môn của đôi tay, không phải của cái đầu. Ở bài này, hãy xem thật kỹ tay phải của thầy, rồi tạm dừng video và làm theo — càng nhiều lần càng tốt.</p>
<h3>Bốn điều hãy dán mắt vào khi xem</h3>
<ul>
<li><strong>Cổ tay thả lỏng</strong> — tay đàn không gồng, không cứng. Lực đến từ cả cẳng tay đung đưa, không phải từ mấy ngón bấu vào.</li>
<li><strong>Con lắc đều</strong> — tay đưa lên xuống <em>đều như con lắc đồng hồ</em>, không dừng khựng giữa chừng, kể cả lúc chưa cần tiếng.</li>
<li><strong>Xuống ở &ldquo;số&rdquo;, lên ở &ldquo;và&rdquo;</strong> — cú ↓ rơi đúng đầu phách (1 2 3 4), cú ↑ chen vào chữ &ldquo;và&rdquo;.</li>
<li><strong>Tiếng đều, không giật</strong> — các cú quạt gần bằng nhau, mượt mà.</li>
</ul>
<h3>Cách luyện theo video</h3>
<p>Xem một lượt để nắm tổng thể. Lượt hai, <em>tắt tiếng đàn của thầy</em> và quạt theo tay thầy trên màn hình. Lượt ba, tự đàn và tự đếm to. Đừng nóng vội — thà chậm mà đều, còn hơn nhanh mà giật.</p>
<blockquote>Mục tiêu không phải &ldquo;quạt được&rdquo;, mà là quạt tới lúc bạn <strong>không cần nghĩ nữa</strong>. Khi tay tự chạy đều còn đầu óc rảnh để hát — đó là lúc bạn thật sự có nó.</blockquote>'
WHERE id = 'd2c00107-0000-4000-8000-000000000000';

-- Khi thầy gửi link video chùm 2 (tổng quát) đã có sẵn, chạy thêm:
-- UPDATE edu_course_lessons SET lesson_type='video', content_url='<LINK>' WHERE id='d2c00107-0000-4000-8000-000000000000';

-- ── Ch3 Ballad · Mẫu quạt Ballad cơ bản  (d2c00302) ─────────────────────────
-- Video "Quạt ballad chùm 2 — Thầy Văn Anh Guitar" (PwSGfSGeuaE)
UPDATE edu_course_lessons SET lesson_type = 'video', content_url = 'https://www.youtube.com/watch?v=PwSGfSGeuaE', content =
'<h2>Mẫu quạt Ballad — xem thầy đàn</h2>
<p>Đây là lúc chùm 2 biến thành một điệu Ballad hoàn chỉnh. Hãy xem kỹ tay phải của thầy, để ý cái <em>đều đặn, êm ái</em> rất đặc trưng của Ballad — không cú nào bật gắt lên phá vỡ sự dịu dàng.</p>
<h3>Ba điều hãy để ý khi xem</h3>
<ul>
<li><strong>Nhịp đều như hơi thở</strong> — chùm 2 chạy ↓↑ ↓↑ mượt mà, gần bằng nhịp tim, khiến người nghe dễ chịu.</li>
<li><strong>Nhấn phách 1 &amp; 3 thật khẽ</strong> — đủ để giữ nhịp, KHÔNG đủ để làm giật. Đây là bí quyết giữ chất &ldquo;lãng mạn&rdquo;.</li>
<li><strong>Đổi hợp âm gọn</strong> — tay trái chuyển hợp âm đúng đầu ô nhịp, tay phải vẫn quạt đều không khựng.</li>
</ul>
<h3>Cách luyện</h3>
<p>Xem một lượt cảm cái &ldquo;êm&rdquo; của điệu. Sau đó quạt theo thật chậm, giữ đều tuyệt đối, rồi mới tăng dần tốc độ. Khi đã đều, hãy thử đệm cho một câu hát bạn thuộc — bạn sẽ nghe ra ngay: <em>nó ra Ballad thật rồi!</em></p>'
WHERE id = 'd2c00302-0000-4000-8000-000000000000';

NOTIFY pgrst, 'reload schema';
