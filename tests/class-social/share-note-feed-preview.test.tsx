// Share Note Feed Preview V1 — lõi thuần: kế hoạch trích đoạn (tối đa 4 ô / 2 dòng), lấy nhạc theo đường dẫn, store (quyền, cache, hàng đợi).
import test from 'node:test'
import assert from 'node:assert/strict'
import { EXCERPT_MAX_BARS, planExcerpt, scoreTexAt } from '../../src/share/scoreExcerpt.ts'

test('planExcerpt: vùng khoanh ưu tiên, ngữ cảnh ≤ 2 ô mỗi phía lấp chỗ trống, thiếu chỗ thì giảm ngữ cảnh trước', () => {
  const P = (r: { from: number; to: number }, perRow: number, rows = 2, ctx = true) => { const p = planExcerpt(r, perRow, rows, ctx)!; return [p.start, p.count, p.focusFrom, p.focusTo, p.before, p.after, p.truncated] }
  // desktop 4 ô/dòng × 2 dòng = 8 chỗ: vùng 2 ô giữa bài → 2 trước + 2 sau (tổng 6)
  assert.deepEqual(P({ from: 5, to: 6 }, 4), [3, 6, 5, 6, 2, 2, false])
  // vùng 4 ô → còn 4 chỗ → 2 + 2
  assert.deepEqual(P({ from: 5, to: 8 }, 4), [3, 8, 5, 8, 2, 2, false])
  // đầu bài (ô 1): không có ô trước → chỉ 2 ô sau
  assert.deepEqual(P({ from: 1, to: 2 }, 4), [1, 4, 1, 2, 0, 2, false])
  // điện thoại có lời 1 ô/dòng × 2 dòng = 2 chỗ: vùng 1 ô → 1 ô ngữ cảnh (đối xứng: giảm trước rồi sau)
  assert.deepEqual(P({ from: 9, to: 9 }, 1), [9, 2, 9, 9, 0, 1, false])
  // vùng 2 ô trên 2 chỗ → KHÔNG có ngữ cảnh (không lấn vùng khoanh)
  assert.deepEqual(P({ from: 5, to: 6 }, 1), [5, 2, 5, 6, 0, 0, false])
  // điện thoại không lời 2 ô/dòng × 3 dòng = 6 chỗ: vùng 2 ô → 2 + 2
  assert.deepEqual(P({ from: 5, to: 6 }, 2, 3), [3, 6, 5, 6, 2, 2, false])
  // vùng dài: cắt ở 4 ô, KHÔNG có ngữ cảnh sau; ngữ cảnh trước chỉ khi còn chỗ
  assert.deepEqual(P({ from: 5, to: 14 }, 4), [3, 6, 5, 8, 2, 0, true])
  assert.deepEqual(P({ from: 5, to: 14 }, 1), [5, 2, 5, 6, 0, 0, true])
  // bản nhạc có 64 ô tối đa vẫn chỉ vẽ ≤ 4 ô khoanh
  assert.equal(planExcerpt({ from: 1, to: 64 }, 8)!.focusTo, 4)
  // tắt ngữ cảnh → như V1
  assert.deepEqual(P({ from: 5, to: 6 }, 4, 2, false), [5, 2, 5, 6, 0, 0, false])
  // tổng ô vẽ không bao giờ vượt chỗ có (perRow × dòng)
  for (let perRow = 1; perRow <= 4; perRow++) for (let rows = 1; rows <= 3; rows++) for (const r of [{ from: 1, to: 1 }, { from: 3, to: 4 }, { from: 7, to: 20 }]) assert.ok(planExcerpt(r, perRow, rows)!.count <= perRow * rows)
})

test('planExcerpt: dải hỏng → null (không vẽ gì)', () => {
  for (const r of [{ from: 0, to: 3 }, { from: -1, to: 2 }, { from: 5, to: 4 }, { from: 1.5, to: 3 }, { from: NaN, to: 3 }, { from: 1, to: Infinity }]) {
    assert.equal(planExcerpt(r, 4), null, JSON.stringify(r))
  }
  assert.equal(planExcerpt({ from: 1, to: 2 }, 0)!.focusTo, 2, 'số ô/dòng 0 → coi như 1, vùng khoanh vẫn vẽ đủ')
})

