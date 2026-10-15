// Danh sách hội thoại (mới nhất trước): avatar · tên · xem trước tin cuối · giờ · badge chưa đọc.
import { BellRing, MessagesSquare, Users } from 'lucide-react'
import { Avatar, EmptyState } from '../ui'
import { SYSTEM_NAME, previewText, shortTime, type ConversationItem, type SystemSummary } from './chatModel'
import type { ListState } from './useChat'

export default function ConversationList({ state, selectedId, onSelect, onRetry, onOpenFriends, system = null, systemActive = false, onSelectSystem }: {
  state: ListState
  selectedId: string | null
  onSelect: (id: string) => void
  onRetry: () => void
  onOpenFriends: () => void
  /** Class 2.0: null = chưa dùng được → không hiện mục */
  system?: SystemSummary | null
  systemActive?: boolean
  onSelectSystem?: () => void
}) {
  return (
    <div className="cs-chat-list">
      <div className="cs-chat-list-head">Đoạn chat</div>
      {system && onSelectSystem && <ul className="cs-chat-items cs-chat-items-system"><SystemItem s={system} active={systemActive} onSelect={onSelectSystem} /></ul>}
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
          Vào Bạn bè và chọn Nhắn tin để bắt đầu trò chuyện. Khi bạn thuộc một Band, nhóm chat của Band sẽ hiện ở đây.
        </EmptyState>
      )}
      {state.status === 'ready' && state.items.length > 0 && (
        <>
          <ul className="cs-chat-items">
            {state.items.filter(c => c.readOnly !== 'support').map(c => <Item key={c.id} c={c} active={c.id === selectedId} onSelect={onSelect} />)}
          </ul>
          {state.items.some(c => c.readOnly === 'support') && (
            <>
              <div className="cs-chat-list-sub">Hỗ trợ · nhóm Band bạn không thuộc (chỉ xem)</div>
              <ul className="cs-chat-items">
                {state.items.filter(c => c.readOnly === 'support').map(c => <Item key={c.id} c={c} active={c.id === selectedId} onSelect={onSelect} />)}
              </ul>
            </>
          )}
        </>
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
        aria-label={`${c.kind === 'band' ? 'Nhóm Band ' : ''}${c.name}${unread ? `, ${c.unread} tin chưa đọc` : ''}`} onClick={() => onSelect(c.id)}>
        <Avatar name={c.name} url={c.avatarUrl} size={48} />
        <span className="cs-chat-item-text">
          <span className="cs-chat-item-top">
            <span className="cs-chat-item-name">{c.name}</span>
            {c.kind === 'band' && <span className="cs-chat-item-tag"><Users size={12} aria-hidden="true" />{c.readOnly === 'archived' ? 'Band · lưu trữ' : c.readOnly === 'support' ? 'Band · xem' : 'Band'}</span>}
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

/** Kênh thông báo chính thức: nhận diện hệ thống (không phải người dùng, không avatar cá nhân) */
function SystemItem({ s, active, onSelect }: { s: SystemSummary; active: boolean; onSelect: () => void }) {
  const unread = s.unread > 0
  return (
    <li>
      <button type="button" className={'cs-chat-item cs-chat-item-system' + (active ? ' is-active' : '') + (unread ? ' is-unread' : '')}
        aria-current={active ? 'true' : undefined}
        aria-label={`${SYSTEM_NAME}, thông báo chính thức${unread ? `, ${s.unread} chưa đọc` : ''}`} onClick={onSelect}>
        <span className="cs-sys-avatar" aria-hidden="true"><BellRing size={22} /></span>
        <span className="cs-chat-item-text">
          <span className="cs-chat-item-top">
            <span className="cs-chat-item-name">{SYSTEM_NAME}</span>
            {s.lastAt && <span className="cs-chat-item-time">{shortTime(s.lastAt)}</span>}
          </span>
          <span className="cs-chat-item-bottom">
            <span className="cs-chat-item-preview">{s.lastBody || 'Chưa có thông báo'}</span>
            {unread && <span className="cs-nav-badge cs-chat-item-badge" aria-hidden="true">{s.unread > 99 ? '99+' : s.unread}</span>}
          </span>
        </span>
      </button>
    </li>
  )
}
