import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import FlowPlayer from './FlowPlayer'
import { STRINGS, colorOfNum } from './elearn/guitarConst'

// ── Tokens (khớp CourseEditorContent) ─────────────────────────────────────────
const C = {
  border: '#E4E4E7', surface: '#FFFFFF', bg: '#F7F7F8',
  text1: '#18181B', text2: '#52525B', text3: '#A1A1AA',
  accent: '#4F46E5', accentLight: '#EEF2FF',
  danger: '#DC2626', success: '#16A34A',
}

const LOGIC_META: Record<string, { label: string; bg: string; color: string }> = {
  NHAN:   { label: 'NHẬN',    bg: '#EEF2FF', color: '#4338CA' },
  NGHI:   { label: 'NGHĨ',    bg: '#FFF7ED', color: '#C2410C' },
  LAM:    { label: 'LÀM',     bg: '#F0FDF4', color: '#16A34A' },
  NGAM:   { label: 'NGẪM',    bg: '#FDF4FF', color: '#9333EA' },
  THUONG: { label: 'THƯỞNG',  bg: '#FFFBEB', color: '#D97706' },
  DAN:    { label: 'DẪN',     bg: '#F0F9FF', color: '#0369A1' },
}

const SLIDE_TYPES = [
  // NHẬN / đọc xem
  { id: 'text',        icon: '📝', label: 'Văn bản'        },
  { id: 'callout',     icon: '💡', label: 'Lời thầy / Mẹo' },
  { id: 'video',       icon: '▶',  label: 'Video'          },
  { id: 'image',       icon: '🖼', label: 'Ảnh'            },
  { id: 'note_chart',  icon: '🎵', label: 'Bảng nốt'       },
  // NGHĨ
  { id: 'quiz',        icon: '❓', label: 'Trắc nghiệm'    },
  { id: 'true_false',  icon: '✓✗', label: 'Đúng / Sai'     },
  { id: 'input',       icon: '✏', label: 'Nhập câu'        },
  // LÀM (tương tác đàn)
  { id: 'guitar_neck', icon: '🎸', label: 'Chọn dây'       },
  { id: 'guitar_strum',icon: '🎶', label: 'Gảy dãy dây'    },
  { id: 'guitar_ear',  icon: '👂', label: 'Luyện tai nghe' },
  { id: 'guitar_tool', icon: '🎚️', label: 'Mở công cụ'     },
  // NGẪM / THƯỞNG / DẪN
  { id: 'checklist',   icon: '☑️', label: 'Tự đánh giá'    },
  { id: 'action',      icon: '⚡', label: 'Hành động'       },
  { id: 'reward',      icon: '🎁', label: 'Phần thưởng'    },
  { id: 'next',        icon: '→',  label: 'Chuyển tiếp'    },
]
const TYPE_ICON: Record<string, string> = Object.fromEntries(SLIDE_TYPES.map(t => [t.id, t.icon]))

interface Slide {
  id: string; order: number; logic: string; type: string
  title?: string; content?: string; mediaUrl?: string
  options?: string[]; correctAnswer?: string; buttonText?: string
  interactive?: Record<string, unknown>; hintText?: string
}

interface Props { lessonId: string }

