// /me/friends — Lời mời kết bạn + Bạn bè. Dữ liệu THẬT từ RPC (my_friends, incoming_friend_requests).
// Lời mời dùng CHUNG nguồn với badge "Bạn bè" + khối Home (useFriendRequests ở shell) → xử lý ở đây,
// badge đổi ngay. Chưa có tìm kiếm / gợi ý: kết bạn từ trang cá nhân (bấm tên một người trong Cộng đồng).
import { useCallback, useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { fetchFriends } from '../friends/friendsApi'
import type { PersonCard } from '../friends/friendModel'
import type { FriendRequests } from '../friends/useFriendRequests'
import { Avatar, EmptyState, PersonLink } from '../ui'
import FriendRequestList from './FriendRequestList'

type FriendList = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; friends: PersonCard[] }

async function loadFriends(): Promise<FriendList> {
  const r = await fetchFriends()
  return r.ok ? { status: 'ready', friends: r.value } : { status: 'error', message: r.message }
}

export default function Friends({ requests, onOpenProfile }: {
  requests: FriendRequests
  onOpenProfile: (userId: string) => void
}) {
  const [list, setList] = useState<FriendList>({ status: 'loading' })
  const { refresh: refreshRequests } = requests

  useEffect(() => {
    let alive = true
    void loadFriends().then(l => { if (alive) setList(l) })
    void refreshRequests()   // mở trang Bạn bè = xem lời mời mới nhất
    return () => { alive = false }
  }, [refreshRequests])

  const reload = useCallback(async () => setList(await loadFriends()), [])

  const respond = async (userId: string, accept: boolean) => {
    if (await requests.respond(userId, accept) && accept) await reload()
  }

  return (
    <div className="cs-col">
      <h1 className="cs-page-title">Bạn bè</h1>
      {requests.actionError && <p className="cs-form-error" role="alert">{requests.actionError}</p>}

      <section className="cs-card cs-friends-card" aria-labelledby="cs-req-title">
        <h2 id="cs-req-title" className="cs-friends-title">
          Lời mời kết bạn{requests.count > 0 && <span className="cs-count">{requests.count}</span>}
        </h2>
        {!requests.loaded && <div className="cs-skeleton" style={{ width: '50%' }} aria-label="Đang tải" />}
        {requests.loaded && requests.error && requests.count === 0 && (
          <p className="cs-friends-empty" role="alert">{requests.error}{' '}
            <button type="button" className="cs-link-btn" onClick={() => void refreshRequests()}>Thử lại</button></p>
        )}
        {requests.loaded && !requests.error && requests.count === 0 && <p className="cs-friends-empty">Chưa có lời mời mới.</p>}
        {requests.count > 0 && (
          <FriendRequestList items={requests.items} busyId={requests.busyId}
            onRespond={(id, accept) => void respond(id, accept)} onOpenProfile={onOpenProfile} />
        )}
      </section>

      <section className="cs-card cs-friends-card" aria-labelledby="cs-fr-title">
        <h2 id="cs-fr-title" className="cs-friends-title">
          Bạn bè{list.status === 'ready' && list.friends.length > 0 && <span className="cs-count">{list.friends.length}</span>}
        </h2>
        {list.status === 'loading' && <div className="cs-skeleton" style={{ width: '50%' }} aria-label="Đang tải" />}
        {list.status === 'error' && (
          <div className="cs-feed-error" role="alert">
            <p>{list.message}</p>
            <button type="button" className="cs-btn cs-btn-soft" onClick={() => { setList({ status: 'loading' }); void reload() }}>Thử lại</button>
          </div>
        )}
        {list.status === 'ready' && list.friends.length === 0 && (
          <EmptyState icon={Users} title="Bạn chưa có bạn bè.">
            Bấm vào tên một thành viên trong Cộng đồng để xem trang cá nhân và gửi lời mời kết bạn.
          </EmptyState>
        )}
        {list.status === 'ready' && list.friends.length > 0 && (
          <ul className="cs-people">
            {list.friends.map(p => (
              <li key={p.userId} className="cs-person">
                <PersonLink userId={p.userId} onOpen={onOpenProfile} label={`Trang cá nhân của ${p.name}`} className="cs-person-main">
                  <Avatar name={p.name} url={p.avatarUrl} size={48} />
                  <span className="cs-person-name">{p.name}{p.isTeacher && <span className="cs-post-role"> · Giáo viên</span>}</span>
                </PersonLink>
                <div className="cs-person-actions">
                  <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm" onClick={() => onOpenProfile(p.userId)}>Xem trang cá nhân</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
