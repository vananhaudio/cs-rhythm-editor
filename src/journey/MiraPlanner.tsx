// ── JOURNEY OS — GĐ4B: Mira Planner (đề xuất bằng RULE, thầy duyệt) ──
// Tính đề xuất trực tiếp từ dữ liệu sẵn có — KHÔNG gọi AI, KHÔNG bảng riêng.
import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '../supabase'
import { TEN_NANG_LUC, nextCourses } from '../hanhtrinh'
import { type SessionRow } from './sessions'
import type { ClassLite } from './ScheduleDashboard'

const S = { surface: '#FFFFFF', border: '#E4E4E7', text1: '#18181B', text2: '#52525B', text3: '#A1A1AA', accent: '#4F46E5', accentLight: '#EEF2FF', bg: '#F4F4F5', ok: '#16A34A', okBg: '#F0FDF4', warn: '#B45309', warnBg: '#FEF3C7', err: '#DC2626', errBg: '#FEF2F2' }
const DEMAND_THRESHOLD = 4   // R2
const OVERLOAD_PER_DAY = 3   // R3
const FOUNDATION = ['DH2', 'DH3', 'DHNC', 'TN2', 'TN3']  // R4: mốc đủ nền cho HT2027

interface Course { id: string; name: string; code: string | null }
interface Demand { id: string; course_code: string; status: string }
interface Offer { id: string; status: string; course_code: string | null }

