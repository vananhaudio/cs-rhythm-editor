// Sửa hợp âm theo CHỮ HÁT trên chuỗi chuẩn "Chiều [Am] nao, tiễn nhau [E7] đi".
// File thuần TS (không React/DOM): chuỗi văn bản vẫn là nguồn sự thật duy nhất — hàm ở đây chỉ chèn / đổi / xoá
// đúng một dấu [hợp âm], không đụng vào lời, khoảng trắng hay các dòng khác.
//
// Bất biến (được kiểm lại ở cuối mỗi lần sửa; vi phạm → không sửa, trả lý do):
//   • mọi dòng khác dòng được sửa giữ nguyên từng byte;
//   • dòng được sửa có CÙNG nhãn, CÙNG dãy chữ hát, CÙNG số vị trí chữ (token) như trước
//     → vạch nhịp (line, token) của bài vẫn trỏ đúng chữ cũ.
import { canonicalChordText } from './chordText.ts'
import { lyricTokens } from './chordAnchors.ts'

// Cùng mẫu với chordText.ts: [Am] [E7] [F#m7b5] [C/G] — không khoảng trắng đầu, không xuống dòng, tối đa 16 ký tự.
const MARKER = /\[([^[\]\s][^[\]\n]{0,15})\]/g
const WORD = /\S+/g

export type ChordCell =
  | { kind: 'label'; text: string }
  /** Một chữ hát. `token` = vị trí trong dòng (khớp `lyricTokens`/vạch nhịp); `joined` = dính liền chữ trước (không khoảng trắng: "ti[Am]ễn"). */
  | { kind: 'word'; token: number; word: string; chord: string | null; joined: boolean }
  /** Hợp âm không đứng trên chữ nào ở dạng sửa được: hợp âm cuối dòng, hay hợp âm bị hợp âm liền sau che. Chỉ hiển thị. */
  | { kind: 'chord'; chord: string; token: number | null }

type Marker = { start: number; end: number; chord: string }
type Located = { word: string; start: number; end: number; token: number; marker: Marker | null; joined: boolean }
type Scan = { label: string | null; cells: Located[]; extras: { marker: Marker; before: number; token: number | null }[] }

/** Quét một dòng thô, giữ vị trí ký tự. Cùng quy tắc với `lyricTokens` (test đối chiếu). */
function scan(line: string): Scan {
  const label = lyricTokens(line).label
  const cells: Located[] = []
  const extras: Scan['extras'] = []
  let pending: Marker | null = null
  let labelSeen = label === null
  let token = 0
  let cursor = 0
  /** Đầu ngoặc của mọi hợp âm đã gặp, khoá theo vị trí cuối ngoặc — để lùi qua "[Am][E7]". */
  const markerStarts = new Map<number, number>()
  const words = (from: number, to: number) => {
    const text = line.slice(from, to)
    WORD.lastIndex = 0
    for (let match = WORD.exec(text); match; match = WORD.exec(text)) {
      const start = from + match.index
      const end = start + match[0].length
      if (!labelSeen) { labelSeen = true; continue }
      // Mép trái của chữ = đầu ngoặc hợp âm gắn với nó (nếu có). Dính liền chữ trước khi ký tự ngay trước mép không phải khoảng trắng.
      let edge = pending ? pending.start : start
      while (markerStarts.has(edge)) edge = markerStarts.get(edge)!      // lùi qua các hợp âm đứng liền nhau
      cells.push({ word: match[0], start, end, token, marker: pending, joined: edge > 0 && !/\s/.test(line[edge - 1]) })
      pending = null
      token += 1
    }
  }
  MARKER.lastIndex = 0
  for (let match = MARKER.exec(line); match; match = MARKER.exec(line)) {
    words(cursor, match.index)
    // Hợp âm đang chờ chữ mà lại gặp hợp âm khác: hợp âm cũ không gắn được vào chữ nào (lyricTokens cũng bỏ nó).
    if (pending) extras.push({ marker: pending, before: cells.length, token: null })
    pending = { start: match.index, end: match.index + match[0].length, chord: match[1].trim() }
    markerStarts.set(pending.end, pending.start)
    cursor = match.index + match[0].length
  }
  words(cursor, line.length)
  if (pending) extras.push({ marker: pending, before: cells.length, token })
  return { label, cells, extras }
}

