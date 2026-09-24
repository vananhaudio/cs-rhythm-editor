// Bình luận cho các bài đang hiện trên feed. Tải THEO LÔ (một request cho cả trang bài),
// mỗi bài 3 bình luận mới nhất; "Xem thêm bình luận" tải tối đa 200 cho riêng bài đó.
import { useCallback, useEffect, useRef, useState } from 'react'
import { COMMENTS_ALL, COMMENTS_PREVIEW, type Comment } from './commentModel'
import { loadCommentsApi } from './lazyApi'

export type PostComments = { items: Comment[]; total: number; expanded: boolean; loading: boolean; error: string | null }
export type CommentsMap = Record<string, PostComments>

export function useFeedComments(postIds: string[]) {
  const [map, setMap] = useState<CommentsMap>({})
  const [nonce, setNonce] = useState(0)   // refreshAll() → tải lại bình luận của mọi bài đang hiện
  const requested = useRef(new Set<string>())
  const expandedIds = useRef(new Set<string>())   // bài đã bấm "Xem thêm bình luận"
  const key = postIds.join(',')

  // Bài mới xuất hiện (trang đầu / Xem thêm / vừa đăng) → một request cho tất cả bài chưa tải
  useEffect(() => {
    const ids = key ? key.split(',') : []
    const missing = ids.filter(id => !requested.current.has(id))
    if (missing.length === 0) return
    missing.forEach(id => requested.current.add(id))
    void loadCommentsApi().then(api => api.fetchComments(missing, COMMENTS_PREVIEW)).then(r => {
      setMap(m => {
        const next = { ...m }
        for (const id of missing) {
          next[id] = r.ok
            ? { items: r.value.byPost.get(id) ?? [], total: r.value.totals.get(id) ?? 0, expanded: false, loading: false, error: null }
            : { items: [], total: 0, expanded: false, loading: false, error: r.message }
        }
        return next
      })
      if (!r.ok) missing.forEach(id => requested.current.delete(id))   // cho phép thử lại
    })
  }, [key, nonce])

  /** Tải lại một bài (sau khi gửi/xoá/ẩn); giữ chế độ "đã mở hết" nếu đang mở. */
  const refresh = useCallback(async (postId: string, expand?: boolean) => {
    if (expand) expandedIds.current.add(postId)
    const expanded = expandedIds.current.has(postId)
    setMap(m => ({ ...m, [postId]: { items: m[postId]?.items ?? [], total: m[postId]?.total ?? 0, expanded, loading: true, error: null } }))
    const r = await (await loadCommentsApi()).fetchComments([postId], expanded ? COMMENTS_ALL : COMMENTS_PREVIEW)
    setMap(m => ({
      ...m,
      [postId]: r.ok
        ? { items: r.value.byPost.get(postId) ?? [], total: r.value.totals.get(postId) ?? 0, expanded, loading: false, error: null }
        : { items: m[postId]?.items ?? [], total: m[postId]?.total ?? 0, expanded, loading: false, error: r.message },
    }))
    return r.ok
  }, [])

  const expand = useCallback((postId: string) => refresh(postId, true), [refresh])

  const refreshAll = useCallback(() => {
    requested.current.clear()
    setNonce(n => n + 1)
  }, [])

  return { comments: map, refresh, expand, refreshAll }
}
