import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

// ─── Light theme tokens ────────────────────────────────────────────────────────
const L = {
  bg:         '#F0F2F5',
  surface:    '#FFFFFF',
  surface2:   '#F7F8FA',
  border:     '#E8EAF0',
  p1:         '#4338CA',
  p2:         '#EEF2FF',
  p3:         '#C7D2FE',
  a1:         '#EA580C',
  a2:         '#FFF7ED',
  a3:         '#FED7AA',
  t1:         '#111827',
  t2:         '#6B7280',
  t3:         '#9CA3AF',
  tinv:       '#FFFFFF',
  green:      '#16A34A',
  greenBg:    '#F0FDF4',
  gold:       '#D97706',
  goldBg:     '#FFFBEB',
  shadow:     '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
  shadowLg:   '0 8px 24px rgba(0,0,0,0.10)',
}

type Tab    = 'hoc' | 'tap' | 'song'
type Screen = 'home' | 'courses' | 'lesson'

interface Student    { id: string; full_name: string; email: string | null; level: string | null; display_name?: string | null; avatar_url?: string | null; honor?: string | null; enrolled_at?: string | null }
interface DBTool     { id: string; icon: string; name: string; description: string | null; category: string; route: string; tier: string; enabled: boolean }
interface Enrollment {
  id: string; course_id: string; enrolled_at: string
  course: { id: string; name: string; type: string; track: string | null; icon?: string | null; image_url?: string | null }
}
interface Module { id: string; name: string; order_index: number }
interface Lesson {
  id: string; module_id: string; title: string; lesson_type: string
  content_url: string | null; description: string | null; content: string | null
  tools: string[]; order_index: number; tier?: string
}

function uname(s: Student) {
  if (s.display_name?.trim()) return s.display_name.trim()
  const n = s.full_name ?? ''
  return (n.includes('@') ? n.split('@')[0] : n.split(' ').pop() ?? n)
}
function getYtId(url: string | null) {
  return url?.match(/(?:v=|youtu\.be\/)([^&\s]+)/)?.[1] ?? null
}
const LEVEL_VI: Record<string, string> = {
  beginner: 'Sơ cấp', elementary: 'Cơ bản', intermediate: 'Trung cấp', advanced: 'Nâng cao',
}
const TIER_ORDER = ['free', 'basic', 'standard', 'pro']
const LEVEL_TIER: Record<string, string> = {
  beginner: 'free', elementary: 'basic', intermediate: 'standard', advanced: 'pro'
}
const TIER_VI: Record<string, string> = {
  free: 'Miễn phí', basic: 'Cơ bản', standard: 'Nâng cao', pro: 'Pro'
}

// ── Hệ thống danh hiệu ──────────────────────────────────────────────────────
const HONOR_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  none:     { label: '',               icon: '',   color: '#4338CA', bg: '#4338CA' },
  bronze:   { label: 'Bronze Member',  icon: '🥉', color: '#92400E', bg: '#B45309' },
  silver:   { label: 'Silver Member',  icon: '🥈', color: '#374151', bg: '#4B5563' },
  gold:     { label: 'Gold Member',    icon: '🥇', color: '#92400E', bg: '#D97706' },
  platinum: { label: 'Platinum',       icon: '💎', color: '#4C1D95', bg: '#7C3AED' },
  diamond:  { label: 'Diamond',        icon: '👑', color: '#0C4A6E', bg: '#0891B2' },
}

// Tính Year Member từ enrolled_at
function getYearBadge(enrolledAt?: string | null): string | null {
  if (!enrolledAt) return null
  const years = Math.floor((Date.now() - new Date(enrolledAt).getTime()) / (365.25 * 24 * 3600 * 1000))
  if (years < 1) return null
  return years === 1 ? '1-Year Member' : `${years}-Year Member`
}

function CourseLogo({ course, size = 44, radius = 12, bg }: { course: { type: string; icon?: string | null; image_url?: string | null }; size?: number; radius?: number; bg?: string }) {
  const fallback = course.icon || (course.type === 'canh_cua' ? '🔑' : '🎸')
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: bg ?? (course.type === 'canh_cua' ? '#FFF7ED' : '#EEF2FF'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.45, flexShrink: 0, overflow: 'hidden' }}>
      {course.image_url
        ? <img src={course.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : fallback}
    </div>
  )
}