test('scoreTexAt: ba dạng đường dẫn như LessonDocument; sai → null', () => {
  const sections = [
    { kind: 'text' },
    { kind: 'score', tex: '\\title "a" . 1.1' },
    { kind: 'layers', layers: [{ tex: 'L0' }, { tex: 'L1' }] },
    { kind: 'pieces', pieces: [{ tex: 'P0' }, { tex: '' }] },
  ]
  assert.equal(scoreTexAt(sections, { section: 1, path: ['tex'] }), '\\title "a" . 1.1')
  assert.equal(scoreTexAt(sections, { section: 2, path: ['layers', '1', 'tex'] }), 'L1')
  assert.equal(scoreTexAt(sections, { section: 3, path: ['pieces', '0', 'tex'] }), 'P0')
  assert.equal(scoreTexAt(sections, { section: 3, path: ['pieces', '1', 'tex'] }), null, 'rỗng')
  assert.equal(scoreTexAt(sections, { section: 0, path: ['tex'] }), null, 'khối không có nhạc')
  assert.equal(scoreTexAt(sections, { section: 9, path: ['tex'] }), null, 'ngoài phạm vi')
  assert.equal(scoreTexAt(sections, { section: 2, path: ['layers', '7', 'tex'] }), null)
  assert.equal(scoreTexAt(null, { section: 0, path: ['tex'] }), null)
  assert.equal(scoreTexAt({}, { section: 0, path: ['tex'] }), null)
  assert.equal(scoreTexAt(sections, { section: -1, path: ['tex'] }), null)
})

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describeToolShare } from '../../src/class-social/toolshare/registry.ts'
import ShareNotePost from '../../src/class-social/toolshare/ShareNotePost.tsx'
import {
  MAX_LIVE_RENDERERS, liveRenderers, requestRenderSlot, resetRenderSlotsForTest, shareNoteMessage,
} from '../../src/share/shareNotePreviewStore.ts'

const ID = '11111111-2222-4333-8444-555555555555', CLS = 'b1000000-0000-4000-8000-000000000001'
const payload = { v: 1, tool: 'share_note', kind: 'share_note', note_id: ID.toUpperCase(), class_id: CLS, session_no: 1, bar_from: 2, bar_to: 7, note: 'Đoạn này đếm phách thế nào?' }

test('registry: share_note mang tham chiếu (KHÔNG có nội dung nhạc / đường dẫn / sha)', () => {
  const v = describeToolShare(payload)!
  assert.deepEqual(v.sharedNote, { noteId: ID, classId: CLS, sessionNo: 1, from: 2, to: 7 })
  assert.equal(v.detail, 'Ô 2–7')
  assert.match(v.action!.href, /\/sessions\/1\?note=/)
  assert.ok(!JSON.stringify(v.sharedNote).match(/tex|sha|path|score/i))
  // các công cụ khác không có sharedNote
  assert.equal(describeToolShare({ v: 1, tool: 'metronome', bpm: 80, seconds: 600 })?.sharedNote, undefined)
})

test('Thẻ Feed chưa gần khung nhìn: chỉ câu hỏi + nút mở, KHÔNG nạp / dựng bản nhạc', () => {
  const html = renderToStaticMarkup(createElement(ShareNotePost, { view: describeToolShare(payload)! }))
  assert.match(html, /Bản nhạc · Buổi 1/); assert.match(html, /Đoạn này đếm phách thế nào\?/); assert.match(html, /Ô 2–7/)
  assert.match(html, /Mở đúng đoạn/)
  assert.doesNotMatch(html, /at-surface|<svg[^>]*lsn|data-testid="share-note-preview"/)
})

test('Thông báo theo trạng thái: no_access / stale / unavailable / lỗi mạng; ok không có thông báo', () => {
  assert.match(shareNoteMessage({ status: 'no_access', note: 'x' })!, /chưa có quyền xem bản nhạc/)
  assert.match(shareNoteMessage({ status: 'locked', note: 'x' })!, /chưa mở cho bạn/)
  assert.match(shareNoteMessage({ status: 'stale', note: 'x' })!, /đã được cập nhật/)
  assert.match(shareNoteMessage({ status: 'unavailable' })!, /không còn khả dụng/)
  assert.match(shareNoteMessage({ status: 'error' })!, /Chưa tải được/)
  assert.equal(shareNoteMessage(null), null)
  assert.equal(shareNoteMessage({ status: 'ok', note: 'x', tex: 't', bars: { from: 1, to: 2 }, score: { section: 0, path: ['tex'] } }), null)
})

test('Khe dựng: tối đa MAX_LIVE_RENDERERS bản nhạc sống; thẻ chờ được cấp khi khe trống; trả khe idempotent; không rò rỉ', () => {
  resetRenderSlotsForTest()
  const got: number[] = []
  const slots = [0, 1, 2, 3].map(i => requestRenderSlot(() => got.push(i)))
  assert.equal(MAX_LIVE_RENDERERS, 2)
  assert.deepEqual(got, [0, 1], 'chỉ 2 thẻ đầu được dựng')
  assert.equal(liveRenderers(), 2)
  slots[0].release(); slots[0].release()                 // trả hai lần = một lần
  assert.deepEqual(got, [0, 1, 2], 'thẻ chờ đầu tiên được cấp')
  assert.equal(liveRenderers(), 2)
  slots[3].release()                                      // thẻ còn CHỜ bị huỷ (cuộn đi) → rời hàng, không chiếm khe
  slots[1].release()
  assert.deepEqual(got, [0, 1, 2], 'thẻ đã huỷ không được cấp khe')
  assert.equal(liveRenderers(), 1)
  slots[2].release()
  assert.equal(liveRenderers(), 0, 'trả hết → không rò rỉ')
})
