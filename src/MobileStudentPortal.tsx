import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

// ─── Light theme tokens ────────────────────────────────────────────────────────
const L = {
  bg:         '#F0F2F5',
  surface:    '#FFFFFF',
  surface2:   '#F7F8FA',
  border:     '#E8EAF0',
  
  // Primary — warm indigo
  p1:         '#4338CA',   // deep indigo
  p2:         '#EEF2FF',   // indigo tint
  p3:         '#C7D2FE',   // indigo mid

  // Accent — vibrant orange for CTAs
  a1:         '#EA580C',
  a2:         '#FFF7ED',
  a3:         '#FED7AA',

  // Text
  t1:         '#111827',
  t2:         '#6B7280',
  t3:         '#9CA3AF',
  tinv:       '#FFFFFF',

  // Status
  green:      '#16A34A',
  greenBg:    '#F0FDF4',
  gold:       '#D97706',
  goldBg:     '#FFFBEB',

  shadow:     '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
  shadowLg:   '0 8px 24px rgba(0,0,0,0.10)',
}

type Tab    = 'hoc' | 'tap' | 'song'
type Screen = 'home' | 'courses' | 'lesson'

interface Student    { id: string; full_name: string; email: string | null; level: string | null }
interface DBTool     { id: string; icon: string; name: string; description: string | null; category: string; route: string; tier: string; enabled: boolean }
interface Enrollment {
  id: string; course_id: string; enrolled_at: string
  course: { id: string; name: string; type: string; track: string | null }
}
interface Module { id: string; name: string; order_index: number }
interface Lesson {
  id: string; module_id: string; title: string; lesson_type: string
  content_url: string | null; description: string | null; content: string | null
  tools: string[]; order_index: number
}

function uname(s: Student) {
  const n = s.full_name ?? ''
  return (n.includes('@') ? n.split('@')[0] : n.split(' ').pop() ?? n)
}
function getYtId(url: string | null) {
  return url?.match(/(?:v=|youtu\.be\/)([^&\s]+)/)?.[1] ?? null
}

const TABS = [
  { id: 'hoc'  as Tab, icon: '📖', label: 'Học'  },
  { id: 'tap'  as Tab, icon: '🎯', label: 'Tập'  },
  { id: 'song' as Tab, icon: '✨', label: 'Sống' },
]
const TOOLS_MAP: Record<string, { label: string; icon: string; color: string }> = {
  tap:           { label: 'Tap nhịp',     icon: '🥁', color: L.p1     },
  metronome:     { label: 'Metronome',    icon: '🎵', color: L.green  },
  backing_track: { label: 'Backing Track',icon: '🎧', color: L.gold   },
  submit_video:  { label: 'Nộp video',    icon: '📹', color: L.a1     },
  chord:         { label: 'Luyện hợp âm', icon: '🎸', color: '#7C3AED'},
  ear:           { label: 'Luyện tai',    icon: '👂', color: '#0891B2'},
}
const PRACTICE_LIST = [
  { id:'tap',     icon:'🥁', label:'Tap nhịp',     sub:'Luyện cảm nhịp điệu',    bg:'#EEF2FF', fg:L.p1      },
  { id:'metro',   icon:'🎵', label:'Metronome',     sub:'Đếm nhịp chính xác',     bg:'#F0FDF4', fg:L.green   },
  { id:'backing', icon:'🎧', label:'Backing Track', sub:'Đệm nhạc luyện tập',     bg:'#FFFBEB', fg:L.gold    },
  { id:'chord',   icon:'🎸', label:'Luyện hợp âm', sub:'Xem hợp âm trực quan',   bg:'#F5F3FF', fg:'#7C3AED' },
  { id:'submit',  icon:'📹', label:'Nộp video',     sub:'Quay và gửi bài tập',    bg:'#FFF7ED', fg:L.a1      },
]

interface Props { student: Student; onLogout: () => void }

