import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import React from 'react'
import { render, cleanup } from '@testing-library/react'
import AnchoredChordViewer from '../../src/rhythm-scroll-viewer/AnchoredChordViewer'
import { BALL_AMPLITUDE, BALL_LANE, BALL_RADIUS } from '../../src/rhythm-scroll-viewer/ballPath'
import { LOOKAHEAD_ANCHOR } from '../../src/rhythm-scroll-viewer/scrollModel'
import { REAL_DATA, REAL_LABELS, REAL_TEXT } from '../../src/rhythm-scroll-viewer/proof/realAnchors'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://localhost' })
Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  IS_REACT_ACT_ENVIRONMENT: { configurable: true, writable: true, value: true },
})
afterEach(cleanup)

// jsdom không dàn trang. Giả lập điện thoại hẹp: mỗi hàng 4 chữ (chữ rộng 50px, bước 60px), hàng cao 80px;
// dòng 10 chữ thành 3 hàng (4 + 4 + 2), các dòng xếp nối nhau cách 20px — như flex-wrap thật.
const PER_ROW = 4
const VIEWPORT = 600
const WORDS = REAL_TEXT.split('\n').map(line => line.replace(/\[[^\]]+\]/g, ' ').split(/\s+/).filter(Boolean).length)
const LINE_TOP = WORDS.map((_, line) => WORDS.slice(0, line).reduce((sum, count) => sum + Math.ceil(count / PER_ROW) * 80 + 20, 0))
dom.window.HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
  const rect = (left: number, top: number, width: number, height: number) =>
    ({ left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON() {} }) as DOMRect
  if (!this.hasAttribute('data-word')) return rect(0, 0, 0, 0)
  const [line, token] = this.dataset.word!.split(':').map(Number)
  return rect(20 + (token % PER_ROW) * 60, LINE_TOP[line] + Math.floor(token / PER_ROW) * 80, 50, 70)
}
Object.defineProperty(dom.window.HTMLElement.prototype, 'clientHeight', { configurable: true, get() { return VIEWPORT } })

const left = (token: number) => 20 + (token % PER_ROW) * 60
const rowTop = (line: number, token: number) => LINE_TOP[line] + Math.floor(token / PER_ROW) * 80
const low = (line: number, token: number) => rowTop(line, token) + BALL_LANE - BALL_RADIUS - 1
const view = (measurePosition: number, extra: { reducedMotion?: boolean; showAnchors?: boolean } = {}) =>
  <AnchoredChordViewer text={REAL_TEXT} data={REAL_DATA} labels={REAL_LABELS} measurePosition={measurePosition} {...extra} />
const numbers = (element: HTMLElement) => element.style.transform.match(/-?[\d.]+(?=px)/g)!.map(Number)
const ball = (container: HTMLElement) => {
  const element = container.querySelector('[data-testid="bounce-ball"]') as HTMLElement | null
  if (!element) return null
  const [x, y] = numbers(element)
  return { x: x + BALL_RADIUS, y: y + BALL_RADIUS }
}
/** Vị trí ball TRÊN MÀN HÌNH (toạ độ khung nhìn) = toạ độ nội dung + độ dịch nội dung. */
const onScreenY = (container: HTMLElement) =>
  ball(container)!.y + numbers(container.querySelector('[data-testid="scroll-content"]') as HTMLElement)[0]

test('render: đủ 18 dòng lời chuẩn, hợp âm trên đúng chữ, nhãn đoạn không lẫn vào chữ', () => {
  const { container } = render(view(0))
  assert.equal(container.querySelectorAll('[data-line]').length, 18)
  assert.equal(container.querySelectorAll('[data-word]').length, 168)
  assert.equal(container.querySelector('[role="alert"]'), null, 'neo khớp lời')
  const first = container.querySelector('[data-line="0"]') as HTMLElement
  assert.deepEqual(Array.from(first.querySelectorAll('[data-chord]')).map(chord => [(chord as HTMLElement).dataset.chord, chord.nextElementSibling?.textContent]),
    [['Am', 'nao,'], ['E7', 'đi'], ['Am', 'tàn']])
  assert.equal(container.querySelector('[data-word="5:0"]')?.textContent?.trim(), 'Xe')
  assert.equal(container.querySelector('[data-anchor-mark]'), null, 'mặc định không hiện vạch soi')
})

test('nhịp lấy đà: ô dẫn vào ball đứng ở "Chiều" rồi đi tới neo ô đầu "nao,"', () => {
  const { container, rerender } = render(view(0))
  assert.deepEqual(ball(container), { x: left(0), y: low(0, 0) })
  rerender(view(0.5))
  assert.equal(ball(container)!.x, (left(0) + left(1)) / 2)
  rerender(view(1))                                              // ô đầy đủ đầu tiên
  assert.deepEqual(ball(container), { x: left(1), y: low(0, 1) })
  assert.equal((container.firstElementChild as HTMLElement).dataset.measure, '1')
})

