import { useState, useEffect, useRef, useCallback } from 'react'
import type { RhythmSong } from './types'
import { supabase } from './supabase'
import { SongList } from './SongList'

type Props = {
  song: RhythmSong
  onClose: () => void
  userRole?: string
}

type Dot = { time: number }
type ScoredDot = Dot & { hit: boolean; offset: number }

function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)
  return m ? m[1] : null
}

// ─────────────────────────────────────────────
// Shared: YouTube player hook
// ─────────────────────────────────────────────
function useYouTube(ytId: string | null, onEnded: () => void) {
  const playerRef = useRef<any>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!(window as any).YT) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(script)
    }
  }, [])

  const initPlayer = useCallback((id: string) => {
    const YT = (window as any).YT
    if (!YT?.Player) { (window as any).onYouTubeIframeAPIReady = () => initPlayer(id); return }
    playerRef.current?.destroy()
    playerRef.current = new YT.Player('yt-player', {
      videoId: id,
      playerVars: { controls: 1, rel: 0 },
      events: {
        onReady: (e: any) => setDuration(e.target.getDuration()),
        onStateChange: (e: any) => { if (e.data === 0) onEnded() }
      }
    })
  }, [onEnded])

  useEffect(() => {
    if (ytId) setTimeout(() => initPlayer(ytId), 300)
  }, [ytId])

  useEffect(() => {
    const tick = () => {
      if (playerRef.current?.getCurrentTime) {
        setCurrentTime(playerRef.current.getCurrentTime())
        const d = playerRef.current.getDuration?.()
        if (d > 0) setDuration(d)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return { playerRef, currentTime, duration }
}

// ─────────────────────────────────────────────
// Shared: TAP area + timeline + countdown
// ─────────────────────────────────────────────
function TapArea({ phase, tapMode, isTeacher, teacherDots, studentDots, scoredStudent,
  currentTime, duration, countdown, onTap, onStart, onRetry, onSave, saving,
  onToggleTapMode, score, stars }: any) {

  const tapBtnRef = useRef<HTMLButtonElement>(null)
  const pct = (t: number) => duration > 0 ? (t / duration) * 100 : 0

  const handleTap = () => {
    onTap()
    if (tapBtnRef.current) {
      tapBtnRef.current.style.transform = 'scale(0.92)'
      setTimeout(() => { if (tapBtnRef.current) tapBtnRef.current.style.transform = 'scale(1)' }, 80)
    }
  }

  return (
    <>
      {/* Timeline */}
      <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#374151', fontSize: 12 }}>
          <span>{Math.floor(currentTime/60)}:{String(Math.floor(currentTime%60)).padStart(2,'0')}</span>
          <span>{Math.floor(duration/60)}:{String(Math.floor(duration%60)).padStart(2,'0')}</span>
        </div>

        {/* Track thầy */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#F59E0B', fontSize: 12, fontWeight: 700, width: 72, flexShrink: 0 }}>
            {isTeacher ? '👨‍🏫 Thầy' : '🎯 Đáp án'}
          </span>
          <div style={{ position: 'relative', flex: 1, height: 36, background: '#0F1117', borderRadius: 6, border: `1px solid ${tapMode==='teacher' && isTeacher ? '#F59E0B' : '#1E2533'}`, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top:0, left:0, bottom:0, width:`${pct(currentTime)}%`, background:'rgba(245,158,11,0.06)' }} />
            {teacherDots.map((d: Dot, i: number) => (
              <div key={i} style={{ position:'absolute', left:`${pct(d.time)}%`, top:'50%', transform:'translate(-50%,-50%)', width:8, height:8, borderRadius:'50%', background:'#F59E0B' }} />
            ))}
            {duration > 0 && <div style={{ position:'absolute', top:0, bottom:0, left:`${pct(currentTime)}%`, width:2, background:'#F59E0B', opacity:0.4 }} />}
          </div>
          {teacherDots.length > 0 && <span style={{ color:'#F59E0B', fontSize:12, width:28 }}>{teacherDots.length}</span>}
        </div>

        {/* Track học sinh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color:'#60A5FA', fontSize:12, fontWeight:700, width:72, flexShrink:0 }}>🎓 Bạn</span>
          <div style={{ position:'relative', flex:1, height:36, background:'#0F1117', borderRadius:6, border:`1px solid ${tapMode==='student' ? '#60A5FA' : '#1E2533'}`, overflow:'hidden' }}>
            <div style={{ position:'absolute', top:0, left:0, bottom:0, width:`${pct(currentTime)}%`, background:'rgba(96,165,250,0.06)' }} />
            {(phase==='result' ? scoredStudent : studentDots.map((d: Dot) => ({...d, hit:true, offset:0}))).map((d: any, i: number) => (
              <div key={i} style={{ position:'absolute', left:`${pct(d.time)}%`, top:'50%', transform:'translate(-50%,-50%)', width:8, height:8, borderRadius:'50%',
                background: phase==='result' ? (d.hit ? '#10B981' : '#EF4444') : '#60A5FA',
                boxShadow: phase!=='result' ? '0 0 6px #60A5FA' : 'none' }} />
            ))}
            {duration > 0 && <div style={{ position:'absolute', top:0, bottom:0, left:`${pct(currentTime)}%`, width:2, background:'#60A5FA', opacity:0.4 }} />}
          </div>
          {studentDots.length > 0 && <span style={{ color:'#60A5FA', fontSize:12, width:28 }}>{studentDots.length}</span>}
        </div>

        {phase==='result' && <div style={{ display:'flex', gap:16, fontSize:12, color:'#6B7280' }}>
          <span><span style={{color:'#10B981'}}>●</span> Đúng (≤0.25s)</span>
          <span><span style={{color:'#EF4444'}}>●</span> Lệch</span>
          <span><span style={{color:'#F59E0B'}}>●</span> Đáp án thầy</span>
        </div>}
      </div>

      {/* Score */}
      {phase==='result' && teacherDots.length > 0 && (
        <div style={{ textAlign:'center', paddingBottom:8 }}>
          <div style={{ fontSize:44, fontWeight:900, color: score>=60 ? '#10B981' : '#EF4444' }}>{score}<span style={{fontSize:17}}>/100</span></div>
          <div style={{ fontSize:20 }}>{'⭐'.repeat(stars)}{'☆'.repeat(5-stars)}</div>
          <div style={{ fontSize:12, color:'#6B7280' }}>{scoredStudent.filter((d:any)=>d.hit).length}/{teacherDots.length} phách đúng</div>
        </div>
      )}

      {/* Buttons */}
      <div style={{ padding:'8px 20px 12px', display:'flex', gap:12, justifyContent:'center', alignItems:'center', flexWrap:'wrap' }}>
        {isTeacher && phase==='playing' && (
          <div style={{ display:'flex', borderRadius:8, overflow:'hidden', border:'1px solid #374151' }}>
            <button onClick={() => onToggleTapMode('student')} style={{ padding:'8px 14px', background: tapMode==='student' ? '#60A5FA' : '#1F2937', border:'none', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:13 }}>🎓 Học sinh</button>
            <button onClick={() => onToggleTapMode('teacher')} style={{ padding:'8px 14px', background: tapMode==='teacher' ? '#F59E0B' : '#1F2937', border:'none', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:13 }}>👨‍🏫 Đáp án</button>
          </div>
        )}

        {phase==='countdown' && (
          <div style={{ width:140, height:140, borderRadius:'50%', background:'#1F2937', border:'3px solid #10B981',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize: countdown===0 ? 32 : 64, fontWeight:900, color:'#10B981', userSelect:'none' }}>
            {countdown===0 ? 'GO!' : countdown}
          </div>
        )}

        {(phase==='countdown' || phase==='playing') && (
          <button ref={tapBtnRef} onPointerDown={handleTap} style={{
            width:140, height:140, borderRadius:'50%',
            background: phase==='playing' ? (tapMode==='teacher' ? '#F59E0B' : '#10B981') : '#1F2937',
            border: phase==='countdown' ? '3px solid #374151' : 'none',
            color:'#fff', fontSize: phase==='playing' ? 26 : 16,
            fontWeight:900, cursor:'pointer', transition:'transform 0.08s',
            opacity: phase==='countdown' ? 0.4 : 1,
            userSelect:'none'
          }}>TAP</button>
        )}

        {phase==='idle' && (
          <button onClick={onStart} style={{ width:160, height:56, borderRadius:28, background:'#10B981', border:'none', color:'#fff', fontSize:18, fontWeight:800, cursor:'pointer', boxShadow:'0 0 24px rgba(16,185,129,0.35)' }}>
            ▶ Bắt đầu Tap
          </button>
        )}

        {phase==='result' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8, alignItems:'center' }}>
            <button onClick={onRetry} style={{ padding:'10px 28px', background:'#10B981', border:'none', borderRadius:8, color:'#fff', fontWeight:700, cursor:'pointer' }}>🔄 Thử lại</button>
            {isTeacher && <button onClick={onSave} disabled={saving} style={{ padding:'10px 28px', background:'#F59E0B', border:'none', borderRadius:8, color:'#fff', fontWeight:700, cursor:'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? '⏳...' : '💾 Lưu đáp án thầy'}
            </button>}
          </div>
        )}

        {phase==='playing' && isTeacher && tapMode==='teacher' && teacherDots.length > 0 && (
          <button onClick={onSave} disabled={saving} style={{ padding:'8px 16px', background:'#F59E0B', border:'none', borderRadius:8, color:'#fff', fontWeight:700, cursor:'pointer', fontSize:13 }}>
            {saving ? '⏳...' : '💾 Lưu ngay'}
          </button>
        )}
      </div>

      <div style={{ textAlign:'center', color:'#374151', fontSize:12, paddingBottom:8 }}>
        {phase==='idle' && 'Nhấn ▶ Bắt đầu hoặc Space'}
        {phase==='countdown' && 'Chuẩn bị tập trung...'}
        {phase==='playing' && 'Nhấn TAP hoặc Space khi đến phách mạnh'}
        {phase==='result' && 'Xong! Xem kết quả bên trên'}
      </div>
    </>
  )
}

// ─────────────────────────────────────────────
// useTapLogic — shared tap state
// ─────────────────────────────────────────────
function useTapLogic(playerRef: React.MutableRefObject<any>, isTeacher: boolean, songTitle: string, ytUrl: string) {
  const [teacherDots, setTeacherDots] = useState<Dot[]>([])
  const [studentDots, setStudentDots] = useState<Dot[]>([])
  const [phase, setPhase] = useState<'idle'|'countdown'|'playing'|'result'>('idle')
  const [countdown, setCountdown] = useState(3)
  const [tapMode, setTapMode] = useState<'teacher'|'student'>('student')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const handleStart = useCallback(() => {
    if (phase !== 'idle') return
    setStudentDots([])
    if (tapMode === 'teacher') setTeacherDots([])
    setPhase('countdown')
    setCountdown(3)
    let c = 3
    const iv = setInterval(() => {
      c--; setCountdown(c)
      if (c === 0) { clearInterval(iv); setPhase('playing'); playerRef.current?.seekTo(0); playerRef.current?.playVideo() }
    }, 1000)
  }, [phase, tapMode, playerRef])

  const handleTap = useCallback(() => {
    if (phase !== 'playing' && phase !== 'countdown') return
    const t = playerRef.current?.getCurrentTime?.() ?? 0
    if (tapMode === 'teacher') setTeacherDots(prev => [...prev, { time: t }])
    else setStudentDots(prev => [...prev, { time: t }])
  }, [phase, tapMode, playerRef])

  const handleEnded = useCallback(() => setPhase('result'), [])

  const handleRetry = useCallback(() => {
    playerRef.current?.seekTo(0)
    setStudentDots([])
    setPhase('idle')
  }, [playerRef])

  const handleSave = useCallback(async () => {
    if (!songTitle) { alert('Bài chưa có tên!'); return }
    setSaving(true)
    const { error } = await supabase.from('timming_songs')
      .update({ teacher_taps: teacherDots, youtube_url: ytUrl, updated_at: new Date().toISOString() })
      .eq('title', songTitle)
    setSaving(false)
    setSaveMsg(error ? '❌ ' + error.message : '✅ Đã lưu!')
    setTimeout(() => setSaveMsg(''), 3000)
  }, [teacherDots, songTitle, ytUrl])

  const refDots = teacherDots
  const scoredStudent: ScoredDot[] = studentDots.map(d => {
    if (refDots.length === 0) return { ...d, hit: false, offset: 999 }
    const nearest = refDots.reduce((a, b) => Math.abs(a.time-d.time) < Math.abs(b.time-d.time) ? a : b)
    const offset = Math.abs(d.time - nearest.time)
    return { ...d, hit: offset <= 0.25, offset }
  })
  const score = refDots.length > 0 ? Math.round(scoredStudent.filter(d=>d.hit).length / refDots.length * 100) : 0
  const stars = score>=90?5:score>=75?4:score>=60?3:score>=40?2:1

  return { teacherDots, setTeacherDots, studentDots, phase, setPhase, countdown, tapMode, setTapMode,
    saving, saveMsg, handleStart, handleTap, handleEnded, handleRetry, handleSave,
    scoredStudent, score, stars }
}

// ─────────────────────────────────────────────
// Mode 3: Chỉ YouTube (không chọn bài)
// ─────────────────────────────────────────────
function TapYouTubeOnly({ isTeacher, onPickSong }: { isTeacher: boolean; onPickSong: () => void }) {
  const [ytUrl, setYtUrl] = useState('')
  const [ytId, setYtId] = useState<string | null>(null)

  const tap = useTapLogic(
    { current: null } as any,
    isTeacher, '', ytUrl
  )

  const { playerRef, currentTime, duration } = useYouTube(ytId, tap.handleEnded)
  // sync playerRef
  ;(tap as any).playerRef = playerRef

  const handleLoad = () => {
    const id = extractYouTubeId(ytUrl)
    if (!id) { alert('Link không hợp lệ'); return }
    setYtId(id)
    tap.setPhase('idle')
    tap.setTeacherDots([])
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); if (tap.phase==='idle') tap.handleStart(); else tap.handleTap() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [tap.phase, tap.handleStart, tap.handleTap])

  return (
    <>
      <div style={{ padding:'12px 20px', display:'flex', gap:8, borderBottom:'1px solid #1E2533' }}>
        <input value={ytUrl} onChange={e => setYtUrl(e.target.value)} placeholder="Dán link YouTube..."
          style={{ flex:1, padding:'8px 12px', background:'#1E2533', border:'1px solid #374151', borderRadius:8, color:'#fff', fontSize:15, outline:'none' }}
          onKeyDown={e => e.key==='Enter' && handleLoad()} />
        <button onClick={handleLoad} style={{ padding:'8px 18px', background:'#10B981', border:'none', borderRadius:8, color:'#fff', fontWeight:700, cursor:'pointer' }}>Tải</button>
        <button onClick={onPickSong} style={{ padding:'8px 14px', background:'#1E2533', border:'1px solid #374151', borderRadius:8, color:'#10B981', fontWeight:700, cursor:'pointer' }}>🎵 Chọn bài</button>
      </div>

      <div style={{ padding:'12px 20px 0' }}>
        <div id="yt-player" style={{ width:'100%', aspectRatio:'16/6', borderRadius:10, overflow:'hidden', background:'#000', display: ytId ? 'block' : 'none' }} />
        {!ytId && <div style={{ height:100, display:'flex', alignItems:'center', justifyContent:'center', color:'#374151', fontSize:15, border:'1px dashed #1E2533', borderRadius:10 }}>
          Dán link YouTube để bắt đầu · hoặc Chọn bài có sẵn
        </div>}
      </div>

      <div style={{ flex:1 }}>
        <TapArea {...tap} isTeacher={isTeacher} currentTime={currentTime} duration={duration}
          onToggleTapMode={tap.setTapMode} onRetry={tap.handleRetry} onSave={tap.handleSave}
          onStart={tap.handleStart} onTap={tap.handleTap} />
      </div>
      {tap.saveMsg && <div style={{ textAlign:'center', color: tap.saveMsg.startsWith('✅') ? '#10B981' : '#EF4444', fontSize:14, paddingBottom:4 }}>{tap.saveMsg}</div>}
    </>
  )
}

// ─────────────────────────────────────────────
// Mode 1+2: Tap với bài hát (có/không có YouTube)
// ─────────────────────────────────────────────
function TapWithSong({ initialSong, isTeacher, onPickSong }: {
  initialSong: RhythmSong | null
  isTeacher: boolean
  onPickSong: () => void
}) {
  const [activeSong, setActiveSong] = useState<RhythmSong | null>(initialSong)
  const [ytId, setYtId] = useState<string | null>(null)
  const [ytUrl, setYtUrl] = useState('')
  const [speed, setSpeed] = useState(1)
  const [hasYT, setHasYT] = useState(false)

  const tap = useTapLogic(
    { current: null } as any,
    isTeacher,
    activeSong?.title || '',
    ytUrl
  )

  const { playerRef, currentTime, duration } = useYouTube(ytId, tap.handleEnded)

  const loadSong = async (song: RhythmSong) => {
    setActiveSong(song)
    tap.setPhase('idle')
    tap.setTeacherDots([])
    const { data } = await supabase.from('timming_songs')
      .select('teacher_taps, youtube_url')
      .eq('title', song.title)
      .maybeSingle()
    if (data?.teacher_taps) tap.setTeacherDots(data.teacher_taps)
    if (data?.youtube_url) {
      setYtUrl(data.youtube_url)
      const id = extractYouTubeId(data.youtube_url)
      if (id) { setYtId(id); setHasYT(true) }
    } else {
      setHasYT(false); setYtId(null)
    }
  }

  useEffect(() => { if (initialSong) loadSong(initialSong) }, [])

  // Metronome cho Mode 1 (không có YouTube)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const schedulerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const nextBeatRef = useRef(0)
  const songTimeRef = useRef(0)
  const wallRef = useRef(0)
  const [songTime, setSongTime] = useState(0)
  const rafRef = useRef<number>(0)

  const beatDur = activeSong ? 60 / activeSong.tempo / speed : 0.5
  const totalDur = activeSong ? activeSong.totalBars * activeSong.timeSignature * beatDur : 0

  useEffect(() => {
    if (hasYT || tap.phase !== 'playing') return
    // Start metronome
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
    const ctx = audioCtxRef.current
    if (ctx.state === 'suspended') ctx.resume()
    wallRef.current = performance.now()
    songTimeRef.current = 0
    nextBeatRef.current = ctx.currentTime + 0.1
    let beatIdx = 0

    schedulerRef.current = setInterval(() => {
      const c = audioCtxRef.current!
      while (nextBeatRef.current < c.currentTime + 0.08) {
        const osc = c.createOscillator()
        const gain = c.createGain()
        osc.connect(gain); gain.connect(c.destination)
        const isBar1 = beatIdx % (activeSong?.timeSignature ?? 4) === 0
        osc.frequency.value = isBar1 ? 880 : 440
        gain.gain.setValueAtTime(0.5, nextBeatRef.current)
        gain.gain.exponentialRampToValueAtTime(0.001, nextBeatRef.current + 0.08)
        osc.start(nextBeatRef.current); osc.stop(nextBeatRef.current + 0.1)
        nextBeatRef.current += beatDur
        beatIdx++
      }
    }, 25)

    const tick = () => {
      const t = (performance.now() - wallRef.current) / 1000
      songTimeRef.current = t
      setSongTime(t)
      if (t >= totalDur) { tap.handleEnded(); return }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (schedulerRef.current) clearInterval(schedulerRef.current)
      cancelAnimationFrame(rafRef.current)
    }
  }, [tap.phase, hasYT, speed])

  const tapCurrentTime = hasYT ? currentTime : songTime
  const tapDuration = hasYT ? duration : totalDur

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); if (tap.phase==='idle') tap.handleStart(); else tap.handleTap() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [tap.phase, tap.handleStart, tap.handleTap])

  // Override handleTap cho mode không có YouTube
  const handleTapMode1 = useCallback(() => {
    if (tap.phase !== 'playing' && tap.phase !== 'countdown') return
    const t = hasYT ? (playerRef.current?.getCurrentTime?.() ?? 0) : songTimeRef.current
    if (tap.tapMode === 'teacher') tap.setTeacherDots((prev: Dot[]) => [...prev, { time: t }])
    else tap.setTeacherDots === tap.setTeacherDots && tap.studentDots !== undefined &&
      (tap as any).setStudentDots((prev: Dot[]) => [...prev, { time: t }])
  }, [tap.phase, tap.tapMode, hasYT, playerRef])

  return (
    <>
      {/* Song info bar */}
      <div style={{ padding:'8px 20px', background:'#0F1117', borderBottom:'1px solid #1E2533', display:'flex', gap:12, alignItems:'center' }}>
        {activeSong ? (
          <>
            <span style={{ color:'#fff', fontWeight:700, fontSize:15 }}>{activeSong.title}</span>
            {activeSong.artist && <span style={{ color:'#6B7280', fontSize:13 }}>— {activeSong.artist}</span>}
            <span style={{ color:'#374151', fontSize:12 }}>{activeSong.tone} · {activeSong.tempo} BPM · {activeSong.timeSignature}/4</span>
            {hasYT && <span style={{ color:'#10B981', fontSize:12 }}>▶ YouTube</span>}
            {!hasYT && <span style={{ color:'#F59E0B', fontSize:12 }}>🥁 Metronome</span>}
          </>
        ) : (
          <span style={{ color:'#6B7280', fontSize:14 }}>Chưa chọn bài</span>
        )}
        <button onClick={onPickSong} style={{ marginLeft:'auto', padding:'4px 12px', background:'#1E2533', border:'1px solid #374151', borderRadius:6, color:'#10B981', fontWeight:700, cursor:'pointer', fontSize:13 }}>
          🎵 Chọn bài
        </button>
        {/* Speed (mode 1 — không có YT) */}
        {!hasYT && activeSong && (
          <div style={{ display:'flex', gap:4 }}>
            {[0.5,0.75,1,1.25].map(s => (
              <button key={s} onClick={() => setSpeed(s)} style={{ padding:'3px 8px', borderRadius:4, border:'none', background: speed===s ? '#10B981' : '#1E2533', color:'#fff', fontSize:12, cursor:'pointer', fontWeight: speed===s ? 700 : 400 }}>
                {s===1?'100%':s===0.5?'50%':s===0.75?'75%':'125%'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* YouTube player (mode 2) */}
      {hasYT && (
        <div style={{ padding:'8px 20px 0' }}>
          <div id="yt-player" style={{ width:'100%', aspectRatio:'16/6', borderRadius:10, overflow:'hidden', background:'#000' }} />
        </div>
      )}

      {/* Mode 1: không có YouTube — hiện lời */}
      {!hasYT && activeSong && (
        <div style={{ padding:'8px 20px', flex:1, display:'flex', alignItems:'center', justifyContent:'center', overflowX:'hidden' }}>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center', maxHeight:120, overflow:'hidden' }}>
            {activeSong.lyrics.map((l, i) => {
              const beatDurBase = 60 / activeSong.tempo
              const isActive = songTime >= l.time && songTime < (activeSong.lyrics[i+1]?.time ?? l.time + beatDurBase*2)
              return (
                <span key={l.id} style={{ fontSize: isActive ? 22 : 16, fontWeight: isActive ? 800 : 500,
                  color: isActive ? '#10B981' : '#4B5563', transition:'all 0.1s' }}>
                  {l.text}
                </span>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ flex: hasYT ? 1 : 'unset' }}>
        <TapArea {...tap} isTeacher={isTeacher} currentTime={tapCurrentTime} duration={tapDuration}
          onToggleTapMode={tap.setTapMode} onRetry={tap.handleRetry} onSave={tap.handleSave}
          onStart={tap.handleStart} onTap={tap.handleTap} />
      </div>
      {tap.saveMsg && <div style={{ textAlign:'center', color: tap.saveMsg.startsWith('✅') ? '#10B981' : '#EF4444', fontSize:14, paddingBottom:4 }}>{tap.saveMsg}</div>}
    </>
  )
}

// ─────────────────────────────────────────────
// TapMode — Router chính
// ─────────────────────────────────────────────
export function TapMode({ song, onClose, userRole }: Props) {
  const isTeacher = userRole === 'teacher' || userRole === 'admin'
  const hasSong = !!(song?.title)
  // mode: 'song' | 'youtube'
  const [mode, setMode] = useState<'song'|'youtube'>(hasSong ? 'song' : 'youtube')
  const [showSongList, setShowSongList] = useState(false)
  const [pickedSong, setPickedSong] = useState<RhythmSong | null>(hasSong ? song : null)

  return (
    <div style={{ position:'fixed', inset:0, background:'#0A0E1A', display:'flex', flexDirection:'column', zIndex:200, fontFamily:'Inter, sans-serif' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 20px', borderBottom:'1px solid #1E2533', flexShrink:0 }}>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ color:'#fff', fontWeight:800, fontSize:17 }}>🥁 Tap nhịp</span>
          {/* Mode tabs */}
          <div style={{ display:'flex', borderRadius:8, overflow:'hidden', border:'1px solid #374151', marginLeft:12 }}>
            <button onClick={() => setMode('song')} style={{ padding:'5px 14px', background: mode==='song' ? '#10B981' : '#1F2937', border:'none', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:13 }}>
              🎵 Theo bài
            </button>
            <button onClick={() => setMode('youtube')} style={{ padding:'5px 14px', background: mode==='youtube' ? '#10B981' : '#1F2937', border:'none', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:13 }}>
              ▶ YouTube
            </button>
          </div>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'1px solid #374151', borderRadius:6, color:'#9CA3AF', cursor:'pointer', padding:'4px 12px' }}>✕</button>
      </div>

      {/* Content */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {mode === 'song'
          ? <TapWithSong initialSong={pickedSong} isTeacher={isTeacher} onPickSong={() => setShowSongList(true)} />
          : <TapYouTubeOnly isTeacher={isTeacher} onPickSong={() => { setMode('song'); setShowSongList(true) }} />
        }
      </div>

      {showSongList && (
        <SongList
          onSelect={(s: RhythmSong) => { setPickedSong(s); setMode('song'); setShowSongList(false) }}
          onClose={() => setShowSongList(false)}
        />
      )}

      <style>{`@keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }`}</style>
    </div>
  )
}
