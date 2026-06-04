import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { fitTempo, beatToTime, timeToBeat } from './logic/tempoFit'
import type { TempoFit } from './logic/tempoFit'
import { splitWords, computeMapping, makeAnchor } from './logic/songBuilder'
import type { Word, Anchor, MappedWord } from './logic/songBuilder'

/* =========================================================================
   SONG BUILDER V1 — biến bài YouTube thành dữ liệu luyện nhịp.
   Trục chuẩn = một lưới beat đều (fitTempo). 1 tap = 1 beat; tick = beat*480.
   Giai đoạn: 1 Tap nhịp · 2 Chọn phách mạnh · 3 Gắn mốc + nội suy · 4 Nghe thử.
   ⛔ Giai đoạn 5 (Xuất) KHÓA — chờ chốt schema v2.1.
   ========================================================================= */

const C = {
  bg: '#0B0E14', surface: '#131823', surface2: '#1A2030', border: 'rgba(255,255,255,0.09)',
  text: '#E6EAF2', muted: '#8A93A6', dim: 'rgba(255,255,255,0.30)',
  accent: '#6C63FF', accentSoft: 'rgba(108,99,255,0.16)',
  cyan: '#22D3EE', cyanSoft: 'rgba(34,211,238,0.14)',
  amber: '#F59E0B', red: '#F43F5E', green: '#22C55E',
}
const FONT = `'Be Vietnam Pro',system-ui,sans-serif`
const MONO = `'JetBrains Mono','Space Mono',monospace`
const DRAFT_KEY = 'csre-song-builder-draft-v1'
const YT_API_KEY = 'AIzaSyA6kg3G2CVZ7b_x8IAlkZJCOa4AJHyWHms'

const STEPS = ['Chuẩn bị', 'Nhịp', 'Phách', 'Gắn mốc', 'Nghe thử', 'Xuất'] as const

interface YTResult { id: string; title: string; channel: string; thumbnail: string }

function extractVideoId(url: string): string | null {
  const ps = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const p of ps) { const m = url.match(p); if (m) return m[1] }
  return null
}
const buildEmbedUrl = (id: string) =>
  `https://www.youtube.com/embed/${id}?${new URLSearchParams({ enablejsapi: '1', controls: '1', rel: '0', modestbranding: '1', playsinline: '1' })}`
const fmt = (s: number) => {
  if (!isFinite(s)) return '0:00'
  const m = Math.floor(Math.abs(s) / 60), sec = Math.floor(Math.abs(s) % 60)
  return `${s < 0 ? '-' : ''}${m}:${String(sec).padStart(2, '0')}`
}

/* ---------- draft ---------- */
interface Draft {
  youtubeUrl: string; lyricsText: string; fit: TempoFit | null
  timeSignature: number; downbeatPosition: number; anchors: Anchor[]; step: number
}
function loadDraft(): Draft | null {
  try { const r = localStorage.getItem(DRAFT_KEY); return r ? JSON.parse(r) as Draft : null } catch { return null }
}

/* ---------- atoms ---------- */
function Btn({ children, onClick, kind = 'solid', disabled, style, ...rest }: {
  children: React.ReactNode; onClick?: () => void; kind?: 'solid' | 'ghost' | 'soft'
  disabled?: boolean; style?: React.CSSProperties
} & React.HTMLAttributes<HTMLButtonElement>) {
  const base: React.CSSProperties = {
    border: 'none', borderRadius: 12, cursor: disabled ? 'default' : 'pointer', fontFamily: FONT,
    fontWeight: 700, fontSize: 14, padding: '12px 18px', opacity: disabled ? 0.4 : 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, userSelect: 'none',
  }
  const skin: React.CSSProperties =
    kind === 'solid' ? { background: C.accent, color: '#fff' }
    : kind === 'soft' ? { background: C.accentSoft, color: C.accent, border: `1px solid ${C.accent}44` }
    : { background: 'transparent', color: C.muted, border: `1px solid ${C.border}` }
  return <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{ ...base, ...skin, ...style }} {...rest}>{children}</button>
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 12px', flex: 1, minWidth: 0 }}>
      <div style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 18, color: color || C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      {sub && <div style={{ color: C.dim, fontSize: 10, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
      {title && <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, marginBottom: 12 }}>{title}</div>}
      {children}
    </div>
  )
}

