// Giữ vị trí cuộn của một danh sách trong /me (Feed, 1001 Câu Chuyện). Con trực tiếp thứ i của listRef ↔ keys[i].
import { useEffect, useRef, type RefObject } from 'react'
import { anchorIndex, consumeResume, readPosition, savePosition, type FeedPosition } from './feedReturn'
import { refreshLikes } from './likes/likeStore'
import { refreshCommentCounts } from './comments/commentCountStore'

const MAX_PAGES = 10
const SETTLE_MS = 4000   // ảnh / bình luận tải thêm làm đổi chiều cao → giữ mục neo đứng yên tới khi người dùng chạm màn hình

export function useFeedReturn({ id, owner, listRef, keys, count, ready, hasMore, loadingMore, loadMore }: {
  id: string; owner: string; listRef: RefObject<HTMLElement | null>; keys: string[]; count: number
  ready: boolean; hasMore: boolean; loadingMore: boolean; loadMore: () => void
}) {
  const pending = useRef<FeedPosition | null | undefined>(undefined)   // undefined = chưa hỏi
  const pages = useRef(0)
  const stopSettle = useRef<(() => void) | null>(null)
  const latest = useRef({ id, owner, keys, count }); latest.current = { id, owner, keys, count }

  // Ghi vị trí đúng lúc sắp rời: mọi cú bấm (trước khi điều hướng đổi màn/cuộn lên đầu) và khi rời trang.
  useEffect(() => {
    const save = () => {
      const list = listRef.current
      if (!list || !list.children.length || pending.current) return
      const rects = Array.from(list.children, c => c.getBoundingClientRect())
      const i = anchorIndex(rects.map(r => r.bottom))
      const cur = latest.current
      savePosition(cur.id, { owner: cur.owner, key: cur.keys[i] ?? null, offset: i >= 0 ? rects[i].top : 0, y: window.scrollY, count: cur.count, at: Date.now() })
    }
    // Trình duyệt giữ nguyên trang (bfcache) → vị trí còn nguyên, chỉ cần làm mới số Thích/Bình luận.
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) { consumeResume(); refreshLikes(); refreshCommentCounts() } }
    document.addEventListener('click', save, true)
    window.addEventListener('pagehide', save)
    window.addEventListener('pageshow', onShow)
    return () => {
      document.removeEventListener('click', save, true)
      window.removeEventListener('pagehide', save)
      window.removeEventListener('pageshow', onShow)
      stopSettle.current?.()
    }
  }, [listRef])

  useEffect(() => {
    if (pending.current === undefined) {
      const back = consumeResume()
      pending.current = back ? readPosition(id, owner) : null
      if (back) { refreshLikes(); refreshCommentCounts() }
    }
    const want = pending.current
    if (!want || !ready) return
    const index = want.key ? keys.indexOf(want.key) : -1
    // Mục neo nằm ở trang sau → nạp thêm cho tới khi gặp (hoặc đủ số mục như lúc rời đi).
    if (index < 0 && hasMore && count < want.count && pages.current < MAX_PAGES) {
      if (!loadingMore) { pages.current++; loadMore() }
      return
    }
    pending.current = null
    const align = () => {
      const el = index >= 0 ? listRef.current?.children[index] : undefined
      window.scrollTo(0, Math.max(0, el ? window.scrollY + el.getBoundingClientRect().top - want.offset : want.y))
    }
    const events = ['touchstart', 'wheel', 'keydown', 'pointerdown'] as const
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(align)
    const stop = () => { observer?.disconnect(); clearTimeout(timer); events.forEach(e => window.removeEventListener(e, stop)); stopSettle.current = null }
    const timer = setTimeout(stop, SETTLE_MS)
    events.forEach(e => window.addEventListener(e, stop, { passive: true }))
    stopSettle.current = stop
    align()
    if (listRef.current) observer?.observe(listRef.current)
  }, [id, owner, keys, count, ready, hasMore, loadingMore, loadMore, listRef])
}
