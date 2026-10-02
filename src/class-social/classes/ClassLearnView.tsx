// TRANG LỚP (/me/classes/<id>) = TRUNG TÂM SINH HOẠT CỦA LỚP, không phải mục lục giáo trình. Thứ tự:
//   1. Tên lớp  2. ĐANG HỌC (buổi hiện tại + Tiếp tục học)  3. HOẠT ĐỘNG GẦN ĐÂY (social_class_activity)
//   4. GIÁO TRÌNH TÓM TẮT (chặng hiện tại: buổi hiện tại + buổi kế) → [Xem toàn bộ giáo trình] bung 24 buổi theo chặng.
// Không render giáo án ở đây (không tải blocks). Bấm một buổi → TRANG BUỔI (/me/classes/<id>/sessions/<n>).
// Buổi hiện tại do currentSessionNo() quyết (giáo trình: theo lịch · checkpoint: theo tiến độ server).
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight } from 'lucide-react'
import { currentSessionNo, pad2, sessionPhase, type SessionState } from '../../classLearning/progress'
import { useHistoryTab } from '../useHistoryTab'
import { BreakDivider, CurrentSessionBlock, SessionRowHead } from './LearnParts'
import { ClassRecentList } from './ClassActivity'
import { takeReturnSession, type LearnReady } from './useClassLearning'

const RECENT_COUNT = 5
const MAP_VIEWS = ['summary', 'full'] as const

type StageGroup = { key: string; no: number | null; title: string | null; sessions: SessionState[] }

/** Gom buổi theo chặng, giữ thứ tự (buổi không có chặng → một nhóm không tiêu đề). */
export function stageGroups(sessions: SessionState[]): StageGroup[] {
  const out: StageGroup[] = []
  for (const s of sessions) {
    const last = out[out.length - 1]
    if (last && last.no === s.stageNo) last.sessions.push(s)
    else out.push({ key: 'stage-' + (s.stageNo ?? 'x') + '-' + s.no, no: s.stageNo, title: s.stageTitle, sessions: [s] })
  }
  return out
}

