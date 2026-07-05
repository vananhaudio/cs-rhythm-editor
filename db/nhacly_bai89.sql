-- ============================================================================
-- CHÌA KHOÁ NHẠC LÝ CƠ BẢN — Điền nội dung Bài 8 & Bài 9 (đang trống)
-- Nhạc lý chung, xưng "bạn". Idempotent (UPDATE theo id).
-- ============================================================================

-- ── BÀI 8: Dấu nối · Dấu chấm dôi · Dấu luyến ──────────────────────────────
UPDATE edu_course_lessons SET content =
'<h2>Ba ký hiệu kéo dài &amp; nối tiếng</h2>
<p>Ở những bài trước, bạn đã biết mỗi nốt có một <strong>trường độ</strong> cố định (đen, trắng, tròn, móc đơn…). Nhưng đôi khi nhạc sĩ cần một âm ngân <em>dài hơn</em> hay hai âm <em>liền mượt</em> với nhau. Khi đó ta dùng ba ký hiệu sau.</p>

<h3>1. Dấu nối (dấu ngân)</h3>
<p>Là một <strong>đường cong</strong> nối <strong>hai nốt CÙNG cao độ</strong> (cùng tên, cùng vị trí trên khuông). Hai nốt được nối lại thành <strong>một tiếng duy nhất</strong>: bạn chỉ đánh/hát nốt đầu, rồi ngân kéo dài đúng bằng tổng trường độ của cả hai.</p>
<blockquote>Đen nối với đen = ngân 2 phách (bằng một nốt trắng). Trắng nối với đen = ngân 3 phách.</blockquote>
<p>Dấu nối rất hay gặp khi một âm cần ngân <strong>vắt qua vạch nhịp</strong> sang ô nhịp sau.</p>

<h3>2. Dấu chấm dôi</h3>
<p>Là một <strong>dấu chấm nhỏ đặt ngay sau nốt</strong>. Nó làm nốt đó <strong>dài thêm một nửa</strong> trường độ vốn có của chính nó.</p>
<table>
<thead><tr><th>Nốt</th><th>Trường độ gốc</th><th>Có chấm dôi</th></tr></thead>
<tbody>
<tr><td>Nốt tròn chấm dôi</td><td>4 phách</td><td>4 + 2 = <strong>6 phách</strong></td></tr>
<tr><td>Nốt trắng chấm dôi</td><td>2 phách</td><td>2 + 1 = <strong>3 phách</strong></td></tr>
<tr><td>Nốt đen chấm dôi</td><td>1 phách</td><td>1 + ½ = <strong>1,5 phách</strong></td></tr>
</tbody>
</table>
<p>Nốt trắng chấm dôi (3 phách) đặc biệt quan trọng: nó chính là âm ngân trọn một ô nhịp <strong>3/4</strong>.</p>

<h3>3. Dấu luyến</h3>
<p>Nhìn cũng là <strong>đường cong</strong>, nhưng nối <strong>hai (hay nhiều) nốt KHÁC cao độ</strong>. Nó không cộng trường độ, mà báo rằng các nốt đó phải được chơi/hát <strong>liền mượt, nối tiếng</strong> với nhau (legato), như trong một hơi thở.</p>

<h3>Phân biệt dấu nối và dấu luyến</h3>
<p>Hai ký hiệu này <strong>trông giống hệt nhau</strong> — đều là đường cong. Chỉ cần nhìn <em>hai nốt ở hai đầu</em> để phân biệt:</p>
<ul>
<li><strong>Cùng cao độ</strong> → là <strong>dấu nối</strong> → cộng dồn trường độ, đánh 1 lần.</li>
<li><strong>Khác cao độ</strong> → là <strong>dấu luyến</strong> → đánh/hát đủ các nốt nhưng thật liền tiếng.</li>
</ul>'
WHERE id = '4ec2e02e-b68e-4ad4-88b8-5df5ddca7403';

-- ── BÀI 9: Đọc nhạc đơn giản ────────────────────────────────────────────────
UPDATE edu_course_lessons SET content =
'<h2>Đọc một bản nhạc từ đầu đến cuối</h2>
<p>Đến đây bạn đã có đủ mảnh ghép: <strong>khuông nhạc, khoá Sol, tên nốt, trường độ, số chỉ nhịp</strong>. Bài này gộp tất cả lại thành một <strong>quy trình đọc</strong> để bạn nhìn vào bất kỳ bản nhạc nào cũng biết bắt đầu từ đâu.</p>

<h3>5 bước đọc một bản nhạc</h3>
<ol>
<li><strong>Nhìn khoá nhạc</strong> ở đầu khuông (khoá Sol) — để biết mỗi dòng, mỗi khe là nốt gì.</li>
<li><strong>Nhìn số chỉ nhịp</strong> (2/4, 3/4, 4/4) — để biết mỗi ô nhịp có mấy phách và đâu là phách mạnh.</li>
<li><strong>Đọc tên nốt</strong> theo vị trí trên khuông, lần lượt từ trái sang phải.</li>
<li><strong>Đọc trường độ</strong> của từng nốt (đen, trắng, tròn, móc đơn, có chấm dôi hay không).</li>
<li><strong>Gõ phách đều tay</strong> và <strong>đọc thành tiếng</strong> tên nốt đúng theo trường độ đó (xướng âm: Đô – Rê – Mi…).</li>
</ol>

<h3>Nhắc lại vị trí nốt trên khoá Sol</h3>
<p>Từ dòng kẻ dưới cùng đi lên, các nốt nằm <strong>trên dòng</strong> lần lượt là: <strong>Mi – Sol – Si – Rê – Fa</strong>. Các nốt nằm <strong>trong khe</strong> (giữa hai dòng) là: <strong>Fa – La – Đô – Mi</strong>. Nhớ được hai chuỗi này là bạn đọc được tên gần như mọi nốt.</p>

<h3>Ba mẹo để đọc trôi chảy</h3>
<ul>
<li><strong>Chậm mà đều</strong> quan trọng hơn nhanh. Chọn tốc độ mà bạn giữ được phách đều từ đầu đến cuối.</li>
<li><strong>Không dừng lại</strong> giữa chừng. Gặp nốt lạ cứ đọc lướt qua rồi quay lại sau, đừng phá nhịp.</li>
<li><strong>Gõ phách bằng chân hoặc tay</strong> trong lúc đọc — cơ thể giữ nhịp giúp mắt rảnh để nhìn nốt.</li>
</ul>
<blockquote>Đọc nhạc giống như đọc chữ: ban đầu đánh vần từng nốt, luyện quen rồi mắt sẽ tự &ldquo;đọc&rdquo; cả câu nhạc một lượt.</blockquote>'
WHERE id = '6650cfbe-8a71-4455-9150-358f0c023134';

NOTIFY pgrst, 'reload schema';
