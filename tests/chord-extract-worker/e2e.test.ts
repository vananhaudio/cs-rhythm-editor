// END-TO-END Slice 2A: worker THẬT (services/measure-analyzer) + engine Python THẬT + SQL THẬT (migration V1.3) trên cluster PostgreSQL tạm,
// qua "Supabase" cục bộ (bridge.ts). Chạy bởi scripts/test-chord-extraction-db.sh (đặt CHORD_PSQL/CHORD_PGHOST/CHORD_PGPORT/CHORD_PGDATABASE).
// Không có biến môi trường → bỏ qua. Corpus bản nhạc thật ở NGOÀI repo (CHORD_EXTRACT_CORPUS); thiếu thì các ca scan bị bỏ qua có lý do.
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, chmodSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createWorker } from '../../services/measure-analyzer/server.ts'
import type { WorkerConfig } from '../../services/measure-analyzer/server.ts'
import { callRpc, sql, startBridge, targetFromEnv } from './bridge.ts'

const target = targetFromEnv()
const skip = !target && 'không có cluster tạm'
const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const PKG = join(ROOT, 'tools/chord-extract')
const WIP = join(homedir(), 'Documents/VAA-Work-In-Progress/chord-library-pdf-extract')
const CORPUS = process.env.CHORD_EXTRACT_CORPUS ?? join(WIP, 'corpus')
const TESSDATA = process.env.CHORD_EXTRACT_TESSDATA ?? join(WIP, 'tessdata')
const PYTHON = process.env.CHORD_E2E_PYTHON ?? 'python3'
const VALIDATOR_PYTHON = process.env.CHORD_VALIDATOR_PYTHON
const T = 'dddddddd-0000-4000-8000-00000000000d'
const X = 'ffffffff-0000-4000-8000-00000000000f'
const A = 'aaaaaaaa-0000-4000-8000-00000000000a'
const TOK_T = 'teacher-token-aaaaaaaaaaaaaaaaaaaa'
const TOK_A = 'student-token-bbbbbbbbbbbbbbbbbbbb'
const TOK_BAD = 'expired-token-cccccccccccccccccccc'
const TOK_X = 'admin-token-ddddddddddddddddddddd'
const work = mkdtempSync(join(tmpdir(), 'extract-e2e-'))
const files = join(work, 'files'); mkdirSync(files)
after(() => rmSync(work, { recursive: true, force: true }))
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex')

