-- ============================================================================
-- DH2 — Nội dung CỤM TEXT (ít phụ thuộc gu điệu): Ch7 Bố cục (4) + Ch8 Áp dụng (3)
--        + bài nhạc lý nhịp 3/4 của Ch6 Valse (1). Phong cách "dài mà cuốn".
-- Các bài "tính chất điệu" và "bố cục mẫu theo bài" để dành khi có ý chính của thầy.
-- ============================================================================

-- ── Ch7: Intro — Phiên khúc — Điệp khúc — Cầu nối — Kết  (d2c00701) ──
UPDATE edu_course_lessons SET content =
'<h2>Bài hát nào cũng là một hành trình có bố cục</h2>
<p>Bạn hãy nhớ lại lần gần nhất nghe một bài mình yêu. Có phải mở đầu là một đoạn dạo êm êm, rồi giọng hát vào kể lể tâm tình, rồi bỗng tới một câu mà <em>cả phòng karaoke gào lên</em>, rồi lắng lại, rồi kết? Bạn vừa mô tả — mà không hề biết — <strong>bố cục</strong> của một bài hát. Ai cũng <em>cảm</em> được nó. Nhưng người biết đệm thì phải <em>gọi tên</em> được nó. Vì gọi tên được, bạn mới đệm chủ động thay vì chạy theo.</p>
<p>Một bài phổ thông thường có 5 phần, như 5 chặng của một chuyến đi:</p>
<h3>Intro — mở màn</h3>
<p>Đoạn dạo đầu, thường không lời. Nhiệm vụ của nó là <em>dựng không khí</em> và báo cho người nghe biết: sắp vào bài rồi đấy. Với người đệm, đây là chỗ bạn &ldquo;đặt nhịp&rdquo; cho cả bài.</p>
<h3>Phiên khúc — kể chuyện</h3>
<p>Đoạn hát chính đầu tiên (verse). Đây là lúc bài hát <em>thủ thỉ</em>, đưa thông tin, dẫn dắt. Cảm xúc còn ghìm lại, chưa bung. Người đệm ở đây nên <strong>nhẹ tay</strong>, nhường sân khấu cho giọng hát.</p>
<h3>Điệp khúc — cao trào</h3>
<p>Đoạn ai cũng thuộc, câu hát &ldquo;đắt&rdquo; nhất, nơi cảm xúc <em>vỡ oà</em> (chorus). Đây là đỉnh của con dốc. Người đệm phải <strong>bung ra</strong>: đầy hơn, mạnh hơn, chắc hơn — để nâng giọng hát bay lên.</p>
<h3>Cầu nối — đổi gió</h3>
<p>Một đoạn hơi &ldquo;lạ tai&rdquo; chèn vào giữa (bridge), thường trước điệp khúc cuối. Nó chống lại sự nhàm chán khi các đoạn cứ lặp, và tạo một bậc thang cảm xúc mới. Không phải bài nào cũng có.</p>
<h3>Kết — hạ màn</h3>
<p>Đoạn khép lại (outro), đưa cảm xúc về chỗ nghỉ. Có thể nhắc lại điệp khúc nhỏ dần, hoặc buông một hợp âm ngân dài.</p>
<blockquote>Khi bạn nhìn ra 5 chặng này trong một bài, bạn <strong>biết trước bài sẽ đi đâu</strong> — chỗ nào ghìm, chỗ nào bung. Người đệm giỏi không chạy theo bài hát; họ <em>đi cùng</em> nó, vì họ đã cầm sẵn tấm bản đồ.</blockquote>'
WHERE id = 'd2c00701-0000-4000-8000-000000000000';

