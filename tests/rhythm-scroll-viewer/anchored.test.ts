import assert from 'node:assert/strict'
import { test } from 'node:test'
import { measuresAtSeconds } from '../../src/rhythm-scroll/index.ts'
import { anchorTextIssues, createAnchoredScroll } from '../../src/rhythm-scroll-viewer/anchored.ts'
import type { RhythmScrollAnchoredData } from '../../src/rhythm-scroll-viewer/anchored.ts'
import { BALL_AMPLITUDE, BALL_LANE, BALL_RADIUS, ballBetweenAnchors, pathOffset } from '../../src/rhythm-scroll-viewer/ballPath.ts'
import { parseChordLines } from '../../src/rhythm-scroll-viewer/chordLines.ts'
import { REAL_DATA, REAL_DEFAULT_BPM, REAL_TEXT } from '../../src/rhythm-scroll-viewer/proof/realAnchors.ts'

const lines = parseChordLines(REAL_TEXT)
const word = (line: number, token: number) => lines[line].words[token]?.text

// ── Dữ liệu thật ──
test('neo thật: 48 ô + nhịp lấy đà, mọi neo trỏ vào chữ có thật của lời chuẩn', () => {
  assert.equal(REAL_DATA.measures.length, 48)
  assert.deepEqual(REAL_DATA.pickup, { line: 0, token: 0 })
  assert.equal(lines.length, 18)
  assert.equal(lines.reduce((sum, line) => sum + line.words.length, 0), 168)
  assert.deepEqual(anchorTextIssues(REAL_DATA, lines.map(line => line.words.length)), [])
  assert.match(REAL_DATA.provenance.generator, /REAL_SHEET_ANCHORS/)
  assert.match(REAL_DATA.provenance.generator, /VISION_PRODUCTION_VERIFIED = NO/)
  assert.ok(REAL_DEFAULT_BPM >= 60 && REAL_DEFAULT_BPM <= 72)
})

test('neo thật: vạch nhịp rơi đúng những chữ đã kiểm trên sheet; lời 1 và lời 2 cùng một mẫu', () => {
  const starts = REAL_DATA.measures.map(anchor => word(anchor.line!, anchor.token!))
  assert.deepEqual(starts.slice(0, 8), ['nao,', 'đi', 'tàn', 'Hoàng', 'hôn', 'màu', 'ta', 'Muốn'])
  assert.deepEqual(starts.slice(15, 19), ['Xe', 'êm', 'đèn', 'bay'])
  // Lời 2 (từ dòng 13) in ở chỗ khác trên sheet nhưng cho cùng mẫu chữ-mỗi-ô với lời 1 (dòng 0–4).
  const shape = (from: number, count: number) => REAL_DATA.measures.slice(from, from + count)
    .map(anchor => `${anchor.line! - REAL_DATA.measures[from].line!}:${anchor.token}`)
  assert.deepEqual(shape(32, 15), shape(0, 15))
  assert.deepEqual(REAL_DATA.measures.at(-1), { line: 17, token: 10 }, 'ô cuối: ngân sau chữ cuối')
  // Vạch nhịp không bao giờ đi lùi trong lời.
  const order = REAL_DATA.measures.map(anchor => anchor.line! * 100 + anchor.token!)
  assert.ok(order.every((value, index) => index === 0 || value > order[index - 1]))
})

// ── A + B. Neo và nhịp lấy đà ──
test('locate: ô dẫn vào neo ở "Chiều"; ô N trả đúng neo N và neo kế', () => {
  const scroll = createAnchoredScroll(REAL_DATA)
  assert.equal(scroll.totalMeasures, 49)
  assert.equal(scroll.hasPickup, true)
  const lead = scroll.locate(0)
  assert.deepEqual([lead.state, lead.isPickup, lead.current, lead.next], ['active', true, { line: 0, token: 0 }, { line: 0, token: 1 }])
  assert.equal(word(0, 0), 'Chiều')
  for (const index of [0, 1, 7, 20, 46]) {
    const at = scroll.locate(index + 1 + 0.25)             // +1: ô 0 của dòng thời gian là ô dẫn vào
    assert.deepEqual(at.current, REAL_DATA.measures[index])
    assert.deepEqual(at.next, REAL_DATA.measures[index + 1])
    assert.equal(at.measureProgress, 0.25)
    assert.equal(at.isPickup, false)
  }
  const last = scroll.locate(48.5)
  assert.deepEqual([last.current, last.next], [{ line: 17, token: 10 }, { line: 17, token: 10 }])
})

test('locate: biên trước bài / hết bài; không có pickup thì ô 0 là ô đầy đủ đầu tiên', () => {
  const scroll = createAnchoredScroll(REAL_DATA)
  assert.equal(scroll.locate(-0.5).state, 'before')
  assert.deepEqual([scroll.locate(49).state, scroll.locate(49).measureProgress, scroll.locate(49).measureIndex], ['ended', 1, 48])
  assert.throws(() => scroll.locate(NaN), RangeError)
  const { pickup: _pickup, ...rest } = REAL_DATA
  const plain = createAnchoredScroll(rest as RhythmScrollAnchoredData)
  assert.equal(plain.totalMeasures, 48)
  assert.deepEqual([plain.locate(0).current, plain.locate(0).isPickup], [REAL_DATA.measures[0], false])
  assert.throws(() => createAnchoredScroll({ ...REAL_DATA, measures: [] }), RangeError)
  assert.throws(() => createAnchoredScroll({ ...REAL_DATA, measures: [{ line: 0, token: -1 }] }), RangeError)
  assert.throws(() => createAnchoredScroll({ ...REAL_DATA, measures: [{ line: null, token: 2 }] }), RangeError)
  assert.equal(anchorTextIssues({ ...REAL_DATA, measures: [{ line: 0, token: 11 }] }, [10]).length, 1)
})

