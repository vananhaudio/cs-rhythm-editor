import { useState, useRef, useEffect, useCallback } from 'react'

// ─── Palette tinh tế (indigo dịu + trung tính ấm) ───────────────────────────────
const C = {
  bg1: '#FAFAFC', bg2: '#EFEFF4',
  card: '#FFFFFF',
  ink:  '#26243A',   // số & chữ đậm (slate ấm, không đen gắt)
  sub:  '#8B8B9E',   // nhãn phụ
  faint:'#C3C3CF',
  line: '#ECEDF2',
  ind:  '#4F46E5', indDeep: '#3F37C9', indSoft: '#EEF0FC', indPale: '#DDE0F6',
  acc:  '#EA580C', accSoft: '#FFF4EC', accPale: '#F6D6BE',
  shadow:    '0 1px 2px rgba(30,27,60,.05), 0 6px 18px rgba(30,27,60,.05)',
  shadowCard:'0 2px 10px rgba(48,44,110,.05), 0 18px 44px rgba(48,44,110,.09)',
}

function tempoName(bpm: number): string {
  if (bpm < 60)  return 'Largo'
  if (bpm < 66)  return 'Larghetto'
  if (bpm < 76)  return 'Adagio'
  if (bpm < 108) return 'Andante'
  if (bpm < 120) return 'Moderato'
  if (bpm < 156) return 'Allegro'
  if (bpm < 176) return 'Vivace'
  if (bpm < 200) return 'Presto'
  return 'Prestissimo'
}

const TIME_SIGS = [
  { top: 2, label: '2/4' },
  { top: 3, label: '3/4' },
  { top: 4, label: '4/4' },
  { top: 6, label: '6/8' },
]
const SUBDIVS = [
  { n: 1, label: '♩' },
  { n: 2, label: '♫' },
  { n: 3, label: '♩³' },
  { n: 4, label: '♬' },
]

const MIN_BPM = 30
const MAX_BPM = 260
const AMP     = 26

interface Props { onClose?: () => void; initialBpm?: number | null }

