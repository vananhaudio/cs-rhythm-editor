import { useState, useEffect, useRef, useCallback } from 'react'
import type { RhythmSong } from './types'
import { supabase } from './supabase'

type Props = {
  song: RhythmSong
  onClose: () => void
  userRole?: string
}

type Dot = { time: number }
type ScoredDot = Dot & { hit: boolean; offset: number }

function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)
  return m ? m[1] : null
}

export function TapMode({ song, onClose, userRole }: Props) {
  const beatDur = 60 / song.tempo
  const barDur = beatDur * song.timeSignature
  const isTeacher = userRole === 'teacher' || userRole === 'admin'

  const [ytUrl, setYtUrl] = useState((song as any).youtubeUrl || '')
  const [ytId, setYtId] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const [teacherDots, setTeacherDots] = useState<Dot[]>([])
  const [studentDots, setStudentDots] = useState<Dot[]>([])
  const [phase, setPhase] = useState<'idle' | 'countdown' | 'playing' | 'result'>('idle')
  const [countdown, setCountdown] = useState(3)
  const [tapMode, setTapMode] = useState<'teacher' | 'student'>('student')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const playerRef = useRef<any>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const tapBtnRef = useRef<HTMLButtonElement>(null)
  const rafRef = useRef<number>(0)

  // Load teacher_taps từ Supabase
  useEffect(() => {
    if (!song.title) return
    supabase.from('timming_songs')
      .select('teacher_taps, youtube_url')
      .eq('title', song.title)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.teacher_taps) setTeacherDots(data.teacher_taps)
        if (data?.youtube_url && !ytUrl) setYtUrl(data.youtube_url)
      })
  }, [song.title])

  // Load YouTube IFrame API
  useEffect(() => {
    if ((window as any).YT) return
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(script)
  }, [])

  const initPlayer = useCallback((id: string) => {
    const YT = (window as any).YT
    if (!YT) { (window as any).onYouTubeIframeAPIReady = () => initPlayer(id); return }
    playerRef.current?.destroy()
    playerRef.current = new YT.Player('yt-player', {
      videoId: id,
      playerVars: { controls: 1, rel: 0 },
      events: {
        onStateChange: (e: any) => {
          if (e.data === 2 || e.data === 0) {
            if (e.data === 0) setPhase('result')
          }
        },
        onReady: (e: any) => setDuration(e.target.getDuration())
      }
    })
  }, [])

  useEffect(() => {
    const tick = () => {
      if (playerRef.current?.getCurrentTime) {
        setCurrentTime(playerRef.current.getCurrentTime())
        const d = playerRef.current.getDuration()
        if (d > 0) setDuration(d)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const handleLoadYT = () => {
    const id = extractYouTubeId(ytUrl)
    if (!id) { alert('Link YouTube không hợp lệ!'); return }
    setYtId(id)
    setStudentDots([])
    setPhase('idle')
    setTimeout(() => initPlayer(id), 300)
  }

  // Countdown → play
  const handleStartTap = useCallback(() => {
    if (phase !== 'idle') return
    setStudentDots([])
    if (tapMode === 'teacher') setTeacherDots([])
    setPhase('countdown')
    setCountdown(3)

    let c = 3
    const iv = setInterval(() => {
      c--
      setCountdown(c)
      if (c === 0) {
        clearInterval(iv)
        setPhase('playing')
        playerRef.current?.seekTo(0)
        playerRef.current?.playVideo()
      }
    }, 1000)
  }, [phase, tapMode])

  const handleTap = useCallback(() => {
    if (phase !== 'playing' || !playerRef.current) return
    const t = playerRef.current.getCurrentTime()
    if (tapMode === 'teacher') {
      setTeacherDots(prev => [...prev, { time: t }])
    } else {
      setStudentDots(prev => [...prev, { time: t }])
    }
    if (tapBtnRef.current) {
      tapBtnRef.current.style.transform = 'scale(0.92)'
      setTimeout(() => { if (tapBtnRef.current) tapBtnRef.current.style.transform = 'scale(1)' }, 80)
    }
  }, [phase, tapMode])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        if (phase === 'idle') handleStartTap()
        else if (phase === 'playing') handleTap()
      }
      if (e.code === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [handleTap, handleStartTap, onClose, phase])

  const handleSaveTeacher = async () => {
    if (!song.title) { alert('Bài chưa có tên!'); return }
    setSaving(true)
    const { error } = await supabase.from('timming_songs')
      .update({ teacher_taps: teacherDots, youtube_url: ytUrl, updated_at: new Date().toISOString() })
      .eq('title', song.title)
    setSaving(false)
    if (error) { setSaveMsg('❌ ' + error.message) }
    else { setSaveMsg('✅ Đã lưu đáp án thầy!'); setTimeout(() => setSaveMsg(''), 3000) }
  }

  const pct = (t: number) => duration > 0 ? (t / duration) * 100 : 0

  const refDots = teacherDots
  const scoredStudent: ScoredDot[] = studentDots.map(d => {
    if (refDots.length === 0) return { ...d, hit: false, offset: 999 }
    const nearest = refDots.reduce((a, b) =>
      Math.abs(a.time - d.time) < Math.abs(b.time - d.time) ? a : b)
    const offset = Math.abs(d.time - nearest.time)
    return { ...d, hit: offset <= 0.25, offset }
  })
  const score = refDots.length > 0
    ? Math.round((scoredStudent.filter(d => d.hit).length / refDots.length) * 100)
    : 0
  const stars = score >= 90 ? 5 : score >= 75 ? 4 : score >= 60 ? 3 : score >= 40 ? 2 : 1

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0A0E1A', display: 'flex', flexDirection: 'column', zIndex: 200, fontFamily: 'Inter, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #1E2533' }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>🥁 Tap nhịp — {song.title || 'Chọn bài'}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#6B7280', fontSize: 13 }}>
          <span>{song.tempo} BPM · {song.timeSignature}/4</span>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #374151', borderRadius: 6, color: '#9CA3AF', cursor: 'pointer', padding: '4px 12px' }}>✕</button>
        </div>
      </div>

      {/* YouTube input */}
      <div style={{ padding: '12px 20px', display: 'flex', gap: 8, borderBottom: '1px solid #1E2533' }}>
        <input value={ytUrl} onChange={e => setYtUrl(e.target.value)}
          placeholder="Dán link YouTube vào đây..."
          style={{ flex: 1, padding: '8px 12px', background: '#1E2533', border: '1px solid #374151', borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none' }}
          onKeyDown={e => e.key === 'Enter' && handleLoadYT()} />
        <button onClick={handleLoadYT} style={{ padding: '8px 18px', background: '#10B981', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Tải</button>
      </div>

      {/* YouTube player */}
      <div style={{ padding: '12px 20px 0' }}>
        <div id="yt-player" style={{ width: '100%', aspectRatio: '16/6', borderRadius: 10, overflow: 'hidden', background: '#000', display: ytId ? 'block' : 'none' }} />
        {!ytId && (
          <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151', fontSize: 14, border: '1px dashed #1E2533', borderRadius: 10 }}>
            Dán link YouTube để bắt đầu
          </div>
        )}
      </div>

      {/* Timeline — 2 tracks */}
      <div style={{ padding: '12px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#374151', fontSize: 11 }}>
          <span>{Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')}</span>
          <span>{Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}</span>
        </div>

        {/* Track thầy */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#F59E0B', fontSize: 11, fontWeight: 700, width: 72, flexShrink: 0 }}>
            {isTeacher ? '👨‍🏫 Thầy' : '🎯 Đáp án'}
          </span>
          <div ref={timelineRef} style={{ position: 'relative', flex: 1, height: 36, background: '#0F1117', borderRadius: 6, border: `1px solid ${tapMode === 'teacher' && isTeacher ? '#F59E0B' : '#1E2533'}`, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${pct(currentTime)}%`, background: 'rgba(245,158,11,0.06)' }} />
            {teacherDots.map((d, i) => (
              <div key={i} style={{ position: 'absolute', left: `${pct(d.time)}%`, top: '50%', transform: 'translate(-50%,-50%)', width: 8, height: 8, borderRadius: '50%', background: '#F59E0B' }} />
            ))}
            {duration > 0 && <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${pct(currentTime)}%`, width: 2, background: '#F59E0B', opacity: 0.4 }} />}
          </div>
          {teacherDots.length > 0 && <span style={{ color: '#F59E0B', fontSize: 11, width: 28 }}>{teacherDots.length}</span>}
        </div>

        {/* Track học sinh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#60A5FA', fontSize: 11, fontWeight: 700, width: 72, flexShrink: 0 }}>🎓 Bạn</span>
          <div style={{ position: 'relative', flex: 1, height: 36, background: '#0F1117', borderRadius: 6, border: `1px solid ${tapMode === 'student' ? '#60A5FA' : '#1E2533'}`, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${pct(currentTime)}%`, background: 'rgba(96,165,250,0.06)' }} />
            {(phase === 'result' ? scoredStudent : studentDots.map(d => ({ ...d, hit: true, offset: 0 }))).map((d, i) => (
              <div key={i} style={{
                position: 'absolute', left: `${pct(d.time)}%`, top: '50%',
                transform: 'translate(-50%,-50%)', width: 8, height: 8, borderRadius: '50%',
                background: phase === 'result' ? ((d as ScoredDot).hit ? '#10B981' : '#EF4444') : '#60A5FA',
                boxShadow: phase !== 'result' ? '0 0 6px #60A5FA' : 'none'
              }} />
            ))}
            {duration > 0 && <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${pct(currentTime)}%`, width: 2, background: '#60A5FA', opacity: 0.4 }} />}
          </div>
          {studentDots.length > 0 && <span style={{ color: '#60A5FA', fontSize: 11, width: 28 }}>{studentDots.length}</span>}
        </div>

        {phase === 'result' && (
          <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#6B7280' }}>
            <span><span style={{ color: '#10B981' }}>●</span> Đúng (≤0.25s)</span>
            <span><span style={{ color: '#EF4444' }}>●</span> Lệch</span>
            <span><span style={{ color: '#F59E0B' }}>●</span> Đáp án thầy</span>
          </div>
        )}
      </div>

      {/* Result */}
      {phase === 'result' && refDots.length > 0 && (
        <div style={{ padding: '0 20px 8px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
          <div style={{ fontSize: 44, fontWeight: 900, color: score >= 60 ? '#10B981' : '#EF4444' }}>
            {score}<span style={{ fontSize: 16 }}>/100</span>
          </div>
          <div style={{ fontSize: 20 }}>{'⭐'.repeat(stars)}{'☆'.repeat(5 - stars)}</div>
          <div style={{ fontSize: 11, color: '#6B7280' }}>{scoredStudent.filter(d => d.hit).length}/{refDots.length} phách đúng</div>
        </div>
      )}

      {/* Controls */}
      <div style={{ padding: '8px 20px 16px', display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>

        {/* Teacher toggle */}
        {isTeacher && phase === 'playing' && (
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #374151' }}>
            <button onClick={() => setTapMode('student')} style={{ padding: '8px 14px', background: tapMode === 'student' ? '#60A5FA' : '#1F2937', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
              🎓 Tap học sinh
            </button>
            <button onClick={() => setTapMode('teacher')} style={{ padding: '8px 14px', background: tapMode === 'teacher' ? '#F59E0B' : '#1F2937', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
              👨‍🏫 Tap đáp án
            </button>
          </div>
        )}

        {/* Countdown overlay */}
        {phase === 'countdown' && (
          <div style={{
            width: 140, height: 140, borderRadius: '50%',
            background: '#1F2937', border: '3px solid #10B981',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: countdown === 0 ? 32 : 64, fontWeight: 900,
            color: '#10B981', userSelect: 'none',
            animation: 'pulse 0.9s ease-in-out infinite'
          }}>
            {countdown === 0 ? 'GO!' : countdown}
          </div>
        )}

        {/* Nút Bắt đầu */}
        {phase === 'idle' && ytId && (
          <button onClick={handleStartTap} style={{
            width: 160, height: 56, borderRadius: 28,
            background: '#10B981', border: 'none', color: '#fff',
            fontSize: 18, fontWeight: 800, cursor: 'pointer',
            boxShadow: '0 0 24px rgba(16,185,129,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }}>
            ▶ Bắt đầu Tap
          </button>
        )}

        {/* TAP button */}
        {phase === 'playing' && (
          <button ref={tapBtnRef} onPointerDown={handleTap} style={{
            width: 140, height: 140, borderRadius: '50%',
            background: tapMode === 'teacher' ? '#F59E0B' : '#10B981',
            border: 'none', color: '#fff', fontSize: 26,
            fontWeight: 900, cursor: 'pointer',
            transition: 'transform 0.08s',
            boxShadow: `0 0 30px ${tapMode === 'teacher' ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}`,
            userSelect: 'none'
          }}>
            TAP
          </button>
        )}

        {/* Result buttons */}
        {phase === 'result' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            <button onClick={() => {
              playerRef.current?.seekTo(0)
              setStudentDots([])
              setPhase('idle')
            }} style={{ padding: '10px 28px', background: '#10B981', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
              🔄 Thử lại
            </button>
            {isTeacher && (
              <button onClick={handleSaveTeacher} disabled={saving}
                style={{ padding: '10px 28px', background: '#F59E0B', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? '⏳ Đang lưu...' : '💾 Lưu đáp án thầy'}
              </button>
            )}
          </div>
        )}

        {/* Lưu ngay khi đang tap đáp án */}
        {phase === 'playing' && isTeacher && tapMode === 'teacher' && teacherDots.length > 0 && (
          <button onClick={handleSaveTeacher} disabled={saving}
            style={{ padding: '8px 16px', background: '#F59E0B', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
            {saving ? '⏳...' : '💾 Lưu ngay'}
          </button>
        )}
      </div>

      {saveMsg && (
        <div style={{ textAlign: 'center', color: saveMsg.startsWith('✅') ? '#10B981' : '#EF4444', fontSize: 13, paddingBottom: 4 }}>
          {saveMsg}
        </div>
      )}

      {/* Hint */}
      <div style={{ textAlign: 'center', color: '#374151', fontSize: 11, paddingBottom: 10 }}>
        {phase === 'idle' && ytId && 'Nhấn ▶ Bắt đầu Tap hoặc Space · video sẽ tự play'}
        {phase === 'idle' && !ytId && 'Dán link YouTube → Tải → Bắt đầu Tap'}
        {phase === 'countdown' && 'Chuẩn bị...'}
        {phase === 'playing' && 'Nhấn TAP hoặc Space khi đến phách mạnh (nhịp 1)'}
        {phase === 'result' && 'Xong! Xem kết quả bên trên'}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
      `}</style>
    </div>
  )
}
