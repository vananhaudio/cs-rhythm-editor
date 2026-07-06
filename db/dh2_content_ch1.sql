-- ============================================================================
-- DH2 — Nội dung CỤM TEXT, Chương 1: Chùm nốt (5 bài giảng nền)
-- Phong cách "dài mà cuốn" (hook + mở vòng + ẩn dụ + câu khai thông). Xưng "bạn".
-- UPDATE content theo id placeholder (từ db/dh2_full.sql). Idempotent.
-- ============================================================================

-- 1) Ôn nhanh: Phách & Nhịp — cầu nối từ Trình độ 1  (d2c00101)
UPDATE edu_course_lessons SET content =
'<h2>Ôn nhanh: Phách &amp; Nhịp — hành trang bước sang Trình độ 2</h2>
<p>Hãy tưởng tượng bạn đang đứng ở một ngưỡng cửa. Phía sau là Trình độ 1 — nơi bạn đã đổ mồ hôi để bấm cho sạch, quạt cho đều, hát cho khớp. Phía trước là Trình độ 2, với những điệu đàn rộn ràng đang chờ. Nhưng trước khi bước qua, ta hãy quay lại nhìn <strong>hai người bạn đồng hành</strong> đã cõng bạn tới tận đây. Vì thật ra, mọi thứ sắp học đều chỉ là trò chơi mới trên chính hai nền tảng cũ này.</p>

<h3>Phách — trái tim thầm lặng của bài hát</h3>
<p>Bạn có để ý, khi nghe một bài hát mình thích, chân bạn tự nhiên giậm, tay tự nhiên vỗ? Cái mà cơ thể bạn bắt được — không cần ai dạy — chính là <strong>phách</strong>. Phách là những cú đập đều đặn chạy ngầm bên dưới mọi giai điệu, như <em>nhịp tim</em>, như tiếng tích-tắc của chiếc đồng hồ treo tường.</p>
<p>Phách không nhanh, không chậm, không cảm xúc. Nó chỉ đều. Và chính cái đều tuyệt đối ấy là điểm tựa để mọi thứ hoa mỹ phía trên được phép bay bổng mà không rơi.</p>

<h3>Nhịp — cách sắp phách thành từng ô</h3>
<p>Nếu phách là những bước chân, thì <strong>nhịp</strong> là cách ta gom các bước ấy thành từng nhóm đều nhau. Nhịp <strong>2/4</strong> gom 2 phách một ô, <strong>3/4</strong> gom 3 phách, <strong>4/4</strong> gom 4 phách. Và trong mỗi ô, phách đầu tiên luôn được nhấn hơn một chút — ta gọi là <strong>phách mạnh</strong>. Nó giống như trọng âm của một câu nói: có nó, câu mới có hồn.</p>
<div style="background:#F4F4F5;border-radius:8px;padding:12px 16px;margin:14px 0;font-size:15px"><b>Mạnh</b>-nhẹ-nhẹ-nhẹ &nbsp;|&nbsp; <b>Mạnh</b>-nhẹ-nhẹ-nhẹ &nbsp;→&nbsp; đó là cảm giác của nhịp 4/4</div>

<h3>Vậy Trình độ 2 sẽ khác ở đâu?</h3>
<p>Ở Trình độ 1, bạn học <em>đi cho đều</em>: mỗi phách một cú quạt, chắc nịch. Đó là điều đúng đắn phải làm đầu tiên — không ai chạy được khi chưa đứng vững.</p>
<blockquote>Trình độ 2 không dạy bạn đi nhanh hơn. Nó dạy bạn <strong>nhảy múa</strong> trên chính nền phách đều đặn ấy. Mà muốn múa đẹp, cái nền bên dưới phải càng vững, càng đều.</blockquote>
<p>Cho nên, nếu ngay lúc này bạn còn thấy tay mình quạt chưa thật đều, đừng ngại quay lại luyện thêm vài buổi. Đó không phải là lùi — đó là đang <em>gia cố móng</em> cho toà nhà sắp xây. Khi cái đều đã nằm trong máu, ta bước tiếp.</p>'
WHERE id = 'd2c00101-0000-4000-8000-000000000000';

