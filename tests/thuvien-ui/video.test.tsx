// Play Scroll Video V1: bộ vẽ dùng dữ liệu thật + timeline; ghi chỉ nhận MP4; hành động chỉ hiện khi trang cấp quyền; dialog chạy đủ vòng.
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import React from 'react'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://class.vananhaudio.com/hopam/x' })
Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  HTMLElement: { configurable: true, value: dom.window.HTMLElement },
  HTMLCanvasElement: { configurable: true, value: dom.window.HTMLCanvasElement },
  IS_REACT_ACT_ENVIRONMENT: { configurable: true, writable: true, value: true },
})
dom.window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof dom.window.matchMedia
globalThis.fetch = (() => Promise.reject(new Error('không được gọi mạng'))) as typeof fetch
Object.assign(globalThis, { requestAnimationFrame: (cb: () => void) => setTimeout(cb, 16), cancelAnimationFrame: (id: number) => clearTimeout(id) })

// Canvas 2D giả: ghi lại mọi lời gọi.
type Call = { fn: string; args: unknown[] }
const calls: Call[] = []
const ctxStub = new Proxy({} as Record<string, unknown>, {
  get(target, prop: string) {
    if (prop === 'measureText') return (t: string) => ({ width: String(t).length * 20 })
    if (prop in target) return target[prop]
    return (...args: unknown[]) => { calls.push({ fn: prop, args }) }
  },
  set(target, prop: string, value) { target[prop] = value; if (prop === 'fillStyle') calls.push({ fn: 'fillStyle', args: [value] }); return true },
})
;(dom.window.HTMLCanvasElement.prototype as unknown as { getContext: unknown }).getContext = () => ctxStub
let captured = 0
;(dom.window.HTMLCanvasElement.prototype as unknown as { captureStream: unknown }).captureStream = () => { captured++; return {} }

const { render, act, cleanup, fireEvent } = await import('@testing-library/react')
const { createVideoRenderer, videoCreditLine, BRAND_FOOTER, VIDEO_SAFE, VIDEO_W, VIDEO_H } = await import('../../src/thuvien/video/videoRenderer')
const { recordVideo, pickMp4Type, VideoExportError, clipSeconds } = await import('../../src/thuvien/video/recordVideo')
const { default: VideoExportDialog } = await import('../../src/thuvien/video/VideoExportDialog')
const { default: RhythmScrollPage } = await import('../../src/thuvien/RhythmScrollPage')
const { createMockChordLibrary } = await import('../../src/thuvien/chordLibrary')
void React

afterEach(() => { cleanup(); calls.length = 0 })
const settle = (ms = 30) => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)) })

const TEXT = '1. [C] một hai ba bốn [G] năm sáu bảy tám\n[Am] chín mười mười một [F] mười hai'
const ANCHORS = { measures: [{ line: 0, token: 0 }, { line: 0, token: 4 }, { line: 1, token: 0 }, { line: 1, token: 4 }] }
const SONG = { title: 'Nỗi nhớ mùa đông', composer: 'Phú Quang', text: TEXT, anchors: ANCHORS, meter: { beats: 4, beatType: 4 }, bpm: 200, bandName: 'Lá Mùa Thu', editorName: 'Trần Văn Anh' }

test('bộ vẽ: khung 1080×1920, dùng đúng dữ liệu bài + ghi công + footer; không có chuỗi mẫu; có bóng và dải hợp âm', () => {
  const canvas = document.createElement('canvas')
  const renderer = createVideoRenderer(SONG, canvas)
  assert.equal(canvas.width, VIDEO_W); assert.equal(canvas.height, VIDEO_H)
  renderer.draw(1.5, 0.1)
  const texts = calls.filter(c => c.fn === 'fillText').map(c => String(c.args[0]))
  assert.ok(texts.includes('Nỗi nhớ mùa đông'), 'tên bài thật')
  assert.ok(texts.includes('Phú Quang'), 'tác giả thật')
  assert.ok(texts.includes('Band Lá Mùa Thu · Biên tập: Trần Văn Anh'), 'ghi công thật, cùng một nhóm')
  assert.ok(texts.includes(BRAND_FOOTER), 'footer nhận diện')
  assert.ok(texts.includes('C') && texts.includes('G'), 'hợp âm đang vang → kế tiếp (từ timeline)')
  for (const sample of ['bản thử', 'Band Thử Nghiệm', 'Người thử', 'Chuyến tàu']) assert.ok(!texts.some(t => t.includes(sample)), `không có chuỗi mẫu: ${sample}`)
  assert.ok(calls.some(c => c.fn === 'arc' && Number(c.args[2]) > 15), 'có bóng (vòng tròn bán kính lớn)')
  // mọi chữ nằm trong vùng an toàn theo bề ngang
  const k = 1
  for (const c of calls.filter(f => f.fn === 'fillText')) {
    const x = Number(c.args[1]) / k
    assert.ok(x >= VIDEO_SAFE.left && x <= VIDEO_W - VIDEO_SAFE.right, `x=${x} trong vùng an toàn`)
  }
})

