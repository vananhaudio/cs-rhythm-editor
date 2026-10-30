// Logic thuần của popover Thông báo (tách khỏi component để Layout/test không kéo hook + supabase).
export const NOTICES_POPOVER_MIN_WIDTH = 1024

/** Desktop có popover? (SSR / không có matchMedia → false: dùng trang đầy đủ) */
export function popoverEnabled(win: Pick<Window, 'matchMedia'> | undefined = typeof window === 'undefined' ? undefined : window): boolean {
  try { return !!win?.matchMedia?.(`(min-width: ${NOTICES_POPOVER_MIN_WIDTH}px)`).matches } catch { return false }
}

/** Bấm này có nằm NGOÀI popover và chuông không? (bấm chuông tự xử lý bật/tắt) */
export function isOutsidePopover(target: Node | null, popover: Pick<Node, 'contains'> | null, bell: Pick<Node, 'contains'> | null): boolean {
  if (!target) return false
  if (popover?.contains(target)) return false
  if (bell?.contains(target)) return false
  return true
}
