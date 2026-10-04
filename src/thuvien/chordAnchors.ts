// Vạch nhịp (measure anchors) của một phiên bản Hợp âm chuẩn hóa — kiểu dữ liệu + cách đọc để XEM.
// Lát này KHÔNG tạo vạch nhịp, không sửa, không phân tích: chỉ đọc dữ liệu máy chủ đã có và hiện ra.
//
// Hình dạng (khớp prototype Rhythm Scroll "anchored", cột chord_sheet_versions.anchors):
//   { pickup?: { line, token }, measures: [ { line, token }, … ] }
//   • line  = dòng (0-based) trong lời + hợp âm chuẩn; null = ô KHÔNG LỜI (dạo, gian tấu) — khi đó token cũng null.
//   • token = chữ ĐẦU TIÊN hát sau vạch nhịp, đếm trong dòng sau khi bỏ [hợp âm] và bỏ NHÃN đầu dòng
//     ("1.", "2.", "ĐK:"…); token = số chữ của dòng = vạch ở cuối dòng (ô ngân sau chữ cuối).
//   • pickup = nhịp lấy đà: chữ hát trước vạch nhịp đầu tiên.
// Dữ liệu sai hình dạng → coi như KHÔNG đọc được (hiện thông báo), không làm sập trang.
import { canonicalChordText, parseChordLine } from './chordText.ts'

export type MeasureAnchor = { line: number | null; token: number | null }
export type ChordAnchors = { pickup?: MeasureAnchor; measures: MeasureAnchor[] }
export type AnchorsStatus = 'none' | 'processing' | 'needs_review' | 'ready' | 'failed'

export const ANCHORS_STATUS_LABEL: Record<AnchorsStatus, string> = {
  none: 'Chưa phân tích', processing: 'Đang phân tích', needs_review: 'Chờ duyệt vạch nhịp', ready: 'Đã có', failed: 'Phân tích lỗi',
}

/** Nhãn đầu dòng — KHÔNG tính là chữ hát. */
const LABEL = /^(?:\d{1,2}\.|đk:?|dk:?|điệp khúc:?|coda:?|intro:?|dạo:?)$/i

/** Chữ hát của một dòng, theo thứ tự; mỗi chữ mang hợp âm đặt ngay trước nó (nếu có). Nhãn đứng riêng. */
export function lyricTokens(line: string): { label: string | null; tokens: { chord: string | null; word: string }[] } {
  const tokens: { chord: string | null; word: string }[] = []
  let label: string | null = null
  let pending: string | null = null
  for (const segment of parseChordLine(line)) {
    if (segment.chord) pending = segment.chord
    for (const word of segment.text.split(/\s+/).filter(Boolean)) {
      if (!tokens.length && label === null && pending === null && LABEL.test(word)) { label = word; continue }
      tokens.push({ chord: pending, word })
      pending = null
    }
  }
  // Hợp âm ở cuối dòng không có chữ đi kèm → một "chữ" rỗng mang hợp âm, để không mất khi hiển thị.
  if (pending) tokens.push({ chord: pending, word: '' })
  return { label, tokens }
}

const index = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0

function anchorOk(value: unknown, lines: { tokens: unknown[] }[]): value is MeasureAnchor {
  if (!value || typeof value !== 'object') return false
  const anchor = value as Record<string, unknown>
  if (anchor.line === null) return anchor.token === null
  if (!index(anchor.line) || !index(anchor.token)) return false
  const line = lines[anchor.line as number]
  return !!line && (anchor.token as number) <= line.tokens.length
}

/** Đọc `anchors` máy chủ trả về theo đúng lời của phiên bản đó. Sai hình dạng / lệch lời → null. */
export function parseAnchors(raw: unknown, text: string): ChordAnchors | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  const lines = canonicalChordText(text).split('\n').map(lyricTokens)
  if (!Array.isArray(data.measures) || !data.measures.length || !data.measures.every(anchor => anchorOk(anchor, lines))) return null
  if (data.pickup !== undefined && !anchorOk(data.pickup, lines)) return null
  return { pickup: data.pickup as MeasureAnchor | undefined, measures: data.measures as MeasureAnchor[] }
}

export type AnchorLine = { label: string | null; text: string; bars: number }

/**
 * Lời + hợp âm có chèn "|" ở mỗi vạch nhịp, từng dòng — để thầy ĐỌC lại vạch nhịp:
 *   "Chiều | [Am] nao, tiễn nhau | [E7] đi"
 * `bars` = số vạch nhịp rơi vào dòng đó. Ô không lời (line null) gom thành dòng "‖ N ô không lời" ở chỗ của nó.
 */
export function renderAnchors(text: string, anchors: ChordAnchors): AnchorLine[] {
  const lines = canonicalChordText(text).split('\n').map(lyricTokens)
  const marks = lines.map(() => new Map<number, number>())
  const silentAfter = new Map<number, number>()
  let lastLine = -1
  for (const anchor of [...(anchors.pickup ? [anchors.pickup] : []), ...anchors.measures]) {
    if (anchor.line === null) { silentAfter.set(lastLine, (silentAfter.get(lastLine) ?? 0) + 1); continue }
    lastLine = anchor.line
    const at = marks[anchor.line]
    at.set(anchor.token as number, (at.get(anchor.token as number) ?? 0) + 1)
  }
  const out: AnchorLine[] = []
  const silent = (after: number) => { const n = silentAfter.get(after); if (n) out.push({ label: null, text: `‖ ${n} ô không lời`, bars: n }) }
  silent(-1)
  lines.forEach((line, lineIndex) => {
    const parts: string[] = []
    let bars = 0
    line.tokens.forEach((token, tokenIndex) => {
      const count = marks[lineIndex].get(tokenIndex) ?? 0
      for (let n = 0; n < count; n += 1) parts.push('|')
      bars += count
      parts.push(token.chord ? `[${token.chord}]${token.word ? ' ' + token.word : ''}` : token.word)
    })
    const end = marks[lineIndex].get(line.tokens.length) ?? 0
    for (let n = 0; n < end; n += 1) parts.push('|')
    bars += end
    out.push({ label: line.label, text: parts.join(' '), bars })
    silent(lineIndex)
  })
  return out
}
