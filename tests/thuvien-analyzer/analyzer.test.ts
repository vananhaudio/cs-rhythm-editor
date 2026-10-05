// Analyzer vạch nhịp (5B): sheet TỔNG HỢP sinh tại chỗ (biết trước đáp án, không bản quyền) + hợp đồng TS + adapter HTTP.
// Golden thật (ảnh + lời có bản quyền, NGOÀI git) chỉ chạy khi có MEASURE_GOLDEN_DIR.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { analysisLineCounts, createHttpMeasureAnalyzer, createWorkerMeasureAnalyzer, parseAnalysisResult, productionMeasureAnalyzer } from '../../src/thuvien/measureAnalysis.ts'
import { runAnalyzer, runAnalyzerRaw } from './harness.ts'

const SYNTH = fileURLToPath(new URL('../../tools/measure-analyzer/synth.py', import.meta.url))
const dir = mkdtempSync(join(tmpdir(), 'measure-synth-'))
after(() => rmSync(dir, { recursive: true, force: true }))
let n = 0
function sheet(systems: string[][], extra: Record<string, unknown> = {}, ext = 'png') {
  const out = join(dir, `s${n += 1}.${ext}`)
  execFileSync('python3', [SYNTH], { input: JSON.stringify({ out, systems: systems.map(items => ({ items })), ...extra }) })
  return out
}
const png = (path: string) => ({ path, mime: 'image/png' })
const A = (line: number, token: number) => ({ line, token })
// Lời tự soạn — số chữ mỗi dòng khớp sheet tổng hợp. Có hợp âm + nhãn để chắc tokenizer của app được dùng.
const TEXT_5_4 = '1. Một [C] hai ba bốn năm\nĐK: [G] sáu bảy tám [Am] chín'

test('tokenizer: analyzer chỉ nhận số chữ mỗi dòng, tính bằng tokenizer của app (bỏ [hợp âm], bỏ nhãn)', () => {
  assert.deepEqual(analysisLineCounts(TEXT_5_4), [5, 4])
  assert.deepEqual(analysisLineCounts('Intro: [C] [G]\n\nla [Am]'), [1, 0, 2], 'hợp âm cuối dòng không kèm chữ = 1 token như accept_anchors')
})

test('cơ bản: lấy đà + vạch + ô ngân; đuôi nốt KHÔNG thành vạch; vạch kết bài không mở ô', async () => {
  const r = await runAnalyzer(TEXT_5_4, [png(sheet([['w', '|', 'w', 'w', '|', 'w', 's', 'w'], ['w', 'w', '|', '|', 'w', 'w']]))])
  assert.ok(r.ok)
  assert.deepEqual(r.anchors, { pickup: A(0, 0), measures: [A(0, 1), A(0, 3), A(1, 0), A(1, 2), A(1, 2)] })
  assert.deepEqual(r.diagnostics.systems.map(s => s.bars.length), [3, 3], 'đuôi nốt (cả khi không có chữ) không bị nhận là vạch')
  assert.equal(r.diagnostics.boundaries.length, 6)
  assert.deepEqual(r.review.measures, [5], 'ô không có chữ mới (ngân hay không lời?) → LOW, chờ thầy')
  assert.equal(r.confidence.measures[0].confidence, 'HIGH')
})

test('không lấy đà: vạch trước chữ đầu → ô 1 = chữ đầu; ô đầu dài mà không có vạch mở → ô 1 suy ra ở đầu bài (MEDIUM)', async () => {
  const a = await runAnalyzer('một hai ba', [png(sheet([['|', 'w', 'w', '|', 'w']]))])
  assert.ok(a.ok)
  assert.deepEqual(a.anchors, { measures: [A(0, 0), A(0, 2)] })
  const b = await runAnalyzer('một hai ba bốn năm sáu', [png(sheet([['w', 'w', 'w', 'w', '|', 'w', '|', 'w']]))])
  assert.ok(b.ok)
  assert.equal(b.anchors.pickup, undefined, 'ô đầu đầy đủ → không phải lấy đà')
  assert.deepEqual(b.anchors.measures, [A(0, 0), A(0, 4), A(0, 5)])
  assert.equal(b.confidence.measures[0].confidence, 'MEDIUM')
})

