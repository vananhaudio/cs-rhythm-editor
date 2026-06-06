import { useState, useRef, useEffect } from 'react'
import { supabase } from './supabase'

const YT_API_KEY = 'AIzaSyA6kg3G2CVZ7b_x8IAlkZJCOa4AJHyWHms'

interface YTResult {
  id: string
  title: string
  channel: string
  thumbnail: string
}

const L = {
  bg:      '#0D0F14',
  surface: '#141720',
  surface2:'#1A1E2A',
  border:  'rgba(255,255,255,0.08)',
  p1:      '#6C63FF',
  p2:      'rgba(108,99,255,0.15)',
  t1:      '#F1F5F9',
  t2:      'rgba(255,255,255,0.55)',
  t3:      'rgba(255,255,255,0.3)',
  green:   '#10B981',
  gold:    '#FCD34D',
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

interface Props {
  onClose?: () => void
  onSaved?: (songId: string) => void
}

export default function TapTempoTool({ onClose, onSaved }: Props) {
  // Đọc params từ URL (truyền từ carousel bài hát)
  const urlParams  = new URLSearchParams(window.location.search)
  const preTitle   = urlParams.get('title') ?? ''
  const preYoutube = urlParams.get('youtube') ?? ''
  const preSongId  = urlParams.get('songId') ?? ''   // có → journey mode: UPDATE thay vì INSERT

  const [url, setUrl]             = useState(preYoutube)
  const [videoId, setVideoId]     = useState<string | null>(null)
  const [bpm, setBpm]             = useState<number | null>(null)
  const [tapCount, setTapCount]   = useState(0)
  const [showSave, setShowSave]   = useState(false)
  const [title, setTitle]         = useState(preTitle)
  const [artist, setArtist]       = useState('')
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [query, setQuery]         = useState(preTitle)
  const [results, setResults]     = useState<YTResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  const tapTimesRef = useRef<number[]>([])
  const tapTORef    = useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchYouTube = async (q: string) => {
    if (!q.trim()) return
    setSearching(true)
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=8&q=${encodeURIComponent(q)}&key=${YT_API_KEY}`
      )
      const data = await res.json()
      setResults((data.items ?? []).map((item: any) => ({
        id:        item.id.videoId,
        title:     item.snippet.title,
        channel:   item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.medium?.url ?? item.snippet.thumbnails.default?.url,
      })))
    } catch (e) {
      console.error(e)
    }
    setSearching(false)
  }

  const selectVideo = (r: YTResult) => {
    setVideoId(r.id)
    setUrl(`https://youtube.com/watch?v=${r.id}`)
    setTitle(r.title)
    setResults([])
    setQuery('')
    setShowSearch(false)
  }

  useEffect(() => {
    const id = extractVideoId(url.trim())
    setVideoId(id)
  }, [url])

  const tap = () => {
    const now = Date.now()
    if (tapTimesRef.current.length > 0 && now - tapTimesRef.current.at(-1)! > 3000) {
      tapTimesRef.current = []
    }
    tapTimesRef.current.push(now)
    setTapCount(tapTimesRef.current.length)
    if (tapTimesRef.current.length >= 2) {
      const diffs = tapTimesRef.current.slice(1).map((v, i) => v - tapTimesRef.current[i])
      const avg   = diffs.reduce((a, b) => a + b, 0) / diffs.length
      setBpm(Math.round(60000 / avg))
    }
    if (tapTORef.current) clearTimeout(tapTORef.current)
    tapTORef.current = setTimeout(() => {
      tapTimesRef.current = []
      setTapCount(0)
    }, 3000)
  }

  const reset = () => {
    tapTimesRef.current = []
    setTapCount(0)
    setBpm(null)
  }

  const handleSave = async () => {
    if (!bpm) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    if (preSongId) {
      // Journey mode: cập nhật bài đã có, không tạo mới
      const { error } = await supabase.from('student_songs')
        .update({ tempo: bpm, youtube_url: url.trim() || null })
        .eq('id', preSongId)
      if (!error) { setSaved(true); setShowSave(false); onSaved?.(preSongId) }
    } else {
      // Standalone mode: tạo bài mới
      if (!title.trim()) { setSaving(false); return }
      const { data: student } = await supabase.from('edu_students')
        .select('id').eq('user_id', user.id).single()
      if (!student) { setSaving(false); return }
      const { data, error } = await supabase.from('student_songs').insert({
        student_id:    student.id,
        title:         title.trim(),
        artist:        artist.trim() || null,
        youtube_url:   url.trim() || null,
        tempo:         bpm,
        time_signature:'4/4',
        status:        'tempo',
      }).select('id').single()
      if (!error && data) { setSaved(true); setShowSave(false); onSaved?.(data.id) }
    }
    setSaving(false)
  }

  return (
    <div style={{ minHeight: '100dvh', background: L.bg, color: L.t1, fontFamily: '"SF Pro Display", system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ background: L.surface, borderBottom: `1px solid ${L.border}`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        {onClose && (
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 10, width: 36, height: 36, color: L.t2, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
        )}
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>🥁 Tap Tempo</div>
          <div style={{ fontSize: 11, color: L.t3 }}>Tìm nhịp bài hát yêu thích</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

        {/* Search / URL input */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button onClick={() => setShowSearch(false)}
              style={{ flex: 1, padding: '8px', borderRadius: 10, border: `1px solid ${!showSearch ? L.p1 : L.border}`, background: !showSearch ? L.p2 : 'none', color: !showSearch ? L.p1 : L.t2, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              🔗 Dán link
            </button>
            <button onClick={() => setShowSearch(true)}
              style={{ flex: 1, padding: '8px', borderRadius: 10, border: `1px solid ${showSearch ? L.p1 : L.border}`, background: showSearch ? L.p2 : 'none', color: showSearch ? L.p1 : L.t2, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              🔍 Tìm kiếm
            </button>
          </div>

          {!showSearch ? (
            <>
              <input value={url} onChange={e => setUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, border: `1px solid ${videoId ? L.p1 : L.border}`, background: L.surface, color: L.t1, fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
              {url && !videoId && <div style={{ fontSize: 11, color: '#F87171', marginTop: 4 }}>⚠ Link không hợp lệ</div>}
            </>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={query} onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') searchYouTube(query) }}
                  placeholder="Tên bài hát, nghệ sĩ..."
                  autoFocus
                  style={{ flex: 1, padding: '12px 14px', borderRadius: 12, border: `1px solid ${L.border}`, background: L.surface, color: L.t1, fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
                <button onClick={() => searchYouTube(query)} disabled={searching || !query.trim()}
                  style={{ padding: '12px 16px', borderRadius: 12, border: 'none', background: L.p1, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: searching ? 0.6 : 1, flexShrink: 0 }}>
                  {searching ? '...' : '🔍'}
                </button>
              </div>
              {/* Kết quả search */}
              {results.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                  {results.map(r => (
                    <div key={r.id} onClick={() => selectVideo(r)}
                      style={{ display: 'flex', gap: 10, padding: '10px', borderRadius: 12, background: L.surface, border: `1px solid ${L.border}`, cursor: 'pointer', alignItems: 'center' }}>
                      <img src={r.thumbnail} alt="" style={{ width: 80, height: 45, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: L.t1, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.title}</div>
                        <div style={{ fontSize: 11, color: L.t3, marginTop: 3 }}>{r.channel}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* YouTube Player */}
        {videoId && (
          <div style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 16, aspectRatio: '16/9', background: '#000' }}>
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?rel=0&controls=1`}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              allowFullScreen
              allow="autoplay"
              title="YouTube player"
            />
          </div>
        )}

        {/* Hướng dẫn nếu chưa có video */}
        {!videoId && (
          <div style={{ background: L.surface, borderRadius: 16, padding: '20px', marginBottom: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🎵</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Cách tìm tempo bài hát</div>
            <div style={{ fontSize: 12, color: L.t2, lineHeight: 1.8 }}>
              1. Paste link YouTube bài hát vào ô trên<br />
              2. Nghe bài hát<br />
              3. Tap đều theo nhịp bài<br />
              4. Hệ thống tính BPM tự động
            </div>
          </div>
        )}

        {/* TAP BUTTON */}
        <div style={{ background: `linear-gradient(135deg, ${L.p1} 0%, #8B84FF 100%)`, borderRadius: 24, padding: '24px 20px', marginBottom: 16, textAlign: 'center', boxShadow: '0 8px 24px rgba(108,99,255,0.35)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />

          {/* BPM Display */}
          <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '.1em' }}>
            {tapCount < 2 ? 'Tap để bắt đầu' : 'BPM'}
          </div>
          <div style={{ fontSize: 72, fontWeight: 900, color: L.gold, lineHeight: 1, marginBottom: 4 }}>
            {bpm ?? '—'}
          </div>
          {tapCount > 0 && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>
              {tapCount} lần tap{tapCount < 4 ? ' · tap thêm để chính xác hơn' : ''}
            </div>
          )}
          {tapCount === 0 && <div style={{ height: 16, marginBottom: 16 }} />}

          {/* TAP Button */}
          <button
            onPointerDown={tap}
            style={{ width: '100%', background: '#fff', color: L.p1, border: 'none', borderRadius: 16, padding: '20px', fontSize: 22, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '.06em', userSelect: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', marginBottom: tapCount > 0 ? 12 : 0 }}>
            TAP
          </button>

          {tapCount > 0 && (
            <button onClick={reset} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, padding: '6px 16px', color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              Làm lại
            </button>
          )}
        </div>

        {/* Nút lưu */}
        {bpm && !saved && (
          <button onClick={() => setShowSave(true)}
            style={{ width: '100%', background: L.green, border: 'none', borderRadius: 16, padding: '16px', fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(16,185,129,0.35)' }}>
            💾 Lưu {bpm} BPM vào My Songs
          </button>
        )}

        {saved && (
          <div style={{ background: 'rgba(16,185,129,0.1)', border: '1.5px solid rgba(16,185,129,0.3)', borderRadius: 16, padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>✅</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: L.green }}>Đã lưu vào My Songs!</div>
            <div style={{ fontSize: 12, color: L.t2, marginTop: 4 }}>Vào tab Tập để xem bài hát của bạn</div>
          </div>
        )}
      </div>

      {/* Modal Save */}
      {showSave && (
        <div onClick={() => setShowSave(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#1A1E2A', borderRadius: '24px 24px 0 0', padding: '20px 20px max(20px, env(safe-area-inset-bottom))', width: '100%', maxWidth: 430, boxShadow: '0 -8px 32px rgba(0,0,0,0.5)' }}>
            <div style={{ width: 40, height: 4, borderRadius: 99, background: L.border, margin: '0 auto 18px' }} />
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>💾 Lưu vào My Songs</div>
            <div style={{ fontSize: 13, color: L.t2, marginBottom: 20 }}>
              Tempo: <strong style={{ color: L.gold }}>{bpm} BPM</strong>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: L.t2, marginBottom: 6 }}>Tên bài hát *</div>
              <input value={title} onChange={e => setTitle(e.target.value)} autoFocus
                placeholder="VD: Nối vòng tay lớn"
                style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, border: `1px solid ${L.border}`, background: L.surface, color: L.t1, fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: L.t2, marginBottom: 6 }}>Nghệ sĩ (tuỳ chọn)</div>
              <input value={artist} onChange={e => setArtist(e.target.value)}
                placeholder="VD: Trịnh Công Sơn"
                style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, border: `1px solid ${L.border}`, background: L.surface, color: L.t1, fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowSave(false)}
                style={{ flex: 1, background: 'none', border: `1px solid ${L.border}`, borderRadius: 12, padding: '13px', fontSize: 14, color: L.t2, cursor: 'pointer', fontFamily: 'inherit' }}>
                Huỷ
              </button>
              <button onClick={handleSave} disabled={saving || !title.trim()}
                style={{ flex: 2, background: L.green, border: 'none', borderRadius: 12, padding: '13px', fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', opacity: (saving || !title.trim()) ? 0.6 : 1 }}>
                {saving ? 'Đang lưu…' : '✅ Lưu bài hát'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
