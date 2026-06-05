import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import RichEditor from './RichEditor'

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: '#F7F7F8', surface: '#FFFFFF', surfaceHover: '#FAFAFA',
  border: '#E4E4E7', borderLight: '#F0F0F2',
  text1: '#18181B', text2: '#52525B', text3: '#A1A1AA',
  accent: '#4F46E5', accentLight: '#EEF2FF',
  success: '#16A34A', successBg: '#F0FDF4',
  danger: '#DC2626', dangerBg: '#FEF2F2',
  shadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Course { id: string; name: string; slug: string; type: string; track: string | null; is_published: boolean; icon?: string | null; image_url?: string | null }
interface Module  { id: string; course_id: string; name: string; order_index: number; description: string | null }
interface Lesson  {
  id: string; module_id: string; title: string; lesson_type: string
  content_url: string | null; description: string | null; content: string | null
  tools: string[]; order_index: number; duration_min: number | null
}

const LESSON_TYPES = [
  { id: 'video',         icon: '▶', label: 'Video'         },
  { id: 'text',          icon: '📄', label: 'Văn bản'      },
  { id: 'slide',         icon: '🖼', label: 'Slide'        },
  { id: 'quiz',          icon: '❓', label: 'Quiz'         },
  { id: 'game',          icon: '🎮', label: 'Game'         },
  { id: 'tap',           icon: '🥁', label: 'Tap nhịp'     },
  { id: 'metronome',     icon: '🎵', label: 'Metronome'    },
  { id: 'backing_track', icon: '🎧', label: 'Backing Track'},
  { id: 'submit_video',  icon: '📹', label: 'Nộp video'    },
  { id: 'discussion',    icon: '💬', label: 'Thảo luận'    },
  { id: 'link',          icon: '🔗', label: 'Link ngoài'   },
]

const TOOLS = [
  { id: 'tap',           label: 'Tap nhịp',     icon: '🥁' },
  { id: 'metronome',     label: 'Metronome',    icon: '🎵' },
  { id: 'backing_track', label: 'Backing Track',icon: '🎧' },
  { id: 'submit_video',  label: 'Nộp video',    icon: '📹' },
  { id: 'chord',         label: 'Luyện hợp âm', icon: '🎸' },
  { id: 'ear',           label: 'Luyện tai',    icon: '👂' },
]

const TOOL_META: Record<string, { label: string; icon: string }> = Object.fromEntries(
  TOOLS.map(t => [t.id, { label: t.label, icon: t.icon }])
)
const TYPE_ICON: Record<string, string> = Object.fromEntries(LESSON_TYPES.map(t => [t.id, t.icon]))

function getYouTubeId(url: string) {
  return url.match(/(?:v=|youtu\.be\/)([^&\s]+)/)?.[1] ?? null
}

// Canva: tách src từ <iframe> nếu có, rồi đảm bảo URL dạng .../view?embed
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

// ─── Markdown → HTML (lightweight) ───────────────────────────────────────────

// ─── Lesson Preview (student view) ───────────────────────────────────────────
function LessonPreview({ lesson }: { lesson: Lesson }) {
  const ytId = lesson.content_url ? getYouTubeId(lesson.content_url) : null
  return (
    <div style={{ background: C.bg, height: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: C.accentLight, border: `1px solid ${C.accent}20`, borderRadius: 20, padding: '4px 12px', marginBottom: 16, fontSize: 12, color: C.accent, fontWeight: 600 }}>
          <span>{TYPE_ICON[lesson.lesson_type] ?? '📄'}</span>
          {LESSON_TYPES.find(t => t.id === lesson.lesson_type)?.label ?? lesson.lesson_type}
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: C.text1, lineHeight: 1.3, marginBottom: 8 }}>
          {lesson.title || 'Chưa có tiêu đề'}
        </div>
        {lesson.description && (
          <div style={{ fontSize: 15, color: C.text2, lineHeight: 1.7, marginBottom: 20 }}>
            {lesson.description}
          </div>
        )}
        {ytId && (
          <div style={{ borderRadius: 12, overflow: 'hidden', background: '#000', marginBottom: 24, aspectRatio: '16/9' }}>
            <iframe src={`https://www.youtube.com/embed/${ytId}?rel=0`} style={{ width: '100%', height: '100%', border: 'none' }} allowFullScreen />
          </div>
        )}
        {lesson.lesson_type === 'slide' && lesson.content_url && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ position: 'relative', paddingBottom: '56.25%', borderRadius: 12, overflow: 'hidden', background: '#1a1a2e', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>
              <iframe
                src={lesson.content_url}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                allowFullScreen
                allow="fullscreen"
                title={lesson.title}
              />
            </div>
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
              <a href={lesson.content_url} target="_blank" rel="noreferrer"
                style={{ fontSize: 12, color: C.accent, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                🔗 Mở toàn màn hình ↗
              </a>
            </div>
          </div>
        )}
        {lesson.lesson_type === 'link' && lesson.content_url && (
          <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 24, border: `1px solid ${C.border}` }}>
            <div style={{ background: C.surface, padding: '10px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🔗</span>
              <span style={{ fontSize: 12, color: C.text2, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lesson.content_url}</span>
            </div>
            <iframe src={lesson.content_url} style={{ width: '100%', height: 400, border: 'none', display: 'block' }} />
          </div>
        )}
        {lesson.content && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14 }}>📝 Nội dung bài học</div>
            <div className="rich-preview" style={{ fontSize: 14, color: C.text2, lineHeight: 1.8 }} dangerouslySetInnerHTML={{ __html: lesson.content }} />
          </div>
        )}
        {lesson.tools.length > 0 && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14 }}>🛠 Công cụ luyện tập</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {lesson.tools.map(tid => {
                const t = TOOL_META[tid]; if (!t) return null
                return (
                  <div key={tid} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: C.accentLight, border: `1px solid ${C.accent}30`, borderRadius: 10, color: C.accent, fontWeight: 600, fontSize: 13 }}>
                    <span style={{ fontSize: 18 }}>{t.icon}</span>{t.label}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
const Input = ({ value, onChange, placeholder, style }: { value: string; onChange: (v: string) => void; placeholder?: string; style?: React.CSSProperties }) => (
  <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, color: C.text1, fontFamily: 'inherit', outline: 'none', ...style }}
    onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
    onBlur={e => (e.currentTarget.style.borderColor = C.border)} />
)

