-- ============================================================================
-- DH2 — Nội dung CỤM TEXT, Chương 1: Chùm nốt (5 bài giảng nền)
-- UPDATE content theo id placeholder (từ db/dh2_full.sql). Xưng "bạn". Idempotent.
-- ============================================================================

-- Ôn nhanh: Phách & Nhịp — cầu nối từ Trình độ 1  (d2c00101)
UPDATE edu_course_lessons SET content =
'<h2>Nhắc lại 2 điều cốt lõi từ Trình độ 1</h2>
<p>Trước khi bước vào Trình độ 2, bạn hãy chắc chắn mình còn nhớ hai khái niệm nền — vì mọi thứ sắp học đều dựng trên chúng.</p>
<h3>1. Phách — nhịp đập đều của bài hát</h3>
<p><strong>Phách</strong> là những cú &ldquo;đập&rdquo; đều đặn bạn cảm thấy khi nghe nhạc — đúng chỗ ta hay vỗ tay hoặc giậm chân. Phách chạy đều như tiếng đồng hồ, không nhanh không chậm.</p>
<h3>2. Nhịp — cách gom phách thành từng ô</h3>
<p><strong>Nhịp</strong> gom các phách thành từng nhóm đều nhau. Nhịp <strong>2/4</strong> gom 2 phách một ô, <strong>3/4</strong> gom 3 phách, <strong>4/4</strong> gom 4 phách. Phách đầu mỗi ô là <strong>phách mạnh</strong>.</p>
<h3>Ở Trình độ 1 bạn đã đệm thế nào?</h3>
<p>Mỗi phách bạn quạt <strong>một cái</strong> — đều, chắc, đúng nhịp. Đó là nền tảng vững. Nhưng nếu chỉ vậy, tiếng đệm sẽ hơi <em>thưa và đơn điệu</em>.</p>
<blockquote>Trình độ 2 giải quyết đúng điều đó: ta sẽ <strong>chia nhỏ mỗi phách</strong> thành nhiều tiếng để tiếng đệm rộn ràng, đầy đặn hơn. Khái niệm mở đường là <strong>chùm nốt</strong>.</blockquote>'
WHERE id = 'd2c00101-0000-4000-8000-000000000000';

-- Từ nốt đen sang chùm nốt  (d2c00102)
UPDATE edu_course_lessons SET content =
'<h2>Vì sao cần chia nhỏ phách?</h2>
<p>Ở Trình độ 1, mỗi phách bạn chơi <strong>một nốt đen</strong> — tương ứng <strong>một cú quạt</strong>. Đếm &ldquo;1 – 2 – 3 – 4&rdquo;, mỗi số một tiếng.</p>
<div style="background:#F4F4F5;border-radius:8px;padding:12px 16px;margin:12px 0;font-size:15px">Nốt đen: <b>1 phách = 1 tiếng</b> → quạt: <b>↓ ↓ ↓ ↓</b></div>
<p>Cách này chắc nhịp, nhưng nghe <em>thưa</em> — giống như đi bộ từng bước chậm rãi. Muốn tiếng đàn <strong>rộn ràng</strong> hơn, ta cho mỗi phách <strong>nhiều hơn một tiếng</strong>.</p>
<h3>Chia đôi một phách</h3>
<p>Thay vì một tiếng, ta chơi <strong>hai tiếng đều nhau</strong> trong cùng khoảng thời gian của một phách. Nhịp đập vẫn y nguyên, nhưng bên trong mỗi phách giờ &ldquo;rộn&rdquo; hơn.</p>
<div style="background:#EEF2FF;border-radius:8px;padding:12px 16px;margin:12px 0;font-size:15px">Chia đôi: <b>1 phách = 2 tiếng</b> → quạt: <b>↓↑ ↓↑ ↓↑ ↓↑</b></div>
<blockquote>Nhóm nhiều tiếng nhỏ đều nhau nằm gọn trong một phách — đó gọi là <strong>chùm nốt</strong>. Bài sau sẽ định nghĩa rõ.</blockquote>'
WHERE id = 'd2c00102-0000-4000-8000-000000000000';

