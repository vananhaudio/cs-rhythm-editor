// Contextual Share V3 — lõi THUẦN khoanh vùng hỗn hợp: khung chữ nhật → neo tài liệu → vẽ lại. Hình học giả lập (không DOM).
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildParts, coverage, drawParts, normRect, parseRegionParts, summarize, type Rect, type SectionProbe } from '../../src/share/regionAnchor.ts'

const R = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h })
// Trang giả: khối 0 (chữ 2 lá), khối 1 (bản nhạc 8 ô, 2 dòng × 4 ô), khối 2 (chỉ hình ảnh — không phần tử gốc)
const page = (dx = 0, dy = 0): SectionProbe[] => [
  { sec: 0, box: R(10 + dx, 0 + dy, 400, 200), leaves: [
    { path: ['blocks', '0', 'text'], rects: [R(20 + dx, 20 + dy, 380, 20)] },
    { path: ['blocks', '1', 'text'], rects: [R(20 + dx, 60 + dy, 380, 20), R(20 + dx, 80 + dy, 200, 20)] }], scores: [] },
  { sec: 1, box: R(10 + dx, 210 + dy, 400, 200), leaves: [], scores: [{ p: ['tex'], bars: [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ index: i, rect: R(20 + (i % 4) * 95 + dx, (i < 4 ? 220 : 320) + dy, 95, 80) })) }] },
  { sec: 2, box: R(10 + dx, 420 + dy, 400, 150), leaves: [], scores: [] },
]

test('khung quá nhỏ / không chạm gì → từ chối rõ lý do', () => {
  assert.deepEqual(buildParts(R(0, 0, 10, 10), page()), { ok: false, reason: 'tooSmall' })
  assert.deepEqual(buildParts(R(600, 600, 100, 100), page()), { ok: false, reason: 'empty' })
})

test('khoanh một đoạn chữ: chỉ lá bị chạm đủ nhiều', () => {
  const r = buildParts(R(15, 15, 395, 35), page())
  assert.ok(r.ok)
  if (!r.ok) return
  assert.equal(r.parts.length, 1)
  assert.deepEqual(r.parts[0].leaves, [['blocks', '0', 'text']])
  assert.deepEqual(r.parts[0].scores, [])
})

test('khoanh hỗn hợp: chữ + bản nhạc + hình trong MỘT khung', () => {
  const r = buildParts(R(15, 50, 395, 480), page())
  assert.ok(r.ok)
  if (!r.ok) return
  assert.deepEqual(r.parts.map(p => p.sec), [0, 1, 2])
  assert.equal(r.parts[0].leaves.length, 1)                       // chỉ lá thứ hai (lá đầu nằm trên khung)
  assert.deepEqual(r.parts[1].scores, [{ p: ['tex'], from: 1, to: 8 }])
  assert.deepEqual(r.parts[2].leaves, [])                         // khối hình: giữ bằng hộp (gần đúng)
  assert.match(summarize(r.parts), /3 khối · 1 đoạn chữ · bản nhạc \(ô 1–8\) · 1 vùng hình/)
})

test('bản nhạc: chỉ ô bị chạm ≥ 25% diện tích', () => {
  const r = buildParts(R(20 + 95 * 1 + 10, 225, 95 * 2, 60), page())   // ô 2 và 3 (0-based 1,2) của dòng đầu
  assert.ok(r.ok)
  if (!r.ok) return
  const s = r.parts.find(p => p.sec === 1)!
  assert.deepEqual(s.scores, [{ p: ['tex'], from: 2, to: 3 }])    // ô 4 chỉ bị chạm ~10% (< 25%) ⇒ không tính
})

test('khung chỉ chạm lề của khối CÓ phần tử gốc → bỏ (không neo vào chỗ trống)', () => {
  const r = buildParts(R(300, 150, 100, 40), page())              // vùng trống cuối khối 0, không dòng chữ nào
  assert.deepEqual(r, { ok: false, reason: 'empty' })
})