export default function ClassLearnView({ state, onOpenSession, onOpenThread, onOpenClasses, onOpenCommunity }: {
  state: LearnReady
  onOpenSession: (sessionNo: number) => void
  onOpenThread: (id: string) => void
  onOpenProfile?: (userId: string) => void
  /** ← Lớp của tôi */
  onOpenClasses: () => void
  /** Xem tất cả hoạt động → phần cộng đồng của lớp (Hoạt động | Thành viên) */
  onOpenCommunity: () => void
}) {
  // Nhịp tuần tính theo giờ SERVER (không tin đồng hồ máy học viên)
  const now = useMemo(() => (state.serverNow ? new Date(state.serverNow) : new Date()), [state.serverNow])
  const current = currentSessionNo(state, now)
  const groups = useMemo(() => stageGroups(state.sessions), [state.sessions])
  const currentGroup = groups.find(g => g.sessions.some(s => s.no === current)) ?? groups[0] ?? null
  const [view, setView] = useHistoryTab<'summary' | 'full'>('csClassMap', 'summary', MAP_VIEWS)
  const [openStages, setOpenStages] = useState<Set<string>>(() => new Set(currentGroup ? [currentGroup.key] : []))

  // Về lại từ Trang Buổi: đưa ĐÚNG dòng buổi vừa xem vào giữa màn hình (bung giáo trình nếu buổi đó không nằm trong tóm tắt)
  const [returnNo] = useState(() => takeReturnSession(state.classId))
  const summary = useMemo(() => {
    if (!currentGroup) return []
    const i = currentGroup.sessions.findIndex(s => s.no === current)
    return currentGroup.sessions.slice(Math.max(i, 0), Math.max(i, 0) + 2)
  }, [currentGroup, current])
  useEffect(() => {
    if (!returnNo) return
    if (view === 'summary' && !summary.some(s => s.no === returnNo)) {
      setView('full')
      const g = groups.find(x => x.sessions.some(s => s.no === returnNo))
      if (g) setOpenStages(cur => new Set(cur).add(g.key))
    }
    requestAnimationFrame(() => document.getElementById(`buoi-${pad2(returnNo)}`)?.scrollIntoView({ block: 'center' }))
    // chỉ một lần khi mở trang
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const row = (s: SessionState) => (
    <li key={s.sessionId} className="cs-learn-item">
      <SessionRowHead s={s} role={state.role} mode={state.mode} now={now} paceDays={state.paceDays} expanded={false}
        current={s.no === current} disabled={sessionPhase(s, state.role, state.mode) === 'locked'} onToggle={() => onOpenSession(s.no)} />
    </li>
  )
  const toggleStage = (key: string) => setOpenStages(cur => {
    const next = new Set(cur)
    if (next.has(key)) next.delete(key); else next.add(key)
    return next
  })
  const stageLabel = (g: StageGroup) => `${g.no != null ? `Chặng ${g.no}` : 'Giáo trình'}${g.title ? ' · ' + g.title : ''}`

  return (
    <div className="cs-col cs-home cs-learn">
      <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm cs-profile-back" onClick={onOpenClasses}><ArrowLeft size={16} /> Lớp của tôi</button>
      <header className="cs-card cs-learn-head">
        <span className="cs-learn-kicker">{state.programCode}</span>
        <h1 className="cs-class-name">{state.className}</h1>
        {state.role === 'teacher' && (
          <p className="lt-note">Bạn đang xem với vai trò giáo viên: mọi buổi đều mở để xem trước.{state.classCode ? ` Mã lớp: ${state.classCode}.` : ''}</p>
        )}
      </header>

      <section className="cs-card cs-learn-now" aria-label="Đang học">
        <CurrentSessionBlock state={state} now={now} onOpenSession={onOpenSession} />
      </section>

      <section className="cs-card cs-learn-recent" aria-label="Hoạt động gần đây">
        <h2 className="cs-learn-recent-title">Hoạt động gần đây</h2>
        <ClassRecentList classId={state.classId} limit={RECENT_COUNT} onOpenThread={onOpenThread} emptyText="Chưa có hoạt động nào. Bài trả của các bạn cùng lớp sẽ hiện ở đây." />
        <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm cs-learn-more" onClick={onOpenCommunity}>
          Xem tất cả hoạt động <ArrowRight size={16} />
        </button>
      </section>

      <section className="cs-learn-curriculum" aria-labelledby="cs-curr-title">
        <h2 id="cs-curr-title" className="cs-learn-recent-title">Giáo trình</h2>
        {view === 'summary' && currentGroup && (
          <>
            <p className="cs-learn-stage-sum">{stageLabel(currentGroup)} · {currentGroup.sessions.length} buổi</p>
            <ol className="cs-learn-map is-summary" aria-label="Giáo trình tóm tắt">{summary.map(row)}</ol>
          </>
        )}
        {view === 'full' && (
          <div className="cs-learn-stages" aria-label="Toàn bộ giáo trình">
            {groups.map((g, gi) => {
              const open = openStages.has(g.key)
              const next = groups[gi + 1]
              const brk = next ? state.breaks.find(b => b.beforeNo === next.sessions[0].no) : null
              return [
                <section key={g.key} className="cs-learn-stage-group">
                  <button type="button" className="cs-learn-stage-toggle" aria-expanded={open} onClick={() => toggleStage(g.key)}>
                    {open ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
                    <span>{stageLabel(g)}</span>
                    <span className="cs-learn-stage-count">{g.sessions.length} buổi</span>
                  </button>
                  {open && (
                    <ol className="cs-learn-map" aria-label={stageLabel(g)}>
                      {g.sessions.map(s => {
                        const inner = state.breaks.find(b => b.beforeNo === s.no && s.no !== g.sessions[0].no)
                        return [inner ? <BreakDivider key={'break-' + s.no} title={inner.title} /> : null, row(s)]
                      })}
                    </ol>
                  )}
                </section>,
                brk ? <ol key={'brk-' + g.key} className="cs-learn-breaks"><BreakDivider title={brk.title} /></ol> : null,
              ]
            })}
            {state.breaks.filter(b => b.beforeNo == null).map(b => <ol key="break-end" className="cs-learn-breaks"><BreakDivider title={b.title} /></ol>)}
          </div>
        )}
        <button type="button" className="cs-btn cs-btn-soft cs-btn-sm cs-learn-all" aria-expanded={view === 'full'}
          onClick={() => setView(view === 'full' ? 'summary' : 'full')}>
          {view === 'full' ? 'Thu gọn giáo trình' : 'Xem toàn bộ giáo trình'}
        </button>
      </section>
    </div>
  )
}
