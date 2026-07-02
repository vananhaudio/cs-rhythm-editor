// ── JOURNEY OS — Calendar tuần (view mặc định) ──
// Cột theo ngày (T2..CN). Mỗi buổi = 1 khối, màu theo trạng thái LỚP. Click khối → đánh dấu buổi.
import { useState, type CSSProperties } from 'react'
import { supabase } from '../supabase'
import { statusInfo, type SessionRow } from './sessions'
import type { ClassLite } from './ScheduleDashboard'

const S = { surface: '#FFFFFF', border: '#E4E4E7', text1: '#18181B', text2: '#52525B', text3: '#A1A1AA', accent: '#4F46E5', bg: '#F4F4F5' }
const DOW = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const startOfWeek = (d: Date) => { const x = startOfDay(d); const off = (x.getDay() + 6) % 7; x.setDate(x.getDate() - off); return x }
const hm = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }

// Trạng thái buổi có thể đổi nhanh khi click
const SESS_STATUS: { v: string; l: string }[] = [
  { v: 'scheduled', l: 'Theo lịch' },
  { v: 'completed', l: '✓ Đã dạy' },
  { v: 'cancelled', l: 'Huỷ buổi' },
  { v: 'rescheduled', l: 'Dời buổi' },
  { v: 'makeup', l: 'Buổi bù' },
  { v: 'holiday', l: 'Nghỉ lễ' },
]

interface FlatSess extends SessionRow { class_id: string }