if (!target) { test('extraction e2e', { skip }, () => {}) } else {
  const db = target
  const bridge = await startBridge({ target: db, filesDir: files, anonKey: 'anon-key', tokens: { [TOK_T]: T, [TOK_A]: A, [TOK_X]: X } })
  after(() => bridge.close())

  // ── dữ liệu mẫu (PDF text tổng hợp qua chính helper của test Python) ──
  const synth = (name: string, pages: number, chords = true) => {
    const out = join(work, name)
    execFileSync(PYTHON, ['-c', `
import sys; sys.path.insert(0, ${JSON.stringify(join(ROOT, 'tests/chord-extract'))})
import support
pages = []
for p in range(${pages}):
    rows = [([(0, "Am"), (2, "Dm")] if ${chords ? 'True' : 'False'} else [], ["Chieu", "nay", "khong", "co", "em"]), ([(1, "G7")] if ${chords ? 'True' : 'False'} else [], ["Mua", "roi", "tren", "pho", "vang"])]
    pages.append(support.lyric_with_chords("Bai thu nghiem %d" % (p + 1), rows))
open(${JSON.stringify(out)}, "wb").write(support.make_text_pdf(pages))`])
    return readFileSync(out)
  }
  const TEXT_PDF = synth('text.pdf', 2)
  const BIG_PDF = synth('big.pdf', 25)
  const PNG = (() => { const out = join(work, 'scan.png'); execFileSync(PYTHON, ['-c', `from PIL import Image; Image.new("L", (1275, 1650), 255).save(${JSON.stringify(out)})`]); return readFileSync(out) })()

  type Seed = { bytes: Buffer; mime: string; declaredSha?: string; noObject?: boolean }
  async function seedVersion(seeds: Seed[], owner = T) {
    const vid = randomUUID(), sid = randomUUID()
    const sources: unknown[] = []
    for (const [i, s] of seeds.entries()) {
      const ext = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[s.mime]!
      const name = `${owner}/${vid}/${i}.${ext}`
      mkdirSync(dirname(join(files, name)), { recursive: true }); writeFileSync(join(files, name), s.bytes)
      if (!s.noObject) {
        const r = await sql(db, `insert into storage.objects (bucket_id, name, owner, metadata) values ('chord-sheet-sources', '${name}', '${owner}', '{"mimetype":"${s.mime}","size":${s.bytes.length}}'::jsonb)`)
        assert.ok(r.ok, r.err)
      }
      sources.push({ path: name, mime: s.mime, sha256: s.declaredSha ?? sha(s.bytes), page: i + 1, size_bytes: s.bytes.length })
    }
    const text = `e2e ${vid}`
    const r = await sql(db, `insert into public.chord_sheets (id, title, created_by) values ('${sid}', 'E2E ${vid.slice(0, 8)}', '${owner}');
      insert into public.chord_sheet_versions (id, sheet_id, version_number, text, text_hash, sources, contributed_by)
      values ('${vid}', '${sid}', 1, '${text}', '${sha(Buffer.from(text))}', '${JSON.stringify(sources)}'::jsonb, '${owner}');`)
    assert.ok(r.ok, r.err)
    return vid
  }

  const logDir = mkdtempSync(join(work, 'log-'))
  type Start = { extract?: Partial<NonNullable<WorkerConfig['extract']>>; python?: string; limits?: Record<string, number>; logDir?: string }
  async function startWorker(o: Start = {}) {
    const server = createWorker({
      supabaseUrl: bridge.url, anonKey: 'anon-key', python: PYTHON, analyzer: join(ROOT, 'tools/measure-analyzer/measure_analyzer.py'),
      allowedOrigins: ['https://class.vananhaudio.com'], logDir: o.logDir ?? logDir,
      extract: { python: o.python ?? PYTHON, packageDir: PKG, tessdataDir: TESSDATA, tempRoot: work, limits: o.limits, ...o.extract },
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    return {
      base, close: () => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections?.() }),
      post: async (body: unknown, token: string | null = TOK_T, headers: Record<string, string> = {}, route = '/extract-content') => {
        const res = await fetch(`${base}${route}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: JSON.stringify(body) })
        return { status: res.status, body: await res.json() as Record<string, any> }
      },
    }
  }
  const worker = await startWorker({ limits: { perMinute: 10_000, perDay: 100_000 } })
  after(() => worker.close())

  const get = async (id: string) => { const r = await callRpc(db, T, 'chord_extraction_get', { p_id: id }); assert.ok(r.ok, r.err); return JSON.parse(r.out) as Record<string, any> }
  async function done(id: string, ms = 120_000) {
    const end = Date.now() + ms
    for (;;) {
      const row = await get(id)
      if (row.status !== 'running') return row
      assert.ok(Date.now() < end, 'extraction chạy quá lâu')
      await new Promise(r => setTimeout(r, 300))
    }
  }
  const rows = async (versionId: string) => Number((await sql(db, `select count(*) from public.chord_sheet_extractions where version_id = '${versionId}'`)).out)
  const validate = (doc: unknown) => {
    if (!VALIDATOR_PYTHON) return null
    const f = join(work, `doc-${randomUUID()}.json`); writeFileSync(f, JSON.stringify(doc))
    return execFileSync(VALIDATOR_PYTHON, ['-c', `import sys, json; sys.path.insert(0, ${JSON.stringify(PKG)}); from chord_extract.contract import validation_errors; e = validation_errors(json.load(open(${JSON.stringify(f)}))); print(len(e)); [print(x.message[:120]) for x in e[:3]]`]).toString().trim()
  }

  test('Text PDF có hợp âm: nguồn → worker → text layer → lưu → đọc lại; hợp lệ chord-extraction/1', { skip }, async () => {
    const vid = await seedVersion([{ bytes: TEXT_PDF, mime: 'application/pdf' }])
    const r = await worker.post({ versionId: vid, sourceIndex: 0 })
    assert.equal(r.status, 202); assert.equal(r.body.status, 'running'); assert.equal(r.body.duplicate, false)
    const row = await done(r.body.extraction_id ?? r.body.extractionId)
    assert.equal(row.status, 'succeeded', JSON.stringify(row))
    const doc = row.document
    assert.equal(doc.extractionId, row.extraction_id, 'danh tính tài liệu = id hàng DB')
    assert.deepEqual(doc.pages.map((p: any) => [p.index, p.kind, p.method]), [[1, 'text', 'text_layer'], [2, 'text', 'text_layer']])
    assert.equal(doc.input.sha256, sha(TEXT_PDF)); assert.equal(doc.input.pageCount, 2)
    assert.equal(doc.interpretation.chords.status, 'DETECTED')
    assert.ok(doc.pages.every((p: any) => p.links.length >= 2), 'giữ liên kết hợp âm → chữ')
    assert.equal(doc.pipeline.vision.status, 'not_needed'); assert.deepEqual(doc.pipeline.fallbackReasons, [])
    assert.equal(row.vision_status, 'not_needed'); assert.equal(row.source_index, 0)
    assert.ok(!doc.pipeline.stages.some((s: any) => s.engine === 'tesseract'), 'không OCR trang text')
    const v = validate(doc)
    if (v !== null) assert.equal(v.split('\n')[0], '0', `không hợp lệ chord-extraction/1: ${v}`)
  })

  test('IDEMPOTENT: double-click + retry không sinh hàng trùng; force = lần chạy mới có rerun_of', { skip }, async () => {
    const vid = await seedVersion([{ bytes: TEXT_PDF, mime: 'application/pdf' }])
    const [a, b] = await Promise.all([worker.post({ versionId: vid, sourceIndex: 0 }), worker.post({ versionId: vid, sourceIndex: 0 })])
    const ids = new Set([a.body.extractionId, b.body.extractionId])
    assert.equal(ids.size, 1, 'hai request đồng thời → CÙNG một lần chạy')
    assert.deepEqual([a.status, b.status].sort(), [200, 202])
    assert.equal(await rows(vid), 1)
    const id = a.body.extractionId
    assert.equal((await done(id)).status, 'succeeded')
    const again = await worker.post({ versionId: vid, sourceIndex: 0 })
    assert.deepEqual([again.status, again.body.duplicate, again.body.status, again.body.extractionId], [200, true, 'succeeded', id])
    assert.equal(await rows(vid), 1, 'retry sau thành công: vẫn 1 hàng')
    const forced = await worker.post({ versionId: vid, sourceIndex: 0, force: true })
    assert.equal(forced.status, 202); assert.notEqual(forced.body.extractionId, id)
    assert.equal((await done(forced.body.extractionId)).status, 'succeeded')
    assert.equal((await sql(db, `select rerun_of from public.chord_sheet_extractions where id = '${forced.body.extractionId}'`)).out, id)
    const old = await get(id)
    assert.equal(old.status, 'succeeded', 'lần cũ giữ nguyên (immutable run)')
    assert.equal(await rows(vid), 2)
  })

  test('Tình ca (scan thật): nguồn → worker → OCR vie → hợp lệ → lưu → đọc lại', { skip: skip || (!existsSync(join(CORPUS, 'tinh-ca.pdf')) && `thiếu corpus ${CORPUS}`) || (!existsSync(join(TESSDATA, 'vie.traineddata')) && 'thiếu gói OCR vie') }, async () => {
    const pdf = readFileSync(join(CORPUS, 'tinh-ca.pdf'))
    const vid = await seedVersion([{ bytes: pdf, mime: 'application/pdf' }])
    const r = await worker.post({ versionId: vid, sourceIndex: 0 })
    assert.equal(r.status, 202)
    const row = await done(r.body.extractionId)
    assert.equal(row.status, 'succeeded', JSON.stringify(row))
    const doc = row.document
    assert.deepEqual(doc.pages.map((p: any) => [p.kind, p.method]), [['scan', 'local_ocr'], ['scan', 'local_ocr']])
    assert.equal(doc.pages.reduce((n: number, p: any) => n + p.regions.filter((g: any) => g.kind === 'staff_system').length, 0), 12)
    assert.equal(doc.interpretation.chords.status, 'NO_CHORDS_DETECTED')
    assert.equal(doc.input.sha256, sha(pdf))
    assert.ok(row.fallback_reasons.includes('METADATA_MISSING'), 'lý do fallback phi chuẩn hoá khớp pipeline')
    assert.equal(row.vision_status, 'skipped_no_provider')
    assert.ok(JSON.stringify(doc).length > 30_000, 'có quan sát đủ lớn (page+bbox+confidence)')
    const v = validate(doc)
    if (v !== null) assert.equal(v.split('\n')[0], '0', `không hợp lệ chord-extraction/1: ${v}`)
    // đọc lại qua RPC list: chỉ metadata
    const list = JSON.parse((await callRpc(db, T, 'chord_extraction_list', { p_version_id: vid })).out) as Record<string, any>[]
    assert.equal(list.length, 1); assert.ok(!('observation' in list[0]) && !('document' in list[0]))
  })

  test('Phiên bản NHIỀU file: mỗi file một extraction riêng, quan hệ version → source_index → extraction rõ ràng', { skip }, async () => {
    const vid = await seedVersion([{ bytes: TEXT_PDF, mime: 'application/pdf' }, { bytes: synth('t2.pdf', 1), mime: 'application/pdf' }])
    const r0 = await worker.post({ versionId: vid, sourceIndex: 0 }), r1 = await worker.post({ versionId: vid, sourceIndex: 1 })
    assert.notEqual(r0.body.extractionId, r1.body.extractionId)
    const [d0, d1] = [await done(r0.body.extractionId), await done(r1.body.extractionId)]
    assert.deepEqual([d0.source_index, d1.source_index], [0, 1]); assert.equal(d0.source.sha256 === d1.source.sha256, false)
    assert.deepEqual([d0.page_count, d1.page_count], [2, 1])
    assert.equal(d0.version_id, vid)
  })

  // ── Thất bại ──
  const failed = async (versionId: string, code: string, body: Record<string, unknown> = {}) => {
    const r = await worker.post({ versionId, sourceIndex: 0, ...body })
    assert.equal(r.status, 202, JSON.stringify(r.body))
    const row = await done(r.body.extractionId)
    assert.deepEqual([row.status, row.error_code], ['failed', code], JSON.stringify(row))
    assert.ok(!('document' in row))
    return row
  }
  test('Thất bại: nguồn không tồn tại trong Storage → failed/source_missing', { skip }, async () => {
    await failed(await seedVersion([{ bytes: TEXT_PDF, mime: 'application/pdf', noObject: true }]), 'source_missing')
  })
  test('Thất bại: phiên bản không tồn tại → 404, KHÔNG tạo hàng', { skip }, async () => {
    const before = Number((await sql(db, 'select count(*) from public.chord_sheet_extractions')).out)
    const r = await worker.post({ versionId: randomUUID(), sourceIndex: 0 })
    assert.deepEqual([r.status, r.body.error.code], [404, 'not_found'])
    assert.equal(Number((await sql(db, 'select count(*) from public.chord_sheet_extractions')).out), before)
  })
  test('Thất bại: source_index ngoài số file → 422, không hàng', { skip }, async () => {
    const vid = await seedVersion([{ bytes: TEXT_PDF, mime: 'application/pdf' }])
    const r = await worker.post({ versionId: vid, sourceIndex: 3 })
    assert.deepEqual([r.status, r.body.error.code], [422, 'invalid']); assert.equal(await rows(vid), 0)
  })
  test('Thất bại: caller không có quyền review → 403 TRƯỚC khi tạo hàng/tải file; token hỏng → 401', { skip }, async () => {
    const vid = await seedVersion([{ bytes: TEXT_PDF, mime: 'application/pdf' }])
    const gets = bridge.faults.storageGets
    const student = await worker.post({ versionId: vid, sourceIndex: 0 }, TOK_A)
    assert.deepEqual([student.status, student.body.error.code], [403, 'forbidden'])
    assert.deepEqual([(await worker.post({ versionId: vid, sourceIndex: 0 }, TOK_BAD)).status, (await worker.post({ versionId: vid, sourceIndex: 0 }, null)).status], [401, 401])
    assert.equal(await rows(vid), 0); assert.equal(bridge.faults.storageGets, gets)
  })
  test('Thất bại: browser KHÔNG chỉ định được URL/đường dẫn/khoá Vision/khoá lạ → 400, không hàng', { skip }, async () => {
    const vid = await seedVersion([{ bytes: TEXT_PDF, mime: 'application/pdf' }])
    for (const extra of [{ url: 'http://169.254.169.254/' }, { path: '/etc/passwd' }, { sourcePath: 'x/y/0.pdf' }, { apiKey: 'sk-x' }, { visionModel: 'x' }, { filename: 'a.pdf' }]) {
      const r = await worker.post({ versionId: vid, sourceIndex: 0, ...extra })
      assert.deepEqual([r.status, r.body.error.code], [400, 'bad_request'], JSON.stringify(extra))
    }
    for (const bad of [{ versionId: 'abc', sourceIndex: 0 }, { versionId: vid, sourceIndex: '0' }, { versionId: vid, sourceIndex: -1 }, { versionId: vid, sourceIndex: 0, force: 'yes' }]) {
      assert.equal((await worker.post(bad)).status, 400)
    }
    assert.equal(await rows(vid), 0); assert.equal((await worker.post({ versionId: vid, sourceIndex: 0 }, TOK_T, { origin: 'https://evil.example' })).status, 403)
  })
  test('Thất bại: MIME không hợp lệ (khai PDF, byte là PNG) → failed/unsupported_mime', { skip }, async () => {
    await failed(await seedVersion([{ bytes: PNG, mime: 'application/pdf' }]), 'unsupported_mime')
  })
  test('Thất bại: sha256 byte tải về ≠ sha256 khai → failed/sha_mismatch', { skip }, async () => {
    await failed(await seedVersion([{ bytes: TEXT_PDF, mime: 'application/pdf', declaredSha: sha(Buffer.from('khac')) }]), 'sha_mismatch')
  })
  test('Thất bại: PDF quá nhiều trang → failed/too_large (engine từ chối, không treo)', { skip }, async () => {
    await failed(await seedVersion([{ bytes: BIG_PDF, mime: 'application/pdf' }]), 'too_large')
  })
  test('Thất bại: file rác có đuôi/magic PDF → failed/bad_file (không lộ stack trace)', { skip }, async () => {
    const row = await failed(await seedVersion([{ bytes: Buffer.from('%PDF-1.4\nrác không phải PDF thật\n'), mime: 'application/pdf' }]), 'bad_file')
    assert.ok(!JSON.stringify(row).includes('Traceback'))
  })
  test('Thất bại: thiếu OCR (gói vie) → failed/ocr_unavailable', { skip }, async () => {
    const empty = mkdtempSync(join(work, 'tess-'))
    const w = await startWorker({ extract: { tessdataDir: empty } })
    try {
      const vid = await seedVersion([{ bytes: PNG, mime: 'image/png' }])
      const r = await w.post({ versionId: vid, sourceIndex: 0 }); assert.equal(r.status, 202)
      const row = await done(r.body.extractionId)
      assert.deepEqual([row.status, row.error_code], ['failed', 'ocr_unavailable'], JSON.stringify(row))
    } finally { await w.close() }
  })
  test('Thất bại: engine quá hạn → SIGKILL, failed/timeout (không treo worker)', { skip }, async () => {
    const stub = join(work, 'slow-python.sh')
    writeFileSync(stub, '#!/bin/bash\nif [[ "$*" == *--version* ]]; then echo chord-extract/1.0.0-slice1; exit 0; fi\nsleep 20\n'); chmodSync(stub, 0o755)
    const w = await startWorker({ python: stub, limits: { jobTimeoutMs: 700 } })
    try {
      const vid = await seedVersion([{ bytes: TEXT_PDF, mime: 'application/pdf' }])
      const started = Date.now()
      const r = await w.post({ versionId: vid, sourceIndex: 0 }); assert.equal(r.status, 202)
      const row = await done(r.body.extractionId, 15_000)
      assert.deepEqual([row.status, row.error_code], ['failed', 'timeout'], JSON.stringify(row))
      assert.ok(Date.now() - started < 10_000)
    } finally { await w.close() }
  })
  test('Thất bại: ghi kết quả hỏng → fail(upstream); cả đóng hỏng → bản ghi vẫn "running" rồi ĐỌC ra failed/abandoned khi hết lease', { skip }, async () => {
    const vid = await seedVersion([{ bytes: TEXT_PDF, mime: 'application/pdf' }])
    bridge.faults.failRpc.add('chord_extraction_complete')
    try {
      const r = await worker.post({ versionId: vid, sourceIndex: 0 })
      const row = await done(r.body.extractionId)
      assert.deepEqual([row.status, row.error_code], ['failed', 'upstream'])
      // cả complete lẫn fail đều hỏng (mạng/DB sập giữa chừng)
      const vid2 = await seedVersion([{ bytes: TEXT_PDF, mime: 'application/pdf' }])
      bridge.faults.failRpc.add('chord_extraction_fail')
      const r2 = await worker.post({ versionId: vid2, sourceIndex: 0 })
      await new Promise(res => setTimeout(res, 4000))
      assert.equal((await get(r2.body.extractionId)).status, 'running', 'chưa hết lease: vẫn đang chạy trong mắt DB')
      await sql(db, `update public.chord_sheet_extractions set lease_expires_at = now() - interval '1 second' where id = '${r2.body.extractionId}'`)
      const after = await get(r2.body.extractionId)
      assert.deepEqual([after.status, after.error_code], ['failed', 'abandoned'])
      assert.ok(!('document' in after), 'không bao giờ trông như thành công')
    } finally { bridge.faults.failRpc.clear() }
  })

  // ── Vision (provider giả qua HTTP cục bộ: không gọi mạng thật) ──
  const fakeVision = async (status: number, payload: unknown) => {
    const seen: { key?: string; body?: string }[] = []
    const server = createServer((req, res) => {
      let body = ''
      req.on('data', c => { body += c })
      req.on('end', () => { seen.push({ key: String(req.headers['x-api-key']), body }); res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(payload)) })
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, seen, close: () => new Promise<void>(r => server.close(() => r())) }
  }
  test('Vision provider lỗi: extraction VẪN thành công bằng kết quả local, ghi vision=failed; khoá chỉ ở worker', { skip }, async () => {
    const fake = await fakeVision(500, { error: 'boom' })
    const w = await startWorker({ extract: { vision: { model: 'model-x', apiKey: 'SECRET-VISION-KEY', baseUrl: fake.url } } })
    try {
      const vid = await seedVersion([{ bytes: TEXT_PDF, mime: 'application/pdf' }])
      const r = await w.post({ versionId: vid, sourceIndex: 0, forceVision: true }); assert.equal(r.status, 202)
      const row = await done(r.body.extractionId)
      assert.equal(row.status, 'succeeded', JSON.stringify(row))
      assert.equal(row.vision_status, 'failed'); assert.deepEqual(row.fallback_reasons, ['USER_REQUESTED'])
      assert.equal(row.document.pipeline.vision.errorCode, 'provider_failed')
      assert.equal(row.document.interpretation.chords.status, 'DETECTED', 'kết quả local giữ nguyên')
      assert.equal(fake.seen[0].key, 'SECRET-VISION-KEY')
      assert.ok(!JSON.stringify(row).includes('SECRET-VISION-KEY'))
    } finally { await w.close(); await fake.close() }
  })
  test('Vision bật: chỉ chạy khi có lý do (forceVision); hợp nhất không đụng token text layer; không có forceVision → không gọi', { skip }, async () => {
    const reply = { content: [{ type: 'text', text: JSON.stringify({ title: 'Bai thu nghiem 1', author: null, timeSignature: null, key: null, directions: [], chords: 'NO_CHORDS_DETECTED', chordSymbols: [], pages: [{ printedPageNumber: null, systems: [] }, { printedPageNumber: null, systems: [] }] }) }], usage: { input_tokens: 5, output_tokens: 2 } }
    const fake = await fakeVision(200, reply)
    const w = await startWorker({ extract: { vision: { model: 'model-x', apiKey: 'k-0123456789', baseUrl: fake.url } } })
    try {
      const vid = await seedVersion([{ bytes: TEXT_PDF, mime: 'application/pdf' }])
      const quiet = await w.post({ versionId: vid, sourceIndex: 0 }); const q = await done(quiet.body.extractionId)
      assert.equal(q.status, 'succeeded'); assert.equal(fake.seen.length, 0, 'text PDF + không yêu cầu → KHÔNG gọi Vision'); assert.equal(q.vision_status, 'not_needed')
      const forced = await w.post({ versionId: vid, sourceIndex: 0, forceVision: true }); const f = await done(forced.body.extractionId)
      assert.equal(f.status, 'succeeded', JSON.stringify(f)); assert.equal(fake.seen.length, 1); assert.equal(f.vision_status, 'ran')
      assert.deepEqual(f.document.pipeline.stages.at(-1), { stage: 'vision', engine: 'anthropic-api', version: 'messages-2023-06-01', model: 'model-x' })
      assert.ok(f.document.pages.every((p: any) => p.regions.every((g: any) => g.lines.every((l: any) => l.tokens.every((t: any) => t.source === 'text_layer')))))
      assert.notEqual(forced.body.extractionId, quiet.body.extractionId, 'forceVision nằm trong khoá chống trùng → lần chạy riêng, không bị coi là trùng lần cũ')
      assert.equal((await get(quiet.body.extractionId)).vision_status, 'not_needed', 'lần cũ không đổi')
    } finally { await w.close(); await fake.close() }
  })

  test('Giới hạn tần suất của extraction: theo NGƯỜI DÙNG → 429 rate_limited', { skip }, async () => {
    const w = await startWorker({ limits: { perMinute: 2 } })
    try {
      const vid = await seedVersion([{ bytes: TEXT_PDF, mime: 'application/pdf' }])
      const codes = []
      for (let i = 0; i < 3; i++) codes.push((await w.post({ versionId: vid, sourceIndex: 0 })).status)
      assert.deepEqual(codes.slice(0, 2).every(c => c === 200 || c === 202), true); assert.equal(codes[2], 429)
    } finally { await w.close() }
  })

  test('LOG: chỉ metadata — không JWT, không khoá API, không lời bài hát, không đường dẫn nguồn', { skip }, async () => {
    await new Promise(r => setTimeout(r, 500))
    const text = readdirSync(logDir).map(f => readFileSync(join(logDir, f), 'utf8')).join('\n')
    const entries = text.split('\n').filter(Boolean).map(l => JSON.parse(l) as Record<string, any>).filter(e => e.event === 'extract_job')
    assert.ok(entries.length >= 5)
    for (const e of entries) assert.ok(/^[0-9a-f-]{36}$/.test(e.extractionId) && /^[0-9a-f-]{36}$/.test(e.versionId) && typeof e.durationMs === 'number')
    const ok = entries.find(e => e.status === 'succeeded')!
    assert.ok(ok.pageCount >= 1 && Array.isArray(ok.methods) && /^[0-9a-f]{8}$/.test(ok.sha8) && 'fallbackReasons' in ok)
    assert.ok(!/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9]\.(pdf|jpg|png|webp)/.test(text), 'log lộ đường dẫn nguồn {uid}/{version}/{n}.ext')
    for (const secret of [TOK_T, TOK_A, 'Bearer', 'SECRET-VISION-KEY', 'Chieu', 'khong', 'Mua roi', 'Traceback']) assert.ok(!text.includes(secret), `log lộ "${secret}": ${text.slice(Math.max(0, text.indexOf(secret) - 120), text.indexOf(secret) + 80)}`)
  })

  // ═════════════ PHÂN TÍCH TẠM (/extract-staged): file đã ở Storage, CHƯA có bài/phiên bản ═════════════
  const extractionRows = async () => Number((await sql(db, 'select count(*) from public.chord_sheet_extractions')).out)
  const versionRows = async () => Number((await sql(db, 'select (select count(*) from public.chord_sheets) + (select count(*) from public.chord_sheet_versions)')).out)
  /** Đặt file vào {owner}/{draftId}/{index}.{ext} — KHÔNG có dòng chord_sheet/version nào (đúng như UI nạp file trước khi Lưu). */
  async function seedStaged(bytes: Buffer, mime: string, owner = T, name?: { draftId?: string; ext?: string }) {
    const draftId = name?.draftId ?? randomUUID()
    const ext = name?.ext ?? ({ 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[mime]!)
    const path = `${owner}/${draftId}/0.${ext}`
    mkdirSync(dirname(join(files, path)), { recursive: true }); writeFileSync(join(files, path), bytes)
    const r = await sql(db, `insert into storage.objects (bucket_id, name, owner, metadata) values ('chord-sheet-sources', '${path}', '${owner}', '{"mimetype":"${mime}","size":${bytes.length}}'::jsonb)`)
    assert.ok(r.ok, r.err)
    return draftId
  }
  const cleanStaged = () => sql(db, "delete from storage.objects where bucket_id = 'chord-sheet-sources' and name not in (select s ->> 'path' from public.chord_sheet_versions v, jsonb_array_elements(v.sources) s)")
  const stagedStart = (w: Awaited<ReturnType<typeof startWorker>>, body: unknown, token: string | null = TOK_T) => w.post(body, token, {}, '/extract-staged')
  const stagedStatus = (w: Awaited<ReturnType<typeof startWorker>>, jobId: unknown, token: string | null = TOK_T) => w.post({ jobId }, token, {}, '/extract-staged/status')
  async function stagedDone(w: Awaited<ReturnType<typeof startWorker>>, jobId: string, token = TOK_T, ms = 120_000) {
    const end = Date.now() + ms
    for (;;) {
      const r = await stagedStatus(w, jobId, token)
      assert.equal(r.status, 200, JSON.stringify(r.body))
      if (r.body.status !== 'running') return r.body
      assert.ok(Date.now() < end, 'việc tạm chạy quá lâu')
      await new Promise(res => setTimeout(res, 250))
    }
  }

  test('STAGED — Text PDF: chưa có bài → /extract-staged → POST status → tài liệu hợp lệ; KHÔNG ghi DB (không extraction, không bài/phiên bản)', { skip }, async () => {
    const draftId = await seedStaged(TEXT_PDF, 'application/pdf')
    const [e0, v0] = [await extractionRows(), await versionRows()]
    const r = await stagedStart(worker, { draftId, sourceIndex: 0, mime: 'application/pdf' })
    assert.equal(r.status, 202); assert.match(r.body.jobId, /^[0-9a-f]{32}$/); assert.equal(r.body.status, 'running')
    const out = await stagedDone(worker, r.body.jobId)
    assert.equal(out.status, 'succeeded'); assert.equal(out.sha256, sha(TEXT_PDF)); assert.equal(out.bytes, TEXT_PDF.length)
    const doc = out.document
    assert.deepEqual(doc.pages.map((p: any) => [p.kind, p.method]), [['text', 'text_layer'], ['text', 'text_layer']])
    assert.equal(doc.interpretation.chords.status, 'DETECTED'); assert.equal(doc.input.sha256, sha(TEXT_PDF))
    const v = validate(doc); if (v !== null) assert.equal(v.split('\n')[0], '0', `không hợp lệ chord-extraction/1: ${v}`)
    assert.equal(await extractionRows(), e0, 'KHÔNG ghi chord_sheet_extractions'); assert.equal(await versionRows(), v0, 'KHÔNG tạo chord_sheet/version')
    await cleanStaged()
  })
  test('STAGED — xác thực/quyền: không token 401, token hỏng 401, học viên 403 (không tạo việc)', { skip }, async () => {
    const draftId = await seedStaged(TEXT_PDF, 'application/pdf'); const body = { draftId, sourceIndex: 0, mime: 'application/pdf' }
    assert.equal((await stagedStart(worker, body, null)).status, 401)
    assert.equal((await stagedStart(worker, body, TOK_BAD)).status, 401)
    const student = await stagedStart(worker, body, TOK_A); assert.deepEqual([student.status, student.body.error.code], [403, 'forbidden'])
    assert.equal((await stagedStatus(worker, '0'.repeat(32), null)).status, 401); assert.equal((await stagedStatus(worker, '0'.repeat(32), TOK_BAD)).status, 401)
    await cleanStaged()
  })
  test('STAGED — body chặt: khoá thừa/thiếu, UUID/index/mime sai, path/url/uid → 400', { skip }, async () => {
    const ok = { draftId: randomUUID(), sourceIndex: 0, mime: 'application/pdf' }
    for (const bad of [{ ...ok, path: '/etc/passwd' }, { ...ok, url: 'http://169.254.169.254/' }, { ...ok, uid: X }, { ...ok, sourcePath: 'a/b/0.pdf' }, { ...ok, bytes: 'AAAA' },
      { draftId: ok.draftId, sourceIndex: 0 }, { sourceIndex: 0, mime: ok.mime }, { ...ok, draftId: 'abc' }, { ...ok, draftId: `${X}/../x` }, { ...ok, sourceIndex: 10 }, { ...ok, sourceIndex: -1 },
      { ...ok, sourceIndex: '0' }, { ...ok, mime: 'text/html' }, { ...ok, mime: 'application/x-msdownload' }, { ...ok, mime: '__proto__' }, [], 'x']) {
      const r = await stagedStart(worker, bad); assert.deepEqual([r.status, r.body.error.code], [400, 'bad_request'], JSON.stringify(bad))
    }
    for (const bad of [{}, { jobId: 'xyz' }, { jobId: '0'.repeat(32), extra: 1 }, { jobId: 'A'.repeat(32) }]) assert.equal((await worker.post(bad, TOK_T, {}, '/extract-staged/status')).status, 400, JSON.stringify(bad))
    assert.equal((await worker.post({ ...ok }, TOK_T, { origin: 'https://evil.example' }, '/extract-staged')).status, 403)
  })
  test('STAGED — không có file: job failed/source_missing; MIME khai ≠ byte thật: failed/unsupported_mime', { skip }, async () => {
    let r = await stagedStart(worker, { draftId: randomUUID(), sourceIndex: 0, mime: 'application/pdf' }); assert.equal(r.status, 202)
    let out = await stagedDone(worker, r.body.jobId); assert.deepEqual([out.status, out.errorCode], ['failed', 'source_missing']); assert.ok(!('document' in out))
    const d2 = await seedStaged(PNG, 'application/pdf')   // đuôi .pdf nhưng byte là PNG
    r = await stagedStart(worker, { draftId: d2, sourceIndex: 0, mime: 'application/pdf' })
    out = await stagedDone(worker, r.body.jobId); assert.deepEqual([out.status, out.errorCode], ['failed', 'unsupported_mime'])
    await cleanStaged()
  })
  test('STAGED — worker tự dựng path từ uid của JWT: file của NGƯỜI KHÁC (dù người gọi có quyền review) không trỏ tới được', { skip }, async () => {
    const draftId = await seedStaged(TEXT_PDF, 'application/pdf', X)   // file nằm ở thư mục của admin X
    const r = await stagedStart(worker, { draftId, sourceIndex: 0, mime: 'application/pdf' }, TOK_T)   // T gọi với draftId đó
    const out = await stagedDone(worker, r.body.jobId, TOK_T)
    assert.deepEqual([out.status, out.errorCode], ['failed', 'source_missing'], 'T chỉ thấy thư mục {uid của T}/draftId — không có file')
    await cleanStaged()
  })
  test('STAGED — người khác không đọc được việc của mình; hết hạn / worker khởi động lại → 404 sạch để phân tích lại', { skip }, async () => {
    const draftId = await seedStaged(TEXT_PDF, 'application/pdf')
    const r = await stagedStart(worker, { draftId, sourceIndex: 0, mime: 'application/pdf' })
    await stagedDone(worker, r.body.jobId)
    const other = await stagedStatus(worker, r.body.jobId, TOK_X)   // admin X (có review) KHÔNG đọc được việc của T
    assert.deepEqual([other.status, other.body.error.code], [404, 'not_found'])
    assert.equal((await stagedStatus(worker, '1'.repeat(32))).status, 404, 'jobId không tồn tại')
    // hết hạn
    const short = await startWorker({ limits: { perMinute: 10_000, perDay: 100_000, stagedTtlMs: 400 } })
    try {
      const a = await stagedStart(short, { draftId, sourceIndex: 0, mime: 'application/pdf' }); const done = await stagedDone(short, a.body.jobId); assert.equal(done.status, 'succeeded')
      await new Promise(res => setTimeout(res, 800))
      const gone = await stagedStatus(short, a.body.jobId); assert.deepEqual([gone.status, gone.body.error.code], [404, 'not_found'])
    } finally { await short.close() }
    // worker khởi động lại: job mất → 404, UI cho phân tích lại
    const restarted = await startWorker({ limits: { perMinute: 10_000, perDay: 100_000 } })
    try { assert.equal((await stagedStatus(restarted, r.body.jobId)).status, 404) } finally { await restarted.close() }
    await cleanStaged()
  })
  test('STAGED — rate-limit theo uid, trần việc đang chạy/người, trần kích thước kết quả, bỏ kết quả cũ nhất khi đầy', { skip }, async () => {
    const draftId = await seedStaged(TEXT_PDF, 'application/pdf'); const body = { draftId, sourceIndex: 0, mime: 'application/pdf' }
    const limited = await startWorker({ limits: { perMinute: 2 } })
    try {
      const codes: number[] = []; for (let i = 0; i < 3; i++) codes.push((await stagedStart(limited, body)).status)
      assert.deepEqual([codes[0], codes[1], codes[2]].map(c => c === 202 || c === 429), [true, true, true]); assert.equal(codes[2], 429)
    } finally { await limited.close() }
    const small = await startWorker({ limits: { perMinute: 10_000, perDay: 100_000, maxStagedResultBytes: 1000 } })
    try {
      const a = await stagedStart(small, body); const out = await stagedDone(small, a.body.jobId)
      assert.deepEqual([out.status, out.errorCode], ['failed', 'too_large']); assert.ok(!('document' in out))
    } finally { await small.close() }
    const stub = join(work, 'slow-python-staged.sh')
    writeFileSync(stub, '#!/bin/bash\nif [[ "$*" == *--version* ]]; then echo chord-extract/1.0.0-slice1; exit 0; fi\nsleep 20\n'); chmodSync(stub, 0o755)
    const cap = await startWorker({ python: stub, limits: { perMinute: 10_000, perDay: 100_000, maxStagedRunningPerUser: 1, jobTimeoutMs: 1500 } })
    try {
      const first = await stagedStart(cap, body); assert.equal(first.status, 202)
      const second = await stagedStart(cap, body); assert.deepEqual([second.status, second.body.error.code], [429, 'too_many_jobs'])
      const out = await stagedDone(cap, first.body.jobId, TOK_T, 15_000); assert.deepEqual([out.status, out.errorCode], ['failed', 'timeout'])
    } finally { await cap.close() }
    const evict = await startWorker({ limits: { perMinute: 10_000, perDay: 100_000, maxStagedPerUser: 2 } })
    try {   // giữ tối đa 2 kết quả: việc thứ 3 vẫn được nhận, kết quả CŨ NHẤT bị bỏ (404), hai kết quả mới còn
      const ids: string[] = []
      for (let i = 0; i < 3; i++) { const a = await stagedStart(evict, body); assert.equal(a.status, 202); await stagedDone(evict, a.body.jobId); ids.push(a.body.jobId) }
      assert.equal((await stagedStatus(evict, ids[0])).status, 404); assert.equal((await stagedStatus(evict, ids[1])).status, 200); assert.equal((await stagedStatus(evict, ids[2])).status, 200)
    } finally { await evict.close() }
    await cleanStaged()
  })
  test('PROBE — POST {} không cần đăng nhập, chữ ký xác định, không chạm DB/Storage/engine; body khác {} → 400; chưa cấu hình → 503', { skip }, async () => {
    const [e0, g0] = [await extractionRows(), bridge.faults.storageGets]
    const r = await worker.post({}, null, {}, '/extract-probe')
    assert.deepEqual([r.status, r.body.ok, r.body.kind, r.body.schema, typeof r.body.engine], [200, true, 'chord-extract-worker', 'chord-extraction/1', 'string'])
    assert.equal((await worker.post({ a: 1 }, null, {}, '/extract-probe')).status, 400); assert.equal((await worker.post([], null, {}, '/extract-probe')).status, 400)
    assert.equal((await worker.post({}, null, { origin: 'https://evil.example' }, '/extract-probe')).status, 403)
    assert.equal(await extractionRows(), e0); assert.equal(bridge.faults.storageGets, g0)
    const server = createWorker({ supabaseUrl: bridge.url, anonKey: 'anon-key', python: PYTHON, analyzer: join(ROOT, 'tools/measure-analyzer/measure_analyzer.py'), allowedOrigins: [], logDir })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    try {
      const res = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/extract-probe`, { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } })
      assert.equal(res.status, 503)
    } finally { server.close(); server.closeAllConnections?.() }
  })
  test('STAGED — log chỉ metadata (không JWT, uid, đường dẫn, lời); poll/probe không làm đầy log', { skip }, async () => {
    await new Promise(r => setTimeout(r, 500))
    const text = readdirSync(logDir).map(f => readFileSync(join(logDir, f), 'utf8')).join('\n')
    const entries = text.split('\n').filter(Boolean).map(l => JSON.parse(l) as Record<string, any>)
    const staged = entries.filter(e => e.event === 'extract_staged'); assert.ok(staged.length >= 4)
    for (const e of staged) assert.ok(typeof e.jobId === 'string' && e.jobId.length === 8 && typeof e.durationMs === 'number' && !('document' in e))
    assert.ok(staged.some(e => e.status === 'succeeded' && e.pageCount >= 1 && /^[0-9a-f]{8}$/.test(e.sha8)) && staged.some(e => e.errorCode === 'source_missing'))
    assert.ok(!entries.some(e => e.path === '/extract-probe') && !entries.some(e => e.path === '/extract-staged/status' && e.status === 200), 'probe và poll thành công không được ghi log')
    for (const secret of [TOK_T, TOK_A, TOK_X, T, X, A, 'Chieu', 'Mua roi', 'Traceback']) assert.ok(!text.includes(secret), `log lộ "${secret}"`)
    assert.ok(!/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9]\.(pdf|jpg|png|webp)/.test(text), 'log lộ đường dẫn nguồn')
  })

  test('Tắt hẳn: worker không cấu hình extract → /extract-content = 503 not_configured; /health không có extract', { skip }, async () => {
    const server = createWorker({ supabaseUrl: bridge.url, anonKey: 'anon-key', python: PYTHON, analyzer: join(ROOT, 'tools/measure-analyzer/measure_analyzer.py'), allowedOrigins: [], logDir })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    try {
      const r = await fetch(`${base}/extract-content`, { method: 'POST', headers: { authorization: `Bearer ${TOK_T}`, 'content-type': 'application/json' }, body: '{}' })
      assert.equal(r.status, 503); assert.equal(((await r.json()) as any).error.code, 'not_configured')
      assert.ok(!('extract' in (await (await fetch(`${base}/health`)).json() as object)))
    } finally { server.close(); server.closeAllConnections?.() }
  })
}
