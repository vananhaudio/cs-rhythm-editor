// ── JOURNEY OS — Dashboard chỉ số (thẻ tổng quan lịch) ──
import type { CSSProperties } from 'react'
import { statusInfo, type SessionRow } from './sessions'

export interface ClassLite {
  id: string; code: string | null; name: string; status: string
  total_sessions: number; mainCourseName: string | null; is_active: boolean
}

const S = { surface: '#FFFFFF', border: '#E4E4E7', text1: '#18181B', text2: '#52525B', text3: '#A1A1AA', accent: '#4F46E5' }

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
// Đầu tuần = Thứ 2
const startOfWeek = (d: Date) => { const x = startOfDay(d); const off = (x.getDay() + 6) % 7; x.setDate(x.getDate() - off); return x }

export default function ScheduleDashboard({ classes, sessById }: { classes: ClassLite[]; sessById: Record<string, SessionRow[]> }) {
  const now = new Date()
  const today0 = startOfDay(now).getTime()
  const today1 = today0 + 86400000
  const week0 = startOfWeek(now).getTime()
  const week1 = week0 + 7 * 86400000

  const allSess = Object.values(sessById).flat()
  const inRange = (a: number, b: number) => allSess.filter(s => {
    const t = new Date(s.start_at).getTime()
    return t >= a && t < b && s.status !== 'cancelled'
  }).length

  const buoiHomNay = inRange(today0, today1)
  const buoiTuanNay = inRange(week0, week1)
  const active = classes.filter(c => c.is_active && c.status === 'active')
  const sapKG = classes.filter(c => c.is_active && (c.status === 'upcoming' || c.status === 'scheduled'))
  const draft = classes.filter(c => c.is_active && (c.status === 'draft' || c.status === 'recruiting'))

  // Lớp sắp kết thúc / cần xếp tiếp: còn ≤2 buổi chưa tới (theo class_sessions)
  const conLai = (c: ClassLite) => {
    const ss = sessById[c.id] ?? []
    if (!ss.length) return null
    const nowT = now.getTime()
    return ss.filter(s => new Date(s.start_at).getTime() > nowT && s.status !== 'cancelled' && s.status !== 'completed').length
  }
  const sapKT = classes.filter(c => c.is_active && c.status !== 'completed' && (() => { const r = conLai(c); return r !== null && r > 0 && r <= 2 })())

  const CARDS: { l: string; v: number | string; sub?: string; c?: string }[] = [
    { l: 'Buổi hôm nay', v: buoiHomNay, c: buoiHomNay ? S.accent : S.text3 },
    { l: 'Buổi tuần này', v: buoiTuanNay },
    { l: 'Đang học', v: active.length, sub: active.map(c => c.code || c.name).slice(0, 3).join(' · ') },
    { l: 'Sắp khai giảng', v: sapKG.length, sub: sapKG.map(c => c.code || c.name).slice(0, 3).join(' · '), c: '#F59E0B' },
    { l: 'Sắp kết thúc / xếp tiếp', v: sapKT.length, sub: sapKT.map(c => c.code || c.name).slice(0, 3).join(' · '), c: sapKT.length ? '#F59E0B' : S.text3 },
    { l: 'Nháp / đang tuyển', v: draft.length, sub: draft.map(c => c.code || c.name).slice(0, 3).join(' · '), c: S.text3 },
  ]

  const card: CSSProperties = { background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, padding: '14px 16px', minWidth: 0 }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 18 }}>
        {CARDS.map((c, i) => (
          <div key={i} style={card}>
            <div style={{ fontSize: 12.5, color: S.text2, fontWeight: 600 }}>{c.l}</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: c.c || S.text1, marginTop: 2, lineHeight: 1.1 }}>{c.v}</div>
            {c.sub && <div style={{ fontSize: 11.5, color: S.text3, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.sub}</div>}
          </div>
        ))}
      </div>

      {/* Chú thích màu trạng thái */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: 12, color: S.text3 }}>
        {['active', 'upcoming', 'scheduled', 'ending_soon', 'draft', 'cancelled'].map(v => {
          const si = statusInfo(v)
          return <span key={v} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: si.c }} />{si.l}</span>
        })}
      </div>
    </div>
  )
}
