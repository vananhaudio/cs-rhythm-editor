// Hợp âm chuẩn hóa — giao diện (jsdom): danh sách, tìm không dấu, thêm bài, validate, lưu mock, mở lại, tab, và cổng admin của /thuvien.
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
dom.window.scrollTo = () => {}
let confirmAnswer = true
let confirmAsked = 0
dom.window.confirm = () => { confirmAsked += 1; return confirmAnswer }
// Bất kỳ lời gọi mạng nào trong các test này đều là lỗi: chế độ thử không được chạm production.
let network = 0
globalThis.fetch = (() => { network += 1; return Promise.reject(new Error('không được gọi mạng')) }) as typeof fetch

const { render, act, cleanup, fireEvent } = await import('@testing-library/react')
const { default: ChordLibraryPage } = await import('../../src/thuvien/ChordLibraryPage')
const { default: ThuVienShell } = await import('../../src/thuvien/ThuVienShell')
const { createDisabledChordLibrary, createMockChordLibrary, createRpcChordLibrary, MOCK_STORAGE_KEY } = await import('../../src/thuvien/chordLibrary')
type RpcCall = import('../../src/thuvien/chordLibrary').RpcCall
void React

function memoryStorage() {
  const data = new Map<string, string>()
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) }, removeItem: (key: string) => { data.delete(key) } }
}
const settle = (ms = 30) => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)) })
const goto = (search: string) => dom.window.history.replaceState(null, '', '/thuvien' + search)
const type = (element: Element, value: string) => fireEvent.change(element, { target: { value } })


// Lời + hợp âm nằm trong cửa sổ "Nạp lời & hợp âm": soạn ở đó, "Áp dụng" mới đổi bản nhạc (chưa ghi DB).
type View = ReturnType<typeof render>
function setLyrics(view: View, text: string) {
  fireEvent.click(view.getByRole('button', { name: 'Nạp lời & hợp âm' }))
  type(view.getByLabelText('Ô soạn lời và hợp âm'), text)
  fireEvent.click(view.getByRole('button', { name: 'Áp dụng' }))
}
function lyricsOf(view: View) {
  fireEvent.click(view.getByRole('button', { name: 'Nạp lời & hợp âm' }))
  const value = (view.getByLabelText('Ô soạn lời và hợp âm') as HTMLTextAreaElement).value
  fireEvent.click(view.getByRole('button', { name: 'Hủy' }))
  return value
}

