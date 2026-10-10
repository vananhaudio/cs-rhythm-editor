// Hợp âm chuẩn hóa — phần thuần: parser [Hợp âm], chuẩn hoá, validate, địa chỉ mục, adapter mock + rpc.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canonicalChordText, chordTextIssues, formatMeter, listChords, parseBpm, parseChordLine, parseChordText, parseMeter, validateChordDraft } from '../../src/thuvien/chordText.ts'
import type { ChordDraft } from '../../src/thuvien/chordText.ts'
import { DISABLED_MESSAGE, MOCK_STORAGE_KEY, chooseChordBackend, createDisabledChordLibrary, createMockChordLibrary, createRpcChordLibrary } from '../../src/thuvien/chordLibrary.ts'
import type { RpcCall } from '../../src/thuvien/chordLibrary.ts'
import { chordSheetFromSearch, sectionFromSearch, sectionUrl } from '../../src/thuvien/sections.ts'

const draft = (patch: Partial<ChordDraft> = {}): ChordDraft => ({ title: 'Bài kiểm thử', composer: '', meter: null, suggestedBpm: null, text: '[C] la la', ...patch })

test('parser: hợp âm đứng trên chữ ngay sau nó', () => {
  assert.deepEqual(parseChordLine('Chiều [Am] nao, tiễn nhau [E7] đi'), [
    { chord: null, text: 'Chiều ' }, { chord: 'Am', text: 'nao, tiễn nhau ' }, { chord: 'E7', text: 'đi' },
  ])
  assert.deepEqual(parseChordLine('[C] Đầu dòng'), [{ chord: 'C', text: 'Đầu dòng' }])
  assert.deepEqual(parseChordLine('ti[Am]ễn'), [{ chord: null, text: 'ti' }, { chord: 'Am', text: 'ễn' }], 'hợp âm giữa chữ: không nuốt ký tự')
  assert.deepEqual(parseChordLine('[Am][E7] hết'), [{ chord: 'Am', text: '' }, { chord: 'E7', text: 'hết' }])
  assert.deepEqual(parseChordLine('hết câu [G]'), [{ chord: null, text: 'hết câu ' }, { chord: 'G', text: '' }])
  assert.deepEqual(parseChordLine('[F#m7b5] và [C/G]').map(segment => segment.chord), ['F#m7b5', 'C/G'])
})

test('parser: dòng không hợp âm, nhãn, ngoặc hỏng đi qua như lời', () => {
  assert.deepEqual(parseChordLine('ĐK: chỉ có lời'), [{ chord: null, text: 'ĐK: chỉ có lời' }])
  assert.deepEqual(parseChordLine(''), [])
  assert.deepEqual(parseChordLine('lỡ [Am quên đóng'), [{ chord: null, text: 'lỡ [Am quên đóng' }])
  assert.deepEqual(parseChordLine('ngoặc [] rỗng'), [{ chord: null, text: 'ngoặc [] rỗng' }])
  assert.deepEqual(parseChordText('1. [C] một\n\nĐK: [G] hai').map(line => line.length), [2, 0, 2])
  assert.equal(parseChordText('1. [C] một')[0][0].text, '1. ', 'nhãn "1." nằm trong lời, không bị coi là hợp âm')
})

test('parser: gọi lặp lại cho cùng kết quả (regex toàn cục không giữ trạng thái)', () => {
  const line = 'a [C] b [G] c'
  assert.deepEqual(parseChordLine(line), parseChordLine(line))
})

test('listChords + chordTextIssues', () => {
  assert.deepEqual(listChords('[C] a [Am] b\n[C] c [G] d'), ['C', 'Am', 'G'])
  assert.deepEqual(chordTextIssues('[C] ổn\nlỡ [Am quên\nổn [G]\ndư ] ngoặc'), [2, 4])
  assert.deepEqual(chordTextIssues('[C] ổn'), [])
})

