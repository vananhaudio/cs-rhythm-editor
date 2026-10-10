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
