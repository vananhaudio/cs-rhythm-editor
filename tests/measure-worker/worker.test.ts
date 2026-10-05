// Worker production (5C): Supabase GIẢ (ghi lại mọi lời gọi), analyzer thật trên sheet tổng hợp, Python giả cho timeout/crash.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createWorker, VERSION } from '../../services/measure-analyzer/server.ts'
import type { WorkerConfig } from '../../services/measure-analyzer/server.ts'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const ANALYZER = join(ROOT, 'tools/measure-analyzer/measure_analyzer.py')
const work = mkdtempSync(join(tmpdir(), 'measure-worker-test-'))
after(() => rmSync(work, { recursive: true, force: true }))

const ADMIN = 'admin-token-aaaaaaaaaaaaaaaaaaaa'
const STUDENT = 'student-token-bbbbbbbbbbbbbbbbbbbb'
const EXPIRED = 'expired-token-cccccccccccccccccccc'
const UID_ADMIN = 'aaaaaaaa-0000-4000-8000-00000000000a'
const UID_STUDENT = 'bbbbbbbb-0000-4000-8000-00000000000b'
const V_OK = '11111111-1111-4111-8111-111111111111'
const V_NOSRC = '22222222-2222-4222-8222-222222222222'
const V_EVIL = '33333333-3333-4333-8333-333333333333'
const V_MANY = '44444444-4444-4444-8444-444444444444'
const V_MISSING = '55555555-5555-4555-8555-555555555555'
const SRC = `${UID_ADMIN}/${V_OK}/0.png`
const TEXT = '1. Một [C] hai ba bốn năm\nĐK: [G] sáu bảy tám [Am] chín'

// sheet tổng hợp (đáp án biết trước): lấy đà + 5 ô, ô 5 là ô ngân
const png = join(work, 'sheet.png')
execFileSync('python3', [join(ROOT, 'tools/measure-analyzer/synth.py')], {
  input: JSON.stringify({ out: png, systems: [{ items: ['w', '|', 'w', 'w', '|', 'w', 's', 'w'] }, { items: ['w', 'w', '|', '|', 'w', 'w'] }] }),
})
const SHEET = readFileSync(png)

type Call = { method: string; path: string; token: string | null; body: string }
const calls: Call[] = []
let storageBytes: Buffer = SHEET
const fake = createServer((req, res) => {
  let body = ''
  req.on('data', chunk => { body += chunk })
  req.on('end', () => {
    const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1] ?? null
    calls.push({ method: req.method!, path: req.url!, token, body })
    const json = (status: number, data: unknown) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)) }
    if (req.headers.apikey !== 'anon-key') return json(401, { message: 'no apikey' })
    const uid = token === ADMIN ? UID_ADMIN : token === STUDENT ? UID_STUDENT : null
    if (req.url === '/auth/v1/user') return uid ? json(200, { id: uid, email: 'x' }) : json(401, { msg: 'invalid JWT' })
    if (!uid) return json(401, { message: 'JWT expired' })
    if (req.url === '/rest/v1/rpc/my_chordlib_caps') return json(200, { role: uid === UID_ADMIN ? 'admin' : 'student', caps: { search: true, contribute: true, review: uid === UID_ADMIN } })
    if (req.url === '/rest/v1/rpc/chord_sheet_get') {
      const id = JSON.parse(body).p_version_id
      const base = { version_id: id, text: TEXT, meter: { beats: 4, beatType: 4 } }
      if (id === V_OK) return json(200, { ...base, sources: [{ path: SRC, mime: 'image/png', sha256: 'x', size_bytes: SHEET.length, page: 1 }] })
      if (id === V_NOSRC) return json(200, { ...base, sources: [] })
      if (id === V_EVIL) return json(200, { ...base, sources: [{ path: '../../etc/passwd', mime: 'image/png' }] })
      if (id === V_MANY) return json(200, { ...base, sources: Array.from({ length: 11 }, (_, i) => ({ path: `${UID_ADMIN}/${V_MANY}/${i % 10}.png`, mime: 'image/png' })) })
      if (id === V_MISSING) return json(200, { ...base, sources: [{ path: `${UID_ADMIN}/${V_MISSING}/0.png`, mime: 'image/png' }] })
      return json(400, { code: 'P0002', message: 'CHORDLIB_NOT_FOUND' })
    }
    if (req.url!.startsWith('/storage/v1/object/authenticated/chord-sheet-sources/')) {
      if (uid !== UID_ADMIN) return json(403, { message: 'denied' })
      if (req.url!.endsWith(`/${V_MISSING}/0.png`)) return json(404, { message: 'not found' })
      res.writeHead(200, { 'content-type': 'image/png' }); return res.end(storageBytes)
    }
    json(404, { message: 'unknown' })
  })
})
await new Promise<void>(resolve => fake.listen(0, '127.0.0.1', resolve))
after(() => fake.close())
const SUPABASE = `http://127.0.0.1:${(fake.address() as AddressInfo).port}`

