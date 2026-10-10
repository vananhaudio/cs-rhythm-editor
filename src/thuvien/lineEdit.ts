// Chỉnh sửa lời THEO DÒNG: sửa chữ, thêm / xoá dòng, chép một đoạn dòng vào chỗ khác — kèm ánh xạ vạch nhịp.
// File thuần TS (không React/DOM). Chuỗi lời + hợp âm vẫn là nguồn sự thật; vạch nhịp là (line, token) nên mọi thao tác
// ở đây trả về CẶP (lines, anchors) mới + danh sách cảnh báo. KHÔNG bao giờ xoá cả bộ vạch: vạch không ánh xạ chắc chắn
// thì được giữ ở vị trí gần nhất và NÊU RÕ để người dùng kiểm tra lại.
//
// Quy ước (Owner duyệt):
//   • Chép đoạn [from..to] vào TRƯỚC dòng `at`: lời + hợp âm đi theo; mọi vạch trong đoạn được NHÂN ĐÔI sang bản sao.
//   • Vạch đứng đúng ở khe chèn (đầu dòng `at`) thuộc ĐOẠN CŨ: dịch xuống cùng đoạn cũ, không dính vào bản sao.
//   • Ô nhịp bắt qua ranh giới (đầu/cuối đoạn chép, khe chèn, ranh giới đoạn xoá) → cảnh báo, nêu số ô.
//   • Không suy diễn hồi tấu / D.C. / D.S. / Coda từ lời.
import { canonicalChordText } from './chordText.ts'
import { lyricTokens } from './chordAnchors.ts'
import type { ChordAnchors, MeasureAnchor } from './chordAnchors.ts'

export type LineDraft = { lines: string[]; anchors: ChordAnchors | null }
export type LineEditResult = { ok: true; draft: LineDraft; notes: string[] } | { ok: false; reason: string }

const countOf = (line: string) => lyricTokens(line).tokens.length

export function draftOf(text: string, anchors: ChordAnchors | null): LineDraft {
  return { lines: canonicalChordText(text).split('\n'), anchors: anchors ? clone(anchors) : null }
}
export const textOf = (draft: LineDraft) => draft.lines.join('\n')

const clone = (anchors: ChordAnchors): ChordAnchors => ({
  ...(anchors.pickup ? { pickup: { ...anchors.pickup } } : {}),
  measures: anchors.measures.map(anchor => ({ ...anchor })),
})

/** Vị trí tuyến tính của một vạch = tổng chữ các dòng trước + token. null = ô không lời. */
function positions(lines: string[]) {
  const prefix: number[] = [0]
  lines.forEach((line, at) => prefix.push(prefix[at] + countOf(line)))
  return {
    prefix,
    of: (anchor: MeasureAnchor): number | null => (anchor.line === null || anchor.token === null || anchor.line >= lines.length ? null : prefix[anchor.line] + anchor.token),
  }
}

/**
 * Ranh giới TRƯỚC dòng L (0 = đầu bài, lines.length = cuối bài). Trả chỉ số ô nhịp đang "mở" qua ranh giới (bắt đầu trước,
 * kết thúc sau), hoặc null nếu một ô bắt đầu đúng ranh giới / không có ô nào đi qua.
 */
function straddling(draft: LineDraft, boundary: number): number | null {
  if (!draft.anchors || boundary <= 0 || boundary >= draft.lines.length) return null
  const pos = positions(draft.lines)
  const edge = pos.prefix[boundary]
  const measures = draft.anchors.measures
  let open: number | null = null
  for (let at = 0; at < measures.length; at += 1) {
    const here = pos.of(measures[at])
    if (here === null) continue
    if (here === edge) return null
    if (here < edge) open = at
  }
  return open
}

/** Số vạch (ô nhịp + nhịp lấy đà) nằm trong các dòng [from..to]. */
export function countBarsInLines(draft: LineDraft, from: number, to: number): number {
  if (!draft.anchors) return 0
  const inside = (anchor: MeasureAnchor) => anchor.line !== null && anchor.line >= from && anchor.line <= to
  return draft.anchors.measures.filter(inside).length + (draft.anchors.pickup && inside(draft.anchors.pickup) ? 1 : 0)
}

const shift = (anchor: MeasureAnchor, from: number, by: number): MeasureAnchor =>
  (anchor.line !== null && anchor.line >= from ? { line: anchor.line + by, token: anchor.token } : anchor)

function inRange(lines: string[], from: number, to: number) {
  return Number.isInteger(from) && Number.isInteger(to) && from >= 0 && to >= from && to < lines.length
}

