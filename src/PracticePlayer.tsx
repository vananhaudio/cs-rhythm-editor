// Màn Luyện tập (web) — mở thẳng 1 bài ĐÃ LƯU: phát video + lời karaoke tự cuộn
// + hợp âm trôi trên lời + dải hợp âm hiện tại (sơ đồ bấm) + metronome.
// Port từ PracticeView.swift (native), tự chứa điều khiển YouTube + Web Audio.

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { splitWords, computeMapping } from './logic/songBuilder'
import type { SongChord } from './logic/songBuilder'
import { beatToTime } from './logic/tempoFit'
import type { SongDraft } from './logic/songDraftStorage'
import { chordShape } from './logic/chordLibrary'
import ChordDiagram from './ChordDiagram'

const C = {
  bg: '#0B0E14', surface: '#131823', surface2: '#1A2030', border: 'rgba(255,255,255,0.09)',
  text: '#E6EAF2', muted: '#8A93A6', dim: 'rgba(255,255,255,0.30)',
  accent: '#6C63FF', accentSoft: 'rgba(108,99,255,0.16)', amber: '#F59E0B', green: '#22C55E',
}
const FONT = `'Be Vietnam Pro',system-ui,sans-serif`
const MONO = `'JetBrains Mono','Space Mono',monospace`
const buildEmbedUrl = (id: string) =>
  `https://www.youtube.com/embed/${id}?${new URLSearchParams({ enablejsapi: '1', controls: '1', rel: '0', modestbranding: '1', playsinline: '1' })}`

