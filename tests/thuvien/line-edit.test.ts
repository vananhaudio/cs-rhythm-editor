// Chỉnh sửa lời theo dòng: sửa chữ / thêm / xoá / chép đoạn + ánh xạ vạch nhịp (src/thuvien/lineEdit.ts).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canonicalChordText } from '../../src/thuvien/chordText.ts'
import { parseAnchors, lyricTokens } from '../../src/thuvien/chordAnchors.ts'
import type { ChordAnchors } from '../../src/thuvien/chordAnchors.ts'
import { copyLines, countBarsInLines, deleteLines, draftOf, editLine, insertLines, repairAnchors, textOf } from '../../src/thuvien/lineEdit.ts'
import type { LineDraft } from '../../src/thuvien/lineEdit.ts'

const TEXT = [
  '1. [Am] Chiều nao tiền nhau [E7] đi',
  '[Dm] Mùa thu về bên [G] em',
  'ĐK: [C] Hát lên cùng nhau',
  '[F] Rồi ta [G] hát lại',
  'Coda: [Am] Hết rồi',
].join('\n')
const at = (line: number, token: number) => ({ line, token })
const BARS: ChordAnchors = { measures: [at(0, 0), at(0, 3), at(1, 0), at(1, 3), at(2, 0), at(2, 2), at(3, 0), at(3, 2), at(4, 0)] }
const start = () => draftOf(TEXT, BARS)
const ok = (result: ReturnType<typeof copyLines>) => { assert.ok(result.ok, result.ok ? '' : result.reason); return result as Extract<typeof result, { ok: true }> }
/** Chữ hát đứng ngay sau mỗi vạch — bất biến "vạch trỏ đúng chữ" bất kể dòng bị dời đi đâu. */
const wordsAfterBars = (draft: LineDraft) => (draft.anchors?.measures ?? []).map(anchor => {
  if (anchor.line === null || anchor.token === null) return null
  const tokens = lyricTokens(draft.lines[anchor.line]).tokens
  return tokens[anchor.token]?.word ?? '<hết dòng>'
})

test('sửa chữ nhưng giữ số chữ → vạch nhịp giữ nguyên, hợp âm giữ nguyên', () => {
  const result = ok(editLine(start(), 1, '[Dm] Mùa đông về bên [G] anh'))
  assert.deepEqual(result.draft.anchors, BARS)
  assert.deepEqual(result.notes, [])
  assert.equal(result.draft.lines[1], '[Dm] Mùa đông về bên [G] anh')
  assert.deepEqual(result.draft.lines.filter((_, i) => i !== 1), start().lines.filter((_, i) => i !== 1), 'dòng khác nguyên byte')
})

test('sửa chữ đổi số chữ → vạch đầu/cuối dòng theo đầu/cuối, vạch giữa dòng được CẢNH BÁO, không xoá bộ vạch', () => {
  const result = ok(editLine(start(), 0, '1. [Am] Chiều nao tiền nhau [E7] đi xa lắm'))   // 5 → 7
  assert.equal(result.draft.anchors?.measures.length, BARS.measures.length)
  assert.deepEqual(result.draft.anchors?.measures[1], at(0, 3), 'vạch giữa dòng giữ token cũ')
  assert.ok(result.notes.some(note => note.includes('Dòng 1') && note.includes('5 → 7')))
  const shorter = ok(editLine(start(), 1, '[Dm] Mùa thu'))                                // 5 → 2: vạch (1,3) kẹp về 2
  assert.deepEqual(shorter.draft.anchors?.measures[3], at(1, 2))
  assert.ok(shorter.notes.length > 0)
  // vạch cuối dòng đi theo cuối dòng, không cảnh báo
  const endBar: ChordAnchors = { measures: [at(0, 0), at(0, 5), at(1, 0)] }
  const moved = ok(editLine(draftOf(TEXT, endBar), 0, '1. [Am] Chiều nao tiền nhau [E7] đi xa'))
  assert.deepEqual(moved.draft.anchors?.measures[1], at(0, 6))
  assert.deepEqual(moved.notes, [])
})

