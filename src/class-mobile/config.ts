// Class Mobile V1 — cấu hình khung ứng dụng.
//
// Khung 5 tab chạy ở hai chỗ:
//  • /app  — mọi nền tảng (xem thử trên trình duyệt / simulator). Đây là đường vào DUY NHẤT trên web.
//  • app native (Capacitor) — khung này là màn chính khi bật cờ dưới (bản build MỚI; app 1.4.2 đang ở store không bị ảnh hưởng).
// App học cũ vẫn còn ở /learn (không xóa chức năng cũ khi chưa có phương án thay thế được duyệt).

/** Bật → trên app native, "/" và "/me…" mở khung Class Mobile thay cho App học cũ. Tắt → native giữ nguyên hành vi cũ. */
export const CLASS_MOBILE_NATIVE_DEFAULT = true

export const CLASS_WEB_ORIGIN = 'https://class.vananhaudio.com'

/** Đường dẫn chạy khung 5 tab trên web. */
export const CLASS_MOBILE_PATH = '/app'

export function isClassMobilePath(pathname: string): boolean {
  return pathname === CLASS_MOBILE_PATH || pathname.startsWith(CLASS_MOBILE_PATH + '/')
}

/** App native có bắt đường dẫn này vào khung Class Mobile không (chỉ khi bật cờ). */
export function nativeOpensClassMobile(pathname: string, isNative: boolean): boolean {
  if (!isNative || !CLASS_MOBILE_NATIVE_DEFAULT) return false
  return pathname === '/' || pathname === '/me' || pathname.startsWith('/me/')
}

/**
 * Liên kết tới nơi KHÔNG nằm trong bản web đóng gói của app: TeamLab (/teamlab), Kho bài giảng (/khobaigiang) là proxy Netlify trên host class.*.
 * Native → URL tuyệt đối mở bên ngoài app; web → đường dẫn tương đối như hiện nay.
 */
export function proxiedHref(path: string, isNative: boolean): { href: string; external: boolean } {
  return isNative ? { href: CLASS_WEB_ORIGIN + path, external: true } : { href: path, external: false }
}
