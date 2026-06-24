import { useEffect, useState, type CSSProperties } from 'react'
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
  bg: '#EAD7B8', bgCard: '#F5EDD8', bgCardHover: '#FBF5EA',
  header: '#1B6B3A', gold: '#A07820', goldLight: '#C8A84B',
  green: '#1B6B3A', greenLight: '#E8F2EC',
  text: '#2C1F0E', textMuted: '#7A6548', textDim: '#A08B6A',
  border: '#C8B090', borderLight: '#DDD0B0',
  danger: '#8B3A1E', warn: '#A07820',
}
const LEVEL_COLOR: Record<string, string> = {
  beginner: '#2E6B40', elementary: '#5A8A2A',
  intermediate: '#A07820', advanced: '#8B3A1E',
}
const LEVEL_LABEL: Record<string, string> = {
  beginner: 'Mới bắt đầu', elementary: 'Cơ bản',
  intermediate: 'Trung cấp', advanced: 'Nâng cao',
}

interface Props { onSelect: (id: string) => void }

export default function StudentList({ onSelect }: Props) {
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
  }, [])

  useEffect(() => {
    let result = students
    if (classFilter !== 'all') {
      const ids = memberByGroup[classFilter] ?? new Set()
      result = result.filter(s => s.user_id && ids.has(s.user_id))
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
    setFiltered(result)
  }, [search, levelFilter, statusFilter, classFilter, students, memberByGroup])

  const activeCount = students.filter(s => s.is_active).length
  const chip = (on: boolean): CSSProperties => ({ background: on ? T.header : T.bgCard, color: on ? '#fff' : T.text, border: `1px solid ${on ? T.header : T.border}`, borderRadius: 20, padding: '6px 14px', fontSize: 13, fontWeight: on ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' })

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: 'Inter, system-ui, sans-serif', color: T.text }}>
      {/* Header */}
      <div style={{ background: T.header, borderBottom: `1px solid ${T.border}`, padding: '14px 24px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>🎸 Danh sách học sinh</div>
            <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>
              {activeCount} đang học · {students.length} tổng
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 24px' }}>
        {/* Lớp (nhóm Zalo) — bấm để lọc học sinh trong lớp */}
        {groups.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, marginBottom: 8, letterSpacing: '.05em' }}>LỚP (NHÓM ZALO)</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={() => setClassFilter('all')} style={chip(classFilter === 'all')}>Tất cả ({students.length})</button>
              {groups.map(g => (
                <button key={g.id} onClick={() => setClassFilter(g.id)} style={chip(classFilter === g.id)}>{g.name} ({memberByGroup[g.id]?.size ?? 0})</button>
              ))}
            </div>
            {classFilter !== 'all' && (() => {
              const g = groups.find(x => x.id === classFilter)
              return g?.zalo_url ? <a href={g.zalo_url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 10, fontSize: 13, color: T.green, fontWeight: 700 }}>💬 Mở nhóm Zalo {g.name} →</a> : null
            })()}
          </div>
        )}
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
        </div>

        {/* Count */}
        <div style={{ fontSize: 14, color: T.textMuted, marginBottom: 12 }}>
          Hiển thị {filtered.length} / {students.length} học sinh
        </div>

        {/* List */}
        {loading ? (
          <div style={{ textAlign: 'center', color: T.textMuted, padding: 40 }}>Đang tải...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: T.textMuted, padding: 40 }}>Không tìm thấy học sinh nào.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {filtered.map(s => (
              <div key={s.id} onClick={() => onSelect(s.id)} style={{
                background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
                padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = T.gold)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = T.border)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%', background: T.header,
                    border: `1.5px solid ${s.level ? LEVEL_COLOR[s.level] : T.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, flexShrink: 0,
                  }}>🎸</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.full_name}
                    </div>
                    <div style={{ fontSize: 13, color: T.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.email ?? s.phone ?? '—'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    {s.level && (
                      <span style={{
                        fontSize: 11, fontWeight: 600, borderRadius: 4, padding: '2px 6px',
                        background: LEVEL_COLOR[s.level] + '22', color: LEVEL_COLOR[s.level],
                        border: `1px solid ${LEVEL_COLOR[s.level]}44`,
                      }}>{LEVEL_LABEL[s.level]}</span>
                    )}
                    <span style={{
                      fontSize: 11, borderRadius: 4, padding: '2px 6px',
                      background: s.is_active ? '#1E3A28' : '#3A2828',
                      color: s.is_active ? T.green : T.danger,
                    }}>{s.is_active ? '● Đang học' : '● Ngừng'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}