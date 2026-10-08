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
import { foldVi } from '../class-social/comments/khoAdapter.ts'

export type MeasureAnchor = { line: number | null; token: number | null }
export type ChordAnchors = { pickup?: MeasureAnchor; measures: MeasureAnchor[] }
export type AnchorsStatus = 'none' | 'processing' | 'needs_review' | 'ready' | 'failed'

export const ANCHORS_STATUS_LABEL: Record<AnchorsStatus, string> = {
  none: 'Chưa phân tích', processing: 'Đang phân tích', needs_review: 'Chờ duyệt vạch nhịp', ready: 'Đã có', failed: 'Phân tích lỗi',
}

/** Nhãn đầu dòng — KHÔNG tính là chữ hát. So trên dạng bỏ dấu + thường hoá; CÙNG danh sách với
 *  chord_lyric_token_counts ở máy chủ (có test đối chiếu). */
const LABEL = /^(?:\d{1,2}\.|dk:?|coda:?|intro:?|dao:?|verse:?|chorus:?|bridge:?)$/
const isLabel = (word: string) => LABEL.test(foldVi(word))

/** Chữ hát của một dòng, theo thứ tự; mỗi chữ mang hợp âm đặt ngay trước nó (nếu có). Nhãn đứng riêng. */
export function lyricTokens(line: string): { label: string | null; tokens: { chord: string | null; word: string }[] } {
  const tokens: { chord: string | null; word: string }[] = []
  let label: string | null = null
  let pending: string | null = null
  for (const segment of parseChordLine(line)) {
    if (segment.chord) pending = segment.chord
    for (const word of segment.text.split(/\s+/).filter(Boolean)) {
      if (!tokens.length && label === null && pending === null && isLabel(word)) { label = word; continue }
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

/** Dòng không hát dù có chữ: chú thích trong ngoặc, capo, "x2", "điệp khúc"… (so trên dạng bỏ dấu + thường hoá). */
const NOT_SUNG = /^\s*(?:\(|\[?capo\b|x\d|\d+\s*x\b|diep khuc|lap lai)/
/** Dòng ngắn hơn ngưỡng này (nhãn "ĐK 1:", "Dạo", "Capo 2"…) không bao giờ bị tính là thiếu vạch. */
export const MIN_SUNG_TOKENS = 3

export type UncoveredRange = { from: number; to: number; tokens: number }

/**
 * Các đoạn dòng LỜI HÁT chưa có vạch nhịp nào (0-based, gộp dòng liền kề; dòng trống/nhãn/chú thích đứng giữa không cắt đoạn).
 * Dòng được phủ khi có ô bắt đầu trong dòng đó, hoặc nằm giữa hai ô liên tiếp đi xuôi (line trước < dòng < line sau).
 * Chỉ để CẢNH BÁO — không bao giờ chặn lưu hay tự thêm ô.
 */
export function uncoveredLines(text: string, anchors: ChordAnchors): UncoveredRange[] {
  const raw = canonicalChordText(text).split('\n')
  const lines = raw.map(lyricTokens)
  const covered = new Set<number>()
  const timeline = [...(anchors.pickup ? [anchors.pickup] : []), ...anchors.measures]
  timeline.forEach((anchor, at) => {
    if (anchor.line === null) return
    if ((anchor.token as number) < lines[anchor.line].tokens.length) covered.add(anchor.line)
    const next = timeline.slice(at + 1).find(item => item.line !== null)
    if (next && (next.line as number) > anchor.line) for (let line = anchor.line + 1; line < (next.line as number); line += 1) covered.add(line)
  })
  const needs = (index: number) => lines[index].tokens.length >= MIN_SUNG_TOKENS && !NOT_SUNG.test(foldVi(raw[index].trim())) && !covered.has(index)
  const out: UncoveredRange[] = []
  let open: UncoveredRange | null = null
  lines.forEach((line, index) => {
    if (needs(index)) {
      if (!open) { open = { from: index, to: index, tokens: 0 }; out.push(open) }
      open.to = index
      open.tokens += line.tokens.length
    } else if (line.tokens.length >= MIN_SUNG_TOKENS) open = null     // dòng hát đã được phủ cắt đoạn; dòng trống / nhãn / chú thích thì không
  })
  return out
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

// ── Trình sửa vạch nhịp thủ công: mô hình thuần (khe + dòng thời gian) ─────────────────────────
// Thầy không thao tác line/token: thầy bấm vào KHE giữa hai chữ. Khe k của một dòng = trước chữ k
// (k = số chữ → khe cuối dòng). Hợp âm và nhãn không tạo khe (chúng không phải chữ).
// `measures` là DÒNG THỜI GIAN biểu diễn: thứ tự trong mảng = thứ tự hát, KHÔNG sắp theo vị trí trong lời,
// nên điệp khúc quay lại dòng cũ được (thêm vị trí ở chế độ "thêm vào cuối").

export type AnchorLineView = { label: string | null; tokens: { chord: string | null; word: string }[] }

export const anchorLines = (text: string): AnchorLineView[] => canonicalChordText(text).split('\n').map(lyricTokens)

const sameAnchor = (a: MeasureAnchor, b: MeasureAnchor) => a.line === b.line && a.token === b.token

/** a trước b trong thứ tự đọc lời. Ô không lời không so được. */
const before = (a: MeasureAnchor, b: MeasureAnchor) =>
  a.line !== null && b.line !== null && (a.line < b.line || (a.line === b.line && (a.token as number) < (b.token as number)))

/**
 * Bấm vào một khe.
 *   order  — khe chưa có vạch → chèn theo thứ tự đọc (sau vị trí đứng trước nó cùng các ô không lời đi liền sau);
 *            khe đã có vạch → bỏ lần xuất hiện CUỐI cùng.
 *   append — luôn thêm vào CUỐI dòng thời gian (dùng khi hát lại điệp khúc: quay về dòng cũ).
 */
export function toggleGap(measures: MeasureAnchor[], at: MeasureAnchor, mode: 'order' | 'append'): MeasureAnchor[] {
  if (mode === 'append') return [...measures, at]
  const last = measures.map((anchor, index) => (sameAnchor(anchor, at) ? index : -1)).filter(index => index >= 0).pop()
  if (last !== undefined) return measures.filter((_, index) => index !== last)
  let insert = 0
  measures.forEach((anchor, index) => { if (anchor.line !== null && before(anchor, at)) insert = index + 1 })
  while (insert < measures.length && measures[insert].line === null) insert += 1
  return [...measures.slice(0, insert), at, ...measures.slice(insert)]
}

/** Ô ngân: thêm một ô CÙNG vị trí ngay sau ô `index` (không chữ mới, vẫn tính một ô nhịp). */
export const addSustain = (measures: MeasureAnchor[], index: number) => [...measures.slice(0, index + 1), { ...measures[index] }, ...measures.slice(index + 1)]
/** Ô không lời (dạo, gian tấu): chèn sau ô `afterIndex`; -1 = đầu bài; vượt cuối = cuối bài. */
export const addSilent = (measures: MeasureAnchor[], afterIndex: number) => {
  const at = Math.max(0, Math.min(afterIndex + 1, measures.length))
  return [...measures.slice(0, at), { line: null, token: null }, ...measures.slice(at)]
}
export const removeMeasure = (measures: MeasureAnchor[], index: number) => measures.filter((_, at) => at !== index)
export function moveMeasure(measures: MeasureAnchor[], index: number, delta: -1 | 1): MeasureAnchor[] {
  const to = index + delta
  if (to < 0 || to >= measures.length) return measures
  const next = [...measures]
  ;[next[index], next[to]] = [next[to], next[index]]
  return next
}

/** Vị trí chữ hát đầu tiên của bài — chỗ mặc định của nhịp lấy đà. */
export function firstLyricAnchor(text: string): MeasureAnchor | null {
  const line = anchorLines(text).findIndex(view => view.tokens.length > 0)
  return line < 0 ? null : { line, token: 0 }
}

/** Chữ hát đầu ô — để thầy đọc dòng thời gian ("Ô 3 → đi"). */
export function anchorWord(text: string, anchor: MeasureAnchor): string {
  if (anchor.line === null) return '(ô không lời)'
  const view = anchorLines(text)[anchor.line]
  if (!view) return '?'
  if ((anchor.token as number) >= view.tokens.length) return `(cuối dòng ${anchor.line + 1})`
  const token = view.tokens[anchor.token as number]
  return token.word || `[${token.chord}]`
}

/** Bộ vạch gửi máy chủ: đúng 2 khoá; nhịp lấy đà chỉ khi có. */
export const anchorsPayload = (measures: MeasureAnchor[], pickup: MeasureAnchor | null): ChordAnchors =>
  ({ ...(pickup ? { pickup: { line: pickup.line, token: pickup.token } } : {}), measures: measures.map(anchor => ({ line: anchor.line, token: anchor.token })) })

// ── Số ô nhịp: MỘT mô hình hiển thị dùng chung cho bản bên phải + khung "Xem lại" ────────────────
// Quy ước ký âm phổ biến (MuseScore/Dorico): nhịp lấy đà KHÔNG mang số; ô đầy đủ đầu tiên = 1; số đặt ở vạch MỞ ô.
// Số = vị trí trong DÒNG THỜI GIAN (measures[i] → i + 1), suy ra lúc hiển thị, KHÔNG lưu DB.
//   • quay lại dòng cũ (điệp khúc) → mở hàng mới, số vẫn tăng tiếp;
//   • ô không lời (line null) → vạch + "♪", vẫn chiếm số;
//   • ô ngân (trùng vị trí ô liền trước) → vạch + "(ngân)" ngay sau phần lời của ô trước, vẫn chiếm số;
//   • không lấy đà mà ô 1 mở ngay đầu bài → chỉ hiện số 1, không vẽ vạch giả trước chữ đầu.

export type MeasureItem =
  | { kind: 'bar'; number: number; start: boolean; mark: 'silent' | 'sustain' | null }
  | { kind: 'word'; chord: string | null; word: string; pickup: boolean }
  | { kind: 'pickup' }
export type MeasureRow = { label: string | null; items: MeasureItem[]; gap?: true }

export function buildMeasureDisplay(text: string, anchors: ChordAnchors | null): MeasureRow[] {
  const lines = anchorLines(text)
  const rows: MeasureRow[] = []
  let row: MeasureRow | null = null
  let rowLine = -1
  let lastRow: MeasureRow | null = null
  let jumped = false
  let cursor = { line: 0, token: 0 }
  const cmp = (a: { line: number; token: number }, b: { line: number; token: number }) => a.line - b.line || a.token - b.token
  const open = (line: number, token: number, fresh = false) => {
    if (!row || rowLine !== line || fresh) { row = { label: token === 0 ? lines[line]?.label ?? null : null, items: [] }; rows.push(row); rowLine = line; lastRow = row }
    return row
  }
  // Vạch ngân / không lời bám vào cuối hàng lời gần nhất (không mở hàng mới chỉ vì vừa qua dòng trống).
  const here = (): MeasureRow => lastRow ?? open(cursor.line, cursor.token)
  // Chép lời từ cursor tới `to` (không gồm `to`).
  const emit = (to: { line: number; token: number }, pickup: boolean) => {
    while (cmp(cursor, to) < 0 && cursor.line < lines.length) {
      const line = lines[cursor.line]
      if (cursor.token < line.tokens.length) {
        const token = line.tokens[cursor.token]
        open(cursor.line, cursor.token).items.push({ kind: 'word', chord: token.chord, word: token.word, pickup })
        cursor = { line: cursor.line, token: cursor.token + 1 }
      } else {
        cursor = { line: cursor.line + 1, token: 0 }
        if (cursor.line < lines.length && lines[cursor.line].tokens.length === 0 && !lines[cursor.line].label) { rows.push({ label: null, items: [], gap: true }); row = null; rowLine = -1 }
      }
    }
  }
  const END = { line: lines.length, token: 0 }
  const measures = anchors?.measures ?? []
  const at = (anchor: MeasureAnchor) => ({ line: anchor.line as number, token: anchor.token as number })
  const firstLyric = measures.find(anchor => anchor.line !== null)
  if (anchors?.pickup) {
    emit(at(anchors.pickup), false)
    open(cursor.line, cursor.token).items.push({ kind: 'pickup' })
    emit(firstLyric ? at(firstLyric) : END, true)
  }
  measures.forEach((anchor, index) => {
    const number = index + 1
    if (anchor.line === null) { here().items.push({ kind: 'bar', number, start: false, mark: 'silent' }); return }
    const previous = measures[index - 1]
    if (previous && previous.line !== null && sameAnchor(previous, anchor)) { here().items.push({ kind: 'bar', number, start: false, mark: 'sustain' }); return }
    const pos = at(anchor)
    if (cmp(pos, cursor) < 0) { jumped = true; cursor = pos; open(pos.line, pos.token, true) } else emit(pos, false)
    const start = number === 1 && !anchors?.pickup && rows.every(r => r.items.length === 0)
    open(pos.line, pos.token).items.push({ kind: 'bar', number, start, mark: null })
    const next = measures.slice(index + 1).find(other => other.line !== null && !sameAnchor(other, anchor))
    // Ô cuối: tới hết bài; nhưng nếu đã quay lại (điệp khúc) thì chỉ tới hết dòng — không chép lại phần lời phía sau.
    const lineEnd = { line: pos.line, token: lines[pos.line].tokens.length }
    const stop = !next ? (jumped ? lineEnd : END) : cmp(at(next), pos) >= 0 ? at(next) : lineEnd
    emit(stop, false)
  })
  if (!measures.length) emit(END, false)
  return rows
}

/** Dạng chữ của mô hình — để kiểm thử và đọc nhanh: "Chiều |¹ [Am] nao, tiễn nhau |² [E7] đi". */
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'
export const measureNumberText = (n: number) => String(n).split('').map(d => SUP[Number(d)]).join('')
export function measureDisplayText(rows: MeasureRow[]): string[] {
  return rows.map(row => [row.label, ...row.items.map(item => item.kind === 'pickup' ? '(lấy đà)'
    : item.kind === 'word' ? (item.chord ? `[${item.chord}]${item.word ? ' ' + item.word : ''}` : item.word)
      : `${item.start ? '' : '|'}${measureNumberText(item.number)}${item.mark === 'silent' ? ' ♪' : item.mark === 'sustain' ? ' (ngân)' : ''}`)]
    .filter(Boolean).join(' '))
}
