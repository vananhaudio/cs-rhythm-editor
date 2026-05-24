import { useState, useEffect, useRef, useCallback } from 'react'
import type { RhythmSong } from './types'

type Props = {
  song: RhythmSong
  onClose: () => void
}

type Dot = { time: number } // thời điểm tap (giây)

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

export function TapMode({ song, onClose }: Props) {
  const beatDur = 60 / song.tempo
  const barDur = beatDur * song.timeSignature

  const [ytUrl, setYtUrl] = useState('')
  const [ytId, setYtId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [dots, setDots] = useState<Dot[]>([])
  const [phase, setPhase] = useState<'setup' | 'playing' | 'result'>('setup')

  const playerRef = useRef<any>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const rafRef = useRef<number>(0)
  const timelineRef = useRef<HTMLDivElement>(null)
  const tapBtnRef = useRef<HTMLButtonElement>(null)

  // Load YouTube IFrame API
  useEffect(() => {
    if ((window as any).YT) return
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(script)
  }, [])

  const initPlayer = useCallback((id: string) => {
    const YT = (window as any).YT
    if (!YT) {
      // Chờ API load xong
      (window as any).onYouTubeIframeAPIReady = () => initPlayer(id)
      return
    }
    if (playerRef.current) {
      playerRef.current.destroy()
    }
    playerRef.current = new YT.Player('yt-player', {
      videoId: id,
      playerVars: { controls: 1, rel: 0 },
      events: {
        onStateChange: (e: any) => {
          if (e.data === 1) { // playing
            setIsPlaying(true)
            setPhase('playing')
            setDots([])
          } else if (e.data === 2 || e.data === 0) { // paused or ended
            setIsPlaying(false)
            if (e.data === 0) setPhase('result')
          }
        },
        onReady: (e: any) => {
          setDuration(e.target.getDuration())
        }
      }
    })
  }, [])

  // Poll currentTime từ YouTube player
  useEffect(() => {
    const tick = () => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        const t = playerRef.current.getCurrentTime()
        setCurrentTime(t)
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
    setDots([])
    setPhase('setup')
    setTimeout(() => initPlayer(id), 300)
  }

  const handleTap = useCallback(() => {
    if (phase !== 'playing' || !playerRef.current) return
    const t = playerRef.current.getCurrentTime()
    setDots(prev => [...prev, { time: t }])
    // Flash tap button
    if (tapBtnRef.current) {
      tapBtnRef.current.style.transform = 'scale(0.92)'
      setTimeout(() => { if (tapBtnRef.current) tapBtnRef.current.style.transform = 'scale(1)' }, 80)
    }
  }, [phase])

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); handleTap() }
      if (e.code === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleTap, onClose])

  // Tính phách chuẩn
  const beat1Times: number[] = []
  if (duration > 0) {
    for (let t = 0; t < duration; t += barDur) beat1Times.push(t)
  }

  const timelineW = timelineRef.current?.offsetWidth || 600
  const pct = (t: number) => duration > 0 ? (t / duration) * 100 : 0

  // Tính điểm
  const scoreDots = dots.map(d => {
    const nearest = beat1Times.reduce((a, b) =>
      Math.abs(a - d.time) < Math.abs(b - d.time) ? a : b, beat1Times[0] ?? 0)
    const offset = Math.abs(d.time - nearest)
    return { ...d, hit: offset <= 0.2 }
  })
  const score = beat1Times.length > 0
    ? Math.round((scoreDots.filter(d => d.hit).length / beat1Times.length) * 100)
    : 0
  const stars = score >= 90 ? 5 : score >= 75 ? 4 : score >= 60 ? 3 : score >= 40 ? 2 : 1

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0A0E1A',
      display: 'flex', flexDirection: 'column', zIndex: 200,
      fontFamily: 'Inter, sans-serif'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #1E2533' }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>🥁 Tap nhịp — {song.title || 'Chọn bài'}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#6B7280', fontSize: 13 }}>
          <span>{song.tempo} BPM · {song.timeSignature}/4</span>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #374151', borderRadius: 6, color: '#9CA3AF', cursor: 'pointer', padding: '4px 12px', fontSize: 13 }}>✕</button>
        </div>
      </div>

      {/* YouTube input */}
      <div style={{ padding: '12px 20px', display: 'flex', gap: 8, borderBottom: '1px solid #1E2533' }}>
        <input
          value={ytUrl}
          onChange={e => setYtUrl(e.target.value)}
          placeholder="Dán link YouTube vào đây..."
          style={{ flex: 1, padding: '8px 12px', background: '#1E2533', border: '1px solid #374151', borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none' }}
          onKeyDown={e => e.key === 'Enter' && handleLoadYT()}
        />
        <button onClick={handleLoadYT} style={{ padding: '8px 18px', background: '#10B981', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
          Tải
        </button>
      </div>

      {/* YouTube player */}
      <div style={{ padding: '0 20px', paddingTop: 12 }}>
        <div id="yt-player" style={{ width: '100%', aspectRatio: '16/6', borderRadius: 10, overflow: 'hidden', background: '#000', display: ytId ? 'block' : 'none' }} />
        {!ytId && (
          <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151', fontSize: 14, border: '1px dashed #1E2533', borderRadius: 10 }}>
            Dán link YouTube để bắt đầu
          </div>
        )}
      </div>

      {/* Timeline */}
      <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Time labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#374151', fontSize: 11 }}>
          <span>{Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')}</span>
          <span>{Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}</span>
        </div>

        {/* Timeline track */}
        <div ref={timelineRef} style={{ position: 'relative', height: 80, background: '#0F1117', borderRadius: 8, border: '1px solid #1E2533', overflow: 'hidden' }}>
          {/* Progress bar */}
          <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${pct(currentTime)}%`, background: 'rgba(16,185,129,0.08)', transition: 'width 0.1s' }} />

          {/* Phách chuẩn (gạch nhỏ dưới) */}
          {beat1Times.map((t, i) => (
            <div key={i} style={{
              position: 'absolute', bottom: 4, left: `${pct(t)}%`,
              width: 2, height: 12, background: '#1E2D3D', borderRadius: 1
            }} />
          ))}

          {/* Dots tap */}
          {(phase === 'result' ? scoreDots : dots.map(d => ({ ...d, hit: true }))).map((d, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: `${pct(d.time)}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 10, height: 10, borderRadius: '50%',
              background: phase === 'result' ? ((d as any).hit ? '#10B981' : '#EF4444') : '#60A5FA',
              boxShadow: phase === 'result' ? 'none' : '0 0 6px #60A5FA'
            }} />
          ))}

          {/* Now line */}
          {duration > 0 && (
            <div style={{
              position: 'absolute', top: 0, bottom: 0,
              left: `${pct(currentTime)}%`,
              width: 2, background: '#10B981', opacity: 0.6
            }} />
          )}
        </div>

        {/* Legend */}
        {phase === 'result' && (
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#6B7280' }}>
            <span><span style={{ color: '#10B981' }}>●</span> Đúng nhịp</span>
            <span><span style={{ color: '#EF4444' }}>●</span> Lệch nhịp</span>
            <span><span style={{ color: '#374151' }}>|</span> Phách chuẩn</span>
          </div>
        )}
      </div>

      {/* Result */}
      {phase === 'result' && (
        <div style={{ padding: '0 20px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          <div style={{ fontSize: 48, fontWeight: 900, color: score >= 60 ? '#10B981' : '#EF4444' }}>
            {score}<span style={{ fontSize: 18 }}>/100</span>
          </div>
          <div style={{ fontSize: 24 }}>{'⭐'.repeat(stars)}{'☆'.repeat(5 - stars)}</div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>
            {scoreDots.filter(d => d.hit).length}/{beat1Times.length} phách đúng
          </div>
        </div>
      )}

      {/* TAP button */}
      <div style={{ padding: '0 20px 20px', display: 'flex', gap: 12, justifyContent: 'center' }}>
        {phase !== 'setup' && (
          <button
            ref={tapBtnRef}
            onPointerDown={handleTap}
            style={{
              width: 140, height: 140, borderRadius: '50%',
              background: phase === 'playing' ? '#10B981' : '#1F2937',
              border: 'none', color: '#fff',
              fontSize: phase === 'playing' ? 26 : 16,
              fontWeight: 900, cursor: 'pointer',
              transition: 'transform 0.08s',
              boxShadow: phase === 'playing' ? '0 0 30px rgba(16,185,129,0.25)' : 'none',
              userSelect: 'none'
            }}
          >
            {phase === 'playing' ? 'TAP' : '🎵'}
          </button>
        )}
        {phase === 'result' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
            <button onClick={() => {
              playerRef.current?.seekTo(0)
              playerRef.current?.playVideo()
              setDots([])
              setPhase('playing')
            }} style={{ padding: '10px 20px', background: '#10B981', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
              🔄 Thử lại
            </button>
            <button onClick={() => alert('Chụp màn hình để chia sẻ!')} style={{ padding: '10px 20px', background: '#1F2937', border: '1px solid #374151', borderRadius: 8, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
              📸 Chia sẻ
            </button>
          </div>
        )}
      </div>

      {/* Hint */}
      {phase === 'playing' && (
        <div style={{ textAlign: 'center', color: '#4B5563', fontSize: 12, paddingBottom: 8 }}>
          Tap vào nút hoặc nhấn Space khi phách mạnh (nhịp 1)
        </div>
      )}
    </div>
  )
}
