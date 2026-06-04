import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { fitTempo, beatToTime, timeToBeat } from './logic/tempoFit'
import type { TempoFit } from './logic/tempoFit'
import { splitWords, computeMapping, makeAnchor } from './logic/songBuilder'
import type { Word, Anchor, MappedWord } from './logic/songBuilder'
import {
  newDraftId, autosaveCurrentDraft, getLatestDraft, getCurrentId, loadDraft as loadDraftById,
  listDrafts, deleteDraft, renameDraft, duplicateDraft, migrateLegacyDraft, hasContent, progressOf,
} from './logic/songDraftStorage'
import type { SongDraft, DraftSummary } from './logic/songDraftStorage'

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

// Logo Beat my Songs — ô vuông xanh + chữ BMS + chấm vàng (theo mẫu icon).
function BmsMark({ size = 28 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28, background: '#1B6B4C',
      display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0,
    }}>
      <span style={{ fontSize: size * 0.36, fontWeight: 900, color: '#F2EFE3', letterSpacing: -0.5, fontFamily: FONT, lineHeight: 1 }}>BMS</span>
      <span style={{ position: 'absolute', top: size * 0.2, right: size * 0.16, width: size * 0.16, height: size * 0.16, borderRadius: '50%', background: '#F5C518' }} />
    </div>
  )
}
const YT_API_KEY = 'AIzaSyA6kg3G2CVZ7b_x8IAlkZJCOa4AJHyWHms'

