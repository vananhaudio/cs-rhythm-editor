// /me/friends — trung tâm bạn bè (Friends UX V2, mô hình Facebook), dữ liệu THẬT từ RPC:
//   Lời mời kết bạn (incoming_friend_requests — CHUNG nguồn với badge + Home) · Lời mời đã gửi (outgoing_friend_requests)
//   · Tất cả bạn bè (my_friends). Mỗi hành động: server xác nhận → danh sách đổi ngay → nạp lại đối chiếu DB.
// Hai mục lời mời chỉ hiện khi có (hoặc khi tải lỗi) — không dựng khung để nói "không có gì".
import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { runFriendAction } from '../friends/friendsApi'
import { unfriendConfirm, type PersonCard } from '../friends/friendModel'
import type { FriendRequests } from '../friends/useFriendRequests'
import { useFriendLists, withPerson, without, type PeopleList } from '../friends/useFriendLists'
import { relativeTime } from '../posts/postModel'
import { Avatar, ConfirmDialog, EmptyState, MoreMenu, PersonLink } from '../ui'
import FriendRequestList from './FriendRequestList'
import { IdentityBadges } from '../identity/IdentityBadges'

export default function Friends({ requests, onOpenProfile }: {
  requests: FriendRequests
  onOpenProfile: (userId: string) => void
}) {
  const lists = useFriendLists()
  const { friends, outgoing, reloadFriends, reloadOutgoing, patchFriends, patchOutgoing } = lists
  const { refresh: refreshRequests } = requests
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<PersonCard | null>(null)

  useEffect(() => { void refreshRequests() }, [refreshRequests])   // mở trang Bạn bè = xem lời mời mới nhất

  const anyBusy = busyId !== null || requests.busyId !== null
  const begin = (id: string) => { setBusyId(id); setNotice(null); setError(null) }

  const respond = async (userId: string, accept: boolean) => {
    if (anyBusy) return
    const person = requests.items.find(x => x.userId === userId)
    setNotice(null); setError(null)
    if (!(await requests.respond(userId, accept))) return   // lỗi hiện qua requests.actionError
    if (accept) {
      if (person) patchFriends(withPerson({ ...person, at: null }))
      setNotice(person ? `Bạn và ${person.name} đã là bạn bè.` : 'Đã xác nhận lời mời.')
      void reloadFriends()
    } else setNotice('Đã xoá lời mời.')
  }

  const cancel = async (p: PersonCard) => {
    if (anyBusy) return
    begin(p.userId)
    const r = await runFriendAction('cancel', p.userId)
    if (r.ok) { patchOutgoing(without(p.userId)); setNotice(`Đã huỷ lời mời gửi ${p.name}.`) } else setError(r.message)
    await reloadOutgoing()
    setBusyId(null)
  }

  const unfriend = async (p: PersonCard) => {
    begin(p.userId)
    const r = await runFriendAction('unfriend', p.userId)
    if (r.ok) { patchFriends(without(p.userId)); setNotice(`Đã huỷ kết bạn với ${p.name}.`) } else setError(r.message)
    setConfirming(null)
    await reloadFriends()
    setBusyId(null)
  }

  const confirm = confirming ? unfriendConfirm(confirming.name) : null
  const outgoingItems = outgoing.status === 'ready' ? outgoing.items : []

  return (
    <div className="cs-col cs-home cs-friends-page">
      <h1 className="cs-page-title">Bạn bè</h1>
      {notice && <p className="cs-rel-notice" role="status">{notice}</p>}
      {(error || requests.actionError) && <p className="cs-form-error" role="alert">{error ?? requests.actionError}</p>}

      {(requests.count > 0 || (requests.loaded && requests.error)) && (
        <section className="cs-card cs-friends-card" aria-labelledby="cs-req-title">
          <h2 id="cs-req-title" className="cs-friends-title">
            Lời mời kết bạn{requests.count > 0 && <span className="cs-count">{requests.count}</span>}
          </h2>
          {requests.error && requests.count === 0 && (
            <p className="cs-friends-empty" role="alert">{requests.error}{' '}
              <button type="button" className="cs-link-btn" onClick={() => void refreshRequests()}>Thử lại</button></p>
          )}
          {requests.count > 0 && (
            <FriendRequestList items={requests.items} busyId={anyBusy ? (requests.busyId ?? busyId) : null}
              onRespond={(id, accept) => void respond(id, accept)} onOpenProfile={onOpenProfile} />
          )}
        </section>
      )}

      {(outgoingItems.length > 0 || outgoing.status === 'error') && (
        <section className="cs-card cs-friends-card" aria-labelledby="cs-out-title">
          <h2 id="cs-out-title" className="cs-friends-title">
            Lời mời đã gửi{outgoingItems.length > 0 && <span className="cs-friends-total">{outgoingItems.length}</span>}
          </h2>
          <ListError list={outgoing} onRetry={lists.retryOutgoing} />
          {outgoingItems.length > 0 && (
            <ul className="cs-people">
              {outgoingItems.map(p => (
                <li key={p.userId} className="cs-person">
                  <PersonLink userId={p.userId} onOpen={onOpenProfile} label={`Trang cá nhân của ${p.name}`} className="cs-person-main">
                    <Avatar name={p.name} url={p.avatarUrl} size={48} />
                    <span className="cs-person-text">
                      <span className="cs-person-name">{p.name}</span>
                      <span className="cs-person-sub">Đã gửi lời mời{p.at ? ` · ${relativeTime(p.at)}` : ''}</span>
                    </span>
                  </PersonLink>
                  <div className="cs-person-actions">
                    <button type="button" className="cs-btn cs-btn-soft cs-btn-sm" disabled={anyBusy}
                      aria-label={`Huỷ lời mời gửi ${p.name}`} onClick={() => void cancel(p)}>
                      {busyId === p.userId ? 'Đang huỷ…' : 'Huỷ lời mời'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="cs-card cs-friends-card" aria-labelledby="cs-fr-title">
        <h2 id="cs-fr-title" className="cs-friends-title">
          Tất cả bạn bè{friends.status === 'ready' && friends.items.length > 0 && <span className="cs-friends-total">{friends.items.length}</span>}
        </h2>
        {friends.status === 'loading' && <div className="cs-skeleton" style={{ width: '50%' }} aria-label="Đang tải" />}
        <ListError list={friends} onRetry={lists.retryFriends} />
        {friends.status === 'ready' && friends.items.length === 0 && (
          <EmptyState icon={Users} title="Chưa có bạn bè" quiet>
            {outgoingItems.length > 0
              ? 'Khi người nhận chấp nhận lời mời, bạn sẽ thấy họ ở đây.'
              : 'Bấm vào tên một bạn trong Trang chủ hoặc trong lớp để kết bạn.'}
          </EmptyState>
        )}
        {friends.status === 'ready' && friends.items.length > 0 && (
          <ul className="cs-people">
            {friends.items.map(p => (
              <li key={p.userId} className="cs-person cs-person-friend">
                <PersonLink userId={p.userId} onOpen={onOpenProfile} label={`Trang cá nhân của ${p.name}`} className="cs-person-main">
                  <Avatar name={p.name} url={p.avatarUrl} size={48} />
                  <span className="cs-person-text">
                    <span className="cs-person-name">{p.name}{p.isTeacher ? <span className="cs-post-role"> · Giáo viên</span> : <IdentityBadges userId={p.userId} />}</span>
                  </span>
                </PersonLink>
                <MoreMenu className="cs-person-more" label={`Tuỳ chọn với ${p.name}`}
                  items={[{ label: 'Huỷ kết bạn', danger: true, onSelect: () => { if (!anyBusy) setConfirming(p) } }]} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {confirming && confirm && (
        <ConfirmDialog title={confirm.title} confirmLabel={confirm.confirm} cancelLabel={confirm.cancel} danger
          busy={busyId === confirming.userId} onConfirm={() => void unfriend(confirming)} onCancel={() => setConfirming(null)}>
          {confirm.body}
        </ConfirmDialog>
      )}
    </div>
  )
}

function ListError({ list, onRetry }: { list: PeopleList; onRetry: () => void }) {
  if (list.status !== 'error') return null
  return (
    <div className="cs-feed-error" role="alert">
      <p>{list.message}</p>
      <button type="button" className="cs-btn cs-btn-soft" onClick={onRetry}>Thử lại</button>
    </div>
  )
}
