// Rhythm Scroll cho một phiên bản Hợp âm chuẩn hóa: lời + hợp âm cuộn theo nhịp, ball nảy mỗi ô.
// MỘT đồng hồ duy nhất: giây → phách → locateBeat → { vị trí ô (ball + cuộn lời), hợp âm đang vang }.
// Timeline hợp âm dựng từ chính dữ liệu đã lưu (lời + vạch nhịp + số chỉ nhịp) — không có nguồn thứ hai.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import AnchoredChordViewer from '../rhythm-scroll-viewer/AnchoredChordViewer.tsx'
import { usePrefersReducedMotion } from '../rhythm-scroll-viewer/RhythmChordViewer.tsx'
import type { RhythmScrollAnchoredData } from '../rhythm-scroll-viewer/anchored.ts'
import { createProofClock, secondsAfterTempoChange } from '../rhythm-scroll-viewer/clock.ts'
import type { ChordLibrary, ChordSheetDetail } from './chordLibrary.ts'
import { beatsAtSeconds, buildChordTimeline, locateBeat } from './chordTimeline.ts'
import type { TimelineMeter } from './chordTimeline.ts'
import { buildPerformanceScript } from './performanceScript.ts'

const BPM_MIN = 30
const BPM_MAX = 200
const DEFAULT_BPM = 70
const clampBpm = (value: number) => Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(value)))
const METERS: TimelineMeter[] = [{ beats: 2, beatType: 4 }, { beats: 3, beatType: 4 }, { beats: 4, beatType: 4 }, { beats: 6, beatType: 8 }]
const meterKey = (meter: TimelineMeter | null) => (meter ? `${meter.beats}/${meter.beatType}` : '')
const parseMeterKey = (key: string): TimelineMeter | null => {
  const found = METERS.find(meter => meterKey(meter) === key)
  return found ?? null
}

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; detail: ChordSheetDetail }

export default function RhythmScrollPage({ library, versionId, onBack }: { library: ChordLibrary; versionId: string; onBack: () => void }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  useEffect(() => {
    let active = true
    setLoad({ state: 'loading' })
    library.getChordSheet(versionId)
      .then(detail => { if (active) setLoad({ state: 'ready', detail }) })
      .catch(error => { if (active) setLoad({ state: 'error', message: error instanceof Error ? error.message : 'Không mở được bài.' }) })
    return () => { active = false }
  }, [library, versionId])

  if (load.state === 'loading') return <Shell onBack={onBack} title="Rhythm Scroll"><p style={S.note}>Đang tải bài…</p></Shell>
  if (load.state === 'error') return <Shell onBack={onBack} title="Rhythm Scroll"><p role="alert" style={S.bad}>{load.message}</p></Shell>
  return <Player detail={load.detail} onBack={onBack} />
}