test('phách nhẹ: hợp âm giữa phách kích hoạt ở phách nguyên, tô xanh; hợp âm trúng phách tô cam (video)', () => {
  // 8 chữ / 4 phách, một ô: chữ k nằm ở phách k/2.
  const anchors = { measures: [{ line: 0, token: 0 }] }
  const whole = { ...SONG, anchors, text: '[C] a b [G] c d e f g h' }        // [G] ở chữ 2 = đúng phách 1
  const light = { ...SONG, anchors, text: '[C] a b c d e [Am] f g h' }     // [Am] ở chữ 5 = 2,5 → phách 2
  const colorsAt = (song: typeof whole, beat: number) => {
    calls.length = 0
    createVideoRenderer(song, document.createElement('canvas')).draw(beat, 0.1)
    return calls.filter(c => c.fn === 'fillStyle').map(c => String(c.args[0]).toUpperCase())
  }
  assert.ok(colorsAt(light, 2.1).includes('#4ADE80'), 'ở phách 2: hợp âm phách nhẹ tô xanh')
  assert.ok(!colorsAt(light, 1.9).includes('#4ADE80'), 'trước phách 2: chưa xanh (không tô trước)')
  assert.ok(!colorsAt(whole, 1.1).includes('#4ADE80'), 'hợp âm trúng phách: cam, không xanh')
  assert.ok(colorsAt(whole, 1.1).includes('#EA580C'))
})

test('ghi công: thiếu phần nào bỏ phần đó, không bịa; Band đã có chữ "Band" không lặp', () => {
  assert.equal(videoCreditLine({ bandName: 'Lá Mùa Thu', editorName: 'A' }), 'Band Lá Mùa Thu · Biên tập: A')
  assert.equal(videoCreditLine({ bandName: 'Band Gió', editorName: null }), 'Band Gió')
  assert.equal(videoCreditLine({ bandName: null, editorName: 'B' }), 'Biên tập: B')
  assert.equal(videoCreditLine({ bandName: null, editorName: null }), '')
})

test('ghi video: chỉ nhận MP4 thật — thiết bị chỉ có WebM thì BÁO LỖI, không đổi tên', async () => {
  const canvas = document.createElement('canvas')
  const renderer = createVideoRenderer(SONG, canvas)
  assert.equal(pickMp4Type({ isTypeSupported: t => t.startsWith('video/webm') }), null)
  Object.assign(globalThis, { MediaRecorder: class { static isTypeSupported(t: string) { return t.startsWith('video/webm') } } })
  await assert.rejects(() => recordVideo(renderer, canvas, { startBeat: 0, maxSeconds: 14 }), (e: unknown) => e instanceof VideoExportError && e.code === 'unsupported_mp4')
  Object.assign(globalThis, { MediaRecorder: undefined })
  await assert.rejects(() => recordVideo(renderer, canvas, { startBeat: 0, maxSeconds: 14 }), (e: unknown) => e instanceof VideoExportError && e.code === 'unsupported')
})

test('thời lượng: tối đa 14 giây; còn ngắn hơn thì kết thúc ở cuối bài (không lặp)', () => {
  const canvas = document.createElement('canvas')
  const renderer = createVideoRenderer({ ...SONG, bpm: 60 }, canvas)   // 16 phách @60 = 16 giây
  assert.equal(clipSeconds(renderer, 0, 14), 14)
  assert.equal(clipSeconds(renderer, 12, 14), 4, 'còn 4 phách = 4 giây')
  assert.equal(clipSeconds(renderer, 16, 14), 0)
})

function installFakeRecorder() {
  class FakeRecorder {
    static isTypeSupported(t: string) { return t.startsWith('video/mp4') }
    state = 'inactive'; mimeType = 'video/mp4'
    ondataavailable: ((e: { data: Blob }) => void) | null = null; onstop: (() => void) | null = null
    start() { this.state = 'recording' }
    stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new dom.window.Blob([new Uint8Array(1000)]) as unknown as Blob }); this.onstop?.() }
  }
  Object.assign(globalThis, { MediaRecorder: FakeRecorder, Blob: dom.window.Blob, File: dom.window.File })
  let n = 0
  ;(dom.window.URL as unknown as { createObjectURL: () => string; revokeObjectURL: () => void }).createObjectURL = () => `blob:fake-${++n}`
  ;(dom.window.URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {}
  Object.assign(globalThis, { URL: dom.window.URL })
}

