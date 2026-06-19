import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { LESSONS } from './elearn/data'

const COURSE_SLUG = 'khoi-dau-dam-me'
const ELEARN_URL = '/lessons/khoi-dau-dam-me.html'

const THAO_OPTS: { id: string; label: string; desc: string }[] = [
  { id: 'check',   label: '✅ Tự đánh giá',   desc: 'Danh sách mục để học viên tự tick' },
  { id: 'neck',    label: '🎸 Chọn dây',       desc: 'Học viên chạm đúng dây số 1' },
  { id: 'tool',    label: '🎚️ Mở công cụ',     desc: 'Nút mở Tuner của app' },
  { id: 'listen8', label: '👂 Gảy & tai nghe', desc: 'Gảy đúng dây + luyện nhận diện âm' },
]

interface Draft {
  title: string
  goal: string
  steps: string       // mỗi dòng = 1 bước
  prompt: string
  thao_type: string
  items: string       // mỗi dòng = 1 mục
  youtube_id: string
  video_url: string
}

interface CourseLesson { id: string; title: string; num: number }

const S = {
  accent: '#4F46E5', accentLight: '#EEF2FF',
  border: '#E4E4E7', text1: '#18181B', text2: '#52525B', text3: '#A1A1AA',
  bg: '#F4F4F5', surface: '#FFFFFF', green: '#16A34A', greenBg: '#F0FDF4',
  red: '#DC2626', redBg: '#FEF2F2',
}

function extractYouTubeId(input: string): string | null {
  const s = input.trim()
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s
  const short = s.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
  if (short) return short[1]
  const long = s.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
  if (long) return long[1]
  return null
}

const lines = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean)

