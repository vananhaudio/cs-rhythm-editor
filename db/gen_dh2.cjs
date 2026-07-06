// Sinh khung SQL cho khoá ĐỆM HÁT TRÌNH ĐỘ 2 (DH2).
// Chạy: node db/gen_dh2.cjs  → db/dh2_full.sql
// Triết lý: tổ chức theo BƯỚC ĐI & THÀNH QUẢ của học sinh (không theo mục lục học thuật).
//   Mỗi chương = một chặng dẫn tới "chơi được một bài" (nguyên tắc It works).
// UUID bài mới = L(code, n): code = số chương GỐC, n = chỉ số GỐC (cố định) → tách khỏi thứ tự.
//   Lesson có thể ghi `code` riêng để giữ UUID cũ khi dời sang chương khác.
// Tiêu đề = "Bài <chương hiển thị>.<thứ tự> — <tên>".
const fs = require('fs')
const esc = (s) => String(s).replace(/'/g, "''")
const DH2 = 'c7ab2fcb-aff1-4485-a381-4edc83e4a62b'
const TD3 = 'd5f963ac-bcd7-45e2-b002-7970ba33e710'
const M_BOLERO = 'd2000044-0000-4000-8000-000000000044'
const M_SLOWROCK = 'd2000055-0000-4000-8000-000000000055'
const M_BOSSA_TD3 = 'd3000001-0000-4000-8000-000000000001'
const M_CH2_OLD = '46e55dbe-dd8f-40b5-a8ec-6464219f7155'    // 'Tiết tấu quạt' cũ — đã gộp vào Ch1
const M_BALLAD_OLD = '2a3011f7-750e-49e6-9b55-ea0af1725d0d' // 'Điệu Ballad' cũ — GỘP vào Ch1
const DROP_EX = [
  'd76e8798-76bd-485e-b0fb-4fadb6b98458', // 'Quạt chùm 2 vào ô nhịp' (video trùng)
]
const L = (code, n) => `d2c00${code}${String(n).padStart(2, '0')}-0000-4000-8000-000000000000`

const CHAPTERS = [
  // ===== CHƯƠNG 1: gộp Chùm nốt + Tiết tấu + Ballad → dẫn 1 mạch tới chơi được nhiều bài chùm 2 =====
  { code: 1, order: 0, mid: '067ae3bb-7812-4485-8fa2-077fccaea2bf', name: 'Chương 1: Quạt chùm 2 (điệu Ballad) & chơi bài đầu tiên', lessons: [
    { ex: 'aca3b657-b2c8-46dd-ac1e-5fe8b7828158', title: 'Chào mừng Trình độ 2' },
    { t: 'Chùm nốt là gì — chia nhỏ phách', note: 'bài giảng (text)', n: 3 },
    { ex: '1bc21a87-d39f-48ee-a62c-a753902631cf', title: 'Chùm 2 — nốt móc đơn' },
    { t: 'Thực hành gõ chùm 2', note: 'công cụ app 🎛 (đếm 1&2& + gõ theo)', n: 6 },
    { ex: 'df4ddd1b-768b-4d74-8b9a-40a310ac99e9', title: 'Thực hành quạt chùm 2 (xuống–lên)' },
    { ex: '2f6b416d-7d4f-4bd0-8c13-0e4ad2e11829', title: 'Gảy theo: Happy Birthday — quạt chùm 2' },
    { ex: '4692e092-3591-4dda-99d6-265b82e0d34c', title: 'Gảy theo: Jingle Bells — quạt chùm 2' },
    { ex: '2b73cd3b-cc6e-4ba9-baff-9ef6acc984ac', title: 'Điệu Ballad là gì' }, // gộp 'Ballad là gì' + 'Ballad dùng chùm 2'
    { t: 'Mẫu quạt Ballad cơ bản', note: 'video thầy quay 🎬', code: 3, n: 2 },        // giữ UUID d2c00302 (đã có video)
    { t: 'Nền tập Ballad', note: 'công cụ app 🎛 (Groove Lab điệu Ballad)', code: 3, n: 3 },
    { t: 'Gảy theo: Ode to Joy', note: 'gảy theo 🎸 (Strum Score) — native song-ode-ballad', code: 3, n: 4 }, // giữ UUID d2c00304
    { t: 'Checkpoint Chương 1', note: 'quiz 📝', n: 9 },
  ] },
  { code: 6, order: 1, mid: '271e9988-0e3b-4171-a829-139a6b399263', name: 'Chương 2: Điệu Valse', lessons: [
    { t: 'Valse là gì — nhịp 3/4 chắc, rắn rỏi', note: 'bài giảng (text)', n: 0 },        // gộp tính chất + nhịp 3/4
    { t: 'Mẫu Valse nốt đen (kiểu cơ bản)', note: 'video thầy quay 🎬', n: 2 },
    { t: 'Nền tập Valse', note: 'công cụ app 🎛 (Groove Lab điệu Valse)', n: 5 },
    { t: 'Gảy theo: 1 bài Valse — nốt đen (chọn sau)', note: 'gảy theo 🎸 (Strum Score)', n: 6 }, // thành quả sớm
    { t: 'Mẫu Valse có chùm 2 (mềm hơn — cho điệp khúc)', note: 'video thầy quay 🎬', n: 3 },
    { t: 'Tiết tấu trộn: Đen – đon đon – đon đon', note: 'video / bài giảng — 1 nốt đen + 2 chùm 2 trong 3/4', n: 4 },
    { t: 'Gảy theo: Scarborough Fair', note: 'gảy theo 🎸 (Strum Score) — áp dụng tiết tấu trộn', n: 7 },
    { t: 'Checkpoint Chương 2', note: 'quiz 📝', n: 8 },
  ] },
  { code: 5, order: 2, mid: M_SLOWROCK, name: 'Chương 3: Điệu Slowrock', lessons: [
    { t: 'Nghe thử chùm 3 và liên 3 — làm quen', note: 'bài giảng + audio mẫu', code: 1, n: 8 }, // giữ UUID d2c00108
    { t: 'Tính chất Slowrock', note: 'bài giảng (text)' },
    { t: 'Liên 3 là gì trong đệm hát', note: 'bài giảng (text)', n: 1 },
    { ex: 'db6fddb4-7d3b-4a3b-9a01-f143928f02e5', title: 'Chùm 3 – Liên 3 (nền tảng Slowrock)' },
    { t: 'Cảm giác dàn trải của Slowrock', note: 'bài giảng (text) + audio', n: 3 },
    { t: 'Mẫu Slowrock cơ bản', note: 'video thầy quay 🎬', n: 4 },
    { t: 'Nền tập Slowrock', note: 'công cụ app 🎛 (Groove Lab điệu Slowrock)', n: 5 },
    { t: 'Gảy theo: 1 bài Slowrock (mọi lứa tuổi — chọn sau)', note: 'gảy theo 🎸 (Strum Score)', n: 6 },
  ] },
  { code: 4, order: 3, mid: M_BOLERO, name: 'Chương 4: Điệu Bolero & kỹ thuật móc', lessons: [
    { t: 'Tính chất Bolero', note: 'bài giảng (text)' },
    { ex: '12bb1218-6dcd-447c-8145-7f7f0302482b', title: 'Chùm 3 lệch phải (đơn – kép – kép) — đặc trưng Bolero' },
    { ex: '5f7acacd-9214-48f3-9349-93cc382649fb', title: 'Bolero móc kiểu 1' },
    { ex: 'a85592d5-b519-470d-84d0-4d9182d224b3', title: 'Bolero móc kiểu 2' },
    { ex: 'aec7a2a0-3b49-4902-891d-22c52759d71f', title: 'Quạt ballad cho điệp khúc Bolero' },
    { t: 'Mẫu rải Ballad đơn giản (kỹ thuật móc)', note: 'video thầy quay 🎬 — rải/móc', n: 5 },
    { t: 'Nền tập Bolero', note: 'công cụ app 🎛 (Groove Lab điệu Bolero)', n: 6 },
    { t: 'Gảy theo: 1 bài Bolero (mọi lứa tuổi — chọn sau)', note: 'gảy theo 🎸 (Strum Score)', n: 7 },
  ] },
  { code: 7, order: 4, mid: 'a844e611-71a9-48c1-84cf-a645b8c79d08', name: 'Chương 5: Bố cục bài hát', lessons: [
    { ex: 'd3624d28-47e2-48d3-a1d3-ee7ead6c3de2', title: 'Cấu trúc bài hát (Musical Form)' },
    { t: 'Intro — Phiên khúc — Điệp khúc — Cầu nối — Kết', note: 'bài giảng (text) + nghe ví dụ', n: 1 },
    { ex: 'c2a2a5eb-411e-4e0a-a2ed-2a891b5ac970', title: 'Bố cục một bài hát thông dụng' },
    { t: 'Chọn điệu theo tính chất bài hát', note: 'bài giảng (text)', n: 3 },
    { t: 'Chọn sắc thái theo từng đoạn', note: 'bài giảng (text)', n: 4 },
    { t: 'Phiên khúc đánh nhẹ — điệp khúc bung hơn', note: 'bài giảng (text)', n: 5 },
    { t: 'Bố cục mẫu Ballad', note: 'bài giảng (text)', n: 6 },
    { ex: '21b2be1b-533a-4d2d-9610-a698e01b31d5', title: 'Bố cục mẫu cho một bài Bolero' },
    { t: 'Bố cục mẫu Slowrock', note: 'bài giảng (text)', n: 8 },
    { t: 'Bố cục mẫu Valse', note: 'bài giảng (text)', n: 9 },
    { ex: 'a3a059a1-7b85-4505-962a-aba56892d28f', title: 'Bài tập tự luận: phân tích bố cục bài hát' },
  ] },
  { code: 8, order: 5, mid: '974b0073-61d3-4b76-857a-e4f01c738d42', name: 'Chương 6: Áp dụng vào bài hát thực tế', lessons: [
    { t: 'Quy trình đệm 1 bài mới — 5 bước', note: 'bài giảng (text/slide)', n: 0 },
    { t: 'Tự đệm bài bạn thích — công cụ Strum Builder', note: 'công cụ 🎛 (skill strum-builder, phần tự do)', n: 1 },
    { t: 'Dự án cuối khoá: tự chọn 1 bài, tự đệm và thu lại nộp', note: 'bài nộp (submit_video)', n: 5 },
    { t: 'Tổng kết Đệm hát Trình độ 2', note: 'bài giảng (text)', n: 6 },
    { t: 'Lộ trình lên Đệm hát Trình độ 3', note: 'bài giảng (text)', n: 7 },
  ] },
]

let sql = `-- ============================================================================
-- ĐỆM HÁT TRÌNH ĐỘ 2 (DH2) — SINH TỰ ĐỘNG từ db/gen_dh2.cjs (đừng sửa tay).
-- Tổ chức theo BƯỚC ĐI & THÀNH QUẢ (mỗi chương → chơi được bài). Course: ${DH2}
-- Tiêu đề "Bài <chương>.<thứ tự> — <tên>". Bài mới placeholder (text ⏳).
-- Idempotent: ON CONFLICT bài mới KHÔNG đè nội dung (chỉ module/order/title).
-- ============================================================================

`
const newIds = []
CHAPTERS.forEach((c) => {
  sql += `-- ===== ${c.name} =====\n`
  sql += `INSERT INTO edu_modules (id, course_id, name, order_index) VALUES ('${c.mid}', '${DH2}', '${esc(c.name)}', ${c.order})\n`
  sql += `ON CONFLICT (id) DO UPDATE SET course_id = EXCLUDED.course_id, name = EXCLUDED.name, order_index = EXCLUDED.order_index;\n`
  c.lessons.forEach((l, oi) => {
    const base = l.ex ? l.title : l.t
    const title = esc(`Bài ${c.order + 1}.${oi + 1} — ${base}`)
    if (l.ex) {
      sql += `UPDATE edu_course_lessons SET module_id = '${c.mid}', order_index = ${oi}, title = '${title}' WHERE id = '${l.ex}';\n`
    } else {
      const n = l.n != null ? l.n : oi
      const id = L(l.code != null ? l.code : c.code, n); newIds.push(id)
      const content = `<p><em>⏳ Bài đang xây dựng.</em></p><p><b>Dự kiến:</b> ${esc(l.note)}</p>`
      sql += `INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, content, order_index, is_published, tier)\n`
      sql += `VALUES ('${id}', '${c.mid}', '${title}', 'text', '${content}', ${oi}, false, 'free')\n`
      sql += `ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, order_index = EXCLUDED.order_index, title = EXCLUDED.title;\n`
    }
  })
  sql += `\n`
})

sql += `-- ===== Dọn bài placeholder mồ côi + bài cũ đã bỏ =====\n`
sql += `DELETE FROM edu_course_lessons WHERE id::text LIKE 'd2c00%'\n  AND id NOT IN (\n    ${newIds.map(id => `'${id}'`).join(',\n    ')}\n  );\n`
DROP_EX.forEach(id => { sql += `DELETE FROM edu_course_lessons WHERE id = '${id}';\n` })
sql += `-- Xoá module cũ đã gộp vào Chương 1\n`
sql += `DELETE FROM edu_modules WHERE id IN ('${M_CH2_OLD}', '${M_BALLAD_OLD}');\n\n`

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
console.log(`OK db/dh2_full.sql — ${CHAPTERS.length} chương, ${nEx} bài cũ + ${nNew} bài mới + 4 Bossa→TĐ3`)
