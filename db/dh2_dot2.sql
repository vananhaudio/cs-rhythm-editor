-- ============================================================================
-- DH2 — ĐỢT 2 (2026-07-12). Idempotent. Gồm:
--   (A) Nền tập Slowrock (3.7) + Bolero (4.7) = Strum Score tự sinh
--   (B) Quiz Checkpoint Chương 2 (2.8)
--   (C) Chương 5: điền 7 bài rỗng (5.1, 5.3, 5.7, 5.8, 5.9, 5.10, 5.11)
--   (D) Chuẩn hoá tier: học thử FREE = Bài 1.1–1.6, còn lại BASIC
-- ============================================================================

-- ─── (A) NỀN TẬP ─────────────────────────────────────────────────────────────

-- 3.7 Nền tập Slowrock (d2c00505) — liên 3 dàn trải, vòng Am buồn, tempo 66
UPDATE edu_course_lessons
   SET lesson_type = 'strum', content_url = NULL,
       content = '{"styleId":"slowrock","tempo":66,"patternId":"lien3","timeSignature":4,"chords":["Am","Dm","E","Am"]}',
       description = 'Bật nền rồi quạt liên 3 (3 nhát xuống đều nhau mỗi phách) — thả lỏng cổ tay, để tiếng đàn dàn trải như sóng. Chưa quen thì đọc miệng "1-2-3, 1-2-3" theo từng phách trước.'
 WHERE id = 'd2c00505-0000-4000-8000-000000000000';

-- 4.7 Nền tập Bolero (d2c00406) — đơn–kép–kép (chùm 3 lệch phải), tempo 75
UPDATE edu_course_lessons
   SET lesson_type = 'strum', content_url = NULL,
       content = '{"styleId":"bolero","tempo":75,"patternId":"donkepkep","timeSignature":4,"chords":["Am","Dm","E","Am"]}',
       description = 'Quạt đơn–kép–kép theo nền: nhát đầu DÀI, hai nhát sau NGẮN (xuống–xuống–lên). Đây không phải liên 3 chia đều — cái "lệch" này chính là chất Bolero. Vững rồi hãy thử vừa quạt vừa đếm "chậm–nhanh-nhanh".'
 WHERE id = 'd2c00406-0000-4000-8000-000000000000';

-- ─── (B) QUIZ CHECKPOINT CHƯƠNG 2 (d2c00608) ────────────────────────────────

UPDATE edu_course_lessons
   SET lesson_type = 'quiz', content_url = NULL, description = NULL,
       content = '{
  "quiz_title": "Checkpoint Chương 2 — Điệu Valse",
  "description": "Kiểm tra nhanh trước khi sang Slowrock. Đạt 70% là qua — sai câu nào, đọc giải thích để nắm lại.",
  "mode": "practice",
  "passing_score": 70,
  "questions": [
    {
      "id": "ch2-q1", "type": "multiple_choice", "skill": "nhip-34", "difficulty": 1, "points": 1,
      "question": "Nhịp 3/4 có mấy phách trong một ô nhịp?",
      "data": { "options": ["3 phách", "4 phách", "2 phách", "6 phách"] },
      "answer": { "correct": "3 phách" },
      "explanation": "3/4 = mỗi ô nhịp có 3 phách, mỗi phách bằng một nốt đen."
    },
    {
      "id": "ch2-q2", "type": "multiple_choice", "skill": "nhip-34", "difficulty": 1, "points": 1,
      "question": "Trọng âm của nhịp 3/4 đi theo thứ tự nào?",
      "data": { "options": ["Mạnh — nhẹ — nhẹ", "Nhẹ — nhẹ — mạnh", "Mạnh — mạnh — nhẹ", "Cả 3 phách đều nhau"] },
      "answer": { "correct": "Mạnh — nhẹ — nhẹ" },
      "explanation": "Phách 1 mạnh, phách 2–3 nhẹ — đọc \"MỘT-hai-ba\" là nghe ra ngay cái xoay tròn của Valse."
    },
    {
      "id": "ch2-q3", "type": "true_false", "skill": "mau-valse", "difficulty": 1, "points": 1,
      "question": "Trong mẫu Valse nốt đen, phách 1 là tiếng bass (Bùm), phách 2 và 3 là hai nhát quạt nhẹ (chát – chát).",
      "data": {},
      "answer": { "correct": true },
      "explanation": "Đúng — Bùm chát chát. Bass phách 1 làm trụ, hai nhát sau nhẹ tay hơn."
    },
    {
      "id": "ch2-q4", "type": "multiple_choice", "skill": "dieu-valse", "difficulty": 1, "points": 1,
      "question": "Tính chất của điệu Valse là gì?",
      "data": { "options": ["Chắc chắn, rắn rỏi, xoay tròn", "Êm ái, dàn trải như sóng", "Dồn dập, lệch phách", "Buồn sâu lắng kiểu chùm 3"] },
      "answer": { "correct": "Chắc chắn, rắn rỏi, xoay tròn" },
      "explanation": "Valse chắc và rắn rỏi trên 3 phách — khác cái êm dàn trải của Ballad hay chất chùm 3 của Slowrock."
    },
    {
      "id": "ch2-q5", "type": "multiple_choice", "skill": "tiet-tau-tron", "difficulty": 2, "points": 1,
      "question": "Tiết tấu trộn \"Đen – đon đon – đon đon\" trong một ô 3/4 gồm những gì?",
      "data": { "options": ["1 nốt đen + 2 chùm 2", "3 nốt đen", "3 chùm 2", "1 chùm 2 + 2 nốt đen"] },
      "answer": { "correct": "1 nốt đen + 2 chùm 2" },
      "explanation": "Phách 1 là nốt đen chắc (Đen), phách 2–3 mỗi phách một chùm 2 (đon đon) — Valse vừa vững vừa nhún nhảy."
    },
    {
      "id": "ch2-q6", "type": "multiple_choice", "skill": "dieu-valse", "difficulty": 2, "points": 1,
      "question": "Ở Chương 1 bạn biết Happy Birthday KHÔNG phải Ballad vì nó nhịp 3/4. Vậy nó hợp điệu gì?",
      "data": { "options": ["Valse", "Ballad", "Slowrock", "Không điệu nào"] },
      "answer": { "correct": "Valse" },
      "explanation": "Chính xác — Happy Birthday nhịp 3/4 đệm Valse là hợp nhất. Giờ bạn đã đủ đồ nghề: thử quay lại đệm nó bằng Bùm chát chát xem!"
    }
  ]
}'
 WHERE id = 'd2c00608-0000-4000-8000-000000000000';

