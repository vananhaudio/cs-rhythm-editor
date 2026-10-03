// BÀI TRẢ CỦA TÔI (Class UX V3, desktop rộng) — panel phải của master-detail: diễn giải RỘNG HƠN của chính mục lục
// cho MỘT buổi ("Tôi phải học gì ↔ Tôi đã thực sự nắm được gì"). Dữ liệu = cùng state của mục lục (class_learning_state,
// thread thật của chính mình) — không request thêm, không progress bar / % / XP. Không phải navigation bắt buộc:
// tên buổi vẫn là đường vào Trang Buổi; bài có thread → cuộc trao đổi; bài chưa trả → Trang Buổi tại đúng bài trả.
import { lockedHint, pad2, type ClassLearningState } from '../../classLearning/progress'
import { SubmissionList } from './ClassMap'
import { sessionView, submissionsText } from './classMapModel'

type Ready = Extract<ClassLearningState, { enabled: true }>

export default function SubmissionsPanel({ state, sessionNo, onOpenSession, onOpenThread }: {
  state: Ready
  sessionNo: number | null
  onOpenSession: (sessionNo: number, checkpointId?: string) => void
  onOpenThread: (threadId: string) => void
}) {
  const teacher = state.role === 'teacher'
  const s = state.sessions.find(x => x.no === sessionNo) ?? null
  const v = s ? sessionView(s, state) : null
  return (
    <aside id="cs-subs-panel" className="cs-subs-panel" aria-labelledby="cs-subs-title" aria-live="polite">
      <h2 id="cs-subs-title" className="cs-classv2-h2">{teacher ? 'Bài trả của buổi' : 'Bài trả của tôi'}</h2>
      {!s || !v
        ? <p className="cs-map-note">Chọn số bài trả ở một buổi trong mục lục để xem chi tiết.</p>
        : <>
            {v.locked
              ? <p className="cs-subs-title is-locked">Buổi {pad2(s.no)} · {s.title}</p>
              : <button type="button" className="cs-subs-title" onClick={() => onOpenSession(s.no)}>Buổi {pad2(s.no)} · {s.title}</button>}
            {v.locked
              ? <p className="cs-map-note">Chưa mở · {lockedHint(state.sessions, s)}.</p>
              : !v.submissions
                ? <p className="cs-map-note">Buổi này không có bài trả.</p>
                : <>
                    <p className="cs-subs-sum">
                      {!teacher && v.submissions.passed > 0 && <span className="cs-map-mark is-ok" aria-hidden="true">✓</span>}
                      {teacher ? submissionsText(v.submissions, true) : `${v.submissions.passed}/${v.submissions.total} Đạt`}
                    </p>
                    <SubmissionList s={s} teacher={teacher} compact label={`Bài trả buổi ${pad2(s.no)}`} onOpenSession={onOpenSession} onOpenThread={onOpenThread} />
                  </>}
          </>}
    </aside>
  )
}
