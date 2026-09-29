// ── Lớp đang học → lớp → Chặng → Buổi → Giáo trình (overlay toàn màn hình, có nút Đóng) ──
// Buổi nào mở được là do RLS trả về (membership + entitlement + published); client không suy quyền.
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import LessonDocument from '../lesson/LessonDocument'
import { fetchClassOutline, fetchSessionContent, type ClassOutlineData, type SessionContent } from './api'
import { groupOutline, toLessonDoc, type ClassRow, type OutlineLesson, type StageRow } from './outline'
import { CL } from './theme'

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('vi-VN',
  { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', day: '2-digit', month: '2-digit' })

export default function ClassLearningOverlay({ cls, onClose }: { cls: ClassRow; onClose: () => void }) {
  const [data, setData] = useState<ClassOutlineData | null>(null)
  const [error, setError] = useState(false)
  const [open, setOpen] = useState<{ lesson: OutlineLesson; stage: StageRow | null } | null>(null)
  const [content, setContent] = useState<SessionContent | null | 'loading' | 'error'>(null)

  const [tick, setTick] = useState(0)
  useEffect(() => {
    let cancelled = false
    fetchClassOutline(supabase, cls.id)
      .then(d => { if (!cancelled) { setData(d); setError(false) } })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [cls.id, tick])
  const load = () => { setError(false); setTick(t => t + 1) }

  const openLesson = async (lesson: OutlineLesson, stage: StageRow | null) => {
    setOpen({ lesson, stage }); setContent('loading')
    try { setContent(await fetchSessionContent(supabase, lesson.session.id)) } catch { setContent('error') }
  }

  if (open && content && content !== 'loading' && content !== 'error') {
    return <div style={{ position: 'fixed', inset: 0, zIndex: 80, overflowY: 'auto', background: '#F7F5FC' }}>
      <LessonDocument doc={toLessonDoc(cls, open.stage, open.lesson.session, content.sections)} onBack={() => { setOpen(null); setContent(null) }} />
    </div>
  }

  const outline = data ? groupOutline(data.stages, data.sessions, data.contents) : []
  return <div role="dialog" aria-label={cls.name} style={{ position: 'fixed', inset: 0, zIndex: 80, background: CL.bg, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
    <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 'calc(40px + env(safe-area-inset-bottom, 0px))' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 2, background: CL.bg, padding: 'max(18px, calc(env(safe-area-inset-top, 0px) + 10px)) 18px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onClose} aria-label="Đóng" style={{ border: 'none', background: CL.surface, borderRadius: 12, width: 40, height: 40, fontSize: 18, cursor: 'pointer', boxShadow: CL.shadow }}>←</button>
        <div style={{ minWidth: 0, textAlign: 'left' }}>
          <div style={{ fontSize: 11.5, fontWeight: 900, color: CL.a1, letterSpacing: '.06em' }}>LỚP ĐANG HỌC · {cls.code}</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: CL.t1, lineHeight: 1.2 }}>{cls.name}</div>
        </div>
      </div>

      {error && <div style={{ margin: '8px 18px', padding: 14, borderRadius: 16, background: CL.surface, color: CL.t2, display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ flex: 1 }}>Không tải được giáo trình lớp.</span>
        <button onClick={load}style={{ border: 'none', background: CL.a2, color: CL.a1, fontWeight: 800, borderRadius: 10, padding: '7px 12px' }}>Thử lại</button>
      </div>}
      {!data && !error && <div style={{ padding: '6px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[0, 1].map(i => <div key={i} style={{ height: 120, borderRadius: 20, background: CL.surface, opacity: .65 }} />)}
      </div>}
      {data && outline.length === 0 && <div style={{ margin: '8px 18px', padding: 18, borderRadius: 20, background: CL.surface, color: CL.t2, textAlign: 'center' }}>🌱 Lịch học của lớp sẽ hiện ở đây.</div>}

      {open && content === 'loading' && <div role="status" style={{ margin: '0 18px 10px', color: CL.t2, fontSize: 13.5 }}>Đang mở giáo trình Buổi {open.lesson.no}…</div>}
      {open && (content === 'error' || content === null) && <div role="alert" style={{ margin: '0 18px 10px', padding: 12, borderRadius: 14, background: CL.a2, color: CL.a1, fontSize: 13.5 }}>
        {content === 'error' ? 'Không mở được giáo trình. Thử lại sau nhé.' : `Giáo trình Buổi ${open.lesson.no} chưa mở cho bạn.`}</div>}

      {outline.map(g => <div key={g.stage?.id ?? 'loose'} style={{ margin: '6px 18px 16px', background: CL.surface, borderRadius: 20, boxShadow: CL.shadow, overflow: 'hidden', textAlign: 'left' }}>
        <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${CL.border}` }}>
          <div style={{ fontSize: 11.5, fontWeight: 900, color: CL.p1, letterSpacing: '.05em' }}>{g.stage ? `CHẶNG ${g.stage.stage_no}` : 'CÁC BUỔI KHÁC'}</div>
          {g.stage && <div style={{ fontSize: 16, fontWeight: 900, color: CL.t1, marginTop: 2 }}>{g.stage.public_title}</div>}
          {g.stage?.summary && <div style={{ fontSize: 13, color: CL.t2, marginTop: 4, lineHeight: 1.45 }}>{g.stage.summary}</div>}
        </div>
        {g.lessons.map(l => {
          const available = l.content !== null
          return <button key={l.session.id} disabled={!available} onClick={() => void openLesson(l, g.stage)} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', border: 'none',
            borderTop: `1px solid ${CL.border}`, background: 'transparent', textAlign: 'left', cursor: available ? 'pointer' : 'default', fontFamily: 'inherit',
          }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 13,
              background: available ? CL.p1 : CL.bg, color: available ? '#fff' : CL.t3 }}>{String(l.no).padStart(2, '0')}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: available ? CL.t1 : CL.t2, lineHeight: 1.3 }}>{l.title}</div>
              <div style={{ fontSize: 12, color: CL.t3, marginTop: 2 }}>
                {fmtDay(l.session.start_at)}{l.session.status === 'completed' ? ' · đã học' : ''}
                {l.content === 'draft' ? ' · Nháp (chỉ thầy thấy)' : ''}
              </div>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: available ? CL.a1 : CL.t3, whiteSpace: 'nowrap' }}>
              {available ? 'Giáo trình ›' : 'Chưa mở'}</div>
          </button>
        })}
      </div>)}
      {data && outline.some(g => g.lessons.some(l => l.content === null)) && <div style={{ margin: '0 22px', color: CL.t3, fontSize: 12.5, lineHeight: 1.5, textAlign: 'center' }}>
        Buổi “Chưa mở” sẽ có giáo trình khi thầy cập nhật và mở quyền Giáo trình cho bạn.</div>}
    </div>
  </div>
}
