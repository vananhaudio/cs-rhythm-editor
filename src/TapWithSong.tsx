import { useState, useEffect, useRef, useCallback } from 'react'
import type { RhythmSong } from './types'
import { supabase } from './supabase'
import { SongList } from './SongList'

type Dot = { time: number }
type ScoredDot = Dot & { hit: boolean }
type TapRecord = { id: string; dots: Dot[]; score: number; level: number; created_at: string }
type Progress = { current_level: number; best_scores: Record<string, number>; unlocked_levels: number[] }

const PX_PER_SEC = 120
const NOW_X_FRAC = 0.3
const UNLOCK_SCORE = 80

function getLevels(timeSig: number): { label: string; beats: number[]; desc: string }[] {
  if (timeSig === 4) return [
    { label: 'Level 1', beats: [1], desc: 'Chỉ tap phách 1 — phách mạnh nhất' },
    { label: 'Level 2', beats: [1,2,3,4], desc: 'Tap đủ 4 phách 1-2-3-4' },
    { label: 'Level 3', beats: [1,3], desc: 'Tap phách 1 và 3' },
    { label: 'Level 4', beats: [2,4], desc: 'Tap phách 2 và 4 — thử thách!' },
  ]
  if (timeSig === 3) return [
    { label: 'Level 1', beats: [1], desc: 'Chỉ tap phách 1' },
    { label: 'Level 2', beats: [1,2,3], desc: 'Tap đủ 3 phách' },
    { label: 'Level 3', beats: [1,3], desc: 'Tap phách 1 và 3' },
    { label: 'Level 4', beats: [2], desc: 'Chỉ tap phách 2' },
  ]
  if (timeSig === 6) return [
    { label: 'Level 1', beats: [1], desc: 'Chỉ tap phách 1' },
    { label: 'Level 2', beats: [1,2,3,4,5,6], desc: 'Tap đủ 6 phách' },
    { label: 'Level 3', beats: [1,4], desc: 'Tap phách 1 và 4' },
    { label: 'Level 4', beats: [2,3,5,6], desc: 'Tap phách 2-3 và 5-6' },
  ]
  return [
    { label: 'Level 1', beats: [1], desc: 'Chỉ tap phách 1' },
    { label: 'Level 2', beats: Array.from({length: timeSig}, (_,i) => i+1), desc: `Tap đủ ${timeSig} phách` },
    { label: 'Level 3', beats: [1,3], desc: 'Tap phách 1 và 3' },
    { label: 'Level 4', beats: [2,4], desc: 'Tap phách 2 và 4' },
  ]
}

function filterDotsForLevel(dots: Dot[], beats: number[], beatDur: number, timeSig: number): Dot[] {
  return dots.filter(d => {
    const beatInBar = Math.round(d.time / beatDur) % timeSig
    const beat = beatInBar === 0 ? timeSig : beatInBar
    return beats.includes(beat)
  })
}

function stars(score: number) {
  if (score >= 95) return 5
  if (score >= 80) return 4
  if (score >= 65) return 3
  if (score >= 50) return 2
  return 1
}

function Confetti({ show }: { show: boolean }) {
  if (!show) return null
  const colors = ['#10B981','#F59E0B','#60A5FA','#F472B6','#A78BFA','#34D399']
  return (
    <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:999, overflow:'hidden' }}>
      {Array.from({length:32},(_,i)=>(
        <div key={i} style={{
          position:'absolute', left:`${Math.random()*100}%`, top:'-10px',
          width:8, height:8, borderRadius: Math.random()>0.5?'50%':2,
          background: colors[i%colors.length],
          animation:`confetti-fall ${1.5+Math.random()}s ease-in forwards`,
          animationDelay:`${Math.random()*0.8}s`,
        }}/>
      ))}
      <style>{`@keyframes confetti-fall{to{transform:translateY(110vh) rotate(720deg);opacity:0}}`}</style>
    </div>
  )
}