const STEPS = ['Chuẩn bị', 'Phách', 'Gắn mốc', 'Nhịp', 'Nghe thử', 'Xuất'] as const

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
  const [draftId, setDraftId] = useState<string>(() => newDraftId())
  const [songTitle, setSongTitle] = useState('')
  const [videoThumb, setVideoThumb] = useState<string | null>(null)

  const [step, setStep] = useState(0)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [videoId, setVideoId] = useState<string | null>(null)
  const [lyricsText, setLyricsText] = useState('')
  const [fit, setFit] = useState<TempoFit | null>(null)
  const [timeSignature, setTimeSignature] = useState(4)
  const [downbeatPosition, setDownbeatPosition] = useState(0)
  const [groupBeats, setGroupBeats] = useState<boolean | null>(null)
  const [anchors, setAnchors] = useState<Anchor[]>([])

  const [tapTimes, setTapTimes] = useState<number[]>([])
  const [playerReady, setPlayerReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [videoTime, setVideoTime] = useState(0)
  const [pendingBeat, setPendingBeat] = useState<{ beatIndex: number; time: number } | null>(null)
  const [metronomeOn, setMetronomeOn] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [videoExpanded, setVideoExpanded] = useState(false)

  /* ---- nháp: tiếp tục / danh sách / nhập JSON ---- */
  const [resumeDraft, setResumeDraft] = useState<SongDraft | null>(null)
  const [showDrafts, setShowDrafts] = useState(false)
  const hydrated = useRef(false)   // chặn autosave ghi đè trước khi khôi phục xong

  const applyDraft = useCallback((d: SongDraft) => {
    setDraftId(d.id)
    setSongTitle(d.title || '')
    setYoutubeUrl(d.youtubeUrl)
    setVideoId(d.videoId ?? (d.youtubeUrl ? extractVideoId(d.youtubeUrl) : null))
    setVideoThumb(d.thumbnail ?? null)
    setLyricsText(d.lyricsText)
    setFit(d.fit)
    setTimeSignature(d.timeSignature)
    setDownbeatPosition(d.downbeatPosition)
    setGroupBeats(d.groupBeats)
    setAnchors(d.anchors)
    setStep(d.step)
    setTapTimes([]); setPlayerReady(false); setPlaying(false); setPendingBeat(null); setMetronomeOn(false)
    hydrated.current = true
  }, [])

  const newDraft = useCallback(() => {
    setDraftId(newDraftId())
    setSongTitle(''); setYoutubeUrl(''); setVideoId(null); setVideoThumb(null); setLyricsText('')
    setFit(null); setTimeSignature(4); setDownbeatPosition(0); setGroupBeats(null); setAnchors([])
    setStep(0); setTapTimes([]); setPlayerReady(false); setPlaying(false); setPendingBeat(null); setMetronomeOn(false)
    hydrated.current = true
  }, [])

  /* ---- mở app: hỏi tiếp tục bài đang làm dở ---- */
  useEffect(() => {
    migrateLegacyDraft()
    const curId = getCurrentId()
    const latest = (curId && loadDraftById(curId)) || getLatestDraft()
    if (latest && hasContent(latest)) setResumeDraft(latest)
    else hydrated.current = true
  }, [])

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
      if (d.event === 'onReady') {
        setPlayerReady(true)
        // bỏ tắt tiếng — tránh video bị mute do chính sách autoplay của trình duyệt
        post('unMute'); post('setVolume', [100])
        return
      }
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
  }, [videoClock, post])

  /* ---- đồng hồ UI ~60fps ---- */
  useEffect(() => {
    let raf = 0
    const tick = () => { setVideoTime(videoClock()); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [videoClock])

  /* ---- transport ---- */
  const play = useCallback(() => { post('unMute'); post('playVideo') }, [post])
  const pause = useCallback(() => post('pauseVideo'), [post])
  const seekTo = useCallback((sec: number) => { post('seekTo', [sec, true]); setAnchorClock(sec) }, [post])

  const loadVideo = () => {
    const id = extractVideoId(youtubeUrl.trim())
    setVideoId(id); setPlayerReady(false); setPlay(false); setAnchorClock(0)
  }
  const pickVideo = (id: string, title?: string, thumb?: string) => {
    setYoutubeUrl(`https://youtube.com/watch?v=${id}`)
    setVideoId(id); setPlayerReady(false); setPlay(false); setAnchorClock(0)
    if (title && !songTitle.trim()) setSongTitle(title)
    if (thumb) setVideoThumb(thumb)
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
    if (!metronomeOn || !fit || step !== 4) return
    lastBeatRef.current = -1
    const N = timeSignature
    const id = setInterval(() => {
      if (!playingRef.current) return
      const beat = Math.floor((videoClock() - fit.gridOffset) / fit.beatDuration)
      if (beat !== lastBeatRef.current) {
        lastBeatRef.current = beat
        const inBar = ((beat % N) + N) % N
        click(groupBeats === true && inBar === downbeatPosition - 1)
      }
    }, 22)
    return () => clearInterval(id)
  }, [metronomeOn, fit, timeSignature, downbeatPosition, groupBeats, videoClock, click, step])

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

  /* ---- autosave nháp: mỗi thay đổi quan trọng đều lưu ngay ---- */
  useEffect(() => {
    if (!hydrated.current) return            // chưa khôi phục xong thì chưa ghi
    const now = Date.now()
    const fallbackTitle = videoId ? `Bài ${videoId}` : (lyricsText.trim().split(/\s+/).slice(0, 4).join(' ') || '')
    const d: SongDraft = {
      id: draftId, title: songTitle.trim() || fallbackTitle,
      youtubeUrl, videoId, thumbnail: videoThumb,
      lyricsText, fit, timeSignature, downbeatPosition, groupBeats, anchors, step,
      createdAt: now, updatedAt: now,
    }
    if (!hasContent(d)) return               // bài rỗng thì không tạo nháp
    autosaveCurrentDraft(d)
  }, [draftId, songTitle, youtubeUrl, videoId, videoThumb, lyricsText, fit, timeSignature, downbeatPosition, groupBeats, anchors, step])

  /* ---- thao tác nháp ---- */
  const resumeLatest = () => { if (resumeDraft) applyDraft(resumeDraft); setResumeDraft(null) }
  const startNew = () => { newDraft(); setResumeDraft(null); setShowDrafts(false) }
  const openDraftById = (id: string) => { const d = loadDraftById(id); if (d) applyDraft(d); setShowDrafts(false) }

  /* ---- điều hướng bước ---- */
  const canNext = (): boolean => {
    if (step === 0) return !!videoId
    if (step === 1) return !!fit?.ok
    if (step === 2) return true
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

      {/* Header gọn + thanh bước dạng dot */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '8px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onClose && <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 9, width: 32, height: 32, color: C.muted, cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>✕</button>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <BmsMark size={28} />
            <span style={{ fontSize: 15, fontWeight: 800, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Beat my Songs</span>
          </div>
          <button onClick={() => setShowHelp(true)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: C.muted, cursor: 'pointer', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>?</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: 10 }}>
          {STEPS.map((s, i) => {
            const locked = i === 5
            const active = i === step
            const done = i < step
            return (
              <button key={s} aria-label={s} onClick={() => { if (!locked && (i <= step || canNext())) setStep(i) }}
                style={{
                  flex: 1, minWidth: 0, padding: 0, border: 'none', background: 'none',
                  cursor: locked ? 'default' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}>
                <div style={{
                  width: active ? 28 : 24, height: active ? 28 : 24, borderRadius: '50%',
                  border: active ? `2px solid ${C.accent}` : `1.5px solid ${done ? C.accent : locked ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.28)'}`,
                  background: active ? C.accent : done ? `${C.accent}33` : 'transparent',
                  color: active ? '#fff' : done ? C.accent : locked ? C.dim : C.muted,
                  fontFamily: MONO, fontSize: 12, fontWeight: 800, lineHeight: 1, transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {locked ? '🔒' : done ? '✓' : i + 1}
                </div>
                <span style={{
                  fontSize: 9.5, fontWeight: active ? 800 : 600, lineHeight: 1.1, textAlign: 'center',
                  color: active ? C.accent : done ? C.muted : locked ? C.dim : C.muted,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
                }}>{s}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Player nhỏ gọn (video phụ — giữ mount xuyên suốt để không reload) */}
      {videoId && (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: C.surface, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ width: videoExpanded ? 200 : 132, aspectRatio: '16 / 9', flexShrink: 0, borderRadius: 8, overflow: 'hidden', background: '#000', transition: 'width 0.2s' }}>
            <iframe ref={iframeRef} src={buildEmbedUrl(videoId)} title="YouTube"
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen
              onLoad={() => { setTimeout(startListening, 400); setTimeout(startListening, 1200) }} />
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => seekTo(0)} disabled={!playerReady}
                style={{ width: 32, height: 32, borderRadius: '50%', border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 13, cursor: 'pointer', flexShrink: 0, opacity: playerReady ? 1 : 0.4 }}
                title="Về đầu video">⏮</button>
              <button onClick={playing ? pause : play} disabled={!playerReady}
                style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: playing ? C.surface2 : C.accent, color: '#fff', fontSize: 15, cursor: 'pointer', flexShrink: 0, opacity: playerReady ? 1 : 0.4 }}>
                {playing ? '⏸' : '▶'}
              </button>
              <span style={{ fontFamily: MONO, fontSize: 13, color: C.cyan, minWidth: 40 }}>{fmt(videoTime)}</span>
              <span style={{ flex: 1 }} />
              <button onClick={() => setVideoExpanded(v => !v)}
                style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 7, width: 28, height: 28, color: C.muted, cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>
                {videoExpanded ? '⤢' : '⤡'}
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {fit?.ok && groupBeats === true ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {Array.from({ length: timeSignature }, (_, i) => (
                    <span key={i} style={{
                      width: i === downbeatPosition - 1 ? 10 : 8, height: i === downbeatPosition - 1 ? 10 : 8, borderRadius: '50%',
                      background: i === inBar ? (i === downbeatPosition - 1 ? C.amber : C.accent) : 'rgba(255,255,255,0.12)',
                      border: i === downbeatPosition - 1 ? `1.5px solid ${C.amber}` : 'none', transition: 'background 0.05s',
                    }} />
                  ))}
                </div>
              ) : <span style={{ flex: 1 }} />}
              <span style={{ flex: 1 }} />
              {playerReady
                ? <span style={{ fontSize: 10, color: C.green, display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, animation: 'pulse 1s infinite' }} />sẵn sàng</span>
                : <span style={{ fontSize: 10, color: C.dim }}>đang kết nối…</span>}
            </div>
          </div>
        </div>
      )}

      {/* Nội dung bước (cuộn) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14, paddingBottom: 90 }}>
        {step === 0 && <StepSetup {...{ youtubeUrl, setYoutubeUrl, videoId, loadVideo, pickVideo, lyricsText, setLyricsText, words, songTitle, setSongTitle, onOpenDrafts: () => setShowDrafts(true) }} />}
        {step === 1 && <StepTempo {...{ fit, tapTimes, tap, resetTaps, playing, playerReady, play }} />}
        {step === 2 && <StepAnchor {...{ fit, words, mapping, anchors, pendingBeat, setPendingBeat, captureAnchor, onChipTap, mappedCount, pct, nonMonotonic, playerReady, playing, play, pause, removeAnchor, resetAnchors }} />}
        {step === 3 && <StepDownbeat {...{ words, mapping, timeSignature, setTimeSignature, downbeatPosition, setDownbeatPosition, groupBeats, setGroupBeats }} />}
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

      {showHelp && <HelpModal step={step} onClose={() => setShowHelp(false)} />}

      {resumeDraft && (
        <ResumeModal draft={resumeDraft} onResume={resumeLatest} onNew={startNew} />
      )}
      {showDrafts && (
        <DraftsModal
          currentId={draftId}
          onClose={() => setShowDrafts(false)}
          onOpen={openDraftById}
          onNew={startNew}
        />
      )}
    </div>
  )
}

/* ===================== Modal hướng dẫn ===================== */
const HELP_TIPS = [
  'Tìm bài trên YouTube (hoặc dán link), rồi dán lời bài hát. Mỗi từ sẽ là một mốc có thể gắn vào nhịp.',
  'Phát video và tap đều theo nhịp — mỗi tap = 1 phách. Tap ≥ 4 lần để máy dựng lưới nhịp; tap sai có thể tap lại.',
  'Bấm “Play để gắn mốc”, nghe tới từ cần đánh dấu thì bấm “Dừng” — video tự dừng, chọn từ là xong. Chỉ cần gắn ~30–50% số từ, phần còn lại máy tự nội suy.',
  'Tuỳ chọn: nhóm beat thành ô nhịp. Nếu có, chọn số beat mỗi ô rồi chạm một từ rơi vào phách mạnh — app tô phách mạnh màu vàng. Không cần thì bỏ qua, beat vẫn chạy đều.',
  'Phát thử: từ đã gắn và nội suy sẽ sáng đúng nhịp. Chỗ nào lệch thì quay lại bước Gắn mốc để thêm/sửa mốc.',
  'Bước Xuất đang tạm khoá, sẽ mở khi chốt xong định dạng dữ liệu.',
]
function HelpModal({ step, onClose }: { step: number; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 20, maxWidth: 380, width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800 }}><BmsMark size={24} /> Hướng dẫn</div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 9, width: 30, height: 30, color: C.muted, cursor: 'pointer', fontSize: 15 }}>✕</button>
        </div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, marginBottom: 16 }}>
          <b style={{ color: C.text }}>Beat my Songs</b> biến một bài YouTube thành dữ liệu luyện nhịp dựa trên <b style={{ color: C.text }}>lưới phách đều</b>. Làm lần lượt qua các bước bên dưới.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 12, background: i === step ? C.accentSoft : 'rgba(255,255,255,0.03)', border: `1px solid ${i === step ? C.accent : C.border}` }}>
              <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: 13, color: i === step ? C.accent : C.muted, flexShrink: 0 }}>{i === 5 ? '🔒' : i + 1}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2 }}>{s}</div>
                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>{HELP_TIPS[i]}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ===================== STEP 0 — Chuẩn bị ===================== */