test('canonicalChordText khớp phép chuẩn hoá của máy chủ', () => {
  assert.equal(canonicalChordText('\n\n1. Chiều [Am] nao   \r\nKhi bóng\t\r\nĐK: hết  \n\n'), '1. Chiều [Am] nao\nKhi bóng\nĐK: hết')
  assert.equal(canonicalChordText('a\rb'), 'a\nb')
  assert.equal(canonicalChordText('Diễm'.normalize('NFD')), 'Diễm'.normalize('NFC'))
  assert.equal(canonicalChordText('  \n \u00a0 '), '')
})

test('nhịp + BPM', () => {
  assert.deepEqual(parseMeter('4/4'), { beats: 4, beatType: 4 })
  assert.deepEqual(parseMeter(' 6/8 '), { beats: 6, beatType: 8 })
  assert.equal(parseMeter(''), null)
  assert.equal(parseMeter('4/3'), null)
  assert.equal(parseMeter('0/4'), null)
  assert.equal(formatMeter({ beats: 12, beatType: 8 }), '12/8')
  assert.equal(formatMeter(null), '')
  assert.equal(parseBpm(''), null)
  assert.equal(parseBpm(' 66 '), 66)
  assert.ok(Number.isNaN(parseBpm('nhanh')))
  assert.ok(Number.isNaN(parseBpm('66.5')))
})

test('validate: tên bài + lời bắt buộc; BPM trong khoảng', () => {
  assert.deepEqual(validateChordDraft(draft()), {})
  assert.equal(validateChordDraft(draft({ title: '   ' })).title, 'Vui lòng nhập Tên bài.')
  assert.equal(validateChordDraft(draft({ text: ' \n ' })).text, 'Vui lòng nhập lời + hợp âm.')
  assert.ok(validateChordDraft(draft({ title: 'x'.repeat(201) })).title)
  assert.ok(validateChordDraft(draft({ text: 'x'.repeat(20001) })).text)
  assert.ok(validateChordDraft(draft({ suggestedBpm: 19 })).suggestedBpm)
  assert.ok(validateChordDraft(draft({ suggestedBpm: 301 })).suggestedBpm)
  assert.ok(validateChordDraft(draft({ suggestedBpm: Number.NaN })).suggestedBpm)
  assert.deepEqual(validateChordDraft(draft({ suggestedBpm: 20, meter: { beats: 6, beatType: 8 } })), {})
  assert.ok(validateChordDraft(draft({ meter: { beats: 4, beatType: 3 } })).meter)
})

test('địa chỉ mục: MusicXML là mặc định; đổi mục thì bỏ tham số của mục kia', () => {
  assert.equal(sectionFromSearch(''), 'musicxml')
  assert.equal(sectionFromSearch('?bai=abc'), 'musicxml')
  assert.equal(sectionFromSearch('?muc=hopam'), 'chords')
  assert.equal(sectionFromSearch('?muc=khac'), 'musicxml')
  assert.equal(chordSheetFromSearch('?muc=hopam'), null)
  assert.equal(chordSheetFromSearch('?muc=hopam&hopam=moi'), 'moi')
  assert.equal(chordSheetFromSearch('?hopam=v1'), null, 'không ở mục hợp âm thì bỏ qua')
  assert.equal(sectionUrl('https://x.test/thuvien?bai=abc', 'chords'), '/thuvien?muc=hopam')
  assert.equal(sectionUrl('https://x.test/thuvien?muc=hopam&hopam=v1', 'musicxml'), '/thuvien')
  assert.equal(sectionUrl('https://x.test/thuvien?muc=hopam', 'chords', 'v1'), '/thuvien?muc=hopam&hopam=v1')
  assert.equal(sectionUrl('https://x.test/thuvien?muc=hopam&hopam=v1', 'chords'), '/thuvien?muc=hopam')
})

function memoryStorage() {
  const data = new Map<string, string>()
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) }, removeItem: (key: string) => { data.delete(key) } }
}

