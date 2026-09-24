// Trò chuyện — nền tảng giao diện hai cột (danh sách | khung hội thoại).
// Chưa có backend tin nhắn nên không có ô soạn tin giả.
import { MessagesSquare } from 'lucide-react'
import { EmptyState } from '../ui'

export default function Chat() {
  return (
    <div className="cs-col-wide">
      <h1 className="cs-page-title">Trò chuyện</h1>
      <section className="cs-card cs-chat">
        <div className="cs-chat-list">
          <div className="cs-chat-list-head">Đoạn chat</div>
          <div className="cs-chat-list-empty">Chưa có cuộc trò chuyện nào.</div>
        </div>
        <div className="cs-chat-pane">
          <EmptyState icon={MessagesSquare} title="Tin nhắn của bạn">
            Các cuộc trò chuyện riêng giữa bạn và thành viên Class sẽ hiện ở đây.
          </EmptyState>
        </div>
      </section>
    </div>
  )
}
