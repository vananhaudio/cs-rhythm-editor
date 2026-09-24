// Dòng hoạt động của Cộng Đồng Hành Trình Guitar — phần chính của /me.
// Dữ liệu THẬT từ class_feed() (bài của mọi thành viên, mới nhất trước). Không bài giả,
// không dùng tiến độ học cá nhân. Chưa có bài → trạng thái trống nhẹ.
import { Users } from 'lucide-react'
import type { FeedState } from '../posts/useCommunityFeed'
import { EmptyState } from '../ui'
import PostCard, { type PostSocial } from './PostCard'

export default function CommunityFeed({ state, onRetry, onLoadMore, social }: {
  state: FeedState
  onRetry: () => void
  onLoadMore: () => void
  social?: PostSocial
}) {
  return (
    <section className="cs-feed" aria-labelledby="cs-feed-title" aria-busy={state.status === 'loading'}>
      <h2 id="cs-feed-title" className="cs-feed-title">Cộng Đồng Hành Trình Guitar</h2>

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
        <div className="cs-card">
          <EmptyState icon={Users} title="Chưa có bài học tập nào">
            Khi thành viên trả bài, hoạt động sẽ xuất hiện tại đây.
          </EmptyState>
        </div>
      )}

      {state.status === 'ready' && state.posts.length > 0 && (
        <div className="cs-post-list">
          {state.posts.map(p => <PostCard key={p.id} post={p} social={social} />)}
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