-- 2) Từ nốt đen sang chùm nốt  (d2c00102) — bản đã thầy duyệt
UPDATE edu_course_lessons SET content =
'<h2>Từ nốt đen sang chùm nốt</h2>
<p>Bạn còn nhớ cảm giác lần đầu đệm trọn một bài ở Trình độ 1 không? Tay phải quạt đều &ldquo;chát – chát – chát&rdquo;, giọng hát bắt được nhịp, và trong lòng bạn vang lên một câu: <em>&ldquo;Mình đệm được rồi!&rdquo;</em> Đó là một cột mốc thật sự — và bạn xứng đáng tự hào về nó.</p>
<p>Nhưng rồi, có thể chỉ vài hôm sau, bạn thu âm lại và ngồi nghe. Một cảm giác lạ len vào: <strong>hình như còn thiếu cái gì đó.</strong> Tiếng đàn đúng nhịp, đúng hợp âm, không hề sai — nhưng nghe hơi trống, hơi đều đều, hơi &ldquo;phẳng&rdquo;. Đúng, nhưng chưa <em>đã</em>.</p>
<p>Nếu bạn từng thấy vậy, xin đừng lo. Cảm giác đó không phải dấu hiệu bạn kém đi.</p>
<blockquote>Nó là dấu hiệu <strong>tai nhạc của bạn đang lớn lên</strong> — và nó bắt đầu đòi hỏi nhiều hơn những gì đôi tay hiện giờ mang lại.</blockquote>

<h3>Cái &ldquo;phẳng&rdquo; ấy đến từ đâu?</h3>
<p>Hãy hình dung bạn đang đi bộ trên một con đường, mỗi bước cách nhau đúng một nhịp: <em>bước… bước… bước… bước…</em> Đều đặn, chắc chắn, nhưng đơn điệu. Đó chính là cách đệm ở Trình độ 1: <strong>mỗi phách một tiếng</strong>, một cú quạt xuống.</p>
<div style="background:#F4F4F5;border-radius:8px;padding:12px 16px;margin:14px 0;font-size:15px">Nốt đen — <b>1 phách = 1 tiếng</b> → tay quạt: <b>↓ &nbsp; ↓ &nbsp; ↓ &nbsp; ↓</b></div>
<p>Không có gì sai với những bước chân đều ấy. Chúng là nền móng. Nhưng âm nhạc, giống như cảm xúc con người, cần có <em>chỗ dồn, chỗ nhặt, chỗ rộn ràng</em>. Một tiếng cho mỗi phách thì… hơi ít để kể một câu chuyện.</p>
<p>Vậy các nghệ sĩ đệm hát làm gì để tiếng đàn &ldquo;đầy&rdquo; lên, rộn ràng lên — <strong>mà nhịp vẫn không hề loạn?</strong></p>

<h3>Bí mật hoá ra rất giản dị</h3>
<p>Họ không đổi nhịp. Họ không đàn nhanh hơn. Họ chỉ làm một việc: <strong>chia nhỏ mỗi phách ra thành nhiều tiếng đều nhau.</strong></p>
<p>Thay vì một bước dài, hãy tưởng tượng bạn bước <em>hai bước nhỏ</em> gọn trong đúng khoảng thời gian của một bước cũ. Con đường vẫn dài y như thế, bạn vẫn đến đích đúng lúc — nhưng nhịp chân giờ rộn ràng hẳn.</p>
<div style="background:#EEF2FF;border-radius:8px;padding:12px 16px;margin:14px 0;font-size:15px">Chia đôi — <b>1 phách = 2 tiếng</b> → tay quạt: <b>↓↑ &nbsp; ↓↑ &nbsp; ↓↑ &nbsp; ↓↑</b></div>
<p>Chỉ vậy thôi. Tiếng đàn lập tức &ldquo;dày&rdquo; và tươi hơn hẳn, trong khi người nghe vẫn cảm thấy đúng cái nhịp cũ, quen thuộc, vững vàng.</p>

