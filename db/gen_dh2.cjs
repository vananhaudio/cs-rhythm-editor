// Sinh khung SQL cho khoá ĐỆM HÁT TRÌNH ĐỘ 2 (DH2) — 8 chương theo mạch học.
// Chạy: node db/gen_dh2.cjs  → db/dh2_full.sql
// Bài CŨ: UPDATE (đổi chương/thứ tự, đổi tên nếu cần). Bài MỚI: INSERT placeholder (text, ⏳).
// Idempotent. ON CONFLICT của bài mới CHỈ cập nhật module/thứ tự → KHÔNG đè nội dung thầy điền sau.
const fs = require('fs')
const esc = (s) => String(s).replace(/'/g, "''")
const DH2 = 'c7ab2fcb-aff1-4485-a381-4edc83e4a62b'
const TD3 = 'd5f963ac-bcd7-45e2-b002-7970ba33e710'

// module id mới cho 2 điệu tách riêng + module Bossa ở TĐ3
const M_BOLERO = 'd2000044-0000-4000-8000-000000000044'
const M_SLOWROCK = 'd2000055-0000-4000-8000-000000000055'
const M_BOSSA_TD3 = 'd3000001-0000-4000-8000-000000000001'
// id bài mới: d2c00<ch><idx2> — cố định, idempotent
const L = (ch, idx) => `d2c00${ch}${String(idx).padStart(2, '0')}-0000-4000-8000-000000000000`

// note = loại dự kiến (đưa vào content placeholder để thầy thấy ý đồ khi mở bài)
// code = cơ sở UUID bài mới (SỐ CHƯƠNG GỐC, cố định — KHÔNG đổi khi sắp lại thứ tự,
//        giữ liên kết với các file nội dung đã viết). order = vị trí hiển thị (0-based).
const CHAPTERS = [
  { code: 1, order: 0, mid: '067ae3bb-7812-4485-8fa2-077fccaea2bf', name: 'Chương 1: Chùm nốt', lessons: [
    { ex: 'aca3b657-b2c8-46dd-ac1e-5fe8b7828158' },
    { t: 'Ôn nhanh: Phách & Nhịp — cầu nối từ Trình độ 1', note: 'bài ôn / quiz 📝' },
    { t: 'Từ nốt đen sang chùm nốt', note: 'bài giảng ngắn (text/slide)' },
    { t: 'Chùm nốt là gì — chia 1 phách thành nhiều tiếng', note: 'bài giảng (text/slide)' },
    { ex: '1bc21a87-d39f-48ee-a62c-a753902631cf' },
    { t: 'Cách đếm chùm 2: 1 & 2 & 3 & 4 &', note: 'bài giảng (text) + tiếng đếm mẫu' },
    { t: 'Xưởng gõ chùm 2', note: 'công cụ app 🎛 (metronome / gõ theo)' },
    { t: 'Xưởng quạt chùm 2 — xuống/lên đều', note: 'video thầy quay 🎬' },
    { t: 'Nghe thử chùm 3 và liên 3 — biết trước, học kỹ sau', note: 'bài giảng + audio mẫu' },
    { t: 'Checkpoint Chương 1', note: 'quiz 📝' },
  ] },
  { code: 2, order: 1, mid: '46e55dbe-dd8f-40b5-a8ec-6464219f7155', name: 'Chương 2: Tiết tấu quạt', lessons: [
    { t: 'Tiết tấu là gì — mẫu lặp trong âm nhạc', note: 'bài giảng (text/slide)' },
    { t: 'Ký hiệu quạt: xuống ↓ và lên ↑', note: 'bài giảng (text)' },
    { t: 'Tay phải: đều, nhẹ, cổ tay thả lỏng', note: 'video thầy quay 🎬' },
    { ex: 'df4ddd1b-768b-4d74-8b9a-40a310ac99e9' },
    { ex: 'd76e8798-76bd-485e-b0fb-4fadb6b98458' },
    { t: 'Ứng dụng chùm 2 vào nhịp 4/4', note: 'video / bài giảng' },
    { t: 'Nền tập quạt — tập với trống + bass', note: 'công cụ app 🎛 (Groove Lab nền tập)' },
    { ex: '2f6b416d-7d4f-4bd0-8c13-0e4ad2e11829' },
    { ex: '4692e092-3591-4dda-99d6-265b82e0d34c' },
    { t: 'Gảy theo: 1 bài Việt đơn giản', note: 'gảy theo 🎸 (Strum Score) — chọn bài sau' },
    { t: 'Checkpoint Chương 2', note: 'quiz 📝' },
  ] },
  // QUẠT trước (Ballad · Valse · Slowrock) — cho học sinh sớm "It works"
  { code: 3, order: 2, mid: '2a3011f7-750e-49e6-9b55-ea0af1725d0d', name: 'Chương 3: Điệu Ballad', lessons: [
    { ex: '2b73cd3b-cc6e-4ba9-baff-9ef6acc984ac' },
    { t: 'Ballad dùng chùm 2 như thế nào', note: 'bài giảng (text)' },
    { t: 'Mẫu quạt Ballad cơ bản', note: 'video thầy quay 🎬' },
    { t: 'Nền tập Ballad', note: 'công cụ app 🎛 (Groove Lab điệu Ballad)' },
    { t: 'Gảy theo: 1 bài Ballad (chọn bài sau)', note: 'gảy theo 🎸 (Strum Score)' },
  ] },
  { code: 6, order: 3, mid: '271e9988-0e3b-4171-a829-139a6b399263', name: 'Chương 4: Điệu Valse', lessons: [
    { t: 'Tính chất Valse', note: 'bài giảng (text)' },
    { t: 'Nhịp 3/4: mạnh — nhẹ — nhẹ', note: 'bài giảng (text)' },
    { t: 'Mẫu Valse nốt đen', note: 'video thầy quay 🎬' },
    { t: 'Mẫu Valse có chùm 2', note: 'video thầy quay 🎬' },
    { t: 'Trộn nốt đen và chùm 2 trong Valse', note: 'video / bài giảng' },
    { t: 'Nền tập Valse', note: 'công cụ app 🎛 (Groove Lab điệu Valse)' },
    { t: 'Gảy theo: 1 bài Valse (chọn bài sau)', note: 'gảy theo 🎸 (Strum Score)' },
  ] },
  { code: 5, order: 4, mid: M_SLOWROCK, name: 'Chương 5: Điệu Slowrock', lessons: [
    { t: 'Tính chất Slowrock', note: 'bài giảng (text)' },
    { t: 'Liên 3 là gì trong đệm hát', note: 'bài giảng (text)' },
    { ex: 'db6fddb4-7d3b-4a3b-9a01-f143928f02e5' },
    { t: 'Cảm giác dàn trải của Slowrock', note: 'bài giảng (text) + audio' },
    { t: 'Mẫu Slowrock cơ bản', note: 'video thầy quay 🎬' },
    { t: 'Nền tập Slowrock', note: 'công cụ app 🎛 (Groove Lab điệu Slowrock)' },
    { t: 'Gảy theo: Diễm Xưa', note: 'gảy theo 🎸 (Strum Score) — Slowrock' },
  ] },
  // MÓC dồn CUỐI: Bolero (móc) + rải — học sau khi đã thạo quạt (nguyên tắc "It works")
  { code: 4, order: 5, mid: M_BOLERO, name: 'Chương 6: Điệu Bolero & kỹ thuật móc', lessons: [
    { t: 'Tính chất Bolero', note: 'bài giảng (text)' },
    { ex: '12bb1218-6dcd-447c-8145-7f7f0302482b', title: 'Chùm 3 lệch phải (đơn – kép – kép) — đặc trưng Bolero' },
    { ex: '5f7acacd-9214-48f3-9349-93cc382649fb' },
    { ex: 'a85592d5-b519-470d-84d0-4d9182d224b3' },
    { ex: 'aec7a2a0-3b49-4902-891d-22c52759d71f' },
    { t: 'Mẫu rải Ballad đơn giản (kỹ thuật móc)', note: 'video thầy quay 🎬 — rải/móc, để sau khi thạo quạt' },
    { t: 'Nền tập Bolero', note: 'công cụ app 🎛 (Groove Lab điệu Bolero)' },
    { t: 'Gảy theo: Con đường xưa em đi', note: 'gảy theo 🎸 (Strum Score) — Bolero' },
  ] },
  { code: 7, order: 6, mid: 'a844e611-71a9-48c1-84cf-a645b8c79d08', name: 'Chương 7: Bố cục bài hát', lessons: [
    { ex: 'd3624d28-47e2-48d3-a1d3-ee7ead6c3de2' },
    { t: 'Intro — Phiên khúc — Điệp khúc — Cầu nối — Kết', note: 'bài giảng (text) + nghe ví dụ' },
    { ex: 'c2a2a5eb-411e-4e0a-a2ed-2a891b5ac970' },
    { t: 'Chọn điệu theo tính chất bài hát', note: 'bài giảng (text)' },
    { t: 'Chọn sắc thái theo từng đoạn', note: 'bài giảng (text)' },
    { t: 'Phiên khúc đánh nhẹ — điệp khúc bung hơn', note: 'bài giảng (text)' },
    { t: 'Bố cục mẫu Ballad', note: 'bài giảng (text)' },
    { ex: '21b2be1b-533a-4d2d-9610-a698e01b31d5' },
    { t: 'Bố cục mẫu Slowrock', note: 'bài giảng (text)' },
    { t: 'Bố cục mẫu Valse', note: 'bài giảng (text)' },
    { ex: 'a3a059a1-7b85-4505-962a-aba56892d28f' },
  ] },
  { code: 8, order: 7, mid: '974b0073-61d3-4b76-857a-e4f01c738d42', name: 'Chương 8: Áp dụng vào bài hát thực tế', lessons: [
    { t: 'Quy trình đệm 1 bài mới — 5 bước', note: 'bài giảng (text/slide): tông → điệu → bố cục → tập đoạn → ghép' },
    { t: 'Thực hành 1 — bài Ballad (chọn bài sau)', note: 'gảy theo 🎸 + phân tích bố cục' },
    { t: 'Thực hành 2 — Con đường xưa em đi (Bolero)', note: 'gảy theo 🎸 + phân tích bố cục' },
    { t: 'Thực hành 3 — Diễm Xưa (Slowrock)', note: 'gảy theo 🎸 + phân tích bố cục' },
    { t: 'Thực hành 4 — bài Valse (chọn bài sau)', note: 'gảy theo 🎸 + phân tích bố cục' },
    { t: 'Dự án cuối khoá: tự chọn 1 bài, tự đệm và thu lại nộp', note: 'bài nộp (submit_video)' },
    { t: 'Tổng kết Đệm hát Trình độ 2', note: 'bài giảng (text)' },
    { t: 'Lộ trình lên Đệm hát Trình độ 3', note: 'bài giảng (text)' },
  ] },
]

let sql = `-- ============================================================================
-- ĐỆM HÁT TRÌNH ĐỘ 2 (DH2) — KHUNG 8 CHƯƠNG. QUẠT trước, MÓC cuối (nguyên tắc "It works").
--   Chùm nốt → Tiết tấu → Ballad → Valse → Slowrock → Bolero&móc → Bố cục → Áp dụng.
-- SINH TỰ ĐỘNG từ db/gen_dh2.cjs — đừng sửa tay. Course DH2: ${DH2}
-- Bài mới = placeholder (text, ⏳) — điền nội dung sau. Bài cũ chỉ đổi chương/thứ tự.
-- Idempotent: ON CONFLICT của bài mới KHÔNG đè nội dung đã điền (chỉ chỉnh module/order).
-- ============================================================================

`
const newIds = []
CHAPTERS.forEach((c) => {
  sql += `-- ===== ${c.name} =====\n`
  sql += `INSERT INTO edu_modules (id, course_id, name, order_index) VALUES ('${c.mid}', '${DH2}', '${esc(c.name)}', ${c.order})\n`
  sql += `ON CONFLICT (id) DO UPDATE SET course_id = EXCLUDED.course_id, name = EXCLUDED.name, order_index = EXCLUDED.order_index;\n`
  c.lessons.forEach((l, oi) => {
    if (l.ex) {
      sql += `UPDATE edu_course_lessons SET module_id = '${c.mid}', order_index = ${oi}${l.title ? `, title = '${esc(l.title)}'` : ''} WHERE id = '${l.ex}';\n`
    } else {
      const id = L(c.code, oi); newIds.push(id)
      const content = `<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> ${esc(l.note)}</p>`
      sql += `INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)\n`
      sql += `VALUES ('${id}', '${c.mid}', '${esc(l.t)}', 'text', '${content}', ${oi}, false, 'free')\n`
      sql += `ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index;\n`
    }
  })
  sql += `\n`
})

// Dọn placeholder MỒ CÔI: bài 'd2c00…' của khung cũ nhưng không còn trong khung mới
// (vd rải Ballad đã dời chương). Chỉ đụng placeholder DH2; bài có nội dung đều nằm trong newIds.
sql += `-- ===== Dọn bài placeholder mồ côi (khung cũ) =====\n`
sql += `DELETE FROM edu_course_lessons WHERE id::text LIKE 'd2c00%'\n  AND id NOT IN (\n    ${newIds.map(id => `'${id}'`).join(',\n    ')}\n  );\n\n`

// Bossa Nova → chuyển sang Trình độ 3 (tạo module mới ở TĐ3, dời 4 bài sang)
sql += `-- ===== Chuyển cụm Bossa Nova sang Đệm Hát Trình Độ 3 =====\n`
sql += `INSERT INTO edu_modules (id, course_id, name, order_index) VALUES ('${M_BOSSA_TD3}', '${TD3}', 'Điệu Bossa Nova (chuyển từ Trình độ 2)', 0)\n`
sql += `ON CONFLICT (id) DO UPDATE SET course_id = EXCLUDED.course_id, name = EXCLUDED.name, order_index = EXCLUDED.order_index;\n`
;[
  'bbf87a30-8daf-46b3-9af7-796c5a330718', '1ec6e240-afe7-4589-a57f-a318e313bead',
  'dbeedf1b-bf9e-4ef6-9413-dd4113255234', 'e2a39c7d-ce7e-4e06-9591-7c3f9b3eb27d',
].forEach((id, i) => { sql += `UPDATE edu_course_lessons SET module_id = '${M_BOSSA_TD3}', order_index = ${i} WHERE id = '${id}';\n` })

sql += `\nNOTIFY pgrst, 'reload schema';\n`
fs.writeFileSync('db/dh2_full.sql', sql)
const nNew = CHAPTERS.reduce((a, c) => a + c.lessons.filter(l => !l.ex).length, 0)
const nEx = CHAPTERS.reduce((a, c) => a + c.lessons.filter(l => l.ex).length, 0)
console.log(`OK db/dh2_full.sql — ${CHAPTERS.length} chương, ${nEx} bài cũ + ${nNew} bài mới (placeholder) + 4 Bossa→TĐ3`)
