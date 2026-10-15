// Rhythm Scroll cho một phiên bản Hợp âm chuẩn hóa: lời + hợp âm cuộn theo nhịp, ball nảy mỗi ô.
// MỘT đồng hồ duy nhất: giây → phách → locateBeat → { vị trí ô (ball + cuộn lời), hợp âm đang vang }.
// Timeline hợp âm dựng từ chính dữ liệu đã lưu (lời + vạch nhịp + số chỉ nhịp) — không có nguồn thứ hai.
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import AnchoredChordViewer from '../rhythm-scroll-viewer/AnchoredChordViewer.tsx'
import { usePrefersReducedMotion } from '../rhythm-scroll-viewer/RhythmChordViewer.tsx'
import type { RhythmScrollAnchoredData } from '../rhythm-scroll-viewer/anchored.ts'
import { createProofClock, secondsAfterTempoChange } from '../rhythm-scroll-viewer/clock.ts'
import type { ChordLibrary, ChordSheetDetail } from './chordLibrary.ts'
import { beatsAtSeconds, buildChordTimeline, locateBeat } from './chordTimeline.ts'
import type { TimelineMeter } from './chordTimeline.ts'
import { buildPerformanceScript } from './performanceScript.ts'
import { createBeatClicker } from './beatClick.ts'
import { useAudioContextResume } from '../useAudioContextResume.ts'
import { chordSheetRef } from '../share/shareRef.ts'
import { publishChordSheet } from '../share/chordShareApi.ts'

const ShareSheet = lazy(() => import('../share/ShareSheet.tsx'))
const VideoExportDialog = lazy(() => import('./video/VideoExportDialog.tsx'))

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
export default function RhythmScrollPage({ library, versionId, onBack, embedded = false, initialDetail, autoStart = false, branded = false, videoExport }: {
  library: ChordLibrary; versionId: string; onBack: () => void
  /** Nhúng trong bài đăng (/me): khung có chiều cao riêng, nút "Thu gọn" + "Mở rộng"; không có Chia sẻ. */
  embedded?: boolean
  /** Đã có nội dung (Feed đã tải để xem trước) → không tải lại. */
  initialDetail?: ChordSheetDetail
  /** Chạy ngay khi dựng xong (Feed: người xem đã bấm Play ở bản xem trước). Mặc định KHÔNG tự phát. */
  autoStart?: boolean
  /** Trang học viên độc lập (/hopam): header thương hiệu Văn Anh Guitar + khối tên bài. Chỉ giao diện; mặc định tắt (Thư viện quản trị, bản nhúng giữ nguyên). */
  branded?: boolean
  /** Quyền tạo video do TRANG quyết (hiện: chỉ Admin hệ thống). Không có = không hiện hành động. 'full' = thêm "Toàn bộ bài". */
  videoExport?: 'clip' | 'full'
}) {
  const [load, setLoad] = useState<Load>(initialDetail ? { state: 'ready', detail: initialDetail } : { state: 'loading' })
  useEffect(() => {
    if (initialDetail) return
    let active = true
    library.getChordSheet(versionId)
      .then(detail => { if (active) setLoad({ state: 'ready', detail }) })
      .catch(error => { if (active) setLoad({ state: 'error', message: error instanceof Error ? error.message : 'Không mở được bài.' }) })
    return () => { active = false }
  }, [library, versionId, initialDetail])

  if (load.state === 'loading') return <Shell embedded={embedded} branded={branded} versionId={versionId} onBack={onBack} title="Rhythm Scroll"><p className="rs-note">Đang tải bài…</p></Shell>
  if (load.state === 'error') return <Shell embedded={embedded} branded={branded} versionId={versionId} onBack={onBack} title="Rhythm Scroll"><p role="alert" className="rs-bad">{load.message}</p></Shell>
  return <Player detail={load.detail} onBack={onBack} embedded={embedded} autoStart={autoStart} branded={branded} videoExport={branded && !embedded ? videoExport : undefined} />
}

