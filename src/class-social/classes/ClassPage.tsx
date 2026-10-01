// /me/classes/<id> — "căn phòng của lớp": tên lớp, Thầy, số học viên, ngữ cảnh; tab Hoạt động | Thành viên.
// Người ngoài lớp XEM được phần công khai (Learning Thread community của lớp) — không đăng, không Trả/Hỏi bài
// từ đây, không xem danh sách thành viên. Quyền do server (RPC social_*) quyết, không chỉ ẩn nút.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Users } from 'lucide-react'
import '../../learning-thread/styles'
import { EmptyState } from '../ui'
import { useHistoryTab } from '../useHistoryTab'
import { usePostsFeed } from '../posts/useCommunityFeed'
import type { PostSocial } from '../sections/PostCard'
import FeedEntryCard from '../sections/FeedEntryCard'
import { respondFriendRequest, sendFriendRequest } from '../friends/friendsApi'
import { fetchClassActivityPage, fetchClassDetail, fetchClassMembers } from './classesApi'
import type { ClassCard, ClassMember } from './classModel'
import { ClassHeader, MemberList } from './ClassParts'
import { programKeyOfClass } from '../identity/learningIdentity'
import { fetchClassLearningState } from '../../classLearning/progressApi'
import { curriculumState, type ClassLearningState } from '../../classLearning/progress'
import { fetchClassOutline, type ClassOutlineData } from '../../classLearning/api'
import ClassLearnView from './ClassLearnView'

const CLASS_TABS = ['activity', 'members'] as const
// Lớp có giáo trình V1 (checkpoint): mặc định HỌC; "Xem thêm về lớp" → phần cộng đồng (Hoạt động | Thành viên) như cũ.
const CLASS_MODES = ['learn', 'community'] as const

type Load<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; value: T }

