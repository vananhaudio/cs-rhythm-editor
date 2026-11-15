// Tìm người + gợi ý kết bạn cho trang Bạn bè (Friends V3). Dữ liệu do RPC friend_search / friend_suggestions;
// hành động dùng RPC quan hệ có sẵn (runFriendAction). Không lưu gì ở máy ngoài việc ẩn tạm một gợi ý trong phiên.
import { useCallback, useEffect, useState } from 'react'
import type { Result } from '../posts/postsApi'
import { fetchSuggestions, runFriendAction, searchPeople } from './friendsApi'
import { searchTerm, type FriendAction, type Relationship, type SearchPerson, type Suggestion } from './friendModel'

export type SearchState =
  | { status: 'idle' } | { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; items: SearchPerson[] }
export type SuggestState =
  | { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; items: Suggestion[] }

export const SEARCH_DEBOUNCE_MS = 250

export function useFriendDiscovery(onChanged: () => void) {
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<{ term: string; result: Result<SearchPerson[]> } | null>(null)
  const [suggestions, setSuggestions] = useState<SuggestState>({ status: 'loading' })
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set())
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const term = searchTerm(query)

  // Kết quả gắn với từ khoá đã tìm; từ khoá đổi → hiện "đang tìm" ngay, câu tìm cũ về muộn bị bỏ (so term)
  useEffect(() => {
    if (!term) return
    let alive = true
    const t = setTimeout(() => {
      void searchPeople(term).then(result => { if (alive) setFound({ term, result }) })
    }, SEARCH_DEBOUNCE_MS)
    return () => { alive = false; clearTimeout(t) }
  }, [term, tick])
  const search: SearchState = !term ? { status: 'idle' }
    : !found || found.term !== term ? { status: 'loading' }
    : found.result.ok ? { status: 'ready', items: found.result.value } : { status: 'error', message: found.result.message }

  const loadSuggestions = useCallback(async () => {
    const r = await fetchSuggestions()
    setSuggestions(prev => (r.ok ? { status: 'ready', items: r.value } : prev.status === 'ready' ? prev : { status: 'error', message: r.message }))
  }, [])
  useEffect(() => {
    let alive = true
    void fetchSuggestions().then(r => {
      if (alive) setSuggestions(prev => (r.ok ? { status: 'ready', items: r.value } : prev.status === 'ready' ? prev : { status: 'error', message: r.message }))
    })
    return () => { alive = false }
  }, [])

  const setRelationship = useCallback((userId: string, rel: Relationship) => {
    setFound(f => (f && f.result.ok
      ? { ...f, result: { ok: true, value: f.result.value.map(x => (x.userId === userId ? { ...x, relationship: rel } : x)) } } : f))
  }, [])

  /** Gửi lời mời / huỷ / xác nhận / xoá … từ kết quả tìm kiếm hoặc gợi ý. Trả true nếu server xác nhận. */
  const act = useCallback(async (userId: string, action: FriendAction): Promise<boolean> => {
    if (busyId) return false
    setBusyId(userId); setActionError(null)
    const r = await runFriendAction(action, userId)
    setBusyId(null)
    if (!r.ok) { setActionError(r.message); return false }
    setRelationship(userId, r.value)
    setSuggestions(s => (s.status === 'ready' ? { status: 'ready', items: s.items.filter(x => x.userId !== userId) } : s))
    onChanged()
    return true
  }, [busyId, onChanged, setRelationship])

  const hide = useCallback((userId: string) => setHidden(h => new Set(h).add(userId)), [])

  return { query, setQuery, term, search, suggestions, hidden, busyId, actionError, act, hide, setRelationship, retrySearch: () => setTick(t => t + 1), reloadSuggestions: loadSuggestions }
}
