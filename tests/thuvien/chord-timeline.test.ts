// Timeline hợp âm theo phách: lời + hợp âm TỰ SOẠN (không bản quyền) để chứng minh luật; bài thật chạy ở chord-timeline-real.test.ts.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildChordTimeline, locateBeat, placeChords, timelineProblems } from '../../src/thuvien/chordTimeline.ts'
import type { ChordTimeline } from '../../src/thuvien/chordTimeline.ts'

const M44 = { beats: 4, beatType: 4 }
const M24 = { beats: 2, beatType: 4 }
const A = (line: number | null, token: number | null) => ({ line, token })
const show = (t: ChordTimeline) => t.events.map(e => `${e.chord}@${e.startBeat}+${e.beats}`).join(' ')

test('mỗi ô đúng số phách; hợp âm ở chữ đầu ô đổi đúng vạch; ô không hợp âm mới → hợp âm trước ngân tiếp', () => {
  const text = '[C] một hai ba bốn năm sáu bảy tám chín mười'
  const t = buildChordTimeline(text, { measures: [A(0, 0), A(0, 3), A(0, 6), A(0, 9)] }, M44)
  assert.equal(t.totalBeats, 16)
  assert.deepEqual(t.events.map(e => [e.chord, e.startBeat, e.beats, e.verified]), [['C', 0, 16, true]], 'một hợp âm ngân suốt 4 ô')
  assert.deepEqual(timelineProblems(t), [])
  assert.deepEqual(t.warnings, [])
})

test('hợp âm đầu ô: đổi đúng phách 0 của ô, CHẮC (verified) — không cảnh báo', () => {
  const text = '[C] một hai ba [G] bốn năm sáu [Am] bảy tám chín'
  const t = buildChordTimeline(text, { measures: [A(0, 0), A(0, 3), A(0, 6)] }, M44)
  assert.equal(show(t), 'C@0+4 G@4+4 Am@8+4')
  assert.deepEqual(t.unverifiedMeasures, [])
  assert.deepEqual(t.events.map(e => e.verified), [true, true, true])
})

test('nhiều hợp âm trong một ô: vị trí theo chữ, làm tròn về phách, đánh dấu CHƯA xác minh', () => {
  const text = '[C] một hai [G] ba bốn'      // 4 chữ, 4 phách: G ở chữ thứ 3 → phách 2
  const t = buildChordTimeline(text, { measures: [A(0, 0)] }, M44)
  assert.equal(show(t), 'C@0+2 G@2+2')
  assert.deepEqual(t.unverifiedMeasures, [0])
  assert.equal(t.warnings[0].code, 'mid_measure_inferred')
  assert.equal(t.events[0].verified, false, 'cả ô được coi là suy luận')
  const two = buildChordTimeline('[Am] một [E] hai', { measures: [A(0, 0)] }, M24)
  assert.equal(show(two), 'Am@0+1 E@1+1', '2/4: hai hợp âm → mỗi hợp âm một phách')
})

test('ba hợp âm trong ô 4/4: phách tăng nghiêm ngặt, không trùng nhau, tổng khít', () => {
  const t = buildChordTimeline('[C] a [F] b [G] c d', { measures: [A(0, 0)] }, M44)
  const beats = t.events.map(e => e.startBeat)
  assert.ok(beats.every((b, i) => i === 0 || b > beats[i - 1]), `tăng nghiêm ngặt: ${beats}`)
  assert.equal(t.events.reduce((sum, e) => sum + e.beats, 0), 4)
  assert.deepEqual(timelineProblems(t), [])
})

test('placeChords: chồng chéo/dồn cuối ô vẫn vừa trong ô; quá nhiều hợp âm → chia theo phần phách và báo', () => {
  const fit = placeChords([0, 1, 2, 3].map(ordinal => ({ chord: 'C', line: 0, token: ordinal, ordinal })), 4, 4)
  assert.deepEqual(fit.map(p => p.beat), [0, 1, 2, 3])
  const tail = placeChords([{ chord: 'C', line: 0, token: 8, ordinal: 8 }, { chord: 'G', line: 0, token: 9, ordinal: 9 }], 10, 4)
  assert.deepEqual(tail.map(p => p.beat), [2, 3], 'hai hợp âm dồn cuối ô được đẩy lùi để vẫn khác phách')
  const crowded = placeChords([0, 1, 2].map(ordinal => ({ chord: 'C', line: 0, token: ordinal, ordinal })), 3, 2)
  assert.ok(crowded.every(p => p.crowded && !p.exact))
  const t = buildChordTimeline('[C] a [F] b [G] c', { measures: [A(0, 0)] }, M24)
  assert.ok(t.warnings.some(w => w.code === 'too_many_chords'))
  assert.deepEqual(timelineProblems(t), [])
})

test('ô ngân (neo trùng): chữ thuộc ô ĐẦU, ô sau ngân tiếp; ô không lời giữ hợp âm trước', () => {
  const text = '[C] một hai [G] ba bốn'
  const t = buildChordTimeline(text, { measures: [A(0, 0), A(0, 0), A(null, null), A(0, 2)] }, M44)
  assert.equal(t.totalBeats, 16)
  assert.equal(show(t), 'C@0+12 G@12+4', 'C ở ô 1, ngân qua ô 2 và ô 3 không lời; G ở ô 4')
  assert.equal(t.measures[1].tokenCount, 0)
  assert.equal(t.measures[2].tokenCount, 0)
  assert.deepEqual(timelineProblems(t), [])
})

