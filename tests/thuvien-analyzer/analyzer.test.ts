// Analyzer vạch nhịp (5B): sheet TỔNG HỢP sinh tại chỗ (biết trước đáp án, không bản quyền) + hợp đồng TS + adapter HTTP.
// Golden thật (ảnh + lời có bản quyền, NGOÀI git) chỉ chạy khi có MEASURE_GOLDEN_DIR.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { anchorLines } from '../../src/thuvien/chordAnchors.ts'
import { analysisLineCounts, analysisTokenLengths, createHttpMeasureAnalyzer, createWorkerMeasureAnalyzer, parseAnalysisResult, productionMeasureAnalyzer } from '../../src/thuvien/measureAnalysis.ts'
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
  // CASE A — ô ngân là biểu diễn HỢP LỆ (contract Rhythm Scroll): trùng vị trí chỉ là thông tin, KHÔNG tham gia confidence
  assert.deepEqual(r.anchors.measures[3], r.anchors.measures[4], 'ô trùng vẫn còn nguyên')
  assert.deepEqual(r.review.measures, [], 'ô trùng một mình không LOW, không vào danh sách cần kiểm')
  assert.equal(r.review.needsReview, false, 'ô trùng một mình không bật needsReview')
  assert.notEqual(r.confidence.overall, 'LOW')
  assert.equal(r.confidence.measures[0].confidence, 'HIGH')
  const held = r.confidence.measures[4]
  assert.equal(held.confidence, 'HIGH', 'điểm = điểm của bằng chứng vạch, không bị cap 0.3')
  assert.ok(held.score >= 0.8)
  assert.doesNotMatch(held.reasons.join(' '), /cần thầy chọn|ô ngân hay ô không lời/, 'không còn lời cảnh báo')
})

test('CASE B — ô trùng KHÔNG nâng cũng KHÔNG hạ confidence: mọi ô mang đúng confidence của vạch mở ô; bằng chứng xấu độc lập vẫn hạ', async () => {
  const S1 = ['w', '|', 'w', 'w', '|', 'w', 's', 'w']
  const T = 'một hai ba bốn năm\nsáu bảy tám chín'
  const cases: [string, string[][]][] = [
    [T, [S1, ['w', 'w', '|', '|', 'w', 'w']]],     // ô trùng, mọi bằng chứng tốt
    [T, [S1, ['w', 'w', '|', '!', 'w', 'w']]],     // ô trùng mở bằng vạch MỜ → giữ MEDIUM (không bị nâng HIGH, không bị hạ LOW)
    [T, [S1, ['w', 'w', '!', '|', 'w', 'w']]],     // vạch mờ ở ô liền trước ô trùng → ô trùng vẫn HIGH, ô trước vẫn MEDIUM
  ]
  const seen: string[] = []
  let sawDuplicate = false, sawIndependentNonHigh = false
  for (const [text, systems] of cases) {
    const r = await runAnalyzer(text, [png(sheet(systems))])
    assert.ok(r.ok)
    const boundaries = r.diagnostics.boundaries
    for (const [i, m] of r.confidence.measures.entries()) {
      const bar: { confidence: string } | undefined = m.boundary === undefined ? undefined : boundaries[m.boundary]
      if (!bar) continue
      assert.equal(m.confidence, bar.confidence, `ô ${i + 1}: confidence = confidence của vạch mở ô (không bị ép)`)
      const dup = i > 0 && r.anchors.measures[i].line === r.anchors.measures[i - 1].line && r.anchors.measures[i].token === r.anchors.measures[i - 1].token
      if (dup) sawDuplicate = true
      if (dup && m.confidence !== 'HIGH') sawIndependentNonHigh = true
      if (dup) seen.push(`${m.confidence}:${m.score}`)
    }
  }
  assert.ok(sawDuplicate, 'có ô trùng trong fixture')
  assert.ok(sawIndependentNonHigh, 'ô trùng mang bằng chứng xấu độc lập vẫn giữ mức MEDIUM/LOW của nó (không bị nâng)')
  assert.deepEqual(seen, ['HIGH:1', 'MEDIUM:0.75', 'HIGH:1'])
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

const hasTiff2pdf = (() => { try { execFileSync('sh', ['-c', 'command -v tiff2pdf']); return true } catch { return false } })()
test('PDF SCAN 1-bit CCITT (Tình ca): trước đây 422 unsupported (pdfimages -all ra .ccitt/.params) → nay đọc được, cùng vạch như ảnh', { skip: !hasTiff2pdf && 'máy không có tiff2pdf' }, async () => {
  const items = [['w', '|', 'w', 'w', '|', 'w', 's', 'w'], ['w', 'w', '|', '|', 'w', 'w']]
  const base = sheet(items)
  const tif = join(dir, 'ccitt.tif')
  const pdf = join(dir, 'ccitt.pdf')
  execFileSync('python3', ['-c', `from PIL import Image; Image.open(${JSON.stringify(base)}).convert('L').point(lambda v: 255 if v > 160 else 0).convert('1').save(${JSON.stringify(tif)}, compression='group4')`])
  execFileSync('tiff2pdf', ['-o', pdf, tif])
  assert.match(execFileSync('pdfimages', ['-list', pdf]).toString(), /ccitt/, 'fixture thật sự là CCITT')
  const r = await runAnalyzer(TEXT_5_4, [{ path: pdf, mime: 'application/pdf' }])
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error))
  assert.deepEqual(r.anchors, { pickup: A(0, 0), measures: [A(0, 1), A(0, 3), A(1, 0), A(1, 2), A(1, 2)] })
})

