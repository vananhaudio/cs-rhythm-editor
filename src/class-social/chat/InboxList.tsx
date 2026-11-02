// Chat List V2 — danh sách Trò chuyện (iOS HIG Light, mobile-first): ô tìm kiếm · phân loại Tất cả/Cá nhân/Lớp học/Band · chip Chưa đọc ·
// mục Đã ghim (người dùng chủ động) · phân trang vô hạn · Thầy/Admin có khu "Quản lý Band" riêng (không tràn danh sách cá nhân).
// Thuần trình bày + hook useInbox; quyền/tìm kiếm/ghim do server (RPC chat_inbox*). Mọi cuộc trò chuyện vẫn mở bằng cùng id/route như trước.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, GraduationCap, MessagesSquare, MoreHorizontal, Pin, Search, Users, X } from 'lucide-react'
import { Avatar, EmptyState } from '../ui'
import { previewText, shortTime, type ConversationItem } from './chatModel'
import type { InboxSource } from './inboxApi'
import { KIND_LABEL, KIND_TABS, emptyReason, kindOf, unreadTotal, type InboxKind, type InboxSummary } from './inboxModel'
import { useInbox } from './useInbox'

type Inbox = ReturnType<typeof useInbox>

export default function InboxList({ inbox, source, selectedId, onSelect, onOpenFriends }: {
  inbox: Inbox
  source: InboxSource
  selectedId: string | null
  onSelect: (id: string) => void
  onOpenFriends: () => void
}) {
  const { state, filter, busy } = inbox
  const [manager, setManager] = useState(false)
  const [editing, setEditing] = useState(false)
  if (manager) return <BandManager source={source} selectedId={selectedId} onSelect={onSelect} onBack={() => setManager(false)} />
  const summary = state.summary
  const canPin = state.mode === 'server'
  const showManage = !!summary && summary.support > 0 && !inbox.searching && state.mode === 'server'
  const unread = summary ? unreadTotal(summary) : 0

  return (
    <div className="cs-chat-list cs-inbox" data-testid="inbox">
      <div className="cs-inbox-head">
        <SearchField value={inbox.rawQuery} onChange={inbox.setQuery} />
        <KindTabs kind={filter.kind} summary={summary} onChange={inbox.setKind} />
        <div className="cs-inbox-chips">
          <button type="button" className={'cs-inbox-chip' + (filter.unreadOnly ? ' is-on' : '')} aria-pressed={filter.unreadOnly}
            onClick={() => inbox.setUnreadOnly(!filter.unreadOnly)} data-testid="chip-unread">
            Chưa đọc{unread > 0 && <span className="cs-inbox-chip-n">{unread > 99 ? '99+' : unread}</span>}
          </button>
          {inbox.searching && <span className="cs-inbox-chips-note" role="status">Tìm trong tất cả cuộc trò chuyện</span>}
          {canPin && (
            <button type="button" className={'cs-inbox-edit' + (editing ? ' is-on' : '')} aria-pressed={editing} onClick={() => setEditing(e => !e)} data-testid="edit-toggle">
              {editing ? 'Xong' : 'Ghim'}
            </button>
          )}
        </div>
      </div>

      {inbox.pinError && (
        <div className="cs-inbox-toast" role="alert">{inbox.pinError}
          <button type="button" className="cs-link-btn" onClick={inbox.dismissPinError}>Đóng</button></div>
      )}

      <div className={'cs-inbox-scroll' + (busy ? ' is-busy' : '')} aria-busy={busy}>
        {state.status === 'loading' && <Skeleton />}
        {state.status === 'error' && (
          <div className="cs-feed-error" role="alert"><p>{state.error}</p>
            <button type="button" className="cs-btn cs-btn-soft" onClick={inbox.retry}>Thử lại</button></div>
        )}
        {state.status === 'ready' && (
          <>
            {showManage && (
              <button type="button" className="cs-inbox-manage" onClick={() => setManager(true)} data-testid="open-band-manager">
                <span className="cs-inbox-manage-ic" aria-hidden="true"><Users size={18} /></span>
                <span className="cs-inbox-manage-text"><b>Quản lý Band</b><small>{summary!.support} Band khác · chỉ xem</small></span>
                <ChevronRight size={18} aria-hidden="true" className="cs-inbox-chev" />
              </button>
            )}
            {state.pinned.length > 0 && !inbox.searching && (
              <section aria-label="Đã ghim">
                <h2 className="cs-inbox-sec"><Pin size={12} aria-hidden="true" /> Đã ghim</h2>
                <ul className="cs-inbox-list">{state.pinned.map(c => <Row key={c.id} c={c} showKind={filter.kind === 'all'} active={c.id === selectedId} canPin={canPin} editing={editing} onSelect={onSelect} onTogglePin={inbox.togglePin} />)}</ul>
              </section>
            )}
            {state.items.length > 0 && (
              <section aria-label={inbox.searching ? 'Kết quả tìm kiếm' : 'Tin nhắn'}>
                {state.pinned.length > 0 && !inbox.searching && <h2 className="cs-inbox-sec">Tin nhắn</h2>}
                {inbox.searching && <h2 className="cs-inbox-sec">Kết quả{state.hasMore ? '' : ` · ${state.items.length}`}</h2>}
                <ul className="cs-inbox-list">{state.items.map(c => <Row key={c.id} c={c} showKind={filter.kind === 'all'} active={c.id === selectedId} canPin={canPin} editing={editing} onSelect={onSelect} onTogglePin={inbox.togglePin} />)}</ul>
              </section>
            )}
            {state.items.length === 0 && state.pinned.length === 0 && (
              <Empty filter={filter} summary={summary} onOpenFriends={onOpenFriends} onClear={inbox.clearFilters}
                hasManager={!!summary && summary.support > 0 && state.mode === 'server'} onManage={() => setManager(true)} />
            )}
            <Footer inbox={inbox} />
          </>
        )}
      </div>
    </div>
  )
}

