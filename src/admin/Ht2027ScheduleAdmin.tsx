// ── Ht2027ScheduleAdmin — 🎸 Lịch thực hành Hành trình 2027 trong /admin ──
// Đọc CÙNG nguồn lịch với landing: class_schedule (program_code='HT2027')
//   + class_sessions + class_off_days. Thầy đổi trạng thái buổi tại đây
//   (Dự kiến/Xác nhận/Đã dạy/Dời/Bù/Huỷ/Nghỉ lễ) → landing tự cập nhật.
// Chỉnh ngày khai giảng/nghỉ chặng: nút "Mở Lịch lớp" → ScheduleManager.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { HT2027, HT2027_STAGES } from '../data/ht2027Program'
import type { SessionRow } from '../journey/sessions'

const S = { bg: '#F4F4F5', surface: '#FFFFFF', border: '#E4E4E7', text1: '#18181B', text2: '#52525B', text3: '#A1A1AA', ok: '#16A34A', err: '#DC2626' }
const STAGE_COLORS = ['#4338CA', '#6D28D9', '#7C3AED', '#8B5CF6', '#A78BFA']
const STATUSES: { v: string; l: string }[] = [
  { v: 'scheduled', l: 'Dự kiến' }, { v: 'confirmed', l: '✓ Xác nhận' }, { v: 'completed', l: '✓ Đã dạy' },
  { v: 'rescheduled', l: 'Dời buổi' }, { v: 'makeup', l: 'Buổi bù' }, { v: 'cancelled', l: 'Huỷ buổi' }, { v: 'holiday', l: 'Nghỉ lễ' },
]
const p2 = (n: number) => String(n).padStart(2, '0')
const ymdOf = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
const fmtDM = (d: Date) => `${p2(d.getDate())}/${p2(d.getMonth() + 1)}`

interface AdminSess extends SessionRow { id: string; end_at?: string | null }
interface OffDay { off_date: string; reason: string | null }
interface Entry { kind: 'lesson' | 'break' | 'off'; date: Date; session?: AdminSess; offReason?: string; stageNo: number | null }

const buildTimeline = (sessions: AdminSess[], offDays: OffDay[]): Entry[] => {
  const byYmd = new Map<string, AdminSess>()
  for (const s of sessions) byYmd.set(ymdOf(new Date(s.start_at)), s)
  const offByYmd = new Map<string, OffDay>()
  for (const o of offDays) offByYmd.set(o.off_date.slice(0, 10), o)
  const sorted = [...sessions].sort((a, b) => a.start_at.localeCompare(b.start_at))
  if (!sorted.length) return []
  const d = new Date(sorted[0].start_at)
  const end = new Date(sorted[sorted.length - 1].start_at)
  const out: Entry[] = []
  let stageNo: number | null = null
  while (d.getTime() <= end.getTime()) {
    const ymd = ymdOf(d)
    const s = byYmd.get(ymd)
    if (s) {
      if (s.event_type === 'break') out.push({ kind: 'break', date: new Date(d), session: s, stageNo })
      else { stageNo = s.session_number ? Math.ceil(s.session_number / 8) : stageNo; out.push({ kind: 'lesson', date: new Date(d), session: s, stageNo }) }
    } else {
      const o = offByYmd.get(ymd)
      if (o) out.push({ kind: 'off', date: new Date(d), offReason: o.reason ?? 'Nghỉ lễ / lịch chung', stageNo })
    }
    d.setDate(d.getDate() + 7)
  }
  return out
}

const inp: React.CSSProperties = { border: `1px solid ${S.border}`, borderRadius: 7, padding: '4px 8px', fontSize: 12.5, fontFamily: 'inherit', background: '#fff', color: S.text1, cursor: 'pointer' }

