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
;(dom.window.HTMLCanvasElement.prototype as unknown as { captureStream: unknown }).captureStream = () => { captured++; return { getVideoTracks: () => [{}], getTracks: () => [{ stop() {} }] } }

const { render, act, cleanup, fireEvent } = await import('@testing-library/react')
const { createVideoRenderer, videoCreditLine, BRAND_FOOTER, VIDEO_SAFE, VIDEO_W, VIDEO_H } = await import('../../src/thuvien/video/videoRenderer')
const { recordVideo, pickMp4Type, pickMp4AudioType, clickPlan, VideoExportError, clipSeconds } = await import('../../src/thuvien/video/recordVideo')
const { default: VideoExportDialog } = await import('../../src/thuvien/video/VideoExportDialog')
const { default: RhythmScrollPage } = await import('../../src/thuvien/RhythmScrollPage')
const { createMockChordLibrary } = await import('../../src/thuvien/chordLibrary')
const { fetchVideoGrant } = await import('../../src/thuvien/HopamViewPage')
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

// AudioContext/MediaStream giả: ghi lại click, kết nối, đóng tài nguyên.
const audioLog = { created: 0, closed: 0, stoppedTracks: 0, clicks: [] as { at: number; freq: number; toDestination: boolean }[], state: 'running' as string }
function installFakeAudio() {
  audioLog.created = 0; audioLog.closed = 0; audioLog.stoppedTracks = 0; audioLog.clicks.length = 0; audioLog.state = 'running'
  class FakeAudioContext {
    state = audioLog.state; currentTime = 10
    destination = { kind: 'speakers' }
    constructor() { audioLog.created++ }
    resume() { return Promise.resolve() }
    close() { audioLog.closed++; return Promise.resolve() }
    createMediaStreamDestination() { return { kind: 'sink', stream: { getAudioTracks: () => [{}], getTracks: () => [{ stop() { audioLog.stoppedTracks++ } }] } } }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (n: unknown) => n } }
    createOscillator() {
      const rec = { at: 0, freq: 0, toDestination: false }
      audioLog.clicks.push(rec)
      const osc = { type: '', frequency: { set value(v: number) { rec.freq = v } }, connect: (g: { connect: (n: { kind: string }) => unknown }) => ({ connect: (n: { kind: string }) => { rec.toDestination = n.kind === 'speakers'; return n } }), start(at: number) { rec.at = at }, stop() {} }
      return osc
    }
  }
  class FakeMediaStream { constructor(public tracks: unknown[]) {} getTracks() { return this.tracks } }
  Object.assign(globalThis, { AudioContext: FakeAudioContext, MediaStream: FakeMediaStream })
}

function installFakeRecorder(withAudio = true) {
  installFakeAudio()
  class FakeRecorder {
    static isTypeSupported(t: string) { return t.startsWith('video/mp4') && (withAudio || !t.includes('mp4a')) }
    state = 'inactive'; mimeType = 'video/mp4'
    ondataavailable: ((e: { data: Blob }) => void) | null = null; onstop: (() => void) | null = null
    start() { this.state = 'recording' }
    stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new dom.window.Blob([new Uint8Array(1000), 'mp4a']) as unknown as Blob }); this.onstop?.() }
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

// ── Cổng C: quyền do máy chủ quyết (RPC chord_video_export_ok); trình duyệt chỉ hỏi và hiện/ẩn ──
const fakeRpc = (rule: (mode: string) => unknown) => {
  const sent: { fn: string; args: Record<string, unknown> }[] = []
  return { sent, client: { rpc: async (fn: string, args: Record<string, unknown>) => { sent.push({ fn, args }); const r = rule(String(args.p_mode)); if (r instanceof Error) throw r; return { data: r, error: null } } } }
}
const ok = (mode: string) => ({ ok: true, mode, max_seconds: mode === 'full' ? 360 : 14, reason: null })
const no = (mode: string, reason: string) => ({ ok: false, mode, max_seconds: 0, reason })