-- ─── (C) CHƯƠNG 5 — 7 BÀI TEXT ──────────────────────────────────────────────

-- 5.1 Cấu trúc bài hát (Musical Form)
UPDATE edu_course_lessons SET content = $tva$
<h2>Bài hát cũng có bản thiết kế</h2>
<p>Nghe một bài hát quen, bạn luôn biết trước khoảnh khắc điệp khúc sắp bùng lên — dù chẳng ai báo. Vì sao? Vì bài hát không phải một dòng chảy tuỳ hứng: nó được <strong>xây từ những khối lặp lại theo sơ đồ</strong>, như một ngôi nhà có phòng khách, phòng ngủ, hành lang. Sơ đồ đó gọi là <strong>cấu trúc bài hát</strong> (musical form).</p>
<h3>Vì sao NGƯỜI ĐỆM phải nhìn thấy cấu trúc?</h3>
<p>Người nghe chỉ cần cảm. Nhưng người đệm là <em>người dẫn đường</em>: bạn phải biết trước &ldquo;sắp tới là đoạn gì&rdquo; để chuẩn bị — đoạn nào đánh nhẹ, đoạn nào bung, chỗ nào ngắt để người hát lấy hơi. Đệm mà không nhìn thấy cấu trúc thì như lái xe không biết đường: vẫn chạy được, nhưng giật cục ở mọi khúc cua.</p>
<p>Tin vui: số sơ đồ thông dụng <strong>ít một cách bất ngờ</strong>. Nắm được một sơ đồ là bạn tự nhiên &ldquo;đọc&rdquo; được hàng trăm bài.</p>
<h3>Thử ngay với đôi tai</h3>
<p>Mở một bài bạn thuộc, nghe và <strong>đếm số lần điệp khúc xuất hiện</strong>, để ý trước mỗi lần đó là gì. Bạn sẽ thấy bài hát tự &ldquo;lộ sơ đồ&rdquo; ra — và từ hôm nay, bạn sẽ không bao giờ nghe nhạc theo kiểu cũ nữa.</p>
<blockquote>Bài kế tiếp, ta gọi tên từng khối: Intro, Phiên khúc, Điệp khúc, Cầu nối, Kết.</blockquote>
$tva$ WHERE id = 'd3624d28-47e2-48d3-a1d3-ee7ead6c3de2' AND (content IS NULL OR content = '');

