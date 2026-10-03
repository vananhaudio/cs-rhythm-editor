import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRhythmScroll, measuresAtSeconds } from '../../src/rhythm-scroll/index.ts'
import { parseChordLines } from '../../src/rhythm-scroll-viewer/chordLines.ts'
import { BALL_AMPLITUDE, BALL_LANE, BALL_RADIUS, ballPoint, buildReadingRows } from '../../src/rhythm-scroll-viewer/ballPath.ts'
import { createProofClock, secondsAfterTempoChange } from '../../src/rhythm-scroll-viewer/clock.ts'
import { LOOKAHEAD_ANCHOR, contentShift, playheadOffset } from '../../src/rhythm-scroll-viewer/scrollModel.ts'
import { DEMO_DATA, DEMO_TEXT } from '../../src/rhythm-scroll-viewer/proof/demoSong.ts'

// ── [Chord] → từ + hợp âm ──
test('parser: hợp âm trong ngoặc gắn vào từ ngay sau nó, lời sạch ngoặc', () => {
  const [line] = parseChordLines('Chiều [Am] nao, tiễn nhau [E7] đi khi bóng ngả xế [Am] tàn')
  assert.equal(line.words.map(word => word.text).join(' '), 'Chiều nao, tiễn nhau đi khi bóng ngả xế tàn')
  assert.deepEqual(line.words.filter(word => word.chord).map(word => [word.text, word.chord]),
    [['nao,', 'Am'], ['đi', 'E7'], ['tàn', 'Am']])
  assert.equal(line.words[0].chord, null)
})

test('parser: hợp âm dính liền chữ, hợp âm đầu dòng, hợp âm phức', () => {
  const [line] = parseChordLines('[Dm]Hoàng hôn [G7/B]đến [F#m7] đâu')
  assert.deepEqual(line.words, [
    { text: 'Hoàng', chord: 'Dm' }, { text: 'hôn', chord: null }, { text: 'đến', chord: 'G7/B' }, { text: 'đâu', chord: 'F#m7' },
  ])
})

test('parser: chỉ số dòng khớp văn bản gốc, kể cả dòng trống; không gộp dòng', () => {
  const lines = parseChordLines('[Am] một\n\nAm Dm\n[C] bốn')
  assert.deepEqual(lines.map(line => line.index), [0, 1, 2, 3])
  assert.deepEqual(lines.map(line => line.words.length), [1, 0, 2, 1])
  assert.equal(lines[3].words[0].chord, 'C')
})

// ── Đồng hồ ──
function fakeTime() {
  let ms = 1000
  return { now: () => ms, advance: (seconds: number) => { ms += seconds * 1000 } }
}
const METER = { beats: 4, beatType: 4 }

test('đồng hồ: Play làm vị trí tăng, Pause giữ nguyên, Play lại chạy tiếp, Restart về đầu', () => {
  const time = fakeTime()
  const clock = createProofClock(time.now)
  const position = (bpm = 60) => measuresAtSeconds(clock.elapsedSeconds(), bpm, METER)
  time.advance(5)
  assert.equal(position(), 0, 'chưa Play thì không chạy')
  clock.play()
  time.advance(4)
  assert.equal(position(), 1)
  time.advance(2)
  assert.equal(position(), 1.5)
  clock.pause()
  time.advance(30)
  assert.equal(position(), 1.5, 'Pause giữ nguyên')
  assert.equal(clock.playing, false)
  clock.play()
  time.advance(2)
  assert.equal(position(), 2)
  clock.restart()
  assert.equal(position(), 0)
  assert.equal(clock.playing, true, 'Restart lúc đang chạy thì chạy lại từ đầu')
  time.advance(4)
  assert.equal(position(), 1)
  clock.pause()
  clock.restart()
  time.advance(9)
  assert.equal(position(), 0, 'Restart lúc đang dừng thì đứng ở đầu')
})

