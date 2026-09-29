// App học — màn toàn màn hình cho MỘT bài: toàn bộ cuộc trao đổi + ô Trả bài / Hỏi bài.
// Không rời App: gửi xong ở lại đây, thấy ngay trạng thái mới; đóng → về đúng bài đang học.
import { useCallback, useEffect, useState } from 'react'
import './styles'
import { fetchThread, setVisibility } from './ltApi'
import {
  VISIBILITY_LABEL, canAsk, canSubmit, ctaTitle,
  type LessonThreadState, type StudentKind, type ThreadDetail, type Visibility,
} from './ltModel'
import ThreadView from './ThreadView'
import StudentComposer from './StudentComposer'

export type SheetMode = { compose: StudentKind | null }

export default function LearningThreadSheet({ lessonId, lessonTitle, state, mode, onClose, onChanged }: {
  lessonId: string
  lessonTitle: string
  state: LessonThreadState
  mode: SheetMode
  onClose: () => void
  onChanged: () => void
}) {
  const [threadId, setThreadId] = useState<string | null>(state.thread?.id ?? null)
  const [thread, setThread] = useState<ThreadDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [compose, setCompose] = useState<StudentKind | null>(mode.compose)
  const [visBusy, setVisBusy] = useState(false)

  const load = useCallback(async (id: string) => {
    const r = await fetchThread(id)
    if (r.ok) { setThread(r.value); setLoadError(null) } else setLoadError(r.message)
  }, [])
  useEffect(() => {
    if (!threadId) return
    let alive = true
    void fetchThread(threadId).then(r => {
      if (!alive) return
      if (r.ok) { setThread(r.value); setLoadError(null) } else setLoadError(r.message)
    })
    return () => { alive = false }
  }, [threadId])

  // Khoá cuộn trang phía sau + Esc để đóng
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [onClose])

  const kinds: StudentKind[] = [...(canSubmit(state) ? ['submission' as const] : []), ...(canAsk(state) ? ['question' as const] : [])]
  const closed = !!thread && (thread.archived || thread.isHidden)

  const onSent = (id: string) => {
    setCompose(null)
    setThreadId(id)
    void load(id)
    onChanged()
  }

  const toggleVisibility = async () => {
    if (!thread || visBusy) return
    const next: Visibility = thread.visibility === 'community' ? 'private' : 'community'
    setVisBusy(true)
    const r = await setVisibility(thread.id, next)
    setVisBusy(false)
    if (r.ok) { setThread({ ...thread, visibility: next }); onChanged() } else setLoadError(r.message)
  }

  return (
    <div className="lt-sheet" role="dialog" aria-modal="true" aria-label={`${ctaTitle(state)} · ${lessonTitle}`}>
      <header className="lt-sheet-head">
        <button type="button" className="lt-icon-btn" onClick={onClose} aria-label="Đóng">‹</button>
        <div className="lt-sheet-title">{lessonTitle}</div>
      </header>
      <div className="lt-sheet-body">
        {state.prompt && <p className="lt-prompt"><b>Lời dặn của Thầy: </b>{state.prompt}</p>}
        {loadError && <p className="lt-error" role="alert">{loadError}</p>}
        {thread && <ThreadView thread={thread} />}
        {thread && thread.isMine && !closed && (
          <div className="lt-actions" style={{ alignItems: 'center' }}>
            <span className="lt-note">Đang chia sẻ: <b>{VISIBILITY_LABEL[thread.visibility]}</b></span>
            <button type="button" className="lt-btn is-ghost" disabled={visBusy} onClick={() => void toggleVisibility()}>
              Chuyển sang "{VISIBILITY_LABEL[thread.visibility === 'community' ? 'private' : 'community']}"
            </button>
          </div>
        )}
        {!closed && kinds.length > 0 && (compose
          ? <StudentComposer key={compose} lessonId={lessonId} kinds={kinds} initialKind={compose} isNewThread={!threadId}
              onSent={onSent} onCancel={threadId ? () => setCompose(null) : onClose} />
          : (
            <div className="lt-actions">
              {canSubmit(state) && <button type="button" className="lt-btn is-primary" onClick={() => setCompose('submission')}>{threadId ? 'Trả lại' : 'Trả bài'}</button>}
              {canAsk(state) && <button type="button" className="lt-btn" onClick={() => setCompose('question')}>{threadId ? 'Hỏi tiếp' : 'Hỏi bài'}</button>}
            </div>
          ))}
        {closed && <p className="lt-note">Cuộc trao đổi này đã đóng.</p>}
      </div>
    </div>
  )
}
