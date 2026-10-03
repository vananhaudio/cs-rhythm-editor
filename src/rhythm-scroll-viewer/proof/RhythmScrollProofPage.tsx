import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { measuresAtSeconds } from '../../rhythm-scroll/index.ts'
import RhythmChordViewer, { usePrefersReducedMotion } from '../RhythmChordViewer.tsx'
import { createProofClock, secondsAfterTempoChange } from '../clock.ts'
import { DEMO_DATA, DEMO_DEFAULT_BPM, DEMO_TEXT, DEMO_TITLE } from './demoSong.ts'

const BPM_MIN = 40
const BPM_MAX = 200
const clampBpm = (value: number) => Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(value)))
const secondsPerMeasure = (bpm: number) => (60 * DEMO_DATA.meter.beats) / bpm

/** `?at=14.5` — mở trang đứng sẵn ở ô nhịp đó (đang dừng), để soi một vị trí cụ thể. */
function startMeasure(): number {
  const at = Number(new URLSearchParams(window.location.search).get('at'))
  return Number.isFinite(at) && at > 0 ? at : 0
}

/**
 * TRANG THỬ (chỉ DEV): kiểm chứng cảm giác đệm hát với RhythmChordViewer.
 * Một nguồn thời gian: đồng hồ → giây → measuresAtSeconds → measurePosition → viewer.
 */
export default function RhythmScrollProofPage() {
  const clockRef = useRef(createProofClock())
  const bpmRef = useRef(DEMO_DEFAULT_BPM)
  const [bpm, setBpm] = useState(DEMO_DEFAULT_BPM)
  const [playing, setPlaying] = useState(false)
  const [measurePosition, setMeasurePosition] = useState(() => {
    const at = startMeasure()
    clockRef.current.seek(at * secondsPerMeasure(DEMO_DEFAULT_BPM))
    return at
  })
  const reducedMotion = usePrefersReducedMotion()

  const readPosition = () => measuresAtSeconds(clockRef.current.elapsedSeconds(), bpmRef.current, DEMO_DATA.meter)

  // Hẹn KÉP rAF + setTimeout: rAF cho mượt khi đang nhìn, setTimeout giữ bài vẫn tiến khi tab chạy nền.
  useEffect(() => {
    if (!playing) return
    let frame = 0
    let timer = 0
    const tick = () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
      const position = readPosition()
      setMeasurePosition(position)
      if (position >= DEMO_DATA.totalMeasures) {
        clockRef.current.pause()
        setPlaying(false)
        return
      }
      frame = requestAnimationFrame(tick)
      timer = window.setTimeout(tick, 250)
    }
    tick()
    return () => { cancelAnimationFrame(frame); clearTimeout(timer) }
  }, [playing])

  const play = () => {
    if (readPosition() >= DEMO_DATA.totalMeasures) clockRef.current.restart()
    clockRef.current.play()
    setPlaying(true)
  }
  const pause = () => {
    clockRef.current.pause()
    setPlaying(false)
    setMeasurePosition(readPosition())
  }
  const restart = () => {
    clockRef.current.restart()
    setMeasurePosition(0)
  }
  const changeBpm = (value: number) => {
    if (!Number.isFinite(value)) return
    const next = clampBpm(value)
    // Giữ nguyên vị trí ô nhịp, chỉ đổi tốc độ.
    clockRef.current.seek(secondsAfterTempoChange(clockRef.current.elapsedSeconds(), bpmRef.current, next))
    bpmRef.current = next
    setBpm(next)
  }

  return (
    <div style={P.page}>
      <div style={P.header}>
        <div style={P.title}>{DEMO_TITLE}</div>
        <div style={P.warning}>DEMO TIMING — NOT VISION VERIFIED · số ô nhịp giả định</div>
        {/* Chỉ để soi khi thử — không thuộc trải nghiệm viewer. */}
        <div style={P.debug} data-testid="proof-measure">
          ô {Math.min(Math.floor(Math.max(measurePosition, 0)) + 1, DEMO_DATA.totalMeasures)}/{DEMO_DATA.totalMeasures}
        </div>
      </div>
      <RhythmChordViewer text={DEMO_TEXT} data={DEMO_DATA} measurePosition={measurePosition} reducedMotion={reducedMotion} />
      <div style={P.controls}>
        {playing
          ? <button type="button" onClick={pause} style={P.primary}>❚❚ Pause</button>
          : <button type="button" onClick={play} style={P.primary}>▶ Play</button>}
        <button type="button" onClick={restart} style={P.button}>↺ Restart</button>
        <label style={P.bpm}>
          <span style={P.bpmLabel}>BPM</span>
          <input type="range" min={BPM_MIN} max={BPM_MAX} value={bpm} aria-label="BPM"
            onChange={event => changeBpm(Number(event.target.value))} style={P.slider} />
          <input type="number" min={BPM_MIN} max={BPM_MAX} value={bpm} aria-label="BPM (số)"
            onChange={event => changeBpm(Number(event.target.value))} style={P.number} />
        </label>
      </div>
    </div>
  )
}

const P: Record<string, CSSProperties> = {
  page: { position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#0F1117', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  header: { position: 'relative', padding: '10px 16px 8px', flexShrink: 0 },
  debug: { position: 'absolute', right: 12, top: 12, color: '#475569', fontSize: 10, fontVariantNumeric: 'tabular-nums' },
  title: { color: '#F1F5F9', fontSize: 17, fontWeight: 700 },
  warning: { color: '#FBBF24', fontSize: 11, fontWeight: 600, letterSpacing: 0.3, marginTop: 2 },
  controls: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '10px 12px calc(10px + env(safe-area-inset-bottom))', background: '#1A1E2A', borderTop: '1px solid #2D3447', flexShrink: 0 },
  primary: { minWidth: 96, height: 44, borderRadius: 10, border: 'none', background: '#EA580C', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  button: { height: 44, padding: '0 12px', borderRadius: 10, border: '1px solid #2D3447', background: '#1E2330', color: '#F1F5F9', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  bpm: { display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 180px', minWidth: 0 },
  bpmLabel: { color: '#94A3B8', fontSize: 12, fontWeight: 700 },
  slider: { flex: 1, minWidth: 60 },
  number: { width: 60, height: 36, borderRadius: 8, border: '1px solid #2D3447', background: '#0F1117', color: '#FBBF24', fontSize: 15, fontWeight: 700, textAlign: 'center' },
}
