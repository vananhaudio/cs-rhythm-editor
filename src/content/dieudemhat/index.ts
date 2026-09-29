// ── ĐIỆU ĐỆM HÁT — điểm vào nguồn nội dung chuẩn ──
// Thêm điệu mới: tạo <dieu>.ts theo khung RhythmStyle, thêm vào STYLES, chạy
//   node docs/giao-trinh/tools/check-dieudemhat.mjs
import type { RhythmStyle } from './types.ts'
import { BALLAD } from './ballad.ts'
import { BOLERO } from './bolero.ts'
import { SLOW_ROCK } from './slowrock.ts'

export { PATTERNS } from './patterns.ts'
export * from './types.ts'

/** Thứ tự hiển thị trên trang chọn điệu */
export const STYLES: RhythmStyle[] = [BALLAD, BOLERO, SLOW_ROCK]

export const COLLECTION = {
  title: 'Điệu đệm hát',
  lead: 'Mỗi điệu có sẵn một công thức: Lời 1, Lời 2, Điệp khúc, Lời 3 đánh gì. Bạn chỉ cần chọn điệu của bài hát rồi làm theo.',
  method: 'Nhìn âm hình → Đàn theo → Ghép vào bài.',
}
