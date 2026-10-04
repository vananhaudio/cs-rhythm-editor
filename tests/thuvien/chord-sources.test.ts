// File nguồn + vạch nhịp của Hợp âm chuẩn hóa — phần thuần, kho trong bộ nhớ, kho Supabase (bucket giả), mock thư viện.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  MAX_SOURCE_BYTES, SOURCE_VIEW_SECONDS, createMemorySourceStore, createSupabaseSourceStore, formatBytes, nextFreeIndex, parseSourcePath,
  sha256Hex, sourceErrorMessage, sourceFileProblem, sourceMimeOf, sourcePath, sourcesFromServer, sourcesPayload,
} from '../../src/thuvien/chordSources.ts'
import type { ChordSource } from '../../src/thuvien/chordSources.ts'
import { lyricTokens, parseAnchors, renderAnchors } from '../../src/thuvien/chordAnchors.ts'
import { MOCK_OWNER_ID, createMockChordLibrary, createRpcChordLibrary } from '../../src/thuvien/chordLibrary.ts'
import type { RpcCall } from '../../src/thuvien/chordLibrary.ts'

const U = 'aaaaaaaa-0000-4000-8000-00000000000a'
const V = 'bbbbbbbb-0000-4000-8000-00000000000b'
const W = 'cccccccc-0000-4000-8000-00000000000c'
const blob = (text: string, type = 'image/png') => new Blob([text], { type })

test('loại file: tin type của trình duyệt; type rỗng thì suy từ đuôi; HEIC và loại khác → không nhận', () => {
  assert.equal(sourceMimeOf({ name: 'a.png', type: 'image/png' }), 'image/png')
  assert.equal(sourceMimeOf({ name: 'Sheet.PDF', type: '' }), 'application/pdf')
  assert.equal(sourceMimeOf({ name: 'x.jpeg', type: '' }), 'image/jpeg')
  assert.equal(sourceMimeOf({ name: 'x.heic', type: 'image/heic' }), null)
  assert.equal(sourceMimeOf({ name: 'x.heic', type: '' }), null)
  assert.equal(sourceMimeOf({ name: 'x.gif', type: 'image/gif' }), null)
  assert.equal(sourceMimeOf({ name: 'x.png', type: 'application/octet-stream' }), null, 'type có mà sai → không đoán theo đuôi')
})

test('kiểm file trước khi tải: loại, rỗng, > 20 MB, quá 10 file', () => {
  assert.equal(sourceFileProblem({ name: 'a.png', type: 'image/png', size: 70 }, 0), null)
  assert.match(sourceFileProblem({ name: 'a.heic', type: 'image/heic', size: 70 }, 0)!, /chưa nhận HEIC/)
  assert.match(sourceFileProblem({ name: 'a.png', type: 'image/png', size: 0 }, 0)!, /rỗng/)
  assert.match(sourceFileProblem({ name: 'a.pdf', type: 'application/pdf', size: MAX_SOURCE_BYTES + 1 }, 0)!, /lớn hơn 20 MB/)
  assert.equal(sourceFileProblem({ name: 'a.pdf', type: 'application/pdf', size: MAX_SOURCE_BYTES }, 0), null, 'đúng 20 MB vẫn nhận')
  assert.match(sourceFileProblem({ name: 'a.png', type: 'image/png', size: 70 }, 10)!, /tối đa 10 file/)
})

