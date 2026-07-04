import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { QuizViewer } from './components/QuizViewer'
import FlowPlayer from './FlowPlayer'
import ElearnLessonView from './elearn/ElearnLessonView'
import { NATIVE_LESSONS } from './elearn/nativeLessons'
import ChordStrumPlayer from './elearn/ChordStrumPlayer'
import { parseStrumConfig, configToSong } from './StrumConfigEditor'
import { missingPrereqs, tenNangLuc, PREREQ } from './hanhtrinh'

const D = {
  bg: '#F4F4F5', surface: '#FFFFFF',
  border: '#E4E4E7', borderLight: '#F0F0F2',
  text1: '#18181B', text2: '#52525B', text3: '#A1A1AA',
  accent: '#4F46E5', accentLight: '#EEF2FF',
  success: '#16A34A', successBg: '#F0FDF4',
  shadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
}

interface Module { id: string; name: string; order_index: number }
interface Lesson {
  id: string; module_id: string; title: string; lesson_type: string
  content_url: string | null; description: string | null; content: string | null
  tools: string[]; order_index: number; is_published: boolean
}
interface Course { id: string; name: string; type: string; code?: string | null }

const TOOL_LABELS: Record<string, { label: string; icon: string; route: string }> = {
  tap:           { label: 'Tap nhịp',      icon: '🥁', route: '/tap'         },
  metronome:     { label: 'Metronome',     icon: '🎵', route: '/tap'         },
  backing_track: { label: 'Backing Track', icon: '🎧', route: '/tap'         },
  submit_video:  { label: 'Nộp video',     icon: '📹', route: '/tap'         },
  chord:         { label: 'Luyện hợp âm', icon: '🎸', route: '/guitarboard' },
  ear:           { label: 'Luyện tai',     icon: '👂', route: '/tap'         },
}

function normalizeCanvaUrl(raw: string): string {
  // Tách src từ HTML block nếu paste cả <iframe> hoặc <div>
  const iframeSrc = raw.match(/src="([^"]*canva\.com[^"]*)"/)
  const s = (iframeSrc?.[1] ?? (raw.trim().startsWith('<') ? '' : raw)).trim()
  if (!s || !s.includes('canva.com')) return raw.trim()
  // Xoá query và fragment
  let base = s.split('?')[0].split('#')[0].replace(/\/+$/, '')
  // Bỏ /watch (gây 403 khi embed)
  base = base.replace(/\/watch(\/.*)?$/, '')
  base = base.replace(/\/+$/, '')
  // Đảm bảo kết thúc /view
  const viewBase = base.endsWith('/view') ? base
    : base.includes('/view') ? base.substring(0, base.lastIndexOf('/view') + 5)
    : base + '/view'
  return viewBase + '?embed'
}


function getYouTubeId(url: string) {
  return url.match(/(?:v=|youtu\.be\/|shorts\/)([^&?\s]+)/)?.[1] ?? null
}