test('chọn backend: rpc khi bật tường minh; mock CHỈ ở dev; production chưa bật → disabled (không bao giờ rơi về mock)', () => {
  assert.equal(chooseChordBackend({ prod: false, setting: undefined }), 'mock')
  assert.equal(chooseChordBackend({ prod: false, setting: 'rpc' }), 'rpc')
  assert.equal(chooseChordBackend({ prod: true, setting: 'rpc' }), 'rpc')
  assert.equal(chooseChordBackend({ prod: true, setting: undefined }), 'disabled')
  assert.equal(chooseChordBackend({ prod: true, setting: 'mock' }), 'disabled', 'production không nhận mock kể cả khi cấu hình nhầm')
  assert.equal(chooseChordBackend({ prod: true, setting: '' }), 'disabled')
})

test('disabled: mọi thao tác đều từ chối với thông báo rõ, không lưu gì', async () => {
  const library = createDisabledChordLibrary()
  assert.equal(library.mode, 'disabled')
  await assert.rejects(library.searchChordSheets(''), new RegExp(DISABLED_MESSAGE.slice(0, 30)))
  await assert.rejects(library.createChordSheet(draft()), /chưa được bật/)
  await assert.rejects(library.approveChordSheetVersion('v'), /chưa được bật/)
})

test('mock: tìm không dấu / không phân biệt hoa thường, theo tên bài hoặc tác giả', async () => {
  const library = createMockChordLibrary()
  assert.equal(library.mode, 'mock')
  assert.equal((await library.searchChordSheets('')).length, 3)
  assert.deepEqual((await library.searchChordSheets('dem thu nghiem')).map(item => item.title), ['Đêm Thử Nghiệm'])
  assert.deepEqual((await library.searchChordSheets('ĐÊM  THỬ')).map(item => item.title), ['Đêm Thử Nghiệm'])
  assert.equal((await library.searchChordSheets('du lieu mau')).length, 2, 'tìm theo tác giả')
  assert.deepEqual(await library.searchChordSheets('không có bài này'), [])
})

test('mock: trạng thái vạch nhịp + trạng thái duyệt của bộ mẫu', async () => {
  const items = await createMockChordLibrary().searchChordSheets('')
  assert.equal(items.find(item => item.title === 'Bài thử 01')?.hasAnchors, true)
  assert.equal(items.find(item => item.title === 'Tình khúc mẫu')?.hasAnchors, false)
  assert.ok(items.every(item => item.status === 'current' && item.draftVersionId === null))
})

test('mock: thêm bài → BẢN NHÁP (chưa phải bản đang dùng) → duyệt → bản đang dùng; mở lại được; không đụng mạng', async () => {
  const storage = memoryStorage()
  const fetchBefore = globalThis.fetch
  let network = 0
  globalThis.fetch = (() => { network += 1; throw new Error('mock không được gọi mạng') }) as typeof fetch
  try {
    const library = createMockChordLibrary({ storage })
    const created = await library.createChordSheet(draft({ title: '  Bài Mới  ', composer: ' Tôi ', meter: { beats: 4, beatType: 4 }, suggestedBpm: 72, text: '[C] một  \r\n[G] hai\n\n' }))
    assert.equal(created.title, 'Bài Mới')
    assert.equal(created.composer, 'Tôi')
    assert.equal(created.text, '[C] một\n[G] hai', 'lời được chuẩn hoá như máy chủ')
    assert.deepEqual([created.versionNumber, created.status, created.draftVersionId, created.hasAnchors, created.hasSource], [1, 'draft', null, false, false])
    assert.deepEqual(await library.getChordSheet(created.versionId), created)
    const [listed] = await library.searchChordSheets('bai moi')
    assert.deepEqual([listed.versionId, listed.status], [created.versionId, 'draft'], 'bài chưa duyệt vẫn hiện trong danh sách của thầy, ghi rõ là nháp')
    const approved = await library.approveChordSheetVersion(created.versionId)
    assert.equal(approved.status, 'current')
    // "Mở lại" sau khi tải lại trang: một thư viện MỚI đọc từ cùng storage.
    const reopened = createMockChordLibrary({ storage })
    assert.deepEqual(await reopened.getChordSheet(created.versionId), approved)
    assert.ok(storage.data.has(MOCK_STORAGE_KEY))
    assert.equal(network, 0)
  } finally { globalThis.fetch = fetchBefore }
})

