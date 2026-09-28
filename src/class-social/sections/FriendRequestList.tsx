// Danh sách lời mời kết bạn đến mình: avatar + tên (mở trang cá nhân) + Chấp nhận / Từ chối.
// Dùng chung cho khối trên Home và trang Bạn bè.
import type { PersonCard } from '../friends/friendModel'
import { Avatar, PersonLink } from '../ui'

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
            <span className="cs-person-name">{p.name}</span>
          </PersonLink>
          <div className="cs-person-actions">
            <button type="button" className="cs-btn cs-btn-primary cs-btn-sm" disabled={busyId !== null}
              onClick={() => onRespond(p.userId, true)}>Chấp nhận</button>
            <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm" disabled={busyId !== null}
              onClick={() => onRespond(p.userId, false)}>Từ chối</button>
          </div>
        </li>
      ))}
    </ul>
  )
}
