import { useRef, useEffect, useState, useMemo } from 'react'
import { NoteSheet } from '../elearn/guitarRenderers'
import { exerciseToNoteItems, pitchToFreq } from './notationAdapter'
import { playTone } from '../elearn/audio'

// ── Types ────────────────────────────────────────────────────────────────────
interface PianoNote { pitch: string; startBeat: number; duration: number }
interface Exercise { title: string; bpm: number; notes: PianoNote[] }

const DEMO: Exercise = {
  title: 'Twinkle Twinkle',
  bpm: 100,
  notes: [
    {pitch:'C4',startBeat:0,duration:1},{pitch:'C4',startBeat:1,duration:1},
    {pitch:'G4',startBeat:2,duration:1},{pitch:'G4',startBeat:3,duration:1},
    {pitch:'A4',startBeat:4,duration:1},{pitch:'A4',startBeat:5,duration:1},
    {pitch:'G4',startBeat:6,duration:2},
    {pitch:'F4',startBeat:8,duration:1},{pitch:'F4',startBeat:9,duration:1},
    {pitch:'E4',startBeat:10,duration:1},{pitch:'E4',startBeat:11,duration:1},
    {pitch:'D4',startBeat:12,duration:1},{pitch:'D4',startBeat:13,duration:1},
    {pitch:'C4',startBeat:14,duration:2},
  ],
}

const SPEEDS = [
  { label: 'Chậm', bpm: 60 },
  { label: 'Vừa', bpm: 80 },
  { label: 'Nhanh', bpm: 100 },
]

interface Props {
  exercise?: Exercise
  onClose?: () => void
  onBack?: () => void
}

