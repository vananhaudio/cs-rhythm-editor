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

test('Chia sẻ: nút hiện ở bản đã duyệt (current/old), ẩn ở bản nháp; bấm mở bảng Chia sẻ', async () => {
  const approved = await open({ status: 'current' })
  assert.ok(approved.getByRole('button', { name: 'Chia sẻ' }))
  fireEvent.click(approved.getByRole('button', { name: 'Chia sẻ' }))
  await settle(80)
  assert.ok(approved.getByRole('dialog', { name: 'Chia sẻ' }))
  assert.ok(approved.getByText('Đăng lên cộng đồng'))
  cleanup()
  const old = await open({ status: 'old' })
  assert.ok(old.queryByRole('button', { name: 'Chia sẻ' }))
  cleanup()
  const draft = await open({ status: 'draft' })
  assert.equal(draft.queryByRole('button', { name: 'Chia sẻ' }), null)
})

test('nhúng trong bài đăng: khung riêng, "Thu gọn" + "Mở rộng" (/hopam/<id>), không có Chia sẻ, không tải lại khi có initialDetail', async () => {
  const library = libraryWith({ status: 'current' })
  let calls = 0
  const orig = library.getChordSheet.bind(library)
  library.getChordSheet = async (id: string) => { calls++; return orig(id) }
  const detail = await orig('v')
  let closed = 0
  const view = render(<RhythmScrollPage embedded library={library} versionId="v" initialDetail={detail} onBack={() => { closed++ }} />)
  await settle()
  assert.equal(calls, 0, 'có initialDetail → không gọi lại thư viện')
  assert.ok(view.container.querySelector('.rs-embedded'))
  assert.equal(view.queryByRole('button', { name: 'Chia sẻ' }), null)
  assert.equal((view.getByText('Mở rộng') as HTMLAnchorElement).getAttribute('href'), '/hopam/v')
  fireEvent.click(view.getByRole('button', { name: /Thu gọn/ }))
  assert.equal(closed, 1)
  assert.ok(view.getByRole('button', { name: 'Phát' }), 'không tự phát: nút Phát, chưa chạy')
})

test('autoStart: dựng xong là chạy ngay (một lần bấm Play ở Feed); mặc định thì KHÔNG tự phát', async () => {
  Object.assign(globalThis, { requestAnimationFrame: (cb: () => void) => setTimeout(cb, 16), cancelAnimationFrame: (id: number) => clearTimeout(id) })
  const lib = libraryWith({ status: 'current' })
  const detail = await lib.getChordSheet('v')
  const auto = render(<RhythmScrollPage embedded autoStart library={lib} versionId="v" initialDetail={detail} onBack={() => {}} />)
  await settle(60)
  assert.ok(auto.getByRole('button', { name: 'Tạm dừng' }), 'đang chạy → nút là Tạm dừng')
  cleanup()
  const manual = render(<RhythmScrollPage embedded library={lib} versionId="v" initialDetail={detail} onBack={() => {}} />)
  await settle(60)
  assert.ok(manual.getByRole('button', { name: 'Phát' }), 'không tự phát')
})

test('V3 branded (/hopam): header logo + "Play Scroll", tên bài + tác giả, Chia sẻ, đủ điều khiển; mặc định và bản nhúng KHÔNG đổi', async () => {
  const lib = libraryWith({ status: 'current', composer: 'Nhạc sĩ A' })
  const detail = await lib.getChordSheet('v')
  const view = render(<RhythmScrollPage branded library={lib} versionId="v" initialDetail={detail} onBack={() => {}} />)
  await settle()
  assert.ok(view.container.querySelector('.rs-branded img.rs-logo[src="/logo.png"]'), 'logo thật từ tài sản có sẵn')
  assert.equal(view.container.querySelector('.rs-brand')!.textContent, 'Play Scroll')
  assert.equal(view.getByTestId("rs-song").textContent, "Bài thửNhạc sĩ A")
  assert.ok(view.getByRole('button', { name: 'Chia sẻ' }) && view.getByRole('button', { name: 'Phát' }) && view.getByLabelText('Vị trí (phách)'))
  cleanup()
  const plain = render(<RhythmScrollPage library={lib} versionId="v" initialDetail={detail} onBack={() => {}} />)
  await settle()
  assert.equal(plain.container.querySelector('.rs-branded'), null, 'mặc định (Thư viện quản trị) giữ nguyên')
  cleanup()
  const embedded = render(<RhythmScrollPage embedded branded library={lib} versionId="v" initialDetail={detail} onBack={() => {}} />)
  await settle()
  assert.equal(embedded.container.querySelector('.rs-branded'), null, 'bản nhúng /me giữ nguyên')
  assert.ok(embedded.container.querySelector('.rs-embedded'))
})