/** Dòng → các ô để vẽ: nhãn, từng chữ (kèm hợp âm ngay trên nó), hợp âm lẻ. Thứ tự đúng thứ tự đọc. */
export function chordLineCells(line: string): ChordCell[] {
  const { label, cells, extras } = scan(line)
  const out: ChordCell[] = []
  if (label !== null) out.push({ kind: 'label', text: label })
  const put = (at: number) => { for (const extra of extras) if (extra.before === at) out.push({ kind: 'chord', chord: extra.marker.chord, token: extra.token }) }
  cells.forEach((cell, at) => {
    put(at)
    out.push({ kind: 'word', token: cell.token, word: cell.word, chord: cell.marker?.chord ?? null, joined: cell.joined })
  })
  put(cells.length)
  return out
}

export type SetChordResult = { ok: true; text: string; changed: boolean } | { ok: false; reason: string }

const CHORD_NAME = /^[^[\]\s][^[\]\n]{0,15}$/

/** Tên hợp âm hợp lệ sau khi cắt khoảng trắng đầu/cuối; không hợp lệ → null. */
export function normalizeChord(input: string): string | null {
  const name = input.trim()
  return CHORD_NAME.test(name) ? name : null
}

const sameWords = (a: ReturnType<typeof lyricTokens>, b: ReturnType<typeof lyricTokens>) =>
  a.label === b.label && a.tokens.length === b.tokens.length && a.tokens.every((token, at) => token.word === b.tokens[at].word)

/**
 * Đặt hợp âm cho chữ hát thứ `token` (đếm từ 0, không tính nhãn) của dòng `line` (đếm từ 0 trong lời đã chuẩn hoá).
 *   • chord = tên → chưa có hợp âm: chèn "[tên] " ngay trước chữ; đã có: đổi tên trong ngoặc, giữ nguyên chỗ.
 *   • chord = null → xoá hợp âm gắn với chữ (và một khoảng trắng liền sau nếu đó là khoảng trắng phân cách).
 * Văn bản trả về ở dạng chuẩn hoá (cùng phép với `canonicalChordText`).
 */
export function setChordAtToken(text: string, line: number, token: number, chord: string | null): SetChordResult {
  const lines = canonicalChordText(text).split('\n')
  if (!Number.isInteger(line) || line < 0 || line >= lines.length) return { ok: false, reason: 'Không tìm thấy dòng này.' }
  const name = chord === null ? null : normalizeChord(chord)
  if (chord !== null && name === null) return { ok: false, reason: 'Tên hợp âm không hợp lệ (tối đa 16 ký tự, không có khoảng trắng đầu, không chứa [ ]).' }

  const source = lines[line]
  const target = scan(source).cells.find(cell => cell.token === token)
  if (!target) return { ok: false, reason: 'Không tìm thấy chữ này trong dòng.' }

  let next: string
  if (target.marker) {
    const { start, end } = target.marker
    if (name !== null) next = source.slice(0, start) + `[${name}]` + source.slice(end)
    else {
      // Bỏ thêm MỘT khoảng trắng đứng sau ngoặc khi ngoặc đứng đầu dòng / sau khoảng trắng ("nhau [E7] đi" → "nhau đi").
      const spaced = source[end] === ' ' && (start === 0 || /\s/.test(source[start - 1]))
      next = source.slice(0, start) + source.slice(spaced ? end + 1 : end)
    }
  } else if (name !== null) {
    next = source.slice(0, target.start) + `[${name}] ` + source.slice(target.start)
  } else {
    return { ok: true, text: lines.join('\n'), changed: false }
  }

  // Cổng an toàn: sửa hợp âm tuyệt đối không được làm đổi lời hay vị trí chữ (ví dụ xoá [Am] trong "ti[Am]ễn" sẽ dính hai chữ).
  if (!sameWords(lyricTokens(source), lyricTokens(next))) {
    return { ok: false, reason: 'Sửa hợp âm này sẽ làm đổi cách tách chữ của câu (và lệch vạch nhịp) — hãy sửa trực tiếp trong ô văn bản.' }
  }
  const out = [...lines]
  out[line] = next
  const joined = out.join('\n')
  return { ok: true, text: joined, changed: joined !== lines.join('\n') }
}

