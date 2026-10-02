// MỤC LỤC SỐNG (Class Page V2): HỌC + TRẢ BÀI trên CÙNG một bản đồ. Không card từng dòng, không CTA:
// hành động tự nhiên là bấm TÊN BUỔI → Trang Buổi sẵn có. Bấm "1/3 bài trả Đạt" → bung nhẹ 3 bài trả đó ngay tại chỗ;
// bài đã có thread → mở đúng cuộc trao đổi, bài chưa trả → mở Trang Buổi ở đúng bài trả.
// Chặng hiện tại mở sẵn; chặng khác thu gọn nhưng vẫn thấy tên + số buổi (không giấu con đường phía trước).
// Không tự cuộn tới buổi hiện tại — lần đầu hay lần thứ 20 đều thấy bản đồ từ đầu; buổi hiện tại chỉ được tô nhẹ.
// Thuần hiển thị (không mạng) → test render được.
import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { pad2, type ClassLearningState, type SessionState } from '../../classLearning/progress'
import { BreakDivider } from './LearnParts'
import type { LearningEntry } from './classesApi'
import { checkpointStatus, cpLabel, sessionView, stageGroups, stageLabel, submissionsText, type StageGroup } from './classMapModel'

type Ready = Extract<ClassLearningState, { enabled: true }>


