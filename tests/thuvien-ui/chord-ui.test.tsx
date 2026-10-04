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
const { default: ThuVienTabs } = await import('../../src/thuvien/ThuVienTabs')
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
  assert.ok(view.getByRole('button', { name: '+ Thêm bài' }))
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

test('+ Thêm bài mở editor; thiếu tên bài / lời thì không lưu và chỉ rõ ô sai', async () => {
  const view = await openList()
  fireEvent.click(view.getByRole('button', { name: '+ Thêm bài' }))
  await settle()
  assert.equal(dom.window.location.search, '?muc=hopam&hopam=moi')
  assert.ok(view.getByRole('heading', { name: 'Thêm bài' }))
  assert.equal(view.queryByTestId('tabs'), null, 'trong editor không có thanh chuyển mục')
  for (const label of ['Thông tin bài', 'Lời và hợp âm', 'Vạch nhịp', 'Nguồn sheet', 'Xem thử']) assert.ok(view.getByRole('region', { name: label }), label)
  assert.match(view.getByRole('region', { name: 'Vạch nhịp' }).textContent ?? '', /Chưa có dữ liệu vạch nhịp\./)
  assert.match(view.getByRole('region', { name: 'Nguồn sheet' }).textContent ?? '', /PDF\/ảnh sẽ được bổ sung ở bước tiếp theo\./)
  assert.equal(view.container.querySelector('input[type=file]'), null, 'chưa có tải file')
  assert.match(view.getByRole('region', { name: 'Lời và hợp âm' }).textContent ?? '', /\[Am\]/, 'có gợi ý định dạng')
  fireEvent.click(view.getByRole('button', { name: 'Lưu' }))
  await settle()
  assert.match(view.getByRole('alert').textContent ?? '', /Chưa lưu được/)
  assert.match(view.container.textContent ?? '', /Vui lòng nhập Tên bài\./)
  assert.match(view.container.textContent ?? '', /Vui lòng nhập lời \+ hợp âm\./)
  assert.equal((await view.library.searchChordSheets('')).length, 3, 'chưa có gì được lưu')
  type(view.getByLabelText(/BPM gợi ý/), '999')
  type(view.getByLabelText(/Tên bài/), 'Bài UI')
  type(view.getByLabelText('Ô soạn lời và hợp âm'), '[C] có lời')
  fireEvent.click(view.getByRole('button', { name: 'Lưu' }))
  await settle()
  assert.match(view.container.textContent ?? '', /BPM là số nguyên từ 20 đến 300\./)
  assert.equal((await view.library.searchChordSheets('')).length, 3)
})

test('xem thử: hợp âm nằm trên chữ; cảnh báo ngoặc hỏng', async () => {
  const view = await openList()
  fireEvent.click(view.getByRole('button', { name: '+ Thêm bài' }))
  await settle()
  const preview = view.getByRole('region', { name: 'Xem thử' })
  assert.match(preview.textContent ?? '', /Nhập lời \+ hợp âm để xem thử/)
  type(view.getByLabelText('Ô soạn lời và hợp âm'), 'Chiều [Am] nao, tiễn nhau [E7] đi\nĐK: chỉ lời\nlỡ [G quên')
  const segments = [...preview.querySelectorAll('.cl-line')[0].querySelectorAll('.cl-seg')].map(node => [node.querySelector('.cl-chord')?.textContent, node.querySelector('.cl-lyric')?.textContent])
  assert.deepEqual(segments, [['\u00a0', 'Chiều '], ['Am', 'nao, tiễn nhau '], ['E7', 'đi']])
  assert.equal(preview.querySelectorAll('.cl-line')[1].getAttribute('data-chords'), 'false')
  assert.match(preview.querySelector('.cl-chordset')?.textContent ?? '', /AmE7$/)
  assert.match(view.getByRole('region', { name: 'Lời và hợp âm' }).textContent ?? '', /Dòng 3: còn ngoặc vuông/)
})

