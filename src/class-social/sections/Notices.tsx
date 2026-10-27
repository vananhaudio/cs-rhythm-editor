// Thông báo (chuông trên thanh trên) — khu vực RIÊNG, tách khỏi Trò chuyện. /me/notices.
// Dùng lại SystemNoticeView + useSystemNotices (chỉ đọc; mở màn này mới đánh dấu thông báo đã đọc — Trò chuyện không chạm vào).
import SystemNoticeView from '../chat/SystemNoticeView'

export default function Notices({ onUnreadChanged, onOpenThread }: {
  /** Đã đọc / có thông báo mới → cập nhật badge chuông ngay */
  onUnreadChanged: () => void
  /** Bấm "Xem kết quả" → trang cuộc trao đổi bài trả (hệ thống gốc) */
  onOpenThread: (threadId: string, search?: string) => void
}) {
  return (
    <div className="cs-col-wide">
      <h1 className="cs-page-title">Thông báo</h1>
      <section className="cs-card cs-notices">
        <SystemNoticeView bare onBack={() => undefined} onActivity={onUnreadChanged} onOpenThread={(id, search) => onOpenThread(id, search)} />
      </section>
    </div>
  )
}
