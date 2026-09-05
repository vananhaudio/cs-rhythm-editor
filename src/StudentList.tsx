import { loadStudentPackages, packageSummary, packageDate, PACKAGE_STATUS, PACKAGE_SOURCE, type StudentPackage } from './studentPackages'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { supabase } from './supabase'

interface Student {
  id: string
  user_id: string | null
  full_name: string
  email: string | null
  phone: string | null
  level: string | null
  is_active: boolean
  enrolled_at: string | null
}
interface Grp { id: string; name: string; zalo_url: string | null }

const T = {
  bg: '#F4F4F5', bgCard: '#FFFFFF', bgCardHover: '#FAFAFA',
  header: '#2D6A4F', gold: '#B45309', goldLight: '#FCD34D',
  green: '#2D6A4F', greenLight: '#E9F3EC',
  text: '#18181B', textMuted: '#52525B', textDim: '#A1A1AA',
  border: '#E4E4E7', borderLight: '#F0F0F2',
  danger: '#DC2626', warn: '#B45309',
}
const LEVEL_COLOR: Record<string, string> = {
  beginner: '#2D6A4F', elementary: '#4D7C0F',
  intermediate: '#B45309', advanced: '#B91C1C',
}
const LEVEL_LABEL: Record<string, string> = {
  beginner: 'Mới bắt đầu', elementary: 'Cơ bản',
  intermediate: 'Trung cấp', advanced: 'Nâng cao',
}

const rTh: CSSProperties = { padding: '10px 14px', fontWeight: 700, fontSize: 12.5, whiteSpace: 'nowrap' }
const rTd: CSSProperties = { padding: '10px 14px', verticalAlign: 'top', whiteSpace: 'nowrap' }

interface Props { onSelect: (id: string) => void }