test('số chữ trên sheet ≠ số token chuẩn → KHÔNG ép im lặng: needsReview + ghi chú; hạ tin cậy ở vạch liên quan', async () => {
  const r = await runAnalyzer('một hai ba', [png(sheet([['w', '|', 'w', 'w', '|', 'w', 'w']]))])
  assert.ok(r.ok)
  assert.equal(r.review.needsReview, true)
  assert.match(r.review.notes.join(' '), /Sheet có 2 cụm chữ không khớp lời chuẩn/)
  assert.ok(r.confidence.measures.some(m => m.confidence !== 'HIGH'), 'vạch đứng trước chữ không khớp bị hạ tin cậy (cục bộ, không hạ cả bài)')
})

test('khuông TAB 6 dây bị bỏ qua; ảnh nghiêng 1° được xoay thẳng — vẫn đúng từng vạch', async () => {
  const tab = await runAnalyzer(TEXT_5_4, [png(sheet([['w', '|', 'w', 'w', '|', 'w', 's', 'w'], ['w', 'w', '|', '|', 'w', 'w']], { tab: true }))])
  assert.ok(tab.ok)
  assert.equal(tab.diagnostics.systems.length, 2, 'chỉ 2 khuông nhạc, không tính khuông tab')
  const skew = await runAnalyzer(TEXT_5_4, [png(sheet([['w', '|', 'w', 'w', '|', 'w', 's', 'w'], ['w', 'w', '|', '|', 'w', 'w']], { skew: 1, width: 1100 }))])
  assert.ok(skew.ok)
  assert.deepEqual(skew.anchors, { pickup: A(0, 0), measures: [A(0, 1), A(0, 3), A(1, 0), A(1, 2), A(1, 2)] })
})

test('PDF (một ảnh mỗi trang) → lấy nguyên ảnh nhúng, cùng kết quả như ảnh', async () => {
  const pdf = sheet([['w', '|', 'w', 'w', '|', 'w', 's', 'w'], ['w', 'w', '|', '|', 'w', 'w']], {}, 'pdf')
  const r = await runAnalyzer(TEXT_5_4, [{ path: pdf, mime: 'application/pdf' }])
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error))
  assert.deepEqual(r.anchors, { pickup: A(0, 0), measures: [A(0, 1), A(0, 3), A(1, 0), A(1, 2), A(1, 2)] })
})

test('thứ tự trang: file trang 2 nạp trước trang 1 → máy xếp lại theo nội dung (căn chỉnh), kết quả như đúng thứ tự + báo cần kiểm', async () => {
  const p1 = png(sheet([['w1', '|', 'w2', 'w2', '|', 'w1', 'w2', 'w4']]))
  const p2 = png(sheet([['w5', 'w5', 'w5', 'w5', '|', 'w5', '|', 'w5', 'w5']]))
  // độ dài chữ khác nhau để thứ tự trang có căn cứ: trang 1 chữ ngắn, trang 2 chữ dài
  const text = 'a bb cc d ee ffff\nggggg hhhhh iiiii jjjjj kkkkk lllll mmmmm'
  const ok = await runAnalyzer(text, [p1, p2])
  const swapped = await runAnalyzer(text, [p2, p1])
  assert.ok(ok.ok && swapped.ok)
  assert.deepEqual(swapped.anchors, ok.anchors)
  assert.match(swapped.review.notes.join(' '), /Đã xếp lại thứ tự trang .* — cần kiểm/)
  assert.equal(swapped.review.needsReview, true)
})

