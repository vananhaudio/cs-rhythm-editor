import { useEffect, useState } from 'react'
import { supabase } from './supabase'

interface Student {
  id: string; full_name: string; email: string | null; phone: string | null; age: number | null
  level: 'beginner' | 'elementary' | 'intermediate' | 'advanced' | null
  goals: string | null; learning_style: string | null; instruments: string | null
  enrolled_at: string | null; is_active: boolean; honor?: string | null
}
interface AppStats {
  totalXP: number; weekXP: number; bySource: { source: string; xp: number }[]
  streak: number; daysWeek: number; weekMin: number; totalMin: number
  doneCount: number; totalLessons: number
  songs: { title: string; mastered: boolean; steps: number }[]
  recent: { xp: number; source: string; created_at: string }[]
}
const SRC_LABEL: Record<string, string> = {
  flow: 'Bài Flow', lesson: 'Hoàn thành bài', practice: 'Luyện tập', song_step: 'Bước hành trình',
  song_mastered: 'Chinh phục bài', practiced_lesson: 'Thực hành', elearn: 'Bài Elearn',
  submitted_video: 'Gửi video', reviewed_old_lesson: 'Ôn bài cũ',
}
interface Skill {
  id: string; category: string; skill_name: string; level_0_10: number
  last_assessed: string | null; note: string | null
}
interface Lesson {
  id: string; started_at: string; duration_min: number | null
  content_summary: string | null; mood_score: number | null
  song_practiced: string | null; next_focus: string | null
}
interface Assignment {
  id: string; title: string; description: string | null; due_date: string | null
  status: 'pending' | 'submitted' | 'done' | 'skipped'
  ai_feedback: string | null; submission_url: string | null
  teacher_feedback: string | null; submitted_at: string | null
}
interface LearningEvent {
  id: string; event_type: string | null; summary: string
  tags: string[] | null; created_at: string
}
interface TeacherNote {
  id: string; note: string; category: string | null
  created_at: string; is_pinned: boolean
}

const T = {
  bg: '#EAD7B8', bgCard: '#F5EDD8', bgCardHover: '#FBF5EA',
  header: '#1B6B3A', gold: '#A07820', goldLight: '#C8A84B',
  green: '#1B6B3A', greenLight: '#E8F2EC',
  text: '#2C1F0E', textMuted: '#7A6548', textDim: '#A08B6A',
  border: '#C8B090', borderLight: '#DDD0B0',
  danger: '#8B3A1E', warn: '#A07820',
}
const LEVEL_LABEL: Record<string, string> = { beginner: 'Mới bắt đầu', elementary: 'Cơ bản', intermediate: 'Trung cấp', advanced: 'Nâng cao' }
const LEVEL_COLOR: Record<string, string> = { beginner: '#2E6B40', elementary: '#5A8A2A', intermediate: '#A07820', advanced: '#8B3A1E' }
const CATEGORY_LABEL: Record<string, string> = { rhythm: '🥁 Nhịp', chords: '🎸 Hợp âm', technique: '🖐 Kỹ thuật', theory: '📖 Lý thuyết', ear_training: '👂 Thẩm âm' }
const MOOD_EMOJI = ['', '😟', '😕', '😐', '🙂', '😄']

const HONOR_OPTIONS = [
  { value: 'none',     label: '— Chưa phong',      icon: '' },
  { value: 'bronze',   label: '🥉 Bronze Member',   icon: '🥉' },
  { value: 'silver',   label: '🥈 Silver Member',   icon: '🥈' },
  { value: 'gold',     label: '🥇 Gold Member',     icon: '🥇' },
  { value: 'platinum', label: '💎 Platinum',         icon: '💎' },
  { value: 'diamond',  label: '👑 Diamond',          icon: '👑' },
]