test('mock: sửa nội dung = bản nháp MỚI; bản đang dùng không đổi cho tới khi duyệt; phiên bản cũ bất biến', async () => {
  const library = createMockChordLibrary()
  const [first] = (await library.searchChordSheets('bai thu 01'))
  const before = await library.getChordSheet(first.versionId)
  const next = await library.createChordSheetVersion(first.sheetId, { text: before.text + '\n[C] thêm một dòng', meter: before.meter, suggestedBpm: 90 }, before.versionId)
  assert.deepEqual([next.versionNumber, next.status, next.suggestedBpm, next.hasAnchors], [2, 'draft', 90, false], 'đổi lời → vạch nhịp cũ hết hiệu lực')
  assert.notEqual(next.versionId, before.versionId)
  const stillCurrent = await library.getChordSheet(before.versionId)
  assert.deepEqual({ ...stillCurrent, draftVersionId: null }, before, 'phiên bản cũ bất biến, vẫn là bản đang dùng')
  assert.equal(stillCurrent.draftVersionId, next.versionId, 'bản đang dùng báo có bản nháp mới hơn')
  const [listed] = await library.searchChordSheets('bai thu 01')
  assert.deepEqual([listed.versionId, listed.status, listed.draftVersionId], [before.versionId, 'current', next.versionId], 'danh sách vẫn mở bản đang dùng, kèm dấu có bản nháp')
  const approved = await library.approveChordSheetVersion(next.versionId)
  assert.equal(approved.status, 'current')
  assert.equal((await library.getChordSheet(before.versionId)).status, 'old')
  assert.equal((await library.searchChordSheets('bai thu 01'))[0].versionId, next.versionId)
})

test('mock: chỉ đổi nhịp / chỉ đổi BPM cũng là phiên bản mới (client gửi kèm vạch đang hiện → vạch đi cùng, một lần lưu); nội dung y hệt thì KHÔNG tạo phiên bản rác', async () => {
  const library = createMockChordLibrary()
  const [first] = (await library.searchChordSheets('bai thu 01'))
  const before = await library.getChordSheet(first.versionId)
  const same = await library.createChordSheetVersion(first.sheetId, { text: before.text + '  \n', meter: { beats: 4, beatType: 4 }, suggestedBpm: 80 }, before.versionId, { anchors: before.anchors })
  assert.equal(same.versionId, before.versionId, 'y hệt bản đang dùng → trả chính nó')
  const meterOnly = await library.createChordSheetVersion(first.sheetId, { text: before.text, meter: { beats: 2, beatType: 4 }, suggestedBpm: 80 }, before.versionId, { anchors: before.anchors })
  assert.deepEqual([meterOnly.versionNumber, meterOnly.hasAnchors, meterOnly.status], [2, true, 'draft'])
  const bpmOnly = await library.createChordSheetVersion(first.sheetId, { text: before.text, meter: { beats: 4, beatType: 4 }, suggestedBpm: 100 }, before.versionId, { anchors: before.anchors })
  assert.equal(bpmOnly.versionNumber, 3)
  const bpmNull = await library.createChordSheetVersion(first.sheetId, { text: before.text, meter: { beats: 4, beatType: 4 }, suggestedBpm: null }, before.versionId, { anchors: before.anchors })
  assert.equal(bpmNull.versionNumber, 4)
  const again = await library.createChordSheetVersion(first.sheetId, { text: before.text, meter: { beats: 4, beatType: 4 }, suggestedBpm: 100 }, before.versionId, { anchors: before.anchors })
  assert.equal(again.versionId, bpmOnly.versionId, 'y hệt một bản nháp đang chờ → trả bản nháp đó')
})

