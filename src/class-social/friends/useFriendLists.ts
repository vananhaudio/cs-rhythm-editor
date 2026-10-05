// Trang Bạn bè: "Tất cả bạn bè" (my_friends) + "Lời mời đã gửi" (outgoing_friend_requests).
// Lời mời ĐẾN không ở đây — dùng chung useFriendRequests với badge + Home.
// Sau mỗi hành động server xác nhận: sửa danh sách NGAY (patch), rồi nạp lại từ DB để đối chiếu.
import { useCallback, useEffect, useState } from 'react'
import { fetchFriends, fetchOutgoingRequests } from './friendsApi'
import { patchList, type PeopleList, type PersonCard } from './friendModel'
export { withPerson, without, type PeopleList } from './friendModel'
import type { Result } from '../posts/postsApi'

/** Kết quả nạp mới; lỗi khi đã có danh sách → giữ danh sách cũ (không xoá trắng màn hình vì một lần mạng chập) */
const next = (prev: PeopleList, r: Result<PersonCard[]>): PeopleList =>
  r.ok ? { status: 'ready', items: r.value } : prev.status === 'ready' ? prev : { status: 'error', message: r.message }

export function useFriendLists() {
  const [friends, setFriends] = useState<PeopleList>({ status: 'loading' })
  const [outgoing, setOutgoing] = useState<PeopleList>({ status: 'loading' })

  const reloadFriends = useCallback(async () => {
    const r = await fetchFriends()
    setFriends(prev => next(prev, r))
  }, [])
  const reloadOutgoing = useCallback(async () => {
    const r = await fetchOutgoingRequests()
    setOutgoing(prev => next(prev, r))
  }, [])

  useEffect(() => {
    let alive = true
    void fetchFriends().then(r => { if (alive) setFriends(prev => next(prev, r)) })
    void fetchOutgoingRequests().then(r => { if (alive) setOutgoing(prev => next(prev, r)) })
    return () => { alive = false }
  }, [])

  return {
    friends, outgoing, reloadFriends, reloadOutgoing,
    patchFriends: (fn: (xs: PersonCard[]) => PersonCard[]) => setFriends(l => patchList(l, fn)),
    patchOutgoing: (fn: (xs: PersonCard[]) => PersonCard[]) => setOutgoing(l => patchList(l, fn)),
    retryFriends: () => { setFriends({ status: 'loading' }); void reloadFriends() },
    retryOutgoing: () => { setOutgoing({ status: 'loading' }); void reloadOutgoing() },
  }
}
