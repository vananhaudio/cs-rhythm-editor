// Vạch nhịp thủ công — mô hình trình sửa (khe, dòng thời gian) + chấp nhận qua adapter mock/rpc.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  addSilent, addSustain, anchorLines, anchorWord, anchorsPayload, buildMeasureDisplay, firstLyricAnchor, measureDisplayText, moveMeasure, parseAnchors, removeMeasure, renderAnchors, toggleGap, uncoveredLines,
} from '../../src/thuvien/chordAnchors.ts'
import type { MeasureAnchor } from '../../src/thuvien/chordAnchors.ts'
import { MOCK_OWNER_ID, createMockChordLibrary, createRpcChordLibrary } from '../../src/thuvien/chordLibrary.ts'
import type { RpcCall } from '../../src/thuvien/chordLibrary.ts'
import { sha256Hex, sourcePath } from '../../src/thuvien/chordSources.ts'

const TEXT = '1. Chiều [Am] nao, tiễn nhau [E7] đi\nKhi [C] bóng ngả [G] xế\nĐK: [Dm] Hoàng hôn [G] xuống'
const A = (line: number | null, token: number | null): MeasureAnchor => ({ line, token })

test('khe: mỗi dòng có (số chữ + 1) khe; hợp âm và nhãn không tạo khe; dòng trống không có khe', () => {
  const lines = anchorLines(TEXT + '\n\nVerse: [C] một')
  assert.deepEqual(lines.map(line => [line.label, line.tokens.length]), [['1.', 5], [null, 4], ['ĐK:', 3], [null, 0], ['Verse:', 1]])
  assert.deepEqual(firstLyricAnchor(TEXT), A(0, 0))
  assert.deepEqual(firstLyricAnchor('[C]\n\nla'), A(0, 0), 'dòng chỉ có hợp âm vẫn có 1 vị trí')
  assert.deepEqual(firstLyricAnchor('\n\n[C] la'), A(0, 0), 'lời được chuẩn hoá (bỏ dòng trống đầu) — đánh số dòng như máy chủ')
  assert.equal(firstLyricAnchor('ĐK:'), null)
})

test('bấm khe (theo thứ tự lời): chèn đúng chỗ đọc; bấm lại thì bỏ', () => {
  let m: MeasureAnchor[] = []
  m = toggleGap(m, A(1, 2), 'order')
  m = toggleGap(m, A(0, 1), 'order')
  m = toggleGap(m, A(2, 0), 'order')
  m = toggleGap(m, A(0, 3), 'order')
  assert.deepEqual(m, [A(0, 1), A(0, 3), A(1, 2), A(2, 0)], 'bấm lộn xộn vẫn ra đúng thứ tự đọc')
  m = toggleGap(m, A(0, 3), 'order')
  assert.deepEqual(m, [A(0, 1), A(1, 2), A(2, 0)], 'bấm lại khe có vạch → bỏ')
})

test('ô không lời: chèn sau ô đang chọn; thêm vạch theo thứ tự lời đi SAU đoạn không lời đứng trước nó', () => {
  let m = [A(0, 1), A(1, 2)]
  m = addSilent(m, -1)
  assert.deepEqual(m, [A(null, null), A(0, 1), A(1, 2)], 'dạo đầu bài')
  m = addSilent(m, 1)
  m = addSilent(m, 1)
  assert.deepEqual(m, [A(null, null), A(0, 1), A(null, null), A(null, null), A(1, 2)])
  m = toggleGap(m, A(1, 0), 'order')
  assert.deepEqual(m, [A(null, null), A(0, 1), A(null, null), A(null, null), A(1, 0), A(1, 2)], 'vạch mới ở dòng 2 đi sau gian tấu')
  m = toggleGap(m, A(0, 0), 'order')
  assert.deepEqual(m.slice(0, 2), [A(null, null), A(0, 0)], 'vạch sớm nhất vẫn đi sau dạo đầu')
  assert.deepEqual(addSilent([A(0, 1)], 99), [A(0, 1), A(null, null)])
})