test('lệch số chữ chỉ ảnh hưởng CỤC BỘ: lời chuẩn thiếu một chữ ở giữa → các vạch xa chỗ đó vẫn đúng chữ', async () => {
  const items = [['w2', '|', 'w4', 'w1', '|', 'w3', 'w5', 'w1'], ['w4', 'w2', '|', 'w6', 'w1', 'w3', '|', 'w2']]
  const full = 'aa bbbb c ddd eeeee f\ngggg hh iiiiii j kkk ll'
  const cut = 'aa bbbb c ddd f\ngggg hh iiiiii j kkk ll'          // thiếu "eeeee"
  const a = await runAnalyzer(full, [png(sheet(items))])
  const b = await runAnalyzer(cut, [png(sheet(items))])
  assert.ok(a.ok && b.ok)
  assert.deepEqual(a.anchors.measures.slice(-2), [A(1, 2), A(1, 5)])
  assert.deepEqual(b.anchors.measures.slice(-2), [A(1, 2), A(1, 5)], 'dòng sau chỗ thiếu không bị dồn lệch')
  assert.match(b.review.notes.join(' '), /không khớp lời chuẩn/)
})

test('PDF VECTOR nhiều trang: mỗi trang render RIÊNG (-f n -l n), ≤ 2 lần/trang — chống tái phát lỗi O(n²) render lại cả tài liệu', async () => {
  const pdf = sheet([['w', '|', 'w', 'w', '|', 'w', 's', 'w'], ['w', 'w', '|', '|', 'w', 'w']], { pages: 4 }, 'vector.pdf')
  const shim = mkdtempSync(join(tmpdir(), 'poppler-shim-'))
  const log = join(shim, 'calls.log')
  const real = execFileSync('sh', ['-c', 'command -v pdftoppm']).toString().trim()
  writeFileSync(join(shim, 'pdftoppm'), `#!/bin/sh\necho "$@" >> "${log}"\nexec "${real}" "$@"\n`, { mode: 0o755 })
  try {
    const raw = await runAnalyzerRaw({ sources: [{ path: pdf, mime: 'application/pdf' }], lineTokenCounts: [5, 4, 5, 4, 5, 4, 5, 4] }, { ...process.env, PATH: `${shim}:${process.env.PATH}` }) as { ok: boolean; diagnostics: { pages: number } }
    assert.equal(raw.ok, true)
    assert.equal(raw.diagnostics.pages, 4)
    const calls = readFileSync(log, 'utf8').trim().split('\n')
    assert.ok(calls.length <= 2 * 4, `${calls.length} lần render cho 4 trang`)
    for (const call of calls) assert.match(call, /-f (\d+) -l \1 /, 'mỗi lệnh render đúng MỘT trang')
  } finally { rmSync(shim, { recursive: true, force: true }) }
})

