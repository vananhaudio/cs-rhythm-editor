// Contextual Share V2 — vùng văn bản: phân tích RPC, thẻ Feed/Chat, khung dựng bằng chính renderer, phân loại vùng chọn, kiểm băm (fail-closed), tương thích bundle cũ.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { parseShareNoteOpen, isTextOpen, isBarsOpen } from '../../src/share/shareNoteApi.ts'
import { describeToolShare } from '../../src/class-social/toolshare/registry.ts'
import { shareNoteCardView } from '../../src/share/refCards.ts'
import { shareNoteMessage } from '../../src/share/shareNotePreviewStore.ts'
import { ContextSectionView } from '../../src/lesson/LessonDocument.tsx'
import LessonDocument from '../../src/lesson/LessonDocument.tsx'
import { ScoreShareSlot } from '../../src/lesson/scoreShareSlot.ts'
import {
  anchorFits, classifyInLeaf, cpLen, cpSlice, leafTextAt, splitForMark, studyCompact, studySubsection, textContextHasMore, textLeaves, verifyAnchor, SELECTION_HINT,
} from '../../src/share/textAnchor.ts'

const CLS = 'b1000000-0000-4000-8000-000000000001', NID = 'aaaaaaaa-1111-4111-8111-111111111111'
const sha = (s: string) => createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex')
const base = { note: 'Em chưa hiểu', author_id: 'x', is_author: false, class_id: CLS, session_no: 1, created_at: 't' }
const P1 = 'Giữ nhịp thật đều. Hãy nghe kỹ nhịp chùm ba ở ô 2 và ô 3 trong cả bài.'
const SEL = 'nghe kỹ nhịp chùm ba'
const study = {
  kind: 'study', tag: 'ÔN TẬP', title: 'Ôn tập 7 ngày', blocks: [
    { b: 'h', text: 'Ngày 1' }, { b: 'p', text: P1 }, { b: 'ul', items: ['Khởi động', 'Đếm nhịp'] },
    { b: 'h', text: 'Ngày 2' }, { b: 'p', text: 'Đoạn ngày hai.' }, { b: 'p', text: 'Đoạn khác ngày hai.' },
  ],
}
const f = cpLen(P1.slice(0, P1.indexOf(SEL)))
const anchor = { section: 3, path: ['blocks', '1', 'text'], from: f, to: f + cpLen(SEL) }
const html = (el: React.ReactElement) => renderToStaticMarkup(el)

test('parse open: text ok/moved có toạ độ + sha; stale/no_access KHÔNG toạ độ; dữ liệu lạ → unavailable (fail-closed)', () => {
  const row = { ...base, kind: 'text', section_idx: 3, score_path: null, bar_from: null, bar_to: null, text_path: ['blocks', '1', 'text'], char_from: f, char_to: f + 20, text_sha: sha(SEL) }
  const ok = parseShareNoteOpen([{ ...row, status: 'ok' }]), mv = parseShareNoteOpen([{ ...row, status: 'moved' }])
  assert.ok(isTextOpen(ok) && ok.status === 'ok' && ok.text.section === 3 && ok.text.path.join('.') === 'blocks.1.text' && ok.sha === sha(SEL))
  assert.ok(isTextOpen(mv) && mv.status === 'moved')
  for (const status of ['stale', 'no_access']) {
    const r = parseShareNoteOpen([{ ...base, kind: 'text', status }])
    assert.ok(r.status === status && 'kind' in r && r.kind === 'text' && !('text' in r) && !('score' in r))
  }
  assert.equal(parseShareNoteOpen([{ ...row, status: 'ok', text_sha: 'zz' }]).status, 'unavailable', 'sha hỏng')
  assert.equal(parseShareNoteOpen([{ ...row, status: 'ok', text_path: ['url'] }]).status, 'unavailable', 'đường dẫn ngoài danh sách')
  assert.equal(parseShareNoteOpen([{ ...row, status: 'ok', text_path: ['blocks', '1', 'text', 'a', 'b', 'c'] }]).status, 'unavailable', 'đường dẫn quá dài')
  assert.equal(parseShareNoteOpen([{ ...row, status: 'ok', char_from: 1.5 }]).status, 'unavailable')
  assert.equal(parseShareNoteOpen([{ ...row, status: 'ok', kind: 'image' }]).status, 'unavailable', 'loại neo lạ')
  assert.equal(parseShareNoteOpen([{ ...base, kind: 'bars', status: 'moved', section_idx: 1, score_path: ['tex'], bar_from: 1, bar_to: 2 }]).status, 'unavailable', 'ô nhịp không có "moved"')
})