/** Thêm `count` dòng trống TRƯỚC dòng `at` (at = số dòng → thêm cuối bài). Vạch từ dòng `at` trở xuống dời xuống `count` dòng. */
export function insertLines(draft: LineDraft, at: number, count = 1): LineEditResult {
  if (!Number.isInteger(at) || at < 0 || at > draft.lines.length) return { ok: false, reason: 'Vị trí chèn không hợp lệ.' }
  const lines = [...draft.lines]
  lines.splice(at, 0, ...Array<string>(count).fill(''))
  const anchors = draft.anchors
    ? { ...(draft.anchors.pickup ? { pickup: shift(draft.anchors.pickup, at, count) } : {}), measures: draft.anchors.measures.map(anchor => shift(anchor, at, count)) }
    : null
  const split = straddling(draft, at)
  return { ok: true, draft: { lines, anchors }, notes: split === null ? [] : [`Chỗ thêm dòng nằm giữa ô ${split + 1} — kiểm tra lại ô này.`] }
}

/** Xoá các dòng [from..to]. Vạch trong các dòng đó bị xoá; vạch sau dời lên. Trả `removed` = số vạch bị xoá. */
export function deleteLines(draft: LineDraft, from: number, to: number): LineEditResult & { removed?: number } {
  if (!inRange(draft.lines, from, to)) return { ok: false, reason: 'Không tìm thấy dòng cần xoá.' }
  const size = to - from + 1
  if (size >= draft.lines.length) return { ok: false, reason: 'Không xoá hết mọi dòng của bài.' }
  const notes: string[] = []
  const removed = countBarsInLines(draft, from, to)
  const lines = draft.lines.filter((_, at) => at < from || at > to)
  let anchors: ChordAnchors | null = null
  if (draft.anchors) {
    const keep = (anchor: MeasureAnchor) => anchor.line === null || anchor.line < from || anchor.line > to
    const move = (anchor: MeasureAnchor): MeasureAnchor => (anchor.line !== null && anchor.line > to ? { line: anchor.line - size, token: anchor.token } : anchor)
    const measures = draft.anchors.measures.filter(keep).map(move)
    const pickup = draft.anchors.pickup && keep(draft.anchors.pickup) ? move(draft.anchors.pickup) : null
    anchors = measures.length ? { ...(pickup ? { pickup } : {}), measures } : null
    if (!measures.length && draft.anchors.measures.length) notes.push('Mọi vạch nhịp nằm trong các dòng đã xoá — bài không còn vạch nhịp.')
    const first = measures.length ? straddling(draft, from) : null
    const last = measures.length ? straddling(draft, to + 1) : null
    if (first !== null) notes.push(`Ô ${first + 1} bắt đầu trước đoạn đã xoá và kéo dài vào trong đó — kiểm tra lại.`)
    if (last !== null && last !== first) notes.push(`Ô ${last + 1} bắt đầu trong đoạn đã xoá và kéo dài ra sau — kiểm tra lại.`)
  }
  return { ok: true, draft: { lines, anchors }, notes, removed }
}

/**
 * Chép các dòng [from..to] thành bản sao đặt TRƯỚC dòng `at` (0..số dòng). Vạch trong đoạn được nhân đôi;
 * vạch từ dòng `at` trở xuống dời xuống `to-from+1` dòng (vạch ở khe chèn đi cùng đoạn cũ).
 */
export function copyLines(draft: LineDraft, from: number, to: number, at: number): LineEditResult {
  if (!inRange(draft.lines, from, to)) return { ok: false, reason: 'Không tìm thấy các dòng cần chép.' }
  if (!Number.isInteger(at) || at < 0 || at > draft.lines.length) return { ok: false, reason: 'Vị trí chèn không hợp lệ.' }
  const size = to - from + 1
  const lines = [...draft.lines]
  lines.splice(at, 0, ...draft.lines.slice(from, to + 1))
  if (!draft.anchors) return { ok: true, draft: { lines, anchors: null }, notes: [] }

  const source = draft.anchors.measures
  const inside = (anchor: MeasureAnchor) => anchor.line !== null && anchor.line >= from && anchor.line <= to
  const moved = source.map(anchor => shift(anchor, at, size))
  // Bản sao: mọi vạch có lời trong đoạn + ô không lời nằm GIỮA vạch đầu và vạch cuối của đoạn.
  const inner = source.map((anchor, index) => (inside(anchor) ? index : -1)).filter(index => index >= 0)
  const copies: MeasureAnchor[] = []
  if (inner.length) {
    for (let index = inner[0]; index <= inner[inner.length - 1]; index += 1) {
      const anchor = source[index]
      if (anchor.line === null) copies.push({ line: null, token: null })
      else if (inside(anchor)) copies.push({ line: at + (anchor.line - from), token: anchor.token })
    }
  }
  // Chỗ chèn trong mảng: trước vạch có lời đầu tiên ở dòng ≥ at; không có thì cuối mảng.
  let ins = source.findIndex(anchor => anchor.line !== null && anchor.line >= at)
  if (ins < 0) ins = source.length
  const notes: string[] = []
  const gapNulls = source.slice(0, ins).reverse().findIndex(anchor => anchor.line !== null)
  const nullsBeforeGap = gapNulls < 0 ? ins : gapNulls
  if (copies.length && nullsBeforeGap > 0) notes.push('Có ô không lời ngay trước chỗ chèn — kiểm tra thứ tự ô quanh bản sao.')
  const measures = [...moved.slice(0, ins), ...copies, ...moved.slice(ins)]
  const pickup = draft.anchors.pickup ? shift(draft.anchors.pickup, at, size) : null
  const renumber = (index: number) => (index < ins ? index : index + copies.length)

  const start = straddling(draft, from)
  const end = straddling(draft, to + 1)
  const gap = straddling(draft, at)
  if (copies.length) {
    if (start !== null) notes.push(`Đoạn chép bắt đầu giữa ô ${renumber(start) + 1} — ô đầu của bản sao (ô ${ins + 1}) có thể thiếu phần đầu, kiểm tra lại.`)
    if (end !== null) {
      const at2 = inner.indexOf(end)
      notes.push(`Ô cuối của bản sao${at2 >= 0 ? ` (ô ${ins + (end - inner[0]) + 1})` : ''} kéo dài sang dòng sau đoạn gốc — kiểm tra phần nối với đoạn tiếp theo.`)
    }
  }
  if (gap !== null) notes.push(`Chỗ chèn nằm giữa ô ${renumber(gap) + 1} — ô này bị đoạn chép tách đôi, kiểm tra lại.`)
  return { ok: true, draft: { lines, anchors: { ...(pickup ? { pickup } : {}), measures } }, notes }
}

