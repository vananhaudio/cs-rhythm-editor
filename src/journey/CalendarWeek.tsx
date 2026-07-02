// ── JOURNEY OS — Lịch đa chế độ: Tuần · Tháng · Năm ──
// Buổi = 1 khối/chip, màu theo trạng thái LỚP. Click buổi → đánh dấu (đã dạy/huỷ/dời/bù/nghỉ).
import { useState, type CSSProperties } from 'react'
import { supabase } from '../supabase'
import { statusInfo, type SessionRow } from './sessions'
import type { ClassLite } from './ScheduleDashboard'

const S = { surface: '#FFFFFF', border: '#E4E4E7', text1: '#18181B', text2: '#52525B', text3: '#A1A1AA', accent: '#4F46E5', accentLight: '#EEF2FF', bg: '#F4F4F5' }
const DOW = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const DAY = 86400000

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const startOfWeek = (d: Date) => { const x = startOfDay(d); const off = (x.getDay() + 6) % 7; x.setDate(x.getDate() - off); return x }
const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime()
const hm = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }

const SESS_STATUS: { v: string; l: string }[] = [
  { v: 'scheduled', l: 'Theo lịch' }, { v: 'completed', l: '✓ Đã dạy' }, { v: 'cancelled', l: 'Huỷ buổi' },
  { v: 'rescheduled', l: 'Dời buổi' }, { v: 'makeup', l: 'Buổi bù' }, { v: 'holiday', l: 'Nghỉ lễ' },
]

interface FlatSess extends SessionRow { class_id: string }
type Mode = 'week' | 'month' | 'year'

