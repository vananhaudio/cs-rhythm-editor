// Contextual Share V3.1 — lõi THUẦN khoanh vùng: khung chữ nhật → neo tài liệu ĐÚNG phần được bao → vẽ lại. Hình học giả lập (không DOM).
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildParts, drawParts, marksByLeaf, normRect, parseRegionParts, pickRanges, splitByRanges, summarize, type Rect, type SectionProbe } from '../../src/share/regionAnchor.ts'

const R = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h })
type Leaf = SectionProbe['leaves'][number]

/** Bố cục giả: chữ xuống dòng theo TỪ trong cột rộng `width`, mỗi ký tự rộng `cw`, dòng cao `lh`. Khoảng trắng gập dòng không có hộp (như trình duyệt). */
function layout(text: string, x: number, y: number, width: number, cw = 8, lh = 20): { chars: (Rect | null)[]; rects: Rect[] } {
  const cps = Array.from(text)
  const chars: (Rect | null)[] = new Array(cps.length).fill(null)
  const lines: Rect[] = []
  let cx = 0, line = 0, i = 0
  const place = (k: number) => { chars[k] = R(x + cx * cw, y + line * lh, cw, lh); cx++ }
  while (i < cps.length) {
    if (cps[i] === ' ') { if (cx > 0 && (cx + 1) * cw <= width) place(i); i++; continue }
    let j = i; while (j < cps.length && cps[j] !== ' ') j++
    if (cx > 0 && (cx + (j - i)) * cw > width) { cx = 0; line++ }
    for (let k = i; k < j; k++) place(k)
    i = j
  }
  const byLine = new Map<number, Rect[]>()
  chars.forEach(c => { if (c) byLine.set(c.y, [...(byLine.get(c.y) ?? []), c]) })
  for (const [yy, cs] of byLine) lines.push(R(Math.min(...cs.map(c => c.x)), yy, Math.max(...cs.map(c => c.x + c.w)) - Math.min(...cs.map(c => c.x)), lh))
  return { chars, rects: lines }
}
const leaf = (path: string[], text: string, x: number, y: number, width: number): Leaf => { const l = layout(text, x, y, width); return { path, text, rects: l.rects, chars: () => l.chars } }

const PARA = 'Giữ nhịp thật đều. Hãy nghe kỹ nhịp chùm ba ở ô hai và ô ba trong cả bài, đếm một và a hai và a trước khi thêm lời hát cho bài này nhé.'
// 8px/ký tự, cột 160px ⇒ 20 ký tự/dòng

test('pickRanges: khoanh NỬA đoạn văn → chỉ phần đó (không lấy cả lá)', () => {
  const l = layout(PARA, 20, 100, 160)
  const nLines = new Set(l.chars.filter(Boolean).map(c => c!.y)).size
  assert.ok(nLines >= 5)
  const r = pickRanges(PARA, l.chars, R(10, 100, 200, 40))                  // 2 dòng đầu
  assert.equal(r.length, 1)
  const picked = Array.from(PARA).slice(r[0][0], r[0][1]).join('')
  assert.ok(picked.startsWith('Giữ nhịp') && picked.length < Array.from(PARA).length / 2, picked)
  assert.ok(!picked.includes('trước khi'))
})

test('pickRanges: từ chỉ bị cắt < 50% thì bỏ, ≥ 50% thì lấy cả từ', () => {
  const t = 'abcdefgh ijklmnop'                      // từ 1: x 20..84, từ 2: x 92..156
  const l = layout(t, 20, 0, 400)
  assert.deepEqual(pickRanges(t, l.chars, R(0, 0, 20 + 8 * 3, 20)), [])          // 3/8 ký tự
  assert.deepEqual(pickRanges(t, l.chars, R(0, 0, 20 + 8 * 4, 20)), [[0, 8]])    // 4/8 ký tự ⇒ cả từ
  assert.deepEqual(pickRanges(t, l.chars, R(0, 0, 400, 20)), [[0, 17]])          // cả hai từ liên tiếp ⇒ MỘT đoạn (gồm khoảng trắng giữa)
})

test('pickRanges: khung chỉ bao phần PHẢI các dòng → nhiều đoạn rời, không lấy phần trái', () => {
  const l = layout(PARA, 20, 100, 160)
  const r = pickRanges(PARA, l.chars, R(100, 100, 100, 100))              // nửa phải của 5 dòng đầu
  assert.ok(r.length >= 3)
  for (const [a, b] of r) assert.ok(b > a)
  assert.ok(!Array.from(PARA).slice(r[0][0], r[0][1]).join('').startsWith('Giữ'))
})

