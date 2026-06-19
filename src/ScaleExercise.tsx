import { useState, useEffect, useRef, useMemo } from 'react'
import { playGuitarNote } from './audioEngine'
import { STRING_COLORS, stringLabels, fretMarkers } from './guitarNotes'

// ── Hằng số ─────────────────────────────────────────────────────────────────
const OPEN_FREQ = [82.41, 110, 146.83, 196, 246.94, 329.63]   // dây 6→1
const NM = ['Đô','Đô#','Rê','Rê#','Mi','Fa','Fa#','Sol','Sol#','La','La#','Si']
const OPC = [4, 9, 2, 7, 11, 4]   // pitch class dây buông, index 0=dây6 Mi trầm
const WINDOW_START = 4             // phím đầu cửa sổ hiển thị
const FRET_COUNT   = 5             // phím 4–8

// ── Thế bấm ──────────────────────────────────────────────────────────────────
// frets[stringIdx][]: mảng phím tuyệt đối trên từng dây (index 0=dây6)
// roots: [{s,f}] — vị trí các nốt chủ âm (cam)
interface PositionDef {
  frets: number[][]
  roots: { s: number; f: number }[]
}

const POS_6: PositionDef = {
  frets: [
    [5,7,8], // dây6
    [5,7,8], // dây5
    [5,7],   // dây4
    [4,5,7], // dây3
    [5,6,8], // dây2
    [5,7,8], // dây1
  ],
  roots: [],  // điền theo bài
}

const POS_5: PositionDef = {
  frets: [
    [5,6,8], // dây6
    [5,7,8], // dây5
    [5,7,8], // dây4
    [5,7],   // dây3
    [5,6,8], // dây2
    [5,6,8], // dây1
  ],
  roots: [],
}

// ── 4 Bài luyện ─────────────────────────────────────────────────────────────
interface Lesson {
  id: string
  name: string
  subtitle: string
  pos: PositionDef
  roots: { s: number; f: number }[]
  unlockMin: number
}

const LESSONS: Lesson[] = [
  {
    id: 'major6',
    name: 'Âm giai Trưởng',
    subtitle: 'Đô trưởng · Thế dây 6',
    pos: POS_6,
    roots: [{ s: 0, f: 8 }, { s: 3, f: 5 }, { s: 5, f: 8 }],
    unlockMin: 0,
  },
  {
    id: 'major5',
    name: 'Âm giai Trưởng',
    subtitle: 'Fa trưởng · Thế dây 5',
    pos: POS_5,
    roots: [{ s: 1, f: 8 }, { s: 4, f: 6 }],
    unlockMin: 60,
  },
  {
    id: 'minor6',
    name: 'Âm giai thứ',
    subtitle: 'La thứ · Thế dây 6',
    pos: POS_6,
    roots: [{ s: 0, f: 5 }, { s: 3, f: 7 }, { s: 5, f: 5 }],
    unlockMin: 120,
  },
  {
    id: 'minor5',
    name: 'Âm giai thứ',
    subtitle: 'Rê thứ · Thế dây 5',
    pos: POS_5,
    roots: [{ s: 1, f: 5 }, { s: 2, f: 7 }],
    unlockMin: 180,
  },
]

// Bài khoá nâng cao (chỉ hiển thị)
const LOCKED_LESSONS = [
  { name: 'Ngũ cung', subtitle: 'Pentatonic · Thế dây 6' },
  { name: 'Ngũ cung', subtitle: 'Pentatonic · Thế dây 5' },
  { name: 'Âm giai Trưởng', subtitle: 'Vị trí 2 · Thế dây 4' },
  { name: 'Âm giai thứ', subtitle: 'Vị trí 2 · Thế dây 4' },
]

// ── Tên nốt tại (string, fret) ───────────────────────────────────────────────
function noteName(stringIdx: number, fret: number): string {
  return NM[(OPC[stringIdx] + fret) % 12]
}

// ── Xây chuỗi step (lên rồi xuống) ─────────────────────────────────────────
interface Step { s: number; f: number }   // stringIdx, fret tuyệt đối

function buildSteps(lesson: Lesson): Step[] {
  const up: Step[] = []
  for (let s = 0; s < 6; s++) {
    const fs = [...lesson.pos.frets[s]].sort((a, b) => a - b)
    for (const f of fs) up.push({ s, f })
  }
  const down = [...up].reverse()
  return [...up, ...down]
}