test('ô ngân: cùng vị trí, liền sau; bấm khe bỏ lần xuất hiện CUỐI', () => {
  let m = addSustain([A(0, 1), A(0, 4)], 1)
  assert.deepEqual(m, [A(0, 1), A(0, 4), A(0, 4)])
  m = toggleGap(m, A(0, 4), 'order')
  assert.deepEqual(m, [A(0, 1), A(0, 4)])
})

test('dòng thời gian KHÔNG sắp theo lời: chế độ thêm vào cuối cho điệp khúc quay lại; lên/xuống/xoá giữ đúng thứ tự', () => {
  let m = [A(0, 1), A(1, 0), A(2, 0), A(2, 2)]
  m = toggleGap(m, A(2, 0), 'append')
  m = toggleGap(m, A(2, 2), 'append')
  assert.deepEqual(m, [A(0, 1), A(1, 0), A(2, 0), A(2, 2), A(2, 0), A(2, 2)], 'điệp khúc hát lại: dòng 3 xuất hiện 2 lần, đúng thứ tự hát')
  assert.deepEqual(moveMeasure(m, 1, -1).slice(0, 2), [A(1, 0), A(0, 1)])
  assert.equal(moveMeasure(m, 0, -1), m, 'không đi lên khỏi đầu')
  assert.deepEqual(removeMeasure(m, 4), [A(0, 1), A(1, 0), A(2, 0), A(2, 2), A(2, 2)])
  assert.deepEqual(parseAnchors({ measures: m }, TEXT)?.measures, m, 'máy đọc chấp nhận dòng thời gian quay lại dòng cũ')
})

test('đọc lại: chữ đầu ô, ô không lời, cuối dòng; payload đúng 2 khoá', () => {
  assert.equal(anchorWord(TEXT, A(0, 1)), 'nao,')
  assert.equal(anchorWord(TEXT, A(0, 5)), '(cuối dòng 1)')
  assert.equal(anchorWord(TEXT, A(null, null)), '(ô không lời)')
  assert.equal(anchorWord('hết [G]', A(0, 1)), '[G]')
  assert.deepEqual(anchorsPayload([A(0, 1)], null), { measures: [A(0, 1)] })
  assert.deepEqual(anchorsPayload([A(0, 1)], A(0, 0)), { pickup: A(0, 0), measures: [A(0, 1)] })
  assert.deepEqual(renderAnchors(TEXT, anchorsPayload([A(0, 1), A(0, 4), A(0, 4)], A(0, 0)))[0],
    { label: '1.', text: '| Chiều | [Am] nao, tiễn nhau | | [E7] đi', bars: 4 }, 'nhịp lấy đà + ô ngân (2 vạch cùng chỗ)')
})

async function libraryWithSourceVersion() {
  const library = createMockChordLibrary()
  const v1 = library.newVersionId()
  const path = sourcePath(MOCK_OWNER_ID, v1, 0, 'image/png')
  const file = new Blob(['sheet'], { type: 'image/png' })
  await library.sources.upload(path, file, 'image/png')
  const source = { path, mime: 'image/png' as const, sha256: await sha256Hex(await file.arrayBuffer()), sizeBytes: file.size, page: 1 }
  const created = await library.createChordSheet({ title: 'Bài vạch', composer: '', meter: { beats: 3, beatType: 4 }, suggestedBpm: 66, text: TEXT }, { versionId: v1, sources: [source] })
  await library.approveChordSheetVersion(created.versionId)
  return { library, created: await library.getChordSheet(created.versionId) }
}

