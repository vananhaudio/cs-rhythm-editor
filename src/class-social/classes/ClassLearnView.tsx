// Lớp của tôi V1 — màn HỌC của một lớp có giáo trình (/me/classes/<id>): chọn lớp là HỌC NGAY.
// Sơ đồ DỌC các buổi (thu gọn) → buổi hiện tại tự mở → nội dung buổi render bằng CHÍNH LessonDocument của SOLO01
// → bài trả (checkpoint) có nút TRẢ BÀI + trạng thái ngay tại chỗ (cắm qua CheckpointSlot, không sửa section nào khác)
// → bên dưới: "Các bạn vừa trả bài" (5 mục, dùng lại social_class_activity) + [Xem thêm về lớp] sang trang cộng đồng lớp.
// Quyền / buổi mở / checkpoint canonical: SERVER (class_learning_state, lt_submit_checkpoint). Không suy luận quyền ở đây.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Users } from 'lucide-react'
import '../../learning-thread/styles'
import LessonDocument from '../../lesson/LessonDocument'
import { CheckpointSlot } from '../../lesson/checkpointSlot'
import type { CheckpointSection, LessonDoc } from '../../lesson/lessonTypes'
import { submitModes } from '../../lesson/checkpoint'
import { fetchSessionContent } from '../../classLearning/api'
import { currentSessionNo, sessionPhase, type ClassLearningState, type SessionState } from '../../classLearning/progress'
import StudentComposer from '../../learning-thread/StudentComposer'
import { submitCheckpoint } from '../../classLearning/progressApi'
import { EmptyState } from '../ui'
import { usePostsFeed } from '../posts/useCommunityFeed'
import type { PostSocial } from '../sections/PostCard'
import FeedEntryCard from '../sections/FeedEntryCard'
import { fetchClassActivityPage } from './classesApi'
import { CheckpointStatusView, LockedNote, SessionRowHead, SessionStatusLine } from './LearnParts'

type Ready = Extract<ClassLearningState, { enabled: true }>
const OPEN_KEY = 'csLearnOpen'
const RECENT_COUNT = 5

function savedOpen(classId: string): number | null {
  const v = (window.history.state as Record<string, unknown> | null)?.[OPEN_KEY]
  return v && typeof v === 'object' && (v as Record<string, unknown>)[classId] !== undefined
    ? Number((v as Record<string, unknown>)[classId]) : null
}
function rememberOpen(classId: string, no: number | null) {
  try {
    const prev = ((window.history.state as Record<string, unknown> | null)?.[OPEN_KEY] ?? {}) as Record<string, unknown>
    window.history.replaceState({ ...(window.history.state ?? {}), [OPEN_KEY]: { ...prev, [classId]: no } }, '')
  } catch { /* bỏ qua */ }
}

