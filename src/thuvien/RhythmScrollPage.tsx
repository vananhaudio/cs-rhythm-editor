// Rhythm Scroll cho một phiên bản Hợp âm chuẩn hóa: lời + hợp âm cuộn theo nhịp, ball nảy mỗi ô.
// MỘT đồng hồ duy nhất: giây → phách → locateBeat → { vị trí ô (ball + cuộn lời), hợp âm đang vang }.
// Timeline hợp âm dựng từ chính dữ liệu đã lưu (lời + vạch nhịp + số chỉ nhịp) — không có nguồn thứ hai.
import { useEffect, useMemo, useRef, useState } from 'react'
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

/** Gắn `key={versionId}` ở nơi dùng: đổi phiên bản = dựng lại, nên chỉ cần nạp một lần. */
export default function RhythmScrollPage({ library, versionId, onBack }: { library: ChordLibrary; versionId: string; onBack: () => void }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  useEffect(() => {
    let active = true
    library.getChordSheet(versionId)
      .then(detail => { if (active) setLoad({ state: 'ready', detail }) })
      .catch(error => { if (active) setLoad({ state: 'error', message: error instanceof Error ? error.message : 'Không mở được bài.' }) })
    return () => { active = false }
  }, [library, versionId])

  if (load.state === 'loading') return <Shell onBack={onBack} title="Rhythm Scroll"><p className="rs-note">Đang tải bài…</p></Shell>
  if (load.state === 'error') return <Shell onBack={onBack} title="Rhythm Scroll"><p role="alert" className="rs-bad">{load.message}</p></Shell>
  return <Player detail={load.detail} onBack={onBack} />
}