// ── Vị trí nghỉ "(-)" ───────────────────────────────────────────────────────────────────────────
// "(-)" là MỘT chữ giữ chỗ: không có khoảng trắng bên trong nên parser TS (`lyricTokens`) và SQL
// (`chord_lyric_token_counts`) cùng đếm nó là đúng một token — hai bên được đối chiếu trong test.
// Nó không là dấu nghỉ MusicXML và không mang trường độ: chỉ là một vị trí để đặt hợp âm / vạch nhịp.
// Các hàm dưới đây CHỈ chèn / xoá đúng token "(-)" (cùng hợp âm gắn trên nó), không đụng lời thật.

export const REST = '(-)'
export const isRest = (word: string) => word === REST

export type RestEdit =
  | { ok: true; text: string; line: number; /** vị trí token của "(-)" vừa chèn / vừa xoá */ at: number; kind: 'insert' | 'remove' }
  | { ok: false; reason: string }

type Tokens = ReturnType<typeof lyricTokens>
const words = (view: Tokens) => view.tokens.map(token => token.word)

/** Kiểm bất biến sau khi chèn/xoá: cùng nhãn; dãy chữ = dãy cũ có thêm/bớt đúng một "(-)" ở vị trí `at`. */
function restOk(before: string, after: string, at: number, kind: 'insert' | 'remove'): boolean {
  const a = lyricTokens(before)
  const b = lyricTokens(after)
  if (a.label !== b.label) return false
  const expected = words(a)
  if (kind === 'insert') expected.splice(at, 0, REST)
  else { if (expected[at] !== REST) return false; expected.splice(at, 1) }
  const got = words(b)
  return expected.length === got.length && expected.every((word, index) => word === got[index])
}

function splice(source: string, from: number, to: number, insert: string): string {
  return source.slice(0, from) + insert + source.slice(to)
}

/** Thêm "(-)" liền TRƯỚC hoặc liền SAU chữ thứ `token` (chữ thật hay "(-)" khác — nên tạo được nhiều vị trí nghỉ liên tiếp). */
export function insertRest(text: string, line: number, token: number, side: 'before' | 'after'): RestEdit {
  const lines = canonicalChordText(text).split('\n')
  if (!Number.isInteger(line) || line < 0 || line >= lines.length) return { ok: false, reason: 'Không tìm thấy dòng này.' }
  const source = lines[line]
  const cells = scan(source).cells
  const target = cells.find(cell => cell.token === token)
  if (!target) return { ok: false, reason: 'Không tìm thấy chữ này trong dòng.' }
  // Chữ dính liền chữ bên cạnh ("ti[Am]ễn"): chèn vào giữa sẽ tách đôi cách viết — từ chối, không tự ý đổi lời.
  const glued = side === 'before' ? target.joined : !!cells.find(cell => cell.token === token + 1)?.joined
  if (glued) return { ok: false, reason: 'Chữ này dính liền chữ bên cạnh (ví dụ ti[Am]ễn) — hãy chèn nghỉ ở chữ khác, hoặc sửa trong ô văn bản.' }
  // "before": đặt trước cả ngoặc hợp âm của chữ → hợp âm vẫn ở lại với chữ cũ, "(-)" không mang hợp âm.
  const index = side === 'before' ? (target.marker ? target.marker.start : target.start) : target.end
  const left = index > 0 && !/\s/.test(source[index - 1]) ? ' ' : ''
  const right = index < source.length && !/\s/.test(source[index]) ? ' ' : ''
  const next = splice(source, index, index, `${left}${REST}${right}`)
  const at = side === 'before' ? token : token + 1
  if (!restOk(source, next, at, 'insert')) return { ok: false, reason: 'Không chèn được vị trí nghỉ ở đây mà không làm đổi cách tách chữ.' }
  const out = [...lines]
  out[line] = next
  return { ok: true, text: out.join('\n'), line, at, kind: 'insert' }
}