test('đồng hồ: đổi BPM giữ nguyên vị trí, chỉ tốc độ đổi', () => {
  const time = fakeTime()
  const clock = createProofClock(time.now)
  clock.play()
  time.advance(10)                                         // BPM 60 → 2.5 ô
  const before = measuresAtSeconds(clock.elapsedSeconds(), 60, METER)
  clock.seek(secondsAfterTempoChange(clock.elapsedSeconds(), 60, 120))
  assert.equal(measuresAtSeconds(clock.elapsedSeconds(), 120, METER), before)
  time.advance(4)                                          // BPM 120 → 4 giây = 2 ô (gấp đôi lúc trước)
  assert.equal(measuresAtSeconds(clock.elapsedSeconds(), 120, METER), before + 2)
  assert.throws(() => secondsAfterTempoChange(1, 60, 0), RangeError)
  assert.throws(() => clock.seek(NaN), RangeError)
})

// ── Cuộn ──
// Các khối cao KHÁC nhau (câu dài xuống hàng, khối 2 dòng) — đúng tình huống không được map theo scrollProgress.
const TOPS = [0, 40, 130, 220, 400, 520, 700, 880, 920, 1100]
const LAYOUT = { segmentTops: TOPS, contentHeight: 1190 }

test('cuộn: liên tục qua mọi ranh giới segment, không lùi, không nhảy', () => {
  const scroll = createRhythmScroll(DEMO_DATA)
  assert.equal(DEMO_DATA.segments.length, TOPS.length)
  let previous = playheadOffset(LAYOUT, scroll.locate(0))
  let largest = 0
  for (let step = 1; step <= DEMO_DATA.totalMeasures * 100; step++) {
    const now = playheadOffset(LAYOUT, scroll.locate(step / 100))
    assert.ok(now >= previous, `lùi ở ô ${step / 100}`)
    largest = Math.max(largest, now - previous)
    previous = now
  }
  assert.ok(largest < 1, `bước lớn nhất ${largest}px cho 1/100 ô — không có cú nhảy theo dòng`)
  assert.equal(playheadOffset(LAYOUT, scroll.locate(DEMO_DATA.totalMeasures)), 1190)
})

test('cuộn: nội suy theo vị trí DOM của segment, không theo scrollProgress toàn bài', () => {
  const scroll = createRhythmScroll(DEMO_DATA)
  // Giữa segment 3 (ô 12–16, khối cao 180px): 220 + 90.
  assert.equal(playheadOffset(LAYOUT, scroll.locate(14)), 310)
  assert.notEqual(playheadOffset(LAYOUT, scroll.locate(14)), (14 / 52) * 1190)
  // Đầu từng segment rơi đúng mép trên khối của nó.
  let start = 0
  DEMO_DATA.segments.forEach((segment, index) => {
    assert.equal(playheadOffset(LAYOUT, scroll.locate(start)), TOPS[index])
    start += segment.measureCount
  })
})

test('cuộn: đoạn không lời (line = null) vẫn tiến dần tới câu kế, không đứng hình, không crash', () => {
  const scroll = createRhythmScroll(DEMO_DATA)
  assert.equal(DEMO_DATA.segments[0].line, null)
  assert.equal(playheadOffset(LAYOUT, scroll.locate(0)), 0)
  assert.equal(playheadOffset(LAYOUT, scroll.locate(2)), 20)
  assert.equal(playheadOffset(LAYOUT, scroll.locate(4)), 40)
  assert.equal(DEMO_DATA.segments[7].line, null)
  assert.equal(playheadOffset(LAYOUT, scroll.locate(38)), 900)
})

test('look-ahead: điểm đang chơi nằm ở 35–40% khung', () => {
  assert.ok(LOOKAHEAD_ANCHOR >= 0.35 && LOOKAHEAD_ANCHOR <= 0.4)
  const scroll = createRhythmScroll(DEMO_DATA)
  const at = scroll.locate(14)
  const viewport = 600
  const onScreen = playheadOffset(LAYOUT, at) - contentShift(LAYOUT, at, viewport)
  assert.equal(onScreen, viewport * LOOKAHEAD_ANCHOR)
  // Đầu bài: nội dung bị đẩy XUỐNG để câu đầu cũng nằm ở điểm neo, không dính mép trên.
  assert.equal(contentShift(LAYOUT, scroll.locate(0), viewport), -viewport * LOOKAHEAD_ANCHOR)
})

