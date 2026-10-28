// Thông báo (chuông trên thanh trên) — màn riêng trong khung Class Mobile, tách khỏi Trò chuyện.
// Dùng lại SystemNoticeView + useSystemNotices (chỉ đọc, đánh dấu đã đọc); khung lo tiêu đề và nút Quay lại.
import SystemNoticeView from '../class-social/chat/SystemNoticeView'

export default function NoticesPage({ onActivity, onOpenThread }: {
  onActivity: () => void
  onOpenThread: (threadId: string, search: string) => void
}) {
  return (
    <div className="cm-page">
      <h1 className="cm-title">Thông báo</h1>
      <div className="cm-notices">
        <SystemNoticeView bare onBack={() => undefined} onActivity={onActivity} onOpenThread={onOpenThread} />
      </div>
    </div>
  )
}