test('parse open: hàng V1 (không có cột kind) vẫn là ô nhịp — tương thích ngược khi DB chưa migrate / lùi về hàm V1', () => {
  const v1 = parseShareNoteOpen([{ ...base, status: 'ok', section_idx: 5, score_path: ['tex'], bar_from: 2, bar_to: 3 }])
  assert.ok(isBarsOpen(v1) && v1.kind === 'bars' && v1.bars.from === 2)
  const v2 = parseShareNoteOpen([{ ...base, kind: 'bars', status: 'ok', section_idx: 5, score_path: ['tex'], bar_from: 2, bar_to: 3, text_path: null, char_from: null, char_to: null, text_sha: null }])
  assert.ok(isBarsOpen(v2) && v2.score.section === 5)
})

test('thẻ Feed: payload văn bản (anchor=text, KHÔNG dải ô) → thẻ "Giáo trình · Đoạn văn bản"; bundle/payload cũ vẫn là ô nhịp', () => {
  const v = describeToolShare({ v: 1, tool: 'share_note', kind: 'share_note', anchor: 'text', note_id: NID, note: 'Hỏi', class_id: CLS, session_no: 2 })
  assert.ok(v && v.toolLabel === 'Giáo trình' && v.detail === 'Đoạn văn bản' && v.action?.label === 'Mở trong giáo trình' && v.sharedNote?.kind === 'text' && v.sharedNote.from === undefined)
  assert.match(v!.action!.href, new RegExp(`/sessions/2\\?note=${NID}`))
  const old = describeToolShare({ v: 1, tool: 'share_note', kind: 'share_note', note_id: NID, note: 'Hỏi', class_id: CLS, session_no: 2, bar_from: 2, bar_to: 3 })
  assert.ok(old && old.toolLabel === 'Bản nhạc' && old.detail === 'Ô 2–3' && old.sharedNote?.kind === 'bars')
  assert.equal(describeToolShare({ v: 1, tool: 'share_note', kind: 'share_note', note_id: NID, note: 'Hỏi', class_id: CLS, session_no: 2 }), null, 'thiếu cả anchor lẫn dải ô ⇒ không dựng (không đoán)')
  assert.equal(describeToolShare({ v: 1, tool: 'share_note', kind: 'share_note', anchor: 'text', note_id: 'bad', note: 'x', class_id: CLS, session_no: 2 }), null)
})

test('thẻ Chat: card_v2 (anchor_kind=text) dựng thẻ tham chiếu; hàng V1 không anchor_kind vẫn là ô nhịp; hàng text không dải ô ở bản V1 ⇒ không dựng', () => {
  const t = shareNoteCardView({ id: NID, note: 'Hỏi', class_id: CLS, session_no: 1, anchor_kind: 'text', bar_from: null, bar_to: null })
  assert.ok(t && t.toolLabel === 'Giáo trình' && t.action?.label === 'Mở trong giáo trình' && !t.sharedNote)
  const b = shareNoteCardView({ id: NID, note: 'Hỏi', class_id: CLS, session_no: 1, bar_from: 2, bar_to: 3 })
  assert.ok(b && b.detail === 'Ô 2–3')
  assert.equal(shareNoteCardView({ id: NID, note: 'Hỏi', class_id: CLS, session_no: 1, bar_from: null, bar_to: null }), null, 'kiểu thẻ cũ gặp hàng text: nhẹ, không lỗi')
})