function StepSetup({ youtubeUrl, setYoutubeUrl, videoId, loadVideo, pickVideo, lyricsText, setLyricsText, words, songTitle, setSongTitle, onOpenDrafts }: {
  youtubeUrl: string; setYoutubeUrl: (s: string) => void; videoId: string | null; loadVideo: () => void
  pickVideo: (id: string, title?: string, thumb?: string) => void; lyricsText: string; setLyricsText: (s: string) => void; words: Word[]
  songTitle: string; setSongTitle: (s: string) => void
  onOpenDrafts: () => void
}) {
  const inp: React.CSSProperties = { width: '100%', padding: '12px 14px', borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontSize: 14, outline: 'none' }
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<YTResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchErr, setSearchErr] = useState<string | null>(null)
  const [showLink, setShowLink] = useState(false)
  const [changing, setChanging] = useState(false)
  const showPicker = !videoId || changing

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

  const onSelect = (r: YTResult) => { pickVideo(r.id, r.title, r.thumbnail); setResults([]); setQuery(''); setChanging(false) }

  return (
    <>
      {/* Thanh quản lý bài nháp */}
      <div style={{ display: 'flex', marginBottom: 12 }}>
        <button onClick={onOpenDrafts} style={{ flex: 1, padding: '10px 6px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>📂 Bài hát của tôi</button>
      </div>

      {showPicker ? (
        <Card title="① Chọn bài hát">
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...inp, flex: 1 }} value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchYouTube(query)} placeholder="Tìm tên bài / ca sĩ trên YouTube…" />
            <Btn onClick={() => searchYouTube(query)} disabled={!query.trim() || searching} style={{ flexShrink: 0 }}>
              {searching ? '…' : '🔍 Tìm'}
            </Btn>
          </div>
          {searchErr && <div style={{ fontSize: 11, color: C.red, marginTop: 6 }}>⚠ {searchErr}</div>}

          {results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10, maxHeight: 220, overflowY: 'auto' }}>
              {results.map(r => {
                const sel = videoId === r.id
                return (
                  <button key={r.id} onClick={() => onSelect(r)}
                    style={{ display: 'flex', gap: 8, alignItems: 'center', textAlign: 'left', padding: 4, borderRadius: 8, cursor: 'pointer',
                      background: sel ? C.accentSoft : 'rgba(255,255,255,0.03)', border: `1px solid ${sel ? C.accent : C.border}` }}>
                    <img src={r.thumbnail} alt="" style={{ width: 52, height: 30, borderRadius: 5, objectFit: 'cover', flexShrink: 0, background: C.surface2 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                      <div style={{ fontSize: 10, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{r.channel}</div>
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
              <Btn onClick={() => { loadVideo(); setChanging(false) }} style={{ flexShrink: 0 }}>Load</Btn>
            </div>
          )}
          {youtubeUrl && !videoId && <div style={{ fontSize: 11, color: C.red, marginTop: 6 }}>⚠ Link YouTube không hợp lệ</div>}
          {changing && videoId && (
            <button onClick={() => setChanging(false)} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer', marginTop: 10, padding: 0, fontFamily: FONT }}>← Giữ bài hiện tại</button>
          )}
        </Card>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 14px' }}>
          <span style={{ fontSize: 16 }}>✓</span>
          <span style={{ flex: 1, fontSize: 13, color: C.green, fontWeight: 600 }}>Đã chọn bài hát</span>
          <button onClick={() => setChanging(true)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 9, color: C.text, fontSize: 12, cursor: 'pointer', padding: '7px 14px', fontFamily: FONT }}>🔄 Đổi bài</button>
        </div>
      )}

      {videoId && (
        <Card title="Tên bài">
          <input style={inp} value={songTitle} onChange={e => setSongTitle(e.target.value)} placeholder="Đặt tên cho bài đang làm…" />
        </Card>
      )}

      <Card title="Lời bài hát">
        <textarea value={lyricsText} onChange={e => setLyricsText(e.target.value)} rows={8}
          placeholder={'Dán lời bài hát vào đây.\nMỗi từ sẽ là một mốc có thể gắn.\nXuống dòng để giữ bố cục câu.'}
          style={{ ...inp, resize: 'vertical', lineHeight: 1.7 }} />
        <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>
          {words.length > 0 ? <>Đã tách <b style={{ color: C.text }}>{words.length}</b> từ.</> : 'Chưa có lời — có thể nhập sau ở bước Gắn mốc.'}
        </div>
      </Card>
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
      <Card title="Phách">
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, marginBottom: 12 }}>
          Hãy nghe bài hát và bấm ngón tay vào nút <b style={{ color: C.text }}>TAP</b> thật đều nhé. App sẽ tự ghi nhận lại tempo cho bạn.
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
        <div style={{ textAlign: 'center', background: 'rgba(34,197,94,0.08)', border: `1px solid ${C.green}55`, borderRadius: 16, padding: '18px 14px' }}>
          <div style={{ fontFamily: MONO, fontSize: 40, fontWeight: 900, color: C.cyan, lineHeight: 1 }}>{fit.bpm.toFixed(0)}<span style={{ fontSize: 16, color: C.muted, fontWeight: 600, marginLeft: 6 }}>BPM</span></div>
          <div style={{ fontSize: 13, color: C.green, marginTop: 10 }}>✓ Đã bắt được nhịp. Bấm “Tiếp tục”.</div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', color: C.dim, fontSize: 13, padding: 16 }}>
          {tapTimes.length < 2 ? 'Tap thêm vài lần nữa…' : 'Tap thêm…'}
        </div>
      )}
    </>
  )
}

