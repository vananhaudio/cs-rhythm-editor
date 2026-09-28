// /me/friends — Lời mời kết bạn + Bạn bè. Dữ liệu THẬT từ RPC (my_friends, incoming_friend_requests).
// Chưa có tìm kiếm / gợi ý: kết bạn từ trang cá nhân (bấm tên một người trong Cộng đồng).
import { useCallback, useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { fetchFriends, fetchIncomingRequests, respondFriendRequest } from '../friends/friendsApi'
import type { PersonCard } from '../friends/friendModel'
import { Avatar, EmptyState, PersonLink } from '../ui'

type Lists = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; incoming: PersonCard[]; friends: PersonCard[] }

async function loadLists(): Promise<Lists> {
  const [inc, fr] = await Promise.all([fetchIncomingRequests(), fetchFriends()])
  if (!inc.ok) return { status: 'error', message: inc.message }
  if (!fr.ok) return { status: 'error', message: fr.message }
  return { status: 'ready', incoming: inc.value, friends: fr.value }
}

export default function Friends({ onOpenProfile }: { onOpenProfile: (userId: string) => void }) {
  const [lists, setLists] = useState<Lists>({ status: 'loading' })
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void loadLists().then(l => { if (alive) setLists(l) })
    return () => { alive = false }
  }, [])

  const reload = useCallback(async () => setLists(await loadLists()), [])

  const respond = async (userId: string, accept: boolean) => {
    if (busyId) return
    setBusyId(userId)
    setActionError(null)
    const r = await respondFriendRequest(userId, accept)
    if (!r.ok) setActionError(r.message)
    await reload()
    setBusyId(null)
  }

  return (
    <div className="cs-col">
      <h1 className="cs-page-title">Bạn bè</h1>
      {actionError && <p className="cs-form-error" role="alert">{actionError}</p>}

      {lists.status === 'loading' && <div className="cs-card cs-friends-card" aria-label="Đang tải"><div className="cs-skeleton" style={{ width: '50%' }} /></div>}
      {lists.status === 'error' && (
        <div className="cs-card cs-feed-error" role="alert">
          <p>{lists.message}</p>
          <button type="button" className="cs-btn cs-btn-soft" onClick={() => { setLists({ status: 'loading' }); void reload() }}>Thử lại</button>
        </div>
      )}

      {lists.status === 'ready' && (
        <>
          <section className="cs-card cs-friends-card" aria-labelledby="cs-req-title">
            <h2 id="cs-req-title" className="cs-friends-title">
              Lời mời kết bạn{lists.incoming.length > 0 && <span className="cs-count">{lists.incoming.length}</span>}
            </h2>
            {lists.incoming.length === 0
              ? <p className="cs-friends-empty">Chưa có lời mời mới.</p>
              : (
                <ul className="cs-people">
                  {lists.incoming.map(p => (
                    <li key={p.userId} className="cs-person">
                      <PersonLink userId={p.userId} onOpen={onOpenProfile} label={`Trang cá nhân của ${p.name}`} className="cs-person-main">
                        <Avatar name={p.name} url={p.avatarUrl} size={48} />
                        <span className="cs-person-name">{p.name}</span>
                      </PersonLink>
                      <div className="cs-person-actions">
                        <button type="button" className="cs-btn cs-btn-primary cs-btn-sm" disabled={busyId !== null}
                          onClick={() => void respond(p.userId, true)}>Chấp nhận</button>
                        <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm" disabled={busyId !== null}
                          onClick={() => void respond(p.userId, false)}>Từ chối</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
          </section>

          <section className="cs-card cs-friends-card" aria-labelledby="cs-fr-title">
            <h2 id="cs-fr-title" className="cs-friends-title">
              Bạn bè{lists.friends.length > 0 && <span className="cs-count">{lists.friends.length}</span>}
            </h2>
            {lists.friends.length === 0
              ? (
                <EmptyState icon={Users} title="Bạn chưa có bạn bè.">
                  Bấm vào tên một thành viên trong Cộng đồng để xem trang cá nhân và gửi lời mời kết bạn.
                </EmptyState>
              )
              : (
                <ul className="cs-people">
                  {lists.friends.map(p => (
                    <li key={p.userId} className="cs-person">
                      <PersonLink userId={p.userId} onOpen={onOpenProfile} label={`Trang cá nhân của ${p.name}`} className="cs-person-main">
                        <Avatar name={p.name} url={p.avatarUrl} size={48} />
                        <span className="cs-person-name">{p.name}{p.isTeacher && <span className="cs-post-role"> · Giáo viên</span>}</span>
                      </PersonLink>
                      <div className="cs-person-actions">
                        <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm" onClick={() => onOpenProfile(p.userId)}>
                          Xem trang cá nhân
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
          </section>
        </>
      )}
    </div>
  )
}
