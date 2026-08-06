// ── Learning Flow: 4-step piano learning system ──
// Architecture: StepDefinition[] → dễ thêm/bớt bước, không cần sửa code orchestrator.

import { useState, useRef, useEffect, useMemo } from 'react'
import { NoteSheet } from '../elearn/guitarRenderers'
import type { NoteItem } from '../elearn/guitarRenderers'
import { exerciseToNoteItems, pitchToFreq, playableNoteCount, leftHandToNoteItems } from './notationAdapter'
import { playTone } from '../elearn/audio'
import { usePitchDetector } from './usePitchDetector'
import { pitchClass } from '../elearn/pitch'

// ── Types ────────────────────────────────────────────────────────────────────
interface PianoNote { pitch: string; startBeat: number; duration: number }
interface Exercise { title: string; bpm: number; notes: PianoNote[]; beatsPerBar?: number }

interface StepComponentProps {
  exercise: Exercise
  noteItems: NoteItem[]
  onComplete: () => void
  onBack: () => void
  /** Báo điểm ra ngoài để lưu vào "Bài hát của con" */
  onScore?: (hit: number, total: number) => void
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

// Sau khi bé bấm ▶: cho một khoảng LẶNG để bé rút tay khỏi màn hình, đặt lên
// phím — rồi MỚI tự đếm vào. Không bắt bấm thêm nút nào, vì bấm xong rút tay về
// đàn là đã trễ mất nhịp.
const READY_MS = 2600
const COUNT_IN = 4          // đếm vào trọn một ô nhịp 4/4

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
  isPlaying, isDone, isCountingDown, countdownValue,
  replayLabel, speedLabel, showSpeed = true,
  skipLabel = 'Bỏ qua →', doneLabel = 'Tiếp tục →',
  isWaitingReady = false,
}: {
  onReplay: () => void
  onToggle: () => void
  onSkip: () => void
  onSpeedCycle: () => void
  isPlaying: boolean
  isDone: boolean
  isCountingDown: boolean
  countdownValue: number
  replayLabel: string
  speedLabel: string
  showSpeed?: boolean
  /** Nút phải. Bước cuối đổi thành "Tập bài mới". */
  skipLabel?: string
  /** Nút chính khi đã xong bước. Bước cuối đổi thành "Tập bài mới". */
  doneLabel?: string
  /** Mic đã mở, đang CHỜ bé bấm "Sẵn sàng" rồi mới đếm ngược. */
  isWaitingReady?: boolean
}) {
  const showPlayBtn = !isDone && !isCountingDown
  return (
    <div style={{
      flexShrink: 0, display: 'flex', alignItems: 'center',
      padding: '8px 10px calc(16px + env(safe-area-inset-bottom, 0px))',
      gap: 6,
    }}>
      {/* Left group: Replay + Play + Speed */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
        {/* Replay */}
        <button onClick={onReplay} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '6px 10px', height: 36, borderRadius: 12,
          background: 'rgba(0,0,0,.04)', border: `1px solid ${C.border}`,
          color: C.dim, fontSize: 12, fontWeight: 700,
          fontFamily: 'inherit', cursor: 'pointer',
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          <span style={{ fontSize: 16 }}>↺</span> {replayLabel}
        </button>

        {isWaitingReady ? (
          // "Sẵn sàng" là GIAI ĐOẠN TỰ CHẠY, KHÔNG phải nút — cố ý dùng <div> để
          // không ai bấm được. Bé bấm ▶ xong chỉ việc đặt tay lên phím, hết
          // READY_MS là máy tự đếm vào.
          <div style={{
            padding: '12px 12px', borderRadius: 16,
            minWidth: 104, justifyContent: 'center',
            background: C.green, color: '#fff',
            fontSize: 15, fontWeight: 700,
            boxShadow: '0 4px 16px rgba(16,185,129,.3)',
            display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
            animation: 'rd-breathe 1.6s ease-in-out infinite',
          }}>
            🙌 Sẵn sàng
          </div>
        ) : isDone ? (
          <button onClick={onSkip} style={{
            padding: '12px 16px', borderRadius: 16,
            border: 'none',
            minWidth: 104, justifyContent: 'center',
            background: C.green, color: '#fff',
            fontSize: 15, fontWeight: 700,
            fontFamily: 'inherit', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(16,185,129,.3)',
            display: 'flex', alignItems: 'center', whiteSpace: 'nowrap',
          }}>
            {doneLabel}
          </button>
        ) : isCountingDown ? (
          <div style={{
            padding: '12px 16px', borderRadius: 16,
            minWidth: 104, justifyContent: 'center',
            background: `linear-gradient(135deg,${C.accent},#D97706)`,
            color: '#fff', fontSize: 22, fontWeight: 900,
            display: 'flex', alignItems: 'center',
            boxShadow: '0 4px 16px rgba(245,158,11,.3)',
            animation: 'cd-pop .6s ease-out',
          }} key={countdownValue}>
            {countdownValue}
          </div>
        ) : (
          <button onClick={onToggle} style={{
            padding: '12px 16px', borderRadius: 16,
            border: 'none',
            minWidth: 104, justifyContent: 'center',
            background: isPlaying ? 'rgba(0,0,0,.05)' : `linear-gradient(135deg,${C.accent},#D97706)`,
            color: isPlaying ? C.text : '#fff',
            fontSize: 15, fontWeight: 700,
            fontFamily: 'inherit', cursor: 'pointer',
            display: 'flex', alignItems: 'center', whiteSpace: 'nowrap',
            boxShadow: isPlaying ? 'none' : '0 4px 16px rgba(245,158,11,.3)',
            transition: 'all .2s',
          }}>
            {isPlaying ? '⏸ Dừng' : '▶'}
          </button>
        )}

        {/* Nút tốc độ — ẨN HẲN khi bước không cho đổi. Bản cũ vẫn vẽ nó mờ mờ,
            bấm không được mà vẫn ăn ~54px bề ngang; trên máy 360px điều đó đẩy
            nút "Tập bài mới" ra sát mép, chỉ còn dư 1px. */}
        {showSpeed && (
          <button onClick={onSpeedCycle} style={{
            marginLeft: 2,
            padding: '7px 10px', height: 30, borderRadius: 8,
            border: `1px solid ${C.border}`,
            background: '#fff',
            color: C.dim, fontSize: 11, fontWeight: 700,
            fontFamily: 'inherit', cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}>
            {speedLabel}
          </button>
        )}
      </div>

      {/* Skip — far right */}
      <button onClick={onSkip} style={{
        padding: '7px 11px', height: 36, borderRadius: 12,
        background: 'rgba(0,0,0,.04)', border: '1px solid rgba(0,0,0,.06)',
        color: C.muted, fontSize: 12, fontWeight: 600,
        fontFamily: 'inherit', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0,
        whiteSpace: 'nowrap',
      }}>
        {skipLabel}
      </button>
      <style>{`@keyframes cd-pop{0%{opacity:0;transform:scale(1.8)}50%{opacity:1;transform:scale(.9)}100%{opacity:1;transform:scale(1)}}@keyframes rd-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}`}</style>
    </div>
  )
}

// ── CHẤM ĐIỂM CHO TRẺ CHƯA BIẾT CHỮ ──────────────────────────────────────────
// Bé 5–12 tuổi có thể chưa đọc được chữ nhưng ĐỌC ĐƯỢC SỐ. Nên bảng điểm chỉ
// dùng 3 thứ bé hiểu ngay: SỐ thật to, SAO, và MÀU. Bản cũ toàn chữ nhỏ 12–16px
// ("Xuất sắc!", "Tốt lắm!", "Luyện thêm nhé") — bé không biết đọc thì vô nghĩa.
// Thêm tiếng đàn báo kết quả: nghe cũng hiểu, không cần nhìn.

const STAR_AT = [0.5, 0.7, 0.9]   // ngưỡng 1, 2, 3 sao

function starsOf(hit: number, total: number): number {
  if (!total) return 0
  const r = hit / total
  return r >= STAR_AT[2] ? 3 : r >= STAR_AT[1] ? 2 : r >= STAR_AT[0] ? 1 : 0
}

/** Tiếng báo kết quả — càng nhiều sao càng leo cao. 0 sao: hai nốt trầm nhẹ. */
function playResultSound(stars: number) {
  const up = [261.63, 329.63, 392.0, 523.25]          // Đô Mi Sol Đô
  const seq = stars === 0 ? [220.0, 196.0] : up.slice(0, stars + 1)
  seq.forEach((f, i) => window.setTimeout(() => playTone(f, stars === 0 ? 0.35 : 0.5), i * 170))
}

/** Bảng điểm: sao + số to + hàng chấm từng nốt. Không một chữ nào cần đọc. */
function ScoreCard({ hit, total, results }: {
  hit: number; total: number; results?: ('correct' | 'wrong' | 'pending')[]
}) {
  const stars = starsOf(hit, total)
  const color = stars >= 2 ? C.green : stars === 1 ? C.accent : C.red
  return (
    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '4px 12px 2px' }}>
      <div style={{ display: 'flex', gap: 5 }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            fontSize: 28, lineHeight: 1,
            opacity: i < stars ? 1 : 0.2,
            filter: i < stars ? 'none' : 'grayscale(1)',
            animation: i < stars ? `sc-pop .45s ${i * 0.14}s backwards` : undefined,
          }}>⭐</span>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
        <span style={{ fontSize: 38, fontWeight: 900, color, lineHeight: 1.05 }}>{hit}</span>
        <span style={{ fontSize: 19, fontWeight: 800, color: C.muted }}>/{total}</span>
      </div>
      {results && results.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 300 }}>
          {results.map((r, i) => (
            <div key={i} style={{
              width: 11, height: 11, borderRadius: '50%',
              background: r === 'correct' ? C.green : r === 'wrong' ? C.red : '#E5E0D5',
            }} />
          ))}
        </div>
      )}
      <style>{'@keyframes sc-pop{0%{transform:scale(0);opacity:0}60%{transform:scale(1.3)}100%{transform:scale(1);opacity:1}}'}</style>
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
  /** Báo điểm mỗi lần bé chơi xong một bước có chấm điểm */
  onScore?: (hit: number, total: number) => void
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════════

