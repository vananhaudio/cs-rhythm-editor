import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const T = {
  bg: '#EAD7B8', bgCard: '#F5EDD8', bgLight: '#FBF5EA',
  header: '#1B6B3A', headerDark: '#134D2B',
  gold: '#A07820', goldLight: '#C8A84B', goldBg: '#FDF6E3',
  text: '#2C1F0E', textMuted: '#7A6548', textDim: '#A08B6A',
  border: '#C8B090', borderLight: '#DDD0B0',
  green: '#1B6B3A', greenLight: '#E8F2EC', greenMid: '#2E6B40',
}

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
  course: Course; progress_pct: number
}
interface DailyTask {
  id: string; title: string; type: string | null; status: string; source: string
}
interface Achievement {
  id: string; type: string; title: string | null; achieved_at: string
}

function displayName(s: Student) {
  const n = s.full_name ?? ''
  if (n.includes('@')) return n.split('@')[0]
  return n.split(' ').slice(-1)[0] // Lấy tên (từ cuối)
}

function ProgressBar({ pct, color = T.header, height = 8 }: { pct: number; color?: string; height?: number }) {
  const real = Math.max(pct, pct > 0 ? pct : 0)
  return (
    <div style={{ height, background: T.borderLight, borderRadius: height / 2, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(100, real)}%`, background: color, borderRadius: height / 2, transition: 'width .8s ease', minWidth: real > 0 ? 8 : 0 }} />
    </div>
  )
}

const LEVEL_LABEL: Record<string, string> = {
  beginner: 'Người mới bắt đầu', elementary: 'Cơ bản',
  intermediate: 'Trung cấp', advanced: 'Nâng cao',
}

const TRACK_TOOLS: Record<string, { unlocked: string[]; next: string[] }> = {
  'nhac-ly-co-ban':  { unlocked: ['Tap Tempo', 'Tap Beat'], next: ['Tap Beam'] },
  'nhac-ly-nang-cao':{ unlocked: ['Tap Tempo', 'Tap Beat', 'Tap Beam'], next: ['Scroll Kara'] },
  'hoa-am-cam-am':   { unlocked: ['Tap Tempo', 'Tap Beat', 'Scroll Kara'], next: ['Chord Seeing'] },
}

const TRACK_ORDER = ['nhap_mon', 'dem_hat', 'tia_not', 'nhac_ly', 'solo']
const TRACK_LABEL: Record<string, string> = {
  nhap_mon: 'Nhập môn', dem_hat: 'Đệm Hát',
  tia_not: 'Tỉa Nốt', nhac_ly: 'Cánh Cửa Nhạc Lý', solo: 'Solo & Nghệ Sĩ',
}

interface Props { student: Student; onLogout: () => void }

export default function StudentPortalV2({ student, onLogout }: Props) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [allCourses, setAllCourses]   = useState<Course[]>([])
  const [dailyTasks, setDailyTasks]   = useState<DailyTask[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [streak, setStreak]           = useState(0)
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split('T')[0]
      const [{ data: enr }, { data: courses }, { data: tasks }, { data: ach }, { data: events }] = await Promise.all([
        supabase.from('edu_enrollments')
          .select('id,course_id,enrolled_at,course:edu_courses(id,name,slug,type,track,level_order,is_free,pain_point,outcome)')
          .eq('student_id', student.id).eq('is_active', true),
        supabase.from('edu_courses')
          .select('id,name,slug,type,track,level_order,is_free,pain_point,outcome')
          .eq('is_published', true).order('track').order('level_order'),
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

      // Tính streak (ngày học liên tục)
      if (events && events.length > 0) {
        const days = [...new Set(events.map((e: { created_at: string }) =>
          new Date(e.created_at).toISOString().split('T')[0]
        ))].sort().reverse()
        let s = 0
        let prev = today
        for (const d of days) {
          const diff = (new Date(prev).getTime() - new Date(d).getTime()) / 86400000
          if (diff <= 1) { s++; prev = d } else break
        }
        setStreak(s)
      }

      // Thêm progress_pct mặc định = 5% cho enrolled (cảm giác đã bắt đầu)
      const enriched = ((enr ?? []) as unknown as Enrollment[]).map(e => ({
        ...e, progress_pct: 5
      }))

      setEnrollments(enriched)
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
  const enrolledIds = new Set(enrollments.map(e => e.course_id))

  // Thành quả
  const achSongs   = achievements.filter(a => a.type === 'song_completed').length
  const achVideos  = achievements.filter(a => a.type === 'video_submitted').length
  const achCourses = achievements.filter(a => a.type === 'course_completed').length
  const achDoors   = achievements.filter(a => a.type === 'door_unlocked').length

  // Overall progress (trung bình các khoá đang học)
  const overallPct = enrollments.length > 0
    ? Math.round(enrollments.reduce((sum, e) => sum + e.progress_pct, 0) / enrollments.length)
    : 0

  const toggleTask = async (task: DailyTask) => {
    const newStatus = task.status === 'done' ? 'pending' : 'done'
    await supabase.from('edu_daily_tasks').update({ status: newStatus }).eq('id', task.id)
    setDailyTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: T.textMuted, fontSize: 14, background: T.bg }}>
      Đang tải...
    </div>
  )

  const name = displayName(student)

  return (
    <div style={{ background: T.bg, minHeight: '100vh', fontFamily: '"Segoe UI", Inter, system-ui, sans-serif', color: T.text }}>

      {/* Header */}
      <header style={{ background: T.header, padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>🎸</span>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Thầy Văn Anh Guitar</span>
        </div>
        <button onClick={onLogout} style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 8, color: 'rgba(255,255,255,.7)', cursor: 'pointer', padding: '5px 12px', fontSize: 12, fontFamily: 'inherit' }}>
          Đăng xuất
        </button>
      </header>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 60px' }}>

        {/* ══ HERO CARD ═══════════════════════════════════════════════════ */}
        <div style={{ background: T.header, borderRadius: 20, padding: '24px 24px 20px', marginBottom: 24, color: '#fff', position: 'relative', overflow: 'hidden' }}>
          {/* Decorative circle */}
          <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,.05)' }} />
          <div style={{ position: 'absolute', bottom: -20, right: 40, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,.04)' }} />

          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', marginBottom: 4 }}>🎸 Xin chào</div>
          <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 16, lineHeight: 1.1 }}>
            {name.toUpperCase()}
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            <div style={{ background: 'rgba(255,255,255,.1)', borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', marginBottom: 4 }}>🌱 Cấp độ</div>
              <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>
                {student.level ? LEVEL_LABEL[student.level] : 'Đang bắt đầu'}
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,.1)', borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', marginBottom: 4 }}>🔥 Chuỗi học</div>
              <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{Math.max(streak, 1)}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.5)' }}>ngày</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,.1)', borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', marginBottom: 4 }}>🎯 Hôm nay</div>
              <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{doneTasks}/{dailyTasks.length || '–'}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.5)' }}>việc xong</div>
            </div>
          </div>

          {/* Overall progress */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,.7)', marginBottom: 6 }}>
              <span>Tiến độ hành trình tổng</span>
              <span style={{ fontWeight: 700 }}>{overallPct > 0 ? `${overallPct}%` : enrollments.length > 0 ? '5%' : 'Chưa bắt đầu'}</span>
            </div>
            <div style={{ height: 10, background: 'rgba(255,255,255,.15)', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.max(overallPct, enrollments.length > 0 ? 5 : 0)}%`, background: T.goldLight, borderRadius: 5, transition: 'width 1s ease', minWidth: enrollments.length > 0 ? 12 : 0 }} />
            </div>
            {enrollments.length > 0 && overallPct < 10 && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginTop: 6 }}>
                Bạn đang ở những bước đầu tiên của hành trình âm nhạc 🌱
              </div>
            )}
          </div>
        </div>

        {/* ══ HÀNH TRÌNH ══════════════════════════════════════════════════ */}
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 18 }}>🎸</span>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Hành Trình Của Tôi</span>
          </div>

          {(() => {
            const MOCK = [
              { name: 'Khởi Đầu Đam Mê — Đệm Hát Trình Độ 1', pct: 40, since: 'tháng 3, 2026', nextLesson: 'Kỹ thuật gảy dây liên tục' },
              { name: 'Chìa Khoá Nhạc Lý Cơ Bản', pct: 70, since: 'tháng 4, 2026', nextLesson: 'Hợp âm 7 và ứng dụng' },
            ]
            const list = hanhTrinh.length > 0
              ? hanhTrinh.map(e => ({ name: e.course?.name ?? '', pct: e.progress_pct, since: new Date(e.enrolled_at).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' }), nextLesson: null as string | null }))
              : MOCK
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {list.map((item, idx) => (
                  <div key={idx} style={{ background: T.bgCard, border: `1.5px solid ${T.border}`, borderRadius: 14, padding: '18px', cursor: 'pointer', transition: 'border-color .15s, transform .1s' }}
                    onMouseEnter={el => { el.currentTarget.style.borderColor = T.header; el.currentTarget.style.transform = 'translateY(-1px)' }}
                    onMouseLeave={el => { el.currentTarget.style.borderColor = T.border; el.currentTarget.style.transform = 'translateY(0)' }}>
                    {/* Tên hành trình */}
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>{item.name}</div>
                    {/* Buổi hiện tại */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, background: T.greenLight, color: T.greenMid, borderRadius: 4, padding: '2px 8px', fontWeight: 600 }}>Đang học</span>
                      <span style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>Buổi {Math.ceil(item.pct / 14) || 1}</span>
                    </div>
                    {/* Bài học tiếp theo */}
                    <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 14 }}>
                      ▸ Bài tiếp theo: <span style={{ color: T.text, fontWeight: 500 }}>{item.nextLesson ?? 'Đang cập nhật...'}</span>
                    </div>
                    {/* Thanh tiến độ */}
                    <ProgressBar pct={item.pct} color={T.header} height={6} />
                  </div>
                ))}
                {hanhTrinh.length === 0 && (
                  <div style={{ fontSize: 11, color: T.textDim, textAlign: 'center', paddingTop: 4 }}>
                    ✦ Đây là ví dụ minh hoạ — dữ liệu thật sẽ hiện sau khi Thầy thêm bạn vào khoá học
                  </div>
                )}
              </div>
            )
          })()}
        </section>


        {/* ══ THẾ GIỚI GUITAR ════════════════════════════════════════════ */}
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>🌍</span>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Thế Giới Guitar</span>
          </div>
          <p style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.7, marginBottom: 16 }}>
            Mỗi người đến với guitar theo một con đường khác nhau.<br />
            Bạn đang ở một phần của thế giới này.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              {
                icon: '🎤',
                title: 'Nghệ Thuật Đệm Hát',
                desc: 'Học cách tự đệm hát những bài mình yêu thích.',
                active: true,
                btnLabel: 'Bạn đang học tại đây',
              },
              {
                icon: '🎸',
                title: 'Nghệ Thuật Tỉa Nốt',
                desc: 'Chơi giai điệu trên nền karaoke.',
                active: false,
                btnLabel: 'Chưa khám phá',
              },
              {
                icon: '📚',
                title: 'Hiểu Biết Âm Nhạc',
                desc: 'Nhạc lý · Hòa âm · Cảm âm.',
                active: false,
                btnLabel: 'Chưa khám phá',
              },
              {
                icon: '⭐',
                title: 'Con Đường Nghệ Sĩ',
                desc: 'Biểu diễn · Sáng tạo · Truyền cảm hứng.',
                active: false,
                btnLabel: 'Chưa mở',
                locked: true,
              },
            ].map((item, i) => (
              <div key={i} style={{
                background: item.active ? T.header : T.bgCard,
                border: `1.5px solid ${item.active ? T.header : T.borderLight}`,
                borderRadius: 16,
                padding: '20px',
                opacity: item.active ? 1 : item.locked ? 0.5 : 0.7,
                transition: 'opacity .2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 22 }}>{item.icon}</span>
                      <span style={{ fontWeight: 700, fontSize: 16, color: item.active ? '#fff' : T.text }}>
                        {item.title}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: item.active ? 'rgba(255,255,255,.75)' : T.textMuted, lineHeight: 1.6 }}>
                      {item.desc}
                    </div>
                  </div>
                  <div style={{
                    flexShrink: 0, borderRadius: 10,
                    padding: '7px 14px', fontSize: 12, fontWeight: 600,
                    background: item.active ? 'rgba(255,255,255,.15)' : T.bg,
                    color: item.active ? '#fff' : item.locked ? T.textDim : T.textMuted,
                    border: `1px solid ${item.active ? 'rgba(255,255,255,.25)' : T.borderLight}`,
                    whiteSpace: 'nowrap' as const,
                  }}>
                    {item.locked ? '🔒 ' : item.active ? '▶ ' : ''}{item.btnLabel}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

                {/* ══ VIỆC HÔM NAY ════════════════════════════════════════════════ */}
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🎯</span>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Việc Hôm Nay</span>
            </div>
            {dailyTasks.length > 0 && (
              <span style={{ fontSize: 13, color: doneTasks === dailyTasks.length ? T.greenMid : T.textMuted, fontWeight: 600 }}>
                {doneTasks}/{dailyTasks.length} hoàn thành
              </span>
            )}
          </div>

          {dailyTasks.length === 0 ? (
            <div style={{ background: T.bgCard, border: `1px solid ${T.borderLight}`, borderRadius: 14, padding: '28px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>☀️</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Chưa có nhiệm vụ mới</div>
              <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6 }}>
                Hãy tiếp tục hành trình đang học bên dưới.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dailyTasks.map(task => {
                const done = task.status === 'done'
                const typeIcon: Record<string, string> = {
                  watch_lesson: '🎬', tap_exercise: '🥁',
                  submit_video: '📹', practice: '🎸', assignment: '📝',
                }
                const typeLabel: Record<string, string> = {
                  watch_lesson: 'Học ngay', tap_exercise: 'Bắt đầu',
                  submit_video: 'Nộp bài', practice: 'Luyện tập', assignment: 'Làm bài',
                }
                const btnLabel = typeLabel[task.type ?? ''] ?? 'Bắt đầu'
                const icon = typeIcon[task.type ?? ''] ?? '🎯'
                return (
                  <div key={task.id} style={{
                    background: done ? T.bg : T.bgCard,
                    border: `1.5px solid ${done ? T.borderLight : T.border}`,
                    borderRadius: 14, padding: '16px',
                    opacity: done ? .6 : 1, transition: 'opacity .2s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      {/* Check circle */}
                      <div onClick={() => toggleTask(task)}
                        style={{ width: 26, height: 26, borderRadius: '50%', border: `2px solid ${done ? T.header : T.border}`, background: done ? T.header : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', marginTop: 2, transition: 'all .2s' }}>
                        {done && <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: done ? T.textDim : T.text, textDecoration: done ? 'line-through' : 'none', marginBottom: 4 }}>
                          {icon} {task.title}
                        </div>
                        {task.source === 'teacher' && (
                          <div style={{ fontSize: 11, color: T.gold, marginBottom: 6 }}>👨‍🏫 Thầy giao</div>
                        )}
                        {!done && (
                          <button onClick={() => toggleTask(task)} style={{
                            background: T.header, color: '#fff', border: 'none',
                            borderRadius: 8, padding: '7px 16px', fontSize: 13,
                            fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                            marginTop: 4,
                          }}>
                            {btnLabel} →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ══ CÁNH CỬA ════════════════════════════════════════════════════ */}
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 18 }}>🚪</span>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Cánh Cửa Đang Vượt Qua</span>
          </div>

          {canhCua.length === 0 ? (
            <div style={{ background: T.bgCard, border: `1px solid ${T.borderLight}`, borderRadius: 14, padding: '20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 28, flexShrink: 0 }}>🔑</span>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Chưa có Cánh Cửa nào mở</div>
                <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6 }}>
                  Khi gặp một điểm yếu cụ thể — lệch nhịp, không cảm âm — Thầy sẽ mở Cánh Cửa phù hợp để bạn vượt qua.
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {canhCua.map(e => {
                const tools = TRACK_TOOLS[e.course?.slug ?? '']
                return (
                  <div key={e.id} style={{ background: T.goldBg, border: `1.5px solid ${T.goldLight}`, borderRadius: 14, padding: '16px' }}>
                    <div style={{ fontSize: 10, color: T.gold, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Cánh Cửa</div>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{e.course?.name}</div>
                    {e.course?.pain_point && (
                      <div style={{ fontSize: 11, color: T.textMuted, fontStyle: 'italic', marginBottom: 10, lineHeight: 1.5 }}>"{e.course.pain_point}"</div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: T.textMuted, marginBottom: 4 }}>
                      <span>Tiến độ</span><span style={{ fontWeight: 600, color: T.gold }}>{e.progress_pct}%</span>
                    </div>
                    <ProgressBar pct={e.progress_pct} color={T.gold} height={6} />
                    {tools && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 11, color: T.textDim, marginBottom: 6 }}>Công cụ đã mở khoá</div>
                        {tools.unlocked.map(t => (
                          <div key={t} style={{ fontSize: 12, color: T.greenMid, marginBottom: 3 }}>✓ {t}</div>
                        ))}
                        {tools.next.map(t => (
                          <div key={t} style={{ fontSize: 12, color: T.textDim, marginBottom: 3 }}>🔒 {t}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ══ THÀNH QUẢ ═══════════════════════════════════════════════════ */}
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 18 }}>🏆</span>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Thành Quả Của Tôi</span>
          </div>

          <div style={{ background: T.bgCard, border: `1px solid ${T.borderLight}`, borderRadius: 14, padding: '20px' }}>
            {[
              { icon: '🎵', value: achSongs,   label: 'Bài hát hoàn thành',    zero: 'Hoàn thành bài hát đầu tiên!' },
              { icon: '🎬', value: achVideos,  label: 'Video đã nộp',           zero: 'Nộp video luyện tập đầu tiên!' },
              { icon: '🔥', value: Math.max(streak, 1), label: 'Ngày học liên tục', zero: null },
              { icon: '🚪', value: achDoors,   label: 'Cánh cửa đã vượt',       zero: 'Vượt qua Cánh Cửa đầu tiên!' },
              { icon: '📚', value: achCourses, label: 'Khoá học hoàn thành',    zero: 'Hoàn thành khoá học đầu tiên!' },
            ].map((a, i) => (
              <div key={a.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: i > 0 ? `1px solid ${T.borderLight}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 22 }}>{a.icon}</span>
                  <span style={{ fontSize: 14, color: T.textMuted }}>{a.label}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: a.value > 0 ? T.header : T.borderLight, lineHeight: 1 }}>{a.value}</span>
                  {a.value === 0 && a.zero && (
                    <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>→ {a.zero}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ══ BẢN ĐỒ ÂM NHẠC ═════════════════════════════════════════════ */}
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 18 }}>🗺</span>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Bản Đồ Âm Nhạc</span>
            <span style={{ fontSize: 12, color: T.textDim }}>— Hành trình phía trước</span>
          </div>

          <div style={{ background: T.bgCard, border: `1px solid ${T.borderLight}`, borderRadius: 16, padding: '20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
            {allCourses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: T.textDim, fontSize: 13 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🗺</div>
                Bản đồ đang được xây dựng...
              </div>
            ) : (
              TRACK_ORDER.map(track => {
                const courses = allCourses.filter(c => c.track === track)
                if (courses.length === 0) return null
                const isCanhCua = track === 'nhac_ly'
                return (
                  <div key={track}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: isCanhCua ? T.gold : T.textDim, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                      {isCanhCua ? '🔑 ' : ''}{TRACK_LABEL[track]}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {courses.map((c, i) => {
                        const enrolled = enrolledIds.has(c.id)
                        const isLast = i === courses.length - 1
                        const status = enrolled ? 'current' : c.is_free ? 'free' : 'locked'
                        return (
                          <div key={c.id} style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
                            {/* Connector line */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32, flexShrink: 0 }}>
                              <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2.5px solid ${enrolled ? T.header : c.is_free ? T.greenMid : T.borderLight}`, background: enrolled ? T.header : c.is_free ? T.greenLight : T.bgLight, flexShrink: 0, marginTop: 10 }} />
                              {!isLast && <div style={{ width: 2, flex: 1, background: T.borderLight, marginTop: 2, marginBottom: 0 }} />}
                            </div>
                            {/* Card */}
                            <div style={{ flex: 1, padding: '8px 0 12px 10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 13, fontWeight: enrolled ? 700 : 400, color: enrolled ? T.header : status === 'locked' ? T.textDim : T.text }}>
                                  {enrolled ? '▶ ' : c.is_free ? '✓ ' : '🔒 '}{c.name}
                                </span>
                                {c.is_free && !enrolled && (
                                  <span style={{ fontSize: 10, background: T.greenLight, color: T.greenMid, borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>Miễn phí</span>
                                )}
                                {enrolled && (
                                  <span style={{ fontSize: 10, background: T.header, color: '#fff', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>Đang học</span>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {/* Destination marker for dem_hat track */}
                    {track === 'solo' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                        <div style={{ width: 32, display: 'flex', justifyContent: 'center' }}>
                          <span style={{ fontSize: 18 }}>🏆</span>
                        </div>
                        <span style={{ fontWeight: 800, fontSize: 14, color: T.gold }}>Nghệ Sĩ Guitar</span>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* ══ KHU VỰC ĐẶC BIỆT ════════════════════════════════════════════ */}
        <section>
          <div style={{ background: `linear-gradient(135deg, ${T.headerDark}, ${T.header})`, borderRadius: 16, padding: '24px 20px', color: '#fff' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>🌟 Khu vực đặc biệt</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Dành cho học viên Hành Trình</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.65)', marginBottom: 20, lineHeight: 1.6 }}>
              Hoàn thành <strong style={{ color: T.goldLight }}>Hành Trình Trở Thành Nghệ Sĩ Guitar 2027</strong> để mở khoá toàn bộ.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { icon: '🎤', label: 'Open Mic — Biểu diễn trực tiếp' },
                { icon: '🤖', label: 'AI Coach — Trợ lý âm nhạc cá nhân' },
                { icon: '👥', label: 'Cộng đồng — Kết nối học viên' },
                { icon: '🎓', label: 'Hồ sơ nghệ sĩ — Portfolio âm nhạc' },
                { icon: '📡', label: 'Truyền nghề — Mentorship từ Thầy' },
              ].map(f => (
                <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: .7 }}>
                  <span style={{ fontSize: 16 }}>{f.icon}</span>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,.7)' }}>🔒 {f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
