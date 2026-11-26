// Dòng hoạt động của Cộng Đồng Hành Trình Guitar — phần chính của /me.
// Dữ liệu THẬT từ social_feed(): bài Social (luật class_feed) + câu chuyện học tập (Learning Thread community),
// mới nhất trước. Không bài giả,
// không dùng tiến độ học cá nhân. Chưa có bài → trạng thái trống nhẹ.
import { useRef, type ReactNode } from 'react'
import { Users } from 'lucide-react'
import { FEED_EMPTY } from '../posts/feedScope'
import type { FeedState } from '../posts/useCommunityFeed'
import { EmptyState } from '../ui'
import type { PostSocial } from './PostCard'
import FeedEntryCard, { TargetActions } from './FeedEntryCard'
import { useFeedReturn } from '../useFeedReturn'
import StoryCard from '../stories/StoryCard'
import { placeTodayCard, type StoryCardData } from '../stories/storyModel'
import { entryKey, isStoryEntry } from '../posts/postModel'

/** Tách riêng để chỉ Feed có yêu cầu giữ vị trí mới gắn bộ nghe. */
function KeepPosition({ position, ...rest }: Omit<Parameters<typeof useFeedReturn>[0], 'id' | 'owner' | 'ready'> & { position: { id: string; owner: string; ready: boolean } }) {
  useFeedReturn({ ...rest, ...position })
  return null
}

export default function CommunityFeed({ state, onRetry, onLoadMore, social, empty, emptyAction, todayStory, position }: {
  state: FeedState
  onRetry: () => void
  onLoadMore: () => void
  social?: PostSocial
  /** Trạng thái trống theo góc nhìn (mặc định: Dành cho bạn) */
  empty?: { title: string; hint: string }
  /** Lối đi tiếp khi trống (vd. "Xem các lớp của tôi") */
  emptyAction?: ReactNode
  /** "Câu chuyện hôm nay" — chỉ tab Dành cho bạn */
  todayStory?: StoryCardData | null
  /** Giữ vị trí cuộn khi quay lại. id = góc nhìn; ready=false khi còn chờ thẻ hôm nay. */
  position?: { id: string; owner: string; ready: boolean }
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const slots = state.status === 'ready' ? placeTodayCard(state.posts, todayStory ?? null, p => isStoryEntry(p) ? p.id : null) : []
  return (
    <section className="cs-feed" aria-labelledby="cs-feed-title" aria-busy={state.status === 'loading'}>
      {/* Home đã là ngữ cảnh cộng đồng → tiêu đề chỉ cho trình đọc màn hình, không lặp chữ "Cộng đồng" */}
      <h2 id="cs-feed-title" className="cs-sr-only">Hoạt động mới</h2>
      {position && <KeepPosition position={{ ...position, ready: position.ready && state.status === 'ready' }} listRef={listRef}
        keys={slots.map(x => x.type === 'today' ? 'story-today' : entryKey(x.entry))}
        count={state.status === 'ready' ? state.posts.length : 0} hasMore={state.status === 'ready' && state.hasMore}
        loadingMore={state.status === 'ready' && state.loadingMore} loadMore={onLoadMore} />}

      {state.status === 'loading' && (
        <div className="cs-card cs-post" aria-label="Đang tải">
          <div className="cs-post-head">
            <span className="cs-skeleton cs-skeleton-avatar" />
            <div style={{ flex: 1 }}>
              <div className="cs-skeleton" style={{ width: '40%', marginBottom: 8 }} />
              <div className="cs-skeleton" style={{ width: '22%' }} />
            </div>
          </div>
          <div className="cs-skeleton cs-skeleton-media" />
        </div>
      )}

      {state.status === 'error' && (
        <div className="cs-card cs-feed-error" role="alert">
          <p>{state.message}</p>
          <button type="button" className="cs-btn cs-btn-soft" onClick={onRetry}>Thử lại</button>
        </div>
      )}

      {state.status === 'ready' && state.posts.length === 0 && (
        <EmptyState icon={Users} title={empty?.title ?? FEED_EMPTY.for_you.title} quiet action={emptyAction}>
          {empty?.hint ?? FEED_EMPTY.for_you.hint}
        </EmptyState>
      )}

      {state.status === 'ready' && state.posts.length > 0 && (
        <div className="cs-post-list" ref={listRef}>
          {slots.map(slot => slot.type === 'today'
            ? <StoryCard key="story-today" card={slot.card} variant="today"
                footer={<TargetActions kind="story" id={slot.card.storyId} social={social} />} />
            : <FeedEntryCard key={slot.entry.id} entry={slot.entry} social={social} />)}
          {state.moreError && <p className="cs-feed-more-error" role="alert">{state.moreError}</p>}
          {state.hasMore && (
            <button type="button" className="cs-btn cs-btn-ghost cs-feed-more" onClick={onLoadMore} disabled={state.loadingMore}>
              {state.loadingMore ? 'Đang tải…' : 'Xem thêm'}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
