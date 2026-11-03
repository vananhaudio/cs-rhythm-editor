// Share Note Feed Preview V1 — lõi thuần: kế hoạch trích đoạn (tối đa 4 ô / 2 dòng), lấy nhạc theo đường dẫn, store (quyền, cache, hàng đợi).
import test from 'node:test'
import assert from 'node:assert/strict'
import { EXCERPT_MAX_BARS, planExcerpt, scoreTexAt } from '../../src/share/scoreExcerpt.ts'

test('planExcerpt: tối đa 4 ô và tối đa 2 dòng theo khổ', () => {
  // desktop 4 ô/dòng: dải 10 ô → 4 ô
  assert.deepEqual(planExcerpt({ from: 5, to: 14 }, 4), { start: 5, count: EXCERPT_MAX_BARS, total: 10, truncated: true })
  // điện thoại có lời 1 ô/dòng → 2 ô (≤ 2 dòng)
  assert.deepEqual(planExcerpt({ from: 5, to: 8 }, 1), { start: 5, count: 2, total: 4, truncated: true })
  // điện thoại không lời 2 ô/dòng → 4 ô
  assert.deepEqual(planExcerpt({ from: 1, to: 4 }, 2), { start: 1, count: 4, total: 4, truncated: false })
  // dải ngắn hơn giới hạn → hiện đủ, không cắt
  assert.deepEqual(planExcerpt({ from: 9, to: 9 }, 1), { start: 9, count: 1, total: 1, truncated: false })
  assert.deepEqual(planExcerpt({ from: 9, to: 10 }, 3), { start: 9, count: 2, total: 2, truncated: false })
  // dải server tối đa 64 ô vẫn chỉ vẽ ≤ 4
  assert.equal(planExcerpt({ from: 1, to: 64 }, 8)!.count, 4)
})

test('planExcerpt: dải hỏng → null (không vẽ gì)', () => {
  for (const r of [{ from: 0, to: 3 }, { from: -1, to: 2 }, { from: 5, to: 4 }, { from: 1.5, to: 3 }, { from: NaN, to: 3 }, { from: 1, to: Infinity }]) {
    assert.equal(planExcerpt(r, 4), null, JSON.stringify(r))
  }
  assert.equal(planExcerpt({ from: 1, to: 2 }, 0)!.count, 2, 'số dòng 0 → coi như 1 ô/dòng, tối thiểu vẫn vẽ')
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
