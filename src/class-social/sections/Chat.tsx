// Trò chuyện V1a — Text 1-1. Desktop: danh sách trái · hội thoại phải. Điện thoại: /me/chat = danh sách;
// /me/chat/<id> = màn chat toàn màn hình (nút ← rõ ràng). Dữ liệu qua RPC dm_* (polling nhẹ, xem chat/chatLive.ts).
import { useCallback, useEffect, useState } from 'react'
import { MessagesSquare } from 'lucide-react'
import { EmptyState } from '../ui'
import InboxList from '../chat/InboxList'
import ConversationView, { type Peer } from '../chat/ConversationView'
import NewConversationView from '../chat/NewConversationView'
import { useNoticeSound } from '../chat/useChat'
import { useInbox } from '../chat/useInbox'
import { defaultInboxSource, type InboxSource } from '../chat/inboxApi'
import { type ChatSelection, type ConversationItem } from '../chat/chatModel'

/** Điện thoại: khi mở một hội thoại, khung phủ toàn màn hình → theo chiều cao THẬT khi bàn phím mở (iOS không co 100dvh) */
function useOpenPaneViewport(open: boolean) {
  useEffect(() => {
    if (!open || !window.matchMedia?.('(max-width: 1023px)').matches) return
    const root = document.documentElement
    const vv = window.visualViewport
    const apply = () => {
      root.style.setProperty('--cs-chat-vh', `${Math.round(vv?.height ?? window.innerHeight)}px`)
      root.style.setProperty('--cs-chat-top', `${Math.round(vv?.offsetTop ?? 0)}px`)
    }
    apply()
    vv?.addEventListener('resize', apply)
    vv?.addEventListener('scroll', apply)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'   // không cuộn trang nền phía sau màn chat
    return () => {
      vv?.removeEventListener('resize', apply)
      vv?.removeEventListener('scroll', apply)
      root.style.removeProperty('--cs-chat-vh')
      root.style.removeProperty('--cs-chat-top')
      document.body.style.overflow = prev
    }
  }, [open])
}

export default function Chat({ meId, selection, onOpenConversation, onBackToList, onOpenProfile, onOpenFriends, onUnreadChanged, soundToggle = false, source = defaultInboxSource }: {
  meId: string
  selection: ChatSelection
  onOpenConversation: (id: string, opts?: { replace?: boolean }) => void
  onBackToList: () => void
  onOpenProfile: (userId: string) => void
  onOpenFriends: () => void
  /** Đã đọc / có tin mới → cập nhật badge menu ngay */
  onUnreadChanged: () => void
  /** Hiện công tắc "Âm thanh thông báo" (tiếng ting cho tin nhắn mới và thông báo hệ thống). Thông báo KHÔNG nằm trong danh sách Trò chuyện. */
  soundToggle?: boolean
  /** Nguồn danh sách (mặc định RPC chat_inbox*; Preview/test thay bằng dữ liệu mẫu) */
  source?: InboxSource
}) {
  const inbox = useInbox(source)
  const sound = useNoticeSound()
  const { reload } = inbox
  const [hint, setHint] = useState<(Peer & { conversationId: string }) | null>(null)
  const open = selection.kind !== 'none'
  useOpenPaneViewport(open)

  const activity = useCallback(() => { void reload(); onUnreadChanged() }, [reload, onUnreadChanged])
  const items = inbox.state.status === 'ready' ? [...inbox.state.pinned, ...inbox.state.items] : []
  const selectedId = selection.kind === 'conversation' ? selection.id : null

  // Hội thoại đang mở có thể nằm NGOÀI các trang đã tải (liên kết trực tiếp, Band ở khu Quản lý): hỏi server đúng một hội thoại đó
  const [remote, setRemote] = useState<ConversationItem | null>(null)
  const loaded = selectedId ? items.find(c => c.id === selectedId) : undefined
  useEffect(() => {
    if (!selectedId || loaded || inbox.state.status !== 'ready') return
    let alive = true
    void source.info(selectedId).then(r => { if (alive && r.ok) setRemote(r.value) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, !!loaded, inbox.state.status])

  let peer: Peer | null = null
  let canSend: boolean | undefined
  if (selection.kind === 'conversation') {
    const hit = loaded ?? (remote && remote.id === selection.id ? remote : undefined)
    if (hit) { peer = { id: hit.peerId, name: hit.name, avatarUrl: hit.avatarUrl, isTeacher: hit.isTeacher, kind: hit.kind === 'class' ? undefined : hit.kind, memberCount: hit.memberCount, readOnly: hit.readOnly, projectId: hit.projectId }; canSend = hit.canSend }
    else if (hint?.conversationId === selection.id) peer = hint
  }

  const openExisting = useCallback((id: string) => onOpenConversation(id, { replace: true }), [onOpenConversation])
  const started = useCallback((id: string, p: Peer) => {
    setHint({ ...p, conversationId: id })
    onOpenConversation(id, { replace: true })
    void reload(); onUnreadChanged()
  }, [onOpenConversation, reload, onUnreadChanged])

  return (
    <div className={'cs-col-wide cs-chat-wrap' + (open ? ' has-open' : '')}>
      <h1 className="cs-page-title">Trò chuyện</h1>
      {soundToggle && (
        <div className="cs-chat-sound">
          <span id="cs-chat-sound-label">Âm thanh thông báo</span>
          <button type="button" role="switch" aria-checked={sound.enabled} aria-labelledby="cs-chat-sound-label"
            className={'cs-switch' + (sound.enabled ? ' is-on' : '')} onClick={() => sound.set(!sound.enabled)}>
            <span className="cs-switch-text">{sound.enabled ? 'Bật' : 'Tắt'}</span>
            <span className="cs-switch-knob" aria-hidden="true" />
          </button>
        </div>
      )}
      <section className="cs-card cs-chat">
        <InboxList inbox={inbox} source={source} selectedId={selectedId} onSelect={id => onOpenConversation(id)} onOpenFriends={onOpenFriends} />
        <div className={'cs-chat-pane' + (open ? ' is-open' : '')}>
          {selection.kind === 'none' && (
            <div className="cs-chat-pane-empty">
              <EmptyState icon={MessagesSquare} title="Tin nhắn của bạn">Chọn một cuộc trò chuyện ở bên trái.</EmptyState>
            </div>
          )}
          {selection.kind === 'conversation' && (
            <ConversationView key={selection.id} id={selection.id} peer={peer} canSend={canSend}
              onBack={onBackToList} onOpenProfile={onOpenProfile} onActivity={activity} />
          )}
          {selection.kind === 'with' && (
            <NewConversationView key={selection.userId} userId={selection.userId} meId={meId} onBack={onBackToList}
              onOpenProfile={onOpenProfile} onOpenExisting={openExisting} onStarted={started} />
          )}
        </div>
      </section>
    </div>
  )
}
