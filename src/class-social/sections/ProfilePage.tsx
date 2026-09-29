// /me/u/<userId> — trang cá nhân + tường.
// Hồ sơ tối thiểu (tên, avatar, ảnh bìa, vai trò) ai trong Class cũng xem được; BÀI ĐĂNG chỉ tải
// khi DB báo can_view_wall (chính mình | bạn bè | Thầy kiểm duyệt). Kể cả khi gọi thẳng API,
// get_user_wall/RLS trả rỗng cho người chưa là bạn — ẩn ở đây chỉ là giao diện.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Lock, ShieldCheck, UserX } from 'lucide-react'
import type { ClassIdentity } from '../useClassSession'
import type { ImageKind } from '../profile/imageFile'
import { safeImageUrl } from '../media/safeImageUrl'
import { usePostsFeed } from '../posts/useCommunityFeed'
import { isPostEntry, type FeedPost } from '../posts/postModel'
import { useFeedComments } from '../comments/useFeedComments'
import { loadCommentsApi } from '../comments/lazyApi'
import {
  fetchProfile, fetchWallMixedPage, respondFriendRequest, sendFriendRequest, unfriend,
} from '../friends/friendsApi'
import { lockedWallText, relationshipUi, type FriendAction, type PublicProfile } from '../friends/friendModel'
import { Avatar, EmptyState } from '../ui'
import { useHistoryTab } from '../useHistoryTab'
import IdentityHeader from './IdentityHeader'
import WallComposer from './WallComposer'
import type { PostSocial } from './PostCard'
import FeedEntryCard from './FeedEntryCard'
import JourneyView from '../../learning-thread/JourneyView'

const PROFILE_TABS = ['wall', 'journey'] as const

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'missing' } | { status: 'ready'; profile: PublicProfile }

