// Thứ tự biểu diễn: điệp khúc / lời 2 hát lại dòng cũ → dòng ảo; neo và hợp âm theo dòng ảo.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildChordTimeline } from '../../src/thuvien/chordTimeline.ts'
import { buildPerformanceScript } from '../../src/thuvien/performanceScript.ts'

const A = (line: number | null, token: number | null) => ({ line, token })
const TEXT = '1. [C] một hai\nĐK: [G] ba bốn\n2. [Am] năm sáu'

test('bài chạy thẳng một lượt: dòng ảo = dòng thật, nhãn tách khỏi chữ', () => {
  const script = buildPerformanceScript(TEXT, { measures: [A(0, 0), A(1, 0), A(2, 0)] })
  assert.equal(script.passes, 1)
  assert.deepEqual(script.lines.map(l => l.words.map(w => w.text).join(' ')), ['một hai', 'ba bốn', 'năm sáu'])
  assert.deepEqual(script.labels, { 0: '1.', 1: 'ĐK:', 2: '2.' })
  assert.deepEqual(script.anchors.measures, [A(0, 0), A(1, 0), A(2, 0)])
})

test('điệp khúc hát lại: neo đi lùi → lượt mới, dòng ĐK được vẽ lần nữa; cuộn không bao giờ lùi', () => {
  const anchors = { measures: [A(0, 0), A(1, 0), A(2, 0), A(1, 0)] }
  const script = buildPerformanceScript(TEXT, anchors)
  assert.equal(script.passes, 2)
  assert.deepEqual(script.lines.map(l => l.words[0].text), ['một', 'ba', 'năm', 'ba'], 'ĐK xuất hiện hai lần theo thứ tự hát')
  assert.deepEqual(script.anchors.measures, [A(0, 0), A(1, 0), A(2, 0), A(3, 0)])
  assert.equal(script.labels[3], 'ĐK:', 'nhãn đi theo dòng ảo')
  const lines = script.anchors.measures.map(a => a.line as number)
  assert.ok(lines.every((line, i) => i === 0 || line >= lines[i - 1]), 'dòng ảo không bao giờ đi lùi')
  const timeline = buildChordTimeline(TEXT, anchors, { beats: 4, beatType: 4 })
  assert.deepEqual(timeline.events.map(e => [e.chord, script.virtualLine(e.measure, e.line)]), [['C', 0], ['G', 1], ['Am', 2], ['G', 3]])
})

test('ô ngân, ô không lời và nhịp lấy đà không tạo lượt mới; phần lời chưa chạm tới được vẽ nốt', () => {
  const anchors = { pickup: A(0, 0), measures: [A(0, 1), A(0, 1), A(null, null), A(1, 0)] }
  const script = buildPerformanceScript(TEXT, anchors)
  assert.equal(script.passes, 1)
  assert.deepEqual(script.anchors.pickup, A(0, 0))
  assert.deepEqual(script.anchors.measures, [A(0, 1), A(0, 1), A(null, null), A(1, 0)])
  assert.equal(script.lines.length, 3, 'dòng 3 chưa có vạch vẫn được vẽ')
})

test('lời 2 nối tiếp rồi quay lại điệp khúc 1: mỗi lượt có bản sao riêng', () => {
  const text = '1. [C] a b\nĐK: [G] c d\n2. [Am] e f\n3. [F] g h'
  const script = buildPerformanceScript(text, { measures: [A(0, 0), A(1, 0), A(2, 0), A(3, 0), A(1, 0)] })
  assert.equal(script.passes, 2)
  assert.deepEqual(script.lines.map(l => l.words[0].text), ['a', 'c', 'e', 'g', 'c'])
})
