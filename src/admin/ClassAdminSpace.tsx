// Admin V2 — Lớp học làm trung tâm: /admin/lop (danh sách) và /admin/lop/<id>[/<tab>] (không gian một lớp).
// Chỉ ĐỌC dữ liệu và ghép các màn hiện có (ClassCurriculumAdminView, ClassJoinCode). Mọi chỉnh sửa lịch/thiết lập
// tiếp tục ở màn "Lớp & lịch". Thành viên lấy từ RPC canonical (docs/CLASS-MEMBERSHIP-CANONICAL.md), không suy từ nguồn khác.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import ClassCurriculumAdminView from './ClassCurriculumAdminView'
import ClassJoinCode from './ClassJoinCode'
import { adminClassPath, CLASS_TABS, parseAdminClassPath, type AdminSection, type ClassTab } from './adminNav'
import { WEEKDAYS, scheduleText, statusInfo, STATUS } from '../journey/sessions'
import { sessionStatusLabel } from './sessionStatus'
import './adminClass.css'

interface ClassRow {
  id: string; code: string | null; name: string; status: string; cohort_group_id: string | null
  start_date: string | null; end_date: string | null; weekday: number | null; start_time: string | null
  duration_minutes: number | null; total_sessions: number | null; zoom_url: string | null; program_code: string | null
}
interface SummaryRow { class_id: string; group_name?: string | null; member_count: number }
interface SessionRow { id: string; session_number: number | null; start_at: string; end_at: string | null; status: string | null; event_type: string | null; title: string | null }

const CLASS_COLS = 'id,code,name,status,cohort_group_id,start_date,end_date,weekday,start_time,duration_minutes,total_sessions,zoom_url,program_code'
const CLOSED = ['cancelled', 'merged', 'completed']
const RANK = ['active', 'upcoming', 'scheduled', 'ready_to_open', 'recruiting', 'paused', 'completed', 'draft']
const rank = (s: string) => { const i = RANK.indexOf(s); return i < 0 ? 99 : i }
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase()
const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
const fmtDateTime = (iso: string | null) => iso ? new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

function StatusBadge({ status }: { status: string }) {
  const info = statusInfo(status)
  return <span className="ac-badge"><i style={{ background: info.c }} aria-hidden />{info.l}</span>
}

// Link thật: chuột giữa / mở tab mới dùng được; click thường đi qua navigate của shell (không tải lại trang).
function NavLink({ href, navigate, className, children, ...rest }: { href: string; navigate: (p: string) => void; className?: string; children: React.ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  return <a href={href} className={className} {...rest}
    onClick={e => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; e.preventDefault(); navigate(href) }}>{children}</a>
}

interface Props { pathname: string; navigate: (path: string) => void; goSection: (id: AdminSection) => void }

export default function ClassAdminSpace({ pathname, navigate, goSection }: Props) {
  const route = parseAdminClassPath(pathname)
  // Tab không hợp lệ → sửa URL về tổng quan, không thêm history.
  useEffect(() => {
    if (route && !route.tabValid) window.history.replaceState(null, '', adminClassPath(route.classKey))
  }, [route?.classKey, route?.tabValid]) // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="ac-root">
    {route
      ? <ClassDetail key={route.classKey} classKey={route.classKey} tab={route.tab} navigate={navigate} goSection={goSection} />
      : <ClassList navigate={navigate} goSection={goSection} />}
  </div>
}