test('lưu mock → BẢN NHÁP, báo rõ chưa lưu production → duyệt → quay lại danh sách → mở lại đúng nội dung (kể cả sau khi tải lại trang)', async () => {
  const storage = memoryStorage()
  const view = await openList(createMockChordLibrary({ storage }))
  fireEvent.click(view.getByRole('button', { name: '+ Thêm bài' }))
  await settle()
  assert.equal(view.queryByRole('group', { name: 'Trạng thái phiên bản' }), null, 'bài chưa lưu thì chưa có trạng thái phiên bản')
  type(view.getByLabelText(/Tên bài/), 'Khúc Hát Thử')
  type(view.getByLabelText(/Tác giả/), 'Thầy')
  fireEvent.change(view.getByLabelText(/Nhịp/), { target: { value: '6/8' } })
  type(view.getByLabelText(/BPM gợi ý/), '72')
  type(view.getByLabelText('Ô soạn lời và hợp âm'), '[C] Một dòng  \n[G] Hai dòng\n')
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
  fireEvent.click(view.getByRole('button', { name: 'Mở bài Khúc Hát Thử' }))
  await settle()
  assert.equal((view.getByLabelText(/Tên bài/) as HTMLInputElement).value, 'Khúc Hát Thử')
  assert.equal((view.getByLabelText(/Tác giả/) as HTMLInputElement).value, 'Thầy')
  assert.equal((view.getByLabelText(/Nhịp/) as HTMLSelectElement).value, '6/8')
  assert.equal((view.getByLabelText(/BPM gợi ý/) as HTMLInputElement).value, '72')
  assert.equal((view.getByLabelText('Ô soạn lời và hợp âm') as HTMLTextAreaElement).value, '[C] Một dòng\n[G] Hai dòng')

  // Tải lại trang: thư viện mới đọc cùng storage, mở thẳng bằng địa chỉ.
  cleanup()
  goto(`?muc=hopam&hopam=${saved.versionId}`)
  const again = render(<ChordLibraryPage library={createMockChordLibrary({ storage })} />)
  await settle()
  assert.equal((again.getByLabelText('Ô soạn lời và hợp âm') as HTMLTextAreaElement).value, '[C] Một dòng\n[G] Hai dòng')
  assert.ok(storage.data.has(MOCK_STORAGE_KEY))
  assert.equal(network, 0, 'chế độ thử không gọi mạng')
})

test('sửa bài đang dùng: lưu → bản nháp v2, bản đang dùng chưa đổi; danh sách ghi "Có bản nháp"; mở bản nháp → duyệt', async () => {
  const view = await openList()
  fireEvent.click(view.getByRole('button', { name: 'Mở bài Bài thử 01' }))
  await settle()
  assert.match(view.getByRole('group', { name: 'Trạng thái phiên bản' }).textContent ?? '', /Bản đang dùng · phiên bản 1/)
  assert.match(view.getByRole('region', { name: 'Vạch nhịp' }).textContent ?? '', /✓ Đã có/)
  const text = view.getByLabelText('Ô soạn lời và hợp âm') as HTMLTextAreaElement
  type(text, text.value + '\n[C] Thêm một dòng')
  assert.match(view.container.textContent ?? '', /Lưu lời mới thì vạch nhịp phải làm lại/)
  assert.match(view.getByRole('region', { name: 'Vạch nhịp' }).textContent ?? '', /— Chưa có/)
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
  fireEvent.click(view.getByRole('button', { name: 'Mở bài Bài thử 01 (đã sửa)' }))
  await settle()
  const state = view.getByRole('group', { name: 'Trạng thái phiên bản' })
  assert.match(state.textContent ?? '', /Bản đang dùng · phiên bản 1\. Bài này có bản nháp mới hơn chưa duyệt\./, 'mở từ danh sách = mở bản đang dùng')
  assert.doesNotMatch((view.getByLabelText('Ô soạn lời và hợp âm') as HTMLTextAreaElement).value, /Thêm một dòng/)
  fireEvent.click(view.getByRole('button', { name: 'Mở bản nháp' }))
  await settle()
  assert.equal(dom.window.location.search, `?muc=hopam&hopam=${item.draftVersionId}`)
  assert.match((view.getByLabelText('Ô soạn lời và hợp âm') as HTMLTextAreaElement).value, /Thêm một dòng$/)
  fireEvent.click(view.getByRole('button', { name: 'Duyệt bản này' }))
  await settle()
  const detail = await view.library.getChordSheet(item.draftVersionId!)
  assert.deepEqual([detail.status, detail.versionNumber, detail.hasAnchors], ['current', 2, false])
  assert.equal((await view.library.getChordSheet(item.versionId)).status, 'old', 'bản cũ vẫn còn, thành "bản cũ"')
})