/** Thêm "(-)" vào dòng CHƯA có chữ nào (dòng trống, dòng chỉ có nhãn như "Dạo:") — nghỉ trong đoạn không lời. */
export function appendRestToEmptyLine(text: string, line: number): RestEdit {
  const lines = canonicalChordText(text).split('\n')
  if (!Number.isInteger(line) || line < 0 || line >= lines.length) return { ok: false, reason: 'Không tìm thấy dòng này.' }
  const source = lines[line]
  if (lyricTokens(source).tokens.length > 0) return { ok: false, reason: 'Dòng này đã có chữ — hãy thêm nghỉ trước/sau một chữ.' }
  const next = source.trim() ? `${source.trimEnd()} ${REST}` : REST
  if (!restOk(source, next, 0, 'insert')) return { ok: false, reason: 'Không thêm được vị trí nghỉ vào dòng này.' }
  const out = [...lines]
  out[line] = next
  return { ok: true, text: out.join('\n'), line, at: 0, kind: 'insert' }
}

/** Xoá một vị trí nghỉ — kèm hợp âm đang đặt trên nó (người dùng được báo trước ở nút). Lời thật không bị đụng. */
export function removeRest(text: string, line: number, token: number): RestEdit {
  const lines = canonicalChordText(text).split('\n')
  if (!Number.isInteger(line) || line < 0 || line >= lines.length) return { ok: false, reason: 'Không tìm thấy dòng này.' }
  const source = lines[line]
  const target = scan(source).cells.find(cell => cell.token === token)
  if (!target || !isRest(target.word)) return { ok: false, reason: 'Chữ này không phải vị trí nghỉ.' }
  let from = target.marker ? target.marker.start : target.start
  let to = target.end
  if (source[to] === ' ' && (from === 0 || /\s/.test(source[from - 1]))) to += 1
  else if (to === source.length && from > 0 && source[from - 1] === ' ') from -= 1
  const next = splice(source, from, to, '')
  if (!restOk(source, next, token, 'remove')) return { ok: false, reason: 'Không xoá được vị trí nghỉ này mà không làm đổi cách tách chữ.' }
  const out = [...lines]
  out[line] = next
  return { ok: true, text: out.join('\n'), line, at: token, kind: 'remove' }
}

/** Hai văn bản có CÙNG nhãn + CÙNG dãy chữ ở mọi dòng (chỉ khác hợp âm / khoảng trắng) → vạch nhịp vẫn đúng chỗ. */
export function sameLyricStructure(a: string, b: string): boolean {
  const left = canonicalChordText(a).split('\n')
  const right = canonicalChordText(b).split('\n')
  if (left.length !== right.length) return false
  return left.every((line, index) => {
    const x = lyricTokens(line)
    const y = lyricTokens(right[index])
    return x.label === y.label && x.tokens.length === y.tokens.length && x.tokens.every((token, at) => token.word === y.tokens[at].word)
  })
}