export default function PracticePlayer({ draft, onClose, embedded = false }: { draft: SongDraft; onClose: () => void; embedded?: boolean }) {
  const words = useMemo(() => splitWords(draft.lyricsText), [draft.lyricsText])
  const mapping = useMemo(() => computeMapping(words, draft.anchors), [words, draft.anchors])
  const fit = draft.fit
  const hasGrid = !!fit?.ok
  const chords = draft.chords ?? []
  const hasChords = chords.length > 0
  const chordByWord = useMemo(() => new Map(chords.map(c => [c.wordIndex, c.name])), [chords])

  const [videoTime, setVideoTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [playerReady, setPlayerReady] = useState(false)
  const [metronomeOn, setMetronomeOn] = useState(false)
  const [videoBig, setVideoBig] = useState(false)   // mặc định video NHỎ — ưu tiên lời + hợp âm

  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const playingRef = useRef(false)
  const anchorWallRef = useRef(0)
  const anchorVideoRef = useRef(0)

  const videoClock = useCallback(() =>
    playingRef.current ? anchorVideoRef.current + (performance.now() - anchorWallRef.current) / 1000 : anchorVideoRef.current
  , [])
  const setAnchorClock = (t: number) => { anchorVideoRef.current = t; anchorWallRef.current = performance.now() }
  const setPlay = (p: boolean) => { playingRef.current = p; setPlaying(p) }

  const post = useCallback((func: string, args: unknown[] = []) => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*')
  }, [])
  const startListening = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), '*')
  }, [])

  useEffect(() => {
    const h = (ev: MessageEvent) => {
      if (typeof ev.origin === 'string' && !ev.origin.includes('youtube')) return
      let d: Record<string, unknown>
      try { d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data } catch { return }
      if (d.event === 'onReady') { setPlayerReady(true); post('unMute'); post('setVolume', [100]); return }
      const applyState = (st: number) => { if (st === 1) setPlay(true); else if (st === 2 || st === 0) setPlay(false) }
      if (d.event === 'onStateChange' && typeof d.info === 'number') applyState(d.info)
      if (d.event === 'infoDelivery') {
        const info = d.info as Record<string, unknown> | undefined
        if (info && typeof info.playerState === 'number') applyState(info.playerState as number)
        if (info && typeof info.currentTime === 'number') {
          const t = info.currentTime as number
          if (!playingRef.current || Math.abs(videoClock() - t) > 0.25) setAnchorClock(t)
        }
      }
    }
    window.addEventListener('message', h)
    return () => window.removeEventListener('message', h)
  }, [videoClock, post])

  useEffect(() => {
    let raf = 0
    const tick = () => { setVideoTime(videoClock()); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [videoClock])

  const play = useCallback(() => { post('unMute'); post('playVideo') }, [post])
  const pause = useCallback(() => post('pauseVideo'), [post])
  const seekTo = useCallback((sec: number) => { post('seekTo', [sec, true]); setAnchorClock(sec) }, [post])

  // ── metronome ──
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
    if (!metronomeOn || !fit?.ok) return
    lastBeatRef.current = -1
    const N = draft.timeSignature
    const id = setInterval(() => {
      if (!playingRef.current) return
      const beat = Math.floor((videoClock() - fit.gridOffset) / fit.beatDuration)
      if (beat !== lastBeatRef.current) {
        lastBeatRef.current = beat
        const inBar = ((beat % N) + N) % N
        click(draft.groupBeats === true && inBar === draft.downbeatPosition - 1)
      }
    }, 22)
    return () => clearInterval(id)
  }, [metronomeOn, fit, draft.timeSignature, draft.downbeatPosition, draft.groupBeats, videoClock, click])
  const toggleMetro = () => { ensureAudio(); setMetronomeOn(v => !v) }

  useEffect(() => () => { post('pauseVideo') }, [post])

  // ── từ đang hát ──
  const timedWords = useMemo(() => {
    if (!fit?.ok) return [] as { index: number; time: number }[]
    return mapping.filter(m => m.source !== 'unmapped' && m.beatPosition != null)
      .map(m => ({ index: m.index, time: beatToTime(m.beatPosition!, fit) }))
      .sort((a, b) => a.time - b.time)
  }, [mapping, fit])
  const activeWordIndex = useMemo(() => {
    let idx: number | undefined
    for (const tw of timedWords) { if (tw.time <= videoTime + 0.05) idx = tw.index; else break }
    return idx
  }, [timedWords, videoTime])

  const activeLine = activeWordIndex != null ? words.find(w => w.index === activeWordIndex)?.line : undefined
  const sortedChords = useMemo(() => [...chords].sort((a, b) => a.wordIndex - b.wordIndex), [chords])
  // Vị trí hợp âm HIỆN TẠI trong dãy (để dải cuộn ngang: trước · hiện tại · sắp tới)
  const curChordIndex = useMemo(() => {
    if (activeWordIndex == null) return 0
    let idx = 0
    for (let i = 0; i < sortedChords.length; i++) { if (sortedChords[i].wordIndex <= activeWordIndex) idx = i; else break }
    return idx
  }, [sortedChords, activeWordIndex])
  // Tự cuộn NGANG để hợp âm hiện tại về giữa (gán scrollLeft trực tiếp → chạy cả iOS WebView)
  const chordRailRef = useRef<HTMLDivElement | null>(null)
  const chordCardRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const chordScrollRef = useRef(0)
  useEffect(() => {
    const rail = chordRailRef.current, card = chordCardRefs.current[curChordIndex]
    if (!rail || !card) return
    const to = Math.max(0, rail.scrollLeft + (card.getBoundingClientRect().left - rail.getBoundingClientRect().left) - (rail.clientWidth - card.clientWidth) / 2)
    const from = rail.scrollLeft, d = to - from
    if (Math.abs(d) < 1) return
    cancelAnimationFrame(chordScrollRef.current)
    let ts0 = 0
    const step = (ts: number) => {
      if (!ts0) ts0 = ts
      const p = Math.min(1, (ts - ts0) / 320)
      rail.scrollLeft = from + d * (1 - Math.pow(1 - p, 3))
      if (p < 1) chordScrollRef.current = requestAnimationFrame(step)
    }
    chordScrollRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(chordScrollRef.current)
  }, [curChordIndex])

  // ── karaoke auto-cuộn ──
  const lines = useMemo(() => {
    const out: { line: number; words: typeof words }[] = []
    const byLine = new Map<number, typeof words>()
    for (const w of words) { const a = byLine.get(w.line) ?? []; a.push(w); byLine.set(w.line, a) }
    for (const k of [...byLine.keys()].sort((a, b) => a - b)) out.push({ line: k, words: byLine.get(k)! })
    return out
  }, [words])
  const lineRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const scrollBoxRef = useRef<HTMLDivElement | null>(null)
  const [boxH, setBoxH] = useState(0)
  useEffect(() => {
    const el = scrollBoxRef.current; if (!el) return
    const ro = new ResizeObserver(() => setBoxH(el.clientHeight))
    ro.observe(el); setBoxH(el.clientHeight)
    return () => ro.disconnect()
  }, [])
  // Teleprompter: BÁM LIÊN TỤC — mỗi frame kéo dòng đang hát về ~30% từ trên (luôn tự sửa sai lệch,
  // kể cả khi chữ to lên làm dòng xê dịch). Gán scrollTop trực tiếp → chạy cả iOS WebView.
  const LINE_ANCHOR = 0.26
  const activeLineRef = useRef<number | undefined>(undefined)
  activeLineRef.current = activeLine
  useEffect(() => {
    let raf = 0
    const follow = () => {
      const box = scrollBoxRef.current
      const al = activeLineRef.current
      if (box && al != null) {
        const el = lineRefs.current[al]
        if (el) {
          const to = Math.round(Math.max(0, box.scrollTop + (el.getBoundingClientRect().top - box.getBoundingClientRect().top) - box.clientHeight * LINE_ANCHOR))
          const d = to - box.scrollTop
          if (Math.abs(d) >= 0.5) box.scrollTop = Math.round(box.scrollTop + d * 0.16)   // lerp mượt, làm tròn tránh nhoè
          else box.scrollTop = to
        }
      }
      raf = requestAnimationFrame(follow)
    }
    raf = requestAnimationFrame(follow)
    return () => cancelAnimationFrame(raf)
  }, [])

  const ctrlBtn = (label: string, onClick: () => void, kind: 'solid' | 'soft' | 'ghost', disabled?: boolean): React.ReactElement => {
    const skin = kind === 'solid' ? { background: C.accent, color: '#fff', border: 'none' }
      : kind === 'soft' ? { background: C.accentSoft, color: C.accent, border: `1px solid ${C.accent}44` }
      : { background: 'transparent', color: C.muted, border: `1px solid ${C.border}` }
    return <button onClick={disabled ? undefined : onClick} disabled={disabled}
      style={{ flex: 1, ...skin, borderRadius: 12, padding: '11px 8px', fontFamily: FONT, fontWeight: 700, fontSize: 14, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1 }}>{label}</button>
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: C.bg, color: C.text, fontFamily: FONT, display: 'flex', flexDirection: 'column' }}>
      {/* Header — ẩn khi mở trong app TVA (đã có thanh 'Đóng · BMS' của app); giữ khi chạy standalone */}
      {!embedded && (
        <div style={{ display: 'flex', alignItems: 'center', padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>‹ Đóng</button>
          <span style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {draft.title || 'Luyện tập'}
          </span>
          <span style={{ minWidth: 48, textAlign: 'right', fontFamily: MONO, fontSize: 12, color: C.muted, whiteSpace: 'nowrap' }}>
            {hasGrid ? `${Math.round(fit!.bpm)}·${draft.timeSignature}/4` : ''}
          </span>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, padding: embedded ? 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 16px' : '0 16px 16px', maxWidth: 720, width: '100%', margin: '0 auto', minHeight: 0, position: 'relative' }}>
        {embedded && (
          <button onClick={onClose} style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 8px)', left: 8, zIndex: 3, background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff', borderRadius: 16, padding: '6px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>‹ Danh sách</button>
        )}
        {draft.videoId && (
          <div style={{ height: videoBig ? 'min(32vh, 210px)' : 52, borderRadius: 14, overflow: 'hidden', background: '#000', flexShrink: 0, position: 'relative', transition: 'height .25s' }}>
            <iframe ref={iframeRef} src={buildEmbedUrl(draft.videoId)} title="YouTube"
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen
              onLoad={() => { setTimeout(startListening, 400); setTimeout(startListening, 1200) }} />
            {/* nút thu/phóng video — mặc định nhỏ để ưu tiên lời + hợp âm */}
            <button onClick={() => setVideoBig(v => !v)} aria-label={videoBig ? 'Thu nhỏ video' : 'Phóng to video'}
              style={{ position: 'absolute', top: 6, right: 6, zIndex: 4, background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', borderRadius: 9, height: 30, padding: '0 10px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 5 }}>
              {videoBig ? '⤡ Thu nhỏ' : '⤢ Phóng to'}
            </button>
          </div>
        )}

        {/* Dải hợp âm cuộn ngang — trước · hiện tại · sắp tới */}
        {hasChords && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '9px 0 11px', flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: C.muted, padding: '0 14px', marginBottom: 8 }}>HỢP ÂM · trước · hiện tại · sắp tới</div>
            <div ref={chordRailRef} style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '0 14px', scrollbarWidth: 'none' }}>
              {sortedChords.map((c, i) => {
                const isCur = i === curChordIndex
                const isPast = i < curChordIndex
                const shape = chordShape(c.name)
                return (
                  <div key={i} ref={el => { chordCardRefs.current[i] = el }}
                    style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      borderRadius: 12, padding: '6px 10px', minWidth: 74,
                      background: isCur ? C.accentSoft : 'transparent',
                      border: `1px solid ${isCur ? C.accent + '66' : 'transparent'}`,
                      opacity: isPast ? 0.4 : isCur ? 1 : 0.82, transition: 'all .25s' }}>
                    <span style={{ fontSize: isCur ? 24 : 18, fontWeight: 800, color: isCur ? C.accent : C.text, lineHeight: 1 }}>{c.name}</span>
                    {shape ? <ChordDiagram shape={shape} width={isCur ? 60 : 48} /> : <div style={{ height: isCur ? 60 : 48 }} />}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Karaoke */}
        <div style={{ flex: 1, minHeight: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: C.muted, marginBottom: 8 }}>LỜI BÀI HÁT</div>
          {words.length === 0 ? (
            <div style={{ color: C.muted, fontSize: 14, flex: 1 }}>Bài này chưa có lời.</div>
          ) : (
            <div ref={scrollBoxRef} style={{ flex: 1, overflowY: 'auto', paddingTop: (playing && boxH) ? boxH * 0.26 : 14, paddingBottom: boxH ? boxH * 0.74 : '42vh' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {lines.map(ln => {
                  const rel = activeLine != null ? ln.line - activeLine : null   // <0 đã hát · 0 đang hát · >0 sắp tới
                  const isActiveLine = rel === 0
                  const opacity = rel == null ? 0.72
                    : rel === 0 ? 1
                    : rel < 0 ? (rel === -1 ? 0.4 : 0.2)          // đã hát → mờ dần
                    : rel <= 2 ? 0.9 : rel <= 4 ? 0.62 : 0.42     // sắp tới → giữ RÕ để đọc trước
                  return (
                    <div key={ln.line} ref={el => { lineRefs.current[ln.line] = el }}
                      style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 6px', justifyContent: 'center', alignItems: 'flex-end', opacity, padding: '2px', transition: 'opacity 0.3s' }}>
                      {ln.words.map(w => {
                        const chord = chordByWord.get(w.index)
                        const size = isActiveLine ? 26 : 21
                        return (
                          <div key={w.index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            {chord && <span style={{ fontSize: isActiveLine ? 17 : 14.5, fontWeight: 800, color: C.accent, lineHeight: 1.1 }}>{chord}</span>}
                            <span style={{
                              fontSize: size, fontWeight: isActiveLine ? 700 : 600,
                              color: isActiveLine ? '#FFF4E0' : C.text,
                            }}>{w.text}</span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {!hasGrid && <div style={{ fontSize: 12, color: C.dim, marginTop: 6 }}>Bài này chưa có lưới nhịp nên lời không tự cuộn / tô sáng.</div>}
        </div>

        {/* Điều khiển — đặt dưới cùng, vừa tầm ngón tay */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {ctrlBtn(playing ? '⏸ Tạm dừng' : '▶ Phát', () => playing ? pause() : play(), 'solid', !playerReady)}
          {ctrlBtn('⏮ Về đầu', () => seekTo(0), 'ghost', !playerReady)}
          {ctrlBtn('🔊 Metro', toggleMetro, metronomeOn ? 'solid' : 'soft', !hasGrid)}
        </div>
      </div>
    </div>
  )
}
