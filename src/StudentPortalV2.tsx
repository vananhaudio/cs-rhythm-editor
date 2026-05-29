import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const T = {
  bg: '#EAD7B8', bgCard: '#F5EDD8', bgLight: '#FBF5EA',
  header: '#1B6B3A', headerDark: '#134D2B',
  gold: '#A07820', goldLight: '#C8A84B',
  text: '#2C1F0E', textMuted: '#7A6548', textDim: '#A08B6A',
  border: '#C8B090', borderLight: '#DDD0B0',
  green: '#1B6B3A', greenLight: '#E8F2EC', greenMid: '#2E6B40',
}

interface Student {
  id: string; full_name: string; email: string | null
  level: string | null; is_active: boolean; enrolled_at: string | null
}
interface Enrollment {
  id: string; course_id: string; enrolled_at: string
  course: { id: string; name: string; slug: string; type: string; track: string | null; pain_point: string | null }
}
interface DailyTask {
  id: string; title: string; type: string | null; status: string; source: string
}
interface Achievement {
  id: string; type: string; title: string | null; achieved_at: string
}

function displayName(s: Student) {
  const n = s.full_name ?? ''
  return n.includes('@') ? n.split('@')[0] : n
}

function Bar({ pct }: { pct: number }) {
  return (
    <div style={{ height: 6, background: T.borderLight, borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(100, Math.max(pct, pct > 0 ? pct : 0))}%`, background: T.header, borderRadius: 3, minWidth: pct > 0 ? 8 : 0 }} />
    </div>
  )
}

const LEVEL_LABEL: Record<string, string> = {
  beginner: 'Mới bắt đầu', elementary: 'Cơ bản',
  intermediate: 'Trung cấp', advanced: 'Nâng cao',
}

const MOCK_COURSES = [
  { zone: 'Nghệ Thuật Đệm Hát', session: 3, total: 10, next: 'Kỹ thuật gảy dây liên tục', pct: 40 },
  { zone: 'Hiểu Biết Âm Nhạc',  session: 5, total: 8,  next: 'Hợp âm 7 và ứng dụng',    pct: 70 },
]

interface Props { student: Student; onLogout: () => void }

export default function StudentPortalV2({ student, onLogout }: Props) {
  const [enrollments, setEnrollments]   = useState<Enrollment[]>([])
  const [dailyTasks, setDailyTasks]     = useState<DailyTask[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [streak, setStreak]             = useState(0)
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split('T')[0]
      const [{ data: enr }, { data: tasks }, { data: ach }, { data: events }] = await Promise.all([
        supabase.from('edu_enrollments')
          .select('id,course_id,enrolled_at,course:edu_courses(id,name,slug,type,track,pain_point)')
          .eq('student_id', student.id).eq('is_active', true),
        supabase.from('edu_daily_tasks')
          .select('id,title,type,status,source')
          .eq('student_id', student.id).eq('due_date', today).order('created_at'),
        supabase.from('edu_achievements')
          .select('id,type,title,achieved_at')
          .eq('student_id', student.id).order('achieved_at', { ascending: false }).limit(50),
        supabase.from('edu_learning_events')
          .select('created_at').eq('student_id', student.id)
          .order('created_at', { ascending: false }).limit(30),
      ])
      if (events?.length) {
        const days = [...new Set(events.map((e: { created_at: string }) =>
          new Date(e.created_at).toISOString().split('T')[0]))].sort().reverse()
        let s = 0; let prev = today
        for (const d of days) {
          if ((new Date(prev).getTime() - new Date(d).getTime()) / 86400000 <= 1) { s++; prev = d } else break
        }
        setStreak(s)
      }
      setEnrollments((enr ?? []) as unknown as Enrollment[])
      setDailyTasks(tasks ?? [])
      setAchievements(ach ?? [])
      setLoading(false)
    }
    load()
  }, [student.id])

  const toggleTask = async (task: DailyTask) => {
    const s = task.status === 'done' ? 'pending' : 'done'
    await supabase.from('edu_daily_tasks').update({ status: s }).eq('id', task.id)
    setDailyTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: s } : t))
  }

  const hanhTrinh = enrollments.filter(e => e.course?.type === 'hanh_trinh')
  const canhCua   = enrollments.filter(e => e.course?.type === 'canh_cua')
  const doneTasks = dailyTasks.filter(t => t.status === 'done').length
  const achSongs   = achievements.filter(a => a.type === 'song_completed').length
  const achVideos  = achievements.filter(a => a.type === 'video_submitted').length
  const achCourses = achievements.filter(a => a.type === 'course_completed').length
  const achDoors   = achievements.filter(a => a.type === 'door_unlocked').length

  const courses = hanhTrinh.length > 0
    ? hanhTrinh.map(e => ({ zone: e.course?.name ?? '', session: 1, total: 10, next: 'Đang cập nhật...', pct: 5 }))
    : MOCK_COURSES

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', background: T.bg, color: T.textMuted }}>Đang tải...</div>

  return (
    <div style={{ background: T.bg, minHeight: '100vh', fontFamily: '"Segoe UI", Inter, system-ui, sans-serif', color: T.text }}>

      {/* Header */}
      <header style={{ background: T.header, padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🎸</span>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Thầy Văn Anh Guitar</span>
        </div>
        <button onClick={onLogout} style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 6, color: 'rgba(255,255,255,.8)', cursor: 'pointer', padding: '5px 12px', fontSize: 12, fontFamily: 'inherit' }}>
          Đăng xuất
        </button>
      </header>

      <div style={{ maxWidth: 1200, width: '92%', margin: '0 auto', padding: '28px 0 60px', display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* ══ 1. THÔNG TIN HỌC VIÊN ══════════════════════════════════════ */}
        <section>
          <div style={{ background: T.header, borderRadius: 14, padding: '22px 28px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
            <div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', marginBottom: 4 }}>Xin chào</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{displayName(student).toUpperCase()}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', marginTop: 4 }}>
                {student.level ? LEVEL_LABEL[student.level] : 'Học viên'} · {hanhTrinh.length === 0 ? MOCK_COURSES.length : hanhTrinh.length} khoá đang học
              </div>
            </div>
            <div style={{ display: 'flex', gap: 24 }}>
              {[
                { label: 'Chuỗi học', value: Math.max(streak, 1), unit: 'ngày 🔥' },
                { label: 'Hôm nay',   value: `${doneTasks}/${dailyTasks.length || '–'}`, unit: 'việc xong' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.55)', marginTop: 3 }}>{s.unit}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ 2. HÀNH TRÌNH CỦA TÔI ══════════════════════════════════════ */}
        <section>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.textDim, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>🎸 Hành Trình Của Tôi</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {courses.map((c, i) => (
              <div key={i} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: '20px', display: 'flex', flexDirection: 'column', gap: 10 }}
                onMouseEnter={el => (el.currentTarget.style.borderColor = T.header)}
                onMouseLeave={el => (el.currentTarget.style.borderColor = T.border)}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 20, color: T.header, lineHeight: 1 }}>{c.zone}</div>
                  <div style={{ fontSize: 16, color: T.textMuted, flexShrink: 0 }}>Buổi {c.session} / {c.total}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: T.text }}>Bài tiếp: {c.next}</div>
                  <button style={{ background: T.header, color: '#fff', border: 'none', borderRadius: 8, height: 42, padding: '0 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                    Học ngay →
                  </button>
                </div>
                <Bar pct={c.pct} />
              </div>
            ))}
            {hanhTrinh.length === 0 && (
              <div style={{ fontSize: 12, color: T.textDim, paddingLeft: 4, marginTop: 2 }}>
                Đây là dữ liệu mẫu — Thầy sẽ thêm bạn vào khoá học sau buổi học đầu tiên.
              </div>
            )}
          </div>
        </section>

                {/* ══ 3. THÀNH QUẢ ═══════════════════════════════════════════════ */}
        <section>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.textDim, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>🏆 Thành Quả</div>
          <div style={{ background: T.bgCard, border: `1px solid ${T.borderLight}`, borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' as const }}>
            {[
              { icon: '🎵', value: achSongs,             label: 'bài hát'      },
              { icon: '🎬', value: achVideos,            label: 'video'        },
              { icon: '🔥', value: Math.max(streak, 1), label: 'ngày'         },
              { icon: '🚪', value: achDoors,             label: 'cánh cửa'    },
              { icon: '📚', value: achCourses,           label: 'khoá xong'   },
            ].map((a, i, arr) => (
              <div key={a.label} style={{ display: 'flex', alignItems: 'baseline', gap: 5, paddingRight: i < arr.length - 1 ? 28 : 0, borderRight: i < arr.length - 1 ? `1px solid ${T.borderLight}` : 'none' }}>
                <span style={{ fontSize: 16 }}>{a.icon}</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: a.value > 0 ? T.header : T.textDim }}>{a.value}</span>
                <span style={{ fontSize: 13, color: T.textDim }}>{a.label}</span>
              </div>
            ))}
          </div>
        </section>

                {/* ══ 4. CÁNH CỬA ════════════════════════════════════════════════ */}
        {canhCua.length > 0 && (
          <section>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.textDim, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>🚪 Cánh Cửa Đang Vượt</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {canhCua.map(e => (
                <div key={e.id} style={{ background: T.bgCard, border: `1px solid ${T.borderLight}`, borderRadius: 12, padding: '14px 18px' }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: e.course?.pain_point ? 4 : 0 }}>{e.course?.name}</div>
                  {e.course?.pain_point && <div style={{ fontSize: 12, color: T.textMuted, fontStyle: 'italic' }}>"{e.course.pain_point}"</div>}
                </div>
              ))}
            </div>
          </section>
        )}


      </div>
    </div>
  )
}
