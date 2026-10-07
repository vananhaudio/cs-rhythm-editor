// Trò chuyện V1a — Text 1-1. Desktop: danh sách trái · hội thoại phải. Điện thoại: /me/chat = danh sách;
// /me/chat/<id> = màn chat toàn màn hình (nút ← rõ ràng). Dữ liệu qua RPC dm_* (polling nhẹ, xem chat/chatLive.ts).
import { useCallback, useEffect, useState } from 'react'
import { MessagesSquare } from 'lucide-react'
import { EmptyState } from '../ui'
import ConversationList from '../chat/ConversationList'
import ConversationView, { type Peer } from '../chat/ConversationView'
import NewConversationView from '../chat/NewConversationView'
import { useConversationList } from '../chat/useChat'
import type { ChatSelection } from '../chat/chatModel'

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

export default function Chat({ meId, selection, onOpenConversation, onBackToList, onOpenProfile, onOpenFriends, onUnreadChanged }: {
  meId: string
  selection: ChatSelection
  onOpenConversation: (id: string, opts?: { replace?: boolean }) => void
  onBackToList: () => void
  onOpenProfile: (userId: string) => void
  onOpenFriends: () => void
  /** Đã đọc / có tin mới → cập nhật badge menu ngay */
  onUnreadChanged: () => void
}) {
  const list = useConversationList()
  const { reload } = list
  const [hint, setHint] = useState<(Peer & { conversationId: string }) | null>(null)
  const open = selection.kind !== 'none'
  useOpenPaneViewport(open)

  const activity = useCallback(() => { void reload(); onUnreadChanged() }, [reload, onUnreadChanged])
  const items = list.state.status === 'ready' ? list.state.items : []
  const selectedId = selection.kind === 'conversation' ? selection.id : null

  let peer: Peer | null = null
  let canSend: boolean | undefined
  if (selection.kind === 'conversation') {
    const hit = items.find(c => c.id === selection.id)
    if (hit) { peer = { id: hit.peerId, name: hit.name, avatarUrl: hit.avatarUrl, isTeacher: hit.isTeacher }; canSend = hit.canSend }
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
      <section className="cs-card cs-chat">
        <ConversationList state={list.state} selectedId={selectedId} onSelect={id => onOpenConversation(id)}
          onRetry={list.retry} onOpenFriends={onOpenFriends} />
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
