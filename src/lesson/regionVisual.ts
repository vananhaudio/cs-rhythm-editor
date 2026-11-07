/**
 * V3.2: phần tử HÌNH của một khối (sơ đồ cần đàn, ảnh…) — mốc tương đối cho vùng khoanh "gần đúng".
 * Hộp ‰ của phần hình được tính trên chính phần tử này (SVG co giãn theo viewBox) chứ không trên cả khối,
 * nên đổi bề rộng / xuống dòng chú thích không làm lệch vùng. Người khoanh và người nhận dùng CÙNG quy tắc này.
 */
const SEL = 'svg[role="img"], img, canvas, video'
export function findVisual(sec: Element): HTMLElement | null {
  for (const e of Array.from(sec.querySelectorAll<HTMLElement>(SEL))) {
    if (e.closest('.lsn-score-host, .lsn-share-layer, .lsn-rg-layer')) continue
    const r = e.getBoundingClientRect()
    if (r.width >= 48 && r.height >= 32) return e
  }
  return null
}
