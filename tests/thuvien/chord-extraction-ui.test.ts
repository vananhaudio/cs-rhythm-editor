// Phân tích nội dung sheet: đề xuất (hàm thuần) + client worker (fetch/RPC giả). Không mạng thật.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyProposal, buildProposal, hasSubstantialText } from '../../src/thuvien/extractionProposal.ts'
import { createContentExtractor, extractorUrlsFrom } from '../../src/thuvien/contentExtractor.ts'

const field = (value: unknown) => ({ value, evidence: [], source: 'text_layer', confidence: 0.9 })
const tok = (source: string) => ({ id: 't', text: 'x', kind: 'word', source })
const doc = (o: { title?: string; author?: string; bpm?: number; text: string; chords?: 'DETECTED' | 'NO_CHORDS_DETECTED'; count?: number; source?: string; warnings?: { code: string; message: string }[]; fallback?: string[]; pages?: number }) => ({
  schema: 'chord-extraction/1', input: { pageCount: o.pages ?? 1 },
  pages: [{ regions: [{ lines: [{ tokens: [tok(o.source ?? 'text_layer')] }] }] }],
  pipeline: { fallbackReasons: o.fallback ?? [] },
  interpretation: {
    metadata: { title: o.title ? field(o.title) : null, author: o.author ? field(o.author) : null, key: null, timeSignature: null, bpm: o.bpm ? field(o.bpm) : null },
    chords: { status: o.chords ?? 'DETECTED', count: o.count ?? (o.text.match(/\[/g) ?? []).length },
    draft: { text: o.text, warnings: o.warnings ?? [], reviewRequired: true },
  },
})

test('đề xuất: bỏ dòng tiêu đề khỏi lời, lấy tên/tác giả/BPM, luôn báo không đọc được nhịp', () => {
  const p = buildProposal([doc({ title: 'Tình ca', author: 'Hoàng Việt', bpm: 90, text: 'Tình ca\n[Am] Sáng nay [E7] mình đi' })])
  assert.equal(p.text, '[Am] Sáng nay [E7] mình đi')
  assert.deepEqual([p.title, p.author, p.bpm, p.chords, p.reading, p.meterReadable], ['Tình ca', 'Hoàng Việt', 90, 'DETECTED', 'text_layer', false])
  assert.ok(p.warnings.some(w => w.code === 'METER_UNREADABLE'))
})

test('đề xuất: KHÔNG hợp âm → cảnh báo, không bịa hợp âm; nhiều tờ giữ thứ tự và nối khổ', () => {
  const p = buildProposal([doc({ text: 'Lời một\nLời hai', chords: 'NO_CHORDS_DETECTED', count: 0 }), doc({ text: 'Lời ba', chords: 'NO_CHORDS_DETECTED', count: 0 })])
  assert.equal(p.text, 'Lời một\nLời hai\n\nLời ba')
  assert.equal(p.chords, 'NO_CHORDS_DETECTED')
  assert.ok(!p.text.includes('['), 'không suy hợp âm')
  assert.ok(p.warnings.some(w => w.code === 'NO_CHORDS_DETECTED'))
  assert.ok(p.warnings.some(w => w.code === 'TITLE_NOT_FOUND'))
})

test('đề xuất: hợp âm mồ côi báo rõ; mâu thuẫn tiêu đề giữ tờ đầu; OCR/độ tin cậy thấp được ghi', () => {
  const orphan = buildProposal([doc({ text: 'Chỉ lời', count: 3, source: 'ocr', fallback: ['LOW_OCR_CONFIDENCE'] })])
  assert.ok(orphan.warnings.some(w => w.code === 'ORPHAN_CHORDS'))
  assert.equal(orphan.reading, 'ocr'); assert.equal(orphan.lowConfidence, true)
  const two = buildProposal([doc({ title: 'A', text: 'x' }), doc({ title: 'B', text: 'y' })])
  assert.equal(two.title, 'A'); assert.ok(two.warnings.some(w => w.code === 'TITLE_CONFLICT'))
  const mixed = buildProposal([doc({ text: 'x', source: 'ocr' }), doc({ text: 'y', source: 'text_layer' })])
  assert.equal(mixed.pageCount, 2)
})

test('áp đề xuất: lời thay; tên/tác giả/BPM chỉ điền khi ô trống', () => {
  const p = buildProposal([doc({ title: 'Tình ca', author: 'HV', bpm: 90, text: '[Am] a' })])
  assert.deepEqual(applyProposal({ title: '', composer: '', bpm: '', text: '' }, p), { title: 'Tình ca', composer: 'HV', bpm: '90', text: '[Am] a' })
  assert.deepEqual(applyProposal({ title: 'Có sẵn', composer: 'Tôi', bpm: '70', text: 'cũ' }, p), { title: 'Có sẵn', composer: 'Tôi', bpm: '70', text: '[Am] a' })
  const empty = buildProposal([doc({ text: '', chords: 'NO_CHORDS_DETECTED' })])
  assert.equal(applyProposal({ title: '', composer: '', bpm: '', text: 'giữ' }, empty).text, 'giữ', 'không có chữ → không xoá lời đang có')
  assert.equal(hasSubstantialText('ngắn'), false); assert.equal(hasSubstantialText('Sáng nay mình cùng đi qua phố dài'), true)
})

// ── client worker ──
type Call = { path: string; body: Record<string, unknown>; auth: string | null; method: string }
function fakeFetch(handler: (call: Call) => { status?: number; json: unknown } | Promise<{ status?: number; json: unknown }>) {
  const calls: Call[] = []
  const fetcher = (async (url: string, init: RequestInit) => {
    const call: Call = { path: new URL(url).pathname, body: JSON.parse(String(init.body ?? '{}')), auth: (init.headers as Record<string, string>).authorization ?? null, method: String(init.method) }
    calls.push(call)
    const out = await handler(call)
    return { status: out.status ?? 200, json: async () => out.json }
  }) as unknown as typeof fetch
  return { fetcher, calls }
}
const PROBE = { ok: true, kind: 'chord-extract-worker', schema: 'chord-extraction/1', engine: 'x' }
const noSleep = async () => {}
const U = '11111111-1111-4111-8111-111111111111'

test('client: thăm dò bằng POST (không GET, không JWT); chữ ký sai/không chạy → không sẵn sàng', async () => {
  const ok = fakeFetch(() => ({ json: PROBE }))
  const ex = createContentExtractor({ getToken: async () => 'T'.repeat(30), fetcher: ok.fetcher })
  assert.equal(await ex.available(), true)
  assert.deepEqual([ok.calls[0].method, ok.calls[0].path, ok.calls[0].auth], ['POST', '/extract-probe', null])
  assert.equal(await createContentExtractor({ getToken: async () => 'x', fetcher: fakeFetch(() => ({ json: { ok: true } })).fetcher }).available(), false)
  assert.equal(await createContentExtractor({ getToken: async () => 'x', fetcher: (async () => { throw new Error('down') }) as unknown as typeof fetch }).available(), false)
})

test('client: staged — POST /extract-staged rồi POST status tới khi xong; chỉ gửi đúng 3 khoá', async () => {
  let polls = 0
  const f = fakeFetch(call => {
    if (call.path === '/extract-probe') return { json: PROBE }
    if (call.path === '/extract-staged') return { status: 202, json: { ok: true, jobId: 'a'.repeat(32), status: 'running' } }
    polls += 1
    return { json: polls < 3 ? { ok: true, status: 'running' } : { ok: true, status: 'succeeded', document: { schema: 'chord-extraction/1' } } }
  })
  const ex = createContentExtractor({ getToken: async () => 'T'.repeat(30), fetcher: f.fetcher, sleep: noSleep })
  const out = await ex.extract({ kind: 'staged', draftId: U, sourceIndex: 0, mime: 'application/pdf' })
  assert.deepEqual(out, { ok: true, document: { schema: 'chord-extraction/1' } })
  const start = f.calls.find(c => c.path === '/extract-staged')!
  assert.deepEqual(Object.keys(start.body).sort(), ['draftId', 'mime', 'sourceIndex'])
  assert.ok(f.calls.every(c => c.method === 'POST'))
  assert.equal(start.auth, `Bearer ${'T'.repeat(30)}`)
})

test('client: staged lỗi → thông điệp tiếng Việt; hết hạn 404 → báo phân tích lại; chưa đăng nhập → unauthorized', async () => {
  const failed = createContentExtractor({ getToken: async () => 'T'.repeat(30), sleep: noSleep, fetcher: fakeFetch(call => call.path === '/extract-probe' ? { json: PROBE }
    : call.path === '/extract-staged' ? { status: 202, json: { ok: true, jobId: 'b'.repeat(32) } } : { json: { ok: true, status: 'failed', errorCode: 'source_missing' } }).fetcher })
  const r = await failed.extract({ kind: 'staged', draftId: U, sourceIndex: 1, mime: 'image/png' })
  assert.ok(!r.ok && r.error.code === 'source_missing' && /nạp lại/.test(r.error.message))
  const gone = createContentExtractor({ getToken: async () => 'T'.repeat(30), sleep: noSleep, fetcher: fakeFetch(call => call.path === '/extract-probe' ? { json: PROBE }
    : call.path === '/extract-staged' ? { status: 202, json: { ok: true, jobId: 'b'.repeat(32) } } : { status: 404, json: { ok: false, error: { code: 'not_found', message: 'x' } } }).fetcher })
  const g = await gone.extract({ kind: 'staged', draftId: U, sourceIndex: 0, mime: 'image/png' })
  assert.ok(!g.ok && g.error.code === 'not_found' && /Phân tích lại/.test(g.error.message))
  const anon = createContentExtractor({ getToken: async () => null, fetcher: fakeFetch(() => ({ json: PROBE })).fetcher })
  const a = await anon.extract({ kind: 'staged', draftId: U, sourceIndex: 0, mime: 'image/png' })
  assert.ok(!a.ok && a.error.code === 'unauthorized')
  const down = await createContentExtractor({ getToken: async () => 'x', fetcher: (async () => { throw new Error('down') }) as unknown as typeof fetch }).extract({ kind: 'staged', draftId: U, sourceIndex: 0, mime: 'image/png' })
  assert.ok(!down.ok && down.error.code === 'unreachable')
})

test('client: persisted — POST /extract-content rồi đọc RPC chord_extraction_get; trùng (200) dùng lại kết quả', async () => {
  let reads = 0
  const f = fakeFetch(call => call.path === '/extract-probe' ? { json: PROBE } : { status: 200, json: { ok: true, extractionId: U, status: 'succeeded', duplicate: true } })
  const ex = createContentExtractor({
    getToken: async () => 'T'.repeat(30), fetcher: f.fetcher, sleep: noSleep,
    readExtraction: async id => { reads += 1; assert.equal(id, U); return reads < 2 ? { status: 'running' } : { status: 'succeeded', document: { d: 1 } } },
  })
  assert.deepEqual(await ex.extract({ kind: 'persisted', versionId: U, sourceIndex: 0 }), { ok: true, document: { d: 1 } })
  assert.deepEqual(Object.keys(f.calls.find(c => c.path === '/extract-content')!.body).sort(), ['sourceIndex', 'versionId'])
  const bad = createContentExtractor({ getToken: async () => 'T'.repeat(30), fetcher: f.fetcher, sleep: noSleep, readExtraction: async () => ({ status: 'failed', error_code: 'abandoned' }) })
  const r = await bad.extract({ kind: 'persisted', versionId: U, sourceIndex: 0 })
  assert.ok(!r.ok && r.error.code === 'abandoned')
})

test('client: poll quá hạn → timeout; URL env: off tắt, không đặt → loopback mặc định, chỉ nhận http(s)', async () => {
  const f = fakeFetch(call => call.path === '/extract-probe' ? { json: PROBE } : call.path === '/extract-staged' ? { status: 202, json: { ok: true, jobId: 'c'.repeat(32) } } : { json: { ok: true, status: 'running' } })
  const ex = createContentExtractor({ getToken: async () => 'T'.repeat(30), fetcher: f.fetcher, sleep: async () => { await new Promise(r => setTimeout(r, 5)) }, maxWaitMs: 20 })
  const out = await ex.extract({ kind: 'staged', draftId: U, sourceIndex: 0, mime: 'image/png' })
  assert.ok(!out.ok && out.error.code === 'timeout')
  assert.equal(extractorUrlsFrom('off'), null)
  assert.deepEqual(extractorUrlsFrom(undefined), ['http://127.0.0.1:7430'])
  assert.deepEqual(extractorUrlsFrom('ftp://x, http://127.0.0.1:9000'), ['http://127.0.0.1:9000'])
})
