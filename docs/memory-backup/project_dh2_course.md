---
name: project_dh2_course
description: "Khoá Đệm Hát Trình Độ 2 (DH2) — tái cấu trúc theo mạch Chùm nốt→Tiết tấu→Điệu→Bố cục→Áp dụng; Bước 1 khung xong, chờ soạn Ch5 + tinh nội dung"
metadata: 
  node_type: memory
  type: project
  originSessionId: 16a41bfe-24d3-487b-9a51-91d2caf8df3c
---

Khoá **"Khởi Đầu Đam Mê – Đệm Hát Trình Độ 2"** (DH2), course_id `c7ab2fcb-aff1-4485-a381-4edc83e4a62b`, slug `dem-hat-td2`, track `dem_hat`. Là bậc 2 của mạch đệm hát (DH1 = Phách & Nhịp).

**ĐỊNH NGHĨA thầy chốt (đừng lẫn):** **Quạt = ĐỘNG TÁC TAY → thuộc THỰC HÀNH** (không phải tiết tấu). **Tiết tấu = ghép đủ 4 chùm thành 1 nhịp, LẶP ĐI LẶP LẠI thành nhạc** mới gọi là tiết tấu. ⇒ "quạt chùm 2" (động tác) thuộc **Chương 1 (Chùm nốt)** cạnh "gõ chùm 2"; Chương 2 (Tiết tấu) là chỗ ghép chùm thành mẫu nhịp lặp lại + gảy theo.

**KHUNG (2026-07-06) — `db/dh2_full.sql` (sinh từ `db/gen_dh2.cjs`), CHẠY CẢ KHOÁ: `db/dh2_ALL.sql`. QUẠT trước, MÓC cuối** ([[feedback_it_works_first]]). **7 chương** (đã GỘP Chùm nốt+Tiết tấu):
1. **Quạt chùm 2 (điệu Ballad) & chơi bài đầu tiên** (gộp Chùm nốt+Tiết tấu+Ballad — 12 bước: chùm 2→gõ→quạt→gảy HBD/Jingle→"hoá ra là Ballad"→mẫu video→nền tập→gảy Ode to Joy) · 2. Valse · 3. Slowrock (mở đầu "nghe thử chùm 3") · 4. **Bolero & kỹ thuật móc** · 5. Bố cục · 6. Áp dụng (Strum Builder tự chọn bài). Tiêu đề "Bài X.Y —"; bỏ các bài học-thuật rườm rà (lồng vào thực hành). Generator có override `code` để dời bài giữ nguyên UUID nội dung. **Nguyên tắc: tổ chức theo bước đi/thành quả, không theo mục lục học thuật** [[feedback_it_works_first]].
Generator dùng `code` (số chương GỐC) làm cơ sở UUID bài mới, tách khỏi `order` hiển thị → sắp lại thứ tự KHÔNG phá liên kết nội dung. Chạy cả khoá 1 lần: `db/dh2_ALL.sql` (khung + text + video).
**Cụm text ĐÃ viết** (phong cách [[feedback_long_engaging_lessons]]): Ch1(5), Ch2(3), tính chất 4 điệu, Ch7 bố cục(4), Ch8(3), nhịp 3/4. **Video đã gắn:** Ch1 "Xưởng quạt chùm 2" = YouTube PwSGfSGeuaE (db/dh2_videos.sql).
16 bài cũ giữ (đổi chương/thứ tự) + **51 bài mới = placeholder** (lesson_type 'text', content ghi "⏳ Dự kiến: <loại/công cụ>"). ON CONFLICT của bài mới CHỈ chỉnh module/order → KHÔNG đè nội dung điền sau. `dh2_restructure.sql` (bản 5 chương cũ) ĐÃ XOÁ.

**Quyết định thầy chốt:** Bossa Nova → **dời sang TĐ3** (4 bài, module `d3000001...` trong `dem-hat-td3` d5f963ac); Bolero "lệch trái"→**"lệch phải (đơn–kép–kép)"**; "Chùm 3 – Liên 3" → Slowrock.

**Bài hát (chốt 2026-07-06):** phần HỌC (điệu Ch3-6) chỉ dùng bài **CHO MỌI LỨA TUỔI** (không kén tuổi) — ĐÃ RÚT Con đường xưa/Diễm Xưa (nhạc vàng người lớn) khỏi khung. Mỗi điệu 1 bài gảy-theo mọi-lứa-tuổi (chờ thầy chọn + cho hợp âm). **Ch8 Áp dụng = công cụ "Strum Builder"** (skill thầy sẽ xây) để học sinh TỰ CHỌN bài & tự dựng đệm — phần cuối tự do; đã bỏ 4 bài "Thực hành bài cố định".

**Đợt 2 (2026-07-12, db/dh2_dot2.sql):** Nền tập Slowrock (lien3 Am-Dm-E-Am 66) + Bolero (donkepkep 75) = strum config; quiz Ch2 (d2c00608, 6 câu, câu chốt HBD=Valse); Chương 5 điền đủ 7 bài rỗng (5.1/5.3/5.7-5.10 bố cục 4 điệu/5.11 tự luận — bài CŨ content rỗng không có ⏳, rà phải check cả rỗng); tier chuẩn: FREE=1.1-1.6, còn lại basic. patternId 'den'/'chum2' dùng được cho 3/4 (player lấy beats[j] theo N). CÒN: 4 video thầy quay (2.2/2.5/3.6/4.6), chọn bài gảy theo Slowrock 3.8 + Bolero 4.8, Ch6 Strum Builder (6.2) + dự án submit_video (6.3).

**Tiến độ 2026-07-12:** **Chương 1 HOÀN CHỈNH 11/11** (bỏ bài 'gõ chùm 2' d2c00106 — thừa; Nền tập Ballad d2c00303 = strum config; quiz Checkpoint d2c00109 = 6 câu db/dh2_quiz_ch1.sql). Chương 2 còn 2 video thầy quay (2.2, 2.5) + quiz 2.8. "Nền tập" các điệu = lesson_type='strum' config JSON (mẫu: db/dh2_nentap_valse.sql — cách B skill strum-score, KHÔNG chế component riêng). Đã fix trùng UUID bài 3.2 (generator: bài mới PHẢI có n riêng). dh2_ALL.sql = full+videos+gaytheo+nentap_valse+ch1_don+quiz_ch1. Quiz nhạc lý thầy chốt: chùm 2 KHÔNG bắt buộc xuống–lên; 2 nốt chỉ đều về THỜI GIAN (mạnh–nhẹ khác nhau); HBD nhịp 3/4 = Valse không phải Ballad. TREO: ranh giới free/basic Ch1 (bài 1.7 basic lẻ giữa chương free); chọn bài gảy theo Slowrock/Bolero; 4 video thầy quay; Strum Builder (6.2).

**Còn phải làm (điền nội dung 51 placeholder dần):** bài giảng text/slide, "xưởng gõ/quạt" 🎛 (metronome + Groove Lab nền tập), video thầy quay 🎬, gảy theo 🎸 (Strum Score/ChordStrumPlayer [[project_strum_score]]), quiz checkpoint, dự án cuối khoá (submit_video). Cùng engine/pattern [[project_nhacly_course]]. id bài mới có tiền tố `d2c00<ch><idx>`.