export default function ClassLearnView({ state, onReload, onOpenThread, onOpenProfile, onOpenClasses, onOpenCommunity }: {
  state: Ready
  /** tải lại trạng thái (yên lặng — không tháo nội dung đang đọc) */
  onReload: () => void
  onOpenThread: (id: string) => void
  onOpenProfile: (userId: string) => void
  onOpenClasses: () => void
  onOpenCommunity: () => void
}) {
  // Nhịp tuần tính theo giờ SERVER (không tin đồng hồ máy học viên)
  const now = useMemo(() => (state.serverNow ? new Date(state.serverNow) : new Date()), [state.serverNow])
  const [open, setOpen] = useState<number | null>(() => savedOpen(state.classId) ?? currentSessionNo(state))
  const current = currentSessionNo(state)
  const scrolled = useRef(false)

  // Vào lớp: đưa buổi hiện tại vào màn hình (một lần), không giật khi tải lại trạng thái.
  useEffect(() => {
    if (scrolled.current || open == null) return
    scrolled.current = true
    const el = document.getElementById(`buoi-${String(open).padStart(2, '0')}`)
    if (el && open !== state.sessions[0]?.no) requestAnimationFrame(() => el.scrollIntoView({ block: 'start', behavior: 'smooth' }))
  }, [open, state.sessions])

  const toggle = (no: number) => {
    const next = open === no ? null : no
    setOpen(next)
    rememberOpen(state.classId, next)
  }

  return (
    <div className="cs-col cs-home cs-learn">
      <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm cs-profile-back" onClick={onOpenClasses}><ArrowLeft size={16} /> Lớp học</button>
      <header className="cs-card cs-learn-head">
        <span className="cs-learn-kicker">{state.programCode}{state.classCode ? ` · ${state.classCode}` : ''}</span>
        <h1 className="cs-class-name">{state.className}</h1>
        {state.role === 'teacher' && <p className="lt-note">Bạn đang xem với vai trò giáo viên: mọi buổi đều mở để xem trước.</p>}
      </header>

      <ol className="cs-learn-map" aria-label="Sơ đồ giáo trình">
        {state.sessions.map((s, i) => {
          const prevStage = i > 0 ? state.sessions[i - 1].stageNo : null
          const stageHead = s.stageNo != null && s.stageNo !== prevStage && s.stageTitle
            ? <li key={'stage-' + s.stageNo} className="cs-learn-stage" aria-hidden="true">Chặng {s.stageNo} · {s.stageTitle}</li> : null
          const expanded = open === s.no
          return [
            stageHead,
            <li key={s.sessionId} className={'cs-learn-item' + (expanded ? ' is-open' : '')}>
              <SessionRowHead s={s} role={state.role} now={now} paceDays={state.paceDays} expanded={expanded}
                current={s.no === current} onToggle={() => toggle(s.no)} />
              {expanded && (
                <div className="cs-learn-body">
                  <SessionBody state={state} s={s} now={now} onReload={onReload} onOpenThread={onOpenThread} />
                </div>
              )}
            </li>,
          ]
        })}
      </ol>

      <RecentSubmissions key={state.serverNow ?? ''} classId={state.classId} onOpenThread={onOpenThread} onOpenProfile={onOpenProfile} onOpenCommunity={onOpenCommunity} />
    </div>
  )
}

function SessionBody({ state, s, now, onReload, onOpenThread }: {
  state: Ready; s: SessionState; now: Date; onReload: () => void; onOpenThread: (id: string) => void
}) {
  const phase = sessionPhase(s, state.role)
  if (phase === 'locked') return <LockedNote sessions={state.sessions} s={s} />
  if (!s.published) return <p className="cs-learn-locked">Giáo trình buổi này đang được soạn. Bạn sẽ thấy nội dung ngay khi buổi được xuất bản.</p>
  return (
    <>
      {state.role === 'learner' && <SessionStatusLine s={s} now={now} paceDays={state.paceDays} />}
      <SessionContent key={s.sessionId} state={state} s={s} onReload={onReload} onOpenThread={onOpenThread} />
    </>
  )
}

type ContentLoad = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; doc: LessonDoc }

