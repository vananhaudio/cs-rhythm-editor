// Thanh trên của khung = MỘT thanh điều hướng duy nhất (kiểu iOS): thương hiệu (Trang chủ) | tên màn (tab gốc) | "‹" + tên màn (màn sâu).
// Thay cho ba lớp cũ xếp chồng: thanh thương hiệu + hàng "Quay lại" + tiêu đề lớn của trang. THUẦN (không React/DOM) để test được.
import type { MobileTab, MobileView } from './mobileNav'

export type BarSpec = {
  /** null = hiện thương hiệu "Thầy Văn Anh Guitar" */
  title: string | null
  /** Có nút "‹" quay lại ngay trên thanh */
  back: boolean
  /** Thanh đã mang tên màn → tiêu đề lớn của trang chỉ còn cho trình đọc màn hình (không hiện lặp) */
  hidePageTitle: boolean
}

const BRAND: BarSpec = { title: null, back: false, hidePageTitle: false }
const ROOT_TITLE: Record<MobileTab, string | null> = { home: null, class: 'Lớp Học', band: 'Ban Nhạc', chat: 'Trò chuyện', me: 'Tôi' }

/** Màn có tên NỘI DUNG riêng trong trang (hồ sơ, lớp, buổi, trao đổi…): thanh chỉ ghi loại màn, trang giữ tên nội dung. */
export function barFor(view: MobileView, tab: MobileTab): BarSpec {
  switch (view.kind) {
    case 'tabRoot': return { title: ROOT_TITLE[tab], back: false, hidePageTitle: ROOT_TITLE[tab] !== null }
    case 'section':
      if (view.section === 'friends') return { title: 'Bạn bè', back: true, hidePageTitle: true }
      if (view.section === 'tools') return { title: 'Công cụ âm nhạc', back: true, hidePageTitle: true }
      return BRAND
    case 'account': return { title: 'Tài khoản & cài đặt', back: true, hidePageTitle: true }
    case 'blocked': return { title: 'Người đã chặn', back: true, hidePageTitle: true }
    case 'password': return { title: 'Đổi mật khẩu', back: true, hidePageTitle: true }
    case 'notices':
    case 'chatSystem': return { title: 'Thông báo', back: true, hidePageTitle: true }
    case 'bands': return { title: 'Quản lý Band', back: true, hidePageTitle: true }
    case 'bandAdmin': return { title: 'Quản lý Band', back: true, hidePageTitle: false }
    case 'profile': return { title: 'Trang cá nhân', back: true, hidePageTitle: false }
    case 'thread': return { title: 'Trao đổi bài', back: true, hidePageTitle: false }
    case 'queue': return { title: 'Hàng đợi', back: true, hidePageTitle: false }
    case 'session': return { title: 'Buổi học', back: true, hidePageTitle: false }
    // Màn lớp: ClassHead tự có nút "‹ Lớp của tôi" nhưng bị ẩn trong khung (S1) ⇒ trước đây KHÔNG còn nút quay lại nào; nay thanh khung lo.
    case 'class': case 'classSpace': case 'classMembers': return { title: 'Lớp học', back: true, hidePageTitle: false }
    case 'classes': return { title: 'Lớp Học', back: true, hidePageTitle: true }
    case 'studio': return { title: 'Studio', back: false, hidePageTitle: false }   // nút "‹" của Studio do StudioPage báo (Studio có thể tự có nút riêng)
    default: return BRAND   // lớp, không gian lớp, hội thoại: giữ như cũ
  }
}
