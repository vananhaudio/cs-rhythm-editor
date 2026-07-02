const fs = require('fs')
const data = JSON.parse(fs.readFileSync('src/elearn/tiaNot1Lessons.json', 'utf8'))
const COURSE = data.course_id
const MI_LESSON = '0d0604ff-bdb4-474a-a088-d9e699c698bb'  // Bài 1 "Nốt Mi" (đã có sẵn)
const esc = (s) => String(s).replace(/'/g, "''")
let sql = `-- Seed Tỉa nốt 1 vào DB. SINH TỰ ĐỘNG từ src/elearn/tiaNot1Lessons.json
-- (đừng sửa tay; sửa JSON rồi chạy: node db/gen_tianot_seed.cjs)
-- Tạo/chỉnh chương (edu_modules) + bài (edu_course_lessons flow) + flows (slides).
-- Idempotent: id cố định + ON CONFLICT DO UPDATE. is_published=true. Course: ${COURSE}

-- Xuất bản Bài 1 (Nốt Mi) cho đồng bộ
UPDATE edu_course_lessons SET is_published = true WHERE id = '${MI_LESSON}';

`
for (const m of data.modules) {
  sql += `-- ===== ${m.name} =====
INSERT INTO edu_modules (id, course_id, name, order_index)
VALUES ('${m.module_id}', '${COURSE}', '${esc(m.name)}', ${m.order})
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, order_index = EXCLUDED.order_index;

`
  for (const l of m.lessons) {
    const slides = esc(JSON.stringify(l.slides))
    const title = esc(l.title)
    sql += `-- ${l.title}
INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, order_index, is_published, tier)
VALUES ('${l.lessonId}', '${m.module_id}', '${title}', 'flow', ${l.order}, true, 'free')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, title = EXCLUDED.title, order_index = EXCLUDED.order_index, lesson_type = 'flow', is_published = true;

INSERT INTO flows (id, lesson_id, title, status, reward_xp, slides)
VALUES ('${l.flowId}', '${l.lessonId}', '${title}', 'published', ${l.reward_xp}, '${slides}'::jsonb)
ON CONFLICT (id) DO UPDATE SET lesson_id = EXCLUDED.lesson_id, title = EXCLUDED.title, status = EXCLUDED.status, reward_xp = EXCLUDED.reward_xp, slides = EXCLUDED.slides;

`
  }
}
sql += `NOTIFY pgrst, 'reload schema';\n`
fs.writeFileSync('db/seed_tianot_chuong1.sql', sql)
const nl = data.modules.reduce((a, m) => a + m.lessons.length, 0)
console.log('OK db/seed_tianot_chuong1.sql (' + sql.length + ' bytes, ' + data.modules.length + ' chương, ' + nl + ' bài)')