-- 5.3 Bố cục một bài hát thông dụng
UPDATE edu_course_lessons SET content = $tva$
<h2>Sơ đồ "kinh điển" — thuộc một, đọc được trăm bài</h2>
<p>Bạn đã biết tên từng khối. Giờ ghép chúng lại theo cách mà <strong>phần lớn bài nhạc nhẹ</strong> vẫn dùng:</p>
<p style="text-align:center"><strong>Intro → Phiên khúc 1 → Điệp khúc → Phiên khúc 2 → Điệp khúc → Cầu nối → Điệp khúc (bùng) → Kết</strong></p>
<h3>Logic cảm xúc đằng sau</h3>
<ul>
<li><strong>Intro</strong> mở cửa, gợi không khí — thường lấy vòng hợp âm của điệp khúc.</li>
<li><strong>Phiên khúc 1</strong> kể chuyện, cảm xúc còn kìm — đánh nhẹ.</li>
<li><strong>Điệp khúc</strong> lần đầu bung — nhưng chưa phải đỉnh.</li>
<li><strong>Phiên khúc 2</strong> hạ xuống kể tiếp — nhẹ lại, người nghe được &ldquo;thở&rdquo;.</li>
<li><strong>Cầu nối</strong> dồn nén, thường đổi màu hợp âm — chuẩn bị cho cú bùng cuối.</li>
<li><strong>Điệp khúc cuối</strong> là đỉnh của cả bài — đánh đầy đặn nhất, có khi lặp 2 lần.</li>
<li><strong>Kết</strong> hạ màn: chậm dần, thưa dần, một cú quạt cuối ngân hết.</li>
</ul>
<h3>Việc của bạn khi cầm một bài mới</h3>
<p>Đừng vội đàn. Nghe bản thu 1–2 lượt, <strong>vẽ sơ đồ ra giấy</strong> (viết tắt: I – PK1 – ĐK – PK2 – ĐK – CN – ĐK – K). Mất 3 phút, nhưng lúc đệm bạn sẽ luôn biết mình đang ở đâu và điều gì sắp tới — đó chính là sự khác biệt giữa người <em>đánh theo</em> và người <em>dẫn dắt</em>.</p>
$tva$ WHERE id = 'c2a2a5eb-411e-4e0a-a2ed-2a891b5ac970' AND (content IS NULL OR content = '');

-- 5.7 Bố cục mẫu Ballad
UPDATE edu_course_lessons SET content = $tva$
<h2>Bố cục mẫu cho một bài Ballad</h2>
<p>Ballad là điệu &ldquo;kể chuyện&rdquo; — êm, đều, tình cảm. Bí quyết đệm Ballad hay không nằm ở kiểu quạt khó, mà ở việc <strong>cùng một chùm 2, mỗi đoạn đánh một sắc thái</strong>:</p>
<ul>
<li><strong>Intro:</strong> quạt chùm 2 thật nhẹ, hoặc chỉ đánh bass + một nhát mỏng mỗi ô — như vén màn.</li>
<li><strong>Phiên khúc:</strong> chùm 2 nhẹ tay, đều đặn, nhường hoàn toàn cho lời hát. Tay phải nhỏ lại, đừng &ldquo;giành mic&rdquo;.</li>
<li><strong>Điệp khúc:</strong> vẫn chùm 2 nhưng <strong>bung đủ lực</strong> — biên độ quạt rộng hơn, chạm nhiều dây hơn. Người nghe phải cảm được cánh cửa mở ra.</li>
<li><strong>Cầu nối:</strong> kìm lại một nhịp (đánh thưa, thậm chí chỉ giữ bass) rồi <em>đẩy dần</em> — để điệp khúc cuối bùng thật đã.</li>
<li><strong>Kết:</strong> chậm dần ở 2 ô cuối, khép bằng <strong>một cú quạt duy nhất</strong> ngân hết trên hợp âm chủ.</li>
</ul>
<h3>Tập thế nào?</h3>
<p>Lấy vòng C – Am – F – G ở bài Nền tập Ballad, tự quy ước: 4 ô đầu là &ldquo;phiên khúc&rdquo; (nhẹ), 4 ô sau là &ldquo;điệp khúc&rdquo; (bung). Quạt liên tục không dừng tay, chỉ đổi <em>lực</em>. Khi cái nhẹ–mạnh này thành phản xạ, bạn đã có 80% chất Ballad.</p>
$tva$ WHERE id = 'd2c00706-0000-4000-8000-000000000000' AND (content IS NULL OR content = '' OR content LIKE '%⏳%');

