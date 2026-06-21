import { useState, useEffect, useRef } from 'react'

export interface NarratedSlide {
  label: string
  html: string
  end_sec: number
}

export interface NarratedSlideshowCfg {
  audio_url: string
  slides: NarratedSlide[]
  title?: string
}

// Strip deck-engine template syntax (onClick="{{ ... }}", data-pop, v.v.)
function cleanHtml(raw: string): string {
  return raw
    .replace(/onClick="{{[^}]+}}"/g, '')
    .replace(/style-hover="[^"]*"/g, '')
    .replace(/\s*data-(pop|rise|float|glow|slide|str|d)(?:="[^"]*")?/g, '')
}

// Kích thước tham chiếu deck DỌC (portrait ~840px wide)
const REF_W = 840

// Inject font Be Vietnam Pro một lần vào <head> trang chính
let fontInjected = false
function injectFont() {
  if (fontInjected) return
  fontInjected = true
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800;900&display=swap'
  document.head.appendChild(link)
}

// Scale slide HTML vừa container bằng transform (không dùng iframe)
function SlideFrame({ html, bg }: { html: string; bg: string }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.4)

  useEffect(() => { injectFont() }, [])

  useEffect(() => {
    const el = outerRef.current
    if (!el) return
    const update = () => {
      // Scale theo chiều rộng (deck dọc — width là chiều hạn chế)
      const s = el.clientWidth / REF_W
      setScale(s)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Chiều cao hiển thị sau khi scale
  const scaledH = REF_W * scale  // nội dung dọc: height xấp xỉ width (vuông ~ 1:1 mỗi slide)

  return (
    <div ref={outerRef} style={{ width: '100%', height: '100%', overflowY: 'auto', overflowX: 'hidden', background: bg }}>
      {/* Container có chiều cao = nội dung thật sau scale để scroll hoạt động */}
      <div style={{ width: '100%', minHeight: scaledH, position: 'relative' }}>
        <div style={{
          position: 'absolute',
          width: REF_W,
          top: 0,
          left: 0,
          transformOrigin: 'top left',
          transform: `scale(${scale})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Be Vietnam Pro', sans-serif",
          padding: 24,
          boxSizing: 'border-box',
        }}
          dangerouslySetInnerHTML={{ __html: `<style>*{box-sizing:border-box;margin:0;padding:0;}svg{height:auto;}button{pointer-events:none;opacity:.85;}</style>${cleanHtml(html)}` }}
        />
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
export function NarratedSlideshow({
  cfg,
  onComplete,
}: {
  cfg: NarratedSlideshowCfg
  onComplete?: () => void
}) {
  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [autoAdv, setAutoAdv] = useState(true)
  const [elapsed, setElapsed] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)
  const { slides } = cfg
  const slide = slides[current]
  const totalDur = slides[slides.length - 1].end_sec
  const slideStart = (i: number) => (i === 0 ? 0 : slides[i - 1].end_sec)

  // Sync audio → slide index
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => {
      const t = audio.currentTime
      setElapsed(t)
      if (!autoAdv) return
      const idx = slides.findLastIndex((_, i) => t >= slideStart(i))
      if (idx >= 0 && idx !== current) setCurrent(idx)
    }
    const onEnded = () => {
      setPlaying(false)
      onComplete?.()
    }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('ended', onEnded)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAdv, current, slides.length])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.play()
        .then(() => setPlaying(true))
        .catch(() => {
          // iOS: thử resume AudioContext nếu bị suspend
          audio.load()
          audio.play().then(() => setPlaying(true)).catch(console.error)
        })
    }
  }

  const goTo = (i: number) => {
    const clamped = Math.max(0, Math.min(slides.length - 1, i))
    setCurrent(clamped)
    const audio = audioRef.current
    if (audio) audio.currentTime = slideStart(clamped)
  }

  const progress = totalDur > 0 ? Math.min(100, (elapsed / totalDur) * 100) : 0
  const pct = (s: number) => ((s / totalDur) * 100).toFixed(1) + '%'
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  // Background colour for current slide
  const getBg = () => {
    if (slide.html.includes('background:#1C1B19') || slide.html.includes('background: #1C1B19')) return '#1C1B19'
    return '#F6F3EC'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: getBg(), overflow: 'hidden' }}>

      {/* ── Slide iframe ── */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <SlideFrame key={current} html={slide.html} bg={getBg()} />
      </div>

      {/* ── Slide label + counter ── */}
      <div style={{
        textAlign: 'center', fontSize: 11, fontWeight: 700,
        letterSpacing: '0.12em', textTransform: 'uppercase',
        color: getBg() === '#1C1B19' ? '#9A8F7E' : '#9A9082',
        padding: '4px 0 2px',
      }}>
        {slide.label} — {current + 1} / {slides.length}
      </div>

      {/* ── Progress bar (clickable) ── */}
      <div
        style={{ height: 6, background: '#E6D8C2', margin: '0 16px', borderRadius: 3, cursor: 'pointer', position: 'relative' }}
        onClick={e => {
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
          const frac = (e.clientX - rect.left) / rect.width
          const audio = audioRef.current
          if (audio) { audio.currentTime = frac * totalDur; setElapsed(frac * totalDur) }
        }}
      >
        {/* Slide markers */}
        {slides.slice(0, -1).map((s, i) => (
          <div key={i} style={{
            position: 'absolute', top: 0, left: pct(s.end_sec),
            width: 2, height: '100%', background: 'rgba(255,255,255,0.5)',
          }} />
        ))}
        <div style={{
          height: '100%', width: `${progress}%`, background: '#E2673B',
          borderRadius: 3, transition: 'width 0.25s linear',
        }} />
      </div>

      {/* ── Controls ── */}
      <div style={{ padding: '10px 16px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Prev */}
        <button onClick={() => goTo(current - 1)} disabled={current === 0}
          style={{ width: 42, height: 42, border: 'none', borderRadius: '50%', flexShrink: 0,
            background: current === 0 ? '#E6D8C2' : '#1C1B19', color: '#fff', fontSize: 22,
            cursor: current === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ‹
        </button>

        {/* Play/Pause */}
        <button onClick={toggle}
          style={{ flex: 1, height: 48, border: 'none', borderRadius: 24, background: '#E2673B',
            color: '#fff', fontSize: 17, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }}>
          <span style={{ fontSize: 20 }}>{playing ? '⏸' : '▶'}</span>
          <span>{playing ? fmt(elapsed) + ' / ' + fmt(totalDur) : 'Nghe giọng thầy'}</span>
        </button>

        {/* Next */}
        <button onClick={() => goTo(current + 1)} disabled={current === slides.length - 1}
          style={{ width: 42, height: 42, border: 'none', borderRadius: '50%', flexShrink: 0,
            background: current === slides.length - 1 ? '#E6D8C2' : '#1C1B19', color: '#fff', fontSize: 22,
            cursor: current === slides.length - 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ›
        </button>

        {/* Auto-advance toggle */}
        <button onClick={() => setAutoAdv(v => !v)} title={autoAdv ? 'Tự lật: BẬT' : 'Tự lật: TẮT'}
          style={{ width: 42, height: 42, border: `2px solid ${autoAdv ? '#E2673B' : '#CFC8B7'}`,
            borderRadius: '50%', background: 'transparent',
            color: autoAdv ? '#E2673B' : '#9A9082', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
          A
        </button>
      </div>

      {/* ── Dot navigation ── */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, paddingBottom: 12 }}>
        {slides.map((_, i) => (
          <button key={i} onClick={() => goTo(i)}
            style={{ width: i === current ? 22 : 7, height: 7, borderRadius: 4, border: 'none',
              background: i === current ? '#E2673B' : '#CFC8B7', cursor: 'pointer',
              padding: 0, transition: 'width 0.2s' }} />
        ))}
      </div>

      <audio ref={audioRef} src={cfg.audio_url} preload="auto" />
    </div>
  )
}