function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="cs-inbox-search">
      <Search size={16} aria-hidden="true" className="cs-inbox-search-ic" />
      <input type="search" inputMode="search" enterKeyHint="search" autoComplete="off" autoCorrect="off" spellCheck={false}
        className="cs-inbox-search-input" placeholder="Tìm người, Band, lớp" aria-label="Tìm cuộc trò chuyện" value={value}
        onChange={e => onChange(e.target.value)} data-testid="inbox-search" />
      {value && <button type="button" className="cs-inbox-search-x" aria-label="Xoá tìm kiếm" onClick={() => onChange('')}><X size={14} aria-hidden="true" /></button>}
    </div>
  )
}

function KindTabs({ kind, summary, onChange }: { kind: InboxKind; summary: InboxSummary | null; onChange: (k: InboxKind) => void }) {
  return (
    <div className="cs-inbox-seg" role="tablist" aria-label="Loại cuộc trò chuyện">
      {KIND_TABS.map(t => {
        const unread = !summary ? 0 : t.id === 'dm' ? summary.unreadDm : t.id === 'band' ? summary.unreadBand : t.id === 'class' ? summary.unreadClass : 0
        return (
          <button key={t.id} type="button" role="tab" aria-selected={kind === t.id} className={'cs-inbox-seg-btn' + (kind === t.id ? ' is-on' : '')}
            onClick={() => onChange(t.id)} data-testid={`tab-${t.id}`}>
            {t.label}{unread > 0 && <span className="cs-inbox-seg-dot" aria-label={`${unread} chưa đọc`} />}
          </button>
        )
      })}
    </div>
  )
}

function Skeleton() {
  return <div className="cs-inbox-skel" aria-label="Đang tải">{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="cs-skeleton" style={{ height: 56, margin: '0 16px 10px', borderRadius: 14 }} />)}</div>
}