export default function ProfilePage({ me, userId, identityRev = 0, canEditAvatar, onEditMedia, onBack, onOpenProfile, onOpenThread }: {
  me: ClassIdentity
  userId: string
  identityRev?: number
  canEditAvatar?: boolean
  onEditMedia?: (kind: ImageKind) => void
  /** Quay lại màn trước trong /me (vd. Feed, lớp, Bạn bè) */
  onBack: () => void
  onOpenProfile: (userId: string) => void
  /** Learning Thread (P2): mở /me/t/<id> từ Tường / Hành trình */
  onOpenThread?: (threadId: string) => void
}) {
  const isSelf = userId === me.userId
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [busy, setBusy] = useState(false)
  // Tab trang cá nhân: Tường (bài + câu chuyện học tập) | Hành trình (timeline Learning Thread theo chặng)
  const [tab, setTab] = useHistoryTab<'wall' | 'journey'>('csProfileTab', 'wall', PROFILE_TABS)
  const [actionError, setActionError] = useState<string | null>(null)

  const [prevUser, setPrevUser] = useState(userId)
  if (prevUser !== userId) {   // sang trang người khác: về trạng thái đang tải ngay
    setPrevUser(userId)
    setLoad({ status: 'loading' })
    setActionError(null)
  }

  const refresh = useCallback(async () => {
    const r = await fetchProfile(userId)
    setLoad(!r.ok ? { status: 'error', message: r.message } : r.value ? { status: 'ready', profile: r.value } : { status: 'missing' })
  }, [userId])

  useEffect(() => {
    let alive = true
    void fetchProfile(userId).then(r => {
      if (!alive) return
      setLoad(!r.ok ? { status: 'error', message: r.message } : r.value ? { status: 'ready', profile: r.value } : { status: 'missing' })
    })
    return () => { alive = false }
  }, [userId])

  const name = load.status === 'ready' ? load.profile.name : null
  useEffect(() => {
    if (name) document.title = `${name} · Thầy Văn Anh Guitar`
  }, [name])

  const act = async (action: FriendAction) => {
    if (busy) return
    setBusy(true)
    setActionError(null)
    const r = action === 'send' ? await sendFriendRequest(userId)
      : action === 'accept' ? await respondFriendRequest(userId, true)
      : action === 'decline' ? await respondFriendRequest(userId, false)
      : await unfriend(userId)
    if (!r.ok) setActionError(r.message)
    await refresh()   // quyền xem tường lấy lại từ DB, không tự suy ở client
    setBusy(false)
  }

  const back = (
    <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm cs-profile-back" onClick={onBack}>
      <ArrowLeft size={16} /> Quay lại
    </button>
  )

  if (load.status === 'loading') {
    return <div className="cs-col cs-home">{back}<div className="cs-card cs-profile-skeleton" aria-label="Đang tải"><div className="cs-cover" /></div></div>
  }
  if (load.status === 'error') {
    return (
      <div className="cs-col cs-home">{back}
        <div className="cs-card cs-feed-error" role="alert">
          <p>{load.message}</p>
          <button type="button" className="cs-btn cs-btn-soft" onClick={() => { setLoad({ status: 'loading' }); void refresh() }}>Thử lại</button>
        </div>
      </div>
    )
  }
  if (load.status === 'missing') {
    return (
      <div className="cs-col cs-home">{back}
        <div className="cs-card"><EmptyState icon={UserX} title="Không tìm thấy thành viên">Trang này không tồn tại hoặc không thuộc Class.</EmptyState></div>
      </div>
    )
  }

  const p = load.profile
  const ui = relationshipUi(p.relationship)
  const moderatorView = !isSelf && p.canViewWall && p.relationship !== 'friends'
  return (
    <div className="cs-col cs-home">
      {back}
      {isSelf
        ? <IdentityHeader me={me} canEditAvatar={canEditAvatar} onEdit={onEditMedia} />
        : <OtherHeader profile={p} status={ui.status} actions={ui.actions} busy={busy} onAct={a => void act(a)} />}
      {actionError && <p className="cs-form-error" role="alert">{actionError}</p>}
      {moderatorView && (
        <p className="cs-profile-note"><ShieldCheck size={15} aria-hidden="true" />Bạn đang xem với quyền Thầy.</p>
      )}
      <div className="lt-profile-tabs" role="group" aria-label="Trang cá nhân">
        <button type="button" aria-pressed={tab === 'wall'} onClick={() => setTab('wall')}>Tường</button>
        <button type="button" aria-pressed={tab === 'journey'} onClick={() => setTab('journey')}>Hành trình</button>
      </div>
      {tab === 'journey' && (
        <JourneyView userId={userId} ownerName={isSelf ? me.name : p.name} onOpenThread={id => onOpenThread?.(id)} />
      )}
      {tab === 'wall' && <>{p.canViewWall
        ? <Wall me={me} userId={userId} isSelf={isSelf} identityRev={identityRev} onOpenProfile={onOpenProfile} onOpenThread={onOpenThread} />
        : (
          <section className="cs-wall-locked" aria-label="Tường chỉ dành cho bạn bè">
            <EmptyState icon={Lock} title="Chỉ bạn bè mới xem được bài đăng" quiet>{lockedWallText(p.relationship, p.name)}</EmptyState>
          </section>
        )}</>}
    </div>
  )
}

