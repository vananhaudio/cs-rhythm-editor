// ─────────────────────────────────────────────────────────────────────────────
// Điểm đến sau đăng nhập — hàm THUẦN (không đụng window) để test được.
//
//  Trang cần tài khoản + khách chưa đăng nhập → /start?return=<path+query+hash>
//  /start đăng nhập xong (hoặc đã có phiên) → về đúng <return>, nếu hợp lệ.
//  Vào /start không kèm return → trang mặc định (cổng học) như trước.
//
// Nguồn điểm đến DUY NHẤT là tham số `return` trên URL: không lưu storage nên
// không bao giờ dùng lại điểm đến cũ của lần đăng nhập trước, và F5 vẫn giữ.
// Chỉ nhận đường dẫn tương đối cùng origin → không thể dẫn người dùng ra website khác.
// ─────────────────────────────────────────────────────────────────────────────

export const LOGIN_PATH = '/start'
export const RETURN_PARAM = 'return'
const MAX_LEN = 2048

/** Trang đăng nhập / cổng học — đích trỏ về đây sẽ gây vòng lặp nên bị loại. */
function isLoginPath(pathname: string): boolean {
  return pathname === LOGIN_PATH || pathname.startsWith(LOGIN_PATH + '/')
    || pathname === '/start.html'
}

/**
 * Trả về `path?query#hash` an toàn, hoặc null nếu không hợp lệ.
 * `origin` chỉ dùng để kiểm tra cùng origin (mặc định giả định cố định).
 */
export function sanitizeReturnTo(raw: string | null | undefined, origin = 'https://class.invalid'): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  if (!s || s.length > MAX_LEN) return null
  if (!s.startsWith('/') || s.startsWith('//')) return null          // chỉ đường dẫn tuyệt đối trong site
  if (s.includes('\\') || [...s].some(c => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f)) return null   // \ và ký tự điều khiển (trình duyệt coi \ như /)
  let u: URL
  try { u = new URL(s, origin) } catch { return null }
  if (u.origin !== origin) return null
  if (isLoginPath(u.pathname)) return null                           // không quay lại trang đăng nhập
  return u.pathname + u.search + u.hash
}

/** URL trang đăng nhập kèm điểm đến (điểm đến hiện tại nếu hợp lệ; nếu không → /start trần). */
export function loginUrlFor(current: string | null | undefined): string {
  const dest = sanitizeReturnTo(current)
  return dest ? `${LOGIN_PATH}?${RETURN_PARAM}=${encodeURIComponent(dest)}` : LOGIN_PATH
}

/** Đọc điểm đến từ `location.search` của /start. */
export function returnToFromSearch(search: string): string | null {
  try { return sanitizeReturnTo(new URLSearchParams(search).get(RETURN_PARAM)) } catch { return null }
}

/**
 * Nơi cần chuyển tới khi một trang bị chặn.
 *  • Chưa đăng nhập → /start kèm điểm đến (đăng nhập xong quay lại).
 *  • Đã đăng nhập nhưng thiếu quyền → /start TRẦN: kèm điểm đến sẽ bị /start đẩy ngược lại → vòng lặp.
 */
export function blockedRedirect(signedIn: boolean, current: string): string {
  return signedIn ? LOGIN_PATH : loginUrlFor(current)
}
