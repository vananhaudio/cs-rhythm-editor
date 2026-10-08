// Rhythm Scroll production page (jsdom): một đồng hồ → ball + cuộn + hợp âm; cảnh báo suy luận; lỗi thiếu dữ liệu.
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import React from 'react'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://class.vananhaudio.com/thuvien?muc=hopam' })
Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  HTMLElement: { configurable: true, value: dom.window.HTMLElement },
  IS_REACT_ACT_ENVIRONMENT: { configurable: true, writable: true, value: true },
})
dom.window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof dom.window.matchMedia
globalThis.fetch = (() => Promise.reject(new Error('không được gọi mạng'))) as typeof fetch

const { render, act, cleanup, fireEvent } = await import('@testing-library/react')
const { default: RhythmScrollPage } = await import('../../src/thuvien/RhythmScrollPage')
const { createMockChordLibrary } = await import('../../src/thuvien/chordLibrary')
type Detail = Awaited<ReturnType<ReturnType<typeof createMockChordLibrary>['getChordSheet']>>
void React

afterEach(cleanup)
const settle = (ms = 30) => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)) })

const TEXT = '1. [C] một hai ba bốn [G] năm sáu bảy tám\n[Am] chín mười mười một [F] mười hai'
function libraryWith(patch: Partial<Detail>) {
  const base: Detail = {
    sheetId: 's', versionId: 'v', title: 'Bài thử', composer: null, hasAnchors: true, updatedAt: '2026-10-08T00:00:00.000Z', status: 'current', draftVersionId: null,
    versionNumber: 1, text: TEXT, meter: { beats: 4, beatType: 4 }, suggestedBpm: 90, hasSource: false, sources: [],
    anchors: { measures: [{ line: 0, token: 0 }, { line: 0, token: 4 }, { line: 1, token: 0 }, { line: 1, token: 4 }] }, anchorsStatus: 'ready',
  }
  const library = createMockChordLibrary()
  library.getChordSheet = async () => ({ ...base, ...patch })
  return library
}
const open = async (patch: Partial<Detail> = {}) => {
  const view = render(<RhythmScrollPage library={libraryWith(patch)} versionId="v" onBack={() => {}} />)
  await settle()
  return view
}
const seek = (view: ReturnType<typeof render>, beat: number) => fireEvent.change(view.getByLabelText('Vị trí (phách)'), { target: { value: String(beat) } })

test('hiện nhịp, số ô, tổng phách; hợp âm đầu bài sáng và đổi đúng mốc phách (cùng một đồng hồ với ô)', async () => {
  const view = await open()
  assert.match(view.getByTestId('rhythm-status').textContent!, /Nhịp 4\/4.*4 ô.*16 phách/)
  assert.equal(view.getByTestId('rs-chord-now').textContent, 'C', 'đứng ở phách 0: hợp âm đầu bài')
  assert.match(view.getByTestId('rs-beat').textContent!, /ô 1 · phách 1/)
  const root = () => view.container.querySelector('[data-measure]') as HTMLElement
  seek(view, 0.5)
  assert.equal(view.getByTestId('rs-chord-now').textContent, 'C')
  assert.equal(root().dataset.measure, '0')
  seek(view, 3.75)
  assert.equal(view.getByTestId('rs-chord-now').textContent, 'C')
  seek(view, 4)
  assert.equal(view.getByTestId('rs-chord-now').textContent, 'G', 'ô 2 bắt đầu ở phách 4: đổi hợp âm VÀ sang ô mới cùng lúc')
  assert.equal(root().dataset.measure, '1')
  assert.ok(view.container.querySelector('[data-active-chord]')?.textContent?.includes('G'))
  seek(view, 8)
  assert.equal(view.getByTestId('rs-chord-now').textContent, 'Am')
  assert.equal(root().dataset.measure, '2')
  seek(view, 15.9)
  assert.equal(view.getByTestId('rs-chord-now').textContent, 'F')
  assert.equal(root().dataset.measure, '3')
  assert.match(view.getByTestId('rs-beat').textContent!, /ô 4 · phách 4/)
})

test('ô có hợp âm đổi giữa ô → cảnh báo "suy luận — chưa xác minh" hiện cho người xem', async () => {
  const view = await open({ text: '[C] một hai [G] ba bốn', anchors: { measures: [{ line: 0, token: 0 }] } })
  assert.match(view.getByTestId('rhythm-unverified').textContent!, /1 ô.*suy luận/)
})

test('đổi số chỉ nhịp → tổng phách đổi theo, không lưu gì', async () => {
  const view = await open()
  fireEvent.change(view.getByLabelText('Số chỉ nhịp'), { target: { value: '2/4' } })
  await settle()
  assert.match(view.getByTestId('rhythm-status').textContent!, /Nhịp 2\/4.*8 phách/)
})

test('chưa có vạch nhịp / chưa có số chỉ nhịp → nói thẳng, không bịa', async () => {
  const noAnchors = await open({ anchors: null, hasAnchors: false, anchorsStatus: 'none' })
  assert.match(noAnchors.getByRole('alert').textContent!, /chưa có vạch nhịp/)
  cleanup()
  const noMeter = await open({ meter: null })
  assert.match(noMeter.getByRole('alert').textContent!, /chưa có số chỉ nhịp/)
})

test('nhịp lấy đà: ô lấy đà ngắn, hợp âm đầu chưa vang, tổng phách = lấy đà + ô × beats, báo suy luận', async () => {
  const view = await open({ text: 'Chiều [Am] nao tiễn nhau [E7] đi', anchors: { pickup: { line: 0, token: 0 }, measures: [{ line: 0, token: 1 }, { line: 0, token: 4 }] } })
  assert.match(view.getByTestId('rhythm-status').textContent!, /lấy đà 1 phách \+ 2 ô.*9 phách.*lấy đà là suy luận/)
  seek(view, 0.5)
  assert.equal(view.getByTestId('rs-chord-now').textContent, '—')
  seek(view, 1)
  assert.equal(view.getByTestId('rs-chord-now').textContent, 'Am')
})