function getYearBadge(enrolledAt?: string | null): string | null {
  if (!enrolledAt) return null
  const years = Math.floor((Date.now() - new Date(enrolledAt).getTime()) / (365.25 * 24 * 3600 * 1000))
  if (years < 1) return null
  return years === 1 ? '1-Year Member' : `${years}-Year Member`
}
const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: '#F0E4C8', color: '#7A6548', label: 'Chưa nộp' },
  submitted: { bg: '#D8EAF0', color: '#1A5A7A', label: 'Đã nộp' },
  done:      { bg: '#D8EDD8', color: '#1B6B3A', label: 'Hoàn thành' },
  skipped:   { bg: '#F0D8D0', color: '#8B3A1E', label: 'Bỏ qua' },
}
interface CourseItem {
  id: string; name: string; slug: string; type: string; track: string | null; is_free: boolean
}
interface EnrollmentItem {
  id: string; course_id: string; enrolled_at: string; is_active: boolean
  course: CourseItem
}

function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
interface CourseItem {
  id: string; name: string; slug: string; type: string; track: string | null; is_free: boolean
}
interface EnrollmentItem {
  id: string; course_id: string; enrolled_at: string; is_active: boolean
  course: CourseItem
}

function fmtDateTime(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function timeAgo(s: string) {
  const d = Math.floor((Date.now() - new Date(s).getTime()) / 86400000)
  if (d === 0) return 'Hôm nay'
  if (d === 1) return 'Hôm qua'
  return `${d} ngày trước`
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <div style={{ width: 3, height: 16, background: T.gold, borderRadius: 2 }} />
      <span style={{ color: T.gold, fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{children}</span>
    </div>
  )
}
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: T.bgCard, borderRadius: 12, padding: 16, border: `1px solid ${T.border}`, ...style }}>{children}</div>
}
function SkillBar({ skill }: { skill: Skill }) {
  const pct = (skill.level_0_10 / 10) * 100
  const color = pct >= 70 ? T.green : pct >= 40 ? T.gold : T.danger
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 14, color: T.text }}>{skill.skill_name}</span>
        <span style={{ fontSize: 14, color, fontWeight: 700 }}>{skill.level_0_10}/10</span>
      </div>
      <div style={{ height: 6, background: T.border, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
      </div>
      {skill.note && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 3 }}>{skill.note}</div>}
    </div>
  )
}

interface Props { studentId: string; onBack: () => void }

