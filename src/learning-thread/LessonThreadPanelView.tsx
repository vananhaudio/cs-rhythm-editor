// Phần hiển thị THUẦN của khu vực Trả bài / Hỏi bài trong bài học (không mạng, không CSS import) — test được.
import { ctaTitle, isEnabled, studentActions, type LessonThreadState, type StudentAction } from './ltModel'
import { StatusChip } from './ThreadView'

/** Phần hiển thị THUẦN (không mạng) — test được bằng renderToStaticMarkup. */
export function LessonThreadPanelView({ state, compact = false, onAction }: {
  state: LessonThreadState
  compact?: boolean
  onAction: (a: StudentAction) => void
}) {
  if (!isEnabled(state)) return null
  const actions = studentActions(state)
  return (
    <section className={'lt-panel' + (compact ? ' is-compact' : '')} aria-label={ctaTitle(state)}>
      <div className="lt-panel-head">
        {!compact && <span className="lt-panel-title">{ctaTitle(state)}</span>}
        {state.submission === 'required' && <span className="lt-badge is-required">Bài này cần Trả bài</span>}
        {state.thread && <StatusChip status={state.thread.status} />}
      </div>
      {!compact && state.prompt && <p className="lt-prompt">{state.prompt}</p>}
      <div className="lt-actions">
        {actions.map(a => (
          <button key={a.id} type="button" className={'lt-btn' + (a.primary ? ' is-primary' : '')} onClick={() => onAction(a)}>
            {a.label}
          </button>
        ))}
      </div>
      {!compact && !state.thread && <p className="lt-note">Gửi ngay tại bài này — Thầy biết bạn đang học bài nào.</p>}
    </section>
  )
}