-- ── Ch7: Chọn điệu theo tính chất bài hát  (d2c00703) ──
UPDATE edu_course_lessons SET content =
'<h2>Chọn điệu — quyết định đầu tiên, và quan trọng nhất</h2>
<p>Có một sự thật hơi phũ: bạn có thể bấm hợp âm sạch bong, quạt đều tăm tắp, nhưng nếu <strong>chọn sai điệu</strong>, cả bài vẫn hỏng. Đệm một bản tình ca da diết bằng điệu tưng bừng nhảy nhót thì… nghe như mặc vest đi tắm biển. Không sai kỹ thuật, chỉ sai <em>tinh thần</em>.</p>
<p>Vậy nên, trước khi chạm dây, hãy dừng lại vài giây và hỏi: <em>bài này mang tính chất gì?</em></p>
<h3>Lắng nghe cái &ldquo;chất&rdquo; của bài</h3>
<p>Bạn không cần lý thuyết cao siêu, chỉ cần <strong>hát nhẩm</strong> bài đó và cảm:</p>
<ul>
<li>Lời <strong>buồn, tâm sự, chậm rãi</strong>, giai điệu ngân dài → nghiêng về <strong>Ballad, Slowrock, Bolero</strong>.</li>
<li>Nhịp <strong>đung đưa, dập dìu như ru</strong> → chất của <strong>chùm 3</strong>: Slowrock, Bolero.</li>
<li>Giai điệu <strong>xoay tròn, nhịp nhàng ba phách</strong>, kiểu valse cổ điển → <strong>Valse</strong>.</li>
<li>Tươi tắn, đều đặn, dễ vỗ tay → <strong>Ballad</strong> nhịp 4/4 tươi.</li>
</ul>
<h3>Mẹo cực đơn giản mà hiệu quả</h3>
<p>Hát nhẩm câu điệp khúc, rồi thử <strong>gõ tay lên đùi</strong> theo hai ba kiểu điệu khác nhau. Kiểu nào khiến bạn thấy &ldquo;khớp&rdquo;, thấy đã, thấy đúng cảm xúc bài hát — đó là điệu của nó. Tai và cơ thể bạn thường biết câu trả lời trước cả cái đầu.</p>
<blockquote>Chọn điệu không phải là tra bảng, mà là <strong>lắng nghe</strong>. Càng nghe nhiều, cảm nhạc càng nhạy, và một ngày bạn sẽ chọn đúng điệu chỉ sau vài giây — như phản xạ.</blockquote>'
WHERE id = 'd2c00703-0000-4000-8000-000000000000';

-- ── Ch7: Chọn sắc thái theo từng đoạn  (d2c00704) ──
UPDATE edu_course_lessons SET content =
'<h2>Trong một bài, cảm xúc có lên có xuống</h2>
<p>Bạn đã chọn đúng điệu. Nhưng nếu từ câu đầu đến câu cuối bạn đệm <em>y hệt nhau</em> — cùng một độ mạnh, cùng một độ dày — thì dù đúng điệu, bài vẫn nghe <strong>phẳng lì, vô cảm</strong>, như một người kể chuyện đều đều một giọng suốt hai tiếng đồng hồ.</p>
<p>Vì một bài hát không phải đường thẳng. Nó là những ngọn đồi: chỗ trầm xuống thủ thỉ, chỗ dâng lên vỡ oà. Nhiệm vụ của người đệm là <strong>đi theo đường cong cảm xúc ấy</strong>.</p>
<h3>Quy tắc vàng: ghìm ở phiên khúc, bung ở điệp khúc</h3>
<p>Nhớ lại bố cục bạn vừa học. Cùng một điệu, nhưng:</p>
<ul>
<li><strong>Phiên khúc</strong> (đoạn kể chuyện) → đệm <em>nhẹ, thưa, kín đáo</em>. Đây là lúc lời hát cần được nghe rõ, tiếng đàn chỉ nên là tấm nền êm phía sau.</li>
<li><strong>Điệp khúc</strong> (cao trào) → đệm <em>đầy, mạnh, chắc</em>. Đây là lúc bạn được phép &ldquo;tung&rdquo;, đẩy năng lượng lên để nâng người hát.</li>
</ul>
<p>Chỉ riêng việc biết ghìm rồi bung đúng chỗ, tiếng đệm của bạn đã lập tức nghe <strong>chuyên nghiệp hơn hẳn</strong> — dù kỹ thuật tay chưa hề thay đổi.</p>
<blockquote>Đệm hát, xét cho cùng, là <strong>kể chuyện cùng người hát</strong>. Người kể chuyện hay biết chỗ nào hạ giọng cho người ta nghiêng tai, chỗ nào cao giọng cho người ta nổi da gà. Đàn của bạn cũng phải biết hai điều đó.</blockquote>'
WHERE id = 'd2c00704-0000-4000-8000-000000000000';

