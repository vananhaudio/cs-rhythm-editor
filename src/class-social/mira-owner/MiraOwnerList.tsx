// Danh sách học viên đã trò chuyện với Mira (Owner) — dùng trong Hộp thư (cùng khung với Hỗ trợ lớp học / Quản lý Band) và ở đường dẫn cũ /me/mira-owner.
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, Search, Sparkles, X } from 'lucide-react'
import { EmptyState } from '../ui'
import { Avatar } from '../ui'
import { listConversations, type MiraConvItem, type MiraConvList } from './miraOwnerApi'
import { fmtTime } from './MiraOwnerThread'

export default function MiraOwnerList({ selectedId, onSelect, onBack, backLabel = 'Trò chuyện' }: { selectedId: string | null; onSelect: (conversationId: string) => void; onBack?: () => void; backLabel?: string }) {
  const [raw, setRaw] = useState('')
  const [q, setQ] = useState('')
  const [list, setList] = useState<MiraConvList | null>(null)
  const [st, setSt] = useState<'loading' | 'ok' | 'forbidden' | 'error'>('loading')
  const [more, setMore] = useState(false)
  const seq = useRef(0)
  useEffect(() => { const t = setTimeout(() => setQ(raw.trim()), 300); return () => clearTimeout(t) }, [raw])   // tìm sau khi ngừng gõ; lọc do SERVER

  const load = useCallback(async (query: string) => {
    const my = ++seq.current
    setSt('loading')
    const r = await listConversations({ q: query })
    if (my !== seq.current) return   // câu tìm cũ về sau không đè câu mới
    if (!r.ok) { setSt(r.reason === 'forbidden' ? 'forbidden' : 'error'); return }
    setList(r.data); setSt('ok')
  }, [])
  useEffect(() => { void load(q) }, [q, load])
  const loadMore = async () => {
    if (!list?.next_before) return
    setMore(true)
    const r = await listConversations({ q, before: list.next_before })
    setMore(false)
    if (r.ok) setList({ ...r.data, items: [...list.items, ...r.data.items] })
  }
  const row = (c: MiraConvItem) => (
    <li key={c.conversation_id} className="cs-inbox-li">
      <div className={'cs-inbox-row' + (c.conversation_id === selectedId ? ' is-active' : '')}>
        <button type="button" className="cs-inbox-main" data-testid="mira-owner-row" aria-current={c.conversation_id === selectedId ? 'true' : undefined}
          aria-label={`${c.display_name ?? 'Học viên'}, ${c.turn_count} lượt`} onClick={() => onSelect(c.conversation_id)}>
          <span className="cs-inbox-av"><Avatar name={c.display_name ?? 'Học viên'} url={null} size={48} /></span>
          <span className="cs-inbox-text">
            <span className="cs-inbox-top"><span className="cs-inbox-name">{c.display_name ?? 'Học viên'}</span><span className="cs-inbox-time">{fmtTime(c.last_at)}</span></span>
            <span className="cs-inbox-bottom"><span className="cs-inbox-preview">{c.matched ? '🔎 ' : ''}{c.snippet}</span></span>
          </span>
        </button>
      </div>
    </li>
  )
  return (
    <div className="cs-chat-list cs-inbox cs-inbox-manager" data-testid="mira-owner-manager">
      <div className="cs-inbox-head">
        <div className="cs-inbox-mgr-bar">
          {onBack && <button type="button" className="cs-inbox-back" onClick={onBack} data-testid="manager-back"><ChevronLeft size={20} aria-hidden="true" />{backLabel}</button>}
          <h2 className="cs-inbox-mgr-title">Mira · học viên</h2>
        </div>
        <div className="cs-inbox-search">
          <Search size={16} aria-hidden="true" className="cs-inbox-search-ic" />
          <input type="search" inputMode="search" autoComplete="off" spellCheck={false} className="cs-inbox-search-input" value={raw} onChange={e => setRaw(e.target.value)}
            placeholder="Tìm theo tên hoặc nội dung (không cần dấu)" aria-label="Tìm hội thoại với Mira" data-testid="mira-owner-search" />
          {raw && <button type="button" className="cs-inbox-search-x" aria-label="Xoá tìm kiếm" onClick={() => setRaw('')}><X size={14} aria-hidden="true" /></button>}
        </div>
        <p className="cs-inbox-note cs-inbox-mgr-note">Hội thoại học viên với Mira — chỉ Owner đọc.{list ? ` ${list.total_conversations} hội thoại · ${list.total_students} học viên.` : ''}</p>
      </div>
      <div className="cs-inbox-scroll">
        {st === 'loading' && !list && <div className="cs-skeleton" style={{ width: 200, height: 18, margin: 16 }} aria-label="Đang tải" />}
        {st === 'forbidden' && <EmptyState icon={Sparkles} title="Chỉ dành cho Owner" quiet>Mục này không mở cho tài khoản của bạn.</EmptyState>}
        {st === 'error' && <div className="cs-feed-error" role="alert"><p>Chưa tải được.</p><button type="button" className="cs-btn cs-btn-soft" onClick={() => void load(q)}>Thử lại</button></div>}
        {st === 'ok' && list && list.items.length === 0 && (
          <EmptyState icon={Sparkles} title={q ? `Không tìm thấy “${q}”` : 'Chưa có hội thoại nào'} quiet>
            {q ? 'Thử từ khoá khác.' : 'Hội thoại chỉ được lưu khi học viên đã đồng ý thông báo có lưu hội thoại.'}</EmptyState>)}
        {st === 'ok' && list && list.items.length > 0 && <ul className="cs-inbox-list">{list.items.map(row)}</ul>}
        {st === 'ok' && list?.next_before && <button type="button" className="cs-btn cs-btn-soft" disabled={more} onClick={() => void loadMore()}>{more ? 'Đang tải…' : 'Xem thêm'}</button>}
      </div>
    </div>
  )
}
