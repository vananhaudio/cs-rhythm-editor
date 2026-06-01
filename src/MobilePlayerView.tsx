import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { RhythmSong } from './types'
import { SongList } from './SongList'

// ── Design tokens — Dark Studio (mobile) ──
const D = {
  bg:         '#0D0F14',
  bgSurface:  '#141720',
  bgCard:     '#1C2030',
  bgBeat:     '#0A0C10',
  border:     'rgba(255,255,255,0.06)',
  accent:     '#6C63FF',
  accentGlow: 'rgba(108,99,255,0.25)',
  accentLight:'#8B84FF',
  gold:       '#F59E0B',
  goldGlow:   'rgba(245,158,11,0.3)',
  green:      '#22C55E',
  teal:       '#2DD4BF',
  text1:      '#F1F5F9',
  text2:      '#94A3B8',
  text3:      '#475569',
}

function fmtTime(t: number) {
  const s = Math.max(0, t)
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`
}

export function MobilePlayerView({
  song, onClose
}: {
  song: RhythmSong
  onClose: () => void
}) {
  const [isPlaying, setIsPlaying]   = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [speed, setSpeed]           = useState(1)
  const [mute, setMute]             = useState(false)
  const [activeBeatIdx, setActiveBeatIdx] = useState(-1)
  const [showSongList, setShowSongList]   = useState(false)
  const [containerW, setContainerW] = useState(390)

  const isPlayingRef   = useRef(false)
  const currentTimeRef = useRef(0)
  const muteRef        = useRef(false)
  const speedRef       = useRef(1)
  const rafRef         = useRef<number>(0)
  const audioCtxRef    = useRef<AudioContext|null>(null)
  const schedulerRef   = useRef<ReturnType<typeof setInterval>|null>(null)
  const nextBeatRef    = useRef(0)
  const audioStartRef  = useRef<{audioT:number; songT:number}|null>(null)
  const containerRef   = useRef<HTMLDivElement>(null)

  useEffect(() => { muteRef.current = mute }, [mute])
  useEffect(() => { speedRef.current = speed }, [speed])
  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(e => setContainerW(e[0].contentRect.width))
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const beatDur  = 60 / song.tempo
  const barDur   = beatDur * song.timeSignature
  const totalDur = song.totalBars * barDur

  // Chunk logic
  const PPS = 80
  const rawBeats = Math.max(song.timeSignature, Math.floor((containerW - 40) / (PPS * beatDur)))
  const beatsPerTrack = Math.floor(rawBeats / song.timeSignature) * song.timeSignature
  const currentChunk  = Math.floor((currentTime / beatDur) / Math.max(1, beatsPerTrack))
  const activeTrackNum = currentChunk % 2 === 0 ? 1 : 2
  const t1Chunk = activeTrackNum === 1 ? currentChunk : currentChunk + 1
  const t2Chunk = activeTrackNum === 2 ? currentChunk : currentChunk + 1
  const nowX = containerW * 0.3
  const t1ScrollOff = nowX + t1Chunk * beatsPerTrack * beatDur * PPS - 120
  const t2ScrollOff = nowX + t2Chunk * beatsPerTrack * beatDur * PPS - 120
  const trackW = totalDur * PPS + containerW

  // Chord map
  const chordMap = useMemo(() => {
    const m: Record<number,string> = {}
    ;(song.chords??[]).forEach(c => { m[Math.round(c.time/beatDur)] = c.name })
    return m
  }, [song.chords, beatDur])

  function scheduleClick(t: number, accent: 0|1|2) {
    try {
      if (!audioCtxRef.current || muteRef.current) return
      const ctx = audioCtxRef.current
      const osc = ctx.createOscillator(), g = ctx.createGain()
      osc.connect(g); g.connect(ctx.destination)
      osc.frequency.value = accent===0 ? 1100 : accent===1 ? 700 : 440
      const vol = accent===0 ? 0.5 : accent===1 ? 0.32 : 0.22
      g.gain.setValueAtTime(vol, t)
      g.gain.exponentialRampToValueAtTime(0.001, t+(accent===0?0.09:0.06))
      osc.start(t); osc.stop(t+0.12)
    } catch {}
  }

  function getAccent(bib: number, ts: number): 0|1|2 {
    if (bib===0) return 0
    if (ts===6 && bib===3) return 1
    return 2
  }

  function startMetronome(from: number) {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
    const ctx = audioCtxRef.current
    if (ctx.state==='suspended') ctx.resume()
    const bd = beatDur / speedRef.current
    const beats = Math.floor(from / beatDur)
    const timeInBeat = from - beats * beatDur
    const atBeatStart = timeInBeat < 0.03
    nextBeatRef.current = atBeatStart
      ? ctx.currentTime + 0.02
      : ctx.currentTime + (beatDur - timeInBeat) / speedRef.current
    audioStartRef.current = { audioT: ctx.currentTime, songT: from }
    let idx = atBeatStart ? beats : beats + 1
    stopMetronome()
    schedulerRef.current = setInterval(() => {
      const c = audioCtxRef.current; if (!c) return
      while (nextBeatRef.current < c.currentTime + 0.05) {
        scheduleClick(nextBeatRef.current+0.016, getAccent(idx%song.timeSignature, song.timeSignature))
        nextBeatRef.current += bd; idx++
      }
    }, 25)
  }

  function stopMetronome() {
    if (schedulerRef.current) { clearInterval(schedulerRef.current); schedulerRef.current = null }
  }

  // RAF loop
  useEffect(() => {
    let wall = performance.now()
    const tick = () => {
      if (isPlayingRef.current) {
        let t: number
        if (audioCtxRef.current && audioStartRef.current) {
          const a = audioStartRef.current
          t = a.songT + (audioCtxRef.current.currentTime - a.audioT) * speedRef.current
        } else {
          t = currentTimeRef.current + (performance.now()-wall)/1000*speedRef.current
        }
        t = Math.min(t, totalDur)
        currentTimeRef.current = t; setCurrentTime(t)
        setActiveBeatIdx(Math.floor(t/beatDur))
        if (t >= totalDur) {
          isPlayingRef.current = false; setIsPlaying(false)
          audioStartRef.current = null; stopMetronome()
        }
      } else { wall = performance.now() }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [totalDur, beatDur])

  const togglePlay = useCallback(() => {
    if (isPlayingRef.current) {
      isPlayingRef.current = false; setIsPlaying(false)
      stopMetronome(); audioStartRef.current = null
    } else {
      isPlayingRef.current = true; setIsPlaying(true)
      startMetronome(currentTimeRef.current)
    }
  }, [beatDur, song.timeSignature])

  const seekTo = (t: number) => {
    currentTimeRef.current = Math.max(0, Math.min(t, totalDur))
    setCurrentTime(currentTimeRef.current)
    if (isPlayingRef.current) startMetronome(currentTimeRef.current)
  }

  const pct = totalDur > 0 ? currentTime/totalDur*100 : 0

  // ── Render track ──
  const renderTrack = (tScrollOff: number, isActive: boolean, ti: number) => {
    const tChunk = ti===0 ? t1Chunk : t2Chunk
    const beatStart = tChunk * beatsPerTrack
    const beatEnd = Math.min(beatStart + beatsPerTrack, song.totalBars * song.timeSignature)

    const chunkStartTime = beatStart * beatDur
    const chunkEndTime = beatEnd * beatDur
    const trackLyrics = (song.lyrics??[]).filter(l => l.time >= chunkStartTime && l.time < chunkEndTime)

    return (
      <div key={ti} style={{
        height: 86, flexShrink:0, overflow:'hidden',
        borderTop: `1px solid ${D.border}`,
        borderBottom: ti===1 ? `1px solid ${D.border}` : 'none',
        background: isActive ? '#141720' : D.bg,
        opacity: isActive ? 1 : 0.45,
        transition: 'opacity 0.3s, background 0.3s',
        position:'relative',
      }}>
        <div style={{ position:'absolute', top:0, left:0, height:'100%', width:trackW, transform:`translateX(${-tScrollOff}px)`, willChange:'transform' }}>
          {/* Beat + Chord */}
          {Array.from({ length: beatEnd - beatStart }, (_, bi) => {
            const i = beatStart + bi
            const bib = i % song.timeSignature
            const isBar1 = bib === 0
            const isActiveB = activeBeatIdx === i && isActive
            const chord = chordMap[i]
            const cellX = nowX + i * beatDur * PPS
            return (
              <div key={'b'+i} style={{ position:'absolute', left:cellX, top:'50%', height:28, width:PPS*beatDur, transform:'translate(-50%,-100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', borderLeft: isBar1 ? `1px solid rgba(108,99,255,0.2)` : `1px solid rgba(255,255,255,0.03)` }}>
                {isBar1 && <span style={{ position:'absolute', top:2, left:3, fontSize:7, fontFamily:'"DM Mono",monospace', color:'rgba(108,99,255,0.45)' }}>M{Math.floor(i/song.timeSignature)+1}</span>}
                {chord ? (
                  <span style={{ fontSize:14, fontWeight:700, fontFamily:'"Helvetica Neue",Arial,sans-serif', lineHeight:1, transition:'color 0.06s',
                    color: isActiveB ? D.gold : 'rgba(245,158,11,0.55)',
                    textShadow: isActiveB ? `0 0 8px ${D.goldGlow}` : 'none',
                  }}>{chord}</span>
                ) : (
                  <span style={{ fontSize:11, fontFamily:'"DM Mono",monospace', lineHeight:1, transition:'color 0.06s',
                    fontWeight: isActiveB ? 800 : 400,
                    color: isActiveB ? (isBar1 ? '#fff' : D.accentLight) : (isBar1 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.13)'),
                    textShadow: isActiveB ? (isBar1 ? `0 0 8px #fff,0 0 16px ${D.accent}` : `0 0 6px ${D.accent}`) : 'none',
                  }}>{bib+1}</span>
                )}
              </div>
            )
          })}
          {/* Lyrics */}
          {trackLyrics.map((l, li) => {
            const lx = nowX + l.time * PPS
            const nt = trackLyrics[li+1]?.time ?? chunkEndTime
            const active = isActive && currentTime >= l.time && currentTime < nt
            const past   = isActive && currentTime >= nt
            const pctG = active ? Math.min(100, Math.max(0, (currentTime-l.time)/Math.max(0.05,nt-l.time)*100)) : 0
            return (
              <div key={l.id} style={{ position:'absolute', left:lx, top:'calc(50% + 2px)', transform:'translateX(-50%)', pointerEvents:'none', whiteSpace:'nowrap' }}>
                <span style={{
                  fontSize:18, fontWeight:400,
                  fontFamily:'"Helvetica Neue",Arial,sans-serif',
                  ...(active ? {
                    backgroundImage: `linear-gradient(to right,${D.teal} ${pctG}%,rgba(255,255,255,1) ${pctG}%)`,
                    WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
                  } : { color: past ? `rgba(45,212,191,0.7)` : 'rgba(255,255,255,1)' }),
                }}>{l.text}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div style={{ position:'fixed', inset:0, background:D.bg, display:'flex', flexDirection:'column', zIndex:300, fontFamily:'"DM Sans",system-ui,sans-serif', color:D.text1 }}>

      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap');`}</style>

      {/* ── HEADER ── */}
      <div style={{ background:D.bgSurface, borderBottom:`1px solid ${D.border}`, padding:'0 14px', height:52, display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
        <button onClick={onClose}
          style={{ width:32,height:32,borderRadius:8,border:`1px solid ${D.border}`,background:'none',color:D.text3,cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
          ←
        </button>
        <button onClick={() => setShowSongList(true)}
          style={{ flex:1,display:'flex',alignItems:'center',gap:8,padding:'6px 10px',borderRadius:8,border:`1px solid ${D.border}`,background:D.bgCard,cursor:'pointer',minWidth:0 }}>
          <span style={{ fontSize:13 }}>🎵</span>
          <div style={{ minWidth:0,flex:1 }}>
            <div style={{ fontSize:13,fontWeight:700,color:D.text1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{song.title||'Chọn bài'}</div>
            <div style={{ fontSize:10,color:D.text3,fontFamily:'"DM Mono",monospace' }}>{song.tempo} BPM · {song.timeSignature}/4</div>
          </div>
          <span style={{ color:D.text3,fontSize:10,flexShrink:0 }}>▾</span>
        </button>
        <button onClick={() => setMute(v=>!v)}
          style={{ width:32,height:32,borderRadius:8,border:`1px solid ${mute?D.accent+'44':D.border}`,background:mute?`${D.accent}22`:'none',color:mute?D.accentLight:D.text3,cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
          {mute?'🔇':'🔊'}
        </button>
      </div>

      {/* ── SEEK BAR ── */}
      <div style={{ background:D.bgSurface, padding:'8px 14px', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
        <span style={{ fontSize:10,fontFamily:'"DM Mono",monospace',color:D.text3,minWidth:30 }}>{fmtTime(currentTime)}</span>
        <div style={{ flex:1,position:'relative',height:20,cursor:'pointer',display:'flex',alignItems:'center' }}
          onClick={e => { const r=e.currentTarget.getBoundingClientRect(); seekTo((e.clientX-r.left)/r.width*totalDur) }}>
          <div style={{ width:'100%',height:4,background:D.bgCard,borderRadius:2,overflow:'hidden',border:`1px solid ${D.border}` }}>
            <div style={{ height:'100%',width:`${pct}%`,background:`linear-gradient(90deg,${D.accent},${D.accentLight})`,borderRadius:2,transition:'width 0.05s linear' }} />
          </div>
          <div style={{ position:'absolute',left:`${pct}%`,transform:'translateX(-50%)',width:12,height:12,borderRadius:'50%',background:D.accent,border:`2px solid ${D.accentLight}`,pointerEvents:'none',transition:'left 0.05s linear' }} />
        </div>
        <span style={{ fontSize:10,fontFamily:'"DM Mono",monospace',color:D.text3,minWidth:30,textAlign:'right' }}>{fmtTime(totalDur)}</span>
      </div>

      {/* ── 2 TRACKS ── */}
      <div ref={containerRef} style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column', justifyContent:'flex-start' }}>
        {renderTrack(t1ScrollOff, activeTrackNum===1, 0)}
        {renderTrack(t2ScrollOff, activeTrackNum===2, 1)}
      </div>

      {/* ── CONTROLS ── */}
      <div style={{ background:D.bgSurface, borderTop:`1px solid ${D.border}`, padding:'16px 14px 24px', flexShrink:0 }}>
        {/* Speed */}
        <div style={{ display:'flex', justifyContent:'center', gap:6, marginBottom:16 }}>
          {[0.75,1,1.25].map(s => (
            <button key={s} onClick={() => setSpeed(s)}
              style={{ padding:'5px 16px',borderRadius:8,border:'none',cursor:'pointer',fontFamily:'"DM Mono",monospace',fontSize:12,fontWeight:600,
                background: speed===s ? D.accent : D.bgCard,
                color: speed===s ? '#fff' : D.text3,
                boxShadow: speed===s ? `0 2px 10px ${D.accentGlow}` : 'none',
              }}>
              {s===1?'1×':s+'×'}
            </button>
          ))}
        </div>

        {/* Transport */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:20 }}>
          <button onClick={() => seekTo(0)}
            style={{ width:44,height:44,borderRadius:12,border:`1px solid ${D.border}`,background:D.bgCard,color:D.text2,cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center' }}>
            ⏮
          </button>
          <button onClick={togglePlay}
            style={{ width:64,height:64,borderRadius:'50%',border:'none',cursor:'pointer',fontSize:24,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 0.2s',
              background: isPlaying ? D.bgCard : `linear-gradient(135deg,${D.accent},${D.accentLight})`,
              color: isPlaying ? D.accentLight : '#fff',
              boxShadow: isPlaying ? 'none' : `0 6px 20px ${D.accentGlow}`,
            }}>
            {isPlaying?'⏸':'▶'}
          </button>
          <button onClick={() => seekTo(Math.min(totalDur, currentTime+5))}
            style={{ width:44,height:44,borderRadius:12,border:`1px solid ${D.border}`,background:D.bgCard,color:D.text2,cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center' }}>
            +5s
          </button>
        </div>
      </div>

      {showSongList && (
        <SongList
          onSelect={(s: RhythmSong) => { setShowSongList(false); window.location.reload() }}
          onClose={() => setShowSongList(false)}
          isTeacher={false}
        />
      )}
    </div>
  )
}
