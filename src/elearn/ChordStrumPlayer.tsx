// ── MÀN "QUẠT HỢP ÂM" theo bản thu thật — HIỂN THỊ NHƯ SÁCH (khuông nhịp) ──────
// Cả bài = các ô nhịp (tên hợp âm + chùm 2), sáng theo ô/phách đang chơi.
// Nguồn tiếng: audio up HOẶC YouTube ẩn. Mốc nhịp do thầy cung cấp (tempo đều).
import { useEffect, useMemo, useRef, useState } from 'react'

const INDIGO = '#4338CA', ORANGE = '#EA580C', INK = '#1F2430', DIM = '#C0C6D2', SUB = '#6B7280'

export interface SongBar { chord?: string | null; pickup?: boolean }   // pickup = ô lấy đà (không đàn)
export interface StrumSong {
  title: string
  videoId?: string | null
  audioUrl?: string | null
  bpm: number
  timeSignature: number          // số phách / ô (3 hoặc 4)
  gridOffset: number             // giây của phách 1
  eighths?: boolean              // chùm 2 (mặc định true)
  bars: SongBar[]                // 1 phần tử / ô nhịp
}

// Vẽ NỐT CẢ Ô NHỊP — nốt móc đơn cách ĐỀU (trường độ bằng nhau), thân cao, nối chùm 2 theo phách.
// eighths=false → nốt đen (1 cú ↓/phách). litBeat = phách đang chơi (sáng), -1 = không.
function BarStaff({ N, eighths, litBeat }: { N: number; eighths: boolean; litBeat: number }) {
  const M = eighths ? N * 2 : N           // tổng số nốt trong ô
  const W = 100, H = 66, pad = 9, top = 8, base = 44
  const xs = Array.from({ length: M }, (_, i) => pad + (i + 0.5) * (W - 2 * pad) / M)   // cách đều
  const beatOf = (i: number) => eighths ? Math.floor(i / 2) : i
  const colOf = (i: number) => beatOf(i) === litBeat ? INDIGO : DIM
  const els: React.ReactNode[] = []
  if (eighths) for (let k = 0; k < N; k++) {                                            // dấu chùm mỗi phách
    const a = xs[2 * k], b = xs[2 * k + 1], c = beatOf(2 * k) === litBeat ? INDIGO : DIM
    els.push(<rect key={'bm' + k} x={a} y={top} width={b - a} height={4.2} rx={1} fill={c} />)
  }
  xs.forEach((x, i) => {
    const c = colOf(i), litArrow = beatOf(i) === litBeat
    els.push(<line key={'st' + i} x1={x} y1={top} x2={x} y2={base} stroke={c} strokeWidth={2.4} />)
    els.push(<line key={'hd' + i} x1={x - 5.5} y1={base + 7} x2={x + 4} y2={base - 3} stroke={c} strokeWidth={4.6} strokeLinecap="round" />)
    els.push(<text key={'ar' + i} x={x} y={H - 1} textAnchor="middle" fontSize={9} fontWeight={800} fill={litArrow ? INDIGO : '#9AA0B0'}>{eighths ? (i % 2 === 0 ? '↓' : '↑') : '↓'}</text>)
  })
  return <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: 62, overflow: 'visible', display: 'block' }}>{els}</svg>
}

export default function ChordStrumPlayer({ song, onClose, onComplete }: { song: StrumSong; onClose?: () => void; onComplete?: () => void }) {
  const eighths = song.eighths !== false
  const N = song.timeSignature
  const beatDur = 60 / song.bpm
  const barDur = N * beatDur
  const perRow = N === 3 ? 3 : 4

  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [ended, setEnded] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const playingRef = useRef(false)
  const anchorV = useRef(0)
  const anchorW = useRef(0)
  const isYT = !!song.videoId && !song.audioUrl
  const clock = () => isYT
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

  // Vị trí hiện tại theo lưới nhịp đều
  const elapsed = t - song.gridOffset
  const barIdx = elapsed >= 0 ? Math.floor(elapsed / barDur) : -1
  const beatInBar = elapsed >= 0 ? Math.floor(elapsed / beatDur) - barIdx * N : -1
  const rows = useMemo(() => {
    const out: { bar: SongBar; idx: number }[][] = []
    song.bars.forEach((bar, idx) => {
      if (idx % perRow === 0) out.push([])
      out[out.length - 1].push({ bar, idx })
    })
    return out
  }, [song.bars, perRow])

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  const curChord = barIdx >= 0 && barIdx < song.bars.length ? song.bars[barIdx].chord : null

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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '12px 14px', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ background: '#fff', border: '1.5px solid #E1E4EA', borderRadius: 16, padding: '14px 8px', boxShadow: '0 2px 10px rgba(17,24,39,.04)', maxWidth: 760, width: '100%', margin: '0 auto' }}>
          {rows.map((row, ri) => (
            <div key={ri} style={{ display: 'flex', alignItems: 'stretch', marginBottom: ri === rows.length - 1 ? 0 : 14 }}>
              <div style={{ width: 2, background: INK, borderRadius: 1, alignSelf: 'stretch' }} />
              {row.map(({ bar, idx }) => {
                const isCur = playing && barIdx === idx
                return (
                  <div key={idx} style={{ flex: 1, display: 'flex' }}>
                    <div style={{ flex: 1, padding: '0 5px', minWidth: 0 }}>
                      {/* tên hợp âm — đặt trên NỐT ĐẦU của ô (căn trái) */}
                      <div style={{ height: 22, textAlign: 'left', paddingLeft: '9%', fontSize: bar.pickup ? 11 : 18, fontWeight: 800, lineHeight: '22px', color: bar.pickup ? '#9AA0B0' : isCur ? INDIGO : INK, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                        {bar.pickup ? 'Lấy đà' : (bar.chord ?? '')}
                      </div>
                      {/* nốt cả ô / nhãn không đàn */}
                      {bar.pickup ? (
                        <div style={{ height: 62, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#9AA0B0', fontStyle: 'italic', textAlign: 'center' }}>không đàn</div>
                      ) : (
                        <BarStaff N={N} eighths={eighths} litBeat={isCur ? beatInBar : -1} />
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

      {/* Điều khiển */}
      <div style={{ padding: '12px 18px calc(env(safe-area-inset-bottom,0px) + 16px)', flexShrink: 0, display: 'flex', gap: 10 }}>
        <button onClick={restart} style={{ flex: '0 0 auto', background: '#fff', border: `1.5px solid ${INDIGO}`, color: INDIGO, borderRadius: 12, padding: '13px 16px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>⏮</button>
        <button onClick={toggle} style={{ flex: 1, background: ended ? '#16A34A' : INDIGO, border: 'none', color: '#fff', borderRadius: 12, padding: 13, fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
          {ended ? '✓ Xong — gảy lại' : playing ? '⏸ Tạm dừng' : '▶ Phát — gảy theo'}
        </button>
      </div>

      {song.audioUrl && <audio ref={audioRef} src={song.audioUrl} preload="auto" onEnded={() => { setPlaying(false); setEnded(true); onComplete?.() }} />}
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
