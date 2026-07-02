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
interface Rec { key: string; kind: Kind; icon: string; color: string; bg: string; priority: number; title: string; reason: string; action?: { label: string; run: () => void } }
interface RecRow { rec_key: string; status: string }
const STAT: Record<string, { l: string; c: string; bg: string }> = {
  approved: { l: '✓ Đã duyệt', c: '#16A34A', bg: '#F0FDF4' },
  done: { l: '✓ Đã xong', c: '#71717A', bg: '#F4F4F5' },
  dismissed: { l: 'Đã ẩn', c: '#A1A1AA', bg: '#F4F4F5' },
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function MiraPlanner({ courses, classes, sessById, onCreateDraft, onGoTab }: {
  courses: Course[]; classes: ClassLite[]; sessById: Record<string, SessionRow[]>
  onCreateDraft: (code: string) => void; onGoTab: (v: 'demands' | 'offers' | 'list') => void
}) {
  const [demands, setDemands] = useState<Demand[]>([])
  const [offers, setOffers] = useState<Offer[]>([])
  const [recStatus, setRecStatus] = useState<Record<string, string>>({})  // rec_key → status (bền)
  const [showHandled, setShowHandled] = useState(false)

  const loadRecs = () => supabase.from('mira_recommendations').select('rec_key,status')
    .then(({ data }) => setRecStatus(Object.fromEntries(((data ?? []) as RecRow[]).map(r => [r.rec_key, r.status]))))
  useEffect(() => {
    supabase.from('class_demands').select('id,course_code,status').eq('status', 'waiting').then(({ data }) => setDemands((data ?? []) as Demand[]))
    supabase.from('offer_campaigns').select('id,status,course_code').then(({ data }) => setOffers((data ?? []) as Offer[]))
    loadRecs()
  }, [])

  // lưu bền trạng thái đề xuất theo key (upsert)
  const setStatus = async (r: Rec, status: string) => {
    setRecStatus(s => ({ ...s, [r.key]: status }))  // lạc quan
    await supabase.from('mira_recommendations').upsert({
      rec_key: r.key, kind: r.kind, title: r.title, reason: r.reason, priority: r.priority,
      status, approved_at: status === 'approved' ? new Date().toISOString() : null,
    }, { onConflict: 'rec_key' })
    loadRecs()
  }

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
      recs.push({ key: `R2:${code}`, kind: 'open_class', icon: '★', color: S.ok, bg: S.okBg, priority: 2,
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
      recs.push({ key: `R1:${c.id}`, kind: 'continue', icon: '▲', color: S.warn, bg: S.warnBg, priority: 3,
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
      recs.push({ key: `R4:${c.id}`, kind: 'ht2027', icon: '★', color: '#7C3AED', bg: '#F5F3FF', priority: 4,
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
      recs.push({ key: `R5:${c.id}`, kind: 'promote', icon: '◇', color: S.accent, bg: S.accentLight, priority: 3,
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
      recs.push({ key: `R3:${day}`, kind: 'warning', icon: '⚠', color: S.err, bg: S.errBg, priority: 1,
        title: `Ngày ${d}/${m}/${y} có ${n} buổi — dễ quá tải`,
        reason: `Cân nhắc giãn lịch, đừng xếp thêm lớp vào ngày này.` })
    }
  }

  const sorted = recs.sort((a, b) => a.priority - b.priority)
  // đang chờ xử lý = chưa ẩn/duyệt/xong; đã xử lý = có trạng thái approved/done/dismissed
  const pending = sorted.filter(r => !recStatus[r.key] || recStatus[r.key] === 'new')
  const handled = sorted.filter(r => ['approved', 'done', 'dismissed'].includes(recStatus[r.key]))
  const shown = showHandled ? handled : pending

  const btn: CSSProperties = { border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }
  const mini: CSSProperties = { border: `1px solid ${S.border}`, background: '#fff', borderRadius: 7, padding: '5px 11px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: S.text2 }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: S.text2, flex: 1, minWidth: 220 }}>
          Mira quan sát lịch + nhu cầu + ưu đãi → <b>đề xuất</b>, thầy <b>duyệt</b>. Quy tắc R1–R5, không dùng AI. Trạng thái lưu bền.
        </div>
        <div style={{ display: 'flex', gap: 4, background: S.bg, borderRadius: 9, padding: 3 }}>
          <button onClick={() => setShowHandled(false)} style={{ ...mini, border: 'none', background: !showHandled ? '#fff' : 'transparent', color: !showHandled ? S.accent : S.text2, fontWeight: 700 }}>Đang chờ ({pending.length})</button>
          <button onClick={() => setShowHandled(true)} style={{ ...mini, border: 'none', background: showHandled ? '#fff' : 'transparent', color: showHandled ? S.accent : S.text2, fontWeight: 700 }}>Đã xử lý ({handled.length})</button>
        </div>
      </div>

      {shown.length === 0 ? (
        <div style={{ textAlign: 'center', color: S.text3, padding: 36, background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12 }}>
          {showHandled ? 'Chưa có đề xuất nào được xử lý.' : 'Chưa có đề xuất chờ xử lý. Thêm nhu cầu / lớp có lịch để Mira gợi ý.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shown.map((r, i) => {
            const st = recStatus[r.key]
            const badge = st && STAT[st]
            return (
              <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderLeft: `4px solid ${r.color}`, borderRadius: 12, padding: '13px 15px', opacity: showHandled && st === 'dismissed' ? 0.7 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, color: r.color }}>{r.icon}</span>
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: S.text1, flex: 1 }}>{r.title}</span>
                  {badge && <span style={{ fontSize: 11.5, fontWeight: 800, color: badge.c, background: badge.bg, borderRadius: 6, padding: '2px 8px' }}>{badge.l}</span>}
                </div>
                <div style={{ fontSize: 13, color: S.text2, marginTop: 5, paddingLeft: 24 }}>{r.reason}</div>
                <div style={{ paddingLeft: 24, marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {r.action && <button onClick={r.action.run} style={{ ...btn, background: r.bg, color: r.color }}>{r.action.label}</button>}
                  {!showHandled ? (<>
                    <button onClick={() => setStatus(r, 'approved')} style={{ ...mini, color: S.ok, borderColor: '#BBF7D0' }}>✓ Duyệt</button>
                    <button onClick={() => setStatus(r, 'done')} style={mini}>Đã xong</button>
                    <button onClick={() => setStatus(r, 'dismissed')} style={mini}>Ẩn</button>
                  </>) : (
                    <button onClick={() => setStatus(r, 'new')} style={mini}>↩ Đưa lại chờ</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