-- ── Ch7: Phiên khúc đánh nhẹ — điệp khúc bung hơn (kỹ thuật)  (d2c00705) ──
UPDATE edu_course_lessons SET content =
'<h2>Làm sao để &ldquo;nhẹ&rdquo; và &ldquo;bung&rdquo; bằng đôi tay?</h2>
<p>Bài trước ta đã thống nhất tinh thần: phiên khúc ghìm, điệp khúc bung. Nhưng &ldquo;ghìm&rdquo; với &ldquo;bung&rdquo; cụ thể là làm gì với mười ngón tay? Đây là những công cụ rất thật, bạn dùng được ngay hôm nay.</p>
<h3>Bộ công cụ làm NHẸ (cho phiên khúc)</h3>
<ul>
<li><strong>Quạt ít dây hơn</strong>: chỉ lướt qua 3–4 dây thay vì cả 6. Tiếng mỏng lại tức thì.</li>
<li><strong>Chuyển sang rải</strong>: thay vì quạt cả chùm, rải từng dây nhẹ nhàng — dịu và tình hơn.</li>
<li><strong>Nhẹ lực cổ tay</strong>: vẫn giữ nhịp đung đưa đều, nhưng chạm dây khẽ thôi.</li>
<li><strong>Bỏ bớt cú</strong>: lược đi vài cú &ldquo;lên&rdquo; cho thưa thoáng.</li>
</ul>
<h3>Bộ công cụ làm BUNG (cho điệp khúc)</h3>
<ul>
<li><strong>Quạt đủ 6 dây</strong>: cho hợp âm vang đầy, dày dặn.</li>
<li><strong>Nhấn sâu tay ở phách mạnh</strong>: dồn lực vào phách 1 (và 3) để tạo cú &ldquo;huỵch&rdquo;.</li>
<li><strong>Thêm cú, chặt nhịp</strong>: quạt đủ cả xuống-lên, không lược, cho rộn ràng liên tục.</li>
<li><strong>Cổ tay chắc hơn</strong>: biên độ rộng hơn, tiếng bật ra khoẻ khoắn.</li>
</ul>
<h3>Bí quyết nằm ở đường CHUYỂN</h3>
<p>Người mới hay bị &ldquo;giật cấp&rdquo;: đang nhẹ, vào điệp khúc thì đột ngột nện thình thình. Người chơi hay thì <em>dâng lên từ từ</em> ở câu cuối phiên khúc, như con sóng gom nước trước khi vỗ bờ, để khi vào điệp khúc, năng lượng đã sẵn sàng tuôn ra một cách <strong>tự nhiên, liền mạch</strong>.</p>
<blockquote>Hãy thử ngay: chọn một bài quen, đệm phiên khúc thật khẽ, rồi bung điệp khúc. Lần đầu có thể gượng, nhưng chỉ cần cảm được sự tương phản ấy một lần, bạn sẽ nghiện — vì đó là lúc cây đàn bắt đầu <em>biết nói</em>.</blockquote>'
WHERE id = 'd2c00705-0000-4000-8000-000000000000';

-- ── Ch8: Quy trình đệm 1 bài mới — 5 bước  (d2c00800) ──
UPDATE edu_course_lessons SET content =
'<h2>Cầm một bài lạ trên tay — bắt đầu từ đâu?</h2>
<p>Đây là khoảnh khắc thử thách nhất, và cũng đã đời nhất, của người đệm hát: ai đó đưa bạn một bài bạn <em>chưa từng tập</em>, và nói &ldquo;đệm giúp mình bài này với&rdquo;. Người chưa có phương pháp sẽ luống cuống. Còn bạn — sau chương này — sẽ có một <strong>tấm bản đồ 5 bước</strong> để không bao giờ đứng hình.</p>
<h3>Bước 1 — Chọn tông</h3>
<p>Tông phải hợp <em>giọng người hát</em>, không phải hợp tay bạn. Hát thử câu cao nhất của bài: nếu với không tới thì hạ tông xuống, nếu quá trầm thì nâng lên. Chọn tông đúng, mọi thứ sau đó nhẹ hẳn.</p>
<h3>Bước 2 — Chọn điệu</h3>
<p>Cảm cái &ldquo;chất&rdquo; của bài (buồn/vui, đung đưa/thẳng thớm, 3 phách hay 4 phách) rồi chọn điệu phù hợp — đúng như bạn đã luyện ở chương Bố cục.</p>
<h3>Bước 3 — Chia bố cục</h3>
<p>Đánh dấu đâu là intro, phiên khúc, điệp khúc, cầu nối, kết. Ghi luôn chỗ nào sẽ ghìm, chỗ nào sẽ bung.</p>
<h3>Bước 4 — Tập từng đoạn</h3>
<p>Đừng ôm cả bài một lúc. Tập <em>rời từng đoạn</em> cho nhuyễn — phiên khúc riêng, điệp khúc riêng — nhất là những chỗ đổi hợp âm khó.</p>
<h3>Bước 5 — Ghép cả bài</h3>
<p>Nối các đoạn lại, chạy trọn bài từ đầu đến cuối, giữ nhịp đều và chuyển sắc thái mượt. Vấp ở đâu, quay lại Bước 4 chỗ đó.</p>
<blockquote>Năm bước này không chỉ để đệm một bài. Nó là <strong>cách tư duy</strong> của người chơi nhạc trưởng thành: chia nhỏ điều lớn, chinh phục từng phần, rồi hợp nhất. Thuộc quy trình này, bạn tự tin cầm <em>bất kỳ</em> bài nào — kể cả bài chưa ai từng đệm.</blockquote>'
WHERE id = 'd2c00800-0000-4000-8000-000000000000';

