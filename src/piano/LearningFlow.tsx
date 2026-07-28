// ── Learning Flow: 4-step piano learning system ──
// Architecture: StepDefinition[] → dễ thêm/bớt bước, không cần sửa code orchestrator.

import { useState, useRef, useEffect, useMemo } from 'react'
import { NoteSheet } from '../elearn/guitarRenderers'
import type { NoteItem } from '../elearn/guitarRenderers'
import { exerciseToNoteItems, pitchToFreq } from './notationAdapter'
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

const STEP_INSTRUCTIONS: Record<string, string> = {
  listen: 'Nghe giai điệu mẫu',
  note: 'Luyện từng nốt',
  rhythm: 'Giữ đúng nhịp',
  perform: 'Chơi như đọc sheet',
}

const STEP_CTA: Record<string, string> = {
  listen: 'Nghe',
  note: 'Bắt đầu',
  rhythm: 'Bắt đầu',
  perform: 'Biểu diễn',
}

// ── Shared Bottom Bar ─────────────────────────────────────────────────────────

function BottomBar({
  onReplay, onToggle, onSkip, onSpeedCycle,
  isPlaying, isDone, replayLabel, speedLabel, showSpeed = true,
}: {
  onReplay: () => void
  onToggle: () => void
  onSkip: () => void
  onSpeedCycle: () => void
  isPlaying: boolean
  isDone: boolean
  replayLabel: string
  speedLabel: string
  showSpeed?: boolean
}) {
  return (
    <div style={{
      flexShrink: 0, display: 'flex', alignItems: 'center',
      padding: '8px 12px calc(16px + env(safe-area-inset-bottom, 0px))',
      gap: 8,
    }}>
      {/* Left group: Replay + Play + Speed */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
        {/* Replay */}
        <button onClick={onReplay} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '6px 12px', height: 36, borderRadius: 12,
          background: 'rgba(0,0,0,.04)', border: `1px solid ${C.border}`,
          color: C.dim, fontSize: 12, fontWeight: 700,
          fontFamily: 'inherit', cursor: 'pointer',
        }}>
          <span style={{ fontSize: 16 }}>↺</span> {replayLabel}
        </button>

        {isDone ? (
          <button onClick={onSkip} style={{
            padding: '12px 28px', borderRadius: 16,
            border: 'none',
            background: C.green, color: '#fff',
            fontSize: 15, fontWeight: 700,
            fontFamily: 'inherit', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(16,185,129,.3)',
          }}>
            Tiếp tục →
          </button>
        ) : (
          <button onClick={onToggle} style={{
            width: 52, height: 52, borderRadius: 16,
            border: 'none',
            background: isPlaying ? 'rgba(0,0,0,.05)' : `linear-gradient(135deg,${C.accent},#D97706)`,
            color: isPlaying ? C.text : '#fff',
            fontSize: 20, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: isPlaying ? 'none' : '0 4px 16px rgba(245,158,11,.3)',
            transition: 'all .2s',
          }}>
            {isPlaying ? '⏸' : '▶'}
          </button>
        )}

        {/* Speed chip — spaced away from Play */}
        <button onClick={onSpeedCycle} style={{
          marginLeft: 4,
          padding: '7px 12px', height: 30, borderRadius: 8,
          border: `1px solid ${C.border}`,
          background: '#fff',
          color: C.dim, fontSize: 11, fontWeight: 700,
          fontFamily: 'inherit', cursor: 'pointer',
          opacity: showSpeed ? 1 : 0.4,
          pointerEvents: showSpeed ? 'auto' : 'none',
          whiteSpace: 'nowrap',
        }}>
          {speedLabel}
        </button>
      </div>

      {/* Skip — far right */}
      <button onClick={onSkip} style={{
        padding: '7px 14px', height: 36, borderRadius: 12,
        background: 'rgba(0,0,0,.04)', border: '1px solid rgba(0,0,0,.06)',
        color: C.muted, fontSize: 12, fontWeight: 600,
        fontFamily: 'inherit', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0,
      }}>
        Bỏ qua →
      </button>
    </div>
  )
}

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
  const curStepId = STEPS[stepIdx].id

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
        justifyContent: 'space-between', padding: '8px 12px 4px',
        minHeight: 36,
      }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', borderRadius: 8,
          width: 32, height: 32, fontSize: 16,
          color: C.dim, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>←</button>
        <div style={{
          fontSize: 13, fontWeight: 700, color: C.text,
          textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', maxWidth: '55%',
        }}>
          {exercise.title}
        </div>
        <div style={{ width: 32 }} />
      </div>

      {/* Timeline progress */}
      <div style={{
        flexShrink: 0, padding: '4px 16px 0', minHeight: 28,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0,
        }}>
          {STEPS.map((s, i) => {
            const isActive = i === stepIdx
            const isDone = completed.has(i)
            const locked = !completed.has(i) && !isActive
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center' }}>
                {i > 0 && (
                  <div style={{
                    width: 24, height: 2, borderRadius: 1,
                    background: isDone || completed.has(i - 1) ? C.green : C.muted,
                    opacity: completed.has(i - 1) ? 1 : 0.3,
                    margin: '0 1px',
                  }} />
                )}
                <div style={{
                  fontSize: 11, fontWeight: 700,
                  color: isActive ? C.accent : isDone ? C.green : C.muted,
                  opacity: locked ? 0.4 : 1,
                  transition: 'color .2s',
                  whiteSpace: 'nowrap',
                }}>
                  {isDone ? '✓' : isActive ? '●' : '○'} {s.label}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Instruction */}
      <div style={{
        flexShrink: 0, textAlign: 'center', padding: '2px 16px 6px',
      }}>
        <span style={{ fontSize: 12, color: C.dim, fontWeight: 500 }}>
          {STEP_INSTRUCTIONS[curStepId] || ''}
        </span>
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

function StepListen({ exercise, noteItems, onComplete }: StepComponentProps) {
  const [playing, setPlaying] = useState(false)
  const [cursor, setCursor] = useState(-1)
  const [done, setDone] = useState(false)
  const [speedIdx, setSpeedIdx] = useState(1)
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
      {/* Speed selector — compact */}
      <div style={{
        flexShrink: 0, display: 'flex', justifyContent: 'center',
        marginBottom: 4, gap: 2,
      }}>
        {SPEEDS.map((s, i) => (
          <button key={i} onClick={() => { setSpeedIdx(i); if (playing) start() }}
            disabled={playing}
            style={{
              padding: '3px 10px', border: `1px solid ${C.border}`, borderRadius: 6,
              cursor: playing ? 'default' : 'pointer',
              fontFamily: 'inherit', fontSize: 10, fontWeight: 600,
              background: speedIdx === i ? C.accent : '#fff',
              color: speedIdx === i ? '#fff' : C.dim,
            }}
          >{s.label}</button>
        ))}
      </div>

      {/* NoteSheet */}
      <div style={{
        flex: 1, minHeight: 0, margin: '0 10px 6px',
        borderRadius: 12, overflow: 'hidden',
        background: '#fff', border: `1px solid ${C.border}`,
      }}>
        <NoteSheet notes={noteItems} active={cursor} />
      </div>

      {/* Bottom CTA */}
      <BottomBar
        onReplay={() => { stop(); setDone(false); start() }}
        onToggle={() => playing ? stop() : start()}
        onSkip={() => { stop(); onComplete() }}
        isPlaying={playing}
        isDone={done}
        replayLabel="Nghe lại"
        speedLabel={SPEEDS[speedIdx].label}
        onSpeedCycle={() => setSpeedIdx(i => (i + 1) % SPEEDS.length)}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 2 — TẬP TỪNG NỐT
// ═══════════════════════════════════════════════════════════════════════════════

function StepNoteByNote({ exercise, noteItems, onComplete }: StepComponentProps) {
  const [cursor, setCursor] = useState(0)
  const [state, setState] = useState<'idle' | 'active' | 'correct' | 'wrong'>('idle')
  const [errorMic, setErrorMic] = useState('')
  const detector = usePitchDetector()
  const stableRef = useRef(0)
  const wrongRef = useRef(0)
  const timerRef = useRef<number | null>(null)

  const startMic = async () => {
    const ok = await detector.start()
    if (!ok) { setErrorMic('Không truy cập được micro.'); return }
    setState('active')
  }

  useEffect(() => () => { detector.stop(); if (timerRef.current) clearInterval(timerRef.current) }, [])

  // Pitch detection loop
  useEffect(() => {
    if (!detector.listening || state !== 'active') return
    const loop = () => {
      const d = detector.detect()
      const curNote = exercise.notes[cursor]
      if (!d) { stableRef.current = 0; return }
      const target = pitchClass(pitchToFreq(curNote.pitch))
      if (d.pc === target) {
        stableRef.current++
        if (stableRef.current >= 3) {
          stableRef.current = 0
          setState('correct')
          playTone(pitchToFreq(curNote.pitch), 0.3)
          timerRef.current = window.setTimeout(() => {
            setCursor(c => {
              const next = c + 1
              if (next >= exercise.notes.length) { onComplete(); return c }
              return next
            })
            setState('active')
          }, 500)
        }
      } else {
        stableRef.current = 0
        wrongRef.current++
        if (wrongRef.current >= 2) {
          setState('wrong')
          wrongRef.current = 0
          timerRef.current = window.setTimeout(() => setState('active'), 400)
        }
      }
    }
    const id = setInterval(loop, 60)
    return () => { clearInterval(id); if (timerRef.current) clearTimeout(timerRef.current) }
  }, [detector.listening, state, cursor, exercise.notes, onComplete])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Status bar */}
      <div style={{
        flexShrink: 0, display: 'flex', justifyContent: 'center',
        padding: '2px 16px 4px', gap: 16, alignItems: 'center',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
          Nốt {cursor + 1}/{exercise.notes.length}
        </span>
        {state === 'idle' && (
          <span style={{ fontSize: 12, color: C.muted }}>Nhấn Bắt đầu</span>
        )}
        {state === 'active' && (
          <span style={{ fontSize: 12, color: C.dim }}>🎤 {detector.heard || 'chờ...'}</span>
        )}
        {state === 'correct' && (
          <span style={{ fontSize: 12, fontWeight: 600, color: C.green }}>✓ Đúng!</span>
        )}
        {state === 'wrong' && (
          <span style={{ fontSize: 12, fontWeight: 600, color: C.red }}>✗ Sai</span>
        )}
        {errorMic && <span style={{ fontSize: 11, color: C.red }}>{errorMic}</span>}
      </div>

      {/* NoteSheet */}
      <div style={{
        flex: 1, minHeight: 0, margin: '0 10px 6px',
        borderRadius: 12, overflow: 'hidden',
        background: '#fff', border: `1px solid ${C.border}`,
      }}>
        <NoteSheet notes={noteItems} active={state === 'idle' ? -1 : cursor} />
      </div>

      {/* Bottom */}
      <BottomBar
        onReplay={() => { setCursor(0); setState('active') }}
        onToggle={() => {
          if (state === 'idle') startMic()
          else { detector.stop(); setState('idle') }
        }}
        onSkip={() => { detector.stop(); onComplete() }}
        isPlaying={state === 'active'}
        isDone={false}
        replayLabel="Tập lại"
        speedLabel="Vừa"
        showSpeed={false}
        onSpeedCycle={() => {}}
      />
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

  const startMic = async () => {
    const ok = await detector.start()
    if (!ok) { setErrorMic('Không truy cập được micro.'); return false }
    return true
  }

  useEffect(() => () => detector.stop(), [])

  const startAll = async () => {
    if (!detector.listening) {
      const ok = await startMic()
      if (!ok) return
    }
    setCountdown(3)
  }

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
    setNoteResults(new Array(exercise.notes.length).fill('pending'))
    const beatMs = 60000 / bpm
    const results: ('correct' | 'wrong')[] = []
    let i = 0
    const tick = () => {
      if (i >= exercise.notes.length) {
        setPlaying(false); setDone(true); setCursor(-1)
        const hit = results.filter(r => r === 'correct').length
        setScore({ hit, total: results.length })
        if (hit / results.length >= 0.5) setTimeout(onComplete, 1500)
        return
      }
      if (i > 0) {
        results.push(hitRef.current ? 'correct' : 'wrong')
        setNoteResults(prev => { const next = [...prev]; next[i - 1] = hitRef.current ? 'correct' : 'wrong'; return next })
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
    setScore(null); startAll()
  }

  const retry = () => {
    stopPlayback(); setScore(null); setNoteResults([])
    startAll()
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* BPM selector + status */}
      <div style={{
        flexShrink: 0, display: 'flex', justifyContent: 'center',
        padding: '2px 16px 4px', gap: 8, alignItems: 'center',
      }}>
        <div style={{ display: 'flex', gap: 1, padding: 2, background: '#F0ECE3', borderRadius: 8 }}>
          {SPEEDS.map((s, i) => (
            <button key={i} onClick={() => { setSpeedIdx(i); if (playing) { stopPlayback(); setCountdown(3) } }}
              disabled={playing}
              style={{
                padding: '3px 10px', border: 'none', borderRadius: 6,
                cursor: playing ? 'default' : 'pointer',
                fontFamily: 'inherit', fontSize: 10, fontWeight: 700,
                background: speedIdx === i ? 'rgba(194,98,46,.15)' : 'transparent',
                color: speedIdx === i ? C.accent : C.dim,
              }}
            >{s.label}<span style={{ fontSize: 8, marginLeft: 2, opacity: .5 }}>{s.bpm}</span></button>
          ))}
        </div>
        {playing && <span style={{ fontSize: 11, fontWeight: 600, color: C.accent }}>🎤 {detector.heard || '...'}</span>}
        {errorMic && <span style={{ fontSize: 10, color: C.red }}>{errorMic}</span>}
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
              width: 6, height: 6, borderRadius: '50%',
              background: r === 'correct' ? C.green : r === 'wrong' ? C.red : '#E5E0D5',
            }} />
          ))}
        </div>
      )}

      {/* Score summary */}
      {done && score && (
        <div style={{ flexShrink: 0, textAlign: 'center', padding: '2px 16px 4px' }}>
          <span style={{
            fontSize: 13, fontWeight: 700,
            color: score.hit / score.total >= 0.5 ? C.green : C.red,
          }}>
            {score.hit}/{score.total} đúng
            {score.hit / score.total >= 0.5 ? ' ✅' : ' — thử lại nhé'}
          </span>
        </div>
      )}

      {/* Bottom */}
      <BottomBar
        onReplay={() => {
          stopPlayback(); setScore(null); setNoteResults([])
          if (detector.listening) setCountdown(3)
          else startAll()
        }}
        onToggle={() => {
          if (playing) { stopPlayback(); return }
          setScore(null); setNoteResults([])
          startAll()
        }}
        onSkip={() => { stopPlayback(); detector.stop(); onComplete() }}
        isPlaying={playing}
        isDone={done && !!score}
        replayLabel="Chơi lại"
        speedLabel={SPEEDS[speedIdx].label}
        onSpeedCycle={() => setSpeedIdx(i => (i + 1) % SPEEDS.length)}
      />
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
  const bpm = SPEEDS[1].bpm

  const startMic = async () => {
    const ok = await detector.start()
    if (!ok) { setErrorMic('Không truy cập được micro.'); return false }
    return true
  }

  useEffect(() => () => detector.stop(), [])

  const startAll = async () => {
    if (!detector.listening) {
      const ok = await startMic()
      if (!ok) return
    }
    setCountdown(3)
  }

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
      if (i > 0) results.push(hitRef.current ? 'correct' : 'wrong')
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
    setScore(null); startAll()
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Status */}
      <div style={{
        flexShrink: 0, display: 'flex', justifyContent: 'center',
        padding: '2px 16px 4px', gap: 12, alignItems: 'center',
      }}>
        {playing && <span style={{ fontSize: 11, fontWeight: 600, color: C.accent }}>🎤 {detector.heard || '...'}</span>}
        {errorMic && <span style={{ fontSize: 10, color: C.red }}>{errorMic}</span>}
      </div>

      {/* NoteSheet */}
      <div style={{
        flex: 1, minHeight: 0, margin: '0 10px 6px',
        borderRadius: 12, overflow: 'hidden',
        background: '#fff', border: `1px solid ${C.border}`,
      }}>
        <NoteSheet notes={noteItems} active={cursor} />
      </div>

      {/* Score */}
      {done && score && (
        <div style={{ flexShrink: 0, textAlign: 'center', padding: '2px 16px 4px' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.accent, marginBottom: 2 }}>
            🎉 {Math.round(score.hit / score.total * 100)}%
          </div>
          <div style={{ fontSize: 12, color: C.dim }}>
            {score.hit}/{score.total} nốt đúng
            {score.hit / score.total >= 0.8 ? ' · Xuất sắc! ⭐' : score.hit / score.total >= 0.5 ? ' · Tốt lắm! 👏' : ' · Luyện thêm nhé 💪'}
          </div>
        </div>
      )}

      {/* Bottom */}
      <BottomBar
        onReplay={() => {
          stopPlayback(); setScore(null)
          if (detector.listening) setCountdown(3)
          else startAll()
        }}
        onToggle={() => {
          if (playing) { stopPlayback(); return }
          setScore(null); startAll()
        }}
        onSkip={() => { stopPlayback(); detector.stop(); onComplete() }}
        isPlaying={playing}
        isDone={done && !!score}
        replayLabel="Chơi lại"
        speedLabel="Vừa"
        showSpeed={false}
        onSpeedCycle={() => {}}
      />
    </div>
  )
}
