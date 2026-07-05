-- ============================================================================
-- CHÌA KHOÁ NHẠC LÝ — CHẠY TẤT CẢ (gộp 6 file, đúng thứ tự). Idempotent.
-- Sinh từ: cat các file db/nhacly_*.sql. Chạy cả file này 1 lần trong Supabase.
-- ============================================================================


-- ==================== db/nhacly_restructure.sql ====================
-- ============================================================================
-- CHÌA KHOÁ NHẠC LÝ CƠ BẢN — Tái cấu trúc 13 bài thành 5 chương theo chủ đề
-- Course: 79706056-ddf5-4741-8811-1f33f4ee0d48
-- Idempotent: chạy lại nhiều lần OK. (KHÔNG publish/đổi ẩn-hiện ở đây.)
-- ============================================================================

-- ── 5 CHƯƠNG ────────────────────────────────────────────────────────────────
-- Chương 1: tái dùng module cũ (b64ad7f3), đổi tên + order 0
UPDATE edu_modules SET name = 'Chương 1: Âm thanh & Nhạc', order_index = 0
  WHERE id = 'b64ad7f3-0d4d-458a-a849-b76e4c746c57';

INSERT INTO edu_modules (id, course_id, name, order_index) VALUES
  ('b1000002-0000-4000-8000-000000000002', '79706056-ddf5-4741-8811-1f33f4ee0d48', 'Chương 2: Nốt nhạc & Khuông', 1),
  ('b1000003-0000-4000-8000-000000000003', '79706056-ddf5-4741-8811-1f33f4ee0d48', 'Chương 3: Trường độ', 2),
  ('b1000004-0000-4000-8000-000000000004', '79706056-ddf5-4741-8811-1f33f4ee0d48', 'Chương 4: Nhịp & Ô nhịp', 3),
  ('b1000005-0000-4000-8000-000000000005', '79706056-ddf5-4741-8811-1f33f4ee0d48', 'Chương 5: Thực hành đọc nhạc', 4)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, order_index = EXCLUDED.order_index, course_id = EXCLUDED.course_id;

-- ── GÁN 13 BÀI VÀO CHƯƠNG (module_id + order_index) ─────────────────────────
-- Chương 1: Âm thanh & Nhạc
UPDATE edu_course_lessons SET module_id = 'b64ad7f3-0d4d-458a-a849-b76e4c746c57', order_index = 0 WHERE id = '2957fb41-7b4a-418e-902d-c5bd27473d46'; -- Bài 1 Âm thanh
UPDATE edu_course_lessons SET module_id = 'b64ad7f3-0d4d-458a-a849-b76e4c746c57', order_index = 1 WHERE id = '45188585-dfcd-4f0d-a57d-80471ec0ce67'; -- Bài 2.1 Cao độ/Cung
UPDATE edu_course_lessons SET module_id = 'b64ad7f3-0d4d-458a-a849-b76e4c746c57', order_index = 2 WHERE id = '519f0fae-0968-4bfc-9224-0235d0e7bdd1'; -- Bài 2.2 Trường độ-Cường độ-Âm sắc
UPDATE edu_course_lessons SET module_id = 'b64ad7f3-0d4d-458a-a849-b76e4c746c57', order_index = 3 WHERE id = '6465455e-5704-4e0d-bd77-0fc0f3915d02'; -- Bài hát ôn (xen)

-- Chương 2: Nốt nhạc & Khuông
UPDATE edu_course_lessons SET module_id = 'b1000002-0000-4000-8000-000000000002', order_index = 0 WHERE id = '69998853-af2a-46c9-8431-2551cd9c7643'; -- Bài 3 Nốt & ký hiệu
UPDATE edu_course_lessons SET module_id = 'b1000002-0000-4000-8000-000000000002', order_index = 1 WHERE id = 'e3c677f6-4c8b-408a-976f-d838341129c2'; -- Bài 4 Khuông & khoá

