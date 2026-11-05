// Contextual Share V2 — vòng đời MIGRATION + test DB trên cụm PG tạm của scripts/e2e-share-note.sh (E2E_SHARE_TEXT=1). KHÔNG production.
// Trình tự: dữ liệu V1 TRƯỚC migration → static → preflight → setup → postflight (V1 không đổi) → áp lại (idempotent) → test SQL (db/tests/share_text_v2_test.sql)
//           → rollback (hàng văn bản + bài Feed bị gỡ, ô nhịp V1 nguyên vẹn, cột/NOT NULL khôi phục) → áp lại → để DB ở trạng thái ĐÃ migrate cho các kịch bản trình duyệt.
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname)
const { E2E_PG_BIN, E2E_PG_SOCK, E2E_PG_PORT } = process.env
const A = 'aaaaaaaa-0000-4000-8000-00000000000a', B = 'bbbbbbbb-0000-4000-8000-00000000000b', C = 'cccccccc-0000-4000-8000-00000000000c'
const S1 = '51000000-0000-4000-8000-000000000001'
let fails = 0
const ok = (c, m) => { if (c) console.log('PASS: ' + m); else { fails++; console.log('FAIL: ' + m) } }

function psql(args, opts = {}) {
  const r = spawnSync(`${E2E_PG_BIN}/psql`, ['-X', '-q', '-tA', '-h', E2E_PG_SOCK, '-p', E2E_PG_PORT, '-U', 'postgres', '-d', 'e2e', '-v', 'ON_ERROR_STOP=1', ...args],
    { encoding: 'utf8', env: { ...process.env, PGOPTIONS: '-c client_min_messages=notice' } })
  return { code: r.status, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() }
}
const q = sql => { const r = psql(['-c', sql]); if (r.code !== 0) throw new Error(sql.slice(0, 80) + ' → ' + r.err); return r.out }
const asUser = (u, sql) => q(`begin; select set_config('request.jwt.claims', json_build_object('sub','${u}','role','authenticated')::text, true); set local role authenticated; ${sql}; commit;`)

// ── hàm V1 + dấu vân tay ghi chú ô nhịp ──
const FN_LIST = ['share_note_create', 'share_note_open', 'share_note_card', 'share_note_session_open', 'social_share_share_note', 'share_note_delete', 'share_note_visible', 'share_note_score_ok', 'share_note_tex', 'dm_share']
const fnMd5 = () => q(`select string_agg(p.proname || '=' || left(md5(p.prosrc), 8), ',' order by p.proname collate "C") from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in (${FN_LIST.map(f => `'${f}'`).join(',')})`)
const barsFp = () => q(`select left(md5(coalesce(string_agg(id::text || ':' || section_idx || ':' || array_to_string(score_path, '.') || ':' || tex_sha || ':' || bar_from || '-' || bar_to, ',' order by id), '')), 12) from public.share_notes where deleted_at is null or true`)
const gate = (file, md5, mutate = false) => {
  let sql = readFileSync(path.join(ROOT, 'db', file), 'utf8').replace(/@V1_FUNCTION_MD5@/g, md5)
  if (mutate) sql = sql.split(md5).join(md5.replace('dm_share=', 'dm_share=0'))
  const tmp = path.join(mkdtempSync(path.join(tmpdir(), 'stv2-')), file); writeFileSync(tmp, sql)
  const r = psql(['-F', '|', '-f', tmp]); return r
}
const gateOf = r => (r.out.split('\n').find(l => l.startsWith('GATE|')) ?? '').split('|')[1]

