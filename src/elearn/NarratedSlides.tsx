// ── Trình chiếu SLIDE NHƯ VIDEO, ÉP NGHE HẾT ──────────────────────────────────
// Ảnh slide chạy theo audio (chia đều hoặc theo mốc end_times). KHOÁ TUA — chỉ
// đánh dấu hoàn thành khi audio chạy hết. Học sinh không thể bỏ qua.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { STAGE, PRACTICE } from './surfaces'

const INDIGO = '#4338CA'

export interface NarratedSlidesCfg {
  title: string
  crumb?: string
  audioUrl: string
  slides: ReactNode[]     // slide JSX (hoặc <img>) — phủ trọn khung 16:9
  endTimes?: number[]     // (tuỳ chọn) giây kết thúc mỗi slide; thiếu → chia đều theo audio
  dim?: boolean           // true → nền TỐI DỊU (tập lâu) thay vì tối đậm
}

export default function NarratedSlides({ cfg, onComplete, onClose }: { cfg: NarratedSlidesCfg; onComplete?: () => void; onClose?: () => void }) {
  const S = cfg.dim ? PRACTICE : STAGE
  const audioRef = useRef<HTMLAudioElement>(null)
  const [dur, setDur] = useState(0)
  const [cur, setCur] = useState(0)
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [done, setDone] = useState(false)
  const N = cfg.slides.length

  // Mốc kết thúc mỗi slide: dùng endTimes nếu có, không thì chia đều theo độ dài audio
  const ends = useMemo(() => {
    if (cfg.endTimes?.length === N) return cfg.endTimes
    if (!dur) return []
    return Array.from({ length: N }, (_, i) => Math.round(((i + 1) * dur) / N))
  }, [cfg.endTimes, dur, N])

  useEffect(() => {
    const a = audioRef.current; if (!a) return
    const onMeta = () => setDur(a.duration || 0)
    const onTime = () => {
      setT(a.currentTime)
      const e = ends.length ? ends : Array.from({ length: N }, (_, i) => ((i + 1) * (a.duration || 1)) / N)
      let idx = e.findIndex(x => a.currentTime < x)
      if (idx < 0) idx = N - 1
      setCur(idx)
    }
    const onEnded = () => { setPlaying(false); setDone(true); setCur(N - 1); onComplete?.() }
    a.addEventListener('loadedmetadata', onMeta)
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('ended', onEnded)
    return () => { a.removeEventListener('loadedmetadata', onMeta); a.removeEventListener('timeupdate', onTime); a.removeEventListener('ended', onEnded) }
  }, [ends, N, onComplete])

  const toggle = () => {
    const a = audioRef.current; if (!a) return
    if (a.paused) { a.play(); setPlaying(true) } else { a.pause(); setPlaying(false) }
  }
  const pct = dur ? Math.min(100, (t / dur) * 100) : 0
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: S.bg, fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 10px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,.12)', border: 'none', color: '#fff', borderRadius: 10, width: 34, height: 34, fontSize: 18, cursor: 'pointer' }}>‹</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cfg.title}</div>
        </div>
        <div style={{ fontSize: 12, color: '#9AA0B0' }}>{cur + 1}/{N}</div>
      </div>

      {/* Slide — lấp đầy màn (dọc/ngang đều được); card tự xếp dọc khi màn dọc */}
      <style>{`@container (max-aspect-ratio: 1/1){.ntd-row{flex-direction:column !important}.ntd-row>*{max-height:none !important}}`}</style>
      <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', justifyContent: 'center', padding: '2px 8px 6px', minHeight: 0 }}>
        <div style={{ width: '100%', maxWidth: 760, background: S.panel, borderRadius: 14, overflow: 'hidden', position: 'relative', containerType: 'size' }}>
          {cfg.slides[cur] ?? <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontSize: 13 }}>Slide {cur + 1}</div>}
        </div>
      </div>

      {/* Thanh điều khiển — KHOÁ TUA (chỉ play/pause), ép nghe hết */}
      <div style={{ padding: '14px 18px calc(env(safe-area-inset-bottom, 0px) + 16px)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={toggle} disabled={done} style={{ background: INDIGO, border: 'none', color: '#fff', borderRadius: '50%', width: 48, height: 48, fontSize: 20, cursor: done ? 'default' : 'pointer', flexShrink: 0, opacity: done ? .6 : 1 }}>{done ? '✓' : playing ? '⏸' : '▶'}</button>
          <div style={{ flex: 1 }}>
            <div style={{ height: 6, background: 'rgba(255,255,255,.15)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: INDIGO, borderRadius: 3 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9AA0B0', marginTop: 5 }}>
              <span>{mmss(t)} / {mmss(dur)}</span>
              <span>{done ? '✓ Đã nghe hết' : '🔒 Nghe hết mới xong bài'}</span>
            </div>
          </div>
        </div>
        {!playing && !done && t === 0 && (
          <div style={{ textAlign: 'center', fontSize: 12.5, color: '#C7CBF0', marginTop: 10 }}>Bấm ▶ để bắt đầu — slide tự chạy theo lời giảng, hãy nghe trọn vẹn.</div>
        )}
        {done && (
          <button onClick={() => { onComplete?.(); onClose?.() }} style={{ width: '100%', marginTop: 12, background: '#16A34A', color: '#fff', border: 'none', borderRadius: 12, padding: 13, fontSize: 15, fontWeight: 700, fontFamily: 'inherit' }}>✓ Hoàn thành — tiếp tục</button>
        )}
      </div>

      <audio ref={audioRef} src={cfg.audioUrl} preload="auto" />
    </div>
  )
}
