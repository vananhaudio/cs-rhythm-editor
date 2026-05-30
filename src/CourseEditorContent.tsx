import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

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
interface Course { id: string; name: string; slug: string; type: string; track: string | null; is_published: boolean }
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
  { id: 'tap',           label: 'Tap nhịp'      },
  { id: 'metronome',     label: 'Metronome'     },
  { id: 'backing_track', label: 'Backing Track' },
  { id: 'submit_video',  label: 'Nộp video'     },
  { id: 'chord',         label: 'Luyện hợp âm'  },
  { id: 'ear',           label: 'Luyện tai'     },
]

const TYPE_ICON: Record<string, string> = Object.fromEntries(LESSON_TYPES.map(t => [t.id, t.icon]))

// ─── Shared components ────────────────────────────────────────────────────────
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CourseEditorContent() {
  const [courses, setCourses]       = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [modules, setModules]       = useState<Module[]>([])
  const [lessons, setLessons]       = useState<Lesson[]>([])
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [newModuleName, setNewModuleName] = useState('')
  const [addingModule, setAddingModule]   = useState(false)
  const [popupModuleId, setPopupModuleId]   = useState<string | null>(null)
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null)
  const [editingModuleName, setEditingModuleName] = useState('')

  // Lesson form state
  const [fTitle,   setFTitle]   = useState('')
  const [fType,    setFType]    = useState('video')
  const [fUrl,     setFUrl]     = useState('')
  const [fDesc,    setFDesc]    = useState('')
  const [fContent, setFContent] = useState('')
  const [fTools,   setFTools]   = useState<string[]>([])

  // Load courses
  useEffect(() => {
    supabase.from('edu_courses').select('id,name,slug,type,track,is_published')
      .order('track').order('level_order')
      .then(({ data }) => setCourses(data ?? []))
  }, [])

  // Load modules + lessons when course changes
  const loadCourse = useCallback(async (course: Course) => {
    setSelectedCourse(course)
    setSelectedLesson(null)
    const { data: mods } = await supabase.from('edu_modules')
      .select('*').eq('course_id', course.id).order('order_index')
    setModules(mods ?? [])
    if (mods && mods.length > 0) {
      const ids = mods.map((m: Module) => m.id)
      const { data: lsns } = await supabase.from('edu_course_lessons')
        .select('*').in('module_id', ids).order('order_index')
      setLessons((lsns ?? []).map((l: Lesson & { tools?: unknown }) => ({ ...l, tools: Array.isArray(l.tools) ? l.tools : [] })))
    } else {
      setLessons([])
    }
  }, [])

  // Populate form when lesson selected
  const selectLesson = (lesson: Lesson) => {
    setSelectedLesson(lesson)
    setFTitle(lesson.title ?? '')
    setFType(lesson.lesson_type ?? 'video')
    setFUrl(lesson.content_url ?? '')
    setFDesc(lesson.description ?? '')
    setFContent(lesson.content ?? '')
    setFTools(Array.isArray(lesson.tools) ? lesson.tools : [])
  }

  // Save lesson
  const saveLesson = async () => {
    if (!selectedLesson) return
    setSaving(true)
    await supabase.from('edu_course_lessons').update({
      title: fTitle, lesson_type: fType,
      content_url: fUrl || null,
      description: fDesc || null,
      content: fContent || null,
      tools: fTools,
    }).eq('id', selectedLesson.id)
    setLessons(prev => prev.map(l => l.id === selectedLesson.id
      ? { ...l, title: fTitle, lesson_type: fType, content_url: fUrl, description: fDesc, content: fContent, tools: fTools }
      : l))
    setSelectedLesson(prev => prev ? { ...prev, title: fTitle, lesson_type: fType, content_url: fUrl, description: fDesc, content: fContent, tools: fTools } : prev)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // Rename module
  const saveModuleName = async (moduleId: string) => {
    if (!editingModuleName.trim()) return
    await supabase.from('edu_modules').update({ name: editingModuleName }).eq('id', moduleId)
    setModules(prev => prev.map(m => m.id === moduleId ? { ...m, name: editingModuleName } : m))
    setEditingModuleId(null)
  }

  // Add lesson to module
  const addLesson = async (moduleId: string, type: string) => {
    const modLessons = lessons.filter(l => l.module_id === moduleId)
    const { data, error } = await supabase.from('edu_course_lessons').insert({
      module_id: moduleId, title: `Bài ${modLessons.length + 1}: (Chưa đặt tên)`,
      lesson_type: type, order_index: modLessons.length, tools: [],
    }).select('*').single()
    if (error) { alert('Lỗi tạo bài: ' + error.message); return }
    if (data) {
      const newLesson = { ...data, tools: Array.isArray(data.tools) ? data.tools : [] }
      setLessons(prev => [...prev, newLesson])
      selectLesson(newLesson)
    }
  }

  // Add module
  const addModule = async () => {
    if (!selectedCourse || !newModuleName.trim()) return
    const { data } = await supabase.from('edu_modules').insert({
      course_id: selectedCourse.id, name: newModuleName.trim(),
      order_index: modules.length,
    }).select('*').single()
    if (data) { setModules(prev => [...prev, data]); setNewModuleName(''); setAddingModule(false) }
  }

  // Delete lesson
  const deleteLesson = async (id: string) => {
    if (!confirm('Xoá bài học này?')) return
    await supabase.from('edu_course_lessons').delete().eq('id', id)
    setLessons(prev => prev.filter(l => l.id !== id))
    if (selectedLesson?.id === id) setSelectedLesson(null)
  }

  // Toggle tool
  const toggleTool = (id: string) =>
    setFTools(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])

  // Toggle publish
  const togglePublish = async () => {
    if (!selectedCourse) return
    const newVal = !selectedCourse.is_published
    await supabase.from('edu_courses').update({ is_published: newVal }).eq('id', selectedCourse.id)
    setSelectedCourse(prev => prev ? { ...prev, is_published: newVal } : prev)
    setCourses(prev => prev.map(c => c.id === selectedCourse.id ? { ...c, is_published: newVal } : c))
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: C.bg, fontFamily: '"Inter", system-ui, sans-serif', fontSize: 14, color: C.text1 }}>

            {/* ── LEFT: Course list ──────────────────────────────────────────── */}
      <div style={{ width: 200, flexShrink: 0, background: C.surface, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px', borderBottom: `1px solid ${C.border}` }}>
          <button onClick={() => setShowNewCourse(!showNewCourse)}
            style={{ width: '100%', background: C.accent, border: 'none', borderRadius: 7, padding: '8px', color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
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
                <button onClick={createCourse} style={{ flex: 1, background: C.accent, border: 'none', borderRadius: 6, padding: '6px', color: '#fff', fontWeight: 600, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Tạo</button>
                <button onClick={() => { setShowNewCourse(false); setNcName('') }} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Huỷ</button>
              </div>
            </div>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
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
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                  {c.is_published && <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.success, flexShrink: 0 }} />}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── MIDDLE: Course + lesson list ────────────────────────────────── */}
      <div style={{ width: 340, flexShrink: 0, background: C.bg, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selectedCourse ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text3, fontSize: 13, flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 32 }}>📚</span>
            Chọn khoá học để bắt đầu
          </div>
        ) : (
          <>
            {/* Course header */}
            <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: C.text1, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>
                  {selectedCourse.name}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <Btn variant="secondary" onClick={togglePublish} style={{ fontSize: 12, padding: '5px 10px' }}>
                    {selectedCourse.is_published
                      ? <><span style={{ color: C.success }}>●</span> Đã xuất bản</>
                      : <><span style={{ color: C.text3 }}>○</span> Nháp</>}
                  </Btn>
                </div>
              </div>
              <div style={{ fontSize: 11, color: C.text3 }}>
                {selectedCourse.type === 'canh_cua' ? '🔑 Cánh Cửa' : '🎸 Hành Trình'} · {lessons.length} bài học
              </div>
            </div>

            {/* Module + lesson list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              {modules.map(mod => {
                const modLessons = lessons.filter(l => l.module_id === mod.id)
                return (
                  <div key={mod.id} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.text2, padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      {editingModuleId === mod.id ? (
                        <input autoFocus value={editingModuleName} onChange={e => setEditingModuleName(e.target.value)}
                          onBlur={() => saveModuleName(mod.id)}
                          onKeyDown={e => { if (e.key === 'Enter') saveModuleName(mod.id); if (e.key === 'Escape') setEditingModuleId(null) }}
                          style={{ flex: 1, border: `1px solid ${C.accent}`, borderRadius: 5, padding: '3px 6px', fontSize: 11, fontFamily: 'inherit', outline: 'none', color: C.text1 }} />
                      ) : (
                        <span
                          onDoubleClick={() => { setEditingModuleId(mod.id); setEditingModuleName(mod.name) }}
                          title="Double-click để đổi tên"
                          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text', flex: 1 }}>
                          {mod.name}
                        </span>
                      )}
                      <span style={{ color: C.text3, fontWeight: 400, flexShrink: 0 }}>{modLessons.length} bài</span>
                    </div>
                    {modLessons.map((l, li) => (
                      <div key={l.id}
                        onClick={() => selectLesson(l)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 7, cursor: 'pointer', background: selectedLesson?.id === l.id ? C.accentLight : C.surface, border: `1px solid ${selectedLesson?.id === l.id ? C.accent : C.border}`, marginBottom: 4 }}
                        onMouseEnter={e => { if (selectedLesson?.id !== l.id) e.currentTarget.style.background = C.surfaceHover }}
                        onMouseLeave={e => { if (selectedLesson?.id !== l.id) e.currentTarget.style.background = C.surface }}>
                        <span style={{ fontSize: 11, color: C.text3, width: 16, flexShrink: 0, textAlign: 'center' }}>{li + 1}</span>
                        <span style={{ fontSize: 14, flexShrink: 0 }}>{TYPE_ICON[l.lesson_type] ?? '📄'}</span>
                        <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: selectedLesson?.id === l.id ? C.accent : C.text1, fontWeight: selectedLesson?.id === l.id ? 600 : 400 }}>
                          {l.title}
                        </span>
                        <button onClick={e => { e.stopPropagation(); deleteLesson(l.id) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, fontSize: 14, padding: '2px 4px', borderRadius: 4, flexShrink: 0, opacity: 0 }}
                          onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = C.danger }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = '0'; e.currentTarget.style.color = C.text3 }}>
                          ×
                        </button>
                      </div>
                    ))}

                    {/* Add lesson button */}
                    <button onClick={() => setPopupModuleId(mod.id)}
                      style={{ width: '100%', background: 'none', border: `1.5px dashed ${C.border}`, borderRadius: 7, padding: '8px', color: C.text3, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, marginTop: 4 }}>
                      + Thêm bài mới
                    </button>
                  </div>
                )
              })}

              {/* Add module */}
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
                  style={{ width: '100%', background: 'none', border: `1.5px dashed ${C.border}`, borderRadius: 8, padding: '10px', color: C.text3, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, marginTop: 8 }}>
                  + Thêm tuần / chương
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── RIGHT: Lesson editor ────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {!selectedLesson ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text3, flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 40 }}>✏️</span>
            <div style={{ fontSize: 14 }}>Chọn bài học để chỉnh sửa</div>
            <div style={{ fontSize: 12 }}>hoặc thêm bài mới từ danh sách bên trái</div>
          </div>
        ) : (
          <>
            {/* Editor header */}
            <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: C.text1 }}>Chỉnh sửa bài học</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {saved && <span style={{ fontSize: 12, color: C.success }}>✓ Đã lưu</span>}
                <Btn variant="secondary" onClick={() => setSelectedLesson(null)}>Huỷ</Btn>
                <Btn variant="primary" onClick={saveLesson}>
                  {saving ? 'Đang lưu...' : '💾 Lưu nháp'}
                </Btn>
              </div>
            </div>

            {/* Form */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Loại bài học */}
              <div>
                <Label>Loại bài học</Label>
                <select value={fType} onChange={e => setFType(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, color: C.text1, background: C.surface, fontFamily: 'inherit', outline: 'none' }}>
                  {LESSON_TYPES.map(t => (
                    <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
                  ))}
                </select>
              </div>

              {/* Tiêu đề */}
              <div>
                <Label>Tiêu đề bài học</Label>
                <Input value={fTitle} onChange={setFTitle} placeholder="Bài 1: Làm quen với guitar" />
              </div>

              {/* Mô tả ngắn */}
              <div>
                <Label>Mô tả ngắn (hiện thị cho học viên)</Label>
                <Textarea value={fDesc} onChange={setFDesc} placeholder="Giới thiệu về cây đàn guitar, các bộ phận cơ bản và cách cầm đàn đúng." rows={3} />
              </div>

              {/* YouTube link */}
              {(fType === 'video' || fType === 'tap' || fType === 'metronome' || fType === 'backing_track') && (
                <div>
                  <Label>Link video YouTube</Label>
                  <Input value={fUrl} onChange={setFUrl} placeholder="https://youtube.com/watch?v=xxxxxxxxxxx" />
                  {fUrl && (
                    <div style={{ marginTop: 8, borderRadius: 8, overflow: 'hidden', background: '#000', aspectRatio: '16/9' }}>
                      <iframe
                        src={`https://www.youtube.com/embed/${fUrl.match(/(?:v=|youtu\.be\/)([^&\s]+)/)?.[1] ?? ''}`}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        allowFullScreen
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Nội dung chi tiết */}
              <div>
                <Label>Nội dung chi tiết (hiển thị sau video)</Label>
                <Textarea value={fContent} onChange={setFContent}
                  placeholder="Nhập nội dung bài học ở đây...&#10;Bạn có thể viết hướng dẫn, lưu ý, kinh nghiệm...&#10;Cho học viên sau khi xem video."
                  rows={6} />
              </div>

              {/* Công cụ liên quan */}
              <div>
                <Label>Công cụ liên quan (học viên sẽ thấy)</Label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {TOOLS.map(t => (
                    <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 10px', borderRadius: 7, border: `1px solid ${fTools.includes(t.id) ? C.accent : C.border}`, background: fTools.includes(t.id) ? C.accentLight : C.surface }}>
                      <input type="checkbox" checked={fTools.includes(t.id)} onChange={() => toggleTool(t.id)}
                        style={{ accentColor: C.accent, cursor: 'pointer' }} />
                      <span style={{ fontSize: 12, color: fTools.includes(t.id) ? C.accent : C.text2, fontWeight: fTools.includes(t.id) ? 600 : 400 }}>
                        {t.label}
                      </span>
                    </label>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: C.text3, marginTop: 6 }}>
                  * Học viên sẽ thấy các công cụ đã chọn ở trang học bài
                </div>
              </div>

              {/* Save button bottom */}
              <div style={{ paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                <Btn variant="primary" onClick={saveLesson} style={{ width: '100%', justifyContent: 'center', padding: '10px' }}>
                  {saving ? 'Đang lưu...' : '💾 Lưu bài học'}
                </Btn>
              </div>

            </div>
          </>
        )}
      </div>
    {/* ── POPUP: chọn loại bài ──────────────────────────────────────── */}
      {popupModuleId && (
        <div
          onClick={() => setPopupModuleId(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: C.surface, borderRadius: 14, padding: 24, width: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Thêm bài mới</div>
            <div style={{ fontSize: 12, color: C.text3, marginBottom: 16 }}>Chọn loại bài học</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {LESSON_TYPES.map(t => (
                <button key={t.id}
                  onClick={() => { addLesson(popupModuleId, t.id); setPopupModuleId(null) }}
                  style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 8px', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit', transition: 'background .1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.accentLight)}
                  onMouseLeave={e => (e.currentTarget.style.background = C.bg)}>
                  <div style={{ fontSize: 22, marginBottom: 5 }}>{t.icon}</div>
                  <div style={{ fontSize: 12, color: C.text2, fontWeight: 500 }}>{t.label}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setPopupModuleId(null)}
              style={{ marginTop: 16, width: '100%', background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px', color: C.text3, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
              Huỷ
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