export default function ClassPage({ classId, isTeacher = false, onOpenThread, onOpenProfile, onOpenClasses }: {
  classId: string
  /** Thầy/admin: xem trước màn học (đọc giáo trình nhờ RLS teacher có sẵn) — không cần là học viên lớp */
  isTeacher?: boolean
  onOpenThread: (id: string) => void
  onOpenProfile: (userId: string) => void
  onOpenClasses: () => void
}) {
  const [detail, setDetail] = useState<Load<ClassCard>>({ status: 'loading' })
  const [tab, setTab] = useHistoryTab<'activity' | 'members'>('csClassTab', 'activity', CLASS_TABS)
  const [members, setMembers] = useState<Load<ClassMember[]> | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actError, setActError] = useState<string | null>(null)
  const [mode, setMode] = useHistoryTab<'learn' | 'community'>('csClassMode', 'learn', CLASS_MODES)
  // Trạng thái học (server). Lỗi / lớp chưa bật V1 → trang lớp cũ (progressive enhancement, không regression).
  const [learn, setLearn] = useState<ClassLearningState | 'loading' | 'off'>('loading')
  const [learnRev, setLearnRev] = useState(0)
  const reloadLearn = useCallback(() => setLearnRev(x => x + 1), [])
  useEffect(() => {
    let alive = true
    void fetchClassLearningState(classId).then(r => { if (alive) setLearn(r.ok ? r.value : 'off') })
    return () => { alive = false }
  }, [classId, learnRev])
  // Giáo trình lớp đọc qua RLS SẴN CÓ (học viên: thành viên + quyền giáo trình + đã xuất bản; Thầy/admin: tất cả).
  // Có giáo trình (HAS_CURRICULUM) → màn học; checkpoint (HAS_CHECKPOINTS) chỉ BẬT THÊM trả bài/tiến độ.
  const [outline, setOutline] = useState<ClassOutlineData | 'loading' | 'off'>('loading')
  useEffect(() => {
    let alive = true
    void import('../../supabase').then(({ supabase }) => fetchClassOutline(supabase, classId))
      .then(o => { if (alive) setOutline(o) }, () => { if (alive) setOutline('off') })
    return () => { alive = false }
  }, [classId])

  useEffect(() => {
    let alive = true
    void fetchClassDetail(classId).then(r => { if (alive) setDetail(r.ok ? { status: 'ready', value: r.value } : { status: 'error', message: r.message }) })
    return () => { alive = false }
  }, [classId])
  const name = detail.status === 'ready' ? detail.value.name : null
  useEffect(() => { if (name) document.title = `${name} · Thầy Văn Anh Guitar` }, [name])

  const canViewMembers = detail.status === 'ready' && detail.value.canViewMembers
  useEffect(() => {
    if (tab !== 'members' || !canViewMembers || members) return
    let alive = true
    void fetchClassMembers(classId).then(r => { if (alive) setMembers(r.ok ? { status: 'ready', value: r.value } : { status: 'error', message: r.message }) })
    return () => { alive = false }
  }, [tab, canViewMembers, members, classId])

  const fetchPage = useCallback((c?: { createdAt: string; id: string; key: string }) => fetchClassActivityPage(classId, c), [classId])
  const { state, loadMore } = usePostsFeed(fetchPage)
  const social: PostSocial = {
    me: null, comments: {}, onRefreshComments: async () => {}, onExpandComments: async () => {}, onModeratePost: () => {},
    onOpenProfile, onOpenThread, threadContext: 'class',
  }

  const act = async (m: ClassMember, action: 'send' | 'accept') => {
    setBusyId(m.userId); setActError(null)
    const r = action === 'send' ? await sendFriendRequest(m.userId) : await respondFriendRequest(m.userId, true)
    setBusyId(null)
    if (!r.ok) { setActError(r.message); return }
    setMembers(cur => cur && cur.status === 'ready'
      ? { status: 'ready', value: cur.value.map(x => (x.userId === m.userId ? { ...x, relationship: r.value } : x)) } : cur)
  }

  const checkpointReady = learn !== 'loading' && learn !== 'off' && learn.enabled ? learn : null
  const curriculumReady = useMemo(() => (!checkpointReady && learn !== 'loading' && outline !== 'loading' && outline !== 'off' && detail.status === 'ready'
    ? curriculumState({ classId, programCode: detail.value.programCode, classCode: detail.value.code, className: detail.value.name,
        role: isTeacher ? 'teacher' : 'learner', ...outline })
    : null), [checkpointReady, learn, outline, detail, classId, isTeacher])
  const learnReady = checkpointReady ?? curriculumReady
  if (learnReady && mode === 'learn') {
    return <ClassLearnView state={learnReady} onReload={reloadLearn} onOpenThread={onOpenThread} onOpenProfile={onOpenProfile}
      onOpenClasses={onOpenClasses} onOpenCommunity={() => { setMode('community'); window.scrollTo(0, 0) }} />
  }

  const back = (
    <div className="lt-actions">
      <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm cs-profile-back" onClick={onOpenClasses}><ArrowLeft size={16} /> Lớp học</button>
      {learnReady && <button type="button" className="cs-btn cs-btn-soft cs-btn-sm" onClick={() => { setMode('learn'); window.scrollTo(0, 0) }}>Vào học</button>}
    </div>
  )
  if ((learn === 'loading' || outline === 'loading' || detail.status === 'loading') && mode === 'learn') return <div className="cs-col cs-home"><p className="cs-loading" role="status">Đang mở lớp…</p></div>
  if (detail.status === 'loading') return <div className="cs-col cs-home">{back}<p className="cs-loading" role="status">Đang mở lớp…</p></div>
  if (detail.status === 'error') return <div className="cs-col cs-home">{back}<div className="cs-card cs-feed-error" role="alert"><p>{detail.message}</p></div></div>

  const c = detail.value
  return (
    <div className="cs-col cs-home">
      {back}
      <ClassHeader c={c} />
      <div className="lt-profile-tabs" role="group" aria-label="Lớp">
        <button type="button" aria-pressed={tab === 'activity'} onClick={() => setTab('activity')}>Hoạt động</button>
        <button type="button" aria-pressed={tab === 'members'} onClick={() => setTab('members')}>Thành viên</button>
      </div>
      {tab === 'activity' && (
        <section className="cs-feed" aria-label="Hoạt động của lớp" aria-busy={state.status === 'loading'}>
          {state.status === 'loading' && <p className="cs-loading" role="status">Đang tải hoạt động…</p>}
          {state.status === 'error' && <div className="cs-card cs-feed-error" role="alert"><p>{state.message}</p></div>}
          {state.status === 'ready' && state.posts.length === 0 && (
            <EmptyState icon={Users} title="Chưa có hoạt động mới" quiet>
              Những bài Trả bài, Hỏi bài của lớp sẽ xuất hiện tại đây.
            </EmptyState>
          )}
          {state.status === 'ready' && state.posts.length > 0 && (
            <div className="cs-post-list">
              {state.posts.map(p => <FeedEntryCard key={p.id} entry={p} social={social} />)}
              {state.hasMore && <button type="button" className="cs-btn cs-btn-ghost cs-feed-more" onClick={() => void loadMore()} disabled={state.loadingMore}>
                {state.loadingMore ? 'Đang tải…' : 'Xem thêm'}</button>}
            </div>
          )}
        </section>
      )}
      {tab === 'members' && (
        !canViewMembers
          ? <EmptyState icon={Users} title={`Lớp có ${c.memberCount} học viên`} quiet>Danh sách thành viên chỉ hiện với thành viên của lớp.</EmptyState>
          : !members || members.status === 'loading' ? <p className="cs-loading" role="status">Đang tải thành viên…</p>
          : members.status === 'error' ? <div className="cs-card cs-feed-error" role="alert"><p>{members.message}</p></div>
          : <>
              {actError && <p className="cs-form-error" role="alert">{actError}</p>}
              <MemberList members={members.value} busyId={busyId} onAct={(m, a) => void act(m, a)} onOpenProfile={onOpenProfile}
                excludeIdentity={programKeyOfClass(c)} />
            </>
      )}
    </div>
  )
}
