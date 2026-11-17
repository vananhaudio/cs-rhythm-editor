// Trạng thái một dòng bài (feed / tường / hoạt động lớp): trang đầu, "Xem thêm", tải lại. THUẦN về mạng:
// nguồn dữ liệu do người gọi truyền vào (fetchPage) → component dùng được trong test Node (không nạp client Supabase).
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Result } from './postsApi'
import { entryKey, mergePosts, type FeedEntry } from './postModel'
import { dropSwr, peekSwr, putSwr } from '../swr/swrCache'

export type FeedState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; posts: FeedEntry[]; hasMore: boolean; loadingMore: boolean; moreError: string | null }

function firstPageState(r: Result<{ posts: FeedEntry[]; hasMore: boolean }>): FeedState {
  return r.ok
    ? { status: 'ready', posts: r.value.posts, hasMore: r.value.hasMore, loadingMore: false, moreError: null }
    : { status: 'error', message: r.message }
}

/** cursor.key = sort_key của mục cuối ('p:<id>' | 't:<id>') — Feed/Tường trộn dùng; nguồn chỉ-bài bỏ qua. */
export type PageFetcher = (cursor?: { createdAt: string; id: string; key: string }) => Promise<Result<{ posts: FeedEntry[]; hasMore: boolean }>>

/** fetchPage phải ỔN ĐỊNH (useCallback) — đổi fetchPage (vd. sang tường người khác) = tải lại từ đầu. */
export function usePostsFeed(fetchPage: PageFetcher, cacheKey?: string) {
  // cacheKey (tuỳ chọn): trang đầu đã tải một lần → lần sau hiện NGAY, server làm mới ở nền (SWR). Lỗi → bỏ đệm + báo lỗi.
  const seedOf = (): FeedState => {
    const c = cacheKey ? peekSwr<{ posts: FeedEntry[]; hasMore: boolean }>(cacheKey) : undefined
    return c ? { status: 'ready', posts: c.posts, hasMore: c.hasMore, loadingMore: false, moreError: null } : { status: 'loading' }
  }
  const remember = (r: Result<{ posts: FeedEntry[]; hasMore: boolean }>) => {
    if (!cacheKey) return
    if (r.ok) putSwr(cacheKey, { posts: r.value.posts, hasMore: r.value.hasMore })
    else if (typeof navigator === 'undefined' || navigator.onLine !== false) dropSwr(cacheKey)   // offline: giữ đệm đang hiện
  }
  const [state, setState] = useState<FeedState>(seedOf)
  const req = useRef(0)   // bỏ kết quả của lần tải cũ khi đã có lần tải mới

  const reload = useCallback(async (opts?: { quiet?: boolean }) => {
    const id = ++req.current
    if (!opts?.quiet) setState({ status: 'loading' })
    const r = await fetchPage()
    if (id === req.current) { remember(r); setState(firstPageState(r)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPage])

  const loadMore = useCallback(async () => {
    const cur = state
    if (cur.status !== 'ready' || !cur.hasMore || cur.loadingMore || cur.posts.length === 0) return
    const last = cur.posts[cur.posts.length - 1]
    const id = req.current
    setState({ ...cur, loadingMore: true, moreError: null })
    const r = await fetchPage({ createdAt: last.createdAt, id: last.id, key: entryKey(last) })
    if (id !== req.current) return
    setState(s => s.status !== 'ready' ? s : r.ok
      ? { ...s, posts: mergePosts(s.posts, r.value.posts), hasMore: r.value.hasMore, loadingMore: false }
      : { ...s, loadingMore: false, moreError: r.message })
  }, [state, fetchPage])

  // Lần đầu / đổi nguồn: state khởi tạo đã là 'loading' → chỉ setState khi có kết quả
  const [source, setSource] = useState(() => fetchPage)
  if (source !== fetchPage) {   // đổi tường: về trạng thái đang tải ngay trong lượt render
    setSource(() => fetchPage)
    setState(seedOf())
  }
  useEffect(() => {
    const id = ++req.current
    void fetchPage().then(r => { if (id === req.current) { remember(r); setState(s0 => (!r.ok && s0.status === 'ready' && typeof navigator !== 'undefined' && navigator.onLine === false) ? s0 : firstPageState(r)) } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPage])

  return { state, reload, loadMore }
}
