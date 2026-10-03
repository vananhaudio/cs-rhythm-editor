import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import React from 'react'
import { render, cleanup } from '@testing-library/react'
import RhythmChordViewer from '../../src/rhythm-scroll-viewer/RhythmChordViewer'
import { BALL_AMPLITUDE, BALL_LANE, BALL_RADIUS } from '../../src/rhythm-scroll-viewer/ballPath'
import { DEMO_DATA, DEMO_TEXT } from '../../src/rhythm-scroll-viewer/proof/demoSong'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://localhost' })
Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  IS_REACT_ACT_ENVIRONMENT: { configurable: true, writable: true, value: true },
})
afterEach(cleanup)

// jsdom không dàn trang. Giả lập hình học: mỗi hàng chứa 4 từ (từ rộng 50px, bước 60px, hàng cao 80px),
// segment thứ n bắt đầu ở y = n × 1000 — đủ để kiểm ball bám đúng chữ, đúng hàng, đúng segment.
const WORDS_PER_ROW = 4
dom.window.HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
  const rect = (left: number, top: number, width: number, height: number) =>
    ({ left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON() {} }) as DOMRect
  if (!this.hasAttribute('data-word')) return rect(0, 0, 0, 0)
  const line = this.parentElement as HTMLElement
  const block = line.parentElement as HTMLElement
  const index = Array.from(line.children).indexOf(this)
  const lineIndex = Array.from(block.querySelectorAll('[data-line]')).indexOf(line)
  const top = Number(block.dataset.segment) * 1000 + lineIndex * 400 + Math.floor(index / WORDS_PER_ROW) * 80
  return rect(20 + (index % WORDS_PER_ROW) * 60, top, 50, 70)
}

const view = (measurePosition: number, reducedMotion = false) =>
  <RhythmChordViewer text={DEMO_TEXT} data={DEMO_DATA} measurePosition={measurePosition} reducedMotion={reducedMotion} />
const ball = (container: HTMLElement) => {
  const element = container.querySelector('[data-testid="bounce-ball"]') as HTMLElement | null
  if (!element) return null
  const [x, y] = element.style.transform.match(/-?[\d.]+(?=px)/g)!.map(Number)
  return { x: x + BALL_RADIUS, y: y + BALL_RADIUS, row: Number(element.dataset.row), inContent: element.parentElement?.getAttribute('data-testid') === 'scroll-content' }
}

test('render: hợp âm nằm TRÊN đúng từ của nó, lời không còn ngoặc vuông', () => {
  const { container } = render(view(0))
  const firstLine = container.querySelector('[data-line="0"]') as HTMLElement
  assert.equal(firstLine.textContent?.includes('['), false)
  const chords = Array.from(firstLine.querySelectorAll('[data-chord]')) as HTMLElement[]
  assert.deepEqual(chords.map(chord => chord.dataset.chord), ['Am', 'E7', 'Am'])
  // Mỗi từ là một cột: hợp âm là phần tử TRƯỚC, chữ là phần tử SAU trong cùng cột.
  assert.deepEqual(chords.map(chord => chord.nextElementSibling?.textContent), ['nao,', 'đi', 'tàn'])
  assert.equal((chords[0].parentElement as HTMLElement).style.flexDirection, 'column')
})

test('render: segment vẽ theo thứ tự biểu diễn; đoạn không lời là nhãn, không phải dòng lời giả', () => {
  const { container } = render(view(0))
  const blocks = Array.from(container.querySelectorAll('[data-segment]')) as HTMLElement[]
  assert.equal(blocks.length, DEMO_DATA.segments.length)
  assert.deepEqual(blocks.map(block => block.dataset.kind),
    DEMO_DATA.segments.map(segment => (segment.line === null ? 'instrumental' : 'lyric')))
  assert.equal(blocks[0].querySelector('[data-line]'), null)
  assert.match(blocks[0].textContent ?? '', /Dạo · 4 ô/)
  // Điệp khúc hát lại → dòng 4 xuất hiện hai lần.
  assert.equal(container.querySelectorAll('[data-line="4"]').length, 2)
  assert.equal(blocks[5].querySelectorAll('[data-line]').length, 2)
})

test('thanh tiến trình cũ đã bỏ: không còn ball/mũi tên/nhãn "Ô x/52" phía trên viewer', () => {
  const { container } = render(view(5.5))
  assert.equal(container.querySelector('[data-testid="measure-ball"]'), null)
  assert.equal(container.querySelector('[data-testid="measure-label"]'), null)
  assert.doesNotMatch(container.textContent ?? '', /Ô \d+\/52/)
  assert.equal(container.querySelector('[data-beat]'), null)
})

