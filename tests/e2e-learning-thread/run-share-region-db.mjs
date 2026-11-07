// Contextual Share V3 — vòng đời migration + test DB trên cụm PG tạm của scripts/e2e-share-note.sh (E2E_SHARE_REGION=1). KHÔNG production.
// Trình tự: dữ liệu V1/V2 trước → áp V2 → áp V3 dự thảo (+ áp lại idempotent) → test SQL → rollback V3 (V1/V2 nguyên vẹn, hàng region biến mất) → áp lại → để DB ĐÃ migrate cho kịch bản trình duyệt.
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname)
const { E2E_PG_BIN, E2E_PG_SOCK, E2E_PG_PORT } = process.env
const A = 'aaaaaaaa-0000-4000-8000-00000000000a'
const S1 = '51000000-0000-4000-8000-000000000001'
let fails = 0
const ok = (c, m) => { if (c) console.log('PASS: ' + m); else { fails++; console.log('FAIL: ' + m) } }
function psql(args) {
  const r = spawnSync(`${E2E_PG_BIN}/psql`, ['-X', '-q', '-tA', '-h', E2E_PG_SOCK, '-p', E2E_PG_PORT, '-U', 'postgres', '-d', 'e2e', '-v', 'ON_ERROR_STOP=1', ...args],
    { encoding: 'utf8', env: { ...process.env, PGOPTIONS: '-c client_min_messages=notice' } })
  return { code: r.status, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() }
}
const q = sql => { const r = psql(['-c', sql]); if (r.code !== 0) throw new Error(sql.slice(0, 80) + ' → ' + r.err); return r.out }
const asUser = (u, sql) => q(`begin; select set_config('request.jwt.claims', json_build_object('sub','${u}','role','authenticated')::text, true); set local role authenticated; ${sql}; commit;`)
const file = f => path.join(ROOT, f)
const fnMd5 = () => q(`select string_agg(p.proname || '=' || left(md5(p.prosrc), 8), ',' order by p.proname collate "C") from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname ~ '^(share_note_|share_text_|social_share_share_note|social_share_share_text|dm_share$)'`)

console.log('── Vòng đời migration Contextual Share V3 (preflight → setup → postflight → rollback)')
for (const f of ['db/share_region_v3_setup.sql', 'db/share_region_v3_rollback.sql', 'db/share_region_v3_preflight.sql', 'db/share_region_v3_postflight.sql']) {
  const t = (await import('node:fs')).readFileSync(file(f), 'utf8')
  ok(!/^\s*(begin|commit|rollback)\s*;/im.test(t), `${f}: không có begin/commit (prod-db.py bọc transaction)`)
}
let r = psql(['-1', '-f', file('db/share_text_v2_setup.sql')]); ok(r.code === 0, 'nền: áp V2' + (r.code ? ' — ' + r.err : ''))
if (r.code) process.exit(1)
// dữ liệu V1 + V2 TRƯỚC khi áp V3
q(`update public.share_notes set created_at = created_at - interval '1 hour'`)
const sx = q(`select (e.i - 1) from public.class_lesson_content cc cross join lateral jsonb_array_elements(cc.blocks) with ordinality e(v, i) where cc.session_id = '${S1}' and e.v ->> 'kind' = 'score' limit 1`)
const ix = q(`select (e.i - 1) from public.class_lesson_content cc cross join lateral jsonb_array_elements(cc.blocks) with ordinality e(v, i) where cc.session_id = '${S1}' and e.v ->> 'title' = 'Ôn tập 7 ngày'`)
const idBars = asUser(A, `select public.share_note_create('${S1}', ${sx}, array['tex'], 2, 3, 'Ô 2–3 trước V3', 'ck-v3-pre-0001')`).split('\n').find(l => /^[0-9a-f-]{36}$/.test(l))
const idText = asUser(A, `select public.share_text_create('${S1}', ${ix}, array['blocks','1','text'], 0, 8, 'Văn bản trước V3', 'ck-v3-pre-0002')`).split('\n').find(l => /^[0-9a-f-]{36}$/.test(l))
const fp = () => q(`select left(md5(coalesce(string_agg(id::text || ':' || anchor_kind || ':' || coalesce(array_to_string(score_path,'.'),'') || ':' || coalesce(tex_sha,'') || ':' || coalesce(bar_from::text,'') || coalesce(text_sha,'') || coalesce(char_from::text,''), ',' order by id), '')), 12) from public.share_notes where anchor_kind in ('bars','text')`)
const fn0 = fnMd5(), fp0 = fp()
ok(q(`select count(*) from public.share_notes`) === '2', 'nền: 1 ghi chú ô nhịp (V1) + 1 ghi chú văn bản (V2)')

