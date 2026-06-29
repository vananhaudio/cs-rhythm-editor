import { useState, useEffect, useRef, type CSSProperties } from 'react'
import { supabase } from './supabase'
import FlowPlayer from './FlowPlayer'

// ── Constants ────────────────────────────────────────────────────────────
const S = {
  bg: '#F4F4F5', surface: '#FFFFFF', border: '#E4E4E7',
  accent: '#4F46E5', accentLight: '#EEF2FF',
  t1: '#18181B', t2: '#52525B', t3: '#A1A1AA',
  shadow: '0 1px 4px rgba(0,0,0,0.07)',
}

const LOGIC_OPTIONS = [
  { value: 'NHAN',   label: 'NHẬN',   color: '#4338CA', emoji: '📥' },
  { value: 'NGHI',   label: 'NGHĨ',   color: '#C2410C', emoji: '🧠' },
  { value: 'LAM',    label: 'LÀM',    color: '#16A34A', emoji: '🎸' },
  { value: 'NGAM',   label: 'NGẪM',   color: '#9333EA', emoji: '🪞' },
  { value: 'THUONG', label: 'THƯỞNG', color: '#D97706', emoji: '🏅' },
  { value: 'DAN',    label: 'DẪN',    color: '#0369A1', emoji: '➡️' },
]

const TYPE_OPTIONS = [
  { value: 'text',       label: 'Văn bản',     emoji: '📄' },
  { value: 'video',      label: 'Video',        emoji: '▶️' },
  { value: 'image',      label: 'Hình ảnh',     emoji: '🖼' },
  { value: 'quiz',       label: 'Quiz',         emoji: '❓' },
  { value: 'true_false', label: 'Đúng / Sai',   emoji: '✅' },
  { value: 'input',      label: 'Nhập liệu',    emoji: '✏️' },
  { value: 'action',     label: 'Hành động',    emoji: '🎯' },
  { value: 'reward',     label: 'Phần thưởng',  emoji: '🎉' },
  { value: 'next',       label: 'Dẫn tiếp',     emoji: '➡️' },
]

// ── Types ─────────────────────────────────────────────────────────────────
interface Slide {
  id: string; order: number; logic: string; type: string
  title: string; content: string; mediaUrl: string
  options: string[]; correctAnswer: string; buttonText: string
}

interface FlowRow {
  id: string; title: string; description: string
  course_id: string | null; lesson_id: string | null
  status: 'draft' | 'published'
  estimated_minutes: number; reward_xp: number; reward_badge: string
  slides: Slide[]; created_at: string; updated_at: string
}

interface Course { id: string; name: string }
interface Lesson { id: string; title: string; module_id: string }
interface Module { id: string; name: string; course_id: string }

// ── Helpers ───────────────────────────────────────────────────────────────
const makeSlide = (order: number): Slide => ({
  id: crypto.randomUUID(), order,
  logic: 'NHAN', type: 'text',
  title: '', content: '', mediaUrl: '',
  options: ['', ''], correctAnswer: '', buttonText: '',
})

const emptyFlow = (): Omit<FlowRow, 'id' | 'created_at' | 'updated_at'> => ({
  title: '', description: '', course_id: null, lesson_id: null,
  status: 'draft', estimated_minutes: 5, reward_xp: 10, reward_badge: '',
  slides: [],
})