test('buildParts: khoanh nửa đoạn → leaves có đoạn, KHÔNG phải cả lá', () => {
  const sec: SectionProbe = { sec: 0, box: R(0, 90, 220, 200), leaves: [leaf(['blocks', '1', 'text'], PARA, 20, 100, 160)], scores: [] }
  const r = buildParts(R(10, 98, 190, 44), [sec])
  assert.ok(r.ok)
  if (!r.ok) return
  const rg = r.parts[0].leaves[0].r
  assert.equal(rg.length, 1)
  assert.ok(rg[0][1] < Array.from(PARA).length - 10, JSON.stringify(rg))
})

test('buildParts: khung bao trọn lá → cả lá (đã cắt khoảng trắng đầu/cuối)', () => {
  const t = 'Khởi động ngón cái'
  const sec: SectionProbe = { sec: 0, box: R(0, 0, 300, 60), leaves: [leaf(['items', '0'], t, 10, 10, 280)], scores: [] }
  const r = buildParts(R(0, 0, 300, 60), [sec])
  assert.ok(r.ok)
  if (r.ok) assert.deepEqual(r.parts[0].leaves, [{ p: ['items', '0'], r: [[0, Array.from(t).length]] }])
})

test('bảng: khoanh 2 trong 4 ô → chỉ 2 ô, không cả bảng', () => {
  const cells = [['rows', '0', '0', 'Ô'], ['rows', '0', '1', 'Việc cần làm'], ['rows', '1', '0', '1'], ['rows', '1', '1', 'Đếm chậm cùng máy nhịp']]
  const leaves = cells.map(([a, b, c, t], i) => leaf([a, b, c], t, 10 + (i % 2) * 150, 10 + Math.floor(i / 2) * 30, 140))
  const sec: SectionProbe = { sec: 0, box: R(0, 0, 320, 80), leaves, scores: [] }
  const r = buildParts(R(0, 0, 320, 36), [sec])                           // chỉ hàng đầu
  assert.ok(r.ok)
  if (!r.ok) return
  assert.deepEqual(r.parts[0].leaves.map(l => l.p.join('.')), ['rows.0.0', 'rows.0.1'])
  const r2 = buildParts(R(150, 0, 170, 80), [sec])                         // chỉ cột phải
  assert.ok(r2.ok)
  if (r2.ok) assert.deepEqual(r2.parts[0].leaves.map(l => l.p.join('.')), ['rows.0.1', 'rows.1.1'])
  const r3 = buildParts(R(0, 40, 160, 40), [sec])                          // chỉ ô trái-dưới
  assert.ok(r3.ok)
  if (r3.ok) assert.deepEqual(r3.parts[0].leaves.map(l => l.p.join('.')), ['rows.1.0'])
})

const bars8 = (dx = 0): SectionProbe['scores'] => [{ p: ['tex'], bars: [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ index: i, rect: R(20 + (i % 4) * 95 + dx, i < 4 ? 220 : 320, 95, 80) })) }]

test('ô nhịp: khoanh vài ô → chỉ dải ô đó; bao < 50% ô thì không tính', () => {
  const sec: SectionProbe = { sec: 1, box: R(10, 210, 400, 200), leaves: [], scores: bars8() }
  const r = buildParts(R(20 + 95 + 10, 225, 95 * 2, 60), [sec])            // ô 2 gần trọn, ô 3 trọn, ô 4 ~ 10%
  assert.ok(r.ok)
  if (!r.ok) return
  assert.deepEqual(r.parts[0].scores, [{ p: ['tex'], from: 2, to: 3 }])
  const half = buildParts(R(20, 225, 40, 60), [sec])                       // 40/95 ≈ 42% của ô 1
  assert.deepEqual(half, { ok: false, reason: 'empty' })
})

test('hỗn hợp: chữ + một phần bản nhạc + hình trong MỘT khung', () => {
  const secs: SectionProbe[] = [
    { sec: 0, box: R(10, 0, 400, 200), leaves: [leaf(['blocks', '0', 'text'], 'Tiêu đề ngắn', 20, 20, 380), leaf(['blocks', '1', 'text'], PARA, 20, 60, 380)], scores: [] },
    { sec: 1, box: R(10, 210, 400, 200), leaves: [], scores: bars8() },
    { sec: 2, box: R(10, 420, 400, 150), leaves: [], scores: [] },
  ]
  const r = buildParts(R(15, 58, 395, 500), secs)
  assert.ok(r.ok)
  if (!r.ok) return
  assert.deepEqual(r.parts.map(p => p.sec), [0, 1, 2])
  assert.equal(r.parts[0].leaves.length, 1)                                // lá tiêu đề nằm trên khung
  assert.deepEqual(r.parts[1].scores, [{ p: ['tex'], from: 1, to: 8 }])
  assert.deepEqual(r.parts[2].leaves, [])                                   // khối hình: giữ bằng hộp (gần đúng)
  assert.match(summarize(r.parts), /3 khối · 1 đoạn chữ · bản nhạc \(ô 1–8\) · 1 vùng hình/)
})

