// TRANG BUỔI — "phòng học" (/me/classes/<id>/sessions/<n>): CHỈ học. Không bản đồ 24 buổi, không feed lớp, không social.
// Nội dung = CHÍNH LessonDocument (khuôn SOLO01), chỉ tải giáo án của ĐÚNG buổi này. URL riêng → reload / deep link được.
// Quyền: buổi khoá (người học, chế độ checkpoint) → không tải nội dung; không có quyền giáo trình → không lộ gì
// (giáo án vẫn do RLS class_lesson_content chặn ở server, URL không vượt quyền).
// NHỊP HỌC: một buổi có N nhịp HỌC → THỰC HÀNH → TRẢ BÀI. Nhịp KHÔNG phải model riêng: nó hình thành bởi VỊ TRÍ khối
// checkpoint mà Owner đặt trong LessonSection[] (xem docs/GIAO-TRINH-CHUAN.md). Trang này chỉ render đúng thứ tự đó.
import ShareButton from '../../share/ShareButton'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import '../../learning-thread/styles'
import LessonDocument, { QuizOptionsStatic } from '../../lesson/LessonDocument'
import { CheckpointSlot } from '../../lesson/checkpointSlot'
import type { CheckpointSection, LessonDoc } from '../../lesson/lessonTypes'
import { quizOf, submitModes, withTeacherPreview } from '../../lesson/checkpoint'
import { fetchSessionContent } from '../../classLearning/api'
import { pad2, sessionPhase, type SessionState } from '../../classLearning/progress'
import StudentComposer from '../../learning-thread/StudentComposer'
import { answerCheckpoint, submitCheckpoint } from '../../classLearning/progressApi'
import { CheckpointStatusView, LockedNote, SessionStatusLine } from './LearnParts'
import QuizCheckpoint from './QuizCheckpoint'
import { takeCheckpointFocus, useClassLearning, type LearnReady } from './useClassLearning'

type Ready = LearnReady