test('hợp âm cuối dòng không kèm chữ vẫn là một vị trí và rơi vào ô của nó', () => {
  const t = buildChordTimeline('[C] một hai [G]', { measures: [A(0, 0), A(0, 2)] }, M44)
  assert.equal(show(t), 'C@0+4 G@4+4')
})

test('nhãn đầu dòng (1., ĐK:) không phải chữ; điệp khúc quay về dòng cũ; lời 2 có hợp âm riêng', () => {
  const text = '1. [C] một hai\nĐK: [G] ba bốn\n2. [Am] năm sáu'
  // lượt: lời 1 → ĐK → lời 2 → ĐK lại (quay về dòng 1)
  const t = buildChordTimeline(text, { measures: [A(0, 0), A(1, 0), A(2, 0), A(1, 0)] }, M44)
  assert.equal(t.totalBeats, 16)
  assert.equal(show(t), 'C@0+4 G@4+4 Am@8+4 G@12+4')
  assert.deepEqual(t.events.map(e => e.measure), [0, 1, 2, 3])
  assert.deepEqual(t.events.map(e => [e.line, e.token]), [[0, 0], [1, 0], [2, 0], [1, 0]])
})

test('nhịp lấy đà: ô lấy đà ngắn hơn một ô đầy đủ; tổng = lấy đà + ô × beats; suy luận được báo', () => {
  const text = 'Chiều [Am] nao tiễn nhau [E7] đi khi bóng'
  const anchors = { pickup: A(0, 0), measures: [A(0, 1), A(0, 4)] }
  const t = buildChordTimeline(text, anchors, M44)
  assert.equal(t.pickupBeats, 1)
  assert.equal(t.totalBeats, 1 + 2 * 4)
  assert.equal(t.measures[0].isPickup, true)
  assert.equal(t.measures[1].startBeat, 1)
  assert.equal(t.measures[2].startBeat, 5)
  assert.ok(t.warnings.some(w => w.code === 'pickup_inferred'))
  assert.equal(show(t), 'Am@1+4 E7@5+4')
  const known = buildChordTimeline(text, anchors, M44, { pickupBeats: 2 })
  assert.equal(known.totalBeats, 2 + 8)
  assert.ok(!known.warnings.some(w => w.code === 'pickup_inferred'), 'pickup cho trước từ sheet → không còn suy luận')
  assert.deepEqual(timelineProblems(known), [])
})

test('không trôi tích luỹ: sau N ô, phách bắt đầu ô cuối = N-1 × beats (cả khi có lấy đà)', () => {
  const measures = Array.from({ length: 200 }, (_, i) => A(0, i))
  const text = Array.from({ length: 200 }, (_, i) => (i % 7 === 0 ? `[C] w${i}` : `w${i}`)).join(' ')
  for (const meter of [M44, M24, { beats: 3, beatType: 4 }, { beats: 6, beatType: 8 }]) {
    const t = buildChordTimeline(text, { measures }, meter)
    assert.equal(t.totalBeats, 200 * meter.beats)
    assert.equal(t.measures[199].startBeat, 199 * meter.beats)
    assert.deepEqual(timelineProblems(t), [])
  }
})

test('không có meter → timeline rỗng + cảnh báo (không bịa số phách)', () => {
  const t = buildChordTimeline('[C] a b', { measures: [A(0, 0)] }, null)
  assert.equal(t.totalBeats, 0)
  assert.equal(t.warnings[0].code, 'meter_missing')
})

test('bài mở không bằng hợp âm → cảnh báo; không hợp âm nào → cảnh báo', () => {
  assert.ok(buildChordTimeline('a b c d [C] e f g h', { measures: [A(0, 0), A(0, 4)] }, M44).warnings.some(w => w.code === 'no_chord_at_start'))
  assert.ok(buildChordTimeline('a b c d', { measures: [A(0, 0)] }, M44).warnings.some(w => w.code === 'no_chords'))
})

test('locateBeat: MỘT phép đổi phách → vị trí cho ball + cuộn + hợp âm; lấy đà dùng chung đồng hồ', () => {
  const text = 'Chiều [Am] nao [E7] tiễn nhau'
  const t = buildChordTimeline(text, { pickup: A(0, 0), measures: [A(0, 1), A(0, 3)] }, M44, { pickupBeats: 1 })
  assert.equal(locateBeat(t, -0.5).state, 'before')
  const p0 = locateBeat(t, 0.5)
  assert.deepEqual([p0.measureIndex, p0.measureProgress, p0.measurePosition, p0.chordIndex], [0, 0.5, 0.5, -1], 'giữa nhịp lấy đà, chưa có hợp âm')
  const p1 = locateBeat(t, 1)
  assert.deepEqual([p1.measureIndex, p1.measureProgress, p1.chordIndex], [1, 0, 0], 'phách 1 = đầu ô 1 = Am')
  const p2 = locateBeat(t, 3)
  assert.equal(p2.measurePosition, 1.5, '2 phách trong ô 4 phách = nửa ô')
  assert.equal(locateBeat(t, 5).chordIndex, 1, 'ô 2 bắt đầu E7')
  assert.deepEqual([locateBeat(t, t.totalBeats).state, locateBeat(t, 99).measurePosition], ['ended', t.measures.length])
  // đơn điệu: measurePosition không bao giờ giảm theo phách
  let last = -Infinity
  for (let b = 0; b < t.totalBeats; b += 0.25) { const m = locateBeat(t, b).measurePosition; assert.ok(m >= last); last = m }
})
