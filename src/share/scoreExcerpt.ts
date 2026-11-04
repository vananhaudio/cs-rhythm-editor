// Share Note — xem trước trích đoạn bản nhạc trong bài Feed. Lõi THUẦN (không DOM / mạng, test trên Node).
// Kiểm chứng spike 03/11 với alphaTab 1.8.3 thật (Chrome + WebKit): display.startBar/barCount (1-based) vẽ đúng các ô đã chọn —
// số ô in ra và chỉ số ô trong boundsLookup GIỮ NGUYÊN số gốc; nốt / TAB / hợp âm / lời hát khớp bản khắc đủ.
import type { BarRange, ScoreKey } from './shareNoteApi'

/** Feed chỉ hiện tối đa 4 ô của VÙNG ĐÃ KHOANH (Owner chốt 03/11) và tối đa EXCERPT_MAX_ROWS dòng nhạc. V1.1 (04/11): thêm tối đa 2 ô ngữ cảnh mỗi phía
 *  vào chỗ còn trống của các dòng đó — ngữ cảnh KHÔNG bao giờ lấn chỗ của vùng khoanh. */
export const EXCERPT_MAX_BARS = 4
export const EXCERPT_MAX_ROWS = 2
export const EXCERPT_CONTEXT_BARS = 2

export type ExcerptPlan = {
  /** ô bắt đầu VẼ (1-based, gồm ngữ cảnh trước) cho alphaTab display.startBar */
  start: number
  /** số ô vẽ (gồm ngữ cảnh) cho display.barCount; ô vượt cuối bản nhạc alphaTab tự bỏ */
  count: number
  /** vùng khoanh THỰC SỰ được vẽ (1-based, gồm hai đầu) — chỉ phần này được tô */
  focusFrom: number
  focusTo: number
  /** số ô ngữ cảnh yêu cầu trước / sau (sau có thể ít hơn nếu bản nhạc hết) */
  before: number
  after: number
  /** tổng số ô trong dải đã chia sẻ */
  total: number
  /** true = còn ô của vùng khoanh chưa hiện (hiện N ô đầu) */
  truncated: boolean
}

/** Dải ô đã chia sẻ + số ô mỗi dòng + số dòng tối đa → ô cần vẽ. Dải hỏng → null (không vẽ).
 *  Ưu tiên: (1) vùng khoanh đủ trong giới hạn → (2) ngữ cảnh hai phía ≤ 2 ô → thiếu chỗ thì GIẢM ngữ cảnh trước khi cắt vùng khoanh.
 *  Vùng khoanh bị cắt (dài) → chỉ giữ ngữ cảnh trước, không có ngữ cảnh sau (ô sau vùng hiện ra sẽ không phải ô liền kề). */
export function planExcerpt(range: BarRange, barsPerRow: number, maxRows: number = EXCERPT_MAX_ROWS, withContext = true): ExcerptPlan | null {
  const { from, to } = range
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) return null
  const perRow = Number.isFinite(barsPerRow) ? Math.max(1, Math.floor(barsPerRow)) : 1
  const capacity = perRow * Math.max(1, Math.floor(maxRows))
  const total = to - from + 1
  const focus = Math.min(total, EXCERPT_MAX_BARS, capacity)
  const truncated = focus < total
  let before = withContext ? Math.min(EXCERPT_CONTEXT_BARS, from - 1) : 0
  let after = withContext && !truncated ? EXCERPT_CONTEXT_BARS : 0
  const room = capacity - focus
  while (before + after > room) { if (before >= after && before > 0) before--; else if (after > 0) after--; else break }
  return { start: from - before, count: before + focus + after, focusFrom: from, focusTo: from + focus - 1, before, after, total, truncated }
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
