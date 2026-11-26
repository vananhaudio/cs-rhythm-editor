// /me/stories — toàn bộ 1001 Câu Chuyện ngay trong khung /me (mới nhất trước, "Xem thêm"), nút Kể chuyện.
import { useCallback, useEffect, useRef, useState } from 'react'
import { BookText, PenLine } from 'lucide-react'
import { EmptyState } from '../ui'
import StoryCard from './StoryCard'
import { fetchStoriesPage, type StoryCursor } from './storiesApi'
import type { StoryCardData } from './storyModel'

export default function MeStories() {
  const [items, setItems] = useState<StoryCardData[]>([])
  const [next, setNext] = useState<StoryCursor | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [more, setMore] = useState<'idle' | 'loading' | 'error'>('idle')
  const alive = useRef(true)

  const first = useCallback(async () => {
    setStatus('loading')
    try {
      const page = await fetchStoriesPage(null)
      if (!alive.current) return
      setItems(page.items); setNext(page.next); setStatus('ready')
    } catch { if (alive.current) setStatus('error') }
  }, [])
  useEffect(() => { alive.current = true; void first(); return () => { alive.current = false } }, [first])

  const loadMore = async () => {
    if (!next || more === 'loading') return
    setMore('loading')
    try {
      const page = await fetchStoriesPage(next)
      if (!alive.current) return
      setItems(cur => [...cur, ...page.items.filter(p => !cur.some(c => c.storyId === p.storyId))]); setNext(page.next); setMore('idle')
    } catch { if (alive.current) setMore('error') }
  }

  return (
    <div className="cs-col cs-stories-page">
      <header className="cs-stories-head">
        <div>
          <h1 className="cs-page-title">1001 Câu Chuyện</h1>
          <p className="cs-stories-sub">Những câu chuyện thật của cộng đồng Guitar.</p>
        </div>
        <a className="cs-btn cs-btn-primary" href="/story/write"><PenLine size={16} aria-hidden="true" />Kể chuyện</a>
      </header>

      {status === 'loading' && <p className="cs-loading" role="status">Đang tải…</p>}
      {status === 'error' && (
        <div className="cs-card cs-feed-error" role="alert">
          <p>Chưa tải được danh sách câu chuyện.</p>
          <button type="button" className="cs-btn cs-btn-soft" onClick={() => void first()}>Thử lại</button>
        </div>
      )}
      {status === 'ready' && items.length === 0 && (
        <EmptyState icon={BookText} title="Chưa có câu chuyện nào" quiet>Câu chuyện được đăng sẽ hiện ở đây.</EmptyState>
      )}
      {status === 'ready' && items.length > 0 && (
        <div className="cs-post-list">
          {items.map(c => <StoryCard key={c.storyId} card={c} variant="list" returnTo="/me/stories" />)}
          {more === 'error' && <p className="cs-feed-more-error" role="alert">Chưa tải thêm được. Hãy thử lại.</p>}
          {next && (
            <button type="button" className="cs-btn cs-btn-ghost cs-feed-more" onClick={() => void loadMore()} disabled={more === 'loading'}>
              {more === 'loading' ? 'Đang tải…' : 'Xem thêm'}
            </button>
          )}
          <a className="cs-stories-mag" href="/story?return=%2Fme%2Fstories">Mở trang tạp chí 1001 Câu Chuyện</a>
        </div>
      )}
    </div>
  )
}
