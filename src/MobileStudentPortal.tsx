import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

// ─── Design tokens ────────────────────────────────────────────────────────────
const M = {
  bg:         '#0F0F0F',
  surface:    '#1A1A1A',
  surface2:   '#242424',
  border:     '#2E2E2E',
  accent:     '#4ADE80',   // green
  accentDark: '#16A34A',
  accentBg:   '#052E16',
  gold:       '#FACC15',
  text1:      '#F5F5F5',
  text2:      '#A3A3A3',
  text3:      '#525252',
  danger:     '#F87171',
  blue:       '#60A5FA',
  purple:     '#A78BFA',
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Student { id: string; full_name: string; email: string | null; level: string | null }
interface Enrollment {
  id: string; course_id: string; enrolled_at: string
  course: { id: string; name: string; slug: string; type: string; track: string | null }
}
interface Module { id: string; name: string; order_index: number }
interface Lesson {
  id: string; module_id: string; title: string; lesson_type: string
  content_url: string | null; description: string | null; content: string | null
  tools: string[]; order_index: number
}

function uname(s: Student) {
  const n = s.full_name ?? ''
  if (n.includes('@')) return n.split('@')[0]
  return n.split(' ').pop() ?? n
}
function ytId(url: string) {
  return url?.match(/(?:v=|youtu\.be\/)([^&\s]+)/)?.[1] ?? null
}

// ─── Bottom nav ───────────────────────────────────────────────────────────────
type Tab = 'hoc' | 'tap' | 'song'
const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'hoc',  icon: '🎓', label: 'Học'  },
  { id: 'tap',  icon: '🥁', label: 'Tập'  },
  { id: 'song', icon: '🎸', label: 'Sống' },
]

// ─── Tool list ────────────────────────────────────────────────────────────────
const PRACTICE_TOOLS = [
  { id: 'tap',     icon: '🥁', label: 'Tap nhịp',     sub: 'Luyện cảm nhịp điệu',  color: '#4ADE80', route: '/tap'          },
  { id: 'metro',   icon: '🎵', label: 'Metronome',     sub: 'Đếm nhịp chính xác',   color: '#60A5FA', route: '/tap'          },
  { id: 'backing', icon: '🎧', label: 'Backing Track', sub: 'Đệm nhạc luyện tập',   color: '#A78BFA', route: '/tap'          },
  { id: 'chord',   icon: '🎸', label: 'Luyện hợp âm', sub: 'Xem hợp âm trực quan', color: '#FACC15', route: '/guitarboard'  },
  { id: 'submit',  icon: '📹', label: 'Nộp video',     sub: 'Quay và gửi bài tập',  color: '#F87171', route: '/tap'          },
]

// ─── Screens ──────────────────────────────────────────────────────────────────
type Screen = 'home' | 'courses' | 'lesson'

interface Props { student: Student; onLogout: () => void }