// ── Danh sách lớp ────────────────────────────────────────────────────────────
function ClassList({ navigate, goSection }: Pick<Props, 'navigate' | 'goSection'>) {
  const [rows, setRows] = useState<ClassRow[] | null>(null)
  const [summary, setSummary] = useState<Record<string, SummaryRow> | null>(null)
  const [next, setNext] = useState<Record<string, string> | null>(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('open')

  useEffect(() => {
    let off = false
    ;(async () => {
      const [cls, sum, ses] = await Promise.all([
        supabase.from('class_schedule').select(CLASS_COLS).order('code'),
        supabase.rpc('admin_class_member_summary'),
        supabase.from('class_sessions').select('class_id,start_at,status').gte('start_at', new Date().toISOString()).order('start_at').limit(2000),
      ])
      if (off) return
      if (cls.error) { setError(cls.error.message); setRows([]); return }
      setRows((cls.data ?? []) as ClassRow[])
      setSummary(sum.error ? null : Object.fromEntries(((sum.data ?? []) as SummaryRow[]).map(r => [r.class_id, r])))
      if (ses.error) setNext(null)
      else {
        const m: Record<string, string> = {}
        for (const s of (ses.data ?? []) as { class_id: string; start_at: string; status: string | null }[]) {
          if (s.status === 'cancelled') continue
          if (!m[s.class_id]) m[s.class_id] = s.start_at
        }
        setNext(m)
      }
      if (sum.error || ses.error) setError('Một phần dữ liệu chưa tải được; ô tương ứng hiển thị "—".')
    })()
    return () => { off = true }
  }, [])

  const statuses = useMemo(() => [...new Set((rows ?? []).map(r => r.status))].sort((a, b) => rank(a) - rank(b)), [rows])
  const shown = useMemo(() => {
    const needle = plain(q.trim())
    return (rows ?? [])
      .filter(r => filter === 'all' ? true : filter === 'open' ? !CLOSED.includes(r.status) && r.status !== 'draft' : r.status === filter)
      .filter(r => !needle || plain(`${r.name} ${r.code ?? ''}`).includes(needle))
      .sort((a, b) => rank(a.status) - rank(b.status) || (a.code ?? '').localeCompare(b.code ?? ''))
  }, [rows, q, filter])

  return <>
    <header className="ac-head">
      <h1 className="ac-title">Danh sách lớp</h1>
      <button type="button" className="ac-btn" onClick={() => goSection('schedule')}>＋ Tạo lớp mới</button>
    </header>
    <div className="ac-toolbar">
      <input className="ac-input" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm theo tên hoặc mã lớp" aria-label="Tìm lớp" />
      <select className="ac-input" value={filter} onChange={e => setFilter(e.target.value)} aria-label="Lọc theo trạng thái">
        <option value="open">Đang hoạt động</option>
        <option value="all">Tất cả</option>
        {statuses.map(s => <option key={s} value={s}>{STATUS.find(x => x.v === s)?.l ?? s}</option>)}
      </select>
    </div>
    {error && <div role="alert" className="ac-note ac-note-err">{error}</div>}
    {rows === null ? <div className="ac-empty" role="status">Đang tải lớp…</div>
      : shown.length === 0 ? <div className="ac-empty">{rows.length === 0 ? 'Chưa có lớp.' : 'Không có lớp nào khớp.'}</div>
      : <ul className="ac-list">
        {shown.map(r => {
          const s = summary?.[r.id]
          const members = summary === null ? '—' : s ? `${s.member_count} học viên` : 'Chưa có nhóm'
          const nxt = next === null ? '—' : next[r.id] ? fmtDateTime(next[r.id]) : 'Chưa có buổi sắp tới'
          return <li key={r.id}>
            <NavLink href={adminClassPath(r.id)} navigate={navigate} className="ac-row">
              <span className="ac-row-main">
                <span className="ac-row-name">{r.name}</span>
                <span className="ac-row-sub">{r.code ?? 'Chưa có mã'} · <StatusBadge status={r.status} /></span>
              </span>
              <span className="ac-row-meta">
                <span>{members}</span>
                <span>Buổi kế: {nxt}</span>
              </span>
              <span className="ac-chev" aria-hidden>›</span>
            </NavLink>
          </li>
        })}
      </ul>}
  </>
}

// ── Chi tiết một lớp ─────────────────────────────────────────────────────────
function ClassDetail({ classKey, tab, navigate, goSection }: { classKey: string; tab: ClassTab } & Pick<Props, 'navigate' | 'goSection'>) {
  const [cls, setCls] = useState<ClassRow | null | undefined>(undefined)   // undefined = đang tải, null = không có
  const [summary, setSummary] = useState<SummaryRow | null | undefined>(undefined)
  const [sessions, setSessions] = useState<SessionRow[] | null>(null)
  const [error, setError] = useState('')
  const [openedAt] = useState(() => Date.now())

  useEffect(() => {
    let off = false
    ;(async () => {
      const c = await supabase.from('class_schedule').select(CLASS_COLS).eq('id', classKey).maybeSingle()
      if (off) return
      if (c.error) { setError(c.error.message); setCls(null); return }
      if (!c.data) { setCls(null); return }
      const row = c.data as ClassRow
      setCls(row)
      const [sum, ses] = await Promise.all([
        supabase.rpc('admin_class_member_summary'),
        supabase.from('class_sessions').select('id,session_number,start_at,end_at,status,event_type,title').eq('class_id', row.id).order('start_at'),
      ])
      if (off) return
      setSummary(sum.error ? undefined : (((sum.data ?? []) as SummaryRow[]).find(r => r.class_id === row.id) ?? null))
      if (ses.error) setError(ses.error.message); else setSessions((ses.data ?? []) as SessionRow[])
    })()
    return () => { off = true }
  }, [classKey])

  const back = <NavLink href="/admin/lop" navigate={navigate} className="ac-back">‹ Danh sách lớp</NavLink>

  if (cls === undefined) return <><div className="ac-head">{back}</div><div className="ac-empty" role="status">Đang tải lớp…</div></>
  if (cls === null) return <>
    <div className="ac-head">{back}</div>
    <div className="ac-empty" role="alert">{error || 'Không tìm thấy lớp này (có thể đã bị xoá hoặc liên kết sai).'}</div>
  </>

  const memberText = summary === undefined ? '—' : summary ? `${summary.member_count} học viên` : 'Chưa có nhóm thành viên'
  const upcoming = (sessions ?? []).find(s => s.status !== 'cancelled' && new Date(s.start_at).getTime() >= openedAt)
  const canJoinCode = !!cls.cohort_group_id && !CLOSED.includes(cls.status)
  const tabHref = (t: ClassTab) => adminClassPath(cls.id, t)

  return <>
    <header className="ac-head ac-head-detail">
      {back}
      <h1 className="ac-title">{cls.name?.trim() || cls.code || 'Lớp chưa đặt tên'}</h1>
      <div className="ac-meta">
        <span className="ac-code">Mã lớp: <b>{cls.code ?? 'Chưa có'}</b></span>
        <StatusBadge status={cls.status} />
      </div>
      {/* Điện thoại: một nút chọn mục (HIG menu button) thay vì ép 5 tab vào một hàng; ≥768px: segmented */}
      <select className="ac-input ac-tabs-select" value={tab} aria-label="Mục của lớp"
        onChange={e => navigate(tabHref(e.target.value as ClassTab))}>
        {CLASS_TABS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
      </select>
      <nav className="ac-tabs" aria-label="Mục của lớp">
        {CLASS_TABS.map(t => <NavLink key={t.id} href={tabHref(t.id)} navigate={navigate} className="ac-tab"
          aria-current={t.id === tab ? 'page' : undefined}>{t.label}</NavLink>)}
      </nav>
    </header>

    {error && <div role="alert" className="ac-note ac-note-err">{error}</div>}

    {tab === 'overview' && <>
      <dl className="ac-card ac-facts">
        <div><dt>Học viên</dt><dd>{memberText}</dd></div>
        <div><dt>Buổi kế tiếp</dt><dd>{sessions === null ? '—' : upcoming ? fmtDateTime(upcoming.start_at) : 'Chưa có buổi sắp tới'}</dd></div>
        <div><dt>Lịch cố định</dt><dd>{scheduleText(cls.weekday, cls.start_time) || '—'}{cls.duration_minutes ? ` · ${cls.duration_minutes} phút` : ''}</dd></div>
        <div><dt>Thời gian</dt><dd>{fmtDate(cls.start_date)} → {fmtDate(cls.end_date)}</dd></div>
        <div><dt>Số buổi</dt><dd>{cls.total_sessions ?? '—'}</dd></div>
        <div><dt>Nhóm thành viên</dt><dd>{summary?.group_name ?? (summary === undefined ? '—' : 'Chưa có')}</dd></div>
      </dl>
      <div className="ac-shortcuts">
        {([['students', 'Học viên'], ['curriculum', 'Giáo trình'], ['schedule', 'Lịch học']] as const).map(([t, label]) =>
          <NavLink key={t} href={tabHref(t)} navigate={navigate} className="ac-shortcut">{label} <span aria-hidden>›</span></NavLink>)}
      </div>
      {canJoinCode && <section className="ac-card"><h2 className="ac-h2">Mã tham gia lớp</h2><ClassJoinCode key={cls.id} client={supabase} classId={cls.id} /></section>}
    </>}

    {tab === 'schedule' && <section className="ac-card">
      <div className="ac-card-head">
        <h2 className="ac-h2">Lịch học</h2>
        <button type="button" className="ac-btn" onClick={() => goSection('schedule')}>Chỉnh lịch ở Lớp & lịch</button>
      </div>
      {sessions === null ? <div className="ac-empty" role="status">Đang tải buổi học…</div>
        : sessions.length === 0 ? <div className="ac-empty">Lớp chưa có buổi học nào.</div>
        : <ul className="ac-sessions">
          {sessions.map(s => <li key={s.id} className="ac-session">
            <span className="ac-session-no">{s.event_type === 'break' ? 'Nghỉ' : s.session_number != null ? `Buổi ${s.session_number}` : 'Sự kiện'}</span>
            <span className="ac-session-when">{fmtDateTime(s.start_at)}</span>
            <span className="ac-session-title">{s.title ?? ''}</span>
            <span className={`ac-session-status${s.status === 'cancelled' ? ' is-off' : ''}`}>{sessionStatusLabel(s.status)}</span>
          </li>)}
        </ul>}
      <p className="ac-hint">Múi giờ hiển thị: Việt Nam. Thứ trong tuần: {WEEKDAYS.join(', ')} (quy ước hệ thống).</p>
    </section>}

    {tab === 'students' && <section className="ac-card"><ClassCurriculumAdminView client={supabase} classId={cls.id} part="students" /></section>}
    {tab === 'curriculum' && <section><ClassCurriculumAdminView client={supabase} classId={cls.id} part="curriculum" /></section>}

    {tab === 'settings' && <>
      <dl className="ac-card ac-facts">
        <div><dt>Tên lớp</dt><dd>{cls.name}</dd></div>
        <div><dt>Mã lớp</dt><dd>{cls.code ?? '—'}</dd></div>
        <div><dt>Trạng thái</dt><dd>{statusInfo(cls.status).l}</dd></div>
        <div><dt>Chương trình</dt><dd>{cls.program_code ?? '—'}</dd></div>
        <div><dt>Link Zoom</dt><dd>{cls.zoom_url ? <a href={cls.zoom_url} target="_blank" rel="noreferrer">Mở link</a> : '—'}</dd></div>
        <div><dt>Nhóm thành viên</dt><dd>{summary?.group_name ?? (summary === undefined ? '—' : 'Chưa có')}</dd></div>
      </dl>
      {canJoinCode && <section className="ac-card"><h2 className="ac-h2">Mã tham gia lớp</h2><ClassJoinCode key={cls.id} client={supabase} classId={cls.id} /></section>}
      <section className="ac-card">
        <h2 className="ac-h2">Chỉnh sửa lớp</h2>
        <p className="ac-hint">Đổi tên, lịch, khoá học, nhóm Zalo, trạng thái hoặc xoá lớp được thực hiện ở màn Lớp & lịch.</p>
        <button type="button" className="ac-btn" onClick={() => goSection('schedule')}>Mở Lớp & lịch</button>
      </section>
    </>}
  </>
}