test('quyền xuất: Admin → full; thành viên Band → clip; khác Band/cựu thành viên/bài không Band/công tắc tắt → không; lỗi → không', async () => {
  assert.equal(await fetchVideoGrant('v', fakeRpc(mode => ok(mode)).client), 'full', 'Admin')
  assert.equal(await fetchVideoGrant('v', fakeRpc(mode => (mode === 'full' ? no(mode, 'full_admin_only') : ok(mode))).client), 'clip', 'thành viên đúng Band')
  for (const reason of ['not_member', 'no_band', 'disabled', 'not_shareable', 'account', 'auth']) {
    assert.equal(await fetchVideoGrant('v', fakeRpc(mode => no(mode, reason)).client), undefined, reason)
  }
  assert.equal(await fetchVideoGrant('v', fakeRpc(() => new Error('mạng')).client), undefined, 'lỗi mạng → không cấp')
  assert.equal(await fetchVideoGrant('v', { rpc: async () => ({ data: null, error: { message: 'x' } }) }), undefined, 'RPC lỗi → không cấp')
})

test('quyền xuất: chỉ gửi version + mode tới RPC — không user, role, band hay thời lượng', async () => {
  const rpc = fakeRpc(mode => (mode === 'full' ? no(mode, 'full_admin_only') : ok(mode)))
  await fetchVideoGrant('11111111-1111-1111-1111-111111111111', rpc.client)
  assert.deepEqual(rpc.sent.map(s => s.fn), ['chord_video_export_ok', 'chord_video_export_ok'])
  for (const call of rpc.sent) assert.deepEqual(Object.keys(call.args).sort(), ['p_mode', 'p_version'])
})

test('quyền bị thu hồi sau khi mở Player: bấm Tạo video → hỏi lại máy chủ → báo không được phép, KHÔNG mở hộp xuất', async () => {
  const lib = createMockChordLibrary()
  const detail = { sheetId: 's', versionId: 'v', title: 'Bài thử', composer: null, hasAnchors: true, updatedAt: '2026-10-08T00:00:00.000Z', status: 'current' as const, draftVersionId: null,
    versionNumber: 1, text: TEXT, meter: { beats: 4, beatType: 4 }, suggestedBpm: 90, hasSource: false, sources: [], anchors: ANCHORS, anchorsStatus: 'ready' as const, bandName: 'Lá Mùa Thu', editorName: 'A' }
  const view = render(<RhythmScrollPage library={lib} versionId="v" initialDetail={detail as never} onBack={() => {}} branded videoExport="clip" videoRecheck={async () => undefined} />)
  await settle()
  fireEvent.click(view.getByRole('button', { name: 'Chia sẻ' })); await settle(80)
  fireEvent.click(view.getByText('Tạo video 14 giây')); await settle(80)
  assert.ok(view.getByTestId('video-denied'), 'có thông báo')
  assert.equal(view.queryByText('Lưu MP4'), null)
  assert.equal(view.queryByRole('dialog'), null, 'không mở hộp xuất')
})

// ── Metronome trong MP4 ──
test('lịch click: đúng timeline — phách đầu ô nhấn, từ giữa bài (seek) tính lại từ 0, cuối bài không lặp', () => {
  const renderer = createVideoRenderer({ ...SONG, bpm: 120 }, document.createElement('canvas'))   // 4/4, 4 ô, 120 BPM = 0,5 s/phách
  const all = clickPlan(renderer.timeline, 120, 0, 16)
  assert.equal(all.length, 16)
  assert.deepEqual(all.slice(0, 5).map(c => [c.t, c.accent]), [[0, true], [0.5, false], [1, false], [1.5, false], [2, true]])
  const mid = clickPlan(renderer.timeline, 120, 8, 16)   // bắt đầu ô 3
  assert.equal(mid.length, 8); assert.deepEqual(mid[0], { t: 0, accent: true }); assert.equal(mid[4].accent, true, 'ô 4 nhấn lại ở 2 giây')
  assert.equal(mid[4].t, 2)
  assert.equal(clickPlan(renderer.timeline, 120, 16, 16).length, 0)
})

test('pickMp4AudioType: chỉ nhận MP4 có AAC', () => {
  assert.equal(pickMp4AudioType({ isTypeSupported: t => t.includes('mp4a.40.2') }), 'video/mp4;codecs=avc1.42E01E,mp4a.40.2')
  assert.equal(pickMp4AudioType({ isTypeSupported: t => t === 'video/mp4;codecs=avc1.42E01E' }), null)
})