export default function Metronome({ onClose, initialBpm }: Props) {
  const startBpm = (() => {
    if (initialBpm && initialBpm >= MIN_BPM && initialBpm <= MAX_BPM) return initialBpm
    const p = new URLSearchParams(window.location.search).get('tempo')
    const n = p ? parseInt(p, 10) : NaN
    return Number.isFinite(n) && n >= MIN_BPM && n <= MAX_BPM ? n : 90
  })()

  const [bpm, setBpm]           = useState(startBpm)
  const [playing, setPlaying]   = useState(false)
  const [sigIdx, setSigIdx]     = useState(2)
  const [subdiv, setSubdiv]     = useState(1)
  const [volume, setVolume]     = useState(0.8)
  const [accentOn, setAccentOn] = useState(true)
  const [curBeat, setCurBeat]   = useState(-1)

  const sig = TIME_SIGS[sigIdx]

  // ── Web Audio scheduler ───────────────────────────────────────────────────────
  const ctxRef      = useRef<AudioContext | null>(null)
  const nextTickRef = useRef(0)
  const tickRef     = useRef(0)
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const queueRef    = useRef<{ beat: number; time: number }[]>([])
  const rafRef      = useRef<number>(0)

  // ── Con lắc + quầng sáng: bám đồng hồ audio, cập nhật thẳng DOM ────────────────
  const armRef        = useRef<SVGGElement | null>(null)
  const glowRef       = useRef<HTMLDivElement | null>(null)
  const pendAnchorRef = useRef(0)
  const pendSignRef   = useRef(1)
  const pendCurRef    = useRef(1)

  const paramsRef = useRef({ bpm, beats: sig.top, subdiv, volume, accentOn })
  useEffect(() => {
    paramsRef.current = { bpm, beats: sig.top, subdiv, volume, accentOn }
  }, [bpm, sig.top, subdiv, volume, accentOn])

  const playClick = useCallback((time: number, kind: 'accent' | 'beat' | 'sub') => {
    const ctx = ctxRef.current
    if (!ctx) return
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    const vol  = paramsRef.current.volume
    let freq = 900, peak = 0.55 * vol
    if (kind === 'accent') { freq = 1600; peak = 1.0 * vol }
    else if (kind === 'sub') { freq = 760; peak = 0.28 * vol }
    osc.frequency.value = freq
    osc.type = 'square'
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.001)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06)
    osc.connect(gain); gain.connect(ctx.destination)
    osc.start(time)
    osc.stop(time + 0.07)
  }, [])

  const scheduler = useCallback(() => {
    const ctx = ctxRef.current
    if (!ctx) return
    const SCHEDULE_AHEAD = 0.12
    while (nextTickRef.current < ctx.currentTime + SCHEDULE_AHEAD) {
      const { bpm, beats, subdiv, accentOn } = paramsRef.current
      const totalTicks = beats * subdiv
      const tick   = tickRef.current
      const isBeat = tick % subdiv === 0
      const beat   = Math.floor(tick / subdiv)
      const kind: 'accent' | 'beat' | 'sub' =
        isBeat ? (beat === 0 && accentOn ? 'accent' : 'beat') : 'sub'
      playClick(nextTickRef.current, kind)
      if (isBeat) queueRef.current.push({ beat, time: nextTickRef.current })
      nextTickRef.current += 60 / bpm / subdiv
      tickRef.current = (tick + 1) % totalTicks
    }
  }, [playClick])

  const visualLoop = useCallback(() => {
    const ctx = ctxRef.current
    if (ctx) {
      const now = ctx.currentTime
      const q = queueRef.current
      while (q.length && q[0].time <= now) {
        setCurBeat(q[0].beat)
        pendAnchorRef.current = q[0].time
        pendCurRef.current    = pendSignRef.current
        pendSignRef.current   = -pendSignRef.current
        q.shift()
      }
      const beatSec = 60 / paramsRef.current.bpm
      if (armRef.current) {
        const phase = Math.min(1, Math.max(0, (now - pendAnchorRef.current) / beatSec))
        const deg = pendCurRef.current * AMP * Math.cos(phase * Math.PI)
        armRef.current.setAttribute('transform', `rotate(${deg.toFixed(2)} 100 176)`)
      }
      if (glowRef.current) {
        const since = now - pendAnchorRef.current
        const g = Math.max(0, 1 - since / 0.22)
        glowRef.current.style.opacity = String(g * 0.55)
      }
    }
    rafRef.current = requestAnimationFrame(visualLoop)
  }, [])

  const start = useCallback(async () => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || (window as any).webkitAudioContext
      ctxRef.current = new AC()
    }
    const ctx = ctxRef.current!
    if (ctx.state === 'suspended') await ctx.resume()
    if (timerRef.current) clearInterval(timerRef.current)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    tickRef.current     = 0
    nextTickRef.current = ctx.currentTime + 0.06
    queueRef.current    = []
    pendAnchorRef.current = nextTickRef.current
    pendSignRef.current   = 1
    pendCurRef.current    = 1
    setCurBeat(-1)
    timerRef.current = setInterval(scheduler, 25)
    rafRef.current   = requestAnimationFrame(visualLoop)
    setPlaying(true)
  }, [scheduler, visualLoop])

  const stop = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    queueRef.current = []
    if (armRef.current) armRef.current.setAttribute('transform', 'rotate(0 100 176)')
    if (glowRef.current) glowRef.current.style.opacity = '0'
    setPlaying(false)
    setCurBeat(-1)
  }, [])

  const toggle = () => { playing ? stop() : start() }

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    ctxRef.current?.close()
  }, [])

  const changeBpm = (d: number) => setBpm(b => Math.min(MAX_BPM, Math.max(MIN_BPM, b + d)))

  const tapTimesRef = useRef<number[]>([])
  const tapTORef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tap = () => {
    const now = performance.now()
    const arr = tapTimesRef.current
    if (arr.length && now - arr[arr.length - 1] > 2500) arr.length = 0
    arr.push(now)
    if (arr.length >= 2) {
      const diffs = arr.slice(1).map((v, i) => v - arr[i])
      const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length
      setBpm(Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(60000 / avg))))
    }
    if (tapTORef.current) clearTimeout(tapTORef.current)
    tapTORef.current = setTimeout(() => { tapTimesRef.current = [] }, 2500)
  }

  const chip = (active: boolean): React.CSSProperties => ({
    flex: 1, border: `1px solid ${active ? C.ind : C.line}`,
    background: active ? C.ind : C.card, color: active ? '#fff' : C.sub,
    borderRadius: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700,
    height: 46, fontSize: 16, transition: 'all .14s ease', WebkitTapHighlightColor: 'transparent',
    boxShadow: active ? '0 5px 14px rgba(79,70,229,0.26)' : 'none',
  })
  const rowLabel: React.CSSProperties = { width: 40, flexShrink: 0, fontSize: 11, fontWeight: 800, color: C.faint, letterSpacing: '.08em', textTransform: 'uppercase' }
  const roundBtn: React.CSSProperties = {
    width: 48, height: 48, borderRadius: 15, border: `1px solid ${C.line}`, background: C.card,
    color: C.ink, fontSize: 26, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
    WebkitTapHighlightColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: C.shadow,
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, color: C.ink, fontFamily: '"SF Pro Display", system-ui, -apple-system, sans-serif', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: `linear-gradient(180deg, ${C.bg1} 0%, ${C.bg2} 100%)` }}>

      {/* Header */}
      <div style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: `1px solid ${C.line}`, padding: 'max(10px, calc(env(safe-area-inset-top,0px) + 6px)) 16px 11px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        {onClose && (
          <button onClick={onClose} style={{ background: C.indSoft, border: 'none', borderRadius: 12, minWidth: 40, height: 40, padding: '0 12px', color: C.ind, cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700 }}>‹</button>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.01em' }}>Máy đập nhịp</div>
        </div>
        <div style={{ fontSize: 21, opacity: 0.85 }}>🎼</div>
      </div>

      {/* Thân — 1 màn, KHÔNG cuộn. Tỉ lệ: hero card ~ phần lớn, controls gọn dưới */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '14px 16px 12px', gap: 14, maxWidth: 440, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        {/* ── HERO CARD ── */}
        <div style={{ flex: 1, minHeight: 0, background: `linear-gradient(165deg, #FFFFFF 0%, #F7F7FB 100%)`, borderRadius: 26, border: `1px solid ${C.line}`, boxShadow: C.shadowCard,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '18px 16px', position: 'relative', overflow: 'hidden' }}>

          {/* quầng sáng dịu đập theo phách */}
          <div ref={glowRef} style={{ position: 'absolute', top: '30%', width: 'min(260px, 70%)', aspectRatio: '1', borderRadius: '50%',
            background: `radial-gradient(circle, ${curBeat === 0 && accentOn ? 'rgba(234,88,12,.5)' : 'rgba(79,70,229,.45)'} 0%, transparent 70%)`,
            filter: 'blur(14px)', opacity: 0, transform: 'translateY(-50%)', transition: 'background .1s', pointerEvents: 'none' }} />

          {/* Con lắc */}
          <svg viewBox="0 0 200 200" style={{ width: 'min(224px, 56vw)', height: 'auto', flexShrink: 1, minHeight: 0, display: 'block', position: 'relative' }}>
            <defs>
              <linearGradient id="mBody" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#FFFFFF" />
                <stop offset="1" stopColor="#F0F0F6" />
              </linearGradient>
              <linearGradient id="mArm" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#8C8AF0" />
                <stop offset="1" stopColor="#4F46E5" />
              </linearGradient>
              <radialGradient id="mBob" cx="0.36" cy="0.3" r="0.85">
                <stop offset="0" stopColor="#B7BAFA" />
                <stop offset="0.5" stopColor="#6D66EC" />
                <stop offset="1" stopColor="#4239C4" />
              </radialGradient>
              <filter id="mShadow" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#4F46E5" floodOpacity="0.24" />
              </filter>
            </defs>

            {/* Thân tháp hình thang bo góc */}
            <path d="M66 182 L83 32 Q85 22 100 22 Q115 22 117 32 L134 182 Q135 190 127 190 L73 190 Q65 190 66 182 Z"
              fill="url(#mBody)" stroke={C.line} strokeWidth="1.5" />

            {/* Thang chia độ (dịu) */}
            {Array.from({ length: 7 }).map((_, i) => {
              const y = 56 + i * 17.5
              const half = 9 + i * 1.3
              return <line key={i} x1={100 - half} y1={y} x2={100 - half + 5} y2={y} stroke={C.indPale} strokeWidth="2" strokeLinecap="round" />
            })}

            {/* Cần + quả nặng */}
            <g ref={armRef} style={{ transition: playing ? 'none' : 'transform .45s cubic-bezier(.34,1.25,.5,1)' }}>
              <line x1="100" y1="176" x2="100" y2="46" stroke="url(#mArm)" strokeWidth="5.5" strokeLinecap="round" />
              <circle cx="100" cy="88" r="12.5" fill="url(#mBob)" filter="url(#mShadow)" />
              <circle cx="96" cy="84" r="3.4" fill="#fff" opacity="0.55" />
            </g>

            {/* Trục */}
            <circle cx="100" cy="176" r="6.5" fill="#2E2A5A" />
            <circle cx="100" cy="176" r="2.6" fill="#C7D2FE" />
          </svg>

          {/* Số BPM */}
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 'min(56px, 14.5vw)', fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em', color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{bpm}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 7 }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: C.faint, letterSpacing: '.16em' }}>BPM</span>
              <span style={{ width: 3, height: 3, borderRadius: 9, background: C.faint }} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: C.ind, letterSpacing: '.01em' }}>{tempoName(bpm)}</span>
            </div>
          </div>

          {/* Dải phách */}
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', justifyContent: 'center', minHeight: 14, flexShrink: 0 }}>
            {Array.from({ length: sig.top }).map((_, i) => {
              const on = curBeat === i
              const isAccent = i === 0 && accentOn
              return (
                <div key={i} style={{
                  width: on ? 13 : 9, height: on ? 13 : 9, borderRadius: '50%',
                  background: on ? (isAccent ? C.acc : C.ind) : (isAccent ? C.accPale : C.indPale),
                  boxShadow: on ? `0 0 12px ${isAccent ? 'rgba(234,88,12,.55)' : 'rgba(79,70,229,.5)'}` : 'none',
                  opacity: on ? 1 : 0.7, transform: on ? 'scale(1.08)' : 'scale(1)',
                  transition: 'all .1s ease-out',
                }} />
              )
            })}
          </div>
        </div>

        {/* ── Tốc độ ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button onPointerDown={() => changeBpm(-1)} style={roundBtn}>−</button>
          <input type="range" min={MIN_BPM} max={MAX_BPM} value={bpm}
            onChange={e => setBpm(parseInt(e.target.value, 10))}
            style={{ flex: 1, accentColor: C.ind, height: 5 }} />
          <button onPointerDown={() => changeBpm(1)} style={roundBtn}>+</button>
        </div>

        {/* ── Loại nhịp ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={rowLabel}>Nhịp</span>
          {TIME_SIGS.map((s, i) => (
            <button key={s.label} onClick={() => setSigIdx(i)} style={chip(i === sigIdx)}>{s.label}</button>
          ))}
        </div>

        {/* ── Chia phách ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={rowLabel}>Chia</span>
          {SUBDIVS.map(s => (
            <button key={s.n} onClick={() => setSubdiv(s.n)} style={{ ...chip(s.n === subdiv), fontSize: 20 }}>{s.label}</button>
          ))}
        </div>

        {/* ── Nhấn phách đầu + Âm lượng ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 48, flexShrink: 0 }}>
          <button onClick={() => setAccentOn(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 8, height: 48, padding: '0 14px', flexShrink: 0,
            border: `1px solid ${accentOn ? C.ind : C.line}`, borderRadius: 15,
            background: accentOn ? C.indSoft : C.card, color: accentOn ? C.ind : C.sub,
            fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent',
            boxShadow: C.shadow,
          }}>
            <span style={{ fontSize: 15 }}>{accentOn ? '🔔' : '🔕'}</span> Phách 1
          </button>
          <span style={{ fontSize: 15, flexShrink: 0, opacity: 0.7 }}>🔊</span>
          <input type="range" min={0} max={1} step={0.01} value={volume}
            onChange={e => setVolume(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: C.ind, height: 5 }} />
        </div>
      </div>

      {/* ── Thanh nút cố định dưới ── */}
      <div style={{ flexShrink: 0, display: 'flex', gap: 10, padding: '10px 16px max(12px, env(safe-area-inset-bottom))', background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderTop: `1px solid ${C.line}`, maxWidth: 440, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <button onPointerDown={tap} style={{
          width: 76, flexShrink: 0, height: 56, borderRadius: 18, border: `1px solid ${C.line}`,
          background: C.card, color: C.sub, cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
          WebkitTapHighlightColor: 'transparent', boxShadow: C.shadow,
        }}>
          <span style={{ fontSize: 17 }}>👆</span>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Tap dò</span>
        </button>
        <button onClick={toggle} style={{
          flex: 1, height: 56, border: 'none', borderRadius: 18,
          background: playing ? `linear-gradient(135deg, #FB923C 0%, ${C.acc} 100%)` : `linear-gradient(135deg, #6D66EC 0%, ${C.indDeep} 100%)`,
          color: '#fff', fontSize: 18, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
          boxShadow: playing ? '0 8px 22px rgba(234,88,12,0.36)' : '0 8px 22px rgba(79,70,229,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, WebkitTapHighlightColor: 'transparent',
          transition: 'background .2s', letterSpacing: '.01em',
        }}>
          <span style={{ fontSize: 19 }}>{playing ? '⏸' : '▶'}</span>
          {playing ? 'Dừng' : 'Bắt đầu'}
        </button>
      </div>
    </div>
  )
}