/**
 * Thay nội dung một dòng (sửa chữ / hợp âm). Số chữ không đổi → vạch giữ nguyên. Số chữ đổi → vạch ở đầu dòng và cuối dòng
 * đi theo đầu/cuối; vạch ở GIỮA dòng giữ token cũ (kẹp vào số chữ mới) và được cảnh báo.
 */
export function editLine(draft: LineDraft, line: number, next: string): LineEditResult {
  if (!Number.isInteger(line) || line < 0 || line >= draft.lines.length) return { ok: false, reason: 'Không tìm thấy dòng này.' }
  const clean = next.replace(/[\r\n]+/g, ' ')
  const before = countOf(draft.lines[line])
  const after = countOf(clean)
  const lines = [...draft.lines]
  lines[line] = clean
  if (!draft.anchors || before === after) return { ok: true, draft: { lines, anchors: draft.anchors }, notes: [] }
  const notes: string[] = []
  let touched = false
  const map = (anchor: MeasureAnchor): MeasureAnchor => {
    if (anchor.line !== line || anchor.token === null) return anchor
    if (anchor.token === 0) return anchor
    if (anchor.token >= before) return { line, token: after }          // vạch cuối dòng vẫn ở cuối dòng
    touched = true
    return { line, token: Math.min(anchor.token, after) }
  }
  const measures = draft.anchors.measures.map(map)
  const pickup = draft.anchors.pickup ? map(draft.anchors.pickup) : null
  if (touched) notes.push(`Dòng ${line + 1} đổi số chữ (${before} → ${after}): vạch nhịp giữa dòng này cần kiểm tra lại.`)
  return { ok: true, draft: { lines, anchors: { ...(pickup ? { pickup } : {}), measures } }, notes }
}

/**
 * Kiểm lần cuối trước khi áp vào bản nhạc: vạch phải trỏ vào dòng có chữ và token ≤ số chữ (máy chủ từ chối nếu không).
 * Vạch hỏng được kẹp/gỡ riêng từng cái và báo; KHÔNG xoá cả bộ.
 */
export function repairAnchors(draft: LineDraft): { draft: LineDraft; notes: string[] } {
  if (!draft.anchors) return { draft, notes: [] }
  const notes: string[] = []
  const counts = draft.lines.map(countOf)
  const fix = (anchor: MeasureAnchor, what: string): MeasureAnchor | null => {
    if (anchor.line === null || anchor.token === null) return anchor
    if (anchor.line >= counts.length || counts[anchor.line] === 0) { notes.push(`${what}: dòng ${anchor.line + 1} không còn chữ hát — vạch này đã được gỡ, hãy đặt lại.`); return null }
    if (anchor.token > counts[anchor.line]) { notes.push(`${what}: dòng ${anchor.line + 1} chỉ còn ${counts[anchor.line]} chữ — vạch được dời về cuối dòng, kiểm tra lại.`); return { line: anchor.line, token: counts[anchor.line] } }
    return anchor
  }
  const measures: MeasureAnchor[] = []
  draft.anchors.measures.forEach((anchor, index) => { const fixed = fix(anchor, `Ô ${index + 1}`); if (fixed) measures.push(fixed) })
  const pickup = draft.anchors.pickup ? fix(draft.anchors.pickup, 'Nhịp lấy đà') : null
  if (!measures.length) return { draft: { lines: draft.lines, anchors: null }, notes: [...notes, 'Không còn vạch nhịp nào hợp lệ.'] }
  return { draft: { lines: draft.lines, anchors: { ...(pickup ? { pickup } : {}), measures } }, notes }
}