type Kind = 'warning' | 'open_class' | 'continue' | 'promote' | 'ht2027'
interface Rec { kind: Kind; icon: string; color: string; bg: string; priority: number; title: string; reason: string; action?: { label: string; run: () => void } }

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function MiraPlanner({ courses, classes, sessById, onCreateDraft, onGoTab }: {
  courses: Course[]; classes: ClassLite[]; sessById: Record<string, SessionRow[]>
  onCreateDraft: (code: string) => void; onGoTab: (v: 'demands' | 'offers' | 'list') => void
}) {
  const [demands, setDemands] = useState<Demand[]>([])
  const [offers, setOffers] = useState<Offer[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    supabase.from('class_demands').select('id,course_code,status').eq('status', 'waiting').then(({ data }) => setDemands((data ?? []) as Demand[]))
    supabase.from('offer_campaigns').select('id,status,course_code').then(({ data }) => setOffers((data ?? []) as Offer[]))
  }, [])

  const now = new Date()
  const hasCourse = (code: string) => courses.some(c => (c.code || '').toUpperCase() === code)
  // số buổi còn lại (chưa tới, chưa completed/cancelled)
  const remaining = (cid: string) => (sessById[cid] ?? []).filter(s => new Date(s.start_at).getTime() > now.getTime() && s.status !== 'cancelled' && s.status !== 'completed').length
  const activeClassCodes = new Set(classes.filter(c => c.is_active && c.status !== 'completed' && c.status !== 'cancelled' && c.status !== 'merged').map(c => (c.mainCourseCode || '').toUpperCase()))

  const recs: Rec[] = []

  // R2 — đủ người/khoá → mở lớp (khoá chưa có lớp đang chạy)
  const byCode: Record<string, number> = {}
  for (const d of demands) byCode[d.course_code.toUpperCase()] = (byCode[d.course_code.toUpperCase()] || 0) + 1
  for (const [code, n] of Object.entries(byCode)) {
    if (n >= DEMAND_THRESHOLD && !activeClassCodes.has(code)) {
      recs.push({ kind: 'open_class', icon: '★', color: S.ok, bg: S.okBg, priority: 2,
        title: `Đủ ${n} người muốn học ${code} · ${TEN_NANG_LUC[code] ?? code}`,
        reason: `Có ${n} nhu cầu đang chờ (≥${DEMAND_THRESHOLD}) mà chưa có lớp đang chạy. Nên mở lớp.`,
        action: { label: '✎ Tạo lớp nháp', run: () => onCreateDraft(code) } })
    }
  }

  // R1 — lớp còn 1-2 buổi → chuẩn bị khoá tiếp nối
  for (const c of classes) {
    if (!c.is_active || c.status === 'completed' || c.status === 'cancelled' || c.status === 'draft') continue
    const rem = remaining(c.id)
    if (rem >= 1 && rem <= 2) {
      const nexts = nextCourses(c.mainCourseCode).filter(hasCourse)
      const nextLabel = nexts.length ? nexts.map(n => `${n} · ${TEN_NANG_LUC[n] ?? n}`).join(', ') : '—'
      recs.push({ kind: 'continue', icon: '▲', color: S.warn, bg: S.warnBg, priority: 3,
        title: `${c.code || c.name} sắp xong (còn ${rem} buổi)`,
        reason: nexts.length ? `Chuẩn bị dẫn HV sang: ${nextLabel}. Gieo nhận thức từ buổi kế, khảo sát giờ.` : `Lớp sắp kết thúc — chốt hướng học tiếp cho HV.`,
        action: nexts.length ? { label: `✎ Mở lớp nháp ${nexts[0]}`, run: () => onCreateDraft(nexts[0]) } : undefined })
    }
  }

  // R4 — lớp mốc đủ nền sắp xong → mời tư vấn HT2027 + ưu đãi sớm
  for (const c of classes) {
    if (!c.is_active || c.status === 'completed' || c.status === 'cancelled' || c.status === 'draft') continue
    const code = (c.mainCourseCode || '').toUpperCase()
    if (FOUNDATION.includes(code) && remaining(c.id) <= 3) {
      const hasOffer = offers.some(o => o.status === 'active')
      recs.push({ kind: 'ht2027', icon: '★', color: '#7C3AED', bg: '#F5F3FF', priority: 4,
        title: `HV lớp ${c.code || code} sắp đủ nền cho Hành trình 2027`,
        reason: `Nhóm này đang ở mốc ${code}. Thời điểm tốt để mời tư vấn HT2027 + ưu đãi đăng ký sớm.`,
        action: { label: hasOffer ? 'Xem ưu đãi' : '＋ Tạo ưu đãi sớm', run: () => onGoTab('offers') } })
    }
  }

  // R5 — lớp nháp gần đủ nhu cầu → đẩy truyền thông
  for (const c of classes) {
    if (c.status !== 'draft') continue
    const code = (c.mainCourseCode || '').toUpperCase()
    const n = byCode[code] || 0
    if (n >= 3) {
      recs.push({ kind: 'promote', icon: '◇', color: S.accent, bg: S.accentLight, priority: 3,
        title: `Lớp nháp ${c.code || c.name} đã gần đủ (${n} nhu cầu)`,
        reason: `Đủ lực để chốt: đẩy truyền thông/giữ chỗ, chuyển từ nháp sang chính thức.`,
        action: { label: 'Mở lớp (sửa)', run: () => onGoTab('list') } })
    }
  }

  // R3 — ngày quá nhiều buổi → cảnh báo quá tải
  const perDay: Record<string, number> = {}
  for (const arr of Object.values(sessById)) for (const s of arr) {
    if (s.status === 'cancelled') continue
    const t = new Date(s.start_at); if (t.getTime() < now.getTime()) continue
    perDay[ymd(t)] = (perDay[ymd(t)] || 0) + 1
  }
  for (const [day, n] of Object.entries(perDay)) {
    if (n >= OVERLOAD_PER_DAY) {
      const [y, m, d] = day.split('-')
      recs.push({ kind: 'warning', icon: '⚠', color: S.err, bg: S.errBg, priority: 1,
        title: `Ngày ${d}/${m}/${y} có ${n} buổi — dễ quá tải`,
        reason: `Cân nhắc giãn lịch, đừng xếp thêm lớp vào ngày này.` })
    }
  }

  const visible = recs
    .filter(r => !dismissed.has(r.title))
    .sort((a, b) => a.priority - b.priority)

  const dismiss = (title: string) => setDismissed(s => new Set(s).add(title))

  const btn: CSSProperties = { border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }

  return (
    <div>
      <div style={{ fontSize: 13, color: S.text2, marginBottom: 14 }}>
        Mira quan sát lịch + nhu cầu + ưu đãi → <b>đề xuất</b>, thầy <b>duyệt</b>. Đề xuất tính bằng quy tắc (R1–R5), không dùng AI.
      </div>

      {visible.length === 0 ? (
        <div style={{ textAlign: 'center', color: S.text3, padding: 36, background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12 }}>
          Chưa có đề xuất nào lúc này. Thêm nhu cầu / lớp có lịch để Mira gợi ý.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map((r, i) => (
            <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderLeft: `4px solid ${r.color}`, borderRadius: 12, padding: '13px 15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ fontSize: 15, color: r.color }}>{r.icon}</span>
                <span style={{ fontSize: 14.5, fontWeight: 700, color: S.text1, flex: 1 }}>{r.title}</span>
                <button onClick={() => dismiss(r.title)} title="Ẩn đề xuất này" style={{ background: 'transparent', border: 'none', color: S.text3, cursor: 'pointer', fontSize: 16, fontFamily: 'inherit' }}>×</button>
              </div>
              <div style={{ fontSize: 13, color: S.text2, marginTop: 5, paddingLeft: 24 }}>{r.reason}</div>
              {r.action && (
                <div style={{ paddingLeft: 24, marginTop: 10 }}>
                  <button onClick={r.action.run} style={{ ...btn, background: r.bg, color: r.color }}>{r.action.label}</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
