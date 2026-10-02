// /me — TRANG CHỦ = CON NGƯỜI + HOẠT ĐỘNG. Mở ra là thấy ô chia sẻ âm nhạc rồi tới Feed ngay:
// [chia sẻ] → (lời mời kết bạn / hàng đợi Thầy — chỉ khi có) → Feed (bài + câu chuyện học tập).
// Ảnh bìa + hồ sơ đầy đủ + Hành trình thuộc về TRANG CÁ NHÂN (/me/u/<id>), không lặp lại ở đây.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ClassIdentity } from '../useClassSession'
import { useCommunityFeed } from '../posts/useCommunityFeed'
import { isPostEntry, type FeedPost } from '../posts/postModel'
import '../../learning-thread/styles'
import { useFeedComments } from '../comments/useFeedComments'
import { loadCommentsApi } from '../comments/lazyApi'
import HomeComposer from './HomeComposer'
import CommunityFeed from './CommunityFeed'
import type { PostSocial } from './PostCard'
import type { ImageKind } from '../profile/imageFile'
import type { FriendRequests } from '../friends/useFriendRequests'
import FriendRequestList from './FriendRequestList'
import MeThreadsBlock from '../../learning-thread/MeThreadsBlock'
import FeedTabs from './FeedTabs'
import { FEED_EMPTY, scopeFromSearch, searchForScope, type FeedScope } from '../posts/feedScope'
import MyClassesBoard from '../classes/MyClassesBoard'
import type { SocialClasses } from '../classes/useSocialClasses'

/** Góc nhìn Feed đọc từ ?feed= (chia sẻ link / Quay lại về đúng góc nhìn); đổi góc nhìn = thay URL tại chỗ. */
function useFeedScope(): [FeedScope, (s: FeedScope) => void] {
  const [scope, setScope] = useState<FeedScope>(() => scopeFromSearch(window.location.search))
  const pick = useCallback((s: FeedScope) => {
    setScope(s)
    try { window.history.replaceState(window.history.state, '', window.location.pathname + searchForScope(window.location.search, s)) } catch { /* bỏ qua */ }
  }, [])
  return [scope, pick]
}

/** Home chỉ hiện vài lời mời mới nhất; đủ danh sách ở trang Bạn bè. */
const HOME_REQUESTS_MAX = 3

export default function MeHome({ me, identityRev = 0, onOpenProfile, requests, onSeeAllRequests, onOpenThread, onOpenQueue, classes, onOpenClass, onOpenSession, onOpenDiscover }: {
  me: ClassIdentity
  identityRev?: number
  /** (không dùng trên Home nữa — đổi ảnh ở Trang cá nhân / menu tài khoản) */
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
  /** Tab "Lớp của tôi" = bảng các lớp ĐANG THAM GIA (không phải dòng feed lọc) + lối "Khám phá các lớp khác" */
  classes?: SocialClasses
  onOpenClass?: (classId: string) => void
  onOpenSession?: (classId: string, sessionNo: number) => void
  onOpenDiscover?: () => void
}) {
  const [scope, setScope] = useFeedScope()
  const { state, reload, loadMore } = useCommunityFeed(scope)
  const feedRef = useRef<HTMLDivElement>(null)
  const [modError, setModError] = useState<string | null>(null)

  // Bình luận: MỘT request cho mọi bài đang hiện (không N+1)
  const postIds = useMemo(() => state.status === 'ready' ? state.posts.filter(isPostEntry).map(p => p.id) : [], [state])
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
    onOpenThread,
  }

  return (
    <div className="cs-col cs-home cs-home-feedfirst">
      <HomeComposer me={me} onPosted={onPosted} onOpenProfile={onOpenProfile} />
      {me.isTeacher && onOpenThread && onOpenQueue && <MeThreadsBlock isTeacher onOpenThread={onOpenThread} onOpenQueue={onOpenQueue} />}
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
      <div ref={feedRef} className="cs-feed-anchor">
        {modError && <p className="cs-form-error" role="alert">{modError}</p>}
        <FeedTabs scope={scope} onChange={setScope} />
        {scope === 'my_classes' && classes && onOpenClass && onOpenSession && onOpenThread && onOpenDiscover
          ? <MyClassesBoard classes={classes} isTeacher={me.isTeacher} onOpenClass={onOpenClass} onOpenSession={onOpenSession}
              onOpenThread={onOpenThread} onOpenDiscover={onOpenDiscover} />
          : <CommunityFeed state={state} onRetry={() => void reload()} onLoadMore={() => void loadMore()} social={social}
          empty={FEED_EMPTY[scope]}
          emptyAction={scope === 'friends' && onSeeAllRequests
              ? <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm cs-empty-action" onClick={onSeeAllRequests}>Đến trang Bạn bè</button>
              : undefined} />}
      </div>
    </div>
  )
}
