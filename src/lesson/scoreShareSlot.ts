// Cắm công cụ "Khoanh để hỏi" vào bản nhạc của LessonDocument — CHỈ trang Buổi trong /me cấp (giống CheckpointSlot).
// Trang công khai / bản in / Admin không cấp ⇒ LessonScore hiển thị như cũ, không có lớp khoanh.
import { createContext } from 'react'
import type { BarRange, ScoreKey } from '../share/shareNoteApi'
import type { TextAnchor } from '../share/textAnchor'
import type { RegionPart } from '../share/regionAnchor'

export type ScoreShareContext = {
  /** Người học chọn xong một dải ô ở bản nhạc `score` → mở khung soạn câu hỏi / chia sẻ */
  onAsk: (score: ScoreKey, bars: BarRange) => void
  /** Vùng cần tô khi mở từ liên kết chia sẻ (đã được server xác nhận còn khớp bản nhạc) */
  focus: { score: ScoreKey; bars: BarRange } | null
  /** Bản nhạc của vùng focus đã tô xong (để trang cuộn tới đúng chỗ một lần) */
  onFocusShown?: (el: HTMLElement) => void
  /** V2 — chia sẻ VÙNG VĂN BẢN: có hàm này thì giáo trình cho phép chọn văn bản trong MỘT lá; chọn xong → khung soạn câu hỏi. `quote` chỉ để hiện cho người soạn. */
  onAskText?: (anchor: TextAnchor, quote: string) => void
  /** Vùng văn bản cần tô khi mở từ liên kết (server đã xác nhận + client đã kiểm băm) */
  textFocus?: TextAnchor | null
  /** V3 — KHOANH VÙNG HỖN HỢP: có hàm này thì giáo trình cho phép kéo khung chữ nhật; xong → khung soạn câu hỏi. `summary` chỉ để hiện cho người soạn. */
  onAskRegion?: (parts: RegionPart[], summary: string) => void
  /** Vùng cần vẽ khi mở từ liên kết (server đã xác nhận mọi khối còn NGUYÊN VĂN) */
  regionFocus?: RegionPart[] | null
}
export const ScoreShareSlot = createContext<ScoreShareContext | null>(null)
