const fs = require('fs')
const data = JSON.parse(fs.readFileSync('src/elearn/tiaNot1Lessons.json', 'utf8'))
const MOD = data.module_id
const MI_LESSON = '0d0604ff-bdb4-474a-a088-d9e699c698bb'  // Bài 1 "Nốt Mi — dây 1 buông" (đã có)
const esc = (s) => String(s).replace(/'/g, "''")
let sql = `-- Seed Tỉa nốt 1 — Chương 1 (Bài 2–6) vào DB. SINH TỰ ĐỘNG từ src/elearn/tiaNot1Lessons.json
-- (đừng sửa tay; sửa JSON rồi chạy: node db/gen_tianot_seed.cjs)
-- Mỗi bài = 1 edu_course_lessons (lesson_type='flow') + 1 flows (slides JSON).
-- Idempotent: id cố định + ON CONFLICT DO UPDATE. is_published=true (gắn lên bài học).
-- Module: ${MOD}

-- Xuất bản luôn Bài 1 (Nốt Mi) cho đồng bộ thứ tự
UPDATE edu_course_lessons SET is_published = true WHERE id = '${MI_LESSON}';

`
for (const l of data.lessons) {
  const slides = esc(JSON.stringify(l.slides))
  const title = esc(l.title)
  sql += `-- ${l.title}
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, order_index, is_published, tier)
VALUES ('${l.lessonId}', '${MOD}', '${title}', 'flow', ${l.order}, true, 'free')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, order_index = EXCLUDED.order_index, lesson_type = 'flow', is_published = true;

INSERT INTO flows (id, lesson_id, title, status, reward_xp, slides)
VALUES ('${l.flowId}', '${l.lessonId}', '${title}', 'published', ${l.reward_xp}, '${slides}'::jsonb)
ON CONFLICT (id) DO UPDATE SET lesson_id = EXCLUDED.lesson_id, title = EXCLUDED.title, status = EXCLUDED.status, reward_xp = EXCLUDED.reward_xp, slides = EXCLUDED.slides;

`
}
sql += `NOTIFY pgrst, 'reload schema';\n`
fs.writeFileSync('db/seed_tianot_chuong1.sql', sql)
console.log('OK wrote db/seed_tianot_chuong1.sql (' + sql.length + ' bytes, ' + data.lessons.length + ' bài)')