// ── Helpers ───────────────────────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: C.text2, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }}>{children}</div>
}
function Inp({ value, onChange, placeholder, style }: { value: string; onChange: (v: string) => void; placeholder?: string; style?: React.CSSProperties }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, color: C.text1, fontFamily: 'inherit', outline: 'none', background: C.surface, ...style }} />
  )
}
function Sel({ value, onChange, children, style }: { value: string; onChange: (v: string) => void; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, color: C.text1, background: C.surface, fontFamily: 'inherit', outline: 'none', ...style }}>
      {children}
    </select>
  )
}
function Btn({ onClick, children, variant = 'secondary', style }: { onClick: () => void; children: React.ReactNode; variant?: 'primary' | 'secondary' | 'danger'; style?: React.CSSProperties }) {
  const bg = variant === 'primary' ? C.accent : variant === 'danger' ? C.danger : C.surface
  const color = variant === 'secondary' ? C.text1 : '#fff'
  return (
    <button onClick={onClick}
      style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${variant === 'secondary' ? C.border : bg}`, background: bg, color, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', ...style }}>
      {children}
    </button>
  )
}

// Hàng 6 dây để bấm chọn (dây 1 trên cùng → 6). single = chọn 1 dây.
function StringPicker({ selected, onTap }: { selected: number[]; onTap: (n: number) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {STRINGS.map(s => {
        const on = selected.includes(s.num)
        const idx = selected.indexOf(s.num)
        return (
          <button key={s.num} onClick={() => onTap(s.num)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 11px', borderRadius: 8, border: `1.5px solid ${on ? colorOfNum(s.num) : C.border}`, background: on ? '#F0FDF4' : C.surface, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
            <span style={{ width: 16, fontFamily: 'ui-monospace, monospace', fontSize: 12, fontWeight: 800, color: colorOfNum(s.num) }}>{s.num}</span>
            <span style={{ flex: 1, height: 3 + (s.num - 1) * 1.4, borderRadius: 99, background: colorOfNum(s.num) }} />
            <span style={{ width: 52, textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontSize: 11, fontWeight: 700, color: C.text2 }}>{s.vn}·{s.note}</span>
            {on && <span style={{ width: 18, fontSize: 11, fontWeight: 800, color: C.success }}>{idx >= 0 && selected.length > 1 ? idx + 1 : '✓'}</span>}
          </button>
        )
      })}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function FlowInlineEditor({ lessonId }: Props) {
  const [flowId,     setFlowId]     = useState<string | null>(null)
  const [flowTitle,  setFlowTitle]  = useState('')
  const [rewardXp,   setRewardXp]   = useState(10)
  const [slides,     setSlides]     = useState<Slide[]>([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [editSlide,  setEditSlide]  = useState<Slide | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError,setImportError]= useState('')
  const [showPreview,setShowPreview]= useState(false)
  const [uploadingId,setUploadingId]= useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadTarget = useRef<string | null>(null)
  const jsonFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [lessonId])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('flows').select('*').eq('lesson_id', lessonId).maybeSingle()
    if (data) {
      setFlowId(data.id)
      setFlowTitle(data.title ?? '')
      setRewardXp(data.reward_xp ?? 10)
      // Backfill id cho slide cũ import từ JSON mà không có id
      const rawSlides = (Array.isArray(data.slides) ? data.slides : [])
        .sort((a: Slide, b: Slide) => a.order - b.order)
        .map((s: Slide, i: number) => ({
          ...s,
          id: s.id || `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
        }))
      setSlides(rawSlides)
    } else {
      setFlowId(null); setFlowTitle(''); setRewardXp(10); setSlides([])
    }
    setLoading(false)
  }

  const save = async () => {
    if (!flowTitle.trim()) { alert('Nhập tên Flow trước'); return }
    setSaving(true)
    const ordered = slides.map((s, i) => ({ ...s, order: i + 1 }))
    const payload = { lesson_id: lessonId, title: flowTitle.trim(), reward_xp: rewardXp, status: 'published', slides: ordered }
    if (flowId) {
      await supabase.from('flows').update(payload).eq('id', flowId)
    } else {
      const { data } = await supabase.from('flows').insert(payload).select('id').single()
      setFlowId(data?.id ?? null)
    }
    await supabase.from('edu_course_lessons').update({ lesson_type: 'flow' }).eq('id', lessonId)
    setSlides(ordered)
    setSaving(false)
  }

  const addSlide = () => {
    const s: Slide = { id: Date.now().toString(), order: slides.length + 1, logic: 'NHAN', type: 'text', title: '', content: '' }
    const updated = [...slides, s]
    setSlides(updated)
    setEditSlide(s)
  }

  const duplicateSlide = (id: string) => {
    const idx = slides.findIndex(s => s.id === id)
    if (idx < 0) return
    const orig = slides[idx]
    const dup: Slide = { ...orig, id: Date.now().toString() + '_dup', title: orig.title ? orig.title + ' (bản sao)' : '' }
    const arr = [...slides]
    arr.splice(idx + 1, 0, dup)
    setSlides(arr.map((s, i) => ({ ...s, order: i + 1 })))
  }

  const removeSlide = (id: string) => {
    if (!confirm('Xoá slide này?')) return
    setSlides(prev => prev.filter(s => s.id !== id))
    if (editSlide?.id === id) setEditSlide(null)
  }

  const patch = (field: keyof Slide, value: unknown) => {
    if (!editSlide) return
    const updated = { ...editSlide, [field]: value }
    setEditSlide(updated)
    setSlides(prev => prev.map(s => s.id === updated.id ? updated : s))
  }
  // Cập nhật 1 khoá trong interactive (config slide tương tác)
  const patchItv = (key: string, value: unknown) => {
    if (!editSlide) return
    patch('interactive', { ...(editSlide.interactive ?? {}), [key]: value })
  }
  const itv = (editSlide?.interactive ?? {}) as Record<string, unknown>

  const moveSlide = (id: string, dir: -1 | 1) => {
    const idx = slides.findIndex(s => s.id === id)
    if (idx < 0) return
    const next = idx + dir
    if (next < 0 || next >= slides.length) return
    const arr = [...slides]
    ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
    setSlides(arr.map((s, i) => ({ ...s, order: i + 1 })))
  }

  const handleUpload = async (file: File) => {
    const id = uploadTarget.current
    if (!id) return
    setUploadingId(id)
    const ext = file.name.split('.').pop()
    const path = `flows/slide_${id}_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('flow-media').upload(path, file, { upsert: true })
    if (!error) {
      const { data: pub } = supabase.storage.from('flow-media').getPublicUrl(path)
      const slide = slides.find(s => s.id === id)
      if (slide) {
        const updated = { ...slide, mediaUrl: pub.publicUrl }
        setEditSlide(updated)
        setSlides(prev => prev.map(s => s.id === id ? updated : s))
      }
    }
    setUploadingId(null)
    uploadTarget.current = null
  }

  const doImport = () => {
    setImportError('')
    try {
      const arr = JSON.parse(importText)
      if (!Array.isArray(arr)) throw new Error('Phải là mảng JSON')
      const validLogics = Object.keys(LOGIC_META)
      const validTypes  = SLIDE_TYPES.map(t => t.id)
      const imported: Slide[] = arr.map((s: Record<string, unknown>, i: number) => ({
        id: Date.now().toString() + i,
        order: i + 1,
        logic: validLogics.includes(String(s.logic)) ? String(s.logic) : 'NHAN',
        type:  validTypes.includes(String(s.type))   ? String(s.type)  : 'text',
        title:         String(s.title ?? ''),
        content:       String(s.content ?? ''),
        mediaUrl:      String(s.mediaUrl ?? ''),
        options:       Array.isArray(s.options) ? s.options.map(String) : [],
        correctAnswer: String(s.correctAnswer ?? ''),
        buttonText:    String(s.buttonText ?? ''),
        interactive:   (s.interactive && typeof s.interactive === 'object') ? s.interactive as Record<string, unknown> : undefined,
        hintText:      s.hintText ? String(s.hintText) : undefined,
      }))
      setSlides(imported)
      setShowImport(false)
      setImportText('')
    } catch (e: unknown) {
      setImportError('JSON lỗi: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  if (loading) return <div style={{ padding: 16, color: C.text3, fontSize: 13 }}>Đang tải...</div>

  const lm = editSlide ? (LOGIC_META[editSlide.logic] ?? LOGIC_META.NHAN) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Flow meta ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 10 }}>
        <div>
          <Label>Tên Flow</Label>
          <Inp value={flowTitle} onChange={setFlowTitle} placeholder="VD: Học tên dây đàn" />
        </div>
        <div>
          <Label>Thưởng XP</Label>
          <input type="number" value={rewardXp} onChange={e => setRewardXp(Number(e.target.value))} min={0}
            style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, color: C.text1, fontFamily: 'inherit', outline: 'none' }} />
        </div>
      </div>

      {/* ── Slide list ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Label>Slides ({slides.length})</Label>
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn onClick={() => setShowImport(true)}>📋 Import JSON</Btn>
            <Btn variant="primary" onClick={addSlide}>+ Thêm slide</Btn>
          </div>
        </div>

        {slides.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: C.text3, fontSize: 13, border: `1.5px dashed ${C.border}`, borderRadius: 10 }}>
            Chưa có slide nào — nhấn <b>+ Thêm slide</b> hoặc <b>Import JSON</b>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {slides.map((s, i) => {
            const lm = LOGIC_META[s.logic] ?? LOGIC_META.NHAN
            const isEditing = editSlide?.id === s.id
            return (
              <div key={s.id}>
                {/* Slide row */}
                <div onClick={() => setEditSlide(isEditing ? null : s)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: isEditing ? C.accentLight : C.surface, border: `1px solid ${isEditing ? C.accent : C.border}`, cursor: 'pointer', userSelect: 'none' }}>
                  <span style={{ color: C.text3, fontSize: 11, width: 18, textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ background: lm.bg, color: lm.color, borderRadius: 99, padding: '2px 8px', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{lm.label}</span>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{TYPE_ICON[s.type] ?? '📄'}</span>
                  <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isEditing ? C.accent : C.text1, fontWeight: isEditing ? 600 : 400 }}>
                    {s.title || <span style={{ color: C.text3, fontStyle: 'italic' }}>(chưa có tiêu đề)</span>}
                  </span>
                  {/* Move up/down */}
                  <button onClick={e => { e.stopPropagation(); moveSlide(s.id, -1) }}
                    disabled={i === 0}
                    style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: C.text3, fontSize: 13, padding: '0 2px', opacity: i === 0 ? 0.3 : 1 }}>↑</button>
                  <button onClick={e => { e.stopPropagation(); moveSlide(s.id, 1) }}
                    disabled={i === slides.length - 1}
                    style={{ background: 'none', border: 'none', cursor: i === slides.length - 1 ? 'default' : 'pointer', color: C.text3, fontSize: 13, padding: '0 2px', opacity: i === slides.length - 1 ? 0.3 : 1 }}>↓</button>
                  <button onClick={e => { e.stopPropagation(); duplicateSlide(s.id) }}
                    title="Nhân đôi slide"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, fontSize: 12, padding: '0 3px', lineHeight: 1 }}
                    onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
                    onMouseLeave={e => (e.currentTarget.style.color = C.text3)}>⊕</button>
                  <button onClick={e => { e.stopPropagation(); removeSlide(s.id) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, fontSize: 15, padding: '0 3px', lineHeight: 1 }}
                    onMouseEnter={e => (e.currentTarget.style.color = C.danger)}
                    onMouseLeave={e => (e.currentTarget.style.color = C.text3)}>×</button>
                </div>

                {/* Inline slide editor */}
                {isEditing && editSlide && (
                  <div style={{ border: `1px solid ${C.accent}`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: 16, background: '#FAFBFF', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 4 }}>

                    {/* Logic + Type */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <Label>Logic</Label>
                        <Sel value={editSlide.logic} onChange={v => patch('logic', v)}>
                          {Object.entries(LOGIC_META).map(([k, m]) => (
                            <option key={k} value={k}>{m.label}</option>
                          ))}
                        </Sel>
                        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ background: lm!.bg, color: lm!.color, borderRadius: 99, padding: '3px 12px', fontSize: 11, fontWeight: 700 }}>{lm!.label}</span>
                        </div>
                      </div>
                      <div>
                        <Label>Loại slide</Label>
                        <Sel value={editSlide.type} onChange={v => patch('type', v)}>
                          {SLIDE_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
                        </Sel>
                      </div>
                    </div>

                    {/* Title */}
                    <div>
                      <Label>Tiêu đề slide</Label>
                      <Inp value={editSlide.title ?? ''} onChange={v => patch('title', v)} placeholder="VD: Câu hỏi số 1" />
                    </div>

                    {/* Content */}
                    {['text', 'callout', 'next', 'action', 'reward', 'quiz', 'true_false', 'input'].includes(editSlide.type) && (
                      <div>
                        <Label>Nội dung / Câu hỏi</Label>
                        <textarea value={editSlide.content ?? ''} onChange={e => patch('content', e.target.value)}
                          rows={3} placeholder="Nội dung hiển thị cho học viên..."
                          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', color: C.text1 }} />
                      </div>
                    )}

                    {/* Media URL — video/image */}
                    {['video', 'image'].includes(editSlide.type) && (
                      <div>
                        <Label>{editSlide.type === 'video' ? 'URL YouTube (embed)' : 'URL Ảnh'}</Label>
                        <Inp value={editSlide.mediaUrl ?? ''} onChange={v => patch('mediaUrl', v)}
                          placeholder={editSlide.type === 'video' ? 'https://www.youtube.com/embed/...' : 'https://...'} />
                        {editSlide.type === 'image' && (
                          <div style={{ marginTop: 6 }}>
                            <input type="file" accept="image/*" ref={fileRef} style={{ display: 'none' }}
                              onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]) }} />
                            <Btn onClick={() => { uploadTarget.current = editSlide.id; fileRef.current?.click() }}>
                              {uploadingId === editSlide.id ? '⏳ Đang tải...' : '📁 Tải ảnh lên'}
                            </Btn>
                            {editSlide.mediaUrl && (
                              <img src={editSlide.mediaUrl} alt="" style={{ marginTop: 8, maxWidth: '100%', maxHeight: 160, borderRadius: 8, display: 'block', objectFit: 'cover' }} />
                            )}
                          </div>
                        )}
                        {editSlide.type === 'video' && editSlide.mediaUrl && (
                          <div style={{ marginTop: 8, borderRadius: 8, overflow: 'hidden', background: '#000', aspectRatio: '16/9' }}>
                            <iframe src={editSlide.mediaUrl} style={{ width: '100%', height: '100%', border: 'none' }} allowFullScreen title="preview" />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Quiz options */}
                    {editSlide.type === 'quiz' && (
                      <div>
                        <Label>Đáp án (mỗi dòng 1 lựa chọn)</Label>
                        <textarea
                          value={(editSlide.options ?? []).join('\n')}
                          onChange={e => patch('options', e.target.value.split('\n'))}
                          rows={4} placeholder={'Đáp án A\nĐáp án B\nĐáp án C\nĐáp án D'}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', color: C.text1 }} />
                        <div style={{ marginTop: 8 }}>
                          <Label>Đáp án đúng</Label>
                          <Sel value={editSlide.correctAnswer ?? ''} onChange={v => patch('correctAnswer', v)}>
                            <option value="">— Chọn đáp án đúng —</option>
                            {(editSlide.options ?? []).filter(o => o.trim()).map((o, i) => (
                              <option key={i} value={o}>{String.fromCharCode(65 + i)}. {o}</option>
                            ))}
                          </Sel>
                        </div>
                      </div>
                    )}

                    {/* True/False */}
                    {editSlide.type === 'true_false' && (
                      <div>
                        <Label>Đáp án đúng</Label>
                        <Sel value={editSlide.correctAnswer ?? 'true'} onChange={v => patch('correctAnswer', v)}>
                          <option value="true">✓ Đúng</option>
                          <option value="false">✗ Sai</option>
                        </Sel>
                      </div>
                    )}

                    {/* CALLOUT — kiểu lời thầy / mẹo */}
                    {editSlide.type === 'callout' && (
                      <div>
                        <Label>Kiểu hộp</Label>
                        <Sel value={(itv.variant as string) ?? 'tip'} onChange={v => patchItv('variant', v)}>
                          <option value="tip">💡 Mẹo</option>
                          <option value="warn">⚠️ Lưu ý</option>
                          <option value="teacher">🧑‍🏫 Lời thầy Văn Anh</option>
                        </Sel>
                      </div>
                    )}

                    {/* NOTE CHART — không cần cấu hình */}
                    {editSlide.type === 'note_chart' && (
                      <div style={{ fontSize: 12, color: C.text3, background: '#FAFBFF', border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px' }}>
                        🎵 Bảng nốt C–B ↔ Đô–Si (cố định). Học viên chỉ xem — không cần cấu hình.
                      </div>
                    )}

                    {/* GUITAR_NECK — chọn 1 dây mục tiêu */}
                    {editSlide.type === 'guitar_neck' && (
                      <div>
                        <Label>Dây học viên phải chạm đúng</Label>
                        <StringPicker selected={[(itv.target as number) ?? 1]} onTap={n => patchItv('target', n)} />
                      </div>
                    )}

                    {/* GUITAR_STRUM — dãy dây cần gảy đúng thứ tự */}
                    {editSlide.type === 'guitar_strum' && (() => {
                      const seq = (itv.sequence as number[]) ?? []
                      return (
                        <div>
                          <Label>Dãy dây cần gảy (bấm theo thứ tự)</Label>
                          <div style={{ fontSize: 12, color: seq.length ? C.text1 : C.text3, marginBottom: 6 }}>
                            {seq.length ? 'Thứ tự: ' + seq.map(n => 'dây ' + n).join(' → ') : 'Chưa chọn → mặc định gảy buông dây 1 → 6'}
                          </div>
                          <StringPicker selected={seq} onTap={n => patchItv('sequence', [...seq, n])} />
                          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                            <Btn onClick={() => patchItv('sequence', [1, 2, 3, 4, 5, 6])}>Dây 1→6</Btn>
                            <Btn onClick={() => patchItv('sequence', [6, 5, 4, 3, 2, 1])}>Dây 6→1</Btn>
                            <Btn onClick={() => patchItv('sequence', [])}>Xoá</Btn>
                          </div>
                        </div>
                      )
                    })()}

                    {/* GUITAR_EAR — luyện tai nghe */}
                    {editSlide.type === 'guitar_ear' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                          <Label>Số câu</Label>
                          <input type="number" min={1} max={20} value={(itv.rounds as number) ?? 5}
                            onChange={e => patchItv('rounds', Number(e.target.value))}
                            style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, color: C.text1, fontFamily: 'inherit', outline: 'none' }} />
                        </div>
                        <div style={{ alignSelf: 'end', fontSize: 11.5, color: C.text3, paddingBottom: 7 }}>Nghe âm → đoán dây (cả 6 dây)</div>
                      </div>
                    )}

                    {/* GUITAR_TOOL — mở công cụ */}
                    {editSlide.type === 'guitar_tool' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div>
                          <Label>Công cụ</Label>
                          <Sel value={(itv.tool as string) ?? 'tuner'} onChange={v => patchItv('tool', v)}>
                            <option value="tuner">🎚️ Tuner (lên dây)</option>
                            <option value="tempo">🥁 Metronome (nhịp)</option>
                            <option value="guitarboard">🎸 Bảng phím / Tab</option>
                          </Sel>
                        </div>
                        <div>
                          <Label>Nhãn nút</Label>
                          <Inp value={(itv.label as string) ?? ''} onChange={v => patchItv('label', v)} placeholder="VD: Mở Tuner lên dây" />
                        </div>
                        <div>
                          <Label>Mô tả nhỏ (tuỳ chọn)</Label>
                          <Inp value={(itv.sub as string) ?? ''} onChange={v => patchItv('sub', v)} placeholder="VD: Lên dây chuẩn trước khi tập" />
                        </div>
                      </div>
                    )}

                    {/* CHECKLIST — tự đánh giá */}
                    {editSlide.type === 'checklist' && (
                      <div>
                        <Label>Mục tự đánh giá (mỗi dòng 1 mục)</Label>
                        <textarea
                          value={((itv.items as string[]) ?? []).join('\n')}
                          onChange={e => patchItv('items', e.target.value.split('\n'))}
                          rows={4} placeholder={'Tay phải thả lỏng\nTiếng đàn nghe rõ'}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', color: C.text1 }} />
                        <label style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, fontSize: 12.5, color: C.text2, cursor: 'pointer' }}>
                          <input type="checkbox" checked={(itv.requireAll as boolean) !== false}
                            onChange={e => patchItv('requireAll', e.target.checked)} />
                          Phải tick HẾT mới qua (bỏ chọn = chỉ cần tick 1 mục)
                        </label>
                      </div>
                    )}

                    {/* Button text — action / next */}
                    {['action', 'next'].includes(editSlide.type) && (
                      <div>
                        <Label>Text nút bấm</Label>
                        <Inp value={editSlide.buttonText ?? ''} onChange={v => patch('buttonText', v)}
                          placeholder={editSlide.type === 'action' ? 'VD: ✓ Tôi đã làm xong' : 'VD: Tiếp tục →'} />
                      </div>
                    )}

                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Save + Preview ── */}
      <div style={{ paddingTop: 4, borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {slides.length > 0 && (
            <Btn onClick={() => setShowPreview(true)} style={{ flexShrink: 0 }}>👁 Xem thử</Btn>
          )}
          <Btn variant="primary" onClick={save} style={{ flex: 1, justifyContent: 'center', padding: 10 }}>
            {saving ? '⏳ Đang lưu...' : '💾 Lưu Flow'}
          </Btn>
        </div>
        {flowId && <div style={{ textAlign: 'center', fontSize: 11, color: C.success, marginTop: 6 }}>✓ Flow đã tồn tại · {slides.length} slides</div>}
      </div>

      {/* ── Preview modal ── */}
      {showPreview && (
        <div onClick={() => setShowPreview(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: 390, maxHeight: '90vh', background: '#fff', borderRadius: 24, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #EEE', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: C.text1 }}>📱 Xem thử — {flowTitle || 'Flow chưa lưu'}</span>
              <button onClick={() => setShowPreview(false)}
                style={{ background: '#F4F4F5', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: C.text2 }}>
                Đóng ✕
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <FlowPlayer
                lessonId={lessonId}
                studentId="__preview__"
                onComplete={() => setShowPreview(false)}
                onBack={() => setShowPreview(false)}
                previewFlow={{ id: '__preview__', title: flowTitle, reward_xp: rewardXp, slides: slides.map((s, i) => ({ ...s, order: i + 1 })) }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Import JSON modal ── */}
      {showImport && (
        <div onClick={() => setShowImport(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: C.surface, borderRadius: 14, padding: 24, width: 520, maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>📋 Import slides từ JSON</div>
            <div style={{ fontSize: 12, color: C.text3, marginBottom: 10 }}>
              Dán JSON từ ChatGPT hoặc chọn file <code>.json</code> từ máy tính.
            </div>

            {/* Nút chọn file */}
            <input ref={jsonFileRef} type="file" accept=".json,application/json" style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = ev => {
                  setImportText(String(ev.target?.result ?? ''))
                  setImportError('')
                }
                reader.readAsText(file)
                e.target.value = ''
              }} />
            <button onClick={() => jsonFileRef.current?.click()}
              style={{ width: '100%', padding: '9px 0', marginBottom: 10, border: `1.5px dashed ${C.border}`, borderRadius: 8, background: '#FAFBFF', color: C.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              📁 Chọn file .json từ máy tính
            </button>

            <textarea value={importText} onChange={e => { setImportText(e.target.value); setImportError('') }} rows={9}
              placeholder={'[\n  { "logic": "NHAN", "type": "text", "title": "...", "content": "..." },\n  ...\n]'}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: `1px solid ${importError ? C.danger : C.border}`, borderRadius: 8, fontSize: 12, fontFamily: 'ui-monospace, monospace', outline: 'none', resize: 'vertical', color: C.text1 }} />
            {importText && !importError && (
              <div style={{ fontSize: 11, color: C.success, marginTop: 4 }}>✓ Đã có nội dung — bấm "Nhập slides" để import</div>
            )}
            {importError && <div style={{ color: C.danger, fontSize: 12, marginTop: 6 }}>{importError}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <Btn onClick={() => { setShowImport(false); setImportText(''); setImportError('') }}>Huỷ</Btn>
              <Btn variant="primary" onClick={doImport}>Nhập slides</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
