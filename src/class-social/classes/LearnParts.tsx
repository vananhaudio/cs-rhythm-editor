// Phần hiển thị THUẦN của màn HỌC trong lớp (Lớp của tôi V1) — không mạng, không import CSS → test render được.
// Sơ đồ DỌC: mỗi buổi một dòng "Buổi 01 · Tiêu đề" (thu gọn); bài trả hiện trạng thái + nút NGAY tại checkpoint.
import type { ReactNode } from 'react'
import { checkpointUi, currentSessionNo, lockedHint, pad2, requiredProgress, sessionBadge, sessionLabel, sessionPace, sessionPhase, PACE_DOT,
  type CheckpointState, type ClassLearningState, type LearnMode, type SessionState } from '../../classLearning/progress'

export function SessionRowHead({ s, role, now, paceDays, expanded, current, onToggle, mode = 'checkpoint', disabled = false }: {
  s: SessionState
  role: 'learner' | 'teacher'
  mode?: LearnMode
  /** buổi khoá với người học: thấy trên bản đồ nhưng không vào học */
  disabled?: boolean
  now: Date
  paceDays: number
  expanded: boolean
  current: boolean
  onToggle: () => void
}) {
  const phase = sessionPhase(s, role, mode)
  const badge = sessionBadge(s, role, now, paceDays, mode)
  return (
    <button type="button" className={'cs-learn-row is-' + phase + (current ? ' is-current' : '') + (s.published ? '' : ' is-pending')} aria-current={current ? 'step' : undefined} data-selected={expanded || undefined}
      disabled={disabled} aria-disabled={disabled || undefined} onClick={onToggle} id={`buoi-${pad2(s.no)}`}>
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

/** ĐANG HỌC: buổi hiện tại + trạng thái + [Tiếp tục học] — đầu Trang Lớp và trong mỗi lớp ở "Lớp của tôi".
 *  Buổi hiện tại do currentSessionNo() quyết (giáo trình: theo lịch · checkpoint: theo tiến độ server). */
export function CurrentSessionBlock({ state, now, onOpenSession, compact = false }: {
  state: Extract<ClassLearningState, { enabled: true }>
  now: Date
  onOpenSession: (sessionNo: number) => void
  compact?: boolean
}) {
  const no = currentSessionNo(state, now)
  const s = state.sessions.find(x => x.no === no) ?? null
  if (!s) return <p className="cs-now-empty">Lớp chưa có buổi học nào được xuất bản.</p>
  const teacher = state.role === 'teacher'
  const status = teacher ? 'Giáo viên xem trước'
    : state.mode === 'curriculum' ? 'Buổi hiện tại'
    : sessionBadge(s, state.role, now, state.paceDays, state.mode) || 'Đang học'
  const req = state.mode === 'checkpoint' && !teacher ? requiredProgress(s) : null
  return (
    <div className={'cs-now' + (compact ? ' is-compact' : '')}>
      {!compact && <span className="cs-now-kicker">Đang học</span>}
      <span className="cs-now-title">{sessionLabel(s)}</span>
      <span className="cs-now-status">
        {status}{req && req.total > 0 ? ` · ${req.passed}/${req.total} bài trả bắt buộc đã Đạt` : ''}
      </span>
      <button type="button" className="cs-btn cs-btn-primary cs-now-go" onClick={() => onOpenSession(s.no)}>
        {teacher ? 'Mở buổi hiện tại' : 'Tiếp tục học'}
      </button>
    </div>
  )
}
