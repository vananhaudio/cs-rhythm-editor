import { useState, useEffect, useRef, useCallback } from 'react'

export interface NarratedSlideshowCfg {
  audio_url: string
  sections: string[]   // full <section ...>...</section> HTML mỗi slide
  helmet: string       // CSS từ <helmet> của deck
  end_times: number[]  // mốc giây kết thúc mỗi slide (VD: [11.5, 22.4, ...])
  title?: string
}

// ── Iframe chứa deck-stage gốc ─────────────────────────────────────────────
function DeckIframe({
  cfg,
  targetSlide,
  onSlideChange,
}: {
  cfg: NarratedSlideshowCfg
  targetSlide: number
  onSlideChange: (i: number) => void
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  // Build srcdoc một lần — toàn bộ deck HTML với deck-stage.js từ /public
  const srcdoc = `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    ${cfg.helmet}
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{overflow:hidden;background:#F6F3EC;}
      deck-stage:not(:defined){visibility:hidden;}
      deck-stage{display:block;width:100vw;height:100vh;}
    </style>
    <script src="${origin}/deck-stage.js"><\/script>
  </head><body>
    <deck-stage width="1080" height="1920" no-rail no-overlay>
      ${cfg.sections.join('\n')}
    </deck-stage>
    <script>
      // Relay slideIndexChanged từ deck-stage về parent
      window.addEventListener('message', function(e){
        if(e.data && e.data.slideIndexChanged !== undefined){
          window.parent.postMessage({slideIndexChanged: e.data.slideIndexChanged}, '*');
        }
      });
    </script>
  </body></html>`

  // Khi targetSlide thay đổi → điều khiển deck
  useEffect(() => {
    if (!ready) return
    const deck = iframeRef.current?.contentDocument?.querySelector('deck-stage') as any
    if (deck?.goTo) deck.goTo(targetSlide)
  }, [targetSlide, ready])

  // Nhận thông báo từ deck khi người dùng tự chuyển slide (tap trái/phải)
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.slideIndexChanged !== undefined) {
        onSlideChange(e.data.slideIndexChanged)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [onSlideChange])

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcdoc}
      onLoad={() => setReady(true)}
      style={{ width: '100%', height: '100%', border: 'none' }}
      title="deck"
      allow="autoplay"
    />
  )
}

// ── Main player ────────────────────────────────────────────────────────────
export function NarratedSlideshow({
  cfg,
  onComplete,
}: {
  cfg: NarratedSlideshowCfg
  onComplete?: () => void
}) {
  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  const totalDur = cfg.end_times[cfg.end_times.length - 1]
  const slideStart = useCallback(
    (i: number) => (i === 0 ? 0 : cfg.end_times[i - 1]),
    [cfg.end_times]
  )

  // Audio → deck: auto-advance slide theo thời gian
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => {
      const t = audio.currentTime
      setElapsed(t)
      const idx = cfg.end_times.findLastIndex((_, i) => t >= slideStart(i))
      if (idx >= 0 && idx !== current) setCurrent(idx)
    }
    const onEnded = () => { setPlaying(false); onComplete?.() }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('ended', onEnded)
    }
  }, [current, cfg.end_times, slideStart, onComplete])

  // Deck → audio: người dùng tự tap chuyển slide → seek audio
  const handleDeckSlideChange = useCallback((i: number) => {
    setCurrent(i)
    const audio = audioRef.current
    if (audio) audio.currentTime = slideStart(i)
  }, [slideStart])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) { audio.pause(); setPlaying(false) }
    else { audio.play().then(() => setPlaying(true)).catch(console.error) }
  }

  const goTo = (i: number) => {
    const clamped = Math.max(0, Math.min(cfg.sections.length - 1, i))
    setCurrent(clamped)
    const audio = audioRef.current
    if (audio) audio.currentTime = slideStart(clamped)
  }

  const progress = totalDur > 0 ? Math.min(100, (elapsed / totalDur) * 100) : 0
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  const label = (() => {
    const m = cfg.sections[current]?.match(/data-label="([^"]+)"/)
    return m ? m[1] : `Slide ${current + 1}`
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F6F3EC', overflow: 'hidden' }}>

      {/* Deck iframe — chiếm toàn bộ phần trên */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <DeckIframe cfg={cfg} targetSlide={current} onSlideChange={handleDeckSlideChange} />
      </div>

      {/* Label + counter */}
      <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9A9082', padding: '4px 0 2px', flexShrink: 0 }}>
        {label} — {current + 1} / {cfg.sections.length}
      </div>

      {/* Progress bar */}
      <div
        style={{ height: 5, background: '#E6D8C2', margin: '0 16px', borderRadius: 3, cursor: 'pointer', position: 'relative', flexShrink: 0 }}
        onClick={e => {
          const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
          const t = ((e.clientX - r.left) / r.width) * totalDur
          const audio = audioRef.current
          if (audio) { audio.currentTime = t; setElapsed(t) }
        }}
      >
        {cfg.end_times.slice(0, -1).map((s, i) => (
          <div key={i} style={{ position: 'absolute', top: 0, left: `${(s / totalDur) * 100}%`, width: 2, height: '100%', background: 'rgba(255,255,255,0.6)' }} />
        ))}
        <div style={{ height: '100%', width: `${progress}%`, background: '#E2673B', borderRadius: 3, transition: 'width 0.2s linear' }} />
      </div>

      {/* Controls */}
      <div style={{ padding: '8px 16px 10px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={() => goTo(current - 1)} disabled={current === 0}
          style={{ width: 40, height: 40, border: 'none', borderRadius: '50%', flexShrink: 0, background: current === 0 ? '#E6D8C2' : '#1C1B19', color: '#fff', fontSize: 20, cursor: current === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ‹
        </button>

        <button onClick={toggle}
          style={{ flex: 1, height: 46, border: 'none', borderRadius: 23, background: '#E2673B', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }}>
          <span style={{ fontSize: 18 }}>{playing ? '⏸' : '▶'}</span>
          <span>{playing ? `${fmt(elapsed)} / ${fmt(totalDur)}` : 'Nghe giọng thầy'}</span>
        </button>

        <button onClick={() => goTo(current + 1)} disabled={current === cfg.sections.length - 1}
          style={{ width: 40, height: 40, border: 'none', borderRadius: '50%', flexShrink: 0, background: current === cfg.sections.length - 1 ? '#E6D8C2' : '#1C1B19', color: '#fff', fontSize: 20, cursor: current === cfg.sections.length - 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ›
        </button>
      </div>

      {/* Dot nav */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 5, paddingBottom: 10, flexShrink: 0 }}>
        {cfg.sections.map((_, i) => (
          <button key={i} onClick={() => goTo(i)}
            style={{ width: i === current ? 20 : 7, height: 7, borderRadius: 4, border: 'none', background: i === current ? '#E2673B' : '#CFC8B7', cursor: 'pointer', padding: 0, transition: 'width 0.2s' }} />
        ))}
      </div>

      <audio ref={audioRef} src={cfg.audio_url} preload="metadata" />
    </div>
  )
}