test('thông điệp trạng thái theo loại neo', () => {
  assert.match(shareNoteMessage({ status: 'stale', note: 'x', kind: 'text' })!, /Giáo trình đã được cập nhật/)
  assert.match(shareNoteMessage({ status: 'no_access', note: 'x', kind: 'text' })!, /phần giáo trình/)
  assert.match(shareNoteMessage({ status: 'locked', note: 'x', kind: 'text' })!, /đoạn văn bản/)
  assert.match(shareNoteMessage({ status: 'stale', note: 'x', kind: 'bars' })!, /Bản nhạc đã được cập nhật/)
  assert.match(shareNoteMessage({ status: 'stale', note: 'x' })!, /Bản nhạc đã được cập nhật/)
})

test('khung văn bản: dựng bằng chính renderer; <mark> bọc ĐÚNG đoạn chọn; cửa sổ gọn = tiêu đề + khối chứa + khối phụ thuộc; có dấu ⋯ khi lược', () => {
  const m = html(createElement(ContextSectionView, { section: study, index: 3, text: anchor }))
  assert.equal((m.match(/<mark/g) ?? []).length, 1)
  assert.match(m, new RegExp(`<mark[^>]*data-testid="text-focus">${SEL}</mark>`))
  assert.match(m, /Ngày 1/); assert.match(m, /Khởi động/, 'khối ul phụ thuộc liền sau')
  assert.doesNotMatch(m, /Ngày 2/, 'tiểu mục khác bị lược khi gọn'); assert.doesNotMatch(m, /Đoạn ngày hai/)
  assert.match(m, /lsn-ctx-gap/, 'dấu ⋯ báo còn nội dung ở bản gốc')
  assert.match(m, /data-expanded="0"/)
  // nối lại các mảnh quanh <mark> = đúng chuỗi nguồn (không mất / thêm ký tự)
  const text = m.replace(/<[^>]+>/g, '')
  assert.ok(text.includes(P1), 'lá chứa vùng chọn được in NGUYÊN VĂN')
})

test('khung văn bản mở rộng: cả tiểu mục (đến trước tiêu đề kế); không kéo tiểu mục khác; khối không phải study dựng nguyên khối', () => {
  const m = html(createElement(ContextSectionView, { section: study, index: 3, text: anchor, expanded: true }))
  assert.match(m, /data-expanded="1"/); assert.match(m, /Ngày 1/); assert.match(m, /Khởi động/); assert.match(m, /Đếm nhịp/)
  assert.doesNotMatch(m, /Ngày 2/)
  assert.match(m, /lsn-ctx-gap/)
  const note = { kind: 'note', title: 'Ghi chú', text: 'Đàn 🎸 hay lắm, giữ đều tay nhé.' }
  const a = { section: 0, path: ['text'], from: 6, to: cpLen('Đàn 🎸 hay lắm, giữ đều tay nhé.') - 6 }
  const n = html(createElement(ContextSectionView, { section: note, index: 0, text: a }))
  assert.match(n, /<mark[^>]*>[^<]+<\/mark>/); assert.ok(n.replace(/<[^>]+>/g, '').includes('Đàn 🎸 hay lắm, giữ đều tay nhé.'))
})

test('khung văn bản: toạ độ không khớp lá ⇒ KHÔNG tô (fail-closed), nội dung vẫn không bị cắt', () => {
  for (const bad of [{ ...anchor, to: 9999 }, { ...anchor, from: 5, to: 5 }, { ...anchor, path: ['blocks', '0', 'text'], to: 99 }, { ...anchor, path: ['url'] }]) {
    const m = html(createElement(ContextSectionView, { section: study, index: 3, text: bad }))
    assert.equal((m.match(/<mark/g) ?? []).length, 0)
  }
})

