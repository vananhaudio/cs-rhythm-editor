// /me/t/<thread id> — SOCIAL VIEW của một learning thread (cùng dữ liệu với App học, không copy).
// Quyền đọc do server quyết định (lt_detail): community → thành viên Class; private → chính chủ + Thầy.
// Không xem được → "không tìm thấy" (server không lộ sự tồn tại). Chính chủ tiếp tục Trả lại / Hỏi tiếp tại đây
// (theo cấu hình bài); Thầy phản hồi / chấm làm lại / đạt, ẩn nội dung.
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ListChecks } from 'lucide-react'
import './styles'
import { fetchLessonStates, fetchThread, moderate, setVisibility } from './ltApi'
import { submitCheckpoint } from '../classLearning/progressApi'
import { VISIBILITY_LABEL, canAsk, canSubmit, otherVisibility, visibilityChoices, type LessonThreadState, type StudentKind, type ThreadDetail, type ThreadEvent } from './ltModel'
import ThreadView from './ThreadView'
import StudentComposer from './StudentComposer'
import TeacherComposer from './TeacherComposer'

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; thread: ThreadDetail }

export default function ThreadPage({ threadId, isTeacher, onBack, onOpenQueue, onOpenProfile, onOpenClass, onOpenSession }: {
  threadId: string
  isTeacher: boolean
  onBack: () => void
  onOpenQueue?: () => void
  onOpenProfile?: (userId: string) => void
  /** bài trả checkpoint: quay về đúng giáo trình lớp */
  onOpenClass?: (classId: string) => void
  /** bài trả checkpoint: mở thẳng Trang Buổi chứa bài trả */
  onOpenSession?: (classId: string, sessionNo: number) => void
}) {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [lesson, setLesson] = useState<LessonThreadState | null>(null)
  const [compose, setCompose] = useState<StudentKind | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Tải thread (+ cấu hình bài nếu là chính chủ: để biết được Trả lại / Hỏi tiếp không). rev++ → tải lại.
  const [rev, setRev] = useState(0)
  const reload = useCallback(() => setRev(x => x + 1), [])
  useEffect(() => {
    let alive = true
    void fetchThread(threadId).then(async r => {
      if (!alive) return
      setLoad(r.ok ? { status: 'ready', thread: r.value } : { status: 'error', message: r.message })
      if (r.ok && r.value.isMine && r.value.lessonId) {
        const s = await fetchLessonStates([r.value.lessonId])
        if (alive) setLesson(s.ok ? s.value.get(r.value.lessonId) ?? null : null)
      }
    })
    return () => { alive = false }
  }, [threadId, rev])   // đổi thread → component mount lại (key) → state ban đầu là loading
  useEffect(() => {
    if (load.status === 'ready') document.title = `${load.thread.identity.lesson.title} · ${load.thread.learner.name} · Thầy Văn Anh Guitar`
  }, [load])

  const back = (
    <div className="lt-actions">
      <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm" onClick={onBack}><ArrowLeft size={16} /> Quay lại</button>
      {isTeacher && onOpenQueue && (
        <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm" onClick={onOpenQueue}><ListChecks size={16} /> Hàng đợi Trả/Hỏi bài</button>
      )}
    </div>
  )

  if (load.status === 'loading') return <div className="cs-col cs-home">{back}<div className="cs-card lt-empty" role="status">Đang tải cuộc trao đổi…</div></div>
  if (load.status === 'error') {
    return (
      <div className="cs-col cs-home">
        {back}
        <div className="cs-card lt-empty" role="alert">
          <p>{load.message}</p>
          <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm" onClick={() => { setLoad({ status: 'loading' }); reload() }}>Thử lại</button>
        </div>
      </div>
    )
  }

  const t = load.thread
  const closed = t.archived || t.isHidden
  const kinds: StudentKind[] = lesson ? [...(canSubmit(lesson) ? ['submission' as const] : []), ...(canAsk(lesson) ? ['question' as const] : [])] : []
  // Bài trả checkpoint: Trả lại khi Thầy đã phản hồi / yêu cầu làm lại (server vẫn kiểm quyền + buổi đã mở).
  const cp = t.checkpoint
  const cpCanResubmit = !!cp?.classId && (t.status === 'needs_retry' || t.status === 'teacher_responded')

  const run = async (f: () => Promise<{ ok: boolean; message?: string }>) => {
    if (busy) return
    setBusy(true)
    const r = await f()
    setBusy(false)
    setError(r.ok ? null : r.message ?? null)
    if (r.ok) reload()
  }
  const nextVisibility = otherVisibility(t.visibility, !!cp)
  const toggleVisibility = () => run(() => setVisibility(t.id, nextVisibility) as Promise<{ ok: boolean; message?: string }>)
  const moderateEvent = (e: ThreadEvent, hidden: boolean) => void run(() => moderate('event', e.id, hidden) as Promise<{ ok: boolean; message?: string }>)

  return (
    <div className="cs-col cs-home lt-page">
      {back}
      <ThreadView thread={t} canModerate={isTeacher} onModerate={moderateEvent} onOpenProfile={onOpenProfile} showIdentity />
      {cp?.classId && (onOpenSession || onOpenClass) && (t.isMine || !isTeacher) && (
        <div className="lt-actions">
          <button type="button" className="lt-btn is-ghost"
            onClick={() => (onOpenSession ? onOpenSession(cp.classId!, cp.sessionNo) : onOpenClass!(cp.classId!))}>
            Mở giáo trình Buổi {String(cp.sessionNo).padStart(2, '0')}</button>
        </div>
      )}
      {error && <p className="cs-form-error" role="alert">{error}</p>}

      {t.isMine && !closed && (
        <div className="lt-actions" style={{ alignItems: 'center' }}>
          <span className="lt-note">Đang chia sẻ: <b>{VISIBILITY_LABEL[t.visibility]}</b></span>
          <button type="button" className="lt-btn is-ghost" disabled={busy} onClick={() => void toggleVisibility()}>
            Chuyển sang "{VISIBILITY_LABEL[nextVisibility]}"
          </button>
        </div>
      )}

      {t.isMine && !closed && cp?.classId && cpCanResubmit && (compose
        ? <StudentComposer key={compose} lessonId={`cp-${t.id}`} kinds={['submission']} initialKind="submission" isNewThread={false}
            visibilities={visibilityChoices(true)} title={`Trả lại bài ${cp.checkpointId}`}
            sendEvent={i => submitCheckpoint({ classId: cp.classId!, sessionNo: cp.sessionNo, checkpointId: cp.checkpointId, body: i.body, mediaUrl: i.mediaUrl })}
            onSent={() => { setCompose(null); reload() }} onCancel={() => setCompose(null)} />
        : <div className="lt-actions"><button type="button" className="lt-btn is-primary" onClick={() => setCompose('submission')}>Trả lại</button></div>)}

      {t.isMine && !closed && t.lessonId && kinds.length > 0 && (compose
        ? <StudentComposer key={compose} lessonId={t.lessonId} kinds={kinds} initialKind={compose} isNewThread={false}
            onSent={() => { setCompose(null); reload() }} onCancel={() => setCompose(null)} />
        : (
          <div className="lt-actions">
            {kinds.includes('submission') && <button type="button" className="lt-btn is-primary" onClick={() => setCompose('submission')}>Trả lại</button>}
            {kinds.includes('question') && <button type="button" className="lt-btn" onClick={() => setCompose('question')}>Hỏi tiếp</button>}
          </div>
        ))}

      {t.canRespond && !t.isHidden && (
        <TeacherComposer threadId={t.id} events={t.events} allowKho onSent={reload} isCheckpoint={!!t.checkpoint} />
      )}
      {isTeacher && (
        <div className="lt-actions">
          <button type="button" className="lt-btn is-ghost" disabled={busy}
            onClick={() => void run(() => moderate('thread', t.id, !t.isHidden) as Promise<{ ok: boolean; message?: string }>)}>
            {t.isHidden ? 'Bỏ ẩn cuộc trao đổi' : 'Ẩn cuộc trao đổi khỏi cộng đồng'}
          </button>
        </div>
      )}
      {closed && !isTeacher && <p className="lt-note">Cuộc trao đổi này đã đóng.</p>}
    </div>
  )
}
