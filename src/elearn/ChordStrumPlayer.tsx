// ── MÀN "QUẠT HỢP ÂM" theo bản thu thật — HIỂN THỊ NHƯ SÁCH (khuông nhịp) ──────
// Cả bài = các ô nhịp (tên hợp âm + chùm 2), sáng theo ô/phách đang chơi.
// Nguồn tiếng: audio up HOẶC YouTube ẩn. Mốc nhịp do thầy cung cấp (tempo đều).
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { BackingEngine, type MelodyNote } from './backing/backingEngine'
import { getStyle } from './backing/backingStyles'
import { resolvePattern, type Stroke } from './strumPatterns'

const INDIGO = '#4338CA', ORANGE = '#EA580C', INK = '#1F2430', DIM = '#C0C6D2', SUB = '#6B7280'

// Mức thành thạo theo số lượt: 1→2→3+ (xanh hóa). Lời ĐỘNG VIÊN, không khiến học sinh tưởng bị sai.
const SKILL = (n: number) => n >= 3 ? { color: '#16A34A', bg: '#DCFCE7', label: 'Quá vững! Bạn làm chủ phần này rồi 🎸' }
  : n === 2 ? { color: '#D97706', bg: '#FEF3C7', label: 'Tiến bộ rõ — thêm 1 lượt nữa là thật vững 💪' }
  : { color: '#DC2626', bg: '#FEE2E2', label: 'Khởi đầu tốt — gảy thêm cho quen tay 👍' }

export interface SongBar { chord?: string | null; pickup?: boolean; rest?: boolean; oneStrum?: boolean }   // pickup=lấy đà; rest=nghỉ cả ô; oneStrum=quạt 1 cái (nốt trắng) rồi lặng nửa ô
export interface StrumSong {
  title: string
  videoId?: string | null
  audioUrl?: string | null
  bpm: number
  timeSignature: number          // số phách / ô (2, 3 hoặc 4)
  gridOffset: number             // giây của phách 1
  eighths?: boolean              // (cũ) chùm 2 nếu không có patternId
  patternId?: string             // kiểu quạt từ thư viện chùm (strumPatterns.ts) — ưu tiên hơn eighths
  bars: SongBar[]                // 1 phần tử / ô nhịp
  backing?: { styleId: string; tempo?: number }  // có → NỀN trống+bass synth, bỏ qua audio/video
  melody?: MelodyNote[]                            // (chế độ nền) giai điệu chơi kèm để học sinh theo dõi
  loop?: boolean                                   // (chế độ nền) false = chơi 1 lượt rồi DỪNG (mặc định loop)
}

// Vẽ MỘT CHÙM (1..4 nốt) trong một phách — đầu nốt slash dày, thân cao, nối chùm + ↓/↑.
// M=1 nốt đen; M=2 chùm 2; M=3 liên ba (có số "3"); M=4 móc kép. lit = phách đang chơi.
function BeatGroup({ strokes, lit }: { strokes: Stroke[]; lit: boolean }) {
  const c = lit ? INDIGO : DIM, ac = lit ? INDIGO : '#9AA0B0'
  const M = Math.max(1, strokes.length)
  const SP = 19, pad = 6, W = pad * 2 + (M - 1) * SP + 10   // bề rộng theo số nốt
  const top = 4, stemBot = 31, base = 40
  const xs = Array.from({ length: M }, (_, i) => pad + 5 + i * SP)
  return (
    <svg viewBox={`0 0 ${W} 60`} style={{ height: 52, width: 'auto', maxWidth: '100%', overflow: 'visible', display: 'block' }}>
      {M >= 2 && <rect x={xs[0]} y={top} width={xs[M - 1] - xs[0]} height={4} rx={1} fill={c} />}
      {M === 3 && <text x={(xs[0] + xs[2]) / 2} y={top - 1} fontSize={9} textAnchor="middle" fontWeight={800} fill={ac}>3</text>}
      {xs.map((x, i) => (
        <g key={i}>
          <line x1={x} y1={M >= 2 ? top + 2 : 8} x2={x} y2={stemBot} stroke={c} strokeWidth={3} />
          <line x1={x - 9.5} y1={base + 7} x2={x + 1} y2={base - 3} stroke={c} strokeWidth={4.6} strokeLinecap="round" />
          <text x={x - 4} y={57} fontSize={11.5} textAnchor="middle" fontWeight={800} fill={ac}>{strokes[i] === 'U' ? '↑' : '↓'}</text>
        </g>
      ))}
    </svg>
  )
}