test('ghi video + tiếng: click vào luồng ghi (KHÔNG ra loa), đúng tần số phách mạnh/nhẹ, đóng đủ tài nguyên', async () => {
  installFakeRecorder()
  const canvas = document.createElement('canvas')
  const renderer = createVideoRenderer({ ...SONG, bpm: 600 }, canvas)   // 0,1 s/phách → 16 phách = 1,6 s
  const out = await recordVideo(renderer, canvas, { startBeat: 0, maxSeconds: 14 })
  assert.ok(out.blob.size > 0)
  assert.equal(audioLog.created, 1)
  const clicks = audioLog.clicks.filter(c => c.freq > 0)   // bỏ tín hiệu giữ luồng (không phải click)
  assert.ok(clicks.length >= 14, `đủ click (${clicks.length})`)
  assert.ok(audioLog.clicks.every(c => !c.toDestination), 'không nối ra loa')
  assert.equal(clicks[0].freq, 1760, 'phách đầu ô = mạnh'); assert.equal(clicks[1].freq, 1175, 'phách còn lại = nhẹ'); assert.equal(clicks[4].freq, 1760)
  const gaps = clicks.slice(1, 6).map((c, i) => Math.round((c.at - clicks[i].at) * 1000))
  assert.ok(gaps.every(g => g === 100), `cách nhau 100 ms: ${gaps}`)
  assert.equal(audioLog.closed, 1, 'AudioContext đã đóng'); assert.ok(audioLog.stoppedTracks >= 1)
})

test('xuất từ giữa bài: click đầu tiên là phách đầu ô tại thời điểm bắt đầu', async () => {
  installFakeRecorder()
  const canvas = document.createElement('canvas')
  const renderer = createVideoRenderer({ ...SONG, bpm: 600 }, canvas)
  await recordVideo(renderer, canvas, { startBeat: 8, maxSeconds: 14 })
  const clicks = audioLog.clicks.filter(c => c.freq > 0)
  assert.equal(clicks[0].freq, 1760)
  assert.ok(clicks.length >= 6 && clicks.length <= 8, `chỉ 8 phách còn lại (${clicks.length})`)
})

test('không ghi được MP4 có tiếng → BÁO LỖI, không xuất video câm; không rò AudioContext', async () => {
  installFakeRecorder(false)   // MP4 có, AAC không
  const canvas = document.createElement('canvas')
  const renderer = createVideoRenderer(SONG, canvas)
  await assert.rejects(() => recordVideo(renderer, canvas, { startBeat: 0, maxSeconds: 14 }), (e: unknown) => e instanceof VideoExportError && e.code === 'unsupported_audio')
  assert.equal(audioLog.created, 0, 'chưa tạo AudioContext khi đã biết không hỗ trợ')
  installFakeRecorder()
  Object.assign(globalThis, { AudioContext: undefined })
  await assert.rejects(() => recordVideo(renderer, canvas, { startBeat: 0, maxSeconds: 14 }), (e: unknown) => e instanceof VideoExportError && e.code === 'unsupported_audio')
})

test('AudioContext không chạy (bị chặn) → báo lỗi và đóng tài nguyên', async () => {
  installFakeRecorder()
  audioLog.state = 'suspended'
  const Base = (globalThis as unknown as { AudioContext: new () => { state: string } }).AudioContext
  class Blocked extends Base { constructor() { super(); this.state = 'suspended' } }
  Object.assign(globalThis, { AudioContext: Blocked })
  const canvas = document.createElement('canvas')
  const renderer = createVideoRenderer(SONG, canvas)
  await assert.rejects(() => recordVideo(renderer, canvas, { startBeat: 0, maxSeconds: 14 }), (e: unknown) => e instanceof VideoExportError && e.code === 'unsupported_audio')
  assert.equal(audioLog.closed, 1)
})

test('tệp ghi ra không có track audio (không có hộp mp4a) → báo lỗi thay vì lưu video câm', async () => {
  installFakeRecorder()
  const Rec = (globalThis as unknown as { MediaRecorder: { prototype: { stop(): void } } }).MediaRecorder
  const keep = Rec.prototype.stop
  Rec.prototype.stop = function (this: { state: string; ondataavailable: ((e: { data: Blob }) => void) | null; onstop: (() => void) | null }) { this.state = 'inactive'; this.ondataavailable?.({ data: new dom.window.Blob([new Uint8Array(1000)]) as unknown as Blob }); this.onstop?.() }
  const canvas = document.createElement('canvas')
  const renderer = createVideoRenderer({ ...SONG, bpm: 600 }, canvas)
  await assert.rejects(() => recordVideo(renderer, canvas, { startBeat: 0, maxSeconds: 14 }), (e: unknown) => e instanceof VideoExportError && e.code === 'unsupported_audio')
  Rec.prototype.stop = keep
})