test('giới hạn: > 12 khối, > 40 lá, > 64 ô', () => {
  const many: SectionProbe[] = Array.from({ length: 13 }, (_, i) => ({ sec: i, box: R(0, i * 50, 100, 50), leaves: [], scores: [] }))
  assert.deepEqual(buildParts(R(0, 0, 100, 700), many), { ok: false, reason: 'tooManyParts' })
  const leaves = Array.from({ length: 41 }, (_, i) => ({ path: ['items', String(i), 'text'], rects: [R(0, i * 10, 100, 10)] }))
  assert.deepEqual(buildParts(R(0, 0, 100, 500), [{ sec: 0, box: R(0, 0, 100, 500), leaves, scores: [] }]), { ok: false, reason: 'tooManyLeaves' })
  const bars = Array.from({ length: 65 }, (_, i) => ({ index: i, rect: R(i * 10, 0, 10, 50) }))
  assert.deepEqual(buildParts(R(0, 0, 700, 50), [{ sec: 0, box: R(0, 0, 700, 50), leaves: [], scores: [{ p: ['tex'], bars }] }]), { ok: false, reason: 'tooManyBars' })
})

test('NEO KHÔNG PHỤ THUỘC TOẠ ĐỘ: dời/giãn trang → vẽ lại vẫn đúng phần tử', () => {
  const r = buildParts(R(15, 50, 395, 480), page())
  assert.ok(r.ok)
  if (!r.ok) return
  // Trang mới: lề dời (dx,dy) và chữ xuống dòng khác (lá 1 thành 3 dòng, khối nhạc bị đẩy xuống) — vẽ lại tra theo ĐƯỜNG DẪN, không theo pixel cũ
  const moved = page(37, 90)
  const lk = {
    section: (s: number) => moved.find(x => x.sec === s)?.box ?? null,
    leaf: (s: number, p: string[]) => moved.find(x => x.sec === s)?.leaves.find(l => l.path.join('.') === p.join('.'))?.rects ?? [],
    bars: (s: number, _p: string[], from: number, to: number) => (moved.find(x => x.sec === s)?.scores[0].bars ?? []).filter(b => b.index + 1 >= from && b.index + 1 <= to).map(b => b.rect),
  }
  const d = drawParts(r.parts, lk)
  assert.equal(d[0].rects[0].x, 20 + 37)                           // đúng lá, ở vị trí MỚI
  assert.equal(d[1].rects.length, 8)
  assert.equal(d[2].approx, true)                                  // chỉ phần hình là gần đúng, và được ĐÁNH DẤU
  assert.equal(d[0].approx, false)
  assert.ok(d[2].outline && d[2].outline.x >= 10 + 37 - 6)
})

test('lá/ô không tra được trong DOM hiện tại → không vẽ gì cho phần tử đó (không đoán)', () => {
  const r = buildParts(R(15, 50, 395, 480), page())
  assert.ok(r.ok)
  if (!r.ok) return
  const d = drawParts(r.parts, { section: () => null, leaf: () => [], bars: () => [] })
  assert.ok(d.every(p => p.rects.length === 0 && p.outline === null))
})

test('parseRegionParts: dữ liệu lạ → null', () => {
  const ok = [{ sec: 0, box: [0, 0, 1000, 500], leaves: [['blocks', '1', 'text']], scores: [{ p: ['tex'], from: 1, to: 2 }] }]
  assert.ok(parseRegionParts(ok))
  assert.equal(parseRegionParts([]), null)
  assert.equal(parseRegionParts([{ ...ok[0], box: [0, 0, 0, 5] }]), null)
  assert.equal(parseRegionParts([{ ...ok[0], leaves: [['<script>']] }]), null)
  assert.equal(parseRegionParts([{ ...ok[0], scores: [{ p: ['tex'], from: 3, to: 2 }] }]), null)
  assert.equal(parseRegionParts('x'), null)
})

test('coverage & normRect', () => {
  assert.equal(coverage([R(0, 0, 10, 10)], R(0, 0, 5, 10)), 0.5)
  assert.equal(coverage([], R(0, 0, 5, 10)), 0)
  assert.deepEqual(normRect({ x: 10, y: 20 }, { x: 4, y: 30 }), R(4, 20, 6, 10))
})