export default function ChordStrumPlayer({ song, onClose, onComplete, studentId, lessonId }: { song: StrumSong; onClose?: () => void; onComplete?: () => void; studentId?: string; lessonId?: string }) {
  const eighths = song.eighths !== false
  const N = song.timeSignature
  const pattern = resolvePattern(N, eighths, song.patternId)   // kiểu quạt (chùm)
  const beatDur = 60 / song.bpm
  const barDur = N * beatDur
  const perRow = 2   // 2 ô / hàng → nốt to, không tràn

  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [ended, setEnded] = useState(false)
  const [sessions, setSessions] = useState(0)
  const recordedRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const playingRef = useRef(false)
  const anchorV = useRef(0)
  const anchorW = useRef(0)
  const isBacking = !!song.backing
  const isYT = !isBacking && !!song.videoId && !song.audioUrl

  // Nền trống+bass synth (loop). Chords = các ô có hợp âm (bỏ pickup/rest).
  const backChords = useMemo(() => song.bars.filter((b) => b.chord).map((b) => b.chord as string), [song.bars])
  const backOutro = useMemo(() => song.bars.filter((b) => b.chord).map((b) => !!b.oneStrum), [song.bars])
  const backTempo = song.backing?.tempo ?? song.bpm
  const engineRef = useRef<BackingEngine | null>(null)
  if (isBacking && !engineRef.current) {
    engineRef.current = new BackingEngine({
      getStyle: () => getStyle(song.backing!.styleId),
      getChords: () => backChords,
      getTempo: () => backTempo,
      getMutes: () => ({ drums: false, bass: false, click: true }),  // nền groove; click tắt
      getMelody: () => song.melody ?? [],
      getOutro: () => backOutro,
    })
  }
  useEffect(() => () => { engineRef.current?.dispose(); engineRef.current = null }, [])

  // ── GHI ÂM thành quả: thu tiếng đàn TRỘN nhạc (nền synth HOẶC mp3) — lưu tạm tại máy, KHÔNG upload ──
  const canRecord = isBacking || (!isYT && !!song.audioUrl)   // nền synth, hoặc mp3 (HBD); KHÔNG cho YouTube
  const [recState, setRecState] = useState<'idle' | 'recording' | 'done'>('idle')
  const [recUrl, setRecUrl] = useState<string | null>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const recChunks = useRef<Blob[]>([])
  // Chế độ mp3 (HBD): trộn qua AudioContext riêng — MediaElementSource(mp3) + micro
  const audioCtxRef = useRef<AudioContext | null>(null)
  const mediaElSrcRef = useRef<MediaElementAudioSourceNode | null>(null)
  const audioRecDestRef = useRef<MediaStreamAudioDestinationNode | null>(null)
  const audioMicRef = useRef<{ src: MediaStreamAudioSourceNode; gain: GainNode } | null>(null)
  useEffect(() => () => {
    if (recUrl) URL.revokeObjectURL(recUrl)
    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    try { audioCtxRef.current?.close() } catch { /* */ }
  }, [recUrl])

  const wireRecorder = (mr: MediaRecorder) => {
    recChunks.current = []
    mr.ondataavailable = (ev) => { if (ev.data.size) recChunks.current.push(ev.data) }
    mr.onstop = () => {
      const blob = new Blob(recChunks.current, { type: mr.mimeType || 'audio/webm' })
      setRecUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob) })
      setRecState('done')
    }
    recRef.current = mr
  }
  const startRecord = async () => {
    if (!canRecord) return
    try {
      // TẮT xử lý giọng nói (EC/NS/AGC) — chúng làm bệt/nhoè tiếng đàn. Thu nhạc cần tín hiệu thô.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } as MediaTrackConstraints,
      })
      micStreamRef.current = stream
      setEnded(false)
      if (isBacking && engineRef.current) {
        wireRecorder(engineRef.current.startMixRecording(stream)); recRef.current!.start()
        await engineRef.current.start(); setPlaying(true)
      } else if (audioRef.current) {
        const el = audioRef.current
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
          mediaElSrcRef.current = audioCtxRef.current.createMediaElementSource(el)
          mediaElSrcRef.current.connect(audioCtxRef.current.destination)   // vẫn nghe được
        }
        const ctx = audioCtxRef.current
        if (ctx.state === 'suspended') await ctx.resume()
        const recDest = ctx.createMediaStreamDestination(); audioRecDestRef.current = recDest
        mediaElSrcRef.current!.connect(recDest)                            // nhạc mp3 → bản thu
        const src = ctx.createMediaStreamSource(stream), gain = ctx.createGain(); gain.gain.value = 1.6
        src.connect(gain).connect(recDest); audioMicRef.current = { src, gain }   // tiếng đàn → bản thu
        wireRecorder(new MediaRecorder(recDest.stream, { audioBitsPerSecond: 256000 })); recRef.current!.start()
        el.currentTime = 0; await el.play(); setPlaying(true)
      }
      setRecState('recording')
    } catch {
      alert('Không truy cập được micro. Hãy cho phép quyền micro cho ứng dụng/trình duyệt rồi thử lại.')
      setRecState('idle')
    }
  }
  const stopRecord = () => {
    try { recRef.current?.stop() } catch { /* */ }
    if (isBacking) { engineRef.current?.stopMixRecording(); engineRef.current?.stop() }
    else if (audioRef.current) {
      audioRef.current.pause()
      try { if (audioRecDestRef.current) mediaElSrcRef.current?.disconnect(audioRecDestRef.current) } catch { /* */ }
      try { audioMicRef.current?.src.disconnect(); audioMicRef.current?.gain.disconnect() } catch { /* */ }
      audioRecDestRef.current = null; audioMicRef.current = null
    }
    setPlaying(false)
    micStreamRef.current?.getTracks().forEach((t) => t.stop()); micStreamRef.current = null
  }
  const discardRecord = () => { if (recUrl) URL.revokeObjectURL(recUrl); setRecUrl(null); setRecState('idle') }

  const clock = () => isBacking
    ? (engineRef.current?.getElapsed() ?? -1)
    : isYT
      ? (playingRef.current ? anchorV.current + (performance.now() - anchorW.current) / 1000 : anchorV.current)
      : (audioRef.current?.currentTime ?? 0)

  useEffect(() => {
    let raf = 0
    const tick = () => { setT(clock()); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isYT])

  const post = (func: string, args: unknown[] = []) => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*')
  useEffect(() => {
    if (!isYT) return
    const h = (ev: MessageEvent) => {
      if (typeof ev.origin === 'string' && !ev.origin.includes('youtube')) return
      let d: Record<string, unknown>; try { d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data } catch { return }
      if (d.event === 'onReady') { post('unMute'); post('setVolume', [100]) }
      const info = (d.info ?? {}) as Record<string, unknown>
      const st = typeof d.info === 'number' ? d.info : info.playerState
      if (typeof st === 'number') { playingRef.current = st === 1; setPlaying(st === 1); if (st === 0) setEnded(true) }
      if (typeof info.currentTime === 'number') { anchorV.current = info.currentTime as number; anchorW.current = performance.now() }
    }
    window.addEventListener('message', h)
    return () => window.removeEventListener('message', h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isYT])

  const toggle = () => {
    if (isBacking) {
      const e = engineRef.current; if (!e) return
      if (e.isPlaying()) { e.stop(); setPlaying(false) } else { e.start(); setPlaying(true) }
    }
    else if (isYT) { playing ? post('pauseVideo') : (post('unMute'), post('playVideo')) }
    else { const a = audioRef.current; if (!a) return; if (a.paused) { if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume(); a.play(); setPlaying(true) } else { a.pause(); setPlaying(false) } }
  }
  const restart = () => {
    setEnded(false)
    if (isBacking) { engineRef.current?.stop(); engineRef.current?.start(); setPlaying(true) }
    else if (isYT) { post('seekTo', [0, true]); anchorV.current = 0; anchorW.current = performance.now() }
    else if (audioRef.current) { audioRef.current.currentTime = 0 }
  }

  // Vị trí hiện tại theo lưới nhịp đều (nền: dùng tempo của nền + LOOP vòng)
  const effBeatDur = isBacking ? 60 / backTempo : beatDur
  const effBarDur = N * effBeatDur
  const elapsed = t - (isBacking ? 0 : song.gridOffset)
  const rawBar = elapsed >= 0 ? Math.floor(elapsed / effBarDur) : -1
  const barIdx = rawBar < 0 ? -1 : isBacking ? rawBar % song.bars.length : rawBar
  const beatInBar = elapsed >= 0 ? (Math.floor(elapsed / effBeatDur) % N) : -1
  // Đếm vào của nền (elapsed âm trong lúc đang chạy) → số đếm 1..N
  const counting = isBacking && playing && elapsed < 0 && elapsed > -(N * effBeatDur + 1)
  const countNum = counting ? Math.min(N, Math.max(1, Math.floor(elapsed / effBeatDur) + N + 1)) : 0
  const rows = useMemo(() => {
    const out: { bar: SongBar; idx: number }[][] = []
    song.bars.forEach((bar, idx) => {
      if (idx % perRow === 0) out.push([])
      out[out.length - 1].push({ bar, idx })
    })
    return out
  }, [song.bars, perRow])

  // Tự cuộn khuông tới hàng đang chơi (bài dài nhiều ô)
  const rowRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const curRow = barIdx >= 0 ? Math.floor(barIdx / perRow) : -1
  useEffect(() => {
    if (curRow >= 0) rowRefs.current[curRow]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [curRow])

  // Bài KHÔNG loop (nền): hết lượt (qua ô cuối) thì DỪNG — đang ghi thì dừng ghi luôn.
  useEffect(() => {
    if (!isBacking || song.loop !== false || !playing) return
    if (t >= song.bars.length * effBarDur) {
      if (recState === 'recording') stopRecord()
      else { engineRef.current?.stop(); setPlaying(false); setEnded(true) }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  const curChord = barIdx >= 0 && barIdx < song.bars.length ? song.bars[barIdx].chord : null

  // Gảy hết 1 lượt = 1 phiên luyện → ghi nhận (1 lần / lượt) để xanh hóa
  useEffect(() => {
    if (!ended || recordedRef.current) return
    recordedRef.current = true
    onComplete?.()
    if (studentId && lessonId) {
      supabase.rpc('record_skill_session', { p_student: studentId, p_lesson: lessonId })
        .then(({ data, error }) => setSessions(error ? (s) => s + 1 : (data as number) || 1))
    } else setSessions((s) => s + 1)
  }, [ended, studentId, lessonId, onComplete])

  const replay = () => {
    recordedRef.current = false
    setEnded(false)
    restart()
    if (isYT) { post('playVideo') }
    else { const a = audioRef.current; if (a) { a.play(); setPlaying(true) } }
  }
  const sk = SKILL(sessions), green = sessions >= 3

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: '#F0F2F5', color: INK, fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ padding: 'calc(env(safe-area-inset-top,0px) + 12px) 16px 8px', background: '#fff', borderBottom: '1px solid #E8EAF0', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: INDIGO, fontSize: 22, cursor: 'pointer', padding: 0 }}>‹</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: ORANGE, letterSpacing: '.08em', fontWeight: 700 }}>GẢY THEO BÀI · QUẠT HỢP ÂM</div>
          <div style={{ fontSize: 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</div>
        </div>
        <div style={{ fontSize: 12, color: SUB }}>{mmss(t)}</div>
      </div>

      {/* Khuông nhịp — như sách */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', padding: '12px 14px', minHeight: 0, overflowY: 'auto', position: 'relative' }}>
        {counting && (
          <div style={{ position: 'absolute', top: 16, left: 0, right: 0, zIndex: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.14em', color: SUB }}>ĐẾM VÀO — nhìn ô đầu, sẵn sàng</div>
            <div style={{ fontSize: 64, fontWeight: 900, color: INDIGO, lineHeight: 1, textShadow: '0 2px 8px rgba(244,246,250,.9)' }}>{countNum}</div>
          </div>
        )}
        <div style={{ background: '#fff', border: '1.5px solid #E1E4EA', borderRadius: 16, padding: '14px 8px', boxShadow: '0 2px 10px rgba(17,24,39,.04)', maxWidth: 760, width: '100%', margin: '0 auto' }}>
          {rows.map((row, ri) => (
            <div key={ri} ref={(el) => { rowRefs.current[ri] = el }} style={{ display: 'flex', alignItems: 'stretch', marginBottom: ri === rows.length - 1 ? 0 : 14 }}>
              <div style={{ width: 2, background: INK, borderRadius: 1, alignSelf: 'stretch' }} />
              {row.map(({ bar, idx }) => {
                const isCur = playing && barIdx === idx
                return (
                  <div key={idx} style={{ flex: 1, display: 'flex' }}>
                    <div style={{ flex: 1, padding: '0 5px', minWidth: 0 }}>
                      {/* tên hợp âm — đặt trên NỐT ĐẦU của ô (căn trái) */}
                      <div style={{ height: 22, textAlign: 'left', paddingLeft: '9%', fontSize: (bar.pickup || bar.rest) ? 11 : 18, fontWeight: 800, lineHeight: '22px', color: (bar.pickup || bar.rest) ? '#9AA0B0' : isCur ? INDIGO : INK, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                        {bar.pickup ? 'Lấy đà' : bar.rest ? 'Nghỉ' : (bar.chord ?? '')}
                      </div>
                      {/* ô lấy đà: ĐẾM VÀO 1-2-3 (sáng theo phách) / dấu lặng / nốt */}
                      {bar.pickup ? (
                        <div style={{ height: 52, display: 'grid', gridTemplateColumns: `repeat(${N},1fr)`, alignItems: 'center', justifyItems: 'center' }}>
                          {Array.from({ length: N }, (_, j) => {
                            const lit = isCur && beatInBar === j
                            return <div key={j} style={{ fontSize: lit ? 30 : 22, fontWeight: 800, color: lit ? INDIGO : '#B6BBC9', transition: 'all .07s', transform: lit ? 'scale(1.1)' : 'none' }}>{j + 1}</div>
                          })}
                        </div>
                      ) : bar.rest ? (
                        <div style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Bravura', fontSize: 30, color: isCur ? INDIGO : '#9AA0B0' }}>{String.fromCodePoint(0xE4E3)}</div>
                      ) : bar.oneStrum ? (
                        (() => {
                          const lit = isCur && beatInBar < N / 2
                          const c = lit ? INDIGO : DIM, ac = lit ? INDIGO : '#9AA0B0'
                          return (
                            <div style={{ height: 52, display: 'flex', alignItems: 'center' }}>
                              {/* nốt TRẮNG: đầu HÌNH THOI RỖNG (khỏi nhầm nốt đen) + thân + mũi tên xuống */}
                              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                                <svg viewBox="0 0 30 60" style={{ height: 52, width: 'auto', overflow: 'visible', display: 'block' }}>
                                  <line x1={20} y1={38} x2={20} y2={10} stroke={c} strokeWidth={3} />
                                  <polygon points="13,31 21,38 13,45 5,38" fill="none" stroke={c} strokeWidth={2.6} strokeLinejoin="round" />
                                  <text x={10} y={57} fontSize={11.5} textAnchor="middle" fontWeight={800} fill={ac}>↓</text>
                                </svg>
                              </div>
                              <div style={{ flex: 1, textAlign: 'center', fontFamily: 'Bravura', fontSize: 28, color: (isCur && beatInBar >= N / 2) ? INDIGO : '#9AA0B0' }}>{String.fromCodePoint(0xE4E4)}</div>
                            </div>
                          )
                        })()
                      ) : (
                        <div style={{ height: 52, display: 'grid', gridTemplateColumns: `repeat(${N},1fr)`, alignItems: 'center', justifyItems: 'center' }}>
                          {Array.from({ length: N }, (_, j) => (
                            <BeatGroup key={j} strokes={pattern.beats[j] ?? ['D']} lit={isCur && beatInBar === j} />
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ width: 2, background: INK, borderRadius: 1, alignSelf: 'stretch' }} />
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', fontSize: 12, color: SUB, marginTop: 10 }}>
          {playing ? <>Đang chơi: <b style={{ color: INDIGO }}>{curChord ?? 'lấy đà'}</b> — gảy theo ô đang sáng</> : 'Bấm ▶ để phát — gảy theo ô sáng'}
        </div>
      </div>

      {/* Điều khiển — gọn: 1 hàng */}
      <div style={{ padding: '10px 18px calc(env(safe-area-inset-bottom,0px) + 14px)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {recState === 'recording' ? (
          <button onClick={stopRecord} style={{ background: '#DC2626', border: 'none', color: '#fff', borderRadius: 12, padding: 14, fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>⏹ Dừng ghi · {curChord ? `đang gảy ${curChord}` : 'đang ghi…'}</button>
        ) : recState === 'done' && recUrl ? (
          <div style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 12, padding: '8px 10px', display: 'flex', gap: 8, alignItems: 'center' }}>
            <audio src={recUrl} controls style={{ flex: 1, height: 36 }} />
            <button onClick={discardRecord} style={{ flex: '0 0 auto', background: '#fff', border: '1.5px solid #DC2626', color: '#DC2626', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>🔴 Ghi lại</button>
          </div>
        ) : canRecord ? (
          <>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={toggle} style={{ flex: 1, background: ended ? '#16A34A' : INDIGO, border: 'none', color: '#fff', borderRadius: 12, padding: 13, fontSize: 15.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                {ended ? '✓ Gảy lại' : playing ? '⏸ Tạm dừng' : (isBacking ? '▶ Tập luyện' : '▶ Phát — gảy theo')}
              </button>
              {playing
                ? (isBacking
                  ? <button onClick={() => { engineRef.current?.stop(); setPlaying(false); setEnded(true) }} style={{ flex: '0 0 auto', background: '#16A34A', border: 'none', color: '#fff', borderRadius: 12, padding: '13px 16px', fontSize: 14.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>✓ Xong lượt</button>
                  : null)
                : <button onClick={startRecord} style={{ flex: 1, background: '#DC2626', border: 'none', color: '#fff', borderRadius: 12, padding: 13, fontSize: 15.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>🔴 Ghi âm</button>}
            </div>
            {!playing && <div style={{ textAlign: 'center', fontSize: 11.5, color: '#DC2626', fontWeight: 700 }}>🎧 Đeo tai nghe để bản thu sạch, rõ</div>}
          </>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={restart} style={{ flex: '0 0 auto', background: '#fff', border: `1.5px solid ${INDIGO}`, color: INDIGO, borderRadius: 12, padding: '13px 16px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>⏮</button>
            <button onClick={toggle} style={{ flex: 1, background: ended ? '#16A34A' : INDIGO, border: 'none', color: '#fff', borderRadius: 12, padding: 13, fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
              {ended ? '✓ Xong — gảy lại' : playing ? '⏸ Tạm dừng' : '▶ Phát — gảy theo'}
            </button>
          </div>
        )}
      </div>

      {/* Màn XONG LƯỢT — xanh hóa (đỏ/vàng/xanh) */}
      {ended && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(240,242,245,.98)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 44 }}>{green ? '🟢' : '🎉'}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: INK, marginTop: 6 }}>Gảy xong một lượt!</div>
          <div style={{ background: sk.bg, border: `1.5px solid ${sk.color}`, borderRadius: 14, padding: '12px 16px', margin: '14px 0', maxWidth: 340, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
              {[1, 2, 3].map((i) => <span key={i} style={{ width: 26, height: 8, borderRadius: 4, background: i <= sessions ? sk.color : '#E5E7EB' }} />)}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: sk.color }}>{sk.label}</div>
            <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 3 }}>Đã gảy <b>{sessions}/3</b> lượt{green ? ' — bài đã xanh hóa 🎉' : ` · còn ${3 - sessions} lượt để xanh hóa`}</div>
          </div>
          <div style={{ fontSize: 13.5, color: '#5A6072', lineHeight: 1.6, marginBottom: 16, maxWidth: 340 }}>Nghỉ tay chút rồi gảy lại — lặp nhiều lượt cho thật chắc nhịp.</div>
          {!green && <button onClick={replay} style={{ width: '100%', maxWidth: 340, marginBottom: 10, background: INDIGO, border: 'none', color: '#fff', borderRadius: 12, padding: 14, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Gảy thêm một lượt →</button>}
          <button onClick={onClose} style={{ width: '100%', maxWidth: 340, background: '#fff', border: `1.5px solid ${INDIGO}`, color: INDIGO, borderRadius: 12, padding: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{green ? 'Hoàn tất — về danh sách' : 'Dừng tại đây'}</button>
        </div>
      )}

      {song.audioUrl && <audio ref={audioRef} src={song.audioUrl} preload="auto" crossOrigin="anonymous" onEnded={() => { if (recState === 'recording') stopRecord(); else { setPlaying(false); setEnded(true) } }} />}
      {isYT && (
        <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none', bottom: 0, left: 0 }}>
          <iframe ref={iframeRef} title="audio" width="200" height="120"
            src={`https://www.youtube.com/embed/${song.videoId}?${new URLSearchParams({ enablejsapi: '1', controls: '0', rel: '0', playsinline: '1' })}`}
            allow="autoplay; encrypted-media"
            onLoad={() => { const p = () => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), '*'); setTimeout(p, 400); setTimeout(p, 1200) }} />
        </div>
      )}
    </div>
  )
}
