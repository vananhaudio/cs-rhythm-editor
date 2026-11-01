// Tích hợp RPC mira_grading_context('curriculum') V2 trên cluster TẠM (cùng schema/migration như production): trước/ssau/hoàn tác, quyền, đúng nội dung bài 1.1 và 4.3.
// Chạy bởi scripts/test-mira-grading-curriculum-rpc.sh. KHÔNG production, KHÔNG OpenAI.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import path from 'node:path'

const PGBIN = process.env.E2E_PG_BIN, SOCK = process.env.E2E_PG_SOCK, PGPORT = process.env.E2E_PG_PORT
const ROOT = process.env.ROOT_DIR, OUT = process.env.OUT_DIR
const base = ['-X', '-q', '-tA', '-h', SOCK, '-p', PGPORT, '-U', 'postgres', '-d', 'e2e', '-v', 'ON_ERROR_STOP=1']
const psql = (sql) => execFileSync(path.join(PGBIN, 'psql'), [...base, '-c', sql], { encoding: 'utf8' }).trim()
const psqlFile = (f) => execFileSync(path.join(PGBIN, 'psql'), [...base, '-f', f], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const tryPsql = (sql) => { try { return { ok: true, out: psql(sql) } } catch (e) { return { ok: false, err: String(e.stderr || e.message) } } }
const SETUP = path.join(ROOT, 'db/mira_grading_curriculum_v2_setup.sql'), ROLLBACK = path.join(ROOT, 'db/mira_grading_curriculum_v2_rollback.sql')
const OLD_MD5 = '485339e878064c693d5a7866ba6022ae'
const T = 'dddddddd-0000-4000-8000-00000000000d', TH01 = 'b1000000-0000-4000-8000-000000000001'
let n = 0; const ok = (m) => { n++; console.log('PASS: ' + m) }
const ctxMd5 = () => psql("select md5(prosrc) from pg_proc where oid = to_regprocedure('public.mira_grading_context(text,text)')")

// ── dữ liệu: khối giáo trình THẬT (mẫu SOLO01 Buổi 1 và 4) đặt vào hàng published của SOLO01.TH01 ──
const tpl = JSON.parse(execFileSync('npx', ['tsx', 'tests/mira-grading-curriculum/dump-blocks.ts'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }))
const lit = (o) => `$j$${JSON.stringify(o)}$j$::jsonb`
psql(`update public.class_lesson_content set blocks = ${lit(tpl[1].blocks)}, status = 'published' where session_id = '51000000-0000-4000-8000-000000000001'`)
psql(`update public.class_lesson_content set blocks = ${lit(tpl[4].blocks)}, status = 'published' where session_id = '51000000-0000-4000-8000-000000000004'`)
const hasS4 = psql(`select count(*) from public.class_lesson_content where session_id = '51000000-0000-4000-8000-000000000004'`)
if (hasS4 === '0') psql(`insert into public.class_lesson_content (session_id, status, blocks) values ('51000000-0000-4000-8000-000000000004', 'published', ${lit(tpl[4].blocks)})`)
const th11 = psql(`select t.id from public.learning_threads t where t.learner_user_id = 'aaaaaaaa-0000-4000-8000-00000000000a' and t.checkpoint_id = '1.1'`)
assert.match(th11, /^[0-9a-f-]{36}$/)
// bài trả 4.3 của học viên A (sao từ 1.1, đổi buổi + mã bài trả)
psql(`create temp table x as select * from public.learning_threads where id = '${th11}'; update x set id = gen_random_uuid(), session_no = 4, checkpoint_id = '4.3', content_key = 'C:SOLO01:4:4.3'; insert into public.learning_threads select * from x;`)
const th43 = psql(`select id from public.learning_threads where learner_user_id = 'aaaaaaaa-0000-4000-8000-00000000000a' and checkpoint_id = '4.3'`)
assert.match(th43, /^[0-9a-f-]{36}$/)

const ticket = (th, uid = T) => psql(`select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', false); set role authenticated; select (public.mira_grading_ticket('${th}'))->>'ticket';`).split('\n').pop()
const KEY = `select set_config('request.headers', '{"x-mira-grading-key":"e2e-mira-key"}', false); set role anon;`
const ctx = (tk, src, key = KEY) => { const r = tryPsql(`${key} select public.mira_grading_context('${tk}', '${src}')::text;`); return r.ok ? { ok: true, j: JSON.parse(r.out.split('\n').pop()) } : r }
const strip = (j) => { const c = JSON.parse(JSON.stringify(j)); delete c.as_of; return c }

const tk11 = ticket(th11), tk43 = ticket(th43)
assert.equal(ctxMd5(), OLD_MD5, 'cluster tạm phải đang ở thân V1.1 như production'); ok('trước migration: thân mira_grading_context = V1.1 production (md5 485339e8…)')

// ── TRƯỚC: hình dạng cũ ──
const beforeCur = ctx(tk11, 'curriculum'); assert.ok(beforeCur.ok, JSON.stringify(beforeCur))
assert.equal(beforeCur.j.data.guide, undefined); assert.equal(beforeCur.j.data.fretboard, undefined); assert.equal(beforeCur.j.data.v, undefined)
ok('trước: curriculum chỉ có checkpoint/objectives/notes — KHÔNG có bản đồ và lời dặn (đúng điều tra)')
const beforeThread = ctx(tk11, 'thread'), before360 = ctx(tk11, 'student360'), beforeThread43 = ctx(tk43, 'thread')

// ── ÁP DỤNG ──
psqlFile(SETUP); const NEW_MD5 = ctxMd5(); assert.notEqual(NEW_MD5, OLD_MD5); ok('áp dụng setup V2 (một lần): ' + NEW_MD5.slice(0, 8) + '…')
psqlFile(SETUP); assert.equal(ctxMd5(), NEW_MD5); ok('áp dụng lại setup V2: idempotent, cùng md5')
mkdirSync(OUT, { recursive: true })
for (const [name, tk, cp] of [['1.1', tk11, '1.1'], ['4.3', tk43, '4.3']]) {
  const r = ctx(tk, 'curriculum'); assert.ok(r.ok, JSON.stringify(r)); const d = r.j.data
  writeFileSync(path.join(OUT, `rpc-curriculum-${name}.json`), JSON.stringify(r.j, null, 1))
  assert.equal(r.j.status, 'ok'); assert.equal(d.checkpoint.id, cp); assert.equal(d.v, 2)
  assert.ok(Array.isArray(d.guide) && d.guide.length >= 3 && Array.isArray(d.fretboard) && d.fretboard.length === 1)
  assert.doesNotMatch(JSON.stringify(d), /\\ts |"tex"|"quiz"/)
  ok(`sau: curriculum bài ${name} qua RPC thật (vé + khoá): đề + ${d.guide.length} khối hướng dẫn + bản đồ ${d.fretboard[0].dots.length} chấm, ${JSON.stringify(d).length} ký tự`)
}
const d11 = ctx(tk11, 'curriculum').j.data, d43 = ctx(tk43, 'curriculum').j.data
assert.match(d11.checkpoint.prompt, /cùng cao độ/); assert.deepEqual(d11.checkpoint.accepts, ['text'])
assert.ok(d11.fretboard[0].dots.some((x) => x.name === 'C' && x.string === 3 && x.fret === 5) && d11.fretboard[0].dots.some((x) => x.name === 'C' && x.string === 2 && x.fret === 1)); ok('bài 1.1: đề mới + bản đồ có C4 ở dây 3 ngăn 5 và dây 2 ngăn 1')
assert.match(d43.guide.find((g) => g.kind === 'assignment').message, /không chấm bạn có xếp giống Thầy/); assert.ok(d43.guide.some((g) => g.kind === 'recap' && g.steps.length === 4)); ok('bài 4.3: có cách chấm (assignment.message) và 4 câu hỏi (recap)')
// nguồn khác KHÔNG đổi một chữ
assert.deepEqual(strip(ctx(tk11, 'thread').j), strip(beforeThread.j)); assert.deepEqual(strip(ctx(tk43, 'thread').j), strip(beforeThread43.j)); assert.deepEqual(strip(ctx(tk11, 'student360').j), strip(before360.j)); ok('nguồn thread (1.1, 4.3) và student360: kết quả y hệt trước migration')

// ── BẢO MẬT giữ nguyên ──
for (const [label, r] of [['thiếu khoá', ctx(tk11, 'curriculum', `select set_config('request.headers', '{}', false); set role anon;`)],
                          ['sai khoá', ctx(tk11, 'curriculum', `select set_config('request.headers', '{"x-mira-grading-key":"sai"}', false); set role anon;`)],
                          ['vé sai', ctx('0'.repeat(64), 'curriculum')], ['nguồn lạ', ctx(tk11, 'khac')]]) {
  assert.equal(r.ok, false, label); assert.match(r.err, /forbidden|bad_source/); }
ok('thiếu khoá / sai khoá / vé sai / nguồn lạ → bị từ chối như cũ')
assert.equal(tryPsql(`set role anon; select public.mira_gc_s('x', 1);`).ok, false); assert.equal(tryPsql(`set role authenticated; select public.mira_grading_curriculum_data('[]'::jsonb, 'x', 'y', now());`).ok, false); ok('anon/authenticated không gọi được 3 hàm phụ')
// Thầy ngoài pilot: không xin được vé (giữ cổng pilot)
const t2 = tryPsql(`select set_config('request.jwt.claims', '{"sub":"ffffffff-0000-4000-8000-00000000000f","role":"authenticated"}', false); set role authenticated; select (public.mira_grading_ticket('${th11}'))->>'ticket';`); assert.equal(t2.ok, false); ok('Thầy không thuộc pilot: vẫn không xin được vé')
// rút Owner khỏi pilot → vé đang sống cũng bị chặn ở tầng context
psql(`delete from public.mira_grading_pilot where user_id = '${T}'`)
const gone = ctx(tk11, 'curriculum'); assert.equal(gone.ok, false); assert.match(gone.err, /forbidden`?/); ok('rút khỏi pilot: vé còn hạn cũng không đọc được giáo trình (cổng pilot trong hàm context còn nguyên)')
psql(`insert into public.mira_grading_pilot (user_id, note) values ('${T}', 'Owner (E2E)')`)
// vé hết hạn
psql(`update public.mira_grading_tickets set expires_at = now() - interval '1 second'`); const exp = ctx(tk11, 'curriculum'); assert.equal(exp.ok, false); ok('vé hết hạn → bị từ chối')

// ── HOÀN TÁC ──
psqlFile(ROLLBACK); assert.equal(ctxMd5(), OLD_MD5); ok('hoàn tác: thân quay về đúng V1.1 (md5 485339e8…)')
assert.equal(psql(`select count(*) from pg_proc where proname in ('mira_gc_s','mira_gc_strs','mira_grading_curriculum_data')`), '0'); ok('hoàn tác: gỡ sạch 3 hàm phụ')
psqlFile(SETUP); assert.equal(ctxMd5(), NEW_MD5); ok('áp dụng lại sau hoàn tác: đúng md5 V2')
console.log(`\nRPC curriculum V2: ${n} kiểm tra đạt`)