-- Chương 3: Trường độ
UPDATE edu_course_lessons SET module_id = 'b1000003-0000-4000-8000-000000000003', order_index = 0 WHERE id = '80ba6209-6e68-490e-96c1-f9781b8c05b7'; -- Bài 5 Trường độ & lặng
UPDATE edu_course_lessons SET module_id = 'b1000003-0000-4000-8000-000000000003', order_index = 1 WHERE id = '4ec2e02e-b68e-4ad4-88b8-5df5ddca7403'; -- Bài 8 Dấu nối/chấm đôi/luyến

-- Chương 4: Nhịp & Ô nhịp
UPDATE edu_course_lessons SET module_id = 'b1000004-0000-4000-8000-000000000004', order_index = 0 WHERE id = 'a2c742e3-d671-4767-88b2-21cd0de28b0c'; -- Bài 6 Nhịp-phách-ô nhịp
UPDATE edu_course_lessons SET module_id = 'b1000004-0000-4000-8000-000000000004', order_index = 1 WHERE id = '132c6e92-932b-4ed0-b10f-450d68545f1f'; -- Bài 7 Các loại nhịp

-- Chương 5: Thực hành đọc nhạc
UPDATE edu_course_lessons SET module_id = 'b1000005-0000-4000-8000-000000000005', order_index = 0 WHERE id = '6650cfbe-8a71-4455-9150-358f0c023134'; -- Bài 9 Đọc nhạc đơn giản
UPDATE edu_course_lessons SET module_id = 'b1000005-0000-4000-8000-000000000005', order_index = 1 WHERE id = '2c083246-48b1-4d20-894b-ce3ee6f23311'; -- Bài 10 Game nốt
UPDATE edu_course_lessons SET module_id = 'b1000005-0000-4000-8000-000000000005', order_index = 2 WHERE id = '853bc817-2ee6-434b-946c-4a33acf39d01'; -- Giải trí: Bài hát (xen cuối)

NOTIFY pgrst, 'reload schema';

-- ==================== db/nhacly_bai89.sql ====================
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

-- ==================== db/nhacly_exercises.sql ====================
-- ============================================================================
-- CHÌA KHOÁ NHẠC LÝ — 3 bài tập tương tác STAFF-ONLY (noFretboard)
-- SINH TỰ ĐỘNG từ db/gen_nhacly_exercises.cjs (đừng sửa tay).
-- lesson_type='flow' + bảng flows. is_published=false (khoá chưa publish).
-- Idempotent: id cố định + ON CONFLICT DO UPDATE.
-- ============================================================================

