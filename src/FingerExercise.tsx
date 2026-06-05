import { useState, useEffect, useRef, useMemo } from 'react'
import { playGuitarNote } from './audioEngine'

// ── Tần số dây mở (index 0 = low E, 5 = high e) ──────────────────────────────
const OPEN_FREQ = [82.41, 110, 146.83, 196, 246.94, 329.63]

// Tên dây hiển thị từ trên xuống (visual row 0 = high e = OPEN[5])
const STRING_NAMES_VISUAL = ['e', 'B', 'G', 'D', 'A', 'E']

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
  for (const lv of BASE_LEVELS) {
    if (totalMin >= lv.unlockMin) best = lv
  }
  if (totalMin >= 750) {
    const extra = Math.floor((totalMin - 750) / 120)
    if (extra >= 1) best = { n: 10 + extra, sub: 'kep', bpm: 80 + extra * 10, unlockMin: 750 + extra * 120 }
  }
  return best
}

function nextLevelOf(lv: Level): Level {
  if (lv.n < 10) return BASE_LEVELS[lv.n] // BASE_LEVELS[n] = level n+1
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
  const push = (s: number) => p.forEach((f, j) => out.push({ stringIdx: s, finger: f, fret: START_FRET + f - 1, patternPos: j }))
  for (let s = 0; s < 6; s++) push(s)       // forward: low E → high e
  for (let s = 5; s >= 0; s--) push(s)      // backward: high e → low E
  return out
}

