// ── Video ÉP XEM ──────────────────────────────────────────────────────────────
// Phát video tự host (Supabase). KHOÁ TUA (không có thanh kéo) — chỉ đánh dấu
// hoàn thành khi video chạy HẾT. Chống tua nhanh: nếu nhảy quá xa thì kéo về.
import { useEffect, useRef, useState } from 'react'

const INDIGO = '#4338CA'

export interface ForcedVideoCfg { title: string; crumb?: string; videoUrl: string }

export default function ForcedVideo({ cfg, onComplete, onClose }: { cfg: ForcedVideoCfg; onComplete?: () => void; onClose?: () => void }) {
  const vRef = useRef<HTMLVideoElement>(null)
  const watchedRef = useRef(0)        // mốc đã xem tới (giây) — chống tua vượt
  const [dur, setDur] = useState(0)
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const v = vRef.current; if (!v) return
    const onMeta = () => setDur(v.duration || 0)
    const onTime = () => {
      // Chống tua: chỉ cho xem tới mốc đã xem (cộng biên nhỏ)
      if (v.currentTime > watchedRef.current + 1.2) { v.currentTime = watchedRef.current }
      else watchedRef.current = Math.max(watchedRef.current, v.currentTime)
      setT(v.currentTime)
    }
    const onEnded = () => { setPlaying(false); setDone(true); onComplete?.() }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    v.addEventListener('loadedmetadata', onMeta)
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('ended', onEnded)
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    return () => { v.removeEventListener('loadedmetadata', onMeta); v.removeEventListener('timeupdate', onTime); v.removeEventListener('ended', onEnded); v.removeEventListener('play', onPlay); v.removeEventListener('pause', onPause) }
  }, [onComplete])

  const toggle = () => { const v = vRef.current; if (!v) return; v.paused ? v.play() : v.pause() }
  const pct = dur ? Math.min(100, (t / dur) * 100) : 0
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: '#0B0B12', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 10px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,.12)', border: 'none', color: '#fff', borderRadius: 10, width: 34, height: 34, fontSize: 18, cursor: 'pointer' }}>‹</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          {cfg.crumb && <div style={{ fontSize: 10, color: '#9AA0F0', letterSpacing: '.06em', fontWeight: 700 }}>{cfg.crumb}</div>}
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cfg.title}</div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px', minHeight: 0 }} onClick={toggle}>
        <video ref={vRef} src={cfg.videoUrl} playsInline preload="auto" controlsList="nodownload noplaybackrate" disablePictureInPicture
          style={{ width: '100%', maxWidth: 760, maxHeight: '100%', borderRadius: 12, background: '#000', boxShadow: '0 8px 40px rgba(0,0,0,.5)' }} />
      </div>

      <div style={{ padding: '14px 18px calc(env(safe-area-inset-bottom, 0px) + 16px)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={toggle} disabled={done} style={{ background: INDIGO, border: 'none', color: '#fff', borderRadius: '50%', width: 48, height: 48, fontSize: 20, cursor: done ? 'default' : 'pointer', flexShrink: 0, opacity: done ? .6 : 1 }}>{done ? '✓' : playing ? '⏸' : '▶'}</button>
          <div style={{ flex: 1 }}>
            <div style={{ height: 6, background: 'rgba(255,255,255,.15)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: INDIGO, borderRadius: 3 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9AA0B0', marginTop: 5 }}>
              <span>{mmss(t)} / {mmss(dur)}</span>
              <span>{done ? '✓ Đã xem hết' : '🔒 Xem hết mới xong bài'}</span>
            </div>
          </div>
        </div>
        {!playing && !done && t === 0 && (
          <div style={{ textAlign: 'center', fontSize: 12.5, color: '#C7CBF0', marginTop: 10 }}>Bấm ▶ (hoặc chạm vào video) để bắt đầu — hãy xem trọn vẹn.</div>
        )}
        {done && (
          <button onClick={() => { onComplete?.(); onClose?.() }} style={{ width: '100%', marginTop: 12, background: '#16A34A', color: '#fff', border: 'none', borderRadius: 12, padding: 13, fontSize: 15, fontWeight: 700, fontFamily: 'inherit' }}>✓ Hoàn thành — tiếp tục</button>
        )}
      </div>
    </div>
  )
}