function stubPython(name: string, script: string) {
  const path = join(work, `${name}.py`)
  writeFileSync(path, script)
  return path
}
const SLEEP = stubPython('sleep', 'import time, sys\nsys.stdin.read()\ntime.sleep(5)\nprint("{}")\n')
const BADPDF = stubPython('badpdf', 'import sys, json\nsys.stdin.read()\nprint(json.dumps({"ok": False, "error": {"code": "bad_pdf", "message": "Không đọc được /Users/x/secret.pdf"}}))\n')
const TOOBIG = stubPython('toobig', 'import sys, json\nsys.stdin.read()\nprint(json.dumps({"ok": False, "error": {"code": "too_large", "message": "x"}}))\n')
const CRASH = stubPython('crash', 'import sys\nsys.stdin.read()\nraise SystemExit("Traceback (most recent call last): File /Users/x/a.py")\n')

async function start(overrides: Partial<WorkerConfig> = {}) {
  const temp = mkdtempSync(join(work, 'tmp-'))
  const logDir = mkdtempSync(join(work, 'log-'))
  const server = createWorker({
    supabaseUrl: SUPABASE, anonKey: 'anon-key', python: 'python3', analyzer: ANALYZER,
    allowedOrigins: ['https://class.vananhaudio.com'], logDir, tempRoot: temp, ...overrides,
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return { base, temp, logDir, close: () => new Promise<void>(resolve => server.close(() => resolve())) }
}
const post = (base: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${base}/analyze-measures`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) })
const auth = (token: string) => ({ authorization: `Bearer ${token}` })
async function expectError(reply: Response, status: number, code: string) {
  const text = await reply.text()
  assert.equal(reply.status, status, text)
  const data = JSON.parse(text) as { ok: boolean; error: { code: string } }
  assert.deepEqual([data.ok, data.error.code], [false, code])
  assert.doesNotMatch(text, /\/Users|Traceback|token-|stack|\.py\b|anon-key/, 'không lộ đường dẫn/stack/token')
}

test('health: ok + phiên bản + python + poppler; không lộ đường dẫn/biến môi trường', async () => {
  const w = await start()
  try {
    const reply = await fetch(`${w.base}/health`)
    const data = await reply.json() as Record<string, string>
    assert.equal(reply.status, 200)
    assert.deepEqual(Object.keys(data).sort(), ['ok', 'poppler', 'python', 'version'])
    assert.equal(data.version, VERSION)
    assert.match(data.python, /^Python 3\./)
    assert.match(data.poppler, /pdftoppm version/)
    assert.doesNotMatch(JSON.stringify(data), /\/Users|\/opt|anon-key/)
  } finally { await w.close() }
})

test('CORS: chỉ origin production được cấp; OPTIONS đúng; origin lạ → không CORS + 403', async () => {
  const w = await start()
  try {
    const ok = await fetch(`${w.base}/analyze-measures`, { method: 'OPTIONS', headers: { origin: 'https://class.vananhaudio.com', 'access-control-request-method': 'POST' } })
    assert.equal(ok.status, 204)
    assert.equal(ok.headers.get('access-control-allow-origin'), 'https://class.vananhaudio.com')
    assert.match(ok.headers.get('access-control-allow-headers') ?? '', /authorization/)
    const evil = await fetch(`${w.base}/analyze-measures`, { method: 'OPTIONS', headers: { origin: 'https://evil.example' } })
    assert.equal(evil.status, 403)
    assert.equal(evil.headers.get('access-control-allow-origin'), null)
    const evilPost = await post(w.base, { versionId: V_OK }, { origin: 'https://evil.example', ...auth(ADMIN) })
    assert.equal(evilPost.headers.get('access-control-allow-origin'), null)
    await expectError(evilPost, 403, 'origin')
    assert.equal((await fetch(`${w.base}/health`, { headers: { origin: 'http://localhost:5173' } })).headers.get('access-control-allow-origin'), null, 'localhost không được cấp ở production')
  } finally { await w.close() }
})

test('xác thực: không token / Bearer hỏng / JWT hết hạn → 401; học viên (không review) → 403 và KHÔNG đọc phiên bản', async () => {
  const w = await start()
  try {
    await expectError(await post(w.base, { versionId: V_OK }), 401, 'unauthorized')
    await expectError(await post(w.base, { versionId: V_OK }, { authorization: 'Bearer' }), 401, 'unauthorized')
    await expectError(await post(w.base, { versionId: V_OK }, { authorization: 'Basic abc' }), 401, 'unauthorized')
    await expectError(await post(w.base, { versionId: V_OK }, auth(EXPIRED)), 401, 'unauthorized')
    calls.length = 0
    await expectError(await post(w.base, { versionId: V_OK }, auth(STUDENT)), 403, 'forbidden')
    assert.deepEqual(calls.map(c => c.path), ['/auth/v1/user', '/rest/v1/rpc/my_chordlib_caps'], 'không gọi chord_sheet_get / Storage khi không có quyền')
  } finally { await w.close() }
})

test('đầu vào: chỉ { versionId } UUID — sai dạng / thừa khoá (path, text, uid, role) / quá lớn → 4xx', async () => {
  const w = await start()
  try {
    await expectError(await post(w.base, { versionId: 'abc' }, auth(ADMIN)), 400, 'bad_request')
    await expectError(await post(w.base, '{nope', auth(ADMIN)), 400, 'bad_request')
    for (const extra of [{ path: SRC }, { text: 'lời giả' }, { uid: UID_ADMIN }, { role: 'admin' }, { caps: { review: true } }]) {
      await expectError(await post(w.base, { versionId: V_OK, ...extra }, auth(ADMIN)), 400, 'bad_request')
    }
    await expectError(await post(w.base, JSON.stringify({ versionId: V_OK, pad: 'x'.repeat(8000) }), auth(ADMIN)), 413, 'too_large')
  } finally { await w.close() }
})

test('phân tích THẬT: nguồn + lời CHỈ từ DB, tải bằng token của người gọi, đúng đáp án, không ghi DB, dọn thư mục tạm, log sạch', async () => {
  const w = await start()
  try {
    calls.length = 0
    const reply = await post(w.base, { versionId: V_OK }, { ...auth(ADMIN), origin: 'https://class.vananhaudio.com' })
    const text = await reply.text()
    assert.equal(reply.status, 200, text)
    assert.equal(reply.headers.get('access-control-allow-origin'), 'https://class.vananhaudio.com')
    const data = JSON.parse(text)
    assert.deepEqual(data.anchors, { pickup: { line: 0, token: 0 }, measures: [{ line: 0, token: 1 }, { line: 0, token: 3 }, { line: 1, token: 0 }, { line: 1, token: 2 }, { line: 1, token: 2 }] })
    assert.deepEqual(Object.keys(data.anchors.measures[0]), ['line', 'token'])
    assert.equal(data.diagnostics.generator, 'measure-analyzer/0.2.0')
    assert.deepEqual(data.review.measures, [5])
    // chỉ ĐỌC: Auth, 2 RPC đọc, 1 file Storage — mọi lời gọi bằng token của người gọi; không RPC ghi nào
    assert.deepEqual(calls.map(c => `${c.method} ${c.path}`), [
      'GET /auth/v1/user', 'POST /rest/v1/rpc/my_chordlib_caps', 'POST /rest/v1/rpc/chord_sheet_get',
      `GET /storage/v1/object/authenticated/chord-sheet-sources/${SRC}`,
    ])
    assert.ok(calls.every(c => c.token === ADMIN))
    assert.ok(!calls.some(c => /accept_anchors|approve|contribute|update|insert/.test(c.path)))
    assert.deepEqual(readdirSync(w.temp), [], 'thư mục tạm đã dọn')
    await new Promise(resolve => setTimeout(resolve, 50))
    const log = readFileSync(join(w.logDir, 'requests.log'), 'utf8')
    const line = JSON.parse(log.trim().split('\n').pop()!)
    for (const key of ['requestId', 'versionId', 'uidHash', 'durationMs', 'sourceCount', 'pageCount', 'systemsFound', 'barlinesFound', 'high', 'medium', 'low', 'reordered', 'status', 'generatorVersion']) {
      assert.ok(key in line, `log có ${key}`)
    }
    assert.doesNotMatch(log, new RegExp(`${ADMIN}|${UID_ADMIN}|Một|chín|${SRC.replace(/\//g, '\\/')}|storage`), 'log không có token, uid đầy đủ, lời, đường dẫn nguồn')
  } finally { await w.close() }
})

test('đường dẫn nguồn KHÔNG được tin: khuôn lạ (../) → 422; quá 10 nguồn → 413; thiếu nguồn → 404; phiên bản không có → 404', async () => {
  const w = await start()
  try {
    calls.length = 0
    await expectError(await post(w.base, { versionId: V_EVIL }, auth(ADMIN)), 422, 'unsupported')
    assert.ok(!calls.some(c => c.path.startsWith('/storage')), 'không gọi Storage với đường dẫn lạ')
    await expectError(await post(w.base, { versionId: V_MANY }, auth(ADMIN)), 413, 'too_large')
    await expectError(await post(w.base, { versionId: V_NOSRC }, auth(ADMIN)), 404, 'source_missing')
    await expectError(await post(w.base, { versionId: V_MISSING }, auth(ADMIN)), 404, 'source_missing')
    await expectError(await post(w.base, { versionId: '99999999-9999-4999-8999-999999999999' }, auth(ADMIN)), 404, 'not_found')
    assert.deepEqual(readdirSync(w.temp), [])
  } finally { await w.close() }
})

test('file nguồn quá lớn khi tải → 413, dọn tạm', async () => {
  const w = await start({ limits: { maxFileBytes: 1000 } })
  try {
    await expectError(await post(w.base, { versionId: V_OK }, auth(ADMIN)), 413, 'too_large')
    assert.deepEqual(readdirSync(w.temp), [])
  } finally { await w.close() }
})

test('ánh xạ lỗi analyzer: bad_pdf → 422, too_large → 413, crash → 422 analysis_failed — không lộ đường dẫn/stack', async () => {
  for (const [python, status, code] of [[BADPDF, 422, 'bad_pdf'], [TOOBIG, 413, 'too_large'], [CRASH, 422, 'analysis_failed']] as const) {
    const w = await start({ python: 'python3', analyzer: python })
    try {
      await expectError(await post(w.base, { versionId: V_OK }, auth(ADMIN)), status, code)
      assert.deepEqual(readdirSync(w.temp), [])
    } finally { await w.close() }
  }
})

test('quá 30 s (ở đây 400 ms) → 504 timeout, Python bị giết, tạm được dọn, server vẫn sống', async () => {
  const w = await start({ analyzer: SLEEP, limits: { requestTimeoutMs: 400 } })
  try {
    const t = Date.now()
    await expectError(await post(w.base, { versionId: V_OK }, auth(ADMIN)), 504, 'timeout')
    assert.ok(Date.now() - t < 3000, 'không chờ hết 5 s của Python')
    assert.deepEqual(readdirSync(w.temp), [])
    assert.equal((await fetch(`${w.base}/health`)).status, 200)
  } finally { await w.close() }
})

test('đồng thời: tối đa N đang chạy + hàng chờ M; quá → 429 busy', async () => {
  const w = await start({ analyzer: SLEEP, limits: { maxConcurrent: 1, maxQueue: 1, requestTimeoutMs: 1500, perMinute: 50 } })
  try {
    const replies = await Promise.all([0, 1, 2].map(i => new Promise(resolve => setTimeout(resolve, i * 80)).then(() => post(w.base, { versionId: V_OK }, auth(ADMIN)))))
    const codes = await Promise.all(replies.map(async r => [r.status, (await r.json() as { error?: { code: string } }).error?.code]))
    assert.ok(codes.some(([s, c]) => s === 429 && c === 'busy'), JSON.stringify(codes))
  } finally { await w.close() }
})

test('giới hạn theo NGƯỜI DÙNG (không theo IP): quá N/phút → 429 rate_limited; người khác không bị ảnh hưởng', async () => {
  const w = await start({ limits: { perMinute: 2 } })
  try {
    assert.equal((await post(w.base, { versionId: V_OK }, auth(ADMIN))).status, 200)
    assert.equal((await post(w.base, { versionId: V_OK }, auth(ADMIN))).status, 200)
    await expectError(await post(w.base, { versionId: V_OK }, auth(ADMIN)), 429, 'rate_limited')
    await expectError(await post(w.base, { versionId: V_OK }, auth(STUDENT)), 403, 'forbidden')
  } finally { await w.close() }
})

test('upstream sập → 502 upstream (không treo, không lộ chi tiết)', async () => {
  const w = await start({ supabaseUrl: 'http://127.0.0.1:9' })
  try { await expectError(await post(w.base, { versionId: V_OK }, auth(ADMIN)), 502, 'upstream') } finally { await w.close() }
})

test('đường không có → 404; GET /analyze-measures → 404', async () => {
  const w = await start()
  try {
    await expectError(await fetch(`${w.base}/nope`), 404, 'not_found')
    await expectError(await fetch(`${w.base}/analyze-measures`), 404, 'not_found')
  } finally { await w.close() }
  storageBytes = SHEET
})