test('khung quá nhỏ / không chạm gì / chỉ chạm lề khối CÓ phần tử gốc → từ chối rõ lý do', () => {
  const sec: SectionProbe = { sec: 0, box: R(0, 0, 400, 200), leaves: [leaf(['text'], 'ngắn', 10, 10, 380)], scores: [] }
  assert.deepEqual(buildParts(R(0, 0, 10, 10), [sec]), { ok: false, reason: 'tooSmall' })
  assert.deepEqual(buildParts(R(600, 600, 100, 100), [sec]), { ok: false, reason: 'empty' })
  assert.deepEqual(buildParts(R(300, 150, 100, 40), [sec]), { ok: false, reason: 'empty' })
})

test('giới hạn: > 12 khối, > 40 lá, > 64 ô, quá nhiều mảnh rời', () => {
  const many: SectionProbe[] = Array.from({ length: 13 }, (_, i) => ({ sec: i, box: R(0, i * 50, 100, 50), leaves: [], scores: [] }))
  assert.deepEqual(buildParts(R(0, 0, 100, 700), many), { ok: false, reason: 'tooManyParts' })
  const leaves = Array.from({ length: 41 }, (_, i) => leaf(['items', String(i), 'text'], 'abcd', 0, i * 20, 100))
  assert.deepEqual(buildParts(R(0, 0, 100, 900), [{ sec: 0, box: R(0, 0, 100, 900), leaves, scores: [] }]), { ok: false, reason: 'tooManyLeaves' })
  const bars = Array.from({ length: 65 }, (_, i) => ({ index: i, rect: R(i * 10, 0, 10, 50) }))
  assert.deepEqual(buildParts(R(0, 0, 700, 50), [{ sec: 0, box: R(0, 0, 700, 50), leaves: [], scores: [{ p: ['tex'], bars }] }]), { ok: false, reason: 'tooManyBars' })
  // 13 dòng, chỉ lấy nửa phải mỗi dòng ⇒ > 12 đoạn rời trong một lá
  const longT = Array.from({ length: 13 }, (_, i) => `aaaa bbbb${i}`).join(' ')
  const l = leaf(['text'], longT, 0, 0, 90)
  assert.deepEqual(buildParts(R(50, 0, 60, 400), [{ sec: 0, box: R(0, 0, 100, 400), leaves: [l], scores: [] }]), { ok: false, reason: 'tooManyRanges' })
})

test('đoạn dài > 1000 điểm mã được cắt ở khoảng trắng', () => {
  const t = Array.from({ length: 400 }, () => 'abcde').join(' ')           // 2399 ký tự
  const l = leaf(['text'], t, 0, 0, 100000)
  const r = buildParts(R(0, 0, 100000, 30), [{ sec: 0, box: R(0, 0, 100000, 30), leaves: [l], scores: [] }])
  assert.ok(r.ok)
  if (!r.ok) return
  const rg = r.parts[0].leaves[0].r
  assert.ok(rg.length >= 3 && rg.every(([a, b]) => b - a <= 1000))
  assert.equal(rg[0][0], 0); assert.equal(rg.at(-1)![1], Array.from(t).length)
})

test('drawParts: vẽ lại theo DOM mới (đổi bề rộng) — đoạn chữ theo chữ, không theo pixel cũ', () => {
  const sec1: SectionProbe = { sec: 0, box: R(0, 0, 220, 300), leaves: [leaf(['blocks', '1', 'text'], PARA, 20, 100, 160)], scores: [] }
  const b = buildParts(R(10, 98, 190, 44), [sec1])
  assert.ok(b.ok)
  if (!b.ok) return
  const lookupAt = (width: number) => {
    const l = layout(PARA, 20, 100, width)
    return {
      section: () => R(0, 0, width + 60, 300),
      leaf: (_s: number, _p: string[], ranges: [number, number][]) => ranges.flatMap(([a, z]) => l.chars.slice(a, z).filter(Boolean) as Rect[]),
      bars: () => [],
    }
  }
  const wide = drawParts(b.parts, lookupAt(160))[0].rects
  const narrow = drawParts(b.parts, lookupAt(80))[0].rects
  assert.ok(wide.length > 0 && narrow.length > 0)
  assert.equal(wide.length, narrow.length)                                  // cùng số ký tự được tô
  assert.notDeepEqual(wide, narrow)                                         // nhưng vị trí đổi theo bố cục mới
  assert.ok(Math.max(...narrow.map(r => r.y + r.h)) > Math.max(...wide.map(r => r.y + r.h)))   // hẹp hơn ⇒ nhiều dòng hơn
  assert.equal(drawParts(b.parts, { ...lookupAt(160), leaf: () => [] })[0].rects.length, 0)      // chữ không còn → không vẽ (không đoán)
})