test('reduced-motion: không trôi — đứng ở đầu segment, chỉ đổi khi sang segment mới', () => {
  const scroll = createRhythmScroll(DEMO_DATA)
  for (const position of [12, 13, 14.5, 15.99]) assert.equal(playheadOffset(LAYOUT, scroll.locate(position), true), 220)
  assert.equal(playheadOffset(LAYOUT, scroll.locate(16), true), 400)
})

test('cuộn: chưa đo được layout thì trả 0, không NaN', () => {
  const scroll = createRhythmScroll(DEMO_DATA)
  assert.equal(playheadOffset({ segmentTops: [], contentHeight: 0 }, scroll.locate(10)), 0)
  assert.equal(contentShift({ segmentTops: [], contentHeight: 0 }, scroll.locate(10), 0), 0)
})

test('demo: dữ liệu hợp lệ, mọi segment lời trỏ tới dòng có thật, ghi rõ chưa kiểm chứng', () => {
  const lines = parseChordLines(DEMO_TEXT)
  for (const segment of DEMO_DATA.segments) {
    if (segment.line === null) continue
    for (let offset = 0; offset < (segment.lineCount ?? 1); offset++) assert.ok(lines[segment.line + offset]?.words.length)
  }
  assert.match(DEMO_DATA.provenance.generator, /NOT VISION VERIFIED/)
})

// ── Bouncing ball ──
// Hình học giả lập một câu 8 từ ở ba bề ngang điện thoại: mỗi từ rộng 62px, cách nhau 8px, lề trái 20px.
// Màn càng hẹp càng ít từ mỗi hàng → câu bị xuống hàng đúng như trên máy thật.
function wrappedBoxes(viewportWidth: number, words = 8, wordWidth = 62, gap = 8, margin = 20, rowHeight = 90) {
  const perRow = Math.max(1, Math.floor((viewportWidth - margin - 16 + gap) / (wordWidth + gap)))
  return Array.from({ length: words }, (_, index) => {
    const left = margin + (index % perRow) * (wordWidth + gap)
    return { left, right: left + wordWidth, top: 300 + Math.floor(index / perRow) * rowHeight }
  })
}

test('ball X: segmentProgress tăng → ball tiến theo đường đọc, không lùi trong cùng hàng, không reset theo ô nhịp', () => {
  const rows = buildReadingRows(wrappedBoxes(1280))
  assert.equal(rows.length, 1)
  const scroll = createRhythmScroll(DEMO_DATA)
  let previous = -Infinity
  for (let step = 0; step < 400; step++) {                 // segment 1: ô 4 → 8, quét qua 4 ô nhịp
    const at = scroll.locate(4 + step / 100)
    const point = ballPoint(rows, at.segmentProgress, at.measureProgress)!
    assert.ok(point.x >= previous, `lùi ở ô ${4 + step / 100}`)
    previous = point.x
  }
  assert.equal(ballPoint(rows, 0, 0)!.x, rows[0].left)
  assert.equal(ballPoint(rows, 0.5, 0)!.x, (rows[0].left + rows[0].right) / 2)
  assert.equal(ballPoint(rows, 1, 0)!.x, rows[0].right)
  // Qua ranh giới ô nhịp (ô 5 → ô 6) X vẫn đi tiếp, chỉ cú nảy bắt đầu lại.
  const before = scroll.locate(4.999), after = scroll.locate(5.001)
  assert.ok(ballPoint(rows, after.segmentProgress, after.measureProgress)!.x > ballPoint(rows, before.segmentProgress, before.measureProgress)!.x)
})

