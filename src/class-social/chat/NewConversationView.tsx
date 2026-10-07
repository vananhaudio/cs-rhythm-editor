// "Nhắn tin" tới một người CHƯA có hội thoại: hiện khung trống + ô soạn; hội thoại chỉ được tạo khi gửi tin ĐẦU TIÊN
// (dm_start) → mở hồ sơ/bấm Nhắn tin không sinh hội thoại rác. Đã có hội thoại → chuyển thẳng sang đó.
import { useEffect, useRef, useState } from 'react'
import ChatHeader from './ChatHeader'
import Composer from './Composer'
import { canMessage, findConversation, startConversation } from './chatApi'
import { fetchProfile } from '../friends/friendsApi'
import type { Peer } from './ConversationView'

type Resolved = { status: 'loading' } | { status: 'missing' } | { status: 'error'; message: string }
  | { status: 'ready'; peer: Peer; allowed: boolean }

export default function NewConversationView({ userId, meId, onBack, onOpenProfile, onOpenExisting, onStarted }: {
  userId: string
  meId: string
  onBack: () => void
  onOpenProfile: (userId: string) => void
  /** Đã có hội thoại → thay mục lịch sử hiện tại bằng hội thoại đó */
  onOpenExisting: (conversationId: string) => void
  /** Vừa tạo bằng tin đầu */
  onStarted: (conversationId: string, peer: Peer) => void
}) {
  const [state, setState] = useState<Resolved>({ status: 'loading' })
  const [error, setError] = useState<string | null>(null)
  // callback đổi mỗi lần render của cha → giữ trong ref, KHÔNG đưa vào deps (tránh tải lại vòng lặp)
  const openExisting = useRef(onOpenExisting)
  useEffect(() => { openExisting.current = onOpenExisting }, [onOpenExisting])

  useEffect(() => {
    let alive = true
    if (userId === meId) return
    void (async () => {
      const found = await findConversation(userId)
      if (!alive) return
      if (found.ok && found.value) { openExisting.current(found.value); return }
      const [prof, can] = await Promise.all([fetchProfile(userId), canMessage(userId)])
      if (!alive) return
      if (!prof.ok) { setState({ status: 'error', message: prof.message }); return }
      if (!prof.value) { setState({ status: 'missing' }); return }
      setState({ status: 'ready', allowed: can.ok && can.value, peer: { id: userId, name: prof.value.name, avatarUrl: prof.value.avatarUrl, isTeacher: prof.value.isTeacher } })
    })()
    return () => { alive = false }
  }, [userId, meId])

  const self = userId === meId
  const view: Resolved = self ? { status: 'missing' } : state   // không nhắn cho chính mình
  const peer = view.status === 'ready' ? view.peer : null
  const send = async (body: string): Promise<boolean> => {
    setError(null)
    const r = await startConversation(userId, body)
    if (!r.ok) { setError(r.message); return false }
    if (peer) onStarted(r.value.conversationId, peer)
    return true
  }

  return (
    <>
      <ChatHeader name={peer?.name ?? null} avatarUrl={peer?.avatarUrl ?? null} isTeacher={peer?.isTeacher}
        onBack={onBack} onOpenProfile={peer ? () => onOpenProfile(peer.id) : undefined} />
      {view.status === 'loading' && <div className="cs-chat-body-state"><div className="cs-spinner" role="status" aria-label="Đang tải" /></div>}
      {view.status === 'missing' && (
        <div className="cs-chat-body-state" role="alert"><p>Không tìm thấy thành viên này.</p>
          <button type="button" className="cs-btn cs-btn-soft" onClick={onBack}>Về danh sách</button></div>
      )}
      {view.status === 'error' && (
        <div className="cs-chat-body-state" role="alert"><p>{view.status === 'error' ? view.message : ''}</p>
          <button type="button" className="cs-btn cs-btn-soft" onClick={onBack}>Về danh sách</button></div>
      )}
      {view.status === 'ready' && (
        <>
          <div className="cs-chat-body-state is-start">
            <p className="cs-chat-start-title">Bắt đầu trò chuyện với {view.peer.name}</p>
            <p className="cs-chat-start-sub">{view.allowed ? 'Cuộc trò chuyện sẽ được tạo khi bạn gửi tin đầu tiên.' : 'Bạn chưa thể nhắn tin cho người này.'}</p>
          </div>
          {error && <p className="cs-form-error cs-chat-error" role="alert">{error}</p>}
          {view.allowed
            ? <Composer onSend={send} autoFocus placeholder={`Nhắn cho ${view.peer.name}…`} />
            : (
              <div className="cs-chat-locked" role="status">
                <p>Bạn cần là bạn bè của {view.peer.name} để nhắn tin.</p>
                <button type="button" className="cs-btn cs-btn-soft cs-btn-sm" onClick={() => onOpenProfile(view.peer.id)}>Xem trang cá nhân</button>
              </div>
            )}
        </>
      )}
    </>
  )
}
