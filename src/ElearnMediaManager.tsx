import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

const COURSE_SLUG = 'khoi-dau-dam-me'

const LESSONS_INFO = [
  { num: 1,  title: 'Chọn cây đàn phù hợp' },
  { num: 2,  title: 'Kiểm tra đàn trước khi học' },
  { num: 3,  title: 'Các bộ phận của đàn' },
  { num: 4,  title: 'Tên 6 dây đàn' },
  { num: 5,  title: 'Chỉnh dây bằng tuner' },
  { num: 6,  title: 'Tư thế ngồi & đặt đàn' },
  { num: 7,  title: 'Đặt tay trái lên cần đàn' },
  { num: 8,  title: 'Gảy dây cho đàn kêu rõ' },
  { num: 9,  title: 'Cầm pick / dùng ngón phải' },
  { num: 10, title: 'Góc học & thói quen tập' },
  { num: 11, title: 'Đặt tinh thần cho khoá học' },
]

type MediaRow = { youtube_id?: string | null; video_url?: string | null }

function extractYouTubeId(input: string): string | null {
  const s = input.trim()
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s
  const short = s.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
  if (short) return short[1]
  const long = s.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
  if (long) return long[1]
  return null
}

const S = {
  accent: '#4F46E5', accentLight: '#EEF2FF',
  border: '#E4E4E7', text1: '#18181B', text2: '#52525B', text3: '#A1A1AA',
  bg: '#F4F4F5', surface: '#FFFFFF', green: '#16A34A', greenBg: '#F0FDF4',
  red: '#DC2626', redBg: '#FEF2F2',
}

