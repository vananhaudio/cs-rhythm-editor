import { useEffect, useState } from 'react'
import { supabase } from './supabase'

interface Student {
  id: string; full_name: string; phone: string | null; age: number | null
  level: 'beginner' | 'elementary' | 'intermediate' | 'advanced' | null
  goals: string | null; learning_style: string | null; instruments: string | null
  enrolled_at: string | null; is_active: boolean
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
const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: '#F0E4C8', color: '#7A6548', label: 'Chưa nộp' },
  submitted: { bg: '#D8EAF0', color: '#1A5A7A', label: 'Đã nộp' },
  done:      { bg: '#D8EDD8', color: '#1B6B3A', label: 'Hoàn thành' },
  skipped:   { bg: '#F0D8D0', color: '#8B3A1E', label: 'Bỏ qua' },
}
function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
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
      <span style={{ color: T.gold, fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{children}</span>
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
        <span style={{ fontSize: 13, color: T.text }}>{skill.skill_name}</span>
        <span style={{ fontSize: 13, color, fontWeight: 700 }}>{skill.level_0_10}/10</span>
      </div>
      <div style={{ height: 6, background: T.border, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
      </div>
      {skill.note && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>{skill.note}</div>}
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
  const [activeTab, setActiveTab] = useState<'overview' | 'lessons' | 'assignments' | 'timeline'>('overview')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: s }, { data: sk }, { data: ls }, { data: as }, { data: ev }, { data: nt }] = await Promise.all([
        supabase.from('edu_students').select('*').eq('id', studentId).single(),
        supabase.from('edu_skills').select('*').eq('student_id', studentId).order('category'),
        supabase.from('edu_lessons').select('*').eq('student_id', studentId).order('started_at', { ascending: false }).limit(10),
        supabase.from('edu_assignments').select('*').eq('student_id', studentId).order('due_date', { ascending: false }).limit(20),
        supabase.from('edu_learning_events').select('*').eq('student_id', studentId).order('created_at', { ascending: false }).limit(15),
        supabase.from('edu_teacher_notes').select('*').eq('student_id', studentId).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
      ])
      setStudent(s); setSkills(sk ?? []); setLessons(ls ?? [])
      setAssignments(as ?? []); setEvents(ev ?? []); setNotes(nt ?? [])
      setLoading(false)
    }
    load()
  }, [studentId])

  if (loading) return <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMuted }}>Đang tải hồ sơ...</div>
  if (!student) return <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.danger }}>Không tìm thấy học sinh.</div>

  const skillsByCategory = skills.reduce<Record<string, Skill[]>>((acc, sk) => {
    const cat = sk.category ?? 'other'; if (!acc[cat]) acc[cat] = []; acc[cat].push(sk); return acc
  }, {})
  const avgSkill = skills.length > 0 ? Math.round(skills.reduce((s, k) => s + k.level_0_10, 0) / skills.length * 10) / 10 : null
  const pendingCount = assignments.filter(a => a.status === 'pending').length
  const doneCount = assignments.filter(a => a.status === 'done').length

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: 'Inter, system-ui, sans-serif', color: T.text }}>
      <div style={{ background: T.header, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{ background: 'none', border: `1px solid ${T.greenDim}`, borderRadius: 8, color: T.green, cursor: 'pointer', padding: '6px 14px', fontSize: 13, fontWeight: 600 }}>← Quay lại</button>
          <span style={{ color: T.textMuted, fontSize: 13 }}>Hồ sơ học sinh</span>
        </div>
      </div>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>
        <Card style={{ marginBottom: 20, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: T.header, border: `2px solid ${T.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>🎸</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.text }}>{student.full_name}</h1>
                {student.level && <span style={{ background: LEVEL_COLOR[student.level] + '22', border: `1px solid ${LEVEL_COLOR[student.level]}`, color: LEVEL_COLOR[student.level], borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{LEVEL_LABEL[student.level]}</span>}
                <span style={{ background: student.is_active ? '#1E3A28' : '#3A2828', color: student.is_active ? T.green : T.danger, borderRadius: 20, padding: '2px 10px', fontSize: 11 }}>{student.is_active ? '● Đang học' : '● Ngừng học'}</span>
              </div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                {student.phone && <span style={{ fontSize: 13, color: T.textMuted }}>📞 {student.phone}</span>}
                {student.age && <span style={{ fontSize: 13, color: T.textMuted }}>🎂 {student.age} tuổi</span>}
                {student.enrolled_at && <span style={{ fontSize: 13, color: T.textMuted }}>📅 Từ {fmtDate(student.enrolled_at)}</span>}
              </div>
              {student.goals && <div style={{ marginTop: 8, fontSize: 13, color: T.text, background: T.bg, borderRadius: 8, padding: '8px 12px', borderLeft: `3px solid ${T.gold}` }}><span style={{ color: T.textMuted }}>Mục tiêu: </span>{student.goals}</div>}
            </div>
            <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
              {[{ v: lessons.length, label: 'Buổi học', color: T.gold }, { v: avgSkill ?? '—', label: 'Điểm TB', color: T.green }, { v: pendingCount, label: 'Chờ nộp', color: pendingCount > 0 ? T.warn : T.green }].map(s => (
                <div key={s.label} style={{ textAlign: 'center', background: T.bg, borderRadius: 10, padding: '10px 16px', minWidth: 64 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.v}</div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: T.bgCard, borderRadius: 10, padding: 4, border: `1px solid ${T.border}` }}>
          {(['overview', 'lessons', 'assignments', 'timeline'] as const).map(tab => {
            const labels = { overview: '📊 Tổng quan', lessons: '📚 Buổi học', assignments: '📝 Bài tập', timeline: '⚡ Timeline AI' }
            return <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, border: 'none', borderRadius: 7, cursor: 'pointer', padding: '8px 4px', fontSize: 12, fontWeight: 600, background: activeTab === tab ? T.header : 'none', color: activeTab === tab ? T.text : T.textMuted }}>{labels[tab]}</button>
          })}
        </div>

        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Card style={{ gridColumn: '1 / -1' }}>
              <SectionTitle>Kỹ năng</SectionTitle>
              {skills.length === 0 ? <div style={{ color: T.textMuted, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Chưa có đánh giá kỹ năng nào.</div> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                  {Object.entries(skillsByCategory).map(([cat, catSkills]) => (
                    <div key={cat}><div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>{CATEGORY_LABEL[cat] ?? cat}</div>{catSkills.map(sk => <SkillBar key={sk.id} skill={sk} />)}</div>
                  ))}
                </div>
              )}
            </Card>
            <Card>
              <SectionTitle>Ghi chú ghim</SectionTitle>
              {notes.filter(n => n.is_pinned).length === 0 ? <div style={{ color: T.textMuted, fontSize: 13 }}>Không có ghi chú ghim.</div> : notes.filter(n => n.is_pinned).map(note => (
                <div key={note.id} style={{ borderLeft: `3px solid ${T.gold}`, paddingLeft: 10, marginBottom: 10, fontSize: 13, color: T.text, lineHeight: 1.5 }}>
                  {note.note}<div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>{note.category} · {fmtDate(note.created_at)}</div>
                </div>
              ))}
            </Card>
            <Card>
              <SectionTitle>Buổi học gần nhất</SectionTitle>
              {lessons[0] ? (
                <div>
                  <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 6 }}>{fmtDateTime(lessons[0].started_at)}{lessons[0].duration_min && ` · ${lessons[0].duration_min} phút`}{lessons[0].mood_score && ` · ${MOOD_EMOJI[lessons[0].mood_score]}`}</div>
                  {lessons[0].song_practiced && <div style={{ fontSize: 13, color: T.text, marginBottom: 4 }}>🎵 {lessons[0].song_practiced}</div>}
                  {lessons[0].content_summary && <div style={{ fontSize: 13, color: T.text, lineHeight: 1.6, marginBottom: 6 }}>{lessons[0].content_summary}</div>}
                  {lessons[0].next_focus && <div style={{ fontSize: 12, color: T.gold, background: T.bg, borderRadius: 6, padding: '6px 10px' }}>→ Lần tới: {lessons[0].next_focus}</div>}
                </div>
              ) : <div style={{ color: T.textMuted, fontSize: 13 }}>Chưa có buổi học nào.</div>}
            </Card>
          </div>
        )}

        {activeTab === 'lessons' && (
          <Card>
            <SectionTitle>Lịch sử buổi học ({lessons.length})</SectionTitle>
            {lessons.length === 0 ? <div style={{ color: T.textMuted, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Chưa có buổi học nào.</div> : lessons.map((lesson, i) => (
              <div key={lesson.id} style={{ borderBottom: i < lessons.length - 1 ? `1px solid ${T.border}` : 'none', paddingBottom: 14, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{fmtDateTime(lesson.started_at)}</span>
                  {lesson.duration_min && <span style={{ fontSize: 12, color: T.textMuted }}>{lesson.duration_min} phút</span>}
                  {lesson.mood_score && <span style={{ fontSize: 14 }}>{MOOD_EMOJI[lesson.mood_score]}</span>}
                  <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 'auto' }}>{timeAgo(lesson.started_at)}</span>
                </div>
                {lesson.song_practiced && <div style={{ fontSize: 13, color: T.green, marginBottom: 4 }}>🎵 {lesson.song_practiced}</div>}
                {lesson.content_summary && <div style={{ fontSize: 13, color: T.text, lineHeight: 1.6, marginBottom: 6 }}>{lesson.content_summary}</div>}
                {lesson.next_focus && <div style={{ fontSize: 12, color: T.gold }}>→ Lần tới: {lesson.next_focus}</div>}
              </div>
            ))}
          </Card>
        )}

        {activeTab === 'assignments' && (
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: T.warn, background: T.bgCard, borderRadius: 6, padding: '4px 12px', border: `1px solid ${T.border}` }}>Chờ nộp ({pendingCount})</div>
              <div style={{ fontSize: 12, color: T.green, background: T.bgCard, borderRadius: 6, padding: '4px 12px', border: `1px solid ${T.border}` }}>Hoàn thành ({doneCount})</div>
            </div>
            <Card>
              <SectionTitle>Tất cả bài tập ({assignments.length})</SectionTitle>
              {assignments.length === 0 ? <div style={{ color: T.textMuted, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Chưa có bài tập nào.</div> : assignments.map((asgn, i) => {
                const st = STATUS_STYLE[asgn.status] ?? STATUS_STYLE.pending
                return (
                  <div key={asgn.id} style={{ borderBottom: i < assignments.length - 1 ? `1px solid ${T.border}` : 'none', paddingBottom: 14, marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{asgn.title}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 4, padding: '2px 8px', background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    {asgn.description && <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 6 }}>{asgn.description}</div>}
                    {asgn.due_date && <div style={{ fontSize: 12, color: T.textMuted }}>📅 Hạn nộp: {fmtDate(asgn.due_date)}</div>}
                    {asgn.submission_url && <a href={asgn.submission_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#7EC8E8', display: 'inline-block', marginTop: 4 }}>🎥 Xem bài nộp</a>}
                    {asgn.teacher_feedback && <div style={{ fontSize: 13, color: T.text, background: T.bg, borderRadius: 6, padding: '6px 10px', marginTop: 6, borderLeft: `3px solid ${T.green}` }}><span style={{ color: T.textMuted, fontSize: 11 }}>Nhận xét giáo viên: </span>{asgn.teacher_feedback}</div>}
                    {asgn.ai_feedback && <div style={{ fontSize: 13, color: T.text, background: '#D8EAF0', borderRadius: 6, padding: '6px 10px', marginTop: 6, borderLeft: '3px solid #1A5A7A' }}><span style={{ color: '#1A5A7A', fontSize: 11 }}>🤖 AI nhận xét: </span>{asgn.ai_feedback}</div>}
                  </div>
                )
              })}
            </Card>
          </div>
        )}

        {activeTab === 'timeline' && (
          <Card>
            <SectionTitle>Timeline AI đã xử lý ({events.length})</SectionTitle>
            {events.length === 0 ? (
              <div style={{ color: T.textMuted, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>AI chưa xử lý sự kiện nào. Sau khi học sinh chat và nộp bài, AI sẽ tóm tắt ở đây.</div>
            ) : (
              <div style={{ position: 'relative', paddingLeft: 20 }}>
                <div style={{ position: 'absolute', left: 7, top: 0, bottom: 0, width: 2, background: T.border, borderRadius: 1 }} />
                {events.map(ev => (
                  <div key={ev.id} style={{ position: 'relative', marginBottom: 16 }}>
                    <div style={{ position: 'absolute', left: -17, top: 4, width: 10, height: 10, borderRadius: '50%', background: T.gold, border: `2px solid ${T.bg}` }} />
                    <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 3 }}>{ev.event_type && <span style={{ color: T.gold, marginRight: 6 }}>{ev.event_type}</span>}{fmtDateTime(ev.created_at)}</div>
                    <div style={{ fontSize: 13, color: T.text, lineHeight: 1.6 }}>{ev.summary}</div>
                    {ev.tags && ev.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                        {ev.tags.map(tag => <span key={tag} style={{ fontSize: 11, background: '#D8EDD8', color: '#1B6B3A', borderRadius: 4, padding: '2px 7px' }}>#{tag}</span>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}