test('mock: bỏ bản nháp → không còn là bản chờ; bản đã duyệt thì không bỏ được', async () => {
  const library = createMockChordLibrary()
  const [first] = (await library.searchChordSheets('tinh khuc mau'))
  const next = await library.createChordSheetVersion(first.sheetId, { text: '[C] khác hẳn', meter: null, suggestedBpm: null }, first.versionId)
  await library.discardChordSheetVersion(next.versionId)
  assert.equal((await library.getChordSheet(next.versionId)).status, 'discarded')
  assert.equal((await library.searchChordSheets('tinh khuc mau'))[0].draftVersionId, null)
  await assert.rejects(library.discardChordSheetVersion(first.versionId), /Bản đã duyệt không bỏ được/)
  const lonely = await library.createChordSheet(draft({ title: 'Bài bỏ ngay' }))
  await library.discardChordSheetVersion(lonely.versionId)
  assert.deepEqual(await library.searchChordSheets('bai bo ngay'), [], 'bài chỉ có bản nháp đã bỏ → không hiện trong danh sách')
})

test('mock: đổi tên bài/tác giả; validate chặn dữ liệu sai; reset về bộ mẫu', async () => {
  const storage = memoryStorage()
  const library = createMockChordLibrary({ storage })
  const [first] = await library.searchChordSheets('tinh khuc mau')
  await library.updateChordSheetInfo(first.sheetId, { title: 'Tình khúc đã đổi tên', composer: '' })
  const renamed = await library.getChordSheet(first.versionId)
  assert.deepEqual([renamed.title, renamed.composer, renamed.versionNumber, renamed.status], ['Tình khúc đã đổi tên', null, 1, 'current'], 'đổi tên không tạo phiên bản')
  await assert.rejects(library.updateChordSheetInfo(first.sheetId, { title: ' ', composer: '' }), /Tên bài/)
  await assert.rejects(library.createChordSheet(draft({ title: '' })), /Tên bài/)
  await assert.rejects(library.createChordSheet(draft({ text: '  ' })), /lời \+ hợp âm/)
  await assert.rejects(library.createChordSheetVersion('khong-co', { text: 'x', meter: null, suggestedBpm: null }, 'v'), /Không tìm thấy/)
  await assert.rejects(library.getChordSheet('khong-co'), /Không tìm thấy/)
  library.resetMock?.()
  assert.deepEqual((await library.searchChordSheets('')).map(item => item.title).sort(), ['Bài thử 01', 'Tình khúc mẫu', 'Đêm Thử Nghiệm'].sort())
  assert.equal(storage.data.has(MOCK_STORAGE_KEY), false)
})

test('mock: storage hỏng hoặc không có → vẫn chạy với bộ mẫu', async () => {
  const broken = memoryStorage()
  broken.data.set(MOCK_STORAGE_KEY, '{không phải json')
  assert.equal((await createMockChordLibrary({ storage: broken }).searchChordSheets('')).length, 3)
  assert.equal((await createMockChordLibrary({ storage: null }).searchChordSheets('')).length, 3)
})

test('mock: dữ liệu mẫu là lời tự đặt, không phải bài hát thật', async () => {
  const all = await createMockChordLibrary().searchChordSheets('')
  assert.ok(all.every(item => /thử|mẫu/i.test(item.title)))
})

// ── Adapter RPC: kiểm đúng tên hàm + tham số của db/chord_library_v1_setup.sql bằng một máy chủ giả.
//    (Chạy với Postgres thật: tests/thuvien-db/e2e.test.ts qua scripts/test-chord-library-db.sh.)
function fakeRpc(replies: Record<string, (args: Record<string, unknown>) => unknown>) {
  const calls: { fn: string; args: Record<string, unknown> }[] = []
  const rpc: RpcCall = async (fn, args) => {
    calls.push({ fn, args })
    try { return { data: replies[fn](args), error: null } }
    catch (cause) { return { data: null, error: { message: (cause as Error).message } } }
  }
  return { rpc, calls }
}
const row = (patch: Record<string, unknown> = {}) => ({
  sheet_id: 's1', version_id: 'v1', title: 'Bài', composer: null, version_number: 1, is_canonical: true, review_status: 'approved',
  anchors_status: 'none', created_at: '2026-10-04T00:00:00Z', text: '[C] la', meter: null, suggested_bpm: null, sources: [], draft_version_id: null, ...patch,
})