// ─────────────────────────────────────────────────────────────────────────
export default function FlowManager() {
  const [flows,    setFlows]    = useState<FlowRow[]>([])
  const [courses,  setCourses]  = useState<Course[]>([])
  const [modules,  setModules]  = useState<Module[]>([])
  const [lessons,  setLessons]  = useState<Lesson[]>([])
  const [selected, setSelected] = useState<FlowRow | null>(null)
  const [form,     setForm]     = useState(emptyFlow())
  const [slides,   setSlides]   = useState<Slide[]>([])
  const [editSlideId, setEditSlideId] = useState<string | null>(null)
  const [creating,    setCreating]    = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [preview,     setPreview]     = useState(false)
  const [msg,         setMsg]         = useState('')
  const [showImport,     setShowImport]     = useState(false)
  const [importText,     setImportText]     = useState('')
  const [importError,    setImportError]    = useState('')
  const [uploadingSlide, setUploadingSlide] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTargetSlide = useRef<string | null>(null)
  const jsonFileRef = useRef<HTMLInputElement>(null)

  // Load list
  useEffect(() => {
    supabase.from('flows').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setFlows((data ?? []) as FlowRow[]))
    supabase.from('edu_courses').select('id,name').order('name')
      .then(({ data }) => setCourses(data ?? []))
    supabase.from('edu_modules').select('id,name,course_id').order('order_index')
      .then(({ data }) => setModules(data ?? []))
  }, [])

  // Load lessons when course changes
  useEffect(() => {
    if (!form.course_id) { setLessons([]); return }
    const mids = modules.filter(m => m.course_id === form.course_id).map(m => m.id)
    if (!mids.length) return
    supabase.from('edu_course_lessons')
      .select('id,title,module_id').in('module_id', mids).order('order_index')
      .then(({ data }) => setLessons(data ?? []))
  }, [form.course_id, modules])

  const selectFlow = (f: FlowRow) => {
    setSelected(f)
    setForm({ title: f.title, description: f.description, course_id: f.course_id, lesson_id: f.lesson_id, status: f.status, estimated_minutes: f.estimated_minutes, reward_xp: f.reward_xp, reward_badge: f.reward_badge, slides: f.slides })
    setSlides((f.slides ?? []).sort((a, b) => a.order - b.order))
    setEditSlideId(null); setCreating(false); setPreview(false)
  }

  const newFlow = () => {
    setSelected(null); setForm(emptyFlow()); setSlides([])
    setEditSlideId(null); setCreating(true); setPreview(false)
  }

  const addSlide = () => {
    const s = makeSlide(slides.length)
    setSlides(prev => [...prev, s])
    setEditSlideId(s.id)
  }

  const duplicateSlide = (id: string) => {
    setSlides(prev => {
      const idx = prev.findIndex(s => s.id === id)
      if (idx < 0) return prev
      const orig = prev[idx]
      const dup: Slide = { ...orig, id: crypto.randomUUID(), title: orig.title ? orig.title + ' (bản sao)' : '' }
      const arr = [...prev]
      arr.splice(idx + 1, 0, dup)
      return arr.map((s, i) => ({ ...s, order: i }))
    })
  }

  const removeSlide = (id: string) => {
    setSlides(prev => prev.filter(s => s.id !== id).map((s, i) => ({ ...s, order: i })))
    if (editSlideId === id) setEditSlideId(null)
  }

  const moveSlide = (id: string, dir: -1 | 1) => {
    setSlides(prev => {
      const arr = [...prev]
      const i = arr.findIndex(s => s.id === id)
      const j = i + dir
      if (j < 0 || j >= arr.length) return arr
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
      return arr.map((s, idx) => ({ ...s, order: idx }))
    })
  }

  const updateSlide = (id: string, patch: Partial<Slide>) => {
    setSlides(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
  }

  const VALID_LOGIC = ['NHAN','NGHI','LAM','NGAM','THUONG','DAN']
  const VALID_TYPE  = ['text','image','video','audio','quiz','true_false','input','action','reward','next',
    // GĐ1 — engine gộp elearn (giữ để KHÔNG bị auto-fix về 'text')
    'callout','note_chart','checklist','self_report','summary','support','guitar_neck','guitar_strum','guitar_ear','guitar_tool','note_practice','note_show','bar_split']

  const validateAndImport = () => {
    setImportError('')
    let parsed: unknown

    // ── Bước 1: parse JSON ──────────────────────────────────────────────────
    try { parsed = JSON.parse(importText.trim()) }
    catch { setImportError('❌ JSON không hợp lệ. Kiểm tra lại dấu ngoặc, dấu phẩy.'); return }

    if (!Array.isArray(parsed)) { setImportError('❌ JSON phải là một mảng (array) các slide.'); return }
    if (parsed.length === 0)    { setImportError('❌ Mảng slides không được rỗng.'); return }

    // ── Bước 2: validate lỏng — chỉ báo lỗi khi thiếu nội dung hẳn ──────────
    // id, order, logic, type → tự điền nếu thiếu hoặc sai
    const errors: string[] = []
    parsed.forEach((s: unknown, i: number) => {
      const slide = s as Record<string, unknown>
      if (!slide.title && !slide.content)
        errors.push(`Slide ${i+1}: phải có ít nhất "title" hoặc "content"`)
    })
    if (errors.length > 0) { setImportError(errors.join('\n')); return }

    // ── Bước 3: normalize + auto-fix ──────────────────────────────────────
    const normalized: Slide[] = (parsed as Record<string, unknown>[]).map((s, i) => {
      // Auto-fix logic: nếu thiếu hoặc sai → default NHAN
      const logic = VALID_LOGIC.includes(String(s.logic ?? '')) ? String(s.logic) : 'NHAN'
      // Auto-fix type: nếu thiếu hoặc sai → default text
      const type  = VALID_TYPE.includes(String(s.type ?? ''))  ? String(s.type)  : 'text'
      return {
        id:            s.id ? String(s.id) : crypto.randomUUID(),
        order:         i,
        logic,
        type,
        title:         String(s.title   ?? ''),
        content:       String(s.content ?? ''),
        mediaUrl:      String(s.mediaUrl ?? ''),
        options:       Array.isArray(s.options) ? (s.options as unknown[]).map(String) : ['', ''],
        correctAnswer: String(s.correctAnswer ?? ''),
        buttonText:    String(s.buttonText ?? ''),
      }
    })

    const autoFixed = normalized.filter((s, i) => {
      const raw = (parsed as Record<string, unknown>[])[i]
      return !VALID_LOGIC.includes(String(raw.logic ?? '')) || !VALID_TYPE.includes(String(raw.type ?? '')) || !raw.id
    }).length

    setSlides(normalized)
    setShowImport(false)
    setImportText('')
    setMsg(`✅ Đã import ${normalized.length} slides!${autoFixed > 0 ? ` (tự sửa ${autoFixed} slide)` : ''}`)
    setTimeout(() => setMsg(''), 3000)
  }

  const triggerUpload = (slideId: string) => {
    uploadTargetSlide.current = slideId
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const slideId = uploadTargetSlide.current
    if (!file || !slideId) return
    e.target.value = '' // reset để upload cùng file lần sau vẫn trigger

    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `flows/slide_${slideId}_${Date.now()}.${ext}`

    setUploadingSlide(slideId)
    const { error } = await supabase.storage.from('flow-media').upload(path, file, { upsert: true })
    if (error) {
      alert('Upload lỗi: ' + error.message)
      setUploadingSlide(null)
      return
    }
    const { data } = supabase.storage.from('flow-media').getPublicUrl(path)
    updateSlide(slideId, { mediaUrl: data.publicUrl })
    setUploadingSlide(null)
    setMsg('🖼 Ảnh đã upload!')
    setTimeout(() => setMsg(''), 2500)
  }

  const save = async (publish = false) => {
    if (!form.title.trim()) { setMsg('Vui lòng nhập tiêu đề Flow'); return }
    setSaving(true); setMsg('')
    const status = publish ? 'published' : 'draft'
    const payload = { ...form, status, slides, updated_at: new Date().toISOString() }

    if (selected) {
      const { error } = await supabase.from('flows').update(payload).eq('id', selected.id)
      if (error) { setMsg('Lỗi: ' + error.message); setSaving(false); return }
      const updated = { ...selected, ...payload } as FlowRow
      setFlows(prev => prev.map(f => f.id === selected.id ? updated : f))
      setSelected(updated)
    } else {
      const { data, error } = await supabase.from('flows').insert(payload).select('*').single()
      if (error) { setMsg('Lỗi: ' + error.message); setSaving(false); return }
      setFlows(prev => [data as FlowRow, ...prev])
      setSelected(data as FlowRow); setCreating(false)
    }

    // Nếu có lesson_id, update lesson_type = 'flow'
    if (form.lesson_id) {
      await supabase.from('edu_course_lessons').update({ lesson_type: 'flow' }).eq('id', form.lesson_id)
    }

    setSaving(false)
    setMsg(publish ? '✅ Đã xuất bản!' : '💾 Đã lưu nháp!')
    setTimeout(() => setMsg(''), 2500)
  }

  const editingSlide = slides.find(s => s.id === editSlideId) ?? null

  // ── Preview mode ────────────────────────────────────────────────────────
  if (preview && selected) {
    const previewFlow = { ...selected, slides, status: 'published' as const }
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 390, maxHeight: '90vh', background: '#fff', borderRadius: 24, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #EEE', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: S.t1 }}>📱 Preview — {previewFlow.title}</span>
            <button onClick={() => setPreview(false)}
              style={{ background: '#F4F4F5', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: S.t2 }}>
              Đóng ✕
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <FlowPlayer
              lessonId={previewFlow.lesson_id ?? '__preview__'}
              studentId="__preview__"
              onComplete={() => setPreview(false)}
              onBack={() => setPreview(false)}
              previewFlow={previewFlow}
            />
          </div>
        </div>
      </div>
    )
  }

  // ── Layout ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: S.bg }}>

      {/* ── LEFT: Flow list ──────────────────────────────────────────────── */}
      <div style={{ width: 260, flexShrink: 0, background: S.surface, borderRight: `1px solid ${S.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px', borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: S.t1 }}>Flow Bài Học</div>
          <button onClick={newFlow}
            style={{ background: S.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Tạo mới
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {flows.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: S.t3, fontSize: 14 }}>Chưa có Flow nào</div>
          )}
          {flows.map(f => {
            const active = selected?.id === f.id
            return (
              <div key={f.id} onClick={() => selectFlow(f)}
                style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', background: active ? S.accentLight : 'transparent', borderLeft: `3px solid ${active ? S.accent : 'transparent'}`, marginBottom: 2, transition: 'all .1s' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: S.t1, marginBottom: 3 }}>{f.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: f.status === 'published' ? '#DCFCE7' : '#FEF9C3', color: f.status === 'published' ? '#16A34A' : '#B45309' }}>
                    {f.status === 'published' ? 'Published' : 'Draft'}
                  </span>
                  <span style={{ fontSize: 12, color: S.t3 }}>{(f.slides ?? []).length} slides</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Hidden file input cho upload ảnh */}
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: 'none' }} onChange={handleFileChange} />

      {/* ── RIGHT: Editor ────────────────────────────────────────────────── */}
      {(selected || creating) ? (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* Toolbar */}
          <div style={{ padding: '12px 20px', borderBottom: `1px solid ${S.border}`, background: S.surface, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, fontWeight: 700, fontSize: 16, color: S.t1 }}>
              {creating ? 'Flow mới' : form.title || 'Chỉnh sửa Flow'}
            </div>
            {msg && <span style={{ fontSize: 14, color: msg.startsWith('Lỗi') ? '#DC2626' : '#16A34A', fontWeight: 600 }}>{msg}</span>}
            {selected && (
              <button onClick={() => setPreview(true)}
                style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.surface, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: S.t2 }}>
                👁 Preview
              </button>
            )}
            <button onClick={() => save(false)} disabled={saving}
              style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.surface, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: S.t2, opacity: saving ? .6 : 1 }}>
              {saving ? 'Đang lưu...' : '💾 Lưu nháp'}
            </button>
            <button onClick={() => save(true)} disabled={saving}
              style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: S.accent, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? .6 : 1 }}>
              🚀 Xuất bản
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

            {/* ── Flow metadata form ────────────────────────────────────── */}
            <div style={{ background: S.surface, borderRadius: 14, padding: '20px', marginBottom: 20, boxShadow: S.shadow }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: S.t2, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.05em' }}>Thông tin Flow</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: S.t2 }}>Tiêu đề *</span>
                  <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="Ví dụ: Giới thiệu khóa học"
                    style={inputSt()} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: S.t2 }}>Thời lượng (phút)</span>
                  <input type="number" value={form.estimated_minutes} onChange={e => setForm(p => ({ ...p, estimated_minutes: +e.target.value }))}
                    style={inputSt()} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: '1/-1' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: S.t2 }}>Mô tả</span>
                  <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Mô tả ngắn về Flow này"
                    style={inputSt()} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: S.t2 }}>Khoá học</span>
                  <select value={form.course_id ?? ''} onChange={e => setForm(p => ({ ...p, course_id: e.target.value || null, lesson_id: null }))}
                    style={inputSt()}>
                    <option value="">-- Chọn khoá học --</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: S.t2 }}>Gắn vào bài học</span>
                  <select value={form.lesson_id ?? ''} onChange={e => setForm(p => ({ ...p, lesson_id: e.target.value || null }))}
                    disabled={!form.course_id}
                    style={inputSt()}>
                    <option value="">-- Chọn bài học --</option>
                    {lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: S.t2 }}>Thưởng XP</span>
                  <input type="number" value={form.reward_xp} onChange={e => setForm(p => ({ ...p, reward_xp: +e.target.value }))}
                    style={inputSt()} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: S.t2 }}>Badge</span>
                  <input value={form.reward_badge} onChange={e => setForm(p => ({ ...p, reward_badge: e.target.value }))}
                    placeholder="VD: 🎸 Guitar Starter"
                    style={inputSt()} />
                </label>
              </div>
            </div>

            {/* ── Slides ───────────────────────────────────────────────── */}
            <div style={{ background: S.surface, borderRadius: 14, padding: '20px', boxShadow: S.shadow }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: S.t2, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Slides ({slides.length})
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setShowImport(true); setImportError(''); setImportText('') }}
                    style={{ background: '#FFF7ED', color: '#D97706', border: '1px solid #FED7AA', borderRadius: 8, padding: '6px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    📥 Import JSON
                  </button>
                  <button onClick={addSlide}
                    style={{ background: S.accentLight, color: S.accent, border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    + Thêm slide
                  </button>
                </div>
              </div>

              {/* ── Modal Import JSON ──────────────────────────────────── */}
              {showImport && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ background: S.surface, borderRadius: 16, width: 600, maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>

                    {/* Header */}
                    <div style={{ padding: '18px 20px', borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16, color: S.t1 }}>📥 Import JSON Slides</div>
                        <div style={{ fontSize: 13, color: S.t3, marginTop: 3 }}>Dán JSON từ ChatGPT hoặc chọn file .json</div>
                      </div>
                      <button onClick={() => setShowImport(false)}
                        style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: S.t3, padding: '4px 8px' }}>✕</button>
                    </div>

                    {/* Schema hint */}
                    <div style={{ padding: '12px 20px', background: '#F8F9FF', borderBottom: `1px solid ${S.border}`, fontSize: 12, color: S.t3, fontFamily: 'monospace', lineHeight: 1.7 }}>
                      Tối thiểu mỗi slide cần: <b>"title"</b> hoặc <b>"content"</b>. Các trường khác (id, order, logic, type) tự động điền nếu thiếu.
                    </div>

                    {/* Textarea + file button */}
                    <div style={{ flex: 1, padding: '16px 20px', overflowY: 'auto' }}>
                      {/* Nút chọn file */}
                      <input ref={jsonFileRef} type="file" accept=".json,application/json" style={{ display: 'none' }}
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          const reader = new FileReader()
                          reader.onload = ev => { setImportText(String(ev.target?.result ?? '')); setImportError('') }
                          reader.readAsText(file)
                          e.target.value = ''
                        }} />
                      <button onClick={() => jsonFileRef.current?.click()}
                        style={{ width: '100%', padding: '10px', marginBottom: 12, border: `1.5px dashed ${S.border}`, borderRadius: 10, background: '#FAFBFF', color: S.accent, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        📁 Chọn file .json từ máy tính
                      </button>
                      <textarea
                        value={importText}
                        onChange={e => { setImportText(e.target.value); setImportError('') }}
                        placeholder={'[\n  {\n    "logic": "NHAN",\n    "type": "text",\n    "title": "Chào mừng!",\n    "content": "Nội dung bài học..."\n  }\n]'}
                        style={{ width: '100%', boxSizing: 'border-box', height: 220, borderRadius: 10, border: `1.5px solid ${importError ? '#EF4444' : S.border}`, padding: '12px 14px', fontSize: 14, fontFamily: 'monospace', outline: 'none', resize: 'vertical', lineHeight: 1.6, color: S.t1, background: '#FAFAFA' }}
                      />
                      {importError && (
                        <div style={{ marginTop: 10, background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '12px 14px', fontSize: 14, color: '#DC2626', whiteSpace: 'pre-line', lineHeight: 1.7 }}>
                          {importError}
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div style={{ padding: '14px 20px', borderTop: `1px solid ${S.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                      <button onClick={() => setShowImport(false)}
                        style={{ padding: '9px 20px', borderRadius: 9, border: `1px solid ${S.border}`, background: S.surface, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: S.t2 }}>
                        Huỷ
                      </button>
                      <button onClick={validateAndImport} disabled={!importText.trim()}
                        style={{ padding: '9px 22px', borderRadius: 9, border: 'none', background: importText.trim() ? '#D97706' : '#E5E7EB', color: importText.trim() ? '#fff' : '#9CA3AF', fontSize: 14, fontWeight: 700, cursor: importText.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                        ✓ Import vào Flow
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {slides.length === 0 && (
                <div style={{ textAlign: 'center', padding: '28px', color: S.t3, fontSize: 14 }}>
                  Chưa có slide nào. Bấm "+ Thêm slide" hoặc "📥 Import JSON".
                </div>
              )}

              {slides.map((slide, idx) => {
                const lm = LOGIC_OPTIONS.find(l => l.value === slide.logic)
                const tp = TYPE_OPTIONS.find(t => t.value === slide.type)
                const isEditing = editSlideId === slide.id
                return (
                  <div key={slide.id} style={{ border: `1.5px solid ${isEditing ? S.accent : S.border}`, borderRadius: 12, marginBottom: 10, overflow: 'hidden', transition: 'border-color .15s' }}>

                    {/* Slide header */}
                    <div onClick={() => setEditSlideId(isEditing ? null : slide.id)}
                      style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: isEditing ? S.accentLight : '#FAFAFA' }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: S.t3, width: 20 }}>{idx + 1}</span>
                      <span style={{ fontSize: 12, background: lm?.color + '18', color: lm?.color, borderRadius: 99, padding: '2px 8px', fontWeight: 700 }}>{lm?.emoji} {lm?.label}</span>
                      <span style={{ fontSize: 13, color: S.t2 }}>{tp?.emoji} {tp?.label}</span>
                      <span style={{ flex: 1, fontSize: 14, color: S.t1, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {slide.title || slide.content || '(Chưa có nội dung)'}
                      </span>
                      <button onClick={e => { e.stopPropagation(); moveSlide(slide.id, -1) }} disabled={idx === 0}
                        style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? '#DDD' : S.t2, fontSize: 15, padding: '2px 4px' }}>↑</button>
                      <button onClick={e => { e.stopPropagation(); moveSlide(slide.id, 1) }} disabled={idx === slides.length - 1}
                        style={{ background: 'none', border: 'none', cursor: idx === slides.length - 1 ? 'default' : 'pointer', color: idx === slides.length - 1 ? '#DDD' : S.t2, fontSize: 15, padding: '2px 4px' }}>↓</button>
                      <button onClick={e => { e.stopPropagation(); duplicateSlide(slide.id) }}
                        title="Nhân đôi slide"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.t3, fontSize: 14, padding: '2px 4px' }}
                        onMouseEnter={e => (e.currentTarget.style.color = S.accent)}
                        onMouseLeave={e => (e.currentTarget.style.color = S.t3)}>⊕</button>
                      <button onClick={e => { e.stopPropagation(); removeSlide(slide.id) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 15, padding: '2px 4px' }}>✕</button>
                    </div>

                    {/* Slide editor (expanded) */}
                    {isEditing && (
                      <div style={{ padding: '16px', borderTop: `1px solid ${S.border}` }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>

                          {/* Logic */}
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: S.t2 }}>Logic</span>
                            <select value={slide.logic} onChange={e => updateSlide(slide.id, { logic: e.target.value })} style={inputSt()}>
                              {LOGIC_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.emoji} {l.label}</option>)}
                            </select>
                          </label>

                          {/* Type */}
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: S.t2 }}>Loại slide</span>
                            <select value={slide.type} onChange={e => updateSlide(slide.id, { type: e.target.value })} style={inputSt()}>
                              {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
                            </select>
                          </label>

                          {/* Title */}
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: '1/-1' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: S.t2 }}>Tiêu đề slide</span>
                            <input value={slide.title} onChange={e => updateSlide(slide.id, { title: e.target.value })}
                              placeholder="Tiêu đề hiển thị to ở đầu slide"
                              style={inputSt()} />
                          </label>

                          {/* Content */}
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: '1/-1' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: S.t2 }}>Nội dung</span>
                            <textarea value={slide.content} onChange={e => updateSlide(slide.id, { content: e.target.value })}
                              placeholder={slide.type === 'quiz' ? 'Câu hỏi' : slide.type === 'input' ? 'Hướng dẫn nhập' : 'Nội dung văn bản (hỗ trợ HTML đơn giản)'}
                              rows={3}
                              style={{ ...inputSt(), resize: 'vertical' as const }} />
                          </label>

                          {/* mediaUrl — VIDEO */}
                          {slide.type === 'video' && (
                            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: '1/-1' }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: S.t2 }}>URL Video (YouTube embed)</span>
                              <input value={slide.mediaUrl} onChange={e => updateSlide(slide.id, { mediaUrl: e.target.value })}
                                placeholder="https://www.youtube.com/embed/..."
                                style={inputSt()} />
                            </label>
                          )}

                          {/* mediaUrl — IMAGE + Upload */}
                          {slide.type === 'image' && (
                            <div style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: S.t2 }}>Hình ảnh</span>

                              {/* Input URL + nút Upload */}
                              <div style={{ display: 'flex', gap: 8 }}>
                                <input value={slide.mediaUrl} onChange={e => updateSlide(slide.id, { mediaUrl: e.target.value })}
                                  placeholder="URL ảnh hoặc dùng nút Upload →"
                                  style={{ ...inputSt(), flex: 1 }} />
                                <button
                                  onClick={() => triggerUpload(slide.id)}
                                  disabled={uploadingSlide === slide.id}
                                  style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: uploadingSlide === slide.id ? '#E5E7EB' : '#4338CA', color: uploadingSlide === slide.id ? '#9CA3AF' : '#fff', fontSize: 13, fontWeight: 600, cursor: uploadingSlide === slide.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                  {uploadingSlide === slide.id ? '⏳ Đang upload...' : '⬆️ Upload ảnh'}
                                </button>
                              </div>

                              {/* Thumbnail preview */}
                              {slide.mediaUrl && (
                                <div style={{ position: 'relative', display: 'inline-block' }}>
                                  <img src={slide.mediaUrl} alt="preview"
                                    style={{ height: 120, maxWidth: '100%', borderRadius: 8, border: `1px solid ${S.border}`, objectFit: 'cover', display: 'block' }}
                                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                                </div>
                              )}
                              <div style={{ fontSize: 12, color: S.t3 }}>Hỗ trợ: JPG, PNG, WebP, GIF — tối đa 5MB</div>
                            </div>
                          )}

                          {/* Quiz options */}
                          {slide.type === 'quiz' && (
                            <div style={{ gridColumn: '1/-1' }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: S.t2, marginBottom: 8 }}>Đáp án</div>
                              {slide.options.map((opt, oi) => (
                                <div key={oi} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                                  <input type="radio" name={`correct-${slide.id}`} checked={slide.correctAnswer === opt}
                                    onChange={() => updateSlide(slide.id, { correctAnswer: opt })} style={{ flexShrink: 0 }} />
                                  <input value={opt}
                                    onChange={e => { const ops = [...slide.options]; ops[oi] = e.target.value; updateSlide(slide.id, { options: ops }) }}
                                    placeholder={`Đáp án ${String.fromCharCode(65 + oi)}`}
                                    style={{ ...inputSt(), flex: 1 }} />
                                  {slide.options.length > 2 && (
                                    <button onClick={() => { const ops = slide.options.filter((_, j) => j !== oi); updateSlide(slide.id, { options: ops }) }}
                                      style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 17 }}>✕</button>
                                  )}
                                </div>
                              ))}
                              {slide.options.length < 4 && (
                                <button onClick={() => updateSlide(slide.id, { options: [...slide.options, ''] })}
                                  style={{ fontSize: 13, color: S.accent, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontFamily: 'inherit' }}>
                                  + Thêm đáp án
                                </button>
                              )}
                              <div style={{ fontSize: 12, color: S.t3, marginTop: 6 }}>☝️ Chọn radio để đánh dấu đáp án đúng</div>
                            </div>
                          )}

                          {/* True/False correct answer */}
                          {slide.type === 'true_false' && (
                            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: S.t2 }}>Đáp án đúng</span>
                              <select value={slide.correctAnswer} onChange={e => updateSlide(slide.id, { correctAnswer: e.target.value })} style={inputSt()}>
                                <option value="">-- Chọn --</option>
                                <option value="Đúng">✓ Đúng</option>
                                <option value="Sai">✗ Sai</option>
                              </select>
                            </label>
                          )}

                          {/* Button text */}
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: S.t2 }}>Nút bấm (để trống = mặc định)</span>
                            <input value={slide.buttonText} onChange={e => updateSlide(slide.id, { buttonText: e.target.value })}
                              placeholder={slide.type === 'action' ? 'Tôi đã làm xong' : 'Tiếp tục →'}
                              style={inputSt()} />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.t3, flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 40 }}>✨</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Chọn Flow để chỉnh sửa</div>
          <div style={{ fontSize: 14 }}>hoặc bấm "+ Tạo mới"</div>
        </div>
      )}
    </div>
  )
}

// ── Style helper ───────────────────────────────────────────────────────────
function inputSt(): CSSProperties {
  return {
    padding: '8px 11px', borderRadius: 8, border: '1.5px solid #E4E4E7',
    fontSize: 14, fontFamily: 'inherit', outline: 'none', color: '#18181B',
    background: '#FAFAFA', width: '100%', boxSizing: 'border-box',
  }
}
