// Universal Contextual Share — lõi thuần (neo, khung, fail-closed) + khung ngữ cảnh dựng bằng chính renderer giáo trình.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { contextFrameForBars, locateScore, resolveFocus, studyContext } from '../../src/share/contextShare.ts'
import type { ScoreKey } from '../../src/share/shareNoteApi.ts'
import { ContextSectionView } from '../../src/lesson/LessonDocument.tsx'

const sections = [
  { kind: 'objectives', items: ['a'] },
  { kind: 'score', title: 'Giai điệu mở đầu', subtitle: 'BÀI MẪU', lead: 'Mô tả nguyên văn của Thầy.', tex: 'T0', tempo: '♩ = 60', guidance: ['Gạch đầu dòng'], marks: [{ at: 'Ô 3', text: 'chuyển vùng' }] },
  { kind: 'repertoire', title: 'Tác phẩm thực hành', candidates: ['Thành Phố Buồn – Lam Phương (Am)', 'Diễm Xưa'], status: 'ready', assets: [{ label: 'XML', href: '/x.xml', type: 'musicxml' }],
    pieces: [{ title: 'Thành Phố Buồn', composer: 'Lam Phương', note: 'Đoạn mô tả nguyên văn', tempo: 'Slow rock', tex: 'P0', guidance: ['g'] }, { title: 'Diễm Xưa', tex: 'P1' }] },
  { kind: 'layers', title: 'Chồng lớp', layers: [{ label: 'B1', what: 'Lớp một', tex: 'L0' }, { label: 'B2', what: 'Lớp hai', tex: 'L1' }] },
]

test('locateScore / contextFrameForBars: tìm đúng khối + phần tử con; sai → null', () => {
  assert.equal(locateScore(sections, { section: 1, path: ['tex'] })?.index, 1)
  assert.equal(contextFrameForBars(sections, { section: 2, path: ['pieces', '1', 'tex'] })?.child, 1)
  assert.equal(contextFrameForBars(sections, { section: 2, path: ['pieces', '9', 'tex'] }), null)
  assert.equal(contextFrameForBars(sections, { section: 0, path: ['tex'] }), null)
  assert.equal(contextFrameForBars(null, { section: 0, path: ['tex'] }), null)
})

test('resolveFocus: ô nhịp ok; neo mồ côi / hỏng → broken (fail closed); loại neo chưa có hạ tầng → unsupported (không báo là hỗ trợ)', () => {
  const k: ScoreKey = { section: 1, path: ['tex'] }
  assert.equal(resolveFocus({ type: 'bars', bars: { from: 2, to: 3 } }, sections, k).status, 'ok')
  assert.equal(resolveFocus({ type: 'bars', bars: { from: 2, to: 3 } }, sections, { section: 7, path: ['tex'] }).status, 'broken')
  assert.equal(resolveFocus({ type: 'bars', bars: { from: 3, to: 2 } }, sections, k).status, 'broken')
  for (const a of [{ type: 'text', section: 1, block: 0, start: 0, end: 3 }, { type: 'region', section: 1, x: 0, y: 0, w: .5, h: .5 }, { type: 'cells', section: 1, block: 0, r0: 0, c0: 0, r1: 1, c1: 1 }, { type: 'blocks', from: 0, to: 1 }] as const)
    assert.equal(resolveFocus(a, sections).status, 'unsupported', a.type)
})

test('studyContext (hợp đồng văn bản): tiêu đề mục gần nhất + khối + phần phụ thuộc; chỉ số hỏng → null', () => {
  const b = [{ b: 'p' }, { b: 'h' }, { b: 'p' }, { b: 'ul' }, { b: 'p' }, { b: 'h' }, { b: 'p' }]
  assert.deepEqual(studyContext(b, 2), [1, 2, 3])
  assert.deepEqual(studyContext(b, 4), [1, 4])
  assert.deepEqual(studyContext(b, 1), [1])
  assert.deepEqual(studyContext(b, 0), [0])
  assert.equal(studyContext(b, 99), null)
  assert.equal(studyContext(b, -1), null)
})

const html = (index: number, path: readonly string[]) => renderToStaticMarkup(createElement(ContextSectionView, { section: sections[index], index, scoreKey: { section: index, path } as never, node: createElement('i', { id: 'EXCERPT' }) }))

test('Khung ngữ cảnh khối score: giữ nguyên tiêu đề / nhãn / mô tả / nhịp độ, thay bản nhạc bằng trích đoạn, lược chú thích & hướng dẫn', () => {
  const h = html(1, ['tex'])
  for (const t of ['Giai điệu mở đầu', 'BÀI MẪU', 'Mô tả nguyên văn của Thầy.', '♩ = 60', 'id="EXCERPT"']) assert.match(h, new RegExp(t.replace(/[.♩=]/g, m => '\\' + m)), t)
  assert.doesNotMatch(h, /Gạch đầu dòng|chuyển vùng/)
})

test('Khung ngữ cảnh khối repertoire: chỉ tác phẩm được chia sẻ (tên, tác giả, ghi chú, nhịp độ) + danh sách dự kiến; không kéo tác phẩm khác / tệp', () => {
  const h = html(2, ['pieces', '0', 'tex'])
  for (const t of ['Tác phẩm', 'Tác phẩm thực hành', 'Thành Phố Buồn – Lam Phương', 'Lam Phương', 'Đoạn mô tả nguyên văn', 'Slow rock', 'id="EXCERPT"']) assert.ok(h.includes(t), t)
  assert.equal((h.match(/id="EXCERPT"/g) ?? []).length, 1)
  assert.ok(!h.includes('Diễm Xưa</h3>'), 'tác phẩm khác không vào khung')
  assert.ok(!h.includes('/x.xml'))
  const h2 = html(2, ['pieces', '1', 'tex'])
  assert.ok(h2.includes('Diễm Xưa</h3>') && !h2.includes('Đoạn mô tả nguyên văn'))
})

test('Khung ngữ cảnh khối layers: chỉ đúng tầng được chia sẻ', () => {
  const h = html(3, ['layers', '1', 'tex'])
  assert.ok(h.includes('Lớp hai') && !h.includes('Lớp một') && h.includes('id="EXCERPT"'))
})

test('Khối hỏng không làm sập thẻ: renderer rơi về khối "không hiển thị được" thay vì ném lỗi', () => {
  const h = renderToStaticMarkup(createElement(ContextSectionView, { section: { kind: 'repertoire' }, index: 0, scoreKey: { section: 0, path: ['pieces', '0', 'tex'] } as never, node: null }))
  assert.ok(h.length > 0)
})
