// MỤC LỤC SỐNG (Class UX V3): HỌC + TRẢ BÀI trên CÙNG một bản đồ. Không card từng dòng, không CTA:
// hành động tự nhiên là bấm TÊN BUỔI → Trang Buổi sẵn có (con đường mòn không đổi).
//   • layout 'inline' (mobile / vùng hẹp): bấm "1/3 bài trả Đạt" → bung các bài trả NGAY TẠI CHỖ.
//   • layout 'side' (desktop rộng): bấm "1/3 bài trả Đạt" → CHỌN buổi đó cho panel "Bài trả của tôi" bên phải
//     (diễn giải rộng hơn của chính mục lục — không phải navigation bắt buộc).
// Cột số 01/02/… tách khỏi tên buổi để scan. Buổi khoá: chữ nhạt + ổ khoá (chữ "Chưa mở" cho trình đọc màn hình);
// CHỈ buổi khoá đầu tiên ghi một câu ngắn — không lặp "Chưa mở" từng dòng. Dấu chân hiện tại: vạch xám rất nhẹ.
// Không tự cuộn. Thuần hiển thị (không mạng) → test render được.
import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Lock } from 'lucide-react'
import { lockedHint, pad2, type ClassLearningState, type SessionState } from '../../classLearning/progress'
import { BreakDivider } from './LearnParts'
import type { LearningEntry } from './classesApi'
import { checkpointStatus, cpLabel, sessionView, stageGroups, stageLabel, submissionsText, type StageGroup } from './classMapModel'

type Ready = Extract<ClassLearningState, { enabled: true }>
export type MapLayout = 'inline' | 'side'

/** Danh sách bài trả của MỘT buổi (dùng chung: bung tại chỗ trên mobile · panel phải trên desktop). */
export function SubmissionList({ s, teacher, onOpenSession, onOpenThread, label }: {
  s: SessionState; teacher: boolean; label: string
  onOpenSession: (no: number, checkpointId?: string) => void; onOpenThread: (id: string) => void
}) {
  return (
    <ul className="cs-map-cps" aria-label={label}>
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
  )
}

function SessionItem({ s, state, current, layout, open, firstLocked, onToggle, onOpenSession, onOpenThread }: {
  s: SessionState; state: Ready; current: boolean; layout: MapLayout
  /** inline: đang bung · side: đang được chọn cho panel phải */
  open: boolean
  /** buổi khoá ĐẦU TIÊN của bản đồ → một câu gợi ý ngắn (các buổi khoá sau chỉ có ổ khoá) */
  firstLocked: boolean
  onToggle: () => void
  onOpenSession: (no: number, checkpointId?: string) => void; onOpenThread: (id: string) => void
}) {
  const v = sessionView(s, state)
  const teacher = state.role === 'teacher'
  const meta = v.locked ? (firstLocked ? lockedHint(state.sessions, s) : '') : v.state
  return (
    <li className={'cs-map-row' + (current ? ' is-current' : '') + (v.locked ? ' is-locked' : '') + (layout === 'side' && open ? ' is-selected' : '')}
      id={`buoi-${pad2(s.no)}`} aria-current={current ? 'step' : undefined}>
      <span className="cs-map-no" aria-hidden="true">{pad2(s.no)}</span>
      <div className="cs-map-body">
        {v.locked
          ? <span className="cs-map-title"><span className="cs-sr-only">Buổi {pad2(s.no)}: </span>{s.title}
              <Lock size={13} className="cs-map-lock" aria-hidden="true" /><span className="cs-sr-only"> — Chưa mở</span></span>
          : <button type="button" className="cs-map-title" onClick={() => onOpenSession(s.no)}><span className="cs-sr-only">Buổi {pad2(s.no)}: </span>{s.title}</button>}
        {(meta || v.submissions) && (
          <div className="cs-map-meta">
            {meta && <span className="cs-map-state">{meta}</span>}
            {meta && v.submissions && <span aria-hidden="true">·</span>}
            {v.submissions && (layout === 'side'
              ? <button type="button" className="cs-map-subs" aria-pressed={open} aria-controls="cs-subs-panel" onClick={onToggle}
                  aria-label={`${submissionsText(v.submissions, teacher)} — xem bài trả buổi ${pad2(s.no)} bên cạnh`}>
                  {!teacher && v.submissions.passed > 0 && <span aria-hidden="true">✓ </span>}
                  {submissionsText(v.submissions, teacher)}
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              : <button type="button" className="cs-map-subs" aria-expanded={open} onClick={onToggle}
                  aria-label={`${submissionsText(v.submissions, teacher)} — ${open ? 'thu gọn' : 'xem từng bài trả'}`}>
                  {!teacher && v.submissions.passed > 0 && <span aria-hidden="true">✓ </span>}
                  {submissionsText(v.submissions, teacher)}
                  {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                </button>)}
          </div>
        )}
        {layout === 'inline' && open && v.submissions && (
          <SubmissionList s={s} teacher={teacher} label={`Bài trả buổi ${pad2(s.no)}`} onOpenSession={onOpenSession} onOpenThread={onOpenThread} />
        )}
      </div>
    </li>
  )
}

export default function ClassMap({ state, current, onOpenSession, onOpenThread, layout = 'inline', selected = null, onSelect }: {
  state: Ready
  /** buổi hiện tại (dấu chân nhẹ) — do currentSessionNo() quyết, KHÔNG cuộn tới */
  current: number | null
  onOpenSession: (sessionNo: number, checkpointId?: string) => void
  onOpenThread: (threadId: string) => void
  layout?: MapLayout
  /** layout 'side': buổi đang diễn giải ở panel phải */
  selected?: number | null
  onSelect?: (sessionNo: number) => void
}) {
  const groups = useMemo(() => stageGroups(state.sessions), [state.sessions])
  const currentKey = (groups.find(g => g.sessions.some(s => s.no === current)) ?? groups[0])?.key
  const [open, setOpen] = useState<Set<string>>(() => new Set(currentKey ? [currentKey] : []))
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set())
  const flip = <T,>(set: (f: (x: Set<T>) => Set<T>) => void, k: T) => set(cur => {
    const next = new Set(cur); if (next.has(k)) next.delete(k); else next.add(k); return next
  })
  const firstLockedNo = state.sessions.find(x => sessionView(x, state).locked)?.no ?? null
  const single = groups.length === 1
  const list = (g: StageGroup) => (
    <ol className="cs-map-list" aria-label={stageLabel(g)}>
      {g.sessions.map(s => {
        const brk = state.breaks.find(b => b.beforeNo === s.no && s.no !== g.sessions[0].no)
        return [brk ? <BreakDivider key={'break-' + s.no} title={brk.title} /> : null,
          <SessionItem key={s.sessionId} s={s} state={state} current={s.no === current} layout={layout} firstLocked={s.no === firstLockedNo}
            open={layout === 'side' ? selected === s.no : expanded.has(s.no)}
            onToggle={() => (layout === 'side' ? onSelect?.(s.no) : flip(setExpanded, s.no))}
            onOpenSession={onOpenSession} onOpenThread={onOpenThread} />]
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

