// Một hội thoại có sẵn: header · dòng tin · ô soạn (hoặc ghi chú khi không còn gửi được — DB quyết qua can_send).
import { RefreshCw } from 'lucide-react'
import ChatHeader from './ChatHeader'
import Composer from './Composer'
import MessageList from './MessageList'
import { useConversation } from './useChat'

export type Peer = { id: string; name: string; avatarUrl: string | null; isTeacher: boolean }

export default function ConversationView({ id, peer, canSend, onBack, onOpenProfile, onActivity }: {
  id: string
  /** null = chưa biết (danh sách chưa tải xong) → header hiện khung chờ */
  peer: Peer | null
  /** undefined = chưa biết → cho gõ, server là người quyết */
  canSend: boolean | undefined
  onBack: () => void
  onOpenProfile: (userId: string) => void
  onActivity: () => void
}) {
  const c = useConversation(id, onActivity)

  return (
    <>
      <ChatHeader name={peer?.name ?? null} avatarUrl={peer?.avatarUrl ?? null} isTeacher={peer?.isTeacher}
        onBack={onBack} onOpenProfile={peer ? () => onOpenProfile(peer.id) : undefined} />

      {c.status === 'loading' && <div className="cs-chat-body-state"><div className="cs-spinner" role="status" aria-label="Đang tải" /></div>}
      {c.status === 'notfound' && (
        <div className="cs-chat-body-state" role="alert">
          <p>Không tìm thấy cuộc trò chuyện này.</p>
          <button type="button" className="cs-btn cs-btn-soft" onClick={onBack}>Về danh sách</button>
        </div>
      )}
      {c.status === 'error' && (
        <div className="cs-chat-body-state" role="alert">
          <p>{c.error}</p>
          <button type="button" className="cs-btn cs-btn-soft" onClick={c.reload}><RefreshCw size={16} aria-hidden="true" />Thử lại</button>
        </div>
      )}

      {c.status === 'ready' && (
        <>
          <MessageList messages={c.messages} pending={c.pending} hasMore={c.hasMore} loadingOlder={c.loadingOlder}
            onLoadOlder={() => void c.loadOlder()} onRetry={c.retry} onDiscard={c.discard} />
          {c.error && c.pending.every(p => p.state !== 'failed') && <p className="cs-form-error cs-chat-error" role="alert">{c.error}</p>}
          {canSend === false
            ? (
              <div className="cs-chat-locked" role="status">
                <p>Bạn chưa thể gửi tin mới cho {peer?.name ?? 'người này'}. Lịch sử trò chuyện vẫn được giữ.</p>
                {peer && <button type="button" className="cs-btn cs-btn-soft cs-btn-sm" onClick={() => onOpenProfile(peer.id)}>Xem trang cá nhân</button>}
              </div>
            )
            : <Composer onSend={body => { c.send(body); return true }} autoFocus />}
        </>
      )}
    </>
  )
}
