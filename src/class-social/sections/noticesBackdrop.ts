// Hành vi đóng trang Thông báo khi bấm nền — hàm thuần để kiểm thử.
/** Bấm này có phải "nền trống" quanh nội dung không? (trong vùng chính, ngoài danh sách, không phải nút/liên kết/ô nhập) */
export function isNoticesBackdropClick(target: Element | null): boolean {
  if (!target || !target.closest) return false
  if (!target.closest('.cs-main')) return false
  if (target.closest('.cs-notices')) return false
  return !target.closest('a,button,input,textarea,select,label,[role="dialog"],[role="button"]')
}
