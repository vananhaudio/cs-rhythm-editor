import { useState, useEffect, useRef, useMemo } from 'react'
import { playGuitarNote } from './audioEngine'
import { STRING_COLORS, stringLabels, fretMarkers } from './guitarNotes'

// ── Tần số dây mở (index 0 = Mi thấp / low-E, 5 = Mi cao / high-e) ──────────
const OPEN_FREQ = [82.41, 110, 146.83, 196, 246.94, 329.63]

const PATTERNS = [
  [1, 2, 3, 4],
  [1, 3, 2, 4],
  [4, 3, 2, 1],
  [2, 4, 1, 3],
  [1, 2, 3, 4],
]
const PATTERN_NAMES = ['1-2-3-4', '1-3-2-4', '4-3-2-1', '2-4-1-3', '1-2-3-4 (nhanh)']

type Sub = 'den' | 'don' | 'kep'
const SUB_LABEL: Record<Sub, string> = { den: 'Nốt đen', don: 'Móc đơn', kep: 'Móc kép' }
const NOTES_PER_BEAT: Record<Sub, number> = { den: 1, don: 2, kep: 4 }
const START_FRET = 1

interface Level { n: number; sub: Sub; bpm: number; unlockMin: number }

const BASE_LEVELS: Level[] = [
  { n: 1,  sub: 'den', bpm: 60,  unlockMin: 0   },
  { n: 2,  sub: 'den', bpm: 80,  unlockMin: 60  },
  { n: 3,  sub: 'den', bpm: 100, unlockMin: 120 },
  { n: 4,  sub: 'don', bpm: 60,  unlockMin: 180 },
  { n: 5,  sub: 'don', bpm: 75,  unlockMin: 240 },
  { n: 6,  sub: 'don', bpm: 90,  unlockMin: 330 },
  { n: 7,  sub: 'don', bpm: 105, unlockMin: 420 },
  { n: 8,  sub: 'kep', bpm: 60,  unlockMin: 510 },
  { n: 9,  sub: 'kep', bpm: 70,  unlockMin: 630 },
  { n: 10, sub: 'kep', bpm: 80,  unlockMin: 750 },
]

function calcLevel(totalMin: number): Level {
  let best = BASE_LEVELS[0]
  for (const lv of BASE_LEVELS) { if (totalMin >= lv.unlockMin) best = lv }
  if (totalMin >= 750) {
    const extra = Math.floor((totalMin - 750) / 120)
    if (extra >= 1) best = { n: 10 + extra, sub: 'kep', bpm: 80 + extra * 10, unlockMin: 750 + extra * 120 }
  }
  return best
}

function nextLevelOf(lv: Level): Level {
  if (lv.n < 10) return BASE_LEVELS[lv.n]
  const extra = lv.n - 10 + 1
  return { n: lv.n + 1, sub: 'kep', bpm: 80 + extra * 10, unlockMin: 750 + extra * 120 }
}

function shiftLevel(lv: Level, delta: number): Level {
  const target = Math.max(1, lv.n + delta)
  if (target <= 10) return BASE_LEVELS[target - 1]
  const extra = target - 10
  return { n: target, sub: 'kep', bpm: 80 + extra * 10, unlockMin: 750 + extra * 120 }
}

interface Step { stringIdx: number; finger: number; fret: number; patternPos: number }

function buildSteps(patternIdx: number): Step[] {
  const p = PATTERNS[patternIdx]
  const out: Step[] = []
  const push = (s: number) => p.forEach((f, j) =>
    out.push({ stringIdx: s, finger: f, fret: START_FRET + f - 1, patternPos: j }))
  for (let s = 0; s < 6; s++) push(s)   // Mi thấp → Mi cao
  for (let s = 5; s >= 0; s--) push(s)  // Mi cao  → Mi thấp
  return out
}

