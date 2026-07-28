// ── Learning Flow: 4-step piano learning system ──
// Architecture: StepDefinition[] → dễ thêm/bớt bước, không cần sửa code orchestrator.

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { NoteSheet } from '../elearn/guitarRenderers'
import type { NoteItem } from '../elearn/guitarRenderers'
import { exerciseToNoteItems, pitchToFreq, pitchToLabel } from './notationAdapter'
import { playTone } from '../elearn/audio'
import { usePitchDetector } from './usePitchDetector'
import { pitchClass } from '../elearn/pitch'

// ── Types ────────────────────────────────────────────────────────────────────
interface PianoNote { pitch: string; startBeat: number; duration: number }
interface Exercise { title: string; bpm: number; notes: PianoNote[] }

interface StepComponentProps {
  exercise: Exercise
  noteItems: NoteItem[]
  onComplete: () => void
  onBack: () => void
}

interface StepDefinition {
  id: string
  icon: string
  label: string
  component: React.ComponentType<StepComponentProps>
}

// ── Step definitions — thêm/bớt ở đây, code orchestrator bên dưới không cần sửa ──
const STEPS: StepDefinition[] = [
  { id: 'listen',  icon: '🎧', label: 'Nghe mẫu',       component: StepListen },
  { id: 'note',    icon: '🎯', label: 'Tập từng nốt',    component: StepNoteByNote },
  { id: 'rhythm',  icon: '🥁', label: 'Chơi theo nhịp',  component: StepRhythm },
  { id: 'perform', icon: '🎵', label: 'Biểu diễn',       component: StepPerform },
]

const SPEEDS = [
  { label: 'Chậm', bpm: 60 },
  { label: 'Vừa', bpm: 80 },
  { label: 'Nhanh', bpm: 100 },
]

// ── Colors ────────────────────────────────────────────────────────────────────
const C = {
  bg: '#F9F7F1',
  text: '#2E2A24',
  dim: '#8A8478',
  muted: '#B0A898',
  accent: '#C2622E',
  green: '#059669',
  red: '#DC2626',
  border: '#EAE4D8',
}

