// ── Hằng số nhạc lý guitar (KHÔNG vào DB — vật lý cố định) ─────────────────────
// QUY ƯỚC CHỐT: mọi nơi dùng SỐ DÂY nhạc lý 1..6 (1 = mỏng nhất/cao, 6 = dày nhất/trầm).
// DB chỉ lưu số dây 1..6; file này map sang tần số/màu/độ dày hiển thị.
import { ACCENT } from './data'

export { ACCENT }

export interface GuitarString {
  num: number   // số dây nhạc lý 1..6
  note: string  // tên nốt quốc tế
  vn: string    // tên Việt
  freq: number  // Hz (dây buông)
}

// Thứ tự mảng = thứ tự HIỂN THỊ trên cần: dây 1 trên cùng → dây 6 dưới cùng
export const STRINGS: GuitarString[] = [
  { num: 1, note: 'E', vn: 'Mí',  freq: 329.63 }, // mỏng nhất
  { num: 2, note: 'B', vn: 'Si',  freq: 246.94 },
  { num: 3, note: 'G', vn: 'Sol', freq: 196.0  },
  { num: 4, note: 'D', vn: 'Rê',  freq: 146.83 },
  { num: 5, note: 'A', vn: 'La',  freq: 110.0  },
  { num: 6, note: 'E', vn: 'Mi',  freq: 82.41  }, // dày nhất (trầm)
]

export const stringByNum = (num: number): GuitarString | undefined =>
  STRINGS.find(s => s.num === num)

export const freqOfNum = (num: number): number => stringByNum(num)?.freq ?? 110

// Màu dây: dây 1 (cao) cam · dây 6 (trầm) xanh · còn lại nâu xám
export const colorOfNum = (num: number): string =>
  num === 1 ? ACCENT.c1 : num === 6 ? ACCENT.a : '#C2BAA9'

// Độ dày thanh dây khi vẽ (dây trầm dày hơn)
export const widthOfNum = (num: number): number => 3 + (num - 1) * 1.7
