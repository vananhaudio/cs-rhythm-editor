// STAGE_OPEN_V1 — Thầy mở đầu chặng mới: một lối vào rõ ở đầu trang lớp, kể cả khi chặng cũ còn dở. Chỉ trình bày:
// không ghi tiến độ, không đổi quyền. Tự ẩn khi người học đã hoàn thành buổi mở đầu.
import { openedStageStart, pad2, sessionLabel, type ClassLearningState } from '../../classLearning/progress'

export default function NewStageEntry({ state, onOpenSession }: {
  state: Extract<ClassLearningState, { enabled: true }>
  onOpenSession: (sessionNo: number) => void
}) {
  const s = openedStageStart(state)
  if (!s || s.completedAt) return null
  const unfinished = state.sessions.some(x => x.no < s.no && !!x.openedAt && !x.completedAt)
  return (
    <section className="cs-card cs-newstage" aria-label="Chặng mới đã mở">
      <p className="cs-newstage-title"><b>{s.stageNo != null ? `Chặng ${s.stageNo} đã mở` : 'Chặng mới đã mở'}</b></p>
      <p className="cs-newstage-note">{sessionLabel(s)}</p>
      <button type="button" className="cs-btn cs-btn-primary cs-btn-sm" onClick={() => onOpenSession(s.no)}>Vào Buổi {pad2(s.no)}</button>
      {unfinished && <p className="cs-newstage-note">Tiến độ chặng trước vẫn được giữ. Bạn có thể quay lại làm tiếp.</p>}
    </section>
  )
}