// ── Đồng bộ vạch nhịp khi chèn / xoá "(-)" ──────────────────────────────────────────────────────
// Vạch = (line, token). Chèn/xoá một token ở dòng L chỉ dịch các vạch CÙNG dòng L (và cùng nhịp lấy đà); dòng khác,
// ô không lời (line null) giữ nguyên. Quy ước khi vạch đứng đúng ở khe chèn:
//   • chèn "trước chữ p": vạch tại p ở lại TRƯỚC "(-)" → "(-)" thuộc ô bắt đầu ở vạch đó;
//   • chèn "sau chữ k":  vạch tại k+1 dời ra SAU "(-)" → "(-)" ở lại cuối ô chứa chữ k.
// Đó là ánh xạ xác định nhưng vẫn là một lựa chọn: các vạch này được liệt kê trong `atGap` để giao diện CẢNH BÁO.
import type { ChordAnchors, MeasureAnchor } from './chordAnchors.ts'

export type AnchorRemap = {
  anchors: ChordAnchors
  /** Chỉ số (0-based, theo dòng thời gian) các ô có vạch đúng ở khe chèn — cần người dùng xem lại. */
  atGap: number[]
  /** Chỉ số các ô bị trùng vị trí với ô liền trước sau khi xoá (thành "ô ngân") — cần xem lại. */
  merged: number[]
}

function mapAnchors(anchors: ChordAnchors, f: (anchor: MeasureAnchor) => MeasureAnchor, ids: (anchor: MeasureAnchor) => boolean): AnchorRemap {
  const atGap: number[] = []
  const merged: number[] = []
  const measures = anchors.measures.map((anchor, index) => { if (ids(anchor)) atGap.push(index); return f(anchor) })
  measures.forEach((anchor, index) => {
    const previous = measures[index - 1]
    const was = anchors.measures[index - 1]
    if (previous && anchor.line !== null && previous.line === anchor.line && previous.token === anchor.token
      && !(was && was.line === anchors.measures[index].line && was.token === anchors.measures[index].token)) merged.push(index)
  })
  return { anchors: { ...(anchors.pickup ? { pickup: f(anchors.pickup) } : {}), measures }, atGap, merged }
}

export function remapAnchorsForInsert(anchors: ChordAnchors, line: number, at: number, side: 'before' | 'after'): AnchorRemap {
  // `at` = vị trí token của "(-)" mới. 'before': vạch tại `at` ở lại; 'after': vạch tại `at` dời +1.
  const moves = (anchor: MeasureAnchor) => anchor.line === line && anchor.token !== null && (side === 'after' ? anchor.token >= at : anchor.token > at)
  return mapAnchors(anchors, anchor => (moves(anchor) ? { line: anchor.line, token: (anchor.token as number) + 1 } : anchor),
    anchor => anchor.line === line && anchor.token === at)
}

export function remapAnchorsForRemove(anchors: ChordAnchors, line: number, at: number): AnchorRemap {
  // Vạch tại `at` (trước "(-)") đứng nguyên; vạch sau token bị xoá lùi 1.
  return mapAnchors(anchors, anchor => (anchor.line === line && anchor.token !== null && anchor.token > at ? { line: anchor.line, token: anchor.token - 1 } : anchor),
    anchor => anchor.line === line && (anchor.token === at || anchor.token === at + 1))
}

/**
 * Dịch vạch của ô `index` sang khe liền trước / liền sau CÙNG dòng. Ở mép dòng thì sang mép của dòng kế có chữ.
 * Trả null nếu không dịch được (ô không lời, hay hết bài). Không đụng các ô khác.
 */
export function nudgeMeasure(measures: MeasureAnchor[], index: number, delta: -1 | 1, tokenCounts: number[]): MeasureAnchor[] | null {
  const anchor = measures[index]
  if (!anchor || anchor.line === null || anchor.token === null) return null
  let line = anchor.line
  let token = anchor.token + delta
  if (token < 0) {
    line -= 1
    while (line >= 0 && tokenCounts[line] === 0) line -= 1
    if (line < 0) return null
    token = tokenCounts[line]
  } else if (token > tokenCounts[line]) {
    line += 1
    while (line < tokenCounts.length && tokenCounts[line] === 0) line += 1
    if (line >= tokenCounts.length) return null
    token = 0
  }
  return measures.map((entry, at) => (at === index ? { line, token } : entry))
}