test('OCR ↔ lời chuẩn (ocrDocs giả, không chạy tesseract): cùng anchors như căn chỉnh độ rộng; anchors trỏ vào lời CHUẨN; chữ OCR sai chính tả vẫn định vị đúng', async () => {
  const systems = [['w', '|', 'w', 'w', '|', 'w', 's', 'w'], ['w', 'w', '|', '|', 'w', 'w']]
  const png1 = png(sheet(systems))
  // vị trí chữ trong sheet tổng hợp (synth.py): x của mục i = left + 3·gap + (i+1)·step, hàng lời ở lines[4] + 3·gap
  const W = 900, gap = 8, left = 60, right = W - 40, H = 352
  const words = [['Một', 'hai', 'ba', 'bốn', 'năm'], ['sáu', 'bảy', 'tám', 'chín']]
  const typo = [['Mot', 'hái', 'bà', 'bồn', 'nam'], ['sau', 'bãy', 'tam', 'chín']]      // OCR sai dấu/chữ — chỉ để định vị
  const tokens = systems.map((items, si) => {
    const step = (right - left - 4 * gap) / (items.length + 1)
    const out: { text: string; bbox: number[] }[] = []
    let wi = 0
    items.forEach((item, i) => {
      if (item[0] !== 'w') return
      const x = left + 3 * gap + (i + 1) * step
      out.push({ text: typo[si][wi++], bbox: [(x - 12) / W, (60 + si * 136 + 4 * gap + 3 * gap) / H, 24 / W, 10 / H] })
    })
    return out
  })
  const doc = { pages: [{ regions: [{ kind: 'lyric_block', lines: tokens.map((toks, si) => ({ role: 'lyric', bbox: [0.1, toks[0].bbox[1], 0.8, 0.03], tokens: toks.map(t => ({ ...t })) })) }] }] }
  const raw = await runAnalyzerRaw({ sources: [png1], lineTokenCounts: analysisLineCounts(TEXT_5_4), lineTokenLengths: analysisTokenLengths(TEXT_5_4), lineWords: words, ocrDocs: [doc] }) as { ok: boolean; anchors: unknown; diagnostics: { alignment?: { method: string; systems: { rows: { status: string }[] }[]; unresolvedBars: unknown[] } } }
  assert.equal(raw.ok, true)
  assert.deepEqual(raw.anchors, { pickup: A(0, 0), measures: [A(0, 1), A(0, 3), A(1, 0), A(1, 2), A(1, 2)] })
  assert.equal(raw.diagnostics.alignment?.method, 'ocr-local-v1')
  assert.deepEqual(raw.diagnostics.alignment?.systems.map(s => s.rows[0].status), ['MATCH', 'MATCH'])
  assert.deepEqual(raw.diagnostics.alignment?.unresolvedBars, [])
  // lời chuẩn dạng chữ không khớp số đếm → bỏ qua OCR, vẫn chạy như cũ (không hỏng)
  const bad = await runAnalyzerRaw({ sources: [png1], lineTokenCounts: analysisLineCounts(TEXT_5_4), lineTokenLengths: analysisTokenLengths(TEXT_5_4), lineWords: [['x']], ocrDocs: [doc] }) as { ok: boolean; diagnostics: { alignment?: unknown } }
  assert.equal(bad.ok, true)
  assert.equal(bad.diagnostics.alignment, undefined)
})

