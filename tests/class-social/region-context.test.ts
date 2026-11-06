// Contextual Share V3.1 — chọn cái gì dựng trong thẻ Feed của vùng khoanh (thuần). Gọn: ≤ 3 khối, ≤ 1 bản nhạc sống; Đầy đủ: tất cả.
import test from 'node:test'
import assert from 'node:assert/strict'
import { regionHasMore, regionViews, REGION_COMPACT_PARTS } from '../../src/share/regionContext.ts'
import type { RegionPart } from '../../src/share/regionAnchor.ts'

const study = { kind: 'study', title: 'T', blocks: [{ b: 'h', text: 'Tiêu đề A' }, { b: 'p', text: 'Đoạn một' }, { b: 'p', text: 'Đoạn hai' }, { b: 'h', text: 'Tiêu đề B' }, { b: 'p', text: 'Đoạn ba' }] }
const score = (t: string) => ({ kind: 'score', title: 'N', tex: t })
const sections: unknown[] = [study, score('\\ts 4 4 . C.4 |'), score('\\ts 4 4 . D.4 |'), { kind: 'note', text: 'Ghi chú ngắn' }, { kind: 'fretboard', title: 'Cần đàn' }]
const P = (sec: number, extra: Partial<RegionPart> = {}): RegionPart => ({ sec, box: [0, 0, 1000, 1000], leaves: [], scores: [], ...extra })

test('regionViews: gọn lấy 3 khối đầu, chỉ MỘT bản nhạc sống; đầy đủ lấy tất cả', () => {
  const parts = [P(1, { scores: [{ p: ['tex'], from: 1, to: 2 }] }), P(2, { scores: [{ p: ['tex'], from: 1, to: 1 }] }), P(3, { leaves: [{ p: ['text'], r: [[0, 5]] }] }), P(4)]
  const c = regionViews(sections, parts, false)
  assert.equal(c.shown.length, REGION_COMPACT_PARTS); assert.equal(c.hidden, 1)
  assert.equal(c.shown.filter(v => v.tex).length, 1, 'gọn: một bản nhạc sống')
  const f = regionViews(sections, parts, true)
  assert.equal(f.shown.length, 4); assert.equal(f.hidden, 0); assert.equal(f.shown.filter(v => v.tex).length, 2)
  assert.equal(f.shown[3].approx, true); assert.equal(f.shown[2].approx, false)
})

test('regionViews: khối study → blocksAt là các khối con được khoanh; marks theo khoá lá', () => {
  const v = regionViews(sections, [P(0, { leaves: [{ p: ['blocks', '1', 'text'], r: [[0, 4]] }, { p: ['blocks', '4', 'text'], r: [[0, 3]] }] })], false).shown[0]
  assert.deepEqual(v.blocksAt, [1, 4]); assert.deepEqual([...v.marks.keys()], ['0:blocks.1.text', '0:blocks.4.text'])
})

test('regionHasMore: nhiều khối / nhiều bản nhạc / tiểu mục study rộng hơn cửa sổ gọn', () => {
  assert.equal(regionHasMore(sections, [P(3, { leaves: [{ p: ['text'], r: [[0, 5]] }] })]), false)
  assert.equal(regionHasMore(sections, [P(1), P(2), P(3), P(4)]), true)
  assert.equal(regionHasMore(sections, [P(1, { scores: [{ p: ['tex'], from: 1, to: 1 }] }), P(2, { scores: [{ p: ['tex'], from: 1, to: 1 }] })]), true)
  assert.equal(regionHasMore(sections, [P(0, { leaves: [{ p: ['blocks', '2', 'text'], r: [[0, 4]] }] })]), true)
})