// ── Tool route map — dẫn đến đúng route theo id ──
const TOOL_ROUTES: Record<string, string> = {
  tap:           '/tap',
  metronome:     '/tap',
  backing_track: '/tap',
  chord:         '/chords',
  tuner:         '/tap',
  submit_video:  '/tap',
  ear:           '/tap',
}

const TABS = [
  { id: 'hoc'  as Tab, icon: '📖', label: 'Học'  },
  { id: 'tap'  as Tab, icon: '🎯', label: 'Tập'  },
  { id: 'song' as Tab, icon: '✨', label: 'Sống' },
]
const TOOLS_MAP: Record<string, { label: string; icon: string; color: string; route: string }> = {
  tap:           { label: 'Tap nhịp',     icon: '🥁', color: L.p1,      route: '/tap'    },
  metronome:     { label: 'Metronome',    icon: '🎵', color: L.green,   route: '/tap'    },
  backing_track: { label: 'Backing Track',icon: '🎧', color: L.gold,    route: '/tap'    },
  submit_video:  { label: 'Nộp video',    icon: '📹', color: L.a1,      route: '/tap'    },
  chord:         { label: 'Luyện hợp âm', icon: '🎸', color: '#7C3AED', route: '/chords' },
  ear:           { label: 'Luyện tai',    icon: '👂', color: '#0891B2', route: '/tap'    },
}

interface Props { student: Student; onLogout: () => void }

