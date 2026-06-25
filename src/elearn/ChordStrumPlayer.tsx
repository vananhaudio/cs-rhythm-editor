// ── MÀN "QUẠT HỢP ÂM" theo bản thu thật ───────────────────────────────────────
// Nhận 1 bài: nguồn tiếng (audio up HOẶC YouTube) + mốc hợp âm (giây) + tempo/nhịp.
// Ẩn video/lời — chỉ hiện HỢP ÂM HIỆN TẠI + KẾ TIẾP + dải CHÙM 2 sáng theo nhịp.
// Học sinh nghe tiếng, gảy theo. Mốc do thầy cung cấp (BMS lo phần soạn).
import { useEffect, useMemo, useRef, useState } from 'react'
import { PRACTICE } from './surfaces'

const IND = '#8B82F0', GOLD = '#E8B96B', SUB = PRACTICE.sub, INK = PRACTICE.ink

export interface StrumSong {
  title: string
  videoId?: string | null
  audioUrl?: string | null
  bpm: number
  timeSignature: number               // số phách / ô (3 hoặc 4)
  gridOffset: number                  // giây của phách 1 (downbeat đầu tiên)
  chords: { t: number; name: string }[]   // mốc đổi hợp âm (giây), tăng dần
  eighths?: boolean                   // chùm 2 (mặc định true)
}

// Cặp mũi tên chùm 2 ↓↑ (sáng khi đúng phách)
function Strum({ on, eighths }: { on: boolean; eighths: boolean }) {
  const c = on ? IND : '#3A3D55'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, transition: 'transform .08s', transform: on ? 'scale(1.12)' : 'none' }}>
      <svg viewBox="0 0 30 40" style={{ height: 34, width: 'auto', overflow: 'visible' }}>
        <rect x={8} y={3} width={14} height={3.4} rx={1} fill={c} />
        <line x1={9.5} y1={5} x2={9.5} y2={24} stroke={c} strokeWidth={2.4} />
        <line x1={3} y1={29} x2={11} y2={21} stroke={c} strokeWidth={3.6} strokeLinecap="round" />
        {eighths && <>
          <line x1={20.5} y1={5} x2={20.5} y2={24} stroke={c} strokeWidth={2.4} />
          <line x1={14} y1={29} x2={22} y2={21} stroke={c} strokeWidth={3.6} strokeLinecap="round" />
        </>}
      </svg>
      <div style={{ display: 'flex', gap: eighths ? 7 : 0, fontSize: 12, fontWeight: 800, color: on ? IND : '#4A4D6B' }}>
        <span>↓</span>{eighths && <span>↑</span>}
      </div>
    </div>
  )
}