/* lời bài hát theo từng dòng, tô màu theo source */
function LyricBlock({ words, mapping, activeIndex, onTap, picker }: {
  words: Word[]; mapping: MappedWord[]; activeIndex?: number
  onTap?: (w: Word, m: MappedWord) => void; picker?: boolean
}) {
  const byIndex = new Map(mapping.map(m => [m.index, m]))
  const lines: Word[][] = []
  for (const w of words) { (lines[w.line] ??= []).push(w) }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {lines.map((lw, li) => (
        <div key={li} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {lw.map(w => {
            const m = byIndex.get(w.index)!
            const isActive = activeIndex === w.index
            let bg = 'transparent', col = C.dim, bd = C.border, weight = 500
            if (m.source === 'anchor') { bg = C.accent; col = '#fff'; bd = C.accent; weight = 700 }
            else if (m.source === 'interpolated') { col = C.cyan; bd = `${C.cyan}55`; bg = C.cyanSoft }
            if (isActive) { bg = C.amber; col = '#1a1200'; bd = C.amber; weight = 800 }
            return (
              <button key={w.index} onClick={onTap ? () => onTap(w, m) : undefined}
                style={{
                  fontFamily: FONT, fontSize: 15, fontWeight: weight, padding: '6px 11px', borderRadius: 9,
                  border: `1px solid ${bd}`, background: bg, color: col, cursor: onTap ? 'pointer' : 'default',
                  transition: 'all 0.12s', position: 'relative',
                  boxShadow: isActive ? `0 0 14px ${C.amber}66` : (picker && m.source === 'anchor' ? `0 0 0 2px ${C.accent}55` : 'none'),
                }}>
                {w.text}
                {m.source === 'anchor' && m.beatPosition != null &&
                  <span style={{ fontFamily: MONO, fontSize: 9, opacity: 0.8, marginLeft: 5 }}>·{m.beatPosition}</span>}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/* ============================ PAGE ============================ */
export default function SongBuilderPage({ onClose }: { onClose?: () => void }) {
  const draft = useMemo(() => loadDraft(), [])

  const [step, setStep] = useState(draft?.step ?? 0)
  const [youtubeUrl, setYoutubeUrl] = useState(draft?.youtubeUrl ?? '')
  const [videoId, setVideoId] = useState<string | null>(draft?.youtubeUrl ? extractVideoId(draft.youtubeUrl) : null)
  const [lyricsText, setLyricsText] = useState(draft?.lyricsText ?? '')
  const [fit, setFit] = useState<TempoFit | null>(draft?.fit ?? null)
  const [timeSignature, setTimeSignature] = useState(draft?.timeSignature ?? 4)
  const [downbeatPosition, setDownbeatPosition] = useState(draft?.downbeatPosition ?? 1)
  const [anchors, setAnchors] = useState<Anchor[]>(draft?.anchors ?? [])

  const [tapTimes, setTapTimes] = useState<number[]>([])
  const [playerReady, setPlayerReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [videoTime, setVideoTime] = useState(0)
  const [pendingBeat, setPendingBeat] = useState<{ beatIndex: number; time: number } | null>(null)
  const [metronomeOn, setMetronomeOn] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const playingRef = useRef(false)
  const anchorWallRef = useRef(0)   // performance.now() ms tại mốc đồng bộ
  const anchorVideoRef = useRef(0)  // giây video tại mốc đồng bộ

  /* ---- đồng hồ video (media clock mượt, tự sửa lệch) ---- */
  const videoClock = useCallback(() =>
    playingRef.current ? anchorVideoRef.current + (performance.now() - anchorWallRef.current) / 1000 : anchorVideoRef.current
  , [])

  const post = useCallback((func: string, args: unknown[] = []) => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*')
  }, [])
  const startListening = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), '*')
  }, [])

  const setAnchorClock = (t: number) => { anchorVideoRef.current = t; anchorWallRef.current = performance.now() }
  const setPlay = (p: boolean) => { playingRef.current = p; setPlaying(p) }

  /* ---- nhận message từ YouTube ---- */
  useEffect(() => {
    const h = (ev: MessageEvent) => {
      if (typeof ev.origin === 'string' && !ev.origin.includes('youtube')) return
      let d: Record<string, unknown>
      try { d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data } catch { return }
      if (d.event === 'onReady') { setPlayerReady(true); return }
      const applyState = (st: number) => {
        if (st === 1) setPlay(true)
        else if (st === 2 || st === 0) setPlay(false)
      }
      if (d.event === 'onStateChange' && typeof d.info === 'number') applyState(d.info)
      if (d.event === 'infoDelivery') {
        const info = d.info as Record<string, unknown> | undefined
        if (info && typeof info.playerState === 'number') applyState(info.playerState)
        if (info && typeof info.currentTime === 'number') {
          const t = info.currentTime as number
          // chỉ neo lại khi đang dừng hoặc lệch lớn → đồng hồ mượt, monotonic
          if (!playingRef.current || Math.abs(videoClock() - t) > 0.25) setAnchorClock(t)
        }
      }
    }
    window.addEventListener('message', h)
    return () => window.removeEventListener('message', h)
  }, [videoClock])

  /* ---- đồng hồ UI ~60fps ---- */
  useEffect(() => {
    let raf = 0
    const tick = () => { setVideoTime(videoClock()); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [videoClock])

  /* ---- transport ---- */
  const play = useCallback(() => post('playVideo'), [post])
  const pause = useCallback(() => post('pauseVideo'), [post])
  const seekTo = useCallback((sec: number) => { post('seekTo', [sec, true]); setAnchorClock(sec) }, [post])

  const loadVideo = () => {
    const id = extractVideoId(youtubeUrl.trim())
    setVideoId(id); setPlayerReady(false); setPlay(false); setAnchorClock(0)
  }
  const pickVideo = (id: string) => {
    setYoutubeUrl(`https://youtube.com/watch?v=${id}`)
    setVideoId(id); setPlayerReady(false); setPlay(false); setAnchorClock(0)
  }

  /* ---- tap nhịp (video-time) ---- */
  const tap = useCallback(() => {
    const t = videoClock()
    setTapTimes(prev => {
      const next = [...prev, t]
      setFit(next.length >= 2 ? fitTempo(next) : null)
      return next
    })
  }, [videoClock])
  const resetTaps = () => { setTapTimes([]); setFit(null) }

  /* ---- metronome (Web Audio) ---- */
  const audioRef = useRef<AudioContext | null>(null)
  const lastBeatRef = useRef(-1)
  const ensureAudio = () => {
    if (!audioRef.current) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audioRef.current = new Ctor()
    }
    if (audioRef.current.state === 'suspended') audioRef.current.resume()
    return audioRef.current
  }
  const click = useCallback((strong: boolean) => {
    const ctx = audioRef.current; if (!ctx) return
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.frequency.value = strong ? 1650 : 920
    const t0 = ctx.currentTime
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(strong ? 0.5 : 0.28, t0 + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08)
    o.connect(g).connect(ctx.destination)
    o.start(t0); o.stop(t0 + 0.09)
  }, [])
  useEffect(() => {
    if (!metronomeOn || !fit || (step !== 2 && step !== 4)) return
    lastBeatRef.current = -1
    const N = timeSignature
    const id = setInterval(() => {
      if (!playingRef.current) return
      const beat = Math.floor((videoClock() - fit.gridOffset) / fit.beatDuration)
      if (beat !== lastBeatRef.current) {
        lastBeatRef.current = beat
        const inBar = ((beat % N) + N) % N
        click(inBar === downbeatPosition - 1)
      }
    }, 22)
    return () => clearInterval(id)
  }, [metronomeOn, fit, timeSignature, downbeatPosition, videoClock, click, step])

  /* ---- derived ---- */
  const words = useMemo(() => splitWords(lyricsText), [lyricsText])
  const mapping = useMemo(() => computeMapping(words, anchors), [words, anchors])
  const mappedCount = anchors.length
  const pct = words.length ? Math.round((mappedCount / words.length) * 100) : 0
  const nonMonotonic = useMemo(() => {
    const s = [...anchors].sort((a, b) => a.wordIndex - b.wordIndex)
    for (let i = 1; i < s.length; i++) if (s[i].beatIndex <= s[i - 1].beatIndex) return true
    return false
  }, [anchors])

  const curBeat = fit ? timeToBeat(videoTime, fit) : 0
  const inBar = fit ? (((curBeat % timeSignature) + timeSignature) % timeSignature) : 0

  /* preview: từ có vị trí + thời gian, tìm từ đang hát */
  const timedWords = useMemo(() => {
    if (!fit) return [] as { index: number; time: number }[]
    return mapping
      .filter(m => m.source !== 'unmapped' && m.beatPosition != null)
      .map(m => ({ index: m.index, time: beatToTime(m.beatPosition!, fit) }))
      .sort((a, b) => a.time - b.time)
  }, [mapping, fit])
  const activeWordIndex = useMemo(() => {
    let idx: number | undefined
    for (const tw of timedWords) { if (tw.time <= videoTime + 0.05) idx = tw.index; else break }
    return idx
  }, [timedWords, videoTime])

  /* ---- anchor handlers ---- */
  const captureAnchor = () => {
    if (!fit) return
    const t = videoClock()
    const beatIndex = timeToBeat(t, fit)
    pause()
    seekTo(beatToTime(beatIndex, fit))
    setPendingBeat({ beatIndex, time: t })
  }
  const assignWord = (w: Word) => {
    if (!pendingBeat) return
    setAnchors(prev => {
      const filtered = prev.filter(a => a.wordIndex !== w.index && a.beatIndex !== pendingBeat.beatIndex)
      return [...filtered, makeAnchor(w.index, w.text, pendingBeat.beatIndex)].sort((a, b) => a.wordIndex - b.wordIndex)
    })
    setToast(`Đã gắn "${w.text}" → beat ${pendingBeat.beatIndex}`)
    setPendingBeat(null)
  }
  const removeAnchor = (wordIndex: number) => setAnchors(prev => prev.filter(a => a.wordIndex !== wordIndex))
  const onChipTap = (w: Word, m: MappedWord) => {
    if (pendingBeat) { assignWord(w); return }
    if (m.source === 'anchor') removeAnchor(w.index)
  }
  const resetAnchors = () => { setAnchors([]); setPendingBeat(null); pause() }

  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 2200); return () => clearTimeout(id) }, [toast])

  /* ---- lưu nháp ---- */
  useEffect(() => {
    const d: Draft = { youtubeUrl, lyricsText, fit, timeSignature, downbeatPosition, anchors, step }
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)) } catch { /* sandbox */ }
  }, [youtubeUrl, lyricsText, fit, timeSignature, downbeatPosition, anchors, step])

  /* ---- điều hướng bước ---- */
  const canNext = (): boolean => {
    if (step === 0) return !!videoId
    if (step === 1) return !!fit?.ok
    if (step === 2) return !!fit?.ok
    if (step === 3) return true
    if (step === 4) return true
    return false
  }
  const goNext = () => setStep(s => Math.min(STEPS.length - 1, s + 1))
  const goBack = () => setStep(s => Math.max(0, s - 1))

  /* ===================== RENDER ===================== */
  return (
    <div style={{ minHeight: '100dvh', background: C.bg, color: C.text, fontFamily: FONT, display: 'flex', flexDirection: 'column' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap');
        *{box-sizing:border-box} button:active:not(:disabled){transform:scale(0.97)}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        textarea,input{font-family:${FONT}}
        ::placeholder{color:${C.dim}}`}</style>

      {/* Header + step dots */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '10px 14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {onClose && <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 10, width: 34, height: 34, color: C.muted, cursor: 'pointer', fontSize: 17, flexShrink: 0 }}>✕</button>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>🎼 Song Builder</div>
            <div style={{ fontSize: 11, color: C.dim }}>Biến bài YouTube thành dữ liệu luyện nhịp</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5, marginTop: 10 }}>
          {STEPS.map((s, i) => {
            const locked = i === 5
            const active = i === step
            const done = i < step
            return (
              <button key={s} onClick={() => { if (!locked && (i <= step || canNext())) setStep(i) }}
                style={{
                  flex: 1, padding: '5px 2px', borderRadius: 8, border: 'none', cursor: locked ? 'default' : 'pointer',
                  background: active ? C.accent : done ? C.accentSoft : 'rgba(255,255,255,0.04)',
                  color: active ? '#fff' : locked ? C.dim : done ? C.accent : C.muted,
                  fontSize: 10, fontWeight: 700, fontFamily: FONT, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                }}>
                <span style={{ fontSize: 11 }}>{locked ? '🔒' : `${i + 1}`}</span>
                <span style={{ fontSize: 9, whiteSpace: 'nowrap' }}>{s}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Player (giữ mount xuyên suốt để không reload video) */}
      {videoId && (
        <div style={{ flexShrink: 0, background: '#000' }}>
          <div style={{ width: '100%', margin: '0 auto', aspectRatio: '16 / 9', maxHeight: '30vh' }}>
            <iframe ref={iframeRef} src={buildEmbedUrl(videoId)} title="YouTube"
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen
              onLoad={() => { setTimeout(startListening, 400); setTimeout(startListening, 1200) }} />
          </div>
          {/* transport mini */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: C.surface, borderBottom: `1px solid ${C.border}` }}>
            <button onClick={playing ? pause : play} disabled={!playerReady}
              style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: playing ? C.surface2 : C.accent, color: '#fff', fontSize: 15, cursor: 'pointer', flexShrink: 0, opacity: playerReady ? 1 : 0.4 }}>
              {playing ? '⏸' : '▶'}
            </button>
            <span style={{ fontFamily: MONO, fontSize: 13, color: C.cyan, minWidth: 44 }}>{fmt(videoTime)}</span>
            {fit?.ok && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {Array.from({ length: timeSignature }, (_, i) => (
                  <span key={i} style={{
                    width: i === downbeatPosition - 1 ? 10 : 8, height: i === downbeatPosition - 1 ? 10 : 8, borderRadius: '50%',
                    background: i === inBar ? (i === downbeatPosition - 1 ? C.amber : C.accent) : 'rgba(255,255,255,0.12)',
                    border: i === downbeatPosition - 1 ? `1.5px solid ${C.amber}` : 'none', transition: 'background 0.05s',
                  }} />
                ))}
                <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted, marginLeft: 4 }}>beat {curBeat}</span>
              </div>
            )}
            <span style={{ flex: 1 }} />
            {playerReady
              ? <span style={{ fontSize: 10, color: C.green, display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, animation: 'pulse 1s infinite' }} />sẵn sàng</span>
              : <span style={{ fontSize: 10, color: C.dim }}>đang kết nối…</span>}
          </div>
        </div>
      )}

      {/* Nội dung bước (cuộn) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14, paddingBottom: 90 }}>
        {step === 0 && <StepSetup {...{ youtubeUrl, setYoutubeUrl, videoId, loadVideo, pickVideo, lyricsText, setLyricsText, words }} />}
        {step === 1 && <StepTempo {...{ fit, tapTimes, tap, resetTaps, playing, playerReady, play }} />}
        {step === 2 && <StepDownbeat {...{ fit, timeSignature, setTimeSignature, downbeatPosition, setDownbeatPosition, metronomeOn, toggleMetro: () => { ensureAudio(); setMetronomeOn(v => !v) }, playing, play, inBar, curBeat }} />}
        {step === 3 && <StepAnchor {...{ fit, words, mapping, anchors, pendingBeat, setPendingBeat, captureAnchor, onChipTap, mappedCount, pct, nonMonotonic, playerReady, playing, play, pause, removeAnchor, resetAnchors }} />}
        {step === 4 && <StepPreview {...{ fit, words, mapping, activeWordIndex, metronomeOn, toggleMetro: () => { ensureAudio(); setMetronomeOn(v => !v) }, playing, play, pause, mappedCount, pct }} />}
        {step === 5 && <StepExportLocked />}
      </div>

      {/* Footer điều hướng */}
      {step < 5 && (
        <div style={{ flexShrink: 0, display: 'flex', gap: 10, padding: '10px 14px max(10px, env(safe-area-inset-bottom))', borderTop: `1px solid ${C.border}`, background: C.surface }}>
          {step > 0 && <Btn kind="ghost" onClick={goBack} style={{ flex: 1 }}>← Quay lại</Btn>}
          <Btn onClick={goNext} disabled={!canNext()} style={{ flex: 2 }}>
            {step === 4 ? 'Tới bước Xuất →' : 'Tiếp tục →'}
          </Btn>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 78, left: '50%', transform: 'translateX(-50%)', background: C.green, color: '#04210f', fontWeight: 700, fontSize: 13, padding: '10px 18px', borderRadius: 999, boxShadow: '0 6px 20px rgba(0,0,0,0.4)', zIndex: 200, maxWidth: '90%' }}>
          {toast}
        </div>
      )}
    </div>
  )
}

/* ===================== STEP 0 — Chuẩn bị ===================== */
function StepSetup({ youtubeUrl, setYoutubeUrl, videoId, loadVideo, pickVideo, lyricsText, setLyricsText, words }: {
  youtubeUrl: string; setYoutubeUrl: (s: string) => void; videoId: string | null; loadVideo: () => void
  pickVideo: (id: string) => void; lyricsText: string; setLyricsText: (s: string) => void; words: Word[]
}) {
  const inp: React.CSSProperties = { width: '100%', padding: '12px 14px', borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontSize: 14, outline: 'none' }
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<YTResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchErr, setSearchErr] = useState<string | null>(null)
  const [showLink, setShowLink] = useState(false)

  const searchYouTube = async (q: string) => {
    if (!q.trim()) return
    setSearching(true); setSearchErr(null)
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(q)}&key=${YT_API_KEY}`
      )
      const data = await res.json()
      if (data.error) { setSearchErr('Lỗi tìm kiếm (quota?) — thử lại sau hoặc dán link.'); setResults([]); setSearching(false); return }
      setResults((data.items ?? []).map((item: { id: { videoId: string }; snippet: { title: string; channelTitle: string; thumbnails: Record<string, { url: string }> } }) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.medium?.url ?? item.snippet.thumbnails.default?.url,
      })))
    } catch {
      setSearchErr('Không kết nối được YouTube — kiểm tra mạng hoặc dán link.')
      setResults([])
    }
    setSearching(false)
  }

  const onSelect = (r: YTResult) => { pickVideo(r.id); setResults([]); setQuery('') }

  return (
    <>
      <Card title="① Tìm bài hát trên YouTube">
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={{ ...inp, flex: 1 }} value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchYouTube(query)} placeholder="Tên bài hát / ca sĩ…" />
          <Btn onClick={() => searchYouTube(query)} disabled={!query.trim() || searching} style={{ flexShrink: 0 }}>
            {searching ? '…' : '🔍 Tìm'}
          </Btn>
        </div>
        {searchErr && <div style={{ fontSize: 11, color: C.red, marginTop: 6 }}>⚠ {searchErr}</div>}

        {results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12, maxHeight: 340, overflowY: 'auto' }}>
            {results.map(r => {
              const sel = videoId === r.id
              return (
                <button key={r.id} onClick={() => onSelect(r)}
                  style={{ display: 'flex', gap: 10, alignItems: 'center', textAlign: 'left', padding: 6, borderRadius: 10, cursor: 'pointer',
                    background: sel ? C.accentSoft : 'rgba(255,255,255,0.03)', border: `1px solid ${sel ? C.accent : C.border}` }}>
                  <img src={r.thumbnail} alt="" style={{ width: 76, height: 43, borderRadius: 6, objectFit: 'cover', flexShrink: 0, background: C.surface2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{r.channel}</div>
                  </div>
                  {sel && <span style={{ fontSize: 11, color: C.accent, fontWeight: 700, flexShrink: 0 }}>✓</span>}
                </button>
              )
            })}
          </div>
        )}

        <button onClick={() => setShowLink(v => !v)} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer', marginTop: 12, padding: 0, fontFamily: FONT }}>
          {showLink ? '▾ Ẩn dán link' : '▸ Hoặc dán link YouTube trực tiếp'}
        </button>
        {showLink && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input style={{ ...inp, flex: 1 }} value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadVideo()} placeholder="https://youtube.com/watch?v=..." />
            <Btn onClick={loadVideo} style={{ flexShrink: 0 }}>Load</Btn>
          </div>
        )}
        {youtubeUrl && !videoId && <div style={{ fontSize: 11, color: C.red, marginTop: 6 }}>⚠ Link YouTube không hợp lệ</div>}
        {videoId && <div style={{ fontSize: 11, color: C.green, marginTop: 8 }}>✓ Đã nạp video. Bấm ▶ để nghe thử.</div>}
      </Card>

      <Card title="② Lời bài hát">
        <textarea value={lyricsText} onChange={e => setLyricsText(e.target.value)} rows={8}
          placeholder={'Dán lời bài hát vào đây.\nMỗi từ sẽ là một mốc có thể gắn.\nXuống dòng để giữ bố cục câu.'}
          style={{ ...inp, resize: 'vertical', lineHeight: 1.7 }} />
        <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>
          {words.length > 0 ? <>Đã tách <b style={{ color: C.text }}>{words.length}</b> từ.</> : 'Chưa có lời — có thể nhập sau ở bước Gắn mốc.'}
        </div>
      </Card>

      <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.7, padding: '0 4px' }}>
        Quy trình: <b style={{ color: C.muted }}>nghe & tap nhịp</b> → chọn phách mạnh → <b style={{ color: C.muted }}>gắn mốc</b> vài từ vào beat → app tự nội suy phần còn lại → nghe thử.
      </div>
    </>
  )
}

