// Thông báo (chuông trên thanh trên) — khu vực RIÊNG, tách khỏi Trò chuyện. /me/notices.
// Dùng lại SystemNoticeView + useSystemNotices (chỉ đọc; mở màn này mới đánh dấu thông báo đã đọc — Trò chuyện không chạm vào).
// Là TRANG độc lập (có URL), không phải popup: bấm vùng nền NGOÀI danh sách → quay lại màn trước (như nút Quay lại).
import { useEffect } from 'react'
import SystemNoticeView from '../chat/SystemNoticeView'
import { isNoticesBackdropClick } from './noticesBackdrop'

export default function Notices({ onUnreadChanged, onOpenThread, onClose }: {
  /** Đã đọc / có thông báo mới → cập nhật badge chuông ngay */
  onUnreadChanged: () => void
  /** Bấm "Xem kết quả" → trang cuộc trao đổi bài trả (hệ thống gốc) */
  onOpenThread: (threadId: string, search?: string) => void
  /** Bấm nền ngoài danh sách → về màn trước (không đổi trạng thái đã đọc) */
  onClose: () => void
}) {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return
      if (window.getSelection()?.toString()) return   // đang bôi đen chữ: không đóng
      if (isNoticesBackdropClick(e.target as Element | null)) onClose()
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [onClose])
  return (
    <div className="cs-col-wide cs-notices-page">
      <h1 className="cs-page-title">Thông báo</h1>
      <section className="cs-card cs-notices">
        <SystemNoticeView bare onBack={() => undefined} onActivity={onUnreadChanged} onOpenThread={(id, search) => onOpenThread(id, search)} />
      </section>
    </div>
  )
}