function Footer({ inbox }: { inbox: Inbox }) {
  const { state } = inbox
  const ref = useRef<HTMLDivElement>(null)
  const { loadMore } = inbox
  useEffect(() => {
    const el = ref.current
    if (!el || !state.hasMore || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) void loadMore() }, { rootMargin: '240px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [state.hasMore, state.items.length, loadMore])
  if (state.hasMore) {
    return (
      <div ref={ref} className="cs-inbox-more-wrap" data-testid="inbox-sentinel">
        {state.loadingMore && <div className="cs-skeleton" style={{ height: 56, margin: '0 16px', borderRadius: 14 }} aria-label="Đang tải thêm" />}
        {state.loadMoreError && <p className="cs-inbox-note" role="alert">{state.loadMoreError} <button type="button" className="cs-link-btn" onClick={() => void loadMore()}>Thử lại</button></p>}
        {!state.loadingMore && !state.loadMoreError && <button type="button" className="cs-btn cs-btn-soft cs-btn-sm" onClick={() => void loadMore()}>Tải thêm</button>}
      </div>
    )
  }
  const total = state.items.length + state.pinned.length
  if (state.mode === 'legacy' && total >= 100) return <p className="cs-inbox-note" data-testid="legacy-note">Đang hiển thị 100 cuộc trò chuyện gần nhất. Cập nhật máy chủ để xem toàn bộ và tìm kiếm trong tất cả.</p>
  if (total > 30 && !inbox.searching) return <p className="cs-inbox-note" data-testid="end-note">Đã hiển thị tất cả {total} cuộc trò chuyện</p>
  return null
}

function Empty({ filter, summary, onOpenFriends, onClear, hasManager, onManage }: {
  filter: Inbox['filter']; summary: InboxSummary | null; onOpenFriends: () => void; onClear: () => void; hasManager: boolean; onManage: () => void
}) {
  const r = emptyReason(filter, summary)
  const friends = <button type="button" className="cs-btn cs-btn-soft cs-btn-sm" onClick={onOpenFriends}>Mở Bạn bè</button>
  const all = <button type="button" className="cs-btn cs-btn-soft cs-btn-sm" onClick={onClear}>Xem tất cả</button>
  const cfg: Record<string, { title: string; body: string; action?: ReactNode }> = {
    search: { title: `Không tìm thấy “${filter.query.trim()}”`, body: hasManager ? 'Thử tên khác. Muốn tìm Band bạn không thuộc, mở Quản lý Band.' : 'Thử tên khác hoặc gõ không dấu.', action: hasManager ? <button type="button" className="cs-btn cs-btn-soft cs-btn-sm" onClick={onManage}>Mở Quản lý Band</button> : all },
    unread: { title: 'Bạn đã đọc hết', body: 'Không còn cuộc trò chuyện nào chưa đọc.', action: all },
    'kind-dm': { title: 'Chưa có cuộc trò chuyện cá nhân', body: 'Vào Bạn bè và chọn Nhắn tin để bắt đầu.', action: friends },
    'kind-band': { title: 'Bạn chưa thuộc Band nào', body: 'Khi bạn thuộc một Band, nhóm chat của Band sẽ hiện ở đây.' },
    'kind-class': { title: 'Nhóm chat lớp học sắp có', body: 'Khi nhóm chat của lớp bạn được mở, nó sẽ hiện ở đây.' },
    all: { title: 'Chưa có cuộc trò chuyện', body: 'Vào Bạn bè và chọn Nhắn tin để bắt đầu trò chuyện. Khi bạn thuộc một Band, nhóm chat của Band sẽ hiện ở đây.', action: friends },
    none: { title: 'Không có cuộc trò chuyện phù hợp', body: 'Thử bỏ bộ lọc.', action: all },
  }
  const c = cfg[r] ?? cfg.none
  return <EmptyState icon={r === 'kind-class' ? GraduationCap : r === 'search' ? Search : MessagesSquare} title={c.title} quiet action={c.action}>{c.body}</EmptyState>
}

function Row({ c, showKind, active, canPin, editing = false, onSelect, onTogglePin }: {
  c: ConversationItem; showKind: boolean; active: boolean; canPin: boolean; editing?: boolean; onSelect: (id: string) => void; onTogglePin: (c: ConversationItem) => void
}) {
  const [menu, setMenu] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)   // nhấn giữ vừa mở menu → bỏ cú click do nhả tay sinh ra (không mở nhầm hội thoại)
  const unread = c.unread > 0
  const kind = kindOf(c)
  const group = kind !== 'dm'
  const pinnable = canPin && c.readOnly !== 'support'
  useEffect(() => {
    if (!menu) return
    const close = (e: Event) => { if (!(e.target instanceof Element) || !e.target.closest('.cs-inbox-menu-host')) setMenu(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false) }
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc) }
  }, [menu])
  const startPress = () => { if (pinnable) timer.current = setTimeout(() => { held.current = true; setMenu(true); setTimeout(() => { held.current = false }, 900) }, 480) }
  const endPress = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null } }
  const tag = kind === 'band' ? (c.readOnly === 'archived' ? 'Band · lưu trữ' : c.readOnly === 'support' ? 'Band · xem' : KIND_LABEL.band) : KIND_LABEL[kind]
  return (
    <li className="cs-inbox-li">
      <div className={'cs-inbox-row cs-inbox-menu-host' + (active ? ' is-active' : '') + (unread ? ' is-unread' : '')}
        onContextMenu={pinnable ? (e => { e.preventDefault(); setMenu(true) }) : undefined}
        onTouchStart={startPress} onTouchEnd={endPress} onTouchMove={endPress} onTouchCancel={endPress}>
        <button type="button" className="cs-inbox-main" aria-current={active ? 'true' : undefined} data-testid="inbox-row" data-kind={kind} data-conv={c.id}
          aria-label={`${kind === 'band' ? 'Nhóm Band ' : kind === 'class' ? 'Nhóm lớp ' : ''}${c.name}${c.pinned ? ', đã ghim' : ''}${unread ? `, ${c.unread} tin chưa đọc` : ''}`}
          onClick={() => { endPress(); if (held.current) { held.current = false; return } onSelect(c.id) }}>
          <span className={'cs-inbox-av' + (group ? ' is-group' : '')}>
            <Avatar name={c.name} url={c.avatarUrl} size={48} className={group ? 'cs-avatar-sq' : undefined} />
            {group && <span className={'cs-inbox-av-badge is-' + kind} aria-hidden="true">{kind === 'class' ? <GraduationCap size={11} /> : <Users size={11} />}</span>}
          </span>
          <span className="cs-inbox-text">
            <span className="cs-inbox-top">
              <span className="cs-inbox-name">{c.name}</span>
              {showKind && group && <span className={'cs-inbox-tag is-' + kind}>{tag}</span>}
              <span className="cs-inbox-time">{shortTime(c.lastAt)}</span>
            </span>
            <span className="cs-inbox-bottom">
              <span className="cs-inbox-preview">{previewText(c)}</span>
              {c.pinned && !unread && <Pin size={13} className="cs-inbox-pin" aria-hidden="true" />}
              {unread && <span className="cs-nav-badge cs-chat-item-badge" aria-hidden="true">{c.unread > 99 ? '99+' : c.unread}</span>}
            </span>
          </span>
        </button>
        {pinnable && editing && (
          <button type="button" className={'cs-inbox-pinbtn' + (c.pinned ? ' is-on' : '')} data-testid="row-pin" aria-pressed={!!c.pinned}
            aria-label={`${c.pinned ? 'Bỏ ghim' : 'Ghim'} ${c.name}`} onClick={() => onTogglePin(c)}>
            <Pin size={14} aria-hidden="true" />{c.pinned ? 'Bỏ ghim' : 'Ghim'}
          </button>
        )}
        {pinnable && !editing && (
          <button type="button" className="cs-inbox-more" aria-label={`Tuỳ chọn cho ${c.name}`} aria-haspopup="menu" aria-expanded={menu} data-testid="row-more"
            onClick={e => { e.stopPropagation(); setMenu(m => !m) }}><MoreHorizontal size={18} aria-hidden="true" /></button>
        )}
        {menu && (
          <div className="cs-inbox-menu" role="menu">
            <button type="button" role="menuitem" className="cs-inbox-menu-item" data-testid="menu-pin" autoFocus
              onClick={() => { setMenu(false); onTogglePin(c) }}><Pin size={15} aria-hidden="true" />{c.pinned ? 'Bỏ ghim' : 'Ghim lên đầu'}</button>
          </div>
        )}
      </div>
    </li>
  )
}