function Shell({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return <div style={S.page} data-testid="rhythm-scroll-page">
    <div style={S.header}>
      <button type="button" onClick={onBack} style={S.button}>← Quay lại</button>
      <div style={S.title}>{title}</div>
    </div>
    {children}
  </div>
}

function Player({ detail, onBack }: { detail: ChordSheetDetail; onBack: () => void }) {
  const [meterChoice, setMeterChoice] = useState<string>(meterKey(detail.meter))
  const meter = detail.meter && meterKey(detail.meter) === meterChoice ? detail.meter : parseMeterKey(meterChoice)
  const anchors = detail.anchors
  const timeline = useMemo(() => (anchors ? buildChordTimeline(detail.text, anchors, meter) : null), [detail.text, anchors, meter])
  const script = useMemo(() => (anchors ? buildPerformanceScript(detail.text, anchors) : null), [detail.text, anchors])

  const data = useMemo<RhythmScrollAnchoredData | null>(() => (script && meter ? {
    version: 2, prototype: true, songId: detail.sheetId, lyricsHash: detail.versionId, meter,
    ...(script.anchors.pickup ? { pickup: script.anchors.pickup } : {}), measures: script.anchors.measures,
    provenance: { sourceType: 'manual', sourceHash: detail.versionId, generator: 'chord-library-version', generatedAt: detail.updatedAt },
  } : null), [script, meter, detail.sheetId, detail.versionId, detail.updatedAt])

  const startBpm = clampBpm(detail.suggestedBpm ?? DEFAULT_BPM)
  const clockRef = useRef(createProofClock())
  const bpmRef = useRef(startBpm)
  const [bpm, setBpm] = useState(startBpm)
  const [playing, setPlaying] = useState(false)
  const [beat, setBeat] = useState(0)
  const reducedMotion = usePrefersReducedMotion()
  const total = timeline?.totalBeats ?? 0

  const readBeat = () => beatsAtSeconds(clockRef.current.elapsedSeconds(), bpmRef.current)
  useEffect(() => {
    if (!playing || !total) return
    let frame = 0
    let timer = 0
    const tick = () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
      const now = readBeat()
      setBeat(now)
      if (now >= total) { clockRef.current.pause(); setPlaying(false); return }
      frame = requestAnimationFrame(tick)
      timer = window.setTimeout(tick, 250)
    }
    tick()
    return () => { cancelAnimationFrame(frame); clearTimeout(timer) }
  }, [playing, total])

  if (!anchors || !timeline || !script) {
    return <Shell onBack={onBack} title={detail.title}><p role="alert" style={S.bad}>Phiên bản này chưa có vạch nhịp nên chưa chạy được Rhythm Scroll. Hãy đặt vạch nhịp trong trình sửa rồi mở lại.</p></Shell>
  }
  if (!meter || !data || !timeline.totalBeats) {
    return <Shell onBack={onBack} title={detail.title}>
      <p role="alert" style={S.bad}>Bài chưa có số chỉ nhịp nên chưa tính được phách. Chọn nhịp để xem thử (không lưu):</p>
      <div style={S.controls}>
        <select aria-label="Số chỉ nhịp" value={meterChoice} onChange={event => setMeterChoice(event.target.value)} style={S.select}>
          <option value="">— chọn —</option>
          {METERS.map(m => <option key={meterKey(m)} value={meterKey(m)}>{meterKey(m)}</option>)}
        </select>
      </div>
    </Shell>
  }

  const position = locateBeat(timeline, beat)
  const event = position.chordIndex >= 0 ? timeline.events[position.chordIndex] : null
  const next = position.chordIndex + 1 < timeline.events.length ? timeline.events[position.chordIndex + 1] : null
  const activeChord = event ? { line: script.virtualLine(event.measure, event.line), token: event.token } : null
  const unverified = timeline.unverifiedMeasures.length
  const pickupGuess = timeline.warnings.some(w => w.code === 'pickup_inferred')

  const play = () => {
    if (readBeat() >= total) clockRef.current.restart()
    clockRef.current.play()
    setPlaying(true)
  }
  const pause = () => { clockRef.current.pause(); setPlaying(false); setBeat(readBeat()) }
  const restart = () => { clockRef.current.restart(); setBeat(0) }
  const seek = (toBeat: number) => {
    clockRef.current.seek((toBeat * 60) / bpmRef.current)
    setBeat(toBeat)
  }
  const changeBpm = (value: number) => {
    if (!Number.isFinite(value)) return
    const nextBpm = clampBpm(value)
    clockRef.current.seek(secondsAfterTempoChange(clockRef.current.elapsedSeconds(), bpmRef.current, nextBpm))
    bpmRef.current = nextBpm
    setBpm(nextBpm)
  }

  const measureNumber = position.state === 'before' ? 0 : position.measureIndex + 1 - (timeline.pickupBeats ? 1 : 0)
  const beatInMeasure = position.state === 'active' ? Math.floor(position.measureProgress * timeline.measures[position.measureIndex].beats) + 1 : 0
  return <Shell onBack={onBack} title={detail.title}>
    <div style={S.status} data-testid="rhythm-status">
      <span>Nhịp {meterKey(timeline.meter)}</span>
      <span>{timeline.pickupBeats ? `lấy đà ${timeline.pickupBeats} phách + ` : ''}{timeline.measures.length - (timeline.pickupBeats ? 1 : 0)} ô</span>
      <span>{timeline.totalBeats} phách</span>
      {script.passes > 1 && <span>{script.passes} lượt hát</span>}
      {unverified > 0 && <span style={S.warn} data-testid="rhythm-unverified">{unverified} ô hợp âm chia phách theo suy luận — chưa xác minh</span>}
      {pickupGuess && <span style={S.warn}>nhịp lấy đà là suy luận</span>}
    </div>
    <div style={S.chordStrip} data-testid="rhythm-chords" aria-live="off">
      <span style={S.chordNow} data-testid="rs-chord-now">{event?.chord ?? '—'}</span>
      <span style={S.chordNext}>{next ? `→ ${next.chord} sau ${Math.max(0, Math.ceil(next.startBeat - beat))} phách` : ''}</span>
      <span style={S.beatCount} data-testid="rs-beat">{position.state === 'before' ? 'sẵn sàng' : `ô ${Math.max(measureNumber, 0) || 'lấy đà'} · phách ${beatInMeasure}`}</span>
    </div>
    <AnchoredChordViewer text={detail.text} lines={script.lines} data={data} labels={script.labels} measurePosition={position.measurePosition}
      reducedMotion={reducedMotion} activeChord={activeChord} />
    <div style={S.controls}>
      {playing ? <button type="button" onClick={pause} style={S.primary}>❚❚ Pause</button> : <button type="button" onClick={play} style={S.primary}>▶ Play</button>}
      <button type="button" onClick={restart} style={S.button}>↺ Restart</button>
      <input type="range" min={0} max={total} step={0.25} value={Math.min(beat, total)} aria-label="Vị trí (phách)" onChange={event => seek(Number(event.target.value))} style={S.scrub} />
      <label style={S.bpm}>
        <span style={S.bpmLabel}>BPM</span>
        <input type="range" min={BPM_MIN} max={BPM_MAX} value={bpm} aria-label="BPM" onChange={event => changeBpm(Number(event.target.value))} style={S.slider} />
        <input type="number" min={BPM_MIN} max={BPM_MAX} value={bpm} aria-label="BPM (số)" onChange={event => changeBpm(Number(event.target.value))} style={S.number} />
      </label>
      <select aria-label="Số chỉ nhịp" value={meterChoice} onChange={event => { setMeterChoice(event.target.value); restart() }} style={S.select}>
        {!METERS.some(m => meterKey(m) === meterChoice) && <option value={meterChoice}>{meterChoice}</option>}
        {METERS.map(m => <option key={meterKey(m)} value={meterKey(m)}>{meterKey(m)}</option>)}
      </select>
    </div>
  </Shell>
}