// ── Metronome click ───────────────────────────────────────────────────────────
let _clickCtx: AudioContext | null = null
function playClick(accent: boolean) {
  try {
    if (!_clickCtx) _clickCtx = new AudioContext()
    if (_clickCtx.state === 'suspended') _clickCtx.resume()
    const osc = _clickCtx.createOscillator()
    const g   = _clickCtx.createGain()
    osc.connect(g); g.connect(_clickCtx.destination)
    osc.frequency.value = accent ? 1200 : 900
    const t = _clickCtx.currentTime
    g.gain.setValueAtTime(accent ? 0.28 : 0.12, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
    osc.start(t); osc.stop(t + 0.05)
  } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fretboard gỗ tối — tái dùng style của GuitarBoard
// activeStringIdx: 0=Mi thấp..5=Mi cao  |  activeFinger: 1..4 | null = không hiện nốt
// ─────────────────────────────────────────────────────────────────────────────
function FretboardMini({
  activeStringIdx,
  activeFinger,
}: {
  activeStringIdx: number | null
  activeFinger: number | null
}) {
  const FRET_COUNT  = 4   // hiển thị 4 phím
  const STRING_CNT  = 6
  const BOARD_H     = 156 // px

  // string 0 (Mi thấp) = visual row cuối; string 5 (Mi cao) = visual row 0
  const visualRow = (si: number) => 5 - si

  // Y tâm của visual row (tính theo %)
  const rowY = (row: number) => ((row + 0.5) / STRING_CNT) * 100

  // X tâm của fret slot (tính theo %)
  const slotX = (finger: number) => {
    const slot = (START_FRET + finger - 1) - START_FRET // 0-indexed
    return ((slot + 0.5) / FRET_COUNT) * 100
  }

  // Độ dày dây: string 0 dày ~3.4px, string 5 mỏng ~1px
  const strW = (si: number) => 3.4 - si * (2.4 / 5)

  return (
    <div>
      {/* Hàng nhãn dây + fretboard */}
      <div style={{ display: 'flex', height: BOARD_H }}>

        {/* Cột nhãn dây (trái) */}
        <div style={{ width: 28, flexShrink: 0, position: 'relative', paddingRight: 2 }}>
          {[0,1,2,3,4,5].map(row => {
            const si = 5 - row
            return (
              <div key={row} style={{
                position: 'absolute',
                right: 4,
                top: `${rowY(row)}%`,
                transform: 'translateY(-50%)',
                fontSize: 9,
                fontWeight: 700,
                color: STRING_COLORS[si],
                letterSpacing: '-.02em',
                textShadow: 'none',
                userSelect: 'none',
              }}>
                {stringLabels[si]}
              </div>
            )
          })}
        </div>

        {/* Thân cần đàn */}
        <div style={{
          flex: 1,
          position: 'relative',
          background: 'linear-gradient(180deg,#1e1008 0%,#20140F 55%,#1a0d06 100%)',
          border: '1.5px solid #3a2a1f',
          borderRadius: '0 8px 8px 0',
          overflow: 'hidden',
        }}>

          {/* NUT — màu xương */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 5,
            background: 'linear-gradient(90deg,#b8ac90,#ede3cc,#b8ac90)',
            zIndex: 4,
            boxShadow: '2px 0 5px rgba(0,0,0,0.5)',
          }} />

          {/* Fret wires giữa các khoang (25%, 50%, 75%) */}
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              position: 'absolute',
              left: `${i * 25}%`,
              top: 0, bottom: 0, width: 2,
              background: 'linear-gradient(90deg,#888,#bbb,#888)',
              zIndex: 3,
              boxShadow: '0 0 3px rgba(0,0,0,0.5)',
            }} />
          ))}

          {/* Inlay dots cho fret trong range */}
          {[0,1,2,3].map(slot => {
            const fret = START_FRET + slot
            if (!fretMarkers.includes(fret)) return null
            return (
              <div key={slot} style={{
                position: 'absolute',
                left: `${(slot + 0.5) / FRET_COUNT * 100}%`,
                top: '50%',
                transform: 'translate(-50%,-50%)',
                width: 14, height: 14,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.09)',
                border: '1px solid rgba(255,255,255,0.06)',
                zIndex: 1,
              }} />
            )
          })}

          {/* Dây đàn — horizontal lines */}
          {[0,1,2,3,4,5].map(row => {
            const si = 5 - row
            const thick = strW(si)
            return (
              <div key={row} style={{
                position: 'absolute',
                left: 5, right: 0,
                top: `${rowY(row)}%`,
                height: thick,
                marginTop: -(thick / 2),
                background: `linear-gradient(90deg,${STRING_COLORS[si]}99,${STRING_COLORS[si]})`,
                zIndex: 3,
                boxShadow: `0 1px 3px rgba(0,0,0,0.7)`,
              }} />
            )
          })}

          {/* Nốt đang bấm */}
          {activeStringIdx !== null && activeFinger !== null && (() => {
            const row  = visualRow(activeStringIdx)
            const xPct = slotX(activeFinger)
            const yPct = rowY(row)
            return (
              <div style={{
                position: 'absolute',
                left: `${xPct}%`,
                top: `${yPct}%`,
                width: 26, height: 26,
                marginLeft: -13, marginTop: -13,
                borderRadius: '50%',
                background: '#4338CA',
                border: '2px solid rgba(255,255,255,0.75)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 900, color: '#fff',
                zIndex: 10,
                boxShadow: '0 0 14px rgba(67,56,202,0.95), 0 2px 6px rgba(0,0,0,0.5)',
                // transition nhẹ để nốt không nhảy đột ngột
                transition: 'left .07s ease-out, top .07s ease-out',
              }}>
                {activeFinger}
              </div>
            )
          })()}
        </div>
      </div>

      {/* Số phím bên dưới */}
      <div style={{ display: 'flex', marginLeft: 28, marginTop: 5 }}>
        {[0,1,2,3].map(slot => {
          const fret = START_FRET + slot
          const isMarked = fretMarkers.includes(fret)
          return (
            <div key={slot} style={{
              flex: 1, textAlign: 'center',
              fontSize: 10, fontWeight: isMarked ? 700 : 400,
              color: isMarked ? '#C99700' : '#9CA3AF',
            }}>
              {fret}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  totalMinutes: number
  onClose: () => void
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function FingerExercise({ totalMinutes, onClose }: Props) {
  const [patternIdx,   setPatternIdx]   = useState(0)
  const [playing,      setPlaying]      = useState(false)
  const [levelDelta,   setLevelDelta]   = useState(0)
  // Nốt đang hiển thị trên cần đàn
  const [activeStrIdx, setActiveStrIdx] = useState<number | null>(null)
  const [activeFinger, setActiveFinger] = useState<number | null>(null)
  // Dots nhịp
  const [beatDotIdx,   setBeatDotIdx]   = useState(0)
  const [fingerDotIdx, setFingerDotIdx] = useState(0)

  const autoLevel  = useMemo(() => calcLevel(totalMinutes), [totalMinutes])
  const curLevel   = useMemo(() => shiftLevel(autoLevel, levelDelta), [autoLevel, levelDelta])
  const nextLv     = useMemo(() => nextLevelOf(autoLevel), [autoLevel])
  const minsToNext = nextLv.unlockMin - totalMinutes
  const progressPct = Math.min(100, Math.max(0,
    (totalMinutes - autoLevel.unlockMin) / Math.max(1, nextLv.unlockMin - autoLevel.unlockMin) * 100
  ))

  const steps = useMemo(() => buildSteps(patternIdx), [patternIdx])

  // ── Refs (tránh stale closure trong setInterval) ──────────────────────────
  const playingRef  = useRef(false)
  const stepIdxRef  = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stepsRef    = useRef(steps)
  const bpmRef      = useRef(curLevel.bpm)
  const npbRef      = useRef(NOTES_PER_BEAT[curLevel.sub])

  stepsRef.current = steps
  bpmRef.current   = curLevel.bpm
  npbRef.current   = NOTES_PER_BEAT[curLevel.sub]

  // ── Phát một nốt ─────────────────────────────────────────────────────────
  const playStep = () => {
    const si   = stepIdxRef.current % stepsRef.current.length
    const step = stepsRef.current[si]
    const freq = OPEN_FREQ[step.stringIdx] * Math.pow(2, step.fret / 12)
    try { playGuitarNote(freq, step.stringIdx) } catch { /* ignore */ }

    const npb = npbRef.current
    if (stepIdxRef.current % npb === 0) {
      playClick(Math.floor(stepIdxRef.current / npb) % 4 === 0)
    }

    setActiveStrIdx(step.stringIdx)
    setActiveFinger(step.finger)
    setBeatDotIdx(Math.floor(stepIdxRef.current / npb) % 4)
    setFingerDotIdx(stepIdxRef.current % 4)

    stepIdxRef.current++
  }

  // ── Scheduler ────────────────────────────────────────────────────────────
  const startScheduler = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    stepIdxRef.current = 0
    const ms = Math.round(60000 / (bpmRef.current * npbRef.current))
    playStep()
    intervalRef.current = setInterval(playStep, ms)
  }

  const stopScheduler = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    setActiveStrIdx(null); setActiveFinger(null)
    setBeatDotIdx(0); setFingerDotIdx(0)
  }

  const togglePlay = () => {
    if (playing) {
      playingRef.current = false; stopScheduler(); setPlaying(false)
    } else {
      playingRef.current = true; startScheduler(); setPlaying(true)
    }
  }

  // Restart khi đổi pattern / level lúc đang chạy
  useEffect(() => {
    if (playingRef.current) { stopScheduler(); startScheduler() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patternIdx, curLevel.n])

  // Cleanup
  useEffect(() => {
    return () => { playingRef.current = false; stopScheduler() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Colors ───────────────────────────────────────────────────────────────
  const P1 = '#4338CA', A1 = '#EA580C', BG = '#F0F2F5'
  const canGoDown = autoLevel.n + levelDelta > 1

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
            style={{ background: 'rgba(255,255,255,.18)', border: 'none', borderRadius: 10, padding: '8px 14px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            ← Đóng
          </button>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>🖐 Luyện ngón</span>
          <div style={{ width: 64 }} />
        </div>

        {/* Badge trình */}
        <div style={{ background: 'rgba(255,255,255,.14)', borderRadius: 12, padding: '10px 14px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>Trình {curLevel.n} · {SUB_LABEL[curLevel.sub]} ♩={curLevel.bpm}</span>
            {levelDelta < 0 && <span style={{ fontSize: 11, opacity: 0.7 }}>({-levelDelta} bậc dưới)</span>}
          </div>
          {minsToNext > 0 && (
            <>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.75)', marginTop: 4 }}>
                Còn {minsToNext}′ để lên Trình {nextLv.n}
              </div>
              <div style={{ marginTop: 7, height: 4, borderRadius: 99, background: 'rgba(255,255,255,.2)' }}>
                <div style={{ height: '100%', borderRadius: 99, background: '#fff', width: `${progressPct}%`, transition: 'width .4s' }} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Body scrollable ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Card: Cần đàn + pattern name + dots */}
        <div style={{ background: '#fff', borderRadius: 18, padding: '16px', boxShadow: '0 1px 6px rgba(0,0,0,0.09)' }}>

          {/* Row: tên mẫu + beat dots */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Mẫu ngón</div>
              <div style={{ fontSize: 19, fontWeight: 900, color: P1 }}>{PATTERN_NAMES[patternIdx]}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              {/* 4 chấm phách */}
              <div style={{ display: 'flex', gap: 5 }}>
                {[0,1,2,3].map(i => (
                  <div key={i} style={{
                    width: 11, height: 11, borderRadius: '50%',
                    background: playing && beatDotIdx === i ? A1 : '#E5E7EB',
                    boxShadow: playing && beatDotIdx === i ? `0 0 8px ${A1}88` : 'none',
                    transition: 'background .07s',
                  }} />
                ))}
              </div>
              {/* 4 chấm ngón */}
              <div style={{ display: 'flex', gap: 4 }}>
                {[0,1,2,3].map(i => (
                  <div key={i} style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: playing && fingerDotIdx === i ? P1 : '#E5E7EB',
                    transition: 'background .07s',
                  }} />
                ))}
              </div>
            </div>
          </div>

          {/* Cần đàn rút gọn */}
          <FretboardMini
            activeStringIdx={activeStrIdx}
            activeFinger={activeFinger}
          />
        </div>

        {/* Card: thứ tự ngón hiện tại */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '12px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Thứ tự bấm — Mẫu {PATTERN_NAMES[patternIdx]}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {PATTERNS[patternIdx].map((f, i) => {
              const isActive = playing && fingerDotIdx === i
              return (
                <div key={i} style={{
                  flex: 1, height: 36, borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 800,
                  background: isActive ? P1 : '#F3F4F6',
                  color: isActive ? '#fff' : '#9CA3AF',
                  border: `2px solid ${isActive ? P1 : 'transparent'}`,
                  boxShadow: isActive ? `0 2px 10px ${P1}44` : 'none',
                  transition: 'all .07s',
                }}>
                  {f}
                </div>
              )
            })}
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
        <button onClick={togglePlay} style={{
          width: '100%', border: 'none', borderRadius: 16, padding: '16px',
          fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
          background: playing
            ? 'linear-gradient(135deg,#EF4444,#DC2626)'
            : `linear-gradient(135deg,${P1},#6366F1)`,
          color: '#fff',
          boxShadow: playing ? '0 4px 16px rgba(239,68,68,.35)' : `0 4px 16px ${P1}44`,
        }}>
          {playing ? '⏸ Tạm dừng' : '▶ Bắt đầu'}
        </button>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setPatternIdx(i => (i + 1) % PATTERNS.length)}
            style={{ flex: 1, background: '#EEF2FF', color: P1, border: 'none', borderRadius: 12, padding: '13px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Bài kế →
          </button>
          <button
            disabled={!canGoDown}
            onClick={() => canGoDown && setLevelDelta(d => d - 1)}
            style={{
              flex: 1, border: 'none', borderRadius: 12, padding: '13px',
              fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              cursor: canGoDown ? 'pointer' : 'default',
              background: canGoDown ? A1 + '1A' : '#F3F4F6',
              color: canGoDown ? A1 : '#D1D5DB',
              opacity: canGoDown ? 1 : 0.5,
            }}>
            Lùi 1 bậc
          </button>
        </div>
      </div>
    </div>
  )
}