test('chỉ đổi Nhịp → phiên bản mới; chỉ đổi BPM → phiên bản mới; chỉ đổi tên → KHÔNG tạo phiên bản; còn thay đổi dở thì chưa duyệt được', async () => {
  const view = await openList()
  fireEvent.click(view.getByRole('button', { name: 'Mở bài Tình khúc mẫu' }))
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
  fireEvent.click(view.getByRole('button', { name: 'Mở bài Đêm Thử Nghiệm' }))
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
  fireEvent.click(view.getByRole('button', { name: '+ Thêm bài' }))
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
  fireEvent.click(view.getByRole('button', { name: 'Mở bài Tình khúc mẫu' }))
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

  fireEvent.click(view.getByRole('button', { name: '+ Thêm bài' }))
  await settle()
  assert.equal(view.queryByRole('note'), null)
  type(view.getByLabelText(/Tên bài/), 'Bài thử RPC')
  type(view.getByLabelText('Ô soạn lời và hợp âm'), '[C] lời một')
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
  type(view.getByLabelText('Ô soạn lời và hợp âm'), '[C] lời một\n[G] lời hai')
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
  type(view.getByLabelText('Ô soạn lời và hợp âm'), '[C] gốc\n[G] thêm')
  server.fail('chord_sheet_contribute')
  server.calls.length = 0
  fireEvent.click(view.getByRole('button', { name: 'Lưu' }))
  await settle()
  assert.match(view.getByRole('alert').textContent ?? '', /máy chủ từ chối \(thử nghiệm\)/)
  assert.equal(view.queryByRole('status'), null, 'không có thông báo thành công')
  assert.equal((view.getByLabelText('Ô soạn lời và hợp âm') as HTMLTextAreaElement).value, '[C] gốc\n[G] thêm', 'chữ đang gõ còn nguyên')
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

test('thanh chuyển mục: hai mục, mục hiện tại được đánh dấu, bấm mục kia thì báo đổi', async () => {
  const changes: string[] = []
  const view = render(<ThuVienTabs section="musicxml" onChange={next => changes.push(next)} />)
  const tabs = view.getAllByRole('button')
  assert.deepEqual(tabs.map(tab => tab.textContent), ['Bản nhạc / MusicXML', 'Hợp âm chuẩn hóa'])
  assert.equal(tabs[0].getAttribute('aria-current'), 'page')
  assert.equal(tabs[1].getAttribute('aria-current'), null)
  fireEvent.click(tabs[0])
  fireEvent.click(tabs[1])
  assert.deepEqual(changes, ['chords'])
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
  assert.match(page, /<main className="thu-vien[^"]*">\s*\{tabs\}\s*<div className="mx-auto max-w-4xl">/)
  assert.match(page, /return <MusicXmlLibrary tabs=\{tabs\} \/>/)
  const css = readFileSync(new URL('../../src/thuvien/ChordLibrary.css', import.meta.url), 'utf8')
  assert.equal(css.replace(/\/\*[\s\S]*?\*\//g, '').match(/\.thu-vien/g), null, 'CSS mới không có luật nào nhắm vào .thu-vien của mục MusicXML')
  const master = readFileSync(new URL('../../src/thuvien/masterLibrary.ts', import.meta.url), 'utf8')
  assert.ok(!master.includes('chord'), 'masterLibrary không biết gì về hợp âm')
})
