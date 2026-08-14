import { useState, useRef, useEffect, useCallback } from 'react'

// ─── Light theme tokens (đồng bộ MobileStudentPortal) ───────────────────────────
const L = {
  bg:       '#F0F2F5',
  surface:  '#FFFFFF',
  surface2: '#F7F8FA',
  border:   '#E8EAF0',
  p1:       '#4338CA',
  p2:       '#EEF2FF',
  p3:       '#C7D2FE',
  a1:       '#EA580C',
  a2:       '#FFF7ED',
  a3:       '#FED7AA',
  t1:       '#111827',
  t2:       '#6B7280',
  t3:       '#9CA3AF',
  green:    '#16A34A',
  shadow:   '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
  shadowLg: '0 12px 34px rgba(67,56,202,0.22)',
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
const AMP     = 27          // biên độ con lắc (độ)

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

  // ── Con lắc: bám đồng hồ audio, cập nhật thẳng DOM (không re-render 60fps) ──────
  const armRef        = useRef<SVGGElement | null>(null)
  const pendAnchorRef = useRef(0)   // thời điểm phách gần nhất
  const pendSignRef   = useRef(1)   // dấu cho khoảng KẾ tiếp
  const pendCurRef    = useRef(1)   // dấu đang dùng

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
      // góc con lắc theo pha giữa 2 phách (cos → chậm ở hai đầu như con lắc thật)
      if (armRef.current) {
        const beatSec = 60 / paramsRef.current.bpm
        const phase = Math.min(1, Math.max(0, (now - pendAnchorRef.current) / beatSec))
        const deg = pendCurRef.current * AMP * Math.cos(phase * Math.PI)
        armRef.current.setAttribute('transform', `rotate(${deg.toFixed(2)} 100 176)`)
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
    flex: 1, border: `1.5px solid ${active ? L.p1 : L.border}`,
    background: active ? L.p1 : L.surface, color: active ? '#fff' : L.t2,
    borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700,
    height: 44, fontSize: 16, transition: 'all .12s', WebkitTapHighlightColor: 'transparent',
    boxShadow: active ? '0 4px 12px rgba(67,56,202,0.28)' : 'none',
  })
  const rowLabel: React.CSSProperties = { width: 44, flexShrink: 0, fontSize: 12, fontWeight: 700, color: L.t3, letterSpacing: '.02em' }
  const roundBtn: React.CSSProperties = {
    width: 46, height: 46, borderRadius: 14, border: `1.5px solid ${L.border}`, background: L.surface,
    color: L.t1, fontSize: 26, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
    WebkitTapHighlightColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: L.shadow,
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, color: L.t1, fontFamily: '"SF Pro Display", system-ui, -apple-system, sans-serif', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'linear-gradient(180deg, #F5F6FB 0%, #ECEEF6 60%, #E7E9F3 100%)' }}>

      {/* Header */}
      <div style={{ background: 'rgba(255,255,255,0.86)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderBottom: `1px solid ${L.border}`, padding: 'max(10px, calc(env(safe-area-inset-top,0px) + 6px)) 16px 10px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        {onClose && (
          <button onClick={onClose} style={{ background: L.p2, border: 'none', borderRadius: 12, minWidth: 40, height: 40, padding: '0 12px', color: L.p1, cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, flexShrink: 0, fontWeight: 700 }}>‹</button>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.01em' }}>Máy đập nhịp</div>
        </div>
        <div style={{ fontSize: 22 }}>🎼</div>
      </div>

      {/* Thân — lấp đầy 1 màn, KHÔNG cuộn */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '8px 16px', gap: 10, maxWidth: 460, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        {/* ── HERO: con lắc + số BPM ── */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>

          <svg viewBox="0 0 200 200" style={{ width: 'min(230px, 58vw)', height: 'auto', flexShrink: 0, display: 'block' }}>
            <defs>
              <linearGradient id="mBody" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#FFFFFF" />
                <stop offset="1" stopColor="#F1F2F8" />
              </linearGradient>
              <linearGradient id="mArm" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#6366F1" />
                <stop offset="1" stopColor="#4338CA" />
              </linearGradient>
              <radialGradient id="mBob" cx="0.35" cy="0.3" r="0.8">
                <stop offset="0" stopColor="#818CF8" />
                <stop offset="1" stopColor="#4338CA" />
              </radialGradient>
              <filter id="mShadow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#4338CA" floodOpacity="0.28" />
              </filter>
            </defs>

            {/* Thân tháp metronome (hình thang bo góc) */}
            <path d="M64 182 L82 30 Q84 20 100 20 Q116 20 118 30 L136 182 Q137 190 128 190 L72 190 Q63 190 64 182 Z"
              fill="url(#mBody)" stroke={L.border} strokeWidth="1.5" />

            {/* Thang chia độ */}
            {Array.from({ length: 7 }).map((_, i) => {
              const y = 54 + i * 18
              const half = 10 + i * 1.4
              return <line key={i} x1={100 - half} y1={y} x2={100 - half + 5} y2={y} stroke={L.p3} strokeWidth="2" strokeLinecap="round" />
            })}

            {/* Cần lắc + quả nặng — nhóm xoay quanh trục (100,176) */}
            <g ref={armRef} style={{ transition: playing ? 'none' : 'transform .4s cubic-bezier(.34,1.3,.5,1)' }}>
              <line x1="100" y1="176" x2="100" y2="44" stroke="url(#mArm)" strokeWidth="6" strokeLinecap="round" />
              <circle cx="100" cy="86" r="13" fill="url(#mBob)" filter="url(#mShadow)" />
              <circle cx="100" cy="86" r="13" fill="none" stroke="#fff" strokeWidth="1.5" opacity="0.5" />
            </g>

            {/* Trục xoay */}
            <circle cx="100" cy="176" r="7" fill="#312E81" />
            <circle cx="100" cy="176" r="3" fill="#C7D2FE" />
          </svg>

          {/* Số BPM */}
          <div style={{ textAlign: 'center', marginTop: -4 }}>
            <div style={{ fontSize: 'min(58px, 15vw)', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.03em', color: L.t1, fontVariantNumeric: 'tabular-nums' }}>{bpm}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: L.t3, letterSpacing: '.14em' }}>BPM</span>
              <span style={{ width: 4, height: 4, borderRadius: 9, background: L.p3 }} />
              <span style={{ fontSize: 12.5, fontWeight: 800, color: L.p1, letterSpacing: '.02em' }}>{tempoName(bpm)}</span>
            </div>
          </div>

          {/* Dải phách */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', minHeight: 16, marginTop: 4 }}>
            {Array.from({ length: sig.top }).map((_, i) => {
              const on = curBeat === i
              const isAccent = i === 0 && accentOn
              return (
                <div key={i} style={{
                  width: on ? 15 : 10, height: on ? 15 : 10, borderRadius: '50%',
                  background: on ? (isAccent ? L.a1 : L.p1) : (isAccent ? L.a3 : L.p3),
                  boxShadow: on ? `0 0 12px ${isAccent ? 'rgba(234,88,12,.6)' : 'rgba(67,56,202,.55)'}` : 'none',
                  opacity: on ? 1 : 0.55, transform: on ? 'scale(1.1)' : 'scale(1)',
                  transition: 'all .1s ease-out',
                }} />
              )
            })}
          </div>
        </div>

        {/* ── Tốc độ ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onPointerDown={() => changeBpm(-1)} style={roundBtn}>−</button>
          <input type="range" min={MIN_BPM} max={MAX_BPM} value={bpm}
            onChange={e => setBpm(parseInt(e.target.value, 10))}
            style={{ flex: 1, accentColor: L.p1, height: 6 }} />
          <button onPointerDown={() => changeBpm(1)} style={roundBtn}>+</button>
        </div>

        {/* ── Loại nhịp ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={rowLabel}>Nhịp</span>
          {TIME_SIGS.map((s, i) => (
            <button key={s.label} onClick={() => setSigIdx(i)} style={chip(i === sigIdx)}>{s.label}</button>
          ))}
        </div>

        {/* ── Chia phách ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={rowLabel}>Chia</span>
          {SUBDIVS.map(s => (
            <button key={s.n} onClick={() => setSubdiv(s.n)} style={{ ...chip(s.n === subdiv), fontSize: 20 }}>{s.label}</button>
          ))}
        </div>

        {/* ── Nhấn phách đầu + Âm lượng ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 46 }}>
          <button onClick={() => setAccentOn(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 8, height: 46, padding: '0 14px', flexShrink: 0,
            border: `1.5px solid ${accentOn ? L.p1 : L.border}`, borderRadius: 14,
            background: accentOn ? L.p2 : L.surface, color: accentOn ? L.p1 : L.t3,
            fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent',
            boxShadow: L.shadow,
          }}>
            <span style={{ fontSize: 16 }}>{accentOn ? '🔔' : '🔕'}</span> Nhấn phách 1
          </button>
          <span style={{ fontSize: 16, flexShrink: 0 }}>🔊</span>
          <input type="range" min={0} max={1} step={0.01} value={volume}
            onChange={e => setVolume(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: L.p1, height: 6 }} />
        </div>
      </div>

      {/* ── Thanh nút cố định dưới ── */}
      <div style={{ flexShrink: 0, display: 'flex', gap: 10, padding: '10px 16px max(12px, env(safe-area-inset-bottom))', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderTop: `1px solid ${L.border}`, maxWidth: 460, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <button onPointerDown={tap} style={{
          width: 78, flexShrink: 0, height: 58, borderRadius: 18, border: `1.5px solid ${L.border}`,
          background: L.surface, color: L.t2, cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
          WebkitTapHighlightColor: 'transparent', boxShadow: L.shadow,
        }}>
          <span style={{ fontSize: 18 }}>👆</span>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Tap dò</span>
        </button>
        <button onClick={toggle} style={{
          flex: 1, height: 58, border: 'none', borderRadius: 18,
          background: playing ? 'linear-gradient(135deg, #F97316, #EA580C)' : 'linear-gradient(135deg, #6366F1, #4338CA)',
          color: '#fff', fontSize: 19, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
          boxShadow: playing ? '0 8px 22px rgba(234,88,12,0.4)' : '0 8px 22px rgba(67,56,202,0.42)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, WebkitTapHighlightColor: 'transparent',
          transition: 'background .2s',
        }}>
          <span style={{ fontSize: 20 }}>{playing ? '⏸' : '▶'}</span>
          {playing ? 'Dừng' : 'Bắt đầu'}
        </button>
      </div>
    </div>
  )
}