test('hộp "Tạo video": 14 giây → tiến độ → xem trước → Lưu MP4 (.mp4); Huỷ không tạo tệp; Admin có "Toàn bộ bài"', async () => {
  installFakeRecorder()
  const song = { ...SONG, bpm: 200 }   // 16 phách @200 = 4,8 giây (< 14: kết thúc ở cuối bài)
  const view = render(<VideoExportDialog song={song} startBeat={0} canFull onClose={() => {}} />)
  await settle()
  assert.ok(view.getByRole('button', { name: '14 giây' }) && view.getByRole('button', { name: 'Toàn bộ bài' }), 'Admin có hai lựa chọn')
  assert.match(view.container.textContent!, /khoảng 5 giây/)
  // Huỷ giữa chừng
  fireEvent.click(view.getByRole('button', { name: /Tạo video 14 giây/ }))
  await settle(300)
  assert.ok(view.getByRole('progressbar'))
  fireEvent.click(view.getByRole('button', { name: 'Huỷ' }))
  await settle(300)
  assert.equal(view.queryByTestId('video-preview'), null, 'huỷ → không có tệp')
  // Chạy đủ
  fireEvent.click(view.getByRole('button', { name: /Tạo video 14 giây/ }))
  await settle(5600)
  assert.ok(view.getByTestId('video-preview'), 'xem trước')
  const save = view.getByRole('link', { name: 'Lưu MP4' }) as HTMLAnchorElement
  assert.match(save.getAttribute('download')!, /\.mp4$/)
  assert.match(save.getAttribute('download')!, /^Noi-nho-mua-dong/)
  assert.ok(captured > 0)
})

test('hộp "Tạo video" cho thành viên thường (canFull=false): không có "Toàn bộ bài"; lỗi MP4 hiện rõ', async () => {
  Object.assign(globalThis, { MediaRecorder: class { static isTypeSupported() { return false } } })
  const view = render(<VideoExportDialog song={SONG} startBeat={0} canFull={false} onClose={() => {}} />)
  await settle()
  assert.equal(view.queryByRole('button', { name: 'Toàn bộ bài' }), null)
  fireEvent.click(view.getByRole('button', { name: /Tạo video 14 giây/ }))
  await settle(100)
  assert.match(view.getByRole('alert').textContent!, /chưa xuất được MP4/)
})

test('Play Scroll: "Tạo video" chỉ có trong Chia sẻ khi TRANG cấp quyền; mặc định, bản nhúng, bản chưa duyệt thì không', async () => {
  const lib = createMockChordLibrary()
  const base = { sheetId: 's', versionId: 'v', title: 'Bài thử', composer: null, hasAnchors: true, updatedAt: '2026-10-08T00:00:00.000Z', status: 'current' as const, draftVersionId: null,
    versionNumber: 1, text: TEXT, meter: { beats: 4, beatType: 4 }, suggestedBpm: 90, hasSource: false, sources: [], anchors: ANCHORS, anchorsStatus: 'ready' as const, bandName: 'Lá Mùa Thu', editorName: 'A' }
  const detail = { ...base }
  const open = async (props: Record<string, unknown>, d = detail) => {
    const view = render(<RhythmScrollPage library={lib} versionId="v" initialDetail={d as never} onBack={() => {}} {...props as object} />)
    await settle()
    const share = view.queryByRole('button', { name: 'Chia sẻ' })
    if (share) { fireEvent.click(share); await settle(80) }
    return view
  }
  let v = await open({ branded: true })
  assert.equal(v.queryByText('Tạo video 14 giây'), null, 'mặc định: không hiện')
  cleanup()
  v = await open({ branded: true, videoExport: 'clip' })
  assert.ok(v.getByText('Tạo video 14 giây'), 'trang cấp quyền → hiện trong Chia sẻ')
  cleanup()
  v = await open({ branded: true, videoExport: 'clip', embedded: true })
  assert.equal(v.queryByText('Tạo video 14 giây'), null, 'bản nhúng /me: không')
  cleanup()
  v = await open({ branded: true, videoExport: 'clip' }, { ...detail, status: 'draft' as never })
  assert.equal(v.queryByText('Tạo video 14 giây'), null, 'bản chưa duyệt: không chia sẻ được')
})