export default function MusicPlayer({ exercise: propEx, onClose, onBack }: Props) {
  const [ex] = useState<Exercise>(propEx || DEMO)
  const [playing, setPlaying] = useState(false)
  const [cursor, setCursor] = useState(-1)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [done, setDone] = useState(false)
  const [speedIdx, setSpeedIdx] = useState(() => {
    // pick closest speed to exercise's bpm
    const bpm = (propEx || DEMO).bpm
    let best = 1
    SPEEDS.forEach((s, i) => { if (Math.abs(s.bpm - bpm) < Math.abs(SPEEDS[best].bpm - bpm)) best = i })
    return best
  })

  const timerRef = useRef<number | null>(null)
  const noteItems = useMemo(() => exerciseToNoteItems(ex), [ex])
  const bpm = SPEEDS[speedIdx].bpm

  // ── Countdown timer ──
  useEffect(() => {
    if (countdown === null) return
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c! - 1), 700)
      return () => clearTimeout(t)
    }
    // countdown done → start playback
    setCountdown(null)
    startPlayback(bpm)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown])

  // ── Playback (timer-based note advance) ──
  const startPlayback = (bpmVal: number) => {
    stop()
    setDone(false)
    setPlaying(true)
    const beatMs = 60000 / bpmVal
    let i = 0
    const tick = () => {
      if (i >= ex.notes.length) {
        setDone(true); setPlaying(false); setCursor(-1)
        return
      }
      setCursor(i)
      const note = ex.notes[i]
      try { playTone(pitchToFreq(note.pitch), note.duration * beatMs / 1000) } catch { /* */ }
      i++
      timerRef.current = window.setTimeout(tick, note.duration * beatMs)
    }
    tick()
  }

  const stop = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    setPlaying(false); setCursor(-1)
  }

  const toggle = () => {
    if (playing) { stop(); return }
    setDone(false)
    setCountdown(3)
  }

  const reset = () => { stop(); setCountdown(null); setDone(false); setCursor(-1) }

  // Cleanup timer on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return (
    <div style={{
      width: '100%', maxWidth: 800, margin: '0 auto',
      height: '100dvh', background: '#0d0a04',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Inter, system-ui, sans-serif',
      position: 'relative', overflowX: 'hidden', overflowY: 'auto',
      userSelect: 'none',
    }}>
      {/* Top bar */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '12px 16px 6px', zIndex: 10,
      }}>
        {onBack ? (
          <button onClick={onBack} style={btnSm}>←</button>
        ) : onClose ? (
          <button onClick={onClose} style={btnSm}>✕</button>
        ) : <div />}
        <div style={{
          fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,.7)',
          textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', maxWidth: '65%',
        }}>
          🎹 {ex.title}
        </div>
        <div style={{ width: 36 }} />
      </div>

      {/* Speed selector */}
      <div style={{
        flexShrink: 0, display: 'flex', justifyContent: 'center',
        marginBottom: 6, padding: '0 16px',
      }}>
        <div style={{
          display: 'flex', gap: 3, padding: 3,
          background: 'rgba(255,255,255,.05)', borderRadius: 10,
        }}>
          {SPEEDS.map((s, i) => (
            <button
              key={i}
              onClick={() => { setSpeedIdx(i); if (playing || countdown !== null) { stop(); setCountdown(null); setDone(false); setCursor(-1) } }}
              disabled={playing}
              style={{
                padding: '5px 14px', border: 'none', borderRadius: 8,
                cursor: playing ? 'default' : 'pointer',
                fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                background: speedIdx === i ? 'rgba(245,158,11,.18)' : 'transparent',
                color: speedIdx === i ? '#F59E0B' : 'rgba(255,255,255,.35)',
                transition: 'background .2s, color .2s',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* NoteSheet — centerpiece */}
      <div style={{
        flex: 1, minHeight: 0,
        margin: '0 10px 6px',
        borderRadius: 12,
        overflow: 'hidden',
        background: '#1a1206',
        border: '1px solid rgba(255,255,255,.06)',
      }}>
        <NoteSheet notes={noteItems} active={cursor} />
      </div>

      {/* Countdown overlay */}
      {countdown !== null && (
        <div style={{
          position: 'absolute', top: '20%', left: 0, right: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', zIndex: 20,
        }}>
          <div
            key={countdown}
            style={{
              fontSize: 72, fontWeight: 900,
              color: 'rgba(251,191,36,.85)',
              textShadow: '0 0 50px rgba(251,191,36,.35)',
              animation: 'cd-pop .6s ease-out',
              lineHeight: 1,
            }}
          >
            {countdown}
          </div>
        </div>
      )}

      {/* Done indicator */}
      {done && !playing && (
        <div style={{
          position: 'absolute', top: '50%', left: 0, right: 0,
          transform: 'translateY(-50%)',
          display: 'flex', justifyContent: 'center',
          pointerEvents: 'none', zIndex: 15,
        }}>
          <div style={{
            fontSize: 14, fontWeight: 600,
            color: 'rgba(16,185,129,.7)',
            background: 'rgba(16,185,129,.08)',
            padding: '8px 20px', borderRadius: 20,
          }}>
            ✅ Hoàn thành!
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 24,
        padding: '10px 20px calc(24px + env(safe-area-inset-bottom, 0px))',
      }}>
        <button onClick={reset} style={bs}>⟲</button>
        <button onClick={toggle} style={{ ...bs, width: 58, height: 58, fontSize: 22 }}>
          {playing ? '⏸' : '▶'}
        </button>
        <div style={{
          color: 'rgba(255,255,255,.45)', fontSize: 15, fontWeight: 700,
          minWidth: 56, textAlign: 'center', lineHeight: 1.1,
        }}>
          <span style={{ color: 'rgba(255,255,255,.8)' }}>{bpm}</span>
          <span style={{ display: 'block', fontSize: 10, fontWeight: 400, opacity: .45, marginTop: 1 }}>BPM</span>
        </div>
      </div>

      <style>{`@keyframes cd-pop{0%{opacity:0;transform:scale(1.8)}50%{opacity:1;transform:scale(.9)}100%{opacity:1;transform:scale(1)}}`}</style>
    </div>
  )
}

const bs: React.CSSProperties = {
  width: 48, height: 48, borderRadius: '50%',
  background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.1)',
  color: 'rgba(255,255,255,.8)', fontSize: 20, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

const btnSm: React.CSSProperties = {
  background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)',
  borderRadius: 50, width: 36, height: 36, fontSize: 14,
  color: 'rgba(255,255,255,.5)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