/* ===================== STEP — Nhịp (nhóm beat + phách mạnh) ===================== */
function StepDownbeat({ words, mapping, timeSignature, setTimeSignature, downbeatPosition, setDownbeatPosition, groupBeats, setGroupBeats }: {
  words: Word[]; mapping: MappedWord[]; timeSignature: number; setTimeSignature: (n: number) => void
  downbeatPosition: number; setDownbeatPosition: (n: number) => void
  groupBeats: boolean | null; setGroupBeats: (v: boolean | null) => void
}) {
  const [pending, setPending] = useState<{ index: number; text: string; beatIndex: number } | null>(null)
  const hasMapped = mapping.some(m => m.beatPosition != null)
  const confirmed = groupBeats === true && downbeatPosition > 0
  const beatOptions: { n: number; label: string }[] = [
    { n: 2, label: '2/4' }, { n: 3, label: '3/4' }, { n: 4, label: '4/4' }, { n: 6, label: '6/8' },
  ]

  const pickWord = (w: Word, m: MappedWord) => {
    if (m.beatPosition == null) return
    setPending({ index: w.index, text: w.text, beatIndex: Math.round(m.beatPosition) })
  }
  const confirmStrong = () => {
    if (!pending) return
    setDownbeatPosition((pending.beatIndex % timeSignature) + 1)
    setPending(null)
  }
  const chooseBeats = (n: number) => { setGroupBeats(true); setTimeSignature(n); setDownbeatPosition(0); setPending(null) }
  const chooseEven = () => { setGroupBeats(false); setDownbeatPosition(0); setPending(null) }

  return (
    <>
      <Card title="Chọn Nhịp">
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={chooseEven}
            style={{ flex: 1, height: 42, borderRadius: 10, border: `1px solid ${groupBeats === false ? C.accent : C.border}`, background: groupBeats === false ? C.accentSoft : 'transparent', color: groupBeats === false ? C.accent : C.muted, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Đều</button>
          {beatOptions.map(o => {
            const sel = groupBeats === true && timeSignature === o.n
            return (
              <button key={o.n} onClick={() => chooseBeats(o.n)}
                style={{ flex: 1, height: 42, borderRadius: 10, border: `1px solid ${sel ? C.accent : C.border}`, background: sel ? C.accentSoft : 'transparent', color: sel ? C.accent : C.muted, fontFamily: MONO, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>{o.label}</button>
            )
          })}
        </div>
        <div style={{ fontSize: 11, color: C.dim, marginTop: 8 }}>
          {groupBeats === false ? 'Beat chạy đều, cùng màu — bấm “Tiếp tục”.' : 'Chọn số phách/ô, hoặc “Đều” nếu không chia nhịp.'}
        </div>
      </Card>

      {groupBeats === true && (
        <Card title="Chọn một từ rơi vào phách mạnh">
          {!hasMapped ? (
            <div style={{ fontSize: 13, color: C.amber, lineHeight: 1.7 }}>
              Chưa có từ nào được gắn mốc. Quay lại bước <b>Gắn mốc</b> để gắn vài từ trước, rồi mới chọn được phách mạnh.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, marginBottom: 12 }}>
                Hãy chạm vào một từ mà bạn cảm thấy <b style={{ color: C.amber }}>rơi vào phách mạnh</b>. App sẽ tự lặp lại phách mạnh đó theo chu kỳ {timeSignature} beat.
              </div>
              {pending && (
                <div style={{ marginBottom: 14, padding: 14, borderRadius: 14, background: 'rgba(245,180,30,0.08)', border: `1px solid ${C.amber}55` }}>
                  <div style={{ fontSize: 14, color: C.text, marginBottom: 12 }}>
                    Từ <b style={{ color: C.amber }}>“{pending.text}”</b> ở beat {pending.beatIndex} → phách mạnh lặp mỗi <b>{timeSignature}</b> beat.
                  </div>
                  <Btn onClick={confirmStrong} style={{ width: '100%', background: C.amber, color: '#1a1200' }}>✓ Xác nhận phách mạnh</Btn>
                </div>
              )}

              {confirmed && !pending && (
                <div style={{ marginBottom: 14, textAlign: 'center', fontSize: 13, color: C.green, fontWeight: 700 }}>
                  ✓ Đã đặt phách mạnh — tô vàng theo chu kỳ {timeSignature} beat. Chạm từ khác nếu muốn đổi.
                </div>
              )}

              <LyricBlock words={words} mapping={mapping} onTap={pickWord} picker />
            </>
          )}
        </Card>
      )}
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

/* ===================== Nháp: thời gian tương đối ===================== */
function relTime(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (s < 60) return 'vừa xong'
  const m = Math.floor(s / 60); if (m < 60) return `${m} phút trước`
  const h = Math.floor(m / 60); if (h < 24) return `${h} giờ trước`
  const d = Math.floor(h / 24); if (d < 30) return `${d} ngày trước`
  return new Date(ts).toLocaleDateString('vi-VN')
}

/* ===================== Modal: tiếp tục bài đang làm dở ===================== */
function ResumeModal({ draft, onResume, onNew }: { draft: SongDraft; onResume: () => void; onNew: () => void }) {
  const pct = progressOf(draft)
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 22, maxWidth: 360, width: '100%' }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Bạn có bài đang làm dở</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, margin: '14px 0' }}>
          {draft.thumbnail
            ? <img src={draft.thumbnail} alt="" style={{ width: 64, height: 38, borderRadius: 7, objectFit: 'cover', flexShrink: 0, background: C.surface2 }} />
            : <div style={{ width: 64, height: 38, borderRadius: 7, background: C.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>🎼</div>}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{draft.title || 'Bài chưa đặt tên'}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{relTime(draft.updatedAt)} · {pct}% hoàn thành</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Btn onClick={onResume} style={{ width: '100%' }}>▶ Tiếp tục</Btn>
          <Btn kind="ghost" onClick={onNew} style={{ width: '100%' }}>+ Tạo bài mới</Btn>
        </div>
      </div>
    </div>
  )
}

/* ===================== Modal: danh sách bài đang làm ===================== */
function DraftsModal({ currentId, onClose, onOpen, onNew }: {
  currentId: string; onClose: () => void; onOpen: (id: string) => void; onNew: () => void
}) {
  const [items, setItems] = useState<DraftSummary[]>(() => listDrafts())
  const refresh = () => setItems(listDrafts())

  const doRename = (id: string, cur: string) => {
    const name = prompt('Đổi tên bài:', cur)
    if (name != null && name.trim()) { renameDraft(id, name.trim()); refresh() }
  }
  const doDelete = (id: string, name: string) => {
    if (confirm(`Xoá bài “${name}”? Không thể hoàn tác.`)) { deleteDraft(id); refresh() }
  }
  const doDuplicate = (id: string) => { duplicateDraft(id); refresh() }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 450, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, borderTop: `2px solid ${C.accent}`, borderRadius: '20px 20px 0 0', padding: 18, width: '100%', maxWidth: 480, maxHeight: '82vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>📂 Bài đang làm ({items.length})</div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 9, width: 30, height: 30, color: C.muted, cursor: 'pointer', fontSize: 15 }}>✕</button>
        </div>

        {items.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.muted, fontSize: 13, padding: '24px 0' }}>Chưa có bài nào. Bấm “Tạo bài mới” để bắt đầu.</div>
        ) : (
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map(d => (
              <div key={d.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 10, borderRadius: 12, background: d.id === currentId ? C.accentSoft : 'rgba(255,255,255,0.03)', border: `1px solid ${d.id === currentId ? C.accent : C.border}` }}>
                {d.thumbnail
                  ? <img src={d.thumbnail} alt="" style={{ width: 56, height: 34, borderRadius: 6, objectFit: 'cover', flexShrink: 0, background: C.surface2 }} />
                  : <div style={{ width: 56, height: 34, borderRadius: 6, background: C.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 17 }}>🎼</div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.title}{d.id === currentId && <span style={{ fontSize: 10, color: C.accent, marginLeft: 6 }}>• đang mở</span>}
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{relTime(d.updatedAt)} · {d.progressPercent}%</div>
                  <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)', marginTop: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${d.progressPercent}%`, background: C.accent }} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => onOpen(d.id)} style={{ border: 'none', borderRadius: 8, background: C.accent, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '6px 10px', fontFamily: FONT }}>Mở tiếp</button>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button title="Đổi tên" onClick={() => doRename(d.id, d.title)} style={{ border: `1px solid ${C.border}`, borderRadius: 7, background: 'transparent', color: C.muted, fontSize: 12, cursor: 'pointer', padding: '4px 7px' }}>✎</button>
                    <button title="Nhân bản" onClick={() => doDuplicate(d.id)} style={{ border: `1px solid ${C.border}`, borderRadius: 7, background: 'transparent', color: C.muted, fontSize: 12, cursor: 'pointer', padding: '4px 7px' }}>⧉</button>
                    <button title="Xoá" onClick={() => doDelete(d.id, d.title)} style={{ border: `1px solid ${C.border}`, borderRadius: 7, background: 'transparent', color: C.red, fontSize: 12, cursor: 'pointer', padding: '4px 7px' }}>🗑</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Btn onClick={onNew} style={{ width: '100%', marginTop: 14 }}>+ Tạo bài mới</Btn>
      </div>
    </div>
  )
}