const BG = '#0F1117'
const S: Record<string, CSSProperties> = {
  page: { position: 'fixed', inset: 0, height: '100dvh', display: 'flex', flexDirection: 'column', background: BG, color: '#F1F5F9', zIndex: 50 },
  header: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid #1F2937' },
  title: { fontWeight: 700, fontSize: 16, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  status: { display: 'flex', flexWrap: 'wrap', gap: '4px 14px', padding: '6px 16px', fontSize: 12, color: '#94A3B8' },
  warn: { color: '#FBBF24' },
  note: { padding: 16, color: '#94A3B8' },
  bad: { margin: 16, padding: '10px 12px', borderRadius: 8, background: '#7F1D1D', color: '#FECACA', fontSize: 14 },
  chordStrip: { display: 'flex', alignItems: 'baseline', gap: 14, padding: '4px 16px 8px' },
  chordNow: { fontSize: 28, fontWeight: 800, color: '#FBBF24', minWidth: 64 },
  chordNext: { fontSize: 13, color: '#94A3B8', flex: 1 },
  beatCount: { fontSize: 13, color: '#CBD5E1', fontVariantNumeric: 'tabular-nums' },
  controls: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '10px 16px calc(10px + env(safe-area-inset-bottom))', borderTop: '1px solid #1F2937' },
  button: { minHeight: 40, padding: '0 14px', borderRadius: 8, border: '1px solid #374151', background: '#1F2937', color: '#F1F5F9', fontSize: 14, cursor: 'pointer' },
  primary: { minHeight: 40, padding: '0 18px', borderRadius: 8, border: 'none', background: '#EA580C', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  scrub: { flex: '1 1 160px', minWidth: 120 },
  bpm: { display: 'flex', alignItems: 'center', gap: 6 },
  bpmLabel: { fontSize: 12, color: '#94A3B8' },
  slider: { width: 100 },
  number: { width: 56, minHeight: 32, borderRadius: 6, border: '1px solid #374151', background: '#111827', color: '#F1F5F9', padding: '0 6px' },
  select: { minHeight: 36, borderRadius: 6, border: '1px solid #374151', background: '#111827', color: '#F1F5F9', padding: '0 8px' },
}