test('OCR hỏng KHÔNG làm hỏng analyzer: engine lỗi / lệch số trang / lời chuẩn sai kiểu → rơi về căn chỉnh theo độ rộng, cùng anchors, có cảnh báo', async () => {
  const sys = [['w', '|', 'w', 'w', '|', 'w', 's', 'w'], ['w', 'w', '|', '|', 'w', 'w']]
  const src = png(sheet(sys))
  const base = { sources: [src], lineTokenCounts: analysisLineCounts(TEXT_5_4), lineTokenLengths: analysisTokenLengths(TEXT_5_4) }
  const words = [['Một', 'hai', 'ba', 'bốn', 'năm'], ['sáu', 'bảy', 'tám', 'chín']]
  const expected = { pickup: A(0, 0), measures: [A(0, 1), A(0, 3), A(1, 0), A(1, 2), A(1, 2)] }
  type Out = { ok: boolean; anchors: unknown; diagnostics: { alignment?: unknown; warnings: { code: string }[] } }
  const run = async (extra: Record<string, unknown>) => await runAnalyzerRaw({ ...base, ...extra }) as Out
  const cases: [string, Record<string, unknown>, string][] = [
    ['engine OCR không chạy được (tessdata không tồn tại / tesseract lỗi)', { lineWords: words, ocr: { tessdataDir: '/khong/ton/tai' } }, 'OCR_UNAVAILABLE'],
    ['số trang OCR ≠ số trang phân tích', { lineWords: words, ocrDocs: [{ pages: [{ regions: [] }, { regions: [] }] }] }, 'OCR_PAGE_MISMATCH'],
    ['OCR không khớp hàng lời nào', { lineWords: words, ocrDocs: [{ pages: [{ regions: [{ kind: 'lyric_block', lines: [{ role: 'lyric', bbox: [0, 0.3, 1, 0.03], tokens: ['xq', 'zv', 'wk'].map((text, i) => ({ text, bbox: [0.1 + i * 0.1, 0.3, 0.05, 0.02] })) }] }] }] }] }, 'OCR_NO_MATCH'],
    ['lời chuẩn sai kiểu (không phải chuỗi)', { lineWords: [[1, 2, 3, 4, 5], [6, 7, 8, 9]], ocrDocs: [{ pages: [{ regions: [] }] }] }, 'OCR_ERROR'],
  ]
  for (const [name, extra, code] of cases) {
    const r = await run(extra)
    assert.equal(r.ok, true, name)
    assert.deepEqual(r.anchors, expected, `${name}: anchors như căn chỉnh theo độ rộng`)
    assert.equal(r.diagnostics.alignment, undefined, name)
    assert.ok(r.diagnostics.warnings.some(w => w.code === code), `${name}: cảnh báo ${code}`)
  }
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

test('adapter PRODUCTION: chỉ gửi { versionId } + Bearer JWT phiên hiện tại; thăm dò bằng POST (không GET); chỉ https hoặc loopback http, còn lại → không có analyzer (nút khoá)', async () => {
  const calls: { url: string; init?: RequestInit }[] = []
  const fetcher = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    if (url.endsWith('/extract-probe')) return new Response(JSON.stringify({ ok: true, kind: 'chord-extract-worker', schema: 'chord-extraction/1' }))
    return new Response(JSON.stringify({ ok: true, anchors: { measures: [A(0, 1)] }, confidence: { overall: 'HIGH', measures: [] }, review: { needsReview: false, measures: [], notes: [] }, diagnostics: {} }))
  }) as typeof fetch
  const analyzer = createWorkerMeasureAnalyzer('https://worker.example/', async () => 'jwt-cua-phien', fetcher)
  assert.equal(await analyzer.available(), true)
  assert.deepEqual([calls[0].url, calls[0].init!.method], ['https://worker.example/extract-probe', 'POST'], 'availability = POST probe, không GET /health (service worker chặn GET loopback)')
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
  assert.ok(productionMeasureAnalyzer('http://127.0.0.1:7430', token), 'worker loopback trên máy Owner')
  assert.equal(productionMeasureAnalyzer('http://worker.example', token), undefined, 'http không phải loopback → không dùng')
  assert.equal(productionMeasureAnalyzer('off', token), undefined)
  assert.ok(productionMeasureAnalyzer('https://mac-mini.example.ts.net', token))
  // Nhiều địa chỉ: loopback trước, Funnel cũ chết thì vẫn dùng loopback; loopback chết thì lùi về địa chỉ cấu hình.
  const probeOk = { ok: true, kind: 'chord-extract-worker' }
  const hits: string[] = []
  const reach = (alive: string[]) => (async (url: string) => {
    hits.push(String(url))
    if (!alive.some(a => String(url).startsWith(a))) throw new TypeError('Failed to fetch')
    return new Response(JSON.stringify(String(url).endsWith('/extract-probe') ? probeOk : { ok: false, error: { code: 'bad_request' } }), { status: 200 })
  }) as unknown as typeof fetch
  const LOOP = 'http://127.0.0.1:7430', FUNNEL = 'https://mac-mini.example.ts.net:8443'
  const both = productionMeasureAnalyzer([LOOP, FUNNEL], token, reach([LOOP]))!
  assert.equal(await both.available(), true, 'Funnel chết không kéo loopback xuống')
  assert.deepEqual(hits, [`${LOOP}/extract-probe`], 'loopback được thử trước; thấy sống thì không gọi địa chỉ sau')
  hits.length = 0
  const onlyFunnel = productionMeasureAnalyzer([LOOP, FUNNEL], token, reach([FUNNEL]))!
  assert.equal(await onlyFunnel.available(), true)
  assert.deepEqual(hits, [`${LOOP}/extract-probe`, `${FUNNEL}/extract-probe`])
  assert.equal(await productionMeasureAnalyzer([LOOP, FUNNEL], token, reach([]))!.available(), false)
  assert.equal(productionMeasureAnalyzer([undefined, 'off'], token), undefined)
  assert.ok(productionMeasureAnalyzer([undefined, FUNNEL], token), 'không rpc + có env → chỉ env')
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

// ── Nhiều lời dưới một khuông (Multi-verse anchors V1) ───────────────────────────────────────────────────────
// Sheet tổng hợp: 2 khuông, bố cục như TEXT_5_4 (lấy đà + vạch). Lời 2 là hàng OCR thứ hai dưới mỗi khuông, số âm tiết KHÁC lời 1
// và rải đều nên vạch rơi vào token khác lời 1 — kiểm chứng "token riêng", không mặc định cùng vị trí.
const TEXT_2_VERSES = '1. Một [C] hai ba bốn năm\nĐK: [G] sáu bảy tám [Am] chín\n2. Xanh đỏ tím vàng nâu hồng\nĐK: Lam [G] lục cam'
const WORDS_2_VERSES = [['Một', 'hai', 'ba', 'bốn', 'năm'], ['sáu', 'bảy', 'tám', 'chín'], ['Xanh', 'đỏ', 'tím', 'vàng', 'nâu', 'hồng'], ['Lam', 'lục', 'cam']]
const V_SYSTEMS = [['w', '|', 'w', 'w', '|', 'w', 's', 'w'], ['w', 'w', '|', '|', 'w', 'w']]
const SW = 900, SH = 352, SGAP = 8, SLEFT = 60, SRIGHT = SW - 40
const barX = (items: string[], k: number) => SLEFT + 3 * SGAP + (k + 1) * ((SRIGHT - SLEFT - 4 * SGAP) / (items.length + 1))

/** Hàng OCR của một khuông: chữ rải đều giữa lề trái và phải; `y0` = đáy khuông + dải lời (px), `row` = 0 lời 1, 1 lời 2. */
function ocrRow(words: string[], si: number, row: number, x0 = 80, x1 = 820, H = SH) {
  const y = 60 + si * 136 + 7 * SGAP + row * 18
  const xs = words.map((_, i) => x0 + ((i + 0.5) * (x1 - x0)) / words.length)
  return { xs, line: { role: 'lyric', bbox: [0.1, y / H, 0.8, 0.03], tokens: words.map((text, i) => ({ text, bbox: [(xs[i] - 12) / SW, y / H, 24 / SW, 10 / H] })) } }
}
const ocrDoc = (lines: unknown[]) => ({ pages: [{ regions: [{ kind: 'lyric_block', lines }] }] })
/** Token đứng đầu sau vạch x theo hàng chữ `xs` (chữ đầu có tâm ≥ x); hết hàng → số chữ. Tính độc lập, không dùng code của analyzer. */
const tokenAfter = (xs: number[], x: number) => { const k = xs.findIndex(v => v >= x); return k < 0 ? xs.length : k }

type VerseOut = {
  ok: boolean; anchors: { pickup?: { line: number; token: number }; measures: { line: number; token: number }[] }
  review: { needsReview: boolean; notes: string[] }; confidence: { measures: { measure: number; verse?: number }[] }
  diagnostics: { alignment?: { verses: { built: { verse: number; measures: number }[]; withheld: { verse: number; reason: string }[] } }; warnings: { code: string }[] }
  error?: { code: string }
}
const verseBase = () => ({ sources: [png(sheet(V_SYSTEMS))], lineTokenCounts: analysisLineCounts(TEXT_2_VERSES), lineTokenLengths: analysisTokenLengths(TEXT_2_VERSES), lineWords: WORDS_2_VERSES })

test('hai lời dưới một khuông: lời 1 giữ NGUYÊN, lời 2 nối tiếp với token RIÊNG (số âm tiết khác lời 1)', async () => {
  const v1 = V_SYSTEMS.map((_, si) => ocrRow(WORDS_2_VERSES[si], si, 0))
  const v2 = V_SYSTEMS.map((_, si) => ocrRow(WORDS_2_VERSES[si + 2], si, 1))
  const only1 = await runAnalyzerRaw({ ...verseBase(), ocrDocs: [ocrDoc(v1.map(r => r.line))] }) as VerseOut
  const raw = await runAnalyzerRaw({ ...verseBase(), ocrDocs: [ocrDoc([...v1, ...v2].map(r => r.line))] }) as VerseOut
  assert.equal(raw.ok, true)
  assert.equal(only1.diagnostics.alignment?.verses.built.length, 0, 'một hàng lời → không có lượt phụ')
  const head = only1.anchors.measures
  assert.deepEqual(raw.anchors.measures.slice(0, head.length), head, 'lời 1 không đổi so với khi chỉ có một hàng lời')
  assert.deepEqual(raw.anchors.pickup, only1.anchors.pickup, 'nhịp lấy đà không đổi')
  // Đáp án lời 2 tính ĐỘC LẬP (không dùng code analyzer): vạch ở mục 1,4 (khuông 1) và 2,3 (khuông 2); chữ đầu có tâm ≥ vạch.
  // Vạch phải của khuông 1 hết hàng → chữ đầu hàng lời 2 của khuông 2. Bài CÓ nhịp lấy đà: lời 2 KHÔNG có ô lấy đà riêng — cùng số ô với lời 1.
  const expectedTail = [
    { line: 2, token: tokenAfter(v2[0].xs, barX(V_SYSTEMS[0], 1)) },
    { line: 2, token: tokenAfter(v2[0].xs, barX(V_SYSTEMS[0], 4)) },
    { line: 3, token: 0 },
    { line: 3, token: tokenAfter(v2[1].xs, barX(V_SYSTEMS[1], 2)) },
    { line: 3, token: tokenAfter(v2[1].xs, barX(V_SYSTEMS[1], 3)) },
  ]
  assert.deepEqual(expectedTail.map(a => a.token), [1, 3, 0, 1, 2], 'đáp án tính tay')
  assert.equal(expectedTail.length, head.length, 'cùng giai điệu → cùng số ô')
  assert.deepEqual(raw.anchors.measures.slice(head.length), expectedTail)
  assert.equal(raw.review.needsReview, true, 'có lấy đà → thầy kiểm phần lấy đà của lời 2')
  assert.ok(raw.review.notes.some(n => n.includes('nhịp lấy đà') && n.includes('lời 2')))
  assert.deepEqual(raw.diagnostics.alignment?.verses, { built: [{ verse: 2, measures: expectedTail.length }], withheld: [] })
  assert.ok(raw.confidence.measures.slice(head.length).every(m => m.verse === 2))
  assert.ok(raw.review.notes.some(n => n.includes('hàng lời thứ 2')))
})

test('hàng lời 2 chỉ có ở một số khuông → KHÔNG dựng lời 2 (không đoán), bắt buộc duyệt, ghi rõ khuông nào', async () => {
  const v1 = V_SYSTEMS.map((_, si) => ocrRow(WORDS_2_VERSES[si], si, 0))
  const v2first = ocrRow(WORDS_2_VERSES[2], 0, 1)
  const full = await runAnalyzerRaw({ ...verseBase(), ocrDocs: [ocrDoc(v1.map(r => r.line))] }) as VerseOut
  const raw = await runAnalyzerRaw({ ...verseBase(), ocrDocs: [ocrDoc([...v1.map(r => r.line), v2first.line])] }) as VerseOut
  assert.equal(raw.ok, true)
  assert.deepEqual(raw.anchors.measures, full.anchors.measures, 'chỉ còn lượt 1')
  assert.deepEqual(raw.diagnostics.alignment?.verses.built, [])
  assert.deepEqual(raw.diagnostics.alignment?.verses.withheld.map(w => [w.verse, w.reason]), [[2, 'missing_row']])
  assert.equal(raw.review.needsReview, true)
  assert.ok(raw.review.notes.some(n => n.includes('KHÔNG dựng lời 2') && n.includes('khuông 2')))
})

test('sheet nhiều lời mà không có OCR: căn chỉnh theo độ rộng KHÔNG tự dựng vạch (lỗi có mã); sheet một lời không đổi', async () => {
  const noOcr = await runAnalyzerRaw({ ...verseBase(), lineWords: undefined }) as VerseOut
  assert.equal(noOcr.ok, false)
  assert.equal(noOcr.error?.code, 'width_only_incomplete_lyrics')
  const dead = await runAnalyzerRaw({ ...verseBase(), ocr: { tessdataDir: '/khong/ton/tai' } }) as VerseOut
  assert.equal(dead.ok, false, 'engine OCR không chạy được + nhiều lời → không rơi về width-only sai')
  assert.equal(dead.error?.code, 'width_only_incomplete_lyrics')
  const single = await runAnalyzerRaw({ sources: [png(sheet(V_SYSTEMS))], lineTokenCounts: analysisLineCounts(TEXT_5_4), lineTokenLengths: analysisTokenLengths(TEXT_5_4) }) as VerseOut
  assert.equal(single.ok, true, 'bài một lời vẫn chạy width-only như cũ')
  assert.deepEqual(single.anchors, { pickup: A(0, 0), measures: [A(0, 1), A(0, 3), A(1, 0), A(1, 2), A(1, 2)] })
})

test('không có lấy đà: ô 1 có ở cả hai lời (cùng cấu trúc nhịp, token riêng); không có ô thừa, không ghi chú lấy đà', async () => {
  const H1 = 216                                                                       // ảnh một khuông: 80 + (4·8 + 9·8 + 4·8)
  // Chữ nằm DƯỚI ĐÚNG NỐT của sheet (mục 'w'): hàng 1 mỗi nốt một chữ; hàng 2 có số âm tiết khác (hai chữ chung một nốt, hoặc bỏ nốt).
  const under = (items: string[], k: number, dx = 0) => barX(items, k) + dx
  const rowAt = (words: string[], xs: number[], row: number) => {
    const y = 60 + 7 * SGAP + row * 18
    return { xs, line: { role: 'lyric', bbox: [0.1, y / H1, 0.8, 0.03], tokens: words.map((text, i) => ({ text, bbox: [(xs[i] - 12) / SW, y / H1, 24 / SW, 10 / H1] })) } }
  }
  const cases = [
    { name: 'vạch ngay trước chữ đầu (ô 1 = chữ đầu)', items: ['|', 'w', 'w', '|', 'w'], text: 'một hai ba\nxanh đỏ tím vàng nâu',
      v1: ['một', 'hai', 'ba'], x1: [1, 2, 4].map(k => under(['|', 'w', 'w', '|', 'w'], k)),
      v2: ['xanh', 'đỏ', 'tím', 'vàng', 'nâu'], x2: [under(['|', 'w', 'w', '|', 'w'], 1), under(['|', 'w', 'w', '|', 'w'], 2, -8), under(['|', 'w', 'w', '|', 'w'], 2, 8), under(['|', 'w', 'w', '|', 'w'], 4, -8), under(['|', 'w', 'w', '|', 'w'], 4, 8)],
      head: [A(0, 0), A(0, 2)], barItems: [0, 3], tailTokens: [0, 3], firstLine2: false },
    { name: 'ô đầu đầy đủ, không vạch mở đầu (ô 1 suy ra)', items: ['w', 'w', 'w', 'w', '|', 'w', '|', 'w'], text: 'một hai ba bốn năm sáu\nxanh đỏ tím vàng nâu',
      v1: ['một', 'hai', 'ba', 'bốn', 'năm', 'sáu'], x1: [0, 1, 2, 3, 5, 7].map(k => under(['w', 'w', 'w', 'w', '|', 'w', '|', 'w'], k)),
      v2: ['xanh', 'đỏ', 'tím', 'vàng', 'nâu'], x2: [0, 1, 2, 5, 7].map(k => under(['w', 'w', 'w', 'w', '|', 'w', '|', 'w'], k)),
      head: [A(0, 0), A(0, 4), A(0, 5)], barItems: [4, 6], tailTokens: [3, 4], firstLine2: true },
  ]
  for (const c of cases) {
    const lines = c.text.split('\n').map(l => l.split(' '))
    const r1 = rowAt(c.v1, c.x1, 0), r2 = rowAt(c.v2, c.x2, 1)
    const base = { sources: [png(sheet([c.items]))], lineTokenCounts: analysisLineCounts(c.text), lineTokenLengths: analysisTokenLengths(c.text), lineWords: lines }
    const only1 = await runAnalyzerRaw({ ...base, ocrDocs: [ocrDoc([r1.line])] }) as VerseOut
    const raw = await runAnalyzerRaw({ ...base, ocrDocs: [ocrDoc([r1.line, r2.line])] }) as VerseOut
    assert.equal(only1.ok && raw.ok, true, c.name)
    assert.equal(only1.anchors.pickup, undefined, `${c.name}: không phải lấy đà`)
    assert.deepEqual(only1.anchors.measures, c.head, `${c.name}: lời 1 như dự kiến`)
    assert.equal(raw.anchors.pickup, undefined)
    assert.deepEqual(raw.anchors.measures.slice(0, c.head.length), c.head, `${c.name}: lời 1 không đổi`)
    // đáp án lời 2 độc lập: ô 1 ở đầu hàng (nếu suy ra) + chữ đầu có tâm ≥ từng vạch (kể cả vạch ngay trước chữ đầu)
    const tokens = c.barItems.map(k => tokenAfter(r2.xs, barX(c.items, k)))
    assert.deepEqual(tokens, c.tailTokens, `${c.name}: đáp án tính tay`)
    const tail = [...(c.firstLine2 ? [A(1, 0)] : []), ...tokens.map(t => A(1, t))]
    assert.equal(tail.length, c.head.length, `${c.name}: cùng số ô`)
    assert.deepEqual(raw.anchors.measures.slice(c.head.length), tail, `${c.name}: lời 2 token riêng`)
    assert.ok(tail.some((a, i) => a.token !== c.head[i].token), `${c.name}: có ô lời 2 khác token lời 1`)
    assert.ok(!raw.review.notes.some(n => n.includes('nhịp lấy đà')), `${c.name}: không có ghi chú lấy đà`)
    assert.deepEqual(raw.diagnostics.alignment?.verses.built, [{ verse: 2, measures: c.head.length }])
  }
})

// ── Tình ca thật (2 lời dưới mỗi khuông). Ảnh + lời CÓ BẢN QUYỀN → NGOÀI git: chạy khi có MEASURE_TINHCA_DIR (tinh-ca.pdf, text.txt = lời chuẩn
// v7, anchors.json = 40 ô thầy đặt tay cho lời 1) và MEASURE_TESSDATA (thư mục có vie.traineddata). Không có → SKIP, KHÔNG tính là PASS gate ảnh thật.
const tinhCaDir = process.env.MEASURE_TINHCA_DIR
const tessdata = process.env.MEASURE_TESSDATA
test('GOLD Tình ca (ngoài git): 80 ô — lời 1 đúng 40/40 như thầy đặt tay; lời 2 đúng 40 ô nằm trong lời 2/ĐK 2, token riêng', { skip: (!tinhCaDir || !tessdata) && 'thiếu MEASURE_TINHCA_DIR / MEASURE_TESSDATA' }, async () => {
  const text = readFileSync(join(tinhCaDir!, 'text.txt'), 'utf8')
  const manual = JSON.parse(readFileSync(join(tinhCaDir!, 'anchors.json'), 'utf8')).measures as { line: number; token: number }[]
  const counts = analysisLineCounts(text)
  const raw = await runAnalyzerRaw({ sources: [{ path: join(tinhCaDir!, 'tinh-ca.pdf'), mime: 'application/pdf' }], lineTokenCounts: counts, lineTokenLengths: analysisTokenLengths(text),
    lineWords: anchorLines(text).map(line => line.tokens.map(token => token.word)), ocr: { tessdataDir: tessdata } }) as VerseOut
  assert.equal(raw.ok, true)
  const ms = raw.anchors.measures
  assert.equal(ms.length, 80, '40 ô lời 1 + 40 ô lời 2')
  assert.deepEqual(raw.diagnostics.alignment?.verses, { built: [{ verse: 2, measures: 40 }], withheld: [] })
  // Lời 1: so với bộ vạch thầy đặt. Vạch cuối dòng (token = số chữ) và đầu dòng kế là CÙNG một chỗ nghe → so theo dạng chuẩn hoá.
  const norm = (a: { line: number; token: number }) => a.token >= counts[a.line] ? { line: nextSung(a.line), token: 0 } : a
  const nextSung = (line: number) => { let l = line + 1; while (l < counts.length && counts[l] === 0) l += 1; return l }
  assert.deepEqual(ms.slice(0, 40).map(norm), manual.map(norm), 'lời 1: 40/40 không đổi')
  // Lời 2: mọi ô nằm trong lời 2 (dòng 15–21) hoặc ĐK 2 (23–28); cùng giai điệu nên mỗi ô ở cùng chỗ với ô lời 1 (cộng 123 chữ), TRỪ nơi lời 2
  // được hát lệch một âm tiết — token RIÊNG theo hàng chữ của lời 2, không mặc định bằng lời 1.
  const tail = ms.slice(40)
  assert.ok(tail.every(a => (a.line >= 15 && a.line <= 21) || (a.line >= 23 && a.line <= 28)), 'không ô nào rơi ngoài lời 2 / ĐK 2')
  const flat = (a: { line: number; token: number }) => counts.slice(0, a.line).reduce((sum, c) => sum + c, 0) + a.token
  const verse1Chars = counts.slice(0, 15).reduce((sum, c) => sum + c, 0)
  assert.equal(counts.slice(0, 14).join(), counts.slice(15).join(), 'fixture: lời 2 được soạn cùng số chữ mỗi dòng với lời 1')
  const shifts = tail.map((a, i) => flat(a) - (flat(ms[i]) + verse1Chars))
  assert.ok(shifts.every(d => Math.abs(d) <= 1), `mọi ô lời 2 trong phạm vi một âm tiết của ô lời 1: ${shifts.join()}`)
  assert.ok(shifts.some(d => d !== 0), 'ít nhất một ô lời 2 lệch một âm tiết so với lời 1 → token riêng, không sao chép')
  assert.ok(shifts.filter(d => d !== 0).length <= 3, `chỉ vài ô lệch (phụ thuộc mô hình OCR): ${shifts.join()}`)
  assert.equal(raw.review.needsReview, true, 'bắt buộc thầy kiểm thứ tự hát')
})
