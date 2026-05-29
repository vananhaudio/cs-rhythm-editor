import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// ─── Theme ────────────────────────────────────────────────────────────────────
const T = {
  bg: '#EAD7B8', bgCard: '#F5EDD8', bgLight: '#FBF5EA',
  header: '#1B6B3A', headerDark: '#134D2B',
  gold: '#A07820', goldLight: '#C8A84B', goldBg: '#FDF6E3',
  text: '#2C1F0E', textMuted: '#7A6548', textDim: '#A08B6A',
  border: '#C8B090', borderLight: '#DDD0B0',
  green: '#1B6B3A', greenLight: '#E8F2EC', greenMid: '#2E6B40',
  danger: '#8B3A1E',
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Student {
  id: string; full_name: string; email: string | null
  level: string | null; is_active: boolean; enrolled_at: string | null
}
interface Course {
  id: string; name: string; slug: string; type: string
  track: string | null; level_order: number
  is_free: boolean; pain_point: string | null; outcome: string | null
}
interface Enrollment {
  id: string; course_id: string; enrolled_at: string
  course: Course
}
interface DailyTask {
  id: string; title: string; type: string | null
  status: string; source: string; due_date: string
}
interface Achievement {
  id: string; type: string; title: string | null; achieved_at: string
}

function displayName(s: Student) {
  const n = s.full_name ?? ''
  return n.includes('@') ? n.split('@')[0] : n
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ pct, color = T.header }: { pct: number; color?: string }) {
  return (
    <div style={{ height: 6, background: T.borderLight, borderRadius: 3, overflow: 'hidden', marginTop: 8 }}>
      <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: color, borderRadius: 3, transition: 'width .5s ease' }} />
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '24px 16px', color: T.textDim, fontSize: 13 }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      {text}
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div>
        <div style={{ fontWeight: 700, fontSize: 16, color: T.text }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: T.textDim, marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface Props {
  student: Student
  onLogout: () => void
}

export default function StudentPortalV2({ student, onLogout }: Props) {
  const [enrollments, setEnrollments]   = useState<Enrollment[]>([])
  const [allCourses, setAllCourses]     = useState<Course[]>([])
  const [dailyTasks, setDailyTasks]     = useState<DailyTask[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split('T')[0]

      const [{ data: enr }, { data: courses }, { data: tasks }, { data: ach }] = await Promise.all([
        supabase.from('edu_enrollments')
          .select('id, course_id, enrolled_at, course:edu_courses(id,name,slug,type,track,level_order,is_free,pain_point,outcome)')
          .eq('student_id', student.id)
          .eq('is_active', true),
        supabase.from('edu_courses')
          .select('id,name,slug,type,track,level_order,is_free,pain_point,outcome')
          .eq('is_published', true)
          .order('track').order('level_order'),
        supabase.from('edu_daily_tasks')
          .select('id,title,type,status,source,due_date')
          .eq('student_id', student.id)
          .eq('due_date', today)
          .order('created_at'),
        supabase.from('edu_achievements')
          .select('id,type,title,achieved_at')
          .eq('student_id', student.id)
          .order('achieved_at', { ascending: false })
          .limit(20),
      ])

      setEnrollments((enr ?? []) as unknown as Enrollment[])
      setAllCourses(courses ?? [])
      setDailyTasks(tasks ?? [])
      setAchievements(ach ?? [])
      setLoading(false)
    }
    load()
  }, [student.id])

  const hanhTrinh = enrollments.filter(e => e.course?.type === 'hanh_trinh')
  const canhCua   = enrollments.filter(e => e.course?.type === 'canh_cua')
  const doneTasks = dailyTasks.filter(t => t.status === 'done').length
  const totalTasks = dailyTasks.length

  // Achievement counts
  const achSongs   = achievements.filter(a => a.type === 'song_completed').length
  const achVideos  = achievements.filter(a => a.type === 'video_submitted').length
  const achCourses = achievements.filter(a => a.type === 'course_completed').length
  const achDoors   = achievements.filter(a => a.type === 'door_unlocked').length

  // Bản đồ — group by track
  const trackOrder = ['nhap_mon', 'dem_hat', 'tia_not', 'nhac_ly', 'solo']
  const trackLabel: Record<string, string> = {
    nhap_mon: 'Nhập môn', dem_hat: 'Đệm Hát', tia_not: 'Tỉa Nốt',
    nhac_ly: 'Cánh Cửa Nhạc Lý', solo: 'Solo & Nghệ Sĩ',
  }
  const enrolledIds = new Set(enrollments.map(e => e.course_id))

  const toggleTask = async (task: DailyTask) => {
    const newStatus = task.status === 'done' ? 'pending' : 'done'
    await supabase.from('edu_daily_tasks').update({ status: newStatus }).eq('id', task.id)
    setDailyTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: T.textMuted, fontSize: 14 }}>
      Đang tải...
    </div>
  )

  return (
    <div style={{ background: T.bg, minHeight: '100vh', fontFamily: '"Segoe UI", Inter, system-ui, sans-serif', color: T.text }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header style={{ background: T.header, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🎸</span>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Thầy Văn Anh Guitar</div>
            <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 11 }}>Music Learning System</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{displayName(student)}</div>
            <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 11 }}>{student.level ?? 'Học sinh'}</div>
          </div>
          <button onClick={onLogout} style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 8, color: 'rgba(255,255,255,.7)', cursor: 'pointer', padding: '6px 12px', fontSize: 12, fontFamily: 'inherit' }}>
            Đăng xuất
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 60px' }}>

        {/* ── KHỐI 1: HÀNH TRÌNH ─────────────────────────────────────── */}
        <section style={{ marginBottom: 28 }}>
          <SectionHeader icon="🎸" title="Hành Trình Của Tôi" sub="Khoá học bạn đang theo học" />

          {hanhTrinh.length === 0 ? (
            <div style={{ background: T.bgCard, border: `1px solid ${T.borderLight}`, borderRadius: 14, padding: '24px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🌱</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Hành trình chưa bắt đầu</div>
              <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6 }}>Thầy sẽ thêm bạn vào khoá học phù hợp sau buổi học đầu tiên.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {hanhTrinh.map(e => (
                <div key={e.id} style={{ background: T.bgCard, border: `1.5px solid ${T.border}`, borderRadius: 14, padding: '16px 18px', cursor: 'pointer' }}
                  onMouseEnter={el => (el.currentTarget.style.borderColor = T.header)}
                  onMouseLeave={el => (el.currentTarget.style.borderColor = T.border)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{e.course?.name}</div>
                      <div style={{ fontSize: 12, color: T.textDim }}>Đang học</div>
                    </div>
                    <div style={{ background: T.greenLight, color: T.greenMid, borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>▶ Tiếp tục</div>
                  </div>
                  <ProgressBar pct={0} color={T.header} />
                  <div style={{ fontSize: 11, color: T.textDim, marginTop: 4 }}>Chưa có dữ liệu tiến độ</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── KHỐI 2: CÁNH CỬA ───────────────────────────────────────── */}
        <section style={{ marginBottom: 28 }}>
          <SectionHeader icon="🚪" title="Cánh Cửa Đang Vượt Qua" sub="Chuyên đề giải quyết điểm yếu" />

          {canhCua.length === 0 ? (
            <div style={{ background: T.bgCard, border: `1px solid ${T.borderLight}`, borderRadius: 14, padding: '20px', textAlign: 'center' }}>
              <Empty icon="🔑" text="Thầy sẽ mở Cánh Cửa phù hợp khi bạn gặp khó khăn cụ thể." />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {canhCua.map(e => (
                <div key={e.id} style={{ background: T.bgCard, border: `1.5px solid ${T.borderLight}`, borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, color: T.gold, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>Cánh Cửa</div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{e.course?.name}</div>
                  {e.course?.pain_point && (
                    <div style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.5, marginBottom: 8, fontStyle: 'italic' }}>"{e.course.pain_point}"</div>
                  )}
                  <ProgressBar pct={0} color={T.gold} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── KHỐI 3: VIỆC HÔM NAY ───────────────────────────────────── */}
        <section style={{ marginBottom: 28 }}>
          <SectionHeader
            icon="🎯"
            title="Việc Hôm Nay"
            sub={totalTasks > 0 ? `${doneTasks}/${totalTasks} hoàn thành` : undefined}
          />

          <div style={{ background: T.bgCard, border: `1px solid ${T.borderLight}`, borderRadius: 14, overflow: 'hidden' }}>
            {dailyTasks.length === 0 ? (
              <Empty icon="☀️" text="Chưa có việc hôm nay. Hệ thống sẽ gợi ý sau khi bạn bắt đầu khoá học." />
            ) : (
              dailyTasks.map((task, i) => (
                <div key={task.id}
                  onClick={() => toggleTask(task)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', cursor: 'pointer', borderTop: i > 0 ? `1px solid ${T.borderLight}` : 'none', transition: 'background .1s' }}
                  onMouseEnter={el => (el.currentTarget.style.background = T.bgLight)}
                  onMouseLeave={el => (el.currentTarget.style.background = 'transparent')}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${task.status === 'done' ? T.header : T.border}`, background: task.status === 'done' ? T.header : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s' }}>
                    {task.status === 'done' && <span style={{ color: '#fff', fontSize: 12 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: task.status === 'done' ? T.textDim : T.text, textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>
                      {task.title}
                    </div>
                    {task.source === 'teacher' && (
                      <div style={{ fontSize: 11, color: T.gold, marginTop: 2 }}>👨‍🏫 Thầy giao</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* ── KHỐI 4: THÀNH QUẢ ──────────────────────────────────────── */}
        <section style={{ marginBottom: 28 }}>
          <SectionHeader icon="🏆" title="Thành Quả Của Tôi" sub="Những gì bạn đã đạt được" />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {[
              { icon: '🎵', value: achSongs,   label: 'Bài hát hoàn thành' },
              { icon: '🎬', value: achVideos,  label: 'Video đã nộp' },
              { icon: '📚', value: achCourses, label: 'Khoá học xong' },
              { icon: '🚪', value: achDoors,   label: 'Cánh cửa đã vượt' },
            ].map(a => (
              <div key={a.label} style={{ background: T.bgCard, border: `1px solid ${T.borderLight}`, borderRadius: 12, padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>{a.icon}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: a.value > 0 ? T.header : T.borderLight, lineHeight: 1 }}>{a.value}</div>
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{a.label}</div>
              </div>
            ))}
          </div>

          {achievements.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: T.textDim }}>
              Thành quả sẽ xuất hiện khi bạn hoàn thành bài học đầu tiên 🌟
            </div>
          )}
        </section>

        {/* ── KHỐI 5: BẢN ĐỒ ÂM NHẠC ────────────────────────────────── */}
        <section style={{ marginBottom: 28 }}>
          <SectionHeader icon="🗺" title="Bản Đồ Âm Nhạc" sub="Toàn bộ hành trình phía trước" />

          <div style={{ background: T.bgCard, border: `1px solid ${T.borderLight}`, borderRadius: 14, padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {trackOrder.map(track => {
              const courses = allCourses.filter(c => c.track === track)
              if (courses.length === 0) return null
              return (
                <div key={track}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.textDim, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
                    {trackLabel[track]}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    {courses.map((c, i) => {
                      const enrolled = enrolledIds.has(c.id)
                      const isLast = i === courses.length - 1
                      return (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                            background: enrolled ? T.header : c.is_free ? T.greenLight : T.bg,
                            color: enrolled ? '#fff' : c.is_free ? T.greenMid : T.textDim,
                            border: `1.5px solid ${enrolled ? T.header : c.is_free ? T.greenMid : T.borderLight}`,
                          }}>
                            {enrolled ? '▶ ' : c.is_free ? '✓ ' : '🔒 '}{c.name}
                          </div>
                          {!isLast && <span style={{ color: T.borderLight, fontSize: 16 }}>→</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {allCourses.length === 0 && (
              <Empty icon="🗺" text="Bản đồ đang được xây dựng..." />
            )}
          </div>
        </section>

        {/* ── KHỐI 6: KHU VỰC TƯƠNG LAI (placeholder) ────────────────── */}
        <section>
          <div style={{ background: T.bgCard, border: `1.5px dashed ${T.borderLight}`, borderRadius: 14, padding: '24px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🌟</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: T.text }}>Khu Vực Đặc Biệt</div>
            <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 12, lineHeight: 1.6 }}>
              Dành riêng cho học viên <strong>Hành Trình Trở Thành Nghệ Sĩ Guitar</strong>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {['🎤 Open Mic', '🤖 AI Coach', '👥 Cộng đồng', '🎓 Hồ sơ nghệ sĩ', '📡 Truyền nghề'].map(f => (
                <span key={f} style={{ background: T.bg, border: `1px solid ${T.borderLight}`, borderRadius: 16, padding: '5px 12px', fontSize: 12, color: T.textDim }}>
                  {f}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: T.textDim }}>🚧 Đang phát triển</div>
          </div>
        </section>

      </div>
    </div>
  )
}