<h3>Khoảnh khắc &ldquo;à, ra thế&rdquo;</h3>
<p>Đây là điều tinh tế mà nhiều người học lâu năm vẫn nhầm: khi chia phách, <strong>nhịp của bài KHÔNG nhanh lên.</strong> Cái nhanh lên chỉ là <em>số tiếng bên trong mỗi phách</em>. Phách vẫn đập đúng tốc độ ấy — bạn chỉ lấp đầy khoảng trống giữa hai phách bằng những tiếng nhỏ.</p>
<p>Hiểu được điều này, bạn vừa chạm tay vào <strong>gốc rễ của mọi điệu đệm</strong>. Ballad, Bolero, Slowrock, Valse — nghe thì khác nhau một trời một vực, nhưng tất cả đều sinh ra từ một câu hỏi duy nhất: <em>ta chia mỗi phách thành mấy tiếng, và nhấn nhá vào đâu?</em></p>

<h3>Bạn sắp bước vào điều gì</h3>
<p>Cái nhóm nhiều tiếng nhỏ, đều nhau, nằm gọn trong một phách ấy — nó có một cái tên: <strong>chùm nốt</strong>. Đó là viên gạch đầu tiên, và cũng là viên gạch quan trọng nhất, của cả Trình độ 2.</p>
<blockquote>Cái cảm giác &ldquo;còn thiếu gì đó&rdquo; lúc nãy — nó chính là cánh cửa. Bước qua cánh cửa ấy, bạn không chỉ đệm <em>đúng</em> nữa, mà bắt đầu đệm cho <em>hay</em>. Bài kế tiếp, ta gọi đúng tên và mổ xẻ viên gạch đó.</blockquote>'
WHERE id = 'd2c00102-0000-4000-8000-000000000000';

-- 3) Chùm nốt là gì — chia 1 phách thành nhiều tiếng  (d2c00103)
UPDATE edu_course_lessons SET content =
'<h2>Chùm nốt là gì?</h2>
<p>Ở bài trước, ta đã hé lộ một viên gạch chưa gọi tên. Giờ là lúc gọi nó ra ánh sáng và nhìn cho kỹ. Bởi vì — nói không ngoa — nếu bạn thật sự thấm được điều trong bài này, bạn sẽ không bao giờ phải &ldquo;học vẹt&rdquo; một điệu đàn nào nữa.</p>
<p><strong>Chùm nốt</strong> là một nhóm nốt nhỏ, <strong>đều nhau</strong>, cùng nằm gọn trong <strong>một phách</strong>.</p>
<p>Hãy hình dung mỗi phách là một <em>chiếc hộp</em> có kích thước cố định. Ở Trình độ 1, bạn bỏ vào mỗi hộp đúng <em>một viên bi</em>. Chùm nốt đơn giản là: ta bỏ vào cùng chiếc hộp ấy <em>hai</em>, hoặc <em>ba</em> viên bi nhỏ hơn — xếp thật đều. Chiếc hộp không to ra, không nhỏ đi. Chỉ là bên trong nó giờ nhiều hơn.</p>

<h3>Hai loại chùm bạn sẽ dùng suốt Trình độ 2</h3>
<table>
<thead><tr><th>Loại</th><th>Số tiếng / phách</th><th>Cách đếm</th><th>Tên nhạc lý</th></tr></thead>
<tbody>
<tr><td><strong>Chùm 2</strong></td><td>2 tiếng</td><td>&ldquo;1 và&rdquo;</td><td>nốt móc đơn</td></tr>
<tr><td><strong>Chùm 3</strong></td><td>3 tiếng</td><td>&ldquo;1 2 3&rdquo;</td><td>liên 3</td></tr>
</tbody>
</table>
<p>Điểm mấu chốt — hãy đọc chậm câu này: dù chia thành 2 hay 3 tiếng, cả chùm vẫn <strong>chỉ chiếm đúng một phách</strong>. Nhịp đập của bài không hề nhanh lên. Đây là chỗ mà rất nhiều người tự học vấp phải: họ chia phách rồi vô thức… đàn nhanh dần, cuốn theo, loạn nhịp. Bạn thì đã biết trước cái bẫy đó.</p>

