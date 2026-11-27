// STAGE_OPEN_V1 — lối vào ở đầu trang lớp khi Thầy đã mở chặng mới. Chỉ trình bày: không ghi tiến độ, không đổi quyền.
// Còn bài dở ở chặng trước → "Bài bạn đang học" đứng TRƯỚC (nút chính), chặng mới là lối thứ hai (Owner 27/11: học viên
// phải tìm thấy ngay buổi mình đang học). Không còn bài dở và đã hoàn thành buổi mở đầu → tự ẩn.
import { openedStageStart, pad2, requiredProgress, resumeSessionNo, sessionLabel, type ClassLearningState } from '../../classLearning/progress'

export default function NewStageEntry({ state, onOpenSession }: {
  state: Extract<ClassLearningState, { enabled: true }>
  onOpenSession: (sessionNo: number) => void
}) {
  const stage = openedStageStart(state)
  if (!stage) return null
  const resumeNo = resumeSessionNo(state)
  const resume = state.sessions.find(x => x.no === resumeNo) ?? null
  const newStage = !stage.completedAt
  if (!resume && !newStage) return null
  const done = resume ? requiredProgress(resume) : null
  return (
    <>
      {resume && done && (
        <section className="cs-card cs-newstage" aria-label="Bài bạn đang học">
          <p className="cs-newstage-title"><b>Bài bạn đang học</b></p>
          <p className="cs-newstage-note">{sessionLabel(resume)}{done.total > 0 ? ` · ${done.passed}/${done.total} bài trả đã Đạt` : ''}</p>
          <button type="button" className="cs-btn cs-btn-primary cs-btn-sm" onClick={() => onOpenSession(resume.no)}>Học tiếp Buổi {pad2(resume.no)}</button>
        </section>
      )}
      {newStage && (
        <section className="cs-card cs-newstage" aria-label="Chặng mới đã mở">
          <p className="cs-newstage-title"><b>{stage.stageNo != null ? `Chặng ${stage.stageNo} đã mở` : 'Chặng mới đã mở'}</b></p>
          <p className="cs-newstage-note">{sessionLabel(stage)}</p>
          <button type="button" className={'cs-btn cs-btn-sm ' + (resume ? 'cs-btn-ghost' : 'cs-btn-primary')} onClick={() => onOpenSession(stage.no)}>Vào Buổi {pad2(stage.no)}</button>
          {resume && <p className="cs-newstage-note">Tiến độ chặng trước vẫn được giữ.</p>}
        </section>
      )}
    </>
  )
}
