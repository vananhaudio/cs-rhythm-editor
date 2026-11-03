// Share Note — xem trước trích đoạn bản nhạc trong bài Feed. Lõi THUẦN (không DOM / mạng, test trên Node).
// Kiểm chứng spike 03/11 với alphaTab 1.8.3 thật (Chrome + WebKit): display.startBar/barCount (1-based) vẽ đúng các ô đã chọn —
// số ô in ra và chỉ số ô trong boundsLookup GIỮ NGUYÊN số gốc; nốt / TAB / hợp âm / lời hát khớp bản khắc đủ.
import type { BarRange, ScoreKey } from './shareNoteApi'

/** Feed chỉ hiện tối đa 4 ô (Owner chốt 03/11) và tối đa 2 dòng nhạc (điện thoại + bản có lời chỉ 1 ô/dòng → 2 ô). */
export const EXCERPT_MAX_BARS = 4
export const EXCERPT_MAX_ROWS = 2

export type ExcerptPlan = {
  /** ô bắt đầu (1-based) cho alphaTab display.startBar */
  start: number
  /** số ô vẽ cho display.barCount */
  count: number
  /** tổng số ô trong dải đã chia sẻ */
  total: number
  /** true = còn ô chưa hiện (hiện N ô đầu) */
  truncated: boolean
}

/** Dải ô đã chia sẻ + số ô mỗi dòng của khổ hiện tại → ô cần vẽ. Dải hỏng → null (không vẽ). */
export function planExcerpt(range: BarRange, rowsPerSystem: number, maxRows: number = EXCERPT_MAX_ROWS): ExcerptPlan | null {
  const { from, to } = range
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) return null
  const rows = Number.isFinite(rowsPerSystem) ? Math.max(1, Math.floor(rowsPerSystem)) : 1
  const total = to - from + 1
  const count = Math.min(total, EXCERPT_MAX_BARS, rows * Math.max(1, Math.floor(maxRows)))
  return { start: from, count, total, truncated: count < total }
}

const obj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Chuỗi alphaTex tại (khối, đường dẫn) trong các khối giáo trình đã parse — đúng 3 chỗ LessonDocument dựng LessonScore.
 *  Không thấy / sai kiểu → null (không vẽ gì). */
export function scoreTexAt(sections: unknown, key: ScoreKey): string | null {
  if (!Array.isArray(sections) || !Number.isInteger(key.section) || key.section < 0) return null
  const s = sections[key.section]
  if (!obj(s)) return null
  const p = key.path
  let v: unknown
  if (p.length === 1) v = s.tex
  else {
    const list = s[p[0]]
    const item = Array.isArray(list) ? list[Number(p[1])] : null
    v = obj(item) ? item.tex : null
  }
  return typeof v === 'string' && v.length > 0 && v.length <= 200000 ? v : null
}