test('giới hạn tài nguyên: PDF > 10 trang / ảnh > 40 MP / PDF hỏng → lỗi có mã, không treo, không lộ đường dẫn', async () => {
  const many = sheet([['w', '|', 'w']], { pages: 11 }, 'vector.pdf')
  assert.deepEqual(pick(await runAnalyzerRaw({ sources: [{ path: many, mime: 'application/pdf' }], lineTokenCounts: [2] })), { ok: false, code: 'too_large' })
  const bomb = join(dir, 'bomb.png')
  execFileSync('python3', ['-c', `from PIL import Image; Image.new('L', (7000, 7000), 255).save(${JSON.stringify(bomb)})`])
  const big = await runAnalyzerRaw({ sources: [{ path: bomb, mime: 'image/png' }], lineTokenCounts: [2] }) as { error: { message: string } }
  assert.deepEqual(pick(big), { ok: false, code: 'too_large' })
  assert.doesNotMatch(big.error.message, /\//, 'thông báo không chứa đường dẫn')
  const broken = join(dir, 'broken.pdf')
  writeFileSync(broken, '%PDF-1.4 rác không phải PDF')
  assert.deepEqual(pick(await runAnalyzerRaw({ sources: [{ path: broken, mime: 'application/pdf' }], lineTokenCounts: [2] })), { ok: false, code: 'bad_pdf' })
  const raw = await runAnalyzerRaw({ sources: [{ path: bomb.replace('bomb', 'khong-co'), mime: 'image/png' }], lineTokenCounts: [2] }) as { diagnostics: { generator: string } }
  assert.deepEqual(pick(raw), { ok: false, code: 'unsupported' })
  assert.equal(raw.diagnostics.generator, 'measure-analyzer/0.2.0', 'lỗi cũng mang phiên bản analyzer')
})
const pick = (raw: unknown) => { const r = raw as { ok: boolean; error?: { code: string } }; return { ok: r.ok, code: r.error?.code } }

test('thất bại có cấu trúc: trang trắng → ok:false (không đoán)', async () => {
  const blank = join(dir, 'blank.png')
  execFileSync('python3', ['-c', `from PIL import Image; Image.new('L', (600, 800), 250).save(${JSON.stringify(blank)})`])
  const r = await runAnalyzer('một hai', [png(blank)])
  assert.deepEqual(r, { ok: false, error: { code: 'no_staff', message: 'Không tìm thấy khuông nhạc nào.' } })
})

test('hợp đồng: anchors chỉ đúng 2 khoá (confidence không lọt vào); anchors lệch lời → lỗi, không nạp', () => {
  const ok = parseAnalysisResult({ ok: true, anchors: { pickup: A(0, 0), measures: [{ line: 0, token: 1, confidence: 'HIGH' }], extra: 1 }, confidence: { overall: 'HIGH', measures: [] }, review: { needsReview: false, measures: [], notes: [] }, diagnostics: {} }, TEXT_5_4)
  assert.ok(ok.ok)
  assert.deepEqual(ok.anchors, { pickup: A(0, 0), measures: [A(0, 1)] })
  assert.deepEqual(parseAnalysisResult({ ok: true, anchors: { measures: [A(0, 9)] } }, TEXT_5_4), { ok: false, error: { code: 'invalid_anchors', message: 'Kết quả phân tích không khớp lời hiện tại.' } })
  assert.equal(parseAnalysisResult({ ok: false, error: { code: 'x', message: 'hỏng' } }, TEXT_5_4).ok, false)
  const missing = parseAnalysisResult({ ok: true, anchors: { measures: [A(0, 1)] } }, TEXT_5_4)
  assert.ok(missing.ok && missing.review.needsReview, 'thiếu thông tin review → coi như cần kiểm')
})

test('adapter HTTP: health + POST /analyze (base64, số chữ mỗi dòng); mạng hỏng → ok:false, không ném', async () => {
  const calls: { url: string; body?: Record<string, unknown> }[] = []
  const fetcher = (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (url.endsWith('/health')) return new Response(JSON.stringify({ ok: true }))
    return new Response(JSON.stringify({ ok: true, anchors: { measures: [A(0, 1)] }, confidence: { overall: 'HIGH', measures: [] }, review: { needsReview: false, measures: [], notes: [] }, diagnostics: {} }))
  }) as typeof fetch
  const analyzer = createHttpMeasureAnalyzer('http://x', fetcher)
  assert.equal(await analyzer.available(), true)
  const r = await analyzer.analyze({ versionId: 'v', loadFiles: async () => [{ name: 'a.png', mime: 'image/png', data: new Blob(['abc']) }], text: TEXT_5_4, meter: null })
  assert.ok(r.ok)
  assert.deepEqual(calls[1].body, { files: [{ mime: 'image/png', base64: 'YWJj' }], lineTokenCounts: [5, 4], lineTokenLengths: [[3, 3, 2, 3, 3], [3, 3, 3, 4]], meter: null, traceId: null })
  const down = createHttpMeasureAnalyzer('http://x', (async () => { throw new Error('ECONNREFUSED') }) as typeof fetch)
  assert.equal(await down.available(), false)
  assert.equal((await down.analyze({ versionId: 'v', loadFiles: async () => [], text: TEXT_5_4, meter: null })).ok, false)
})

