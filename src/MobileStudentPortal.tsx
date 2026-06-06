import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import FlowPlayer from './FlowPlayer'
import FingerExercise from './FingerExercise'
import ScaleExercise from './ScaleExercise'

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
  course: { id: string; name: string; type: string; track: string | null; icon?: string | null; image_url?: string | null; status?: string; sort_order?: number }
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
  tap:           '/tempo',
  'tap-tempo':   '/tempo',
  'tap-beat':    '/tap',
  'tap-beam':    '/tap',
  'tap-sing':    '/tap',
  'tap-strum':   '/tap',
  'scroll-kara': '/tap',
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
  tap:           { label: 'Tap nhịp',     icon: '🥁', color: L.p1,      route: '/tempo'  },
  'tap-tempo':   { label: 'Tap Tempo',    icon: '🥁', color: L.p1,      route: '/tempo'  },
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

  // ── XP & Artist Level ──
  const ARTIST_LEVELS = [
    { label: '🌱 Mầm non',    min: 0,      max: 1000,  color: '#16A34A' },
    { label: '📚 Học việc',   min: 1000,   max: 5000,  color: '#0891B2' },
    { label: '🎤 Biểu diễn',  min: 5000,   max: 15000, color: '#7C3AED' },
    { label: '🎸 Nghệ sĩ',    min: 15000,  max: 40000, color: '#D97706' },
    { label: '👑 Bậc thầy',   min: 40000,  max: 999999,color: '#DC2626' },
  ]
  const XP_SOURCE: Record<string, number> = {
    practice:      1,    // per minute
    lesson:        50,
    song_tempo:    100,
    song_timing:   200,
    song_approved: 300,
    song_mastered: 500,
    streak:        200,
  }
  const [totalXP, setTotalXP]     = useState(0)
  const [weekXP, setWeekXP]       = useState(0)
  const [lastWeekXP, setLastWeekXP] = useState(0)
  const [classRank, setClassRank] = useState<{ rank: number; total: number } | null>(null)

  // ── Practice tracker ──
  const EXERCISES = [
    { id: 'finger',    name: 'Luyện ngón',  icon: '🖐', color: '#7C3AED' },
    { id: 'scale',     name: 'Âm giai',     icon: '🎼', color: '#0891B2' },
    { id: 'arpeggio',  name: 'Arpeggio',    icon: '🎸', color: '#4338CA' },
    { id: 'metronome', name: 'Metronome',   icon: '🥁', color: '#16A34A' },
    { id: 'ear',       name: 'Cảm âm',      icon: '👂', color: '#D97706' },
  ]
  const [practiceTotals, setPracticeTotals] = useState<Record<string, number>>({})
  const [practiceToday, setPracticeToday]   = useState<Record<string, number>>({})
  const [activeTimer, setActiveTimer]       = useState<string | null>(null)
  const [timerStart, setTimerStart]         = useState<number | null>(null)
  const [timerSeconds, setTimerSeconds]     = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Journey config ──
  const JOURNEY_STEPS = [
    { id: 'tempo',  label: 'Tempo',  icon: '🥁', route: '/tempo',        color: '#7C3AED' },
    { id: 'timing', label: 'Timing', icon: '🎼', route: '/youtube-sync', color: '#0891B2' },
    { id: 'nhip',   label: 'Nhịp',   icon: '🎵', route: '/tap',          color: '#4338CA' },
    { id: 'hat',    label: 'Hát',    icon: '🎤', route: null,            color: '#16A34A' },
    { id: 'dan',    label: 'Đàn',    icon: '🎸', route: null,            color: '#D97706' },
  ]

  // ── YouTube Search ──
  const YT_API_KEY = 'AIzaSyA6kg3G2CVZ7b_x8IAlkZJCOa4AJHyWHms'
  const [ytQuery, setYtQuery]         = useState('')
  const [ytResults, setYtResults]     = useState<{ id: string; title: string; channel: string; thumbnail: string }[]>([])
  const [ytSearching, setYtSearching] = useState(false)
  const [ytSelected, setYtSelected]   = useState<{ id: string; title: string; thumbnail: string } | null>(null)

  const searchYouTube = async (q: string) => {
    if (!q.trim()) return
    setYtSearching(true); setYtResults([])
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=6&q=${encodeURIComponent(q)}&key=${YT_API_KEY}`)
      const data = await res.json()
      setYtResults((data.items ?? []).map((item: any) => ({
        id: item.id.videoId, title: item.snippet.title,
        channel: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.default?.url ?? '',
      })))
    } catch(e) { console.error(e) }
    setYtSearching(false)
  }

  const selectYtVideo = (r: { id: string; title: string; thumbnail: string }) => {
    setYtSelected(r)
    setNewSongTitle(r.title)
    setNewSongYoutube(`https://youtube.com/watch?v=${r.id}`)
    setShowConfirmSave(true)
  }

  // ── Add Song Flow ──
  const [showAddSong, setShowAddSong]       = useState(false)
  const [addStep, setAddStep]               = useState<'input'|'preview'>('input')
  const [newSongTitle, setNewSongTitle]     = useState('')
  const [newSongYoutube, setNewSongYoutube] = useState('')
  const [addingSong, setAddingSong]         = useState(false)
  const [carouselIdx, setCarouselIdx]       = useState(0)
  const [showConfirmSave, setShowConfirmSave] = useState(false)
  const [showAllSongs, setShowAllSongs]     = useState(false)

  // XP thưởng cho từng bước journey
  const STEP_XP: Record<string, number> = {
    tempo: XP_SOURCE.song_tempo, timing: XP_SOURCE.song_timing,
    nhip: 150, hat: 250, dan: 300,
  }
  const [celebrate, setCelebrate] = useState<{ title: string; mastered: boolean; xp: number } | null>(null)

  const markStepDone = async (songId: string, stepId: string) => {
    const song = mySongs.find(s => s.id === songId)
    if (!song) return
    const newJourney = song.journey.map(j => j.id === stepId ? { ...j, done: true } : j)
    const mastered = newJourney.every(j => j.done)
    // Cập nhật DB
    await supabase.from('student_songs')
      .update({ journey: newJourney, status: mastered ? 'mastered' : stepId })
      .eq('id', songId)
    setMySongs(prev => prev.map(s => s.id === songId ? { ...s, journey: newJourney } : s))
    // Thưởng XP — bước + bonus nếu chinh phục cả bài
    const gained = (STEP_XP[stepId] ?? 100) + (mastered ? XP_SOURCE.song_mastered : 0)
    await supabase.from('student_xp_log').insert({
      student_id: student.id, xp: gained,
      source: mastered ? 'song_mastered' : 'song_step', ref_id: songId,
    })
    setTotalXP(prev => prev + gained)
    setWeekXP(prev  => prev + gained)
    // Chúc mừng
    setCelebrate({ title: song.title, mastered, xp: gained })
    setTimeout(() => setCelebrate(null), mastered ? 3500 : 2200)
  }

  const handleAddSong = async () => {
    if (!newSongTitle.trim()) return
    setAddingSong(true)
    const steps = [
      { id: 'tempo',  done: false },
      { id: 'timing', done: false },
      { id: 'nhip',   done: false },
      { id: 'hat',    done: false },
      { id: 'dan',    done: false },
    ]
    await supabase.from('student_songs').insert({
      student_id: student.id,
      title: newSongTitle.trim(),
      youtube_url: newSongYoutube.trim() || null,
      status: 'tempo',
      journey: steps,
    })
    const { data } = await supabase.from('student_songs')
      .select('id,title,artist,tempo,status,created_at,journey')
      .eq('student_id', student.id).order('created_at', { ascending: false })
    setMySongs((data ?? []).map((s: any) => ({
      ...s,
      journey: s.journey?.length ? s.journey : steps
    })))
    // Reset form TRƯỚC — để carousel hiện ngay sau khi mySongs được update
    setShowConfirmSave(false)
    setShowAddSong(false)
    setAddStep('input')
    setNewSongTitle(''); setNewSongYoutube('')
    setYtSelected(null); setYtQuery(''); setYtResults([])
    setCarouselIdx(0)
    setAddingSong(false)
  }

  // ── My Songs ──
  const [mySongs, setMySongs] = useState<{ id: string; title: string; artist: string | null; tempo: number | null; status: string; created_at: string; journey: { id: string; done: boolean }[]; youtube_url?: string | null }[]>([])

  // ── Progress tracking ──
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [markingDone, setMarkingDone]   = useState(false)

  // ── Finger Exercise overlay ──
  const [showFingerExercise, setShowFingerExercise] = useState(false)
  // ── Scale Exercise overlay ──
  const [showScaleExercise, setShowScaleExercise] = useState(false)

  // ── Tool overlay — mở tool ngay trong app, không navigate ra ngoài ──
  const [activeTool, setActiveTool] = useState<{ name: string; url: string } | null>(null)
  // ── Track tool đã dùng trong bài hiện tại ──
  const [usedToolIds, setUsedToolIds] = useState<Set<string>>(new Set())

  const startTimer = (exerciseId: string) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setActiveTimer(exerciseId); setTimerStart(Date.now()); setTimerSeconds(0)
    timerRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000)
  }
  const stopTimer = async () => {
    if (!activeTimer || !timerStart) return
    if (timerRef.current) clearInterval(timerRef.current)
    const minutes = Math.max(1, Math.round((Date.now() - timerStart) / 60000))
    await supabase.from('student_practice_log').insert({ student_id: student.id, exercise_id: activeTimer, minutes })
    // Ghi XP — 1 XP/phút
    await supabase.from('student_xp_log').insert({ student_id: student.id, xp: minutes, source: 'practice', ref_id: activeTimer })
    setTotalXP(prev => prev + minutes)
    setWeekXP(prev  => prev + minutes)
    setPracticeTotals(prev => ({ ...prev, [activeTimer]: (prev[activeTimer] ?? 0) + minutes }))
    setPracticeToday(prev  => ({ ...prev, [activeTimer]: (prev[activeTimer] ?? 0) + minutes }))
    setActiveTimer(null); setTimerStart(null); setTimerSeconds(0)
  }
  const fmtTimer = (s: number) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`

  // Khoá lưu trạng thái tool đã thực hành theo từng học sinh + bài học
  const usedToolsKey = (lessonId: string) => `usedTools:${student.id}:${lessonId}`

  // Gộp tool bảng cứng (TOOLS_MAP) + tool tạo trong DB (edu_tools) → mọi tool hợp lệ đều có thẻ thực hành
  const resolveTool = (tid: string): { label: string; icon: string; color: string; route: string } | null => {
    if (TOOLS_MAP[tid]) return TOOLS_MAP[tid]
    const db = dbTools.find(t => t.id === tid)
    if (db) return { label: db.name, icon: db.icon, color: L.p1, route: db.route }
    return null
  }

  const openTool = (route: string, name: string, toolId?: string) => {
    const url = route.startsWith('http') ? route : window.location.origin + route
    setActiveTool({ name, url })
    if (toolId) setUsedToolIds(prev => {
      const next = new Set([...prev, toolId])
      if (activeLesson) { try { localStorage.setItem(usedToolsKey(activeLesson.id), JSON.stringify([...next])) } catch { /* bỏ qua */ } }
      return next
    })
  }

  const studentTierIdx = TIER_ORDER.indexOf(LEVEL_TIER[student.level ?? 'beginner'] ?? 'free')
  const isTierUnlocked = (tier?: string) => TIER_ORDER.indexOf(tier ?? 'free') <= studentTierIdx

  // Tất cả bài đã sắp xếp đúng thứ tự: module order_index → lesson order_index
  const sortedLessons = [...lessons].sort((a, b) => {
    const ma = modules.find(m => m.id === a.module_id)?.order_index ?? 0
    const mb = modules.find(m => m.id === b.module_id)?.order_index ?? 0
    return ma !== mb ? ma - mb : a.order_index - b.order_index
  })

  const isSequentiallyUnlocked = (lessonId: string) => {
    const idx = sortedLessons.findIndex(l => l.id === lessonId)
    if (idx <= 0) return true
    return completedIds.has(sortedLessons[idx - 1].id)
  }

  const isUnlocked = (l: Lesson) =>
    isTierUnlocked(l.tier) && isSequentiallyUnlocked(l.id)

  useEffect(() => {
    supabase.from('edu_enrollments')
      .select('id,course_id,enrolled_at,is_active,course:edu_courses(id,name,type,track,icon,image_url,status,sort_order)')
      .eq('student_id', student.id).eq('is_active', true)
      .then(({ data }) => setEnrollments((data ?? []) as unknown as Enrollment[]))
    supabase.from('edu_tools').select('*').eq('enabled', true).order('order_index')
      .then(({ data }) => { if (data?.length) setDbTools(data as DBTool[]) })
    // Load progress
    // Load XP
    const weekAgo     = new Date(Date.now() - 7  * 24 * 3600 * 1000).toISOString()
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString()
    supabase.from('student_xp_log').select('xp, source, created_at').eq('student_id', student.id)
      .then(({ data }) => {
        if (!data) return
        const total   = data.reduce((a, r) => a + r.xp, 0)
        const week    = data.filter(r => r.created_at >= weekAgo).reduce((a, r) => a + r.xp, 0)
        const lweek   = data.filter(r => r.created_at >= twoWeeksAgo && r.created_at < weekAgo).reduce((a, r) => a + r.xp, 0)
        setTotalXP(total); setWeekXP(week); setLastWeekXP(lweek)
      })
    // Class rank
    supabase.from('student_xp_log').select('student_id, xp')
      .then(({ data: all }) => {
        if (!all) return
        const byStudent: Record<string, number> = {}
        all.forEach((r: any) => { byStudent[r.student_id] = (byStudent[r.student_id] ?? 0) + r.xp })
        const myXP   = byStudent[student.id] ?? 0
        const better = Object.values(byStudent).filter(x => x > myXP).length
        setClassRank({ rank: better + 1, total: Math.max(Object.keys(byStudent).length, 1) })
      })

    // Load practice data
    const now2 = new Date()
    const todayStart = new Date(now2.getFullYear(), now2.getMonth(), now2.getDate()).toISOString()
    supabase.from('student_practice_log')
      .select('exercise_id, minutes, practiced_at')
      .eq('student_id', student.id)
      .then(({ data }) => {
        if (!data) return
        const totals: Record<string, number> = {}
        const today: Record<string, number>  = {}
        data.forEach((r: any) => {
          totals[r.exercise_id] = (totals[r.exercise_id] ?? 0) + r.minutes
          if (r.practiced_at >= todayStart)
            today[r.exercise_id] = (today[r.exercise_id] ?? 0) + r.minutes
        })
        setPracticeTotals(totals)
        setPracticeToday(today)
      })

    supabase.from('student_songs')
      .select('id,title,artist,tempo,status,created_at,journey,youtube_url')
      .eq('student_id', student.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setMySongs((data ?? []).map((s: any) => ({
        ...s,
        journey: s.journey?.length ? s.journey : JOURNEY_STEPS.map((step: any) => ({ id: step.id, done: false }))
      }))))
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
    // Khôi phục tool đã thực hành của bài này (nếu có) → không bị "khoá lại" khi mở lại
    try {
      const saved = JSON.parse(localStorage.getItem(usedToolsKey(l.id)) || '[]')
      setUsedToolIds(new Set(Array.isArray(saved) ? saved : []))
    } catch { setUsedToolIds(new Set()) }
    setScreen('lesson')
  }

  const markComplete = async (lessonId: string) => {
    if (completedIds.has(lessonId) || markingDone) return
    setMarkingDone(true)
    // Kiểm tra đã có record chưa trước khi insert
    const { data: existing } = await supabase.from('edu_lesson_progress')
      .select('id').eq('student_id', student.id).eq('lesson_id', lessonId).maybeSingle()
    const { error } = existing
      ? await supabase.from('edu_lesson_progress')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', existing.id)
      : await supabase.from('edu_lesson_progress')
          .insert({ student_id: student.id, lesson_id: lessonId, status: 'completed', completed_at: new Date().toISOString() })
    if (error) {
      console.error('Lỗi lưu tiến độ:', error)
      alert('Không lưu được tiến độ: ' + error.message)
      setMarkingDone(false)
      return
    }
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

  // Sắp xếp theo sort_order, published trước unpublished
  // Lọc bỏ khoá status = 'off' (hoàn toàn ẩn với học sinh)
  const visibleEnrollments = enrollments.filter(e => (e.course?.status ?? 'on') !== 'off')
  const sortedEnrollments = [...visibleEnrollments].sort((a, b) => {
    const ap = (a.course?.status ?? 'on') === 'on' ? 0 : 1
    const bp = (b.course?.status ?? 'on') === 'on' ? 0 : 1
    if (ap !== bp) return ap - bp
    return (a.course?.sort_order ?? 99) - (b.course?.sort_order ?? 99)
  })
  // Khoá "Học ngay": published (status = 'on') ưu tiên
  const mainCourse = sortedEnrollments.find(e => (e.course?.status ?? 'on') === 'on')
    ?? sortedEnrollments[0]
  const name = uname(me)

  const displayTools = dbTools.length > 0 ? dbTools : [
    { id:'tap-tempo', icon:'🥁', name:'Tap Tempo',   description:'Tìm nhịp bài hát yêu thích', category:'Luyện tập', route:'/tempo', tier:'free', enabled:true },
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
    {/* ── Finger Exercise overlay (fullscreen, position:fixed) ── */}
    {showFingerExercise && (
      <FingerExercise
        totalMinutes={practiceTotals['finger'] ?? 0}
        onClose={async () => {
          await stopTimer()
          setShowFingerExercise(false)
        }}
      />
    )}

    {showScaleExercise && (
      <ScaleExercise
        totalMinutes={practiceTotals['scale'] ?? 0}
        onClose={async () => {
          await stopTimer()
          setShowScaleExercise(false)
        }}
      />
    )}

    {celebrate && (
      <div onClick={() => setCelebrate(null)} style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)', animation: 'fadeIn .2s ease' }}>
        <div style={{ background: L.surface, borderRadius: 24, padding: '28px 32px', textAlign: 'center', boxShadow: '0 12px 48px rgba(0,0,0,0.25)', maxWidth: 320, margin: 16, animation: 'popIn .35s cubic-bezier(.18,.89,.32,1.28)' }}>
          <div style={{ fontSize: 56, marginBottom: 8 }}>{celebrate.mastered ? '👑' : '🎉'}</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: celebrate.mastered ? L.green : L.p1, marginBottom: 4 }}>
            {celebrate.mastered ? 'Chinh phục thành công!' : 'Hoàn thành bước!'}
          </div>
          <div style={{ fontSize: 13, color: L.t2, marginBottom: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{celebrate.title}</div>
          <div style={{ display: 'inline-block', background: '#D9770618', color: '#D97706', fontWeight: 800, fontSize: 15, padding: '6px 16px', borderRadius: 99 }}>+{celebrate.xp} XP</div>
        </div>
        <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes popIn{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}`}</style>
      </div>
    )}
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

              {/* Artist Level Card */}
            {(() => {
              const level    = ARTIST_LEVELS.find(l => totalXP >= l.min && totalXP < l.max) ?? ARTIST_LEVELS[0]
              const nextLevel= ARTIST_LEVELS[ARTIST_LEVELS.indexOf(level) + 1]
              const pct      = nextLevel ? Math.round(((totalXP - level.min) / (nextLevel.min - level.min)) * 100) : 100
              const weekDiff = lastWeekXP > 0 ? Math.round(((weekXP - lastWeekXP) / lastWeekXP) * 100) : null
              const rankPct  = classRank ? Math.round((1 - classRank.rank / classRank.total) * 100) : null
              return (
                <div style={{ background: L.surface, borderRadius: 20, padding: '18px', boxShadow: L.shadowLg, border: `1.5px solid ${level.color}22` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 11, color: L.t3, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.06em' }}>Cấp độ nghệ sĩ</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: level.color }}>{level.label}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: level.color }}>{totalXP.toLocaleString()}</div>
                      <div style={{ fontSize: 10, color: L.t3 }}>XP tổng</div>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ height: 8, borderRadius: 99, background: L.surface2, overflow: 'hidden', marginBottom: 5 }}>
                      <div style={{ height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${level.color}, ${level.color}99)`, width: `${pct}%`, transition: 'width .5s' }} />
                    </div>
                    {nextLevel && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: L.t3 }}>
                        <span>{level.min.toLocaleString()} XP</span>
                        <span style={{ color: level.color, fontWeight: 600 }}>{pct}% → {nextLevel.label}</span>
                        <span>{nextLevel.min.toLocaleString()} XP</span>
                      </div>
                    )}
                  </div>
                  {/* Stats row */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1, background: L.surface2, borderRadius: 12, padding: '10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: L.t1 }}>{weekXP.toLocaleString()}</div>
                      <div style={{ fontSize: 10, color: L.t3 }}>XP tuần này</div>
                      {weekDiff !== null && (
                        <div style={{ fontSize: 10, fontWeight: 700, color: weekDiff >= 0 ? L.green : '#EF4444', marginTop: 2 }}>
                          {weekDiff >= 0 ? '↑' : '↓'}{Math.abs(weekDiff)}% vs tuần trước
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, background: L.surface2, borderRadius: 12, padding: '10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: L.t1 }}>
                        {rankPct !== null ? `Top ${100 - rankPct}%` : '—'}
                      </div>
                      <div style={{ fontSize: 10, color: L.t3 }}>Xếp hạng lớp</div>
                      {classRank && <div style={{ fontSize: 10, color: L.t2, marginTop: 2 }}>#{classRank.rank}/{classRank.total}</div>}
                    </div>
                  </div>
                </div>
              )
            })()}

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
              {sortedEnrollments.length > 0 && (
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Tất cả khoá học</div>
                  {sortedEnrollments.map(e => {
                    const isPublished = (e.course?.status ?? 'on') === 'on'
                    return (
                      <div key={e.id}
                        onClick={() => isPublished ? openCourse(e.course_id) : undefined}
                        style={{
                          background: L.surface, borderRadius: 16, padding: '14px 16px',
                          boxShadow: L.shadow, display: 'flex', alignItems: 'center', gap: 12,
                          marginBottom: 8,
                          cursor: isPublished ? 'pointer' : 'default',
                          opacity: isPublished ? 1 : 0.45,
                        }}>
                        <CourseLogo course={e.course} size={42} radius={12} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isPublished ? L.t1 : L.t2 }}>
                            {e.course?.name}
                          </div>
                          <div style={{ fontSize: 11, color: L.t3, marginTop: 2 }}>
                            {isPublished
                              ? (e.course?.type === 'canh_cua' ? 'Cánh Cửa' : 'Hành Trình')
                              : '🔜 Sắp ra mắt'}
                          </div>
                        </div>
                        {isPublished
                          ? <span style={{ color: L.t3, fontSize: 18 }}>›</span>
                          : <span style={{ fontSize: 10, color: L.t3, background: L.surface2, borderRadius: 8, padding: '3px 8px', fontWeight: 600, flexShrink: 0 }}>Sắp ra mắt</span>
                        }
                      </div>
                    )
                  })}
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
                  {lessons.filter(l => l.module_id === mod.id).sort((a, b) => a.order_index - b.order_index).map((l) => {
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
            {/* Flow Player — fullScreen=true → FlowPlayer tự dùng position:fixed, tránh bug iOS WebKit */}
            {activeLesson.lesson_type === 'flow' ? (
              <FlowPlayer
                lessonId={activeLesson.id}
                studentId={student.id}
                onComplete={() => markComplete(activeLesson.id)}
                onBack={goBack}
                fullScreen
              />
            ) : (
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
            {activeLesson.lesson_type !== 'flow' && activeLesson.lesson_type === 'video' && getYtId(activeLesson.content_url) && (
              <div style={{ aspectRatio: '16/9', background: '#000' }}>
                <iframe src={`https://www.youtube.com/embed/${getYtId(activeLesson.content_url)}?rel=0`}
                  style={{ width: '100%', height: '100%', border: 'none' }} allowFullScreen />
              </div>
            )}

            {/* Slide Canva */}
            {activeLesson.lesson_type !== 'flow' && activeLesson.lesson_type === 'slide' && activeLesson.content_url && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#1a1a2e' }}>
                <iframe src={activeLesson.content_url} style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} allowFullScreen allow="fullscreen" title={activeLesson.title} />
                <button onClick={goBack} style={{ position: 'absolute', top: 16, left: 16, zIndex: 51, background: 'rgba(0,0,0,0.65)', border: 'none', borderRadius: 20, padding: '8px 14px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', backdropFilter: 'blur(8px)' }}>← Quay lại</button>
              </div>
            )}

            {/* Link embed */}
            {activeLesson.lesson_type !== 'flow' && activeLesson.lesson_type === 'link' && activeLesson.content_url && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#000' }}>
                <iframe src={activeLesson.content_url} style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} allow="microphone; camera" title={activeLesson.title} />
                <button onClick={goBack} style={{ position: 'absolute', top: 16, left: 16, zIndex: 51, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 20, padding: '8px 14px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', backdropFilter: 'blur(8px)' }}>← Quay lại</button>
              </div>
            )}

            {activeLesson.lesson_type !== 'flow' && <div style={{ padding: '16px' }}>
              {lessonTab === 'content' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {activeLesson.description && (
                    <div style={{ fontSize: 14, color: L.t2, lineHeight: 1.8 }}>{activeLesson.description}</div>
                  )}
                  {activeLesson.content && (
                    <div style={{ background: L.surface, borderRadius: 16, padding: '16px', boxShadow: L.shadow, fontSize: 14, lineHeight: 1.8, color: L.t1 }}
                      className="rich-content"
                      dangerouslySetInnerHTML={{ __html: activeLesson.content }} />
                  )}
                  {activeLesson.tools?.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: L.t3, textTransform: 'uppercase', letterSpacing: '.06em', paddingLeft: 4 }}>
                        🎯 Thực hành — hoàn thành để tiếp tục
                      </div>
                      {activeLesson.tools.map((tid) => {
                        const t = resolveTool(tid); if (!t) return null
                        const done = usedToolIds.has(tid)
                        return (
                          <div key={tid} onClick={() => openTool(t.route, t.label, tid)}
                            style={{ background: done ? L.greenBg : L.surface, border: `2px solid ${done ? L.green : t.color}`, borderRadius: 18, padding: '18px 16px', cursor: 'pointer', boxShadow: done ? 'none' : `0 4px 20px ${t.color}22`, transition: 'all .2s' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                              <div style={{ width: 52, height: 52, borderRadius: 14, background: done ? L.green + '18' : t.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>
                                {done ? '✅' : t.icon}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 15, fontWeight: 700, color: done ? L.green : L.t1, marginBottom: 3 }}>{t.label}</div>
                                <div style={{ fontSize: 12, color: done ? L.green : L.t2 }}>
                                  {done ? 'Đã hoàn thành ✓' : 'Bấm để bắt đầu thực hành'}
                                </div>
                              </div>
                              {!done && (
                                <div style={{ background: t.color, color: '#fff', borderRadius: 12, padding: '8px 14px', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                                  Bắt đầu →
                                </div>
                              )}
                            </div>
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
            </div>}

            {/* Nav buttons + Đánh dấu hoàn thành — ẩn khi flow (FlowPlayer tự quản lý) */}
            {activeLesson.lesson_type === 'flow' ? null : <>{/* Nav buttons + Đánh dấu hoàn thành */}
            <div style={{ padding: '8px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Nút hoàn thành — block nếu chưa dùng hết tool */}
              {!completedIds.has(activeLesson.id) && (() => {
                // Chỉ tính tool còn hiển thị được thẻ (có trong TOOLS_MAP hoặc DB).
                // Tool không xác định (đã xoá/đổi id) bị bỏ qua → KHÔNG khoá vĩnh viễn.
                const requiredTools = (activeLesson.tools ?? []).filter(tid => !!resolveTool(tid))
                const allToolsDone = requiredTools.length === 0 || requiredTools.every(tid => usedToolIds.has(tid))
                return allToolsDone ? (
                  <button onClick={() => markComplete(activeLesson.id)} disabled={markingDone}
                    style={{ width: '100%', background: L.greenBg, border: `1.5px solid ${L.green}`, borderRadius: 14, padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: L.green, opacity: markingDone ? 0.6 : 1 }}>
                    {markingDone ? 'Đang lưu…' : '✓ Đánh dấu đã học'}
                  </button>
                ) : (
                  <div style={{ background: L.surface2, border: `1.5px solid ${L.border}`, borderRadius: 14, padding: '13px', textAlign: 'center' }}>
                    <div style={{ fontSize: 13, color: L.t3, fontWeight: 600 }}>
                      🔒 Hoàn thành {requiredTools.filter(tid => !usedToolIds.has(tid)).length} bài tập thực hành để tiếp tục
                    </div>
                  </div>
                )
              })()}
              {completedIds.has(activeLesson.id) && (
                <div style={{ textAlign: 'center', fontSize: 13, color: L.green, fontWeight: 600, padding: '8px 0' }}>✅ Bài này đã hoàn thành</div>
              )}
              {/* Prev / Next */}
              <div style={{ display: 'flex', gap: 10 }}>
                {(() => {
                  const idx  = sortedLessons.findIndex(l => l.id === activeLesson.id)
                  const prev = idx > 0 ? sortedLessons[idx - 1] : null
                  const next = idx < sortedLessons.length - 1 ? sortedLessons[idx + 1] : null
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
            </>}
            </> /* đóng nhánh else (không phải flow) */
            )}
          </>
        )}

        {/* ── TẬP ─────────────────────────────────────────────────────── */}
        {tab === 'tap' && (
          <div style={{ padding: '52px 16px 16px' }}>
            <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 4 }}>Luyện tập</div>

            {/* ══ HÔM NAY LUYỆN GÌ ══ */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>🔥 Hôm nay luyện gì?</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {EXERCISES.map(ex => {
                  const totalMin = practiceTotals[ex.id] ?? 0
                  const totalHrs = (totalMin / 60).toFixed(1)
                  const todayMin = practiceToday[ex.id] ?? 0
                  const isActive = activeTimer === ex.id
                  return (
                    <div key={ex.id} style={{ background: L.surface, borderRadius: 16, padding: '14px 16px', boxShadow: L.shadow, border: `1.5px solid ${isActive ? ex.color : 'transparent'}`, transition: 'border .2s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: ex.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                          {ex.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{ex.name}</div>
                          <div style={{ fontSize: 11, color: L.t2, marginTop: 2 }}>
                            Tích lũy: <span style={{ color: ex.color, fontWeight: 700 }}>{totalHrs}h</span>
                            {todayMin > 0 && <span style={{ color: L.green }}> · Hôm nay: {todayMin}ph</span>}
                          </div>
                        </div>
                        {ex.id === 'finger' ? (
                          /* Card Luyện ngón: mở FingerExercise overlay thay vì chỉ chạy timer */
                          isActive ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ fontSize: 15, fontWeight: 900, color: ex.color, fontVariantNumeric: 'tabular-nums' }}>{fmtTimer(timerSeconds)}</div>
                              <button onClick={() => setShowFingerExercise(true)}
                                style={{ background: ex.color, border: 'none', borderRadius: 10, padding: '6px 12px', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                                Mở →
                              </button>
                            </div>
                          ) : (
                            <button
                              disabled={!!activeTimer}
                              onClick={() => { startTimer('finger'); setShowFingerExercise(true) }}
                              style={{ background: activeTimer ? L.surface2 : ex.color, border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 700, color: activeTimer ? L.t3 : '#fff', cursor: activeTimer ? 'default' : 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                              ▶ Bắt đầu
                            </button>
                          )
                        ) : ex.id === 'scale' ? (
                          /* Card Âm giai: mở ScaleExercise overlay */
                          isActive ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ fontSize: 15, fontWeight: 900, color: ex.color, fontVariantNumeric: 'tabular-nums' }}>{fmtTimer(timerSeconds)}</div>
                              <button onClick={() => setShowScaleExercise(true)}
                                style={{ background: ex.color, border: 'none', borderRadius: 10, padding: '6px 12px', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                                Mở →
                              </button>
                            </div>
                          ) : (
                            <button
                              disabled={!!activeTimer}
                              onClick={() => { startTimer('scale'); setShowScaleExercise(true) }}
                              style={{ background: activeTimer ? L.surface2 : ex.color, border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 700, color: activeTimer ? L.t3 : '#fff', cursor: activeTimer ? 'default' : 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                              ▶ Bắt đầu
                            </button>
                          )
                        ) : isActive ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ fontSize: 16, fontWeight: 900, color: ex.color, fontVariantNumeric: 'tabular-nums' }}>{fmtTimer(timerSeconds)}</div>
                            <button onClick={stopTimer}
                              style={{ background: '#EF4444', border: 'none', borderRadius: 10, padding: '6px 12px', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                              Dừng
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => startTimer(ex.id)} disabled={!!activeTimer}
                            style={{ background: activeTimer ? L.surface2 : ex.color, border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 700, color: activeTimer ? L.t3 : '#fff', cursor: activeTimer ? 'default' : 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                            ▶ Bắt đầu
                          </button>
                        )}
                      </div>
                      {totalMin > 0 && (
                        <div style={{ marginTop: 10, height: 3, borderRadius: 99, background: L.surface2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 99, background: ex.color, width: `${Math.min(100, totalMin / (1000*60) * 100)}%` }} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ══ BÀI HÁT ĐANG CHINH PHỤC ══ */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>🎸 Bài hát đang chinh phục</div>
                {mySongs.length > 0 && <span style={{ fontSize: 11, color: L.t3 }}>{mySongs.length} bài</span>}
              </div>

              {/* Empty state */}
              {mySongs.length === 0 && !showAddSong && (
                <div style={{ background: L.surface, borderRadius: 20, padding: '32px 20px', boxShadow: L.shadow, textAlign: 'center' }}>
                  <div style={{ fontSize: 40, marginBottom: 14 }}>🎸</div>
                  <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>Bạn chưa có bài hát nào</div>
                  <div style={{ fontSize: 13, color: L.t2, lineHeight: 1.7, marginBottom: 24 }}>Mỗi nghệ sĩ đều bắt đầu từ bài hát đầu tiên.</div>
                  <button onClick={() => { setShowAddSong(true); setAddStep('input') }}
                    style={{ background: `linear-gradient(135deg, ${L.p1}, #6366F1)`, color: '#fff', border: 'none', borderRadius: 14, padding: '14px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    ➕ Chọn bài hát đầu tiên
                  </button>
                </div>
              )}

              {/* Add song — step input: YouTube search */}
              {showAddSong && addStep === 'input' && (
                <div style={{ background: L.surface, borderRadius: 20, padding: '20px', boxShadow: L.shadow }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>🔍 Tìm bài hát</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <input value={ytQuery} onChange={e => setYtQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && searchYouTube(ytQuery)}
                      placeholder="Nhập tên bài hát..." autoFocus
                      style={{ flex: 1, background: L.surface2, border: `1.5px solid ${L.border}`, borderRadius: 12, padding: '12px 14px', fontSize: 14, color: L.t1, fontFamily: 'inherit', outline: 'none' }} />
                    <button onClick={() => searchYouTube(ytQuery)} disabled={ytSearching || !ytQuery.trim()}
                      style={{ background: L.p1, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 16px', fontSize: 16, cursor: 'pointer', opacity: ytSearching ? 0.6 : 1, flexShrink: 0 }}>
                      {ytSearching ? '⏳' : '🔍'}
                    </button>
                  </div>
                  {ytResults.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto', marginBottom: 12 }}>
                      {ytResults.map(r => (
                        <div key={r.id} onClick={() => selectYtVideo(r)}
                          style={{ display: 'flex', gap: 10, background: L.surface2, borderRadius: 12, padding: '10px', cursor: 'pointer', border: `1px solid ${L.border}` }}>
                          {r.thumbnail && <img src={r.thumbnail} alt="" style={{ width: 60, height: 45, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: L.t1, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{r.title}</div>
                            <div style={{ fontSize: 10, color: L.t3, marginTop: 2 }}>{r.channel}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => { setShowAddSong(false); setYtResults([]); setYtQuery('') }}
                    style={{ width: '100%', background: L.surface2, color: L.t2, border: 'none', borderRadius: 12, padding: '12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Huỷ
                  </button>
                </div>
              )}

              {/* Confirm save popup */}
              {showConfirmSave && ytSelected && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                  <div style={{ background: L.surface, borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: 480 }}>
                    <div style={{ width: 40, height: 4, background: L.border, borderRadius: 99, margin: '0 auto 20px' }} />
                    <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16, textAlign: 'center' }}>Thêm vào thư viện?</div>
                    <div style={{ display: 'flex', gap: 12, background: L.surface2, borderRadius: 16, padding: 14, marginBottom: 20 }}>
                      <img src={ytSelected.thumbnail} alt="" style={{ width: 80, height: 60, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>{ytSelected.title}</div>
                        <div style={{ fontSize: 11, color: L.green, marginTop: 4 }}>✓ YouTube đã liên kết</div>
                      </div>
                    </div>
                    <button onClick={async () => { await handleAddSong() }}
                      disabled={addingSong}
                      style={{ width: '100%', background: `linear-gradient(135deg, ${L.p1}, #6366F1)`, color: '#fff', border: 'none', borderRadius: 14, padding: '15px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10, opacity: addingSong ? 0.7 : 1 }}>
                      {addingSong ? '⏳ Đang lưu...' : '🎸 Lưu vào thư viện'}
                    </button>
                    <button onClick={() => { setShowConfirmSave(false); setYtSelected(null); setNewSongTitle(''); setNewSongYoutube('') }}
                      style={{ width: '100%', background: 'none', border: 'none', color: L.t2, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '10px' }}>
                      Huỷ
                    </button>
                  </div>
                </div>
              )}

              {/* Carousel */}
              {mySongs.length > 0 && !showAddSong && (() => {
                const recent = mySongs.slice(0, 5)
                const song = recent[Math.min(carouselIdx, recent.length - 1)]
                if (!song) return null
                const journey = song.journey ?? JOURNEY_STEPS.map(s => ({ id: s.id, done: false }))
                const curIdx = journey.findIndex(j => !j.done)
                const curStep = JOURNEY_STEPS[curIdx >= 0 ? curIdx : JOURNEY_STEPS.length - 1]
                return (
                  <div>
                    <div style={{ background: L.surface, borderRadius: 20, padding: '18px', boxShadow: L.shadowLg, border: `1.5px solid ${L.border}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: curStep.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{curStep.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</div>
                          <div style={{ fontSize: 11, color: L.t2, marginTop: 1 }}>Đang luyện: <span style={{ color: curStep.color, fontWeight: 700 }}>{curStep.label}</span></div>
                        </div>
                      </div>
                      {/* Progress */}
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 5 }}>
                          {JOURNEY_STEPS.map((step, i) => {
                            const done = journey.find(j => j.id === step.id)?.done ?? false
                            const isCur = i === curIdx
                            return (
                              <div key={step.id} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                {i > 0 && <div style={{ flex: 1, height: 3, background: done ? step.color : L.border, borderRadius: 99 }} />}
                                <div style={{ width: 14, height: 14, borderRadius: '50%', flexShrink: 0, background: done ? step.color : isCur ? step.color : 'transparent', border: `2px solid ${done || isCur ? step.color : L.border}`, transition: 'all .3s' }} />
                                {i < JOURNEY_STEPS.length - 1 && <div style={{ flex: 1, height: 3, background: done ? JOURNEY_STEPS[i+1].color + '40' : L.border, borderRadius: 99 }} />}
                              </div>
                            )
                          })}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          {JOURNEY_STEPS.map((step, i) => {
                            const done = journey.find(j => j.id === step.id)?.done ?? false
                            const isCur = i === curIdx
                            return <div key={step.id} style={{ fontSize: 9, fontWeight: isCur ? 700 : 400, color: done ? step.color : isCur ? step.color : L.t3, textAlign: 'center', flex: 1 }}>{step.label}</div>
                          })}
                        </div>
                      </div>
                      {/* Buttons */}
                      {curIdx < 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'linear-gradient(135deg, #16A34A18, #D9770618)', borderRadius: 12, padding: '13px', border: '1.5px solid #16A34A40' }}>
                          <span style={{ fontSize: 18 }}>👑</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: L.green }}>Đã chinh phục bài này!</span>
                        </div>
                      ) : (
                      <div style={{ display: 'flex', gap: 8 }}>
                        {curStep.route ? (
                          <button onClick={() => {
                            let route = curStep.route!
                            if (song.title) {
                              const params = new URLSearchParams({ title: song.title })
                              if (song.youtube_url) params.set('youtube', song.youtube_url)
                              route = route + '?' + params.toString()
                            }
                            openTool(route, curStep.label, curStep.id)
                          }}
                            style={{ flex: 2, background: `linear-gradient(135deg, ${curStep.color}, ${curStep.color}99)`, color: '#fff', border: 'none', borderRadius: 12, padding: '11px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                            {curStep.icon} Tiếp tục {curStep.label}
                          </button>
                        ) : (
                          <div style={{ flex: 2, background: L.surface2, borderRadius: 12, padding: '11px', fontSize: 12, color: L.t3, textAlign: 'center' }}>🔒 {curStep.label} — Sắp ra mắt</div>
                        )}
                        <button onClick={() => markStepDone(song.id, curStep.id)}
                          style={{ flex: 1, background: L.surface2, color: L.green, border: `1.5px solid ${L.green}40`, borderRadius: 12, padding: '11px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          ✓ Xong
                        </button>
                      </div>
                      )}
                    </div>
                    {/* Dots */}
                    {recent.length > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 10 }}>
                        <button onClick={() => setCarouselIdx(i => Math.max(0, i - 1))} disabled={carouselIdx === 0}
                          style={{ background: 'none', border: 'none', color: carouselIdx === 0 ? L.border : L.t2, fontSize: 18, cursor: 'pointer', padding: '4px 8px' }}>‹</button>
                        {recent.map((_, i) => (
                          <div key={i} onClick={() => setCarouselIdx(i)}
                            style={{ width: i === carouselIdx ? 16 : 7, height: 7, borderRadius: 99, background: i === carouselIdx ? L.p1 : L.border, cursor: 'pointer', transition: 'all .2s' }} />
                        ))}
                        <button onClick={() => setCarouselIdx(i => Math.min(recent.length - 1, i + 1))} disabled={carouselIdx === recent.length - 1}
                          style={{ background: 'none', border: 'none', color: carouselIdx === recent.length - 1 ? L.border : L.t2, fontSize: 18, cursor: 'pointer', padding: '4px 8px' }}>›</button>
                      </div>
                    )}
                    {/* All songs */}
                    {mySongs.length > 5 && (
                      <div style={{ marginTop: 10 }}>
                        <button onClick={() => setShowAllSongs(!showAllSongs)}
                          style={{ width: '100%', background: 'none', border: 'none', color: L.t2, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '8px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>📚 Tất cả bài hát ({mySongs.length})</span><span>{showAllSongs ? '▲' : '▼'}</span>
                        </button>
                        {showAllSongs && mySongs.map(s => {
                          const j = s.journey ?? []
                          const ci = j.findIndex(jj => !jj.done)
                          const cs = JOURNEY_STEPS[ci >= 0 ? ci : JOURNEY_STEPS.length - 1]
                          return (
                            <div key={s.id} onClick={() => { const idx = mySongs.slice(0,5).findIndex(ss => ss.id === s.id); if (idx >= 0) setCarouselIdx(idx); setShowAllSongs(false) }}
                              style={{ display: 'flex', alignItems: 'center', gap: 10, background: L.surface, borderRadius: 12, padding: '10px 12px', cursor: 'pointer', marginTop: 6 }}>
                              <span style={{ fontSize: 15 }}>{cs.icon}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                                <div style={{ fontSize: 10, color: cs.color, fontWeight: 600 }}>{cs.label}</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    <button onClick={() => { setShowAddSong(true); setAddStep('input') }}
                      style={{ width: '100%', marginTop: 10, background: 'none', border: `1.5px dashed ${L.border}`, borderRadius: 14, padding: '11px', fontSize: 13, fontWeight: 600, color: L.t2, cursor: 'pointer', fontFamily: 'inherit' }}>
                      ➕ Thêm bài hát mới
                    </button>
                  </div>
                )
              })()}
            </div>

            {/* ── Công cụ ── */}
            <div style={{ fontSize: 14, fontWeight: 700, color: L.t2, marginBottom: 12 }}>🎯 Công cụ luyện tập</div>

            {/* Tools grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {displayTools.map((t) => {
                const unlocked = isTierUnlocked(t.tier)
                const route = TOOL_ROUTES[t.id] ?? t.route ?? '/tap'
                return (
                  <div key={t.id} onClick={() => { if (unlocked) openTool(route, t.name, t.id) }}
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