const gate = f => psql(['-f', file(f)]).out.split('\n').find(l => l.startsWith('GATE|'))
ok(gate('db/share_region_v3_preflight.sql') === 'GATE|PASS', 'preflight V3: GATE PASS trên nền V2 (md5 24 hàm V1/V2 khớp production)')
r = psql(['-1', '-f', file('db/share_region_v3_setup.sql')]); ok(r.code === 0, 'V3 setup chạy trong MỘT transaction' + (r.code ? ' — ' + r.err : ''))
if (r.code) process.exit(1)
ok(fnMd5() === fn0, 'MỌI hàm V1/V2 giữ nguyên md5 sau V3')
ok(gate('db/share_region_v3_postflight.sql') === 'GATE|PASS', 'postflight V3: GATE PASS (hàm V1/V2 nguyên, 3 hàm công khai chỉ authenticated, hàm nội bộ không ai gọi)')
ok(gate('db/share_region_v3_preflight.sql') === 'GATE|FAIL', 'preflight V3 trên DB ĐÃ có V3 → FAIL (chặn chạy lại nhầm)')
ok(fp() === fp0, 'ghi chú V1 + V2 nguyên vẹn sau V3')
r = psql(['-1', '-f', file('db/share_region_v3_setup.sql')]); ok(r.code === 0, 'V3 setup áp LẠI (idempotent) không lỗi')
const openOld = id => asUser(A, `select status || '|' || kind from public.share_note_open_v2('${id}')`).split('\n').find(l => /\|/.test(l))
ok(openOld(idBars) === 'ok|bars' && openOld(idText) === 'ok|text', 'V1 + V2 vẫn mở được qua share_note_open_v2 sau V3')

r = psql(['-f', file('db/tests/share_region_v3_test.sql')])
const lines = (r.err + '\n' + r.out).split('\n').map(l => l.replace(/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):\s*/, '').trim()).filter(Boolean)
for (const l of lines) if (/^(PASS|FAIL|PERF)/.test(l) || /ALL_SHARE_REGION/.test(l)) console.log('   ' + l)
const nPass = lines.filter(l => l.startsWith('PASS:')).length, nFail = lines.filter(l => /^FAIL|ERROR/.test(l)).length
ok(r.code === 0 && nFail === 0 && lines.some(l => l.includes('ALL_SHARE_REGION_DB_TESTS_DONE')), `test SQL: ${nPass} PASS, ${nFail} FAIL` + (r.code ? ' — ' + r.err.split('\n').slice(-8).join(' | ') : ''))

// rollback V3: tạo 1 vùng + bài Feed rồi gỡ
const sc = q(`select (e.i - 1) from public.class_lesson_content cc cross join lateral jsonb_array_elements(cc.blocks) with ordinality e(v, i) where cc.session_id = '${S1}' and e.v ->> 'kind' = 'fretboard'`)
const rid = asUser(A, `select public.share_region_create('${S1}', '[{"sec":${sc},"box":[0,0,1000,1000],"leaves":[],"scores":[]}]'::jsonb, 'trước rollback', 'ck-v3-rb-00001')`).split('\n').find(l => /^[0-9a-f-]{36}$/.test(l))
asUser(A, `select public.social_share_share_region('${rid}')`)
ok(q(`select count(*) from public.share_notes where anchor_kind = 'region'`) === '1' && q(`select count(*) from public.class_posts where tool_share ->> 'anchor' = 'region'`) === '1', 'trước rollback: có 1 vùng + 1 bài Feed')
r = psql(['-1', '-f', file('db/share_region_v3_rollback.sql')]); ok(r.code === 0, 'rollback V3 chạy trong MỘT transaction' + (r.code ? ' — ' + r.err : ''))
ok(q(`select count(*) from public.share_notes where anchor_kind = 'region'`) === '0' && q(`select count(*) from public.class_posts where tool_share ->> 'anchor' = 'region'`) === '0', 'rollback: hàng vùng + bài Feed vùng biến mất')
ok(fp() === fp0 && openOld(idBars) === 'ok|bars' && openOld(idText) === 'ok|text', 'rollback V3: ghi chú V1 + V2 nguyên vẹn, vẫn mở được')
ok(q(`select count(*) from information_schema.columns where table_schema='public' and table_name='share_notes' and column_name='region'`) === '0', 'rollback: cột region đã gỡ')
r = psql(['-1', '-f', file('db/share_region_v3_rollback.sql')]); ok(r.code === 0, 'rollback áp LẠI (idempotent) không lỗi')
r = psql(['-1', '-f', file('db/share_region_v3_setup.sql')]); ok(r.code === 0, 'áp lại V3 sau rollback')
q(`update public.share_notes set created_at = created_at - interval '1 hour'`)
console.log(fails ? `FAIL: ${fails}` : 'ALL_SHARE_REGION_DB_OK')
process.exit(fails ? 1 : 0)