-- ── Ch8: Tổng kết Đệm hát Trình độ 2  (d2c00806) ──
UPDATE edu_course_lessons SET content =
'<h2>Nhìn lại chặng đường bạn vừa đi</h2>
<p>Hãy dừng lại một nhịp và ngoảnh nhìn phía sau. Còn nhớ ngày đầu Trình độ 2, khi bạn thu âm lại tiếng đệm của mình và thấy nó &ldquo;hơi phẳng, còn thiếu gì đó&rdquo; không? Cái cảm giác mơ hồ ấy — giờ bạn đã biết chính xác nó là gì, và quan trọng hơn, <strong>biết cách khắc phục</strong>.</p>
<h3>Bạn đã đi qua những gì</h3>
<ul>
<li><strong>Chùm nốt</strong> — bạn học được bí mật chia nhỏ một phách, gốc rễ của mọi điệu.</li>
<li><strong>Tiết tấu quạt</strong> — bạn biết đọc, ghi và tự dựng một mẫu quạt bằng ↓ và ↑.</li>
<li><strong>Bốn điệu</strong> — Ballad, Bolero, Slowrock, Valse: bạn không học vẹt, bạn hiểu mỗi điệu sinh ra từ cách chia phách nào.</li>
<li><strong>Bố cục</strong> — bạn nhìn ra hành trình cảm xúc của bài, biết chỗ ghìm chỗ bung.</li>
<li><strong>Áp dụng</strong> — bạn có quy trình 5 bước để chinh phục bất kỳ bài mới nào.</li>
</ul>
<p>Nhưng điều quý nhất bạn mang ra khỏi Trình độ 2 không phải là mấy điệu đàn. Mà là một sự thay đổi trong <em>cách nghĩ</em>:</p>
<blockquote>Bạn đã bước từ người <strong>đệm cho đúng</strong> sang người bắt đầu <strong>đệm cho hay</strong> — người không thuộc bài, mà <em>hiểu bài</em>. Đó là ranh giới ngăn cách một người &ldquo;biết vài điệu&rdquo; với một người thật sự <strong>chơi được nhạc</strong>.</blockquote>
<p>Hãy tự hào. Bạn đã làm được một quãng đường dài.</p>'
WHERE id = 'd2c00806-0000-4000-8000-000000000000';

-- ── Ch8: Lộ trình lên Đệm hát Trình độ 3  (d2c00807) ──
UPDATE edu_course_lessons SET content =
'<h2>Phía trước có gì? — Trình độ 3</h2>
<p>Nếu Trình độ 2 dạy bạn <em>dựng</em> được các điệu từ gốc rễ, thì Trình độ 3 sẽ dạy bạn <strong>làm cho chúng đẹp và tinh tế</strong> — bước từ &ldquo;đệm được&rdquo; sang &ldquo;đệm có màu sắc riêng&rdquo;.</p>
<h3>Những điều đang chờ bạn</h3>
<ul>
<li><strong>Bossa Nova</strong> — điệu Latin sang trọng, dập dìu, với cách đặt hợp âm rất riêng (ta đã hẹn gặp nó ở đây).</li>
<li><strong>Kỹ thuật tay phải nâng cao</strong> — móc, chặn tiếng, đảo phách, làm cho tiết tấu &ldquo;có gân&rdquo; hơn.</li>
<li><strong>Màu hợp âm</strong> — thêm các hợp âm màu (7, sus, add…) để tiếng đệm giàu cảm xúc hơn.</li>
<li><strong>Chuyển tông, dạo đầu, dồn kết</strong> — những nét chấm phá khiến phần đệm của bạn nghe như một bản phối hoàn chỉnh.</li>
</ul>
<h3>Trước khi bước tiếp, một lời dặn</h3>
<p>Đừng vội. Trình độ 3 sẽ đợi bạn. Điều đáng làm nhất lúc này là <strong>đem những gì vừa học ra dùng thật nhiều</strong>: đệm cho mình hát, đệm cho bạn bè, ngồi ở một góc quán… Kỹ thuật chỉ thật sự là của bạn khi nó đã ngấm vào tay qua hàng trăm lần chơi thực tế.</p>
<blockquote>Hẹn gặp bạn ở Trình độ 3 — với một đôi tay đã dày dạn hơn, và một trái tim yêu cây đàn hơn nữa. Còn bây giờ: hãy đàn, và hãy hát.</blockquote>'
WHERE id = 'd2c00807-0000-4000-8000-000000000000';

NOTIFY pgrst, 'reload schema';