export default function CalendarWeek({ classes, sessById, onChanged }: {
  classes: ClassLite[]; sessById: Record<string, FlatSess[] | SessionRow[]>; onChanged: () => void
}) {
  const [mode, setMode] = useState<Mode>('week')
  const [cursor, setCursor] = useState<Date>(startOfDay(new Date()))
  const [sel, setSel] = useState<{ cid: string; s: SessionRow } | null>(null)
  const [busy, setBusy] = useState(false)

  const clsById: Record<string, ClassLite> = {}
  for (const c of classes) clsById[c.id] = c
  const today = startOfDay(new Date())

  // tất cả buổi (phẳng)
  const flat: FlatSess[] = []
  for (const [cid, arr] of Object.entries(sessById)) for (const s of arr) flat.push({ ...s, class_id: cid } as FlatSess)
  const sessionsOn = (d: Date) => flat.filter(s => sameDay(new Date(s.start_at), d)).sort((a, b) => a.start_at.localeCompare(b.start_at))
  const countIn = (from: number, to: number) => flat.filter(s => { const t = new Date(s.start_at).getTime(); return t >= from && t < to && s.status !== 'cancelled' }).length

  const setSessStatus = async (status: string) => {
    if (!sel) return
    setBusy(true)
    await supabase.from('class_sessions').update({ status }).eq('class_id', sel.cid).eq('session_number', sel.s.session_number)
    setBusy(false); setSel(null); onChanged()
  }

  // điều hướng theo chế độ
  const nav = (dir: number) => setCursor(c => {
    const n = new Date(c)
    if (mode === 'week') n.setDate(n.getDate() + dir * 7)
    else if (mode === 'month') n.setMonth(n.getMonth() + dir)
    else n.setFullYear(n.getFullYear() + dir)
    return n
  })
  const title = mode === 'week'
    ? (() => { const w = startOfWeek(cursor); const e = new Date(w); e.setDate(e.getDate() + 6); return `${w.getDate()}/${w.getMonth() + 1} – ${e.getDate()}/${e.getMonth() + 1}/${e.getFullYear()}` })()
    : mode === 'month' ? `Tháng ${cursor.getMonth() + 1}/${cursor.getFullYear()}` : `Năm ${cursor.getFullYear()}`

  const navBtn: CSSProperties = { background: '#fff', border: `1px solid ${S.border}`, borderRadius: 8, padding: '6px 12px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', color: S.text2 }
  const segBtn = (m: Mode, l: string) => (
    <button key={m} onClick={() => setMode(m)} style={{ border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: mode === m ? '#fff' : 'transparent', color: mode === m ? S.accent : S.text2, boxShadow: mode === m ? '0 1px 2px rgba(0,0,0,.08)' : 'none' }}>{l}</button>
  )

  // khối buổi (dùng cho tuần & popup)
  const sessBlock = (s: FlatSess, compact: boolean) => {
    const cls = clsById[s.class_id]; const si = statusInfo(cls?.status)
    const done = s.status === 'completed', cancelled = s.status === 'cancelled', draft = cls?.status === 'draft'
    return (
      <button key={s.class_id + s.session_number} onClick={() => setSel({ cid: s.class_id, s })} title={cls?.name}
        style={{ textAlign: 'left', borderRadius: 6, cursor: 'pointer', border: draft ? `1px dashed ${si.c}` : 'none', borderLeft: `3px solid ${si.c}`,
          padding: compact ? '2px 5px' : '5px 7px', background: cancelled ? '#FEF2F2' : done ? '#F0FDF4' : draft ? '#FAFAFA' : `${si.c}14`,
          opacity: cancelled ? 0.6 : draft ? 0.85 : 1, fontFamily: 'inherit', width: '100%', textDecoration: cancelled ? 'line-through' : 'none' }}>
        <div style={{ fontSize: compact ? 10 : 11, fontWeight: 800, color: S.text1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hm(s.start_at)} · {cls?.code || cls?.name || '—'}</div>
        {!compact && <>
          <div style={{ fontSize: 10.5, color: S.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cls?.mainCourseName || cls?.name}</div>
          <div style={{ fontSize: 10, color: S.text3, marginTop: 1 }}>buổi {s.session_number}/{cls?.total_sessions ?? '?'}{done ? ' · ✓' : cancelled ? ' · huỷ' : ''}</div>
        </>}
      </button>
    )
  }

  return (
    <div>
      {/* Thanh điều hướng + chuyển chế độ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 3, background: S.bg, borderRadius: 9, padding: 3 }}>
          {segBtn('week', 'Tuần')}{segBtn('month', 'Tháng')}{segBtn('year', 'Năm')}
        </div>
        <button onClick={() => nav(-1)} style={navBtn}>◀</button>
        <button onClick={() => setCursor(startOfDay(new Date()))} style={{ ...navBtn, fontWeight: 700, color: S.accent }}>Hôm nay</button>
        <button onClick={() => nav(1)} style={navBtn}>▶</button>
        <div style={{ fontSize: 14, color: S.text1, fontWeight: 700 }}>{title}</div>
      </div>

      {mode === 'week' && <WeekView cursor={cursor} today={today} sessionsOn={sessionsOn} sessBlock={sessBlock} />}
      {mode === 'month' && <MonthView cursor={cursor} today={today} sessionsOn={sessionsOn} clsById={clsById} onPick={(cid, s) => setSel({ cid, s })} />}
      {mode === 'year' && <YearView cursor={cursor} today={today} flat={flat} countIn={countIn} onOpenMonth={(d) => { setCursor(d); setMode('month') }} />}

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
                    border: `1px solid ${sel.s.status === ss.v ? S.accent : S.border}`, background: sel.s.status === ss.v ? '#EEF2FF' : '#fff', color: sel.s.status === ss.v ? S.accent : S.text2 }}>
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

// ── VIEW: TUẦN ──
function WeekView({ cursor, today, sessionsOn, sessBlock }: {
  cursor: Date; today: Date; sessionsOn: (d: Date) => FlatSess[]; sessBlock: (s: FlatSess, c: boolean) => any
}) {
  const wkStart = startOfWeek(cursor)
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(wkStart); d.setDate(d.getDate() + i); return d })
  return (
    <div style={{ display: 'flex', background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, overflow: 'auto' }}>
      {days.map((d, i) => {
        const isToday = sameDay(d, today); const dayS = sessionsOn(d)
        return (
          <div key={i} style={{ flex: 1, minWidth: 108, borderRight: i === 6 ? 'none' : `1px solid ${S.border}` }}>
            <div style={{ textAlign: 'center', padding: '8px 4px', borderBottom: `1px solid ${S.border}`, background: isToday ? S.accentLight : '#FAFAFA' }}>
              <div style={{ fontSize: 11, color: S.text3, fontWeight: 700 }}>{DOW[i]}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: isToday ? S.accent : S.text1 }}>{d.getDate()}</div>
            </div>
            <div style={{ padding: 5, minHeight: 90, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {dayS.map(s => sessBlock(s, false))}
              {!dayS.length && <div style={{ fontSize: 10.5, color: '#D4D4D8', textAlign: 'center', paddingTop: 14 }}>—</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── VIEW: THÁNG ──
function MonthView({ cursor, today, sessionsOn, clsById, onPick }: {
  cursor: Date; today: Date; sessionsOn: (d: Date) => FlatSess[]; clsById: Record<string, ClassLite>; onPick: (cid: string, s: SessionRow) => void
}) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const off = (first.getDay() + 6) % 7   // T2 đầu tuần
  const gridStart = new Date(first); gridStart.setDate(1 - off)
  const cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); return d })
  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${S.border}`, background: '#FAFAFA' }}>
        {DOW.map(d => <div key={d} style={{ textAlign: 'center', padding: '7px 0', fontSize: 11, fontWeight: 700, color: S.text3 }}>{d}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth(); const isToday = sameDay(d, today); const dayS = sessionsOn(d)
          return (
            <div key={i} style={{ minHeight: 78, borderRight: (i % 7 !== 6) ? `1px solid ${S.border}` : 'none', borderBottom: i < 35 ? `1px solid ${S.border}` : 'none', padding: 4, background: inMonth ? '#fff' : '#FAFAFA', opacity: inMonth ? 1 : 0.55 }}>
              <div style={{ fontSize: 11.5, fontWeight: isToday ? 800 : 600, color: isToday ? S.accent : S.text2, textAlign: 'right', marginBottom: 2 }}>{d.getDate()}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {dayS.slice(0, 3).map(s => {
                  const cls = clsById[s.class_id]; const si = statusInfo(cls?.status)
                  return (
                    <button key={s.class_id + s.session_number} onClick={() => onPick(s.class_id, s)} title={`${cls?.name} · ${hm(s.start_at)}`}
                      style={{ textAlign: 'left', border: 'none', borderLeft: `3px solid ${si.c}`, borderRadius: 4, background: s.status === 'cancelled' ? '#FEF2F2' : `${si.c}14`, padding: '1px 4px', fontFamily: 'inherit', cursor: 'pointer', fontSize: 10, fontWeight: 700, color: S.text1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: s.status === 'cancelled' ? 'line-through' : 'none' }}>
                      {hm(s.start_at)} {cls?.code || cls?.name}
                    </button>
                  )
                })}
                {dayS.length > 3 && <div style={{ fontSize: 10, color: S.text3, paddingLeft: 2 }}>+{dayS.length - 3} nữa</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── VIEW: NĂM (12 tháng thu nhỏ, ngày có buổi = chấm; click tháng → xem tháng) ──
function YearView({ cursor, today, flat, countIn, onOpenMonth }: {
  cursor: Date; today: Date; flat: FlatSess[]; countIn: (a: number, b: number) => number; onOpenMonth: (d: Date) => void
}) {
  const year = cursor.getFullYear()
  const daysWithSess = new Set(flat.filter(s => new Date(s.start_at).getFullYear() === year && s.status !== 'cancelled').map(s => startOfDay(new Date(s.start_at)).getTime()))
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
      {Array.from({ length: 12 }, (_, m) => {
        const first = new Date(year, m, 1)
        const off = (first.getDay() + 6) % 7
        const gridStart = new Date(first); gridStart.setDate(1 - off)
        const monthStart = first.getTime(); const monthEnd = new Date(year, m + 1, 1).getTime()
        const total = countIn(monthStart, monthEnd)
        return (
          <button key={m} onClick={() => onOpenMonth(new Date(year, m, 1))}
            style={{ textAlign: 'left', background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: 10, cursor: 'pointer', fontFamily: 'inherit' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: S.text1 }}>Tháng {m + 1}</span>
              {total > 0 && <span style={{ fontSize: 10.5, fontWeight: 800, color: S.accent, background: S.accentLight, borderRadius: 5, padding: '1px 6px' }}>{total} buổi</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
              {Array.from({ length: 42 }, (_, i) => {
                const d = new Date(gridStart); d.setDate(gridStart.getDate() + i)
                const inMonth = d.getMonth() === m; const has = daysWithSess.has(startOfDay(d).getTime()); const isToday = sameDay(d, today)
                return (
                  <div key={i} style={{ aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8.5, borderRadius: 3,
                    color: !inMonth ? '#D4D4D8' : isToday ? '#fff' : has ? '#fff' : S.text3,
                    background: isToday ? S.text1 : has && inMonth ? S.accent : 'transparent', fontWeight: has ? 800 : 400 }}>
                    {inMonth ? d.getDate() : ''}
                  </div>
                )
              })}
            </div>
          </button>
        )
      })}
    </div>
  )
}
