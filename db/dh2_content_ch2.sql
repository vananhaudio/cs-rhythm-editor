-- ============================================================================
-- DH2 — Nội dung CỤM TEXT, Chương 2: Tiết tấu quạt (3 bài giảng)
-- Phong cách "dài mà cuốn". Xưng "bạn". UPDATE theo id placeholder. Idempotent.
-- ============================================================================

-- 1) Tiết tấu là gì — mẫu lặp trong âm nhạc  (d2c00200)
UPDATE edu_course_lessons SET content =
'<h2>Tiết tấu là gì?</h2>
<p>Ở chương trước, bạn đã có trong tay một thứ nguyên liệu quý: <strong>chùm nốt</strong>. Nhưng hãy thành thật — có bột chưa chắc gột nên hồ. Một đống gạch đẹp chưa phải là ngôi nhà. Chùm nốt cũng vậy: nó là <em>nguyên liệu</em>, còn thứ biến nguyên liệu ấy thành âm nhạc có hồn, có cá tính — đó là <strong>tiết tấu</strong>.</p>
<p>Vậy tiết tấu là gì? Nói gọn nhất:</p>
<blockquote><strong>Tiết tấu là một mẫu nhấn nhá được lặp đi lặp lại.</strong> Cùng một nắm chùm nốt, nhưng cách bạn sắp xếp chỗ mạnh – chỗ nhẹ – chỗ nghỉ sẽ tạo ra những &ldquo;khuôn mặt&rdquo; hoàn toàn khác nhau.</blockquote>

<h3>Cùng nguyên liệu, khác linh hồn</h3>
<p>Đây là điều kỳ diệu bạn cần cảm cho được. Lấy đúng <strong>chùm 2</strong> mà bạn vừa học. Sắp nó một kiểu, ta có điệu <strong>Ballad</strong> êm đềm ru ngủ. Sắp lại theo kiểu khác — nhấn mạnh vào phách nghịch — ta có ngay chất <strong>Disco</strong> sôi động nhảy nhót. Cùng một nguyên liệu duy nhất!</p>
<p>Giống như 12 nốt nhạc tạo ra mọi bài hát trên đời, hay 24 chữ cái viết nên mọi cuốn sách — sự phong phú không nằm ở <em>số lượng nguyên liệu</em>, mà ở <strong>cách sắp xếp</strong> chúng.</p>

<h3>Vì sao &ldquo;mẫu lặp&rdquo; là một tin cực vui cho bạn</h3>
<p>Hãy để ý chữ <strong>lặp lại</strong>. Một điệu đệm không phải là hàng trăm động tác khác nhau bạn phải nhớ. Nó thường chỉ là <em>một ô nhịp</em> — một mẫu ngắn — được nhắc đi nhắc lại từ đầu đến cuối bài, chỉ thay hợp âm bên tay trái.</p>
<blockquote>Nghĩa là: nắm chắc <strong>một</strong> mẫu tiết tấu, bạn chơi được <strong>cả</strong> bài. Thậm chí cả trăm bài cùng điệu. Đó là lý do vì sao người biết đệm hát có thể ngồi xuống và chơi một bài họ chưa từng tập — họ không thuộc bài, họ thuộc <em>cái mẫu</em>.</blockquote>
<p>Trong chương này, ta sẽ học cách <em>đọc</em> và <em>dựng</em> những mẫu ấy. Và bước đầu tiên, như mọi ngôn ngữ, là học vài ký hiệu thật đơn giản. Bài kế tiếp.</p>'
WHERE id = 'd2c00200-0000-4000-8000-000000000000';

-- 2) Ký hiệu quạt: xuống và lên  (d2c00201)
UPDATE edu_course_lessons SET content =
'<h2>Ký hiệu quạt: xuống ↓ và lên ↑</h2>
<p>Âm nhạc truyền miệng có một nhược điểm chí mạng: nó bay đi mất. Thầy chỉ tay đàn cho bạn xem một mẫu quạt hay, về nhà vài hôm là quên sạch. Bởi vậy, loài người nghĩ ra <em>cách viết lại</em> tiết tấu — và tin vui là thứ &ldquo;chữ viết&rdquo; này gọn đến bất ngờ: chỉ cần <strong>hai mũi tên</strong>.</p>

<h3>Mũi tên xuống ↓ — cú quạt đầy đặn</h3>
<p>Dấu <strong>↓</strong> nghĩa là tay phải quét <strong>từ dây trầm xuống dây cao</strong> — từ trên xuống dưới theo hướng nhìn của bạn. Vì nó thuận theo trọng lực và thường quét qua <em>nhiều dây</em>, tiếng của cú xuống nghe <strong>đầy, chắc, mạnh mẽ</strong>. Đây là cú quạt xương sống, thường rơi vào các phách chính.</p>

<h3>Mũi tên lên ↑ — cú vuốt nhẹ nhàng</h3>
<p>Dấu <strong>↑</strong> là tay hất ngược <strong>từ dây cao lên dây trầm</strong>. Cú này thường chỉ lướt qua <em>vài dây cao</em>, nên tiếng nghe <strong>mỏng hơn, nhẹ hơn, tinh tế hơn</strong>. Nó khéo léo lấp vào những khoảng &ldquo;và&rdquo; giữa các phách, làm tiếng đàn liền lạc mà không nặng nề.</p>
<div style="background:#F4F4F5;border-radius:8px;padding:12px 16px;margin:14px 0;font-size:15px"><b>↓</b> = xuống, tiếng <b>đầy &amp; mạnh</b> &nbsp;·&nbsp; <b>↑</b> = lên, tiếng <b>mỏng &amp; nhẹ</b></div>
<p>Chính cái tương phản đầy–mỏng, mạnh–nhẹ này là thứ tạo nên <em>sức sống</em> cho tiết tấu. Một chuỗi toàn cú xuống nghe sẽ cứng đờ như máy; xen cú lên vào, nó lập tức &ldquo;thở&rdquo;.</p>