function Shell({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return <div className="rs-page" data-testid="rhythm-scroll-page">
    <header className="rs-nav">
      <button type="button" className="rs-back" onClick={onBack}><span aria-hidden="true">‹</span> Quay lại</button>
      <div className="rs-title">{title}</div>
      <span aria-hidden="true" />
    </header>
    <div className="rs-body">{children}</div>
  </div>
}

const Icon = ({ name }: { name: 'play' | 'pause' | 'restart' | 'gear' }) => <svg viewBox="0 0 24 24" aria-hidden="true">{{
  play: <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />,
  pause: <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />,
  restart: <path d="M12 5V2L7 6.5 12 11V8a5 5 0 1 1-5 5H5a7 7 0 1 0 7-8z" />,
  gear: <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm8.2 5.5-.1-.9 1.9-1.5-2-3.4-2.3.9a7 7 0 0 0-1.5-.9L15.8 5h-4l-.4 2.4c-.5.2-1 .5-1.5.9l-2.3-.9-2 3.4 1.9 1.5a7 7 0 0 0 0 1.8L5.6 15.6l2 3.4 2.3-.9c.5.4 1 .7 1.5.9l.4 2.4h4l.4-2.4c.5-.2 1-.5 1.5-.9l2.3.9 2-3.4-1.9-1.5z" />,
}[name]}</svg>

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
    return <Shell onBack={onBack} title={detail.title}><p role="alert" className="rs-bad">Phiên bản này chưa có vạch nhịp nên chưa chạy được Rhythm Scroll. Hãy đặt vạch nhịp trong trình sửa rồi mở lại.</p></Shell>
  }
  if (!meter || !data || !timeline.totalBeats) {
    return <Shell onBack={onBack} title={detail.title}>
      <p role="alert" className="rs-bad">Bài chưa có số chỉ nhịp nên chưa tính được phách. Chọn nhịp để xem thử (không lưu):</p>
      <div style={{ padding: 16 }}>
        <select aria-label="Số chỉ nhịp" className="rs-select" value={meterChoice} onChange={event => setMeterChoice(event.target.value)}>
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
  const [showOptions, setShowOptions] = useState(false)
  const measureCount = timeline.measures.length - (timeline.pickupBeats ? 1 : 0)
  return <Shell onBack={onBack} title={detail.title}>
    <div className="rs-meta" data-testid="rhythm-status">
      <span>Nhịp {meterKey(timeline.meter)}</span>
      <span>{timeline.pickupBeats ? `lấy đà ${timeline.pickupBeats} phách + ` : ''}{measureCount} ô</span>
      <span>{timeline.totalBeats} phách</span>
      {script.passes > 1 && <span>{script.passes} lượt hát</span>}
      {unverified > 0 && <span className="rs-warn" data-testid="rhythm-unverified">{unverified} ô hợp âm chia phách theo suy luận — chưa xác minh</span>}
      {pickupGuess && <span className="rs-warn">nhịp lấy đà là suy luận</span>}
    </div>
    <div className="rs-now" data-testid="rhythm-chords" aria-live="off">
      <span className="rs-now-chord" data-testid="rs-chord-now">{event?.chord ?? '—'}</span>
      <span className="rs-now-next">{next ? `→ ${next.chord} sau ${Math.max(0, Math.ceil(next.startBeat - beat))} phách` : ''}</span>
      <span className="rs-now-pos" data-testid="rs-beat">{position.state === 'before' ? 'sẵn sàng' : `ô ${Math.max(measureNumber, 0) || 'lấy đà'} · phách ${beatInMeasure}`}</span>
    </div>
    <div className="rs-sheet">
      <AnchoredChordViewer theme="light" text={detail.text} lines={script.lines} data={data} labels={script.labels} measurePosition={position.measurePosition}
        reducedMotion={reducedMotion} activeChord={activeChord} />
    </div>
    <div className="rs-dock">
      <div className="rs-bar">
        <input className="rs-range" type="range" min={0} max={total} step={0.25} value={Math.min(beat, total)} aria-label="Vị trí (phách)"
          onChange={event => seek(Number(event.target.value))} />
      </div>
      <div className="rs-row">
        <button type="button" className="rs-btn" onClick={restart} aria-label="Về đầu bài"><Icon name="restart" /></button>
        <button type="button" className="rs-btn rs-play" data-playing={playing} onClick={playing ? pause : play} aria-label={playing ? 'Tạm dừng' : 'Phát'}>
          <Icon name={playing ? 'pause' : 'play'} />
        </button>
        <div className="rs-speed" role="group" aria-label="Tốc độ cuộn">
          <button type="button" className="rs-btn" onClick={() => changeBpm(bpm - 5)} disabled={bpm <= BPM_MIN} aria-label="Chậm hơn">−</button>
          <span className="rs-speed-val">{bpm}<small>BPM</small></span>
          <button type="button" className="rs-btn" onClick={() => changeBpm(bpm + 5)} disabled={bpm >= BPM_MAX} aria-label="Nhanh hơn">+</button>
        </div>
        <button type="button" className="rs-btn" data-on={showOptions} onClick={() => setShowOptions(open => !open)} aria-expanded={showOptions} aria-label="Tuỳ chọn"><Icon name="gear" /></button>
      </div>
      <div className="rs-opts" data-open={showOptions}>
        <span className="rs-state" data-playing={playing}><i />{playing ? 'Đang cuộn' : 'Tạm dừng'}</span>
        <label>BPM
          <input type="range" className="rs-range" min={BPM_MIN} max={BPM_MAX} value={bpm} aria-label="BPM" onChange={event => changeBpm(Number(event.target.value))} style={{ width: 120, flex: 'none' }} />
          <input type="number" min={BPM_MIN} max={BPM_MAX} value={bpm} aria-label="BPM (số)" onChange={event => changeBpm(Number(event.target.value))} />
        </label>
        <label>Nhịp
          <select aria-label="Số chỉ nhịp" value={meterChoice} onChange={event => { setMeterChoice(event.target.value); restart() }}>
            {!METERS.some(m => meterKey(m) === meterChoice) && <option value={meterChoice}>{meterChoice}</option>}
            {METERS.map(m => <option key={meterKey(m)} value={meterKey(m)}>{meterKey(m)}</option>)}
          </select>
        </label>
      </div>
    </div>
  </Shell>
}