export default function LearningFlow({ exercise, onBack, onClose, onScore }: Props) {
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
      {/* Top bar — phải chừa tai thỏ/status bar, không thì nút ← và tên bài
          bị vẽ chồng lên giờ và cột pin trên iPhone. */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'calc(env(safe-area-inset-top, 0px) + 8px) 12px 4px',
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

      {/* Timeline progress — stepper */}
      <div style={{
        flexShrink: 0, padding: '6px 10px 2px',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      }}>
        {STEPS.map((s, i) => {
          const isActive = i === stepIdx
          const isDone = completed.has(i)
          const prevDone = i > 0 && completed.has(i - 1)
          return (
            <div key={s.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative' }}>
              {/* Connector line to previous */}
              {i > 0 && (
                <div style={{
                  position: 'absolute', top: 15, right: '50%', width: '100%', height: 3, borderRadius: 2,
                  background: prevDone ? C.green : '#E0DACE',
                  zIndex: 0,
                }} />
              )}
              {/* Circle badge */}
              <div style={{
                position: 'relative', zIndex: 1,
                width: isActive ? 32 : 28, height: isActive ? 32 : 28,
                borderRadius: '50%',
                background: isActive ? C.accent : isDone ? C.green : '#fff',
                border: isActive ? `3px solid ${C.accent}` : isDone ? `2px solid ${C.green}` : `2px solid #D8D0C0`,
                boxShadow: isActive ? `0 3px 12px rgba(194,98,46,.4)` : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: isActive ? 16 : 14,
                color: isActive ? '#fff' : isDone ? '#fff' : C.muted,
                transition: 'all .25s',
                marginBottom: 4,
              }}>
                {isDone && !isActive ? '✓' : s.icon}
              </div>
              {/* Label */}
              <div style={{
                fontSize: 10.5, lineHeight: 1.2, textAlign: 'center',
                fontWeight: isActive ? 800 : isDone ? 700 : 500,
                color: isActive ? C.accent : isDone ? C.green : C.muted,
                transition: 'all .25s',
                padding: '0 2px',
              }}>
                {s.label}
              </div>
            </div>
          )
        })}
      </div>

      {/* Instruction — current step highlighted */}
      <div style={{
        flexShrink: 0, textAlign: 'center', padding: '4px 16px 6px',
      }}>
        <span style={{
          display: 'inline-block',
          fontSize: 12.5, color: C.accent, fontWeight: 700,
          background: 'rgba(194,98,46,.08)',
          padding: '3px 14px', borderRadius: 20,
        }}>
          {STEPS[stepIdx].icon} {STEP_INSTRUCTIONS[curStepId] || ''}
        </span>
      </div>

      {/* Step content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <CurrentStep
          exercise={exercise}
          noteItems={noteItems}
          onComplete={handleComplete}
          onBack={onBack}
          onScore={onScore}
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
      if (note.pitch !== 'rest') {
        try { playTone(pitchToFreq(note.pitch), note.duration * beatMs / 1000) } catch { /* */ }
      }
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
      {/* NoteSheet */}
      <div style={{
        flex: 1, minHeight: 0, margin: '0 10px 6px',
        borderRadius: 12, overflow: 'hidden',
        background: '#fff', border: `1px solid ${C.border}`,
      }}>
        <NoteSheet notes={noteItems} active={cursor} showDur beatsPerBar={exercise.beatsPerBar ?? 4} />
      </div>
      <LeftHandBar exercise={exercise} cursor={cursor} />

      {/* Bottom CTA */}
      <BottomBar
        onReplay={() => { stop(); setDone(false); start() }}
        onToggle={() => playing ? stop() : start()}
        onSkip={() => { stop(); onComplete() }}
        isPlaying={playing}
        isDone={done}
        replayLabel="Nghe lại"
        isCountingDown={false}
        countdownValue={0}
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
  const loopRef = useRef<number | null>(null)

  // Vòng nghe chạy bằng REF, KHÔNG đặt trong useEffect theo state.
  // Bản cũ để vòng lặp trong useEffect có `state` trong deps, mà cleanup lại
  // clearTimeout(timerRef) — nên ngay khi chấm đúng một nốt, setState('correct')
  // làm effect dọn dẹp và GIẾT luôn cái hẹn giờ 500ms sang nốt kế ⇒ đứng im
  // vĩnh viễn ở "✓ Đúng!". Đây là khuôn của guitarRenderers vốn chạy tốt lâu nay:
  // một interval duy nhất cho cả phiên, trạng thái đọc qua ref.
  const cursorRef = useRef(0)
  const stateRef  = useRef<'idle' | 'active' | 'correct' | 'wrong'>('idle')
  const doneRef   = useRef(onComplete)
  useEffect(() => { doneRef.current = onComplete }, [onComplete])

  const setSt  = (s: 'idle' | 'active' | 'correct' | 'wrong') => { stateRef.current = s; setState(s) }
  const setCur = (c: number) => { cursorRef.current = c; setCursor(c) }

  const stopAll = () => {
    if (loopRef.current)  { clearInterval(loopRef.current); loopRef.current = null }
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    detector.stop()
  }

  const tick = () => {
    if (stateRef.current === 'idle') return
    const curNote = exercise.notes[cursorRef.current]
    if (!curNote) return
    // Dấu lặng — tự động qua, không cần mic
    if (curNote.pitch === 'rest') {
      const next = cursorRef.current + 1
      if (next >= exercise.notes.length) { stopAll(); setSt('idle'); doneRef.current(); return }
      setCur(next); setSt('active')
      return
    }
    const d = detector.detect()
    if (!d) { stableRef.current = 0; return }

    const target = pitchClass(pitchToFreq(curNote.pitch))
    if (d.pc === target) {
      wrongRef.current = 0
      if (stateRef.current === 'correct') return      // đang chờ sang nốt kế
      stableRef.current++
      if (stableRef.current >= 3) {
        stableRef.current = 0
        setSt('correct')
        playTone(pitchToFreq(curNote.pitch), 0.3)
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = window.setTimeout(() => {
          const next = cursorRef.current + 1
          if (next >= exercise.notes.length) { stopAll(); setSt('idle'); doneRef.current(); return }
          setCur(next); setSt('active')
        }, 500)
      }
    } else {
      stableRef.current = 0
      if (stateRef.current === 'correct') return      // đừng báo sai khi đang chuyển nốt
      wrongRef.current++
      if (wrongRef.current >= 2) {
        wrongRef.current = 0
        setSt('wrong')
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = window.setTimeout(() => setSt('active'), 400)
      }
    }
  }

  const startMic = async () => {
    setErrorMic('')
    const ok = await detector.start()
    if (!ok) { setErrorMic('Chưa dùng được micro — hãy cho phép quyền micro rồi thử lại.'); return }
    stableRef.current = 0; wrongRef.current = 0
    setSt('active')
    if (loopRef.current) clearInterval(loopRef.current)
    loopRef.current = window.setInterval(tick, 60)
  }

  // Rời màn hình → nhả micro, dọn hẹn giờ
  useEffect(() => () => {
    if (loopRef.current)  clearInterval(loopRef.current)
    if (timerRef.current) clearTimeout(timerRef.current)
    detector.stop()
    // detector.stop ổn định (useCallback), chỉ chạy khi unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Status bar */}
      <div style={{
        flexShrink: 0, display: 'flex', justifyContent: 'center',
        padding: '2px 16px 4px', gap: 16, alignItems: 'center',
      }}>
        {/* Số to — bé chưa biết chữ vẫn đọc được "3 / 7" */}
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: C.text, lineHeight: 1 }}>{cursor + 1}</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: C.muted }}>/{exercise.notes.length}</span>
        </span>
        {state === 'idle' && <span style={{ fontSize: 18, color: C.muted }}>▶</span>}
        {state === 'active' && (
          <span style={{ fontSize: 15, fontWeight: 700, color: C.dim }}>🎤 {detector.heard || '…'}</span>
        )}
        {state === 'correct' && <span style={{ fontSize: 26, color: C.green, lineHeight: 1, animation: 'sc-pop .35s' }}>✓</span>}
        {state === 'wrong' && <span style={{ fontSize: 26, color: C.red, lineHeight: 1, animation: 'sc-pop .35s' }}>✗</span>}
        {errorMic && <span style={{ fontSize: 11, color: C.red }}>{errorMic}</span>}
      </div>

      {/* NoteSheet */}
      <div style={{
        flex: 1, minHeight: 0, margin: '0 10px 6px',
        borderRadius: 12, overflow: 'hidden',
        background: '#fff', border: `1px solid ${C.border}`,
      }}>
        <NoteSheet notes={noteItems} active={state === 'idle' ? -1 : cursor} showDur beatsPerBar={exercise.beatsPerBar ?? 4} />
      </div>
      <LeftHandBar exercise={exercise} cursor={cursor} />

      {/* Bottom */}
      <BottomBar
        // "Tập lại" phải BẬT LẠI MIC nếu đang tắt — bản cũ chỉ đặt state='active'
        // nên nút hiện "⏸ Dừng" mà máy không hề nghe gì.
        onReplay={() => {
          if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
          stableRef.current = 0; wrongRef.current = 0
          setCur(0)
          if (loopRef.current) setSt('active'); else startMic()
        }}
        onToggle={() => {
          if (state === 'idle') startMic()
          else { stopAll(); setSt('idle') }
        }}
        onSkip={() => { stopAll(); onComplete() }}
        isPlaying={state !== 'idle'}
        isDone={false}
        replayLabel="Tập lại"
        isCountingDown={false}
        countdownValue={0}
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