export default function ChordStrumPlayer({ song, onClose, onComplete }: { song: StrumSong; onClose?: () => void; onComplete?: () => void }) {
  const eighths = song.eighths !== false
  const N = song.timeSignature
  const beatDur = 60 / song.bpm
  const chords = useMemo(() => [...song.chords].sort((a, b) => a.t - b.t), [song.chords])

  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [ended, setEnded] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Đồng hồ: audio.currentTime (nếu audio) hoặc anchor YouTube (nếu video)
  const playingRef = useRef(false)
  const anchorV = useRef(0)
  const anchorW = useRef(0)
  const isYT = !!song.videoId && !song.audioUrl
  const clock = () => isYT
    ? (playingRef.current ? anchorV.current + (performance.now() - anchorW.current) / 1000 : anchorV.current)
    : (audioRef.current?.currentTime ?? 0)

  // raf cập nhật thời gian hiển thị
  useEffect(() => {
    let raf = 0
    const tick = () => { setT(clock()); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isYT])

  // YouTube postMessage (chỉ khi dùng video)
  const post = (func: string, args: unknown[] = []) => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*')
  useEffect(() => {
    if (!isYT) return
    const h = (ev: MessageEvent) => {
      if (typeof ev.origin === 'string' && !ev.origin.includes('youtube')) return
      let d: Record<string, unknown>; try { d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data } catch { return }
      if (d.event === 'onReady') { post('unMute'); post('setVolume', [100]) }
      const info = (d.info ?? {}) as Record<string, unknown>
      const st = typeof d.info === 'number' ? d.info : info.playerState
      if (typeof st === 'number') { playingRef.current = st === 1; setPlaying(st === 1); if (st === 0) { setEnded(true); onComplete?.() } }
      if (typeof info.currentTime === 'number') { anchorV.current = info.currentTime as number; anchorW.current = performance.now() }
    }
    window.addEventListener('message', h)
    return () => window.removeEventListener('message', h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isYT])

  const toggle = () => {
    if (isYT) { playing ? post('pauseVideo') : (post('unMute'), post('playVideo')) }
    else { const a = audioRef.current; if (!a) return; if (a.paused) { a.play(); setPlaying(true) } else { a.pause(); setPlaying(false) } }
  }
  const restart = () => {
    setEnded(false)
    if (isYT) { post('seekTo', [0, true]); anchorV.current = 0; anchorW.current = performance.now() }
    else if (audioRef.current) { audioRef.current.currentTime = 0 }
  }

  // Hợp âm hiện tại + kế tiếp theo mốc giây
  const curIdx = useMemo(() => { let i = -1; for (let k = 0; k < chords.length; k++) { if (chords[k].t <= t + 0.04) i = k; else break } return i }, [chords, t])
  const current = curIdx >= 0 ? chords[curIdx].name : null
  const next = curIdx + 1 < chords.length ? chords[curIdx + 1] : null
  const toNext = next ? Math.max(0, next.t - t) : null
  const started = t >= song.gridOffset - 0.05
  const beat = started ? Math.floor((t - song.gridOffset) / beatDur) : -1
  const beatInBar = beat >= 0 ? ((beat % N) + N) % N : -1

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: PRACTICE.bg, color: INK, fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ padding: 'calc(env(safe-area-inset-top,0px) + 12px) 16px 10px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,.12)', border: 'none', color: '#fff', borderRadius: 10, width: 34, height: 34, fontSize: 18, cursor: 'pointer' }}>‹</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: IND, letterSpacing: '.08em', fontWeight: 700 }}>GẢY THEO BÀI · QUẠT HỢP ÂM</div>
          <div style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</div>
        </div>
        <div style={{ fontSize: 12, color: SUB }}>{mmss(t)}</div>
      </div>

      {/* Vùng chính */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, padding: '0 18px', minHeight: 0 }}>
        {/* Hợp âm kế tiếp (nhỏ, để kịp đổi tay) */}
        <div style={{ textAlign: 'center', opacity: next ? 1 : .25 }}>
          <div style={{ fontSize: 11, color: SUB, fontWeight: 700, letterSpacing: '.1em' }}>KẾ TIẾP</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: GOLD }}>{next?.name ?? '—'}</div>
          {toNext != null && <div style={{ fontSize: 12, color: SUB }}>đổi sau {toNext.toFixed(1)}s</div>}
        </div>

        {/* Hợp âm hiện tại (TO) */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: SUB, fontWeight: 700, letterSpacing: '.1em', marginBottom: 4 }}>ĐANG CHƠI</div>
          <div style={{ fontSize: 92, fontWeight: 900, lineHeight: 1, color: current ? '#fff' : '#3A3D55' }}>{current ?? (started ? '—' : '…')}</div>
        </div>

        {/* Dải quạt chùm 2 — sáng theo phách */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
          {Array.from({ length: N }, (_, i) => <Strum key={i} on={playing && beatInBar === i} eighths={eighths} />)}
        </div>
        {!started && <div style={{ fontSize: 13, color: SUB }}>Bấm ▶ — chờ hợp âm đầu sáng rồi vào</div>}
      </div>

      {/* Điều khiển */}
      <div style={{ padding: '12px 18px calc(env(safe-area-inset-bottom,0px) + 16px)', flexShrink: 0, display: 'flex', gap: 10 }}>
        <button onClick={restart} style={{ flex: '0 0 auto', background: 'rgba(255,255,255,.1)', border: 'none', color: '#fff', borderRadius: 12, padding: '13px 16px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>⏮</button>
        <button onClick={toggle} style={{ flex: 1, background: ended ? '#16A34A' : IND, border: 'none', color: '#fff', borderRadius: 12, padding: 13, fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
          {ended ? '✓ Xong — gảy lại' : playing ? '⏸ Tạm dừng' : '▶ Phát — gảy theo'}
        </button>
      </div>

      {/* Nguồn tiếng — audio thường, hoặc YouTube ẩn (1px, vẫn ra tiếng) */}
      {song.audioUrl && <audio ref={audioRef} src={song.audioUrl} preload="auto" onEnded={() => { setPlaying(false); setEnded(true); onComplete?.() }} />}
      {isYT && (
        <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none', bottom: 0, left: 0 }}>
          <iframe ref={iframeRef} title="audio" width="200" height="120"
            src={`https://www.youtube.com/embed/${song.videoId}?${new URLSearchParams({ enablejsapi: '1', controls: '0', rel: '0', playsinline: '1' })}`}
            allow="autoplay; encrypted-media"
            onLoad={() => { const post2 = () => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), '*'); setTimeout(post2, 400); setTimeout(post2, 1200) }} />
        </div>
      )}
    </div>
  )
}