interface Props {
  exercise: Exercise
  onBack: () => void
  onClose?: () => void
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════════

export default function LearningFlow({ exercise, onBack, onClose }: Props) {
  const [stepIdx, setStepIdx] = useState(0)
  const [completed, setCompleted] = useState<Set<number>>(new Set([0])) // step 0 auto-unlocked
  const noteItems = useMemo(() => exerciseToNoteItems(exercise), [exercise])

  const handleComplete = () => {
    setCompleted(prev => {
      const next = new Set(prev)
      next.add(stepIdx)
      // auto-unlock next step
      if (stepIdx + 1 < STEPS.length) next.add(stepIdx + 1)
      return next
    })
    if (stepIdx < STEPS.length - 1) {
      setStepIdx(stepIdx + 1)
    }
  }

  const CurrentStep = STEPS[stepIdx].component

  return (
    <div style={{
      width: '100%', maxWidth: 800, margin: '0 auto',
      height: '100dvh', background: C.bg,
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Inter, system-ui, sans-serif',
      overflow: 'hidden',
    }}>
      {/* Top bar */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '10px 16px 6px',
      }}>
        <button onClick={onBack} style={btnBack}>←</button>
        <div style={{
          fontSize: 14, fontWeight: 700, color: C.text,
          textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', maxWidth: '60%',
        }}>
          🎹 {exercise.title}
        </div>
        {onClose
          ? <button onClick={onClose} style={btnBack}>✕</button>
          : <div style={{ width: 36 }} />}
      </div>

      {/* Progress bar */}
      <div style={{
        flexShrink: 0, display: 'flex', gap: 4,
        padding: '0 12px 10px',
      }}>
        {STEPS.map((s, i) => {
          const isActive = i === stepIdx
          const isDone = completed.has(i)
          const locked = !completed.has(i)
          return (
            <button
              key={s.id}
              onClick={() => { if (!locked) setStepIdx(i) }}
              disabled={locked}
              style={{
                flex: 1, textAlign: 'center',
                padding: '7px 4px 6px', borderRadius: 10,
                border: isActive ? `2px solid ${C.accent}` : '2px solid transparent',
                background: isActive ? 'rgba(194,98,46,.08)' : isDone ? 'rgba(16,185,129,.06)' : 'transparent',
                color: isActive ? C.accent : isDone ? C.green : C.muted,
                cursor: locked ? 'default' : 'pointer',
                fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
                lineHeight: 1.3, transition: 'all .2s',
                opacity: locked ? 0.5 : 1,
              }}
            >
              <div style={{ fontSize: 16, marginBottom: 1 }}>
                {isDone ? '✓' : s.icon}
              </div>
              <div>{s.label}</div>
            </button>
          )
        })}
      </div>

      {/* Step content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <CurrentStep
          exercise={exercise}
          noteItems={noteItems}
          onComplete={handleComplete}
          onBack={onBack}
        />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 1 — NGHE MẪU
// ═══════════════════════════════════════════════════════════════════════════════

function StepListen({ exercise, noteItems, onComplete, onBack }: StepComponentProps) {
  const [playing, setPlaying] = useState(false)
  const [cursor, setCursor] = useState(-1)
  const [done, setDone] = useState(false)
  const [speedIdx, setSpeedIdx] = useState(1) // Vừa
  const timerRef = useRef<number | null>(null)
  const bpm = SPEEDS[speedIdx].bpm

  const start = () => {
    stop()
    setPlaying(true); setDone(false)
    const beatMs = 60000 / bpm
    let i = 0
    const tick = () => {
      if (i >= exercise.notes.length) { setDone(true); setPlaying(false); setCursor(-1); return }
      setCursor(i)
      const note = exercise.notes[i]
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

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        flexShrink: 0, display: 'flex', justifyContent: 'center', marginBottom: 6,
      }}>
        <div style={{ display: 'flex', gap: 3, padding: 3, background: '#F0ECE3', borderRadius: 10 }}>
          {SPEEDS.map((s, i) => (
            <button key={i} onClick={() => { setSpeedIdx(i); if (playing) start() }}
              disabled={playing}
              style={{
                padding: '5px 14px', border: 'none', borderRadius: 8,
                cursor: playing ? 'default' : 'pointer',
                fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                background: speedIdx === i ? 'rgba(194,98,46,.15)' : 'transparent',
                color: speedIdx === i ? C.accent : C.dim,
              }}
            >{s.label}</button>
          ))}
        </div>
      </div>

      <div style={{
        flex: 1, minHeight: 0, margin: '0 10px 6px',
        borderRadius: 12, overflow: 'hidden',
        background: '#fff', border: `1px solid ${C.border}`,
      }}>
        <NoteSheet notes={noteItems} active={cursor} />
      </div>

      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 20,
        padding: '10px 20px calc(24px + env(safe-area-inset-bottom, 0px))',
      }}>
        <button onClick={() => { stop(); onComplete() }}
          style={{
            padding: '10px 24px', fontSize: 14, fontWeight: 700,
            borderRadius: 12, border: `1.5px solid ${C.border}`,
            background: '#fff', color: C.dim,
            fontFamily: 'inherit', cursor: 'pointer',
          }}>
          Bỏ qua →
        </button>
        <button onClick={playing ? stop : start}
          style={{
            width: 56, height: 56, borderRadius: '50%',
            border: 'none',
            background: playing ? 'rgba(0,0,0,.06)' : `linear-gradient(135deg,${C.accent},#D97706)`,
            color: playing ? C.text : '#fff',
            fontSize: 22, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          {playing ? '⏸' : '▶'}
        </button>
        {done && (
          <button onClick={onComplete}
            style={{
              padding: '10px 24px', fontSize: 14, fontWeight: 700,
              borderRadius: 12, border: 'none',
              background: C.green, color: '#fff',
              fontFamily: 'inherit', cursor: 'pointer',
            }}>
            Tiếp tục →
          </button>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 2 — TẬP TỪNG NỐT
// ═══════════════════════════════════════════════════════════════════════════════

function StepNoteByNote({ exercise, noteItems, onComplete }: StepComponentProps) {
  const [cursor, setCursor] = useState(0)
  const [state, setState] = useState<'waiting' | 'correct' | 'wrong'>('waiting')
  const [errorMic, setErrorMic] = useState('')
  const detector = usePitchDetector()
  const stableRef = useRef(0)
  const wrongRef = useRef(0)
  const timerRef = useRef<number | null>(null)

  // Start mic on mount
  useEffect(() => {
    let cancelled = false
    const init = async () => {
      const ok = await detector.start()
      if (!ok && !cancelled) setErrorMic('Không truy cập được micro. Hãy cho phép quyền micro.')
    }
    init()
    return () => { cancelled = true; detector.stop(); if (timerRef.current) clearInterval(timerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pitch detection loop
  useEffect(() => {
    if (!detector.listening) return
    const loop = () => {
      const d = detector.detect()
      if (!d) { stableRef.current = 0; return }
      const target = pitchClass(pitchToFreq(exercise.notes[cursor].pitch))
      if (d.pc === target) {
        stableRef.current++
        if (stableRef.current >= 3) { // ~180ms stable
          stableRef.current = 0
          setState('correct')
          playTone(pitchToFreq(exercise.notes[cursor].pitch), 0.3)
          // Advance to next note after short delay
          timerRef.current = window.setTimeout(() => {
            setCursor(c => {
              const next = c + 1
              if (next >= exercise.notes.length) {
                onComplete()
                return c
              }
              return next
            })
            setState('waiting')
          }, 500)
        }
      } else {
        stableRef.current = 0
        wrongRef.current++
        if (wrongRef.current >= 2) {
          setState('wrong')
          wrongRef.current = 0
          timerRef.current = window.setTimeout(() => setState('waiting'), 400)
        }
      }
    }
    const id = setInterval(loop, 60)
    return () => { clearInterval(id); if (timerRef.current) clearTimeout(timerRef.current) }
  }, [detector.listening, cursor, exercise.notes, onComplete])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        flexShrink: 0, display: 'flex', justifyContent: 'center',
        padding: '4px 16px 6px', gap: 12, alignItems: 'center',
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
          Nốt {cursor + 1}/{exercise.notes.length}
        </span>
        <span style={{
          fontSize: 13, fontWeight: 700,
          color: state === 'correct' ? C.green : state === 'wrong' ? C.red : C.dim,
        }}>
          {state === 'correct' ? '✓ Đúng!' : state === 'wrong' ? '✗ Sai — thử lại' : 'Đợi con đàn...'}
        </span>
        {detector.listening && (
          <span style={{ fontSize: 11, color: C.muted }}>🎤 {detector.heard || '...'}</span>
        )}
        {errorMic && <span style={{ fontSize: 11, color: C.red }}>{errorMic}</span>}
      </div>

      <div style={{
        flex: 1, minHeight: 0, margin: '0 10px 6px',
        borderRadius: 12, overflow: 'hidden',
        background: '#fff', border: `1px solid ${C.border}`,
      }}>
        <NoteSheet notes={noteItems} active={cursor} />
      </div>

      <div style={{
        flexShrink: 0, display: 'flex', justifyContent: 'center',
        padding: '10px 20px calc(24px + env(safe-area-inset-bottom, 0px))',
      }}>
        <button onClick={onComplete}
          style={{
            padding: '10px 24px', fontSize: 14, fontWeight: 700,
            borderRadius: 12, border: `1.5px solid ${C.border}`,
            background: '#fff', color: C.dim,
            fontFamily: 'inherit', cursor: 'pointer',
          }}>
          Bỏ qua →
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 3 — CHƠI THEO NHỊP
// ═══════════════════════════════════════════════════════════════════════════════

function StepRhythm({ exercise, noteItems, onComplete }: StepComponentProps) {
  const [playing, setPlaying] = useState(false)
  const [cursor, setCursor] = useState(-1)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [done, setDone] = useState(false)
  const [score, setScore] = useState<{ hit: number; total: number } | null>(null)
  const [noteResults, setNoteResults] = useState<('correct' | 'wrong' | 'pending')[]>([])
  const [speedIdx, setSpeedIdx] = useState(1)
  const [errorMic, setErrorMic] = useState('')
  const detector = usePitchDetector()
  const timerRef = useRef<number | null>(null)
  const hitRef = useRef(false)
  const bpm = SPEEDS[speedIdx].bpm

  // Start mic
  useEffect(() => {
    const init = async () => {
      const ok = await detector.start()
      if (!ok) setErrorMic('Không truy cập được micro.')
    }
    init()
    return () => detector.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Countdown
  useEffect(() => {
    if (countdown === null) return
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c! - 1), 700)
      return () => clearTimeout(t)
    }
    setCountdown(null)
    startPlayback()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown])

  // Pitch detection (runs while playing)
  useEffect(() => {
    if (!playing || done || !detector.listening) return
    const loop = () => {
      const d = detector.detect()
      if (!d || cursor < 0 || cursor >= exercise.notes.length) return
      const target = pitchClass(pitchToFreq(exercise.notes[cursor].pitch))
      if (d.pc === target) hitRef.current = true
    }
    const id = setInterval(loop, 60)
    return () => clearInterval(id)
  }, [playing, done, cursor, exercise.notes, detector])

  const startPlayback = () => {
    stopPlayback()
    setPlaying(true); setDone(false)
    setNoteResults(new Array(exercise.notes.length).fill('pending'))
    const beatMs = 60000 / bpm
    const results: ('correct' | 'wrong')[] = []
    let i = 0
    const tick = () => {
      if (i >= exercise.notes.length) {
        setPlaying(false); setDone(true); setCursor(-1)
        const hit = results.filter(r => r === 'correct').length
        setScore({ hit, total: results.length })
        // Auto-advance if >50% correct
        if (hit / results.length >= 0.5) {
          setTimeout(onComplete, 1500)
        }
        return
      }
      // Record result for PREVIOUS note
      if (i > 0 && !exercise.notes[i - 1].pitch.match(/rest/i)) {
        results.push(hitRef.current ? 'correct' : 'wrong')
        setNoteResults(prev => {
          const next = [...prev]
          next[i - 1] = hitRef.current ? 'correct' : 'wrong'
          return next
        })
      }
      setCursor(i)
      hitRef.current = false
      i++
      const dur = exercise.notes[i - 1]?.duration ?? 1
      timerRef.current = window.setTimeout(tick, dur * beatMs)
    }
    tick()
  }

  const stopPlayback = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    setPlaying(false); setCursor(-1)
  }

  const toggle = () => {
    if (playing) { stopPlayback(); return }
    setScore(null); setCountdown(3)
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Status bar */}
      <div style={{
        flexShrink: 0, display: 'flex', justifyContent: 'space-between',
        padding: '4px 16px 6px', gap: 12, alignItems: 'center',
      }}>
        <div style={{ display: 'flex', gap: 3, padding: 3, background: '#F0ECE3', borderRadius: 10 }}>
          {SPEEDS.map((s, i) => (
            <button key={i} onClick={() => { setSpeedIdx(i); if (playing) { stopPlayback(); setCountdown(3) } }}
              disabled={playing}
              style={{
                padding: '4px 12px', border: 'none', borderRadius: 8,
                cursor: playing ? 'default' : 'pointer',
                fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
                background: speedIdx === i ? 'rgba(194,98,46,.15)' : 'transparent',
                color: speedIdx === i ? C.accent : C.dim,
              }}
            >{s.label}</button>
          ))}
        </div>
        {playing && (
          <span style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>
            🎤 {detector.heard || '...'}
          </span>
        )}
        {errorMic && <span style={{ fontSize: 11, color: C.red }}>{errorMic}</span>}
      </div>

      {/* NoteSheet */}
      <div style={{
        flex: 1, minHeight: 0, margin: '0 10px 6px',
        borderRadius: 12, overflow: 'hidden',
        background: '#fff', border: `1px solid ${C.border}`,
      }}>
        <NoteSheet notes={noteItems} active={cursor} />
      </div>

      {/* Score dots */}
      {playing && (
        <div style={{
          flexShrink: 0, display: 'flex', justifyContent: 'center', gap: 3,
          padding: '0 16px 4px', flexWrap: 'wrap',
        }}>
          {noteResults.map((r, i) => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: '50%',
              background: r === 'correct' ? C.green : r === 'wrong' ? C.red : '#E5E0D5',
            }} />
          ))}
        </div>
      )}

      {/* Score summary */}
      {done && score && (
        <div style={{
          flexShrink: 0, textAlign: 'center', padding: '6px 16px',
        }}>
          <div style={{
            display: 'inline-block', fontSize: 14, fontWeight: 700,
            color: score.hit / score.total >= 0.5 ? C.green : C.red,
            background: score.hit / score.total >= 0.5 ? 'rgba(16,185,129,.08)' : 'rgba(220,38,38,.06)',
            padding: '8px 20px', borderRadius: 12,
          }}>
            {score.hit}/{score.total} nốt đúng
            {score.hit / score.total >= 0.5 ? ' ✅' : ' — thử lại nhé'}
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 20,
        padding: '8px 20px calc(24px + env(safe-area-inset-bottom, 0px))',
      }}>
        {done && score && score.hit / score.total < 0.5 && (
          <button onClick={() => { stopPlayback(); setCountdown(3); setScore(null) }}
            style={{
              padding: '10px 24px', fontSize: 14, fontWeight: 700,
              borderRadius: 12, border: `1.5px solid ${C.border}`,
              background: '#fff', color: C.dim,
              fontFamily: 'inherit', cursor: 'pointer',
            }}>
            ↻ Thử lại
          </button>
        )}
        <button onClick={toggle}
          style={{
            width: 56, height: 56, borderRadius: '50%', border: 'none',
            background: playing ? 'rgba(0,0,0,.06)' : countdown !== null ? C.dim : `linear-gradient(135deg,${C.accent},#D97706)`,
            color: playing ? C.text : '#fff',
            fontSize: 22, cursor: countdown !== null ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          {playing ? '⏸' : countdown !== null ? countdown : '▶'}
        </button>
        {done && score && score.hit / score.total >= 0.5 && (
          <button onClick={onComplete}
            style={{
              padding: '10px 24px', fontSize: 14, fontWeight: 700,
              borderRadius: 12, border: 'none',
              background: C.green, color: '#fff',
              fontFamily: 'inherit', cursor: 'pointer',
            }}>
            Tiếp tục →
          </button>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 4 — BIỂU DIỄN
// ═══════════════════════════════════════════════════════════════════════════════

function StepPerform({ exercise, noteItems, onComplete }: StepComponentProps) {
  const [playing, setPlaying] = useState(false)
  const [cursor, setCursor] = useState(-1)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [done, setDone] = useState(false)
  const [score, setScore] = useState<{ hit: number; total: number } | null>(null)
  const [errorMic, setErrorMic] = useState('')
  const detector = usePitchDetector()
  const timerRef = useRef<number | null>(null)
  const hitRef = useRef(false)
  const bpm = SPEEDS[1].bpm // Vừa

  useEffect(() => {
    const init = async () => {
      const ok = await detector.start()
      if (!ok) setErrorMic('Không truy cập được micro.')
    }
    init()
    return () => detector.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (countdown === null) return
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c! - 1), 700)
      return () => clearTimeout(t)
    }
    setCountdown(null)
    startPlayback()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown])

  useEffect(() => {
    if (!playing || done || !detector.listening) return
    const loop = () => {
      const d = detector.detect()
      if (!d || cursor < 0 || cursor >= exercise.notes.length) return
      const target = pitchClass(pitchToFreq(exercise.notes[cursor].pitch))
      if (d.pc === target) hitRef.current = true
    }
    const id = setInterval(loop, 60)
    return () => clearInterval(id)
  }, [playing, done, cursor, exercise.notes, detector])

  const startPlayback = () => {
    stopPlayback()
    setPlaying(true); setDone(false)
    const beatMs = 60000 / bpm
    const results: ('correct' | 'wrong')[] = []
    let i = 0
    const tick = () => {
      if (i >= exercise.notes.length) {
        setPlaying(false); setDone(true); setCursor(-1)
        const hit = results.filter(r => r === 'correct').length
        setScore({ hit, total: results.length })
        return
      }
      if (i > 0 && !(exercise.notes[i - 1] as any)?.rest) {
        results.push(hitRef.current ? 'correct' : 'wrong')
      }
      setCursor(i)
      hitRef.current = false
      i++
      const dur = exercise.notes[i - 1]?.duration ?? 1
      timerRef.current = window.setTimeout(tick, dur * beatMs)
    }
    tick()
  }

  const stopPlayback = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    setPlaying(false); setCursor(-1)
  }

  const toggle = () => {
    if (playing) { stopPlayback(); return }
    setScore(null); setCountdown(3)
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        flexShrink: 0, display: 'flex', justifyContent: 'center',
        padding: '4px 16px 6px', gap: 12, alignItems: 'center',
      }}>
        {playing && (
          <span style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>
            🎤 {detector.heard || '...'}
          </span>
        )}
        {errorMic && <span style={{ fontSize: 11, color: C.red }}>{errorMic}</span>}
        {!playing && !done && (
          <span style={{ fontSize: 13, fontWeight: 600, color: C.dim }}>
            Chơi theo bản nhạc — đừng nhìn highlight
          </span>
        )}
      </div>

      <div style={{
        flex: 1, minHeight: 0, margin: '0 10px 6px',
        borderRadius: 12, overflow: 'hidden',
        background: '#fff', border: `1px solid ${C.border}`,
      }}>
        <NoteSheet notes={noteItems} active={cursor} />
      </div>

      {done && score && (
        <div style={{
          flexShrink: 0, textAlign: 'center', padding: '6px 16px',
        }}>
          <div style={{
            display: 'inline-block', fontSize: 14, fontWeight: 700,
            color: C.accent, background: 'rgba(194,98,46,.08)',
            padding: '8px 20px', borderRadius: 12, marginBottom: 8,
          }}>
            🎉 Kết quả: {score.hit}/{score.total} ({Math.round(score.hit / score.total * 100)}%)
          </div>
          <div style={{ fontSize: 12, color: C.dim }}>
            {score.hit / score.total >= 0.8 ? 'Xuất sắc! ⭐' :
             score.hit / score.total >= 0.5 ? 'Tốt lắm! 👏' :
             'Luyện thêm nhé 💪'}
          </div>
        </div>
      )}

      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 20,
        padding: '8px 20px calc(24px + env(safe-area-inset-bottom, 0px))',
      }}>
        {done && (
          <button onClick={() => { stopPlayback(); setCountdown(3); setScore(null) }}
            style={{
              padding: '10px 24px', fontSize: 14, fontWeight: 700,
              borderRadius: 12, border: `1.5px solid ${C.border}`,
              background: '#fff', color: C.dim,
              fontFamily: 'inherit', cursor: 'pointer',
            }}>
            ↻ Chơi lại
          </button>
        )}
        <button onClick={toggle}
          style={{
            width: 56, height: 56, borderRadius: '50%', border: 'none',
            background: playing ? 'rgba(0,0,0,.06)' : countdown !== null ? C.dim : `linear-gradient(135deg,${C.accent},#D97706)`,
            color: playing ? C.text : '#fff',
            fontSize: 22, cursor: countdown !== null ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          {playing ? '⏸' : countdown !== null ? countdown : '▶'}
        </button>
        {done && (
          <button onClick={onComplete}
            style={{
              padding: '10px 24px', fontSize: 14, fontWeight: 700,
              borderRadius: 12, border: 'none',
              background: C.green, color: '#fff',
              fontFamily: 'inherit', cursor: 'pointer',
            }}>
            Hoàn thành ✓
          </button>
        )}
      </div>
    </div>
  )
}

const btnBack: React.CSSProperties = {
  background: 'rgba(0,0,0,.04)', border: '1px solid rgba(0,0,0,.06)',
  borderRadius: 50, width: 36, height: 36, fontSize: 14,
  color: '#8A8478', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
