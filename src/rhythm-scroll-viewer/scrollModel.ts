// ── RHYTHM SCROLL VIEWER — vị trí cuộn (thuần, không DOM) ──
// Viewer vẽ các segment THEO THỨ TỰ BIỂU DIỄN (điệp khúc hát lại thì vẽ lại), nên mép trên của các khối
// tăng dần và cuộn không bao giờ phải lùi. DOM chỉ cấp số đo; mọi phép tính nằm ở đây để test được.
import type { RhythmScrollPosition } from '../rhythm-scroll/index.ts'

/** Dòng đang chơi nằm quanh 38% chiều cao khung (yêu cầu 35–40%): thấy câu vừa qua và nhiều câu sắp tới. */
export const LOOKAHEAD_ANCHOR = 0.38

export interface ScrollLayout {
  /** Mép trên từng khối segment, đo trong hệ toạ độ của nội dung (px). */
  segmentTops: readonly number[]
  /** Mép dưới của khối cuối. */
  contentHeight: number
}

/**
 * Điểm "đang chơi" trong nội dung (px): nội suy tuyến tính từ mép trên segment hiện tại tới mép trên segment
 * kế tiếp theo `segmentProgress`. KHÔNG dùng scrollProgress × chiều cao: các dòng cao khác nhau.
 * Đoạn không lời (line = null) cũng là một khối, nên thời gian dạo vẫn kéo nội dung tiến dần tới câu kế.
 *
 * reducedMotion: không trôi — đứng ở đầu segment hiện tại, đổi segment thì đổi vị trí một lần.
 */
export function playheadOffset(layout: ScrollLayout, position: RhythmScrollPosition, reducedMotion = false): number {
  const tops = layout.segmentTops
  if (!tops.length) return 0
  const index = Math.min(Math.max(position.segmentIndex, 0), tops.length - 1)
  const start = tops[index]
  if (reducedMotion) return start
  const end = index + 1 < tops.length ? tops[index + 1] : layout.contentHeight
  return start + (end - start) * Math.min(Math.max(position.segmentProgress, 0), 1)
}

/**
 * Điểm đang chơi khi cuộn BÁM THEO BALL (prototype neo vạch nhịp): ball đi hết bề ngang một hàng thì nội dung
 * cũng vừa trôi hết khoảng cách tới hàng kế. Liên tục, không lùi; ball đứng (ô ngân) thì cuộn cũng đứng.
 * reducedMotion: đứng ở mép trên hàng của ball, chỉ đổi khi ball sang hàng mới.
 */
export function rowPlayhead(rows: readonly { left: number; right: number; top: number }[], point: { row: number; x: number } | null, reducedMotion = false): number {
  if (!point || !rows[point.row]) return 0
  const row = rows[point.row]
  const next = rows[point.row + 1]
  const width = row.right - row.left
  if (reducedMotion || !next || width <= 0) return row.top
  return row.top + (next.top - row.top) * Math.min(Math.max((point.x - row.left) / width, 0), 1)
}

/** Độ dịch nội dung (px, ≥ 0 nghĩa là kéo lên) để điểm đang chơi nằm ở LOOKAHEAD_ANCHOR của khung. */
export function contentShift(layout: ScrollLayout, position: RhythmScrollPosition, viewportHeight: number, reducedMotion = false): number {
  return playheadOffset(layout, position, reducedMotion) - viewportHeight * LOOKAHEAD_ANCHOR
}
