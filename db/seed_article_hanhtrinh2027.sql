-- Seed bài viết "HÀNH TRÌNH 2027" cho nút "Xem bản đồ hành trình đầy đủ" (slot ban-do-hanh-trinh)
-- Idempotent theo slug: chạy lại sẽ CẬP NHẬT nội dung. Sửa sau trong admin → Bài viết.
-- Yêu cầu: đã chạy db/class_tuyensinh_setup.sql (bảng articles).

insert into public.articles (title, slug, slot, published, body)
values (
  'HÀNH TRÌNH 2027',
  'hanh-trinh-2027',
  'ban-do-hanh-trinh',
  true,
  $html$
<p style="text-align:center"><img src="/ban-do-hanh-trinh-2027.png" alt="Bản đồ hành trình 2027 — Combo 10 khóa học"></p>
<p><strong>Lộ trình trở thành Nghệ sĩ Guitar – từ số 0 đến làm chủ cây đàn</strong></p>
<p>Trong hơn 25 năm học và chơi guitar, thầy Văn Anh đã đi qua gần như mọi con đường mà người học đàn thường trải qua:</p>
<ul><li>Học theo tab</li><li>Học thuộc hợp âm</li><li>Luyện kỹ thuật</li><li>Và cả những giai đoạn “chững lại”, không biết phải đi tiếp như thế nào</li></ul>
<p>Sau tất cả, thầy nhận ra một điều rất quan trọng:</p>
<p>👉 Vấn đề không nằm ở người học<br>👉 Mà nằm ở cách mà người học đang học</p>
<p>Rất nhiều người học guitar nhiều năm, nhưng vẫn không thể:</p>
<ul><li>Tự đệm một bài hát khi không có hợp âm</li><li>Bắt tông và đệm cho người khác hát</li><li>Chơi theo cảm nhận của mình</li></ul>

<h3>Bản chất của việc chơi guitar thực sự</h3>
<p>Chơi guitar không phải là ghi nhớ. Chơi guitar là <strong>làm chủ âm thanh trên cây đàn</strong>.</p>
<p>Một người chơi đàn thực sự cần làm chủ 3 yếu tố:</p>
<ul><li><strong>Tai nghe</strong>: nghe được tông – hợp âm – giai điệu</li><li><strong>Tay đàn</strong>: chơi được những gì mình nghe thấy</li><li><strong>Tư duy âm nhạc</strong>: hiểu và xử lý bài hát</li></ul>
<p>👉 Khi 3 yếu tố này kết nối, bạn sẽ không cần nhìn hợp âm, không cần phụ thuộc tab, và có thể tự chơi theo cảm nhận.</p>

<h3>Điểm khác biệt cốt lõi của phương pháp</h3>
<p>Điều đặc biệt nhất trong phương pháp của thầy Văn Anh không nằm ở nội dung dạy, mà nằm ở <strong>cách học được thiết kế</strong>.</p>
<p>👉 Người học không thiếu kiến thức — mà thiếu khả năng cảm âm và phản xạ âm nhạc từ bên trong.</p>

<h3>Học guitar không chỉ diễn ra ở ý thức</h3>
<p>Phần lớn người học hiện nay học bằng <strong>ý thức</strong>: nhớ hợp âm, nhớ bài, nhớ vị trí nốt.</p>
<p>Nhưng âm nhạc thực sự lại diễn ra ở <strong>tiềm thức</strong>:</p>
<p>👉 Nơi bạn nghe → phản xạ → chơi ngay lập tức, không cần suy nghĩ.</p>

<h3>Phương pháp tác động vào tiềm thức</h3>
<p>Thầy Văn Anh đã xây dựng phương pháp đưa âm nhạc đi từ <strong>ý thức → tiềm thức</strong>, thông qua:</p>
<ul><li>Luyện tai nghe theo hệ thống</li><li>Lặp lại có chủ đích</li><li>Gắn âm thanh với cảm nhận thực tế</li><li>Tạo phản xạ thay vì ghi nhớ</li></ul>
<p>👉 Khi đó, bạn không còn “nghĩ hợp âm”, nghĩ nốt — mà <strong>nghe là biết, chơi là ra</strong>.</p>

<h3>Đây chính là sự khác biệt</h3>
<p>Người học theo cách thông thường → biết nhiều nhưng không chơi được.</p>
<p>Người học theo phương pháp này → có thể chơi thực chiến, dù không cần biết quá nhiều.</p>

<h3>Hành trình 2027 được xây dựng trên nền tảng đó</h3>
<p>Đây không phải một khóa học riêng lẻ, mà là một <strong>hệ thống hoàn chỉnh</strong>, giúp bạn:</p>
<p>👉 Đi đúng ngay từ đầu<br>👉 Phát triển đúng hướng<br>👉 Và hình thành phản xạ âm nhạc thực sự</p>

<h3>Bước 1: Nhập môn (miễn phí)</h3>
<p>Chuẩn hoá đầu vào:</p>
<ul><li>Cách cầm đàn</li><li>Cách chỉnh dây</li><li>Luyện ngón cơ bản</li><li>Làm quen nhạc cụ</li></ul>
<p>👉 Đảm bảo tất cả học viên có cùng nền tảng và tiết kiệm thời gian khi bước vào lớp học.</p>

<h3>Bước 2: Phát triển theo 2 nhánh song song</h3>
<p>🔵 <strong>Nhánh 1: Đệm hát</strong> (bè nền)</p>
<ul><li>Đệm hát căn bản</li><li>Đệm hát theo tai</li><li>Tự cảm âm hợp âm</li><li>Giữ nhịp – tạo tiết tấu</li><li>Làm chủ bài hát</li></ul>
<p>🟢 <strong>Nhánh 2: Tỉa nốt (Guitar Lead)</strong> (bè giai điệu)</p>
<ul><li>Nghe và chơi lại giai điệu</li><li>Tạo câu lót</li><li>Tạo intro – outro</li><li>Phát triển cảm âm</li></ul>
<p><strong>Một sự thật rất quan trọng:</strong> 👉 SOLO = ĐỆM + TỈA. Nếu thiếu 1 trong 2 nền tảng này, solo chỉ là bấm nốt theo tab — không có hồn, và bạn phải chơi theo bản nhạc do người khác soạn.</p>

<h3>Bước 3: Nâng cao & Solo</h3>
<ul><li>Đệm hát nâng cao</li><li>Solo guitar</li><li>Ứng biến và sáng tạo</li></ul>
<p>👉 Đây là lúc bạn bắt đầu thực sự chơi nhạc.</p>

<h3>Đích đến cuối cùng: Nghệ sĩ Guitar</h3>
<ul><li>Tự chơi, tự soạn bản solo phù hợp với kỹ năng và tầm của mình – không phụ thuộc</li><li>Tự đệm – tự tỉa – tự sáng tạo</li><li>Chơi theo cảm xúc</li><li>Có phong cách riêng</li></ul>

<h3>Phương pháp học liên hoàn theo mô hình AZZ</h3>
<p><strong>AZZ = App – Zalo – Zoom</strong></p>
<ul><li><strong>A – App</strong>: học kiến thức nền tảng mỗi ngày</li><li><strong>Z – Zalo</strong>: sửa bài – kèm sát – chỉnh lỗi</li><li><strong>Z – Zoom</strong>: thầy giảng trực tiếp trên lớp, giúp hiểu sâu – quan sát – phát triển</li></ul>

<h3>Giá trị thực sự của thầy</h3>
<p>Trong thời đại có Google và AI, 👉 kiến thức không còn là lợi thế. Nhưng <strong>kinh nghiệm – phản xạ – bí kíp thực chiến</strong> mới là thứ quyết định bạn có chơi được hay không.</p>

<h3>Hai cách tham gia hành trình</h3>
<p><strong>1. Học từng khóa lẻ</strong> — phù hợp nếu bạn muốn đi từng bước.</p>
<p><strong>2. Đăng ký COMBO HÀNH TRÌNH 2027</strong>:</p>
<ul><li>👉 Học toàn bộ lộ trình</li><li>👉 Thích học lớp nào cũng được</li><li>👉 Không bị giới hạn hướng đi</li><li>👉 Tiết kiệm chi phí hơn rất nhiều</li></ul>

<h3>Bạn không cần</h3>
<ul><li>Không cần năng khiếu</li><li>Không cần biết nhạc lý trước</li><li>Không cần học nhiều năm</li></ul>
<p>👉 Bạn chỉ cần: <strong>đi đúng phương pháp</strong>.</p>

<h3>Bắt đầu</h3>
<p>👉 Bắt đầu từ <strong>Nhập môn miễn phí</strong> → trải nghiệm trước khi quyết định.</p>

<h3>Kết luận</h3>
<p>HÀNH TRÌNH 2027 không dạy bạn chơi đàn theo cách thông thường — 👉 mà giúp bạn <strong>làm chủ cây đàn từ bên trong</strong>.</p>
$html$
)
on conflict (slug) do update
  set title = excluded.title, slot = excluded.slot, published = excluded.published,
      body = excluded.body, updated_at = now();