const Textarea = ({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) => (
  <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, color: C.text1, fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.6 }}
    onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
    onBlur={e => (e.currentTarget.style.borderColor = C.border)} />
)

const Label = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 12, fontWeight: 600, color: C.text2, marginBottom: 6 }}>{children}</div>
)

const Btn = ({ children, onClick, variant = 'ghost', style }: { children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; style?: React.CSSProperties }) => {
  const base: React.CSSProperties = { border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }
  const variants = {
    primary:   { background: C.accent, color: '#fff' },
    secondary: { background: C.surface, color: C.text2, border: `1px solid ${C.border}` },
    ghost:     { background: 'transparent', color: C.text2 },
    danger:    { background: C.dangerBg, color: C.danger, border: `1px solid #FECACA` },
  }
  return <button onClick={onClick} style={{ ...base, ...variants[variant], ...style }}>{children}</button>
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function CourseEditorContent() {
  const [courses, setCourses]             = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [modules, setModules]             = useState<Module[]>([])
  const [lessons, setLessons]             = useState<Lesson[]>([])
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null)
  const [saving, setSaving]               = useState(false)
  const [saved, setSaved]                 = useState(false)
  const [newModuleName, setNewModuleName] = useState('')
  const [addingModule, setAddingModule]   = useState(false)
  const [popupModuleId, setPopupModuleId] = useState<string | null>(null)
  const [editingModuleId, setEditingModuleId]   = useState<string | null>(null)
  const [editingModuleName, setEditingModuleName] = useState('')
  const [editingCourseName, setEditingCourseName] = useState(false)
  const [courseNameDraft, setCourseNameDraft]     = useState('')
  const [showLogoPicker, setShowLogoPicker] = useState(false)
  const [uploadingLogo, setUploadingLogo]   = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting]   = useState(false)
  const [importMsg, setImportMsg]   = useState('')
  const logoFileRef = useRef<HTMLInputElement>(null)
  const [showNewCourse, setShowNewCourse] = useState(false)
  const [ncName,  setNcName]  = useState('')
  const [ncType,  setNcType]  = useState('hanh_trinh')
  const [ncTrack, setNcTrack] = useState('dem_hat')
  const [rightMode, setRightMode] = useState<'edit' | 'preview'>('edit')

  // ── Drag state ──
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const dragSrcRef = useRef<{ id: string; moduleId: string } | null>(null)

  // ── Form state ──
  const [fTitle,   setFTitle]   = useState('')
  const [fType,    setFType]    = useState('video')
  const [fUrl,     setFUrl]     = useState('')
  const [fDesc,    setFDesc]    = useState('')
  const [fContent, setFContent] = useState('')
  const [fTools,   setFTools]   = useState<string[]>([])
  const [dbTools,  setDbTools]  = useState<{ id: string; name: string; icon: string }[]>([])

  const previewLesson: Lesson | null = selectedLesson
    ? { ...selectedLesson, title: fTitle, lesson_type: fType, content_url: fUrl || null, description: fDesc || null, content: fContent || null, tools: fTools }
    : null

  // ── Load ──
  useEffect(() => {
    supabase.from('edu_courses').select('id,name,slug,type,track,is_published,icon,image_url')
      .order('track').order('level_order')
      .then(({ data }) => setCourses(data ?? []))
    supabase.from('edu_tools').select('id,name,icon').eq('enabled', true).order('order_index')
      .then(({ data }) => { if (data?.length) setDbTools(data.map((t: any) => ({ id: t.id, name: t.name, icon: t.icon }))) })
  }, [])

  const loadCourse = useCallback(async (course: Course) => {
    setSelectedCourse(course); setSelectedLesson(null)
    const { data: mods } = await supabase.from('edu_modules').select('*').eq('course_id', course.id).order('order_index')
    setModules(mods ?? [])
    if (mods && mods.length > 0) {
      const { data: lsns } = await supabase.from('edu_course_lessons')
        .select('*').in('module_id', mods.map((m: Module) => m.id)).order('order_index')
      setLessons((lsns ?? []).map((l: Lesson & { tools?: unknown }) => ({ ...l, tools: Array.isArray(l.tools) ? l.tools : [] })))
    } else setLessons([])
  }, [])

  const selectLesson = (lesson: Lesson) => {
    setSelectedLesson(lesson)
    setFTitle(lesson.title ?? '')
    setFType(lesson.lesson_type ?? 'video')
    setFUrl(lesson.content_url ?? '')
    setFDesc(lesson.description ?? '')
    setFContent(lesson.content ?? '')
    setFTools(Array.isArray(lesson.tools) ? lesson.tools : [])
    setRightMode('edit')
  }

  const saveLesson = async () => {
    if (!selectedLesson) return
    setSaving(true)
    const saveUrl = fType === 'slide' && fUrl ? normalizeCanvaUrl(fUrl) : (fUrl || null)
    await supabase.from('edu_course_lessons').update({ title: fTitle, lesson_type: fType, content_url: saveUrl, description: fDesc || null, content: fContent || null, tools: fTools }).eq('id', selectedLesson.id)
    const patch = { title: fTitle, lesson_type: fType, content_url: saveUrl, description: fDesc, content: fContent, tools: fTools }
    setLessons(prev => prev.map(l => l.id === selectedLesson.id ? { ...l, ...patch } : l))
    setSelectedLesson(prev => prev ? { ...prev, ...patch } : prev)
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const saveCourseName = async () => {
    if (!selectedCourse || !courseNameDraft.trim()) return
    await supabase.from('edu_courses').update({ name: courseNameDraft }).eq('id', selectedCourse.id)
    const updated = { ...selectedCourse, name: courseNameDraft }
    setSelectedCourse(updated)
    setCourses(prev => prev.map(c => c.id === selectedCourse.id ? { ...c, name: courseNameDraft } : c))
    setEditingCourseName(false)
  }

  // ── Logo khoá học ──
  const setCourseLogo = async (patch: { icon?: string | null; image_url?: string | null }) => {
    if (!selectedCourse) return
    await supabase.from('edu_courses').update(patch).eq('id', selectedCourse.id)
    const updated = { ...selectedCourse, ...patch }
    setSelectedCourse(updated)
    setCourses(prev => prev.map(c => c.id === selectedCourse.id ? { ...c, ...patch } : c))
  }
  const pickEmoji = async (emoji: string) => {
    await setCourseLogo({ icon: emoji, image_url: null })
    setShowLogoPicker(false)
  }
  const uploadLogo = async (file: File) => {
    if (!selectedCourse) return
    setUploadingLogo(true)
    try {
      const ext = file.name.split('.').pop() || 'png'
      const path = `${selectedCourse.id}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('course-logos').upload(path, file, { upsert: true })
      if (upErr) { alert('Lỗi tải ảnh: ' + upErr.message); setUploadingLogo(false); return }
      const { data: pub } = supabase.storage.from('course-logos').getPublicUrl(path)
      await setCourseLogo({ image_url: pub.publicUrl, icon: null })
      setShowLogoPicker(false)
    } catch (e: any) {
      alert('Lỗi: ' + (e?.message ?? e))
    }
    setUploadingLogo(false)
  }
  const courseLogoEmoji = (c: { type: string; icon?: string | null }) => c.icon || (c.type === 'canh_cua' ? '🔑' : '🎸')

  const createCourse = async () => {
    if (!ncName.trim()) return
    const slug = ncName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now()
    const { data, error } = await supabase.from('edu_courses').insert({ name: ncName.trim(), slug, type: ncType, track: ncTrack, level_order: 99, is_free: false, is_published: false }).select('*').single()
    if (error) { alert('Lỗi: ' + error.message); return }
    if (data) { setCourses(prev => [...prev, data]); setShowNewCourse(false); setNcName(''); loadCourse(data) }
  }

  const saveModuleName = async (moduleId: string) => {
    if (!editingModuleName.trim()) return
    await supabase.from('edu_modules').update({ name: editingModuleName }).eq('id', moduleId)
    setModules(prev => prev.map(m => m.id === moduleId ? { ...m, name: editingModuleName } : m))
    setEditingModuleId(null)
  }

  const addLesson = async (moduleId: string, type: string) => {
    const count = lessons.filter(l => l.module_id === moduleId).length
    const { data, error } = await supabase.from('edu_course_lessons').insert({ module_id: moduleId, title: `Bài ${count + 1}: (Chưa đặt tên)`, lesson_type: type, order_index: count, tools: [] }).select('*').single()
    if (error) { alert('Lỗi: ' + error.message); return }
    if (data) { const nl = { ...data, tools: [] }; setLessons(prev => [...prev, nl]); selectLesson(nl) }
  }

  const addModule = async () => {
    if (!selectedCourse || !newModuleName.trim()) return
    const { data } = await supabase.from('edu_modules').insert({ course_id: selectedCourse.id, name: newModuleName.trim(), order_index: modules.length }).select('*').single()
    if (data) { setModules(prev => [...prev, data]); setNewModuleName(''); setAddingModule(false) }
  }

  // Phân tích dàn bài: dòng "#" = chương; dòng khác = bài ("Tên | url" tuỳ chọn)
  const parseOutline = (text: string) => {
    const mods: { name: string; lessons: { title: string; lesson_type: string; content_url: string | null }[] }[] = []
    let cur: typeof mods[0] | null = null
    for (const raw of text.split('\n')) {
      const line = raw.trim()
      if (!line) continue
      if (line.startsWith('#')) {
        cur = { name: line.replace(/^#+\s*/, '').trim() || `Chương ${mods.length + 1}`, lessons: [] }
        mods.push(cur); continue
      }
      if (!cur) { cur = { name: 'Chương 1', lessons: [] }; mods.push(cur) }
      const parts = line.replace(/^[-*•]\s*/, '').split('|').map(p => p.trim())
      const title = parts[0] || '(Chưa đặt tên)'
      const url = parts.slice(1).find(p => /^https?:\/\//i.test(p)) ?? null
      const explicitType = parts.slice(1).find(p => LESSON_TYPES.some(t => t.id === p))
      let lesson_type = explicitType ?? 'text'
      if (!explicitType && url) lesson_type = getYouTubeId(url) ? 'video' : 'link'
      cur.lessons.push({ title, lesson_type, content_url: url })
    }
    return mods
  }

  const bulkImport = async () => {
    if (!selectedCourse || !importText.trim()) return
    const parsed = parseOutline(importText)
    if (parsed.length === 0) { setImportMsg('Không nhận diện được nội dung.'); return }
    const totalLessons = parsed.reduce((a, m) => a + m.lessons.length, 0)
    setImporting(true); setImportMsg('')
    try {
      let modOrder = modules.length
      const newMods: Module[] = []
      const newLsns: Lesson[] = []
      for (const m of parsed) {
        const { data: mod, error: me } = await supabase.from('edu_modules')
          .insert({ course_id: selectedCourse.id, name: m.name, order_index: modOrder++ })
          .select('*').single()
        if (me || !mod) throw new Error(me?.message ?? 'Lỗi tạo chương')
        newMods.push(mod)
        if (m.lessons.length) {
          const rows = m.lessons.map((l, i) => ({
            module_id: mod.id, title: l.title, lesson_type: l.lesson_type,
            content_url: l.content_url, order_index: i, tools: [],
          }))
          const { data: lsns, error: le } = await supabase.from('edu_course_lessons').insert(rows).select('*')
          if (le) throw new Error(le.message)
          newLsns.push(...(lsns ?? []).map((l: Lesson & { tools?: unknown }) => ({ ...l, tools: [] })))
        }
      }
      setModules(prev => [...prev, ...newMods])
      setLessons(prev => [...prev, ...newLsns])
      setImportMsg(`✓ Đã tạo ${newMods.length} chương, ${totalLessons} bài.`)
      setImportText('')
      setTimeout(() => { setShowImport(false); setImportMsg('') }, 1400)
    } catch (e: any) {
      setImportMsg('Lỗi: ' + (e?.message ?? e))
    }
    setImporting(false)
  }

  const deleteLesson = async (id: string) => {
    if (!confirm('Xoá bài học này?')) return
    await supabase.from('edu_course_lessons').delete().eq('id', id)
    setLessons(prev => prev.filter(l => l.id !== id))
    if (selectedLesson?.id === id) setSelectedLesson(null)
  }

  const deleteModule = async (moduleId: string, moduleName: string) => {
    const modLessons = lessons.filter(l => l.module_id === moduleId)
    const msg = modLessons.length > 0
      ? `Xoá chương "${moduleName}" và ${modLessons.length} bài bên trong?`
      : `Xoá chương "${moduleName}"?`
    if (!confirm(msg)) return
    if (modLessons.length > 0) {
      await supabase.from('edu_course_lessons').delete().eq('module_id', moduleId)
    }
    await supabase.from('edu_modules').delete().eq('id', moduleId)
    setLessons(prev => prev.filter(l => l.module_id !== moduleId))
    setModules(prev => prev.filter(m => m.id !== moduleId))
    if (selectedLesson && modLessons.some(l => l.id === selectedLesson.id)) setSelectedLesson(null)
  }

  const toggleTool = (id: string) =>
    setFTools(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])

  const togglePublish = async () => {
    if (!selectedCourse) return
    const newVal = !selectedCourse.is_published
    await supabase.from('edu_courses').update({ is_published: newVal }).eq('id', selectedCourse.id)
    setSelectedCourse(prev => prev ? { ...prev, is_published: newVal } : prev)
    setCourses(prev => prev.map(c => c.id === selectedCourse.id ? { ...c, is_published: newVal } : c))
  }

  // ── Drag & Drop (HTML5, fixed) ─────────────────────────────────────────────
  const onDragStart = (e: React.DragEvent, lessonId: string, moduleId: string) => {
    dragSrcRef.current = { id: lessonId, moduleId }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', lessonId)
    setDraggingId(lessonId)
  }

  const onDragEnd = () => { setDraggingId(null); setDragOverId(null) }

  const onDragEnterLesson = (lessonId: string) => {
    if (lessonId !== dragSrcRef.current?.id) setDragOverId(lessonId)
  }

  const onDropModule = async (e: React.DragEvent, targetModuleId: string) => {
    e.preventDefault()
    const src = dragSrcRef.current
    const overId = dragOverId
    setDraggingId(null); setDragOverId(null)
    if (!src) return

    // Build working list with possible module change
    let working = lessons.map(l => l.id === src.id ? { ...l, module_id: targetModuleId } : l)

    if (src.moduleId !== targetModuleId) {
      await supabase.from('edu_course_lessons').update({ module_id: targetModuleId }).eq('id', src.id)
    }

    if (overId && overId !== src.id) {
      const modLessons = working
        .filter(l => l.module_id === targetModuleId)
        .sort((a, b) => a.order_index - b.order_index)

      const fi = modLessons.findIndex(l => l.id === src.id)
      const ti = modLessons.findIndex(l => l.id === overId)
      if (fi >= 0 && ti >= 0) {
        const arr = [...modLessons]
        const [moved] = arr.splice(fi, 1)
        arr.splice(ti, 0, moved)
        const reindexed = arr.map((l, i) => ({ ...l, order_index: i }))
        working = working.map(l => {
          const r = reindexed.find(x => x.id === l.id)
          return r ?? l
        })
        await Promise.all(reindexed.map(l =>
          supabase.from('edu_course_lessons').update({ order_index: l.order_index }).eq('id', l.id)
        ))
      }
    }

    setLessons(working)
    dragSrcRef.current = null
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: C.bg, fontFamily: '"Inter", system-ui, sans-serif', fontSize: 14, color: C.text1 }}>

      {/* ── LEFT: Course list ─────────────────────────────────────────── */}
      <div style={{ width: 200, flexShrink: 0, background: C.surface, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: 12, borderBottom: `1px solid ${C.border}` }}>
          <button onClick={() => setShowNewCourse(!showNewCourse)}
            style={{ width: '100%', background: C.accent, border: 'none', borderRadius: 7, padding: 8, color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Tạo khoá mới
          </button>
          {showNewCourse && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input value={ncName} onChange={e => setNcName(e.target.value)} placeholder="Tên khoá học..."
                style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
              <select value={ncType} onChange={e => setNcType(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit', outline: 'none' }}>
                <option value="hanh_trinh">🎸 Hành Trình</option>
                <option value="canh_cua">🔑 Cánh Cửa</option>
                <option value="final">⭐ Final</option>
              </select>
              <select value={ncTrack} onChange={e => setNcTrack(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit', outline: 'none' }}>
                <option value="dem_hat">Đệm Hát</option>
                <option value="tia_not">Tỉa Nốt</option>
                <option value="nhac_ly">Nhạc Lý</option>
                <option value="nhap_mon">Nhập Môn</option>
                <option value="solo">Solo</option>
              </select>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={createCourse} style={{ flex: 1, background: C.accent, border: 'none', borderRadius: 6, padding: 6, color: '#fff', fontWeight: 600, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Tạo</button>
                <button onClick={() => { setShowNewCourse(false); setNcName('') }} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Huỷ</button>
              </div>
            </div>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {[
            { label: 'HÀNH TRÌNH', types: ['hanh_trinh', 'final'] },
            { label: 'CÁNH CỬA',   types: ['canh_cua'] },
          ].map(group => (
            <div key={group.label} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em', padding: '4px 8px 6px' }}>
                {group.label}
              </div>
              {courses.filter(c => group.types.includes(c.type)).map(c => (
                <div key={c.id} onClick={() => loadCourse(c)}
                  style={{ padding: '7px 10px', borderRadius: 7, cursor: 'pointer', background: selectedCourse?.id === c.id ? C.accentLight : 'transparent', color: selectedCourse?.id === c.id ? C.accent : C.text2, fontWeight: selectedCourse?.id === c.id ? 600 : 400, fontSize: 12, marginBottom: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}
                  onMouseEnter={e => { if (selectedCourse?.id !== c.id) e.currentTarget.style.background = C.bg }}
                  onMouseLeave={e => { if (selectedCourse?.id !== c.id) e.currentTarget.style.background = 'transparent' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.4, wordBreak: 'break-word', minWidth: 0 }}>
                    <span style={{ width: 18, height: 18, borderRadius: 4, overflow: 'hidden', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                      {c.image_url ? <img src={c.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : courseLogoEmoji(c)}
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                  </span>
                  {c.is_published && <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.success, flexShrink: 0 }} />}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── MIDDLE: Module + lesson list ──────────────────────────────── */}
      <div style={{ width: 340, flexShrink: 0, background: C.bg, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selectedCourse ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text3, fontSize: 13, flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 32 }}>📚</span>Chọn khoá học để bắt đầu
          </div>
        ) : (
          <>
            <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 10 }}>
                {/* Logo khoá học */}
                <button onClick={() => setShowLogoPicker(true)} title="Đổi logo khoá học"
                  style={{ width: 40, height: 40, borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg, cursor: 'pointer', flexShrink: 0, padding: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                  {selectedCourse.image_url
                    ? <img src={selectedCourse.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : courseLogoEmoji(selectedCourse)}
                </button>
                {editingCourseName ? (
                  <input autoFocus value={courseNameDraft} onChange={e => setCourseNameDraft(e.target.value)}
                    onBlur={saveCourseName}
                    onKeyDown={e => { if (e.key === 'Enter') saveCourseName(); if (e.key === 'Escape') setEditingCourseName(false) }}
                    style={{ flex: 1, fontWeight: 700, fontSize: 15, border: `1px solid ${C.accent}`, borderRadius: 6, padding: '4px 8px', fontFamily: 'inherit', outline: 'none', marginRight: 8, minWidth: 0 }} />
                ) : (
                  <div onDoubleClick={() => { setEditingCourseName(true); setCourseNameDraft(selectedCourse.name) }}
                    title="Double-click để đổi tên"
                    style={{ fontWeight: 700, fontSize: 15, color: C.text1, flex: 1, minWidth: 0, marginRight: 8, cursor: 'text', wordBreak: 'break-word', lineHeight: 1.4 }}>
                    {selectedCourse.name}
                  </div>
                )}
                <Btn variant="secondary" onClick={togglePublish} style={{ fontSize: 12, padding: '5px 10px' }}>
                  {selectedCourse.is_published
                    ? <><span style={{ color: C.success }}>●</span> Đã xuất bản</>
                    : <><span style={{ color: C.text3 }}>○</span> Nháp</>}
                </Btn>
              </div>
              <div style={{ fontSize: 11, color: C.text3 }}>
                {selectedCourse.type === 'canh_cua' ? '🔑 Cánh Cửa' : '🎸 Hành Trình'} · {lessons.length} bài học
              </div>
            </div>

            {/* ── Modal chọn logo khoá học ── */}
            {showLogoPicker && (
              <div onClick={() => setShowLogoPicker(false)}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                <div onClick={e => e.stopPropagation()}
                  style={{ background: C.surface, borderRadius: 16, padding: 20, width: '100%', maxWidth: 360, boxShadow: '0 12px 48px rgba(0,0,0,0.25)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: C.text1 }}>Logo khoá học</span>
                    <button onClick={() => setShowLogoPicker(false)} style={{ background: 'none', border: 'none', fontSize: 18, color: C.text3, cursor: 'pointer' }}>✕</button>
                  </div>

                  {/* Preview hiện tại */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 14, border: `1px solid ${C.border}`, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, overflow: 'hidden', flexShrink: 0 }}>
                      {selectedCourse.image_url
                        ? <img src={selectedCourse.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : courseLogoEmoji(selectedCourse)}
                    </div>
                    <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.5 }}>Logo hiện tại. Chọn emoji bên dưới hoặc tải ảnh lên.</div>
                  </div>

                  {/* Tải ảnh */}
                  <input ref={logoFileRef} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.currentTarget.value = '' }} />
                  <button onClick={() => logoFileRef.current?.click()} disabled={uploadingLogo}
                    style={{ width: '100%', padding: '10px', borderRadius: 10, border: `1px dashed ${C.accent}`, background: C.bg, color: C.accent, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16 }}>
                    {uploadingLogo ? '⏳ Đang tải...' : '📤 Tải ảnh logo lên'}
                  </button>

                  {/* Emoji có sẵn */}
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Hoặc chọn emoji</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6 }}>
                    {['🎸','🎵','🎶','🎼','🎤','🥁','🎹','🎺','🔑','🌱','⭐','🔥','💎','🏆','🎯','📘','🚀','❤️','🎧','🪕','🎻','✨','🌟','🎀'].map(em => (
                      <button key={em} onClick={() => pickEmoji(em)}
                        style={{ aspectRatio: '1', borderRadius: 8, border: `1px solid ${selectedCourse.icon === em ? C.accent : C.border}`, background: selectedCourse.icon === em ? C.bg : C.surface, fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
              {modules.map(mod => {
                const modLessons = lessons.filter(l => l.module_id === mod.id).sort((a, b) => a.order_index - b.order_index)
                return (
                  <div key={mod.id} style={{ marginBottom: 12 }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => onDropModule(e, mod.id)}>

                    <div style={{ fontSize: 11, fontWeight: 700, color: C.text2, padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      {editingModuleId === mod.id ? (
                        <input autoFocus value={editingModuleName} onChange={e => setEditingModuleName(e.target.value)}
                          onBlur={() => saveModuleName(mod.id)}
                          onKeyDown={e => { if (e.key === 'Enter') saveModuleName(mod.id); if (e.key === 'Escape') setEditingModuleId(null) }}
                          style={{ flex: 1, border: `1px solid ${C.accent}`, borderRadius: 5, padding: '3px 6px', fontSize: 11, fontFamily: 'inherit', outline: 'none', color: C.text1 }} />
                      ) : (
                        <span onDoubleClick={() => { setEditingModuleId(mod.id); setEditingModuleName(mod.name) }}
                          title="Double-click để đổi tên"
                          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text', flex: 1 }}>
                          {mod.name}
                        </span>
                      )}
                      <span style={{ color: C.text3, fontWeight: 400, flexShrink: 0 }}>{modLessons.length} bài</span>
                      <button onClick={e => { e.stopPropagation(); deleteModule(mod.id, mod.name) }}
                        title="Xoá chương này"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, fontSize: 15, padding: '2px 4px', borderRadius: 4, flexShrink: 0, lineHeight: 1, opacity: 0 }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = C.danger }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '0'; e.currentTarget.style.color = C.text3 }}>
                        ×
                      </button>
                    </div>

                    {modLessons.map((l, li) => {
                      const isDragging = draggingId === l.id
                      const isOver = dragOverId === l.id
                      const isSelected = selectedLesson?.id === l.id
                      return (
                        <div key={l.id}
                          draggable
                          onDragStart={e => onDragStart(e, l.id, mod.id)}
                          onDragEnter={() => onDragEnterLesson(l.id)}
                          onDragOver={e => e.preventDefault()}
                          onDragEnd={onDragEnd}
                          onClick={() => { if (!isDragging) selectLesson(l) }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 10px', borderRadius: 7,
                            cursor: isDragging ? 'grabbing' : 'grab',
                            background: isOver ? '#E0E7FF' : isSelected ? C.accentLight : C.surface,
                            border: `1px solid ${isOver ? C.accent : isSelected ? C.accent : C.border}`,
                            marginBottom: 4, userSelect: 'none',
                            opacity: isDragging ? 0.4 : 1,
                            transition: 'opacity 0.15s, background 0.1s',
                          }}>
                          <span style={{ color: C.text3, fontSize: 12, cursor: 'grab', flexShrink: 0 }}>⠿</span>
                          <span style={{ fontSize: 11, color: C.text3, width: 16, flexShrink: 0, textAlign: 'center' }}>{li + 1}</span>
                          <span style={{ fontSize: 14, flexShrink: 0 }}>{TYPE_ICON[l.lesson_type] ?? '📄'}</span>
                          <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isSelected ? C.accent : C.text1, fontWeight: isSelected ? 600 : 400 }}>
                            {l.title}
                          </span>
                          <button onClick={e => { e.stopPropagation(); deleteLesson(l.id) }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, fontSize: 15, padding: '2px 4px', borderRadius: 4, flexShrink: 0, opacity: 0 }}
                            onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = C.danger }}
                            onMouseLeave={e => { e.currentTarget.style.opacity = '0'; e.currentTarget.style.color = C.text3 }}>
                            ×
                          </button>
                        </div>
                      )
                    })}

                    <button onClick={() => setPopupModuleId(mod.id)}
                      style={{ width: '100%', background: 'none', border: `1.5px dashed ${C.border}`, borderRadius: 7, padding: 8, color: C.text3, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, marginTop: 4 }}>
                      + Thêm bài mới
                    </button>
                  </div>
                )
              })}

              {addingModule ? (
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, marginTop: 8 }}>
                  <Input value={newModuleName} onChange={setNewModuleName} placeholder="Tên tuần / chương..." />
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <Btn variant="primary" onClick={addModule} style={{ flex: 1, justifyContent: 'center' }}>Thêm</Btn>
                    <Btn variant="ghost" onClick={() => { setAddingModule(false); setNewModuleName('') }}>Huỷ</Btn>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingModule(true)}
                  style={{ width: '100%', background: 'none', border: `1.5px dashed ${C.border}`, borderRadius: 8, padding: 10, color: C.text3, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, marginTop: 8 }}>
                  + Thêm tuần / chương
                </button>
              )}
              <button onClick={() => setShowImport(true)}
                style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, color: C.text2, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                📥 Nhập hàng loạt
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── RIGHT: Editor / Preview ───────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {!selectedLesson ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text3, flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 40 }}>✏️</span>
            <div style={{ fontSize: 14 }}>Chọn bài học để chỉnh sửa</div>
            <div style={{ fontSize: 12 }}>hoặc thêm bài mới từ danh sách bên trái</div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: C.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {fTitle || 'Chỉnh sửa bài học'}
              </div>
              {/* Edit / Preview toggle */}
              <div style={{ display: 'flex', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 2, gap: 2, flexShrink: 0 }}>
                {(['edit', 'preview'] as const).map(mode => (
                  <button key={mode} onClick={() => setRightMode(mode)}
                    style={{ padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, background: rightMode === mode ? C.surface : 'transparent', color: rightMode === mode ? C.accent : C.text3, boxShadow: rightMode === mode ? C.shadow : 'none' }}>
                    {mode === 'edit' ? '✏️ Soạn' : '👁 Xem trước'}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                {saved && <span style={{ fontSize: 12, color: C.success }}>✓ Đã lưu</span>}
                <Btn variant="secondary" onClick={() => setSelectedLesson(null)}>Đóng</Btn>
                <Btn variant="primary" onClick={saveLesson}>{saving ? 'Đang lưu...' : '💾 Lưu'}</Btn>
              </div>
            </div>

            {/* Edit panel */}
            {rightMode === 'edit' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12 }}>
                  <div>
                    <Label>Loại bài học</Label>
                    <select value={fType} onChange={e => setFType(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, color: C.text1, background: C.surface, fontFamily: 'inherit', outline: 'none' }}>
                      {LESSON_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Tiêu đề bài học</Label>
                    <Input value={fTitle} onChange={setFTitle} placeholder="Bài 1: Làm quen với guitar" />
                  </div>
                </div>

                <div>
                  <Label>Mô tả ngắn (hiển thị cho học viên)</Label>
                  <Textarea value={fDesc} onChange={setFDesc} placeholder="Giới thiệu về cây đàn guitar, các bộ phận cơ bản..." rows={2} />
                </div>

                {(fType === 'video' || fType === 'tap' || fType === 'metronome' || fType === 'backing_track') && (
                  <div>
                    <Label>Link video YouTube</Label>
                    <Input value={fUrl} onChange={setFUrl} placeholder="https://youtube.com/watch?v=xxxxxxxxxxx" />
                    {fUrl && getYouTubeId(fUrl) && (
                      <div style={{ marginTop: 8, borderRadius: 8, overflow: 'hidden', background: '#000', aspectRatio: '16/9' }}>
                        <iframe src={`https://www.youtube.com/embed/${getYouTubeId(fUrl)}?rel=0`} style={{ width: '100%', height: '100%', border: 'none' }} allowFullScreen />
                      </div>
                    )}
                  </div>
                )}

                {fType === 'slide' && (
                  <div>
                    {/* Hướng dẫn Canva */}
                    <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#92400E', lineHeight: 1.7 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>📐 Cách lấy link nhúng từ Canva:</div>
                      <ol style={{ margin: 0, paddingLeft: 16 }}>
                        <li>Mở thiết kế trên <a href="https://canva.com" target="_blank" rel="noreferrer" style={{ color: '#7C3AED' }}>canva.com</a></li>
                        <li>Nhấn <b>Share</b> → <b>Embed</b></li>
                        <li>Chọn <b>Responsive</b> → nhấn <b>Copy embed code</b></li>
                        <li>Dán vào đây, mình sẽ tự tách URL</li>
                      </ol>
                      <div style={{ marginTop: 6, color: '#6B7280', fontSize: 11 }}>
                        Hoặc lấy thẳng URL dạng: <code style={{ background: '#F3F4F6', padding: '1px 4px', borderRadius: 3 }}>https://www.canva.com/design/DAF.../view?embed</code>
                      </div>
                    </div>

                    <Label>Link Canva (URL hoặc embed code)</Label>
                    <div style={{ position: 'relative' }}>
                      <textarea
                        value={fUrl}
                        onChange={e => setFUrl(e.target.value)}
                        onBlur={e => {
                          if (e.target.value.trim()) setFUrl(normalizeCanvaUrl(e.target.value))
                          e.currentTarget.style.borderColor = C.border
                        }}
                        onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                        placeholder={'Dán link Canva hoặc cả mã HTML nhúng vào đây...\n\nVí dụ:\nhttps://www.canva.com/design/DAFxxx/view?embed'}
                        rows={4}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, color: C.text1, fontFamily: 'ui-monospace, monospace', outline: 'none', resize: 'vertical', lineHeight: 1.6, background: C.surface }}
                      />
                      {fUrl && fUrl.includes('<iframe') && (
                        <div style={{ fontSize: 11, color: C.success, marginTop: 4 }}>✓ Đã tách URL từ embed code</div>
                      )}
                    </div>

                    {/* Preview slide */}
                    {fUrl && (fUrl.includes('canva.com') || fUrl.startsWith('http')) && !fUrl.includes('<') && (() => {
                      const embedUrl = normalizeCanvaUrl(fUrl)
                      return (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontSize: 11, color: C.text3, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Xem trước slide:</span>
                            {embedUrl !== fUrl && <span style={{ color: C.success, fontSize: 11 }}>✓ Đã chuyển sang link embed</span>}
                          </div>
                          <div style={{ position: 'relative', paddingBottom: '56.25%', borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}`, background: '#1a1a2e' }}>
                            <iframe
                              src={embedUrl}
                              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                              allowFullScreen
                              allow="fullscreen"
                              title="Canva slide preview"
                            />
                          </div>
                          <div style={{ marginTop: 6, fontSize: 11, color: C.text3, wordBreak: 'break-all' }}>
                            URL embed: <code style={{ color: C.accent }}>{embedUrl}</code>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}

                {fType === 'link' && (
                  <div>
                    <Label>URL nhúng (embed vào bài học)</Label>
                    <Input value={fUrl} onChange={setFUrl} placeholder="https://timming.vananhaudio.com/chords" />
                    {fUrl && (
                      <div style={{ marginTop: 8, borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}`, height: 200 }}>
                        <iframe src={fUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="preview" />
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <Label>Nội dung chi tiết</Label>
                  <RichEditor value={fContent} onChange={setFContent} />
                  <div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>Hiển thị sau video cho học viên.</div>
                </div>

                <div>
                  <Label>Công cụ luyện tập</Label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {(dbTools.length > 0 ? dbTools.map(t => ({ id: t.id, label: t.name, icon: t.icon })) : TOOLS).map(t => (
                      <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 10px', borderRadius: 7, border: `1px solid ${fTools.includes(t.id) ? C.accent : C.border}`, background: fTools.includes(t.id) ? C.accentLight : C.surface }}>
                        <input type="checkbox" checked={fTools.includes(t.id)} onChange={() => toggleTool(t.id)} style={{ accentColor: C.accent, cursor: 'pointer' }} />
                        <span style={{ fontSize: 14 }}>{t.icon}</span>
                        <span style={{ fontSize: 12, color: fTools.includes(t.id) ? C.accent : C.text2, fontWeight: fTools.includes(t.id) ? 600 : 400 }}>{t.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                  <Btn variant="primary" onClick={saveLesson} style={{ width: '100%', justifyContent: 'center', padding: 10 }}>
                    {saving ? 'Đang lưu...' : '💾 Lưu bài học'}
                  </Btn>
                </div>
              </div>
            )}

            {/* Preview panel */}
            {rightMode === 'preview' && previewLesson && (
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ background: '#FFF9EC', borderBottom: '1px solid #F5E9C8', padding: '7px 20px', fontSize: 12, color: '#92742A', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>👁</span> Giao diện học sinh sẽ thấy — nội dung hiện tại (chưa lưu cũng hiện đúng).
                </div>
                <LessonPreview lesson={previewLesson} />
              </div>
            )}
          </>
        )}
      </div>

      {/* ── POPUP: chọn loại bài ──────────────────────────────────────── */}
      {popupModuleId && (
        <div onClick={() => setPopupModuleId(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: C.surface, borderRadius: 14, padding: 24, width: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Thêm bài mới</div>
            <div style={{ fontSize: 12, color: C.text3, marginBottom: 16 }}>Chọn loại bài học</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {LESSON_TYPES.map(t => (
                <button key={t.id} onClick={() => { addLesson(popupModuleId, t.id); setPopupModuleId(null) }}
                  style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 8px', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit' }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.accentLight)}
                  onMouseLeave={e => (e.currentTarget.style.background = C.bg)}>
                  <div style={{ fontSize: 22, marginBottom: 5 }}>{t.icon}</div>
                  <div style={{ fontSize: 12, color: C.text2, fontWeight: 500 }}>{t.label}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setPopupModuleId(null)}
              style={{ marginTop: 16, width: '100%', background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: 8, color: C.text3, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
              Huỷ
            </button>
          </div>
        </div>
      )}

      {/* ── Bulk import modal ── */}
      {showImport && (
        <div onClick={() => !importing && setShowImport(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: C.surface, borderRadius: 12, padding: 22, width: '100%', maxWidth: 560, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 12px 48px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.text1, marginBottom: 4 }}>📥 Nhập bài giảng hàng loạt</div>
            <div style={{ fontSize: 12, color: C.text3, marginBottom: 14, lineHeight: 1.6 }}>
              Dán dàn bài vào ô dưới. Dòng bắt đầu bằng <b>#</b> là chương, các dòng còn lại là bài học.
              Mỗi bài có thể kèm link: <b>Tên bài | link YouTube</b>. Tự nhận diện video / link.
            </div>
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 11.5, color: C.text3, fontFamily: 'monospace', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
{`# Chương 1: Nhập môn
Giới thiệu khoá học | https://youtu.be/abc123
Cầm đàn đúng tư thế | https://youtu.be/def456
# Chương 2: Hợp âm cơ bản
Hợp âm Em
Hợp âm Am | https://youtu.be/ghi789`}
            </div>
            <textarea value={importText} onChange={e => setImportText(e.target.value)}
              placeholder="Dán dàn bài của bạn vào đây..."
              style={{ width: '100%', minHeight: 200, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, fontSize: 13, color: C.text1, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }} />
            {importMsg && (
              <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: importMsg.startsWith('✓') ? '#16A34A' : '#DC2626' }}>{importMsg}</div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={bulkImport} disabled={importing || !importText.trim()}
                style={{ flex: 1, background: importing || !importText.trim() ? C.border : '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, padding: 11, fontSize: 14, fontWeight: 700, cursor: importing || !importText.trim() ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                {importing ? 'Đang nhập...' : 'Nhập vào khoá học'}
              </button>
              <button onClick={() => setShowImport(false)} disabled={importing}
                style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 18px', color: C.text2, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
