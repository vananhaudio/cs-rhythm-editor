// Phần hiển thị THUẦN của màn HỌC trong lớp (Lớp của tôi V1) — không mạng, không import CSS → test render được.
// Sơ đồ DỌC: mỗi buổi một dòng "Buổi 01 · Tiêu đề" (thu gọn); bài trả hiện trạng thái + nút NGAY tại checkpoint.
import type { ReactNode } from 'react'
import { checkpointUi, lockedHint, pad2, requiredProgress, sessionBadge, sessionPace, sessionPhase, PACE_DOT,
  type CheckpointState, type LearnMode, type SessionState } from '../../classLearning/progress'

export function SessionRowHead({ s, role, now, paceDays, expanded, current, onToggle, mode = 'checkpoint' }: {
  s: SessionState
  role: 'learner' | 'teacher'
  mode?: LearnMode
  now: Date
  paceDays: number
  expanded: boolean
  current: boolean
  onToggle: () => void
}) {
  const phase = sessionPhase(s, role, mode)
  const badge = sessionBadge(s, role, now, paceDays, mode)
  return (
    <button type="button" className={'cs-learn-row is-' + phase + (current ? ' is-current' : '') + (s.published ? '' : ' is-pending')} aria-expanded={expanded}
      onClick={onToggle} id={`buoi-${pad2(s.no)}`}>
      <span className="cs-learn-dot" aria-hidden="true">{phase === 'done' ? '✓' : phase === 'locked' ? '' : pad2(s.no)}</span>
      <span className="cs-learn-row-main">
        <span className="cs-learn-row-title">Buổi {pad2(s.no)} · {s.title}</span>
        {badge && <span className="cs-learn-row-badge">{badge}</span>}
      </span>
    </button>
  )
}

/** Dòng tình trạng đầu buổi đang mở: nhịp tuần + số bài trả bắt buộc đã Đạt. */
export function SessionStatusLine({ s, now, paceDays }: { s: SessionState; now: Date; paceDays: number }) {
  const pace = sessionPace(s, now, paceDays)
  const req = requiredProgress(s)
  const parts: ReactNode[] = []
  if (s.completedAt) parts.push(<b key="d">Đã hoàn thành buổi này</b>)
  if (pace) parts.push(<span key="p" className={'cs-learn-pace is-' + pace.tone}>{PACE_DOT[pace.tone] ? PACE_DOT[pace.tone] + ' ' : ''}{pace.label}</span>)
  if (req.total > 0) parts.push(<span key="r">{req.passed}/{req.total} bài trả bắt buộc đã Đạt</span>)
  if (!parts.length) return null
  return <p className="cs-learn-status">{parts.reduce<ReactNode[]>((a, p, i) => (i ? [...a, <span key={'s' + i} aria-hidden="true"> · </span>, p] : [p]), [])}</p>
}

/** Dòng nghỉ: vạch ngăn nhẹ trên đường dọc — không số buổi, không mở được. */
export function BreakDivider({ title }: { title: string }) {
  return <li className="cs-learn-break" role="separator" aria-label={title}><span>{title}</span></li>
}

export function LockedNote({ sessions, s }: { sessions: SessionState[]; s: SessionState }) {
  return <p className="cs-learn-locked">🔒 {lockedHint(sessions, s)}.</p>
}

/** Trạng thái + hành động tại checkpoint (người học). Composer do container cắm vào khi đang soạn. */
export function CheckpointStatusView({ cp, supported, onSubmit, onView, composer }: {
  cp: CheckpointState | null
  /** loại nộp của checkpoint có chạy được ở V1 không (text / link video) */
  supported: boolean
  onSubmit: () => void
  onView: (threadId: string) => void
  composer?: ReactNode
}) {
  if (!cp) return <p className="lt-note">Bài trả này chưa sẵn sàng. Hãy tải lại trang.</p>
  if (!supported) return <p className="lt-note">Bài trả này sẽ mở khi có công cụ nộp bài phù hợp.</p>
  const ui = checkpointUi(cp.thread)
  return (
    <div className="cs-learn-cp">
      {ui.chip && <span className={'lt-chip is-' + ui.chip.tone}>{ui.chip.label}</span>}
      {composer ?? (
        <div className="lt-actions">
          {ui.submit && (
            <button type="button" className="lt-btn is-primary" onClick={onSubmit}>{ui.submit === 'first' ? 'TRẢ BÀI' : 'TRẢ LẠI'}</button>
          )}
          {ui.canView && cp.thread && (
            <button type="button" className={'lt-btn' + (ui.submit ? ' is-ghost' : '')} onClick={() => onView(cp.thread!.id)}>Xem cuộc trao đổi</button>
          )}
        </div>
      )}
    </div>
  )
}
