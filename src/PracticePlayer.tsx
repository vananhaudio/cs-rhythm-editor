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

export default function PracticePlayer({ draft, onClose }: { draft: SongDraft; onClose: () => void }) {
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
  const currentChord = activeWordIndex != null
    ? (sortedChords.filter(c => c.wordIndex <= activeWordIndex).pop()?.name ?? sortedChords[0]?.name)
    : sortedChords[0]?.name

  // ── karaoke auto-cuộn ──
  const lines = useMemo(() => {
    const out: { line: number; words: typeof words }[] = []
    const byLine = new Map<number, typeof words>()
    for (const w of words) { const a = byLine.get(w.line) ?? []; a.push(w); byLine.set(w.line, a) }
    for (const k of [...byLine.keys()].sort((a, b) => a - b)) out.push({ line: k, words: byLine.get(k)! })
    return out
  }, [words])
  const lineRefs = useRef<Record<number, HTMLDivElement | null>>({})
  useEffect(() => {
    if (activeLine == null) return
    lineRefs.current[activeLine]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeLine])

  const ctrlBtn = (label: string, onClick: () => void, kind: 'solid' | 'soft' | 'ghost', disabled?: boolean): React.ReactElement => {
    const skin = kind === 'solid' ? { background: C.accent, color: '#fff', border: 'none' }
      : kind === 'soft' ? { background: C.accentSoft, color: C.accent, border: `1px solid ${C.accent}44` }
      : { background: 'transparent', color: C.muted, border: `1px solid ${C.border}` }
    return <button onClick={disabled ? undefined : onClick} disabled={disabled}
      style={{ flex: 1, ...skin, borderRadius: 12, padding: '11px 8px', fontFamily: FONT, fontWeight: 700, fontSize: 14, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1 }}>{label}</button>
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: C.bg, color: C.text, fontFamily: FONT, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 10, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>‹ Đóng</button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {draft.title || 'Luyện tập'}
        </span>
        <span style={{ width: 48 }} />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px 16px', maxWidth: 720, width: '100%', margin: '0 auto', minHeight: 0 }}>
        {draft.videoId && (
          <div style={{ aspectRatio: '16 / 9', borderRadius: 14, overflow: 'hidden', background: '#000', flexShrink: 0 }}>
            <iframe ref={iframeRef} src={buildEmbedUrl(draft.videoId)} title="YouTube"
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen
              onLoad={() => { setTimeout(startListening, 400); setTimeout(startListening, 1200) }} />
          </div>
        )}

        {/* Controls */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {ctrlBtn(playing ? '⏸ Tạm dừng' : '▶ Phát', () => playing ? pause() : play(), 'solid', !playerReady)}
          {ctrlBtn('⏮ Về đầu', () => seekTo(0), 'ghost', !playerReady)}
          {ctrlBtn('🔊 Metro', toggleMetro, metronomeOn ? 'solid' : 'soft', !hasGrid)}
        </div>

        {/* Dải hợp âm hiện tại */}
        {hasChords && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '10px 14px', flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: C.muted }}>HỢP ÂM</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: currentChord ? C.accent : C.dim, lineHeight: 1.1 }}>{currentChord ?? '—'}</div>
            </div>
            <div style={{ flex: 1 }} />
            {currentChord && chordShape(currentChord) && <ChordDiagram shape={chordShape(currentChord)!} width={64} />}
          </div>
        )}

        {/* Karaoke */}
        <div style={{ flex: 1, minHeight: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: C.muted, marginBottom: 8 }}>LỜI BÀI HÁT</div>
          {words.length === 0 ? (
            <div style={{ color: C.muted, fontSize: 14, flex: 1 }}>Bài này chưa có lời.</div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', padding: '8vh 0', maskImage: 'linear-gradient(to bottom, transparent, #000 16%, #000 84%, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 16%, #000 84%, transparent)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {lines.map(ln => {
                  const dist = activeLine != null ? Math.abs(activeLine - ln.line) : null
                  const opacity = dist == null ? 0.72 : dist === 0 ? 1 : dist === 1 ? 0.5 : dist === 2 ? 0.32 : 0.2
                  const isActiveLine = dist === 0
                  return (
                    <div key={ln.line} ref={el => { lineRefs.current[ln.line] = el }}
                      style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 6px', justifyContent: 'center', alignItems: 'flex-end', opacity, transition: 'opacity 0.3s' }}>
                      {ln.words.map(w => {
                        const isActive = activeWordIndex === w.index
                        const chord = chordByWord.get(w.index)
                        const size = isActive ? 27 : isActiveLine ? 23 : 19
                        return (
                          <div key={w.index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                            {chord && <span style={{ fontSize: isActiveLine ? 15 : 13, fontWeight: 800, color: C.accent }}>{chord}</span>}
                            <span style={{
                              fontSize: size, fontWeight: isActive ? 800 : isActiveLine ? 700 : 600,
                              color: isActive ? '#1A1200' : C.text,
                              background: isActive ? C.amber : 'transparent', borderRadius: 9,
                              padding: isActive ? '2px 9px' : '0 2px',
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

        {/* Stats */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {stat('BPM', hasGrid ? String(Math.round(fit!.bpm)) : '—', C.accent)}
          {stat('Nhịp', `${draft.timeSignature}/4`, C.text)}
          {stat('Mốc', String(draft.anchors.length), C.green)}
        </div>
      </div>
    </div>
  )

  function stat(label: string, value: string, color: string) {
    return (
      <div style={{ flex: 1, textAlign: 'center', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 4px' }}>
        <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color }}>{value}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{label}</div>
      </div>
    )
  }
}