<h3>Vì sao đây là chiếc chìa khoá?</h3>
<p>Vì mỗi <strong>điệu đệm</strong> mà bạn từng nghe và mê — thực chất chỉ là một <em>công thức chia phách</em> được đặt tên:</p>
<ul>
<li><strong>Ballad</strong> êm đềm ư? Đó là <strong>chùm 2</strong> được sắp khéo.</li>
<li><strong>Slowrock</strong> dập dìu, <strong>Bolero</strong> da diết ư? Đó là <strong>chùm 3</strong>.</li>
<li>Và <strong>Valse</strong> xoay tròn? Cũng chỉ là chùm nốt, đặt trong nhịp 3/4.</li>
</ul>
<blockquote>Người học vẹt sẽ phải nhớ hàng chục &ldquo;mẫu quạt&rdquo; rời rạc và mau quên. Còn bạn, khi đã nắm chùm nốt, chỉ cần hỏi đúng một câu cho mọi điệu: <em>&ldquo;Phách này chia mấy, nhấn vào đâu?&rdquo;</em> — và tự mình dựng lại được điệu đàn. Đó là khác biệt giữa người <strong>thuộc bài</strong> và người <strong>hiểu bài</strong>.</blockquote>'
WHERE id = 'd2c00103-0000-4000-8000-000000000000';

-- 4) Cách đếm chùm 2: 1 & 2 & 3 & 4 &  (d2c00105)
UPDATE edu_course_lessons SET content =
'<h2>Đếm chùm 2 cho đều — bí quyết nằm ở cái miệng</h2>
<p>Có một sự thật hơi ngược đời mà những người thầy giỏi luôn nhắc: muốn tay quạt cho đều, việc đầu tiên <strong>đừng đụng vào cây đàn</strong>. Hãy để cái miệng học trước. Vì một khi miệng bạn đã đếm trơn tru, đôi tay chỉ việc bám theo — nhẹ tênh. Còn nếu miệng còn lúng túng mà tay đã quạt, bạn sẽ mãi vật lộn với một mớ bòng bong.</p>

<h3>Thêm một chữ nhỏ, mở ra cả thế giới</h3>
<p>Chùm 2 chia mỗi phách làm hai. Để đếm được cái nửa sau ấy, ta chèn thêm một chữ <strong>&ldquo;và&rdquo;</strong>:</p>
<div style="background:#F4F4F5;border-radius:8px;padding:16px;margin:14px 0;font-size:19px;text-align:center;letter-spacing:.04em"><b>1</b> và <b>2</b> và <b>3</b> và <b>4</b> và</div>
<p>Con số là <em>đầu phách</em>. Chữ &ldquo;và&rdquo; là <em>nửa sau</em>. Đọc lên, bạn sẽ nghe thấy nó rộn ràng gấp đôi cái &ldquo;một–hai–ba–bốn&rdquo; khô khan ngày trước.</p>

<h3>Gắn tiếng đếm vào bàn tay</h3>
<p>Giờ mới đến lượt bàn tay, và quy ước cực kỳ tự nhiên:</p>
<ul>
<li><strong>Số (1 2 3 4)</strong> → tay đưa <strong>xuống ↓</strong></li>
<li><strong>&ldquo;và&rdquo;</strong> → tay hất <strong>lên ↑</strong></li>
</ul>
<p>Ghép lại thành một dòng chảy không đứt: <strong>↓↑ ↓↑ ↓↑ ↓↑</strong>. Xuống rồi lên, xuống rồi lên — như hơi thở: <em>ra rồi vào</em>, không bao giờ dừng giữa chừng.</p>

<h3>Điều ít ai nói cho bạn</h3>
<p>Hãy để tay phải <strong>đung đưa đều như một con lắc</strong>, xuống ở &ldquo;số&rdquo; và lên ở &ldquo;và&rdquo; — <em>kể cả khi tay chưa chạm dây</em>. Nghĩa là con lắc ấy đưa liên tục, chỉ khi nào cần tiếng thì mới cho chạm vào dây, còn lại vẫn cứ đưa không.</p>
<blockquote>Đây là bí mật lớn nhất của tay phải: <strong>nhịp nằm ở cánh tay đung đưa, không nằm ở đầu ngón.</strong> Người mới cố &ldquo;gảy đúng lúc&rdquo; bằng ngón tay nên luôn giật cục. Người chơi hay để cả cánh tay lắc đều như con lắc đồng hồ, và dây đàn chỉ là thứ tình cờ nằm trên đường đi của nó.</blockquote>
<p>Hãy tập đếm to &ldquo;một-và-hai-và&rdquo; trong lúc đung đưa tay không, cho tới khi bạn <em>quên mất mình đang đếm</em>. Lúc đó, bạn đã sẵn sàng cho cây đàn.</p>'
WHERE id = 'd2c00105-0000-4000-8000-000000000000';