function SessionContent({ state, s, onReload, onOpenThread }: {
  state: Ready; s: SessionState; onReload: () => void; onOpenThread: (id: string) => void
}) {
  const [load, setLoad] = useState<ContentLoad>({ status: 'loading' })
  const [rev, setRev] = useState(0)
  const [composing, setComposing] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const db = (await import('../../supabase')).supabase
        const c = await fetchSessionContent(db, s.sessionId)
        if (!alive) return
        if (!c) { setLoad({ status: 'error', message: 'Chưa mở được giáo trình buổi này.' }); return }
        setLoad({ status: 'ready', doc: {
          meta: { programCode: state.programCode, programName: state.className, sessionNo: s.no, title: s.title,
                  stageLabel: s.stageNo != null && s.stageTitle ? `Chặng ${s.stageNo} · ${s.stageTitle}` : undefined },
          sections: c.sections,
        } })
      } catch (e) {
        if (alive) setLoad({ status: 'error', message: (e as Error).message || 'Chưa tải được giáo trình.' })
      }
    })()
    return () => { alive = false }
  }, [s.sessionId, s.no, s.title, s.stageNo, s.stageTitle, state.programCode, state.className, rev])

  const slot = useCallback((cp: CheckpointSection) => {
    if (state.role === 'teacher') return <p className="lt-note">Học viên trả bài tại đây. Bài gửi về Hàng đợi Trả/Hỏi bài để chấm.</p>
    const st = s.checkpoints.find(c => c.id === cp.id) ?? null
    const modes = submitModes(cp)
    const key = `${s.no}:${cp.id}`
    const composer = composing === key ? (
      <StudentComposer lessonId={`cp-${state.classId}-${key}`} kinds={['submission']} initialKind="submission"
        isNewThread={!st?.thread} visibilities={['class', 'private']} title={`Trả bài ${cp.id}`}
        placeholder="Viết ngắn gọn bạn đã làm được gì, chỗ nào còn vướng." requireMedia={!modes.text} allowMedia={modes.video}
        sendEvent={i => submitCheckpoint({ classId: state.classId, sessionNo: s.no, checkpointId: cp.id, body: i.body, mediaUrl: i.mediaUrl, visibility: i.visibility })}
        onSent={() => { setComposing(null); onReload() }} onCancel={() => setComposing(null)} />
    ) : undefined
    return (
      <div className="lt-panel is-compact">
        <CheckpointStatusView cp={st} supported={modes.supported} composer={composer}
          onSubmit={() => setComposing(key)} onView={onOpenThread} />
      </div>
    )
  }, [state.role, state.classId, s.checkpoints, s.no, composing, onReload, onOpenThread])

  if (load.status === 'loading') return <p className="cs-loading" role="status">Đang mở giáo trình…</p>
  if (load.status === 'error') {
    return (
      <div className="cs-card cs-feed-error" role="alert">
        <p>{load.message}</p>
        <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm" onClick={() => { setLoad({ status: 'loading' }); setRev(x => x + 1) }}>Thử lại</button>
      </div>
    )
  }
  return (
    <CheckpointSlot.Provider value={slot}>
      <LessonDocument doc={load.doc} embedded />
    </CheckpointSlot.Provider>
  )
}

function RecentSubmissions({ classId, onOpenThread, onOpenProfile, onOpenCommunity }: {
  classId: string; onOpenThread: (id: string) => void; onOpenProfile: (userId: string) => void; onOpenCommunity: () => void
}) {
  const fetchPage = useCallback((c?: { createdAt: string; id: string; key: string }) => fetchClassActivityPage(classId, c), [classId])
  const { state } = usePostsFeed(fetchPage)
  const social: PostSocial = {
    me: null, comments: {}, onRefreshComments: async () => {}, onExpandComments: async () => {}, onModeratePost: () => {},
    onOpenProfile, onOpenThread, threadContext: 'class',
  }
  return (
    <section className="cs-feed cs-learn-recent" aria-label="Các bạn vừa trả bài" aria-busy={state.status === 'loading'}>
      <h2 className="cs-learn-recent-title">Các bạn vừa trả bài</h2>
      {state.status === 'loading' && <p className="cs-loading" role="status">Đang tải…</p>}
      {state.status === 'error' && <div className="cs-card cs-feed-error" role="alert"><p>{state.message}</p></div>}
      {state.status === 'ready' && state.posts.length === 0 && (
        <EmptyState icon={Users} title="Chưa có bài trả nào" quiet>Bài trả của các bạn cùng lớp sẽ hiện ở đây.</EmptyState>
      )}
      {state.status === 'ready' && state.posts.length > 0 && (
        <div className="cs-post-list">
          {state.posts.slice(0, RECENT_COUNT).map(p => <FeedEntryCard key={p.id} entry={p} social={social} />)}
        </div>
      )}
      <button type="button" className="cs-btn cs-btn-ghost cs-learn-more" onClick={onOpenCommunity}>
        Xem thêm về lớp <ArrowRight size={16} />
      </button>
    </section>
  )
}
