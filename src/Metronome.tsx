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
  shadowLg: '0 10px 30px rgba(67,56,202,0.18)',
}

// ─── Ký hiệu tốc độ theo BPM (thuật ngữ âm nhạc) ────────────────────────────────
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

// ─── Nhịp phổ biến ──────────────────────────────────────────────────────────────
const TIME_SIGS = [
  { top: 2, label: '2/4' },
  { top: 3, label: '3/4' },
  { top: 4, label: '4/4' },
  { top: 6, label: '6/8' },
]

// ─── Chia nhỏ phách ─────────────────────────────────────────────────────────────
const SUBDIVS = [
  { n: 1, label: '♩' },
  { n: 2, label: '♫' },
  { n: 3, label: '♩³' },
  { n: 4, label: '♬' },
]

const MIN_BPM = 30
const MAX_BPM = 260

interface Props { onClose?: () => void }

export default function Metronome({ onClose }: Props) {
  const initBpm = (() => {
    const p = new URLSearchParams(window.location.search).get('tempo')
    const n = p ? parseInt(p, 10) : NaN
    return Number.isFinite(n) && n >= MIN_BPM && n <= MAX_BPM ? n : 90
  })()

  const [bpm, setBpm]           = useState(initBpm)
  const [playing, setPlaying]   = useState(false)
  const [sigIdx, setSigIdx]     = useState(2)          // mặc định 4/4
  const [subdiv, setSubdiv]     = useState(1)
  const [volume, setVolume]     = useState(0.8)
  const [accentOn, setAccentOn] = useState(true)
  const [curBeat, setCurBeat]   = useState(-1)          // phách đang sáng (0-based), -1 = chưa chạy

  const sig = TIME_SIGS[sigIdx]

  // ── Web Audio: scheduler nhìn trước (lookahead) cho timing chuẩn xác ──────────
  const ctxRef        = useRef<AudioContext | null>(null)
  const nextTickRef   = useRef(0)
  const tickRef       = useRef(0)
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const queueRef      = useRef<{ beat: number; time: number }[]>([])
  const rafRef        = useRef<number>(0)

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
      const secPerTick = 60 / bpm / subdiv
      nextTickRef.current += secPerTick
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
        q.shift()
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
    tickRef.current    = 0
    nextTickRef.current = ctx.currentTime + 0.06
    queueRef.current   = []
    setCurBeat(-1)
    timerRef.current = setInterval(scheduler, 25)
    rafRef.current   = requestAnimationFrame(visualLoop)
    setPlaying(true)
  }, [scheduler, visualLoop])

  const stop = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    queueRef.current = []
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

  // ── Tap tempo phụ trợ ─────────────────────────────────────────────────────────
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

  // chip chọn (nhịp / chia phách)
  const chip = (active: boolean): React.CSSProperties => ({
    flex: 1, border: `1.5px solid ${active ? L.p1 : L.border}`,
    background: active ? L.p1 : L.surface, color: active ? '#fff' : L.t2,
    borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700,
    height: 42, fontSize: 16, transition: 'all .12s', WebkitTapHighlightColor: 'transparent',
  })
  const rowLabel: React.CSSProperties = { width: 46, flexShrink: 0, fontSize: 12, fontWeight: 700, color: L.t3 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: L.bg, color: L.t1, fontFamily: '"SF Pro Display", system-ui, -apple-system, sans-serif', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ background: L.surface, borderBottom: `1px solid ${L.border}`, padding: 'max(10px, calc(env(safe-area-inset-top,0px) + 6px)) 16px 10px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        {onClose && (
          <button onClick={onClose} style={{ background: L.p2, border: 'none', borderRadius: 10, width: 34, height: 34, color: L.p1, cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>‹</button>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>Máy đập nhịp</div>
        </div>
        <div style={{ fontSize: 22 }}>🎼</div>
      </div>

      {/* Thân — lấp đầy 1 màn, KHÔNG cuộn */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '10px 16px', gap: 10, maxWidth: 460, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        {/* ── HERO: vòng nhịp co giãn theo chiều cao ── */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{
            position: 'relative', width: 'min(190px, 46vw)', aspectRatio: '1', borderRadius: '50%',
            background: L.surface, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: playing ? L.shadowLg : L.shadow, border: `1px solid ${L.border}`, transition: 'box-shadow .2s',
          }}>
            <div style={{
              position: 'absolute', inset: 8, borderRadius: '50%',
              border: `3px solid ${curBeat === 0 ? L.a1 : L.p1}`,
              opacity: playing ? (curBeat >= 0 ? 0.9 : 0.22) : 0.14,
              transform: playing && curBeat >= 0 ? 'scale(1)' : 'scale(0.94)',
              transition: 'transform .09s ease-out, opacity .12s, border-color .05s',
            }} />
            <div style={{ textAlign: 'center', zIndex: 1 }}>
              <div style={{ fontSize: 'min(60px, 15vw)', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{bpm}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: L.t3, letterSpacing: '.1em', marginTop: 2 }}>BPM</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: L.p1, marginTop: 6 }}>{tempoName(bpm)}</div>
            </div>
          </div>

          {/* dải phách */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', minHeight: 16 }}>
            {Array.from({ length: sig.top }).map((_, i) => {
              const on = curBeat === i
              const isAccent = i === 0 && accentOn
              return (
                <div key={i} style={{
                  width: on ? 15 : 11, height: on ? 15 : 11, borderRadius: '50%',
                  background: on ? (isAccent ? L.a1 : L.p1) : (isAccent ? L.a3 : L.p3),
                  opacity: on ? 1 : 0.5, transform: on ? 'scale(1.15)' : 'scale(1)',
                  transition: 'all .09s ease-out',
                }} />
              )
            })}
          </div>
        </div>

        {/* ── Tốc độ: 1 hàng gọn − [slider] + ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onPointerDown={() => changeBpm(-1)} style={{ width: 44, height: 44, borderRadius: 12, border: `1.5px solid ${L.border}`, background: L.surface, color: L.t1, fontSize: 26, fontWeight: 700, cursor: 'pointer', flexShrink: 0, WebkitTapHighlightColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
          <input type="range" min={MIN_BPM} max={MAX_BPM} value={bpm}
            onChange={e => setBpm(parseInt(e.target.value, 10))}
            style={{ flex: 1, accentColor: L.p1, height: 6 }} />
          <button onPointerDown={() => changeBpm(1)} style={{ width: 44, height: 44, borderRadius: 12, border: `1.5px solid ${L.border}`, background: L.surface, color: L.t1, fontSize: 26, fontWeight: 700, cursor: 'pointer', flexShrink: 0, WebkitTapHighlightColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
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

        {/* ── Nhấn phách đầu + Âm lượng (1 hàng) ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 44 }}>
          <button onClick={() => setAccentOn(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 12px', flexShrink: 0,
            border: `1.5px solid ${accentOn ? L.p1 : L.border}`, borderRadius: 12,
            background: accentOn ? L.p2 : L.surface, color: accentOn ? L.p1 : L.t3,
            fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent',
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
      <div style={{ flexShrink: 0, display: 'flex', gap: 10, padding: '10px 16px max(12px, env(safe-area-inset-bottom))', background: L.surface, borderTop: `1px solid ${L.border}`, maxWidth: 460, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <button onPointerDown={tap} style={{
          width: 78, flexShrink: 0, height: 56, borderRadius: 16, border: `1.5px solid ${L.border}`,
          background: L.surface, color: L.t2, cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
          WebkitTapHighlightColor: 'transparent',
        }}>
          <span style={{ fontSize: 18 }}>👆</span>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Tap dò</span>
        </button>
        <button onClick={toggle} style={{
          flex: 1, height: 56, border: 'none', borderRadius: 16,
          background: playing ? L.a1 : L.p1, color: '#fff', fontSize: 19, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
          boxShadow: playing ? '0 6px 20px rgba(234,88,12,0.35)' : '0 6px 20px rgba(67,56,202,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, WebkitTapHighlightColor: 'transparent',
        }}>
          <span style={{ fontSize: 20 }}>{playing ? '⏸' : '▶'}</span>
          {playing ? 'Dừng' : 'Bắt đầu'}
        </button>
      </div>
    </div>
  )
}