<h3>Đọc một dòng tiết tấu</h3>
<p>Giờ khi nhìn một dòng như thế này:</p>
<div style="background:#EEF2FF;border-radius:8px;padding:14px 16px;margin:14px 0;font-size:18px;text-align:center;letter-spacing:.08em"><b>↓ ↓↑ ↑ ↓↑</b></div>
<p>bạn không còn thấy một mớ ký hiệu khó hiểu nữa. Bạn <em>đọc</em> được nó: xuống — xuống-lên — lên — xuống-lên. Như đọc một câu chữ.</p>
<blockquote>Đây là bước ngoặt nhỏ mà quan trọng: từ giờ, mỗi điệu đàn không còn là thứ &ldquo;xem thầy làm rồi bắt chước&rdquo; nữa. Nó trở thành một dòng ký hiệu bạn <strong>đọc được, ghi được, và tự dựng lại được</strong> bất cứ lúc nào. Bạn vừa biết đọc chữ, trong ngôn ngữ của tay phải.</blockquote>'
WHERE id = 'd2c00201-0000-4000-8000-000000000000';

-- 3) Ứng dụng chùm 2 vào nhịp 4/4  (d2c00205)
UPDATE edu_course_lessons SET content =
'<h2>Ghép tất cả lại: chùm 2 trong một ô nhịp 4/4</h2>
<p>Đây là khoảnh khắc mọi mảnh ghép rời rạc bấy nay khớp vào nhau. Bạn đã có chùm 2, đã biết đếm &ldquo;1 và 2 và&rdquo;, đã đọc được ↓ và ↑. Giờ ta đặt tất cả vào một khung quen thuộc nhất của nhạc phổ thông: <strong>nhịp 4/4</strong> — bốn phách một ô.</p>

<h3>Trải chùm 2 lên bốn phách</h3>
<p>Nhịp 4/4 có 4 phách. Cho mỗi phách một chùm 2 (một cú xuống, một cú lên), ta được một chuỗi liền mạch:</p>
<div style="background:#F4F4F5;border-radius:8px;padding:16px;margin:14px 0;font-size:17px;text-align:center;letter-spacing:.03em">
Đếm: &nbsp;<b>1</b> và &nbsp;<b>2</b> và &nbsp;<b>3</b> và &nbsp;<b>4</b> và<br/>
Tay: &nbsp;&nbsp;<b>↓ ↑ &nbsp; ↓ ↑ &nbsp; ↓ ↑ &nbsp; ↓ ↑</b>
</div>
<p>Tám cú quạt đều tăm tắp, gói gọn trong một ô nhịp. Nghe qua thì đơn giản, nhưng khoan — nếu chỉ quạt đều tăm tắp như máy, nó lại rơi vào cái bẫy &ldquo;phẳng&rdquo; mà ta đã nói ở Chương 1.</p>

<h3>Linh hồn nằm ở chỗ nhấn</h3>
<p>Hãy nhớ lại: mỗi ô nhịp có <strong>phách mạnh</strong>. Trong 4/4, phách <strong>1</strong> mạnh nhất, phách <strong>3</strong> mạnh vừa, còn 2 và 4 thì nhẹ. Bạn đưa cái quy luật mạnh–nhẹ đó vào tay phải: <em>nhấn hơi sâu tay ở phách 1 và 3, buông nhẹ ở phách 2 và 4.</em></p>
<div style="background:#EEF2FF;border-radius:8px;padding:14px 16px;margin:14px 0;font-size:16px;text-align:center"><b>Ⓓ</b>↑ &nbsp; ↓↑ &nbsp; <b>Ⓓ</b>↑ &nbsp; ↓↑ &nbsp;&nbsp;<span style="font-size:13px;color:#71717A">(Ⓓ = cú xuống nhấn sâu ở phách 1 &amp; 3)</span></div>
<p>Chỉ một chỉnh sửa nhỏ ấy thôi, chuỗi quạt cứng đờ lập tức có <em>nhịp thở</em>, có chỗ dồn chỗ buông. Và bạn có biết không —</p>
<blockquote>cái mẫu bạn vừa dựng nên chính là <strong>điệu Ballad căn bản nhất</strong>. Bạn chưa hề &ldquo;học điệu Ballad&rdquo;, vậy mà đã tự tay xây được nó từ những viên gạch nền. Đó chính xác là sức mạnh của việc hiểu gốc rễ.</blockquote>

<h3>Và đây là món quà</h3>
<p>Một ô nhịp 4/4 bạn đã quạt trơn tru. Cả bài hát thì sao? Nó chỉ là <em>ô nhịp ấy lặp lại</em>, mỗi lần tay trái đổi sang một hợp âm mới. Tập thật nhuyễn một ô — đều, có nhấn, không vấp — rồi nối vòng lặp lại, và bạn đã cầm trong tay chiếc chìa khoá để đệm hàng trăm bài. Ở các bài thực hành kế tiếp, ta sẽ tập đúng vòng lặp này cùng nền trống và những bài hát quen thuộc.</p>'
WHERE id = 'd2c00205-0000-4000-8000-000000000000';

NOTIFY pgrst, 'reload schema';