/** Ghi công (chỉ trang học viên): "Band X · Biên tập: Y". Chỉ phần có dữ liệu từ máy chủ; không có gì → không hiện. */
export function creditLine(detail: { bandName?: string | null; editorName?: string | null }): string | null {
  const band = detail.bandName?.trim()
  const editor = detail.editorName?.trim()
  const parts = [band ? (/^band\b/i.test(band) ? band : `Band ${band}`) : null, editor ? `Biên tập: ${editor}` : null].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

function Shell({ title, onBack, children, right, embedded = false, versionId, branded = false, composer, credit }: { title: string; onBack: () => void; children: React.ReactNode; right?: React.ReactNode; embedded?: boolean; versionId?: string; branded?: boolean; composer?: string | null; credit?: string | null }) {
  if (branded && !embedded) {
    return <div className="rs-page rs-branded" data-testid="rhythm-scroll-page">
      <header className="rs-nav rs-brandbar">
        <img className="rs-logo" src="/logo.png" alt="Thầy Văn Anh Guitar" width="32" height="32" />
        <span className="rs-brand">Play Scroll</span>
        <div className="rs-nav-right">{right}</div>
      </header>
      <div className="rs-body">
        <div className="rs-song" data-testid="rs-song">
          <h1 className="rs-song-title">{title}</h1>
          {composer ? <span className="rs-song-by">{composer}</span> : null}
          {credit ? <p className="rs-credit" data-testid="rs-credit">{credit}</p> : null}
        </div>
        {children}
      </div>
    </div>
  }
  return <div className={embedded ? 'rs-page rs-embedded' : 'rs-page'} data-testid="rhythm-scroll-page">
    <header className="rs-nav">
      <button type="button" className="rs-back" onClick={onBack}><span aria-hidden="true">‹</span> {embedded ? 'Thu gọn' : 'Quay lại'}</button>
      <div className="rs-title">{title}</div>
      <div className="rs-nav-right">{embedded && versionId ? <a className="rs-back rs-share" href={`/hopam/${versionId}`}>Mở rộng</a> : right}</div>
    </header>
    <div className="rs-body">{children}</div>
  </div>
}

const Icon = ({ name }: { name: 'play' | 'pause' | 'restart' | 'gear' | 'share' | 'speaker' | 'mute' }) => <svg viewBox="0 0 24 24" aria-hidden="true">{{
  play: <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />,
  pause: <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />,
  restart: <path d="M12 5V2L7 6.5 12 11V8a5 5 0 1 1-5 5H5a7 7 0 1 0 7-8z" />,
  share: <path d="M12 3 7.5 7.5l1.4 1.4L11 6.8V15h2V6.8l2.1 2.1 1.4-1.4L12 3zM5 11v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9h-2v8H7v-8H5z" />,
  speaker: <path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4H4zm11.2-1.7-1.1 1.1a4.2 4.2 0 0 1 0 6.2l1.1 1.1a5.8 5.8 0 0 0 0-8.4zm2.2-2.2-1.1 1.1a7.4 7.4 0 0 1 0 10.6l1.1 1.1a9 9 0 0 0 0-12.8z" />,
  mute: <path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4H4zm11.3.2 1.4-1.4 2.3 2.3 2.3-2.3 1.4 1.4-2.3 2.3 2.3 2.3-1.4 1.4-2.3-2.3-2.3 2.3-1.4-1.4 2.3-2.3-2.3-2.3z" />,
  gear: <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm8.2 5.5-.1-.9 1.9-1.5-2-3.4-2.3.9a7 7 0 0 0-1.5-.9L15.8 5h-4l-.4 2.4c-.5.2-1 .5-1.5.9l-2.3-.9-2 3.4 1.9 1.5a7 7 0 0 0 0 1.8L5.6 15.6l2 3.4 2.3-.9c.5.4 1 .7 1.5.9l.4 2.4h4l.4-2.4c.5-.2 1-.5 1.5-.9l2.3.9 2-3.4-1.9-1.5z" />,
}[name]}</svg>

function Player({ detail, onBack, embedded = false, autoStart = false, branded = false, videoExport }: { detail: ChordSheetDetail; onBack: () => void; embedded?: boolean; autoStart?: boolean; branded?: boolean; videoExport?: 'clip' | 'full' }) {
  const [sharing, setSharing] = useState(false)
  const [videoAt, setVideoAt] = useState<number | null>(null)
  // Chỉ bản đã duyệt (current/old) chia sẻ được; máy chủ kiểm lại approved khi đăng/gửi.
  const canShare = !embedded && (detail.status === 'current' || detail.status === 'old')
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

  // Người xem đã bấm Play ở bản xem trước → chạy ngay (một lần), dùng đúng đồng hồ + play() của engine hiện có.
  const autoStarted = useRef(false)
  useEffect(() => {
    if (!autoStart || autoStarted.current || !total) return
    autoStarted.current = true
    clockRef.current.play()
    setPlaying(true)
  }, [autoStart, total])

  // Tiếng đập nhịp (chỉ trang học viên, mặc định TẮT): hẹn click theo đúng beat clock + BPM hiện tại; không đồng hồ riêng.
  const [clickOn, setClickOn] = useState(false)
  const clicker = useRef<ReturnType<typeof createBeatClicker> | null>(null)
  const audioRef = useRef<AudioContext | null>(null)
  const lastClick = useRef<number | null>(null)
  useAudioContextResume(audioRef)
  useEffect(() => () => { clicker.current?.close(); clicker.current = null; audioRef.current = null }, [])
  useEffect(() => {
    if (!playing || !clickOn || !clicker.current) { lastClick.current = null; return }
    const pickup = timeline?.pickupBeats ?? 0
    const beatsPerMeasure = meter?.beats ?? 4
    const fire = (n: number, delay: number) => {
      lastClick.current = n
      clicker.current?.click(delay, (((n - pickup) % beatsPerMeasure) + beatsPerMeasure) % beatsPerMeasure === 0)
    }
    // Vòng hẹn ngắn: chỉ ĐỌC beat clock + BPM hiện tại (không đồng hồ riêng), hẹn click khi phách kế còn < 0.1 giây.
    const schedule = () => {
      const b = readBeat()
      if (lastClick.current === null && b < 0.05) { fire(0, 0); return }
      const n = Math.floor(b) + 1
      const ahead = ((n - b) * 60) / bpmRef.current
      if (n < total && ahead < 0.1 && n !== lastClick.current) fire(n, ahead)
    }
    schedule()
    const timer = window.setInterval(schedule, 25)
    return () => window.clearInterval(timer)
  }, [playing, clickOn, total])
  const toggleClick = () => {
    if (clickOn) { setClickOn(false); return }
    if (!clicker.current) { clicker.current = createBeatClicker() }
    clicker.current.unlock()
    audioRef.current = clicker.current.context()
    lastClick.current = null
    setClickOn(true)
  }

  if (!anchors || !timeline || !script) {
    return <Shell embedded={embedded} branded={branded} composer={detail.composer} credit={creditLine(detail)} versionId={detail.versionId} onBack={onBack} title={detail.title}><p role="alert" className="rs-bad">Phiên bản này chưa có vạch nhịp nên chưa chạy được Rhythm Scroll. Hãy đặt vạch nhịp trong trình sửa rồi mở lại.</p></Shell>
  }
  if (!meter || !data || !timeline.totalBeats) {
    return <Shell embedded={embedded} branded={branded} composer={detail.composer} credit={creditLine(detail)} versionId={detail.versionId} onBack={onBack} title={detail.title}>
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
  // Mở hộp "Tạo video": dừng Play Scroll, bắt đầu từ đầu ô nhịp đang xem (hết bài → từ đầu).
  const openVideo = () => {
    if (playing) pause()
    setSharing(false)
    setVideoAt(position.state === 'active' ? timeline.measures[position.measureIndex].startBeat : 0)
  }
  const shareButton = canShare ? <button type="button" className="rs-back rs-share" onClick={() => setSharing(true)} aria-label="Chia sẻ"><Icon name="share" /><span>Chia sẻ</span></button> : null
  return <Shell embedded={embedded} branded={branded} composer={detail.composer} credit={creditLine(detail)} versionId={detail.versionId} onBack={onBack} title={detail.title} right={shareButton}>
    {sharing && <Suspense fallback={null}>
      <ShareSheet title={detail.title} target={chordSheetRef(detail.versionId)} canPublish publish={() => publishChordSheet(detail.versionId)}
        ensureTarget={async () => ({ ok: true, target: chordSheetRef(detail.versionId) })} onClose={() => setSharing(false)}
        extra={videoExport ? [{ key: 'video', title: 'Tạo video 14 giây', hint: 'MP4 dọc 9:16 để lưu hoặc chia sẻ', onSelect: openVideo }] : []} />
    </Suspense>}
    {videoAt !== null && anchors && meter && <Suspense fallback={null}>
      <VideoExportDialog canFull={videoExport === 'full'} startBeat={videoAt} onClose={() => setVideoAt(null)}
        song={{ title: detail.title, composer: detail.composer, text: detail.text, anchors, meter, bpm, bandName: detail.bandName ?? null, editorName: detail.editorName ?? null }} />
    </Suspense>}
    {branded && !embedded ? <>
      {(unverified > 0 || pickupGuess) && <div className="rs-meta rs-meta-warn" data-testid="rhythm-status">
        {unverified > 0 && <span className="rs-warn" data-testid="rhythm-unverified">{unverified} ô hợp âm chia phách theo suy luận — chưa xác minh</span>}
        {pickupGuess && <span className="rs-warn">nhịp lấy đà là suy luận</span>}
      </div>}
      <div className="rs-strip" data-testid="rhythm-chords" aria-live="off">
        <span className="rs-strip-now" data-testid="rs-chord-now">{event?.chord ?? '—'}</span>
        <span className="rs-strip-arrow" aria-hidden="true">→</span>
        <span className="rs-strip-next" data-testid="rs-chord-next">{next?.chord ?? ''}</span>
        <span className="rs-dots" data-testid="rs-beat" role="img" aria-label={(playing || beat > 0) && beatInMeasure ? `phách ${beatInMeasure}` : 'sẵn sàng'}>
          {Array.from({ length: position.state === 'active' ? timeline.measures[position.measureIndex].beats : meter.beats }, (_, i) =>
            <i key={i} data-on={(playing || beat > 0) && beatInMeasure === i + 1} />)}
        </span>
        <button type="button" className="rs-click" data-on={clickOn} aria-pressed={clickOn} onClick={toggleClick}
          aria-label={clickOn ? 'Tắt tiếng đập nhịp' : 'Bật tiếng đập nhịp'}><Icon name={clickOn ? 'speaker' : 'mute'} /></button>
      </div>
    </> : <>
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
    </>}
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