test('rpc: tìm → gộp theo BÀI: bản đang dùng làm đại diện, kèm bản nháp mới hơn; bỏ qua bản đã bỏ', async () => {
  const { rpc, calls } = fakeRpc({
    chord_sheet_search: () => [
      row({ sheet_id: 's1', version_id: 'v3', version_number: 3, is_canonical: false, review_status: 'private' }),
      row({ sheet_id: 's1', version_id: 'v2', version_number: 2, is_canonical: true, anchors_status: 'ready' }),
      row({ sheet_id: 's1', version_id: 'v1', version_number: 1, is_canonical: false, review_status: 'private' }),
      row({ sheet_id: 's2', version_id: 'v9', version_number: 2, is_canonical: false, review_status: 'private', title: 'Bài chờ', anchors_status: 'processing' }),
      row({ sheet_id: 's2', version_id: 'v8', version_number: 1, is_canonical: false, review_status: 'private', title: 'Bài chờ' }),
      row({ sheet_id: 's3', version_id: 'v7', is_canonical: false, review_status: 'rejected', title: 'Bài đã bỏ' }),
    ],
  })
  const library = createRpcChordLibrary(rpc)
  assert.equal(library.mode, 'rpc')
  assert.equal(library.resetMock, undefined)
  const items = await library.searchChordSheets('con duong')
  assert.deepEqual(calls, [{ fn: 'chord_sheet_search', args: { p_query: 'con duong', p_limit: 50 } }])
  assert.deepEqual(items.map(item => [item.sheetId, item.versionId, item.status, item.draftVersionId, item.hasAnchors]),
    [['s1', 'v2', 'current', 'v3', true], ['s2', 'v9', 'draft', null, false]])
})

test('rpc: thêm bài = contribute rồi đọc lại — KHÔNG tự duyệt', async () => {
  const { rpc, calls } = fakeRpc({
    chord_sheet_contribute: () => ({ ok: true, duplicate: false, sheet_id: 's1', version_id: 'v1' }),
    chord_sheet_get: () => row({ is_canonical: false, review_status: 'private', meter: { beats: 3, beatType: 4 }, suggested_bpm: 96,
      sources: [{ path: `${'a'.repeat(8)}-0000-4000-8000-${'a'.repeat(12)}/${'b'.repeat(8)}-0000-4000-8000-${'b'.repeat(12)}/0.png`, mime: 'image/png', sha256: 'c'.repeat(64), size_bytes: 70, page: 1 }, { path: 'rác' }] }),
  })
  const detail = await createRpcChordLibrary(rpc).createChordSheet(draft({ title: ' Bài ', composer: ' ', meter: { beats: 3, beatType: 4 }, suggestedBpm: 96 }))
  assert.deepEqual(calls.map(call => call.fn), ['chord_sheet_contribute', 'chord_sheet_get'])
  assert.deepEqual(calls[0].args, { p_text: '[C] la la', p_title: 'Bài', p_composer: null, p_meter: { beats: 3, beatType: 4 }, p_suggested_bpm: 96 })
  assert.deepEqual([detail.status, detail.meter, detail.suggestedBpm, detail.hasSource], ['draft', { beats: 3, beatType: 4 }, 96, true])
})