export default function LessonViewerPage() {
  const courseId = new URLSearchParams(window.location.search).get('id')
  const [course, setCourse]   = useState<Course | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [active, setActive]   = useState<Lesson | null>(null)
  const [loading, setLoading] = useState(true)
  const [toolMap, setToolMap] = useState<Record<string, { label: string; icon: string; route: string }>>(TOOL_LABELS)
  const [studentId, setStudentId] = useState('')
  const [studentName, setStudentName] = useState('')
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [ownedCodes, setOwnedCodes] = useState<Set<string>>(new Set()) // mã năng lực học viên đã sở hữu (tính thiếu nền)
  const [htMember, setHtMember] = useState(false) // học viên Hành trình: chặn tuần tự
  const [seqLockNames, setSeqLockNames] = useState<string[]>([]) // tên khoá cấp dưới CHƯA hoàn thành → khoá này bị chặn

  // Bài elearn? → trả về số bài (1..11), ngược lại null
  const elearnNumOf = (l: Lesson | null): number | null => {
    if (!l || l.lesson_type !== 'link' || !l.content_url?.startsWith('/lessons/')) return null
    try {
      const c = typeof l.content === 'string' ? JSON.parse(l.content) : l.content
      return c?.elearn && c?.num ? c.num : null
    } catch { return null }
  }

  // Hoàn thành bài elearn → ghi tiến độ + XP + "đã thực hành" (điểm hành trình)
  // Đánh dấu hoàn thành bài NATIVE (chord, slide…) trên desktop
  const completeNative = (lesson: Lesson) => {
    if (completedIds.has(lesson.id)) return
    setCompletedIds(prev => new Set(prev).add(lesson.id))
    if (!studentId) return
    supabase.from('edu_lesson_progress').upsert({ student_id: studentId, lesson_id: lesson.id, completed: true, completed_at: new Date().toISOString() }, { onConflict: 'student_id,lesson_id' }).then(() => {})
    supabase.from('student_xp_log').insert({ student_id: studentId, xp: 15, reason: 'native:' + (lesson.content_url || '') }).then(() => {})
  }

  const completeElearn = async (lesson: Lesson, lessonNum: number) => {
    if (completedIds.has(lesson.id)) return // đã xong rồi, không cộng lại
    setCompletedIds(prev => new Set(prev).add(lesson.id))
    if (!studentId) return
    supabase.from('edu_lesson_progress').upsert({
      student_id: studentId, lesson_id: lesson.id,
      completed: true, completed_at: new Date().toISOString(),
    }, { onConflict: 'student_id,lesson_id' }).then(() => {})
    supabase.from('student_xp_log').insert({
      student_id: studentId, xp: 10, reason: `elearn:bai${lessonNum}`,
    }).then(() => {})
    // Widget tương tác = đã thực hành → cộng điểm hành trình
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('student_action_logs')
        .insert({ user_id: user.id, action_type: 'practiced_lesson', lesson_id: lesson.id })
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const [{ data: st }, { data: au }] = await Promise.all([
          supabase.from('edu_students').select('id').eq('user_id', data.user.id).single(),
          supabase.from('app_users').select('name').eq('id', data.user.id).single(),
        ])
        if (st?.id) {
          setStudentId(st.id)
          const { data: prog } = await supabase.from('edu_lesson_progress')
            .select('lesson_id').eq('student_id', st.id).eq('completed', true)
          if (prog) setCompletedIds(new Set(prog.map((r: { lesson_id: string }) => r.lesson_id)))
          // Mã năng lực đã sở hữu → tính khoá nền còn thiếu (§6)
          const { data: enr } = await supabase.from('edu_enrollments')
            .select('course:edu_courses(code)').eq('student_id', st.id).eq('is_active', true)
          setOwnedCodes(new Set(((enr ?? []) as any[]).map(e => (e.course?.code || '').trim().toUpperCase()).filter(Boolean)))
          const { data: stRow } = await supabase.from('edu_students').select('ht_member').eq('id', st.id).single()
          setHtMember(!!(stRow as any)?.ht_member)
        }
        if (au?.name) setStudentName(au.name)
      }
    })
  }, [])

  useEffect(() => {
    if (!courseId) return
    const load = async () => {
      const [{ data: c }, { data: mods }] = await Promise.all([
        supabase.from('edu_courses').select('id,name,type,code').eq('id', courseId).single(),
        supabase.from('edu_modules').select('*').eq('course_id', courseId).order('order_index'),
      ])
      setCourse(c)
      setModules(mods ?? [])
      if (mods && mods.length > 0) {
        const { data: lsns } = await supabase.from('edu_course_lessons')
          .select('*').in('module_id', mods.map((m: Module) => m.id)).order('order_index')
        const parsed = (lsns ?? []).map((l: Lesson & { tools?: unknown }) => ({
          ...l, tools: Array.isArray(l.tools) ? l.tools : [],
        }))
        setLessons(parsed)
        if (parsed.length > 0) setActive(parsed[0])
      }
      // Load tool map từ DB
      const { data: toolsData } = await supabase.from('edu_tools').select('id,name,icon,route').eq('enabled', true)
      if (toolsData?.length) {
        const map: Record<string, { label: string; icon: string; route: string }> = { ...TOOL_LABELS }
        toolsData.forEach((t: any) => { map[t.id] = { label: t.name, icon: t.icon, route: t.route } })
        setToolMap(map)
      }
      setLoading(false)
    }
    load()
  }, [courseId])

  // HT: chặn tuần tự — khoá này bị khoá nếu còn mã tiên quyết CHƯA hoàn thành (khoá chưa dựng thì bỏ qua)
  useEffect(() => {
    const code = (course?.code || '').trim().toUpperCase()
    if (!htMember || !studentId || !code || !PREREQ[code]) { setSeqLockNames([]); return }
    const need = PREREQ[code].filter(c => c !== 'NM')
    if (need.length === 0) { setSeqLockNames([]); return }
    ;(async () => {
      const { data: cs } = await supabase.from('edu_courses').select('id,code').in('code', need)
      const idsByCode: Record<string, string[]> = {}
      ;(cs ?? []).forEach((c: any) => { const cc = (c.code || '').trim().toUpperCase(); (idsByCode[cc] ??= []).push(c.id) })
      const courseIds = (cs ?? []).map((c: any) => c.id)
      if (courseIds.length === 0) { setSeqLockNames([]); return }  // chưa dựng khoá nền → không chặn
      const { data: mods } = await supabase.from('edu_modules').select('id,course_id').in('course_id', courseIds)
      const modCourse: Record<string, string> = {}; (mods ?? []).forEach((m: any) => { modCourse[m.id] = m.course_id })
      const modIds = (mods ?? []).map((m: any) => m.id)
      const { data: lsns } = modIds.length
        ? await supabase.from('edu_course_lessons').select('id,module_id').in('module_id', modIds)
        : { data: [] as any[] }
      const lessonsByCourse: Record<string, string[]> = {}
      ;(lsns ?? []).forEach((l: any) => { const cid = modCourse[l.module_id]; if (cid) (lessonsByCourse[cid] ??= []).push(l.id) })
      const { data: prog } = await supabase.from('edu_lesson_progress').select('lesson_id').eq('student_id', studentId).eq('completed', true)
      const done = new Set((prog ?? []).map((r: any) => r.lesson_id))
      const codeDone = (cc: string) => (idsByCode[cc] || []).some(cid => { const ls = lessonsByCourse[cid]; return ls && ls.length > 0 && ls.every(id => done.has(id)) })
      const missing = need.filter(cc => (idsByCode[cc]?.length) && !codeDone(cc))
      setSeqLockNames(missing.map(c => tenNangLuc(c) || c))
    })()
  }, [course, htMember, studentId])

  if (!courseId) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: D.bg, color: D.text3 }}>
      Không tìm thấy khoá học.
    </div>
  )

  if (loading) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: D.bg, color: D.text3 }}>
      Đang tải...
    </div>
  )

  if (seqLockNames.length > 0) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: D.bg, padding: 24 }}>
      <div style={{ maxWidth: 460, textAlign: 'center', background: D.surface, border: `1px solid ${D.border}`, borderRadius: 16, padding: '32px 26px' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <div style={{ fontWeight: 800, fontSize: 19, color: D.text1, marginBottom: 8 }}>Chưa mở khoá này</div>
        <div style={{ fontSize: 14.5, color: D.text3, lineHeight: 1.6 }}>
          Bạn cần hoàn thành <b style={{ color: '#B91C1C' }}>{seqLockNames.join(' · ')}</b> trước. Hành trình học tuần tự — chắc gốc từng cấp rồi mới lên cấp trên.
        </div>
        <a href="/start" style={{ display: 'inline-block', marginTop: 20, background: D.text1, color: D.bg, textDecoration: 'none', borderRadius: 10, padding: '11px 22px', fontSize: 14.5, fontWeight: 700 }}>← Về trang chủ</a>
      </div>
    </div>
  )

  const ytId = active?.content_url ? getYouTubeId(active.content_url) : null
  const tools = active?.tools ?? []

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: D.bg, fontFamily: '"Inter", system-ui, sans-serif', color: D.text1, fontSize: 15 }}>

      {/* ── SIDEBAR: lesson list ─────────────────────────────────────── */}
      <aside style={{ width: 280, flexShrink: 0, background: D.surface, borderRight: `1px solid ${D.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${D.border}` }}>
          <a href="/start" style={{ fontSize: 13, color: D.text3, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10 }}>
            ← Về trang chủ
          </a>
          <div style={{ fontWeight: 700, fontSize: 16, color: D.text1, lineHeight: 1.3 }}>
            {course?.name ?? 'Khoá học'}
          </div>
          <div style={{ fontSize: 13, color: D.text3, marginTop: 4 }}>
            {lessons.length} bài học
          </div>
          {/* ── Cảnh báo thiếu khoá nền tảng (§6) ── */}
          {(() => {
            const miss = missingPrereqs(course?.code, ownedCodes)
            if (miss.length === 0) return null
            const names = miss.map(c => tenNangLuc(c) || c)
            return (
              <div style={{ marginTop: 12, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <div style={{ fontSize: 12, color: '#991B1B', lineHeight: 1.5 }}>
                  <b>Thiếu nền tảng.</b> Bạn chưa học <b>{names.join(' · ')}</b> — nền tảng của khoá này. Nên học bổ sung để theo kịp và chơi vững hơn.
                </div>
              </div>
            )
          })()}
        </div>

        {/* Module + lesson list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {modules.map(mod => {
            const modLessons = lessons.filter(l => l.module_id === mod.id)
            if (modLessons.length === 0) return null
            return (
              <div key={mod.id}>
                <div style={{ padding: '10px 16px 6px', fontSize: 12, fontWeight: 700, color: D.text3, textTransform: 'uppercase', letterSpacing: '.05em', background: D.bg }}>
                  {mod.name}
                </div>
                {modLessons.map((l, i) => {
                  const isActive = active?.id === l.id
                  const typeIcon: Record<string, string> = { video: '▶', text: '📄', slide: '🖼', quiz: '❓', game: '🎮', tap: '🥁', metronome: '🎵', backing_track: '🎧', submit_video: '📹', discussion: '💬', link: '🔗' }
                  return (
                    <div key={l.id} onClick={() => setActive(l)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', background: isActive ? D.accentLight : 'transparent', borderLeft: `3px solid ${isActive ? D.accent : 'transparent'}`, transition: 'background .1s' }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = D.bg }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
                      <span style={{ fontSize: 13, flexShrink: 0, width: 18, textAlign: 'center' }}>{typeIcon[l.lesson_type] ?? '📄'}</span>
                      <span style={{ fontSize: 14, flex: 1, color: isActive ? D.accent : D.text1, fontWeight: isActive ? 600 : 400, lineHeight: 1.4 }}>
                        {l.title}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}

          {lessons.length === 0 && (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: D.text3, fontSize: 14 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📚</div>
              Khoá học chưa có bài nào.
            </div>
          )}
        </div>
      </aside>

      {/* ── ELEARN: trình chiếu bài native (fullscreen overlay) ──────── */}
      {active && elearnNumOf(active) != null && (() => {
        const lesson = active
        const n = elearnNumOf(active)!
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#F6F2EA' }}>
            <ElearnLessonView
              key={lesson.id}
              num={n}
              title={lesson.title}
              studentName={studentName}
              isDone={completedIds.has(lesson.id)}
              onBack={() => setActive(null)}
              onComplete={() => { completeElearn(lesson, n); setActive(null) }}
              onOpenTool={(tool) => window.open((tool === 'tuner' ? '/tuner' : '/tempo') + '?embedded=1', '_blank')}
            />
          </div>
        )
      })()}

      {/* ── BÀI NATIVE (chord, slide…) — overlay full màn, dùng chung với app ── */}
      {active && active.lesson_type === 'native' && NATIVE_LESSONS[active.content_url ?? ''] && (() => {
        const C = NATIVE_LESSONS[active.content_url!].Component
        return <C onClose={() => setActive(null)} onComplete={() => completeNative(active)} studentId={studentId} lessonId={active.id} />
      })()}

      {/* ── BÀI STRUM SCORE — overlay full màn ── */}
      {active && active.lesson_type === 'strum' && (
        <ChordStrumPlayer song={configToSong(parseStrumConfig(active.content), active.title)} onClose={() => setActive(null)} onComplete={() => completeNative(active)} studentId={studentId} lessonId={active.id} />
      )}

      {/* ── MAIN: lesson content (ẩn khi bài elearn/native — overlay đã phủ kín) ─ */}
      <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        {active && (elearnNumOf(active) != null || active.lesson_type === 'native' || active.lesson_type === 'strum') ? null : !active ? (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: D.text3, flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 40 }}>👈</span>
            <div>Chọn bài học từ danh sách</div>
          </div>
        ) : active.lesson_type === 'flow' ? (
          <div style={{ maxWidth: 480, margin: '0 auto', padding: '0' }}>
            <FlowPlayer
              lessonId={active.id}
              studentId={studentId}
              onComplete={() => {}}
              onBack={() => window.history.back()}
              onOpenTool={(tool) => window.open('/' + (tool === 'tempo' ? 'tempo' : tool === 'guitarboard' ? 'guitarboard' : 'tuner') + '?embedded=1', '_blank')}
            />
          </div>
        ) : (
          <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 32px 60px' }}>

            {/* Lesson title */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: D.text1, lineHeight: 1.3, marginBottom: 6 }}>
                {active.title}
              </div>
              {active.description && (
                <div style={{ fontSize: 15, color: D.text2, lineHeight: 1.7 }}>
                  {active.description}
                </div>
              )}
            </div>

            {/* YouTube embed */}
            {ytId && (
              <div style={{ borderRadius: 12, overflow: 'hidden', background: '#000', marginBottom: 24, aspectRatio: '16/9' }}>
                <iframe
                  src={`https://www.youtube.com/embed/${ytId}?rel=0`}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            )}

            {/* No video placeholder */}
            {!ytId && active.lesson_type === 'video' && (
              <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: '40px', textAlign: 'center', marginBottom: 24, color: D.text3 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎬</div>
                <div>Video chưa được thêm vào bài học này.</div>
              </div>
            )}

            {/* Slide Canva embed */}
            {active.lesson_type === 'slide' && active.content_url && (() => {
              const sIdx  = lessons.findIndex(l => l.id === active.id)
              const prevL = sIdx > 0 ? lessons[sIdx - 1] : null
              const nextL = sIdx < lessons.length - 1 ? lessons[sIdx + 1] : null
              const embedUrl = normalizeCanvaUrl(active.content_url)
              return (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ position: 'relative', paddingBottom: '62.5%', borderRadius: 12, overflow: 'hidden', background: '#1a1a2e', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>
                    <iframe
                      key={embedUrl}
                      src={embedUrl}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                      allowFullScreen allow="fullscreen"
                      title={active.title}
                    />
                  </div>
                  {/* Nav + fullscreen row */}
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => prevL && setActive(prevL)} disabled={!prevL}
                      style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${D.border}`, background: D.surface, color: D.text2, fontSize: 14, fontWeight: 600, cursor: prevL ? 'pointer' : 'default', fontFamily: 'inherit', opacity: prevL ? 1 : 0.35 }}>
                      ← Bài trước
                    </button>
                    <div style={{ flex: 1 }} />
                    <a href={active.content_url} onClick={(e) => { e.preventDefault(); window.open(embedUrl, '_blank') }} rel="noreferrer"
                      style={{ fontSize: 13, color: D.accent, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                      🔗 Toàn màn hình ↗
                    </a>
                    <div style={{ flex: 1 }} />
                    <button onClick={() => nextL && setActive(nextL)} disabled={!nextL}
                      style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: nextL ? D.accent : D.border, color: '#fff', fontSize: 14, fontWeight: 700, cursor: nextL ? 'pointer' : 'default', fontFamily: 'inherit', opacity: nextL ? 1 : 0.35 }}>
                      Bài tiếp →
                    </button>
                  </div>
                </div>
              )
            })()}

            {/* External URL embed */}
            {active.lesson_type === 'link' && active.content_url && (
              <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 24, border: `1px solid ${D.border}` }}>
                <div style={{ background: D.surface, padding: '10px 16px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15 }}>🔗</span>
                  <span style={{ fontSize: 13, color: D.text2 }}>{active.content_url}</span>
                  <a href={active.content_url} onClick={(e) => { e.preventDefault(); window.open((e.currentTarget as HTMLAnchorElement).href, '_system') }} rel="noreferrer"
                    style={{ marginLeft: 'auto', fontSize: 12, color: D.accent, textDecoration: 'none' }}>
                    Mở tab mới ↗
                  </a>
                </div>
                <iframe
                  src={active.content_url}
                  style={{ width: '100%', height: '80vh', border: 'none', display: 'block' }}
                  allow="microphone; camera"
                  title={active.title}
                />
              </div>
            )}
{active.lesson_type === 'quiz' && (
              <QuizViewer
                lessonId={active.id}
                studentId={studentId}
                quizData={(() => { try { return typeof active.content === 'string' ? JSON.parse(active.content) : active.content } catch { return null } })()}
              />
            )}
            {/* Content — KHÔNG đổ với quiz (content là JSON, đã render qua QuizViewer ở trên) */}
            {active.lesson_type !== 'quiz' && active.content && (
              <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: D.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
                  Nội dung bài học
                </div>
                <div style={{ fontSize: 15, color: D.text2, lineHeight: 1.8 }}
                  className="rich-content"
                  dangerouslySetInnerHTML={{ __html: active.content }} />
              </div>
            )}

            {/* Tools */}
            {tools.length > 0 && (
              <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: D.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>
                  Công cụ luyện tập
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {tools.map(toolId => {
                    const t = toolMap[toolId]
                    if (!t) return null
                    return (
                      <a key={toolId} href={t.route}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: D.accentLight, border: `1px solid ${D.accent}20`, borderRadius: 10, color: D.accent, fontWeight: 600, fontSize: 14, textDecoration: 'none', transition: 'background .1s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#E0E7FF')}
                        onMouseLeave={e => (e.currentTarget.style.background = D.accentLight)}>
                        <span style={{ fontSize: 18 }}>{t.icon}</span>
                        {t.label}
                      </a>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, paddingTop: 8 }}>
              {(() => {
                const idx = lessons.findIndex(l => l.id === active.id)
                const prev = idx > 0 ? lessons[idx - 1] : null
                const next = idx < lessons.length - 1 ? lessons[idx + 1] : null
                return (
                  <>
                    {prev ? (
                      <button onClick={() => setActive(prev)}
                        style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: '10px 18px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: D.text2, display: 'flex', alignItems: 'center', gap: 6 }}>
                        ← {prev.title}
                      </button>
                    ) : <div />}
                    {next && (
                      <button onClick={() => setActive(next)}
                        style={{ background: D.accent, border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {next.title} →
                      </button>
                    )}
                  </>
                )
              })()}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
