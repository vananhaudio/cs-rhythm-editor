// /me — TÔI + CỘNG ĐỒNG trên một trang cuộn liên tục:
// identity (tôi) → TRẢ BÀI → dòng hoạt động cộng đồng (bài + bình luận + nhận xét của Thầy).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ClassIdentity } from '../useClassSession'
import { useCommunityFeed } from '../posts/useCommunityFeed'
import type { FeedPost } from '../posts/postModel'
import { useFeedComments } from '../comments/useFeedComments'
import { loadCommentsApi } from '../comments/lazyApi'
import IdentityHeader from './IdentityHeader'
import TraBaiCta from './TraBaiCta'
import CommunityFeed from './CommunityFeed'
import type { PostSocial } from './PostCard'
import type { ImageKind } from '../profile/imageFile'
import type { FriendRequests } from '../friends/useFriendRequests'
import FriendRequestList from './FriendRequestList'
import MeThreadsBlock from '../../learning-thread/MeThreadsBlock'

/** Home chỉ hiện vài lời mời mới nhất; đủ danh sách ở trang Bạn bè. */
const HOME_REQUESTS_MAX = 3

export default function MeHome({ me, identityRev = 0, canEditAvatar, onEditMedia, onOpenProfile, requests, onSeeAllRequests, onOpenThread, onOpenQueue }: {
  me: ClassIdentity
  identityRev?: number
  canEditAvatar?: boolean
  onEditMedia?: (kind: ImageKind) => void
  /** Bấm tên/avatar trong Cộng đồng → trang cá nhân */
  onOpenProfile?: (userId: string) => void
  /** Lời mời kết bạn đến mình (nguồn chung với badge menu) — có lời mời thì hiện khối ngay dưới header */
  requests?: FriendRequests
  onSeeAllRequests?: () => void
  /** Learning Thread: mở /me/t/<id> · hàng đợi Thầy /me/queue */
  onOpenThread?: (threadId: string) => void
  onOpenQueue?: () => void
}) {
  const { state, reload, loadMore } = useCommunityFeed()
  const feedRef = useRef<HTMLDivElement>(null)
  const [modError, setModError] = useState<string | null>(null)

  // Bình luận: MỘT request cho mọi bài đang hiện (không N+1)
  const postIds = useMemo(() => state.status === 'ready' ? state.posts.map(p => p.id) : [], [state])
  const { comments, refresh, expand, refreshAll } = useFeedComments(postIds)

  // Đăng xong: tải lại trang đầu (giữ danh sách cũ trong lúc tải) rồi đưa feed vào tầm nhìn
  const onPosted = useCallback(async () => {
    await reload({ quiet: true })
    feedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [reload])

  // Đổi ảnh đại diện → tải lại bài + bình luận để mọi chỗ hiện avatar mới (nguồn: edu_students.avatar_url)
  useEffect(() => {
    if (identityRev === 0) return
    void reload({ quiet: true }).then(refreshAll)
  }, [identityRev, reload, refreshAll])

  const onModeratePost = useCallback(async (post: FeedPost, hidden: boolean) => {
    const r = await (await loadCommentsApi()).moderate('post', post.id, hidden)
    setModError(r.ok ? null : r.message)
    if (r.ok) await reload({ quiet: true })
  }, [reload])

  const social: PostSocial = {
    me,
    comments,
    onRefreshComments: refresh,
    onExpandComments: expand,
    onModeratePost: (p, h) => void onModeratePost(p, h),
    onOpenProfile,
  }

  return (
    <div className="cs-col cs-home">
      <IdentityHeader me={me} canEditAvatar={canEditAvatar} onEdit={onEditMedia}
        onOpenProfile={onOpenProfile ? () => onOpenProfile(me.userId) : undefined} />
      {requests && requests.count > 0 && onOpenProfile && (
        <section className="cs-card cs-friends-card cs-home-requests" aria-labelledby="cs-home-req-title">
          <h2 id="cs-home-req-title" className="cs-friends-title">
            Lời mời kết bạn<span className="cs-count">{requests.count}</span>
          </h2>
          {requests.actionError && <p className="cs-form-error" role="alert">{requests.actionError}</p>}
          <FriendRequestList items={requests.items.slice(0, HOME_REQUESTS_MAX)} busyId={requests.busyId}
            onRespond={(id, accept) => void requests.respond(id, accept)} onOpenProfile={onOpenProfile} />
          {requests.count > HOME_REQUESTS_MAX && onSeeAllRequests && (
            <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm cs-home-requests-all" onClick={onSeeAllRequests}>
              Xem tất cả {requests.count} lời mời
            </button>
          )}
        </section>
      )}
      {onOpenThread && onOpenQueue && <MeThreadsBlock isTeacher={me.isTeacher} onOpenThread={onOpenThread} onOpenQueue={onOpenQueue} />}
      <TraBaiCta me={me} onPosted={onPosted} />
      <div ref={feedRef} className="cs-feed-anchor">
        {modError && <p className="cs-form-error" role="alert">{modError}</p>}
        <CommunityFeed state={state} onRetry={() => void reload()} onLoadMore={() => void loadMore()} social={social} />
      </div>
    </div>
  )
}
