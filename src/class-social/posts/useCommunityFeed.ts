// Trạng thái một dòng bài (feed Cộng đồng / tường cá nhân): trang đầu, "Xem thêm", tải lại sau khi đăng bài.
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchFeedPage, type Result } from './postsApi'
import { mergePosts, type FeedPost } from './postModel'

export type FeedState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; posts: FeedPost[]; hasMore: boolean; loadingMore: boolean; moreError: string | null }

function firstPageState(r: Result<{ posts: FeedPost[]; hasMore: boolean }>): FeedState {
  return r.ok
    ? { status: 'ready', posts: r.value.posts, hasMore: r.value.hasMore, loadingMore: false, moreError: null }
    : { status: 'error', message: r.message }
}

export type PageFetcher = (cursor?: { createdAt: string; id: string }) => Promise<Result<{ posts: FeedPost[]; hasMore: boolean }>>

export function useCommunityFeed() {
  return usePostsFeed(fetchFeedPage)
}

/** fetchPage phải ỔN ĐỊNH (useCallback) — đổi fetchPage (vd. sang tường người khác) = tải lại từ đầu. */
export function usePostsFeed(fetchPage: PageFetcher) {
  const [state, setState] = useState<FeedState>({ status: 'loading' })
  const req = useRef(0)   // bỏ kết quả của lần tải cũ khi đã có lần tải mới

  const reload = useCallback(async (opts?: { quiet?: boolean }) => {
    const id = ++req.current
    if (!opts?.quiet) setState({ status: 'loading' })
    const r = await fetchPage()
    if (id === req.current) setState(firstPageState(r))
  }, [fetchPage])

  const loadMore = useCallback(async () => {
    const cur = state
    if (cur.status !== 'ready' || !cur.hasMore || cur.loadingMore || cur.posts.length === 0) return
    const last = cur.posts[cur.posts.length - 1]
    const id = req.current
    setState({ ...cur, loadingMore: true, moreError: null })
    const r = await fetchPage({ createdAt: last.createdAt, id: last.id })
    if (id !== req.current) return
    setState(s => s.status !== 'ready' ? s : r.ok
      ? { ...s, posts: mergePosts(s.posts, r.value.posts), hasMore: r.value.hasMore, loadingMore: false }
      : { ...s, loadingMore: false, moreError: r.message })
  }, [state, fetchPage])

  // Lần đầu / đổi nguồn: state khởi tạo đã là 'loading' → chỉ setState khi có kết quả
  const [source, setSource] = useState(() => fetchPage)
  if (source !== fetchPage) {   // đổi tường: về trạng thái đang tải ngay trong lượt render
    setSource(() => fetchPage)
    setState({ status: 'loading' })
  }
  useEffect(() => {
    const id = ++req.current
    void fetchPage().then(r => { if (id === req.current) setState(firstPageState(r)) })
  }, [fetchPage])

  return { state, reload, loadMore }
}