test('ball Y: mỗi Ô NHỊP một cú nảy — thấp ở đầu ô, cao nhất giữa ô, thấp lại cuối ô, ô mới nảy lại', () => {
  const rows = buildReadingRows(wrappedBoxes(1280))
  const low = rows[0].top + BALL_LANE - BALL_RADIUS - 1
  const y = (measureProgress: number) => ballPoint(rows, 0.3, measureProgress)!.y
  assert.equal(y(0), low)
  assert.ok(Math.abs(y(0.5) - (low - BALL_AMPLITUDE)) < 1e-9)
  assert.ok(Math.abs(y(0.999) - low) < 0.1)
  assert.ok(y(0.25) < y(0) && y(0.5) < y(0.25) && y(0.75) > y(0.5))
  for (let step = 0; step <= 100; step++) assert.ok(y(step / 100) <= low && y(step / 100) >= low - BALL_AMPLITUDE - 1e-9)
  // Cả 4 ô của một segment: đúng 4 đỉnh, mỗi đỉnh ở giữa một ô — không phải mỗi phách một lần.
  const scroll = createRhythmScroll(DEMO_DATA)
  let peaks = 0
  let rising = false
  let last = 0
  for (let step = 0; step < 400; step++) {
    const lift = ballPoint(rows, 0, scroll.locate(4 + step / 100).measureProgress)!.lift
    if (lift < last && rising) peaks++
    rising = lift > last
    last = lift
  }
  assert.equal(peaks, 4)
  // Ball luôn nằm gọn trong làn trống phía trên hàng chữ: không che hợp âm bên dưới, không chạm hàng trên.
  assert.ok(low + BALL_RADIUS <= rows[0].top + BALL_LANE)
  assert.ok(low - BALL_AMPLITUDE - BALL_RADIUS >= rows[0].top)
  assert.equal(ballPoint(rows, 0.3, 0.5, false)!.y, low, 'reduced-motion: không nảy')
})

for (const width of [320, 375, 390]) {
  test(`ball xuống hàng @${width}px: đi hết hàng 1 rồi sang đầu hàng 2, không bay chéo qua khoảng trống`, () => {
    const rows = buildReadingRows(wrappedBoxes(width))
    assert.ok(rows.length >= 2, 'câu phải bị xuống hàng ở bề ngang này')
    let previous = ballPoint(rows, 0, 0)!
    assert.deepEqual([previous.row, previous.x], [0, rows[0].left])
    const visited = new Set([0])
    for (let step = 1; step <= 2000; step++) {
      const point = ballPoint(rows, step / 2000, 0)!
      const row = rows[point.row]
      assert.ok(point.x >= row.left && point.x <= row.right, 'ball luôn nằm trong bề ngang của hàng đang đọc')
      if (point.row === previous.row) assert.ok(point.x >= previous.x)
      else {
        // Đổi hàng: hàng kế tiếp, vừa hết hàng cũ, và đáp xuống ngay mép trái hàng mới.
        assert.equal(point.row, previous.row + 1)
        assert.ok(rows[previous.row].right - previous.x < 1, 'chỉ rời hàng khi đã đi hết hàng')
        assert.ok(point.x - row.left < 1, 'vào hàng mới từ mép trái')
        assert.equal(point.y, row.top + BALL_LANE - BALL_RADIUS - 1)
      }
      visited.add(point.row)
      previous = point
    }
    assert.equal(visited.size, rows.length)
    assert.equal(previous.x, rows[rows.length - 1].right)
  })
}

test('ball: quãng đường chia theo bề ngang thật của từng hàng; không có hàng → null', () => {
  const rows = [{ left: 20, right: 320, top: 0 }, { left: 20, right: 120, top: 90 }]   // 300px + 100px
  assert.deepEqual([ballPoint(rows, 0.74, 0)!.row, ballPoint(rows, 0.76, 0)!.row], [0, 1])
  assert.equal(ballPoint(rows, 0.875, 0)!.x, 70)
  assert.equal(ballPoint([], 0.5, 0.5), null)
  assert.equal(ballPoint([{ left: 5, right: 5, top: 0 }], 0.7, 0)!.x, 5, 'chưa đo được bề ngang thì đứng yên, không NaN')
})