export default function Ht2027ScheduleAdmin({ onOpenSchedule }: { onOpenSchedule: () => void }) {
  const [cls, setCls] = useState<{ id: string; code: string | null; name: string; start_date: string | null; start_time: string | null; end_date: string | null; total_sessions: number; is_active: boolean } | null>(null)
  const [sessions, setSessions] = useState<AdminSess[]>([])
  const [offDays, setOffDays] = useState<OffDay[]>([])
  const [openStage, setOpenStage] = useState(1)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: c } = await supabase.from('class_schedule').select('id,code,name,start_date,start_time,end_date,total_sessions,is_active')
        .eq('program_code', HT2027.programCode).maybeSingle()
      const clsData = c ?? (await supabase.from('class_schedule').select('id,code,name,start_date,start_time,end_date,total_sessions,is_active')
        .eq('code', HT2027.classCode).maybeSingle()).data
      if (cancelled) return
      setCls(clsData as never)
      if (clsData) {
        const [sr, or] = await Promise.all([
          supabase.from('class_sessions').select('id,session_number,start_at,end_at,status,event_type,title').eq('class_id', (clsData as { id: string }).id).order('start_at'),
          supabase.from('class_off_days').select('off_date,reason').eq('is_active', true),
        ])
        if (cancelled) return
        setSessions((sr.data ?? []) as AdminSess[])
        setOffDays((or.data ?? []) as OffDay[])
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const timeline = useMemo(() => buildTimeline(sessions, offDays), [sessions, offDays])
  const byStage = useMemo(() => {
    const map = new Map<number, Entry[]>()
    for (const t of timeline) {
      const k = t.stageNo ?? 1
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(t)
    }
    return HT2027_STAGES.map(s => map.get(s.no) ?? [])
  }, [timeline])

  const setStatus = async (id: string, status: string) => {
    setBusyId(id); setMsg('')
    const { error } = await supabase.from('class_sessions').update({ status }).eq('id', id)
    setBusyId(null)
    if (error) { setMsg('Lỗi: ' + error.message); return }
    setSessions(prev => prev.map(s => s.id === id ? { ...s, status } : s))
  }

  const stageRange = (entries: Entry[]) => {
    const lessons = entries.filter(e => e.kind === 'lesson')
    if (!lessons.length) return ''
    return `${fmtDM(lessons[0].date)} → ${fmtDM(lessons[lessons.length - 1].date)}`
  }
  const stageSummary = (entries: Entry[]) => {
    const lessons = entries.filter(e => e.kind === 'lesson')
    const breaks = entries.filter(e => e.kind === 'break').length
    const offs = entries.filter(e => e.kind === 'off').length
    const bySt = new Map<string, number>()
    for (const e of lessons) { const st = e.session?.status ?? 'scheduled'; bySt.set(st, (bySt.get(st) ?? 0) + 1) }
    const parts: string[] = []
    for (const st of STATUSES) { const n = bySt.get(st.v); if (n) parts.push(`${st.l} ${n}`) }
    return { text: `${lessons.length} buổi${breaks ? ` · nghỉ ${breaks} tuần` : ''}${offs ? ` · bỏ qua ${offs}` : ''}`, bySt: parts.join(' · ') }
  }

  const startTime = cls?.start_time?.slice(0, 5) ?? '20:30'

  return (
    <div style={{ minHeight: '100%', background: S.bg, fontFamily: '"Inter", system-ui, sans-serif', padding: '16px 20px 32px' }}>
      {/* Header chương trình */}
      <div style={{ background: 'linear-gradient(120deg,#201A52,#4338CA)', borderRadius: 14, padding: '18px 20px', color: '#fff', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 22 }}>🎸</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>Lịch thực hành — Hành trình 2027</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.85)', marginTop: 2 }}>
              {cls?.code ?? 'HT2027.TH01'} · Thứ Năm {startTime} · 40 buổi ·{' '}
              {cls?.start_date ? `${fmtDM(new Date(cls.start_date + 'T00:00:00'))} → ${cls.end_date ? fmtDM(new Date(cls.end_date + 'T00:00:00')) : '—'}` : 'chưa có lịch'}
              {cls && !cls.is_active && <span style={{ marginLeft: 8, background: 'rgba(255,255,255,.2)', borderRadius: 6, padding: '2px 8px', fontSize: 11.5, fontWeight: 700 }}>ẩn trên trang tuyển sinh</span>}
            </div>
          </div>
          <button onClick={onOpenSchedule} style={{ background: '#fff', color: '#4338CA', border: 'none', borderRadius: 9, padding: '9px 15px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>🗓 Mở Lịch lớp (sửa ngày)</button>
          <a href="/hanhtrinh2027" target="_blank" rel="noreferrer" style={{ background: 'rgba(255,255,255,.16)', color: '#fff', border: '1px solid rgba(255,255,255,.4)', borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' }}>👁 Xem landing ↗</a>
        </div>
        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.75)', marginTop: 10, lineHeight: 1.6 }}>
          Đổi trạng thái từng buổi tại đây → trang /hanhtrinh2027 tự cập nhật. Ngày nghỉ lễ/lock quản lý ở bảng class_off_days (mục 4 của docs/HT2027-40-BUOI-THUC-HANH.md).
        </div>
      </div>

      {msg && <div style={{ background: '#FEF2F2', color: S.err, border: '1px solid #FECACA', borderRadius: 8, padding: '8px 14px', fontSize: 13, marginBottom: 12 }}>⚠ {msg}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', color: S.text3, padding: 40 }}>Đang tải lịch…</div>
      ) : !cls ? (
        <div style={{ textAlign: 'center', color: S.text3, padding: 40, background: S.surface, border: `1px dashed ${S.border}`, borderRadius: 12 }}>
          Chưa có lớp chương trình HT2027 — chạy <b>scripts/seed-ht2027.ts</b> hoặc tạo lớp có <b>program_code = HT2027</b>.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {HT2027_STAGES.map((st, si) => {
            const entries = byStage[si]
            if (!entries?.length) return null
            const open = openStage === st.no
            const stColor = STAGE_COLORS[si]
            const sum = stageSummary(entries)
            return (
              <div key={st.no} style={{ background: S.surface, border: `1px solid ${S.border}`, borderLeft: `4px solid ${stColor}`, borderRadius: 12, overflow: 'hidden' }}>
                <button onClick={() => setOpenStage(open ? 0 : st.no)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                  <span style={{ background: stColor, color: '#fff', borderRadius: 7, padding: '4px 9px', fontSize: 11.5, fontWeight: 800, flexShrink: 0 }}>Chặng {st.no}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: S.text1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.title}</span>
                    <span style={{ display: 'block', fontSize: 12, color: S.text3, marginTop: 1 }}>{stageRange(entries)} · {sum.text} {sum.bySt && <span style={{ color: stColor, fontWeight: 600 }}>· {sum.bySt}</span>}</span>
                  </span>
                  <span style={{ color: stColor, fontSize: 18, fontWeight: 700, flexShrink: 0 }}>{open ? '−' : '+'}</span>
                </button>
                {open && (
                  <div style={{ borderTop: `1px solid ${S.border}` }}>
                    {entries.map((t, idx) => {
                      if (t.kind === 'lesson') {
                        const s = t.session!
                        const num = s.session_number ?? 0
                        return (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: idx < entries.length - 1 ? `1px solid ${S.border}` : 'none', background: idx % 2 ? '#FAFAFA' : '#fff' }}>
                            <div style={{ width: 52, flexShrink: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 800, color: S.text1 }}>{fmtDM(t.date)}</div>
                              <div style={{ fontSize: 10.5, color: S.text3 }}>{startTime}</div>
                            </div>
                            <span style={{ background: `${stColor}18`, color: stColor, borderRadius: 6, padding: '2px 7px', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>B{String(num).padStart(2, '0')}</span>
                            <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: S.text1, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title ? s.title.replace(/^Buổi \d+ · /, '') : st.lessons[(num - 1) % 8]}</span>
                            <select value={s.status} disabled={busyId === s.id} onChange={e => setStatus(s.id, e.target.value)} style={inp}>
                              {STATUSES.map(x => <option key={x.v} value={x.v}>{x.l}</option>)}
                            </select>
                          </div>
                        )
                      }
                      if (t.kind === 'break') {
                        return (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', background: '#FBF3E6', borderBottom: idx < entries.length - 1 ? `1px solid ${S.border}` : 'none' }}>
                            <div style={{ width: 52, flexShrink: 0, fontSize: 13, fontWeight: 800, color: '#8A4B06' }}>{fmtDM(t.date)}</div>
                            <span style={{ fontSize: 12, fontWeight: 800, color: '#8A4B06' }}>✕ Nghỉ giữa chặng</span>
                            <span style={{ fontSize: 12, color: '#7A5A28', fontStyle: 'italic' }}>tự luyện và hoàn thiện sản phẩm</span>
                          </div>
                        )
                      }
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', background: '#F7F7F9', borderBottom: idx < entries.length - 1 ? `1px solid ${S.border}` : 'none' }}>
                          <div style={{ width: 52, flexShrink: 0, fontSize: 13, fontWeight: 800, color: S.text3 }}>{fmtDM(t.date)}</div>
                          <span style={{ background: '#E5E7EB', color: '#4B5563', borderRadius: 6, padding: '2px 7px', fontSize: 10.5, fontWeight: 800 }}>Bỏ qua</span>
                          <span style={{ fontSize: 12.5, color: S.text2 }}>{t.offReason}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