test('mock: chấp nhận → phiên bản MỚI dạng nháp, cùng lời/nhịp/BPM/nguồn; bản cũ giữ nguyên và vẫn là bản đang dùng', async () => {
  const { library, created } = await libraryWithSourceVersion()
  const anchors = { pickup: A(0, 0), measures: [A(0, 1), A(0, 3), A(null, null), A(2, 0)] }
  const next = await library.acceptAnchors(created.versionId, anchors)
  assert.deepEqual([next.versionNumber, next.status, next.anchorsStatus, next.hasAnchors], [2, 'draft', 'ready', true])
  assert.deepEqual([next.text, next.meter, next.suggestedBpm, next.sources], [created.text, created.meter, created.suggestedBpm, created.sources], 'trỏ lại đúng file nguồn, không chép')
  assert.deepEqual(next.anchors, anchors)
  const old = await library.getChordSheet(created.versionId)
  assert.deepEqual([old.status, old.anchors, old.anchorsStatus], ['current', null, 'none'])
  assert.equal((await library.acceptAnchors(created.versionId, anchors)).versionId, next.versionId, 'chấp nhận lại đúng bộ vạch → trả bản đã có')
  await assert.rejects(library.acceptAnchors(created.versionId, { measures: [A(0, 9)] }), /không hợp lệ/)
  await assert.rejects(library.acceptAnchors(created.versionId, { measures: [] }), /không hợp lệ/)
})

test('rpc: acceptAnchors gọi đúng RPC + tham số (mode manual, không gửi người/giờ), rồi đọc lại phiên bản mới', async () => {
  const calls: { fn: string; args: Record<string, unknown> }[] = []
  const rpc: RpcCall = async (fn, args) => {
    calls.push({ fn, args })
    if (fn === 'chord_sheet_accept_anchors') return { data: { ok: true, duplicate: false, version_id: 'v2' }, error: null }
    return { data: { sheet_id: 's', version_id: 'v2', title: 'B', composer: null, version_number: 2, is_canonical: false, review_status: 'private', created_at: 'x',
      text: TEXT, meter: null, suggested_bpm: null, sources: [], anchors: { measures: [{ line: 0, token: 1 }] }, anchors_status: 'ready' }, error: null }
  }
  const detail = await createRpcChordLibrary(rpc).acceptAnchors('v1', { pickup: A(0, 0), measures: [A(0, 1)] })
  assert.deepEqual(calls[0], { fn: 'chord_sheet_accept_anchors', args: { p_from_version_id: 'v1', p_anchors: { pickup: A(0, 0), measures: [A(0, 1)] }, p_anchor_review: { mode: 'manual' } } })
  assert.deepEqual([detail.versionId, detail.anchorsStatus, detail.anchors?.measures.length], ['v2', 'ready', 1])
  const failing = createRpcChordLibrary(async () => ({ data: null, error: { message: 'CHORDLIB_INVALID: vạch nhịp không hợp lệ — vị trí 1: dòng 9 không có trong lời' } }))
  await assert.rejects(failing.acceptAnchors('v1', { measures: [A(9, 0)] }), /^Error: vạch nhịp không hợp lệ — vị trí 1: dòng 9/)
})

// ── 5A.1 Số ô nhịp (buildMeasureDisplay) ──
const SONG = 'Sáng [Am] nay, mình cùng [E7] đi qua bao con phố [Am] dài\n\n[Dm] Nắng vàng rơi trên vai'
const show = (anchors: Parameters<typeof buildMeasureDisplay>[1], text = SONG) => measureDisplayText(buildMeasureDisplay(text, anchors))
const bars = (anchors: Parameters<typeof buildMeasureDisplay>[1], text = SONG) =>
  buildMeasureDisplay(text, anchors).flatMap(row => row.items).flatMap(item => (item.kind === 'bar' ? [item.number] : []))