test('drawParts: phần không phần tử gốc vẽ bằng hộp ‰ và đánh dấu gần đúng', () => {
  const d = drawParts([{ sec: 2, box: [100, 200, 900, 800], leaves: [], scores: [] }], { section: () => R(0, 1000, 400, 100), leaf: () => [], bars: () => [] })
  assert.equal(d[0].approx, true)
  assert.deepEqual(d[0].rects, [R(40, 1020, 320, 60)])
})

test('splitByRanges / marksByLeaf: cắt theo điểm mã; sai biên → null', () => {
  assert.deepEqual(splitByRanges('abc def ghi', [[0, 3], [8, 11]]), [{ t: 'abc', hl: true }, { t: ' def ', hl: false }, { t: 'ghi', hl: true }])
  assert.equal(splitByRanges('abc', [[0, 9]]), null)
  assert.equal(splitByRanges('abc def', [[4, 7], [0, 3]]), null)           // không tăng dần
  assert.equal(splitByRanges('🎸x', [[1, 2]]) !== null, true)                // điểm mã, không phải UTF-16
  assert.deepEqual([...marksByLeaf([{ sec: 3, box: [0, 0, 1, 1], leaves: [{ p: ['blocks', '1', 'text'], r: [[0, 3]] }], scores: [] }]).keys()], ['3:blocks.1.text'])
})

test('parseRegionParts: nhận dữ liệu đúng, từ chối dữ liệu lạ', () => {
  const ok = [{ sec: 1, box: [0, 0, 1000, 1000], leaves: [{ p: ['blocks', '1', 'text'], r: [[0, 5], [8, 12]] }], scores: [{ p: ['tex'], from: 2, to: 4 }] }]
  assert.ok(parseRegionParts(ok))
  assert.equal(parseRegionParts([]), null)
  assert.equal(parseRegionParts([{ ...ok[0], box: [500, 0, 400, 1000] }]), null)
  assert.equal(parseRegionParts([{ ...ok[0], leaves: [['blocks', '1', 'text']] }]), null)                      // dạng V3.0 cũ ⇒ không hiểu
  assert.equal(parseRegionParts([{ ...ok[0], leaves: [{ p: ['blocks', '1', 'text'], r: [[5, 3]] }] }]), null)
  assert.equal(parseRegionParts([{ ...ok[0], leaves: [{ p: ['blocks', '1', 'text'], r: [[0, 5], [3, 9]] }] }]), null)
  assert.equal(parseRegionParts([{ ...ok[0], leaves: [{ p: ['__proto__'], r: [[0, 1]] }] }]), null)
  assert.equal(parseRegionParts([{ ...ok[0], scores: [{ p: ['tex'], from: 4, to: 2 }] }]), null)
})

test('normRect', () => assert.deepEqual(normRect({ x: 50, y: 40 }, { x: 10, y: 90 }), R(10, 40, 40, 50)))

test('V3.2: phần hình tính ‰ trên PHẦN TỬ HÌNH, dựng lại đúng khi bề rộng/chú thích đổi', () => {
  const sec = (box: Rect, visual: Rect): SectionProbe => ({ sec: 3, box, visual, leaves: [], scores: [] })
  // Người khoanh (1280): hình 600×200 tại (100,300); chú thích 1 dòng phía trên. Khung bao góc trên-trái của hình.
  const region: Rect = { x: 130, y: 320, w: 180, h: 80 }
  const r = buildParts(region, [sec({ x: 80, y: 260, w: 700, h: 300 }, { x: 100, y: 300, w: 600, h: 200 })])
  assert.ok(r.ok); if (!r.ok) return
  assert.deepEqual(r.parts[0].box, [50, 100, 350, 500])                       // ‰ của HÌNH, không phải của khối
  // Người nhận (390): hình 300×100 tại (20,150) (chú thích xuống 3 dòng, khối cao hơn). Cùng ‰ ⇒ cùng chỗ TRÊN HÌNH.
  const d = drawParts(r.parts, { section: () => ({ x: 20, y: 150, w: 300, h: 100 }), leaf: () => [], bars: () => [] })
  assert.deepEqual(d[0].rects[0], { x: 35, y: 160, w: 90, h: 40 })
  assert.equal(d[0].approx, true)
  // Khung chỉ chạm mép hình (< 15% diện tích khung nằm trên hình) ⇒ không đưa vào
  const touch = buildParts({ x: 90, y: 480, w: 400, h: 200 }, [sec({ x: 80, y: 260, w: 700, h: 300 }, { x: 100, y: 300, w: 600, h: 200 })])
  assert.equal(touch.ok, false)
})