export default function ElearnLessonsManager() {
  const [lessonMap, setLessonMap] = useState<Record<number, CourseLesson>>({})   // num → edu_course_lessons
  const [cfgMap, setCfgMap] = useState<Record<number, any>>({})                   // num → elearn_lessons
  const [expanded, setExpanded] = useState<number | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [mediaTab, setMediaTab] = useState<'youtube' | 'upload'>('youtube')
  const [ytInput, setYtInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [bucketError, setBucketError] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: lsns }, { data: cfgs }] = await Promise.all([
      supabase.from('edu_course_lessons').select('id,title,content').eq('content_url', ELEARN_URL),
      supabase.from('elearn_lessons').select('*').eq('course_slug', COURSE_SLUG),
    ])
    const lm: Record<number, CourseLesson> = {}
    ;(lsns ?? []).forEach((l: any) => {
      try {
        const c = typeof l.content === 'string' ? JSON.parse(l.content) : l.content
        if (c?.elearn && c?.num) lm[c.num] = { id: l.id, title: l.title, num: c.num }
      } catch { /* bỏ qua */ }
    })
    setLessonMap(lm)
    const cm: Record<number, any> = {}
    ;(cfgs ?? []).forEach((r: any) => { cm[r.lesson_num] = r })
    setCfgMap(cm)
  }

  function openLesson(num: number) {
    if (expanded === num) { setExpanded(null); setDraft(null); return }
    const def = LESSONS[num]
    const cfg = cfgMap[num]
    const cl = lessonMap[num]
    const d: Draft = {
      title: cl?.title ?? def.title,
      goal: cfg?.goal ?? def.goal,
      steps: ((cfg?.steps?.length ? cfg.steps : def.steps) ?? []).join('\n'),
      prompt: cfg?.prompt ?? def.prompt,
      thao_type: cfg?.thao_type ?? def.thao.type,
      items: ((cfg?.items?.length ? cfg.items : def.thao.items) ?? []).join('\n'),
      youtube_id: cfg?.youtube_id ?? '',
      video_url: cfg?.video_url ?? '',
    }
    setDraft(d)
    setYtInput(d.youtube_id ? `https://youtu.be/${d.youtube_id}` : '')
    setMediaTab(d.video_url && !d.youtube_id ? 'upload' : 'youtube')
    setExpanded(num)
    setMsg(null); setBucketError(false)
  }

  function patch(p: Partial<Draft>) { setDraft(d => (d ? { ...d, ...p } : d)) }

  async function save(num: number) {
    if (!draft) return
    setSaving(true); setMsg(null)
    // 1. Cập nhật tiêu đề bài (bảng edu_course_lessons)
    const cl = lessonMap[num]
    if (cl && draft.title.trim() && draft.title.trim() !== cl.title) {
      await supabase.from('edu_course_lessons').update({ title: draft.title.trim() }).eq('id', cl.id)
    }
    // 2. Lưu nội dung + media (bảng elearn_lessons)
    const yt = ytInput.trim() ? extractYouTubeId(ytInput) : null
    const { error } = await supabase.from('elearn_lessons').upsert({
      course_slug: COURSE_SLUG, lesson_num: num,
      goal: draft.goal.trim() || null,
      steps: lines(draft.steps),
      prompt: draft.prompt.trim() || null,
      thao_type: draft.thao_type,
      items: draft.thao_type === 'check' ? lines(draft.items) : [],
      youtube_id: mediaTab === 'youtube' ? yt : null,
      video_url: mediaTab === 'upload' ? (draft.video_url || null) : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'course_slug,lesson_num' })
    setSaving(false)
    if (error) {
      if (error.message.includes('elearn_lessons')) setMsg({ text: 'Chưa tạo bảng elearn_lessons — chạy SQL bên dưới trước.', ok: false })
      else setMsg({ text: error.message, ok: false })
      return
    }
    setMsg({ text: 'Đã lưu ✓', ok: true })
    load()
  }

  async function handleUpload(num: number, file: File) {
    if (file.size > 200 * 1024 * 1024) { setMsg({ text: 'File quá lớn (tối đa 200MB)', ok: false }); return }
    setUploading(true); setMsg(null); setBucketError(false)
    const ext = file.name.split('.').pop()
    const path = `${COURSE_SLUG}/lesson-${num}-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('elearn-videos').upload(path, file, { upsert: true, cacheControl: '3600' })
    if (upErr) {
      setUploading(false)
      if (upErr.message.toLowerCase().includes('bucket')) { setBucketError(true); setMsg({ text: 'Chưa tạo bucket "elearn-videos" trong Supabase Storage', ok: false }) }
      else setMsg({ text: upErr.message, ok: false })
      return
    }
    const { data: urlData } = supabase.storage.from('elearn-videos').getPublicUrl(path)
    patch({ video_url: urlData.publicUrl, youtube_id: '' })
    setMediaTab('upload')
    setUploading(false)
    setMsg({ text: 'Đã tải video lên — nhớ bấm "Lưu bài" để áp dụng.', ok: true })
  }

  async function clearMedia() { patch({ youtube_id: '', video_url: '' }); setYtInput('') }

  return (
    <div style={{ padding: '28px 32px', background: S.bg, minHeight: '100%' }}>
      <div style={{ maxWidth: 760 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: S.text1, marginBottom: 4 }}>🎬 Bài Elearn — Khởi Đầu Đam Mê</div>
          <div style={{ fontSize: 14.5, color: S.text2, lineHeight: 1.5 }}>
            Soạn nội dung từng bài: mục tiêu, các bước, loại tương tác, mục tự đánh giá, và video. App học viên đọc trực tiếp từ đây.
          </div>
        </div>

        {/* SQL notice */}
        <details style={{ marginBottom: 18, padding: '12px 16px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, fontSize: 13.5, color: '#92400E' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>⚙️ Lần đầu: chạy SQL tạo bảng + tạo bucket video (bấm để xem)</summary>
          <code style={{ display: 'block', marginTop: 8, padding: '10px 12px', background: '#FEF3C7', borderRadius: 8, fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#78350F' }}>{`create table if not exists elearn_lessons (
  id serial primary key, course_slug text not null, lesson_num int not null,
  goal text, steps jsonb default '[]', prompt text, thao_type text,
  items jsonb default '[]', youtube_id text, video_url text,
  updated_at timestamptz default now(), unique(course_slug, lesson_num));
alter table elearn_lessons enable row level security;
create policy "r" on elearn_lessons for select using (true);
create policy "w" on elearn_lessons for all using (auth.role()='authenticated') with check (auth.role()='authenticated');
NOTIFY pgrst, 'reload schema';`}</code>
          <div style={{ marginTop: 8 }}>Và tạo bucket <b>elearn-videos</b> (Public) trong <b>Supabase → Storage</b> (chỉ cần nếu tải video lên).</div>
        </details>

        {/* Lesson list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(num => {
            const cl = lessonMap[num]
            const cfg = cfgMap[num]
            const hasCfg = !!cfg
            const hasMedia = cfg && (cfg.youtube_id || cfg.video_url)
            const isOpen = expanded === num
            const title = cl?.title ?? LESSONS[num].title
            return (
              <div key={num} style={{ background: S.surface, border: `1px solid ${isOpen ? S.accent : S.border}`, borderRadius: 14, overflow: 'hidden' }}>
                <button onClick={() => openLesson(num)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                  <div style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 9, background: hasCfg ? S.accent : '#F1F1F5', color: hasCfg ? '#fff' : S.text3, fontSize: 13.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{num}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: S.text1, lineHeight: 1.3 }}>Bài {num} · {title}</div>
                    <div style={{ fontSize: 12.5, color: S.text3, marginTop: 2 }}>
                      {hasCfg ? 'Đã soạn riêng' : 'Đang dùng mặc định (code)'}{hasMedia ? ' · 🎬 có video' : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: isOpen ? S.accent : S.text3, fontWeight: 700 }}>{isOpen ? '▲' : '▼'}</div>
                </button>

                {isOpen && draft && (
                  <div style={{ padding: '4px 16px 18px', borderTop: `1px solid ${S.border}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {fieldLabel('Tiêu đề bài')}
                    <input value={draft.title} onChange={e => patch({ title: e.target.value })} style={inputStyle} />

                    {fieldLabel('🎯 Mục tiêu')}
                    <textarea value={draft.goal} onChange={e => patch({ goal: e.target.value })} rows={2} style={areaStyle} />

                    {fieldLabel('Các bước (mỗi dòng 1 bước)')}
                    <textarea value={draft.steps} onChange={e => patch({ steps: e.target.value })} rows={4} style={areaStyle} />

                    {fieldLabel('Câu nhắc thao tác')}
                    <input value={draft.prompt} onChange={e => patch({ prompt: e.target.value })} style={inputStyle} />

                    {fieldLabel('Loại tương tác')}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {THAO_OPTS.map(o => (
                        <button key={o.id} onClick={() => patch({ thao_type: o.id })}
                          style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${draft.thao_type === o.id ? S.accent : S.border}`, background: draft.thao_type === o.id ? S.accentLight : S.surface, cursor: 'pointer', fontFamily: 'inherit' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: draft.thao_type === o.id ? S.accent : S.text1 }}>{o.label}</div>
                          <div style={{ fontSize: 12, color: S.text3, marginTop: 2 }}>{o.desc}</div>
                        </button>
                      ))}
                    </div>

                    {draft.thao_type === 'check' && (
                      <>
                        {fieldLabel('Mục tự đánh giá (mỗi dòng 1 mục)')}
                        <textarea value={draft.items} onChange={e => patch({ items: e.target.value })} rows={3} style={areaStyle} />
                      </>
                    )}

                    {/* Media */}
                    {fieldLabel('Video bài học (tùy chọn)')}
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['youtube', 'upload'] as const).map(t => (
                        <button key={t} onClick={() => setMediaTab(t)} style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${mediaTab === t ? S.accent : S.border}`, background: mediaTab === t ? S.accentLight : S.surface, color: mediaTab === t ? S.accent : S.text2, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
                          {t === 'youtube' ? '▶ YouTube' : '📁 Tải lên'}
                        </button>
                      ))}
                      {(draft.youtube_id || draft.video_url) && (
                        <button onClick={clearMedia} style={{ marginLeft: 'auto', padding: '6px 12px', border: '1px solid #FCA5A5', borderRadius: 8, background: S.redBg, color: S.red, fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Xoá video</button>
                      )}
                    </div>
                    {mediaTab === 'youtube' ? (
                      <input value={ytInput} onChange={e => setYtInput(e.target.value)} placeholder="https://youtu.be/... hoặc ID 11 ký tự" style={inputStyle} />
                    ) : (
                      <div>
                        {bucketError && <div style={{ padding: '9px 12px', background: S.redBg, border: '1px solid #FCA5A5', borderRadius: 9, fontSize: 13, color: S.red, marginBottom: 8 }}>Chưa tạo bucket <b>elearn-videos</b> (Public) trong Supabase → Storage.</div>}
                        <input ref={fileRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(num, f); e.target.value = '' }} />
                        <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ width: '100%', padding: '11px 0', border: `2px dashed ${S.border}`, borderRadius: 10, background: '#FAFAFA', color: uploading ? S.accent : S.text2, fontFamily: 'inherit', fontSize: 14.5, fontWeight: 600, cursor: 'pointer' }}>
                          {uploading ? 'Đang tải...' : draft.video_url ? '✓ Đã có video — chọn file khác' : '+ Chọn file video (≤200MB)'}
                        </button>
                      </div>
                    )}

                    {/* Save */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                      <button onClick={() => save(num)} disabled={saving} style={{ padding: '11px 22px', border: 'none', borderRadius: 10, background: saving ? '#C7D2FE' : S.accent, color: '#fff', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>
                        {saving ? 'Đang lưu...' : '💾 Lưu bài'}
                      </button>
                      {msg && <div style={{ fontSize: 14, fontWeight: 600, color: msg.ok ? S.green : S.red }}>{msg.text}</div>}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function fieldLabel(t: string) {
  return <div style={{ fontSize: 13, fontWeight: 700, color: S.text2, marginBottom: -6 }}>{t}</div>
}
const inputStyle: React.CSSProperties = { padding: '10px 13px', border: `1px solid ${S.border}`, borderRadius: 9, fontFamily: 'inherit', fontSize: 14.5, outline: 'none', color: S.text1, width: '100%' }
const areaStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical', lineHeight: 1.5 }