test('adapter PRODUCTION: chỉ gửi { versionId } + Bearer JWT phiên hiện tại; không https / không có URL → không có analyzer (nút khoá, không rơi về localhost)', async () => {
  const calls: { url: string; init?: RequestInit }[] = []
  const fetcher = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    if (url.endsWith('/health')) return new Response(JSON.stringify({ ok: true, version: 'measure-analyzer/0.2.0' }))
    return new Response(JSON.stringify({ ok: true, anchors: { measures: [A(0, 1)] }, confidence: { overall: 'HIGH', measures: [] }, review: { needsReview: false, measures: [], notes: [] }, diagnostics: {} }))
  }) as typeof fetch
  const analyzer = createWorkerMeasureAnalyzer('https://worker.example/', async () => 'jwt-cua-phien', fetcher)
  assert.equal(await analyzer.available(), true)
  let loaded = false
  const r = await analyzer.analyze({ versionId: '11111111-1111-4111-8111-111111111111', text: TEXT_5_4, meter: null, loadFiles: async () => { loaded = true; return [] } })
  assert.ok(r.ok)
  assert.equal(calls[1].url, 'https://worker.example/analyze-measures')
  assert.equal(calls[1].init!.body, JSON.stringify({ versionId: '11111111-1111-4111-8111-111111111111' }), 'không gửi lời / file / đường dẫn / uid')
  assert.equal((calls[1].init!.headers as Record<string, string>).authorization, 'Bearer jwt-cua-phien')
  assert.equal(loaded, false, 'không đọc byte file trong browser')
  const noSession = createWorkerMeasureAnalyzer('https://worker.example', async () => null, fetcher)
  assert.deepEqual(await noSession.analyze({ versionId: 'v', text: TEXT_5_4, meter: null, loadFiles: async () => [] }), { ok: false, error: { code: 'unauthorized', message: 'Cần đăng nhập lại để phân tích.' } })
  const token = async () => 'x'
  assert.equal(productionMeasureAnalyzer(undefined, token), undefined)
  assert.equal(productionMeasureAnalyzer('', token), undefined)
  assert.equal(productionMeasureAnalyzer('http://127.0.0.1:54398', token), undefined, 'không bao giờ dùng cầu dev')
  assert.ok(productionMeasureAnalyzer('https://mac-mini.example.ts.net', token))
  const offline = createWorkerMeasureAnalyzer('https://worker.example', token, (async () => { throw new Error('offline') }) as typeof fetch)
  assert.equal(await offline.available(), false)
  assert.equal((await offline.analyze({ versionId: 'v', text: TEXT_5_4, meter: null, loadFiles: async () => [] })).ok, false)
})

const goldDir = process.env.MEASURE_GOLDEN_DIR
// thiếu thư mục HOẶC thiếu file gold → SKIP rõ ràng, không bao giờ giả PASS
const golden = goldDir && ['text.txt', 'gold4.json', 'sources.json'].every(f => existsSync(join(goldDir, f))) ? goldDir : undefined
// GOLD ĐỘC LẬP 4 câu đầu (gold4.json) — chỉ dùng ở ASSERTION. Bộ 48 ô POC cũ KHÔNG còn là đáp án.
test('GOLD 4 câu (ngoài git): Chuyến Tàu Hoàng Hôn — lấy đà đúng, 12/12 ô, không vạch ở "Ngừng", có vạch ở "trôi"; cả khi thứ tự trang bị đảo', { skip: !golden && 'không có gold độc lập (MEASURE_GOLDEN_DIR với text.txt + gold4.json + sources.json, NGOÀI git)' }, async () => {
  const text = readFileSync(join(golden!, 'text.txt'), 'utf8')
  const gold = JSON.parse(readFileSync(join(golden!, 'gold4.json'), 'utf8')) as { pickup: unknown; measures: { line: number; token: number }[]; mustNot: { line: number; token: number }[]; must: { line: number; token: number }[]; coversLines: number }
  const pages = (JSON.parse(readFileSync(join(golden!, 'sources.json'), 'utf8')) as string[]).map(path => ({ path: join(golden!, path), mime: 'image/jpeg' }))
  for (const order of [pages, [...pages].reverse()]) {
    const r = await runAnalyzer(text, order)
    assert.ok(r.ok)
    assert.deepEqual(r.anchors.pickup, gold.pickup)
    const inGold = r.anchors.measures.filter(m => m.line !== null && m.line < gold.coversLines)
    assert.deepEqual(inGold, gold.measures, '12/12 — không thừa, không thiếu, không lệch')
    for (const no of gold.mustNot) assert.ok(!r.anchors.measures.some(m => m.line === no.line && m.token === no.token), 'ô đo xuyên dòng lời: không mở ô ở chữ đầu dòng')
    for (const yes of gold.must) assert.ok(r.anchors.measures.some(m => m.line === yes.line && m.token === yes.token))
  }
})