/* ===================== STEP 1 — Tap nhịp ===================== */
function StepTempo({ fit, tapTimes, tap, resetTaps, playing, playerReady, play }: {
  fit: TempoFit | null; tapTimes: number[]; tap: () => void; resetTaps: () => void
  playing: boolean; playerReady: boolean; play: () => void
}) {
  return (
    <>
      <Card title="Giai đoạn 1 — Lưới nhịp">
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, marginBottom: 12 }}>
          Bấm <b style={{ color: C.text }}>▶ phát video</b>, rồi <b style={{ color: C.text }}>tap đều theo nhịp</b> bài hát (mỗi tap = 1 phách). Tap ≥ 4 lần; có thể tap–nghỉ–tap, bỏ vài nhịp cũng được.
        </div>
        {!playing && (
          <Btn kind="soft" onClick={play} disabled={!playerReady} style={{ width: '100%', marginBottom: 12 }}>▶ Phát video để tap</Btn>
        )}
        <button onPointerDown={tap}
          style={{
            width: '100%', background: `linear-gradient(135deg, ${C.accent}, #8B84FF)`, color: '#fff', border: 'none',
            borderRadius: 20, padding: '34px 0', fontSize: 26, fontWeight: 900, letterSpacing: '0.08em', cursor: 'pointer',
            userSelect: 'none', boxShadow: `0 10px 30px ${C.accent}44`,
          }}>
          TAP
          <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8, marginTop: 6 }}>{tapTimes.length} lần</div>
        </button>
        {tapTimes.length > 0 && (
          <button onClick={resetTaps} style={{ display: 'block', margin: '12px auto 0', background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, color: C.muted, fontSize: 12, padding: '7px 18px', cursor: 'pointer', fontFamily: FONT }}>↺ Tap lại từ đầu</button>
        )}
      </Card>

      {fit?.ok ? (
        <Card title="Kết quả fit">
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <Stat label="BPM" value={fit.bpm.toFixed(1)} color={C.cyan} />
            <Stat label="beatDuration" value={`${fit.beatDuration.toFixed(3)}s`} />
            <Stat label="gridOffset" value={`${fit.gridOffset.toFixed(2)}s`} sub="≈ youtubeOffset" color={C.amber} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Stat label="Tap" value={String(fit.validTaps)} />
            <Stat label="Bị loại" value={String(fit.rejected)} color={fit.rejected ? C.amber : C.green} />
            <Stat label="Sai số TB" value={`${(fit.avgError * 1000).toFixed(0)}ms`} color={fit.avgError * 1000 < 35 ? C.green : C.amber} />
            <Stat label="Chế độ" value={fit.fitted ? 'hồi quy' : 'fallback'} color={fit.fitted ? C.green : C.amber} />
          </div>
          {fit.fitted && fit.avgError * 1000 < 45 &&
            <div style={{ marginTop: 12, background: 'rgba(34,197,94,0.08)', border: `1px solid ${C.green}55`, borderRadius: 10, padding: '10px 14px', fontSize: 12, color: C.green }}>
              ✓ Lưới ổn định. Bấm “Tiếp tục” để chọn phách mạnh.
            </div>}
        </Card>
      ) : (
        <div style={{ textAlign: 'center', color: C.dim, fontSize: 13, padding: 16 }}>
          {tapTimes.length < 2 ? 'Tap ít nhất 2 lần để ước lượng, ≥ 4 lần để fit chính xác…' : 'Tap thêm…'}
        </div>
      )}
    </>
  )
}