export default function MobileStudentPortal({ student, onLogout }: Props) {
  const [tab, setTab]             = useState<Tab>('hoc')
  const [screen, setScreen]       = useState<Screen>('home')
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [modules, setModules]     = useState<Module[]>([])
  const [lessons, setLessons]     = useState<Lesson[]>([])
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null)
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null)
  const [lessonTab, setLessonTab] = useState<'content' | 'note'>('content')
  const [dbTools, setDbTools]     = useState<DBTool[]>([])
  const [bpm, setBpm]             = useState(72)
  const [tapCount, setTapCount]   = useState(0)
  const tapTimes                  = useRef<number[]>([])
  const tapTimer                  = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    supabase.from('edu_enrollments')
      .select('id,course_id,enrolled_at,is_active,course:edu_courses(id,name,type,track)')
      .eq('student_id', student.id).eq('is_active', true)
      .then(({ data }) => setEnrollments((data ?? []) as unknown as Enrollment[]))
    supabase.from('edu_tools').select('*').eq('enabled', true).order('order_index')
      .then(({ data }) => { if (data?.length) setDbTools(data as DBTool[]) })
  }, [student.id])

  const openCourse = async (courseId: string) => {
    setActiveCourseId(courseId)
    setScreen('courses')
    const { data: mods } = await supabase.from('edu_modules')
      .select('*').eq('course_id', courseId).order('order_index')
    setModules(mods ?? [])
    if (mods?.length) {
      const { data: lsns } = await supabase.from('edu_course_lessons')
        .select('*').in('module_id', mods.map((m: Module) => m.id)).order('order_index')
      setLessons((lsns ?? []).map((l: Lesson & {tools?: unknown}) => ({ ...l, tools: Array.isArray(l.tools) ? l.tools : [] })))
    }
  }
  const openLesson = (l: Lesson) => { setActiveLesson(l); setLessonTab('content'); setScreen('lesson') }
  const goBack = () => screen === 'lesson' ? setScreen('courses') : (setScreen('home'), setActiveCourseId(null))

  const handleTap = () => {
    const now = Date.now()
    tapTimes.current.push(now)
    if (tapTimes.current.length > 8) tapTimes.current.shift()
    if (tapTimes.current.length > 1) {
      const diffs = tapTimes.current.slice(1).map((t, i) => t - tapTimes.current[i])
      setBpm(Math.round(60000 / (diffs.reduce((a, b) => a + b) / diffs.length)))
    }
    setTapCount(c => c + 1)
    if (tapTimer.current) clearTimeout(tapTimer.current)
    tapTimer.current = setTimeout(() => { tapTimes.current = []; setTapCount(0) }, 3000)
  }

  const mainCourse = enrollments.find(e => e.course?.type === 'hanh_trinh')
  const name = uname(student)
  const TIER_ORDER = ['free', 'basic', 'standard', 'pro']
  const LEVEL_TIER: Record<string, string> = { beginner: 'free', elementary: 'basic', intermediate: 'standard', advanced: 'pro' }
  const studentTierIdx = TIER_ORDER.indexOf(LEVEL_TIER[student.level ?? 'beginner'] ?? 'free')
  const isUnlocked = (tier: string) => TIER_ORDER.indexOf(tier) <= studentTierIdx
  const displayTools = dbTools.length > 0 ? dbTools : PRACTICE_LIST.map(p => ({ id: p.id, icon: p.icon, name: p.label, description: p.sub, category: 'Luyện tập', route: '/tap', tier: 'free', enabled: true } as DBTool))

  // Pill component
  const Pill = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button onClick={onClick} style={{
      background: active ? L.p1 : L.surface2, color: active ? L.tinv : L.t2,
      border: `1px solid ${active ? L.p1 : L.border}`, borderRadius: 20,
      padding: '7px 16px', fontSize: 13, fontWeight: active ? 600 : 400,
      cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
    }}>{label}</button>
  )

  return (
    <div style={{
      maxWidth: 430, margin: '0 auto', height: '100dvh',
      display: 'flex', flexDirection: 'column',
      background: L.bg, fontFamily: '"SF Pro Display", "DM Sans", system-ui, sans-serif',
      color: L.t1, position: 'relative', overflow: 'hidden',
    }}>

      {/* ══ SCROLLABLE CONTENT ══════════════════════════════════════════════ */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 84 }}>

        {/* ── HOME ──────────────────────────────────────────────────────── */}
        {tab === 'hoc' && screen === 'home' && (
          <>
            {/* Hero header */}
            <div style={{ background: L.p1, padding: '52px 20px 28px', position: 'relative', overflow: 'hidden' }}>
              {/* Decorative circles */}
              <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,.06)' }} />
              <div style={{ position: 'absolute', bottom: -20, right: 60, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,.04)' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,.65)', marginBottom: 4 }}>Xin chào 👋</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: L.tinv, letterSpacing: '-.02em' }}>{name}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.15)', borderRadius: 20, padding: '6px 12px 6px 8px' }}>
                  <span style={{ fontSize: 18 }}>🔥</span>
                  <span style={{ fontWeight: 800, fontSize: 16, color: '#FCD34D' }}>12</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,.65)' }}>ngày</span>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,.65)' }}>Tiến độ hôm nay</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#A5F3FC' }}>60%</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,.15)', borderRadius: 99 }}>
                  <div style={{ height: '100%', width: '60%', background: 'linear-gradient(90deg, #6EE7B7, #3B82F6)', borderRadius: 99 }} />
                </div>
              </div>
            </div>

            <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Việc hôm nay */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>Hôm nay</span>
                  <span style={{ fontSize: 12, color: L.p1, fontWeight: 600 }}>2/3 xong</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {mainCourse && (
                    <div onClick={() => openCourse(mainCourse.course_id)}
                      style={{ background: L.surface, borderRadius: 16, padding: '14px 16px', boxShadow: L.shadow, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: L.p2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>▶️</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Xem bài học</div>
                        <div style={{ fontSize: 12, color: L.t2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mainCourse.course?.name}</div>
                      </div>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: L.green, flexShrink: 0 }} />
                    </div>
                  )}
                  {[
                    { icon: '🥁', label: 'Tap nhịp', sub: 'Thành phố buồn', done: true  },
                    { icon: '📹', label: 'Nộp video', sub: 'Đệm hát 1 - Buổi 3', done: false },
                  ].map(t => (
                    <div key={t.label} style={{ background: L.surface, borderRadius: 16, padding: '14px 16px', boxShadow: L.shadow, display: 'flex', alignItems: 'center', gap: 12, opacity: t.done ? .6 : 1 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: L.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{t.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2, textDecoration: t.done ? 'line-through' : 'none', color: t.done ? L.t3 : L.t1 }}>{t.label}</div>
                        <div style={{ fontSize: 12, color: L.t2 }}>{t.sub}</div>
                      </div>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: t.done ? L.green : L.border, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {t.done && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hành trình */}
              {mainCourse ? (
                <div>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>Hành trình hiện tại</span>
                  <div style={{ background: L.surface, borderRadius: 20, padding: '20px', boxShadow: L.shadowLg, marginTop: 12, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, right: 0, width: 100, height: 100, background: L.p2, borderRadius: '0 20px 0 100%', opacity: .5 }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 14, background: L.p2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🎸</div>
                      <div>
                        <div style={{ fontSize: 12, color: L.t3, marginBottom: 3 }}>Đang theo học</div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: L.p1, lineHeight: 1.3 }}>{mainCourse.course?.name}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: L.t2, marginBottom: 6 }}>
                      <span>Đệm hát 1 · Buổi 3</span>
                      <span style={{ fontWeight: 700, color: L.p1 }}>30%</span>
                    </div>
                    <div style={{ height: 6, background: L.border, borderRadius: 99, marginBottom: 18 }}>
                      <div style={{ height: '100%', width: '30%', background: `linear-gradient(90deg, ${L.p1}, #818CF8)`, borderRadius: 99 }} />
                    </div>
                    <button onClick={() => openCourse(mainCourse.course_id)}
                      style={{ width: '100%', background: `linear-gradient(135deg, ${L.p1}, #6366F1)`, color: L.tinv, border: 'none', borderRadius: 14, padding: '15px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '.02em', boxShadow: '0 4px 16px rgba(67,56,202,.35)' }}>
                      HỌC NGAY →
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ background: L.surface, borderRadius: 20, padding: '32px 20px', textAlign: 'center', boxShadow: L.shadow }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🌱</div>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Hành trình chưa bắt đầu</div>
                  <div style={{ fontSize: 13, color: L.t2, lineHeight: 1.7 }}>Thầy sẽ thêm bạn vào khoá học sau buổi học đầu tiên.</div>
                </div>
              )}

              {/* Tất cả khoá học */}
              {enrollments.length > 1 && (
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Tất cả khoá học</div>
                  {enrollments.map(e => (
                    <div key={e.id} onClick={() => openCourse(e.course_id)}
                      style={{ background: L.surface, borderRadius: 16, padding: '14px 16px', boxShadow: L.shadow, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, cursor: 'pointer' }}>
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: e.course?.type === 'canh_cua' ? '#FFF7ED' : L.p2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                        {e.course?.type === 'canh_cua' ? '🔑' : '🎸'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.course?.name}</div>
                        <div style={{ fontSize: 11, color: L.t2, marginTop: 2 }}>{e.course?.type === 'canh_cua' ? 'Cánh Cửa' : 'Hành Trình'}</div>
                      </div>
                      <span style={{ color: L.t3, fontSize: 18 }}>›</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── COURSES ───────────────────────────────────────────────────── */}
        {tab === 'hoc' && screen === 'courses' && (
          <>
            <div style={{ background: L.surface, padding: '52px 16px 16px', boxShadow: '0 1px 0 ' + L.border }}>
              <button onClick={goBack} style={{ background: L.p2, border: 'none', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: L.p1, marginBottom: 12 }}>‹</button>
              <div style={{ fontWeight: 800, fontSize: 20 }}>Danh sách bài học</div>
            </div>
            <div style={{ padding: '16px' }}>
              {modules.map(mod => (
                <div key={mod.id} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: L.t3, textTransform: 'uppercase', letterSpacing: '.08em', padding: '0 4px 10px' }}>{mod.name}</div>
                  {lessons.filter(l => l.module_id === mod.id).map((l, i) => {
                    const icons: Record<string, string> = { video: '▶️', text: '📄', slide: '🖼', quiz: '❓', tap: '🥁', metronome: '🎵', backing_track: '🎧', submit_video: '📹' }
                    return (
                      <div key={l.id} onClick={() => openLesson(l)}
                        style={{ background: L.surface, borderRadius: 14, padding: '14px', boxShadow: L.shadow, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: 8, border: `2px solid ${activeLesson?.id === l.id ? L.p1 : 'transparent'}` }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: L.p2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{icons[l.lesson_type] ?? '📄'}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</div>
                        </div>
                        <span style={{ color: L.t3, fontSize: 18 }}>›</span>
                      </div>
                    )
                  })}
                </div>
              ))}
              {lessons.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 20px', color: L.t3 }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
                  Khoá học chưa có bài nào
                </div>
              )}
            </div>
          </>
        )}

        {/* ── LESSON ────────────────────────────────────────────────────── */}
        {tab === 'hoc' && screen === 'lesson' && activeLesson && (
          <>
            {/* Header */}
            <div style={{ background: L.surface, padding: '52px 16px 0', boxShadow: '0 1px 0 ' + L.border }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <button onClick={goBack} style={{ background: L.p2, border: 'none', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: L.p1, flexShrink: 0 }}>‹</button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeLesson.title}</div>
                </div>
                <span style={{ fontSize: 20, cursor: 'pointer', color: L.t3 }}>♡</span>
              </div>
              {/* Tab pills */}
              <div style={{ display: 'flex', gap: 8, paddingBottom: 14 }}>
                <Pill label="Nội dung" active={lessonTab === 'content'} onClick={() => setLessonTab('content')} />
                <Pill label="Ghi chú" active={lessonTab === 'note'}    onClick={() => setLessonTab('note')}    />
              </div>
            </div>

            {/* Video */}
            {activeLesson.lesson_type === 'video' && getYtId(activeLesson.content_url) && (
              <div style={{ aspectRatio: '16/9', background: '#000' }}>
                <iframe src={`https://www.youtube.com/embed/${getYtId(activeLesson.content_url)}?rel=0`}
                  style={{ width: '100%', height: '100%', border: 'none' }} allowFullScreen />
              </div>
            )}

            {/* External link embed */}
            {activeLesson.lesson_type === 'link' && activeLesson.content_url && (
              <div style={{ borderRadius: 12, overflow: 'hidden', margin: '0 -16px', border: 'none' }}>
                <iframe
                  src={activeLesson.content_url}
                  style={{ width: '100%', height: '85vh', border: 'none', display: 'block' }}
                  allow="microphone; camera"
                  title={activeLesson.title}
                />
              </div>
            )}

            <div style={{ padding: '16px' }}>
              {lessonTab === 'content' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {activeLesson.description && (
                    <div style={{ fontSize: 14, color: L.t2, lineHeight: 1.8 }}>{activeLesson.description}</div>
                  )}
                  {activeLesson.content && (
                    <div style={{ background: L.surface, borderRadius: 16, padding: '16px', boxShadow: L.shadow, fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: L.t1 }}>
                      {activeLesson.content}
                    </div>
                  )}
                  {activeLesson.tools?.length > 0 && (
                    <div style={{ background: L.surface, borderRadius: 16, padding: '16px', boxShadow: L.shadow }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: L.t3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Công cụ luyện tập</div>
                      {activeLesson.tools.map((tid, i) => {
                        const t = TOOLS_MAP[tid]; if (!t) return null
                        return (
                          <div key={tid} onClick={() => window.location.href = '/tap'}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i > 0 ? `1px solid ${L.border}` : 'none', cursor: 'pointer' }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: t.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{t.icon}</div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: t.color, flex: 1 }}>{t.label}</span>
                            <span style={{ color: L.t3 }}>›</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {!activeLesson.description && !activeLesson.content && (
                    <div style={{ textAlign: 'center', padding: '28px', color: L.t3, fontSize: 14 }}>Chưa có nội dung</div>
                  )}
                </div>
              ) : (
                <textarea placeholder="Ghi chú của bạn..." style={{ width: '100%', boxSizing: 'border-box', minHeight: 220, background: L.surface, border: `1px solid ${L.border}`, borderRadius: 16, padding: '16px', color: L.t1, fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'none', lineHeight: 1.8, boxShadow: L.shadow }} />
              )}
            </div>

            {/* Nav buttons */}
            <div style={{ padding: '8px 16px 16px', display: 'flex', gap: 10 }}>
              {(() => {
                const idx = lessons.findIndex(l => l.id === activeLesson.id)
                const prev = idx > 0 ? lessons[idx - 1] : null
                const next = idx < lessons.length - 1 ? lessons[idx + 1] : null
                return (
                  <>
                    {prev && (
                      <button onClick={() => openLesson(prev)} style={{ flex: 1, background: L.surface, border: `1px solid ${L.border}`, borderRadius: 14, padding: '14px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: L.t1, boxShadow: L.shadow }}>
                        ‹ Trước
                      </button>
                    )}
                    <button onClick={() => next ? openLesson(next) : goBack()}
                      style={{ flex: 2, background: `linear-gradient(135deg, ${L.p1}, #6366F1)`, color: L.tinv, border: 'none', borderRadius: 14, padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(67,56,202,.3)' }}>
                      {next ? 'TIẾP THEO ›' : '✓ HOÀN THÀNH'}
                    </button>
                  </>
                )
              })()}
            </div>
          </>
        )}

        {/* ── TẬP ───────────────────────────────────────────────────────── */}
        {tab === 'tap' && (
          <div style={{ padding: '52px 16px 16px' }}>
            <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 4 }}>Luyện tập</div>
            <div style={{ fontSize: 13, color: L.t2, marginBottom: 20 }}>Chọn công cụ để bắt đầu</div>

            {/* Tap BPM widget */}
            <div style={{ background: `linear-gradient(135deg, ${L.p1} 0%, #6366F1 100%)`, borderRadius: 24, padding: '24px 20px', marginBottom: 16, textAlign: 'center', boxShadow: '0 8px 24px rgba(67,56,202,.35)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,.08)' }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.7)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>🥁 Tap BPM</div>
              <div style={{ fontSize: 64, fontWeight: 900, color: '#FCD34D', lineHeight: 1, marginBottom: 4 }}>{bpm}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', marginBottom: 20 }}>BPM {tapCount > 0 && `· đã tap ${tapCount} lần`}</div>
              <button onClick={handleTap}
                style={{ width: '100%', background: L.tinv, color: L.p1, border: 'none', borderRadius: 16, padding: '18px', fontSize: 18, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '.06em', userSelect: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.15)' }}>
                TAP
              </button>
            </div>

            {/* Tools grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {displayTools.map((t, i) => {
                const unlocked = isUnlocked(t.tier)
                return (
                  <div key={t.id} onClick={() => unlocked && window.location.href === t.route}
                    style={{ background: L.surface, borderRadius: 18, padding: '18px 14px', boxShadow: L.shadow, cursor: unlocked ? 'pointer' : 'default', opacity: unlocked ? 1 : .5, position: 'relative' }}>
                    {!unlocked && <span style={{ position: 'absolute', top: 10, right: 10, fontSize: 12 }}>🔒</span>}
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: L.p2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 10 }}>{t.icon}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: unlocked ? L.p1 : L.t3, marginBottom: 4 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: L.t3, lineHeight: 1.4 }}>{t.description}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── SỐNG ──────────────────────────────────────────────────────── */}
        {tab === 'song' && (
          <div style={{ padding: '52px 16px 16px' }}>
            <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 4 }}>Sống cùng âm nhạc</div>
            <div style={{ fontSize: 13, color: L.t2, marginBottom: 20 }}>Kết nối · Trải nghiệm · Truyền cảm hứng</div>

            {/* Events */}
            {[
              { icon: '🎪', label: 'Workshop cuối tuần', date: 'Chủ nhật, 09/06/2025', color: L.p1, bg: L.p2 },
              { icon: '🎤', label: 'Open Mic tháng 6',   date: 'Thứ bảy, 15/06/2025',  color: '#7C3AED', bg: '#F5F3FF' },
              { icon: '☕', label: 'Giao lưu học viên',  date: 'Chủ nhật, 23/06/2025', color: L.gold, bg: L.goldBg },
            ].map(e => (
              <div key={e.label} style={{ background: L.surface, borderRadius: 18, padding: '16px', boxShadow: L.shadow, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: e.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{e.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{e.label}</div>
                  <div style={{ fontSize: 12, color: L.t2, marginTop: 2 }}>{e.date}</div>
                </div>
                <button style={{ background: e.bg, border: 'none', borderRadius: 10, padding: '8px 14px', color: e.color, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                  Tham gia
                </button>
              </div>
            ))}

            {/* Quote */}
            <div style={{ background: L.p1, borderRadius: 20, padding: '20px 20px 24px', marginTop: 8, marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 80, opacity: .08, lineHeight: 1 }}>"</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,.85)', lineHeight: 1.8, fontStyle: 'italic' }}>
                Bạn không cần phải giỏi ngay từ đầu. Nhưng bạn phải bắt đầu để trở nên giỏi.
              </div>
            </div>

            {/* Profile card */}
            <div style={{ background: L.surface, borderRadius: 18, padding: '16px', boxShadow: L.shadow, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: L.p2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: L.p1, fontWeight: 800 }}>
                {name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{name}</div>
                <div style={{ fontSize: 12, color: L.t2 }}>{student.level ?? 'Học viên'}</div>
              </div>
              <button onClick={onLogout} style={{ background: L.surface2, border: `1px solid ${L.border}`, borderRadius: 10, padding: '8px 14px', color: L.t2, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Đăng xuất
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ══ BOTTOM NAV ══════════════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderTop: `1px solid ${L.border}`,
        display: 'flex', padding: '10px 8px max(10px, env(safe-area-inset-bottom)) 8px',
        zIndex: 20,
      }}>
        {TABS.map(t => {
          const active = tab === t.id
          return (
            <button key={t.id}
              onClick={() => { setTab(t.id); if (t.id === 'hoc') setScreen('home') }}
              style={{
                flex: 1, background: active ? L.p2 : 'transparent', border: 'none',
                borderRadius: 14, cursor: 'pointer', padding: '8px 4px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                fontFamily: 'inherit', transition: 'background .15s',
              }}>
              <span style={{ fontSize: 22 }}>{t.icon}</span>
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, color: active ? L.p1 : L.t3, letterSpacing: '.04em' }}>
                {t.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Inline Pill component
function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: active ? L.p1 : L.surface2, color: active ? L.tinv : L.t2,
      border: `1px solid ${active ? L.p1 : L.border}`, borderRadius: 20,
      padding: '7px 18px', fontSize: 13, fontWeight: active ? 600 : 400,
      cursor: 'pointer', fontFamily: 'inherit',
    }}>{label}</button>
  )
}