test('ball theo neo: đầu ô ở neo hiện tại, giữa ô ở đỉnh nảy giữa đường, hết ô tới neo kế', () => {
  // Ô 2 của dòng thời gian: "nao," (0:1) → "đi" (0:4). Với 4 chữ/hàng: từ hàng 0 sang đầu hàng 1.
  const { container, rerender } = render(view(1))
  const start = ball(container)!
  rerender(view(1.5))
  const middle = ball(container)!
  assert.ok(middle.x > start.x && Math.abs(middle.y - (low(0, 1) - BALL_AMPLITUDE)) < 0.01)
  rerender(view(1.9999))                                        // hết ô: tới mép phải hàng trên, sát vạch nhịp kế
  assert.ok(Math.abs(ball(container)!.x - (left(3) + 50)) < 0.5 && Math.abs(ball(container)!.y - low(0, 1)) < 0.5)
  rerender(view(2))
  assert.deepEqual(ball(container), { x: left(4), y: low(0, 4) })
})

test('xuống hàng và sang dòng: không bao giờ bay chéo, không lùi; cả bài ball luôn nằm trên một hàng chữ', () => {
  const { container, rerender } = render(view(0))
  let previous = ball(container)!
  let rowChanges = 0
  for (let step = 1; step < 49 * 40; step++) {
    rerender(view(step / 40))
    const at = ball(container)!
    assert.ok(at.x >= 20 && at.x <= 250, `ball ra ngoài bề ngang chữ ở ô ${step / 40}`)
    const base = at.y + BALL_RADIUS + 1 - BALL_LANE              // mép trên hàng gần nhất phía dưới ball (khi sát chữ)
    const sameRow = Math.abs(base - (previous.y + BALL_RADIUS + 1 - BALL_LANE)) < BALL_AMPLITUDE + 1
    if (sameRow) assert.ok(at.x >= previous.x - 0.01, `lùi ở ô ${step / 40}`)
    else {
      rowChanges++
      assert.ok(at.x - 20 < 20, `đổi hàng phải đáp gần mép trái (ô ${step / 40}, x=${at.x})`)
      assert.ok(at.y > previous.y, 'đổi hàng là đi XUỐNG')
    }
    previous = at
  }
  assert.ok(rowChanges >= 30)
})

test('ô ngân cuối bài: X đứng tại mép phải chữ cuối, Y vẫn nảy', () => {
  const { container, rerender } = render(view(48))
  const end = left(9) + 50                                        // mép phải "hôn." (17:9)
  const ys: number[] = []
  for (const progress of [0, 0.25, 0.5, 0.75, 0.99]) {
    rerender(view(48 + progress))
    assert.equal(ball(container)!.x, end)
    ys.push(ball(container)!.y)
  }
  assert.ok(ys[2] < ys[1] && ys[1] < ys[0] && ys[3] > ys[2] && ys[4] > ys[3])
  rerender(view(49))
  assert.equal(ball(container), null, 'hết bài: ẩn ball')
  rerender(view(-1))
  assert.equal(ball(container), null, 'trước bài: ẩn ball')
})

test('auto-scroll bám neo: ball luôn trong khung và quanh điểm neo 38%; cuộn liên tục, không lùi', () => {
  const { container, rerender } = render(view(0))
  const content = () => numbers(container.querySelector('[data-testid="scroll-content"]') as HTMLElement)[0]
  let previousShift = -content()
  let largest = 0
  for (let step = 0; step < 49 * 40; step++) {
    rerender(view(step / 40))
    const y = onScreenY(container)
    assert.ok(y > 0 && y < VIEWPORT, `ball rời khung ở ô ${step / 40} (y=${y})`)
    assert.ok(y > VIEWPORT * 0.15 && y < VIEWPORT * 0.62, `ball xa vùng đọc ở ô ${step / 40} (y=${y})`)
    const shift = -content()
    assert.ok(shift >= previousShift - 0.01, 'cuộn không lùi')
    largest = Math.max(largest, shift - previousShift)
    previousShift = shift
  }
  assert.ok(largest < 12, `cuộn nhảy ${largest}px trong 1/40 ô`)
  rerender(view(0))                                               // ball ở đầu một hàng → hàng đó nằm đúng điểm neo 38%
  assert.ok(Math.abs(onScreenY(container) - (VIEWPORT * LOOKAHEAD_ANCHOR + BALL_LANE - BALL_RADIUS - 1)) < 0.5)
})

test('dòng đang hát được làm nổi; chế độ soi hiện vạch tại đúng các chữ neo; reduced-motion không nảy', () => {
  const { container, rerender } = render(view(3))               // ô "tàn" (0:9) → "Hoàng" (1:0)
  assert.deepEqual(Array.from(container.querySelectorAll('[data-line][data-state="active"]')).map(line => line.getAttribute('data-line')), ['0', '1'])
  rerender(view(3, { showAnchors: true }))
  const marked = Array.from(container.querySelectorAll('[data-anchor-mark]')).map(mark => (mark.parentElement as HTMLElement).dataset.word)
  assert.equal(marked.length, 48, '49 neo, trừ neo "hết dòng" cuối bài không có chữ để gắn')
  assert.deepEqual(marked.slice(0, 5), ['0:0', '0:1', '0:4', '0:9', '1:0'])
  rerender(view(1.5, { reducedMotion: true }))
  assert.equal(ball(container)!.y, low(0, 1))
})