export default function ElearnMediaManager() {
  const [media, setMedia] = useState<Record<number, MediaRow>>({})
  const [expanded, setExpanded] = useState<number | null>(null)
  const [tab, setTab] = useState<'youtube' | 'upload'>('youtube')
  const [ytInput, setYtInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [bucketError, setBucketError] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('elearn_media')
      .select('lesson_num, youtube_id, video_url')
      .eq('course_slug', COURSE_SLUG)
    if (data) {
      const m: Record<number, MediaRow> = {}
      data.forEach((r: any) => { m[r.lesson_num] = r })
      setMedia(m)
    }
  }

  function openLesson(num: number) {
    if (expanded === num) { setExpanded(null); return }
    const cur = media[num] || {}
    setExpanded(num)
    setYtInput(cur.youtube_id ? `https://youtu.be/${cur.youtube_id}` : '')
    setMsg(null)
    setUploadProgress(null)
    setTab(cur.video_url && !cur.youtube_id ? 'upload' : 'youtube')
  }

  async function saveYoutube(num: number) {
    const id = extractYouTubeId(ytInput)
    if (!id) { setMsg({ text: 'URL YouTube không hợp lệ', ok: false }); return }
    setSaving(true); setMsg(null)
    const { error } = await supabase.from('elearn_media').upsert(
      { course_slug: COURSE_SLUG, lesson_num: num, youtube_id: id, video_url: null },
      { onConflict: 'course_slug,lesson_num' }
    )
    setSaving(false)
    if (error) setMsg({ text: error.message, ok: false })
    else { setMsg({ text: 'Đã lưu ✓', ok: true }); load() }
  }

  async function handleUpload(num: number, file: File) {
    // Check file size (max 200MB)
    if (file.size > 200 * 1024 * 1024) {
      setMsg({ text: 'File quá lớn (tối đa 200MB)', ok: false }); return
    }
    setUploading(true); setMsg(null); setBucketError(false)
    setUploadProgress('Đang tải lên...')
    const ext = file.name.split('.').pop()
    const path = `${COURSE_SLUG}/lesson-${num}-${Date.now()}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('elearn-videos')
      .upload(path, file, { upsert: true, cacheControl: '3600' })

    if (upErr) {
      setUploading(false); setUploadProgress(null)
      if (upErr.message.includes('Bucket not found') || upErr.message.includes('bucket')) {
        setBucketError(true)
        setMsg({ text: 'Chưa tạo bucket "elearn-videos" trong Supabase Storage', ok: false })
      } else {
        setMsg({ text: upErr.message, ok: false })
      }
      return
    }

    const { data: urlData } = supabase.storage.from('elearn-videos').getPublicUrl(path)
    setUploadProgress('Đang lưu link...')

    const { error: dbErr } = await supabase.from('elearn_media').upsert(
      { course_slug: COURSE_SLUG, lesson_num: num, video_url: urlData.publicUrl, youtube_id: null },
      { onConflict: 'course_slug,lesson_num' }
    )
    setUploading(false); setUploadProgress(null)
    if (dbErr) setMsg({ text: dbErr.message, ok: false })
    else { setMsg({ text: 'Đã tải lên & lưu ✓', ok: true }); load() }
  }

  async function clearMedia(num: number) {
    await supabase.from('elearn_media')
      .delete().eq('course_slug', COURSE_SLUG).eq('lesson_num', num)
    setMedia(m => { const n = { ...m }; delete n[num]; return n })
    setExpanded(null)
  }

  const cur = expanded !== null ? (media[expanded] || {}) : {}
  const hasYt = !!(cur as MediaRow).youtube_id
  const hasVid = !!(cur as MediaRow).video_url

  return (
    <div style={{ padding: '28px 32px', background: S.bg, minHeight: '100%' }}>
      <div style={{ maxWidth: 720 }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: S.text1, marginBottom: 4 }}>
            🎬 Media bài học — Khởi Đầu Đam Mê
          </div>
          <div style={{ fontSize: 13.5, color: S.text2, lineHeight: 1.5 }}>
            Chèn video YouTube hoặc tải video lên cho từng bài. Elearn sẽ hiển thị ngay khi học viên vào bài.
          </div>
        </div>

        {/* SQL notice */}
        <div style={{ marginBottom: 20, padding: '14px 16px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, fontSize: 12.5, color: '#92400E', lineHeight: 1.6 }}>
          <b>Cần chạy SQL một lần</b> nếu chưa tạo bảng:
          <code style={{ display: 'block', marginTop: 8, padding: '10px 12px', background: '#FEF3C7', borderRadius: 8, fontSize: 11.5, fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#78350F' }}>{`create table if not exists elearn_media (
  id serial primary key,
  course_slug text not null,
  lesson_num int not null,
  youtube_id text,
  video_url text,
  updated_at timestamptz default now(),
  unique(course_slug, lesson_num)
);
alter table elearn_media enable row level security;
create policy "anon read" on elearn_media for select using (true);
create policy "auth all" on elearn_media for all using (auth.role() = 'authenticated');
NOTIFY pgrst, 'reload schema';`}</code>
          <div style={{ marginTop: 8 }}>Và tạo bucket <b>elearn-videos</b> (Public) trong <b>Supabase → Storage</b>.</div>
        </div>

        {/* Lesson list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {LESSONS_INFO.map(({ num, title }) => {
            const m = media[num]
            const hasMedia = m && (m.youtube_id || m.video_url)
            const isOpen = expanded === num

            return (
              <div key={num} style={{ background: S.surface, border: `1px solid ${isOpen ? S.accent : S.border}`, borderRadius: 14, overflow: 'hidden', transition: 'border-color .15s' }}>
                {/* Row */}
                <button
                  onClick={() => openLesson(num)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                >
                  <div style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 9, background: hasMedia ? S.accent : '#F1F1F5', color: hasMedia ? '#fff' : S.text3, fontSize: 12.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {hasMedia ? '▶' : num}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: S.text1, lineHeight: 1.3 }}>Bài {num} · {title}</div>
                    {hasMedia && (
                      <div style={{ fontSize: 11.5, color: m.youtube_id ? S.accent : S.green, fontWeight: 600, marginTop: 2 }}>
                        {m.youtube_id ? `YouTube: ${m.youtube_id}` : '📁 Video đã tải lên'}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: isOpen ? S.accent : S.text3, fontWeight: 700 }}>{isOpen ? '▲' : '▼'}</div>
                </button>

                {/* Expanded panel */}
                {isOpen && (
                  <div style={{ padding: '0 16px 18px', borderTop: `1px solid ${S.border}` }}>
                    {/* Preview current media */}
                    {(hasYt || hasVid) && (
                      <div style={{ marginTop: 14, marginBottom: 14 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: S.text3, marginBottom: 8 }}>ĐANG HIỂN THỊ</div>
                        {hasYt && (
                          <div style={{ position: 'relative', paddingBottom: '56.25%', background: '#000', borderRadius: 10, overflow: 'hidden' }}>
                            <iframe
                              src={`https://www.youtube.com/embed/${cur.youtube_id}`}
                              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        )}
                        {hasVid && !hasYt && (
                          <video
                            src={(cur as MediaRow).video_url!}
                            controls
                            style={{ width: '100%', borderRadius: 10, background: '#000', maxHeight: 260 }}
                          />
                        )}
                        <button
                          onClick={() => clearMedia(num)}
                          style={{ marginTop: 8, padding: '6px 12px', border: '1px solid #FCA5A5', borderRadius: 8, background: S.redBg, color: S.red, fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Xoá media này
                        </button>
                      </div>
                    )}

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: 6, marginTop: hasYt || hasVid ? 0 : 14, marginBottom: 14 }}>
                      {(['youtube', 'upload'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => { setTab(t); setMsg(null) }}
                          style={{ padding: '7px 16px', borderRadius: 8, border: `1.5px solid ${tab === t ? S.accent : S.border}`, background: tab === t ? S.accentLight : S.surface, color: tab === t ? S.accent : S.text2, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                        >
                          {t === 'youtube' ? '▶ YouTube' : '📁 Tải video lên'}
                        </button>
                      ))}
                    </div>

                    {/* YouTube tab */}
                    {tab === 'youtube' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ fontSize: 12.5, color: S.text2 }}>Dán link YouTube hoặc ID video (11 ký tự):</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            value={ytInput}
                            onChange={e => setYtInput(e.target.value)}
                            placeholder="https://youtu.be/... hoặc dxT7s1Ai7XA"
                            style={{ flex: 1, padding: '10px 13px', border: `1px solid ${S.border}`, borderRadius: 9, fontFamily: 'inherit', fontSize: 13.5, outline: 'none', color: S.text1 }}
                            onKeyDown={e => e.key === 'Enter' && saveYoutube(num)}
                          />
                          <button
                            onClick={() => saveYoutube(num)}
                            disabled={saving || !ytInput.trim()}
                            style={{ padding: '10px 18px', border: 'none', borderRadius: 9, background: saving ? '#C7D2FE' : S.accent, color: '#fff', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: saving ? 'default' : 'pointer', flexShrink: 0 }}
                          >
                            {saving ? 'Đang lưu...' : 'Lưu'}
                          </button>
                        </div>
                        {ytInput && extractYouTubeId(ytInput) && (
                          <div style={{ fontSize: 12, color: S.green }}>✓ ID: <b>{extractYouTubeId(ytInput)}</b></div>
                        )}
                        {ytInput && !extractYouTubeId(ytInput) && (
                          <div style={{ fontSize: 12, color: S.red }}>Không nhận ra link này</div>
                        )}
                      </div>
                    )}

                    {/* Upload tab */}
                    {tab === 'upload' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {bucketError && (
                          <div style={{ padding: '10px 13px', background: S.redBg, border: '1px solid #FCA5A5', borderRadius: 9, fontSize: 12.5, color: S.red, lineHeight: 1.5 }}>
                            <b>Chưa tạo bucket.</b> Vào <b>Supabase → Storage → New bucket</b>, đặt tên <b>elearn-videos</b>, bật Public.
                          </div>
                        )}
                        <div style={{ fontSize: 12.5, color: S.text2 }}>Chọn file video (MP4, MOV, WebM — tối đa 200MB):</div>
                        <input
                          ref={fileRef}
                          type="file"
                          accept="video/*"
                          style={{ display: 'none' }}
                          onChange={e => {
                            const f = e.target.files?.[0]
                            if (f) handleUpload(num, f)
                            e.target.value = ''
                          }}
                        />
                        <button
                          onClick={() => fileRef.current?.click()}
                          disabled={uploading}
                          style={{ padding: '12px 0', border: `2px dashed ${uploading ? '#C7D2FE' : S.border}`, borderRadius: 12, background: '#FAFAFA', color: uploading ? S.accent : S.text2, fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: uploading ? 'default' : 'pointer', textAlign: 'center' }}
                        >
                          {uploading ? (uploadProgress || 'Đang tải...') : '+ Chọn file video'}
                        </button>
                        <div style={{ fontSize: 11.5, color: S.text3 }}>Video sẽ được lưu vào Supabase Storage (bucket: elearn-videos)</div>
                      </div>
                    )}

                    {/* Message */}
                    {msg && (
                      <div style={{ marginTop: 10, padding: '9px 13px', borderRadius: 9, background: msg.ok ? S.greenBg : S.redBg, color: msg.ok ? S.green : S.red, fontSize: 13, fontWeight: 600 }}>
                        {msg.text}
                      </div>
                    )}
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