export default function StudentProfile({ studentId, onBack }: Props) {
  const [student, setStudent] = useState<Student | null>(null)
  const [skills, setSkills] = useState<Skill[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [events, setEvents] = useState<LearningEvent[]>([])
  const [notes, setNotes] = useState<TeacherNote[]>([])
  const [loading, setLoading] = useState(true)
  const [savingHonor, setSavingHonor] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'lessons' | 'assignments' | 'timeline' | 'courses' | 'app'>('overview')
  const [enrollments, setEnrollments] = useState<EnrollmentItem[]>([])
  const [allCourses, setAllCourses] = useState<CourseItem[]>([])
  const [enrolling, setEnrolling] = useState<string | null>(null)
  const [appStats, setAppStats] = useState<AppStats | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: s }, { data: sk }, { data: ls }, { data: as }, { data: ev }, { data: nt }] = await Promise.all([
        supabase.from('edu_students').select('*').eq('id', studentId).single(),
        supabase.from('edu_skills').select('*').eq('student_id', studentId).order('category'),
        // edu_lessons = nhật ký BUỔI HỌC theo học viên (student_id, started_at, mood_score...),
        // KHÔNG phải bảng nội dung edu_course_lessons. Giữ nguyên — đừng đổi sang edu_course_lessons.
        supabase.from('edu_lessons').select('*').eq('student_id', studentId).order('started_at', { ascending: false }).limit(10),
        supabase.from('edu_assignments').select('*').eq('student_id', studentId).order('due_date', { ascending: false }).limit(20),
        supabase.from('edu_learning_events').select('*').eq('student_id', studentId).order('created_at', { ascending: false }).limit(15),
        supabase.from('edu_teacher_notes').select('*').eq('student_id', studentId).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
      ])
      setStudent(s); setSkills(sk ?? []); setLessons(ls ?? [])
      setAssignments(as ?? []); setEvents(ev ?? []); setNotes(nt ?? [])
      const [{ data: enr }, { data: courses }] = await Promise.all([
        supabase.from("edu_enrollments").select("id,course_id,enrolled_at,is_active,course:edu_courses(id,name,slug,type,track,is_free)").eq("student_id", studentId),
        supabase.from("edu_courses").select("id,name,slug,type,track,is_free").eq("status", "on").order("level_order"),
      ])
      setEnrollments((enr ?? []) as unknown as EnrollmentItem[])
      setAllCourses(courses ?? [])

      // ── Chỉ số do APP ghi (XP / luyện tập / tiến độ / bài hát) — dùng đúng công thức portal ──
      const [{ data: xp }, { data: pr }, { data: lp }, { data: sg }] = await Promise.all([
        supabase.from('student_xp_log').select('xp,source,created_at').eq('student_id', studentId),
        supabase.from('student_practice_log').select('minutes,practiced_at').eq('student_id', studentId),
        supabase.from('edu_lesson_progress').select('lesson_id').eq('student_id', studentId),
        supabase.from('student_songs').select('title,status,journey').eq('student_id', studentId),
      ])
      const wkAgo = Date.now() - 7 * 24 * 3600 * 1000
      let totalXP = 0, weekXP = 0; const srcMap: Record<string, number> = {}
      ;(xp ?? []).forEach((r: any) => {
        totalXP += r.xp || 0
        if (new Date(r.created_at).getTime() >= wkAgo) weekXP += r.xp || 0
        srcMap[r.source || 'khác'] = (srcMap[r.source || 'khác'] || 0) + (r.xp || 0)
      })
      const bySource = Object.entries(srcMap).map(([source, x]) => ({ source, xp: x })).sort((a, b) => b.xp - a.xp)
      const recent = (xp ?? []).slice().sort((a: any, b: any) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 8)
      const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      const days = new Set((pr ?? []).map((r: any) => dayKey(new Date(r.practiced_at))))
      let streak = 0; const cur = new Date()
      if (!days.has(dayKey(cur))) cur.setDate(cur.getDate() - 1)
      while (days.has(dayKey(cur))) { streak++; cur.setDate(cur.getDate() - 1) }
      let daysWeek = 0
      for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() - i); if (days.has(dayKey(d))) daysWeek++ }
      let weekMin = 0, totalMin = 0
      ;(pr ?? []).forEach((r: any) => { totalMin += r.minutes || 0; if (new Date(r.practiced_at).getTime() >= wkAgo) weekMin += r.minutes || 0 })
      // tiến độ: lộ trình = bài của các khoá đang ghi danh active
      const courseIds = ((enr ?? []) as any[]).filter(e => e.is_active).map(e => e.course_id)
      let pathIds: string[] = []
      if (courseIds.length) {
        const { data: mods } = await supabase.from('edu_modules').select('id').in('course_id', courseIds)
        const modIds = (mods ?? []).map((m: any) => m.id)
        if (modIds.length) {
          const { data: lns } = await supabase.from('edu_course_lessons').select('id').in('module_id', modIds)
          pathIds = (lns ?? []).map((l: any) => l.id)
        }
      }
      const completedIds = new Set((lp ?? []).map((r: any) => r.lesson_id))
      const totalLessons = pathIds.length
      const doneCount = pathIds.length ? pathIds.filter(id => completedIds.has(id)).length : completedIds.size
      const songs = (sg ?? []).map((s: any) => ({
        title: s.title, mastered: s.status === 'mastered',
        steps: s.journey ? Object.values(s.journey).filter((v: any) => v && v.done).length : 0,
      }))
      setAppStats({ totalXP, weekXP, bySource, streak, daysWeek, weekMin, totalMin, doneCount, totalLessons, songs, recent })

      setLoading(false)
    }
    load()
  }, [studentId])

  const SEL = 'id,course_id,enrolled_at,is_active,course:edu_courses(id,name,slug,type,track,is_free)'
  const handleEnroll = async (courseId: string) => {
    if (!student) return
    setEnrolling(courseId)
    // Đã có dòng ghi danh (kể cả đã tắt is_active=false)? → BẬT LẠI, tránh chèn trùng (lỗi unique)
    const { data: existRows } = await supabase.from('edu_enrollments')
      .select('id').eq('student_id', student.id).eq('course_id', courseId).limit(1)
    const existing = existRows?.[0]
    if (existing) {
      const { data, error } = await supabase.from('edu_enrollments')
        .update({ is_active: true }).eq('id', existing.id).select(SEL).single()
      if (error) { alert('Đăng ký khoá học thất bại: ' + error.message) }
      else if (data) setEnrollments(prev => prev.some(e => e.id === data.id)
        ? prev.map(e => e.id === data.id ? data as unknown as EnrollmentItem : e)
        : [...prev, data as unknown as EnrollmentItem])
      setEnrolling(null)
      return
    }
    const { data, error } = await supabase.from('edu_enrollments').insert({
      student_id: student.id, course_id: courseId,
      enrolled_by: (await supabase.auth.getUser()).data.user?.id,
      is_active: true,
    }).select(SEL).single()
    if (error) { alert('Đăng ký khoá học thất bại: ' + error.message) }
    else if (data) setEnrollments(prev => [...prev, data as unknown as EnrollmentItem])
    setEnrolling(null)
  }

  const handleUnenroll = async (enrollmentId: string) => {
    const { error } = await supabase.from('edu_enrollments').update({ is_active: false }).eq('id', enrollmentId)
    if (error) { alert('Huỷ đăng ký thất bại: ' + error.message); return }
    setEnrollments(prev => prev.map(e => e.id === enrollmentId ? { ...e, is_active: false } : e))
  }

  if (loading) return <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMuted }}>Đang tải hồ sơ...</div>
  if (!student) return <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.danger }}>Không tìm thấy học sinh.</div>

  const skillsByCategory = skills.reduce<Record<string, Skill[]>>((acc, sk) => {
    const cat = sk.category ?? 'other'; if (!acc[cat]) acc[cat] = []; acc[cat].push(sk); return acc
  }, {})
  const updateHonor = async (honor: string) => {
    if (!student) return
    setSavingHonor(true)
    const { error } = await supabase.from('edu_students').update({ honor }).eq('id', student.id)
    setSavingHonor(false)
    if (error) { alert('Lưu danh hiệu thất bại: ' + error.message); return }
    setStudent(prev => prev ? { ...prev, honor } : prev)
  }

  const avgSkill = skills.length > 0 ? Math.round(skills.reduce((s, k) => s + k.level_0_10, 0) / skills.length * 10) / 10 : null
  const pendingCount = assignments.filter(a => a.status === 'pending').length
  const doneCount = assignments.filter(a => a.status === 'done').length

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: 'Inter, system-ui, sans-serif', color: T.text }}>
      <div style={{ background: T.header, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{ background: 'none', border: `1px solid ${'#4A8A60'}`, borderRadius: 8, color: T.green, cursor: 'pointer', padding: '6px 14px', fontSize: 14, fontWeight: 600 }}>← Quay lại</button>
          <span style={{ color: T.textMuted, fontSize: 14 }}>Hồ sơ học sinh</span>
        </div>
      </div>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>
        <Card style={{ marginBottom: 20, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: T.header, border: `2px solid ${T.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>🎸</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.text }}>{student.full_name}</h1>
                {student.level && <span style={{ background: LEVEL_COLOR[student.level] + '22', border: `1px solid ${LEVEL_COLOR[student.level]}`, color: LEVEL_COLOR[student.level], borderRadius: 20, padding: '2px 10px', fontSize: 13, fontWeight: 600 }}>{LEVEL_LABEL[student.level]}</span>}
                <span style={{ background: student.is_active ? '#1E3A28' : '#3A2828', color: student.is_active ? T.green : T.danger, borderRadius: 20, padding: '2px 10px', fontSize: 12 }}>{student.is_active ? '● Đang học' : '● Ngừng học'}</span>
              </div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 8 }}>
                {student.email && <span style={{ fontSize: 14, color: T.textMuted, userSelect: 'all' }}>📧 {student.email}</span>}
                {student.phone && <span style={{ fontSize: 14, color: T.textMuted }}>📞 {student.phone}</span>}
                {student.age && <span style={{ fontSize: 14, color: T.textMuted }}>🎂 {student.age} tuổi</span>}
                {student.enrolled_at && <span style={{ fontSize: 14, color: T.textMuted }}>📅 Từ {fmtDate(student.enrolled_at)}</span>}
              </div>
              {/* Badge 2 hệ thống */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                {getYearBadge(student.enrolled_at) && (
                  <span style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8', borderRadius: 20, padding: '3px 12px', fontSize: 13, fontWeight: 700 }}>
                    📅 {getYearBadge(student.enrolled_at)}
                  </span>
                )}
                {student.honor && student.honor !== 'none' && (
                  <span style={{ background: '#FEF3C7', border: '1px solid #FCD34D', color: '#92400E', borderRadius: 20, padding: '3px 12px', fontSize: 13, fontWeight: 700 }}>
                    {HONOR_OPTIONS.find(h => h.value === student.honor)?.label}
                  </span>
                )}
              </div>
              {/* Thầy phong danh hiệu */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 600 }}>Phong danh hiệu:</span>
                <select value={student.honor ?? 'none'} onChange={e => updateHonor(e.target.value)}
                  disabled={savingHonor}
                  style={{ background: '#FEF9EE', border: `1px solid ${T.gold}`, borderRadius: 8, padding: '4px 10px', fontSize: 13, fontWeight: 600, color: T.gold, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', opacity: savingHonor ? 0.6 : 1 }}>
                  {HONOR_OPTIONS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                </select>
                {savingHonor && <span style={{ fontSize: 12, color: T.textMuted }}>Đang lưu…</span>}
              </div>
              {student.goals && <div style={{ marginTop: 8, fontSize: 14, color: T.text, background: T.bg, borderRadius: 8, padding: '8px 12px', borderLeft: `3px solid ${T.gold}` }}><span style={{ color: T.textMuted }}>Mục tiêu: </span>{student.goals}</div>}
            </div>
            <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
              {[{ v: lessons.length, label: 'Buổi học', color: T.gold }, { v: avgSkill ?? '—', label: 'Điểm TB', color: T.green }, { v: pendingCount, label: 'Chờ nộp', color: pendingCount > 0 ? T.warn : T.green }].map(s => (
                <div key={s.label} style={{ textAlign: 'center', background: T.bg, borderRadius: 10, padding: '10px 16px', minWidth: 64 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.v}</div>
                  <div style={{ fontSize: 12, color: T.textMuted }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: T.bgCard, borderRadius: 10, padding: 4, border: `1px solid ${T.border}` }}>
          {(['overview', 'app', 'lessons', 'assignments', 'timeline', 'courses'] as const).map(tab => {
            const labels: Record<'overview'|'app'|'lessons'|'assignments'|'timeline'|'courses', string> = { overview: '📊 Tổng quan', app: '📱 Hoạt động app', lessons: '📚 Buổi học', assignments: '📝 Bài tập', timeline: '⚡ Timeline AI', courses: '📚 Khoá học' }
            return <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, border: 'none', borderRadius: 7, cursor: 'pointer', padding: '8px 4px', fontSize: 13, fontWeight: 600, background: activeTab === tab ? T.header : 'none', color: activeTab === tab ? T.text : T.textMuted }}>{labels[tab]}</button>
          })}
        </div>

        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Card style={{ gridColumn: '1 / -1' }}>
              <SectionTitle>Kỹ năng</SectionTitle>
              {skills.length === 0 ? <div style={{ color: T.textMuted, fontSize: 14, textAlign: 'center', padding: '20px 0' }}>Chưa có đánh giá kỹ năng nào.</div> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                  {Object.entries(skillsByCategory).map(([cat, catSkills]) => (
                    <div key={cat}><div style={{ fontSize: 13, color: T.textMuted, marginBottom: 8 }}>{CATEGORY_LABEL[cat] ?? cat}</div>{catSkills.map(sk => <SkillBar key={sk.id} skill={sk} />)}</div>
                  ))}
                </div>
              )}
            </Card>
            <Card>
              <SectionTitle>Ghi chú ghim</SectionTitle>
              {notes.filter(n => n.is_pinned).length === 0 ? <div style={{ color: T.textMuted, fontSize: 14 }}>Không có ghi chú ghim.</div> : notes.filter(n => n.is_pinned).map(note => (
                <div key={note.id} style={{ borderLeft: `3px solid ${T.gold}`, paddingLeft: 10, marginBottom: 10, fontSize: 14, color: T.text, lineHeight: 1.5 }}>
                  {note.note}<div style={{ fontSize: 12, color: T.textMuted, marginTop: 3 }}>{note.category} · {fmtDate(note.created_at)}</div>
                </div>
              ))}
            </Card>
            <Card>
              <SectionTitle>Buổi học gần nhất</SectionTitle>
              {lessons[0] ? (
                <div>
                  <div style={{ fontSize: 14, color: T.textMuted, marginBottom: 6 }}>{fmtDateTime(lessons[0].started_at)}{lessons[0].duration_min && ` · ${lessons[0].duration_min} phút`}{lessons[0].mood_score && ` · ${MOOD_EMOJI[lessons[0].mood_score]}`}</div>
                  {lessons[0].song_practiced && <div style={{ fontSize: 14, color: T.text, marginBottom: 4 }}>🎵 {lessons[0].song_practiced}</div>}
                  {lessons[0].content_summary && <div style={{ fontSize: 14, color: T.text, lineHeight: 1.6, marginBottom: 6 }}>{lessons[0].content_summary}</div>}
                  {lessons[0].next_focus && <div style={{ fontSize: 13, color: T.gold, background: T.bg, borderRadius: 6, padding: '6px 10px' }}>→ Lần tới: {lessons[0].next_focus}</div>}
                </div>
              ) : <div style={{ color: T.textMuted, fontSize: 14 }}>Chưa có buổi học nào.</div>}
            </Card>
          </div>
        )}

        {activeTab === 'lessons' && (
          <Card>
            <SectionTitle>Lịch sử buổi học ({lessons.length})</SectionTitle>
            {lessons.length === 0 ? <div style={{ color: T.textMuted, fontSize: 14, textAlign: 'center', padding: '20px 0' }}>Chưa có buổi học nào.</div> : lessons.map((lesson, i) => (
              <div key={lesson.id} style={{ borderBottom: i < lessons.length - 1 ? `1px solid ${T.border}` : 'none', paddingBottom: 14, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{fmtDateTime(lesson.started_at)}</span>
                  {lesson.duration_min && <span style={{ fontSize: 13, color: T.textMuted }}>{lesson.duration_min} phút</span>}
                  {lesson.mood_score && <span style={{ fontSize: 15 }}>{MOOD_EMOJI[lesson.mood_score]}</span>}
                  <span style={{ fontSize: 12, color: T.textMuted, marginLeft: 'auto' }}>{timeAgo(lesson.started_at)}</span>
                </div>
                {lesson.song_practiced && <div style={{ fontSize: 14, color: T.green, marginBottom: 4 }}>🎵 {lesson.song_practiced}</div>}
                {lesson.content_summary && <div style={{ fontSize: 14, color: T.text, lineHeight: 1.6, marginBottom: 6 }}>{lesson.content_summary}</div>}
                {lesson.next_focus && <div style={{ fontSize: 13, color: T.gold }}>→ Lần tới: {lesson.next_focus}</div>}
              </div>
            ))}
          </Card>
        )}

        {activeTab === 'assignments' && (
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: T.warn, background: T.bgCard, borderRadius: 6, padding: '4px 12px', border: `1px solid ${T.border}` }}>Chờ nộp ({pendingCount})</div>
              <div style={{ fontSize: 13, color: T.green, background: T.bgCard, borderRadius: 6, padding: '4px 12px', border: `1px solid ${T.border}` }}>Hoàn thành ({doneCount})</div>
            </div>
            <Card>
              <SectionTitle>Tất cả bài tập ({assignments.length})</SectionTitle>
              {assignments.length === 0 ? <div style={{ color: T.textMuted, fontSize: 14, textAlign: 'center', padding: '20px 0' }}>Chưa có bài tập nào.</div> : assignments.map((asgn, i) => {
                const st = STATUS_STYLE[asgn.status] ?? STATUS_STYLE.pending
                return (
                  <div key={asgn.id} style={{ borderBottom: i < assignments.length - 1 ? `1px solid ${T.border}` : 'none', paddingBottom: 14, marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{asgn.title}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, borderRadius: 4, padding: '2px 8px', background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    {asgn.description && <div style={{ fontSize: 14, color: T.textMuted, marginBottom: 6 }}>{asgn.description}</div>}
                    {asgn.due_date && <div style={{ fontSize: 13, color: T.textMuted }}>📅 Hạn nộp: {fmtDate(asgn.due_date)}</div>}
                    {asgn.submission_url && <a href={asgn.submission_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#7EC8E8', display: 'inline-block', marginTop: 4 }}>🎥 Xem bài nộp</a>}
                    {asgn.teacher_feedback && <div style={{ fontSize: 14, color: T.text, background: T.bg, borderRadius: 6, padding: '6px 10px', marginTop: 6, borderLeft: `3px solid ${T.green}` }}><span style={{ color: T.textMuted, fontSize: 12 }}>Nhận xét giáo viên: </span>{asgn.teacher_feedback}</div>}
                    {asgn.ai_feedback && <div style={{ fontSize: 14, color: T.text, background: '#D8EAF0', borderRadius: 6, padding: '6px 10px', marginTop: 6, borderLeft: '3px solid #1A5A7A' }}><span style={{ color: '#1A5A7A', fontSize: 12 }}>🤖 AI nhận xét: </span>{asgn.ai_feedback}</div>}
                  </div>
                )
              })}
            </Card>
          </div>
        )}

        {activeTab === 'courses' && (
          <div>
            <SectionTitle>Khoá học đang học ({enrollments.filter(e => e.is_active).length})</SectionTitle>
            {enrollments.filter(e => e.is_active).length === 0 ? (
              <div style={{ color: T.textMuted, fontSize: 14, marginBottom: 20, padding: '12px 0' }}>
                Chưa có khoá học nào. Thêm khoá từ danh sách bên dưới.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {enrollments.filter(e => e.is_active).map(e => (
                  <div key={e.id} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{e.course?.name}</div>
                      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
                        {e.course?.type === 'canh_cua' ? '🔑 Cánh Cửa' : '🎸 Hành Trình'} · Từ {fmtDate(e.enrolled_at)}
                      </div>
                    </div>
                    <button onClick={() => handleUnenroll(e.id)} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 7, padding: '5px 12px', fontSize: 13, color: T.textMuted, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Gỡ khoá
                    </button>
                  </div>
                ))}
              </div>
            )}

            <SectionTitle>Thêm vào khoá học</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {allCourses.map(c => {
                const already = enrollments.find(e => e.course_id === c.id && e.is_active)
                const typeLabel = c.type === 'canh_cua' ? '🔑 Cánh Cửa' : c.type === 'final' ? '⭐ Cuối hành trình' : '🎸 Hành Trình'
                return (
                  <div key={c.id} style={{ background: already ? T.greenLight : T.bgCard, border: `1px solid ${already ? '#90C4A0' : T.borderLight}`, borderRadius: 10, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: 14, color: already ? T.header : T.text }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: T.textDim, marginTop: 1 }}>{typeLabel}{c.is_free ? ' · Miễn phí' : ''}</div>
                    </div>
                    {already ? (
                      <span style={{ fontSize: 13, color: T.header, fontWeight: 600 }}>✓ Đang học</span>
                    ) : (
                      <button onClick={() => handleEnroll(c.id)} disabled={enrolling === c.id} style={{ background: T.header, color: '#fff', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: enrolling === c.id ? .7 : 1 }}>
                        {enrolling === c.id ? '...' : '+ Thêm vào'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <Card>
            <SectionTitle>Timeline AI đã xử lý ({events.length})</SectionTitle>
            {events.length === 0 ? (
              <div style={{ color: T.textMuted, fontSize: 14, textAlign: 'center', padding: '20px 0' }}>AI chưa xử lý sự kiện nào. Sau khi học sinh chat và nộp bài, AI sẽ tóm tắt ở đây.</div>
            ) : (
              <div style={{ position: 'relative', paddingLeft: 20 }}>
                <div style={{ position: 'absolute', left: 7, top: 0, bottom: 0, width: 2, background: T.border, borderRadius: 1 }} />
                {events.map(ev => (
                  <div key={ev.id} style={{ position: 'relative', marginBottom: 16 }}>
                    <div style={{ position: 'absolute', left: -17, top: 4, width: 10, height: 10, borderRadius: '50%', background: T.gold, border: `2px solid ${T.bg}` }} />
                    <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 3 }}>{ev.event_type && <span style={{ color: T.gold, marginRight: 6 }}>{ev.event_type}</span>}{fmtDateTime(ev.created_at)}</div>
                    <div style={{ fontSize: 14, color: T.text, lineHeight: 1.6 }}>{ev.summary}</div>
                    {ev.tags && ev.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                        {ev.tags.map(tag => <span key={tag} style={{ fontSize: 12, background: '#D8EDD8', color: '#1B6B3A', borderRadius: 4, padding: '2px 7px' }}>#{tag}</span>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {activeTab === 'app' && (
          <Card>
            <SectionTitle>Hoạt động trên app</SectionTitle>
            {!appStats ? (
              <div style={{ color: T.textMuted, fontSize: 14, textAlign: 'center', padding: '20px 0' }}>Đang tải…</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                {/* 🧭 Hành trình */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.green, marginBottom: 8 }}>🧭 Hành trình — em đi đến đâu</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {[
                      { label: 'Mốc', value: `${Math.min(appStats.doneCount + 1, appStats.totalLessons || appStats.doneCount + 1)}/${appStats.totalLessons || '—'}`, color: T.green },
                      { label: '% hành trình', value: appStats.totalLessons ? Math.round(appStats.doneCount / appStats.totalLessons * 100) + '%' : '—', color: T.green },
                      { label: 'Bài hoàn thành', value: appStats.doneCount, color: T.green },
                      { label: 'Điểm hành trình', value: appStats.totalXP.toLocaleString(), color: T.gold },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign: 'center', background: T.bg, borderRadius: 10, padding: '10px 16px', minWidth: 90 }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 🔥 Chăm chỉ */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.warn, marginBottom: 8 }}>🔥 Chăm chỉ — em luyện đều không</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {[
                      { label: 'Chuỗi ngày luyện', value: `${appStats.streak} ngày`, color: T.warn },
                      { label: 'Ngày luyện/tuần', value: `${appStats.daysWeek}/7`, color: T.warn },
                      { label: 'Phút luyện tuần', value: appStats.weekMin, color: T.gold },
                      { label: 'Tổng phút luyện', value: appStats.totalMin, color: T.textMuted },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign: 'center', background: T.bg, borderRadius: 10, padding: '10px 16px', minWidth: 90 }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 🎵 Sống cùng nhạc */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.green, marginBottom: 8 }}>🎵 Sống cùng nhạc — bài đang chinh phục</div>
                  {appStats.songs.length === 0
                    ? <div style={{ color: T.textMuted, fontSize: 14 }}>Chưa thêm bài hát nào.</div>
                    : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {appStats.songs.map((s, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: T.bg, borderRadius: 8, padding: '8px 12px', fontSize: 14 }}>
                            <span style={{ flex: 1, color: T.text, fontWeight: 600 }}>{s.title}</span>
                            <span style={{ fontSize: 12, color: T.textMuted }}>{s.steps}/5 bước</span>
                            {s.mastered && <span style={{ fontSize: 12, fontWeight: 700, color: T.green, background: T.greenLight, borderRadius: 6, padding: '2px 8px' }}>✓ Chinh phục</span>}
                          </div>
                        ))}
                      </div>
                    )}
                </div>

                {/* XP gần đây */}
                {appStats.recent.length > 0 && (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.textMuted, marginBottom: 8 }}>Mốc XP gần đây</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {appStats.recent.map((r, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, padding: '4px 2px' }}>
                          <span style={{ color: T.gold, fontWeight: 700, width: 48 }}>+{r.xp}</span>
                          <span style={{ flex: 1, color: T.text }}>{SRC_LABEL[r.source] ?? r.source}</span>
                          <span style={{ color: T.textDim, fontSize: 12 }}>{fmtDateTime(r.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}