-- Chùm nốt là gì — chia 1 phách thành nhiều tiếng  (d2c00103)
UPDATE edu_course_lessons SET content =
'<h2>Chùm nốt là gì?</h2>
<p><strong>Chùm nốt</strong> là một nhóm nốt nhỏ, <strong>đều nhau</strong>, cùng nằm gọn trong <strong>một phách</strong>. Số phách của bài không đổi — ta chỉ chia mỗi phách ra làm nhiều phần bằng nhau.</p>
<table>
<thead><tr><th>Loại</th><th>Số tiếng / phách</th><th>Cách đếm</th><th>Tên nhạc lý</th></tr></thead>
<tbody>
<tr><td><strong>Chùm 2</strong></td><td>2 tiếng</td><td>&ldquo;1 và&rdquo;</td><td>nốt móc đơn</td></tr>
<tr><td><strong>Chùm 3</strong></td><td>3 tiếng</td><td>&ldquo;1 2 3&rdquo;</td><td>liên 3</td></tr>
</tbody>
</table>
<p>Điểm mấu chốt: dù chia thành 2 hay 3 tiếng, cả chùm vẫn <strong>chỉ chiếm đúng một phách</strong>. Nhịp đập của bài không hề nhanh lên — chỉ có bên trong mỗi phách là dày hơn.</p>
<h3>Vì sao chùm nốt quan trọng với đệm hát?</h3>
<p>Mỗi <strong>điệu</strong> (Ballad, Bolero, Slowrock, Valse…) thực chất được xây từ cách chia phách này:</p>
<ul>
<li><strong>Chùm 2</strong> là nền của <strong>Ballad</strong>.</li>
<li><strong>Chùm 3</strong> là nền của <strong>Slowrock</strong> và <strong>Bolero</strong>.</li>
</ul>
<blockquote>Nắm chắc chùm nốt, bạn sẽ hiểu <em>gốc rễ</em> của mọi điệu — thay vì học vẹt từng mẫu quạt.</blockquote>'
WHERE id = 'd2c00103-0000-4000-8000-000000000000';

-- Cách đếm chùm 2: 1 & 2 & 3 & 4 &  (d2c00105)
UPDATE edu_course_lessons SET content =
'<h2>Đếm chùm 2 cho đều</h2>
<p>Chùm 2 chia mỗi phách làm hai. Để đếm, ta thêm chữ <strong>&ldquo;và&rdquo;</strong> vào <em>nửa sau</em> của mỗi phách:</p>
<div style="background:#F4F4F5;border-radius:8px;padding:14px 16px;margin:12px 0;font-size:18px;text-align:center;letter-spacing:.04em">
<b>1</b> và <b>2</b> và <b>3</b> và <b>4</b> và
</div>
<ul>
<li><strong>Số (1 2 3 4)</strong> = đầu phách → tay quạt <strong>xuống ↓</strong></li>
<li><strong>&ldquo;và&rdquo;</strong> = nửa sau phách → tay quạt <strong>lên ↑</strong></li>
</ul>
<p>Ghép lại, tay phải chạy đều: <strong>↓↑ ↓↑ ↓↑ ↓↑</strong> — xuống rồi lên, xuống rồi lên, không ngắt quãng.</p>
<h3>Tập miệng trước, tay sau</h3>
<p>Đừng vội cầm đàn. Hãy <strong>đếm to thành tiếng</strong> &ldquo;một-và-hai-và…&rdquo; trong lúc vỗ tay hoặc gõ bàn, cho thật đều. Khi miệng và tay đã khớp, chuyển sang đàn sẽ nhẹ tênh.</p>
<blockquote>Mẹo: giữ tay phải <em>đung đưa đều</em> như con lắc — xuống ở &ldquo;số&rdquo;, lên ở &ldquo;và&rdquo; — kể cả khi chưa chạm dây. Nhịp nằm ở cánh tay, không phải ở đầu ngón.</blockquote>'
WHERE id = 'd2c00105-0000-4000-8000-000000000000';

-- Nghe thử chùm 3 và liên 3 — biết trước, học kỹ sau  (d2c00108)
UPDATE edu_course_lessons SET content =
'<h2>Làm quen trước với chùm 3</h2>
<p>Bạn vừa học <strong>chùm 2</strong> (chia phách làm hai). Còn một cách chia nữa rất hay gặp: <strong>chùm 3</strong> — chia mỗi phách thành <strong>ba tiếng đều nhau</strong>, nhạc lý gọi là <strong>liên 3</strong>.</p>
<table>
<thead><tr><th></th><th>Chia mấy phần</th><th>Đếm</th><th>Cảm giác</th></tr></thead>
<tbody>
<tr><td><strong>Chùm 2</strong></td><td>2</td><td>&ldquo;1 và&rdquo;</td><td>rộn ràng, tươi</td></tr>
<tr><td><strong>Chùm 3</strong></td><td>3</td><td>&ldquo;1 2 3&rdquo;</td><td>lắc lư, dàn trải</td></tr>
</tbody>
</table>
<p>Chùm 3 tạo cảm giác <em>đung đưa, mềm mại</em> — chính là chất của điệu <strong>Slowrock</strong> và <strong>Bolero</strong>. Thử đếm &ldquo;một-hai-ba, một-hai-ba&rdquo; đều đều, bạn sẽ thấy nó lắc lư khác hẳn cái tươi tắn của &ldquo;một-và-hai-và&rdquo;.</p>
<blockquote>Bài này bạn chỉ cần <strong>nghe và cảm</strong> sự khác nhau giữa chia 2 và chia 3 — chưa cần tập kỹ. Ta sẽ luyện chùm 3 thật sâu ở <strong>Chương 5 — Điệu Slowrock</strong>.</blockquote>'
WHERE id = 'd2c00108-0000-4000-8000-000000000000';

NOTIFY pgrst, 'reload schema';
