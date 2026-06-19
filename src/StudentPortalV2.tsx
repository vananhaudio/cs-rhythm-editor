import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

const D = {
  bg: '#F4F4F5', surface: '#FFFFFF',
  text1: '#18181B', text2: '#52525B', text3: '#A1A1AA',
  border: '#E4E4E7', borderLight: '#F0F0F1',
  accent: '#4F46E5', accentLight: '#EEF2FF',
  success: '#16A34A',
  gold: '#D97706', goldBg: '#FFFBEB',
  shadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
  shadowMd: '0 4px 12px rgba(0,0,0,0.08)',
}

const EXERCISES = [
  { id: 'finger',    name: 'Luyện ngón',  icon: '🖐', color: '#7C3AED' },
  { id: 'scale',     name: 'Âm giai',     icon: '🎼', color: '#0891B2' },
  { id: 'arpeggio',  name: 'Arpeggio',    icon: '🎸', color: '#4338CA' },
  { id: 'metronome', name: 'Metronome',   icon: '🥁', color: '#16A34A' },
  { id: 'ear',       name: 'Cảm âm',      icon: '👂', color: '#D97706' },
]

const ARTIST_LEVELS = [
  { label: 'Mầm non',   min: 0,     max: 1000,  color: '#16A34A' },
  { label: 'Học việc',  min: 1000,  max: 5000,  color: '#0891B2' },
  { label: 'Biểu diễn', min: 5000,  max: 15000, color: '#7C3AED' },
  { label: 'Nghệ sĩ',   min: 15000, max: 40000, color: '#D97706' },
  { label: 'Bậc thầy',  min: 40000, max: 999999,color: '#DC2626' },
]


const TIER_ORDER = ['free', 'basic', 'standard', 'pro']
const LEVEL_TIER: Record<string, string> = { beginner: 'free', elementary: 'basic', intermediate: 'standard', advanced: 'pro' }

interface Student { id: string; full_name: string; email: string | null; level: string | null; display_name?: string | null; avatar_url?: string | null }
interface DBTool { id: string; icon: string; name: string; description: string | null; category: string; route: string; tier: string; enabled: boolean }
interface Enrollment { id: string; course_id: string; course: { id: string; name: string; slug: string; type: string } }
interface MySong { id: string; title: string; artist: string | null; tempo: number | null; status: string }

