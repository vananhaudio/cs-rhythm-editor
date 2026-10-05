// Danh sách lời mời kết bạn đến mình: avatar + tên (mở trang cá nhân) + thời điểm + Xác nhận / Xóa (như Facebook).
// Dùng chung cho khối trên Home và trang Bạn bè.
import type { PersonCard } from '../friends/friendModel'
import { relativeTime } from '../posts/postModel'
import { Avatar, PersonLink } from '../ui'
import { IdentityBadges } from '../identity/IdentityBadges'

export default function FriendRequestList({ items, busyId, onRespond, onOpenProfile }: {
  items: PersonCard[]
  busyId: string | null
  onRespond: (userId: string, accept: boolean) => void
  onOpenProfile: (userId: string) => void
}) {
  return (
    <ul className="cs-people">
      {items.map(p => (
        <li key={p.userId} className="cs-person">
          <PersonLink userId={p.userId} onOpen={onOpenProfile} label={`Trang cá nhân của ${p.name}`} className="cs-person-main">
            <Avatar name={p.name} url={p.avatarUrl} size={48} />
            <span className="cs-person-text">
              <span className="cs-person-name">{p.name}<IdentityBadges userId={p.userId} max={1} /></span>
              {p.at && <span className="cs-person-sub">{relativeTime(p.at)}</span>}
            </span>
          </PersonLink>
          <div className="cs-person-actions">
            <button type="button" className="cs-btn cs-btn-primary cs-btn-sm" disabled={busyId !== null}
              aria-label={`Xác nhận lời mời của ${p.name}`} onClick={() => onRespond(p.userId, true)}>Xác nhận</button>
            <button type="button" className="cs-btn cs-btn-soft cs-btn-sm" disabled={busyId !== null}
              aria-label={`Xóa lời mời của ${p.name}`} onClick={() => onRespond(p.userId, false)}>Xóa</button>
          </div>
        </li>
      ))}
    </ul>
  )
}