/* ===================== STEP 2 — Phách mạnh ===================== */
function StepDownbeat({ fit, timeSignature, setTimeSignature, downbeatPosition, setDownbeatPosition, metronomeOn, toggleMetro, playing, play, inBar, curBeat }: {
  fit: TempoFit | null; timeSignature: number; setTimeSignature: (n: number) => void
  downbeatPosition: number; setDownbeatPosition: (n: number) => void
  metronomeOn: boolean; toggleMetro: () => void; playing: boolean; play: () => void; inBar: number; curBeat: number
}) {
  if (!fit?.ok) return <div style={{ color: C.muted, fontSize: 13, padding: 16 }}>Cần lưới nhịp ở bước 1 trước.</div>
  const labels = ['A', 'B', 'C', 'D', 'E', 'F']
  return (
    <>
      <Card title="Giai đoạn 2 — Cảm nhận phách mạnh">
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, marginBottom: 14 }}>
          Bật <b style={{ color: C.text }}>metronome</b> và nghe. Chọn phiên bản mà phách 🟡 <b style={{ color: C.amber }}>rơi đúng vào phách mạnh</b> bạn cảm nhận. Không có đúng/sai.
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: C.muted }}>Số phách / nhịp:</span>
          {[2, 3, 4, 6].map(n => (
            <button key={n} onClick={() => { setTimeSignature(n); if (downbeatPosition > n) setDownbeatPosition(1) }}
              style={{ width: 38, height: 34, borderRadius: 9, border: `1px solid ${timeSignature === n ? C.accent : C.border}`, background: timeSignature === n ? C.accentSoft : 'transparent', color: timeSignature === n ? C.accent : C.muted, fontFamily: MONO, fontWeight: 700, cursor: 'pointer' }}>{n}</button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: timeSignature }, (_, p) => {
            const sel = downbeatPosition === p + 1
            return (
              <button key={p} onClick={() => setDownbeatPosition(p + 1)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, border: `1px solid ${sel ? C.accent : C.border}`, background: sel ? C.accentSoft : 'transparent', cursor: 'pointer' }}>
                <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: 15, color: sel ? C.accent : C.muted, width: 18 }}>{labels[p]}</span>
                <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                  {Array.from({ length: timeSignature }, (_, i) => (
                    <span key={i} style={{ width: 22, height: 22, borderRadius: '50%', background: i === p ? C.amber : 'rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: i === p ? '#1a1200' : C.dim }}>{i + 1}</span>
                  ))}
                </div>
                {sel && <span style={{ fontSize: 11, color: C.accent, fontWeight: 700 }}>đang chọn</span>}
              </button>
            )
          })}
        </div>
      </Card>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Btn kind={metronomeOn ? 'solid' : 'soft'} onClick={toggleMetro} style={{ flex: 1 }}>
            {metronomeOn ? '⏹ Tắt metronome' : '🔊 Bật metronome'}
          </Btn>
          {!playing && <Btn kind="ghost" onClick={play} style={{ flex: 1 }}>▶ Phát</Btn>}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 14, justifyContent: 'center' }}>
          {Array.from({ length: timeSignature }, (_, i) => (
            <span key={i} style={{
              width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 12, fontWeight: 700,
              background: i === inBar ? (i === downbeatPosition - 1 ? C.amber : C.accent) : 'rgba(255,255,255,0.06)',
              color: i === inBar ? '#0b0e14' : C.dim, transition: 'background 0.05s',
            }}>{i + 1}</span>
          ))}
        </div>
        <div style={{ textAlign: 'center', fontFamily: MONO, fontSize: 11, color: C.muted, marginTop: 8 }}>beat {curBeat} · phách mạnh ở vị trí {downbeatPosition}</div>
      </Card>
    </>
  )
}