test('chèn dòng → vạch phía sau dời đúng, phía trước đứng yên', () => {
  const result = ok(insertLines(start(), 2))
  assert.equal(result.draft.lines.length, 6)
  assert.equal(result.draft.lines[2], '')
  assert.deepEqual(result.draft.anchors?.measures, [at(0, 0), at(0, 3), at(1, 0), at(1, 3), at(3, 0), at(3, 2), at(4, 0), at(4, 2), at(5, 0)])
  assert.deepEqual(wordsAfterBars(result.draft), wordsAfterBars(start()), 'mỗi vạch vẫn đứng trước đúng chữ cũ')
  const appended = ok(insertLines(start(), 5))
  assert.deepEqual(appended.draft.anchors, BARS)
})

test('xoá dòng → vạch của dòng đó mất, vạch còn lại dời đúng; đếm trước để xác nhận', () => {
  assert.equal(countBarsInLines(start(), 1, 1), 2)
  const result = deleteLines(start(), 1, 1)
  assert.ok(result.ok)
  if (!result.ok) return
  assert.equal(result.removed, 2)
  assert.deepEqual(result.draft.lines, [start().lines[0], ...start().lines.slice(2)])
  assert.deepEqual(result.draft.anchors?.measures, [at(0, 0), at(0, 3), at(1, 0), at(1, 2), at(2, 0), at(2, 2), at(3, 0)])
  assert.deepEqual(result.notes, [])
  const everything = deleteLines(start(), 0, 4)
  assert.equal(everything.ok, false)
  const noBars = deleteLines(draftOf(TEXT, { measures: [at(1, 0), at(1, 3)] }), 1, 1)
  assert.ok(noBars.ok && noBars.draft.anchors === null && noBars.notes.length === 1)
})

test('chép nhiều dòng vào trước Coda → lời, hợp âm và vạch được nhân đôi, các đoạn khác không lệch', () => {
  const result = ok(copyLines(start(), 2, 3, 4))
  const lines = result.draft.lines
  assert.equal(lines.length, 7)
  assert.deepEqual(lines.slice(4, 6), start().lines.slice(2, 4), 'bản sao giữ nguyên lời + hợp âm')
  assert.deepEqual(lines.slice(0, 4), start().lines.slice(0, 4))
  assert.equal(lines[6], 'Coda: [Am] Hết rồi')
  assert.deepEqual(result.draft.anchors?.measures, [
    at(0, 0), at(0, 3), at(1, 0), at(1, 3), at(2, 0), at(2, 2), at(3, 0), at(3, 2),   // đoạn gốc
    at(4, 0), at(4, 2), at(5, 0), at(5, 2),                                           // bản sao (nhân đôi)
    at(6, 0),                                                                         // Coda dời xuống 2 dòng
  ])
  const words = wordsAfterBars(result.draft)
  assert.deepEqual(words.slice(0, 8), wordsAfterBars(start()).slice(0, 8))
  assert.deepEqual(words.slice(8, 12), words.slice(4, 8), 'bản sao có cùng chữ sau mỗi vạch như đoạn gốc')
  assert.equal(words[12], 'Hết')
  assert.deepEqual(result.notes, [], 'ranh giới đoạn trùng vạch → không cảnh báo')
})

test('chép đoạn vào GIỮA bài → vạch của các đoạn khác không lệch; vạch ở khe chèn thuộc đoạn cũ', () => {
  const result = ok(copyLines(start(), 0, 0, 2))                  // chép dòng 1 vào trước dòng 3
  const lines = result.draft.lines
  assert.deepEqual(lines, [start().lines[0], start().lines[1], start().lines[0], ...start().lines.slice(2)])
  const measures = result.draft.anchors?.measures ?? []
  assert.deepEqual(measures, [at(0, 0), at(0, 3), at(1, 0), at(1, 3), at(2, 0), at(2, 3), at(3, 0), at(3, 2), at(4, 0), at(4, 2), at(5, 0)])
  // (2,0) cũ — vạch đúng ở khe chèn — đã dời xuống (3,0) cùng đoạn cũ; (2,0) mới là đầu bản sao
  assert.deepEqual(lyricTokens(lines[3]).tokens[0].word, 'Hát')
  assert.equal(measures.length, BARS.measures.length + 2)
  assert.deepEqual(wordsAfterBars(result.draft).slice(6), wordsAfterBars(start()).slice(4), 'đoạn cũ (kể cả vạch ở khe chèn) giữ nguyên chữ sau mỗi vạch')
})

