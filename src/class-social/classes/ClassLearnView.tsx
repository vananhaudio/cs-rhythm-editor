// Lớp của tôi — TRANG LỚP = BẢN ĐỒ (/me/classes/<id>): "Tôi đang ở đâu và học buổi nào?"
// Sơ đồ DỌC 24 buổi (3 chặng, vạch nghỉ) — bấm một buổi → TRANG BUỔI riêng (/me/classes/<id>/sessions/<n>) để HỌC.
// Không render giáo án ở đây (không tải blocks của các buổi). Bên dưới: "Các bạn vừa trả bài" (social_class_activity)
// + [Xem thêm về lớp] → trang cộng đồng lớp. Buổi hiện tại do currentSessionNo() quyết (hôm nay: theo lịch ở chế độ
// giáo trình / theo tiến độ server ở chế độ checkpoint) — trình bày tách khỏi cách xác định.
import { useCallback, useEffect, useMemo } from 'react'
import { ArrowLeft, ArrowRight, Users } from 'lucide-react'
import '../../learning-thread/styles'
import { currentSessionNo, pad2, sessionPhase } from '../../classLearning/progress'
import { EmptyState } from '../ui'
import { usePostsFeed } from '../posts/useCommunityFeed'
import type { PostSocial } from '../sections/PostCard'
import FeedEntryCard from '../sections/FeedEntryCard'
import { fetchClassActivityPage } from './classesApi'
import { BreakDivider, SessionRowHead } from './LearnParts'
import { takeReturnSession, type LearnReady } from './useClassLearning'

const RECENT_COUNT = 5

export default function ClassLearnView({ state, onOpenSession, onOpenThread, onOpenProfile, onOpenClasses, onOpenCommunity }: {
  state: LearnReady
  onOpenSession: (sessionNo: number) => void
  onOpenThread: (id: string) => void
  onOpenProfile: (userId: string) => void
  onOpenClasses: () => void
  onOpenCommunity: () => void
}) {
  // Nhịp tuần tính theo giờ SERVER (không tin đồng hồ máy học viên)
  const now = useMemo(() => (state.serverNow ? new Date(state.serverNow) : new Date()), [state.serverNow])
  const current = currentSessionNo(state, now)

  useEffect(() => {
    const no = takeReturnSession(state.classId)
    if (no) document.getElementById(`buoi-${pad2(no)}`)?.scrollIntoView({ block: 'center' })
  }, [state.classId])

  const open = (no: number) => onOpenSession(no)

  return (
    <div className="cs-col cs-home cs-learn">
      <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm cs-profile-back" onClick={onOpenClasses}><ArrowLeft size={16} /> Lớp học</button>
      <header className="cs-card cs-learn-head">
        <span className="cs-learn-kicker">{state.programCode}</span>
        <h1 className="cs-class-name">{state.className}</h1>
        {state.role === 'teacher' && (
          <p className="lt-note">Bạn đang xem với vai trò giáo viên: mọi buổi đều mở để xem trước.{state.classCode ? ` Mã lớp: ${state.classCode}.` : ''}</p>
        )}
      </header>

      <ol className="cs-learn-map" aria-label="Sơ đồ giáo trình">
        {state.sessions.map((s, i) => {
          const prevStage = i > 0 ? state.sessions[i - 1].stageNo : null
          const stageHead = s.stageNo != null && s.stageNo !== prevStage && s.stageTitle
            ? <li key={'stage-' + s.stageNo} className="cs-learn-stage" aria-hidden="true">Chặng {s.stageNo} · {s.stageTitle}</li> : null
          const brk = state.breaks.find(b => b.beforeNo === s.no)
          const locked = sessionPhase(s, state.role, state.mode) === 'locked'
          return [
            brk ? <BreakDivider key={'break-' + s.no} title={brk.title} /> : null,   // nghỉ cuối chặng trước, rồi mới sang chặng mới
            stageHead,
            <li key={s.sessionId} className="cs-learn-item">
              <SessionRowHead s={s} role={state.role} mode={state.mode} now={now} paceDays={state.paceDays} expanded={false}
                current={s.no === current} disabled={locked} onToggle={() => open(s.no)} />
            </li>,
          ]
        })}
        {state.breaks.filter(b => b.beforeNo == null).map(b => <BreakDivider key="break-end" title={b.title} />)}
      </ol>

      <RecentSubmissions classId={state.classId} onOpenThread={onOpenThread} onOpenProfile={onOpenProfile} onOpenCommunity={onOpenCommunity} />
    </div>
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