/** Header → "Nạp hợp âm mới": đổi địa chỉ rồi báo popstate; trang hợp âm đang mở đọc lại địa chỉ và dựng trình sửa bài mới. */
async function openNewChord() {
  dom.window.history.pushState(null, '', '/thuvien?muc=hopam&hopam=moi')
  await act(async () => { dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate')) })
}

afterEach(() => { cleanup(); confirmAnswer = true; confirmAsked = 0 })

async function openList(library = createMockChordLibrary({ storage: memoryStorage() })) {
  goto('?muc=hopam')
  const view = render(<ChordLibraryPage library={library} tabs={<nav data-testid="tabs" />} />)
  await settle()
  return { ...view, library }
}

test('danh sách: tiêu đề, nút thêm, ô tìm, trạng thái từng bài, nhãn dữ liệu thử', async () => {
  const view = await openList()
  assert.ok(view.getByRole('heading', { name: 'HỢP ÂM CHUẨN HÓA' }))
  assert.equal(view.queryByRole('button', { name: '+ Thêm bài' }), null, 'tạo bài mới đã có ở Header — không còn nút trùng trong danh sách')
  assert.ok(view.getByLabelText('Tìm tên bài hoặc tác giả'))
  assert.ok(view.getByTestId('tabs'), 'thanh chuyển mục hiện ở danh sách')
  assert.match(view.getByRole('note').textContent ?? '', /Dữ liệu thử — chưa lưu production/)
  const rows = view.getAllByRole('listitem')
  assert.equal(rows.length, 3)
  const row = (title: string) => rows.find(item => item.textContent?.includes(title))!
  assert.match(row('Bài thử 01').textContent ?? '', /Hợp âm✓ Có.*Vạch nhịp✓ Đã có/)
  assert.match(row('Tình khúc mẫu').textContent ?? '', /Hợp âm✓ Có.*Vạch nhịp— Chưa có/)
  assert.match(row('Đêm Thử Nghiệm').textContent ?? '', /—/, 'không có tác giả → gạch ngang')
  assert.equal(view.container.textContent?.match(/anchors_status|review_status|canonical|text_hash/), null, 'không lộ từ kỹ thuật')
})

test('tìm không dấu, không phân biệt hoa thường; không thấy thì gợi ý thêm bài', async () => {
  const view = await openList()
  type(view.getByLabelText('Tìm tên bài hoặc tác giả'), 'DEM thu nghiem')
  await settle(260)
  assert.deepEqual(view.getAllByRole('listitem').map(item => item.querySelector('strong')?.textContent), ['Đêm Thử Nghiệm'])
  type(view.getByLabelText('Tìm tên bài hoặc tác giả'), 'bài không tồn tại')
  await settle(260)
  assert.match(view.getByRole('list').textContent ?? '', /Không tìm thấy bài phù hợp/)
})

test('Nạp hợp âm mới (Header) mở editor; thiếu tên bài / lời thì không lưu và chỉ rõ ô sai', async () => {
  const view = await openList()
  await openNewChord()
  await settle()
  assert.equal(dom.window.location.search, '?muc=hopam&hopam=moi')
  assert.ok(view.getByRole('heading', { name: 'Thêm bài' }))
  assert.ok(view.getByTestId('tabs'), 'Header website hiện ở cả trang nạp/biên tập')
  for (const label of ['Thông tin bài', 'Vạch nhịp', 'Nguồn sheet', 'Xem thử']) assert.ok(view.getByRole('region', { name: label }), label)
  assert.match(view.getByRole('region', { name: 'Vạch nhịp' }).textContent ?? '', /Chưa phân tích.*Chưa có dữ liệu vạch nhịp\./)
  assert.equal((view.getByRole('button', { name: 'Phân tích vạch nhịp' }) as HTMLButtonElement).disabled, true, 'nút Phân tích có mặt nhưng chưa bật')
  assert.match(view.getByRole('region', { name: 'Nguồn sheet' }).textContent ?? '', /Chưa có file nguồn\./)
  assert.equal(view.getByLabelText('Chọn file PDF hoặc ảnh sheet').getAttribute('accept'), 'application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp')
  fireEvent.click(view.getByRole('button', { name: 'Nạp lời & hợp âm' }))
  assert.match(view.getByRole('dialog').textContent ?? '', /\[Am\]/, 'cửa sổ nạp lời có gợi ý định dạng')
  fireEvent.click(view.getByRole('button', { name: 'Hủy' }))
  assert.equal(view.queryByRole('dialog'), null)
  fireEvent.click(view.getByRole('button', { name: 'Lưu' }))
  await settle()
  assert.match(view.getByRole('alert').textContent ?? '', /Chưa lưu được/)
  assert.match(view.container.textContent ?? '', /Vui lòng nhập Tên bài\./)
  assert.match(view.container.textContent ?? '', /Vui lòng nhập lời \+ hợp âm\./)
  assert.equal((await view.library.searchChordSheets('')).length, 3, 'chưa có gì được lưu')
  type(view.getByLabelText(/BPM gợi ý/), '999')
  type(view.getByLabelText(/Tên bài/), 'Bài UI')
  setLyrics(view, '[C] có lời')
  fireEvent.click(view.getByRole('button', { name: 'Lưu' }))
  await settle()
  assert.match(view.container.textContent ?? '', /BPM là số nguyên từ 20 đến 300\./)
  assert.equal((await view.library.searchChordSheets('')).length, 3)
})

test('xem thử: hợp âm nằm trên chữ; cảnh báo ngoặc hỏng', async () => {
  const view = await openList()
  await openNewChord()
  await settle()
  const preview = view.getByRole('region', { name: 'Xem thử' })
  assert.match(preview.textContent ?? '', /Chưa có lời\. Bấm “Nạp lời & hợp âm”/)
  setLyrics(view, 'Chiều [Am] nao, tiễn nhau [E7] đi\nĐK: chỉ lời\nlỡ [G quên')
  // Mỗi chữ hát là một ô chạm được; hợp âm nằm ngay trên chữ nó thuộc về.
  const segments = [...preview.querySelectorAll('.cl-line')[0].querySelectorAll('.cl-seg')].map(node => [node.querySelector('.cl-chord')?.textContent, node.querySelector('.cl-word')?.textContent])
  assert.deepEqual(segments, [['\u00a0', 'Chiều'], ['Am', 'nao,'], ['\u00a0', 'tiễn'], ['\u00a0', 'nhau'], ['E7', 'đi']])
  assert.equal(preview.querySelectorAll('.cl-line')[1].getAttribute('data-chords'), 'false')
  assert.match(preview.textContent ?? '', /Dòng 3: còn ngoặc vuông/)
})

test('lưu mock → BẢN NHÁP, báo rõ chưa lưu production → duyệt → quay lại danh sách → mở lại đúng nội dung (kể cả sau khi tải lại trang)', async () => {
  const storage = memoryStorage()
  const view = await openList(createMockChordLibrary({ storage }))
  await openNewChord()
  await settle()
  assert.equal(view.queryByRole('group', { name: 'Trạng thái phiên bản' }), null, 'bài chưa lưu thì chưa có trạng thái phiên bản')
  type(view.getByLabelText(/Tên bài/), 'Khúc Hát Thử')
  type(view.getByLabelText(/Tác giả/), 'Thầy')
  fireEvent.change(view.getByLabelText(/Nhịp/), { target: { value: '6/8' } })
  type(view.getByLabelText(/BPM gợi ý/), '72')
  setLyrics(view, '[C] Một dòng  \n[G] Hai dòng\n')
  fireEvent.click(view.getByRole('button', { name: 'Lưu' }))
  await settle()
  assert.match(view.getByRole('status').textContent ?? '', /Đã lưu bản nháp \(phiên bản 1\).*Dữ liệu thử — chưa lưu production/)
  assert.ok(view.getByRole('heading', { name: 'Khúc Hát Thử' }))
  assert.match(view.getByRole('group', { name: 'Trạng thái phiên bản' }).textContent ?? '', /Bản nháp · phiên bản 1 — chưa duyệt, chưa phải bản đang dùng/)
  const saved = (await view.library.searchChordSheets('khuc hat thu'))[0]
  assert.equal(saved.status, 'draft', 'lưu KHÔNG tự duyệt')
  assert.equal(dom.window.location.search, `?muc=hopam&hopam=${saved.versionId}`, 'địa chỉ trỏ vào bài vừa lưu')
  fireEvent.click(view.getByRole('button', { name: 'Lưu' }))
  await settle()
  assert.match(view.getByRole('status').textContent ?? '', /Chưa có thay đổi nào để lưu\./)
  assert.equal((await view.library.getChordSheet(saved.versionId)).versionNumber, 1)

  fireEvent.click(view.getByRole('button', { name: 'Duyệt bản này' }))
  await settle()
  assert.match(view.getByRole('status').textContent ?? '', /Đã duyệt — phiên bản 1 là bản đang dùng/)
  assert.match(view.getByRole('group', { name: 'Trạng thái phiên bản' }).textContent ?? '', /Bản đang dùng · phiên bản 1/)
  assert.equal(view.queryByRole('button', { name: 'Duyệt bản này' }), null)

  fireEvent.click(view.getByRole('button', { name: '← Danh sách' }))
  await settle()
  assert.equal(confirmAsked, 0, 'không còn thay đổi dở → không hỏi')
  assert.equal(dom.window.location.search, '?muc=hopam')
  assert.equal(view.getAllByRole('listitem').length, 4)
  fireEvent.click(view.getByRole('button', { name: 'Sửa bài Khúc Hát Thử' }))
  await settle()
  assert.equal((view.getByLabelText(/Tên bài/) as HTMLInputElement).value, 'Khúc Hát Thử')
  assert.equal((view.getByLabelText(/Tác giả/) as HTMLInputElement).value, 'Thầy')
  assert.equal((view.getByLabelText(/Nhịp/) as HTMLSelectElement).value, '6/8')
  assert.equal((view.getByLabelText(/BPM gợi ý/) as HTMLInputElement).value, '72')
  assert.equal(lyricsOf(view), '[C] Một dòng\n[G] Hai dòng')

  // Tải lại trang: thư viện mới đọc cùng storage, mở thẳng bằng địa chỉ.
  cleanup()
  goto(`?muc=hopam&hopam=${saved.versionId}`)
  const again = render(<ChordLibraryPage library={createMockChordLibrary({ storage })} />)
  await settle()
  assert.equal(lyricsOf(again), '[C] Một dòng\n[G] Hai dòng')
  assert.ok(storage.data.has(MOCK_STORAGE_KEY))
  assert.equal(network, 0, 'chế độ thử không gọi mạng')
})

test('sửa bài đang dùng: lưu → bản nháp v2, bản đang dùng chưa đổi; danh sách ghi "Có bản nháp"; mở bản nháp → duyệt', async () => {
  const view = await openList()
  fireEvent.click(view.getByRole('button', { name: 'Sửa bài Bài thử 01' }))
  await settle()
  assert.match(view.getByRole('group', { name: 'Trạng thái phiên bản' }).textContent ?? '', /Bản đang dùng · phiên bản 1/)
  assert.match(view.getByRole('region', { name: 'Vạch nhịp' }).textContent ?? '', /✓ Đã có/)
  assert.deepEqual(sheetText(view.getByLabelText('Vạch nhịp theo ô')).slice(0, 2), ['1. ¹ [C] Một câu hát mẫu cho |² [Am] buổi chiều', '|³ [F] Dòng tiếp theo đi |⁴ [G] thật chậm'],
    'vạch nhịp đã có được hiện lại kèm số ô; ô 1 mở đầu bài chỉ có số, không vạch giả')
  assert.deepEqual([...view.container.querySelectorAll('.cl-slot-num')].map(node => node.textContent), ['¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹', '¹⁰', '¹¹'], 'vạch nhịp hiện NGAY trên bản nhạc duy nhất, kèm số ô')
  setLyrics(view, lyricsOf(view) + '\n[C] Thêm một dòng')
  assert.match(view.container.textContent ?? '', /Lưu lời mới thì vạch nhịp phải làm lại/)
  assert.match(view.getByRole('region', { name: 'Vạch nhịp' }).textContent ?? '', /— Chưa phân tích.*Lời đã đổi — vạch nhịp cũ không còn khớp/)
  type(view.getByLabelText(/Tên bài/), 'Bài thử 01 (đã sửa)')
  fireEvent.click(view.getByRole('button', { name: 'Lưu' }))
  await settle()
  assert.match(view.getByRole('status').textContent ?? '', /Đã lưu bản nháp \(phiên bản 2\)\. Bản đang dùng chưa đổi/)
  assert.match(view.getByRole('group', { name: 'Trạng thái phiên bản' }).textContent ?? '', /Bản nháp · phiên bản 2/)
  const [item] = await view.library.searchChordSheets('da sua')
  assert.deepEqual([item.title, item.status], ['Bài thử 01 (đã sửa)', 'current'], 'tên đổi ngay; bản đang dùng vẫn là v1')
  assert.equal((await view.library.getChordSheet(item.versionId)).versionNumber, 1)
  assert.ok(item.draftVersionId)

  fireEvent.click(view.getByRole('button', { name: '← Danh sách' }))
  await settle()
  const row = view.getAllByRole('listitem').find(node => node.textContent?.includes('Bài thử 01 (đã sửa)'))!
  assert.match(row.textContent ?? '', /Có bản nháp/)
  fireEvent.click(view.getByRole('button', { name: 'Sửa bài Bài thử 01 (đã sửa)' }))
  await settle()
  const state = view.getByRole('group', { name: 'Trạng thái phiên bản' })
  assert.match(state.textContent ?? '', /Bản đang dùng · phiên bản 1\. Bài này có bản nháp mới hơn chưa duyệt\./, 'mở từ danh sách = mở bản đang dùng')
  assert.doesNotMatch(lyricsOf(view), /Thêm một dòng/)
  fireEvent.click(view.getByRole('button', { name: 'Mở bản nháp' }))
  await settle()
  assert.equal(dom.window.location.search, `?muc=hopam&hopam=${item.draftVersionId}`)
  assert.match(lyricsOf(view), /Thêm một dòng$/)
  fireEvent.click(view.getByRole('button', { name: 'Duyệt bản này' }))
  await settle()
  const detail = await view.library.getChordSheet(item.draftVersionId!)
  assert.deepEqual([detail.status, detail.versionNumber, detail.hasAnchors], ['current', 2, false])
  assert.equal((await view.library.getChordSheet(item.versionId)).status, 'old', 'bản cũ vẫn còn, thành "bản cũ"')
})

test('chỉ đổi Nhịp → phiên bản mới; chỉ đổi BPM → phiên bản mới; chỉ đổi tên → KHÔNG tạo phiên bản; còn thay đổi dở thì chưa duyệt được', async () => {
  const view = await openList()
  fireEvent.click(view.getByRole('button', { name: 'Sửa bài Tình khúc mẫu' }))
  await settle()
  const number = () => /phiên bản (\d+)/.exec(view.getByRole('group', { name: 'Trạng thái phiên bản' }).textContent ?? '')?.[1]
  fireEvent.change(view.getByLabelText(/Nhịp/), { target: { value: '4/4' } })
  fireEvent.click(view.getByRole('button', { name: 'Lưu' }))
  await settle()
  assert.equal(number(), '2', 'chỉ đổi nhịp → v2')
  type(view.getByLabelText(/BPM gợi ý/), '120')
  assert.equal((view.getByRole('button', { name: 'Duyệt bản này' }) as HTMLButtonElement).disabled, true, 'đang có thay đổi dở → nút Duyệt khoá')
  assert.match(view.getByRole('group', { name: 'Trạng thái phiên bản' }).textContent ?? '', /Lưu thay đổi trước khi duyệt/)
  fireEvent.click(view.getByRole('button', { name: 'Lưu' }))
  await settle()
  assert.equal(number(), '3', 'chỉ đổi BPM → v3')
  type(view.getByLabelText(/Tác giả/), 'Tác giả mới')
  fireEvent.click(view.getByRole('button', { name: 'Lưu' }))
  await settle()
  assert.match(view.getByRole('status').textContent ?? '', /Đã lưu tên bài \/ tác giả\./)
  assert.equal(number(), '3', 'chỉ đổi tác giả → vẫn v3')
  const [item] = await view.library.searchChordSheets('tinh khuc mau')
  assert.equal(item.composer, 'Tác giả mới')
  const draft = await view.library.getChordSheet(item.draftVersionId!)
  assert.deepEqual([draft.versionNumber, draft.meter, draft.suggestedBpm], [3, { beats: 4, beatType: 4 }, 120])
})

test('bỏ bản nháp: hỏi lại → bỏ → về danh sách, bản đang dùng không đổi', async () => {
  const view = await openList()
  fireEvent.click(view.getByRole('button', { name: 'Sửa bài Đêm Thử Nghiệm' }))
  await settle()
  type(view.getByLabelText(/BPM gợi ý/), '60')
  fireEvent.click(view.getByRole('button', { name: 'Lưu' }))
  await settle()
  confirmAnswer = false
  fireEvent.click(view.getByRole('button', { name: 'Bỏ bản nháp' }))
  await settle()
  assert.ok(view.getByRole('button', { name: 'Bỏ bản nháp' }), 'chọn không → vẫn ở lại')
  confirmAnswer = true
  fireEvent.click(view.getByRole('button', { name: 'Bỏ bản nháp' }))
  await settle()
  assert.match(view.getByRole('status').textContent ?? '', /Đã bỏ bản nháp của “Đêm Thử Nghiệm”/)
  const [item] = await view.library.searchChordSheets('dem thu nghiem')
  assert.deepEqual([item.status, item.draftVersionId], ['current', null])
  assert.equal((await view.library.getChordSheet(item.versionId)).suggestedBpm, null)
})

test('rời editor khi còn thay đổi dở → hỏi lại; chọn ở lại thì không mất gì', async () => {
  const view = await openList()
  await openNewChord()
  await settle()
  type(view.getByLabelText(/Tên bài/), 'Đang gõ dở')
  confirmAnswer = false
  fireEvent.click(view.getByRole('button', { name: '← Danh sách' }))
  await settle()
  assert.equal(confirmAsked, 1)
  assert.equal((view.getByLabelText(/Tên bài/) as HTMLInputElement).value, 'Đang gõ dở')
  confirmAnswer = true
  fireEvent.click(view.getByRole('button', { name: '← Danh sách' }))
  await settle()
  assert.ok(view.getByRole('heading', { name: 'HỢP ÂM CHUẨN HÓA' }))
})

test('nút Back của trình duyệt: từ editor về danh sách', async () => {
  const view = await openList()
  fireEvent.click(view.getByRole('button', { name: 'Sửa bài Tình khúc mẫu' }))
  await settle()
  assert.ok(view.getByRole('heading', { name: 'Tình khúc mẫu' }))
  goto('?muc=hopam')
  await act(async () => { dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate')) })
  await settle()
  assert.ok(view.getByRole('heading', { name: 'HỢP ÂM CHUẨN HÓA' }))
})

test('xoá dữ liệu thử → về bộ mẫu ban đầu', async () => {
  const view = await openList()
  await act(async () => { await view.library.createChordSheet({ title: 'Bài thêm', composer: '', meter: null, suggestedBpm: null, text: '[C] x' }) })
  fireEvent.click(view.getByRole('button', { name: 'Xoá dữ liệu thử' }))
  await settle()
  assert.equal(view.getAllByRole('listitem').length, 3)
})

// ── Nguồn sheet + Vạch nhịp ──
let opened: string[] = []
dom.window.open = ((url: string) => { opened.push(String(url)); return null }) as typeof dom.window.open
const pngFile = (name: string, body = name, type = 'image/png') => new dom.window.File([body], name, { type }) as unknown as File
async function pick(view: ReturnType<typeof render>, files: File[]) {
  const input = view.getByLabelText('Chọn file PDF hoặc ảnh sheet') as HTMLInputElement
  Object.defineProperty(input, 'files', { configurable: true, value: files })
  fireEvent.change(input)
  await settle(80)
}
const rows = (view: ReturnType<typeof render>) => [...view.container.querySelectorAll('.cl-src')].map(node => `${node.getAttribute('data-kind')}|${node.querySelector('strong')?.textContent}|${node.querySelector('.cl-src-tag')?.textContent}`)

test('nạp nguồn cho bài MỚI: 2 ảnh + 1 PDF → "Chưa lưu"; HEIC/rỗng bị từ chối với lời dễ hiểu; Lưu → gắn với phiên bản 1; mở lại vẫn gắn; Xem mở link riêng', async () => {
  opened = []
  const view = await openList()
  await openNewChord()
  await settle()
  type(view.getByLabelText(/Tên bài/), 'Bài có sheet')
  setLyrics(view, '[C] một dòng')
  await pick(view, [pngFile('sheet-01.png'), pngFile('sheet-02.jpg', 'b', 'image/jpeg'), pngFile('anh.heic', 'h', 'image/heic'), pngFile('rong.png', '')])
  assert.deepEqual(rows(view), ['pending|Trang 1|Chưa lưu', 'pending|Trang 2|Chưa lưu'])
  assert.match(view.getByRole('region', { name: 'Nguồn sheet' }).querySelector('[role=alert]')?.textContent ?? '', /“anh\.heic”: chỉ nhận PDF, JPEG, PNG hoặc WebP.*“rong\.png”: file rỗng/)
  await pick(view, [pngFile('ban-nhac.pdf', '%PDF', 'application/pdf')])
  assert.deepEqual(rows(view).at(-1), 'pending|PDF 3|Chưa lưu')
  assert.match(view.getByRole('region', { name: 'Vạch nhịp' }).textContent ?? '', /Nguồn: 3 file sheet \(chưa lưu\)/)
  fireEvent.click(view.getAllByRole('button', { name: 'Xem' })[0])
  await settle()
  assert.equal(opened.length, 1)
  fireEvent.click(view.getByRole('button', { name: 'Xoá sheet-02.jpg' }))
  await settle()
  assert.deepEqual(rows(view).map(row => row.split('|')[1]), ['Trang 1', 'PDF 2'], 'xoá file chưa lưu')
  fireEvent.click(view.getByRole('button', { name: 'Lưu' }))
  await settle(80)
  assert.match(view.getByRole('status').textContent ?? '', /Đã lưu bản nháp \(phiên bản 1, 2 file nguồn\)/)
  assert.deepEqual(rows(view), ['attached|Trang 1|Đã gắn với phiên bản 1', 'attached|PDF 2|Đã gắn với phiên bản 1'])
  const [item] = await view.library.searchChordSheets('bai co sheet')
  const detail = await view.library.getChordSheet(item.versionId)
  assert.deepEqual([detail.sources.length, detail.sources.map(source => source.page), detail.sources.every(source => source.path.includes(item.versionId))], [2, [1, 2], true])
  assert.ok(detail.sources.every(source => /^[0-9a-f]{64}$/.test(source.sha256)) && detail.sources[0].sizeBytes > 0, 'sha256 + kích thước thật')
  fireEvent.click(view.getByRole('button', { name: '← Danh sách' }))
  await settle()
  assert.equal(confirmAsked, 0)
  fireEvent.click(view.getByRole('button', { name: 'Sửa bài Bài có sheet' }))
  await settle()
  assert.deepEqual(rows(view).map(row => row.split('|')[0]), ['attached', 'attached'], 'mở lại → nguồn vẫn gắn')
  assert.match(view.getByRole('region', { name: 'Nguồn sheet' }).textContent ?? '', /File đã gắn với phiên bản — muốn thay nguồn/)
  assert.equal((view.getByRole('button', { name: 'Phân tích vạch nhịp' }) as HTMLButtonElement).disabled, true)
  assert.match(view.getByRole('region', { name: 'Vạch nhịp' }).textContent ?? '', /Chưa phân tích.*Nguồn: 2 file sheet[^(]/)
})

test('thay nguồn bài đã lưu = phiên bản MỚI: bỏ 1 file đã gắn + nạp 1 file → Lưu → v2 có bản CHÉP + file mới; v1 giữ nguyên bộ nguồn cũ', async () => {
  const view = await openList()
  await openNewChord()
  await settle()
  type(view.getByLabelText(/Tên bài/), 'Bài thay nguồn')
  setLyrics(view, '[G] dòng')
  await pick(view, [pngFile('a.png'), pngFile('b.png', 'bb')])
  fireEvent.click(view.getByRole('button', { name: 'Lưu' }))
  await settle(80)
  const [item] = await view.library.searchChordSheets('bai thay nguon')
  const v1 = await view.library.getChordSheet(item.versionId)
  fireEvent.click(view.getByRole('button', { name: 'Bỏ khỏi phiên bản mới sheet-02.png' }))
  await settle()
  assert.match(view.getByRole('region', { name: 'Nguồn sheet' }).textContent ?? '', /Phiên bản 1 giữ nguyên bộ nguồn cũ/)
  await pick(view, [pngFile('c.png', 'ccc')])
  assert.deepEqual(rows(view), ['attached|Trang 1|Đã gắn với phiên bản 1', 'pending|Trang 2|Chưa lưu'])
  fireEvent.click(view.getByRole('button', { name: 'Lưu' }))
  await settle(120)
  assert.match(view.getByRole('status').textContent ?? '', /Đã lưu bản nháp \(phiên bản 2, 2 file nguồn\)/)
  const v2 = await view.library.getChordSheet(dom.window.location.search.split('hopam=')[1])
  assert.equal(v2.versionNumber, 2)
  assert.ok(v2.sources.every(source => source.path.includes(v2.versionId)), 'mọi file của v2 nằm trong thư mục v2 (bản cũ được CHÉP, không dời)')
  assert.deepEqual(v2.sources.map(source => source.sha256), [v1.sources[0].sha256, v2.sources[1].sha256])
  assert.notEqual(v2.sources[1].sha256, v1.sources[1].sha256)
  assert.deepEqual(await view.library.getChordSheet(v1.versionId).then(detail => detail.sources), v1.sources, 'v1 giữ nguyên bộ nguồn')
})

test('rời bài khi còn file đã nạp chưa lưu → hỏi; đồng ý → file bị xoá khỏi kho (không mồ côi)', async () => {
  const view = await openList()
  fireEvent.click(view.getByRole('button', { name: 'Sửa bài Tình khúc mẫu' }))
  await settle()
  await pick(view, [pngFile('nhap.png')])
  const path = (view.library.sources as unknown as { files: Map<string, unknown> }).files
  assert.equal(path.size, 1)
  confirmAnswer = false
  fireEvent.click(view.getByRole('button', { name: '← Danh sách' }))
  await settle()
  assert.equal(path.size, 1, 'chọn ở lại → file còn')
  confirmAnswer = true
  fireEvent.click(view.getByRole('button', { name: '← Danh sách' }))
  await settle(80)
  assert.equal(path.size, 0, 'rời đi → file chưa lưu được dọn')
  assert.ok(view.getByRole('heading', { name: 'HỢP ÂM CHUẨN HÓA' }))
})

test('lưu thất bại → báo lỗi, KHÔNG báo đã lưu; file đã nạp vẫn còn, xoá được', async () => {
  const library = createMockChordLibrary({ storage: memoryStorage() })
  const view = await openList(library)
  await openNewChord()
  await settle()
  setLyrics(view, '[C] lời')
  await pick(view, [pngFile('x.png')])
  fireEvent.click(view.getByRole('button', { name: 'Lưu' }))
  await settle()
  assert.match(view.getByRole('alert').textContent ?? '', /Chưa lưu được/)
  assert.equal(view.queryByRole('status'), null)
  assert.deepEqual(rows(view).map(row => row.split('|')[0]), ['pending'])
  fireEvent.click(view.getByRole('button', { name: 'Xoá x.png' }))
  await settle()
  assert.deepEqual(rows(view), [])
})

test('đủ 10 file → nút nạp khoá; file > 20 MB bị từ chối trước khi tải', async () => {
  const view = await openList()
  await openNewChord()
  await settle()
  await pick(view, Array.from({ length: 11 }, (_, n) => pngFile(`p${n}.png`, `n${n}`)))
  assert.equal(rows(view).length, 10)
  assert.match(view.getByRole('region', { name: 'Nguồn sheet' }).querySelector('[role=alert]')?.textContent ?? '', /tối đa 10 file/)
  assert.equal((view.getByLabelText('Chọn file PDF hoặc ảnh sheet') as HTMLInputElement).disabled, true)
  cleanup()
  const again = await openList()
  await openNewChord()
  await settle()
  const big = pngFile('to.png')
  Object.defineProperty(big, 'size', { value: 20 * 1024 * 1024 + 1 })
  await pick(again, [big])
  assert.deepEqual(rows(again), [])
  assert.match(again.getByRole('region', { name: 'Nguồn sheet' }).querySelector('[role=alert]')?.textContent ?? '', /lớn hơn 20 MB/)
})

// Đọc lại bản có số ô từ DOM thành chữ: "Chiều |¹ [Am] nao" (số trên vạch → chỉ số trên).
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'
const sup = (n: string) => n.split('').map(d => SUP[Number(d)]).join('')
function sheetText(root: Element): string[] {
  return [...root.querySelectorAll('.cl-line:not(.cl-line-gap)')].map(line => [...line.querySelectorAll('.cl-mbar, .cl-seg, .cl-mpickup')].map(node => {
    if (node.classList.contains('cl-mpickup')) return '(lấy đà)'
    if (node.classList.contains('cl-mbar')) {
      const n = sup(node.querySelector('.cl-mnum')!.textContent!)
      const mark = (node as HTMLElement).dataset.mark
      return `${(node as HTMLElement).dataset.start ? '' : '|'}${n}${mark === 'silent' ? ' ♪' : mark === 'sustain' ? ' (ngân)' : ''}`
    }
    const chord = node.querySelector('.cl-chord')!.textContent!.trim()
    const word = node.querySelector('.cl-lyric')!.textContent!.trim()
    return chord ? `[${chord}]${word ? ' ' + word : ''}` : word
  }).filter(Boolean).join(' '))
}

// ── Vạch nhịp thủ công ──
const gap = (view: ReturnType<typeof render>, label: string) => view.getByRole('button', { name: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) })
const timeline = (view: ReturnType<typeof render>) => [...view.container.querySelectorAll('.cl-anchor-list li .cl-anchor-pick')].map(node => node.textContent)

test('sửa vạch nhịp thủ công: bấm khe → dòng thời gian; lấy đà; ô không lời; ô ngân; xem lại; Chấp nhận → PHIÊN BẢN MỚI (nháp); bản cũ nguyên; Phân tích vẫn khoá', async () => {
  const view = await openList()
  fireEvent.click(view.getByRole('button', { name: 'Sửa bài Tình khúc mẫu' }))
  await settle()
  assert.equal((view.getByRole('button', { name: 'Phân tích vạch nhịp' }) as HTMLButtonElement).disabled, true)
  fireEvent.click(view.getByRole('button', { name: 'Sửa vạch nhịp thủ công' }))
  await settle()
  const editor = view.getByRole('group', { name: 'Trình sửa vạch nhịp' })
  assert.ok(editor)
  assert.equal(view.queryByRole('button', { name: 'Sửa vạch nhịp thủ công' }), null, 'đang sửa thì ẩn nút mở')
  assert.equal((view.getByRole('button', { name: 'Chấp nhận vạch nhịp' }) as HTMLButtonElement).disabled, true, 'chưa có vạch → chưa chấp nhận được')
  // khe: dòng 1 "[Am] Dòng một của tình khúc [Dm] mẫu" = 6 chữ → 7 khe; hợp âm hiển thị trên chữ
  assert.equal(editor.querySelectorAll('.cl-anchor-row')[0].querySelectorAll('.cl-gap').length, 7)
  assert.deepEqual([...editor.querySelectorAll('.cl-anchor-row')[0].querySelectorAll('.cl-chord')].map(node => node.textContent?.trim()).filter(Boolean), ['Am', 'Dm'])
  fireEvent.click(gap(view, 'Khe trước “một” — dòng 1'))
  fireEvent.click(gap(view, 'Khe trước “Dòng” — dòng 2'))
  fireEvent.click(gap(view, 'Khe trước “mẫu” — dòng 1'))
  assert.deepEqual(timeline(view), ['Ô 1 → một', 'Ô 2 → mẫu', 'Ô 3 → Dòng'], 'bấm lộn xộn vẫn ra đúng thứ tự đọc')
  assert.equal(gap(view, 'Khe trước “mẫu” — dòng 1').getAttribute('aria-pressed'), 'true')
  fireEvent.click(gap(view, 'Khe trước “mẫu” — dòng 1'))
  assert.deepEqual(timeline(view), ['Ô 1 → một', 'Ô 2 → Dòng'], 'bấm lại → bỏ vạch')
  fireEvent.click(view.getByRole('checkbox', { name: /nhịp lấy đà/ }))
  assert.equal(gap(view, 'Khe trước “Dòng” — dòng 1').getAttribute('data-pickup'), 'true', 'lấy đà từ chữ đầu bài')
  fireEvent.click(view.getByRole('button', { name: /^\+ Ô không lời/ }))
  fireEvent.click(view.getAllByRole('button', { name: '+ Ô ngân' })[0])
  fireEvent.click(gap(view, 'Khe cuối dòng 3'))
  assert.deepEqual(timeline(view), ['Ô 1 → một', 'Ô 2 → một (ngân)', 'Ô 3 → Dòng', 'Ô 4 → (ô không lời)', 'Ô 5 → (cuối dòng 3)'])
  assert.deepEqual(sheetText(view.getByLabelText('Bản xem lại có số ô')), ['(lấy đà) [Am] Dòng |¹ một của tình khúc [Dm] mẫu |² (ngân)', '|³ [G] Dòng hai nối [C] theo', '[F] Dòng ba ngân [E7] dài rồi [Am] nghỉ |⁴ ♪ |⁵'])
  fireEvent.click(view.getByRole('button', { name: 'Chấp nhận vạch nhịp' }))
  await settle(60)
  assert.match(view.getByRole('status').textContent ?? '', /Đã lưu vạch nhịp thành phiên bản 2 \(bản nháp\) — phiên bản 1 giữ nguyên/)
  assert.equal(view.queryByRole('group', { name: 'Trình sửa vạch nhịp' }), null)
  assert.match(view.getByRole('group', { name: 'Trạng thái phiên bản' }).textContent ?? '', /Bản nháp · phiên bản 2/)
  assert.ok(view.getByRole('button', { name: 'Duyệt bản này' }), 'KHÔNG tự duyệt — vẫn phải bấm Duyệt')
  assert.match(view.getByRole('region', { name: 'Vạch nhịp' }).textContent ?? '', /✓ Đã có/)
  assert.deepEqual([...view.container.querySelectorAll('.cl-slot-num')].map(node => node.textContent), ['¹,²', '³', '⁵'], 'sau khi chấp nhận, vạch của phiên bản mới hiện ngay trên bản nhạc (ô 4 không lời không có khe)')
  const [item] = await view.library.searchChordSheets('tinh khuc mau')
  const old = await view.library.getChordSheet(item.versionId)
  assert.deepEqual([old.versionNumber, old.status, old.anchors], [1, 'current', null], 'bản cũ nguyên, vẫn là bản đang dùng')
  const fresh = await view.library.getChordSheet(item.draftVersionId!)
  assert.deepEqual([fresh.text, fresh.meter, fresh.suggestedBpm], [old.text, old.meter, old.suggestedBpm])
  assert.deepEqual(fresh.anchors, { pickup: { line: 0, token: 0 }, measures: [{ line: 0, token: 1 }, { line: 0, token: 1 }, { line: 1, token: 0 }, { line: null, token: null }, { line: 2, token: 6 }] })
  assert.equal((view.getByRole('button', { name: 'Phân tích vạch nhịp' }) as HTMLButtonElement).disabled, true)
})

test('vạch nhịp có sẵn được nạp vào trình sửa; chế độ "thêm vào cuối" cho điệp khúc quay lại; sửa rồi chấp nhận → bản mới, bản cũ không đổi', async () => {
  const view = await openList()
  fireEvent.click(view.getByRole('button', { name: 'Sửa bài Bài thử 01' }))
  await settle()
  fireEvent.click(view.getByRole('button', { name: 'Sửa vạch nhịp thủ công' }))
  await settle()
  assert.equal(timeline(view).length, 11, 'nạp đủ 11 ô đã có')
  fireEvent.click(view.getByRole('radio', { name: /Thêm vào cuối/ }))
  fireEvent.click(gap(view, 'Khe trước “Hát” — dòng 3'))
  fireEvent.click(gap(view, 'Khe trước “vui,” — dòng 3'))
  assert.deepEqual(timeline(view).slice(-2), ['Ô 12 → Hát', 'Ô 13 → vui,'], 'điệp khúc hát lại: thêm vào cuối dù dòng 3 đã có vạch')
  fireEvent.click(view.getByRole('button', { name: 'Chấp nhận vạch nhịp' }))
  await settle(60)
  const [item] = await view.library.searchChordSheets('bai thu 01')
  const v1 = await view.library.getChordSheet(item.versionId)
  const v2 = await view.library.getChordSheet(item.draftVersionId!)
  assert.equal(v1.anchors?.measures.length, 11, 'bản cũ không đổi')
  assert.deepEqual(v2.anchors?.measures.slice(-2), [{ line: 2, token: 0 }, { line: 2, token: 3 }])
})

test('5A.1: sửa bên trái (thêm / ↑ ↓ / xoá / ngân / không lời) → số ô bên phải đánh lại NGAY, liền mạch; lấy đà không mang số', async () => {
  const view = await openList()
  fireEvent.click(view.getByRole('button', { name: 'Sửa bài Tình khúc mẫu' }))
  await settle()
  fireEvent.click(view.getByRole('button', { name: 'Sửa vạch nhịp thủ công' }))
  await settle()
  const right = () => sheetText(view.getByLabelText('Bản xem lại có số ô'))
  fireEvent.click(gap(view, 'Khe trước “Dòng” — dòng 1'))
  fireEvent.click(gap(view, 'Khe trước “Dòng” — dòng 2'))
  assert.equal(right()[0], '¹ [Am] Dòng một của tình khúc [Dm] mẫu', 'không lấy đà: ô 1 ở đầu bài, chỉ số')
  fireEvent.click(view.getByRole('button', { name: /^\+ Ô không lời/ }))
  assert.match(right().at(-1)!, / \[Am\] nghỉ \|³ ♪$/, 'ô không lời thêm vào cuối vẫn có số')
  fireEvent.click(view.getByRole('button', { name: 'Đưa ô 3 lên' }))
  assert.deepEqual(right().slice(0, 2), ['¹ [Am] Dòng một của tình khúc [Dm] mẫu |² ♪', '|³ [G] Dòng hai nối [C] theo'], '↑ → đánh số lại ngay')
  fireEvent.click(view.getByRole('button', { name: 'Xoá ô 2' }))
  assert.equal(right()[1], '|² [G] Dòng hai nối [C] theo', 'xoá → ô sau lùi số')
  fireEvent.click(view.getAllByRole('button', { name: '+ Ô ngân' })[0])
  assert.deepEqual(right().slice(0, 2), ['¹ [Am] Dòng một của tình khúc [Dm] mẫu |² (ngân)', '|³ [G] Dòng hai nối [C] theo'])
  fireEvent.click(gap(view, 'Khe trước “một” — dòng 1'))
  fireEvent.click(view.getByRole('checkbox', { name: /nhịp lấy đà/ }))
  fireEvent.click(gap(view, 'Khe trước “Dòng” — dòng 1: vạch ô 1, 2'))
  fireEvent.click(gap(view, 'Khe trước “Dòng” — dòng 1: vạch ô 1'))
  assert.equal(right()[0], '(lấy đà) [Am] Dòng |¹ một của tình khúc [Dm] mẫu', 'lấy đà: không số; ô 1 ở vạch đầu tiên sau lấy đà')
  assert.equal(view.container.querySelectorAll('.cl-gap[data-on=true]').length, 2, 'chỉ khe đã chọn mới có số')
})

test('còn thay đổi chưa lưu → chưa sửa vạch nhịp được; Huỷ không lưu gì', async () => {
  const view = await openList()
  fireEvent.click(view.getByRole('button', { name: 'Sửa bài Đêm Thử Nghiệm' }))
  await settle()
  type(view.getByLabelText(/BPM gợi ý/), '70')
  assert.equal((view.getByRole('button', { name: 'Sửa vạch nhịp thủ công' }) as HTMLButtonElement).disabled, true)
  assert.match(view.getByRole('region', { name: 'Vạch nhịp' }).textContent ?? '', /Lưu các thay đổi trước/)
  type(view.getByLabelText(/BPM gợi ý/), '')
  fireEvent.click(view.getByRole('button', { name: 'Sửa vạch nhịp thủ công' }))
  await settle()
  fireEvent.click(gap(view, 'Khe trước “nay” — dòng 1'))
  fireEvent.click(view.getByRole('button', { name: 'Huỷ' }))
  await settle()
  const [item] = await view.library.searchChordSheets('dem thu nghiem')
  assert.deepEqual([item.draftVersionId, (await view.library.getChordSheet(item.versionId)).anchors], [null, null])
})

test('bài MỚI chưa lưu: nút Sửa vạch nhịp khoá, có lời nhắc lưu trước', async () => {
  const view = await openList()
  await openNewChord()
  await settle()
  assert.equal((view.getByRole('button', { name: 'Sửa vạch nhịp thủ công' }) as HTMLButtonElement).disabled, true)
  assert.match(view.getByRole('region', { name: 'Vạch nhịp' }).textContent ?? '', /Lưu bài trước/)
})

// ── Backend thật qua adapter RPC — máy chủ giả có trạng thái, cùng hợp đồng với db/chord_library_v1_setup.sql ──
function fakeServer() {
  type V = { id: string; sheet: string; n: number; text: string; meter: unknown; bpm: number | null; review: string }
  const sheets = new Map<string, { title: string; composer: string | null; canonical: string | null }>()
  const versions: V[] = []
  const calls: string[] = []
  let failNext: string | null = null
  let seq = 0
  const rowOf = (v: V) => {
    const sheet = sheets.get(v.sheet)!
    return {
      sheet_id: v.sheet, version_id: v.id, title: sheet.title, composer: sheet.composer, version_number: v.n, is_canonical: sheet.canonical === v.id,
      canonical_version_id: sheet.canonical, review_status: v.review, anchors_status: 'none', created_at: `2026-10-04T00:00:${String(v.n).padStart(2, '0')}Z`,
      text: v.text, meter: v.meter, suggested_bpm: v.bpm, sources: [],
      draft_version_id: versions.filter(x => x.sheet === v.sheet && x.review === 'private' && x.n > v.n).sort((a, b) => b.n - a.n)[0]?.id ?? null,
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- máy chủ giả: tham số RPC đọc tự do như JSON
  const handlers: Record<string, (a: Record<string, any>) => unknown> = {
    chord_sheet_search: a => versions.filter(v => sheets.get(v.sheet)!.title.toLowerCase().includes(String(a.p_query).toLowerCase())
      && (sheets.get(v.sheet)!.canonical === v.id || v.review === 'private')).map(rowOf),
    chord_sheet_get: a => { const v = versions.find(x => x.id === a.p_version_id); if (!v) throw new Error('CHORDLIB_NOT_FOUND'); return rowOf(v) },
    chord_sheet_contribute: a => {
      let sheet = a.p_sheet_id as string | undefined
      if (!sheet) { sheet = `s${++seq}`; sheets.set(sheet, { title: a.p_title, composer: a.p_composer, canonical: null }) }
      const same = versions.find(v => v.sheet === sheet && v.review !== 'rejected' && v.text === a.p_text && JSON.stringify(v.meter) === JSON.stringify(a.p_meter) && v.bpm === a.p_suggested_bpm)
      if (same) return { ok: true, duplicate: true, sheet_id: sheet, version_id: same.id }
      const v: V = { id: `v${++seq}`, sheet, n: versions.filter(x => x.sheet === sheet).length + 1, text: a.p_text, meter: a.p_meter, bpm: a.p_suggested_bpm, review: 'private' }
      versions.push(v)
      return { ok: true, duplicate: false, sheet_id: sheet, version_id: v.id }
    },
    chord_sheet_approve: a => { const v = versions.find(x => x.id === a.p_version_id)!; v.review = 'approved'; sheets.get(v.sheet)!.canonical = v.id; return { ok: true } },
    chord_sheet_reject: a => { versions.find(x => x.id === a.p_version_id)!.review = 'rejected'; return { ok: true } },
    chord_sheet_update_info: a => { const sheet = sheets.get(a.p_sheet_id)!; sheet.title = a.p_title; sheet.composer = a.p_composer; return { ok: true } },
  }
  const rpc: RpcCall = async (fn, args) => {
    calls.push(fn)
    if (failNext === fn) { failNext = null; return { data: null, error: { message: 'CHORDLIB_INVALID: máy chủ từ chối (thử nghiệm)' } } }
    try { return { data: handlers[fn](args), error: null } } catch (cause) { return { data: null, error: { message: (cause as Error).message } } }
  }
  return { rpc, calls, versions, sheets, fail: (fn: string) => { failNext = fn } }
}

test('rpc: KHÔNG có băng "Dữ liệu thử"; danh sách + tạo bài + sửa + duyệt đi qua đúng các RPC; form nạp lại từ máy chủ', async () => {
  const server = fakeServer()
  goto('?muc=hopam')
  const view = render(<ChordLibraryPage library={createRpcChordLibrary(server.rpc)} />)
  await settle()
  assert.equal(view.queryByRole('note'), null, 'backend thật: không có băng dữ liệu thử')
  assert.match(view.getByRole('list').textContent ?? '', /Chưa có bài nào\./)
  assert.deepEqual(server.calls, ['chord_sheet_search'])

  await openNewChord()
  await settle()
  assert.equal(view.queryByRole('note'), null)
  type(view.getByLabelText(/Tên bài/), 'Bài thử RPC')
  setLyrics(view, '[C] lời một')
  server.calls.length = 0
  fireEvent.click(view.getByRole('button', { name: 'Lưu' }))
  await settle()
  assert.deepEqual(server.calls, ['chord_sheet_contribute', 'chord_sheet_get'], 'lưu = contribute rồi ĐỌC LẠI từ máy chủ; không approve ngầm')
  assert.doesNotMatch(view.getByRole('status').textContent ?? '', /Dữ liệu thử/)
  assert.match(view.getByRole('status').textContent ?? '', /Đã lưu bản nháp \(phiên bản 1\)/)
  assert.equal(server.sheets.get('s1')!.canonical, null)

  // sửa tên + tác giả + lời + BPM trong một lần lưu
  type(view.getByLabelText(/Tên bài/), 'Bài thử RPC (đổi tên)')
  type(view.getByLabelText(/Tác giả/), 'Thầy')
  setLyrics(view, '[C] lời một\n[G] lời hai')
  type(view.getByLabelText(/BPM gợi ý/), '88')
  server.calls.length = 0
  fireEvent.click(view.getByRole('button', { name: 'Lưu' }))
  await settle()
  assert.deepEqual(server.calls, ['chord_sheet_update_info', 'chord_sheet_contribute', 'chord_sheet_get'])
  assert.deepEqual(server.sheets.get('s1'), { title: 'Bài thử RPC (đổi tên)', composer: 'Thầy', canonical: null })
  assert.deepEqual(server.versions.map(v => [v.n, v.text, v.bpm, v.review]), [[1, '[C] lời một', null, 'private'], [2, '[C] lời một\n[G] lời hai', 88, 'private']], 'v1 không bị sửa; v2 là phiên bản mới')
  assert.ok(view.getByRole('heading', { name: 'Bài thử RPC (đổi tên)' }))

  // không đổi gì → không gọi máy chủ
  server.calls.length = 0
  fireEvent.click(view.getByRole('button', { name: 'Lưu' }))
  await settle()
  assert.deepEqual(server.calls, [], 'no-op: không RPC nào, không phiên bản rác')
  assert.equal(server.versions.length, 2)

  // duyệt
  fireEvent.click(view.getByRole('button', { name: 'Duyệt bản này' }))
  await settle()
  assert.deepEqual(server.calls, ['chord_sheet_approve', 'chord_sheet_get'])
  assert.equal(server.sheets.get('s1')!.canonical, server.versions[1].id)
  assert.match(view.getByRole('group', { name: 'Trạng thái phiên bản' }).textContent ?? '', /Bản đang dùng · phiên bản 2/)

  // quay lại danh sách: lấy từ máy chủ
  fireEvent.click(view.getByRole('button', { name: '← Danh sách' }))
  await settle()
  assert.deepEqual(view.getAllByRole('listitem').map(node => node.querySelector('strong')?.textContent), ['Bài thử RPC (đổi tên)'])
})

test('rpc: máy chủ lỗi khi lưu → hiện lỗi, KHÔNG báo "đã lưu", giữ nguyên chữ đang gõ; lỗi giữa chừng không gửi lại tên lần hai', async () => {
  const server = fakeServer()
  const library = createRpcChordLibrary(server.rpc)
  const first = await library.createChordSheet({ title: 'Bài lỗi', composer: '', meter: null, suggestedBpm: null, text: '[C] gốc' })
  goto(`?muc=hopam&hopam=${first.versionId}`)
  const view = render(<ChordLibraryPage library={library} />)
  await settle()
  type(view.getByLabelText(/Tên bài/), 'Bài lỗi (tên mới)')
  setLyrics(view, '[C] gốc\n[G] thêm')
  server.fail('chord_sheet_contribute')
  server.calls.length = 0
  fireEvent.click(view.getByRole('button', { name: 'Lưu' }))
  await settle()
  assert.match(view.getByRole('alert').textContent ?? '', /máy chủ từ chối \(thử nghiệm\)/)
  assert.equal(view.queryByRole('status'), null, 'không có thông báo thành công')
  assert.equal(lyricsOf(view), '[C] gốc\n[G] thêm', 'chữ đang gõ còn nguyên')
  assert.deepEqual(server.calls, ['chord_sheet_update_info', 'chord_sheet_contribute'])
  assert.equal(server.versions.length, 1, 'không có phiên bản nào được tạo')
  assert.equal(server.sheets.get('s1')!.title, 'Bài lỗi (tên mới)', 'tên đã lưu thật ở bước trước')
  server.calls.length = 0
  fireEvent.click(view.getByRole('button', { name: 'Lưu' }))
  await settle()
  assert.deepEqual(server.calls, ['chord_sheet_contribute', 'chord_sheet_get'], 'lần lưu lại chỉ gửi phần còn thiếu')
  assert.equal(server.versions.length, 2)
})

test('rpc: lỗi khi tải danh sách → thông báo + nút thử lại; lỗi khi duyệt → báo lỗi, trạng thái không đổi', async () => {
  goto('?muc=hopam')
  const denied = render(<ChordLibraryPage library={createRpcChordLibrary(async () => ({ data: null, error: { message: 'CHORDLIB_FORBIDDEN' } }))} />)
  await settle()
  assert.match(denied.getByRole('alert').textContent ?? '', /không có quyền/)
  assert.ok(denied.getByRole('button', { name: 'Thử lại' }))
  cleanup()

  const server = fakeServer()
  const library = createRpcChordLibrary(server.rpc)
  const first = await library.createChordSheet({ title: 'Bài duyệt lỗi', composer: '', meter: null, suggestedBpm: null, text: '[C] x' })
  goto(`?muc=hopam&hopam=${first.versionId}`)
  const view = render(<ChordLibraryPage library={library} />)
  await settle()
  server.fail('chord_sheet_approve')
  fireEvent.click(view.getByRole('button', { name: 'Duyệt bản này' }))
  await settle()
  assert.match(view.getByRole('alert').textContent ?? '', /máy chủ từ chối/)
  assert.match(view.getByRole('group', { name: 'Trạng thái phiên bản' }).textContent ?? '', /Bản nháp/)
  assert.equal(server.sheets.get('s1')!.canonical, null)
})

test('production chưa bật backend (disabled): báo rõ, không có ô nhập, không có nút thêm', async () => {
  goto('?muc=hopam&hopam=moi')
  const view = render(<ChordLibraryPage library={createDisabledChordLibrary()} tabs={<nav data-testid="tabs" />} />)
  await settle()
  assert.match(view.getByRole('alert').textContent ?? '', /chưa được bật trên máy chủ này\. Chưa có gì được lưu\./)
  assert.ok(view.getByTestId('tabs'), 'vẫn chuyển được về mục MusicXML')
  assert.equal(view.container.querySelector('input, textarea, select'), null)
  assert.equal(view.queryByRole('button', { name: '+ Thêm bài' }), null)
  assert.equal(view.queryByRole('note'), null, 'không giả làm dữ liệu thử')
})

const SESSION_READY = { status: 'ready', me: { role: 'teacher', userId: 'u', studentId: null, name: 'Thầy Văn Anh', email: 't@x.vn', avatarUrl: null, level: null, enrolledAt: null, htMember: false, isTeacher: true, coverUrl: null } } as const

test('Khung Class cho Thư viện: dùng đúng cấu trúc/class của Class (topbar, sidebar, nav-item), 5 mục đã chốt, mục đang mở đánh dấu, bấm mục khác thì báo đổi', async () => {
  const changes: string[] = []
  const view = render(<ThuVienShell active="chords" onNavigate={id => changes.push(id)} session={SESSION_READY}><p>nội dung</p></ThuVienShell>)
  const root = view.container.querySelector('.cs-root')!
  assert.ok(root, 'cùng khung .cs-root với Class')
  assert.ok(root.querySelector('header.cs-topbar .cs-brand .cs-brand-logo'), 'logo + chữ như Class')
  assert.equal(root.querySelector('.cs-brand-text')?.textContent, 'Thầy Văn Anh Guitar')
  assert.ok(root.querySelector('.cs-topbar .cs-classhome'), 'có nút "Trang Class" như Class')
  assert.ok(root.querySelector('.cs-sidebar .cs-nav-group .cs-nav-title'), 'sidebar nhóm mục như Class')
  const items = [...root.querySelectorAll('.cs-sidebar .cs-nav-item')].map(node => node.textContent)
  assert.deepEqual(items, ['Danh sách bài hát có hợp âm', 'Danh sách bản nhạc MusicXML', 'Nạp hợp âm mới', 'Nạp bản nhạc mới', 'Nâng cao'])
  const current = [...root.querySelectorAll('.cs-sidebar [aria-current=page]')]
  assert.deepEqual(current.map(node => node.textContent), ['Danh sách bài hát có hợp âm'])
  assert.ok(current[0].classList.contains('is-active'), 'trạng thái đang chọn dùng đúng class của Class')
  const sidebar = root.querySelector('.cs-sidebar')!
  const click = (name: string) => fireEvent.click([...sidebar.querySelectorAll('button')].find(b => b.textContent === name)!)
  click('Danh sách bài hát có hợp âm')
  assert.deepEqual(changes, [], 'bấm đúng mục đang mở thì không điều hướng')
  click('Nạp bản nhạc mới'); click('Danh sách bản nhạc MusicXML'); click('Nạp hợp âm mới')
  assert.deepEqual(changes.slice(-3), ['upload-musicxml', 'musicxml', 'new-chords'])
  assert.equal([...sidebar.querySelectorAll('a')].find(a => a.textContent === 'Nâng cao')!.getAttribute('href'), '/admin')
  assert.ok(view.getByText('nội dung'))
})

test('Khung Class: tài khoản như Class (avatar + menu; chưa đăng nhập → nút Đăng nhập về /me); mobile có ☰ mở menu dạng sheet, Esc đóng', async () => {
  const view = render(<ThuVienShell active="musicxml" onNavigate={() => {}} session={SESSION_READY}><p>x</p></ThuVienShell>)
  fireEvent.click(view.getByRole('button', { name: 'Tài khoản: Thầy Văn Anh' }))
  assert.ok(view.getByRole('menuitem', { name: 'Đăng xuất' }))
  fireEvent.click(view.getByRole('button', { name: 'Mở menu' }))
  const sheet = view.getByRole('dialog', { name: 'Menu' })
  assert.ok(sheet.querySelector('.cs-sheet-grip'))
  assert.equal(sheet.querySelectorAll('.cs-nav-item').length, 5)
  fireEvent.keyDown(window, { key: 'Escape' })
  assert.equal(view.queryByRole('dialog', { name: 'Menu' }), null)
  cleanup()
  const out = render(<ThuVienShell active={null} onNavigate={() => {}} session={{ status: 'signed-out' }}><p>x</p></ThuVienShell>)
  assert.equal(out.getByRole('link', { name: 'Đăng nhập' }).getAttribute('href'), '/me', 'đăng nhập qua trang của Class, không có hệ riêng')
})

// ── Rào chắn: /thuvien vẫn chỉ admin đang hoạt động; mục MusicXML không bị đổi hành vi ──
test('cổng /thuvien trong AppRouter giữ nguyên: admin + active, người khác bị đưa về /start', () => {
  const router = readFileSync(new URL('../../src/AppRouter.tsx', import.meta.url), 'utf8')
  const guard = /if \(path === '\/thuvien' \|\| path === '\/thuvien\/'\) \{\s*if \(loading\) return null\s*if \(!user \|\| appUser\?\.role !== 'admin' \|\| appUser\.status !== 'active'\) \{\s*window\.location\.href = '\/start'\s*return null\s*\}\s*return <Suspense[^\n]*<ThuVienPage \/><\/Suspense>\s*\}/
  assert.match(router, guard)
  assert.equal(router.match(/<ThuVienPage/g)?.length, 1, 'ThuVienPage chỉ được dựng ở đúng một chỗ — sau cổng admin')
})

test('mục MusicXML: vẫn là mặc định, vẫn gọi đúng các hàm cũ; thanh mục nằm NGOÀI khối bố cục theo vị trí', () => {
  const page = readFileSync(new URL('../../src/thuvien/ThuVienPage.tsx', import.meta.url), 'utf8')
  for (const piece of ['listLibrary()', 'importMusicXml(prepared, title, composer)', 'prepareMusicXml(file.name, await file.text())', '<ScoreViewer key={openId}', 'accept=".musicxml,.xml"'])
    assert.ok(page.includes(piece), piece)
  assert.match(page, /<main className="thu-vien[^"]*">\s*<div className="mx-auto max-w-4xl">/)
  assert.match(page, /<MusicXmlLibrary \/>/)
  assert.match(page, /<ThuVienShell active=\{activeNavItem\(search\)\}/, 'toàn bộ trang nằm trong khung Class')
  assert.ok(!page.includes('ThuVienTabs') && !page.includes('ThuVienHeader'), 'thanh mục cũ đã được khung Class thay thế')
  assert.ok(!page.includes('+ Thêm bản nhạc'), 'danh sách MusicXML không còn nút tạo mới trùng với Header')
  assert.equal(page.match(/accept="\.musicxml,\.xml"/g)?.length, 1, 'chỉ MỘT đường chọn file MusicXML (trang Nạp bản nhạc mới)')
  assert.equal(page.match(/importMusicXml\(/g)?.length, 1)
  const css = readFileSync(new URL('../../src/thuvien/ChordLibrary.css', import.meta.url), 'utf8')
  assert.equal(css.replace(/\/\*[\s\S]*?\*\//g, '').match(/\.thu-vien/g), null, 'CSS mới không có luật nào nhắm vào .thu-vien của mục MusicXML')
  const master = readFileSync(new URL('../../src/thuvien/masterLibrary.ts', import.meta.url), 'utf8')
  assert.ok(!master.includes('chord'), 'masterLibrary không biết gì về hợp âm')
})

// ── 5B: Phân tích vạch nhịp tự động → nạp vào trình sửa 5A ──
type AnalyzerT = import('../../src/thuvien/measureAnalysis').MeasureAnalyzer
type ResultT = import('../../src/thuvien/measureAnalysis').MeasureAnalysisResult
const { MOCK_OWNER_ID } = await import('../../src/thuvien/chordLibrary')
const { sha256Hex, sourcePath } = await import('../../src/thuvien/chordSources')
const AUTO_TEXT = 'Sáng [Am] nay, mình cùng [E7] đi qua bao con phố [Am] dài\nNắng [Dm] vàng rơi trên vai'
const proposal = (measures: { line: number | null; token: number | null }[], review: number[] = [], pickup = true): ResultT => ({
  ok: true, anchors: { ...(pickup ? { pickup: { line: 0, token: 0 } } : {}), measures },
  confidence: { overall: review.length ? 'LOW' : 'HIGH', measures: [] },
  review: { needsReview: review.length > 0, measures: review, notes: review.length ? ['Sheet có 16 chữ, lời chuẩn có 15 token.'] : [] },
  diagnostics: { engine: 'fake', pages: 1, systems: [], boundaries: [], sheetTokens: 15, canonicalTokens: 15, pickupDetected: pickup, warnings: [] },
})
function fakeAnalyzer(result: ResultT | (() => ResultT), ready = true) {
  const calls: Parameters<AnalyzerT['analyze']>[0][] = []
  const analyzer: AnalyzerT = { available: async () => ready, analyze: async input => { calls.push(input); return typeof result === 'function' ? result() : result } }
  return { analyzer, calls }
}
async function autoSong(withSource = true, anchors: { line: number | null; token: number | null }[] | null = null) {
  const library = createMockChordLibrary({ storage: memoryStorage() })
  const versionId = library.newVersionId()
  const sources = []
  if (withSource) {
    const path = sourcePath(MOCK_OWNER_ID, versionId, 0, 'image/png')
    const file = new Blob(['sheet-bytes'], { type: 'image/png' })
    await library.sources.upload(path, file, 'image/png')
    sources.push({ path, mime: 'image/png' as const, sha256: await sha256Hex(await file.arrayBuffer()), sizeBytes: file.size, page: 1 })
  }
  let created = await library.createChordSheet({ title: 'Bài tự soạn phân tích', composer: '', meter: { beats: 4, beatType: 4 }, suggestedBpm: 80, text: AUTO_TEXT }, { versionId, sources })
  if (anchors) created = await library.acceptAnchors(created.versionId, { measures: anchors })
  await library.approveChordSheetVersion(created.versionId)
  return { library, versionId: created.versionId }
}
async function openAuto(library: ReturnType<typeof createMockChordLibrary>, analyzer?: AnalyzerT) {
  goto('?muc=hopam')
  const view = render(<ChordLibraryPage library={library} analyzer={analyzer} readSource={async () => new Blob(['sheet-bytes'])} />)
  await settle()
  fireEvent.click(view.getByRole('button', { name: 'Sửa bài Bài tự soạn phân tích' }))
  await settle(60)
  return view
}
const analyzeButton = (view: ReturnType<typeof render>) => view.getByRole('button', { name: /Phân tích vạch nhịp|Đang phân tích/ }) as HTMLButtonElement

test('5B: không có analyzer (bản production) → nút Phân tích KHOÁ; analyzer chưa chạy / chưa có sheet nguồn → khoá kèm lý do', async () => {
  const { library } = await autoSong()
  const none = await openAuto(library)
  assert.equal(analyzeButton(none).disabled, true)
  assert.equal(analyzeButton(none).title, 'Chưa bật ở bản này.')
  cleanup()
  const down = await openAuto(library, fakeAnalyzer(proposal([]), false).analyzer)
  assert.equal(analyzeButton(down).title, 'Máy phân tích chưa chạy trên máy này.')
  cleanup()
  const bare = await autoSong(false)
  const noSource = await openAuto(bare.library, fakeAnalyzer(proposal([])).analyzer)
  assert.equal(analyzeButton(noSource).disabled, true)
  assert.equal(analyzeButton(noSource).title, 'Cần sheet nguồn (đã lưu) để phân tích.')
})

test('5B: Phân tích → máy ĐIỀN vạch vào trình sửa 5A; bản bên phải hiện |¹ |² ngay; ô chưa chắc có ⚠; thầy sửa rồi Chấp nhận → phiên bản mới', async () => {
  const { library } = await autoSong()
  const fake = fakeAnalyzer(proposal([{ line: 0, token: 1 }, { line: 0, token: 4 }, { line: 0, token: 9 }, { line: 1, token: 0 }], [3]))
  const view = await openAuto(library, fake.analyzer)
  assert.equal(analyzeButton(view).disabled, false)
  fireEvent.click(analyzeButton(view))
  await settle(60)
  assert.equal(fake.calls.length, 1)
  const files = await fake.calls[0].loadFiles()
  assert.deepEqual([fake.calls[0].text, files.length, files[0].mime, fake.calls[0].meter], [AUTO_TEXT, 1, 'image/png', { beats: 4, beatType: 4 }])
  assert.match(fake.calls[0].versionId, /^[0-9a-f-]{36}$/, 'analyzer nhận versionId (worker production chỉ dùng trường này)')
  assert.ok(view.getByRole('group', { name: 'Trình sửa vạch nhịp' }), 'đề xuất nạp vào chính trình sửa 5A')
  assert.match(view.getByRole('status').textContent ?? '', /Máy đã điền 4 ô \+ nhịp lấy đà/)
  assert.equal(sheetText(view.getByLabelText('Bản xem lại có số ô'))[0], '(lấy đà) Sáng |¹ [Am] nay, mình cùng |² [E7] đi qua bao con phố |³ [Am] dài')
  assert.match(view.getByLabelText('Máy chưa chắc').textContent ?? '', /⚠ Cần kiểm: ô 3/)
  assert.equal(view.container.querySelectorAll('.cl-anchor-list .cl-anchor-flag').length, 1, 'chỉ ô 3 có ⚠ trong dòng thời gian')
  assert.equal(view.getByLabelText('Bản xem lại có số ô').textContent?.includes('⚠'), false, 'bản thật bên phải KHÔNG bị rối bởi cờ')
  fireEvent.click(view.getByRole('button', { name: 'Xoá ô 3' }))
  assert.equal(sheetText(view.getByLabelText('Bản xem lại có số ô'))[0], '(lấy đà) Sáng |¹ [Am] nay, mình cùng |² [E7] đi qua bao con phố [Am] dài', 'sửa tay → số đổi ngay')
  fireEvent.click(view.getByRole('button', { name: 'Chấp nhận vạch nhịp' }))
  await settle(60)
  assert.match(view.getByRole('status').textContent ?? '', /Đã lưu vạch nhịp thành phiên bản 2 \(bản nháp\)/)
  const [item] = await library.searchChordSheets('tu soan phan tich')
  const v2 = await library.getChordSheet(item.draftVersionId!)
  assert.deepEqual(v2.anchors, { pickup: { line: 0, token: 0 }, measures: [{ line: 0, token: 1 }, { line: 0, token: 4 }, { line: 1, token: 0 }] })
  assert.equal(Object.keys(v2.anchors!.measures[0]).join(), 'line,token', 'không có confidence trong anchors')
  assert.ok(view.getByRole('button', { name: 'Duyệt bản này' }), 'không tự duyệt')
})

test('5B: đã có vạch → KHÔNG ghi đè: "Phân tích cần kiểm tra" + [Dùng đề xuất] / [Giữ vạch hiện tại]; đang sửa tay cũng vậy', async () => {
  const { library } = await autoSong(true, [{ line: 0, token: 2 }, { line: 1, token: 0 }])
  const view = await openAuto(library, fakeAnalyzer(proposal([{ line: 0, token: 1 }, { line: 0, token: 4 }, { line: 1, token: 0 }], [2])).analyzer)
  const barNums = () => [...view.container.querySelectorAll('.cl-slot-num')].map(node => node.textContent)
  const before = barNums()
  assert.deepEqual(before, ['¹', '²'], 'vạch đã lưu hiện sẵn trên bản nhạc')
  fireEvent.click(analyzeButton(view))
  await settle(60)
  const choice = view.getByRole('group', { name: 'Kết quả phân tích' })
  assert.match(choice.textContent ?? '', /Phân tích cần kiểm tra.*3 ô \+ nhịp lấy đà.*Cần kiểm: ô 2.*Vạch hiện tại chưa bị thay đổi/)
  assert.deepEqual(barNums(), before, 'chưa chọn → vạch trên bản nhạc giữ nguyên')
  fireEvent.click(view.getByRole('button', { name: 'Giữ vạch hiện tại' }))
  assert.equal(view.queryByRole('group', { name: 'Kết quả phân tích' }), null)
  assert.deepEqual(barNums(), before)
  // đang sửa tay dở → phân tích cũng không ghi đè
  fireEvent.click(view.getByRole('button', { name: 'Sửa vạch nhịp thủ công' }))
  await settle()
  fireEvent.click(view.getByRole('button', { name: /^Khe trước “phố” — dòng 1/ }))
  const manual = sheetText(view.getByLabelText('Bản xem lại có số ô'))
  fireEvent.click(analyzeButton(view))
  await settle(60)
  assert.deepEqual(sheetText(view.getByLabelText('Bản xem lại có số ô')), manual, 'vạch đang sửa dở không bị ghi đè')
  fireEvent.click(view.getByRole('button', { name: 'Dùng đề xuất' }))
  await settle()
  assert.equal(sheetText(view.getByLabelText('Bản xem lại có số ô'))[0], '(lấy đà) Sáng |¹ [Am] nay, mình cùng |² [E7] đi qua bao con phố [Am] dài', 'chọn Dùng đề xuất → nạp vào trình sửa')
})

test('5B: analyzer lỗi → báo rõ, KHÔNG đổi vạch; trình sửa thủ công vẫn dùng bình thường', async () => {
  const { library } = await autoSong()
  const view = await openAuto(library, fakeAnalyzer({ ok: false, error: { code: 'no_staff', message: 'Không tìm thấy khuông nhạc nào.' } }).analyzer)
  fireEvent.click(analyzeButton(view))
  await settle(60)
  assert.match(view.getByRole('alert').textContent ?? '', /Phân tích không thành công: Không tìm thấy khuông nhạc nào\. — vẫn đặt vạch thủ công được/)
  assert.equal(view.queryByRole('group', { name: 'Trình sửa vạch nhịp' }), null)
  fireEvent.click(view.getByRole('button', { name: 'Sửa vạch nhịp thủ công' }))
  await settle()
  fireEvent.click(view.getByRole('button', { name: /^Khe trước “nay,” — dòng 1/ }))
  assert.equal((view.getByRole('button', { name: 'Chấp nhận vạch nhịp' }) as HTMLButtonElement).disabled, false)
})

// ── Phân tích NỘI DUNG sheet (PDF/ảnh → lời + hợp âm) ──
type ExtractorT = import('../../src/thuvien/contentExtractor').ContentExtractor
type TargetT = import('../../src/thuvien/contentExtractor').ExtractionTarget
const extField = (value: unknown) => ({ value, evidence: [], source: 'ocr', confidence: 0.8 })
const extDoc = (text: string, o: { title?: string; author?: string; bpm?: number; chords?: 'DETECTED' | 'NO_CHORDS_DETECTED'; count?: number } = {}) => ({
  schema: 'chord-extraction/1', input: { pageCount: 1 }, pages: [{ regions: [{ lines: [{ tokens: [{ source: 'ocr' }] }] }] }],
  pipeline: { fallbackReasons: [] },
  interpretation: {
    metadata: { title: o.title ? extField(o.title) : null, author: o.author ? extField(o.author) : null, key: null, timeSignature: null, bpm: o.bpm ? extField(o.bpm) : null },
    chords: { status: o.chords ?? 'DETECTED', count: o.count ?? (text.match(/\[/g) ?? []).length }, draft: { text, warnings: [], reviewRequired: true },
  },
})
function fakeExtractor(result: () => import('../../src/thuvien/contentExtractor').ExtractionOutcome | Promise<import('../../src/thuvien/contentExtractor').ExtractionOutcome>, ready = true) {
  const targets: TargetT[] = []
  const extractor: ExtractorT = { available: async () => ready, extract: async target => { targets.push(target); return result() } }
  return { extractor, targets }
}
async function openNew(library: ReturnType<typeof createMockChordLibrary>, extractor?: ExtractorT) {
  goto('?muc=hopam')
  const view = render(<ChordLibraryPage library={library} extractor={extractor} />)
  await settle()
  await openNewChord()
  await settle()
  return view
}
const newLibrary = () => createMockChordLibrary({ storage: memoryStorage() })

test('extraction UI: không có extractor → không hiện nút; worker chưa chạy → nút khoá + lý do', async () => {
  const none = await openNew(newLibrary())
  await pick(none, [pngFile('a.png')])
  assert.equal(none.queryByRole('button', { name: /^Phân tích a\.png/ }), null)
  cleanup()
  const down = await openNew(newLibrary(), fakeExtractor(() => ({ ok: true, document: extDoc('x') }), false).extractor)
  await pick(down, [pngFile('a.png')])
  const button = down.getByRole('button', { name: 'Phân tích nội dung sheet (tham khảo): a.png' }) as HTMLButtonElement
  assert.equal(button.disabled, true); assert.equal(button.title, 'Máy phân tích chưa chạy.')
  assert.match(down.getByRole('region', { name: 'Nguồn sheet' }).textContent ?? '', /chưa chạy trên máy này/)
})

test('extraction UI: file CHƯA LƯU → staged (draftId + sourceIndex + mime); panel; Dùng kết quả điền form, KHÔNG lưu/duyệt', async () => {
  network = 0
  const library = newLibrary()
  const fake = fakeExtractor(() => ({ ok: true, document: extDoc('Tình ca\n[Am] Sáng nay [E7] mình đi', { title: 'Tình ca', author: 'Hoàng Việt', bpm: 88 }) }))
  const view = await openNew(library, fake.extractor)
  await pick(view, [pngFile('sheet.png')])
  fireEvent.click(view.getByRole('button', { name: 'Phân tích nội dung sheet (tham khảo): sheet.png' }))
  await settle(60)
  assert.equal(fake.targets.length, 1)
  const t = fake.targets[0] as Extract<TargetT, { kind: 'staged' }>
  assert.deepEqual([t.kind, t.sourceIndex, t.mime], ['staged', 0, 'image/png'])
  assert.match(t.draftId, /^[0-9a-f-]{36}$/)
  const panel = view.getByRole('region', { name: 'Kết quả đọc nội dung sheet (tham khảo)' })
  assert.match(panel.textContent ?? '', /thấy 2 hợp âm.*Tình ca.*Hoàng Việt.*88.*Nhịp: máy không đọc được/)
  assert.equal(panel.querySelector('pre')?.textContent, '[Am] Sáng nay [E7] mình đi', 'dòng tiêu đề đã bị bỏ khỏi lời')
  assert.equal(lyricsOf(view), '', 'chưa bấm Dùng → chưa đổi gì')
  fireEvent.click(view.getByRole('button', { name: 'Dùng kết quả này' }))
  await settle()
  assert.equal(lyricsOf(view), '[Am] Sáng nay [E7] mình đi')
  assert.equal((view.getByLabelText(/Tên bài/) as HTMLInputElement).value, 'Tình ca')
  assert.equal((view.getByLabelText(/Tác giả/) as HTMLInputElement).value, 'Hoàng Việt')
  assert.equal((view.getByLabelText(/BPM gợi ý/) as HTMLInputElement).value, '88')
  assert.equal(view.queryByRole('region', { name: 'Kết quả đọc nội dung sheet (tham khảo)' }), null)
  assert.match(view.getByRole('status').textContent ?? '', /chưa lưu hay duyệt/)
  assert.equal((await library.searchChordSheets('tinh ca')).length, 0, 'không tự lưu bài')
  assert.equal(confirmAsked, 0, 'ô trống → không hỏi xác nhận')
  assert.equal(network, 0)
})

test('extraction UI: ô lời đang có nội dung → hỏi trước khi thay; Từ chối giữ nguyên; tên/tác giả đã nhập không bị đè', async () => {
  const view = await openNew(newLibrary(), fakeExtractor(() => ({ ok: true, document: extDoc('[Am] Lời máy đọc', { title: 'Tên máy', author: 'Máy' }) })).extractor)
  type(view.getByLabelText(/Tên bài/), 'Tên của thầy')
  setLyrics(view, '[C] Lời thầy đã gõ rất dài ở đây rồi đó')
  await pick(view, [pngFile('s.png')])
  fireEvent.click(view.getByRole('button', { name: 'Phân tích nội dung sheet (tham khảo): s.png' }))
  await settle(60)
  confirmAnswer = false
  fireEvent.click(view.getByRole('button', { name: 'Dùng kết quả này' }))
  await settle()
  assert.equal(confirmAsked, 1)
  assert.equal(lyricsOf(view), '[C] Lời thầy đã gõ rất dài ở đây rồi đó', 'từ chối → giữ lời cũ')
  confirmAnswer = true
  fireEvent.click(view.getByRole('button', { name: 'Dùng kết quả này' }))
  await settle()
  assert.equal(lyricsOf(view), '[Am] Lời máy đọc')
  assert.equal((view.getByLabelText(/Tên bài/) as HTMLInputElement).value, 'Tên của thầy', 'tên đã có không bị đè')
  assert.equal((view.getByLabelText(/Tác giả/) as HTMLInputElement).value, 'Máy', 'ô tác giả trống → điền')
})

test('extraction UI: lỗi → báo rõ, form không đổi; KHÔNG hợp âm → cảnh báo, không bịa; đang phân tích → nút khoá', async () => {
  let release: (v: import('../../src/thuvien/contentExtractor').ExtractionOutcome) => void = () => {}
  const view = await openNew(newLibrary(), fakeExtractor(() => new Promise(resolve => { release = resolve })).extractor)
  await pick(view, [pngFile('s.png')])
  fireEvent.click(view.getByRole('button', { name: 'Phân tích nội dung sheet (tham khảo): s.png' }))
  await settle()
  assert.match(view.getByRole('status').textContent ?? '', /Đang phân tích s\.png/)
  assert.equal((view.getByRole('button', { name: 'Phân tích nội dung sheet (tham khảo): s.png' }) as HTMLButtonElement).disabled, true)
  release({ ok: false, error: { code: 'source_missing', message: 'Không tìm thấy file nguồn trên kho — nạp lại file.' } })
  await settle()
  assert.match(view.getByRole('alert').textContent ?? '', /Phân tích không thành công\. s\.png: Không tìm thấy file nguồn/)
  assert.equal(lyricsOf(view), '')
  fireEvent.click(view.getByRole('button', { name: 'Đóng' }))
  cleanup()
  const nochord = await openNew(newLibrary(), fakeExtractor(() => ({ ok: true, document: extDoc('Chỉ có lời thôi', { chords: 'NO_CHORDS_DETECTED', count: 0 }) })).extractor)
  await pick(nochord, [pngFile('s.png')])
  fireEvent.click(nochord.getByRole('button', { name: 'Phân tích nội dung sheet (tham khảo): s.png' }))
  await settle(60)
  const warn = nochord.getByLabelText('Cảnh báo của máy').textContent ?? ''
  assert.match(warn, /Máy không thấy hợp âm in trên sheet/)
  assert.equal(nochord.getByLabelText('Bản nháp máy đọc').textContent?.includes('['), false)
})

test('extraction UI: nhiều file → "Phân tích nội dung cả N file (tham khảo)" chạy tuần tự đúng thứ tự, gộp một panel', async () => {
  let n = 0
  const fake = fakeExtractor(() => ({ ok: true, document: extDoc(n++ === 0 ? '[Am] Trang một' : '[C] Trang hai', { title: n === 1 ? 'Bài hai trang' : undefined }) }))
  const view = await openNew(newLibrary(), fake.extractor)
  assert.equal(view.queryByRole('button', { name: /Phân tích nội dung cả/ }), null, 'một file → không có nút gộp')
  await pick(view, [pngFile('p1.png'), pngFile('p2.png', 'b')])
  fireEvent.click(view.getByRole('button', { name: 'Phân tích nội dung cả 2 file (tham khảo)' }))
  await settle(80)
  assert.deepEqual(fake.targets.map(t => (t as { sourceIndex: number }).sourceIndex), [0, 1])
  assert.equal(view.getByLabelText('Bản nháp máy đọc').textContent, '[Am] Trang một\n\n[C] Trang hai')
})

test('extraction UI: phiên bản ĐÃ LƯU → persisted (versionId + vị trí file); sau Dùng kết quả form dirty nhưng chưa tạo phiên bản mới', async () => {
  const { library, versionId } = await autoSong()
  const fake = fakeExtractor(() => ({ ok: true, document: extDoc('[G] Lời mới từ sheet') }))
  goto('?muc=hopam')
  const view = render(<ChordLibraryPage library={library} extractor={fake.extractor} readSource={async () => new Blob(['x'])} />)
  await settle()
  fireEvent.click(view.getByRole('button', { name: 'Sửa bài Bài tự soạn phân tích' }))
  await settle(60)
  fireEvent.click(view.getByRole('button', { name: /^Phân tích nội dung sheet \(tham khảo\): sheet-01/ }))
  await settle(60)
  assert.deepEqual(fake.targets, [{ kind: 'persisted', versionId, sourceIndex: 0 }])
  fireEvent.click(view.getByRole('button', { name: 'Dùng kết quả này' }))
  await settle()
  assert.equal(confirmAsked, 1, 'đang có lời → hỏi')
  assert.equal(lyricsOf(view), '[G] Lời mới từ sheet')
  const [item] = await library.searchChordSheets('tu soan phan tich')
  assert.equal(item.versionNumber ?? 1, 1, 'chưa lưu → vẫn phiên bản 1')
  assert.equal((view.getByRole('button', { name: 'Lưu' }) as HTMLButtonElement).disabled, false, 'form dirty → Lưu sáng; thầy tự bấm')
})

// ── Luồng chính: Lời + hợp âm CHUẨN → Nguồn sheet → Phân tích vạch nhịp → Anchors. OCR chỉ là công cụ nâng cao (tham khảo) ──
test('luồng chính: canonical trống → "Phân tích vạch nhịp" KHOÁ + "Cần dán lời + hợp âm trước."; có lời nhưng chưa lưu → hướng dẫn lưu trước', async () => {
  const fake = fakeAnalyzer(proposal([]))
  const view = await openNew(newLibrary(), undefined)
  void view
  cleanup()
  goto('?muc=hopam')
  const v = render(<ChordLibraryPage library={newLibrary()} analyzer={fake.analyzer} />)
  await settle()
  await openNewChord()
  await settle()
  assert.equal(analyzeButton(v).disabled, true)
  assert.equal(analyzeButton(v).title, 'Cần dán lời + hợp âm trước.')
  setLyrics(v, '[C] Lời chuẩn thầy dán')
  await settle()
  assert.equal(analyzeButton(v).disabled, true)
  assert.equal(analyzeButton(v).title, 'Lưu bài (kèm sheet) trước, rồi phân tích vạch nhịp.')
  assert.equal(fake.calls.length, 0, 'không gọi analyzer khi chưa đủ điều kiện')
})

test('luồng chính: có lời chuẩn + sheet đã lưu → nút sáng, gọi đúng measure analyzer; kết quả vào trình sửa vạch; lời chuẩn KHÔNG bị thay bằng OCR; OCR không hiện ở luồng chính', async () => {
  const { library } = await autoSong()
  const ocrText = 'Sang nay minh cung di qoa bao con pho sai chinh ta OCR-RAC'
  const extractor = fakeExtractor(() => ({ ok: true, document: extDoc(ocrText) }))
  const analyzer = fakeAnalyzer(proposal([{ line: 0, token: 1 }, { line: 0, token: 4 }, { line: 1, token: 0 }]))
  goto('?muc=hopam')
  const view = render(<ChordLibraryPage library={library} analyzer={analyzer.analyzer} extractor={extractor.extractor} readSource={async () => new Blob(['x'])} />)
  await settle()
  fireEvent.click(view.getByRole('button', { name: 'Sửa bài Bài tự soạn phân tích' }))
  await settle(60)
  const before = lyricsOf(view)
  assert.equal(analyzeButton(view).disabled, false)
  fireEvent.click(analyzeButton(view))
  await settle(80)
  assert.equal(analyzer.calls.length, 1, 'gọi đúng measure analyzer (/analyze-measures)')
  assert.equal(analyzer.calls[0].text, AUTO_TEXT)
  assert.ok(view.getByRole('group', { name: 'Trình sửa vạch nhịp' }), 'kết quả đi vào AnchorEditor')
  assert.equal(lyricsOf(view), before, 'lời chuẩn giữ nguyên')
  assert.equal(extractor.targets.length, 0, 'không chạy content extraction thay thế')
  assert.doesNotMatch(view.container.textContent ?? '', /OCR-RAC|sai chinh ta/, 'chữ OCR không xuất hiện trong luồng chính')
  assert.equal(sheetText(view.getByLabelText('Bản xem lại có số ô'))[0].includes('Sáng'), true, 'bản xem thử vẫn là lời chuẩn')
})

test('luồng chính: Nguồn sheet đứng trước Phân tích vạch nhịp; OCR content extraction là "Công cụ nâng cao" thu gọn, nhãn "(tham khảo)", không có nút "Phân tích" trần', async () => {
  const { library } = await autoSong()
  const fake = fakeExtractor(() => ({ ok: true, document: extDoc('x') }))
  goto('?muc=hopam')
  const view = render(<ChordLibraryPage library={library} analyzer={fakeAnalyzer(proposal([])).analyzer} extractor={fake.extractor} readSource={async () => new Blob(['x'])} />)
  await settle()
  fireEvent.click(view.getByRole('button', { name: 'Sửa bài Bài tự soạn phân tích' }))
  await settle(60)
  const source = view.getByRole('region', { name: 'Nguồn sheet' }), beats = view.getByRole('region', { name: 'Vạch nhịp' })
  assert.ok(source.compareDocumentPosition(beats) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING, 'thứ tự: Nguồn sheet → Vạch nhịp')
  const details = source.querySelector('details.cl-advanced') as HTMLDetailsElement
  assert.ok(details); assert.equal(details.open, false, 'thu gọn mặc định')
  assert.equal(details.querySelector('summary')?.textContent, 'Công cụ nâng cao')
  assert.match(details.textContent ?? '', /không phải nguồn lời chuẩn/)
  assert.equal(view.queryByRole('button', { name: /^Phân tích$/ }), null, 'không còn nút "Phân tích" trần cạnh file nguồn')
  assert.ok(view.getByRole('button', { name: /^Phân tích nội dung sheet \(tham khảo\)/ }), 'công cụ cũ vẫn dùng được, nhãn tham khảo')
})

// ── Multi-verse anchors V1: cảnh báo lời chưa có vạch ──
const TWO_VERSE_TEXT = '1. Sáng [Am] nay, mình cùng [E7] đi qua bao con phố\nNắng [Dm] vàng rơi trên vai người\n\n2. Chiều [Am] qua, ta cùng [E7] về bên con đường cũ\nGió [Dm] mây bay trên đồi cao\n(Lặp lại 2 lần)\nĐK 2:'
const VERSE_1_ONLY = [{ line: 0, token: 0 }, { line: 0, token: 4 }, { line: 1, token: 0 }, { line: 1, token: 3 }]
const VERSE_2 = [{ line: 3, token: 0 }, { line: 3, token: 5 }, { line: 4, token: 0 }, { line: 4, token: 3 }]
async function twoVerseSong(anchors: { line: number | null; token: number | null }[]) {
  const library = createMockChordLibrary({ storage: memoryStorage() })
  let created = await library.createChordSheet({ title: 'Bài hai lời', composer: '', meter: { beats: 4, beatType: 4 }, suggestedBpm: 80, text: TWO_VERSE_TEXT }, { versionId: library.newVersionId(), sources: [] })
  created = await library.acceptAnchors(created.versionId, { measures: anchors })
  await library.approveChordSheetVersion(created.versionId)
  goto('?muc=hopam')
  const view = render(<ChordLibraryPage library={library} />)
  await settle()
  fireEvent.click(view.getByRole('button', { name: 'Sửa bài Bài hai lời' }))
  await settle(60)
  return view
}
const uncoveredNote = (view: ReturnType<typeof render>) => view.container.querySelector('.cl-uncovered')

test('vạch chỉ phủ lời 1 → cảnh báo đúng dòng lời 2 (không báo dòng trống, chú thích "(Lặp lại…)", nhãn "ĐK 2:"); không chặn việc xem/sửa', async () => {
  const view = await twoVerseSong(VERSE_1_ONLY)
  const note = uncoveredNote(view)
  assert.ok(note, 'có cảnh báo')
  assert.match(note.textContent ?? '', /Lời chưa có vạch nhịp đã lưu: dòng 4–5 \(15 chữ\)/)
  assert.ok(view.getByRole('button', { name: 'Sửa vạch nhịp thủ công' }), 'vẫn sửa được')
  assert.ok(view.getByLabelText('Vạch nhịp theo ô'), 'vẫn xem được vạch đã có')
})

test('vạch đã phủ cả lời 2 → hết cảnh báo', async () => {
  const view = await twoVerseSong([...VERSE_1_ONLY, ...VERSE_2])
  assert.equal(uncoveredNote(view), null)
})

test('đề xuất của máy chỉ phủ lời 1 → trình sửa cảnh báo ngay; thầy thêm vạch lời 2 (thêm vào cuối) → cảnh báo biến mất; đề xuất phủ cả hai lời thì không có cảnh báo', async () => {
  const library = createMockChordLibrary({ storage: memoryStorage() })
  const versionId = library.newVersionId()
  const path = sourcePath(MOCK_OWNER_ID, versionId, 0, 'image/png')
  const file = new Blob(['sheet-bytes'], { type: 'image/png' })
  await library.sources.upload(path, file, 'image/png')
  const created = await library.createChordSheet({ title: 'Bài hai lời', composer: '', meter: { beats: 4, beatType: 4 }, suggestedBpm: 80, text: TWO_VERSE_TEXT },
    { versionId, sources: [{ path, mime: 'image/png', sha256: await sha256Hex(await file.arrayBuffer()), sizeBytes: file.size, page: 1 }] })
  await library.approveChordSheetVersion(created.versionId)
  const open = async (measures: typeof VERSE_1_ONLY) => {
    goto('?muc=hopam')
    const view = render(<ChordLibraryPage library={library} analyzer={fakeAnalyzer(proposal(measures, [], false)).analyzer} readSource={async () => new Blob(['sheet-bytes'])} />)
    await settle()
    fireEvent.click(view.getByRole('button', { name: 'Sửa bài Bài hai lời' }))
    await settle(60)
    fireEvent.click(analyzeButton(view))
    await settle(60)
    return view
  }
  const partial = await open(VERSE_1_ONLY)
  const editor = partial.getByRole('group', { name: 'Trình sửa vạch nhịp' })
  assert.match(editor.querySelector('.cl-uncovered')?.textContent ?? '', /\(theo dòng thời gian hiện tại\): dòng 4–5/)
  assert.equal((partial.getByRole('button', { name: 'Chấp nhận vạch nhịp' }) as HTMLButtonElement).disabled, false, 'cảnh báo KHÔNG chặn việc chấp nhận')
  fireEvent.click(partial.getByRole('radio', { name: /Thêm vào cuối/ }))
  fireEvent.click(partial.getByRole('button', { name: /^Khe trước “Chiều” — dòng 4/ }))
  assert.match(editor.querySelector('.cl-uncovered')?.textContent ?? '', /dòng 5 \(6 chữ\)/, 'đã phủ dòng 4, còn dòng 5')
  fireEvent.click(partial.getByRole('button', { name: /^Khe trước “Gió” — dòng 5/ }))
  assert.equal(editor.querySelector('.cl-uncovered'), null, 'phủ đủ cả lời 2 → hết cảnh báo')
  cleanup()
  const full = await open([...VERSE_1_ONLY, ...VERSE_2])
  assert.equal(full.container.querySelector('.cl-uncovered'), null)
})

// ── Chạm chữ để chỉnh hợp âm (Slice 1) ──────────────────────────────────────────────────────────
async function openNewWithText(text: string) {
  const view = await openList()
  await openNewChord()
  await settle()
  setLyrics(view, text)
  return view
}
const areaOf = (view: Awaited<ReturnType<typeof openNewWithText>>) => ({ get value() { return lyricsOf(view) } })

test('chạm chữ → chọn hợp âm đã có trong bài → chuỗi [Am] đổi đúng một chỗ, lời không đổi', async () => {
  const view = await openNewWithText('Chiều [Am] nao, tiễn nhau [E7] đi\n[C] Khi bóng ngả')
  fireEvent.click(view.getByRole('button', { name: 'Thêm hợp âm cho chữ nhau' }))
  const picker = view.getByRole('group', { name: 'Chọn hợp âm cho chữ nhau' })
  fireEvent.click([...picker.querySelectorAll('.cl-chip')].find(node => node.textContent === 'E7')!)
  assert.equal(areaOf(view).value, 'Chiều [Am] nao, tiễn [E7] nhau [E7] đi\n[C] Khi bóng ngả')
  assert.equal(view.queryByRole('group', { name: /Chọn hợp âm/ }), null, 'chọn xong thì đóng bảng')
})

test('chạm chữ → nhập hợp âm khác; hợp âm sai báo lỗi tại chỗ, không đổi văn bản', async () => {
  const view = await openNewWithText('Chiều [Am] nao')
  fireEvent.click(view.getByRole('button', { name: 'Đổi hợp âm Am trên chữ nao' }))
  const picker = view.getByRole('group', { name: 'Chọn hợp âm cho chữ nao' })
  const input = picker.querySelector('input')!
  type(input, 'A[m')
  fireEvent.submit(input.closest('form')!)
  assert.match(picker.textContent ?? '', /Nhập tên hợp âm/)
  assert.equal(areaOf(view).value, 'Chiều [Am] nao')
  type(input, 'F#m7')
  fireEvent.submit(input.closest('form')!)
  assert.equal(areaOf(view).value, 'Chiều [F#m7] nao')
})

test('chạm chữ → xoá hợp âm; xoá làm dính chữ (ti[Am]ễn) thì từ chối và giữ nguyên văn bản', async () => {
  const view = await openNewWithText('Chiều [Am] nao\nti[G]ễn nhau')
  fireEvent.click(view.getByRole('button', { name: 'Đổi hợp âm Am trên chữ nao' }))
  fireEvent.click(view.getByRole('button', { name: 'Xoá hợp âm Am' }))
  assert.equal(areaOf(view).value, 'Chiều nao\nti[G]ễn nhau')
  fireEvent.click(view.getByRole('button', { name: 'Đổi hợp âm G trên chữ ễn' }))
  fireEvent.click(view.getByRole('button', { name: 'Xoá hợp âm G' }))
  assert.match(view.getByRole('group', { name: 'Chọn hợp âm cho chữ ễn' }).textContent ?? '', /đổi cách tách chữ/)
  assert.equal(areaOf(view).value, 'Chiều nao\nti[G]ễn nhau')
})

test('bố cục một cột: thanh công cụ 3 nút; ô nhập mã chỉ có trong cửa sổ; Thiết lập bài hát chứa nguồn sheet, vạch nhịp, phiên bản', async () => {
  const view = await openList()
  fireEvent.click(view.getByRole('button', { name: 'Sửa bài Bài thử 01' }))
  await settle()
  const bar = view.getByRole('toolbar', { name: 'Công cụ của bài' })
  assert.deepEqual([...bar.querySelectorAll('button, label')].map(node => node.textContent?.trim()), ['Nạp lời & hợp âm', 'Nạp ảnh/PDF tham khảo', 'Thiết lập bài hát'])
  assert.equal(view.queryByLabelText('Ô soạn lời và hợp âm'), null, 'ô nhập mã không nằm sẵn trong trang')
  const advanced = view.container.querySelector('details.cl-fold-advanced') as HTMLDetailsElement
  assert.equal(advanced.open, false)
  for (const label of ['Nguồn sheet', 'Vạch nhịp']) assert.ok(advanced.querySelector(`section[aria-label="${label}"]`), label)
  assert.ok(advanced.querySelector('[role=group][aria-label="Trạng thái phiên bản"]'), 'phiên bản nằm trong Thiết lập bài hát')
  assert.equal(view.queryByRole('button', { name: 'Nạp bản nhạc' }), null, 'trong trình sửa không còn nút tên "Nạp bản nhạc" (dễ nhầm với MusicXML)')
  fireEvent.click(view.getByRole('button', { name: 'Thiết lập bài hát' }))
  assert.equal(advanced.open, true, 'nút Thiết lập bài hát mở mục cùng tên')
  fireEvent.click(view.container.querySelector('.cl-status-chip')!)
  assert.equal(advanced.open, true)
})

test('cửa sổ Nạp lời: Áp dụng đổi bản nhạc (chưa ghi DB); Hủy giữ nguyên; đóng khi đang sửa thì hỏi, từ chối thì giữ chữ đang soạn', async () => {
  const view = await openNewWithText('[C] Lời gốc\n[G] Dòng hai')
  const dbBefore = (await view.library.searchChordSheets('')).length
  const open = () => fireEvent.click(view.getByRole('button', { name: 'Nạp lời & hợp âm' }))
  const area = () => view.getByLabelText('Ô soạn lời và hợp âm') as HTMLTextAreaElement
  // Hủy khi chưa sửa: đóng, không hỏi
  open(); assert.equal(area().value, '[C] Lời gốc\n[G] Dòng hai')
  fireEvent.click(view.getByRole('button', { name: 'Hủy' }))
  assert.equal(view.queryByRole('dialog'), null); assert.equal(confirmAsked, 0)
  // Sửa rồi Hủy, trả lời "không" → vẫn mở, giữ chữ đang soạn
  open(); type(area(), '[Am] Lời mới hoàn toàn')
  confirmAnswer = false
  fireEvent.click(view.getByRole('button', { name: 'Hủy' }))
  assert.equal(confirmAsked, 1); assert.ok(view.getByRole('dialog'), 'từ chối → cửa sổ vẫn mở'); assert.equal(area().value, '[Am] Lời mới hoàn toàn')
  // Esc cũng hỏi
  fireEvent.keyDown(document, { key: 'Escape' })
  assert.equal(confirmAsked, 2); assert.ok(view.getByRole('dialog'))
  // đồng ý bỏ → đóng, bản nhạc không đổi
  confirmAnswer = true
  fireEvent.click(view.getByRole('button', { name: 'Hủy' }))
  assert.equal(view.queryByRole('dialog'), null)
  assert.equal(lyricsOf(view), '[C] Lời gốc\n[G] Dòng hai', 'Hủy không đổi bản nhạc')
  // Áp dụng → bản nhạc đổi; vẫn chưa ghi DB; chạm chữ sửa hợp âm sau khi nạp
  setLyrics(view, '[Am] Khói thuốc đợi chờ\nAi về trong chiều')
  assert.ok(view.getByRole('region', { name: 'Xem thử' }).textContent?.includes('Khói'))
  assert.equal((await view.library.searchChordSheets('')).length, dbBefore, 'Áp dụng chưa ghi DB')
  fireEvent.click(view.getByRole('button', { name: 'Thêm hợp âm cho chữ trong' }))
  fireEvent.click([...view.container.querySelectorAll('.cl-picker .cl-chip')].find(node => node.textContent === 'G')!)
  assert.equal(lyricsOf(view), '[Am] Khói thuốc đợi chờ\nAi về [G] trong chiều')
})

test('Nạp ảnh/PDF tham khảo từ thanh công cụ dùng lại đường tải PDF/ảnh hiện có và mở Thiết lập bài hát', async () => {
  const view = await openNewWithText('[C] Có lời')
  const input = view.getByLabelText('Nạp ảnh hoặc PDF tham khảo') as HTMLInputElement
  assert.equal(input.getAttribute('accept'), view.getByLabelText('Chọn file PDF hoặc ảnh sheet').getAttribute('accept'))
  const file = new dom.window.File([new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10])], 'bai.pdf', { type: 'application/pdf' })
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  fireEvent.change(input)
  await settle(80)
  const advanced = view.container.querySelector('details.cl-fold-advanced') as HTMLDetailsElement
  assert.equal(advanced.open, true)
  assert.match(view.getByRole('region', { name: 'Nguồn sheet' }).textContent ?? '', /bai\.pdf/)
})

// ── Website THƯ VIỆN ÂM NHẠC: trang XEM tách khỏi khu vực NẠP/BIÊN TẬP ─────────────────────────
const { chordViewFromSearch, chordViewUrl, uploadFromSearch, uploadUrl, sectionUrl, sectionFromSearch, chordSheetFromSearch, activeNavItem } = await import('../../src/thuvien/sections')
const activeHeaderItem = activeNavItem

test('địa chỉ: xem / sửa / nạp tách nhau, đổi mục thì bỏ tham số của mục kia', () => {
  const base = 'https://class.vananhaudio.com/thuvien'
  assert.equal(chordViewUrl(base, 'v1'), '/thuvien?muc=hopam&xem=v1')
  assert.equal(chordViewFromSearch('?muc=hopam&xem=v1'), 'v1')
  assert.equal(chordViewFromSearch('?xem=v1'), null, 'xem= chỉ có nghĩa trong mục hợp âm')
  assert.equal(chordSheetFromSearch('?muc=hopam&xem=v1'), null, 'trang xem KHÔNG phải trình sửa')
  assert.equal(uploadUrl(base), '/thuvien?nap=nhac')
  assert.equal(uploadFromSearch('?nap=nhac'), true)
  assert.equal(uploadFromSearch('?muc=hopam&nap=nhac'), false)
  assert.equal(sectionFromSearch('?nap=nhac'), 'musicxml')
  assert.equal(sectionUrl('https://x/thuvien?muc=hopam&xem=v1', 'musicxml'), '/thuvien', 'sang mục MusicXML thì bỏ xem=')
  assert.equal(sectionUrl('https://x/thuvien?nap=nhac', 'chords'), '/thuvien?muc=hopam', 'sang mục hợp âm thì bỏ nap=')
})

test('Header: mục đang mở suy ra từ địa chỉ', () => {
  assert.equal(activeHeaderItem(''), 'musicxml')
  assert.equal(activeHeaderItem('?bai=abc'), 'musicxml')
  assert.equal(activeHeaderItem('?nap=nhac'), 'upload-musicxml')
  assert.equal(activeHeaderItem('?muc=hopam'), 'chords')
  assert.equal(activeHeaderItem('?muc=hopam&xem=v1'), 'chords')
  assert.equal(activeHeaderItem('?muc=hopam&hopam=moi'), 'new-chords')
  assert.equal(activeHeaderItem('?muc=hopam&hopam=v1'), 'chords', 'đang sửa bài có sẵn thuộc mục danh sách')
})

test('trang XEM: chỉ đọc (không ô nhập, không Lưu), có nút Sửa mở trình sửa; Header điều hướng bằng địa chỉ + popstate', async () => {
  const view = await openList()
  fireEvent.click(view.getByRole('button', { name: 'Xem bài Bài thử 01' }))
  await settle()
  assert.match(dom.window.location.search, /^\?muc=hopam&xem=/)
  assert.ok(view.getByRole('heading', { name: 'Bài thử 01' }))
  assert.match(view.getByRole('region', { name: 'Thông tin phiên bản' }).textContent ?? '', /Phiên bản.*1.*Bản đang dùng/)
  assert.ok(view.getByRole('region', { name: 'Lời và hợp âm' }).textContent?.includes('[') === false, 'hiển thị hợp âm đã dựng, không phải chuỗi mã')
  assert.equal(view.container.querySelector('textarea, input[type=text], .cl-toolbar'), null, 'không có textarea / trình biên tập trong trang xem')
  assert.equal(view.queryByRole('button', { name: 'Lưu' }), null)
  assert.equal(view.queryByRole('button', { name: /Xoá|Xóa/ }), null, 'chưa có đường xoá ở backend → không có nút xoá')
  assert.ok(view.getByTestId('tabs'), 'Header website có mặt ở trang xem')
  fireEvent.click(view.getByRole('button', { name: 'Sửa bài này' }))
  await settle()
  assert.match(dom.window.location.search, /^\?muc=hopam&hopam=/)
  assert.ok(view.getByRole('button', { name: 'Lưu' }), 'sang khu vực biên tập')
  // Header điều hướng bằng pushState + popstate: trang đang mở đọc lại địa chỉ
  dom.window.history.pushState(null, '', '/thuvien?muc=hopam&hopam=moi')
  await act(async () => { dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate')) })
  await settle()
  assert.ok(view.getByRole('heading', { name: 'Thêm bài' }), 'Nạp hợp âm mới mở trình sửa bài mới')
})

test('danh sách: mỗi bài có Xem và Sửa; không có quyền sửa thì chỉ còn Xem', async () => {
  goto('?muc=hopam')
  const view = render(<ChordLibraryPage library={createMockChordLibrary({ storage: memoryStorage() })} canEdit={false} />)
  await settle()
  assert.ok(view.getByRole('button', { name: 'Xem bài Bài thử 01' }))
  assert.equal(view.queryByRole('button', { name: 'Sửa bài Bài thử 01' }), null)
  assert.equal(view.queryByRole('button', { name: '+ Thêm bài' }), null)
})

// ═══ Một bản nhạc duy nhất để biên tập: click chữ / khe / vạch ═══════════════════════════════════
const { buildChordTimeline } = await import('../../src/thuvien/chordTimeline')
const tap = (view: View, name: string) => fireEvent.click(view.getByRole('button', { name }))
const slotOf = (view: View, line: number, gapIndex: number) =>
  view.container.querySelector(`.cl-slot[aria-label$="(dòng ${line + 1}, khe ${gapIndex + 1})"]`) as HTMLElement
const chip = (view: View, name: string) => fireEvent.click([...view.container.querySelectorAll('.cl-picker .cl-chip')].find(node => node.textContent === name)!)
const barNums = (view: View) => [...view.container.querySelectorAll('.cl-slot-num')].map(node => node.textContent)
const barAt = (view: View, line: number, gapIndex: number) => slotOf(view, line, gapIndex).getAttribute('data-bar') === 'true'
const savedVersion = async (view: Awaited<ReturnType<typeof openNewWithText>>, query: string) => {
  const [item] = await view.library.searchChordSheets(query)
  return view.library.getChordSheet(item.draftVersionId ?? item.versionId)
}

test('Case 1 — click chữ → chọn Am → hợp âm hiện đúng; lời không đổi', async () => {
  const view = await openNewWithText('Chiều một mình qua phố')
  tap(view, 'Thêm hợp âm cho chữ Chiều')
  chip(view, 'Am')
  assert.equal(lyricsOf(view), '[Am] Chiều một mình qua phố')
  assert.equal(view.container.querySelectorAll('.cl-edit-row').length, 1, 'chỉ MỘT bản nhạc để chỉnh')
  assert.equal(view.queryByRole('button', { name: /Chỉnh vạch nhịp/ }), null, 'không có "chế độ" chỉnh vạch nhịp')
  assert.equal(view.container.querySelector('.cl-anchor-sheet, .cl-msheet'), null, 'không có bản nhạc thứ hai / bảng token')
})

test('Case 2 — click khe giữa "một" và "mình" → chọn E7 → tự sinh (-) và gắn E7; một lần chọn, không đổi chữ nào', async () => {
  const view = await openNewWithText('Chiều một mình qua phố')
  fireEvent.click(slotOf(view, 0, 2))
  chip(view, 'E7')
  assert.equal(lyricsOf(view), 'Chiều một [E7](-) mình qua phố')
  assert.equal(view.container.querySelector('.cl-picker'), null, 'một lần chọn là xong, popover tự đóng')
})

test('Case 3 — click khe → "Đặt vạch nhịp tại đây": vạch hiện đúng khe, KHÔNG sinh (-), không đổi hợp âm/lời', async () => {
  const view = await openNewWithText('[Am]Chiều một mình qua phố')
  const before = lyricsOf(view)
  fireEvent.click(slotOf(view, 0, 2))
  tap(view, '｜ Đặt vạch nhịp tại đây')
  assert.equal(lyricsOf(view), before)
  assert.ok(barAt(view, 0, 2))
  assert.deepEqual(barNums(view), ['¹'])
  assert.doesNotMatch(lyricsOf(view), /\(-\)/)
})

test('Case 4 — cùng một khe có vạch nhịp và hợp âm trên (-): chọn rõ SAU vạch / TRƯỚC vạch, không xung đột click', async () => {
  const view = await openNewWithText('Chiều một mình qua phố')
  fireEvent.click(slotOf(view, 0, 2)); tap(view, '｜ Đặt vạch nhịp tại đây')
  // mở lại đúng khe đã có vạch: popover liệt kê vạch + đặt hợp âm kèm lựa chọn so với vạch
  fireEvent.click(slotOf(view, 0, 2))
  assert.ok(view.getByRole('button', { name: 'Xóa vạch ô 1' }))
  assert.ok(view.getByRole('radiogroup', { name: 'Vị trí hợp âm so với vạch' }))
  chip(view, 'E7')   // mặc định: sau vạch
  assert.equal(lyricsOf(view), 'Chiều một [E7](-) mình qua phố')
  // vạch vẫn đứng trước (-) (khe 2) → (-) thuộc ô 1 bắt đầu ở vạch
  assert.ok(barAt(view, 0, 2))
  assert.equal(barAt(view, 0, 3), false)
  // click chữ (-) và click khe cạnh nó là hai thao tác khác nhau
  tap(view, 'Đổi hợp âm E7 trên chữ (-) (dòng 1, vị trí 3)')
  assert.ok(view.getByRole('group', { name: 'Chọn hợp âm cho chữ (-)' }))
  tap(view, 'Đóng')
  // thêm hợp âm TRƯỚC vạch: (-) mới nằm trước vạch, vạch dời sau nó
  fireEvent.click(slotOf(view, 0, 2))
  fireEvent.click(view.getByRole('radio', { name: 'Trước vạch' }))
  chip(view, 'Am')
  assert.equal(lyricsOf(view), 'Chiều một [Am](-) [E7](-) mình qua phố')
  assert.ok(barAt(view, 0, 3), 'vạch dời sau (-) mới: vẫn đứng ngay trước (-) của E7')
  assert.equal(barAt(view, 0, 2), false)
})

test('Case 5 — ba vị trí nghỉ liên tiếp, mỗi nơi một hợp âm; không gộp token', async () => {
  const view = await openNewWithText('Chiều một')
  fireEvent.click(slotOf(view, 0, 1)); chip(view, 'Am')
  fireEvent.click(slotOf(view, 0, 2)); chip(view, 'Dm')
  fireEvent.click(slotOf(view, 0, 3)); chip(view, 'E7')
  assert.equal(lyricsOf(view), 'Chiều [Am](-) [Dm](-) [E7](-) một')
  const tokens = lyricsOf(view).split(' ').filter(word => word.includes('(-)'))
  assert.equal(tokens.length, 3)
})

test('Case 6 — vạch: thêm → dịch trái → dịch phải → xoá; lời và hợp âm không đổi', async () => {
  const view = await openNewWithText('[Am]Chiều một [Dm]mình qua phố')
  const before = lyricsOf(view)
  fireEvent.click(slotOf(view, 0, 2)); tap(view, '｜ Đặt vạch nhịp tại đây')
  assert.ok(barAt(view, 0, 2))
  fireEvent.click(slotOf(view, 0, 2)); tap(view, 'Dịch vạch ô 1 sang khe trước')
  assert.ok(barAt(view, 0, 1)); assert.equal(barAt(view, 0, 2), false)
  tap(view, 'Dịch vạch ô 1 sang khe sau')                  // popover đi theo vạch
  assert.ok(barAt(view, 0, 2))
  tap(view, 'Xóa vạch ô 1')
  assert.deepEqual(barNums(view), [])
  assert.equal(lyricsOf(view), before)
})

test('Case 7 — chèn hợp âm không lời khi đã có vạch: vạch phía sau vẫn đứng trước đúng chữ cũ (cả khi sang dòng khác)', async () => {
  const view = await openNewWithText('Chiều một mình\nQua phố vắng em ơi')
  fireEvent.click(slotOf(view, 0, 0)); tap(view, '｜ Đặt vạch nhịp tại đây')
  fireEvent.click(slotOf(view, 0, 2)); tap(view, '｜ Đặt vạch nhịp tại đây')
  fireEvent.click(slotOf(view, 1, 0)); tap(view, '｜ Đặt vạch nhịp tại đây')
  fireEvent.click(slotOf(view, 1, 3)); tap(view, '｜ Đặt vạch nhịp tại đây')
  assert.deepEqual(barNums(view), ['¹', '²', '³', '⁴'])
  // chèn ở khe 1 của dòng 1 (giữa "Chiều" và "một"): vạch ô 2 (trước "mình") dời 1 token, vẫn trước "mình"
  fireEvent.click(slotOf(view, 0, 1)); chip(view, 'G')
  assert.equal(lyricsOf(view), 'Chiều [G](-) một mình\nQua phố vắng em ơi')
  assert.ok(barAt(view, 0, 0) && barAt(view, 0, 3) && barAt(view, 1, 0) && barAt(view, 1, 3), 'vạch: đầu dòng 1, trước "mình", đầu dòng 2, trước "em"')
  assert.equal(barAt(view, 0, 2), false)
  assert.deepEqual(barNums(view), ['¹', '²', '³', '⁴'], 'số ô giữ nguyên')
})

test('xoá vị trí nghỉ: bình thường xoá ngay; nếu (-) đang là CẢ MỘT ô thì hỏi trước vì ô sẽ thành ô ngân', async () => {
  const view = await openNewWithText('Chiều một')
  fireEvent.click(slotOf(view, 0, 1)); chip(view, 'Am')               // Chiều [Am](-) một
  tap(view, 'Đổi hợp âm Am trên chữ (-) (dòng 1, vị trí 2)')
  tap(view, 'Xóa vị trí nghỉ (và hợp âm Am)')
  assert.equal(lyricsOf(view), 'Chiều một', 'không có vạch kề → xoá ngay, kèm hợp âm đã nói rõ ở nút')
  fireEvent.click(slotOf(view, 0, 1)); chip(view, 'Am')
  fireEvent.click(slotOf(view, 0, 1)); tap(view, '｜ Đặt vạch nhịp tại đây')   // vạch trước (-)
  fireEvent.click(slotOf(view, 0, 2)); tap(view, '｜ Đặt vạch nhịp tại đây')   // vạch sau (-): (-) là cả ô
  tap(view, 'Đổi hợp âm Am trên chữ (-) (dòng 1, vị trí 2)')
  tap(view, 'Xóa vị trí nghỉ (và hợp âm Am)')
  assert.match(view.getByRole('alert').textContent ?? '', /cả ô nhịp 2.*ô ngân/s, 'hỏi trước, không âm thầm đổi')
  assert.equal(lyricsOf(view), 'Chiều [Am](-) một', 'chưa xoá')
  tap(view, 'Vẫn xóa')
  assert.equal(lyricsOf(view), 'Chiều một')
})

test('Lưu: lời → "Lưu"; vạch chưa lưu → nút đổi thành "Lưu vạch nhịp"; hai bước đều CHỦ ĐỘNG, không phiên bản trung gian; tải lại đúng', async () => {
  const view = await openNewWithText('[Am]Chiều một mình qua phố')
  type(view.getByLabelText(/Tên bài/), 'Bài bản nhạc duy nhất')
  fireEvent.change(view.getByLabelText(/Nhịp/), { target: { value: '4/4' } })
  tap(view, 'Lưu'); await settle(60)
  let v = await savedVersion(view, 'ban nhac duy nhat')
  assert.equal(v.versionNumber, 1)
  // thêm hợp âm không lời + 2 vạch → lời đổi → "Lưu"
  fireEvent.click(slotOf(view, 0, 2)); chip(view, 'E7')
  fireEvent.click(slotOf(view, 0, 0)); tap(view, '｜ Đặt vạch nhịp tại đây')
  fireEvent.click(slotOf(view, 0, 4)); tap(view, '｜ Đặt vạch nhịp tại đây')   // token 4 = "qua" sau khi chèn (-)
  assert.ok(view.getByRole('button', { name: 'Lưu' }))
  tap(view, 'Lưu'); await settle(60)
  v = await savedVersion(view, 'ban nhac duy nhat')
  assert.equal(v.versionNumber, 2, 'đúng MỘT phiên bản mới cho phần lời')
  assert.equal(v.anchors, null, 'bản lưu lời chưa có vạch (giới hạn M3) — nói rõ')
  assert.match(view.getByRole('status').textContent ?? '', /Vạch nhịp CHƯA được lưu theo bản này/)
  assert.deepEqual(barNums(view), ['¹', '²'], 'vạch vẫn hiện trên bản nhạc, không bị mất')
  const saveBars = view.getByRole('button', { name: 'Lưu vạch nhịp' })
  assert.ok(saveBars)
  fireEvent.click(saveBars); await settle(60)
  v = await savedVersion(view, 'ban nhac duy nhat')
  assert.equal(v.versionNumber, 3)
  assert.deepEqual(v.anchors?.measures, [{ line: 0, token: 0 }, { line: 0, token: 4 }])
  assert.equal(v.text, '[Am]Chiều một [E7](-) mình qua phố', 'lời + hợp âm lưu nguyên văn')
  assert.equal(view.queryByRole('button', { name: 'Lưu vạch nhịp' }), null)
  assert.ok(view.getByRole('button', { name: 'Lưu' }))
  // Case 9 — timeline từ dữ liệu ĐÃ LƯU: E7 trên (-) có mặt đúng ô
  const tl = buildChordTimeline(v.text, v.anchors!, v.meter)
  assert.deepEqual(tl.events.map(e => [e.chord, e.line, e.token]), [['Am', 0, 0], ['E7', 0, 2]])
})

test('Bảo vệ chỉnh sửa chưa lưu: có thay đổi → beforeunload bị chặn; rời trong app thì hỏi', async () => {
  const view = await openNewWithText('Chiều một mình')
  const event = new dom.window.Event('beforeunload', { cancelable: true })
  dom.window.dispatchEvent(event)
  assert.equal(event.defaultPrevented, true, 'tải lại / đóng tab khi còn chỉnh sửa → trình duyệt hỏi')
  confirmAnswer = false
  tap(view, '← Danh sách')
  assert.ok(view.getByRole('button', { name: 'Lưu' }), 'chọn ở lại thì không mất gì')
  assert.equal(confirmAsked > 0, true)
})

test('Case 11 — chỉ có quyền xem: địa chỉ trình sửa rơi về trang xem chỉ-đọc; không có khe, không Lưu, không toolbar', async () => {
  const view = await openList()
  const [item] = await view.library.searchChordSheets('Bài thử 01')
  cleanup()
  goto(`?muc=hopam&hopam=${item.versionId}`)
  const ro = render(<ChordLibraryPage library={view.library} canEdit={false} />)
  await settle()
  assert.ok(ro.getByRole('heading', { name: 'Bài thử 01' }))
  assert.equal(ro.container.querySelector('.cl-slot, .cl-word, .cl-toolbar'), null)
  assert.equal(ro.queryByRole('button', { name: 'Lưu' }), null)
  assert.equal(ro.queryByRole('button', { name: 'Sửa bài này' }), null)
})

test('Case 12 — bài cũ không có (-): hiển thị như trước, vạch có sẵn hiện NGAY trên bản nhạc duy nhất; chưa chạm gì thì không có thay đổi', async () => {
  const view = await openList()
  tap(view, 'Sửa bài Bài thử 01'); await settle()
  assert.equal(barNums(view).length, 11)
  assert.doesNotMatch(lyricsOf(view), /\(-\)/)
  assert.equal(view.queryByRole('button', { name: 'Lưu vạch nhịp' }), null, 'chưa sửa vạch → không đòi lưu')
  assert.equal(view.container.querySelectorAll('.cl-edit-row').length, lyricsOf(view).split('\n').filter(Boolean).length, 'một hàng cho mỗi dòng lời')
})