-- 5.8 Bố cục mẫu cho một bài Bolero
UPDATE edu_course_lessons SET content = $tva$
<h2>Bố cục mẫu cho một bài Bolero</h2>
<p>Bolero là điệu của <strong>tự sự</strong> — chậm, sâu, từng chữ rơi từng giọt. Cái hay của người đệm Bolero là biết <strong>đổi kiểu tay giữa các đoạn</strong>, và bạn đã học đủ đồ nghề rồi:</p>
<ul>
<li><strong>Intro:</strong> móc kiểu 1 chậm rãi trên vòng hợp âm chính — gợi không khí, có thể chỉ 2–4 ô.</li>
<li><strong>Phiên khúc 1:</strong> <strong>móc kiểu 1</strong> — thưa, để giọng hát kể chuyện.</li>
<li><strong>Phiên khúc 2:</strong> đổi sang <strong>móc kiểu 2</strong> — dày hơn một chút, câu chuyện đậm dần mà người nghe không biết vì sao.</li>
<li><strong>Điệp khúc:</strong> chuyển hẳn sang <strong>quạt</strong> (kiểu quạt ballad cho điệp khúc Bolero bạn đã học) — đây là lúc cảm xúc vỡ ra.</li>
<li><strong>Kết:</strong> quay về móc chậm dần, khép bằng một cú rải cuối ngân trên hợp âm chủ.</li>
</ul>
<h3>Mấu chốt: cú CHUYỂN móc → quạt</h3>
<p>Khoảnh khắc đắt nhất của Bolero là giây chuyển từ móc sang quạt ở điệp khúc. Hãy tập riêng cú chuyển này: 2 ô móc kiểu 2 → 2 ô quạt, lặp đi lặp lại cho tới khi không vấp. Chuyển mượt được cú đó, bài Bolero của bạn nghe &ldquo;có nghề&rdquo; ngay lập tức.</p>
$tva$ WHERE id = '21b2be1b-533a-4d2d-9610-a698e01b31d5' AND (content IS NULL OR content = '');

-- 5.9 Bố cục mẫu Slowrock
UPDATE edu_course_lessons SET content = $tva$
<h2>Bố cục mẫu cho một bài Slowrock</h2>
<p>Slowrock sống bằng <strong>liên 3 dàn trải</strong> — như sóng, lớp này chưa tan lớp khác đã tới. Vì kiểu quạt gần như không đổi suốt bài, sắc thái Slowrock nằm trọn ở <strong>lực tay và độ dày</strong>:</p>
<ul>
<li><strong>Intro:</strong> liên 3 rất nhẹ trên 2–4 ô, có thể chỉ chạm 3–4 dây trên — gợi cái đung đưa trước khi lời vào.</li>
<li><strong>Phiên khúc:</strong> liên 3 nhỏ tiếng, đều tăm tắp. Sức hút của Slowrock là sự <em>kiên nhẫn</em> — đừng vội to.</li>
<li><strong>Điệp khúc:</strong> vẫn liên 3 nhưng <strong>đầy đặn</strong> — quạt hết mặt dây, bass rõ hơn. Con sóng lúc này dâng cao nhất.</li>
<li><strong>Cầu nối:</strong> thu nhỏ lại đột ngột (nhẹ như intro) rồi lớn dần — cú &ldquo;rút sóng để đánh sóng to&rdquo; kinh điển.</li>
<li><strong>Kết:</strong> chậm dần, thưa dần, kết bằng một cú quạt ngân dài — để dư âm tự tắt.</li>
</ul>
<h3>Tập thế nào?</h3>
<p>Dùng bài Nền tập Slowrock (vòng Am – Dm – E – Am): quạt liên 3 liên tục, cứ 4 ô lại đổi lực nhẹ → đầy → nhẹ. Giữ được tiếng đều khi đổi lực — đó là kỹ năng ăn tiền của Slowrock.</p>
$tva$ WHERE id = 'd2c00708-0000-4000-8000-000000000000' AND (content IS NULL OR content = '' OR content LIKE '%⏳%');