test('rpc: sửa = phiên bản mới của đúng bài, cha = bản đang sửa; duyệt và bỏ nháp là lời gọi riêng', async () => {
  const { rpc, calls } = fakeRpc({
    chord_sheet_contribute: () => ({ ok: true, duplicate: false, sheet_id: 's1', version_id: 'v2' }),
    chord_sheet_approve: () => ({ ok: true }),
    chord_sheet_reject: () => ({ ok: true }),
    chord_sheet_update_info: () => ({ ok: true }),
    chord_sheet_get: args => row({ version_id: args.p_version_id, version_number: 2, is_canonical: calls.some(call => call.fn === 'chord_sheet_approve'), review_status: 'private', draft_version_id: 'v5' }),
  })
  const library = createRpcChordLibrary(rpc)
  const detail = await library.createChordSheetVersion('s1', { text: '[G] mới', meter: null, suggestedBpm: 88 }, 'v1')
  assert.deepEqual(calls[0], { fn: 'chord_sheet_contribute', args: { p_text: '[G] mới', p_sheet_id: 's1', p_parent_version_id: 'v1', p_meter: null, p_suggested_bpm: 88 } })
  assert.deepEqual([detail.versionId, detail.versionNumber, detail.status, detail.draftVersionId], ['v2', 2, 'draft', 'v5'])
  assert.deepEqual(calls.map(call => call.fn), ['chord_sheet_contribute', 'chord_sheet_get'], 'lưu không gọi approve')
  const approved = await library.approveChordSheetVersion('v2')
  assert.deepEqual(calls.slice(2).map(call => [call.fn, call.args]), [['chord_sheet_approve', { p_version_id: 'v2' }], ['chord_sheet_get', { p_version_id: 'v2' }]])
  assert.equal(approved.status, 'current')
  await library.discardChordSheetVersion('v5')
  assert.deepEqual(calls.at(-1), { fn: 'chord_sheet_reject', args: { p_version_id: 'v5', p_reason: 'Bỏ bản nháp (bàn biên tập).' } })
  await library.updateChordSheetInfo('s1', { title: '  Tên mới ', composer: '  ' })
  assert.deepEqual(calls.at(-1), { fn: 'chord_sheet_update_info', args: { p_sheet_id: 's1', p_title: 'Tên mới', p_composer: null } })
})

test('rpc: máy chủ báo trùng → trả đúng bản đã có, không tạo gì thêm', async () => {
  const { rpc, calls } = fakeRpc({
    chord_sheet_contribute: () => ({ ok: true, duplicate: true, sheet_id: 's1', version_id: 'v1' }),
    chord_sheet_get: () => row(),
  })
  const detail = await createRpcChordLibrary(rpc).createChordSheetVersion('s1', { text: '[C] la', meter: null, suggestedBpm: null }, 'v1')
  assert.deepEqual([detail.versionId, detail.status], ['v1', 'current'])
  assert.deepEqual(calls.map(call => call.fn), ['chord_sheet_contribute', 'chord_sheet_get'])
})

test('rpc: lỗi máy chủ thành câu đọc được; lỗi mạng không bị nuốt', async () => {
  const library = (message: string) => createRpcChordLibrary(fakeRpc({ chord_sheet_get: () => { throw new Error(message) } }).rpc)
  await assert.rejects(library('CHORDLIB_FORBIDDEN').getChordSheet('v'), /không có quyền/)
  await assert.rejects(library('CHORDLIB_NOT_FOUND').getChordSheet('v'), /Không tìm thấy/)
  await assert.rejects(library('CHORDLIB_INVALID: thiếu lời + hợp âm').getChordSheet('v'), /^Error: thiếu lời \+ hợp âm$/)
  await assert.rejects(library('CHORDLIB_RETRY: phiên bản vừa được dời').getChordSheet('v'), /tải lại rồi thử lại/)
  await assert.rejects(library('Could not find the function public.chord_sheet_get(p_version_id) in the schema cache').getChordSheet('v'), /chưa chạy migration/)
  await assert.rejects(createRpcChordLibrary(async () => { throw new Error('Failed to fetch') }).searchChordSheets(''), /Failed to fetch/)
  await assert.rejects(createRpcChordLibrary(fakeRpc({}).rpc).createChordSheet(draft({ title: '' })), /Tên bài/)
  const failing = fakeRpc({ chord_sheet_update_info: () => { throw new Error('CHORDLIB_FORBIDDEN') } })
  await assert.rejects(createRpcChordLibrary(failing.rpc).updateChordSheetInfo('s1', { title: 'x', composer: '' }), /không có quyền/)
})