function uname(s: Student) {
  if (s.display_name?.trim()) return s.display_name.trim()
  const n = s.full_name ?? ''
  return n.includes('@') ? n.split('@')[0] : n.split(' ').pop() ?? n
}
function Bar({ pct, color = D.accent, h = 4 }: { pct: number; color?: string; h?: number }) {
  return (
    <div style={{ height: h, background: D.border, borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, pct))}%`, background: color, borderRadius: 99, transition: 'width .4s' }} />
    </div>
  )
}

interface Props { student: Student; onLogout: () => void }

export default function StudentPortalV2({ student, onLogout }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [dbTools, setDbTools]         = useState<DBTool[]>([])
  const [mySongs, setMySongs]         = useState<MySong[]>([])
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())

  // XP
  const [totalXP, setTotalXP]       = useState(0)
  const [weekXP, setWeekXP]         = useState(0)
  const [lastWeekXP, setLastWeekXP] = useState(0)
  const [classRank, setClassRank]   = useState<{ rank: number; total: number } | null>(null)

  // Practice
  const [practiceTotals, setPracticeTotals] = useState<Record<string, number>>({})
  const [practiceToday, setPracticeToday]   = useState<Record<string, number>>({})
  const [activeTimer, setActiveTimer]       = useState<string | null>(null)
  const [timerStart, setTimerStart]         = useState<number | null>(null)
  const [timerSeconds, setTimerSeconds]     = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    supabase.from('edu_enrollments')
      .select('id,course_id,is_active,course:edu_courses(id,name,slug,type)')
      .eq('student_id', student.id).eq('is_active', true)
      .then(({ data }) => setEnrollments((data ?? []) as unknown as Enrollment[]))
    supabase.from('edu_tools').select('*').eq('enabled', true).order('order_index')
      .then(({ data }) => { if (data?.length) setDbTools(data as DBTool[]) })
    supabase.from('student_songs').select('id,title,artist,tempo,status')
      .eq('student_id', student.id).order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => setMySongs(data ?? []))
    supabase.from('edu_lesson_progress').select('lesson_id').eq('student_id', student.id)
      .then(({ data }) => { if (data) setCompletedIds(new Set(data.map((r: any) => r.lesson_id))) })

    const weekAgo     = new Date(Date.now() - 7  * 24 * 3600 * 1000).toISOString()
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString()
    supabase.from('student_xp_log').select('xp,created_at').eq('student_id', student.id)
      .then(({ data }) => {
        if (!data) return
        setTotalXP(data.reduce((a, r) => a + r.xp, 0))
        setWeekXP(data.filter(r => r.created_at >= weekAgo).reduce((a, r) => a + r.xp, 0))
        setLastWeekXP(data.filter(r => r.created_at >= twoWeeksAgo && r.created_at < weekAgo).reduce((a, r) => a + r.xp, 0))
      })
    supabase.from('student_xp_log').select('student_id,xp')
      .then(({ data: all }) => {
        if (!all) return
        const byS: Record<string, number> = {}
        all.forEach((r: any) => { byS[r.student_id] = (byS[r.student_id] ?? 0) + r.xp })
        const myXP   = byS[student.id] ?? 0
        const better = Object.values(byS).filter(x => x > myXP).length
        setClassRank({ rank: better + 1, total: Math.max(Object.keys(byS).length, 1) })
      })

    const todayStart = new Date(new Date().setHours(0,0,0,0)).toISOString()
    supabase.from('student_practice_log').select('exercise_id,minutes,practiced_at').eq('student_id', student.id)
      .then(({ data }) => {
        if (!data) return
        const totals: Record<string, number> = {}
        const today: Record<string, number>  = {}
        data.forEach((r: any) => {
          totals[r.exercise_id] = (totals[r.exercise_id] ?? 0) + r.minutes
          if (r.practiced_at >= todayStart) today[r.exercise_id] = (today[r.exercise_id] ?? 0) + r.minutes
        })
        setPracticeTotals(totals); setPracticeToday(today)
      })
  }, [student.id])

  const startTimer = (id: string) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setActiveTimer(id); setTimerStart(Date.now()); setTimerSeconds(0)
    timerRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000)
  }
  const stopTimer = async () => {
    if (!activeTimer || !timerStart) return
    if (timerRef.current) clearInterval(timerRef.current)
    const minutes = Math.max(1, Math.round((Date.now() - timerStart) / 60000))
    const { error: plErr } = await supabase.from('student_practice_log').insert({ student_id: student.id, exercise_id: activeTimer, minutes })
    if (plErr) console.error('Ghi nhật ký luyện tập lỗi:', plErr)
    const { error: xpErr } = await supabase.from('student_xp_log').insert({ student_id: student.id, xp: minutes, source: 'practice', ref_id: activeTimer })
    if (xpErr) console.error('Ghi XP lỗi:', xpErr)
    setPracticeTotals(prev => ({ ...prev, [activeTimer]: (prev[activeTimer] ?? 0) + minutes }))
    setPracticeToday(prev  => ({ ...prev, [activeTimer]: (prev[activeTimer] ?? 0) + minutes }))
    setTotalXP(prev => prev + minutes); setWeekXP(prev => prev + minutes)
    setActiveTimer(null); setTimerStart(null); setTimerSeconds(0)
  }
  const fmtTimer = (s: number) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`

  const name = uname(student)
  const isUnlocked = (tier: string) => TIER_ORDER.indexOf(tier) <= TIER_ORDER.indexOf(LEVEL_TIER[student.level ?? 'beginner'] ?? 'free')
  const mainCourse = enrollments.find(e => e.course?.type === 'hanh_trinh')

  const artistLevel  = ARTIST_LEVELS.find(l => totalXP >= l.min && totalXP < l.max) ?? ARTIST_LEVELS[0]
  const nextLevel    = ARTIST_LEVELS[ARTIST_LEVELS.indexOf(artistLevel) + 1]
  const levelPct     = nextLevel ? Math.round(((totalXP - artistLevel.min) / (nextLevel.min - artistLevel.min)) * 100) : 100
  const weekDiff     = lastWeekXP > 0 ? Math.round(((weekXP - lastWeekXP) / lastWeekXP) * 100) : null
  const rankPct      = classRank ? Math.round((1 - classRank.rank / classRank.total) * 100) : null

  const SONG_STATUS: Record<string, { icon: string; label: string; color: string }> = {
    tempo:    { icon: '🥁', label: 'Tempo',    color: D.accent },
    timing:   { icon: '🎼', label: 'Timing',   color: '#7C3AED' },
    approved: { icon: '✅', label: 'Đã duyệt', color: D.success },
    mastered: { icon: '🏆', label: 'Xong',     color: D.gold },
  }

  const card: React.CSSProperties = { background: D.surface, borderRadius: 12, boxShadow: D.shadow, overflow: 'hidden' }
  const btnPrimary: React.CSSProperties = { background: D.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
  const btnSecondary: React.CSSProperties = { background: 'none', color: D.text2, border: `1px solid ${D.border}`, borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: D.bg, fontFamily: '"Inter", system-ui, sans-serif', color: D.text1, fontSize: 15 }}>

      {/* Sidebar */}
      <aside style={{ width: collapsed ? 52 : 200, flexShrink: 0, background: D.surface, borderRight: `1px solid ${D.border}`, display: 'flex', flexDirection: 'column', transition: 'width .2s', overflow: 'hidden' }}>
        <button onClick={() => setCollapsed(!collapsed)} style={{ padding: 16, background: 'none', border: 'none', cursor: 'pointer', color: D.text3, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start' }}>
          {collapsed ? '→' : '←'}
        </button>
        <nav style={{ flex: 1, padding: '4px 8px' }}>
          {[
            { icon: '⊞', label: 'Trang chủ', active: true },
            { icon: '🎓', label: 'Học kiến thức' },
            { icon: '🎯', label: 'Luyện tập' },
            { icon: '🎵', label: 'My Songs' },
            { icon: '♫',  label: 'Sống cùng âm nhạc' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? 10 : '9px 10px', borderRadius: 8, cursor: 'pointer', background: item.active ? D.accentLight : 'transparent', color: item.active ? D.accent : D.text2, fontWeight: item.active ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', marginBottom: 1, justifyContent: collapsed ? 'center' : 'flex-start' }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
              {!collapsed && <span style={{ fontSize: 14 }}>{item.label}</span>}
            </div>
          ))}
        </nav>
        <div style={{ borderTop: `1px solid ${D.border}`, padding: 8 }}>
          <div onClick={onLogout} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? 10 : '9px 10px', borderRadius: 8, cursor: 'pointer', color: D.text3, justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <span>⎋</span>
            {!collapsed && <span style={{ fontSize: 14 }}>Đăng xuất</span>}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Header */}
        <header style={{ background: D.surface, borderBottom: `1px solid ${D.border}`, padding: '0 24px', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: D.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>🎸</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Thầy Văn Anh Guitar</div>
              <div style={{ fontSize: 11, color: D.text3 }}>Music Learning System</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: artistLevel.color + '15', border: `1px solid ${artistLevel.color}33`, borderRadius: 8, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: artistLevel.color }}>{artistLevel.label}</span>
              <span style={{ fontSize: 12, color: D.text3 }}>· {totalXP.toLocaleString()} XP</span>
            </div>
            <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#C2410C' }}>{weekXP.toLocaleString()}</span>
              <span style={{ fontSize: 12, color: '#92400E' }}>XP tuần này</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px 4px 4px', borderRadius: 8, border: `1px solid ${D.border}`, cursor: 'pointer' }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: D.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: D.accent, fontWeight: 700, overflow: 'hidden' }}>
                {student.avatar_url ? <img src={student.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : name.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{name}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Stats row */}
          <div style={{ ...card, display: 'grid', gridTemplateColumns: '200px 1fr 1fr 1fr' }}>
            <div style={{ padding: '16px 20px', borderRight: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: D.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: D.accent, overflow: 'hidden', flexShrink: 0 }}>
                {student.avatar_url ? <img src={student.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 11, color: D.text3, marginBottom: 2 }}>Xin chào</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{name}</div>
                <div style={{ fontSize: 12, color: D.text3, marginTop: 2 }}>{enrollments.length} khoá · {completedIds.size} bài học</div>
              </div>
            </div>
            <div style={{ padding: '16px 20px', borderRight: `1px solid ${D.border}` }}>
              <div style={{ fontSize: 11, color: D.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Cấp độ nghệ sĩ</div>
              <div style={{ fontWeight: 800, fontSize: 15, color: artistLevel.color, marginBottom: 6 }}>{artistLevel.label}</div>
              <Bar pct={levelPct} color={artistLevel.color} />
              {nextLevel && <div style={{ fontSize: 11, color: D.text3, marginTop: 4 }}>{totalXP.toLocaleString()} / {nextLevel.min.toLocaleString()} XP</div>}
            </div>
            <div style={{ padding: '16px 20px', borderRight: `1px solid ${D.border}` }}>
              <div style={{ fontSize: 11, color: D.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Tuần này</div>
              <div style={{ fontSize: 24, fontWeight: 900 }}>{weekXP.toLocaleString()}<span style={{ fontSize: 12, color: D.text3, fontWeight: 400 }}> XP</span></div>
              {weekDiff !== null && <div style={{ fontSize: 12, fontWeight: 700, color: weekDiff >= 0 ? D.success : '#EF4444', marginTop: 4 }}>{weekDiff >= 0 ? '↑' : '↓'}{Math.abs(weekDiff)}% vs tuần trước</div>}
            </div>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: 11, color: D.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Xếp hạng lớp</div>
              <div style={{ fontSize: 24, fontWeight: 900 }}>{rankPct !== null ? `Top ${100 - rankPct}%` : '—'}</div>
              {classRank && <div style={{ fontSize: 12, color: D.text3, marginTop: 4 }}>#{classRank.rank} / {classRank.total} học sinh</div>}
            </div>
          </div>

          {/* 3 columns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>

            {/* COL 1 — Học */}
            <div style={card}>
              <div style={{ padding: '14px 20px 12px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: D.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}></div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>HỌC KIẾN THỨC</div>
                    <div style={{ fontSize: 11, color: D.text3 }}>Hiểu · Biết · Nắm vững</div>
                  </div>
                </div>
                <span style={{ fontSize: 12, color: D.accent }}>{enrollments.length} khoá</span>
              </div>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${D.border}` }}>
                {mainCourse ? (
                  <>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 9, background: D.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>🎸</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{mainCourse.course?.name}</div>
                        <Bar pct={completedIds.size > 0 ? 30 : 0} />
                      </div>
                    </div>
                    <button onClick={() => window.location.href = '/course?id=' + mainCourse.course_id} style={{ ...btnPrimary, width: '100%', textAlign: 'center' }}>Học ngay →</button>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: 16, color: D.text3, fontSize: 13 }}>Chưa có khoá học</div>
                )}
              </div>
              <div style={{ padding: '10px 20px', maxHeight: 180, overflowY: 'auto' }}>
                {enrollments.map((e, i) => (
                  <div key={e.id} onClick={() => window.location.href = '/course?id=' + e.course_id}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: i > 0 ? `1px solid ${D.borderLight}` : 'none', cursor: 'pointer' }}>
                    <div style={{ width: 26, height: 26, borderRadius: 6, background: D.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>🎸</div>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.course?.name}</div>
                    <span style={{ fontSize: 12, color: D.accent }}>›</span>
                  </div>
                ))}
              </div>
            </div>

            {/* COL 2 — Luyện tập */}
            <div style={card}>
              <div style={{ padding: '14px 20px 12px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: D.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}></div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>HÔM NAY LUYỆN GÌ?</div>
                  <div style={{ fontSize: 11, color: D.text3 }}>Luyện · Thực hành · Tiến bộ</div>
                </div>
              </div>
              <div style={{ padding: '8px 14px', maxHeight: 280, overflowY: 'auto' }}>
                {EXERCISES.map((ex, i) => {
                  const totalMin = practiceTotals[ex.id] ?? 0
                  const todayMin = practiceToday[ex.id] ?? 0
                  const isActive = activeTimer === ex.id
                  return (
                    <div key={ex.id} style={{ padding: '8px 0', borderTop: i > 0 ? `1px solid ${D.borderLight}` : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: ex.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{ex.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{ex.name}</div>
                          <div style={{ fontSize: 11, color: D.text3 }}>
                            <span style={{ color: ex.color, fontWeight: 700 }}>{(totalMin/60).toFixed(1)}h</span>
                            {todayMin > 0 && <span style={{ color: D.success }}> · {todayMin}ph hôm nay</span>}
                          </div>
                        </div>
                        {isActive ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 14, fontWeight: 900, color: ex.color, fontVariantNumeric: 'tabular-nums' }}>{fmtTimer(timerSeconds)}</span>
                            <button onClick={stopTimer} style={{ background: '#EF4444', border: 'none', borderRadius: 7, padding: '4px 10px', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Dừng</button>
                          </div>
                        ) : (
                          <button onClick={() => startTimer(ex.id)} disabled={!!activeTimer}
                            style={{ background: activeTimer ? D.bg : ex.color, border: 'none', borderRadius: 7, padding: '5px 12px', fontSize: 12, fontWeight: 700, color: activeTimer ? D.text3 : '#fff', cursor: activeTimer ? 'default' : 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>▶</button>
                        )}
                      </div>
                      {totalMin > 0 && <div style={{ marginTop: 5 }}><Bar pct={Math.min(100, totalMin / (1000*60) * 100)} color={ex.color} h={2} /></div>}
                    </div>
                  )
                })}
              </div>
              <div style={{ padding: '10px 14px', borderTop: `1px solid ${D.border}` }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                  {dbTools.slice(0, 6).map(t => {
                    const unlocked = isUnlocked(t.tier)
                    return (
                      <div key={t.id} onClick={() => { if (unlocked && t.route) window.location.href = t.route }}
                        style={{ background: unlocked ? D.accentLight : D.bg, border: `1px solid ${D.border}`, borderRadius: 7, padding: '7px 6px', textAlign: 'center', cursor: unlocked ? 'pointer' : 'default', opacity: unlocked ? 1 : .5 }}>
                        <div style={{ fontSize: 14, marginBottom: 2 }}>{t.icon}</div>
                        <div style={{ fontSize: 9, color: D.text2, fontWeight: 500, lineHeight: 1.3 }}>{t.name}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* COL 3 — My Songs + Events */}
            <div style={card}>
              <div style={{ padding: '14px 20px 12px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: D.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}></div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>MY SONGS</div>
                    <div style={{ fontSize: 11, color: D.text3 }}>Hành trình chinh phục</div>
                  </div>
                </div>
                {mySongs.length > 0 && <span style={{ fontSize: 12, color: D.accent }}>{mySongs.length} bài</span>}
              </div>
              <div style={{ padding: '12px 14px', borderBottom: `1px solid ${D.border}`, maxHeight: 220, overflowY: 'auto' }}>
                {mySongs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>🎸</div>
                    <div style={{ fontSize: 13, color: D.text3, marginBottom: 12 }}>Chưa có bài hát nào</div>
                    <button onClick={() => window.location.href = '/tempo'} style={{ ...btnPrimary, fontSize: 13, padding: '7px 16px' }}>🥁 Tap Tempo →</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {mySongs.map(s => {
                      const st = SONG_STATUS[s.status] ?? SONG_STATUS.tempo
                      const STEPS = ['tempo','timing','approved','mastered']
                      return (
                        <div key={s.id} style={{ background: D.bg, borderRadius: 10, padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 16 }}>{st.icon}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                              <div style={{ fontSize: 11, color: D.text3 }}>
                                {s.artist && `${s.artist} · `}
                                {s.tempo && <span style={{ color: st.color, fontWeight: 700 }}>{s.tempo} BPM</span>}
                              </div>
                            </div>
                            <span style={{ fontSize: 9, background: st.color + '15', color: st.color, borderRadius: 6, padding: '2px 7px', fontWeight: 700, flexShrink: 0 }}>{st.label}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 3 }}>
                            {STEPS.map((step, i) => (
                              <div key={step} style={{ flex: 1, height: 3, borderRadius: 99, background: STEPS.indexOf(s.status) >= i ? st.color : D.border }} />
                            ))}
                          </div>
                        </div>
                      )
                    })}
                    <button onClick={() => window.location.href = '/tempo'} style={{ ...btnSecondary, fontSize: 12, padding: 7 }}>+ Thêm bài hát mới</button>
                  </div>
                )}
              </div>
              <div style={{ padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: D.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Sự kiện sắp tới</div>
                <div style={{ fontSize: 12, color: D.text3, textAlign: 'center', padding: '12px 0' }}>Chưa có sự kiện nào</div>
              </div>
            </div>
          </div>

          {/* Bottom stats */}
          <div style={{ ...card, display: 'flex', alignItems: 'center', padding: '14px 24px', gap: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginRight: 28, flexShrink: 0 }}>Thành Quả</div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              {[
                { icon: '', v: mySongs.length,     label: 'bài hát' },
                { icon: '', v: completedIds.size,   label: 'bài đã học' },
                { icon: '', v: totalXP.toLocaleString(), label: 'XP tổng' },
                { icon: '', v: enrollments.length,  label: 'khoá học' },
                { icon: '', v: mySongs.filter(s => s.status === 'mastered').length, label: 'bài thuần thục' },
              ].map((a, i, arr) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: i < arr.length-1 ? 24 : 0, marginRight: i < arr.length-1 ? 24 : 0, borderRight: i < arr.length-1 ? `1px solid ${D.border}` : 'none' }}>
                  <span style={{ fontSize: 17 }}>{a.icon}</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: D.accent }}>{a.v}</span>
                  <span style={{ fontSize: 12, color: D.text3 }}>{a.label}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