-- 5.10 Bố cục mẫu Valse
UPDATE edu_course_lessons SET content = $tva$
<h2>Bố cục mẫu cho một bài Valse</h2>
<p>Valse chắc và xoay tròn trên 3 phách. Bạn đã có trong tay <strong>hai mẫu</strong> — nốt đen (Bùm chát chát) và có chùm 2 — cộng tiết tấu trộn. Bố cục Valse chính là nghệ thuật <strong>xếp hai mẫu đó đúng chỗ</strong>:</p>
<ul>
<li><strong>Intro:</strong> Bùm chát chát gọn gàng 2–4 ô — đặt cái khung 3/4 vào tai người nghe ngay từ đầu.</li>
<li><strong>Phiên khúc:</strong> mẫu <strong>nốt đen</strong> — chắc, rắn rỏi, làm trụ cho lời hát.</li>
<li><strong>Điệp khúc:</strong> chuyển sang mẫu <strong>có chùm 2</strong> — câu nhạc lập tức mềm và nhún nhảy hơn, đúng cú &ldquo;mở&rdquo; mà bạn học ở bài Mẫu Valse chùm 2.</li>
<li><strong>Đoạn cao trào / lần điệp khúc cuối:</strong> dùng <strong>tiết tấu trộn</strong> Đen – đon đon – đon đon — vừa vững vừa bay.</li>
<li><strong>Kết:</strong> về lại Bùm chát chát chậm dần, khép bằng <strong>một cú quạt ở phách 1</strong> ngân hết — rất "Valse".</li>
</ul>
<h3>Tập thế nào?</h3>
<p>Trên bài Nền tập Valse (C – F – G – C): 4 ô nốt đen → 4 ô chùm 2 → 4 ô trộn, xoay vòng không dừng tay. Đổi mẫu mà nhịp không xô — bạn đã sẵn sàng đệm trọn một bài Valse có bố cục.</p>
$tva$ WHERE id = 'd2c00709-0000-4000-8000-000000000000' AND (content IS NULL OR content = '' OR content LIKE '%⏳%');

-- 5.11 Bài tập tự luận: phân tích bố cục bài hát
UPDATE edu_course_lessons SET content = $tva$
<h2>Bài tập: tự phân tích bố cục một bài hát</h2>
<p>Đến lượt bạn làm điều mà người đệm chuyên nghiệp nào cũng làm trước khi chơi một bài mới.</p>
<h3>Đề bài</h3>
<ol>
<li><strong>Chọn 1 bài hát bạn yêu thích</strong> (bất kỳ — miễn là bạn nghe đi nghe lại không chán).</li>
<li>Nghe trọn bài 2 lượt, <strong>vẽ sơ đồ bố cục</strong> ra giấy: I – PK1 – ĐK – PK2 – ĐK – CN – ĐK – K (bài của bạn có thể khác sơ đồ chuẩn — cứ ghi đúng cái bạn nghe thấy).</li>
<li>Xác định <strong>bài này hợp điệu gì</strong> (Ballad / Valse / Slowrock / Bolero) và vì sao — dùng mẹo gõ đùi ở bài Chọn điệu.</li>
<li>Với <strong>từng đoạn</strong>, ghi cách bạn định chơi: kiểu quạt/móc nào, nhẹ hay bung. Một dòng mỗi đoạn là đủ.</li>
</ol>
<h3>Nộp bài</h3>
<p>Chép sơ đồ + các ghi chú vào <strong>Nhật ký luyện tập</strong> (hoặc chụp tờ giấy gửi thầy qua nhóm lớp). Thầy sẽ xem và góp ý bố cục của bạn trước khi bạn đệm thật.</p>
<blockquote>Làm xong bài này, bạn đã có bản thiết kế hoàn chỉnh đầu tiên do chính mình vẽ — sang Chương 6, ta biến nó thành tiếng đàn thật.</blockquote>
$tva$ WHERE id = 'a3a059a1-7b85-4505-962a-aba56892d28f' AND (content IS NULL OR content = '');

-- ─── (D) TIER: học thử FREE = 1.1–1.6, còn lại BASIC ────────────────────────

UPDATE edu_course_lessons SET tier = 'basic'
 WHERE module_id IN ('067ae3bb-7812-4485-8fa2-077fccaea2bf','271e9988-0e3b-4171-a829-139a6b399263',
                     'd2000055-0000-4000-8000-000000000055','d2000044-0000-4000-8000-000000000044',
                     'a844e611-71a9-48c1-84cf-a645b8c79d08','974b0073-61d3-4b76-857a-e4f01c738d42');

UPDATE edu_course_lessons SET tier = 'free'
 WHERE id IN ('aca3b657-b2c8-46dd-ac1e-5fe8b7828158',  -- 1.1 Chào mừng
              'd2c00103-0000-4000-8000-000000000000',  -- 1.2 Chùm nốt là gì
              '1bc21a87-d39f-48ee-a62c-a753902631cf',  -- 1.3 Chùm 2
              'df4ddd1b-768b-4d74-8b9a-40a310ac99e9',  -- 1.4 Quạt chùm 2
              '2f6b416d-7d4f-4bd0-8c13-0e4ad2e11829',  -- 1.5 Happy Birthday
              '4692e092-3591-4dda-99d6-265b82e0d34c'); -- 1.6 Jingle Bells

NOTIFY pgrst, 'reload schema';
