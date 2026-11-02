// Cắm công cụ "Khoanh để hỏi" vào bản nhạc của LessonDocument — CHỈ trang Buổi trong /me cấp (giống CheckpointSlot).
// Trang công khai / bản in / Admin không cấp ⇒ LessonScore hiển thị như cũ, không có lớp khoanh.
import { createContext } from 'react'
import type { BarRange, ScoreKey } from '../share/shareNoteApi'

export type ScoreShareContext = {
  /** Người học chọn xong một dải ô ở bản nhạc `score` → mở khung soạn câu hỏi / chia sẻ */
  onAsk: (score: ScoreKey, bars: BarRange) => void
  /** Vùng cần tô khi mở từ liên kết chia sẻ (đã được server xác nhận còn khớp bản nhạc) */
  focus: { score: ScoreKey; bars: BarRange } | null
  /** Bản nhạc của vùng focus đã tô xong (để trang cuộn tới đúng chỗ một lần) */
  onFocusShown?: (el: HTMLElement) => void
}
export const ScoreShareSlot = createContext<ScoreShareContext | null>(null)