export function TapWithSong({ onClose, userRole }: { onClose: () => void; userRole?: string }) {
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
  const isPlayingRef = useRef(false)
  const [progress, setProgress] = useState<Progress>({ current_level:1, best_scores:{'1':0,'2':0,'3':0,'4':0}, unlocked_levels:[1] })
  const [activeLevel, setActiveLevel] = useState(1)
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [prevBest, setPrevBest] = useState(0)
  const [tapHistory, setTapHistory] = useState<TapRecord[]>([])
  const [currentDots, setCurrentDots] = useState<Dot[]>([])
  const [lastScore, setLastScore] = useState<number | null>(null)
  const [saveMsg, setSaveMsg] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const [containerW, setContainerW] = useState(800)
  const [userName, setUserName] = useState('')

  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])

  useEffect(() => {
    if (!scrollRef.current) return
    const ro = new ResizeObserver(e => setContainerW(e[0].contentRect.width))
    ro.observe(scrollRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase.from('app_users').select('name').eq('id', data.user.id).single()
          .then(({ data: u }) => { if (u?.name) setUserName(u.name) })
      }
    })
  }, [])

  const loadProgress = async (title: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('student_progress')
      .select('*').eq('user_id', user.id).eq('song_title', title).maybeSingle()
    if (data) {
      setProgress({ current_level: data.current_level, best_scores: data.best_scores, unlocked_levels: data.unlocked_levels })
      setActiveLevel(data.current_level)
    } else {
      setProgress({ current_level:1, best_scores:{'1':0,'2':0,'3':0,'4':0}, unlocked_levels:[1] })
      setActiveLevel(1)
    }
  }

  const loadHistory = async (title: string, level: number) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('student_taps')
      .select('*').eq('user_id', user.id).eq('song_title', title).eq('level', level)
      .order('created_at', { ascending: false }).limit(5)
    setTapHistory((data ?? []) as TapRecord[])
  }

  const loadSong = async (s: RhythmSong) => {
    setSong(s); setCurrentDots([]); setTapHistory([]); setTeacherDots([])
    setShowTeacher(false); setLastScore(null); setSongTime(0); songTimeRef.current = 0; setIsPlaying(false)
    const { data } = await supabase.from('timming_songs').select('teacher_taps').eq('title', s.title).maybeSingle()
    if (data?.teacher_taps) setTeacherDots(data.teacher_taps)
    await loadProgress(s.title)
  }

  useEffect(() => { if (song) loadHistory(song.title, activeLevel) }, [activeLevel, song?.title])

  const audioCtxRef = useRef<AudioContext | null>(null)
  const schedulerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const nextBeatRef = useRef(0)
  const beatIdxRef = useRef(0)

  const stopMetronome = () => { if (schedulerRef.current) { clearInterval(schedulerRef.current); schedulerRef.current = null } }

  const startMetronome = useCallback((fromTime: number) => {
    if (!song) return
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
    const ctx = audioCtxRef.current
    if (ctx.state === 'suspended') ctx.resume()
    const beatDur = 60 / song.tempo / speed
    const beatsElapsed = Math.floor(fromTime / beatDur)
    beatIdxRef.current = beatsElapsed
    nextBeatRef.current = ctx.currentTime + ((beatsElapsed + 1) * beatDur - fromTime)
    stopMetronome()
    schedulerRef.current = setInterval(() => {
      const c = audioCtxRef.current!
      const bd = 60 / song.tempo / speed
      while (nextBeatRef.current < c.currentTime + 0.08) {
        const osc = c.createOscillator(); const gain = c.createGain()
        osc.connect(gain); gain.connect(c.destination)
        const isBar1 = beatIdxRef.current % song.timeSignature === 0
        osc.frequency.value = isBar1 ? 880 : 440
        gain.gain.setValueAtTime(0.45, nextBeatRef.current)
        gain.gain.exponentialRampToValueAtTime(0.001, nextBeatRef.current + 0.07)
        osc.start(nextBeatRef.current); osc.stop(nextBeatRef.current + 0.1)
        nextBeatRef.current += bd; beatIdxRef.current++
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
        if (t >= totalDur) { songTimeRef.current = totalDur; setSongTime(totalDur); setIsPlaying(false); stopMetronome(); return }
        songTimeRef.current = t; setSongTime(t); rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } else { cancelAnimationFrame(rafRef.current); stopMetronome() }
    return () => { cancelAnimationFrame(rafRef.current); stopMetronome() }
  }, [isPlaying, song, speed])

  const handleTap = useCallback(() => {
    if (!isPlayingRef.current) return
    setCurrentDots(prev => [...prev, { time: songTimeRef.current }])
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.code === 'Space') { e.preventDefault(); handleTap() }
      if (e.code === 'KeyP' || e.code === 'Enter') { e.preventDefault(); if (song) setIsPlaying(p => !p) }
      if (e.code === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [song, onClose, handleTap])

  const seekTo = (t: number) => {
    const c = Math.max(0, Math.min(t, totalDur))
    songTimeRef.current = c; setSongTime(c)
    wallRef.current = performance.now() - c * 1000
    if (isPlaying) startMetronome(c)
  }

  const beatDur = song ? 60 / song.tempo / speed : 0.5
  const levels = song ? getLevels(song.timeSignature) : []
  const levelConfig = levels[activeLevel - 1]
  const targetDots = levelConfig && teacherDots.length > 0
    ? filterDotsForLevel(teacherDots, levelConfig.beats, beatDur * speed, song!.timeSignature)
    : []

  const scoredCurrent: ScoredDot[] = currentDots.map(d => {
    if (targetDots.length === 0) return { ...d, hit: false }
    const nearest = targetDots.reduce((a, b) => Math.abs(a.time - d.time) < Math.abs(b.time - d.time) ? a : b)
    return { ...d, hit: Math.abs(d.time - nearest.time) <= 0.3 }
  })
  const currentScore = targetDots.length > 0 ? Math.round(scoredCurrent.filter(d=>d.hit).length / targetDots.length * 100) : null
  const bestThisLevel = progress.best_scores[String(activeLevel)] ?? 0

  const handleSave = async () => {
    if (!song?.title || currentDots.length === 0) return
    const score = currentScore ?? 0
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaveMsg('❌ Chưa đăng nhập!'); return }
    await supabase.from('student_taps').insert({ user_id: user.id, song_title: song.title, dots: currentDots, score, level: activeLevel })
    const newBestScores = { ...progress.best_scores, [String(activeLevel)]: Math.max(score, bestThisLevel) }
    const newUnlocked = [...progress.unlocked_levels]
    let leveledUp = false
    if (score >= UNLOCK_SCORE && activeLevel < levels.length && !newUnlocked.includes(activeLevel + 1)) {
      newUnlocked.push(activeLevel + 1); leveledUp = true
    }
    await supabase.from('student_progress').upsert({
      user_id: user.id, song_title: song.title,
      current_level: Math.max(progress.current_level, activeLevel),
      best_scores: newBestScores, unlocked_levels: newUnlocked,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,song_title' })
    setPrevBest(bestThisLevel); setLastScore(score)
    setProgress(p => ({ ...p, best_scores: newBestScores, unlocked_levels: newUnlocked }))
    setTapHistory(prev => [{ id: Date.now().toString(), dots: currentDots, score, level: activeLevel, created_at: new Date().toISOString() }, ...prev.slice(0,4)])
    setCurrentDots([])
    if (leveledUp) { setShowConfetti(true); setShowLevelUp(true); setTimeout(() => { setShowConfetti(false); setShowLevelUp(false) }, 4000) }
    else if (score >= 80) { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3000) }
    setSaveMsg('✅ Đã lưu!'); setTimeout(() => setSaveMsg(''), 2000)
  }

  const handleDeleteHistory = async (id: string) => {
    await supabase.from('student_taps').delete().eq('id', id)
    setTapHistory(prev => prev.filter(h => h.id !== id))
  }

  const nowX = containerW * NOW_X_FRAC
  const scrollOffset = songTime * PX_PER_SEC
  const fmtTime = (t: number) => `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`
  const starCount = lastScore !== null ? stars(lastScore) : 0

  return (
    <div style={{ position:'fixed', inset:0, background:'#0A0E1A', display:'flex', flexDirection:'column', zIndex:200, fontFamily:'Inter, sans-serif' }}>
      <Confetti show={showConfetti} />

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 16px', borderBottom:'1px solid #1E2533', flexShrink:0 }}>
        <span style={{ color:'#fff', fontWeight:800, fontSize:15 }}>🥁 Tap nhịp</span>
        <button onClick={() => setShowSongList(true)} style={{ padding:'4px 12px', background:'#1E2533', border:'1px solid #374151', borderRadius:6, color:'#10B981', fontWeight:700, cursor:'pointer', fontSize:12 }}>🎵 Chọn bài</button>
        {song && <>
          <span style={{ color:'#fff', fontWeight:700, fontSize:14 }}>{song.title}</span>
          {song.artist && <span style={{ color:'#6B7280', fontSize:11 }}>— {song.artist}</span>}
          <span style={{ color:'#374151', fontSize:10 }}>{song.tempo} BPM · {song.timeSignature}/4</span>
        </>}
        {song && (
          <div style={{ display:'flex', gap:2, marginLeft:'auto' }}>
            {[0.5,0.75,1,1.25].map(s => (
              <button key={s} onClick={() => { setSpeed(s); if(isPlaying){setIsPlaying(false); setTimeout(()=>setIsPlaying(true),50)} }}
                style={{ padding:'2px 7px', borderRadius:4, border:'none', background: speed===s?'#10B981':'#1E2533', color:'#fff', fontSize:10, cursor:'pointer', fontWeight: speed===s?700:400 }}>
                {s===0.5?'50%':s===0.75?'75%':s===1?'100%':'125%'}
              </button>
            ))}
          </div>
        )}
        {userName && <span style={{ color:'#6B7280', fontSize:11 }}>👤 {userName}</span>}
        <button onClick={onClose} style={{ background:'none', border:'1px solid #374151', borderRadius:6, color:'#9CA3AF', cursor:'pointer', padding:'3px 10px', fontSize:12, marginLeft: song?0:'auto' }}>✕</button>
      </div>

      {/* Chưa chọn bài */}
      {!song && (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:20, padding:32 }}>
          <div style={{ fontSize:52 }}>🥁</div>
          <div style={{ color:'#fff', fontWeight:800, fontSize:22, textAlign:'center' }}>Luyện nhịp cùng thầy Văn Anh</div>
          <div style={{ background:'#0F1117', border:'1px solid #1E2533', borderRadius:12, padding:'20px 28px', maxWidth:380, width:'100%' }}>
            {[['1️⃣','Chọn bài hát muốn luyện'],['2️⃣','Bấm P hoặc ▶ để bắt đầu'],['3️⃣','Nghe metronome — tiếng TO là phách mạnh'],['4️⃣','Bấm SPACE hoặc TAP đúng phách'],['5️⃣','Bấm 💾 Lưu để ghi điểm & lên level']].map(([num,text]) => (
              <div key={num} style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:12 }}>
                <span style={{ fontSize:18, flexShrink:0 }}>{num}</span>
                <span style={{ color:'#9CA3AF', fontSize:14, lineHeight:1.5 }}>{text}</span>
              </div>
            ))}
            <div style={{ marginTop:8, padding:'10px 14px', background:'rgba(16,185,129,0.1)', borderRadius:8, border:'1px solid rgba(16,185,129,0.3)' }}>
              <span style={{ color:'#10B981', fontSize:13 }}>💡 Đạt 80 điểm để mở khoá level tiếp theo!</span>
            </div>
          </div>
          <button onClick={() => setShowSongList(true)} style={{ padding:'14px 40px', background:'#10B981', border:'none', borderRadius:12, color:'#fff', fontWeight:800, fontSize:18, cursor:'pointer', boxShadow:'0 0 24px rgba(16,185,129,0.4)' }}>
            🎵 Chọn bài hát
          </button>
        </div>
      )}

      {song && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* Level bar */}
          <div style={{ padding:'6px 16px', background:'#080C14', borderBottom:'1px solid #1E2533', display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
            {levels.map((lv, i) => {
              const lvNum = i + 1
              const unlocked = progress.unlocked_levels.includes(lvNum)
              const isActive = activeLevel === lvNum
              const best = progress.best_scores[String(lvNum)] ?? 0
              return (
                <button key={lvNum} onClick={() => unlocked && setActiveLevel(lvNum)} style={{
                  display:'flex', flexDirection:'column', alignItems:'center', gap:1,
                  padding:'4px 10px', borderRadius:8,
                  background: isActive?'#10B981':unlocked?'#1E2533':'#0F1117',
                  border: isActive?'none':`1px solid ${unlocked?'#374151':'#1E2533'}`,
                  color: isActive?'#fff':unlocked?'#9CA3AF':'#374151',
                  cursor: unlocked?'pointer':'not-allowed', fontSize:11, fontWeight: isActive?700:400,
                  opacity: unlocked?1:0.5, minWidth:60,
                }}>
                  <span>{unlocked?lv.label:`🔒 L${lvNum}`}</span>
                  {unlocked && <span style={{ fontSize:9, color: isActive?'rgba(255,255,255,0.7)':'#6B7280' }}>Best: {best}</span>}
                </button>
              )
            })}
            <div style={{ marginLeft:'auto', fontSize:10, color:'#6B7280', textAlign:'right' }}>
              <div style={{ color:'#9CA3AF' }}>{levelConfig?.desc}</div>
              <div>Cần {UNLOCK_SCORE}đ để lên level tiếp</div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ padding:'5px 16px', display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
            <span style={{ color:'#4B5563', fontSize:10, width:32 }}>{fmtTime(songTime)}</span>
            <div style={{ flex:1, height:3, background:'#1E2533', borderRadius:2, cursor:'pointer', position:'relative' }}
              onClick={e => { const r=e.currentTarget.getBoundingClientRect(); seekTo((e.clientX-r.left)/r.width*totalDur) }}>
              <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`${totalDur>0?songTime/totalDur*100:0}%`, background:'#10B981', borderRadius:2 }} />
            </div>
            <span style={{ color:'#4B5563', fontSize:10, width:32, textAlign:'right' }}>{fmtTime(totalDur)}</span>
          </div>

          {/* Scroll area */}
          <div ref={scrollRef} style={{ flex:1, position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', left:nowX, top:0, bottom:0, width:2, background:'#10B981', opacity:0.4, zIndex:10, pointerEvents:'none' }} />

            {/* Lời */}
            <div style={{ position:'absolute', top:'10%', left:0, right:0, height:44, transform:`translateX(${-scrollOffset+nowX}px)` }}>
              {song.lyrics.map((l,i) => {
                const lx = l.time * PX_PER_SEC
                const nextTime = song.lyrics[i+1]?.time ?? l.time + beatDur*2
                const isActive = songTime*speed >= l.time && songTime*speed < nextTime
                return (
                  <div key={l.id} style={{ position:'absolute', left:lx/speed, transform:'translateX(-50%)',
                    fontSize: isActive?21:16, fontWeight: isActive?800:500,
                    color: isActive?'#10B981':'#E2E8F0', transition:'all 0.08s', whiteSpace:'nowrap', userSelect:'none' }}>
                    {l.text}
                  </div>
                )
              })}
            </div>

            <div style={{ position:'absolute', top:'calc(10% + 48px)', left:0, right:0, height:1, background:'#1E2533' }} />

            {/* Teacher dots */}
            {showTeacher && (
              <div style={{ position:'absolute', top:'calc(10% + 52px)', left:0, right:0, height:20, transform:`translateX(${-scrollOffset+nowX}px)` }}>
                {targetDots.map((d,i) => (
                  <div key={'td'+i} style={{ position:'absolute', left:d.time*PX_PER_SEC/speed, transform:'translateX(-50%)',
                    width:8, height:8, borderRadius:'50%', background:'#F59E0B', top:6, boxShadow:'0 0 5px rgba(245,158,11,0.6)' }} />
                ))}
              </div>
            )}

            {/* Current dots */}
            <div style={{ position:'absolute', top:'calc(10% + 74px)', left:0, right:0, transform:`translateX(${-scrollOffset+nowX}px)` }}>
              <div style={{ position:'absolute', left:-nowX, right:0, top:0, height:16, display:'flex', alignItems:'center', paddingLeft:nowX }}>
                <span style={{ fontSize:9, color:'#10B981', fontWeight:700, whiteSpace:'nowrap' }}>{userName||'🎓 Bạn'} — Lần này</span>
              </div>
              {scoredCurrent.map((d,i) => (
                <div key={'cd'+i} style={{ position:'absolute', left:d.time*PX_PER_SEC, transform:'translateX(-50%)',
                  width:12, height:12, borderRadius:'50%', top:18,
                  background: targetDots.length>0?(d.hit?'#10B981':'#EF4444'):'#60A5FA',
                  boxShadow: targetDots.length===0?'0 0 8px rgba(96,165,250,0.7)':'none' }} />
              ))}
            </div>

            {/* History rows */}
            {tapHistory.map((h, hi) => {
              const opacity = Math.max(0.2, 0.65 - hi * 0.13)
              const topPos = `calc(10% + ${74 + 38 + hi*32}px)`
              return (
                <div key={h.id} style={{ position:'absolute', top:topPos, left:0, right:0, transform:`translateX(${-scrollOffset+nowX}px)` }}>
                  <div style={{ position:'absolute', left:-nowX, right:0, top:0, height:14, display:'flex', alignItems:'center', gap:5, paddingLeft:nowX }}>
                    <span style={{ fontSize:9, color:'#A78BFA', opacity, whiteSpace:'nowrap' }}>Lần {tapHistory.length-hi} · {h.score}đ · {'⭐'.repeat(stars(h.score))}</span>
                    <button onClick={() => handleDeleteHistory(h.id)} style={{ fontSize:8, background:'none', border:'none', color:'#EF4444', cursor:'pointer', opacity:0.4, padding:0 }}>🗑</button>
                  </div>
                  {h.dots.map((d,di) => (
                    <div key={di} style={{ position:'absolute', left:d.time*PX_PER_SEC, transform:'translateX(-50%)',
                      width:8, height:8, borderRadius:'50%', top:15, background:'#A78BFA', opacity }} />
                  ))}
                </div>
              )
            })}

            {/* Beat marks */}
            <div style={{ position:'absolute', bottom:4, left:0, right:0, transform:`translateX(${-scrollOffset+nowX}px)` }}>
              {Array.from({length: song.totalBars*song.timeSignature}, (_,i) => {
                const t = i*beatDur; const isBar = i%song.timeSignature===0
                const beatInBar = i%song.timeSignature+1
                const isTarget = levelConfig?.beats.includes(beatInBar)
                return <div key={i} style={{ position:'absolute', left:t*PX_PER_SEC,
                  width:isBar?2:1, height:isBar?14:isTarget?10:6,
                  background: isTarget?'#10B981':isBar?'#374151':'#1E2533',
                  transform:'translateX(-50%)', bottom:0, opacity: isTarget?0.6:1 }} />
              })}
            </div>
          </div>

          {/* Score result */}
          {lastScore !== null && currentDots.length === 0 && (
            <div style={{ flexShrink:0, textAlign:'center', padding:'5px 0', background:'rgba(16,185,129,0.05)', borderTop:'1px solid #1E2533' }}>
              <div style={{ fontSize:26, fontWeight:900, color: lastScore>=80?'#10B981':lastScore>=60?'#F59E0B':'#EF4444' }}>
                {lastScore}<span style={{ fontSize:13 }}>/100</span>
              </div>
              <div style={{ fontSize:15 }}>{'⭐'.repeat(starCount)}{'☆'.repeat(5-starCount)}</div>
              {prevBest > 0 && (
                <div style={{ fontSize:11, color: lastScore>prevBest?'#10B981':'#6B7280' }}>
                  {lastScore>prevBest?`📈 +${lastScore-prevBest} so với kỷ lục!`:lastScore===prevBest?'🎯 Bằng kỷ lục!':`Kỷ lục: ${prevBest}`}
                </div>
              )}
              {lastScore < UNLOCK_SCORE && activeLevel < levels.length && (
                <div style={{ fontSize:10, color:'#6B7280', marginTop:2 }}>
                  Cần thêm <span style={{ color:'#F59E0B', fontWeight:700 }}>{UNLOCK_SCORE-lastScore}đ</span> để 🔓 Level {activeLevel+1}
                  <div style={{ width:100, height:3, background:'#1E2533', borderRadius:2, margin:'3px auto 0' }}>
                    <div style={{ width:`${Math.min(lastScore/UNLOCK_SCORE*100,100)}%`, height:'100%', background:'#F59E0B', borderRadius:2 }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Live score */}
          {currentDots.length > 0 && currentScore !== null && (
            <div style={{ flexShrink:0, textAlign:'center', padding:'2px 0', borderTop:'1px solid #1E2533' }}>
              <span style={{ fontSize:11, color: currentScore>=80?'#10B981':currentScore>=60?'#F59E0B':'#EF4444', fontWeight:700 }}>
                {currentScore}/100 · {scoredCurrent.filter(d=>d.hit).length}/{targetDots.length} phách đúng
              </span>
            </div>
          )}

          {/* Controls */}
          <div style={{ padding:'8px 16px 8px', display:'flex', gap:10, justifyContent:'center', alignItems:'center', flexShrink:0, flexWrap:'wrap' }}>
            <button onClick={() => setIsPlaying(p=>!p)} style={{ width:44, height:44, borderRadius:'50%', background:'#1E2533', border:'2px solid #374151', color:'#fff', fontSize:17, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {isPlaying?'⏸':'▶'}
            </button>
            <button
              onMouseDown={e => { e.preventDefault(); e.stopPropagation(); handleTap() }}
              onTouchStart={e => { e.preventDefault(); e.stopPropagation(); handleTap() }}
              style={{ width:110, height:110, borderRadius:'50%', background: isPlaying?'#10B981':'#1F2937', border:'none', color:'#fff', fontSize: isPlaying?22:14, fontWeight:900, cursor:'pointer', userSelect:'none', transition:'background 0.2s', boxShadow: isPlaying?'0 0 28px rgba(16,185,129,0.4)':'none' }}>
              {isPlaying?'TAP':'🎵'}
            </button>
            <button onClick={() => { seekTo(0); setIsPlaying(false) }} style={{ width:44, height:44, borderRadius:'50%', background:'#1E2533', border:'2px solid #374151', color:'#fff', fontSize:17, cursor:'pointer' }}>⏮</button>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {teacherDots.length > 0 && (
                <button onClick={() => setShowTeacher(t=>!t)} style={{ padding:'4px 10px', borderRadius:6, background: showTeacher?'rgba(245,158,11,0.15)':'#1E2533', border:`1px solid ${showTeacher?'#F59E0B':'#374151'}`, color: showTeacher?'#F59E0B':'#9CA3AF', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                  {showTeacher?'🙈 Ẩn đáp án':'👁 Xem đáp án'}
                </button>
              )}
              <div style={{ display:'flex', gap:5 }}>
                <button onClick={() => setCurrentDots([])} style={{ padding:'4px 10px', borderRadius:6, background:'#1E2533', border:'1px solid #374151', color:'#EF4444', fontSize:11, fontWeight:700, cursor:'pointer' }}>🗑 Xoá</button>
                {currentDots.length > 0 && (
                  <button onClick={handleSave} style={{ padding:'4px 10px', borderRadius:6, background: isTeacher?'#F59E0B':'#10B981', border:'none', color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', boxShadow: isTeacher?'0 0 10px rgba(245,158,11,0.3)':'0 0 10px rgba(16,185,129,0.3)' }}>
                    {isTeacher?'💾 Lưu đáp án':'💾 Lưu & tính điểm'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {saveMsg && <div style={{ textAlign:'center', color:'#10B981', fontSize:11, paddingBottom:2 }}>{saveMsg}</div>}
          <div style={{ textAlign:'center', color:'#374151', fontSize:10, paddingBottom:5 }}>Space = TAP · P/Enter = Play/Pause · ⏮ về đầu</div>
        </div>
      )}

      {/* Level Up Modal */}
      {showLevelUp && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:400, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#16213E', borderRadius:20, padding:40, textAlign:'center', border:'2px solid #10B981', maxWidth:320 }}>
            <div style={{ fontSize:52, marginBottom:8 }}>✨</div>
            <div style={{ color:'#10B981', fontWeight:900, fontSize:28, marginBottom:4 }}>LEVEL UP!</div>
            <div style={{ color:'#fff', fontWeight:700, fontSize:18, marginBottom:8 }}>🔓 Level {activeLevel+1} đã mở khoá!</div>
            <div style={{ color:'#9CA3AF', fontSize:14, marginBottom:20 }}>{levels[activeLevel]?.desc}</div>
            <button onClick={() => { setShowLevelUp(false); setActiveLevel(activeLevel+1) }}
              style={{ padding:'12px 32px', background:'#10B981', border:'none', borderRadius:10, color:'#fff', fontWeight:800, fontSize:16, cursor:'pointer' }}>
              Thử ngay! →
            </button>
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