test('một nguồn thời gian: giây → ô → neo (BPM 60, 4/4: mỗi ô 4 giây)', () => {
  const scroll = createAnchoredScroll(REAL_DATA)
  const at = scroll.locate(measuresAtSeconds(10, 60, REAL_DATA.meter))     // 2.5 → ô đầy đủ thứ 2, giữa ô
  assert.deepEqual([at.measureIndex, at.measureProgress, word(at.current.line!, at.current.token!)], [2, 0.5, 'đi'])
})

// ── C–E. Ball giữa hai neo ──
// Hai hàng nhìn thấy: hàng 0 dài 300px (x 20→320), hàng 1 dài 200px (x 20→220).
const ROWS = [{ left: 20, right: 320, top: 100 }, { left: 20, right: 220, top: 190 }]
const LOW = (row: number) => ROWS[row].top + BALL_LANE - BALL_RADIUS - 1

test('ball: đầu ô ở neo hiện tại, giữa ô ở giữa quãng đường, cuối ô tới neo kế; mỗi ô một cú nảy', () => {
  const from = { row: 0, x: 80 }, to = { row: 0, x: 200 }
  const start = ballBetweenAnchors(ROWS, from, to, 0)!
  assert.deepEqual([start.x, start.y, start.row], [80, LOW(0), 0])
  const middle = ballBetweenAnchors(ROWS, from, to, 0.5)!
  assert.equal(middle.x, 140)
  assert.ok(Math.abs(middle.y - (LOW(0) - BALL_AMPLITUDE)) < 1e-9)
  const end = ballBetweenAnchors(ROWS, from, to, 0.999)!
  assert.ok(Math.abs(end.x - 200) < 0.2 && Math.abs(end.y - LOW(0)) < 0.2)
  // Ô kế bắt đầu đúng tại neo vừa tới.
  assert.equal(ballBetweenAnchors(ROWS, to, { row: 0, x: 290 }, 0)!.x, 200)
  let previous = -Infinity
  for (let step = 0; step <= 100; step++) {
    const x = ballBetweenAnchors(ROWS, from, to, step / 100)!.x
    assert.ok(x >= previous)
    previous = x
  }
})

test('ô ngân: hai neo trùng nhau → X đứng yên tại chữ đang ngân, Y vẫn nảy một lần', () => {
  const hold = { row: 1, x: 220 }                                          // mép phải chữ cuối
  const xs = new Set<number>()
  let highest = Infinity
  for (let step = 0; step <= 100; step++) {
    const point = ballBetweenAnchors(ROWS, hold, hold, step / 100)!
    xs.add(point.x)
    assert.equal(point.row, 1)
    highest = Math.min(highest, point.y)
  }
  assert.deepEqual([...xs], [220])
  assert.ok(Math.abs(highest - (LOW(1) - BALL_AMPLITUDE)) < 1e-9)
  // Neo ở mép phải hàng 0 (hết dòng) cũng không được trượt xuống hàng 1.
  const edge = ballBetweenAnchors(ROWS, { row: 0, x: 320 }, { row: 0, x: 320 }, 0.5)!
  assert.deepEqual([edge.row, edge.x], [0, 320])
})

test('qua dòng: đi hết phần còn lại của hàng trên rồi sang mép trái hàng dưới — không bay chéo', () => {
  const from = { row: 0, x: 260 }, to = { row: 1, x: 60 }                   // quãng đường: 60 + 40 = 100px
  assert.equal(pathOffset(ROWS, to) - pathOffset(ROWS, from), 100)
  let previous = ballBetweenAnchors(ROWS, from, to, 0)!
  assert.deepEqual([previous.row, previous.x], [0, 260])
  let changes = 0
  for (let step = 1; step <= 1000; step++) {
    const point = ballBetweenAnchors(ROWS, from, to, step / 1000)!
    assert.ok(point.x >= ROWS[point.row].left && point.x <= ROWS[point.row].right)
    if (point.row !== previous.row) {
      changes++
      assert.equal(point.row, 1)
      assert.ok(ROWS[0].right - previous.x < 0.2, 'chỉ rời hàng trên khi đã tới mép phải')
      assert.ok(point.x - ROWS[1].left < 0.2, 'đáp xuống mép trái hàng dưới')
    } else assert.ok(point.x >= previous.x)
    previous = point
  }
  assert.equal(changes, 1)
  assert.deepEqual([previous.row, previous.x], [1, 60])
  assert.equal(ballBetweenAnchors(ROWS, from, to, 0.59)!.row, 0)
  assert.equal(ballBetweenAnchors(ROWS, from, to, 0.61)!.row, 1)
  assert.equal(ballBetweenAnchors(ROWS, { row: 5, x: 0 }, to, 0.5), null)
  assert.equal(ballBetweenAnchors(ROWS, from, to, 0.5, false)!.y, LOW(0), 'reduced-motion: không nảy')
})
