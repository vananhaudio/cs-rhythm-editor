// SOLO01 Chặng 2 (Solo Bolero) — 8 buổi, hệ thống đánh số 9–16. Nguồn soạn; DB (class_lesson_content, trạng thái draft) là nguồn runtime.
import { SOLO01_BUOI09 } from './buoi09'
import { SOLO01_BUOI10 } from './buoi10'
import { SOLO01_BUOI11 } from './buoi11'
import { SOLO01_BUOI12 } from './buoi12'
import { SOLO01_BUOI13 } from './buoi13'
import { SOLO01_BUOI14 } from './buoi14'
import { SOLO01_BUOI15 } from './buoi15'
import { SOLO01_BUOI16 } from './buoi16'

export const SOLO01_CHANG2 = [
  SOLO01_BUOI09, SOLO01_BUOI10, SOLO01_BUOI11, SOLO01_BUOI12,
  SOLO01_BUOI13, SOLO01_BUOI14, SOLO01_BUOI15, SOLO01_BUOI16,
]
/** Tên hiển thị theo khung 8 buổi Owner đã chốt (cập nhật vào class_sessions.title). */
export const SOLO01_CHANG2_TITLES: Record<number, string> = {
  9: 'Melody & Kỹ thuật diễn tấu',
  10: 'Bass',
  11: 'Xếp ngón (Fingering)',
  12: 'Hợp âm bấm tắt',
  13: 'Chèn hợp âm theo công thức Bolero',
  14: 'Ghép Bass và hợp âm cho điệp khúc',
  15: 'Tự dựng bài Solo Bolero',
  16: 'Tổng kết – Ôn tập – Biểu diễn',
}
