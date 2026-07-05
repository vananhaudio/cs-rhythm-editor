// Sinh SQL chèn 3 BÀI TẬP TƯƠNG TÁC staff-only vào khoá Chìa Khoá Nhạc Lý.
// Slides GIỐNG HỆT 3 sample trong src/FlowLabPage.tsx (nl2/nl3/nl5). Idempotent.
// Chạy: node db/gen_nhacly_exercises.cjs  → db/nhacly_exercises.sql
const fs = require('fs')
const esc = (s) => String(s).replace(/'/g, "''")
const nl = (label, freq, string, fret, staff, dur) =>
  dur != null ? { label, freq, string, fret, staff, dur } : { label, freq, string, fret, staff }

// Chương đích (khớp db/nhacly_restructure.sql)
const MOD_CH2 = 'b1000002-0000-4000-8000-000000000002'  // Nốt nhạc & Khuông
const MOD_CH3 = 'b1000003-0000-4000-8000-000000000003'  // Trường độ
const MOD_CH4 = 'b1000004-0000-4000-8000-000000000004'  // Nhịp & Ô nhịp
const MOD_CH5 = 'b1000005-0000-4000-8000-000000000005'  // Thực hành đọc nhạc

const EXERCISES = [
  {
    lessonId: 'a2100002-0000-4000-8000-000000000002', flowId: 'a2200002-0000-4000-8000-000000000002',
    module_id: MOD_CH2, order: 3, title: 'Bài tập: Đọc nốt trên khuông', reward_xp: 10,
    slides: [
      { id: 'n1', order: 1, logic: 'DAN', type: 'callout', title: 'Đọc nốt trên khuông',
        interactive: { variant: 'tip' },
        content: 'Nhìn <b>vị trí</b> từng nốt trên khuông rồi đọc tên. Bấm <b>Nghe mẫu</b> để nghe từng nốt sáng lên, hoặc <b>Xướng âm</b> (hát tên nốt) để tự kiểm.' },
      { id: 'n2', order: 2, logic: 'LAM', type: 'note_practice', title: 'Gam Đô trưởng — đọc lên dần',
        interactive: { noFretboard: true, hint: 'Từ Đô (dưới khuông) đi lên tới Đô cao: Đô – Rê – Mi – Fa – Sol – La – Si – Đô. Đọc to tên nốt theo từng bước.',
          notes: [ nl('Đô',130.81,5,3,-2), nl('Rê',146.83,4,0,-1), nl('Mi',164.81,4,2,0), nl('Fa',174.61,4,3,1),
                   nl('Sol',196,3,0,2), nl('La',220,3,2,3), nl('Si',246.94,2,0,4), nl('Đô',261.63,2,1,5) ] } },
      { id: 'n3', order: 3, logic: 'NGAM', type: 'checklist', title: 'Tự kiểm tra',
        interactive: { items: ['Mình đọc đúng tên nốt theo vị trí trên khuông', 'Mình phân biệt được nốt trên dòng và nốt trong khe'] } },
    ],
  },
  {
    lessonId: 'a2100003-0000-4000-8000-000000000003', flowId: 'a2200003-0000-4000-8000-000000000003',
    module_id: MOD_CH3, order: 2, title: 'Bài tập: Nghe & nhìn trường độ', reward_xp: 10,
    slides: [
      { id: 'd1', order: 1, logic: 'DAN', type: 'callout', title: 'Trường độ — dài ngắn của nốt',
        interactive: { variant: 'tip' },
        content: 'Cùng một cao độ nhưng <b>hình nốt khác nhau</b> thì ngân <b>dài ngắn khác nhau</b>. Nghe mẫu để cảm nhận rõ.' },
      { id: 'd2', order: 2, logic: 'LAM', type: 'note_practice', title: 'Đen (1) → Trắng (2) → Tròn (4)',
        interactive: { noFretboard: true, showDur: true,
          hint: 'Nghe metronome đếm phách đều. Bốn nốt đen (mỗi nốt 1 phách) → hai nốt trắng (mỗi nốt 2 phách) → một nốt tròn (ngân 4 phách). Nghe kỹ độ dài khác nhau.',
          notes: [ nl('La',220,3,2,3,1), nl('La',220,3,2,3,1), nl('La',220,3,2,3,1), nl('La',220,3,2,3,1),
                   nl('La',220,3,2,3,2), nl('La',220,3,2,3,2), nl('La',220,3,2,3,4) ] } },
      { id: 'd3', order: 3, logic: 'NGAM', type: 'checklist', title: 'Tự kiểm tra',
        interactive: { items: ['Mình nghe rõ nốt tròn ngân dài gấp 4 lần nốt đen', 'Mình nhận ra đầu nốt rỗng = trắng/tròn, đầu đặc = đen'] } },
    ],
  },
  {
    lessonId: 'a2100004-0000-4000-8000-000000000004', flowId: 'a2200004-0000-4000-8000-000000000004',
    module_id: MOD_CH4, order: 2, title: 'Bài tập: Đếm phách trong ô nhịp', reward_xp: 10,
    slides: [
      { id: 'b1', order: 1, logic: 'DAN', type: 'callout', title: 'Nhịp 3/4 — mỗi ô ba phách',
        interactive: { variant: 'tip' },
        content: 'Số chỉ nhịp <b>3/4</b> nghĩa là mỗi ô nhịp có <b>3 phách</b>: mạnh – nhẹ – nhẹ. Cùng đọc và đếm 1‑2‑3, 1‑2‑3.' },
      { id: 'b2', order: 2, logic: 'LAM', type: 'note_practice', title: 'Đọc câu nhịp 3/4',
        interactive: { noFretboard: true, showDur: true, beatsPerBar: 3,
          hint: 'Để ý số chỉ nhịp 3/4 đầu khuông và vạch nhịp. Ô 1: ba nốt đen. Ô 2: một đen + một trắng (1 + 2 = đủ 3 phách).',
          notes: [ nl('Đô',130.81,5,3,-2,1), nl('Mi',164.81,4,2,0,1), nl('Sol',196,3,0,2,1),
                   nl('Mi',164.81,4,2,0,1), nl('Đô',130.81,5,3,-2,2) ] } },
      { id: 'b3', order: 3, logic: 'NGAM', type: 'checklist', title: 'Tự kiểm tra',
        interactive: { items: ['Mình đếm đúng 3 phách mỗi ô', 'Mình cảm được phách mạnh rơi vào đầu ô nhịp'] } },
    ],
  },
  {
    lessonId: 'a2100005-0000-4000-8000-000000000005', flowId: 'a2200005-0000-4000-8000-000000000005',
    module_id: MOD_CH5, order: 1, title: 'Bài tập: Đọc một câu nhạc', reward_xp: 12,
    slides: [
      { id: 'r1', order: 1, logic: 'DAN', type: 'callout', title: 'Đọc trọn một câu nhạc',
        interactive: { variant: 'tip' },
        content: 'Ghép mọi thứ đã học: <b>tên nốt + trường độ + ô nhịp</b>. Nghe mẫu một lượt cho quen, rồi <b>Xướng âm</b> theo nhịp.' },
      { id: 'r2', order: 2, logic: 'LAM', type: 'note_practice', title: 'Câu nhạc ngắn — nhịp 4/4',
        interactive: { noFretboard: true, showDur: true, beatsPerBar: 4,
          hint: 'Đọc lần lượt: tên nốt kèm trường độ. Câu kết bằng nốt trắng (Đô, ngân 2 phách).',
          notes: [ nl('Đô',130.81,5,3,-2,1), nl('Rê',146.83,4,0,-1,1), nl('Mi',164.81,4,2,0,1), nl('Fa',174.61,4,3,1,1),
                   nl('Mi',164.81,4,2,0,1), nl('Rê',146.83,4,0,-1,1), nl('Đô',130.81,5,3,-2,2) ] } },
      { id: 'r3', order: 3, logic: 'NGAM', type: 'checklist', title: 'Tự kiểm tra',
        interactive: { items: ['Mình đọc trôi cả câu, không dừng giữa chừng', 'Mình giữ phách đều từ đầu đến cuối'] } },
    ],
  },
]

let sql = `-- ============================================================================
-- CHÌA KHOÁ NHẠC LÝ — 3 bài tập tương tác STAFF-ONLY (noFretboard)
-- SINH TỰ ĐỘNG từ db/gen_nhacly_exercises.cjs (đừng sửa tay).
-- lesson_type='flow' + bảng flows. is_published=false (khoá chưa publish).
-- Idempotent: id cố định + ON CONFLICT DO UPDATE.
-- ============================================================================

`
for (const e of EXERCISES) {
  const slides = esc(JSON.stringify(e.slides))
  const title = esc(e.title)
  sql += `-- ${e.title}
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, order_index, is_published, tier)
VALUES ('${e.lessonId}', '${e.module_id}', '${title}', 'flow', ${e.order}, false, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, title = EXCLUDED.title, order_index = EXCLUDED.order_index, lesson_type = 'flow';

INSERT INTO flows (id, lesson_id, title, status, reward_xp, slides)
VALUES ('${e.flowId}', '${e.lessonId}', '${title}', 'published', ${e.reward_xp}, '${slides}'::jsonb)
ON CONFLICT (id) DO UPDATE SET lesson_id = EXCLUDED.lesson_id, title = EXCLUDED.title, status = EXCLUDED.status, reward_xp = EXCLUDED.reward_xp, slides = EXCLUDED.slides;

`
}
// Xếp lại thứ tự Chương 5 để bài tập đọc nằm giữa B9 và game B10
sql += `-- Chương 5: B9(0) → Bài tập đọc(1) → Game nốt(2) → Giải trí bài hát(3)
UPDATE edu_course_lessons SET order_index = 2 WHERE id = '2c083246-48b1-4d20-894b-ce3ee6f23311'; -- Bài 10 Game nốt
UPDATE edu_course_lessons SET order_index = 3 WHERE id = '853bc817-2ee6-434b-946c-4a33acf39d01'; -- Giải trí: Bài hát

NOTIFY pgrst, 'reload schema';
`
fs.writeFileSync('db/nhacly_exercises.sql', sql)
console.log('OK db/nhacly_exercises.sql (' + sql.length + ' bytes, ' + EXERCISES.length + ' bài tập)')