console.log('── Vòng đời migration Contextual Share V2')
// 0) static
for (const f of ['share_text_v2_setup.sql', 'share_text_v2_rollback.sql']) {
  const t = readFileSync(path.join(ROOT, 'db', f), 'utf8')
  ok(!/^\s*(begin|commit|rollback)\s*;/im.test(t), `${f}: không có begin/commit (prod-db.py bọc transaction)`)
}
{
  const t = readFileSync(path.join(ROOT, 'db/share_text_v2_setup.sql'), 'utf8').split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
  ok(!/\b(update|delete\s+from)\s+public\.(class_lesson_content|class_sessions|dm_messages|class_posts)\b/i.test(t) && !/insert\s+into\s+public\.(class_lesson_content|dm_messages)\b/i.test(t),
    'setup KHÔNG sửa/xoá giáo trình, buổi, tin Chat, bài Feed; không ghi giáo trình / Chat (chỉ share_notes + hàm; hàm đăng Feed chèn đúng một bài như V1)')
  ok(!/create\s+(or replace\s+)?function\s+public\.(share_note_create|share_note_open|share_note_card|share_note_session_open|social_share_share_note|share_note_delete|dm_share)\s*\(/i.test(t), 'setup KHÔNG tạo lại / sửa hàm V1 nào')
  ok(!/dangerouslySetInnerHTML|http:\/\/|https:\/\//i.test(t), 'setup không chứa URL')
}

// 1) dữ liệu V1 TRƯỚC migration (qua hàm V1 thật, như học viên)
ok(q(`select count(*) from information_schema.columns where table_schema='public' and table_name='share_notes' and column_name='anchor_kind'`) === '0', 'nền: CHƯA có V2')
const sx = q(`select (e.i - 1) from public.class_lesson_content cc cross join lateral jsonb_array_elements(cc.blocks) with ordinality e(v, i) where cc.session_id = '${S1}' and e.v ->> 'kind' = 'score' limit 1`)
const v1id = asUser(A, `select public.share_note_create('${S1}', ${sx}, array['tex'], 2, 3, 'Ô 2–3 trước V2', 'ck-pre-v2-0001')`).split('\n').find(l => /^[0-9a-f-]{36}$/.test(l))
asUser(A, `select public.social_share_share_note('${v1id}')`)
const v1id2 = asUser(A, `select public.share_note_create('${S1}', ${sx}, array['tex'], 1, 1, 'Ô 1 trước V2', 'ck-pre-v2-0002')`).split('\n').find(l => /^[0-9a-f-]{36}$/.test(l))
const fp0 = barsFp(), md0 = fnMd5()
ok(q(`select count(*) from public.share_notes`) === '2', 'V1 trước migration: 2 ghi chú ô nhịp (1 đã đăng Feed)')
console.log('   V1 hàm md5: ' + md0); console.log('   dấu vân tay ô nhịp: ' + fp0)
const openV1 = (u, id) => asUser(u, `select status || '|' || coalesce(section_idx::text,'') || '|' || coalesce(array_to_string(score_path,'.'),'') || '|' || coalesce(bar_from::text,'') || '-' || coalesce(bar_to::text,'') from public.share_note_open('${id}')`).split('\n').filter(l => /^(ok|stale|no_access)\|/.test(l)).join(';')
const v1Before = [A, B, C].map(u => openV1(u, v1id)).join(' ## ')

// 2) preflight → PASS; hàm V1 bị đổi → FAIL (gate hoạt động)
ok(gateOf(gate('share_text_v2_preflight.sql', md0)) === 'PASS', 'preflight GATE = PASS (nền V1 đúng baseline)')
ok(gateOf(gate('share_text_v2_preflight.sql', md0, true)) === 'FAIL', 'preflight GATE = FAIL khi baseline hàm V1 khác (bảo vệ drift)')

// 3) setup (một transaction như prod-db.py) → postflight
let r = psql(['-1', '-f', path.join(ROOT, 'db/share_text_v2_setup.sql')]); ok(r.code === 0, 'setup chạy trong MỘT transaction' + (r.code ? ' — ' + r.err : ''))
if (r.code) process.exit(1)
ok(gateOf(gate('share_text_v2_postflight.sql', md0)) === 'PASS', 'postflight GATE = PASS (V1 không đổi, 7 cột, ràng buộc, quyền thực thi)')
ok(fnMd5() === md0, 'MỌI hàm V1 giữ nguyên md5 sau migration')
ok(barsFp() === fp0, 'dấu vân tay ghi chú ô nhịp KHÔNG đổi sau migration')
ok(q(`select count(*) from public.share_notes where anchor_kind = 'bars'`) === '2', 'cả 2 ghi chú V1 là anchor_kind = bars (mặc định)')
const v1After = [A, B, C].map(u => openV1(u, v1id)).join(' ## ')
ok(v1Before === v1After && v1After.includes('ok|'), `V1: mở bằng share_note_open trước = sau migration (${v1After})`)
// hàm V1 mở ghi chú ô nhịp vẫn đúng; v2 cho cùng kết quả (đã thử sâu hơn trong test SQL mục E)

// 4) idempotent
r = psql(['-1', '-f', path.join(ROOT, 'db/share_text_v2_setup.sql')]); ok(r.code === 0, 'setup áp LẠI (idempotent) không lỗi' + (r.code ? ' — ' + r.err : ''))
ok(gateOf(gate('share_text_v2_postflight.sql', md0)) === 'PASS', 'postflight vẫn PASS sau khi áp lại')

// 5) test SQL
r = psql(['-f', path.join(ROOT, 'db/tests/share_text_v2_test.sql')])
const lines = (r.err + '\n' + r.out).split('\n').map(l => l.replace(/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):\s*/, '').trim()).filter(Boolean)
for (const l of lines) if (/^(PASS|FAIL|PERF)/.test(l) || /ALL_SHARE_TEXT/.test(l)) console.log('   ' + l)
const nPass = lines.filter(l => l.startsWith('PASS:')).length, nFail = lines.filter(l => /^FAIL|ERROR/.test(l)).length
ok(r.code === 0 && nFail === 0 && lines.some(l => l.includes('ALL_SHARE_TEXT_DB_TESTS_DONE')), `test SQL: ${nPass} PASS, ${nFail} FAIL` + (r.code ? ' — ' + r.err.split('\n').slice(-8).join(' | ') : ''))

// 6) rollback: tạo MỘT ghi chú văn bản + bài Feed rồi rollback
const ix = q(`select (e.i - 1) from public.class_lesson_content cc cross join lateral jsonb_array_elements(cc.blocks) with ordinality e(v, i) where cc.session_id = '${S1}' and e.v ->> 'title' = 'Ôn tập 7 ngày'`)
const tid = asUser(A, `select public.share_text_create('${S1}', ${ix}, array['blocks','1','text'], 0, 8, 'trước rollback', 'ck-rb-0000001')`).split('\n').find(l => /^[0-9a-f-]{36}$/.test(l))
asUser(A, `select public.social_share_share_text('${tid}')`)
ok(q(`select count(*) from public.class_posts where tool_share ->> 'anchor' = 'text'`) === '1', 'trước rollback: có 1 bài Feed văn bản')
r = psql(['-1', '-f', path.join(ROOT, 'db/share_text_v2_rollback.sql')]); ok(r.code === 0, 'rollback chạy trong MỘT transaction' + (r.code ? ' — ' + r.err : ''))
ok(q(`select count(*) from information_schema.columns where table_schema='public' and table_name='share_notes' and column_name in ('anchor_kind','text_path','char_from','char_to','text_sha','ctx_sha','block_fp')`) === '0', 'rollback: 7 cột V2 đã gỡ')
ok(q(`select count(*) from information_schema.columns where table_schema='public' and table_name='share_notes' and column_name in ('score_path','tex_sha','bar_from','bar_to') and is_nullable = 'NO'`) === '4', 'rollback: NOT NULL của 4 cột nhạc được khôi phục')
ok(q(`select count(*) from public.class_posts where tool_share ->> 'anchor' = 'text'`) === '0' && q(`select count(*) from public.share_notes`) === '2', 'rollback: bài Feed văn bản + hàng text đã gỡ; 2 ghi chú ô nhịp còn nguyên')
ok(fnMd5() === md0 && barsFp() === fp0, 'rollback: hàm V1 + dấu vân tay ô nhịp NGUYÊN VẸN')
ok([A, B, C].map(u => openV1(u, v1id)).join(' ## ') === v1Before, 'rollback: V1 mở ghi chú ô nhịp y như ban đầu')
ok(q(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and (p.proname like 'share\\_text\\_%' or p.proname in ('share_note_open_v2','share_note_card_v2','social_share_share_text'))`) === '0', 'rollback: không còn hàm V2')
r = psql(['-1', '-f', path.join(ROOT, 'db/share_text_v2_rollback.sql')]); ok(r.code === 0, 'rollback áp LẠI (idempotent) không lỗi')

// 7) áp lại setup → để DB đã migrate cho trình duyệt
r = psql(['-1', '-f', path.join(ROOT, 'db/share_text_v2_setup.sql')]); ok(r.code === 0, 'áp lại setup sau rollback')
ok(gateOf(gate('share_text_v2_postflight.sql', md0)) === 'PASS' && barsFp() === fp0, 'sau áp lại: postflight PASS + ô nhịp V1 nguyên vẹn')
console.log(fails ? `\nFAIL: ${fails} kiểm tra DB/migration` : '\nPASS: vòng đời migration + test DB V2')
process.exit(fails ? 1 : 0)
