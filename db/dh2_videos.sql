-- ============================================================================
-- DH2 — CỤM VIDEO 🎬 (thầy quay). Mỗi bài: content = "điều cần chú ý khi xem"
-- (soạn trước, chạy được ngay); khi có link → đổi lesson_type='video' + content_url.
-- ============================================================================

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