// ── Thao tác bằng tay (không cần AI) — gọi thẳng các action của edge function admin-ai ──
const inpS: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', color: T.text, background: T.bgCard }
const btnPrimary: CSSProperties = { background: T.header, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }
const btnGhost: CSSProperties = { background: T.bgCard, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
const FieldLabel = ({ children }: { children: ReactNode }) =>
  <div style={{ fontSize: 12.5, fontWeight: 700, color: T.textMuted, marginBottom: 5 }}>{children}</div>

function Overlay({ onClose, children, title }: { onClose: () => void; children: ReactNode; title: string }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: T.bgCard, borderRadius: 14, padding: 22, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <b style={{ fontSize: 16, color: T.text }}>{title}</b>
          <button onClick={onClose} style={{ ...btnGhost, padding: '4px 10px' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// Kết quả từng dòng của edge function ({email, ok, error, password, group, warn...})
function ResultLines({ results }: { results: any[] }) {
  return (
    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {results.map((r, i) => (
        <div key={i} style={{ borderRadius: 8, padding: '10px 12px', fontSize: 13.5, lineHeight: 1.5, background: r.ok ? T.greenLight : '#FEE2E2', color: r.ok ? T.green : T.danger }}>
          <b>{r.ok ? '✓' : '✕'} {r.full_name || r.student || r.email}</b>
          {r.ok && r.password && (
            <div style={{ marginTop: 4, color: T.text }}>
              Mật khẩu: <code style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 5, padding: '2px 7px', fontWeight: 700 }}>{r.password}</code>
              <button onClick={() => navigator.clipboard?.writeText(`${r.email}\nMật khẩu: ${r.password}`)} style={{ ...btnGhost, padding: '3px 9px', fontSize: 12, marginLeft: 8 }}>📋 Copy</button>
            </div>
          )}
          {r.ok && r.group && <div style={{ marginTop: 3, color: T.text }}>{r.group}</div>}
          {r.warn && <div style={{ marginTop: 3, color: T.warn }}>⚠ {r.warn}</div>}
          {!r.ok && <div style={{ marginTop: 3 }}>{r.error}</div>}
        </div>
      ))}
    </div>
  )
}

// ➕ Thêm học sinh: tạo tài khoản đăng nhập + hồ sơ, tuỳ chọn gán luôn vào lớp (nhóm Zalo)
function CreateStudentModal({ groups, onClose, onDone }: { groups: Grp[]; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [groupId, setGroupId] = useState('')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<any[] | null>(null)
  const submit = async () => {
    if (!email.trim()) { alert('Cần email của học sinh.'); return }
    setBusy(true); setResults(null)
    const { data, error } = await supabase.functions.invoke('admin-ai', {
      body: { action: 'create', students: [{ email: email.trim(), full_name: name.trim(), password: password.trim() }] },
    })
    let res: any[] = error ? [{ email, ok: false, error: error.message }] : (data?.results ?? [])
    // Tạo OK và thầy chọn lớp → gán vào nhóm luôn (nhóm cấp khoá của lớp qua backfill_class)
    if (res[0]?.ok && groupId) {
      const g = groups.find(x => x.id === groupId)
      const { data: d2, error: e2 } = await supabase.functions.invoke('admin-ai', {
        body: { action: 'add_group', assignments: [{ email: email.trim(), groupName: g?.name }] },
      })
      const r2 = e2 ? { ok: false, email, error: 'gán lớp lỗi: ' + e2.message } : d2?.results?.[0]
      if (r2) res = [...res, r2]
    }
    setResults(res); setBusy(false)
    if (res[0]?.ok) onDone()
  }
  return (
    <Overlay onClose={onClose} title="➕ Thêm học sinh">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><FieldLabel>Họ tên</FieldLabel><input style={inpS} value={name} onChange={e => setName(e.target.value)} placeholder="VD: Nguyễn Văn A" /></div>
        <div><FieldLabel>Email (dùng để đăng nhập)</FieldLabel><input style={inpS} value={email} onChange={e => setEmail(e.target.value)} placeholder="hocsinh@gmail.com" type="email" /></div>
        <div><FieldLabel>Mật khẩu (bỏ trống → tự sinh)</FieldLabel><input style={inpS} value={password} onChange={e => setPassword(e.target.value)} placeholder="Tự sinh nếu bỏ trống" /></div>
        <div>
          <FieldLabel>Gán vào lớp (tuỳ chọn — sẽ cấp luôn khoá của lớp)</FieldLabel>
          <select style={{ ...inpS, cursor: 'pointer' }} value={groupId} onChange={e => setGroupId(e.target.value)}>
            <option value="">— Không gán lớp —</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <button onClick={submit} disabled={busy} style={{ ...btnPrimary, opacity: busy ? .6 : 1 }}>{busy ? 'Đang tạo...' : 'Tạo tài khoản'}</button>
      </div>
      {results && <ResultLines results={results} />}
      {results?.[0]?.ok && results[0].password && <div style={{ marginTop: 10, fontSize: 12.5, color: T.textMuted }}>Nhớ copy mật khẩu gửi cho học sinh — đóng cửa sổ là không xem lại được.</div>}
    </Overlay>
  )
}

// 🔑 Đặt lại mật khẩu cho 1 học sinh
function ResetPasswordModal({ student, onClose }: { student: Student; onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<any[] | null>(null)
  const submit = async () => {
    setBusy(true); setResults(null)
    const { data, error } = await supabase.functions.invoke('admin-ai', {
      body: { action: 'reset_password', resets: [{ email: student.email, password: password.trim() }] },
    })
    setResults(error ? [{ email: student.email, ok: false, error: error.message }] : (data?.results ?? []))
    setBusy(false)
  }
  return (
    <Overlay onClose={onClose} title="🔑 Đặt lại mật khẩu">
      <div style={{ fontSize: 14, color: T.text, marginBottom: 12 }}>
        <b>{student.full_name}</b><div style={{ color: T.textMuted, fontSize: 13 }}>{student.email}</div>
      </div>
      {!student.email ? <div style={{ color: T.danger, fontSize: 13.5 }}>Học sinh này chưa có email — không đặt lại được mật khẩu.</div> : <>
        <div style={{ marginBottom: 12 }}><FieldLabel>Mật khẩu mới (bỏ trống → tự sinh)</FieldLabel><input style={inpS} value={password} onChange={e => setPassword(e.target.value)} placeholder="Tự sinh nếu bỏ trống" /></div>
        <button onClick={submit} disabled={busy} style={{ ...btnPrimary, opacity: busy ? .6 : 1 }}>{busy ? 'Đang đặt lại...' : 'Đặt lại mật khẩu'}</button>
      </>}
      {results && <ResultLines results={results} />}
      {results?.[0]?.ok && <div style={{ marginTop: 10, fontSize: 12.5, color: T.textMuted }}>Copy mật khẩu gửi cho học sinh — đóng cửa sổ là không xem lại được.</div>}
    </Overlay>
  )
}

// 🏫 Thêm lớp: ghép mã lớp từ mã năng lực + số khoá, tự tạo nhóm Zalo cùng mã, sinh buổi học nếu có ngày/giờ
const DOW_OPTS = [['1', 'Thứ Hai'], ['2', 'Thứ Ba'], ['3', 'Thứ Tư'], ['4', 'Thứ Năm'], ['5', 'Thứ Sáu'], ['6', 'Thứ Bảy'], ['0', 'Chủ nhật']] as const
function CreateClassModal({ courses, onClose, onDone }: { courses: { id: string; name: string; code: string | null }[]; onClose: () => void; onDone: () => void }) {
  const coded = courses.filter(c => c.code)
  const [nangLuc, setNangLuc] = useState('')
  const [so, setSo] = useState('')
  const [weekday, setWeekday] = useState('')
  const [time, setTime] = useState('')
  const [startDate, setStartDate] = useState('')
  const [totalSessions, setTotalSessions] = useState('8')
  const [durationMinutes, setDurationMinutes] = useState('90')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<any[] | null>(null)
  const submit = async () => {
    if (!nangLuc || !so.trim()) { alert('Cần chọn khoá (mã năng lực) và nhập số khoá.'); return }
    setBusy(true); setResults(null)
    const cls: any = { nangLuc, so: so.trim(), totalSessions: Number(totalSessions) || 8, durationMinutes: Number(durationMinutes) || 90 }
    if (weekday !== '') cls.weekday = Number(weekday)
    if (time) cls.time = time
    if (startDate) cls.startDate = startDate
    const { data, error } = await supabase.functions.invoke('admin-ai', { body: { action: 'create_schedule', classes: [cls] } })
    const res = error ? [{ email: `${nangLuc}.${so}`, ok: false, error: error.message }] : (data?.results ?? [])
    setResults(res); setBusy(false)
    if (res[0]?.ok) onDone()
  }
  return (
    <Overlay onClose={onClose} title="🏫 Thêm lớp học">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <FieldLabel>Khoá học (mã năng lực)</FieldLabel>
          <select style={{ ...inpS, cursor: 'pointer' }} value={nangLuc} onChange={e => setNangLuc(e.target.value)}>
            <option value="">— Chọn khoá —</option>
            {coded.map(c => <option key={c.id} value={c.code!}>[{c.code}] {c.name}</option>)}
          </select>
          {!coded.length && <div style={{ fontSize: 12.5, color: T.danger, marginTop: 4 }}>Chưa khoá nào có mã — gán mã ở tab Khoá học trước.</div>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><FieldLabel>Số khoá (VD: 17)</FieldLabel><input style={inpS} value={so} onChange={e => setSo(e.target.value)} placeholder="17" /></div>
          <div><FieldLabel>Ngày khai giảng</FieldLabel><input style={inpS} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
          <div>
            <FieldLabel>Thứ trong tuần</FieldLabel>
            <select style={{ ...inpS, cursor: 'pointer' }} value={weekday} onChange={e => setWeekday(e.target.value)}>
              <option value="">— Chưa chốt —</option>
              {DOW_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div><FieldLabel>Giờ học</FieldLabel><input style={inpS} type="time" value={time} onChange={e => setTime(e.target.value)} /></div>
          <div><FieldLabel>Số buổi</FieldLabel><input style={inpS} value={totalSessions} onChange={e => setTotalSessions(e.target.value)} /></div>
          <div><FieldLabel>Phút / buổi</FieldLabel><input style={inpS} value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} /></div>
        </div>
        <div style={{ fontSize: 12.5, color: T.textMuted }}>Mã lớp tự ghép từ mã khoá + số (VD DH1 + 17 → DH1.KD17). Nhóm Zalo cùng mã tự tạo kèm. Có đủ ngày + thứ + giờ thì sinh luôn lịch buổi học; thiếu thì bổ sung sau ở form Lịch lớp.</div>
        <button onClick={submit} disabled={busy} style={{ ...btnPrimary, opacity: busy ? .6 : 1 }}>{busy ? 'Đang tạo...' : 'Tạo lớp'}</button>
      </div>
      {results && <ResultLines results={results} />}
    </Overlay>
  )
}

export default function StudentList({ onSelect }: Props) {
  const [packageRows, setPackageRows] = useState<StudentPackage[]>([])
  const [packageLoaded, setPackageLoaded] = useState(false)
  const [packageError, setPackageError] = useState('')
  const [packageFilter, setPackageFilter] = useState('all')
  useEffect(() => { let live = true; const refresh = () => loadStudentPackages().then(d => { if (live) { setPackageRows(d.records); setPackageLoaded(true); setPackageError('') } }).catch(e => { if (live) setPackageError(e.message) }); refresh(); const timer = window.setInterval(refresh, 60000); return () => { live = false; clearInterval(timer) } }, [])
  const [students, setStudents] = useState<Student[]>([])
  const [filtered, setFiltered] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  // Lớp = nhóm Zalo (edu_groups). Bấm lớp → lọc học sinh trong lớp đó.
  const [groups, setGroups] = useState<Grp[]>([])
  const [memberByGroup, setMemberByGroup] = useState<Record<string, Set<string>>>({})
  const [classFilter, setClassFilter] = useState('all')
  const [showAllClasses, setShowAllClasses] = useState(false)
  // BÁO CÁO QUẢN TRỊ
  const [showReport, setShowReport] = useState(false)
  const [courses, setCourses] = useState<{ id: string; name: string; code: string | null }[]>([])
  // Thao tác bằng tay (thay AI): tạo tài khoản / reset mật khẩu / thêm lớp
  const [showCreate, setShowCreate] = useState(false)
  const [showClass, setShowClass] = useState(false)
  const [resetTarget, setResetTarget] = useState<Student | null>(null)
  const [courseFilter, setCourseFilter] = useState('all')
  const [xpBy, setXpBy] = useState<Record<string, number>>({})
  const [lastBy, setLastBy] = useState<Record<string, string>>({})
  const [doneBy, setDoneBy] = useState<Record<string, number>>({})
  const [accessBy, setAccessBy] = useState<Record<string, number>>({})         // số khoá đã mở
  const [studentsByCourse, setStudentsByCourse] = useState<Record<string, Set<string>>>({})  // course_id → student_id (ghi danh)

  // Tải lại danh sách + nhóm sau khi tạo học sinh / lớp bằng tay
  const reloadStudents = () => {
    supabase.from('edu_students').select('id,user_id,full_name,email,phone,level,is_active,enrolled_at')
      .order('full_name').then(({ data }) => setStudents((data ?? []) as Student[]))
    supabase.from('edu_groups').select('id,name,zalo_url,group_type').eq('is_active', true).order('name')
      .then(({ data }) => setGroups((data ?? []).filter((g: any) => g.group_type !== 'facebook') as Grp[]))
    supabase.from('edu_group_members').select('user_id,group_id').eq('status', 'active')
      .then(({ data }) => {
        const m: Record<string, Set<string>> = {}
        ;(data ?? []).forEach((r: any) => { (m[r.group_id] ??= new Set()).add(r.user_id) })
        setMemberByGroup(m)
      })
  }

  useEffect(() => {
    supabase.from('edu_students').select('id,user_id,full_name,email,phone,level,is_active,enrolled_at')
      .order('full_name').then(({ data }) => {
        setStudents((data ?? []) as Student[])
        setFiltered((data ?? []) as Student[])
        setLoading(false)
      })
    supabase.from('edu_groups').select('id,name,zalo_url,group_type').eq('is_active', true).order('name')
      .then(({ data }) => setGroups((data ?? []).filter((g: any) => g.group_type !== 'facebook') as Grp[]))
    supabase.from('edu_group_members').select('user_id,group_id').eq('status', 'active')
      .then(({ data }) => {
        const m: Record<string, Set<string>> = {}
        ;(data ?? []).forEach((r: any) => { (m[r.group_id] ??= new Set()).add(r.user_id) })
        setMemberByGroup(m)
      })
    // Chỉ số cho BÁO CÁO
    supabase.from('edu_courses').select('id,name,code,sort_order').order('sort_order')
      .then(({ data }) => setCourses((data ?? []).map((c: any) => ({ id: c.id, name: c.name, code: c.code ?? null }))))
    // Gom XP/bài/khoá Ở PHÍA DB (RPC) — tránh giới hạn 1000 dòng làm mất số của học viên nhiều dữ liệu
    supabase.rpc('report_stats').then(({ data }) => {
      const xp: Record<string, number> = {}, last: Record<string, string> = {}, done: Record<string, number> = {}, acc: Record<string, number> = {}
      ;(data ?? []).forEach((r: any) => {
        xp[r.student_id] = Number(r.total_xp) || 0
        if (r.last_at) last[r.student_id] = r.last_at
        done[r.student_id] = Number(r.done) || 0
        acc[r.student_id] = Number(r.opened) || 0
      })
      setXpBy(xp); setLastBy(last); setDoneBy(done); setAccessBy(acc)
    })
    supabase.from('edu_enrollments').select('student_id,course_id').eq('is_active', true)
      .then(({ data }) => { const m: Record<string, Set<string>> = {}; (data ?? []).forEach((r: any) => { (m[r.course_id] ??= new Set()).add(r.student_id) }); setStudentsByCourse(m) })
  }, [])

  useEffect(() => {
    let result = students
    if (classFilter !== 'all') {
      const ids = memberByGroup[classFilter] ?? new Set()
      result = result.filter(s => s.user_id && ids.has(s.user_id))
    }
    if (courseFilter !== 'all') {
      const sids = studentsByCourse[courseFilter] ?? new Set()
      result = result.filter(s => sids.has(s.id))
    }
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(s =>
        s.full_name?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.phone?.includes(q)
      )
    }
    if (levelFilter !== 'all') result = result.filter(s => s.level === levelFilter)
    if (statusFilter === 'active') result = result.filter(s => s.is_active)
    if (statusFilter === 'inactive') result = result.filter(s => !s.is_active)
    if (packageFilter !== 'all') result = result.filter(s => { const rows = packageRows.filter(r => r.student_id === s.id); if (packageFilter === 'none') return !rows.length; if (packageFilter === 'expired') return !rows.some(r => r.is_active) && rows.some(r => ['expired','cancelled','revoked','past_due'].includes(r.display_status)); return rows.some(r => packageFilter === 'active' ? r.is_active : packageFilter === 'expiring' ? r.display_status === 'expiring' : r.source === packageFilter) })
    setFiltered(result)
  }, [search, levelFilter, statusFilter, classFilter, courseFilter, students, memberByGroup, studentsByCourse, packageRows, packageFilter])

  const activeCount = students.filter(s => s.is_active).length
  const chip = (on: boolean): CSSProperties => ({ background: on ? T.header : T.bgCard, color: on ? '#fff' : T.text, border: `1px solid ${on ? T.header : T.border}`, borderRadius: 20, padding: '6px 14px', fontSize: 13, fontWeight: on ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' })
  // Lớp của 1 học sinh (gộp nhiều nhóm Zalo)
  const classNamesOf = (s: Student): string => {
    if (!s.user_id) return '—'
    const names = groups.filter(g => memberByGroup[g.id]?.has(s.user_id!)).map(g => g.name)
    return names.length ? names.join(', ') : '—'
  }
  const fmtDate = (iso?: string) => { if (!iso) return '—'; const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` }
  const reportTotalXP = filtered.reduce((a, s) => a + (xpBy[s.id] ?? 0), 0)
  // ── Số liệu tình hình học tập (theo danh sách đã lọc = theo lớp) ──
  const daysSince = (iso?: string): number | null => { if (!iso) return null; return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) }
  const INACTIVE_DAYS = 7
  const isInactive = (s: Student) => { const d = daysSince(lastBy[s.id]); return d === null || d >= INACTIVE_DAYS }
  const reportDone = filtered.reduce((a, s) => a + (doneBy[s.id] ?? 0), 0)
  const reportInactive = filtered.filter(isInactive).length
  const classLabel = classFilter === 'all' ? 'Tất cả lớp' : (groups.find(g => g.id === classFilter)?.name ?? 'Lớp')
  const exportCSV = () => {
    const head = ['Họ tên', 'Email/ĐT', 'Lớp', 'Trình độ', 'XP', 'Bài xong', 'Khoá đã mở', 'Hoạt động gần nhất', 'Ngày chưa học']
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = [...filtered].sort((a, b) => (xpBy[b.id] ?? 0) - (xpBy[a.id] ?? 0)).map(s => {
      const d = daysSince(lastBy[s.id])
      return [s.full_name, s.email ?? s.phone ?? '', classNamesOf(s), LEVEL_LABEL[s.level ?? ''] ?? '', xpBy[s.id] ?? 0, doneBy[s.id] ?? 0, accessBy[s.id] ?? 0, fmtDate(lastBy[s.id]), d === null ? 'chưa học' : d].map(esc).join(',')
    })
    const csv = '﻿' + [head.map(esc).join(','), ...rows].join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `bao-cao-hoc-tap-${classLabel.replace(/[^\w.-]+/g, '_')}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: 'Inter, system-ui, sans-serif', color: T.text }}>
      {/* Header */}
      <div style={{ background: T.bgCard, borderBottom: `1px solid ${T.border}`, padding: '14px 24px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>🎸 Danh sách học sinh</div>
            <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>
              {activeCount} đang học · {students.length} tổng
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setShowCreate(true)} style={{ background: T.gold, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>➕ Thêm học sinh</button>
          <button onClick={() => setShowClass(true)} style={{ background: '#fff', color: T.header, border: `1px solid ${T.border}`, borderRadius: 8, padding: '9px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>🏫 Thêm lớp</button>
          <button onClick={() => setShowReport(v => !v)} style={{ background: showReport ? '#fff' : T.header, color: showReport ? T.header : '#fff', border: `1px solid ${showReport ? T.border : T.header}`, borderRadius: 8, padding: '9px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {showReport ? '📇 Danh sách' : '📊 Báo cáo'}
          </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 24px' }}>
        {/* Lớp (nhóm Zalo) — bấm để lọc học sinh trong lớp */}
        {groups.length > 0 && (() => {
          // Gọn: chỉ hiện lớp CÓ học sinh, xếp theo sĩ số; lớp trống/còn lại nằm sau nút "xem thêm"
          const sized = groups.map(g => ({ g, n: memberByGroup[g.id]?.size ?? 0 }))
          const active = sized.filter(x => x.n > 0).sort((a, b) => b.n - a.n)
          const empty = sized.filter(x => x.n === 0)
          const MAX = 8
          const shown = showAllClasses ? [...active, ...empty] : active.slice(0, MAX)
          const hidden = active.length - Math.min(active.length, MAX) + empty.length
          return (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, marginBottom: 8, letterSpacing: '.05em' }}>LỚP (NHÓM ZALO)</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={() => setClassFilter('all')} style={chip(classFilter === 'all')}>Tất cả ({students.length})</button>
              {shown.map(({ g, n }) => (
                <button key={g.id} onClick={() => setClassFilter(g.id)} style={{ ...chip(classFilter === g.id), opacity: n === 0 ? .55 : 1 }}>{g.name} ({n})</button>
              ))}
              {!showAllClasses && hidden > 0 && (
                <button onClick={() => setShowAllClasses(true)} style={{ ...chip(false), color: T.textMuted, borderStyle: 'dashed' }}>+{hidden} lớp ▾</button>
              )}
              {showAllClasses && (
                <button onClick={() => setShowAllClasses(false)} style={{ ...chip(false), color: T.textMuted, borderStyle: 'dashed' }}>Thu gọn ▴</button>
              )}
            </div>
            {classFilter !== 'all' && (() => {
              const g = groups.find(x => x.id === classFilter)
              return g?.zalo_url ? <a href={g.zalo_url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 10, fontSize: 13, color: T.green, fontWeight: 700 }}>💬 Mở nhóm Zalo {g.name} →</a> : null
            })()}
          </div>
          )
        })()}
        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Tìm tên, email, số điện thoại..."
            style={{
              flex: 1, minWidth: 200, background: T.bgCard, border: `1px solid ${T.border}`,
              borderRadius: 8, color: T.text, padding: '9px 14px', fontSize: 15, outline: 'none',
            }}
          />
          <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)} style={{
            background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8,
            color: T.text, padding: '9px 14px', fontSize: 14, cursor: 'pointer',
          }}>
            <option value="all">Tất cả trình độ</option>
            <option value="beginner">Mới bắt đầu</option>
            <option value="elementary">Cơ bản</option>
            <option value="intermediate">Trung cấp</option>
            <option value="advanced">Nâng cao</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{
            background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8,
            color: T.text, padding: '9px 14px', fontSize: 14, cursor: 'pointer',
          }}>
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang học</option>
            <option value="inactive">Ngừng học</option>
          </select>
          <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} style={{
            background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8,
            color: T.text, padding: '9px 14px', fontSize: 14, cursor: 'pointer', maxWidth: 220,
          }}>
            <option value="all">Tất cả khoá học</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {packageError && <div role="alert" style={{ color: T.danger }}>Chưa tải được gói học: {packageError}</div>}
        <select aria-label="Lọc gói học" value={packageFilter} onChange={e => setPackageFilter(e.target.value)} style={{ ...inpS, width: 'auto', marginBottom: 12 }}>
          {Object.entries({all:'Tất cả gói',active:'Đang hiệu lực',expiring:'Sắp hết hạn 7 ngày',expired:'Đã hết hạn / kết thúc',none:'Không có gói',apple:'Apple',google_play:'Google Play',web:'Web',admin:'Admin'}).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {/* Count */}
        <div style={{ fontSize: 14, color: T.textMuted, marginBottom: 12 }}>
          Hiển thị {filtered.length} / {students.length} học sinh
        </div>

        {/* List */}
        {loading ? (
          <div style={{ textAlign: 'center', color: T.textMuted, padding: 40 }}>Đang tải...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: T.textMuted, padding: 40 }}>Không tìm thấy học sinh nào.</div>
        ) : showReport ? (
          <div>
            {/* Tiêu đề lớp + xuất CSV */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: T.header }}>Tình hình học tập — <span style={{ color: T.gold }}>{classLabel}</span></div>
              <button onClick={exportCSV} disabled={!filtered.length} style={{ background: T.bgCard, color: T.header, border: `1px solid ${T.border}`, borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: filtered.length ? 'pointer' : 'default', fontFamily: 'inherit', opacity: filtered.length ? 1 : .5 }}>⬇ Xuất CSV</button>
            </div>
            {/* Tóm tắt */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
              {[
                { l: 'Học sinh', v: filtered.length, c: T.header },
                { l: 'Tổng XP', v: reportTotalXP.toLocaleString(), c: T.header },
                { l: 'XP trung bình', v: Math.round(reportTotalXP / Math.max(filtered.length, 1)).toLocaleString(), c: T.header },
                { l: 'Tổng bài xong', v: reportDone.toLocaleString(), c: T.header },
                { l: `Chưa học ≥${INACTIVE_DAYS} ngày`, v: reportInactive, c: reportInactive > 0 ? T.danger : T.green },
              ].map(b => (
                <div key={b.l} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 16px', minWidth: 110 }}>
                  <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700 }}>{b.l}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: b.c }}>{b.v}</div>
                </div>
              ))}
            </div>
            <div style={{ overflowX: 'auto', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 760 }}>
                <thead>
                  <tr style={{ background: T.greenLight, textAlign: 'left', color: T.header }}>
                    <th style={rTh}>Học sinh</th>
                    <th style={rTh}>Lớp</th>
                    <th style={rTh}>Trình độ</th>
                    <th style={{ ...rTh, textAlign: 'right' }}>XP</th>
                    <th style={{ ...rTh, textAlign: 'right' }}>Bài xong</th>
                    <th style={{ ...rTh, textAlign: 'right' }}>Khoá đã mở</th>
                    <th style={rTh}>Hoạt động gần nhất</th>
                  </tr>
                </thead>
                <tbody>
                  {[...filtered].sort((a, b) => (xpBy[b.id] ?? 0) - (xpBy[a.id] ?? 0)).map(s => {
                    const d = daysSince(lastBy[s.id]); const inact = d === null || d >= INACTIVE_DAYS
                    return (
                    <tr key={s.id} onClick={() => onSelect(s.id)} style={{ borderTop: `1px solid ${T.borderLight}`, cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = T.bgCardHover)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={rTd}>
                        <div style={{ fontWeight: 700, color: T.text }}>{s.full_name}{!s.is_active && <span style={{ color: T.danger, fontWeight: 500, fontSize: 12 }}> · ngừng</span>}</div>
                        <div style={{ fontSize: 12, color: T.textDim }}>{s.email ?? s.phone ?? '—'}</div>
                      </td>
                      <td style={{ ...rTd, color: T.textMuted }}>{classNamesOf(s)}</td>
                      <td style={{ ...rTd, color: s.level ? (LEVEL_COLOR[s.level] ?? T.textMuted) : T.textDim, fontWeight: 600 }}>{LEVEL_LABEL[s.level ?? ''] ?? '—'}</td>
                      <td style={{ ...rTd, textAlign: 'right', fontWeight: 800, color: T.gold }}>{(xpBy[s.id] ?? 0).toLocaleString()}</td>
                      <td style={{ ...rTd, textAlign: 'right' }}>{doneBy[s.id] ?? 0}</td>
                      <td style={{ ...rTd, textAlign: 'right' }}>{accessBy[s.id] ?? 0}</td>
                      <td style={{ ...rTd, color: inact ? T.danger : T.textMuted, fontWeight: inact ? 700 : 400 }}>{d === null ? 'chưa học' : fmtDate(lastBy[s.id]) + (inact ? ` · ${d}n` : '')}</td>
                    </tr>
                  ) })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 680 }}>
              <thead>
                <tr style={{ background: T.greenLight, textAlign: 'left', color: T.header }}>
                  <th style={rTh}>Học sinh</th>
                  <th style={rTh}>Lớp</th>
                  <th style={rTh}>Trình độ</th>
                  <th style={rTh}>Trạng thái</th>
                  <th style={rTh}>Gói · Hết hạn · Nguồn</th>
                  <th style={{ ...rTh, textAlign: 'center' }}>Mật khẩu</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} onClick={() => onSelect(s.id)} style={{ borderTop: `1px solid ${T.borderLight}`, cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = T.bgCardHover)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ ...rTd, maxWidth: 260 }}>
                      <div style={{ fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.full_name}</div>
                      <div style={{ fontSize: 12, color: T.textDim, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.email ?? s.phone ?? '—'}</div>
                    </td>
                    <td style={{ ...rTd, color: T.textMuted, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{classNamesOf(s)}</td>
                    <td style={rTd}>
                      {s.level ? (
                        <span style={{ fontSize: 11.5, fontWeight: 700, borderRadius: 5, padding: '3px 8px', background: LEVEL_COLOR[s.level] + '18', color: LEVEL_COLOR[s.level] }}>{LEVEL_LABEL[s.level]}</span>
                      ) : <span style={{ color: T.textDim }}>—</span>}
                    </td>
                    <td style={rTd}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, borderRadius: 5, padding: '3px 8px', background: s.is_active ? T.greenLight : '#FEE2E2', color: s.is_active ? T.green : T.danger }}>
                        {s.is_active ? 'Đang học' : 'Ngừng'}
                      </span>
                    </td>
                    <td style={{ ...rTd, color: T.textMuted }}>{packageError ? 'Chưa tải được' : !packageLoaded ? 'Đang tải gói…' : packageSummary(packageRows.filter(r => r.student_id === s.id)).map(r => <div key={r.id} style={{ whiteSpace: 'normal', minWidth: 180, marginBottom: 6 }}><b>{r.name}</b><div>{packageDate(r.renews_at)}</div><div style={{ color: r.display_status === 'expiring' ? T.warn : r.is_active ? T.green : T.textMuted }}>{PACKAGE_STATUS[r.display_status] ?? r.display_status} · {PACKAGE_SOURCE[r.source] ?? r.source}</div></div>)}{packageLoaded && !packageError && !packageRows.some(r => r.student_id === s.id) && 'Không có gói'}</td>
                    <td style={{ ...rTd, textAlign: 'center' }}>
                      <button title="Đặt lại mật khẩu" onClick={e => { e.stopPropagation(); setResetTarget(s) }} style={{
                        border: `1px solid ${T.border}`, background: T.bgCard, borderRadius: 6,
                        padding: '3px 9px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
                      }}>🔑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal thao tác bằng tay */}
      {showCreate && <CreateStudentModal groups={groups} onClose={() => setShowCreate(false)} onDone={reloadStudents} />}
      {showClass && <CreateClassModal courses={courses} onClose={() => setShowClass(false)} onDone={reloadStudents} />}
      {resetTarget && <ResetPasswordModal student={resetTarget} onClose={() => setResetTarget(null)} />}
    </div>
  )
}