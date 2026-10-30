/**
 * Chốt chặn thanh toán iOS (Apple App Review Guideline 3.1.1 / 3.1.1(a) / 3.1.3).
 * Xem docs/IOS-PAYMENT-POLICY-V1.md.
 *
 * Trên app iOS native (cửa hàng Việt Nam), KHÔNG được hiện nút/CTA/giá/hướng dẫn dẫn người dùng
 * tới cơ chế mua KHÁC In-App Purchase cho nội dung số, quyền truy cập trong app hoặc lớp học nhóm
 * (Zalo "Đăng ký", QR / chuyển khoản, "Tôi đã chuyển khoản", bảng giá VND của lớp...).
 * Luồng duy nhất để mua trên iOS là /subscribe (StoreKit). Web và Android KHÔNG bị ảnh hưởng.
 *
 * Hàm thuần `isIosNativeStorefrontFor` để test; `isIosNativeStorefront()` đọc môi trường thật.
 * KHÔNG áp cho hàng vật lý (Shop nhạc cụ) hay liên hệ hỗ trợ — các luồng đó không bị ẩn.
 */
import { Capacitor } from '@capacitor/core'

export function isIosNativeStorefrontFor(env: { isNative: boolean; platform: string }): boolean {
  return env.isNative === true && env.platform === 'ios'
}

/** true = đang chạy trong app iOS (Capacitor native). Web (kể cả Safari trên iPhone) và Android → false. */
export function isIosNativeStorefront(): boolean {
  try {
    return isIosNativeStorefrontFor({ isNative: Capacitor.isNativePlatform(), platform: Capacitor.getPlatform() })
  } catch {
    return false
  }
}

/** Mở link NGOÀI app (hàng vật lý như Shop): '_system' để iOS đẩy ra Safari, web fallback '_blank'. Cùng quy ước openExternal trong MobileStudentPortal/HomeFeed. */
export function openExternalUrl(u: string): void {
  try { window.open(u, '_system') } catch { window.open(u, '_blank') }
}