function StepRhythm({ exercise, noteItems, onComplete, onScore }: StepComponentProps) {
  const [playing, setPlaying] = useState(false)
  const [cursor, setCursor] = useState(-1)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [waitReady, setWaitReady] = useState(false)
  const [done, setDone] = useState(false)
  const [score, setScore] = useState<{ hit: number; total: number } | null>(null)
  const [noteResults, setNoteResults] = useState<('correct' | 'wrong' | 'pending')[]>([])
  const [speedIdx, setSpeedIdx] = useState(1)
  const [errorMic, setErrorMic] = useState('')
  const detector = usePitchDetector()
  const timerRef = useRef<number | null>(null)
  const hitRef = useRef(false)
  const cursorRef = useRef(-1)
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
    setWaitReady(true)      // chờ bé đặt tay lên phím rồi tự bấm
  }

  // Hết khoảng chuẩn bị thì TỰ đếm vào — bé không phải bấm gì thêm
  useEffect(() => {
    if (!waitReady) return
    const t = setTimeout(() => { setWaitReady(false); setCountdown(COUNT_IN) }, READY_MS)
    return () => clearTimeout(t)
  }, [waitReady])

  useEffect(() => {
    if (countdown === null) return
    if (countdown > 0) {
      // Đếm vào ĐÚNG tốc độ bài để bé bắt được nhịp, không phải 700ms cố định
      const t = setTimeout(() => setCountdown(c => c! - 1), 60000 / bpm)
      return () => clearTimeout(t)
    }
    setCountdown(null)
    startPlayback()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown])

  // Vòng nghe chạy LIÊN TỤC suốt bài, đọc nốt đang tới qua ref.
  // Bản cũ để `cursor` và `detector` trong deps: `detector` là object mới mỗi lần
  // render, mà mỗi lần detect() lại setHeard → render → effect dọn dẹp và DỰNG LẠI
  // interval. Kết quả là có nốt không kịp nghe, bé đàn đúng vẫn bị chấm sai.
  useEffect(() => {
    if (!playing || done || !detector.listening) return
    const loop = () => {
      const c = cursorRef.current
      if (c < 0 || c >= exercise.notes.length) return
      const d = detector.detect()
      if (!d) return
      // Dấu lặng — tự động đúng, không cần mic nghe
      if (exercise.notes[c]?.pitch === 'rest') { hitRef.current = true; return }
      if (d.pc === pitchClass(pitchToFreq(exercise.notes[c].pitch))) hitRef.current = true
    }
    const id = setInterval(loop, 60)
    return () => clearInterval(id)
    // detector.detect ổn định (useCallback), cursor đọc qua ref → deps chỉ cần 2 cờ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, done, detector.listening])

  const startPlayback = () => {
    stopPlayback()
    setPlaying(true); setDone(false)
    const playableTotal = playableNoteCount(exercise)
    setNoteResults(new Array(playableTotal).fill('pending'))
    const beatMs = 60000 / bpm
    const results: ('correct' | 'wrong')[] = []
      // Hàng chấm là ẢNH CHIẾU của chính mảng `results` đã tính điểm — một nguồn
      // sự thật duy nhất. Trước đây `noteResults` được ghi riêng theo chỉ số nên
      // lệch với số đếm (số báo 2 đúng mà chỉ 1 chấm xanh, lại thừa 1 chấm xám).
      const veCham = () => {
        const arr: ('correct' | 'wrong' | 'pending')[] = [...results]
        while (arr.length < exercise.notes.length) arr.push('pending')
        setNoteResults(arr)
      }
    let i = 0
    let playableIdx = 0  // chỉ đếm nốt thật (bỏ qua rest)
    const tick = () => {
      if (i >= exercise.notes.length) {
        setPlaying(false); setDone(true); cursorRef.current = -1; setCursor(-1)
        // Chấm NỐT CUỐI trước khi tổng kết
        const curNote = exercise.notes[i - 1]
        results.push((curNote?.pitch === 'rest' || hitRef.current) ? 'correct' : 'wrong')
        veCham()
        const hit = results.filter(r => r === 'correct').length
        setScore({ hit, total: playableTotal })
        playResultSound(starsOf(hit, playableTotal))
        onScore?.(hit, playableTotal)
        if (hit / playableTotal >= 0.5) setTimeout(onComplete, 1500)
        return
      }
      if (i > 0) {
        const prevNote = exercise.notes[i - 1]
        results.push((prevNote?.pitch === 'rest' || hitRef.current) ? 'correct' : 'wrong')
        veCham()
      }
      cursorRef.current = i; setCursor(i)
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
      {/* Mic status */}
      <div style={{
        flexShrink: 0, display: 'flex', justifyContent: 'center',
        padding: '2px 16px 4px', gap: 8, alignItems: 'center',
        minHeight: 20,
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
        <NoteSheet notes={noteItems} active={cursor} showDur beatsPerBar={exercise.beatsPerBar ?? 4} />
      </div>
      <LeftHandBar exercise={exercise} cursor={cursor} />

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

      {/* Bảng điểm — số to + sao + màu, không cần biết đọc */}
      {done && score && <ScoreCard hit={score.hit} total={score.total} results={noteResults} />}

      {/* Bottom */}
      <BottomBar
        onReplay={() => {
          stopPlayback(); setScore(null); setNoteResults([])
          if (detector.listening) setWaitReady(true)
          else startAll()
        }}
        onToggle={() => {
          if (playing) { stopPlayback(); setWaitReady(false); return }
          setScore(null); setNoteResults([])
          startAll()
        }}
        onSkip={() => { stopPlayback(); setWaitReady(false); detector.stop(); onComplete() }}
        isPlaying={playing}
        isDone={done && !!score}
        replayLabel="Chơi lại"
        isWaitingReady={waitReady}
        isCountingDown={countdown !== null}
        countdownValue={countdown ?? 0}
        speedLabel={SPEEDS[speedIdx].label}
        onSpeedCycle={() => setSpeedIdx(i => (i + 1) % SPEEDS.length)}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 4 — BIỂU DIỄN
// ═══════════════════════════════════════════════════════════════════════════════

function StepPerform({ exercise, noteItems, onBack, onScore }: StepComponentProps) {
  const [playing, setPlaying] = useState(false)
  const [cursor, setCursor] = useState(-1)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [waitReady, setWaitReady] = useState(false)
  const [done, setDone] = useState(false)
  const [score, setScore] = useState<{ hit: number; total: number } | null>(null)
  const [errorMic, setErrorMic] = useState('')
  const detector = usePitchDetector()
  const timerRef = useRef<number | null>(null)
  const hitRef = useRef(false)
  const cursorRef = useRef(-1)
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
    setWaitReady(true)      // chờ bé đặt tay lên phím rồi tự bấm
  }

  // Hết khoảng chuẩn bị thì TỰ đếm vào — bé không phải bấm gì thêm
  useEffect(() => {
    if (!waitReady) return
    const t = setTimeout(() => { setWaitReady(false); setCountdown(COUNT_IN) }, READY_MS)
    return () => clearTimeout(t)
  }, [waitReady])

  useEffect(() => {
    if (countdown === null) return
    if (countdown > 0) {
      // Đếm vào ĐÚNG tốc độ bài để bé bắt được nhịp, không phải 700ms cố định
      const t = setTimeout(() => setCountdown(c => c! - 1), 60000 / bpm)
      return () => clearTimeout(t)
    }
    setCountdown(null)
    startPlayback()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown])

  // Vòng nghe chạy LIÊN TỤC suốt bài, đọc nốt đang tới qua ref.
  // Bản cũ để `cursor` và `detector` trong deps: `detector` là object mới mỗi lần
  // render, mà mỗi lần detect() lại setHeard → render → effect dọn dẹp và DỰNG LẠI
  // interval. Kết quả là có nốt không kịp nghe, bé đàn đúng vẫn bị chấm sai.
  useEffect(() => {
    if (!playing || done || !detector.listening) return
    const loop = () => {
      const c = cursorRef.current
      if (c < 0 || c >= exercise.notes.length) return
      // Dấu lặng — tự động đúng, không cần mic nghe
      if (exercise.notes[c]?.pitch === 'rest') { hitRef.current = true; return }
      const d = detector.detect()
      if (!d) return
      if (d.pc === pitchClass(pitchToFreq(exercise.notes[c].pitch))) hitRef.current = true
    }
    const id = setInterval(loop, 60)
    return () => clearInterval(id)
    // detector.detect ổn định (useCallback), cursor đọc qua ref → deps chỉ cần 2 cờ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, done, detector.listening])

  const startPlayback = () => {
    stopPlayback()
    setPlaying(true); setDone(false)
    const beatMs = 60000 / bpm
    const results: ('correct' | 'wrong')[] = []
    const playableTotal = playableNoteCount(exercise)
    let i = 0
    const tick = () => {
      if (i >= exercise.notes.length) {
        setPlaying(false); setDone(true); cursorRef.current = -1; setCursor(-1)
        const curNote = exercise.notes[i - 1]
        results.push((curNote?.pitch === 'rest' || hitRef.current) ? 'correct' : 'wrong')
        const hit = results.filter(r => r === 'correct').length
        setScore({ hit, total: playableTotal })
        playResultSound(starsOf(hit, playableTotal))
        onScore?.(hit, playableTotal)
        return
      }
      if (i > 0) {
        const prevNote = exercise.notes[i - 1]
        results.push((prevNote?.pitch === 'rest' || hitRef.current) ? 'correct' : 'wrong')
      }
      cursorRef.current = i; setCursor(i)
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
        <NoteSheet notes={noteItems} active={cursor} showDur beatsPerBar={exercise.beatsPerBar ?? 4} />
      </div>
      <LeftHandBar exercise={exercise} cursor={cursor} />

      {/* Bảng điểm — bỏ % (trẻ chưa hiểu phần trăm) và bỏ hết lời khen bằng chữ */}
      {done && score && <ScoreCard hit={score.hit} total={score.total} />}

      {/* Bottom */}
      <BottomBar
        onReplay={() => {
          stopPlayback(); setScore(null)
          if (detector.listening) setWaitReady(true)
          else startAll()
        }}
        onToggle={() => {
          if (playing) { stopPlayback(); setWaitReady(false); return }
          setScore(null); startAll()
        }}
        // Bước cuối: cả hai nút đều dẫn về Lyra để xin bài mới.
        // Trước đây chúng gọi onComplete() — ở bước cuối hàm này không làm gì cả,
        // nên bé tập xong là cụt đường.
        onSkip={() => { stopPlayback(); setWaitReady(false); detector.stop(); onBack() }}
        skipLabel="Tập bài mới"
        doneLabel="🎹 Tập bài mới"
        isPlaying={playing}
        isDone={done && !!score}
        replayLabel="Chơi lại"
        isWaitingReady={waitReady}
        isCountingDown={countdown !== null}
        countdownValue={countdown ?? 0}
        speedLabel="Vừa"
        showSpeed={false}
        onSpeedCycle={() => {}}
      />
    </div>
  )
}

// ── Hiển thị tay trái (bass) ──────────────────────────────────────────────────

function LeftHandBar({ exercise, cursor }: { exercise: any; cursor: number }) {
  const items = leftHandToNoteItems(exercise)
  if (!items.length) return null
  return (
    <div style={{
      margin: '2px 26px 4px',
      display: 'flex', alignItems: 'center', gap: 6,
      fontSize: 12, fontWeight: 700, color: '#8A8478',
    }}>
      <span style={{ fontSize: 14 }}>🅱</span>
      {items.map((n, i) => (
        <span key={i} style={{
          padding: '2px 10px',
          borderRadius: 8,
          background: cursor >= 0 && i === Math.floor(cursor / (exercise.beatsPerBar ?? 4)) ? '#FDE68A' : '#F5F2EB',
          color: cursor >= 0 && i === Math.floor(cursor / (exercise.beatsPerBar ?? 4)) ? '#92400E' : '#8A8478',
          transition: 'background .2s',
        }}>
          {n.label}
        </span>
      ))}
    </div>
  )
}
