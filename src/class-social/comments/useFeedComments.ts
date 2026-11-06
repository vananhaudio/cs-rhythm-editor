// Bình luận cho các bài đang hiện trên feed. Tải THEO LÔ (một request cho cả trang bài),
// mỗi bài 3 bình luận mới nhất. "Xem bình luận cũ hơn" (Lát D) tải TỪNG TRANG theo bình luận gốc bằng con trỏ (class_comments_page_safe),
// gộp theo id — không trùng, không mất, không giới hạn 200. Nếu máy chủ chưa có hàm phân trang → lùi về cách cũ (tối đa 200).
import { useCallback, useEffect, useRef, useState } from 'react'
import { COMMENTS_ALL, COMMENTS_PREVIEW, type Comment } from './commentModel'
import { loadCommentsApi } from './lazyApi'
import { PAGE_ROOTS, dropWithDescendants, mergeById, minRootSeq, replaceHead } from './paging'

export type PostComments = {
  items: Comment[]; total: number; expanded: boolean; loading: boolean; error: string | null
  /** Chế độ phân trang (đã gọi trang đầu): hasMore = còn gốc cũ hơn trên máy chủ; cursor = root_seq nhỏ nhất đã có. */
  paged?: boolean; hasMore?: boolean; cursor?: number | null
  loadingMore?: boolean; moreError?: string | null; loadedOlder?: boolean
}
export type CommentsMap = Record<string, PostComments>

const empty = (): PostComments => ({ items: [], total: 0, expanded: false, loading: false, error: null })

export function useFeedComments(postIds: string[]) {
  const [map, setMap] = useState<CommentsMap>({})
  const [nonce, setNonce] = useState(0)   // refreshAll() → tải lại bình luận của mọi bài đang hiện
  const requested = useRef(new Set<string>())
  const expandedIds = useRef(new Set<string>())   // bài đã bấm "Xem thêm" ở chế độ cũ
  const mapRef = useRef(map); mapRef.current = map
  const moreBusy = useRef(new Set<string>())      // chống tải trùng khi bấm liên tục
  const headSeq = useRef(new Map<string, number>())   // bỏ phản hồi cũ khi có nhiều lần tải lại chồng nhau
  const unsupported = useRef(false)               // máy chủ chưa có hàm phân trang
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

  /** Tải lại một bài (sau khi gửi/xoá/ẩn). Chế độ phân trang: chỉ tải lại TRANG MỚI NHẤT, giữ các trang cũ đã mở. */
  const refresh = useCallback(async (postId: string, expand?: boolean) => {
    const cur = mapRef.current[postId]
    if (cur?.paged && !expand) {
      const ticket = (headSeq.current.get(postId) ?? 0) + 1; headSeq.current.set(postId, ticket)
      setMap(m => ({ ...m, [postId]: { ...(m[postId] ?? empty()), loading: true, error: null } }))
      const r = await (await loadCommentsApi()).fetchCommentsPage(postId, null, PAGE_ROOTS)
      if (headSeq.current.get(postId) !== ticket) return r.ok
      setMap(m => {
        const p = m[postId] ?? empty()
        if (!r.ok) return { ...m, [postId]: { ...p, loading: false, error: r.message } }
        const items = replaceHead(p.items, r.value.items, r.value.hasMore)
        return { ...m, [postId]: { ...p, items, total: r.value.total, loading: false, error: null, hasMore: r.value.hasMore ? (p.hasMore ?? true) : false, cursor: minRootSeq(items) } }
      })
      return r.ok
    }
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

  /** "Xem bình luận cũ hơn": tải thêm MỘT trang. Trả số bình luận mới thêm vào (0 nếu lỗi/đang tải). Lỗi KHÔNG làm mất dữ liệu đã hiện. */
  const loadOlder = useCallback(async (postId: string): Promise<number> => {
    if (moreBusy.current.has(postId)) return 0
    const cur = mapRef.current[postId] ?? empty()
    if (unsupported.current) { const before = cur.items.length; await refresh(postId, true); return Math.max(0, (mapRef.current[postId]?.items.length ?? before) - before) }
    moreBusy.current.add(postId)
    setMap(m => ({ ...m, [postId]: { ...(m[postId] ?? empty()), loadingMore: true, moreError: null } }))
    try {
      const api = await loadCommentsApi()
      const r = await api.fetchCommentsPage(postId, cur.paged ? cur.cursor ?? null : null, PAGE_ROOTS)
      if (!r.ok) {
        if (r.unsupported) { unsupported.current = true; moreBusy.current.delete(postId); setMap(m => ({ ...m, [postId]: { ...(m[postId] ?? empty()), loadingMore: false } })); return await loadOlder(postId) }
        setMap(m => ({ ...m, [postId]: { ...(m[postId] ?? empty()), loadingMore: false, moreError: r.message } }))
        return 0
      }
      const prevItems = mapRef.current[postId]?.items ?? cur.items
      const added = Math.max(0, mergeById(prevItems, r.value.items).length - prevItems.length)   // chỉ để biết cần mở thêm bao nhiêu dòng
      setMap(m => {
        const p = m[postId] ?? empty()
        const items = mergeById(p.items, r.value.items)
        return { ...m, [postId]: { ...p, items, total: r.value.total || p.total, paged: true, loadedOlder: true, loadingMore: false, moreError: null,
          hasMore: r.value.hasMore, cursor: minRootSeq(items) ?? p.cursor ?? null } }
      })
      return added
    } catch {
      setMap(m => ({ ...m, [postId]: { ...(m[postId] ?? empty()), loadingMore: false, moreError: 'Chưa tải được bình luận cũ hơn.' } }))
      return 0
    } finally { moreBusy.current.delete(postId) }
  }, [refresh])

  /** Cũ: mở tối đa 200 (dùng khi chưa có phân trang). */
  const expand = useCallback((postId: string) => refresh(postId, true), [refresh])

  /** Sửa cục bộ danh sách của một bài (xoá/sửa ở vùng cũ mà trang mới nhất không tải lại). */
  const mutate = useCallback((postId: string, fn: (items: Comment[]) => Comment[]) => {
    setMap(m => { const p = m[postId]; if (!p) return m; const items = fn(p.items); return { ...m, [postId]: { ...p, items, total: Math.max(0, p.total - (p.items.length - items.length)) } } })
  }, [])
  const drop = useCallback((postId: string, id: string) => mutate(postId, items => dropWithDescendants(items, id)), [mutate])

  const refreshAll = useCallback(() => {
    requested.current.clear()
    setNonce(n => n + 1)
  }, [])

  return { comments: map, refresh, expand, loadOlder, mutate, drop, refreshAll }
}
