import { useState, useEffect, useRef, useCallback } from 'react'
import type { RhythmSong } from './types'

type TapResult = { time: number; offset: number; hit: boolean }

type Props = {
  song: RhythmSong
  onClose: () => void
}

export function TapMode({ song, onClose }: Props) {
  const beatDur = 60 / song.tempo
  const barDur = beatDur * song.timeSignature

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentBeat, setCurrentBeat] = useState(-1)
  const [results, setResults] = useState<TapResult[]>([])
  const [finished, setFinished] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)

  const startTimeRef = useRef<number>(0)
  const animRef = useRef<number>(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const nextBeatTimeRef = useRef<number>(0)
  const nextBeatIdxRef = useRef<number>(0)
  const totalBeats = song.totalBars * song.timeSignature
  const beat1Times = useRef<number[]>([]) // mp3 times của các phách 1

  // Tính tất cả thời điểm phách 1
  useEffect(() => {
    const times = []
    for (let i = 0; i < song.totalBars; i++) {
      times.push(i * barDur)
    }
    beat1Times.current = times
  }, [song, barDur])

  const scheduleClick = useCallback((audioTime: number, strong: boolean) => {
    if (!audioCtxRef.current) return
    const ctx = audioCtxRef.current
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = strong ? 880 : 440
    gain.gain.setValueAtTime(strong ? 0.5 : 0.2, audioTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioTime + (strong ? 0.08 : 0.05))
    osc.start(audioTime)
    osc.stop(audioTime + 0.1)
  }, [])

  const startGame = useCallback(() => {
    setCountdown(3)
    let c = 3
    const timer = setInterval(() => {
      c--
      if (c > 0) {
        setCountdown(c)
      } else {
        clearInterval(timer)
        setCountdown(null)
        // Bắt đầu chơi
        audioCtxRef.current = new AudioContext()
        const ctx = audioCtxRef.current
        startTimeRef.current = ctx.currentTime
        nextBeatTimeRef.current = ctx.currentTime
        nextBeatIdxRef.current = 0
        setResults([])
        setFinished(false)
        setIsPlaying(true)
      }
    }, 1000)
  }, [])

  // Scheduler
  useEffect(() => {
    if (!isPlaying) return
    const scheduleAhead = 0.1

    const tick = () => {
      const ctx = audioCtxRef.current
      if (!ctx) return

      while (nextBeatTimeRef.current < ctx.currentTime + scheduleAhead) {
        const idx = nextBeatIdxRef.current
        if (idx >= totalBeats) {
          setIsPlaying(false)
          setFinished(true)
          return
        }
        const beatInBar = idx % song.timeSignature
        scheduleClick(nextBeatTimeRef.current, beatInBar === 0)
        nextBeatTimeRef.current += beatDur
        nextBeatIdxRef.current++
      }

      // Update current beat for UI
      const ctx2 = audioCtxRef.current
      if (ctx2) {
        const elapsed = ctx2.currentTime - startTimeRef.current
        const beat = Math.floor(elapsed / beatDur)
        setCurrentBeat(beat)
      }

      animRef.current = requestAnimationFrame(tick)
    }

    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [isPlaying, beatDur, totalBeats, song.timeSignature, scheduleClick])

  const handleTap = useCallback(() => {
    if (!isPlaying || !audioCtxRef.current) return
    const ctx = audioCtxRef.current
    const tapTime = ctx.currentTime - startTimeRef.current

    // Tìm phách 1 gần nhất
    let minOffset = Infinity
    let nearestBeat1 = 0
    beat1Times.current.forEach(t => {
      const offset = Math.abs(tapTime - t)
      if (offset < minOffset) {
        minOffset = offset
        nearestBeat1 = t
      }
    })

    const hit = minOffset <= 0.15 // 150ms
    setResults(prev => [...prev, { time: nearestBeat1, offset: minOffset, hit }])
  }, [isPlaying])

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); handleTap() }
      if (e.code === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleTap, onClose])

  const score = results.length > 0
    ? Math.round((results.filter(r => r.hit).length / song.totalBars) * 100)
    : 0

  const stars = score >= 90 ? 5 : score >= 75 ? 4 : score >= 60 ? 3 : score >= 40 ? 2 : 1

  // Screenshot result
  const resultRef = useRef<HTMLDivElement>(null)

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0F1117',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', zIndex: 200, gap: 24
    }}>
      {/* Header */}
      <div style={{ position: 'absolute', top: 16, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>🥁 Tap nhịp — Level 1</div>
        <button onClick={onClose} style={{ background: 'none', border: '1px solid #374151', borderRadius: 8, color: '#9CA3AF', cursor: 'pointer', padding: '6px 14px' }}>✕ Đóng</button>
      </div>

      {/* Song info */}
      <div style={{ textAlign: 'center', color: '#6B7280', fontSize: 14 }}>
        {song.title} · {song.tempo} BPM · {song.timeSignature}/4
      </div>

      {/* Countdown */}
      {countdown !== null && (
        <div style={{ fontSize: 80, fontWeight: 900, color: '#10B981' }}>{countdown}</div>
      )}

      {/* Beat indicator */}
      {(isPlaying || finished) && !countdown && (
        <div style={{ display: 'flex', gap: 12 }}>
          {Array.from({ length: song.timeSignature }).map((_, i) => {
            const beatInBar = currentBeat % song.timeSignature
            const isActive = beatInBar === i
            const isStrong = i === 0
            return (
              <div key={i} style={{
                width: isStrong ? 32 : 24,
                height: isStrong ? 32 : 24,
                borderRadius: '50%',
                background: isActive ? (isStrong ? '#10B981' : '#6B7280') : 'transparent',
                border: `2px solid ${isStrong ? '#10B981' : '#374151'}`,
                transition: 'background 0.05s'
              }} />
            )
          })}
        </div>
      )}

      {/* TAP button */}
      {!finished && !countdown && (
        <button
          onPointerDown={handleTap}
          style={{
            width: 180, height: 180, borderRadius: '50%',
            background: isPlaying ? '#10B981' : '#1F2937',
            border: 'none', color: '#fff',
            fontSize: isPlaying ? 28 : 16,
            fontWeight: 900, cursor: 'pointer',
            transition: 'transform 0.05s, background 0.1s',
            boxShadow: isPlaying ? '0 0 40px rgba(16,185,129,0.3)' : 'none'
          }}
          onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          onPointerDown2={e => { handleTap(); (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.95)' } as any}
        >
          {isPlaying ? 'TAP' : countdown !== null ? '...' : 'Chờ...'}
        </button>
      )}

      {/* Start button */}
      {!isPlaying && !finished && countdown === null && (
        <button onClick={startGame} style={{
          padding: '14px 40px', background: '#10B981', border: 'none',
          borderRadius: 12, color: '#fff', fontSize: 18, fontWeight: 800,
          cursor: 'pointer'
        }}>
          ▶ Bắt đầu
        </button>
      )}

      {/* Results dots */}
      {results.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxWidth: 400, justifyContent: 'center' }}>
          {results.map((r, i) => (
            <div key={i} style={{
              width: 14, height: 14, borderRadius: '50%',
              background: r.hit ? '#10B981' : '#EF4444'
            }} title={`${r.hit ? '✅' : '❌'} ${Math.round(r.offset * 1000)}ms`} />
          ))}
        </div>
      )}

      {/* Finished screen */}
      {finished && (
        <div ref={resultRef} style={{
          background: '#16213E', borderRadius: 20, padding: 32,
          textAlign: 'center', display: 'flex', flexDirection: 'column',
          gap: 16, minWidth: 300
        }}>
          <div style={{ fontSize: 14, color: '#6B7280' }}>🎵 {song.title}</div>
          <div style={{ fontSize: 64, fontWeight: 900, color: score >= 60 ? '#10B981' : '#EF4444' }}>
            {score}<span style={{ fontSize: 24 }}>/100</span>
          </div>
          <div style={{ fontSize: 28 }}>{'⭐'.repeat(stars)}{'☆'.repeat(5 - stars)}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
            {results.map((r, i) => (
              <div key={i} style={{
                width: 12, height: 12, borderRadius: '50%',
                background: r.hit ? '#10B981' : '#EF4444'
              }} />
            ))}
          </div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>timming.vananhaudio.com</div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={startGame} style={{
              padding: '10px 24px', background: '#10B981', border: 'none',
              borderRadius: 8, color: '#fff', fontWeight: 700, cursor: 'pointer'
            }}>🔄 Thử lại</button>
            <button onClick={() => {
              // Screenshot using html2canvas or manual share
              alert('Chụp màn hình để chia sẻ lên nhóm lớp!')
            }} style={{
              padding: '10px 24px', background: '#1F2937', border: '1px solid #374151',
              borderRadius: 8, color: '#fff', fontWeight: 700, cursor: 'pointer'
            }}>📸 Chia sẻ</button>
          </div>
        </div>
      )}

      {/* Hint */}
      {isPlaying && (
        <div style={{ color: '#6B7280', fontSize: 13 }}>
          Tap vào nút hoặc nhấn Space khi phách 1 (mạnh)
        </div>
      )}
    </div>
  )
}