// ── Metronome click ──────────────────────────────────────────────────────────
let _clkCtx: AudioContext | null = null
function playClick(accent: boolean) {
  try {
    if (!_clkCtx) _clkCtx = new AudioContext()
    if (_clkCtx.state === 'suspended') _clkCtx.resume()
    const osc = _clkCtx.createOscillator()
    const g   = _clkCtx.createGain()
    osc.connect(g); g.connect(_clkCtx.destination)
    osc.frequency.value = accent ? 1200 : 900
    const t = _clkCtx.currentTime
    g.gain.setValueAtTime(accent ? 0.28 : 0.12, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
    osc.start(t); osc.stop(t + 0.05)
  } catch { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Fretboard 5 phím (cửa sổ WINDOW_START .. WINDOW_START+FRET_COUNT-1)
// Nốt trong thế = chấm mờ trắng; chủ âm = cam; đang chơi = tím + tên nốt
// ═══════════════════════════════════════════════════════════════════════════════
function ScaleFretboard({
  lesson,
  activeStep,
}: {
  lesson: Lesson
  activeStep: Step | null
}) {
  const BOARD_H = 180
  const STRING_CNT = 6
  const rowY  = (row: number) => ((row + 0.5) / STRING_CNT) * 100
  const slotX = (fret: number) => {
    const slot = fret - WINDOW_START   // 0-indexed
    return ((slot + 0.5) / FRET_COUNT) * 100
  }
  const strW = (si: number) => 3.4 - si * (2.4 / 5)

  // Build set nốt chủ âm để tra nhanh
  const rootSet = new Set(lesson.roots.map(r => `${r.s}-${r.f}`))

  return (
    <div>
      <div style={{ display: 'flex', height: BOARD_H }}>

        {/* Nhãn dây trái */}
        <div style={{ width: 28, flexShrink: 0, position: 'relative' }}>
          {[0,1,2,3,4,5].map(row => {
            const si = 5 - row
            return (
              <div key={row} style={{
                position: 'absolute', right: 4,
                top: `${rowY(row)}%`, transform: 'translateY(-50%)',
                fontSize: 9, fontWeight: 700, color: STRING_COLORS[si],
                letterSpacing: '-.02em', userSelect: 'none',
              }}>
                {stringLabels[si]}
              </div>
            )
          })}
        </div>

        {/* Thân cần đàn */}
        <div style={{
          flex: 1, position: 'relative',
          background: 'linear-gradient(180deg,#1e1008 0%,#20140F 55%,#1a0d06 100%)',
          border: '1.5px solid #3a2a1f',
          borderRadius: '0 8px 8px 0',
          overflow: 'hidden',
        }}>

          {/* Fret wires */}
          {[1,2,3,4].map(i => (
            <div key={i} style={{
              position: 'absolute',
              left: `${(i / FRET_COUNT) * 100}%`,
              top: 0, bottom: 0, width: 2,
              background: 'linear-gradient(90deg,#777,#bbb,#777)',
              zIndex: 3,
              boxShadow: '0 0 3px rgba(0,0,0,0.5)',
            }} />
          ))}

          {/* Inlay dots (phím 5, 7 nằm trong cửa sổ 4–8) */}
          {[4,5,6,7,8].map(fret => {
            if (!fretMarkers.includes(fret)) return null
            const slot = fret - WINDOW_START
            return (
              <div key={fret} style={{
                position: 'absolute',
                left: `${(slot + 0.5) / FRET_COUNT * 100}%`,
                top: '50%',
                transform: 'translate(-50%,-50%)',
                width: 14, height: 14, borderRadius: '50%',
                background: 'rgba(255,255,255,0.09)',
                border: '1px solid rgba(255,255,255,0.06)',
                zIndex: 1,
              }} />
            )
          })}

          {/* Dây đàn */}
          {[0,1,2,3,4,5].map(row => {
            const si = 5 - row
            const thick = strW(si)
            return (
              <div key={row} style={{
                position: 'absolute',
                left: 0, right: 0,
                top: `${rowY(row)}%`,
                height: thick,
                marginTop: -(thick / 2),
                background: `linear-gradient(90deg,${STRING_COLORS[si]}99,${STRING_COLORS[si]})`,
                zIndex: 3,
                boxShadow: '0 1px 3px rgba(0,0,0,0.7)',
              }} />
            )
          })}

          {/* Nốt trong thế: mờ trắng / chủ âm cam / đang chơi tím */}
          {lesson.pos.frets.flatMap((fretsOnStr, si) =>
            fretsOnStr.map(fret => {
              const row   = 5 - si
              const xPct  = slotX(fret)
              const yPct  = rowY(row)
              const key   = `${si}-${fret}`
              const isRoot    = rootSet.has(key)
              const isActive  = activeStep?.s === si && activeStep?.f === fret
              const bgColor   = isActive ? '#4338CA'
                              : isRoot   ? '#EA580C'
                              : 'rgba(255,255,255,0.22)'
              const border    = isActive ? '2px solid rgba(255,255,255,0.85)'
                              : isRoot   ? '2px solid rgba(255,255,255,0.55)'
                              : '1.5px solid rgba(255,255,255,0.15)'
              const size      = isActive ? 28 : isRoot ? 26 : 22
              return (
                <div key={key} style={{
                  position: 'absolute',
                  left: `${xPct}%`, top: `${yPct}%`,
                  width: size, height: size,
                  marginLeft: -(size/2), marginTop: -(size/2),
                  borderRadius: '50%',
                  background: bgColor,
                  border,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: isActive ? 9 : 0,
                  fontWeight: 900, color: '#fff',
                  zIndex: isActive ? 12 : isRoot ? 8 : 5,
                  boxShadow: isActive ? '0 0 14px rgba(67,56,202,0.9)' : isRoot ? '0 0 8px rgba(234,88,12,0.6)' : 'none',
                  transition: 'background .07s',
                  overflow: 'hidden',
                }}>
                  {isActive && (
                    <span style={{ fontSize: 8, lineHeight: 1, textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {noteName(si, fret)}
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Số phím dưới */}
      <div style={{ display: 'flex', marginLeft: 28, marginTop: 5 }}>
        {Array.from({ length: FRET_COUNT }, (_, i) => {
          const fret = WINDOW_START + i
          const marked = fretMarkers.includes(fret)
          return (
            <div key={i} style={{
              flex: 1, textAlign: 'center',
              fontSize: 11,
              fontWeight: marked ? 700 : 400,
              color: marked ? '#C99700' : '#9CA3AF',
            }}>
              {fret}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════
interface Props {
  totalMinutes: number     // tổng phút đã luyện 'scale'
  onClose: () => void
}

export default function ScaleExercise({ totalMinutes, onClose }: Props) {
  const P1 = '#4338CA', A1 = '#EA580C', BG = '#F0F2F5'

  // Danh sách bài đã mở
  const unlockedLessons = useMemo(
    () => LESSONS.filter(l => totalMinutes >= l.unlockMin),
    [totalMinutes]
  )
  // Nếu chưa mở bài nào thì vẫn mở bài 1 (unlockMin=0)
  const availableLessons = unlockedLessons.length > 0 ? unlockedLessons : [LESSONS[0]]

  const [lessonIdx, setLessonIdx] = useState(0)
  const [bpm,       setBpm]       = useState(60)
  const [playing,   setPlaying]   = useState(false)
  const [activeStep, setActiveStep] = useState<Step | null>(null)
  const [beatDot,    setBeatDot]    = useState(0)
  const [stepCount,  setStepCount]  = useState(0)
  // Âm thanh
  const [guitarOn, setGuitarOn] = useState(true)
  const [muted,    setMuted]    = useState(false)

  const curLesson = availableLessons[lessonIdx % availableLessons.length]
  const steps     = useMemo(() => buildSteps(curLesson), [curLesson])

  // Refs
  const playingRef  = useRef(false)
  const stepIdxRef  = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stepsRef    = useRef(steps)
  const bpmRef      = useRef(bpm)
  const guitarOnRef = useRef(true)
  const mutedRef    = useRef(false)

  stepsRef.current    = steps
  bpmRef.current      = bpm
  guitarOnRef.current = guitarOn
  mutedRef.current    = muted

  const playStep = () => {
    const si   = stepIdxRef.current % stepsRef.current.length
    const step = stepsRef.current[si]

    if (!mutedRef.current) {
      if (guitarOnRef.current) {
        const freq = OPEN_FREQ[step.s] * Math.pow(2, step.f / 12)
        try { playGuitarNote(freq, step.s) } catch { /* ignore */ }
      }
      playClick(stepIdxRef.current % 4 === 0)
    }

    setActiveStep(step)
    setBeatDot(stepIdxRef.current % 4)
    setStepCount(c => c + 1)
    stepIdxRef.current++
  }

  const startScheduler = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    stepIdxRef.current = 0
    const ms = Math.round(60000 / bpmRef.current)
    playStep()
    intervalRef.current = setInterval(playStep, ms)
  }

  const stopScheduler = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    setActiveStep(null); setBeatDot(0)
  }

  const togglePlay = () => {
    if (playing) {
      playingRef.current = false; stopScheduler(); setPlaying(false)
    } else {
      playingRef.current = true; startScheduler(); setPlaying(true)
    }
  }

  // Restart khi đổi bài / bpm lúc đang chạy
  useEffect(() => {
    if (playingRef.current) { stopScheduler(); startScheduler() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonIdx, bpm])

  useEffect(() => {
    return () => { playingRef.current = false; stopScheduler() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tên nốt đang chơi
  const activeNoteName = activeStep ? noteName(activeStep.s, activeStep.f) : null

  // Phần trăm mở khoá bài tiếp theo
  const nextLocked = LESSONS.find(l => totalMinutes < l.unlockMin)
  const progressPct = nextLocked
    ? Math.min(100, (totalMinutes / nextLocked.unlockMin) * 100)
    : 100

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: BG, display: 'flex', flexDirection: 'column',
      fontFamily: '"SF Pro Display","DM Sans",system-ui,sans-serif',
      overflow: 'hidden',
    }}>

      {/* ── Header ── */}
      <div style={{
        background: P1,
        paddingTop: 'env(safe-area-inset-top,44px)',
        paddingLeft: 16, paddingRight: 16, paddingBottom: 16,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <button
            onClick={() => { playingRef.current = false; stopScheduler(); onClose() }}
            style={{ background: 'rgba(255,255,255,.18)', border: 'none', borderRadius: 10, padding: '8px 14px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            ← Đóng
          </button>
          <span style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>🎼 Âm giai</span>
          <div style={{ width: 64 }} />
        </div>

        {/* Tên bài + progress */}
        <div style={{ background: 'rgba(255,255,255,.14)', borderRadius: 12, padding: '10px 14px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{curLesson.name}</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.8)', marginTop: 2 }}>{curLesson.subtitle}</div>
          {nextLocked && (
            <>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', marginTop: 6 }}>
                Còn {nextLocked.unlockMin - totalMinutes}′ để mở "{nextLocked.name} · {nextLocked.subtitle}"
              </div>
              <div style={{ marginTop: 6, height: 4, borderRadius: 99, background: 'rgba(255,255,255,.2)' }}>
                <div style={{ height: '100%', borderRadius: 99, background: '#fff', width: `${progressPct}%`, transition: 'width .4s' }} />
              </div>
            </>
          )}
          {!nextLocked && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.8)', marginTop: 4 }}>✓ Đã mở tất cả bài</div>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Card cần đàn */}
        <div style={{ background: '#fff', borderRadius: 18, padding: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.09)' }}>

          {/* Row: beat dots + nốt đang chơi */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Nốt hiện tại</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: P1, minHeight: 32 }}>
                {activeNoteName ?? '—'}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
              {/* Beat dots */}
              <div style={{ display: 'flex', gap: 5 }}>
                {[0,1,2,3].map(i => (
                  <div key={i} style={{
                    width: 11, height: 11, borderRadius: '50%',
                    background: playing && beatDot === i ? A1 : '#E5E7EB',
                    boxShadow: playing && beatDot === i ? `0 0 8px ${A1}88` : 'none',
                    transition: 'background .07s',
                  }} />
                ))}
              </div>
              {/* Step counter */}
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                {playing ? `Nốt ${(stepCount % steps.length) + 1}/${steps.length}` : '—'}
              </div>
            </div>
          </div>

          {/* Cần đàn */}
          <ScaleFretboard lesson={curLesson} activeStep={activeStep} />

          {/* Chú thích màu */}
          <div style={{ display: 'flex', gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
            {[
              { color: 'rgba(255,255,255,0.5)', border: '1.5px solid rgba(100,100,100,0.4)', bg: '#555', label: 'Nốt trong thế' },
              { color: A1, label: 'Chủ âm' },
              { color: P1, label: 'Đang chơi' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{
                  width: 12, height: 12, borderRadius: '50%',
                  background: item.color,
                  border: item.border ?? `2px solid ${item.color}55`,
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 12, color: '#6B7280' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chọn bài */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <div style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Chọn bài</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {LESSONS.map((l, i) => {
              const locked   = totalMinutes < l.unlockMin
              const isActive = !locked && availableLessons[lessonIdx % availableLessons.length]?.id === l.id
              return (
                <button key={l.id}
                  disabled={locked}
                  onClick={() => {
                    if (!locked) {
                      const idx = availableLessons.findIndex(al => al.id === l.id)
                      if (idx >= 0) setLessonIdx(idx)
                    } else {
                      alert(`Cần luyện thêm ${l.unlockMin - totalMinutes} phút để mở bài này.`)
                    }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: isActive ? `${P1}14` : locked ? '#F9FAFB' : '#F3F4F6',
                    border: `1.5px solid ${isActive ? P1 : 'transparent'}`,
                    borderRadius: 12, padding: '10px 14px',
                    cursor: locked ? 'default' : 'pointer',
                    fontFamily: 'inherit', textAlign: 'left', opacity: locked ? 0.55 : 1,
                  }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: isActive ? P1 : '#374151' }}>
                      {locked ? '🔒 ' : ''}{l.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{l.subtitle}</div>
                  </div>
                  {locked
                    ? <div style={{ fontSize: 12, color: '#9CA3AF', flexShrink: 0 }}>{l.unlockMin}′</div>
                    : isActive
                      ? <div style={{ fontSize: 12, fontWeight: 700, color: P1, flexShrink: 0 }}>● Đang dùng</div>
                      : null
                  }
                </button>
              )
            })}

            {/* Bài nâng cao khoá */}
            {LOCKED_LESSONS.map((l, i) => (
              <button key={`adv-${i}`}
                onClick={() => alert('Dành cho học sinh nâng cao.')}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: '#F9FAFB', border: '1.5px solid transparent',
                  borderRadius: 12, padding: '10px 14px',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', opacity: 0.45,
                }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>🔒 Nâng cao · {l.name}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{l.subtitle}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* ── Controls ── */}
      <div style={{
        background: '#fff',
        borderTop: '1px solid #E8EAF0',
        padding: '12px 16px',
        paddingBottom: 'max(20px, env(safe-area-inset-bottom,20px))',
        display: 'flex', flexDirection: 'column', gap: 10,
        flexShrink: 0,
      }}>

        {/* Nút chính */}
        <button onClick={togglePlay} style={{
          width: '100%', border: 'none', borderRadius: 16, padding: '15px',
          fontSize: 17, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
          background: playing
            ? 'linear-gradient(135deg,#EF4444,#DC2626)'
            : `linear-gradient(135deg,${P1},#6366F1)`,
          color: '#fff',
          boxShadow: playing ? '0 4px 16px rgba(239,68,68,.35)' : `0 4px 16px ${P1}44`,
        }}>
          {playing ? '⏸ Tạm dừng' : '▶ Bắt đầu'}
        </button>

        {/* BPM + Bài kế */}
        <div style={{ display: 'flex', gap: 8 }}>
          {/* BPM stepper */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 0,
            background: '#F3F4F6', borderRadius: 12, overflow: 'hidden', flexShrink: 0,
          }}>
            <button
              onClick={() => setBpm(v => Math.max(40, v - 5))}
              style={{ padding: '10px 14px', border: 'none', background: 'transparent', fontSize: 17, fontWeight: 700, color: '#6B7280', cursor: 'pointer', fontFamily: 'inherit' }}>
              −
            </button>
            <div style={{ minWidth: 52, textAlign: 'center', fontSize: 14, fontWeight: 800, color: P1 }}>
              {bpm} BPM
            </div>
            <button
              onClick={() => setBpm(v => Math.min(160, v + 5))}
              style={{ padding: '10px 14px', border: 'none', background: 'transparent', fontSize: 17, fontWeight: 700, color: '#6B7280', cursor: 'pointer', fontFamily: 'inherit' }}>
              +
            </button>
          </div>

          {/* Bài kế */}
          <button
            onClick={() => setLessonIdx(i => (i + 1) % availableLessons.length)}
            style={{ flex: 1, background: '#EEF2FF', color: P1, border: 'none', borderRadius: 12, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Bài kế →
          </button>
        </div>

        {/* Âm thanh */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setGuitarOn(v => !v)}
            style={{
              flex: 1, border: 'none', borderRadius: 12, padding: '11px 6px',
              fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              background: guitarOn && !muted ? '#EEF2FF' : '#F3F4F6',
              color:      guitarOn && !muted ? P1 : '#9CA3AF',
              opacity: muted ? 0.45 : 1,
              transition: 'background .15s, color .15s',
            }}>
            {guitarOn ? '🎸 Đàn' : '🔕 Đàn'}
          </button>
          <button
            onClick={() => setMuted(v => !v)}
            style={{
              flex: 1, border: 'none', borderRadius: 12, padding: '11px 6px',
              fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              background: muted ? '#FEE2E2' : '#F3F4F6',
              color:      muted ? '#DC2626' : '#9CA3AF',
              transition: 'background .15s, color .15s',
            }}>
            {muted ? '🔇 Đang tắt' : '🔊 Âm thanh'}
          </button>
        </div>
      </div>
    </div>
  )
}