test('A. có lấy đà: lấy đà KHÔNG mang số; ô đầy đủ đầu tiên = 1, số ở vạch mở ô', () => {
  assert.deepEqual(show({ pickup: A(0, 0), measures: [A(0, 1), A(0, 4), A(0, 9)] }),
    ['(lấy đà) Sáng |¹ [Am] nay, mình cùng |² [E7] đi qua bao con phố |³ [Am] dài', '', '[Dm] Nắng vàng rơi trên vai'])
  const rows = buildMeasureDisplay(SONG, { pickup: A(0, 0), measures: [A(0, 1), A(0, 4), A(0, 9)] })
  assert.deepEqual(rows[0].items.slice(0, 2), [{ kind: 'pickup' }, { kind: 'word', chord: null, word: 'Sáng', pickup: true }])
  assert.ok(!rows.flatMap(row => row.items).some(item => item.kind === 'bar' && item.number === 0), 'không có ô 0')
})

test('B. không lấy đà: ô 1 mở ngay đầu bài — chỉ số, không vạch giả', () => {
  const rows = buildMeasureDisplay(SONG, { measures: [A(0, 0), A(0, 4)] })
  assert.deepEqual(rows[0].items[0], { kind: 'bar', number: 1, start: true, mark: null })
  assert.equal(show({ measures: [A(0, 0), A(0, 4)] })[0], '¹ Sáng [Am] nay, mình cùng |² [E7] đi qua bao con phố [Am] dài')
  assert.equal(buildMeasureDisplay(SONG, { measures: [A(0, 1)] })[0].items.find(item => item.kind === 'bar')?.start, false, 'ô 1 không ở đầu bài → có vạch thật')
})

test('C. điệp khúc quay lại dòng cũ: mở hàng mới, số vẫn tăng tiếp (không quay về số cũ)', () => {
  const anchors = { measures: [A(0, 0), A(0, 4), A(2, 0), A(0, 4), A(0, 9)] }
  assert.deepEqual(bars(anchors), [1, 2, 3, 4, 5])
  assert.deepEqual(show(anchors), ['¹ Sáng [Am] nay, mình cùng |² [E7] đi qua bao con phố [Am] dài', '', '|³ [Dm] Nắng vàng rơi trên vai', '|⁴ [E7] đi qua bao con phố |⁵ [Am] dài'])
})

test('D. ô ngân: hai vị trí trùng → hai số khác nhau, ô sau là "(ngân)"; E. ô không lời vẫn có số', () => {
  assert.deepEqual(show({ measures: [A(0, 0), A(0, 4), A(0, 4), A(null, null), A(2, 0)] }),
    ['¹ Sáng [Am] nay, mình cùng |² [E7] đi qua bao con phố [Am] dài |³ (ngân) |⁴ ♪', '', '|⁵ [Dm] Nắng vàng rơi trên vai'])
  assert.deepEqual(show({ measures: [A(null, null), A(0, 0)] })[0].slice(0, 7), '|¹ ♪ |²', 'dạo đầu không lời = ô 1')
})

test('F/G. đổi thứ tự / xoá → đánh số lại liền mạch theo dòng thời gian', () => {
  const m = [A(0, 0), A(null, null), A(0, 4), A(2, 0)]
  assert.deepEqual(show({ measures: moveMeasure(m, 1, 1) })[0], '¹ Sáng [Am] nay, mình cùng |² [E7] đi qua bao con phố [Am] dài |³ ♪')
  assert.deepEqual(bars({ measures: removeMeasure(m, 1) }), [1, 2, 3])
  assert.deepEqual(show({ measures: removeMeasure(m, 1) })[2], '|³ [Dm] Nắng vàng rơi trên vai')
})

test('H. thêm vạch/số không làm lệch hợp âm: mỗi chữ giữ đúng hợp âm của nó', () => {
  const words = (rows: ReturnType<typeof buildMeasureDisplay>) => rows.flatMap(row => row.items).flatMap(item => (item.kind === 'word' ? [[item.chord, item.word]] : []))
  const plain = anchorLines(SONG).flatMap(line => line.tokens.map(token => [token.chord, token.word]))
  assert.deepEqual(words(buildMeasureDisplay(SONG, { pickup: A(0, 0), measures: [A(0, 1), A(0, 4), A(0, 4), A(null, null), A(0, 9), A(2, 0), A(2, 4)] })), plain)
  assert.deepEqual(words(buildMeasureDisplay(SONG, null)), plain, 'không vạch → bản lời + hợp âm như cũ')
})