function SessionItem({ s, state, current, expanded, onToggle, onOpenSession, onOpenThread }: {
  s: SessionState; state: Ready; current: boolean; expanded: boolean; onToggle: () => void
  onOpenSession: (no: number, checkpointId?: string) => void; onOpenThread: (id: string) => void
}) {
  const v = sessionView(s, state, current)
  const teacher = state.role === 'teacher'
  const title = `${pad2(s.no)} · ${s.title}`
  return (
    <li className={'cs-map-row' + (current ? ' is-current' : '') + (v.locked ? ' is-locked' : '')} id={`buoi-${pad2(s.no)}`}
      aria-current={current ? 'step' : undefined}>
      {v.locked
        ? <span className="cs-map-title">{title}</span>
        : <button type="button" className="cs-map-title" onClick={() => onOpenSession(s.no)}>{title}</button>}
      {(v.state || v.submissions) && (
        <div className="cs-map-meta">
          {v.locked && <span aria-hidden="true">🔒</span>}
          {v.state && <span className="cs-map-state">{v.state}</span>}
          {v.state && v.submissions && <span aria-hidden="true">·</span>}
          {v.submissions && (
            <button type="button" className="cs-map-subs" aria-expanded={expanded} onClick={onToggle}
              aria-label={`${submissionsText(v.submissions, teacher)} — ${expanded ? 'thu gọn' : 'xem từng bài trả'}`}>
              {!teacher && v.submissions.passed > 0 && <span aria-hidden="true">✓ </span>}
              {submissionsText(v.submissions, teacher)}
              {expanded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
            </button>
          )}
        </div>
      )}
      {expanded && v.submissions && (
        <ul className="cs-map-cps" aria-label={`Bài trả buổi ${pad2(s.no)}`}>
          {s.checkpoints.map(cp => {
            const st = checkpointStatus(cp.thread)
            const thread = cp.thread && cp.thread.status !== 'archived' ? cp.thread : null
            return (
              <li key={cp.id}>
                <button type="button" className="cs-map-cp" onClick={() => (thread ? onOpenThread(thread.id) : onOpenSession(s.no, cp.id))}>
                  <span className="cs-map-cp-name">{!teacher && <span className={'cs-map-mark is-' + st.tone} aria-hidden="true">{st.mark}</span>}{cpLabel(cp)}</span>
                  {!teacher && <span className={'cs-map-cp-status is-' + st.tone}>{st.label}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}

export default function ClassMap({ state, current, onOpenSession, onOpenThread }: {
  state: Ready
  /** buổi hiện tại (tô nhẹ) — do currentSessionNo() quyết, KHÔNG cuộn tới */
  current: number | null
  onOpenSession: (sessionNo: number, checkpointId?: string) => void
  onOpenThread: (threadId: string) => void
}) {
  const groups = useMemo(() => stageGroups(state.sessions), [state.sessions])
  const currentKey = (groups.find(g => g.sessions.some(s => s.no === current)) ?? groups[0])?.key
  const [open, setOpen] = useState<Set<string>>(() => new Set(currentKey ? [currentKey] : []))
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set())
  const flip = <T,>(set: (f: (x: Set<T>) => Set<T>) => void, k: T) => set(cur => {
    const next = new Set(cur); if (next.has(k)) next.delete(k); else next.add(k); return next
  })
  const single = groups.length === 1
  const list = (g: StageGroup) => (
    <ol className="cs-map-list" aria-label={stageLabel(g)}>
      {g.sessions.map(s => {
        const brk = state.breaks.find(b => b.beforeNo === s.no && s.no !== g.sessions[0].no)
        return [brk ? <BreakDivider key={'break-' + s.no} title={brk.title} /> : null,
          <SessionItem key={s.sessionId} s={s} state={state} current={s.no === current} expanded={expanded.has(s.no)}
            onToggle={() => flip(setExpanded, s.no)} onOpenSession={onOpenSession} onOpenThread={onOpenThread} />]
      })}
    </ol>
  )
  return (
    <div className="cs-map">
      {groups.map((g, gi) => {
        const isOpen = single || open.has(g.key)
        const next = groups[gi + 1]
        const brk = next ? state.breaks.find(b => b.beforeNo === next.sessions[0].no) : null
        return [
          <section key={g.key} className="cs-map-stage">
            {single && g.no == null
              ? null
              : single
                ? <h3 className="cs-map-stage-title">{stageLabel(g)}</h3>
                : (
                  <h3 className="cs-map-stage-title">
                    <button type="button" className="cs-map-stage-toggle" aria-expanded={isOpen} onClick={() => flip(setOpen, g.key)}>
                      {isOpen ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                      <span>{stageLabel(g)}</span>
                      <span className="cs-map-stage-count">{g.sessions.length} buổi</span>
                    </button>
                  </h3>
                )}
            {isOpen && list(g)}
          </section>,
          brk ? <ol key={'brk-' + g.key} className="cs-map-list"><BreakDivider title={brk.title} /></ol> : null,
        ]
      })}
      {state.breaks.filter(b => b.beforeNo == null).map(b => <ol key="break-end" className="cs-map-list"><BreakDivider title={b.title} /></ol>)}
    </div>
  )
}

/** B khi lớp KHÔNG có bản đồ giáo trình đọc được: nói thật tình trạng, không giả curriculum, không CTA lớn. */
export function NoMapNote({ entry, isMember }: { entry: LearningEntry | null | 'loading'; isMember: boolean }) {
  if (!isMember) return <p className="cs-map-note">Mục lục và bài trả hiện với thành viên của lớp.</p>
  if (entry === 'loading') return <p className="cs-map-note" role="status">Đang tải mục lục…</p>
  const course = entry?.course ?? null
  return (
    <div className="cs-map-nomap">
      {course && (course.hasAccess
        ? <a className="cs-map-title" href={`/course?id=${encodeURIComponent(course.id)}`}>{course.name}</a>
        : <span className="cs-map-title is-plain">{course.name}</span>)}
      {course && <p className="cs-map-meta">{course.hasAccess ? 'Mục lục khoá học của lớp' : 'Khoá học của lớp chưa mở cho bạn'}</p>}
      {entry?.curriculum.published && !entry.curriculum.hasAccess && <p className="cs-map-note">Giáo trình lớp chưa bật cho bạn.</p>}
      {!course && !entry?.curriculum.published && <p className="cs-map-note">Chưa có giáo trình được gắn với lớp này.</p>}
    </div>
  )
}

