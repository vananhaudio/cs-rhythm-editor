import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { measuresAtSeconds } from '../../rhythm-scroll/index.ts'
import AnchoredChordViewer from '../AnchoredChordViewer.tsx'
import { usePrefersReducedMotion } from '../RhythmChordViewer.tsx'
import { createAnchoredScroll } from '../anchored.ts'
import type { MeasureAnchor } from '../anchored.ts'
import { createProofClock, secondsAfterTempoChange } from '../clock.ts'
import { REAL_DATA, REAL_DEFAULT_BPM, REAL_LABELS, REAL_TEXT, REAL_TITLE } from './realAnchors.ts'

const BPM_MIN = 40
const BPM_MAX = 200
const clampBpm = (value: number) => Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(value)))
const secondsPerMeasure = (bpm: number) => (60 * REAL_DATA.meter.beats) / bpm
const describe = (anchor: MeasureAnchor) => (anchor.line === null ? 'không lời' : `dòng ${anchor.line} · chữ ${anchor.token}`)

/** `?at=14.5` — mở trang đứng sẵn ở ô nhịp đó (đang dừng). `?debug=1` — bật sẵn chế độ soi. */
function query(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name)
}

/**
 * TRANG THỬ (chỉ DEV): ball chạy theo VẠCH NHỊP THẬT của "Chuyến Tàu Hoàng Hôn".
 * Một nguồn thời gian: đồng hồ → giây → measuresAtSeconds → measurePosition → viewer.
 */
export default function AnchoredProofPage() {
  const scroll = useMemo(() => createAnchoredScroll(REAL_DATA), [])
  const clockRef = useRef(createProofClock())
  const bpmRef = useRef(REAL_DEFAULT_BPM)
  const [bpm, setBpm] = useState(REAL_DEFAULT_BPM)
  const [playing, setPlaying] = useState(false)
  const [debug, setDebug] = useState(() => query('debug') === '1')
  const [measurePosition, setMeasurePosition] = useState(() => {
    const at = Number(query('at'))
    const start = Number.isFinite(at) && at > 0 ? at : 0
    clockRef.current.seek(start * secondsPerMeasure(REAL_DEFAULT_BPM))
    return start
  })
  const reducedMotion = usePrefersReducedMotion()

  const readPosition = () => measuresAtSeconds(clockRef.current.elapsedSeconds(), bpmRef.current, REAL_DATA.meter)

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
      if (position >= scroll.totalMeasures) {
        clockRef.current.pause()
        setPlaying(false)
        return
      }
      frame = requestAnimationFrame(tick)
      timer = window.setTimeout(tick, 250)
    }
    tick()
    return () => { cancelAnimationFrame(frame); clearTimeout(timer) }
  }, [playing, scroll])

  const play = () => {
    if (readPosition() >= scroll.totalMeasures) clockRef.current.restart()
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

  const position = scroll.locate(measurePosition)
  return (
    <div style={P.page}>
      <div style={P.header}>
        <div style={P.title}>{REAL_TITLE}</div>
        <div style={P.note}>REAL SHEET ANCHORS · vạch nhịp thật từ sheet · chưa qua Vision production</div>
        <button type="button" onClick={() => setDebug(value => !value)} aria-pressed={debug} style={P.debugToggle}>
          {debug ? 'Tắt soi' : 'Soi'}
        </button>
      </div>
      {debug && (
        <div style={P.debug} data-testid="proof-debug">
          <span>ô {position.measureIndex + 1}/{scroll.totalMeasures}{position.isPickup ? ' (lấy đà)' : ''}</span>
          <span>neo: {describe(position.current)}</span>
          <span>kế: {describe(position.next)}</span>
          <span>tiến trình: {position.measureProgress.toFixed(2)}</span>
        </div>
      )}
      <AnchoredChordViewer text={REAL_TEXT} data={REAL_DATA} labels={REAL_LABELS} measurePosition={measurePosition}
        reducedMotion={reducedMotion} showAnchors={debug} />
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
  header: { position: 'relative', padding: '10px 76px 8px 16px', flexShrink: 0 },
  title: { color: '#F1F5F9', fontSize: 17, fontWeight: 700 },
  note: { color: '#38BDF8', fontSize: 11, fontWeight: 600, letterSpacing: 0.3, marginTop: 2 },
  debugToggle: { position: 'absolute', right: 12, top: 10, height: 30, padding: '0 10px', borderRadius: 8, border: '1px solid #2D3447', background: '#1E2330', color: '#94A3B8', fontSize: 12, cursor: 'pointer' },
  debug: { display: 'flex', flexWrap: 'wrap', gap: '2px 14px', padding: '4px 16px 6px', color: '#94A3B8', fontSize: 11, fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #1E2330', flexShrink: 0 },
  controls: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '10px 12px calc(10px + env(safe-area-inset-bottom))', background: '#1A1E2A', borderTop: '1px solid #2D3447', flexShrink: 0 },
  primary: { minWidth: 96, height: 44, borderRadius: 10, border: 'none', background: '#EA580C', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  button: { height: 44, padding: '0 12px', borderRadius: 10, border: '1px solid #2D3447', background: '#1E2330', color: '#F1F5F9', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  bpm: { display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 180px', minWidth: 0 },
  bpmLabel: { color: '#94A3B8', fontSize: 12, fontWeight: 700 },
  slider: { flex: 1, minWidth: 60 },
  number: { width: 60, height: 36, borderRadius: 8, border: '1px solid #2D3447', background: '#0F1117', color: '#FBBF24', fontSize: 15, fontWeight: 700, textAlign: 'center' },
}
