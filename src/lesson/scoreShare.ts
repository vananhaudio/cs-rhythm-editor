// Khoanh ô nhịp trên LessonScore — lõi THUẦN (không DOM, test trên Node). Kiểm chứng spike 01/11 với alphaTab 1.8.3 thật:
// boundsLookup.staffSystems[].bars[] (MasterBarBounds: index, realBounds). Toạ độ pixel CHỈ là dữ liệu tạm tính lại sau mỗi lần
// alphaTab khắc (đổi khổ, xoay máy, phóng to); tham chiếu lưu lâu dài = (khối, đường dẫn, dải ô) — xem src/share/shareNoteApi.ts.
export type Box = { x: number; y: number; w: number; h: number }
export type BoundsLike = { staffSystems: { index?: number; realBounds: Box; bars: { index: number; realBounds: Box }[] }[] }
export type HighlightRect = Box & { first: number; last: number }

const inside = (r: Box, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h

/**
 * Điểm (x, y) theo toạ độ bề mặt alphaTab → chỉ số ô (0-based, masterBar index) hoặc null.
 * KHÔNG đoán "ô gần nhất": khe giữa hai dòng nhạc / lề ngoài → null (chống chọn nhầm).
 */
export function hitTestBar(lookup: BoundsLike | null | undefined, x: number, y: number): number | null {
  for (const sys of lookup?.staffSystems ?? []) {
    if (!inside(sys.realBounds, x, y)) continue
    for (const bar of sys.bars) if (x >= bar.realBounds.x && x < bar.realBounds.x + bar.realBounds.w) return bar.index
    return null
  }
  return null
}

/** Dải ô (0-based, gồm 2 đầu) → hình tô theo khổ hiện tại: các ô liên tiếp cùng dòng gộp một hình; qua nhiều dòng → mỗi dòng một hình. */
export function rectsForBars(lookup: BoundsLike | null | undefined, a: number, b: number): HighlightRect[] {
  const out: HighlightRect[] = []
  for (const sys of lookup?.staffSystems ?? []) {
    const hit = sys.bars.filter(bar => bar.index >= a && bar.index <= b)
    if (!hit.length) continue
    const x0 = Math.min(...hit.map(bar => bar.realBounds.x))
    const x1 = Math.max(...hit.map(bar => bar.realBounds.x + bar.realBounds.w))
    out.push({ x: x0, y: sys.realBounds.y, w: x1 - x0, h: sys.realBounds.h, first: hit[0].index, last: hit[hit.length - 1].index })
  }
  return out
}

export function barCount(lookup: BoundsLike | null | undefined): number {
  return (lookup?.staffSystems ?? []).reduce((n, sys) => n + sys.bars.length, 0)
}

/** Dải đánh số từ 1 (như số ô in ra) → còn nằm trong bản nhạc hiện tại? (server đã chặn bản đổi bằng sha; đây là lớp phòng thủ thứ hai) */
export function rangeFits(from: number, to: number, count: number): boolean {
  return Number.isInteger(from) && Number.isInteger(to) && from >= 1 && to >= from && to <= count
}

/** Hai điểm chọn (0-based) → dải 1-based, tối đa 64 ô (giới hạn server). */
export function toRange(a: number, b: number): { from: number; to: number } {
  const lo = Math.min(a, b), hi = Math.max(a, b)
  return { from: lo + 1, to: Math.min(hi, lo + 63) + 1 }
}