export default function MobileStudentPortal({ student, onLogout }: Props) {
  const [tab, setTab]           = useState<Tab>('hoc')
  const [screen, setScreen]     = useState<Screen>('home')
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [modules, setModules]   = useState<Module[]>([])
  const [lessons, setLessons]   = useState<Lesson[]>([])
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null)
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null)
  const [lessonTab, setLessonTab] = useState<'content' | 'note'>('content')
  const [tapCount, setTapCount] = useState(0)
  const [bpm, setBpm]           = useState(72)
  const tapRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    supabase.from('edu_enrollments')
      .select('id,course_id,enrolled_at,is_active,course:edu_courses(id,name,slug,type,track)')
      .eq('student_id', student.id).eq('is_active', true)
      .then(({ data }) => setEnrollments((data ?? []) as unknown as Enrollment[]))
  }, [student.id])

  const openCourse = async (courseId: string) => {
    setActiveCourseId(courseId)
    const { data: mods } = await supabase.from('edu_modules')
      .select('*').eq('course_id', courseId).order('order_index')
    setModules(mods ?? [])
    if (mods?.length) {
      const { data: lsns } = await supabase.from('edu_course_lessons')
        .select('*').in('module_id', mods.map((m: Module) => m.id)).order('order_index')
      const parsed = (lsns ?? []).map((l: Lesson & { tools?: unknown }) => ({ ...l, tools: Array.isArray(l.tools) ? l.tools : [] }))
      setLessons(parsed)
      if (parsed.length) { setActiveLesson(parsed[0]); setScreen('lesson') }
    }
    setScreen('courses')
  }

  const openLesson = (l: Lesson) => { setActiveLesson(l); setScreen('lesson') }
  const goBack = () => { if (screen === 'lesson') setScreen('courses'); else setScreen('home') }

  const name = uname(student)
  const mainCourse = enrollments.find(e => e.course?.type === 'hanh_trinh')
  const currentLesson = activeLesson

  // ── Tap BPM ─────────────────────────────────────────────────────────────────
  const tapTimes = useRef<number[]>([])
  const handleTap = () => {
    const now = Date.now()
    tapTimes.current.push(now)
    if (tapTimes.current.length > 8) tapTimes.current.shift()
    if (tapTimes.current.length > 1) {
      const diffs = tapTimes.current.slice(1).map((t, i) => t - tapTimes.current[i])
      const avg = diffs.reduce((a, b) => a + b) / diffs.length
      setBpm(Math.round(60000 / avg))
    }
    setTapCount(c => c + 1)
    if (tapRef.current) clearTimeout(tapRef.current)
    tapRef.current = setTimeout(() => { tapTimes.current = []; setTapCount(0) }, 3000)
  }

  // ── Shared UI ────────────────────────────────────────────────────────────────
  const card = (style?: React.CSSProperties): React.CSSProperties => ({
    background: M.surface, borderRadius: 16, padding: '16px',
    border: `1px solid ${M.border}`, ...style,
  })

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', height: '100dvh', display: 'flex', flexDirection: 'column', background: M.bg, fontFamily: '"DM Sans", system-ui, sans-serif', color: M.text1, position: 'relative', overflow: 'hidden' }}>

      {/* ══ CONTENT AREA ══════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>

        {/* ── Tab: HỌC ──────────────────────────────────────────────────────── */}
        {tab === 'hoc' && screen === 'home' && (
          <div style={{ padding: '0 0 16px' }}>
            {/* Header */}
            <div style={{ padding: '52px 20px 20px', background: `linear-gradient(180deg, #0A1A0F 0%, ${M.bg} 100%)` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 13, color: M.text2, marginBottom: 2 }}>Chào mừng trở lại 👋</div>
                  <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em' }}>{name}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: M.surface, border: `1px solid ${M.border}`, borderRadius: 20, padding: '6px 12px' }}>
                  <span style={{ fontSize: 16 }}>🔥</span>
                  <span style={{ fontWeight: 700, fontSize: 15, color: M.gold }}>
                    {Math.max(1, Math.floor(Math.random() * 5 + 1))}
                  </span>
                  <span style={{ fontSize: 11, color: M.text2 }}>ngày</span>
                </div>
              </div>
            </div>

            <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Hôm nay */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: M.text3, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Hôm nay</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {mainCourse ? (
                    <div onClick={() => openCourse(mainCourse.course_id)}
                      style={{ ...card(), display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderColor: M.accent + '30' }}>
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: M.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>▶</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Xem bài học</div>
                        <div style={{ fontSize: 11, color: M.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mainCourse.course?.name}</div>
                      </div>
                      <span style={{ color: M.text3, fontSize: 18 }}>›</span>
                    </div>
                  ) : null}
                  {[
                    { icon: '🥁', label: 'Tap nhịp', sub: 'Thành phố buồn', route: '/tap' },
                    { icon: '📹', label: 'Nộp video', sub: 'Đệm hát 1 - Buổi 3', route: '/tap' },
                  ].map(t => (
                    <div key={t.label} onClick={() => window.location.href = t.route}
                      style={{ ...card(), display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: M.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{t.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{t.label}</div>
                        <div style={{ fontSize: 11, color: M.text2 }}>{t.sub}</div>
                      </div>
                      <span style={{ color: M.text3, fontSize: 18 }}>›</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Progress */}
              <div style={card()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Tiến độ hôm nay</span>
                  <span style={{ fontSize: 13, color: M.accent, fontWeight: 700 }}>60%</span>
                </div>
                <div style={{ height: 8, background: M.surface2, borderRadius: 99 }}>
                  <div style={{ height: '100%', width: '60%', background: M.accent, borderRadius: 99 }} />
                </div>
              </div>

              {/* Hành trình hiện tại */}
              {mainCourse && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: M.text3, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Hành trình hiện tại</div>
                  <div style={{ ...card(), borderColor: M.accent + '40', background: M.accentBg }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: M.accent + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🎸</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: M.accent }}>{mainCourse.course?.name ?? 'Hành Trình'}</div>
                        <div style={{ fontSize: 12, color: M.text2, marginTop: 2 }}>Đệm hát 1 · Buổi 3 / 10</div>
                      </div>
                    </div>
                    <div style={{ height: 6, background: M.surface2, borderRadius: 99, marginBottom: 14 }}>
                      <div style={{ height: '100%', width: '30%', background: M.accent, borderRadius: 99 }} />
                    </div>
                    <button onClick={() => openCourse(mainCourse.course_id)}
                      style={{ width: '100%', background: M.accent, color: '#000', border: 'none', borderRadius: 12, padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '.02em' }}>
                      HỌC NGAY
                    </button>
                  </div>
                </div>
              )}

              {enrollments.length === 0 && (
                <div style={{ ...card(), textAlign: 'center', padding: '32px 20px' }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🌱</div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Hành trình chưa bắt đầu</div>
                  <div style={{ fontSize: 13, color: M.text2, lineHeight: 1.6 }}>Thầy sẽ thêm bạn vào khoá học sau buổi học đầu tiên.</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Course list ───────────────────────────────────────────────────── */}
        {tab === 'hoc' && screen === 'courses' && (
          <div>
            <div style={{ padding: '52px 16px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={goBack} style={{ background: M.surface, border: `1px solid ${M.border}`, borderRadius: 10, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>‹</button>
              <div style={{ fontWeight: 700, fontSize: 18 }}>Danh sách bài học</div>
            </div>
            <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {modules.map(mod => {
                const modLessons = lessons.filter(l => l.module_id === mod.id)
                return (
                  <div key={mod.id}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: M.text3, textTransform: 'uppercase', letterSpacing: '.06em', padding: '12px 4px 8px' }}>{mod.name}</div>
                    {modLessons.map((l, i) => {
                      const icons: Record<string, string> = { video: '▶', text: '📄', slide: '🖼', quiz: '❓', game: '🎮', tap: '🥁', metronome: '🎵', backing_track: '🎧', submit_video: '📹', discussion: '💬', link: '🔗' }
                      return (
                        <div key={l.id} onClick={() => openLesson(l)}
                          style={{ ...card({ marginBottom: 6 }), display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', background: activeLesson?.id === l.id ? M.accentBg : M.surface, borderColor: activeLesson?.id === l.id ? M.accent + '40' : M.border }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: M.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{icons[l.lesson_type] ?? '📄'}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</div>
                          </div>
                          <span style={{ color: M.text3 }}>›</span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
              {lessons.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: M.text2 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                  Khoá học chưa có bài nào
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Lesson viewer ─────────────────────────────────────────────────── */}
        {tab === 'hoc' && screen === 'lesson' && currentLesson && (
          <div>
            {/* Header */}
            <div style={{ padding: '52px 16px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={goBack} style={{ background: M.surface, border: `1px solid ${M.border}`, borderRadius: 10, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, color: M.text1 }}>‹</button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentLesson.title}</div>
              </div>
              <span style={{ fontSize: 20, cursor: 'pointer' }}>♡</span>
            </div>

            {/* Video */}
            {currentLesson.lesson_type === 'video' && ytId(currentLesson.content_url ?? '') && (
              <div style={{ background: '#000', aspectRatio: '16/9' }}>
                <iframe src={`https://www.youtube.com/embed/${ytId(currentLesson.content_url ?? '')}?rel=0`}
                  style={{ width: '100%', height: '100%', border: 'none' }} allowFullScreen />
              </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${M.border}`, padding: '0 16px', gap: 0 }}>
              {(['content', 'note'] as const).map(t => (
                <button key={t} onClick={() => setLessonTab(t)}
                  style={{ flex: 1, background: 'none', border: 'none', borderBottom: `2px solid ${lessonTab === t ? M.accent : 'transparent'}`, padding: '14px 0', fontSize: 13, fontWeight: 600, color: lessonTab === t ? M.accent : M.text3, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {t === 'content' ? 'Nội dung' : 'Ghi chú'}
                </button>
              ))}
            </div>

            {/* Content */}
            <div style={{ padding: '16px' }}>
              {lessonTab === 'content' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {currentLesson.description && (
                    <div style={{ fontSize: 14, color: M.text2, lineHeight: 1.7 }}>{currentLesson.description}</div>
                  )}
                  {currentLesson.content && (
                    <div style={{ fontSize: 14, color: M.text1, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{currentLesson.content}</div>
                  )}
                  {!currentLesson.description && !currentLesson.content && (
                    <div style={{ textAlign: 'center', padding: '20px', color: M.text3 }}>Chưa có nội dung</div>
                  )}

                  {/* Tools */}
                  {currentLesson.tools?.length > 0 && (
                    <div style={card()}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: M.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Công cụ luyện tập</div>
                      {currentLesson.tools.map(toolId => {
                        const t = PRACTICE_TOOLS.find(p => p.id === toolId)
                        if (!t) return null
                        return (
                          <div key={toolId} onClick={() => window.location.href = t.route}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid ' + M.border, cursor: 'pointer' }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: t.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{t.icon}</div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: t.color }}>{t.label}</div>
                              <div style={{ fontSize: 11, color: M.text3 }}>{t.sub}</div>
                            </div>
                            <span style={{ marginLeft: 'auto', color: M.text3 }}>›</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
              {lessonTab === 'note' && (
                <textarea placeholder="Ghi chú của bạn..."
                  style={{ width: '100%', boxSizing: 'border-box', minHeight: 200, background: M.surface, border: `1px solid ${M.border}`, borderRadius: 12, padding: '14px', color: M.text1, fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'none', lineHeight: 1.7 }} />
              )}
            </div>

            {/* Next lesson button */}
            {(() => {
              const idx = lessons.findIndex(l => l.id === currentLesson.id)
              const next = idx < lessons.length - 1 ? lessons[idx + 1] : null
              return (
                <div style={{ padding: '8px 16px 16px' }}>
                  <button onClick={() => next ? openLesson(next) : goBack()}
                    style={{ width: '100%', background: M.accent, color: '#000', border: 'none', borderRadius: 14, padding: '15px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '.02em' }}>
                    {next ? 'TIẾP THEO' : 'HOÀN THÀNH'}
                  </button>
                </div>
              )
            })()}
          </div>
        )}

        {/* ── Tab: TẬP ──────────────────────────────────────────────────────── */}
        {tab === 'tap' && (
          <div style={{ padding: '52px 16px 16px' }}>
            <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 6 }}>Luyện tập</div>
            <div style={{ fontSize: 13, color: M.text2, marginBottom: 24 }}>Chọn công cụ để bắt đầu</div>

            {/* Quick tap */}
            <div style={{ ...card({ marginBottom: 16, borderColor: M.accent + '40', background: M.accentBg }), textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: M.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>🥁 Tap BPM nhanh</div>
              <div style={{ fontSize: 48, fontWeight: 900, color: M.accent, lineHeight: 1, marginBottom: 4 }}>{bpm}</div>
              <div style={{ fontSize: 12, color: M.text2, marginBottom: 16 }}>BPM</div>
              <button onClick={handleTap}
                style={{ width: '100%', background: M.accent, color: '#000', border: 'none', borderRadius: 14, padding: '18px', fontSize: 18, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '.04em', userSelect: 'none' }}>
                TAP
              </button>
              {tapCount > 0 && <div style={{ marginTop: 8, fontSize: 11, color: M.accent }}>Đã tap {tapCount} lần</div>}
            </div>

            {/* Tools grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {PRACTICE_TOOLS.map(t => (
                <div key={t.id} onClick={() => window.location.href = t.route}
                  style={{ ...card({ cursor: 'pointer', padding: '16px 14px' }) }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{t.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.color, marginBottom: 3 }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: M.text3, lineHeight: 1.4 }}>{t.sub}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab: SỐNG ─────────────────────────────────────────────────────── */}
        {tab === 'song' && (
          <div style={{ padding: '52px 16px 16px' }}>
            <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 6 }}>Sống cùng âm nhạc</div>
            <div style={{ fontSize: 13, color: M.text2, marginBottom: 24 }}>Kết nối · Trải nghiệm · Truyền cảm hứng</div>

            {[
              { icon: '📅', label: 'Workshop cuối tuần', sub: 'Chủ nhật, 09/06/2025', color: M.blue   },
              { icon: '🎤', label: 'Open Mic tháng 6',   sub: 'Thứ bảy, 15/06/2025',  color: M.purple },
              { icon: '👥', label: 'Giao lưu học viên',  sub: 'Chủ nhật, 23/06/2025', color: M.accent },
            ].map(e => (
              <div key={e.label} style={{ ...card({ marginBottom: 10 }), display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: e.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{e.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{e.label}</div>
                  <div style={{ fontSize: 12, color: M.text2, marginTop: 2 }}>{e.sub}</div>
                </div>
                <button style={{ background: M.surface2, border: `1px solid ${M.border}`, borderRadius: 8, padding: '6px 12px', color: M.text1, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Tham gia</button>
              </div>
            ))}

            <div style={{ ...card({ marginTop: 20, padding: '24px', textAlign: 'center', borderStyle: 'dashed' }) }}>
              <div style={{ fontSize: 13, color: M.text2, lineHeight: 1.8, fontStyle: 'italic' }}>
                "Bạn không cần phải giỏi ngay từ đầu.<br />Nhưng bạn phải bắt đầu để trở nên giỏi."
              </div>
            </div>

            {/* Profile */}
            <div style={{ ...card({ marginTop: 16 }), display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: M.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: M.accent, fontWeight: 700 }}>
                {name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{name}</div>
                <div style={{ fontSize: 12, color: M.text2 }}>{student.level ?? 'Học viên'}</div>
              </div>
              <button onClick={onLogout}
                style={{ background: 'none', border: `1px solid ${M.border}`, borderRadius: 8, padding: '6px 12px', color: M.text2, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                Đăng xuất
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ══ BOTTOM NAV ════════════════════════════════════════════════════════ */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: M.surface, borderTop: `1px solid ${M.border}`, display: 'flex', padding: '8px 0 max(8px, env(safe-area-inset-bottom))', zIndex: 10 }}>
        {TABS.map(t => (
          <button key={t.id}
            onClick={() => { setTab(t.id); if (t.id === 'hoc') setScreen('home') }}
            style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '6px 0', fontFamily: 'inherit' }}>
            <span style={{ fontSize: 22, filter: tab === t.id ? 'none' : 'grayscale(100%) opacity(40%)' }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? M.accent : M.text3, letterSpacing: '.04em', textTransform: 'uppercase' }}>
              {t.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
