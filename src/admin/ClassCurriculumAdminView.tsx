import React, { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { supabase } from '../supabase'
import ClassCurriculumEditor from './ClassCurriculumEditor'
import ClassJoinCode from './ClassJoinCode'

// Mọi lớp chưa huỷ/gộp. Thành viên = nhóm CANONICAL của lớp (RPC class_roster / admin_class_member_summary —
// cùng nguồn Social/App; docs/CLASS-MEMBERSHIP-CANONICAL.md). Thành viên ≠ quyền Giáo trình.
const LIVE_FIRST = ['active', 'ending_soon', 'scheduled', 'upcoming', 'ready_to_open', 'recruiting', 'paused', 'completed']

interface ClassRow {
  id: string
  code: string
  name: string
  cohort_group_id: string | null
  status: string
}
interface StudentRow {
  id: string
  user_id: string | null
  display_name: string | null
  full_name: string | null
  email: string | null
  is_active: boolean
}
interface MemberRow {
  user_id: string
  status: string
  updated_at: string | null
}
interface RosterRow {
  user_id: string; status: string; updated_at: string | null; joined_at: string | null
  student_id: string | null; name: string; email: string | null; student_active: boolean | null
}
interface SummaryRow { class_id: string; group_name: string | null; group_code: string | null; group_type: string | null; member_count: number }
interface AccessRow {
  user_id: string
  status: string
  granted_at: string
  revoked_at: string | null
}

const C = { bg: '#F4F4F5', card: '#FFFFFF', border: '#E4E4E7', text: '#18181B', muted: '#52525B',
  green: '#2D6A4F', greenBg: '#E9F3EC', red: '#B91C1C', redBg: '#FEE2E2' }
const button: CSSProperties = { border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px',
  background: C.card, color: C.text, font: '600 13px Inter, system-ui, sans-serif', cursor: 'pointer' }
const fmt = (value: string | null) => value ? new Date(value).toLocaleString('vi-VN') : '—'
const nameOf = (student?: StudentRow) => student?.display_name?.trim() || student?.full_name?.trim() || student?.email || 'Học viên'

interface Props { client: Pick<typeof supabase, 'from' | 'rpc'> }

export default function ClassCurriculumAdminView({ client }: Props) {
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [members, setMembers] = useState<MemberRow[]>([])
  const [students, setStudents] = useState<Record<string, StudentRow>>({})
  const [access, setAccess] = useState<Record<string, AccessRow>>({})
  const [summary, setSummary] = useState<Record<string, SummaryRow>>({})
  const [tab, setTab] = useState<'students' | 'curriculum'>('students')
  const [search, setSearch] = useState('')
  const [matches, setMatches] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const classLoadId = useRef(0)
  const selected = classes.find(c => c.id === selectedId)
  const activeMembers = members.filter(m => m.status === 'active')
  const inactiveMembers = members.filter(m => m.status !== 'active')

  const loadClasses = useCallback(async () => {
    setLoading(true)
    const [{ data, error: loadError }, sum] = await Promise.all([
      client.from('class_schedule').select('id,code,name,cohort_group_id,status').not('status', 'in', '(cancelled,merged,draft)').order('code'),
      client.rpc('admin_class_member_summary'),
    ])
    if (loadError || sum.error) setError(loadError?.message || sum.error?.message || 'Không tải được lớp')
    setSummary(Object.fromEntries(((sum.data ?? []) as SummaryRow[]).map(r => [r.class_id, r])))
    const rank = (st: string) => { const i = LIVE_FIRST.indexOf(st); return i < 0 ? 99 : i }
    const rows = ((data ?? []) as ClassRow[]).sort((a, b) => rank(a.status) - rank(b.status) || a.code.localeCompare(b.code))
    setClasses(rows)
    setSelectedId(current => rows.some(row => row.id === current) ? current : (rows[0]?.id ?? ''))
    setLoading(false)
  }, [client])

  const loadClass = useCallback(async (cls: ClassRow) => {
    const loadId = ++classLoadId.current
    setError('')
    if (!cls.cohort_group_id) { setMembers([]); setStudents({}); setAccess({}); return }
    const [memberResult, accessResult] = await Promise.all([
      client.rpc('class_roster', { p_class: cls.id }),
      client.from('class_curriculum_access').select('user_id,status,granted_at,revoked_at').eq('class_id', cls.id),
    ])
    if (loadId !== classLoadId.current) return
    if (memberResult.error || accessResult.error) {
      setError(memberResult.error?.message || accessResult.error?.message || 'Không tải được quyền lớp')
      return
    }
    const roster = (memberResult.data ?? []) as RosterRow[]
    setMembers(roster.map(r => ({ user_id: r.user_id, status: r.status, updated_at: r.joined_at ?? r.updated_at })))
    setStudents(Object.fromEntries(roster.map(r => [r.user_id, {
      id: r.student_id ?? '', user_id: r.user_id, display_name: r.name, full_name: r.name, email: r.email, is_active: r.student_active ?? false,
    } as StudentRow])))
    setAccess(Object.fromEntries(((accessResult.data ?? []) as AccessRow[]).map(row => [row.user_id, row])))
  }, [client])

  useEffect(() => { void loadClasses() }, [loadClasses])
  useEffect(() => { if (selected) void loadClass(selected) }, [selectedId, classes, loadClass])

  useEffect(() => {
    const query = search.trim()
    if (!selected || !selected.cohort_group_id || query.length < 2) { setMatches([]); return }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      const pattern = `%${query}%`
      const [byName, byDisplayName, byEmail] = await Promise.all([
        client.from('edu_students').select('id,user_id,display_name,full_name,email,is_active')
          .eq('is_active', true).ilike('full_name', pattern).limit(15),
        client.from('edu_students').select('id,user_id,display_name,full_name,email,is_active')
          .eq('is_active', true).ilike('display_name', pattern).limit(15),
        client.from('edu_students').select('id,user_id,display_name,full_name,email,is_active')
          .eq('is_active', true).ilike('email', pattern).limit(15),
      ])
      if (cancelled) return
      if (byName.error || byDisplayName.error || byEmail.error) { setError(byName.error?.message || byDisplayName.error?.message || byEmail.error?.message || 'Tìm kiếm thất bại'); return }
      const combined = [...((byName.data ?? []) as StudentRow[]), ...((byDisplayName.data ?? []) as StudentRow[]), ...((byEmail.data ?? []) as StudentRow[])]
      const unique = new Map(combined.filter(row => row.user_id).map(row => [row.user_id as string, row]))
      setMatches([...unique.values()].filter(row => !activeMembers.some(member => member.user_id === row.user_id)).slice(0, 20))
    }, 250)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [search, selectedId, selected?.cohort_group_id, members, client])

  const membershipAction = async (userId: string, action: 'add' | 'remove') => {
    if (!selected) return
    if (action === 'remove' && !window.confirm('Bỏ học sinh khỏi lớp? Quyền Giáo trình đang bật sẽ được giữ trong hồ sơ nhưng học sinh không thể xem khi không còn thuộc lớp.')) return
    const restoresAccess = action === 'add' && access[userId]?.status === 'active'
    if (restoresAccess && !window.confirm('Học sinh đang có quyền Giáo trình BẬT. Thêm lại vào lớp sẽ khôi phục khả năng xem bài đã xuất bản. Tiếp tục?')) return
    setBusy(`${action}:${userId}`); setError(''); setNotice('')
    const { error: actionError } = await client.rpc('manage_class_membership', {
      p_class_id: selected.id, p_user_id: userId, p_action: action,
    })
    if (actionError) setError(actionError.message)
    else {
      setNotice(action === 'add'
        ? (restoresAccess ? 'Đã thêm lại lớp. Quyền Giáo trình BẬT trước đó có hiệu lực trở lại.' : 'Đã thêm vào lớp. Giáo trình vẫn TẮT cho tới khi Admin bật.')
        : 'Đã bỏ khỏi lớp. Quyền Giáo trình không tự thay đổi.')
      setSearch(''); setMatches([])
      await loadClass(selected)
    }
    setBusy(null)
  }

  const accessAction = async (userId: string, action: 'grant' | 'revoke') => {
    if (!selected) return
    setBusy(`${action}:${userId}`); setError(''); setNotice('')
    const { error: actionError } = await client.rpc('manage_class_curriculum_access', {
      p_class_id: selected.id, p_user_id: userId, p_action: action,
    })
    if (actionError) setError(actionError.message)
    else {
      setNotice(action === 'grant' ? 'Đã BẬT Giáo trình.'
        : activeMembers.some(member => member.user_id === userId)
          ? 'Đã TẮT Giáo trình; học sinh vẫn thuộc lớp.' : 'Đã TẮT Giáo trình.')
      await loadClass(selected)
    }
    setBusy(null)
  }

  return <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: C.bg, color: C.text, fontFamily: 'Inter, system-ui, sans-serif' }}>
    <h1 style={{ fontSize: 22, margin: '0 0 6px' }}>Lớp học</h1>
    <p style={{ color: C.muted, margin: '0 0 20px', fontSize: 14 }}>Quản lý học sinh và quyền xem Giáo trình của từng lớp.</p>
    {loading ? <div>Đang tải lớp...</div> : classes.length === 0 ? <div>Chưa có lớp.</div> : <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {classes.map(cls => <button key={cls.id} onClick={() => { setSelectedId(cls.id); setSearch(''); setMatches([]); setNotice('') }}
          style={{ ...button, background: cls.id === selectedId ? C.green : C.card, color: cls.id === selectedId ? '#fff' : C.text }}>
          {cls.name} · {cls.code}
        </button>)}
      </div>
      {selected && <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{selected.name}</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>
          Trạng thái lớp: {selected.status} · Nhóm thành viên: <b style={{ color: C.text }}>{summary[selected.id]?.group_name ?? 'chưa có'}</b>
          {' '}· <b style={{ color: C.text }}>{summary[selected.id]?.member_count ?? activeMembers.length} học sinh</b>
          {' '}· Giáo trình bật: {activeMembers.filter(m => access[m.user_id]?.status === 'active').length}
        </div>
        {selected.cohort_group_id && !['completed', 'cancelled', 'merged'].includes(selected.status) &&
          <div style={{ marginBottom: 12 }}><ClassJoinCode key={selected.id} client={client} classId={selected.id} /></div>}
        <div role="tablist" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {([['students', 'Học sinh'], ['curriculum', 'Chặng & Giáo trình']] as const).map(([id, label]) =>
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              style={{ ...button, background: tab === id ? C.text : C.card, color: tab === id ? '#fff' : C.text }}>{label}</button>)}
        </div>
        {tab === 'curriculum' ? <ClassCurriculumEditor key={selected.id} client={client} cls={selected} /> : !selected.cohort_group_id ? <div role="alert" style={{ color: C.red }}>Lớp chưa có nhóm thành viên. Chọn nhóm cho lớp ở Lịch lớp trước khi thêm học sinh.</div> : <>
          <label htmlFor="class-student-search" style={{ display: 'block', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Thêm học sinh</label>
          <input id="class-student-search" value={search} onChange={event => setSearch(event.target.value)}
            placeholder="Tìm theo tên hoặc email" style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', fontSize: 14 }} />
          {matches.length > 0 && <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, marginTop: 6, marginBottom: 20 }}>
            {matches.map(student => <div key={student.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderBottom: `1px solid ${C.border}` }}>
              <span style={{ flex: 1, minWidth: 0 }}>{nameOf(student)} <small style={{ color: C.muted }}>{student.email}</small></span>
              <button disabled={busy !== null} onClick={() => void membershipAction(student.user_id as string, 'add')} style={button}>Thêm vào lớp</button>
            </div>)}
          </div>}
          <h2 style={{ fontSize: 16, margin: '22px 0 10px' }}>Học sinh trong lớp</h2>
          {activeMembers.length === 0 ? <div style={{ color: C.muted, fontSize: 14 }}>Chưa có học sinh.</div> : activeMembers.map(member => {
            const row = access[member.user_id]
            const isOn = row?.status === 'active'
            return <div key={member.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderTop: `1px solid ${C.border}`, padding: '12px 0' }}>
              <div style={{ flex: '1 1 210px', minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{nameOf(students[member.user_id])}</div>
                <div style={{ color: C.muted, fontSize: 12 }}>{students[member.user_id]?.email || 'Chưa có email'} · Vào lớp: {fmt(member.updated_at)}</div>
              </div>
              <div style={{ color: isOn ? C.green : C.red, background: isOn ? C.greenBg : C.redBg, borderRadius: 6, padding: '5px 8px', fontSize: 12, fontWeight: 700 }}>
                Giáo trình: {isOn ? 'BẬT' : 'TẮT'}
              </div>
              <button disabled={busy !== null} onClick={() => void accessAction(member.user_id, isOn ? 'revoke' : 'grant')}
                style={{ ...button, color: isOn ? C.red : C.green }}>{isOn ? 'Tắt Giáo trình' : 'Bật Giáo trình'}</button>
              <button disabled={busy !== null} onClick={() => void membershipAction(member.user_id, 'remove')}
                style={{ ...button, color: C.red }}>Bỏ khỏi lớp</button>
            </div>
          })}
          {inactiveMembers.length > 0 && <>
            <h3 style={{ fontSize: 14, margin: '22px 0 6px', color: C.muted }}>Đã rời lớp</h3>
            {inactiveMembers.map(member => <div key={member.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderTop: `1px solid ${C.border}`, padding: '10px 0', fontSize: 13 }}>
              <span style={{ flex: 1 }}>{nameOf(students[member.user_id])} · Giáo trình: {access[member.user_id]?.status === 'active' ? 'BẬT (không thể xem khi ngoài lớp)' : 'TẮT'}</span>
              {access[member.user_id]?.status === 'active' && <button disabled={busy !== null} onClick={() => void accessAction(member.user_id, 'revoke')} style={button}>Tắt Giáo trình</button>}
              <button disabled={busy !== null} onClick={() => void membershipAction(member.user_id, 'add')} style={button}>Thêm lại lớp</button>
            </div>)}
          </>}
        </>}
      </div>}
    </>}
    {error && <div role="alert" style={{ color: C.red, marginTop: 14 }}>{error}</div>}
    {notice && <div role="status" style={{ color: C.green, marginTop: 14 }}>{notice}</div>}
  </div>
}