// ── Metronome click (minimal oscillator burst) ─────────────────────────────────
let clickCtx: AudioContext | null = null
function playClick(accent: boolean) {
  try {
    if (!clickCtx) clickCtx = new AudioContext()
    if (clickCtx.state === 'suspended') clickCtx.resume()
    const osc = clickCtx.createOscillator()
    const g   = clickCtx.createGain()
    osc.connect(g); g.connect(clickCtx.destination)
    osc.frequency.value = accent ? 1200 : 900
    const now = clickCtx.currentTime
    g.gain.setValueAtTime(accent ? 0.28 : 0.12, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
    osc.start(now); osc.stop(now + 0.05)
  } catch { /* ignore */ }
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  totalMinutes: number   // tổng phút đã luyện 'finger' từ DB
  onClose: () => void
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function FingerExercise({ totalMinutes, onClose }: Props) {
  const [patternIdx,   setPatternIdx]   = useState(0)
  const [playing,      setPlaying]      = useState(false)
  const [levelDelta,   setLevelDelta]   = useState(0)   // 0 = tự động, -N = lùi N bậc
  const [activeCell,   setActiveCell]   = useState<{ row: number; col: number } | null>(null)
  const [beatDotIdx,   setBeatDotIdx]   = useState(0)
  const [fingerDotIdx, setFingerDotIdx] = useState(0)

  const autoLevel   = useMemo(() => calcLevel(totalMinutes), [totalMinutes])
  const curLevel    = useMemo(() => shiftLevel(autoLevel, levelDelta), [autoLevel, levelDelta])
  const nextLv      = useMemo(() => nextLevelOf(autoLevel), [autoLevel])
  const minsToNext  = nextLv.unlockMin - totalMinutes
  const progressPct = Math.min(100, Math.max(0,
    (totalMinutes - autoLevel.unlockMin) / Math.max(1, nextLv.unlockMin - autoLevel.unlockMin) * 100
  ))

  const steps = useMemo(() => buildSteps(patternIdx), [patternIdx])

  // ── Refs cho scheduler (tránh stale closure) ──────────────────────────────
  const playingRef    = useRef(false)
  const stepIdxRef    = useRef(0)
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const stepsRef      = useRef(steps)
  const bpmRef        = useRef(curLevel.bpm)
  const npbRef        = useRef(NOTES_PER_BEAT[curLevel.sub])

  // Sync refs mỗi render
  stepsRef.current = steps
  bpmRef.current   = curLevel.bpm
  npbRef.current   = NOTES_PER_BEAT[curLevel.sub]

  // ── Play một nốt ─────────────────────────────────────────────────────────
  const playStep = () => {
    const si   = stepIdxRef.current % stepsRef.current.length
    const step = stepsRef.current[si]
    const freq = OPEN_FREQ[step.stringIdx] * Math.pow(2, step.fret / 12)
    try { playGuitarNote(freq, step.stringIdx) } catch { /* ignore */ }

    // Metronome: mỗi phách + accent phách 1
    const npb = npbRef.current
    if (stepIdxRef.current % npb === 0) {
      playClick(Math.floor(stepIdxRef.current / npb) % 4 === 0)
    }

    // Cập nhật visual
    setActiveCell({ row: 5 - step.stringIdx, col: step.patternPos })
    setBeatDotIdx(Math.floor(stepIdxRef.current / npb) % 4)
    setFingerDotIdx(stepIdxRef.current % 4)

    stepIdxRef.current++
  }

  // ── Khởi/dừng scheduler ──────────────────────────────────────────────────
  const startScheduler = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    stepIdxRef.current = 0
    const ms = Math.round(60000 / (bpmRef.current * npbRef.current))
    playStep() // nốt đầu tiên ngay lập tức
    intervalRef.current = setInterval(playStep, ms)
  }

  const stopScheduler = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    setActiveCell(null); setBeatDotIdx(0); setFingerDotIdx(0)
  }

  const togglePlay = () => {
    if (playing) {
      playingRef.current = false
      stopScheduler()
      setPlaying(false)
    } else {
      playingRef.current = true
      startScheduler()
      setPlaying(true)
    }
  }

  // Khi pattern hoặc level thay đổi lúc đang chạy → restart
  useEffect(() => {
    if (playingRef.current) {
      stopScheduler()
      startScheduler()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patternIdx, curLevel.n])

  // Cleanup khi unmount
  useEffect(() => {
    return () => {
      playingRef.current = false
      stopScheduler()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────
  const P1 = '#4338CA', A1 = '#EA580C', BG = '#F0F2F5'
  const pattern = PATTERNS[patternIdx]
  const canGoDown = autoLevel.n + levelDelta > 1

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: BG, display: 'flex', flexDirection: 'column',
      fontFamily: '"SF Pro Display","DM Sans",system-ui,sans-serif',
      overflow: 'hidden',
    }}>

      {/* ── Header ── */}
      <div style={{ background: P1, padding: 'env(safe-area-inset-top,44px) 16px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <button onClick={() => { playingRef.current = false; stopScheduler(); onClose() }}
            style={{ background: 'rgba(255,255,255,.18)', border: 'none', borderRadius: 10, padding: '8px 14px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            ← Đóng
          </button>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>🖐 Luyện ngón</span>
          <div style={{ width: 64 }} />
        </div>

        {/* Level badge */}
        <div style={{ background: 'rgba(255,255,255,.14)', borderRadius: 12, padding: '10px 14px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
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

      {/* ── Body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Pattern card */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Mẫu ngón</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: P1 }}>{PATTERN_NAMES[patternIdx]}</div>
            </div>

            {/* Dots */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              {/* Beat dots (4 — phách đen) */}
              <div style={{ display: 'flex', gap: 5 }}>
                {[0,1,2,3].map(i => (
                  <div key={i} style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: playing && beatDotIdx === i ? A1 : '#E5E7EB',
                    transition: 'background .08s',
                  }} />
                ))}
              </div>
              {/* Finger dots (4 — vị trí ngón) */}
              <div style={{ display: 'flex', gap: 4 }}>
                {[0,1,2,3].map(i => (
                  <div key={i} style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: playing && fingerDotIdx === i ? P1 : '#E5E7EB',
                    transition: 'background .08s',
                  }} />
                ))}
              </div>
            </div>
          </div>

          {/* ── Fretboard grid ── */}
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '24px repeat(4, 1fr)', gap: 4, marginBottom: 6 }}>
            <div />
            {pattern.map((finger, col) => (
              <div key={col} style={{ textAlign: 'center', lineHeight: 1.3 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: P1 }}>Ngón {finger}</div>
                <div style={{ fontSize: 9, color: '#9CA3AF' }}>Phím {START_FRET + finger - 1}</div>
              </div>
            ))}
          </div>

          {/* String rows */}
          {STRING_NAMES_VISUAL.map((name, row) => (
            <div key={row} style={{ display: 'grid', gridTemplateColumns: '24px repeat(4, 1fr)', gap: 4, marginBottom: 4 }}>
              {/* String name */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#6B7280' }}>
                {name}
              </div>
              {/* Cells */}
              {pattern.map((finger, col) => {
                const isActive = !!(activeCell && activeCell.row === row && activeCell.col === col)
                return (
                  <div key={col} style={{
                    aspectRatio: '1',
                    borderRadius: 9,
                    background: isActive ? P1 : '#F3F4F6',
                    border: `2px solid ${isActive ? P1 : '#E5E7EB'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 900,
                    color: isActive ? '#fff' : '#D1D5DB',
                    transition: 'background .06s, color .06s',
                    boxShadow: isActive ? `0 2px 10px ${P1}55` : 'none',
                  }}>
                    {finger}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Thông tin vị trí */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '12px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6, fontWeight: 600 }}>Vị trí bàn tay</div>
          <div style={{ display: 'flex', gap: 16 }}>
            {[1,2,3,4].map(f => (
              <div key={f} style={{ textAlign: 'center' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: P1 + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: P1, marginBottom: 3 }}>
                  {f}
                </div>
                <div style={{ fontSize: 10, color: '#9CA3AF' }}>Phím {START_FRET + f - 1}</div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── Controls (bottom) ── */}
      <div style={{
        background: '#fff', borderTop: '1px solid #E8EAF0',
        padding: `12px 16px ${`env(safe-area-inset-bottom, 20px)`}`,
        display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0,
      }}>
        {/* Nút chính */}
        <button onClick={togglePlay}
          style={{
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

        {/* Nút phụ */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setPatternIdx(i => (i + 1) % PATTERNS.length)}
            style={{ flex: 1, background: '#EEF2FF', color: P1, border: 'none', borderRadius: 12, padding: '13px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Bài kế →
          </button>
          <button onClick={() => canGoDown && setLevelDelta(d => d - 1)}
            disabled={!canGoDown}
            style={{
              flex: 1, border: 'none', borderRadius: 12, padding: '13px',
              fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: canGoDown ? 'pointer' : 'default',
              background: canGoDown ? A1 + '18' : '#F3F4F6',
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