test('bouncing ball: nằm TRONG nội dung cuộn, ngay trên dòng đang đọc; X theo segment, Y nảy theo ô', () => {
  // Segment 1 = dòng 0 (11 từ → 3 hàng giả lập: 4 + 4 + 3), ô 4 → 8.
  const { container, rerender } = render(view(4))
  const start = ball(container)!
  assert.equal(start.inContent, true, 'ball đi cùng nội dung khi cuộn, không ghim vào khung')
  assert.deepEqual([start.row, start.x], [0, 20])
  const low = 1000 + BALL_LANE - BALL_RADIUS - 1
  assert.equal(start.y, low)
  rerender(view(4.5))                                         // giữa ô đầu: đỉnh cú nảy
  const peak = ball(container)!
  assert.ok(Math.abs(peak.y - (low - BALL_AMPLITUDE)) < 0.01)
  assert.ok(peak.x > start.x)
  rerender(view(4.999))
  const landing = ball(container)!
  assert.ok(Math.abs(landing.y - low) < 0.1 && landing.x > peak.x)
  rerender(view(5.5))                                         // ô kế: nảy lại, X KHÔNG quay về đầu
  const second = ball(container)!
  assert.ok(Math.abs(second.y - (ball(container)!.row * 80 + low - BALL_AMPLITUDE)) < 0.01)
  assert.ok(second.row > 0 || second.x > landing.x)
})

test('bouncing ball: câu xuống hàng → đi hết hàng trên rồi sang mép trái hàng dưới', () => {
  const { container, rerender } = render(view(4))
  const seen: { row: number; x: number }[] = []
  for (let step = 0; step < 400; step++) {
    rerender(view(4 + step / 100))
    const at = ball(container)!
    const last = seen[seen.length - 1]
    if (last && at.row !== last.row) {
      assert.equal(at.row, last.row + 1)
      assert.ok(at.x - 20 < 3, 'đáp xuống mép trái hàng mới')
    } else if (last) assert.ok(at.x >= last.x)
    assert.ok(at.x >= 20 && at.x <= 250)
    seen.push(at)
  }
  assert.deepEqual([...new Set(seen.map(at => at.row))], [0, 1, 2])
})

test('bouncing ball: ẩn ở đoạn không lời, trước bài và hết bài; hiện lại đúng chỗ khi vào segment có lời', () => {
  const { container, rerender } = render(view(-1))
  assert.equal(ball(container), null)
  rerender(view(2))                                           // Dạo
  assert.equal(ball(container), null)
  rerender(view(4))                                           // vào lời: segment 1
  assert.deepEqual([ball(container)!.x, ball(container)!.y], [20, 1000 + BALL_LANE - BALL_RADIUS - 1])
  rerender(view(8))                                           // sang segment 2: đường đọc mới
  assert.deepEqual([ball(container)!.x, ball(container)!.y], [20, 2000 + BALL_LANE - BALL_RADIUS - 1])
  rerender(view(38))                                          // Gian tấu
  assert.equal(ball(container), null)
  rerender(view(40))                                          // ĐK hát lại: segment 8
  assert.deepEqual([ball(container)!.x, ball(container)!.y], [20, 8000 + BALL_LANE - BALL_RADIUS - 1])
  rerender(view(52))
  assert.equal(ball(container), null)
  rerender(view(4.5, true))                                   // reduced-motion: vẫn dẫn mắt, không nảy
  assert.equal(ball(container)!.y, 1000 + BALL_LANE - BALL_RADIUS - 1)
})

test('trạng thái: segment hiện tại được đánh dấu; trước bài, trong đoạn dạo và hết bài đều không crash', () => {
  const { container, rerender } = render(view(-2))
  assert.equal((container.firstElementChild as HTMLElement).dataset.state, 'before')
  rerender(view(2))
  assert.equal(container.querySelector('[data-state="active"][data-segment]')?.getAttribute('data-kind'), 'instrumental')
  rerender(view(9))
  assert.equal(container.querySelector('[data-state="active"][data-segment]')?.getAttribute('data-segment'), '2')
  assert.equal(container.querySelectorAll('[data-state="past"][data-segment]').length, 2)
  rerender(view(38))
  assert.equal(container.querySelector('[data-state="active"][data-segment]')?.getAttribute('data-kind'), 'instrumental')
  rerender(view(999))
  assert.equal((container.firstElementChild as HTMLElement).dataset.state, 'ended')
  rerender(view(9, true))
  assert.match((container.querySelector('[data-testid="scroll-content"]') as HTMLElement).style.transform, /translate3d/)
})