/* ===================== STEP 3 — Gắn mốc ===================== */
function StepAnchor({ fit, words, mapping, anchors, pendingBeat, setPendingBeat, captureAnchor, onChipTap, mappedCount, pct, nonMonotonic, playerReady, playing, play, pause, removeAnchor, resetAnchors }: {
  fit: TempoFit | null; words: Word[]; mapping: MappedWord[]; anchors: Anchor[]
  pendingBeat: { beatIndex: number; time: number } | null; setPendingBeat: (v: null) => void
  captureAnchor: () => void; onChipTap: (w: Word, m: MappedWord) => void
  mappedCount: number; pct: number; nonMonotonic: boolean
  playerReady: boolean; playing: boolean; play: () => void; pause: () => void
  removeAnchor: (i: number) => void; resetAnchors: () => void
}) {
  const [armed, setArmed] = useState(false)
  if (!fit?.ok) return <div style={{ color: C.muted, fontSize: 13, padding: 16 }}>Cần lưới nhịp ở bước 1 trước.</div>
  if (words.length === 0) return <div style={{ color: C.muted, fontSize: 13, padding: 16 }}>Chưa có lời bài hát — quay lại bước Chuẩn bị để dán lời.</div>

  return (
    <>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: C.muted }}>Đã gắn <b style={{ color: C.text }}>{mappedCount}</b>/{words.length} từ</span>
          <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: pct >= 30 ? C.green : C.amber }}>{pct}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct >= 30 ? C.green : C.amber, transition: 'width 0.2s' }} />
        </div>
        <div style={{ fontSize: 11, color: C.dim, marginTop: 6 }}>Chỉ cần gắn ~30–50% số từ — phần còn lại app tự nội suy.</div>
        {nonMonotonic && <div style={{ fontSize: 11, color: C.red, marginTop: 6 }}>⚠ Có mốc ngược thứ tự (beat giảm khi từ tăng). Kiểm tra lại các mốc.</div>}
      </Card>

      {/* Điều khiển: chỉ 2 nút */}
      <Card>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 14 }}>
          Bấm <b style={{ color: C.text }}>Play để gắn mốc</b>, nghe tới từ muốn đánh dấu thì bấm <b style={{ color: C.amber }}>Dừng để gắn mốc</b> — video tự dừng, chọn từ là xong. Lặp lại để gắn tiếp.
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn kind="ghost" onClick={() => { setArmed(false); resetAnchors() }} disabled={anchors.length === 0} style={{ flex: 1 }}>⏮ Làm lại từ đầu</Btn>
          {armed ? (
            <Btn onClick={() => { setArmed(false); captureAnchor() }} style={{ flex: 2, background: C.amber, color: '#1a1200' }}>⏸ Dừng để gắn mốc</Btn>
          ) : (
            <Btn onClick={() => { setArmed(true); play() }} disabled={!playerReady} style={{ flex: 2 }}>▶ Play để gắn mốc</Btn>
          )}
        </div>
      </Card>

      {/* Lời — bảng tham khảo (chạm từ đã gắn để xoá) */}
      <Card title="Lời bài hát (chạm từ đã gắn để xoá)">
        <LyricBlock words={words} mapping={mapping} onTap={onChipTap} />
        <div style={{ display: 'flex', gap: 16, marginTop: 14, fontSize: 11, color: C.muted, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: C.accent }} /> mốc thật</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: C.cyanSoft, border: `1px solid ${C.cyan}55` }} /> nội suy</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, border: `1px solid ${C.border}` }} /> chưa map</span>
        </div>
      </Card>

      {anchors.length > 0 && (
        <Card title={`Danh sách mốc (${anchors.length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[...anchors].sort((a, b) => a.beatIndex - b.beatIndex).map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}>
                <span style={{ fontFamily: MONO, fontSize: 12, color: C.accent, minWidth: 70 }}>beat {a.beatIndex}</span>
                <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.word}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: C.dim }}>tick {a.tick}</span>
                <button onClick={() => removeAnchor(a.wordIndex)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 16, padding: 2 }}>✕</button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Popup chọn từ — hiện khi vừa dừng để gắn mốc */}
      {pendingBeat && (
        <div onClick={() => setPendingBeat(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: C.surface, borderTop: `2px solid ${C.amber}`, borderRadius: '20px 20px 0 0', padding: 18, maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>Beat #{pendingBeat.beatIndex} là từ nào?</div>
              <span style={{ fontFamily: MONO, fontSize: 12, color: C.amber }}>{fmt(pendingBeat.time)}</span>
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Chạm từ đang hát ở thời điểm này</div>
            <div style={{ overflowY: 'auto', flex: 1, marginBottom: 12 }}>
              <LyricBlock words={words} mapping={mapping} onTap={onChipTap} picker />
            </div>
            <Btn kind="ghost" onClick={() => setPendingBeat(null)} style={{ width: '100%' }}>Huỷ</Btn>
          </div>
        </div>
      )}
    </>
  )
}

/* ===================== STEP 4 — Nghe thử ===================== */
function StepPreview({ fit, words, mapping, activeWordIndex, metronomeOn, toggleMetro, playing, play, pause, mappedCount, pct }: {
  fit: TempoFit | null; words: Word[]; mapping: MappedWord[]; activeWordIndex?: number
  metronomeOn: boolean; toggleMetro: () => void; playing: boolean; play: () => void; pause: () => void
  mappedCount: number; pct: number
}) {
  if (!fit?.ok) return <div style={{ color: C.muted, fontSize: 13, padding: 16 }}>Cần lưới nhịp ở bước 1 trước.</div>
  const activeWord = activeWordIndex != null ? words.find(w => w.index === activeWordIndex) : undefined
  return (
    <>
      <Card title="Giai đoạn 5 — Nghe thử">
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, marginBottom: 12 }}>
          Phát video — từ <b style={{ color: C.accent }}>đã gắn</b> và <b style={{ color: C.cyan }}>nội suy</b> sẽ sáng đúng nhịp. Lệch chỗ nào thì quay lại <b style={{ color: C.text }}>thêm/sửa mốc</b> (không sửa từng từ).
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn onClick={playing ? pause : play} style={{ flex: 1 }}>{playing ? '⏸ Tạm dừng' : '▶ Phát'}</Btn>
          <Btn kind={metronomeOn ? 'solid' : 'soft'} onClick={toggleMetro} style={{ flex: 1 }}>{metronomeOn ? '🔊 Metronome' : '🔈 Metronome'}</Btn>
        </div>
      </Card>

      <Card>
        <div style={{ textAlign: 'center', minHeight: 54, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 30, fontWeight: 800, color: activeWord ? C.amber : C.dim, transition: 'color 0.1s' }}>
            {activeWord ? activeWord.text : '♪'}
          </span>
        </div>
        <LyricBlock words={words} mapping={mapping} activeIndex={activeWordIndex} />
      </Card>

      <div style={{ display: 'flex', gap: 8 }}>
        <Stat label="Mốc thật" value={String(mappedCount)} color={C.accent} />
        <Stat label="Đã map" value={`${pct}%`} color={pct >= 30 ? C.green : C.amber} />
        <Stat label="Tổng từ" value={String(words.length)} />
      </div>
    </>
  )
}

/* ===================== STEP 5 — Xuất (KHÓA) ===================== */
function StepExportLocked() {
  return (
    <div style={{ textAlign: 'center', padding: '30px 16px' }}>
      <div style={{ fontSize: 46, marginBottom: 12 }}>🔒</div>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Bước Xuất đang chờ chốt</div>
      <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.8, maxWidth: 360, margin: '0 auto' }}>
        Theo bàn giao, đợt này <b style={{ color: C.text }}>chỉ dựng UI + state + preview nội suy</b>. Phần xuất dữ liệu (schema v2.1 tick-based) sẽ làm sau khi Văn Anh chốt:
      </div>
      <div style={{ textAlign: 'left', maxWidth: 360, margin: '16px auto 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {['Schema v2.1 thật — file nào định nghĩa, tên field tick/phân số?', '“Phân số” biểu diễn vị trí hay trường độ nốt?', 'Player v2.1 render theo TỪ hay theo DÒNG?'].map((t, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, fontSize: 12, color: C.muted, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}>
            <span style={{ color: C.amber, fontWeight: 800 }}>{i + 1}</span><span>{t}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