-- Bài tập: Đọc nốt trên khuông
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, order_index, is_published, tier)
VALUES ('a2100002-0000-4000-8000-000000000002', 'b1000002-0000-4000-8000-000000000002', 'Bài tập: Đọc nốt trên khuông', 'flow', 3, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, title = EXCLUDED.title, order_index = EXCLUDED.order_index, lesson_type = 'flow';

INSERT INTO flows (id, lesson_id, title, status, reward_xp, slides)
VALUES ('a2200002-0000-4000-8000-000000000002', 'a2100002-0000-4000-8000-000000000002', 'Bài tập: Đọc nốt trên khuông', 'published', 10, '[{"id":"n1","order":1,"logic":"DAN","type":"callout","title":"Đọc nốt trên khuông","interactive":{"variant":"tip"},"content":"Nhìn <b>vị trí</b> từng nốt trên khuông rồi đọc tên. Bấm <b>Nghe mẫu</b> để nghe từng nốt sáng lên, hoặc <b>Xướng âm</b> (hát tên nốt) để tự kiểm."},{"id":"n2","order":2,"logic":"LAM","type":"note_practice","title":"Gam Đô trưởng — đọc lên dần","interactive":{"noFretboard":true,"hint":"Từ Đô (dưới khuông) đi lên tới Đô cao: Đô – Rê – Mi – Fa – Sol – La – Si – Đô. Đọc to tên nốt theo từng bước.","notes":[{"label":"Đô","freq":130.81,"string":5,"fret":3,"staff":-2},{"label":"Rê","freq":146.83,"string":4,"fret":0,"staff":-1},{"label":"Mi","freq":164.81,"string":4,"fret":2,"staff":0},{"label":"Fa","freq":174.61,"string":4,"fret":3,"staff":1},{"label":"Sol","freq":196,"string":3,"fret":0,"staff":2},{"label":"La","freq":220,"string":3,"fret":2,"staff":3},{"label":"Si","freq":246.94,"string":2,"fret":0,"staff":4},{"label":"Đô","freq":261.63,"string":2,"fret":1,"staff":5}]}},{"id":"n3","order":3,"logic":"NGAM","type":"checklist","title":"Tự kiểm tra","interactive":{"items":["Mình đọc đúng tên nốt theo vị trí trên khuông","Mình phân biệt được nốt trên dòng và nốt trong khe"]}}]'::jsonb)
ON CONFLICT (id) DO UPDATE SET lesson_id = EXCLUDED.lesson_id, title = EXCLUDED.title, status = EXCLUDED.status, reward_xp = EXCLUDED.reward_xp, slides = EXCLUDED.slides;

-- Bài tập: Nghe & nhìn trường độ
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, order_index, is_published, tier)
VALUES ('a2100003-0000-4000-8000-000000000003', 'b1000003-0000-4000-8000-000000000003', 'Bài tập: Nghe & nhìn trường độ', 'flow', 3, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, title = EXCLUDED.title, order_index = EXCLUDED.order_index, lesson_type = 'flow';

INSERT INTO flows (id, lesson_id, title, status, reward_xp, slides)
VALUES ('a2200003-0000-4000-8000-000000000003', 'a2100003-0000-4000-8000-000000000003', 'Bài tập: Nghe & nhìn trường độ', 'published', 10, '[{"id":"d1","order":1,"logic":"DAN","type":"callout","title":"Trường độ — dài ngắn của nốt","interactive":{"variant":"tip"},"content":"Cùng một cao độ nhưng <b>hình nốt khác nhau</b> thì ngân <b>dài ngắn khác nhau</b>. Nghe mẫu để cảm nhận rõ."},{"id":"d2","order":2,"logic":"LAM","type":"note_practice","title":"Đen (1) → Trắng (2) → Tròn (4)","interactive":{"noFretboard":true,"showDur":true,"hint":"Nghe metronome đếm phách đều. Bốn nốt đen (mỗi nốt 1 phách) → hai nốt trắng (mỗi nốt 2 phách) → một nốt tròn (ngân 4 phách). Nghe kỹ độ dài khác nhau.","notes":[{"label":"La","freq":220,"string":3,"fret":2,"staff":3,"dur":1},{"label":"La","freq":220,"string":3,"fret":2,"staff":3,"dur":1},{"label":"La","freq":220,"string":3,"fret":2,"staff":3,"dur":1},{"label":"La","freq":220,"string":3,"fret":2,"staff":3,"dur":1},{"label":"La","freq":220,"string":3,"fret":2,"staff":3,"dur":2},{"label":"La","freq":220,"string":3,"fret":2,"staff":3,"dur":2},{"label":"La","freq":220,"string":3,"fret":2,"staff":3,"dur":4}]}},{"id":"d3","order":3,"logic":"NGAM","type":"checklist","title":"Tự kiểm tra","interactive":{"items":["Mình nghe rõ nốt tròn ngân dài gấp 4 lần nốt đen","Mình nhận ra đầu nốt rỗng = trắng/tròn, đầu đặc = đen"]}}]'::jsonb)
ON CONFLICT (id) DO UPDATE SET lesson_id = EXCLUDED.lesson_id, title = EXCLUDED.title, status = EXCLUDED.status, reward_xp = EXCLUDED.reward_xp, slides = EXCLUDED.slides;

-- Bài tập: Đếm phách trong ô nhịp
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, order_index, is_published, tier)
VALUES ('a2100004-0000-4000-8000-000000000004', 'b1000004-0000-4000-8000-000000000004', 'Bài tập: Đếm phách trong ô nhịp', 'flow', 3, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, title = EXCLUDED.title, order_index = EXCLUDED.order_index, lesson_type = 'flow';

INSERT INTO flows (id, lesson_id, title, status, reward_xp, slides)
VALUES ('a2200004-0000-4000-8000-000000000004', 'a2100004-0000-4000-8000-000000000004', 'Bài tập: Đếm phách trong ô nhịp', 'published', 10, '[{"id":"b1","order":1,"logic":"DAN","type":"callout","title":"Nhịp 3/4 — mỗi ô ba phách","interactive":{"variant":"tip"},"content":"Số chỉ nhịp <b>3/4</b> nghĩa là mỗi ô nhịp có <b>3 phách</b>: mạnh – nhẹ – nhẹ. Cùng đọc và đếm 1‑2‑3, 1‑2‑3."},{"id":"b2","order":2,"logic":"LAM","type":"note_practice","title":"Đọc câu nhịp 3/4","interactive":{"noFretboard":true,"showDur":true,"beatsPerBar":3,"hint":"Để ý số chỉ nhịp 3/4 đầu khuông và vạch nhịp. Ô 1: ba nốt đen. Ô 2: một đen + một trắng (1 + 2 = đủ 3 phách).","notes":[{"label":"Đô","freq":130.81,"string":5,"fret":3,"staff":-2,"dur":1},{"label":"Mi","freq":164.81,"string":4,"fret":2,"staff":0,"dur":1},{"label":"Sol","freq":196,"string":3,"fret":0,"staff":2,"dur":1},{"label":"Mi","freq":164.81,"string":4,"fret":2,"staff":0,"dur":1},{"label":"Đô","freq":130.81,"string":5,"fret":3,"staff":-2,"dur":2}]}},{"id":"b3","order":3,"logic":"NGAM","type":"checklist","title":"Tự kiểm tra","interactive":{"items":["Mình đếm đúng 3 phách mỗi ô","Mình cảm được phách mạnh rơi vào đầu ô nhịp"]}}]'::jsonb)
ON CONFLICT (id) DO UPDATE SET lesson_id = EXCLUDED.lesson_id, title = EXCLUDED.title, status = EXCLUDED.status, reward_xp = EXCLUDED.reward_xp, slides = EXCLUDED.slides;

-- Bài tập: Đọc một câu nhạc
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, order_index, is_published, tier)
VALUES ('a2100005-0000-4000-8000-000000000005', 'b1000005-0000-4000-8000-000000000005', 'Bài tập: Đọc một câu nhạc', 'flow', 1, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, title = EXCLUDED.title, order_index = EXCLUDED.order_index, lesson_type = 'flow';

INSERT INTO flows (id, lesson_id, title, status, reward_xp, slides)
VALUES ('a2200005-0000-4000-8000-000000000005', 'a2100005-0000-4000-8000-000000000005', 'Bài tập: Đọc một câu nhạc', 'published', 12, '[{"id":"r1","order":1,"logic":"DAN","type":"callout","title":"Đọc trọn một câu nhạc","interactive":{"variant":"tip"},"content":"Ghép mọi thứ đã học: <b>tên nốt + trường độ + ô nhịp</b>. Nghe mẫu một lượt cho quen, rồi <b>Xướng âm</b> theo nhịp."},{"id":"r2","order":2,"logic":"LAM","type":"note_practice","title":"Câu nhạc ngắn — nhịp 4/4","interactive":{"noFretboard":true,"showDur":true,"beatsPerBar":4,"hint":"Đọc lần lượt: tên nốt kèm trường độ. Câu kết bằng nốt trắng (Đô, ngân 2 phách).","notes":[{"label":"Đô","freq":130.81,"string":5,"fret":3,"staff":-2,"dur":1},{"label":"Rê","freq":146.83,"string":4,"fret":0,"staff":-1,"dur":1},{"label":"Mi","freq":164.81,"string":4,"fret":2,"staff":0,"dur":1},{"label":"Fa","freq":174.61,"string":4,"fret":3,"staff":1,"dur":1},{"label":"Mi","freq":164.81,"string":4,"fret":2,"staff":0,"dur":1},{"label":"Rê","freq":146.83,"string":4,"fret":0,"staff":-1,"dur":1},{"label":"Đô","freq":130.81,"string":5,"fret":3,"staff":-2,"dur":2}]}},{"id":"r3","order":3,"logic":"NGAM","type":"checklist","title":"Tự kiểm tra","interactive":{"items":["Mình đọc trôi cả câu, không dừng giữa chừng","Mình giữ phách đều từ đầu đến cuối"]}}]'::jsonb)
ON CONFLICT (id) DO UPDATE SET lesson_id = EXCLUDED.lesson_id, title = EXCLUDED.title, status = EXCLUDED.status, reward_xp = EXCLUDED.reward_xp, slides = EXCLUDED.slides;

-- Chương 5: B9(0) → Bài tập đọc(1) → Game nốt(2) → Giải trí bài hát(3)
UPDATE edu_course_lessons SET order_index = 2 WHERE id = '2c083246-48b1-4d20-894b-ce3ee6f23311'; -- Bài 10 Game nốt
UPDATE edu_course_lessons SET order_index = 3 WHERE id = '853bc817-2ee6-434b-946c-4a33acf39d01'; -- Giải trí: Bài hát

NOTIFY pgrst, 'reload schema';

-- ==================== db/nhacly_bai_5dongke.sql ====================
-- ============================================================================
-- CHÌA KHOÁ NHẠC LÝ — Bài hát "5 dòng kẻ nho nhỏ" (thầy sáng tác) vào Chương 2
-- Video YouTube Shorts, đặt SAU Bài 4 (Khuông & khoá): B3(0) B4(1) Bài hát(2) Bài tập(3)
-- Idempotent. is_published=false (khoá chưa publish).
-- ============================================================================

INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content_url, order_index, is_published, tier)
VALUES ('a2100020-0000-4000-8000-000000000020', 'b1000002-0000-4000-8000-000000000002',
        'Bài hát: Năm dòng kẻ nhỏ nhỏ', 'video', 'https://www.youtube.com/watch?v=QEsg_ass3dE', 2, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, title = EXCLUDED.title,
  lesson_type = 'video', content_url = EXCLUDED.content_url, order_index = EXCLUDED.order_index;

NOTIFY pgrst, 'reload schema';

-- ==================== db/nhacly_bai_quatao.sql ====================
-- ============================================================================
-- CHÌA KHOÁ NHẠC LÝ — Bài hát "Quả Táo Trường Độ" (thầy sáng tác) vào Chương 3
-- Video YouTube Shorts, đặt trước bài tập: B5(0) B8(1) Bài hát(2) Bài tập(3)
-- Idempotent. is_published=false (khoá chưa publish).
-- ============================================================================

INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content_url, order_index, is_published, tier)
VALUES ('a2100021-0000-4000-8000-000000000021', 'b1000003-0000-4000-8000-000000000003',
        'Bài hát: Quả Táo Trường Độ', 'video', 'https://www.youtube.com/watch?v=HwVfVy7P9gM', 2, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, title = EXCLUDED.title,
  lesson_type = 'video', content_url = EXCLUDED.content_url, order_index = EXCLUDED.order_index;

NOTIFY pgrst, 'reload schema';

-- ==================== db/nhacly_bai_naocungvotay.sql ====================
-- ============================================================================
-- CHÌA KHOÁ NHẠC LÝ — Bài hát "Nào cùng vỗ tay" (thầy sáng tác) vào Chương 4
-- Học Phách & Nhịp. Đặt trước bài tập: B6(0) B7(1) Bài hát(2) Bài tập(3)
-- Idempotent. is_published=false (khoá chưa publish).
-- ============================================================================

INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content_url, order_index, is_published, tier)
VALUES ('a2100022-0000-4000-8000-000000000022', 'b1000004-0000-4000-8000-000000000004',
        'Bài hát: Nào cùng vỗ tay', 'video', 'https://www.youtube.com/watch?v=jLaucGS_1Ds', 2, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, title = EXCLUDED.title,
  lesson_type = 'video', content_url = EXCLUDED.content_url, order_index = EXCLUDED.order_index;

NOTIFY pgrst, 'reload schema';