/** Thầy/Admin: quản lý nhiều Band (chỉ xem) — tìm kiếm + phân trang riêng, không lẫn danh sách cá nhân */
function BandManager({ source, selectedId, onSelect, onBack }: { source: InboxSource; selectedId: string | null; onSelect: (id: string) => void; onBack: () => void }) {
  const inbox = useInbox(source, { scope: 'support' })
  const { state, busy } = inbox
  return (
    <div className="cs-chat-list cs-inbox cs-inbox-manager" data-testid="band-manager">
      <div className="cs-inbox-head">
        <div className="cs-inbox-mgr-bar">
          <button type="button" className="cs-inbox-back" onClick={onBack} data-testid="manager-back"><ChevronLeft size={20} aria-hidden="true" />Trò chuyện</button>
          <h2 className="cs-inbox-mgr-title">Quản lý Band</h2>
        </div>
        <SearchField value={inbox.rawQuery} onChange={inbox.setQuery} />
        <p className="cs-inbox-note cs-inbox-mgr-note">Các Band bạn không thuộc — chỉ xem để hỗ trợ.</p>
      </div>
      <div className={'cs-inbox-scroll' + (busy ? ' is-busy' : '')}>
        {state.status === 'loading' && <Skeleton />}
        {state.status === 'error' && <div className="cs-feed-error" role="alert"><p>{state.error}</p><button type="button" className="cs-btn cs-btn-soft" onClick={inbox.retry}>Thử lại</button></div>}
        {state.status === 'ready' && state.items.length === 0 && (
          <EmptyState icon={Users} title={inbox.searching ? `Không tìm thấy “${inbox.filter.query}”` : 'Không có Band nào'} quiet>{inbox.searching ? 'Thử tên khác.' : 'Chưa có Band để quản lý.'}</EmptyState>
        )}
        {state.status === 'ready' && state.items.length > 0 && (
          <ul className="cs-inbox-list">{state.items.map(c => <Row key={c.id} c={c} showKind={false} active={c.id === selectedId} canPin={false} onSelect={onSelect} onTogglePin={() => {}} />)}</ul>
        )}
        {state.status === 'ready' && <Footer inbox={inbox} />}
      </div>
    </div>
  )
}