test('khung văn bản NFD + emoji: <mark> cắt đúng theo điểm mã và mở ra tới ranh giới ký tự trọn (không tách dấu tổ hợp)', () => {
  const t = 'Nốt 🎸 “giữ đều tay” rất quan trọng'.normalize('NFD')
  const sel = 'giữ đều tay'.normalize('NFD')
  const from = cpLen(t.slice(0, t.indexOf(sel)))
  const a = { section: 0, path: ['text'], from, to: from + cpLen(sel) }
  assert.ok(anchorFits(t, a))
  const parts = splitForMark(t, a.from, a.to)!
  assert.equal(parts.join(''), t); assert.equal(parts[1], sel)
  // biên rơi giữa cụm (sau chữ u, trước dấu): mark mở rộng ra, không bao giờ để dấu tổ hợp đứng một mình ở đầu mảnh
  const iu = Array.from(t).indexOf('u', from)
  assert.equal(splitForMark(t, iu + 1, iu + 4), null, 'biên bắt đầu bằng dấu tổ hợp ⇒ không hợp lệ (không tô)')
  const html1 = html(createElement(ContextSectionView, { section: { kind: 'note', text: t }, index: 0, text: a }))
  assert.ok(html1.replace(/<[^>]+>/g, '').includes(t))
})

test('LessonDocument: có TextShare (trang Buổi) ⇒ mỗi lá có data-tp, nội dung chữ KHÔNG đổi; không có ⇒ HTML y như cũ (bản in / trang công khai)', () => {
  const doc = { meta: { programCode: 'X', programName: 'X', sessionNo: 1, title: 'T' }, sections: [study] } as never
  const plain = html(createElement(LessonDocument, { doc, embedded: true }))
  assert.doesNotMatch(plain, /data-tp/); assert.doesNotMatch(plain, /lsn-leaf/); assert.doesNotMatch(plain, /text-share-bar/)
  const shared = html(createElement(ScoreShareSlot.Provider, { value: { onAsk: () => {}, focus: null, onAskText: () => {}, textFocus: null } }, createElement(LessonDocument, { doc, embedded: true })))
  assert.match(shared, /data-tp="0:blocks\.1\.text"/); assert.match(shared, /data-tp="0:blocks\.2\.items\.1"/)
  assert.equal(shared.replace(/<[^>]+>/g, ''), plain.replace(/<[^>]+>/g, ''), 'chữ hiển thị y hệt khi bật chọn văn bản')
  // vùng tô trên trang Buổi (focus)
  const focused = html(createElement(ScoreShareSlot.Provider, { value: { onAsk: () => {}, focus: null, onAskText: () => {}, textFocus: { ...anchor, section: 0 } } }, createElement(LessonDocument, { doc, embedded: true })))
  assert.match(focused, new RegExp(`<mark[^>]*>${SEL}</mark>`))
})

test('classifyInLeaf: một lá hợp lệ; cắt khoảng trắng; ngắn / dài / rỗng; làm tròn grapheme trong cùng lá', () => {
  const leaf = P1
  const u0 = leaf.indexOf(SEL), u1 = u0 + SEL.length
  const ok = classifyInLeaf(3, ['blocks', '1', 'text'], leaf, u0 - 1, u1 + 1)             // lọt cả khoảng trắng hai đầu
  assert.ok(ok.status === 'ok' && ok.text === SEL && cpSlice(leaf, ok.anchor.from, ok.anchor.to) === SEL, 'cắt khoảng trắng đầu/cuối')
  assert.equal(classifyInLeaf(3, ['x'], leaf, 0, 3).status, 'short')                         // "Giữ" = 3 ký tự
  assert.equal(classifyInLeaf(3, ['x'], leaf, 3, 4).status, 'empty')                         // chỉ khoảng trắng
  assert.equal(classifyInLeaf(3, ['x'], 'a'.repeat(501), 0, 501).status, 'long')
  assert.equal(classifyInLeaf(3, ['x'], 'a b c', 0, 5).status, 'short', '3 ký tự không phải khoảng trắng < 4')
  assert.equal(classifyInLeaf(3, ['x'], 'ab cd', 0, 5).status, 'ok', 'đúng 4 ký tự không phải khoảng trắng')
  const emoji = 'Đàn 🎸 hay'
  assert.equal(classifyInLeaf(3, ['x'], emoji, 5, 6).status, 'outside', 'UTF-16 rơi giữa cặp thay thế')
  const nfd = 'giữ đều tay'.normalize('NFD')
  const r = classifyInLeaf(3, ['x'], nfd, 1, nfd.length)                                    // bắt đầu giữa "g|iữ…" không phải giữa cụm; còn dấu tổ hợp thì làm tròn
  assert.ok(r.status === 'ok')
  const mid = classifyInLeaf(3, ['x'], nfd, nfd.indexOf('u') + 1, nfd.length)               // ngay sau chữ u (đầu là dấu tổ hợp) ⇒ co RA ngoài về u
  assert.ok(mid.status === 'ok' && cpSlice(nfd, mid.anchor.from, mid.anchor.to).normalize('NFC').startsWith('ữ'))
  for (const k of ['multi', 'outside', 'short', 'long'] as const) assert.ok(SELECTION_HINT[k].length > 10)
})

