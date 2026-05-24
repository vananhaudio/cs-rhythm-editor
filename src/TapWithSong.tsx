import { useState, useEffect, useRef, useCallback } from 'react'
import type { RhythmSong } from './types'
import { supabase } from './supabase'
import { SongList } from './SongList'

type Dot = { time: number }
type ScoredDot = Dot & { hit: boolean }

const PX_PER_SEC = 120
const NOW_X_FRAC = 0.3

export function TapWithSong({ onClose, userRole }: {
  onClose: () => void
  userRole?: string
}) {
  const isTeacher = userRole === 'teacher' || userRole === 'admin'

  const [song, setSong] = useState<RhythmSong | null>(null)
  const [showSongList, setShowSongList] = useState(false)
  const [teacherDots, setTeacherDots] = useState<Dot[]>([])
  const [showTeacher, setShowTeacher] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [songTime, setSongTime] = useState(0)
  const songTimeRef = useRef(0)
  const wallRef = useRef(0)
  const rafRef = useRef<number>(0)
  const [studentDots, setStudentDots] = useState<Dot[]>([])
  const [saveMsg, setSaveMsg] = useState('')
  const [history, setHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [viewingDots, setViewingDots] = useState<Dot[] | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])
  const scrollRef = useRef<HTMLDivElement>(null)
  const [containerW, setContainerW] = useState(800)

  useEffect(() => {
    if (!scrollRef.current) return
    const ro = new ResizeObserver(e => setContainerW(e[0].contentRect.width))
    ro.observe(scrollRef.current)
    return () => ro.disconnect()
  }, [])

  const loadSong = async (s: RhythmSong) => {
    setSong(s)
    setStudentDots([])
    setTeacherDots([])
    setShowTeacher(false)
    setSongTime(0)
    songTimeRef.current = 0
    setIsPlaying(false)
    const { data } = await supabase.from('timming_songs')
      .select('teacher_taps')
      .eq('title', s.title)
      .maybeSingle()
    if (data?.teacher_taps) setTeacherDots(data.teacher_taps)
    // Load lịch sử tap của user
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: hist } = await supabase.from('student_taps')
        .select('*')
        .eq('user_id', user.id)
        .eq('song_title', s.title)
        .order('created_at', { ascending: false })
        .limit(20)
      setHistory(hist ?? [])
    }
  }

  const audioCtxRef = useRef<AudioContext | null>(null)
  const schedulerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const nextBeatRef = useRef(0)
  const beatIdxRef = useRef(0)

  const stopMetronome = () => {
    if (schedulerRef.current) { clearInterval(schedulerRef.current); schedulerRef.current = null }
  }

  const startMetronome = useCallback((fromTime: number) => {
    if (!song) return
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
    const ctx = audioCtxRef.current
    if (ctx.state === 'suspended') ctx.resume()
    const beatDur = 60 / song.tempo / speed
    const beatsElapsed = Math.floor(fromTime / beatDur)
    beatIdxRef.current = beatsElapsed
    const timeToNext = (beatsElapsed + 1) * beatDur - fromTime
    nextBeatRef.current = ctx.currentTime + timeToNext
    stopMetronome()
    schedulerRef.current = setInterval(() => {
      const c = audioCtxRef.current!
      const bd = 60 / song.tempo / speed
      while (nextBeatRef.current < c.currentTime + 0.08) {
        const osc = c.createOscillator()
        const gain = c.createGain()
        osc.connect(gain); gain.connect(c.destination)
        const isBar1 = beatIdxRef.current % song.timeSignature === 0
        osc.frequency.value = isBar1 ? 880 : 440
        gain.gain.setValueAtTime(0.45, nextBeatRef.current)
        gain.gain.exponentialRampToValueAtTime(0.001, nextBeatRef.current + 0.07)
        osc.start(nextBeatRef.current); osc.stop(nextBeatRef.current + 0.1)
        nextBeatRef.current += bd
        beatIdxRef.current++
      }
    }, 25)
  }, [song, speed])

  const totalDur = song ? song.totalBars * (60 / song.tempo) * song.timeSignature / speed : 0

  useEffect(() => {
    if (!song) return
    if (isPlaying) {
      wallRef.current = performance.now() - songTimeRef.current * 1000
      startMetronome(songTimeRef.current)
      const tick = () => {
        const t = (performance.now() - wallRef.current) / 1000
        if (t >= totalDur) {
          songTimeRef.current = totalDur
          setSongTime(totalDur)
          setIsPlaying(false)
          stopMetronome()
          return
        }
        songTimeRef.current = t
        setSongTime(t)
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } else {
      cancelAnimationFrame(rafRef.current)
      stopMetronome()
    }
    return () => { cancelAnimationFrame(rafRef.current); stopMetronome() }
  }, [isPlaying, song, speed])

  const isPlayingRef = useRef(false)
  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])
  const handleTap = useCallback(() => {
    if (!isPlayingRef.current) return
    setStudentDots(prev => [...prev, { time: songTimeRef.current }])
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.code === 'Space') { e.preventDefault(); handleTap(); }
      if (e.code === 'KeyP' || e.code === 'Enter') { e.preventDefault(); if (song) setIsPlaying(p => !p) }
      if (e.code === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [song, onClose])

  const seekTo = (t: number) => {
    const clamped = Math.max(0, Math.min(t, totalDur))
    songTimeRef.current = clamped
    setSongTime(clamped)
    wallRef.current = performance.now() - clamped * 1000
    if (isPlaying) startMetronome(clamped)
  }

  const handleSave = async () => {
    if (!song?.title) return
    if (isTeacher) {
      // Thầy lưu đáp án
      const { error } = await supabase.from('timming_songs')
        .update({ teacher_taps: studentDots, updated_at: new Date().toISOString() })
        .eq('title', song.title)
      setSaveMsg(error ? '❌ ' + error.message : '✅ Đã lưu đáp án thầy!')
    } else {
      // Học sinh lưu kết quả
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSaveMsg('❌ Chưa đăng nhập!'); return }
      const { error } = await supabase.from('student_taps').insert({
        user_id: user.id,
        song_title: song.title,
        dots: studentDots,
        score: score ?? 0,
      })
      if (!error) {
        setSaveMsg('✅ Đã lưu!')
        // Reload lịch sử
        const { data: hist } = await supabase.from('student_taps')
          .select('*').eq('user_id', user.id).eq('song_title', song.title)
          .order('created_at', { ascending: false }).limit(20)
        setHistory(hist ?? [])
      } else { setSaveMsg('❌ ' + error.message) }
    }
    setTimeout(() => setSaveMsg(''), 3000)
  }

  const scoredDots: ScoredDot[] = studentDots.map(d => {
    if (teacherDots.length === 0) return { ...d, hit: false }
    const nearest = teacherDots.reduce((a, b) =>
      Math.abs(a.time - d.time) < Math.abs(b.time - d.time) ? a : b)
    return { ...d, hit: Math.abs(d.time - nearest.time) <= 0.25 }
  })
  const score = teacherDots.length > 0
    ? Math.round(scoredDots.filter(d => d.hit).length / teacherDots.length * 100)
    : null

  const beatDur = song ? 60 / song.tempo / speed : 0.5
  const nowX = containerW * NOW_X_FRAC
  const scrollOffset = songTime * PX_PER_SEC

  const fmtTime = (t: number) => `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`

  return (
    <div style={{ position:'fixed', inset:0, background:'#0A0E1A', display:'flex', flexDirection:'column', zIndex:200, fontFamily:'Inter, sans-serif' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 20px', borderBottom:'1px solid #1E2533', flexShrink:0 }}>
        <span style={{ color:'#fff', fontWeight:800, fontSize:16 }}>🥁 Tap nhịp</span>
        <button onClick={() => setShowSongList(true)} style={{ padding:'5px 14px', background:'#1E2533', border:'1px solid #374151', borderRadius:6, color:'#10B981', fontWeight:700, cursor:'pointer', fontSize:13 }}>
          🎵 Chọn bài
        </button>
        {song && <>
          <span style={{ color:'#fff', fontWeight:700 }}>{song.title}</span>
          {song.artist && <span style={{ color:'#6B7280', fontSize:12 }}>— {song.artist}</span>}
          <span style={{ color:'#374151', fontSize:11 }}>{song.tone && song.tone+' · '}{song.tempo} BPM · {song.timeSignature}/4</span>
        </>}
        {song && (
          <div style={{ display:'flex', gap:3, marginLeft:'auto' }}>
            {[0.5,0.75,1,1.25].map(s => (
              <button key={s} onClick={() => { setSpeed(s); if(isPlaying){setIsPlaying(false); setTimeout(()=>setIsPlaying(true),50)} }}
                style={{ padding:'3px 8px', borderRadius:4, border:'none', background: speed===s?'#10B981':'#1E2533', color:'#fff', fontSize:11, cursor:'pointer', fontWeight: speed===s?700:400 }}>
                {s===0.5?'50%':s===0.75?'75%':s===1?'100%':'125%'}
              </button>
            ))}
          </div>
        )}
        <button onClick={onClose} style={{ background:'none', border:'1px solid #374151', borderRadius:6, color:'#9CA3AF', cursor:'pointer', padding:'4px 12px', marginLeft: song ? 0 : 'auto' }}>✕</button>
      </div>

      {/* Chưa chọn bài */}
      {!song && (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
          <div style={{ fontSize:48 }}>🎵</div>
          <div style={{ color:'#6B7280', fontSize:16 }}>Chọn bài để bắt đầu luyện nhịp</div>
          <button onClick={() => setShowSongList(true)} style={{ padding:'12px 32px', background:'#10B981', border:'none', borderRadius:10, color:'#fff', fontWeight:800, fontSize:16, cursor:'pointer' }}>
            Chọn bài hát
          </button>
        </div>
      )}

      {/* Main */}
      {song && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* Progress */}
          <div style={{ padding:'6px 20px', display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
            <span style={{ color:'#4B5563', fontSize:11, width:36 }}>{fmtTime(songTime)}</span>
            <div style={{ flex:1, height:4, background:'#1E2533', borderRadius:2, cursor:'pointer', position:'relative' }}
              onClick={e => { const r=e.currentTarget.getBoundingClientRect(); seekTo((e.clientX-r.left)/r.width*totalDur) }}>
              <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`${totalDur>0?songTime/totalDur*100:0}%`, background:'#10B981', borderRadius:2 }} />
            </div>
            <span style={{ color:'#4B5563', fontSize:11, width:36, textAlign:'right' }}>{fmtTime(totalDur)}</span>
          </div>

          {/* Scroll area */}
          <div ref={scrollRef} style={{ flex:1, position:'relative', overflow:'hidden' }}>
            {/* Now line */}
            <div style={{ position:'absolute', left:nowX, top:0, bottom:0, width:2, background:'#10B981', opacity:0.5, zIndex:10, pointerEvents:'none' }} />

            {/* Lời */}
            <div style={{ position:'absolute', top:'28%', left:0, right:0, height:48, transform:`translateX(${-scrollOffset+nowX}px)` }}>
              {song.lyrics.map((l,i) => {
                const lx = l.time * PX_PER_SEC
                const nextTime = song.lyrics[i+1]?.time ?? l.time + beatDur*2
                const isActive = songTime >= l.time/speed && songTime < nextTime/speed
                return (
                  <div key={l.id} style={{ position:'absolute', left:lx/speed, transform:'translateX(-50%)',
                    fontSize: isActive?22:17, fontWeight: isActive?800:500,
                    color: isActive?'#10B981':'#E2E8F0', transition:'all 0.08s', whiteSpace:'nowrap', userSelect:'none' }}>
                    {l.text}
                  </div>
                )
              })}
            </div>

            {/* Divider */}
            <div style={{ position:'absolute', top:'calc(28% + 52px)', left:0, right:0, height:1, background:'#1E2533' }} />

            {/* Tap dots */}
            <div style={{ position:'absolute', top:'calc(28% + 60px)', left:0, right:0, height:40, transform:`translateX(${-scrollOffset+nowX}px)` }}>
              {showTeacher && teacherDots.map((d,i) => (
                <div key={i} style={{ position:'absolute', left:d.time*PX_PER_SEC/speed, transform:'translateX(-50%)',
                  width:10, height:10, borderRadius:'50%', background:'#F59E0B',
                  boxShadow:'0 0 6px rgba(245,158,11,0.6)', top:4 }} />
              ))}
              {viewingDots && viewingDots.map((d,i) => (
                <div key={'v'+i} style={{ position:'absolute', left:d.time*PX_PER_SEC, transform:'translateX(-50%)',
                  width:10, height:10, borderRadius:'50%', background:'#A78BFA',
                  boxShadow:'0 0 6px rgba(167,139,250,0.7)', top:14, opacity:0.7 }} />
              ))}
              {scoredDots.map((d,i) => (
                <div key={i} style={{ position:'absolute', left:d.time*PX_PER_SEC, transform:'translateX(-50%)',
                  width:12, height:12, borderRadius:'50%',
                  background: teacherDots.length>0 ? (d.hit?'#10B981':'#EF4444') : '#60A5FA',
                  boxShadow: teacherDots.length===0?'0 0 8px rgba(96,165,250,0.7)':'none', top:14 }} />
              ))}
            </div>

            {/* Beat marks */}
            <div style={{ position:'absolute', bottom:8, left:0, right:0, transform:`translateX(${-scrollOffset+nowX}px)` }}>
              {Array.from({ length: song.totalBars*song.timeSignature }, (_,i) => {
                const t = i*beatDur
                const isBar = i%song.timeSignature===0
                return <div key={i} style={{ position:'absolute', left:t*PX_PER_SEC,
                  width:isBar?2:1, height:isBar?12:8, background:isBar?'#374151':'#1E2533',
                  transform:'translateX(-50%)', bottom:0 }} />
              })}
            </div>
          </div>

          {/* Score */}
          {score!==null && !isPlaying && studentDots.length>0 && (
            <div style={{ textAlign:'center', padding:'4px 0', flexShrink:0 }}>
              <span style={{ fontSize:13, color:score>=60?'#10B981':'#EF4444', fontWeight:700 }}>
                Điểm: {score}/100 · {scoredDots.filter(d=>d.hit).length}/{teacherDots.length} phách đúng
              </span>
            </div>
          )}

          {/* Controls */}
          <div style={{ padding:'10px 20px 12px', display:'flex', gap:12, justifyContent:'center', alignItems:'center', flexShrink:0, flexWrap:'wrap' }}>
            <button onClick={() => setIsPlaying(p=>!p)} style={{ width:48, height:48, borderRadius:'50%', background:'#1E2533', border:'2px solid #374151', color:'#fff', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {isPlaying?'⏸':'▶'}
            </button>

            <button onMouseDown={e => { e.preventDefault(); e.stopPropagation(); handleTap(); }} onTouchStart={e => { e.preventDefault(); e.stopPropagation(); handleTap(); }} style={{ width:120, height:120, borderRadius:'50%',
              background: isPlaying?'#10B981':'#1F2937', border:'none', color:'#fff',
              fontSize: isPlaying?24:16, fontWeight:900, cursor:'pointer', userSelect:'none',
              transition:'background 0.2s', boxShadow: isPlaying?'0 0 30px rgba(16,185,129,0.35)':'none' }}>
              {isPlaying?'TAP':'🎵'}
            </button>

            <button onClick={() => { seekTo(0); setIsPlaying(false) }} style={{ width:48, height:48, borderRadius:'50%', background:'#1E2533', border:'2px solid #374151', color:'#fff', fontSize:18, cursor:'pointer' }}>⏮</button>

            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {teacherDots.length>0 && (
                <button onClick={() => setShowTeacher(t=>!t)} style={{ padding:'6px 14px', borderRadius:6,
                  background: showTeacher?'#F59E0B':'#1E2533',
                  border:`1px solid ${showTeacher?'#F59E0B':'#374151'}`,
                  color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                  {showTeacher?'🙈 Ẩn đáp án':'👁 Xem đáp án'}
                </button>
              )}
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={() => setStudentDots([])} style={{ padding:'6px 14px', borderRadius:6, background:'#1E2533', border:'1px solid #374151', color:'#EF4444', fontSize:12, fontWeight:700, cursor:'pointer' }}>🗑 Xoá</button>
                {studentDots.length > 0 && (
                  <button onClick={handleSave} style={{ padding:'6px 14px', borderRadius:6, background: isTeacher ? '#F59E0B' : '#10B981', border:'none', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                    {isTeacher ? '💾 Lưu đáp án' : '💾 Lưu kết quả'}
                  </button>
                )}
                {history.length > 0 && (
                  <button onClick={() => setShowHistory(h => !h)} style={{ padding:'6px 14px', borderRadius:6, background: showHistory ? '#6366F1' : '#1E2533', border:'1px solid #374151', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                    📋 Lịch sử ({history.length})
                  </button>
                )}
              </div>
            </div>
          </div>

          {saveMsg && <div style={{ textAlign:'center', color:saveMsg.startsWith('✅')?'#10B981':'#EF4444', fontSize:12, paddingBottom:6 }}>{saveMsg}</div>}
          <div style={{ textAlign:'center', color:'#374151', fontSize:11, paddingBottom:8 }}>
            {isPlaying?'Space = TAP · P = Pause · chạm nút TAP':'P hoặc Enter = Play · ⏮ về đầu'}
          </div>
        </div>
      )}

      {showHistory && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={() => setShowHistory(false)}>
          <div style={{ background:'#16213E', borderRadius:16, padding:24, width:'90%', maxWidth:500, maxHeight:'70vh', display:'flex', flexDirection:'column', gap:12 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ margin:0, color:'#fff', fontSize:16 }}>📋 Lịch sử tap — {song?.title}</h3>
              <button onClick={() => setShowHistory(false)} style={{ background:'none', border:'none', color:'#6B7280', cursor:'pointer', fontSize:18 }}>✕</button>
            </div>
            <div style={{ overflowY:'auto', display:'flex', flexDirection:'column', gap:8 }}>
              {history.map((h, i) => (
                <button key={h.id} onClick={() => { setViewingDots(h.dots); setShowHistory(false) }}
                  style={{ background:'rgba(255,255,255,0.03)', border:'1px solid #1E2533', borderRadius:8, padding:'12px 16px', cursor:'pointer', textAlign:'left', color:'#fff' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(99,102,241,0.15)'}
                  onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.03)'}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontWeight:700 }}>Lần {history.length - i}</span>
                    <span style={{ fontSize:18, fontWeight:900, color: h.score >= 60 ? '#10B981' : '#EF4444' }}>{h.score}/100</span>
                  </div>
                  <div style={{ fontSize:11, color:'#6B7280', marginTop:4 }}>
                    {new Date(h.created_at).toLocaleString('vi-VN')} · {h.dots.length} nốt
                  </div>
                </button>
              ))}
            </div>
            {viewingDots && (
              <button onClick={() => setViewingDots(null)} style={{ padding:'8px', background:'#1E2533', border:'1px solid #374151', borderRadius:6, color:'#EF4444', cursor:'pointer', fontSize:12 }}>
                ✕ Xoá xem lại
              </button>
            )}
          </div>
        </div>
      )}

      {showSongList && (
        <SongList
          onSelect={(s: RhythmSong) => { loadSong(s); setShowSongList(false) }}
          onClose={() => setShowSongList(false)}
        />
      )}
    </div>
  )
}
