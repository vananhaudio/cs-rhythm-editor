// Danh sách hội thoại (mới nhất trước): avatar · tên · xem trước tin cuối · giờ · badge chưa đọc.
import { MessagesSquare } from 'lucide-react'
import { Avatar, EmptyState } from '../ui'
import { previewText, shortTime, type ConversationItem } from './chatModel'
import type { ListState } from './useChat'

export default function ConversationList({ state, selectedId, onSelect, onRetry, onOpenFriends }: {
  state: ListState
  selectedId: string | null
  onSelect: (id: string) => void
  onRetry: () => void
  onOpenFriends: () => void
}) {
  return (
    <div className="cs-chat-list">
      <div className="cs-chat-list-head">Đoạn chat</div>
      {state.status === 'loading' && (
        <div className="cs-chat-list-skel" aria-label="Đang tải">
          {[0, 1, 2].map(i => <div key={i} className="cs-skeleton" style={{ height: 52, marginBottom: 10 }} />)}
        </div>
      )}
      {state.status === 'error' && (
        <div className="cs-feed-error" role="alert"><p>{state.message}</p>
          <button type="button" className="cs-btn cs-btn-soft" onClick={onRetry}>Thử lại</button></div>
      )}
      {state.status === 'ready' && state.items.length === 0 && (
        <EmptyState icon={MessagesSquare} title="Chưa có cuộc trò chuyện" quiet
          action={<button type="button" className="cs-btn cs-btn-soft cs-btn-sm" onClick={onOpenFriends}>Mở Bạn bè</button>}>
          Vào Bạn bè và chọn Nhắn tin để bắt đầu trò chuyện.
        </EmptyState>
      )}
      {state.status === 'ready' && state.items.length > 0 && (
        <ul className="cs-chat-items">
          {state.items.map(c => <Item key={c.id} c={c} active={c.id === selectedId} onSelect={onSelect} />)}
        </ul>
      )}
    </div>
  )
}

function Item({ c, active, onSelect }: { c: ConversationItem; active: boolean; onSelect: (id: string) => void }) {
  const unread = c.unread > 0
  return (
    <li>
      <button type="button" className={'cs-chat-item' + (active ? ' is-active' : '') + (unread ? ' is-unread' : '')}
        aria-current={active ? 'true' : undefined}
        aria-label={`${c.name}${unread ? `, ${c.unread} tin chưa đọc` : ''}`} onClick={() => onSelect(c.id)}>
        <Avatar name={c.name} url={c.avatarUrl} size={48} />
        <span className="cs-chat-item-text">
          <span className="cs-chat-item-top">
            <span className="cs-chat-item-name">{c.name}</span>
            <span className="cs-chat-item-time">{shortTime(c.lastAt)}</span>
          </span>
          <span className="cs-chat-item-bottom">
            <span className="cs-chat-item-preview">{previewText(c)}</span>
            {unread && <span className="cs-nav-badge cs-chat-item-badge" aria-hidden="true">{c.unread > 99 ? '99+' : c.unread}</span>}
          </span>
        </span>
      </button>
    </li>
  )
}