export default function MobileStudentPortal({ student, onLogout }: Props) {
  const [tab, setTab]             = useState<Tab>('hoc')
  const [me, setMe]               = useState<Student>(student)
  const [showSettings, setShowSettings] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const avatarFileRef = useRef<HTMLInputElement>(null)
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

  // ── Progress tracking ──
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [markingDone, setMarkingDone]   = useState(false)

  // ── Tool overlay — mở tool ngay trong app, không navigate ra ngoài ──
  const [activeTool, setActiveTool] = useState<{ name: string; url: string } | null>(null)

  const openTool = (route: string, name: string) => {
    // URL ngoài (https://...) dùng thẳng, route nội bộ thêm origin
    const url = route.startsWith('http') ? route : window.location.origin + route
    setActiveTool({ name, url })
  }

  const studentTierIdx = TIER_ORDER.indexOf(LEVEL_TIER[student.level ?? 'beginner'] ?? 'free')
  const isTierUnlocked = (tier?: string) => TIER_ORDER.indexOf(tier ?? 'free') <= studentTierIdx

  // Bài chỉ mở khi bài trước đã hoàn thành (theo thứ tự toàn bộ lessons)
  const isSequentiallyUnlocked = (lessonId: string) => {
    const idx = lessons.findIndex(l => l.id === lessonId)
    if (idx <= 0) return true                          // bài đầu luôn mở
    const prev = lessons[idx - 1]
    return completedIds.has(prev.id)                   // mở nếu bài trước đã ✅
  }

  const isUnlocked = (l: Lesson) =>
    isTierUnlocked(l.tier) && isSequentiallyUnlocked(l.id)

  useEffect(() => {
    supabase.from('edu_enrollments')
      .select('id,course_id,enrolled_at,is_active,course:edu_courses(id,name,type,track,icon,image_url)')
      .eq('student_id', student.id).eq('is_active', true)
      .then(({ data }) => setEnrollments((data ?? []) as unknown as Enrollment[]))
    supabase.from('edu_tools').select('*').eq('enabled', true).order('order_index')
      .then(({ data }) => { if (data?.length) setDbTools(data as DBTool[]) })
    // Load progress
    supabase.from('edu_lesson_progress')
      .select('lesson_id').eq('student_id', student.id)
      .then(({ data }) => {
        if (data) setCompletedIds(new Set(data.map((r: any) => r.lesson_id)))
      })
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

  const openLesson = (l: Lesson) => {
    if (!isUnlocked(l)) return // khoá, không mở
    setActiveLesson(l)
    setLessonTab('content')
    setScreen('lesson')
  }

  const markComplete = async (lessonId: string) => {
    if (completedIds.has(lessonId) || markingDone) return
    setMarkingDone(true)
    await supabase.from('edu_lesson_progress').upsert({
      student_id: student.id,
      lesson_id: lessonId,
      course_id: activeCourseId,
    }, { onConflict: 'student_id,lesson_id' })
    setCompletedIds(prev => new Set([...prev, lessonId]))
    setMarkingDone(false)
  }

  const goBack = () => screen === 'lesson' ? setScreen('courses') : (setScreen('home'), setActiveCourseId(null))

  // % hoàn thành của 1 khoá
  const courseProgress = (courseId: string) => {
    const courseLessons = lessons.filter(l => {
      const mod = modules.find(m => m.id === l.module_id)
      return !!mod
    })
    if (!courseLessons.length) return 0
    const done = courseLessons.filter(l => completedIds.has(l.id)).length
    return Math.round((done / courseLessons.length) * 100)
  }

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

  const openSettings = () => { setNameDraft(uname(me)); setShowSettings(true) }
  const saveDisplayName = async () => {
    const v = nameDraft.trim()
    if (!v) return
    setSavingProfile(true)
    await supabase.from('edu_students').update({ display_name: v }).eq('id', me.id)
    setMe(prev => ({ ...prev, display_name: v }))
    setSavingProfile(false)
  }
  const uploadAvatar = async (file: File) => {
    setSavingProfile(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${me.id}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (upErr) { alert('Lỗi tải ảnh: ' + upErr.message); setSavingProfile(false); return }
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('edu_students').update({ avatar_url: pub.publicUrl }).eq('id', me.id)
      setMe(prev => ({ ...prev, avatar_url: pub.publicUrl }))
    } catch (e: any) {
      alert('Lỗi: ' + (e?.message ?? e))
    }
    setSavingProfile(false)
  }

  const mainCourse = enrollments.find(e => e.course?.type === 'hanh_trinh')
  const name = uname(me)

  const displayTools = dbTools.length > 0 ? dbTools : [
    { id:'tap',     icon:'🥁', name:'Tap nhịp',     description:'Luyện cảm nhịp điệu',  category:'Luyện tập', route:'/tap',    tier:'free', enabled:true },
    { id:'metro',   icon:'🎵', name:'Metronome',     description:'Đếm nhịp chính xác',   category:'Luyện tập', route:'/tap',    tier:'free', enabled:true },
    { id:'chord',   icon:'🎸', name:'Luyện hợp âm', description:'Xem hợp âm trực quan', category:'Luyện tập', route:'/chords', tier:'free', enabled:true },
    { id:'submit',  icon:'📹', name:'Nộp video',     description:'Quay và gửi bài tập',  category:'Luyện tập', route:'/tap',    tier:'basic', enabled:true },
  ] as DBTool[]

  const Pill = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button onClick={onClick} style={{
      background: active ? L.p1 : L.surface2, color: active ? L.tinv : L.t2,
      border: `1px solid ${active ? L.p1 : L.border}`, borderRadius: 20,
      padding: '7px 16px', fontSize: 13, fontWeight: active ? 600 : 400,
      cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
    }}>{label}</button>
  )

  // % hiển thị ở home cho mainCourse
  const mainProgress = mainCourse && lessons.length > 0 ? courseProgress(mainCourse.course_id) : null

  return (
    <>
    <div style={{
      maxWidth: 430, margin: '0 auto', height: '100dvh',
      display: 'flex', flexDirection: 'column',
      background: L.bg, fontFamily: '"SF Pro Display", "DM Sans", system-ui, sans-serif',
      color: L.t1, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 84 }}>

        {/* ── HOME ────────────────────────────────────────────────────── */}
        {tab === 'hoc' && screen === 'home' && (
          <>
            {(() => {
              const honor = HONOR_CONFIG[me.honor ?? 'none'] ?? HONOR_CONFIG.none
              const yearBadge = getYearBadge(me.enrolled_at)
              const headerBg = honor.bg
              return (
                <div style={{ background: headerBg, padding: '52px 20px 24px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,.06)' }} />
                  <div style={{ position: 'absolute', bottom: -20, right: 60, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,.04)' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,.65)', marginBottom: 4 }}>Xin chào 👋</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: L.tinv, letterSpacing: '-.02em' }}>{name}</div>
                      {/* 2 badge song song */}
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                        {yearBadge && (
                          <span style={{ background: 'rgba(255,255,255,.2)', color: '#fff', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, backdropFilter: 'blur(4px)' }}>
                            📅 {yearBadge}
                          </span>
                        )}
                        {(me.honor && me.honor !== 'none') && (
                          <span style={{ background: 'rgba(255,255,255,.25)', color: '#fff', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, backdropFilter: 'blur(4px)' }}>
                            {honor.icon} {honor.label}
                          </span>
                        )}
                        {!yearBadge && (!me.honor || me.honor === 'none') && (
                          <span style={{ background: 'rgba(255,255,255,.15)', color: 'rgba(255,255,255,.8)', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
                            🎸 Member
                          </span>
                        )}
                      </div>
                    </div>
                    <div onClick={() => { setTab('song'); setTimeout(openSettings, 50) }}
                      style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff', overflow: 'hidden', cursor: 'pointer', border: '2px solid rgba(255,255,255,.35)' }}>
                      {me.avatar_url
                        ? <img src={me.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                </div>
              )
            })()}

            <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Tiếp tục học */}
              {mainCourse && (
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Tiếp tục học</div>
                <div onClick={() => openCourse(mainCourse.course_id)}
                  style={{ background: L.surface, borderRadius: 20, padding: '20px', boxShadow: L.shadowLg, position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
                  <div style={{ position: 'absolute', top: 0, right: 0, width: 100, height: 100, background: L.p2, borderRadius: '0 20px 0 100%', opacity: .5 }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <CourseLogo course={mainCourse.course} size={48} radius={14} bg={L.p2} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: L.t3, marginBottom: 3 }}>Đang theo học</div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: L.p1, lineHeight: 1.3 }}>{mainCourse.course?.name}</div>
                    </div>
                  </div>
                  {/* Progress bar */}
                  {mainProgress !== null && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: L.t2 }}>Tiến độ</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: L.p1 }}>{mainProgress}%</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 99, background: L.p2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${L.p1}, #6366F1)`, width: `${mainProgress}%`, transition: 'width .4s' }} />
                      </div>
                    </div>
                  )}
                  <button
                    style={{ width: '100%', background: `linear-gradient(135deg, ${L.p1}, #6366F1)`, color: L.tinv, border: 'none', borderRadius: 14, padding: '15px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '.02em', boxShadow: '0 4px 16px rgba(67,56,202,.35)' }}>
                    HỌC NGAY →
                  </button>
                </div>
              </div>
              )}

              {!mainCourse && (
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
                      <CourseLogo course={e.course} size={42} radius={12} />
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

        {/* ── COURSES (danh sách bài học) ──────────────────────────────── */}
        {tab === 'hoc' && screen === 'courses' && (
          <>
            <div style={{ background: L.surface, padding: '52px 16px 16px', boxShadow: '0 1px 0 ' + L.border }}>
              <button onClick={goBack} style={{ background: L.p2, border: 'none', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: L.p1, marginBottom: 12 }}>‹</button>
              <div style={{ fontWeight: 800, fontSize: 20 }}>Danh sách bài học</div>
              {/* Progress summary */}
              {activeCourseId && lessons.length > 0 && (() => {
                const done = lessons.filter(l => completedIds.has(l.id)).length
                const pct  = Math.round((done / lessons.length) * 100)
                return (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: L.t2, marginBottom: 5 }}>
                      <span>{done}/{lessons.length} bài đã học</span>
                      <span style={{ fontWeight: 700, color: L.p1 }}>{pct}%</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 99, background: L.p2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${L.p1}, #6366F1)`, width: `${pct}%`, transition: 'width .3s' }} />
                    </div>
                  </div>
                )
              })()}
            </div>
            <div style={{ padding: '16px' }}>
              {modules.map(mod => (
                <div key={mod.id} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: L.t3, textTransform: 'uppercase', letterSpacing: '.08em', padding: '0 4px 10px' }}>{mod.name}</div>
                  {lessons.filter(l => l.module_id === mod.id).map((l) => {
                    const icons: Record<string, string> = { video: '▶️', text: '📄', slide: '🖼', quiz: '❓', tap: '🥁', metronome: '🎵', backing_track: '🎧', submit_video: '📹' }
                    const done       = completedIds.has(l.id)
                    const tierLocked = !isTierUnlocked(l.tier)
                    const seqLocked  = !isSequentiallyUnlocked(l.id)
                    const locked     = tierLocked || seqLocked
                    const isCurrent  = !done && !locked
                    return (
                      <div key={l.id} onClick={() => openLesson(l)}
                        style={{ background: L.surface, borderRadius: 14, padding: '14px', boxShadow: L.shadow, display: 'flex', alignItems: 'center', gap: 12, cursor: locked ? 'default' : 'pointer', marginBottom: 8, border: `2px solid ${isCurrent ? L.p1 : 'transparent'}`, opacity: locked ? .5 : 1, position: 'relative' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: done ? L.greenBg : isCurrent ? L.p2 : L.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                          {done ? '✅' : locked ? '🔒' : (icons[l.lesson_type] ?? '📄')}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: done ? L.green : locked ? L.t3 : L.t1 }}>{l.title}</div>
                          {seqLocked && !tierLocked && (
                            <div style={{ fontSize: 10, color: L.t3, marginTop: 2 }}>Hoàn thành bài trước để mở khoá</div>
                          )}
                          {tierLocked && l.tier && (
                            <div style={{ fontSize: 10, color: L.gold, fontWeight: 600, marginTop: 2 }}>Yêu cầu gói {TIER_VI[l.tier] ?? l.tier}</div>
                          )}
                          {isCurrent && (
                            <div style={{ fontSize: 10, color: L.p1, fontWeight: 600, marginTop: 2 }}>▶ Học tiếp theo</div>
                          )}
                        </div>
                        {!locked && !done && <span style={{ color: L.p1, fontSize: 18 }}>›</span>}
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

        {/* ── LESSON ──────────────────────────────────────────────────── */}
        {tab === 'hoc' && screen === 'lesson' && activeLesson && (
          <>
            <div style={{ background: L.surface, padding: '52px 16px 0', boxShadow: '0 1px 0 ' + L.border }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <button onClick={goBack} style={{ background: L.p2, border: 'none', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: L.p1, flexShrink: 0 }}>‹</button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeLesson.title}</div>
                </div>
                {/* Trạng thái hoàn thành */}
                {completedIds.has(activeLesson.id)
                  ? <span style={{ fontSize: 20 }}>✅</span>
                  : <span style={{ fontSize: 13, color: L.t3 }}>Chưa học</span>
                }
              </div>
              <div style={{ display: 'flex', gap: 8, paddingBottom: 14 }}>
                <Pill label="Nội dung" active={lessonTab === 'content'} onClick={() => setLessonTab('content')} />
                <Pill label="Ghi chú"  active={lessonTab === 'note'}    onClick={() => setLessonTab('note')}    />
              </div>
            </div>

            {/* Video */}
            {activeLesson.lesson_type === 'video' && getYtId(activeLesson.content_url) && (
              <div style={{ aspectRatio: '16/9', background: '#000' }}>
                <iframe src={`https://www.youtube.com/embed/${getYtId(activeLesson.content_url)}?rel=0`}
                  style={{ width: '100%', height: '100%', border: 'none' }} allowFullScreen />
              </div>
            )}

            {/* Slide Canva */}
            {activeLesson.lesson_type === 'slide' && activeLesson.content_url && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#1a1a2e' }}>
                <iframe src={activeLesson.content_url} style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} allowFullScreen allow="fullscreen" title={activeLesson.title} />
                <button onClick={goBack} style={{ position: 'absolute', top: 16, left: 16, zIndex: 51, background: 'rgba(0,0,0,0.65)', border: 'none', borderRadius: 20, padding: '8px 14px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', backdropFilter: 'blur(8px)' }}>← Quay lại</button>
              </div>
            )}

            {/* Link embed */}
            {activeLesson.lesson_type === 'link' && activeLesson.content_url && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#000' }}>
                <iframe src={activeLesson.content_url} style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} allow="microphone; camera" title={activeLesson.title} />
                <button onClick={goBack} style={{ position: 'absolute', top: 16, left: 16, zIndex: 51, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 20, padding: '8px 14px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', backdropFilter: 'blur(8px)' }}>← Quay lại</button>
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
                          <div key={tid} onClick={() => openTool(t.route, t.label)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i > 0 ? `1px solid ${L.border}` : 'none', cursor: 'pointer' }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: t.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{t.icon}</div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: t.color, flex: 1 }}>{t.label}</span>
                            <span style={{ color: L.t3 }}>›</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {!activeLesson.description && !activeLesson.content && activeLesson.lesson_type !== 'video' && (
                    <div style={{ textAlign: 'center', padding: '28px', color: L.t3, fontSize: 14 }}>Chưa có nội dung</div>
                  )}
                </div>
              ) : (
                <textarea placeholder="Ghi chú của bạn..." style={{ width: '100%', boxSizing: 'border-box', minHeight: 220, background: L.surface, border: `1px solid ${L.border}`, borderRadius: 16, padding: '16px', color: L.t1, fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'none', lineHeight: 1.8, boxShadow: L.shadow }} />
              )}
            </div>

            {/* Nav buttons + Đánh dấu hoàn thành */}
            <div style={{ padding: '8px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Nút hoàn thành */}
              {!completedIds.has(activeLesson.id) && (
                <button onClick={() => markComplete(activeLesson.id)} disabled={markingDone}
                  style={{ width: '100%', background: L.greenBg, border: `1.5px solid ${L.green}`, borderRadius: 14, padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: L.green, opacity: markingDone ? 0.6 : 1 }}>
                  {markingDone ? 'Đang lưu…' : '✓ Đánh dấu đã học'}
                </button>
              )}
              {completedIds.has(activeLesson.id) && (
                <div style={{ textAlign: 'center', fontSize: 13, color: L.green, fontWeight: 600, padding: '8px 0' }}>✅ Bài này đã hoàn thành</div>
              )}
              {/* Prev / Next */}
              <div style={{ display: 'flex', gap: 10 }}>
                {(() => {
                  const idx  = lessons.findIndex(l => l.id === activeLesson.id)
                  const prev = idx > 0 ? lessons[idx - 1] : null
                  const next = idx < lessons.length - 1 ? lessons[idx + 1] : null
                  return (
                    <>
                      {prev && (
                        <button onClick={() => openLesson(prev)} style={{ flex: 1, background: L.surface, border: `1px solid ${L.border}`, borderRadius: 14, padding: '14px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: L.t1, boxShadow: L.shadow }}>
                          ‹ Trước
                        </button>
                      )}
                      <button onClick={() => { if (next) openLesson(next); else goBack() }}
                        style={{ flex: 2, background: `linear-gradient(135deg, ${L.p1}, #6366F1)`, color: L.tinv, border: 'none', borderRadius: 14, padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(67,56,202,.3)' }}>
                        {next ? 'TIẾP THEO ›' : '✓ HOÀN THÀNH'}
                      </button>
                    </>
                  )
                })()}
              </div>
            </div>
          </>
        )}

        {/* ── TẬP ─────────────────────────────────────────────────────── */}
        {tab === 'tap' && (
          <div style={{ padding: '52px 16px 16px' }}>
            <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 4 }}>Luyện tập</div>
            <div style={{ fontSize: 13, color: L.t2, marginBottom: 20 }}>Chọn công cụ để bắt đầu</div>

            {/* Tap BPM */}
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

            {/* Player */}
            <button onClick={() => openTool('/tap', 'Player nhịp điệu')}
              style={{ width:'100%', background:'linear-gradient(135deg,#0D0F14,#141720)', border:'1px solid rgba(108,99,255,0.3)', borderRadius:18, padding:'16px 20px', marginBottom:16, display:'flex', alignItems:'center', gap:14, cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
              <div style={{ width:44,height:44,borderRadius:12,background:'linear-gradient(135deg,#6C63FF,#8B84FF)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0,boxShadow:'0 4px 12px rgba(108,99,255,0.35)' }}>🎸</div>
              <div>
                <div style={{ fontSize:15,fontWeight:700,color:'#F1F5F9',marginBottom:2 }}>Player nhịp điệu</div>
                <div style={{ fontSize:11,color:'rgba(255,255,255,0.4)' }}>Luyện hát theo lời & hợp âm</div>
              </div>
              <div style={{ marginLeft:'auto',color:'rgba(108,99,255,0.7)',fontSize:18 }}>›</div>
            </button>

            {/* Tools grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {displayTools.map((t) => {
                const unlocked = isTierUnlocked(t.tier)
                const route = TOOL_ROUTES[t.id] ?? t.route ?? '/tap'
                return (
                  <div key={t.id} onClick={() => { if (unlocked) openTool(route, t.name) }}
                    style={{ background: L.surface, borderRadius: 18, padding: '18px 14px', boxShadow: L.shadow, cursor: unlocked ? 'pointer' : 'default', opacity: unlocked ? 1 : .5, position: 'relative' }}>
                    {!unlocked && (
                      <div style={{ position: 'absolute', top: 8, right: 8 }}>
                        <span style={{ fontSize: 10, background: L.goldBg, color: L.gold, borderRadius: 6, padding: '2px 6px', fontWeight: 700 }}>{TIER_VI[t.tier] ?? t.tier}</span>
                      </div>
                    )}
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: L.p2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 10 }}>{t.icon}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: unlocked ? L.p1 : L.t3, marginBottom: 4 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: L.t3, lineHeight: 1.4 }}>{t.description}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── SỐNG ────────────────────────────────────────────────────── */}
        {tab === 'song' && (
          <div style={{ padding: '52px 16px 16px' }}>
            <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 4 }}>Sống cùng âm nhạc</div>
            <div style={{ fontSize: 13, color: L.t2, marginBottom: 20 }}>Kết nối · Trải nghiệm · Truyền cảm hứng</div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div style={{ background: L.surface, borderRadius: 16, padding: '16px', boxShadow: L.shadow, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: L.p1 }}>{completedIds.size}</div>
                <div style={{ fontSize: 12, color: L.t2, marginTop: 4 }}>Bài đã học</div>
              </div>
              <div style={{ background: L.surface, borderRadius: 16, padding: '16px', boxShadow: L.shadow, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: L.a1 }}>{enrollments.length}</div>
                <div style={{ fontSize: 12, color: L.t2, marginTop: 4 }}>Khoá học</div>
              </div>
            </div>

            {/* Sự kiện */}
            <div style={{ background: L.surface, borderRadius: 18, padding: '28px 20px', boxShadow: L.shadow, textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🎪</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Sự kiện & giao lưu</div>
              <div style={{ fontSize: 13, color: L.t2, lineHeight: 1.6 }}>Workshop, Open Mic và các buổi giao lưu học viên sẽ sớm xuất hiện ở đây.</div>
            </div>

            {/* Quote */}
            <div style={{ background: L.p1, borderRadius: 20, padding: '20px 20px 24px', marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 80, opacity: .08, lineHeight: 1 }}>"</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,.85)', lineHeight: 1.8, fontStyle: 'italic' }}>
                Bạn không cần phải giỏi ngay từ đầu. Nhưng bạn phải bắt đầu để trở nên giỏi.
              </div>
            </div>

            {/* Profile card */}
            <div style={{ background: L.surface, borderRadius: 18, padding: '16px', boxShadow: L.shadow, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: L.p2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: L.p1, fontWeight: 800, overflow: 'hidden', flexShrink: 0 }}>
                {me.avatar_url
                  ? <img src={me.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                <div style={{ fontSize: 12, color: L.t2 }}>{LEVEL_VI[me.level ?? ''] ?? 'Học viên'}</div>
              </div>
              <button onClick={openSettings} title="Cài đặt hồ sơ" style={{ background: L.p2, border: 'none', borderRadius: 10, width: 38, height: 38, fontSize: 17, cursor: 'pointer', flexShrink: 0 }}>⚙️</button>
              <button onClick={onLogout} style={{ background: L.surface2, border: `1px solid ${L.border}`, borderRadius: 10, padding: '8px 14px', color: L.t2, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                Đăng xuất
              </button>
            </div>
            <div style={{ fontSize: 11, color: L.t3, textAlign: 'center', marginTop: 10 }}>Bấm ⚙️ để đổi tên và ảnh đại diện</div>
          </div>
        )}
      </div>

      {/* ══ BOTTOM NAV ════════════════════════════════════════════════════ */}
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

    {/* ── Modal Cài đặt hồ sơ ── */}
    {showSettings && (
      <div onClick={() => setShowSettings(false)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <div onClick={e => e.stopPropagation()}
          style={{ background: L.surface, borderRadius: '24px 24px 0 0', padding: '20px 20px max(20px, env(safe-area-inset-bottom))', width: '100%', maxWidth: 430, boxShadow: '0 -8px 32px rgba(0,0,0,0.2)' }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: L.border, margin: '0 auto 18px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <span style={{ fontWeight: 800, fontSize: 18 }}>Hồ sơ của tôi</span>
            <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', fontSize: 20, color: L.t3, cursor: 'pointer' }}>✕</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 22 }}>
            <div onClick={() => avatarFileRef.current?.click()}
              style={{ width: 92, height: 92, borderRadius: '50%', background: L.p2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, color: L.p1, fontWeight: 800, overflow: 'hidden', cursor: 'pointer', position: 'relative', border: `3px solid ${L.surface}`, boxShadow: L.shadow }}>
              {me.avatar_url
                ? <img src={me.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : name.charAt(0).toUpperCase()}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: 16, padding: '3px 0', textAlign: 'center' }}>📷</div>
            </div>
            <input ref={avatarFileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.currentTarget.value = '' }} />
            <div style={{ fontSize: 12, color: L.t3, marginTop: 10 }}>{savingProfile ? 'Đang lưu…' : 'Bấm vào ảnh để đổi ảnh đại diện'}</div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: L.t2, marginBottom: 8 }}>Tên hiển thị</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={nameDraft} onChange={e => setNameDraft(e.target.value)}
                placeholder="Nhập tên của bạn"
                style={{ flex: 1, padding: '12px 14px', borderRadius: 12, border: `1px solid ${L.border}`, fontSize: 15, fontFamily: 'inherit', outline: 'none', background: L.surface2 }} />
              <button onClick={saveDisplayName} disabled={savingProfile || !nameDraft.trim()}
                style={{ background: L.p1, color: L.tinv, border: 'none', borderRadius: 12, padding: '0 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (savingProfile || !nameDraft.trim()) ? 0.5 : 1 }}>
                Lưu
              </button>
            </div>
          </div>
          <button onClick={() => setShowSettings(false)}
            style={{ width: '100%', background: L.surface2, border: `1px solid ${L.border}`, borderRadius: 14, padding: '14px', fontSize: 15, fontWeight: 700, color: L.t1, cursor: 'pointer', fontFamily: 'inherit' }}>
            Xong
          </button>
        </div>
      </div>
    )}

    {/* ── Tool Overlay — fullscreen iframe, không rời app ── */}
    {activeTool && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#000', display: 'flex', flexDirection: 'column' }}>
        {/* Thanh tiêu đề */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: L.p1, flexShrink: 0 }}>
          <button onClick={() => setActiveTool(null)}
            style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#fff', cursor: 'pointer', flexShrink: 0 }}>
            ✕
          </button>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 15, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeTool.name}</span>
        </div>
        {/* Tool chạy trong iframe — session Supabase được chia sẻ qua localStorage */}
        <iframe
          src={activeTool.url}
          style={{ flex: 1, border: 'none', width: '100%' }}
          allow="microphone; camera"
          title={activeTool.name}
        />
      </div>
    )}
    </>
  )
}
