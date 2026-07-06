-- ============================================================================
-- DH2 — Nội dung TEXT còn lại của Chương 1 sau khi gộp/bỏ rườm rà.
-- Chỉ còn: "Chùm nốt là gì" (gộp cả phần 'từ nốt đen') + "Nghe thử chùm 3" (đã dời sang Slowrock).
-- Phong cách "dài mà cuốn" nhưng gọn. Xưng "bạn". Idempotent.
-- ============================================================================

-- Chùm nốt là gì — chia nhỏ phách  (d2c00103) — gộp motivation "từ nốt đen" + định nghĩa
UPDATE edu_course_lessons SET content =
'<h2>Chùm nốt là gì?</h2>
<p>Bạn còn nhớ cảm giác lần đầu đệm trọn một bài ở Trình độ 1 chứ? Tay phải quạt đều &ldquo;chát – chát – chát&rdquo;, và bạn thấy tự hào: <em>&ldquo;Mình đệm được rồi!&rdquo;</em> Nhưng nghe lại, có gì đó… hơi trống, hơi đều đều, hơi <strong>phẳng</strong>. Đúng, mà chưa <em>đã</em>.</p>
<p>Cái &ldquo;phẳng&rdquo; ấy đến từ một điều đơn giản: ở Trình độ 1, <strong>mỗi phách bạn chỉ chơi một tiếng</strong> — một cú quạt. Như đi bộ từng bước đều, chắc, nhưng đơn điệu.</p>
<blockquote>Bí quyết để tiếng đàn &ldquo;đầy&rdquo; và rộn ràng hơn — <em>mà nhịp vẫn không loạn</em> — là <strong>chia nhỏ mỗi phách thành nhiều tiếng đều nhau</strong>. Nhóm nhiều tiếng nhỏ ấy gọi là <strong>chùm nốt</strong>.</blockquote>

<h3>Định nghĩa gọn</h3>
<p><strong>Chùm nốt</strong> = một nhóm nốt nhỏ, <strong>đều nhau</strong>, cùng nằm gọn trong <strong>một phách</strong>. Hãy hình dung mỗi phách là một chiếc hộp cố định: thay vì bỏ vào 1 viên bi, ta bỏ vào 2 hoặc 3 viên nhỏ hơn, xếp thật đều. Hộp không to ra — chỉ bên trong dày hơn.</p>
<table>
<thead><tr><th>Loại</th><th>Số tiếng / phách</th><th>Đếm</th></tr></thead>
<tbody>
<tr><td><strong>Chùm 2</strong> (móc đơn)</td><td>2 tiếng</td><td>&ldquo;1 và&rdquo;</td></tr>
<tr><td><strong>Chùm 3</strong> (liên 3)</td><td>3 tiếng</td><td>&ldquo;1 2 3&rdquo;</td></tr>
</tbody>
</table>
<p>Điểm mấu chốt: dù chia 2 hay 3, cả chùm vẫn <strong>chỉ chiếm đúng một phách</strong> — nhịp của bài <em>không hề nhanh lên</em>. Đây là chỗ nhiều người tự học vấp: chia phách rồi vô thức đàn nhanh dần, loạn nhịp. Bạn thì đã biết trước cái bẫy đó.</p>
<blockquote>Ở Trình độ 2 này ta bắt đầu với <strong>chùm 2</strong> — và chỉ vài bước nữa thôi, bạn sẽ quạt được một bài thật bằng chính nó.</blockquote>'
WHERE id = 'd2c00103-0000-4000-8000-000000000000';

-- Nghe thử chùm 3 và liên 3 — làm quen  (d2c00108) — nay là bài MỞ ĐẦU chương Slowrock
UPDATE edu_course_lessons SET content =
'<h2>Làm quen với chùm 3</h2>
<p>Suốt phần đầu khoá, bạn đã thân với <strong>chùm 2</strong> — chia một phách làm đôi, tươi tắn như bước đi trái‑phải. Giờ ta gặp người anh em của nó: <strong>chùm 3</strong> — chia mỗi phách thành <strong>ba tiếng đều nhau</strong>, nhạc lý gọi là <strong>liên 3</strong>. Đây chính là trái tim của điệu Slowrock.</p>
<table>
<thead><tr><th></th><th>Chia mấy phần</th><th>Đếm</th><th>Cảm giác</th></tr></thead>
<tbody>
<tr><td><strong>Chùm 2</strong></td><td>2</td><td>&ldquo;1 và&rdquo;</td><td>bước đi, tươi, dứt khoát</td></tr>
<tr><td><strong>Chùm 3</strong></td><td>3</td><td>&ldquo;1 2 3&rdquo;</td><td>lắc lư, dàn trải, đung đưa</td></tr>
</tbody>
</table>
<p>Thử ngay: đọc &ldquo;<strong>một‑và, hai‑và</strong>&rdquo; — nghe thẳng thớm như sải bước. Giờ đổi sang &ldquo;<strong>một‑hai‑ba, một‑hai‑ba</strong>&rdquo; — lập tức có gì đó <em>tròn hơn, mềm hơn</em>, như con thuyền dập dềnh, như đưa võng.</p>
<blockquote>Bài này bạn chỉ cần <strong>nghe và cảm</strong> ra &ldquo;chia hai&rdquo; khác &ldquo;chia ba&rdquo; ở đâu — thế là đủ. Các bài kế trong chương sẽ luyện chùm 3 tới nơi tới chốn để bạn chơi được điệu Slowrock đong đưa.</blockquote>'
WHERE id = 'd2c00108-0000-4000-8000-000000000000';

NOTIFY pgrst, 'reload schema';