test('verifyAnchor: khớp băm ⇒ true; sai băm / sai toạ độ / sai lá ⇒ false (không tô)', async () => {
  const sections = [{ kind: 'objectives', items: ['a'] }, { kind: 'x' }, { kind: 'x' }, study]
  assert.equal(await verifyAnchor(sections, anchor, sha(SEL)), true)
  assert.equal(await verifyAnchor(sections, anchor, sha(SEL + 'x')), false)
  assert.equal(await verifyAnchor(sections, { ...anchor, from: anchor.from + 1, to: anchor.to + 1 }, sha(SEL)), false)
  assert.equal(await verifyAnchor(sections, { ...anchor, section: 1 }, sha(SEL)), false)
  assert.equal(await verifyAnchor(sections, { ...anchor, path: ['blocks', '99', 'text'] }, sha(SEL)), false)
  assert.equal(leafTextAt(sections, anchor), P1)
})

test('cửa sổ ngữ cảnh study: gọn / tiểu mục; không vượt 12 khối; luôn gồm khối được chọn', () => {
  const b = study.blocks
  assert.deepEqual(studyCompact(b, 1), [0, 1, 2]); assert.deepEqual(studySubsection(b, 1), [0, 1, 2])
  assert.deepEqual(studyCompact(b, 4), [3, 4, 5]); assert.deepEqual(studySubsection(b, 4), [3, 4, 5])
  const long = [{ b: 'h' }, ...Array.from({ length: 30 }, () => ({ b: 'p' }))]
  const sub = studySubsection(long, 15)
  assert.ok(sub.length <= 12 && sub.includes(15))
  assert.ok(textContextHasMore({ kind: 'study', blocks: long }, { path: ['blocks', '15', 'text'] }))
  assert.equal(textContextHasMore({ kind: 'note', text: 'x' }, { path: ['text'] }), false)
  assert.equal(textContextHasMore(study, { path: ['blocks', '1', 'text'] }), false, 'gọn đã gồm cả tiểu mục ngắn')
})

test('enumerator lá phía client: đúng 6 loại khối; loại ô ___, trường ngoài danh sách', () => {
  assert.deepEqual(textLeaves({ kind: 'recap', steps: [{ label: 'L', items: ['a b c d', 'e'] }] }).map(l => l.path.join('.')), ['steps.0.items.0', 'steps.0.items.1'])
  assert.deepEqual(textLeaves({ kind: 'assignment', items: [{ label: 'Bài 1', text: 'abcd' }] }).map(l => l.path.join('.')), ['items.0.text'])
  assert.deepEqual(textLeaves({ kind: 'study', blocks: [{ b: 'table', rows: [['A', 'B'], ['1', '___']] }, { b: 'write', label: 'x', lines: 2 }] }).map(l => l.path.join('.')),
    ['blocks.0.rows.0.0', 'blocks.0.rows.0.1', 'blocks.0.rows.1.0'])
  for (const k of ['video', 'score', 'repertoire', 'fretboard', 'checkpoint', 'layers']) assert.deepEqual(textLeaves({ kind: k, title: 'x', url: 'https://y', text: 'z', lead: 'l', items: ['a'] }), [], `${k} không có lá`)
})
