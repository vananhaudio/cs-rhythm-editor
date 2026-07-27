import { useRef, useEffect, useState, useCallback } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────
interface PianoNote {
  pitch: string    // "C4", "D4", "E4", etc.
  startBeat: number
  duration: number // in beats: 1=quarter, 2=half, 4=whole
}

// ── Demo: Twinkle Twinkle Little Star ─────────────────────────────────────────
const DEMO_NOTES: PianoNote[] = [
  { pitch: 'C4', startBeat: 0, duration: 1 },
  { pitch: 'C4', startBeat: 1, duration: 1 },
  { pitch: 'G4', startBeat: 2, duration: 1 },
  { pitch: 'G4', startBeat: 3, duration: 1 },
  { pitch: 'A4', startBeat: 4, duration: 1 },
  { pitch: 'A4', startBeat: 5, duration: 1 },
  { pitch: 'G4', startBeat: 6, duration: 2 },
  { pitch: 'F4', startBeat: 8, duration: 1 },
  { pitch: 'F4', startBeat: 9, duration: 1 },
  { pitch: 'E4', startBeat: 10, duration: 1 },
  { pitch: 'E4', startBeat: 11, duration: 1 },
  { pitch: 'D4', startBeat: 12, duration: 1 },
  { pitch: 'D4', startBeat: 13, duration: 1 },
  { pitch: 'C4', startBeat: 14, duration: 2 },
]

// ── Pitch → staff position ────────────────────────────────────────────────────
// Treble clef: bottom line = E4, each step = half space
const PITCH_Y: Record<string, number> = {
  'C4': 5, 'D4': 4, 'E4': 3, 'F4': 2, 'G4': 1, 'A4': 0, 'B4': -1,
  'C5': -2, 'D5': -3, 'E5': -4, 'F5': -5,
}
const NOTE_COLORS: Record<string, string> = {
  'C': '#EF4444', 'D': '#F59E0B', 'E': '#10B981', 'F': '#3B82F6',
  'G': '#8B5CF6', 'A': '#EC4899', 'B': '#06B6D4',
}

function pitchColor(pitch: string) { return NOTE_COLORS[pitch[0]] || '#F59E0B' }
function pitchY(pitch: string) { return PITCH_Y[pitch] ?? 3 }

// ── Config ────────────────────────────────────────────────────────────────────
const STAFF_LINE_H = 12      // pixels between staff lines
const NOTE_RADIUS    = 18    // big for kids
const PLAYHEAD_RATIO = 0.28  // playhead at 28% from left
const LOOKAHEAD_BEATS = 4.5 // show ~4.5 beats ahead
const PX_PER_BEAT    = 90    // pixels per beat at default zoom

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props { onClose?: () => void }