test('ô nhịp bắt qua ranh giới đoạn → cảnh báo nêu số ô', () => {
  // bỏ vạch (1,0): ô bắt đầu ở (0,3) kéo qua hết dòng 1 tới (1,3)
  const open: ChordAnchors = { measures: [at(0, 0), at(0, 3), at(1, 3), at(2, 0), at(3, 0)] }
  const end = ok(copyLines(draftOf(TEXT, open), 0, 0, 4))         // đoạn chép kết thúc giữa ô 2
  assert.ok(end.notes.some(note => note.includes('kéo dài sang dòng sau đoạn gốc')), end.notes.join(' | '))
  const startMid = ok(copyLines(draftOf(TEXT, open), 1, 1, 4))    // đoạn chép bắt đầu giữa ô 2
  assert.ok(startMid.notes.some(note => note.includes('bắt đầu giữa ô 2')), startMid.notes.join(' | '))
  const gap = ok(copyLines(draftOf(TEXT, open), 3, 3, 1))         // chèn vào giữa ô 2 (ranh giới trước dòng 2)
  assert.ok(gap.notes.some(note => note.includes('Chỗ chèn nằm giữa ô 2')), gap.notes.join(' | '))
  const added = ok(insertLines(draftOf(TEXT, open), 1))
  assert.ok(added.notes.some(note => note.includes('giữa ô 2')))
  const removed = deleteLines(draftOf(TEXT, open), 1, 1)
  assert.ok(removed.ok && removed.notes.length > 0)
})

test('bài chưa có vạch: mọi thao tác chạy bình thường, không phát sinh vạch', () => {
  const plain = draftOf(TEXT, null)
  const copied = ok(copyLines(plain, 0, 1, 5))
  assert.equal(copied.draft.anchors, null)
  assert.equal(copied.draft.lines.length, 7)
})

test('bản nháp ra khỏi thao tác luôn hợp lệ với bộ đọc vạch (cùng luật máy chủ) — sau chuỗi thao tác', () => {
  let draft = start()
  draft = ok(copyLines(draft, 2, 3, 4)).draft
  draft = ok(insertLines(draft, 1)).draft
  draft = ok(editLine(draft, 2, '[Dm] Mùa thu về bên [G] em')).draft
  const fixed = repairAnchors(draft)
  assert.deepEqual(fixed.notes, [])
  const parsed = parseAnchors(JSON.parse(JSON.stringify(fixed.draft.anchors)), textOf(fixed.draft))
  assert.ok(parsed, 'máy chủ/đầu đọc chấp nhận bộ vạch sau khi chỉnh')
  assert.equal(parsed?.measures.length, BARS.measures.length + 4)
  assert.equal(canonicalChordText(textOf(fixed.draft)).split('\n').length, fixed.draft.lines.length)
})

test('repairAnchors: vạch trỏ dòng không còn chữ → gỡ riêng từng vạch; không bao giờ xoá cả bộ khi còn vạch hợp lệ', () => {
  const draft: LineDraft = { lines: ['[C] một hai', '', '[G] ba'], anchors: { measures: [at(0, 0), at(1, 0), at(2, 5)] } }
  const fixed = repairAnchors(draft)
  assert.deepEqual(fixed.draft.anchors?.measures, [at(0, 0), at(2, 1)])
  assert.equal(fixed.notes.length, 2)
})
