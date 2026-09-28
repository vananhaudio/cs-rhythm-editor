// Lời mời kết bạn ĐẾN mình (pending) — MỘT nguồn cho badge "Bạn bè", khối Home và trang Bạn bè.
// Chấp nhận/Từ chối ở đâu cũng cập nhật ngay mọi chỗ. Chỉ đếm lời mời đến (incoming_friend_requests):
// không tính lời mời mình gửi, không tính đã chấp nhận/từ chối.
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchIncomingRequests, respondFriendRequest } from './friendsApi'
import type { PersonCard } from './friendModel'

export type FriendRequests = {
  items: PersonCard[]
  /** Số lời mời chưa xử lý (0 khi chưa tải xong / lỗi) */
  count: number
  loaded: boolean
  error: string | null
  busyId: string | null
  actionError: string | null
  refresh: () => Promise<void>
  respond: (userId: string, accept: boolean) => Promise<boolean>
}

const REFRESH_MS = 60_000   // lời mời mới đến khi đang mở trang: tự thấy sau ≤1 phút, hoặc ngay khi quay lại tab

export function useFriendRequests(): FriendRequests {
  const [items, setItems] = useState<PersonCard[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const req = useRef(0)

  const apply = useCallback((id: number, r: Awaited<ReturnType<typeof fetchIncomingRequests>>) => {
    if (id !== req.current) return   // bỏ kết quả của lần tải cũ
    if (r.ok) { setItems(r.value); setError(null) } else setError(r.message)
    setLoaded(true)
  }, [])

  const refresh = useCallback(async () => {
    const id = ++req.current
    apply(id, await fetchIncomingRequests())
  }, [apply])

  useEffect(() => {
    const load = () => { const id = ++req.current; void fetchIncomingRequests().then(r => apply(id, r)) }
    load()
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    const timer = window.setInterval(onVisible, REFRESH_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.clearInterval(timer)
    }
  }, [apply])

  const respond = useCallback(async (userId: string, accept: boolean) => {
    if (busyId) return false
    setBusyId(userId)
    setActionError(null)
    const r = await respondFriendRequest(userId, accept)
    if (r.ok) setItems(xs => xs.filter(x => x.userId !== userId))   // badge giảm ngay
    else setActionError(r.message)
    await refresh()   // đối chiếu lại với DB
    setBusyId(null)
    return r.ok
  }, [busyId, refresh])

  return { items, count: items.length, loaded, error, busyId, actionError, refresh, respond }
}