export default function MusicPlayer({ onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef   = useRef(0)
  const startTime = useRef(0)
  const [playing, setPlaying] = useState(false)
  const [tempo, setTempo]     = useState(100)
  const [beat, setBeat]       = useState(0)
  const playedRef = useRef<Set<number>>(new Set())

  // ── Animation loop ──
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width
    const H = canvas.height

    // Layout
    const staffTop    = H * 0.45
    const staffH      = STAFF_LINE_H * 8  // 4 spaces = 8 half-steps
    const staffBottom = staffTop + staffH
    const staffMid    = staffTop + staffH / 2
    const staffLeft   = 60
    const staffRight  = W - 20
    const staffWidth  = staffRight - staffLeft
    const playheadX   = staffLeft + staffWidth * PLAYHEAD_RATIO
    const pxPerSec    = PX_PER_BEAT * (tempo / 60)

    // Current beat
    let currentBeat = 0
    if (playing && startTime.current > 0) {
      currentBeat = ((performance.now() - startTime.current) / 1000) * (tempo / 60)
      setBeat(currentBeat)
    }

    // Clear
    ctx.clearRect(0, 0, W, H)

    // ── Background ──
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H)
    bgGrad.addColorStop(0, '#1a1206')
    bgGrad.addColorStop(1, '#0d0a04')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, W, H)

    // ── Staff lines ──
    for (let i = 0; i < 5; i++) {
      const y = staffTop + i * STAFF_LINE_H * 2
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(staffLeft, y)
      ctx.lineTo(staffRight, y)
      ctx.stroke()
    }

    // Subtle center line glow
    const glowGrad = ctx.createLinearGradient(0, staffTop, 0, staffBottom)
    glowGrad.addColorStop(0, 'rgba(0,0,0,0.3)')
    glowGrad.addColorStop(0.5, 'rgba(0,0,0,0)')
    glowGrad.addColorStop(1, 'rgba(0,0,0,0.3)')
    ctx.fillStyle = glowGrad
    ctx.fillRect(staffLeft, staffTop, staffWidth, staffH)

    // ── Playhead ──
    const phGrad = ctx.createLinearGradient(playheadX - 20, 0, playheadX + 20, 0)
    phGrad.addColorStop(0, 'rgba(251,191,36,0)')
    phGrad.addColorStop(0.4, 'rgba(251,191,36,0.08)')
    phGrad.addColorStop(0.5, 'rgba(251,191,36,0.25)')
    phGrad.addColorStop(0.6, 'rgba(251,191,36,0.08)')
    phGrad.addColorStop(1, 'rgba(251,191,36,0)')
    ctx.fillStyle = phGrad
    ctx.fillRect(playheadX - 30, staffTop - 20, 60, staffH + 40)

    // Playhead line
    ctx.strokeStyle = 'rgba(251,191,36,0.6)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(playheadX, staffTop - 16)
    ctx.lineTo(playheadX, staffBottom + 16)
    ctx.stroke()

    // ── Treble clef symbol (simplified) ──
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.font = `${STAFF_LINE_H * 10}px serif`
    ctx.fillText('𝄞', staffLeft + 4, staffMid + STAFF_LINE_H * 3.5)

    // ── Draw notes ──
    const totalBeats = DEMO_NOTES.reduce((max, n) => Math.max(max, n.startBeat + n.duration), 0)

    for (let i = 0; i < DEMO_NOTES.length; i++) {
      const note = DEMO_NOTES[i]
      const noteX = playheadX + (note.startBeat - currentBeat) * PX_PER_BEAT
      const noteW = note.duration * PX_PER_BEAT

      // Skip if off screen
      if (noteX + NOTE_RADIUS < staffLeft || noteX - NOTE_RADIUS > staffRight) continue

      const py = staffTop + pitchY(note.pitch) * STAFF_LINE_H + STAFF_LINE_H
      const color = pitchColor(note.pitch)

      // Determine state
      const noteEndBeat = note.startBeat + note.duration
      const atPlayhead = note.startBeat <= currentBeat && noteEndBeat >= currentBeat
      const fullyPlayed = noteEndBeat <= currentBeat

      let noteAlpha = 1
      let noteColor = color
      let noteGlow  = false

      if (fullyPlayed) {
        noteColor = '#10B981'
        noteAlpha = 0.7
      } else if (atPlayhead) {
        noteColor = '#FEF3C7'
        noteGlow  = true
      }

      // Glow at playhead
      if (noteGlow) {
        const glow = ctx.createRadialGradient(noteX, py, 0, noteX, py, NOTE_RADIUS * 1.8)
        glow.addColorStop(0, 'rgba(251,191,36,0.25)')
        glow.addColorStop(1, 'rgba(251,191,36,0)')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(noteX, py, NOTE_RADIUS * 1.8, 0, Math.PI * 2)
        ctx.fill()
      }

      // Ledger lines (for C4 below staff)
      if (note.pitch === 'C4') {
        const ledgerY = staffTop + STAFF_LINE_H * 10 // one line below
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(noteX - NOTE_RADIUS, ledgerY)
        ctx.lineTo(noteX + NOTE_RADIUS, ledgerY)
        ctx.stroke()
      }

      // Stem
      const stemUp = pitchY(note.pitch) >= 2
      ctx.strokeStyle = noteColor
      ctx.globalAlpha = noteAlpha
      ctx.lineWidth = 3
      ctx.beginPath()
      if (stemUp) {
        ctx.moveTo(noteX + NOTE_RADIUS - 2, py)
        ctx.lineTo(noteX + NOTE_RADIUS - 2, py - STAFF_LINE_H * 5)
      } else {
        ctx.moveTo(noteX - NOTE_RADIUS + 2, py)
        ctx.lineTo(noteX - NOTE_RADIUS + 2, py + STAFF_LINE_H * 5)
      }
      ctx.stroke()

      // Note head (oval)
      ctx.fillStyle = noteColor
      ctx.beginPath()
      ctx.ellipse(noteX, py, NOTE_RADIUS, NOTE_RADIUS * 0.75, -0.15, 0, Math.PI * 2)
      ctx.fill()

      // Note head border
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      ctx.globalAlpha = 1
    }

    // ── Beat counter ──
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.font = '13px Inter, system-ui, sans-serif'
    ctx.fillText(`Nhịp ${Math.floor(currentBeat) + 1}`, staffRight - 60, staffTop - 14)

    animRef.current = requestAnimationFrame(draw)
  }, [tempo, playing])

  // ── Canvas setup + start loop ──
  useEffect(() => {
    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [draw])

  // ── Play/pause ──
  const togglePlay = () => {
    if (playing) {
      setPlaying(false)
      startTime.current = 0
    } else {
      setPlaying(true)
      // Adjust startTime so currentBeat stays continuous
      const elapsedBeats = beat * (60 / tempo) * 1000
      startTime.current = performance.now() - elapsedBeats
    }
  }

  const resetAll = () => {
    setPlaying(false)
    startTime.current = 0
    setBeat(0)
    playedRef.current = new Set()
  }

  return (
    <div style={{
      width: '100%', height: '100dvh',
      background: '#0d0a04',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Inter, system-ui, sans-serif',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Close */}
      {onClose && (
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 16, zIndex: 10,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 50, width: 40, height: 40, fontSize: 16,
          color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✕</button>
      )}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{ flex: 1, width: '100%', display: 'block' }}
        width={window.innerWidth}
        height={window.innerHeight}
      />

      {/* Controls */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 16, padding: '16px 20px 32px',
        background: 'linear-gradient(to top, rgba(13,10,4,0.95), transparent)',
      }}>
        {/* Reset */}
        <button onClick={resetAll} style={btnStyle}>
          ⟲
        </button>

        {/* Play/Pause */}
        <button onClick={togglePlay} style={{ ...btnStyle, width: 64, height: 64, fontSize: 24 }}>
          {playing ? '⏸' : '▶'}
        </button>

        {/* Tempo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => setTempo(t => Math.max(40, t - 10))} style={btnSm}>−</button>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 600, minWidth: 44, textAlign: 'center' }}>
            {tempo} <span style={{ fontSize: 10, opacity: 0.6 }}>BPM</span>
          </span>
          <button onClick={() => setTempo(t => Math.min(200, t + 10))} style={btnSm}>+</button>
        </div>
      </div>

      {/* Title */}
      <div style={{
        position: 'absolute', top: 16, left: 0, right: 0, textAlign: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
          🎹 Twinkle Twinkle Little Star
        </div>
      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  width: 48, height: 48, borderRadius: '50%',
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'rgba(255,255,255,0.8)', fontSize: 20,
  cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center',
}

const btnSm: React.CSSProperties = {
  width: 32, height: 32, borderRadius: '50%',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: 'rgba(255,255,255,0.6)', fontSize: 16,
  cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center',
}
