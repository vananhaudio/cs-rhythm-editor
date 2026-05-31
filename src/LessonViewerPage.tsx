import { useState, useEffect } from 'react'
import { supabase } from './supabase'

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
interface Course { id: string; name: string; type: string }

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
  return url.match(/(?:v=|youtu\.be\/)([^&\s]+)/)?.[1] ?? null
}

export default function LessonViewerPage() {
  const courseId = new URLSearchParams(window.location.search).get('id')
  const [course, setCourse]   = useState<Course | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [active, setActive]   = useState<Lesson | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!courseId) return
    const load = async () => {
      const [{ data: c }, { data: mods }] = await Promise.all([
        supabase.from('edu_courses').select('id,name,type').eq('id', courseId).single(),
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
      setLoading(false)
    }
    load()
  }, [courseId])

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

  const ytId = active?.content_url ? getYouTubeId(active.content_url) : null
  const tools = active?.tools ?? []

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: D.bg, fontFamily: '"Inter", system-ui, sans-serif', color: D.text1, fontSize: 14 }}>

      {/* ── SIDEBAR: lesson list ─────────────────────────────────────── */}
      <aside style={{ width: 280, flexShrink: 0, background: D.surface, borderRight: `1px solid ${D.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${D.border}` }}>
          <a href="/start" style={{ fontSize: 12, color: D.text3, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10 }}>
            ← Về trang chủ
          </a>
          <div style={{ fontWeight: 700, fontSize: 15, color: D.text1, lineHeight: 1.3 }}>
            {course?.name ?? 'Khoá học'}
          </div>
          <div style={{ fontSize: 12, color: D.text3, marginTop: 4 }}>
            {lessons.length} bài học
          </div>
        </div>

        {/* Module + lesson list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {modules.map(mod => {
            const modLessons = lessons.filter(l => l.module_id === mod.id)
            if (modLessons.length === 0) return null
            return (
              <div key={mod.id}>
                <div style={{ padding: '10px 16px 6px', fontSize: 11, fontWeight: 700, color: D.text3, textTransform: 'uppercase', letterSpacing: '.05em', background: D.bg }}>
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
                      <span style={{ fontSize: 12, flexShrink: 0, width: 18, textAlign: 'center' }}>{typeIcon[l.lesson_type] ?? '📄'}</span>
                      <span style={{ fontSize: 13, flex: 1, color: isActive ? D.accent : D.text1, fontWeight: isActive ? 600 : 400, lineHeight: 1.4 }}>
                        {l.title}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}

          {lessons.length === 0 && (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: D.text3, fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📚</div>
              Khoá học chưa có bài nào.
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN: lesson content ─────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        {!active ? (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: D.text3, flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 40 }}>👈</span>
            <div>Chọn bài học từ danh sách</div>
          </div>
        ) : (
          <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 32px 60px' }}>

            {/* Lesson title */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: D.text1, lineHeight: 1.3, marginBottom: 6 }}>
                {active.title}
              </div>
              {active.description && (
                <div style={{ fontSize: 14, color: D.text2, lineHeight: 1.7 }}>
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
            {active.lesson_type === 'slide' && active.content_url && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ position: 'relative', paddingBottom: '56.25%', borderRadius: 12, overflow: 'hidden', background: '#1a1a2e', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>
                  <iframe
                    src={normalizeCanvaUrl(active.content_url)}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                    allowFullScreen
                    allow="fullscreen"
                    title={active.title}
                  />
                </div>
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                  <a href={active.content_url} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: D.accent, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                    🔗 Mở toàn màn hình ↗
                  </a>
                </div>
              </div>
            )}

            {/* External URL embed */}
            {active.lesson_type === 'link' && active.content_url && (
              <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 24, border: `1px solid ${D.border}` }}>
                <div style={{ background: D.surface, padding: '10px 16px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>🔗</span>
                  <span style={{ fontSize: 12, color: D.text2 }}>{active.content_url}</span>
                  <a href={active.content_url} target="_blank" rel="noreferrer"
                    style={{ marginLeft: 'auto', fontSize: 11, color: D.accent, textDecoration: 'none' }}>
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

            {/* Content */}
            {active.content && (
              <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: D.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
                  📝 Nội dung bài học
                </div>
                <div style={{ fontSize: 14, color: D.text2, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                  {active.content}
                </div>
              </div>
            )}

            {/* Tools */}
            {tools.length > 0 && (
              <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: D.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>
                  🛠 Công cụ luyện tập
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {tools.map(toolId => {
                    const t = TOOL_LABELS[toolId]
                    if (!t) return null
                    return (
                      <a key={toolId} href={t.route}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: D.accentLight, border: `1px solid ${D.accent}20`, borderRadius: 10, color: D.accent, fontWeight: 600, fontSize: 13, textDecoration: 'none', transition: 'background .1s' }}
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
                        style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: '10px 18px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: D.text2, display: 'flex', alignItems: 'center', gap: 6 }}>
                        ← {prev.title}
                      </button>
                    ) : <div />}
                    {next && (
                      <button onClick={() => setActive(next)}
                        style={{ background: D.accent, border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
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