export default function CalendarWeek({ classes, sessById, onChanged }: {
  classes: ClassLite[]; sessById: Record<string, FlatSess[] | SessionRow[]>; onChanged: () => void
}) {
  const [offset, setOffset] = useState(0)
  const [sel, setSel] = useState<{ cid: string; s: SessionRow } | null>(null)
  const [busy, setBusy] = useState(false)

  const clsById: Record<string, ClassLite> = {}
  for (const c of classes) clsById[c.id] = c

  const wkStart = startOfWeek(new Date()); wkStart.setDate(wkStart.getDate() + offset * 7)
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(wkStart); d.setDate(d.getDate() + i); return d })
  const todayKey = startOfDay(new Date()).getTime()

  // gom buổi trong tuần theo ngày
  const flat: FlatSess[] = []
  for (const [cid, arr] of Object.entries(sessById)) for (const s of arr) flat.push({ ...s, class_id: cid } as FlatSess)
  const wkStartT = startOfDay(wkStart).getTime()
  const wkEndT = wkStartT + 7 * 86400000
  const inWeek = flat.filter(s => { const t = new Date(s.start_at).getTime(); return t >= wkStartT && t < wkEndT })

  const setSessStatus = async (status: string) => {
    if (!sel) return
    setBusy(true)
    await supabase.from('class_sessions').update({ status }).eq('class_id', sel.cid).eq('session_number', sel.s.session_number)
    setBusy(false); setSel(null); onChanged()
  }

  const label = (dt: Date) => `${dt.getDate()}/${dt.getMonth() + 1}`
  const col: CSSProperties = { flex: 1, minWidth: 0, borderRight: `1px solid ${S.border}` }

  return (
    <div>
      {/* Thanh điều hướng tuần */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button onClick={() => setOffset(o => o - 1)} style={navBtn}>◀</button>
        <button onClick={() => setOffset(0)} style={{ ...navBtn, fontWeight: 700, color: offset === 0 ? S.accent : S.text2 }}>Tuần này</button>
        <button onClick={() => setOffset(o => o + 1)} style={navBtn}>▶</button>
        <div style={{ fontSize: 13.5, color: S.text2, fontWeight: 600 }}>
          {label(days[0])} – {label(days[6])}/{days[6].getFullYear()}
        </div>
      </div>

      {/* Lưới 7 cột */}
      <div style={{ display: 'flex', background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {days.map((d, i) => {
          const isToday = startOfDay(d).getTime() === todayKey
          const dayS = inWeek
            .filter(s => startOfDay(new Date(s.start_at)).getTime() === startOfDay(d).getTime())
            .sort((a, b) => a.start_at.localeCompare(b.start_at))
          return (
            <div key={i} style={{ ...col, borderRight: i === 6 ? 'none' : col.borderRight }}>
              <div style={{ textAlign: 'center', padding: '8px 4px', borderBottom: `1px solid ${S.border}`, background: isToday ? '#EEF2FF' : '#FAFAFA' }}>
                <div style={{ fontSize: 11, color: S.text3, fontWeight: 700 }}>{DOW[i]}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: isToday ? S.accent : S.text1 }}>{d.getDate()}</div>
              </div>
              <div style={{ padding: 5, minHeight: 90, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {dayS.map((s, j) => {
                  const cls = clsById[s.class_id]
                  const si = statusInfo(cls?.status)
                  const done = s.status === 'completed'
                  const cancelled = s.status === 'cancelled'
                  const draft = cls?.status === 'draft'
                  return (
                    <button key={j} onClick={() => setSel({ cid: s.class_id, s })}
                      title={cls?.name}
                      style={{
                        textAlign: 'left', borderRadius: 6, cursor: 'pointer',
                        border: draft ? `1px dashed ${si.c}` : 'none', borderLeft: `3px solid ${si.c}`,
                        padding: '5px 7px', background: cancelled ? '#FEF2F2' : done ? '#F0FDF4' : draft ? '#FAFAFA' : `${si.c}14`,
                        opacity: cancelled ? 0.6 : draft ? 0.8 : 1, fontFamily: 'inherit', width: '100%',
                        textDecoration: cancelled ? 'line-through' : 'none',
                      }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: S.text1 }}>{hm(s.start_at)} · {cls?.code || cls?.name || '—'}</div>
                      <div style={{ fontSize: 10.5, color: S.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {cls?.mainCourseName || cls?.name}
                      </div>
                      <div style={{ fontSize: 10, color: S.text3, marginTop: 1 }}>
                        buổi {s.session_number}/{cls?.total_sessions ?? '?'}{done ? ' · ✓' : cancelled ? ' · huỷ' : ''}
                      </div>
                    </button>
                  )
                })}
                {!dayS.length && <div style={{ fontSize: 10.5, color: '#D4D4D8', textAlign: 'center', paddingTop: 14 }}>—</div>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Popup đánh dấu buổi */}
      {sel && (
        <div onClick={() => setSel(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: S.surface, borderRadius: 14, padding: 20, width: 320, boxShadow: '0 10px 40px rgba(0,0,0,.2)' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: S.text1 }}>{clsById[sel.cid]?.code || clsById[sel.cid]?.name}</div>
            <div style={{ fontSize: 13, color: S.text2, marginTop: 2 }}>Buổi {sel.s.session_number}/{clsById[sel.cid]?.total_sessions} · {hm(sel.s.start_at)}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
              {SESS_STATUS.map(ss => (
                <button key={ss.v} disabled={busy} onClick={() => setSessStatus(ss.v)}
                  style={{ padding: '9px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                    border: `1px solid ${sel.s.status === ss.v ? S.accent : S.border}`,
                    background: sel.s.status === ss.v ? '#EEF2FF' : '#fff', color: sel.s.status === ss.v ? S.accent : S.text2 }}>
                  {ss.l}
                </button>
              ))}
            </div>
            <button onClick={() => setSel(null)} style={{ marginTop: 12, width: '100%', padding: '8px', borderRadius: 8, border: `1px solid ${S.border}`, background: '#fff', color: S.text2, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>Đóng</button>
          </div>
        </div>
      )}
    </div>
  )
}

const navBtn: CSSProperties = { background: '#fff', border: `1px solid ${S.border}`, borderRadius: 8, padding: '6px 12px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', color: S.text2 }