test('I. dòng thời gian dài (>100 ô): số 3 chữ số, liền mạch, không lưu số vào dữ liệu', () => {
  const text = Array.from({ length: 40 }, (_, i) => `[C] la la la [G] lo ${i}`).join('\n')
  const ordered = { measures: Array.from({ length: 120 }, (_, i) => A(Math.floor(i / 3), (i % 3) * 2)) }
  assert.deepEqual(bars(ordered, text), Array.from({ length: 120 }, (_, i) => i + 1))
  assert.ok(measureDisplayText(buildMeasureDisplay(text, ordered)).at(-1)!.includes('|¹²⁰'))
  assert.deepEqual(Object.keys(anchorsPayload(ordered.measures, null).measures[0]), ['line', 'token'], 'không có measureNumber trong JSON')
})

// ── Multi-verse anchors V1: uncoveredLines ──
const TWO_VERSES = '1. Sáng [Am] nay, mình cùng đi qua bao con phố\nNắng vàng rơi trên vai người\n\nĐK: La la la\n2. Chiều qua ta cùng về bên con đường cũ\nGió mây bay trên đồi cao\n(Lặp lại 2 lần)\nCapo 2\nx2\nĐiệp khúc'
const FIRST_VERSE = [{ line: 0, token: 0 }, { line: 0, token: 4 }, { line: 1, token: 0 }, { line: 3, token: 0 }]

test('uncoveredLines: lời 2 chưa có vạch → báo đúng đoạn; dòng trống / nhãn / chú thích / capo / x2 / "Điệp khúc" không bao giờ bị báo', () => {
  assert.deepEqual(uncoveredLines(TWO_VERSES, { measures: FIRST_VERSE }), [{ from: 4, to: 5, tokens: 9 + 6 }])
  assert.deepEqual(uncoveredLines(TWO_VERSES, { measures: [] }).map(r => [r.from, r.to]), [[0, 5]], 'chưa có ô nào → báo mọi dòng hát; dòng trống ở giữa không cắt đoạn')
})

test('uncoveredLines: hết báo khi đã phủ — kể cả dòng nằm giữa hai ô liên tiếp; ô không lời không phá phủ; thứ tự hát quay lại dòng cũ không phủ nhầm', () => {
  const full = [...FIRST_VERSE, { line: 4, token: 0 }, { line: 5, token: 0 }]
  assert.deepEqual(uncoveredLines(TWO_VERSES, { measures: full }), [])
  assert.deepEqual(uncoveredLines(TWO_VERSES, { pickup: { line: 0, token: 0 }, measures: [{ line: 0, token: 5 }, { line: null, token: null }, { line: 4, token: 0 }, { line: 5, token: 0 }] }), [],
    'ô ở dòng 0 rồi nhảy tới dòng 4: các dòng 1–3 nằm giữa hai ô liên tiếp xuôi chiều nên được phủ; ô không lời bị bỏ qua')
  const back = [{ line: 5, token: 0 }, { line: 0, token: 0 }]
  assert.deepEqual(uncoveredLines(TWO_VERSES, { measures: back }).map(r => [r.from, r.to]), [[1, 4]], 'đi từ dòng 5 quay lại dòng 0: KHÔNG phủ nhầm các dòng 1–4 ở giữa')
})

test('uncoveredLines: một lời hát đủ vạch (bài một lời) không báo gì', () => {
  const one = '1. Chiều [Am] nao, tiễn nhau [E7] đi khi trời\nXe lăn trong [F] tim khuất xa rồi'
  assert.deepEqual(uncoveredLines(one, { measures: [{ line: 0, token: 0 }, { line: 0, token: 4 }, { line: 1, token: 0 }] }), [])
})