-- 5) Nghe thử chùm 3 và liên 3 — biết trước, học kỹ sau  (d2c00108)
UPDATE edu_course_lessons SET content =
'<h2>Ghé thăm người anh em: chùm 3</h2>
<p>Bạn vừa làm quen khá kỹ với <strong>chùm 2</strong> — cách chia một phách làm đôi, tươi tắn như bước đi trái-phải. Nhưng chùm 2 có một người anh em, mang tính cách hoàn toàn khác, và hôm nay ta chỉ <em>ghé thăm</em> thôi, chưa ở lại. Vì sao chỉ ghé thăm, cuối bài bạn sẽ hiểu.</p>
<p>Người anh em ấy là <strong>chùm 3</strong> — chia mỗi phách thành <strong>ba tiếng đều nhau</strong>. Nhạc lý gọi nó là <strong>liên 3</strong>.</p>

<h3>Hai tiếng &ldquo;bước đi&rdquo; và ba tiếng &ldquo;đung đưa&rdquo;</h3>
<table>
<thead><tr><th></th><th>Chia mấy phần</th><th>Đếm</th><th>Cảm giác gợi lên</th></tr></thead>
<tbody>
<tr><td><strong>Chùm 2</strong></td><td>2</td><td>&ldquo;1 và&rdquo;</td><td>bước chân, tươi, dứt khoát</td></tr>
<tr><td><strong>Chùm 3</strong></td><td>3</td><td>&ldquo;1 2 3&rdquo;</td><td>lắc lư, dàn trải, đung đưa</td></tr>
</tbody>
</table>
<p>Thử làm thí nghiệm nhỏ ngay bây giờ. Đọc đều &ldquo;<strong>một-và, hai-và</strong>&rdquo; — bạn nghe thấy cái gì đó thẳng thớm, như đang sải bước. Giờ đổi sang &ldquo;<strong>một-hai-ba, một-hai-ba</strong>&rdquo; — lập tức có cái gì đó <em>tròn hơn, mềm hơn</em>, như con thuyền dập dềnh trên sóng, như người ta đưa võng.</p>
<p>Chính cái &ldquo;đung đưa&rdquo; ấy là linh hồn của hai điệu rất được yêu ở Việt Nam: <strong>Slowrock</strong> dập dìu và <strong>Bolero</strong> da diết. Nghe một bản bolero buồn mà thấy lòng chùng xuống, đung đưa — đó chính là chùm 3 đang làm việc.</p>

<h3>Vì sao hôm nay chỉ ghé thăm?</h3>
<p>Bởi vì chùm 3 xứng đáng có cả một chương riêng để luyện cho tới nơi tới chốn. Nếu ta nhồi hết vào đây, bạn sẽ quá tải và cả chùm 2 lẫn chùm 3 đều nửa vời. Nên hôm nay, nhiệm vụ của bạn <em>nhẹ nhàng thôi</em>:</p>
<blockquote>Chỉ cần tai bạn <strong>nghe ra được</strong> rằng &ldquo;chia hai&rdquo; nghe khác &ldquo;chia ba&rdquo; — thế là đủ hành trang. Cái hạt giống nhận biết ấy, gieo xuống hôm nay, sẽ nảy mầm đúng lúc ta tới <strong>Chương 5 — Điệu Slowrock</strong>, nơi bạn sẽ gặp lại người anh em này và ở lại với nó thật lâu.</blockquote>
<p>Còn bây giờ, ta khép chương Chùm nốt lại với một sự tự tin mới: bạn đã hiểu <em>gốc rễ</em> của mọi điệu đàn. Từ đây, học điệu nào cũng chỉ là biến tấu trên nền tảng bạn vừa nắm.</p>'
WHERE id = 'd2c00108-0000-4000-8000-000000000000';

NOTIFY pgrst, 'reload schema';