test('V4 branded: không nút Quay lại; dải "Am → G" lấy từ timeline; chấm nhịp = số phách/ô, không sáng trước Play, theo seek/BPM', async () => {
  for (const beats of [3, 4]) {
    const lib = libraryWith({ status: 'current', meter: { beats, beatType: 4 } })
    const detail = await lib.getChordSheet('v')
    const view = render(<RhythmScrollPage branded library={lib} versionId="v" initialDetail={detail} onBack={() => {}} />)
    await settle()
    assert.equal(view.queryByRole('button', { name: 'Quay lại' }), null)
    assert.equal(view.container.querySelector('.rs-meta:not(.rs-meta-warn)'), null, 'bỏ thẻ Nhịp/ô/phách')
    const dots = () => [...view.container.querySelectorAll('.rs-dots i')] as HTMLElement[]
    assert.equal(dots().length, beats)
    assert.equal(dots().filter(d => d.dataset.on === 'true').length, 0, 'trước Play: không phách nào sáng')
    assert.equal(view.getByTestId('rs-chord-now').textContent, 'C')
    assert.equal(view.getByTestId('rs-chord-next').textContent, 'G', 'hợp âm kế tiếp theo timeline')
    seek(view, 1)
    assert.equal(dots().findIndex(d => d.dataset.on === 'true'), 1, 'phách 2 của ô')
    seek(view, beats)
    assert.equal(view.getByTestId('rs-chord-now').textContent === view.getByTestId('rs-chord-next').textContent, false)
    assert.equal(dots().findIndex(d => d.dataset.on === 'true'), 0, 'sang ô mới: chấm đầu sáng')
    fireEvent.click(view.getByRole('button', { name: 'Về đầu bài' }))
    assert.equal(dots().filter(d => d.dataset.on === 'true').length, 0)
    cleanup()
  }
})

test('V4.1 loa đập nhịp: mặc định tắt (không tiếng), bật → click theo beat clock, Pause dừng, chấm nhịp vẫn chạy khi tắt', async () => {
  Object.assign(globalThis, { requestAnimationFrame: (cb: () => void) => setTimeout(cb, 16), cancelAnimationFrame: (id: number) => clearTimeout(id) })
  let started = 0
  const node = () => ({ connect: (n: unknown) => n, start() { started++ }, stop() {}, frequency: { value: 0 }, type: '', gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } })
  class FakeCtx { state = 'running'; currentTime = 0; destination = {}; createOscillator = node; createGain = node; resume() { return Promise.resolve() } close() { return Promise.resolve() } }
  ;(dom.window as unknown as { AudioContext: unknown }).AudioContext = FakeCtx
  const lib = libraryWith({ status: 'current', suggestedBpm: 200 })
  const detail = await lib.getChordSheet('v')
  const view = render(<RhythmScrollPage branded library={lib} versionId="v" initialDetail={detail} onBack={() => {}} />)
  await settle()
  assert.ok(view.getByRole('button', { name: 'Bật tiếng đập nhịp' }), 'mặc định tắt')
  fireEvent.click(view.getByRole('button', { name: 'Phát' }))
  await settle(700)
  assert.equal(started, 0, 'loa tắt: không tiếng')
  assert.equal(view.container.querySelectorAll('.rs-dots i[data-on="true"]').length, 1, 'chấm vẫn chạy khi tắt tiếng')
  fireEvent.click(view.getByRole('button', { name: 'Bật tiếng đập nhịp' }))
  assert.ok(view.getByRole('button', { name: 'Tắt tiếng đập nhịp' }))
  await settle(1100)
  const whilePlaying = started
  assert.ok(whilePlaying >= 2 && whilePlaying <= 6, `200 BPM ~ 3 click/giây, nhận ${whilePlaying}`)
  fireEvent.click(view.getByRole('button', { name: 'Tạm dừng' }))
  const atPause = started
  await settle(500)
  assert.equal(started, atPause, 'Pause: không click')
  // jsdom: window.setTimeout không bị clearTimeout toàn cục huỷ → các tick mồ côi chỉ dừng khi đồng hồ chạm cuối bài.
  seek(view, 16)
  await settle(400)
  cleanup()
})

test('V5 ghi công: "Band X · Biên tập: Y" chỉ khi có dữ liệu; thiếu phần nào bỏ phần đó; không có gì thì không hiện; bản nhúng không đổi', async () => {
  const cases: Array<[Partial<Detail>, string | null]> = [
    [{ bandName: 'Lá Mùa Thu', editorName: 'Nguyễn Văn A' }, 'Band Lá Mùa Thu · Biên tập: Nguyễn Văn A'],
    [{ bandName: 'Band Gió', editorName: null }, 'Band Gió'],
    [{ bandName: null, editorName: 'Trần B' }, 'Biên tập: Trần B'],
    [{ bandName: null, editorName: null }, null],
  ]
  for (const [patch, expected] of cases) {
    const lib = libraryWith({ status: 'current', composer: 'Nhạc sĩ A', ...patch })
    const detail = await lib.getChordSheet('v')
    const view = render(<RhythmScrollPage branded library={lib} versionId="v" initialDetail={detail} onBack={() => {}} />)
    await settle()
    assert.equal(view.queryByTestId('rs-credit')?.textContent ?? null, expected)
    assert.equal(view.getByTestId('rs-song').querySelector('.rs-song-title')!.textContent, 'Bài thử', 'tên bài không bị chen vào giữa')
    cleanup()
  }
  const lib = libraryWith({ status: 'current', bandName: 'Lá Mùa Thu', editorName: 'A' })
  const detail = await lib.getChordSheet('v')
  const embedded = render(<RhythmScrollPage embedded branded library={lib} versionId="v" initialDetail={detail} onBack={() => {}} />)
  await settle()
  assert.equal(embedded.queryByTestId('rs-credit'), null)
})