function OtherHeader({ profile, status, actions, busy, onAct }: {
  profile: PublicProfile
  status: string | null
  actions: ReturnType<typeof relationshipUi>['actions']
  busy: boolean
  onAct: (a: FriendAction) => void
}) {
  const cover = safeImageUrl(profile.coverUrl)
  const [broken, setBroken] = useState<string | null>(null)
  const showCover = cover && broken !== cover
  return (
    <section className="cs-card cs-identity" aria-label={`Trang cá nhân của ${profile.name}`}>
      <div className={'cs-cover' + (showCover ? ' has-image' : '')}>
        {showCover && <img className="cs-cover-img" src={cover} alt="" onError={() => setBroken(cover)} />}
      </div>
      <div className="cs-identity-body">
        <div className="cs-identity-avatar-wrap">
          <Avatar className="cs-identity-avatar" name={profile.name} url={profile.avatarUrl} size={124} />
        </div>
        <div className="cs-identity-text">
          <h1 className="cs-identity-name">{profile.name}</h1>
          {profile.isTeacher && <div className="cs-identity-facts"><span className="cs-badge">Giáo viên</span></div>}
          {status && <div className="cs-rel-status">{status}</div>}
          {actions.length > 0 && (
            <div className="cs-rel-actions">
              {actions.map(a => (
                <button key={a.id} type="button" disabled={busy} onClick={() => onAct(a.id)}
                  className={'cs-btn cs-btn-sm ' + (a.tone === 'primary' ? 'cs-btn-primary' : a.tone === 'danger' ? 'cs-btn-ghost is-danger' : 'cs-btn-ghost')}>
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function Wall({ me, userId, isSelf, identityRev, onOpenProfile, onOpenThread }: {
  me: ClassIdentity
  userId: string
  isSelf: boolean
  identityRev: number
  onOpenProfile: (userId: string) => void
  onOpenThread?: (threadId: string) => void
}) {
  // P2: bài của người đó (luật get_user_wall) + câu chuyện học tập của họ theo quyền server — RPC user_wall
  const fetchPage = useCallback((c?: { createdAt: string; id: string; key: string }) => fetchWallMixedPage(userId, c), [userId])
  const { state, reload, loadMore } = usePostsFeed(fetchPage)
  const postIds = useMemo(() => state.status === 'ready' ? state.posts.filter(isPostEntry).map(p => p.id) : [], [state])
  const { comments, refresh, expand, refreshAll } = useFeedComments(postIds)
  const [modError, setModError] = useState<string | null>(null)

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
    me, comments,
    onRefreshComments: refresh,
    onExpandComments: expand,
    onModeratePost: (p, h) => void onModeratePost(p, h),
    onOpenProfile: id => { if (id !== userId) onOpenProfile(id) },
    onOpenThread,
  }

  return (
    <>
      {isSelf && <WallComposer me={me} onPosted={() => void reload({ quiet: true })} />}
      <section className="cs-feed" aria-labelledby="cs-wall-title" aria-busy={state.status === 'loading'}>
        <h2 id="cs-wall-title" className="cs-feed-title">Bài đăng</h2>
        {modError && <p className="cs-form-error" role="alert">{modError}</p>}
        {state.status === 'loading' && <div className="cs-card cs-post" aria-label="Đang tải"><div className="cs-skeleton" style={{ width: '40%' }} /></div>}
        {state.status === 'error' && (
          <div className="cs-card cs-feed-error" role="alert">
            <p>{state.message}</p>
            <button type="button" className="cs-btn cs-btn-soft" onClick={() => void reload()}>Thử lại</button>
          </div>
        )}
        {state.status === 'ready' && state.posts.length === 0 && (
          <EmptyState icon={Lock} title="Chưa có bài đăng" quiet>
            {isSelf ? 'Bài bạn đăng ở đây chỉ bạn bè và Thầy xem được.' : 'Khi có bài mới, bài sẽ hiện ở đây.'}
          </EmptyState>
        )}
        {state.status === 'ready' && state.posts.length > 0 && (
          <div className="cs-post-list">
            {state.posts.map(p => <FeedEntryCard key={p.id} entry={p} social={social} />)}
            {state.moreError && <p className="cs-feed-more-error" role="alert">{state.moreError}</p>}
            {state.hasMore && (
              <button type="button" className="cs-btn cs-btn-ghost cs-feed-more" onClick={() => void loadMore()} disabled={state.loadingMore}>
                {state.loadingMore ? 'Đang tải…' : 'Xem thêm'}
              </button>
            )}
          </div>
        )}
      </section>
    </>
  )
}
