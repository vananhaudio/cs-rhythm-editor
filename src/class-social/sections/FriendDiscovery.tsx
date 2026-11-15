// Tìm người + Gợi ý kết bạn (mô hình Facebook Friends). Dữ liệu từ useFriendDiscovery.
import { Search, UserPlus, X } from 'lucide-react'
import { searchSub, suggestionSub, type FriendAction, type PersonCard, type SearchPerson, type Suggestion } from '../friends/friendModel'
import type { SearchState, SuggestState } from '../friends/useFriendDiscovery'
import { Avatar, EmptyState, PersonLink } from '../ui'
import { IdentityBadges } from '../identity/IdentityBadges'
import RelationshipButton from './RelationshipButton'

export function FriendSearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="cs-friend-search" role="search">
      <Search size={18} aria-hidden="true" className="cs-friend-search-ico" />
      <input type="search" className="cs-friend-search-input" value={value} maxLength={80} enterKeyHint="search"
        placeholder="Tìm bạn bè theo tên" aria-label="Tìm bạn bè theo tên" autoComplete="off" autoCorrect="off"
        onChange={e => onChange(e.target.value)} />
      {value && (
        <button type="button" className="cs-friend-search-clear" aria-label="Xoá nội dung tìm" onClick={() => onChange('')}>
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export function FriendSearchResults({ state, busyId, onAct, onOpenProfile, onMessage, onRetry }: {
  state: SearchState
  busyId: string | null
  onAct: (p: SearchPerson, a: FriendAction) => void
  onOpenProfile: (id: string) => void
  onMessage?: (id: string) => void
  onRetry: () => void
}) {
  if (state.status === 'idle') return null
  return (
    <section className="cs-card cs-friends-card" aria-labelledby="cs-find-title" aria-live="polite">
      <h2 id="cs-find-title" className="cs-friends-title">Kết quả tìm kiếm</h2>
      {state.status === 'loading' && <div className="cs-skeleton" style={{ width: '50%' }} aria-label="Đang tìm" />}
      {state.status === 'error' && (
        <div className="cs-feed-error" role="alert"><p>{state.message}</p>
          <button type="button" className="cs-btn cs-btn-soft" onClick={onRetry}>Thử lại</button></div>
      )}
      {state.status === 'ready' && state.items.length === 0 && (
        <EmptyState icon={Search} title="Không tìm thấy ai" quiet>Thử gõ ít từ hơn hoặc kiểm tra lại tên.</EmptyState>
      )}
      {state.status === 'ready' && state.items.length > 0 && (
        <ul className="cs-people">
          {state.items.map(p => (
            <li key={p.userId} className="cs-person">
              <PersonLink userId={p.userId} onOpen={onOpenProfile} label={`Trang cá nhân của ${p.name}`} className="cs-person-main">
                <Avatar name={p.name} url={p.avatarUrl} size={48} />
                <span className="cs-person-text">
                  <span className="cs-person-name">{p.name}{p.isTeacher ? <span className="cs-post-role"> · Giáo viên</span> : <IdentityBadges userId={p.userId} max={1} />}</span>
                  {searchSub(p) && <span className="cs-person-sub">{searchSub(p)}</span>}
                </span>
              </PersonLink>
              <div className="cs-person-actions">
                <RelationshipButton relationship={p.relationship} name={p.name} busy={busyId === p.userId} onAct={a => onAct(p, a)} />
                {p.relationship === 'friends' && onMessage && (
                  <button type="button" className="cs-btn cs-btn-soft cs-btn-sm" aria-label={`Nhắn tin cho ${p.name}`} onClick={() => onMessage(p.userId)}>Nhắn tin</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function FriendSuggestions({ state, hidden, busyId, onAdd, onHide, onOpenProfile, onRetry }: {
  state: SuggestState
  hidden: ReadonlySet<string>
  busyId: string | null
  onAdd: (p: PersonCard) => void
  onHide: (id: string) => void
  onOpenProfile: (id: string) => void
  onRetry: () => void
}) {
  const items: Suggestion[] = state.status === 'ready' ? state.items.filter(x => !hidden.has(x.userId)) : []
  if (state.status === 'loading' || (state.status === 'ready' && items.length === 0)) return null   // không dựng khung rỗng
  return (
    <section className="cs-card cs-friends-card" aria-labelledby="cs-sug-title">
      <h2 id="cs-sug-title" className="cs-friends-title">Những người bạn có thể biết</h2>
      {state.status === 'error' && (
        <div className="cs-feed-error" role="alert"><p>{state.message}</p>
          <button type="button" className="cs-btn cs-btn-soft" onClick={onRetry}>Thử lại</button></div>
      )}
      <ul className="cs-people">
        {items.map(p => (
          <li key={p.userId} className="cs-person">
            <PersonLink userId={p.userId} onOpen={onOpenProfile} label={`Trang cá nhân của ${p.name}`} className="cs-person-main">
              <Avatar name={p.name} url={p.avatarUrl} size={48} />
              <span className="cs-person-text">
                <span className="cs-person-name">{p.name}<IdentityBadges userId={p.userId} max={1} /></span>
                {suggestionSub(p) && <span className="cs-person-sub">{suggestionSub(p)}</span>}
              </span>
            </PersonLink>
            <div className="cs-person-actions">
              <button type="button" className="cs-btn cs-btn-primary cs-btn-sm" disabled={busyId !== null}
                aria-label={`Gửi lời mời kết bạn tới ${p.name}`} onClick={() => onAdd(p)}>
                <UserPlus size={16} aria-hidden="true" />{busyId === p.userId ? 'Đang gửi…' : 'Kết bạn'}
              </button>
              <button type="button" className="cs-btn cs-btn-soft cs-btn-sm" disabled={busyId !== null}
                aria-label={`Ẩn gợi ý ${p.name}`} onClick={() => onHide(p.userId)}>Gỡ</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