export default function ClassSessionPage({ classId, sessionNo, isTeacher = false, onBackToClass, onOpenSession, onOpenThread }: {
  classId: string
  sessionNo: number
  isTeacher?: boolean
  /** "← Về lớp": quay lại Trang Lớp (lịch sử trong /me nếu có, ngược lại mở Trang Lớp) */
  onBackToClass: () => void
  onOpenSession: (sessionNo: number) => void
  onOpenThread: (id: string) => void
}) {
  const { detail, learn, loading, reload } = useClassLearning(classId, isTeacher)
  const s = learn?.sessions.find(x => x.no === sessionNo) ?? null
  const className = learn?.className ?? (detail.status === 'ready' ? detail.value.name : null)
  useEffect(() => {
    document.title = `Buổi ${pad2(sessionNo)}${s ? ` · ${s.title}` : ''}${className ? ` · ${className}` : ''} · Thầy Văn Anh Guitar`
  }, [sessionNo, s, className])

  const back = (
    <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm cs-profile-back cs-session-back" onClick={onBackToClass}>
      <ArrowLeft size={16} /> {className ?? 'Về lớp'}
    </button>
  )
  // Chia sẻ buổi học (chỉ tham chiếu qua DM; người nhận mở bằng quyền của chính họ) — hiện ở MỌI trạng thái buổi khi giáo trình đọc được
  const shareBtn = learn && s ? <ShareButton target={{ type: 'class_session', key: s.sessionId.toLowerCase() }} title={`Buổi ${pad2(sessionNo)}${s.title ? ' · ' + s.title : ''}`} /> : null
  const shell = (body: ReactNode) => (
    <div className="cs-col-wide cs-home cs-session">
      <div className="cs-session-top" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>{back}{shareBtn}</div>
      {body}
    </div>
  )
  const head = (title: string | null) => (
    <header className="cs-card cs-learn-head">
      <span className="cs-learn-kicker">Buổi {pad2(sessionNo)}</span>
      {title && <h1 className="cs-class-name">{title}</h1>}
    </header>
  )

  if (loading) return shell(<p className="cs-loading" role="status">Đang mở buổi học…</p>)
  if (!learn) return shell(<>{head(null)}<p className="cs-learn-locked">Bạn chưa xem được giáo trình của lớp này.</p></>)
  if (!s) return shell(<>{head(null)}<p className="cs-learn-locked">Không tìm thấy buổi này trong lớp.</p></>)

  const phase = sessionPhase(s, learn.role, learn.mode)
  const idx = learn.sessions.indexOf(s)
  const prev = learn.sessions[idx - 1] ?? null
  const next = learn.sessions[idx + 1] ?? null
  const canEnter = (x: SessionState | null) => !!x && sessionPhase(x, learn.role, learn.mode) !== 'locked'
  const nav = (
    <nav className="cs-session-nav" aria-label="Chuyển buổi">
      {prev ? <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm" disabled={!canEnter(prev)} onClick={() => onOpenSession(prev.no)}><ArrowLeft size={16} /> Buổi {pad2(prev.no)}</button> : <span />}
      {next ? <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm" disabled={!canEnter(next)} onClick={() => onOpenSession(next.no)}>Buổi {pad2(next.no)} <ArrowRight size={16} /></button> : <span />}
    </nav>
  )
  if (phase === 'locked') return shell(<>{head(s.title)}<LockedNote sessions={learn.sessions} s={s} /></>)
  if (!s.published) return shell(<>{head(s.title)}<p className="cs-learn-locked">Nội dung buổi này đang được cập nhật.</p>{nav}</>)
  return shell(
    <>
      {learn.role === 'learner' && learn.mode === 'checkpoint' && (
        <SessionStatusLine s={s} now={learn.serverNow ? new Date(learn.serverNow) : new Date()} paceDays={learn.paceDays} />
      )}
      <SessionContent key={s.sessionId} state={learn} s={s} onReload={reload} onOpenThread={onOpenThread} />
      {nav}
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
          sections: withTeacherPreview(c.sections, state.role),
        } })
      } catch (e) {
        if (alive) setLoad({ status: 'error', message: (e as Error).message || 'Chưa tải được giáo trình.' })
      }
    })()
    return () => { alive = false }
  }, [s.sessionId, s.no, s.title, s.stageNo, s.stageTitle, state.programCode, state.className, state.role, rev])
  // Đến từ Mục lục (bấm một bài trả chưa trả): đưa đúng khối bài trả vào màn hình, một lần
  useEffect(() => {
    if (load.status !== 'ready') return
    const cp = takeCheckpointFocus(state.classId, s.no)
    if (cp) requestAnimationFrame(() => document.getElementById(`bai-tra-${cp}`)?.scrollIntoView({ block: 'start' }))
  }, [load.status, state.classId, s.no])

  const slot = useCallback((cp: CheckpointSection) => {
    if (cp.preview) return <PreviewSubmit />
    const quiz = quizOf(cp)
    if (state.role === 'teacher') {
      return quiz
        ? <><QuizOptionsStatic quiz={quiz} /><p className="lt-note">Trắc nghiệm tự chấm: học viên chọn và bấm Kiểm tra, máy chấm ngay — không vào Hàng đợi.</p></>
        : <p className="lt-note">Học viên trả bài tại đây. Bài gửi về Hàng đợi Trả/Hỏi bài để chấm.</p>
    }
    const st = s.checkpoints.find(c => c.id === cp.id) ?? null
    if (quiz) {
      return (
        <QuizCheckpoint cpId={`${s.no}-${cp.id}`} quiz={quiz} passedAt={st?.quizPassedAt ?? null} onPassed={onReload}
          onAnswer={choices => answerCheckpoint({ classId: state.classId, sessionNo: s.no, checkpointId: cp.id, choices })} />
      )
    }
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
  // Chế độ giáo trình (chưa có bài trả): chỉ cắm phần hiển thị cho khung XEM TRƯỚC của giáo viên; học viên không thấy nút nộp nào.
  if (state.mode === 'curriculum') {
    return (
      <CheckpointSlot.Provider value={cp => (cp.preview ? <PreviewSubmit /> : null)}>
        <LessonDocument doc={load.doc} embedded />
      </CheckpointSlot.Provider>
    )
  }
  return (
    <CheckpointSlot.Provider value={slot}>
      <LessonDocument doc={load.doc} embedded />
    </CheckpointSlot.Provider>
  )
}

// Khung XEM TRƯỚC "Trả bài" (chỉ giáo viên, buổi chưa có bài trả thật) — xem withTeacherPreview trong lesson/checkpoint.ts.
function PreviewSubmit() {
  return (
    <div className="lt-panel is-compact">
      <div className="cs-learn-cp">
        <div className="lt-actions">
          <button type="button" className="lt-btn is-primary" disabled aria-disabled="true" title="Xem trước giao diện — chưa nộp được">TRẢ BÀI</button>
        </div>
        <p className="lt-note">Xem trước giao diện (chỉ giáo viên thấy) — chưa phải bài trả thật, không nộp được.</p>
      </div>
    </div>
  )
}