test('đường dẫn {uid}/{version}/{0-9}.{ext}: dựng + đọc lại; sai khuôn → null', () => {
  assert.equal(sourcePath(U, V, 3, 'image/jpeg'), `${U}/${V}/3.jpg`)
  assert.deepEqual(parseSourcePath(`${U}/${V}/3.jpg`), { ownerId: U, versionId: V, index: 3, ext: 'jpg' })
  for (const bad of [`${U}/${V}/10.png`, `${U}/${V}/1.gif`, `${U}/khong-uuid/1.png`, `${U.toUpperCase()}/${V}/1.png`, `${U}/${V}/1.png/x`, '']) assert.equal(parseSourcePath(bad), null, bad)
  assert.equal(nextFreeIndex([]), 0)
  assert.equal(nextFreeIndex([0, 1, 3]), 2)
  assert.equal(nextFreeIndex([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), null)
})

test('sha256 tính trên đúng byte; payload gửi máy chủ đúng 5 khoá, page theo thứ tự', async () => {
  assert.equal(await sha256Hex(new TextEncoder().encode('abc').buffer), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  const sources: ChordSource[] = [{ path: `${U}/${V}/1.pdf`, mime: 'application/pdf', sha256: 'a'.repeat(64), sizeBytes: 10, page: 9 }, { path: `${U}/${V}/0.png`, mime: 'image/png', sha256: 'b'.repeat(64), sizeBytes: 5, page: 9 }]
  assert.deepEqual(sourcesPayload(sources), [
    { path: `${U}/${V}/1.pdf`, mime: 'application/pdf', sha256: 'a'.repeat(64), size_bytes: 10, page: 1 },
    { path: `${U}/${V}/0.png`, mime: 'image/png', sha256: 'b'.repeat(64), size_bytes: 5, page: 2 },
  ])
  assert.deepEqual(sourcesFromServer([{ path: `${U}/${V}/0.png`, mime: 'image/png', sha256: 'c', size_bytes: 5, page: 1 }, { path: 'rác' }, null, 7]),
    [{ path: `${U}/${V}/0.png`, mime: 'image/png', sha256: 'c', sizeBytes: 5, page: 1 }])
  assert.deepEqual(sourcesFromServer(null), [])
})

test('lỗi Storage → câu đọc được; dung lượng hiển thị', () => {
  assert.equal(sourceErrorMessage('{"message":"CHORDLIB_SOURCE: phiên bản đã ghi — bộ file nguồn không đổi được nữa"}'), 'phiên bản đã ghi — bộ file nguồn không đổi được nữa')
  assert.match(sourceErrorMessage('new row violates row-level security policy'), /Không có quyền ghi/)
  assert.match(sourceErrorMessage('The object exceeded the maximum allowed size'), /20 MB/)
  assert.match(sourceErrorMessage('mime type image/gif is not supported'), /Loại file/)
  assert.equal(formatBytes(70), '70 B')
  assert.equal(formatBytes(2048), '2 KB')
  assert.equal(formatBytes(1.5 * 1024 * 1024), '1,5 MB')
})

test('kho trong bộ nhớ ép cùng luật với bucket thật', async () => {
  let recorded = false
  const store = createMemorySourceStore({ ownerId: U, isRecorded: id => recorded && id === V })
  await store.upload(`${U}/${V}/0.png`, blob('x'), 'image/png')
  await assert.rejects(store.upload(`${W}/${V}/1.png`, blob('x'), 'image/png'), /đường dẫn/, 'thư mục người khác')
  await assert.rejects(store.upload(`${U}/${V}/1.png`, blob('x'), 'application/pdf'), /Loại file/, 'đuôi .png nhưng khai PDF')
  await assert.rejects(store.upload(`${U}/${V}/0.png`, blob('x'), 'image/png'), /đã có file khác/, 'ghi đè')
  for (let n = 1; n < 10; n += 1) await store.upload(`${U}/${V}/${n}.png`, blob('x'), 'image/png')
  await assert.rejects(store.upload(`${U}/${W}/0.png`, new Blob([new Uint8Array(MAX_SOURCE_BYTES + 1)]), 'image/png'), /20 MB/)
  assert.match(await store.viewUrl(`${U}/${V}/0.png`), /^(blob:|mock:)/)
  await store.copy(`${U}/${V}/0.png`, `${U}/${W}/0.png`)
  recorded = true
  await assert.rejects(store.upload(`${U}/${V}/0.webp`, blob('x'), 'image/webp'), /phiên bản đã ghi/, 'thư mục đã ghi → không thêm')
  await assert.rejects(store.remove(`${U}/${V}/0.png`), /phiên bản đã ghi/, 'thư mục đã ghi → không xoá')
  await store.remove(`${U}/${W}/0.png`)
  await assert.rejects(store.remove(`${U}/${W}/0.png`), /Không xoá được/, 'xoá thứ không có → báo lỗi, không im lặng')
})

test('kho Supabase: đúng tham số Storage API; xoá không được → báo lỗi; link xem ký ngắn hạn', async () => {
  const calls: unknown[][] = []
  let removeData: unknown[] = [{ name: 'x' }]
  const bucket = {
    upload: async (...args: unknown[]) => { calls.push(['upload', ...args]); return { error: null } },
    remove: async (...args: unknown[]) => { calls.push(['remove', ...args]); return { data: removeData, error: null } },
    copy: async (...args: unknown[]) => { calls.push(['copy', ...args]); return { error: { message: 'new row violates row-level security policy' } } },
    createSignedUrl: async (...args: unknown[]) => { calls.push(['sign', ...args]); return { data: { signedUrl: 'https://x/sign?token=t' }, error: null } },
  }
  const store = createSupabaseSourceStore({ bucket: async () => bucket, userId: async () => U })
  assert.equal(await store.ownerId(), U)
  const file = blob('x')
  await store.upload(`${U}/${V}/0.png`, file, 'image/png')
  assert.deepEqual(calls[0], ['upload', `${U}/${V}/0.png`, file, { contentType: 'image/png', upsert: false, cacheControl: '3600' }])
  await store.remove(`${U}/${V}/0.png`)
  removeData = []
  await assert.rejects(store.remove(`${U}/${V}/0.png`), /đã gắn với một phiên bản/, 'Storage xoá 0 file (policy chặn) → không im lặng')
  await assert.rejects(store.copy('a', 'b'), /Không có quyền ghi/)
  assert.equal(await store.viewUrl(`${U}/${V}/0.png`), 'https://x/sign?token=t')
  assert.deepEqual(calls.at(-1), ['sign', `${U}/${V}/0.png`, SOURCE_VIEW_SECONDS])
  assert.equal(SOURCE_VIEW_SECONDS, 300)
  await assert.rejects(createSupabaseSourceStore({ bucket: async () => bucket, userId: async () => null }).ownerId(), /đăng nhập lại/)
})

// ── Vạch nhịp ──
const TEXT = '1. Chiều [Am] nao, tiễn nhau [E7] đi\nĐK: [Dm] Hoàng hôn [G] xuống\nkhông hợp âm ở đây [C]'

test('chữ hát: bỏ [hợp âm], bỏ NHÃN đầu dòng; hợp âm cuối dòng giữ thành chữ rỗng', () => {
  assert.deepEqual(lyricTokens('1. Chiều [Am] nao, tiễn nhau [E7] đi'), { label: '1.', tokens: [
    { chord: null, word: 'Chiều' }, { chord: 'Am', word: 'nao,' }, { chord: null, word: 'tiễn' }, { chord: null, word: 'nhau' }, { chord: 'E7', word: 'đi' }] })
  assert.equal(lyricTokens('ĐK: [Dm] Hoàng hôn').label, 'ĐK:')
  assert.equal(lyricTokens('[C] 1. không phải nhãn').label, null, 'có hợp âm đứng trước → "1." là lời')
  assert.deepEqual(lyricTokens('hết [C]').tokens.at(-1), { chord: 'C', word: '' })
})

test('đọc anchors: đúng hình dạng → dùng được; sai hình dạng / lệch lời → null (không sập)', () => {
  const ok = { pickup: { line: 0, token: 0 }, measures: [{ line: 0, token: 1 }, { line: 0, token: 4 }, { line: null, token: null }, { line: 1, token: 0 }, { line: 1, token: 2 }, { line: 2, token: 5 }] }
  assert.deepEqual(parseAnchors(ok, TEXT), ok)
  for (const bad of [null, 'x', {}, { measures: [] }, { measures: [{ line: 0 }] }, { measures: [{ line: 9, token: 0 }] }, { measures: [{ line: 0, token: 6 }] },
    { measures: [{ line: null, token: 1 }] }, { measures: [{ line: 0, token: -1 }] }, { measures: [{ line: 0, token: 1.5 }] }, { pickup: 'x', measures: [{ line: 0, token: 0 }] }]) {
    assert.equal(parseAnchors(bad, TEXT), null, JSON.stringify(bad))
  }
})

test('hiện vạch nhịp: "|" trước chữ đầu ô; ô không lời; vạch cuối dòng; nhãn tách riêng', () => {
  const anchors = parseAnchors({ pickup: { line: 0, token: 0 }, measures: [{ line: 0, token: 1 }, { line: 0, token: 4 }, { line: null, token: null }, { line: 1, token: 0 }, { line: 1, token: 2 }, { line: 2, token: 5 }] }, TEXT)!
  assert.deepEqual(renderAnchors(TEXT, anchors), [
    { label: '1.', text: '| Chiều | [Am] nao, tiễn nhau | [E7] đi', bars: 3 },
    { label: null, text: '‖ 1 ô không lời', bars: 1 },
    { label: 'ĐK:', text: '| [Dm] Hoàng hôn | [G] xuống', bars: 2 },
    { label: null, text: 'không hợp âm ở đây | [C]', bars: 1 },
  ])
})

// ── Thư viện (mock) với file nguồn ──
const draft = { title: 'Bài có nguồn', composer: '', meter: null, suggestedBpm: null, text: '[C] la la' }
async function upload(library: ReturnType<typeof createMockChordLibrary>, versionId: string, index: number, content: string): Promise<ChordSource> {
  const path = sourcePath(MOCK_OWNER_ID, versionId, index, 'image/png')
  const file = blob(content)
  await library.sources.upload(path, file, 'image/png')
  return { path, mime: 'image/png', sha256: await sha256Hex(await file.arrayBuffer()), sizeBytes: file.size, page: index + 1 }
}

test('mock: lưu bài kèm nguồn → nguồn gắn với phiên bản; thư mục phiên bản phải khớp ĐÚNG danh sách khai', async () => {
  const library = createMockChordLibrary()
  const v1 = library.newVersionId()
  const a = await upload(library, v1, 0, 'trang 1')
  const b = await upload(library, v1, 1, 'trang 2')
  await assert.rejects(library.createChordSheet(draft, { versionId: v1, sources: [a] }), /chưa được khai/, 'còn file b chưa khai')
  const created = await library.createChordSheet(draft, { versionId: v1, sources: [a, b] })
  assert.deepEqual([created.versionId, created.hasSource, created.sources.map(source => source.path)], [v1, true, [a.path, b.path]])
  assert.deepEqual((await library.getChordSheet(v1)).sources, [a, b], 'mở lại → nguồn còn đúng')
  await assert.rejects(library.sources.upload(sourcePath(MOCK_OWNER_ID, v1, 2, 'image/png'), blob('x'), 'image/png'), /phiên bản đã ghi/, 'phiên bản đã ghi → không thêm nguồn')
  await assert.rejects(library.sources.remove(a.path), /phiên bản đã ghi/, 'phiên bản đã ghi → không xoá nguồn')
})

test('mock: chỉ thay nguồn = phiên bản mới (giữ vạch nhịp); nguồn y hệt (cùng sha256) = trùng', async () => {
  const library = createMockChordLibrary()
  const [first] = await library.searchChordSheets('bai thu 01')
  const v1 = await library.getChordSheet(first.versionId)
  const v2 = library.newVersionId()
  const s = await upload(library, v2, 0, 'sheet mới')
  const next = await library.createChordSheetVersion(first.sheetId, { text: v1.text, meter: v1.meter, suggestedBpm: v1.suggestedBpm }, v1.versionId, { versionId: v2, sources: [s] })
  assert.deepEqual([next.versionId, next.versionNumber, next.hasAnchors, next.anchors !== null], [v2, 2, true, true], 'lời không đổi → vạch nhịp được giữ')
  const v3 = library.newVersionId()
  const copy = await upload(library, v3, 0, 'sheet mới')
  const same = await library.createChordSheetVersion(first.sheetId, { text: v1.text, meter: v1.meter, suggestedBpm: v1.suggestedBpm }, v2, { versionId: v3, sources: [copy] })
  assert.equal(same.versionId, v2, 'cùng lời + nhịp + BPM + cùng sha256 nguồn → trả bản đã có')
})

test('rpc: lưu kèm nguồn gửi p_version_id + p_sources (5 khoá); đọc lại sources + anchors + trạng thái', async () => {
  const calls: { fn: string; args: Record<string, unknown> }[] = []
  const path = `${U}/${V}/0.png`
  const rpc: RpcCall = async (fn, args) => {
    calls.push({ fn, args })
    if (fn === 'chord_sheet_contribute') return { data: { ok: true, sheet_id: 's1', version_id: V }, error: null }
    return { data: { sheet_id: 's1', version_id: V, title: 'Bài', composer: null, version_number: 1, is_canonical: false, review_status: 'private', created_at: 'x',
      text: TEXT, meter: null, suggested_bpm: null, sources: [{ path, mime: 'image/png', sha256: 'a'.repeat(64), size_bytes: 70, page: 1 }],
      anchors: { measures: [{ line: 0, token: 0 }] }, anchors_status: 'needs_review' }, error: null }
  }
  const library = createRpcChordLibrary(rpc)
  const detail = await library.createChordSheet(draft, { versionId: V, sources: [{ path, mime: 'image/png', sha256: 'a'.repeat(64), sizeBytes: 70, page: 1 }] })
  assert.deepEqual(calls[0].args, { p_text: '[C] la la', p_title: 'Bài có nguồn', p_composer: null, p_meter: null, p_suggested_bpm: null, p_version_id: V,
    p_sources: [{ path, mime: 'image/png', sha256: 'a'.repeat(64), size_bytes: 70, page: 1 }] })
  assert.deepEqual([detail.hasSource, detail.sources.length, detail.anchorsStatus, detail.anchors?.measures.length], [true, 1, 'needs_review', 1])
  await library.createChordSheet(draft, { versionId: W, sources: [] })
  assert.deepEqual(calls.at(-2)!.args, { p_text: '[C] la la', p_title: 'Bài có nguồn', p_composer: null, p_meter: null, p_suggested_bpm: null, p_version_id: W }, 'không nguồn → không gửi p_sources')
})
