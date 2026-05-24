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

function getLevels(timeSig: number): { label: string; beats: number[]; desc: string; shortDesc: string }[] {
  if (timeSig === 4) return [
    { label: 'Level 1', beats: [1],       desc: 'Nghe bài hát và tap vào phách mạnh — thử cảm nhận xem nhịp nào được nhấn rõ nhất nhé!', shortDesc: 'Phách mạnh (phách 1)' },
    { label: 'Level 2', beats: [1,2,3,4], desc: 'Tap đều theo nhịp — giữ nhịp ổn định theo: 1 - 2 - 3 - 4', shortDesc: 'Đủ 4 phách' },
    { label: 'Level 3', beats: [1,3],     desc: 'Chỉ tap vào phách 1 và phách 3 — bỏ qua phách 2 và 4', shortDesc: 'Phách 1 và 3' },
    { label: 'Level 4', beats: [2,4],     desc: 'Tap vào phách 2 và phách 4 — những phách nhẹ nên sẽ khó cảm nhận hơn đấy!', shortDesc: 'Phách 2 và 4' },
  ]
  if (timeSig === 3) return [
    { label: 'Level 1', beats: [1],     desc: 'Nghe bài hát và tap vào phách mạnh — thử cảm nhận xem nhịp nào được nhấn rõ nhất nhé!', shortDesc: 'Phách mạnh (phách 1)' },
    { label: 'Level 2', beats: [1,2,3], desc: 'Tap đều theo nhịp — giữ nhịp ổn định theo: 1 - 2 - 3', shortDesc: 'Đủ 3 phách' },
    { label: 'Level 3', beats: [1,3],   desc: 'Chỉ tap vào phách 1 và phách 3 — bỏ qua phách 2', shortDesc: 'Phách 1 và 3' },
    { label: 'Level 4', beats: [2],     desc: 'Tap vào phách 2 — phách nhẹ nên sẽ khó cảm nhận hơn đấy!', shortDesc: 'Phách 2' },
  ]
  if (timeSig === 6) return [
    { label: 'Level 1', beats: [1],         desc: 'Nghe bài hát và tap vào phách mạnh — thử cảm nhận xem nhịp nào được nhấn rõ nhất nhé!', shortDesc: 'Phách mạnh (phách 1)' },
    { label: 'Level 2', beats: [1,2,3,4,5,6], desc: 'Tap đều theo nhịp — giữ nhịp ổn định theo: 1-2-3-4-5-6', shortDesc: 'Đủ 6 phách' },
    { label: 'Level 3', beats: [1,4],       desc: 'Chỉ tap vào phách 1 và phách 4 — bỏ qua các phách còn lại', shortDesc: 'Phách 1 và 4' },
    { label: 'Level 4', beats: [2,3,5,6],   desc: 'Tap vào phách 2-3 và 5-6 — những phách nhẹ nên sẽ khó cảm nhận hơn đấy!', shortDesc: 'Phách 2,3,5,6' },
  ]
  return [
    { label: 'Level 1', beats: [1],     desc: 'Nghe bài hát và tap vào phách mạnh — thử cảm nhận xem nhịp nào được nhấn rõ nhất nhé!', shortDesc: 'Phách mạnh (phách 1)' },
    { label: 'Level 2', beats: Array.from({length:timeSig},(_,i)=>i+1), desc: `Tap đều theo nhịp — giữ nhịp ổn định theo 1 đến ${timeSig}`, shortDesc: `Đủ ${timeSig} phách` },
    { label: 'Level 3', beats: [1,3],   desc: 'Chỉ tap vào phách 1 và phách 3 — bỏ qua phách 2 và 4', shortDesc: 'Phách 1 và 3' },
    { label: 'Level 4', beats: [2,4],   desc: 'Tap vào phách 2 và phách 4 — những phách nhẹ nên sẽ khó cảm nhận hơn đấy!', shortDesc: 'Phách 2 và 4' },
  ]
}

function generateTargetDots(song: RhythmSong, beats: number[]): Dot[] {
  const beatDur = 60 / song.tempo
  const dots: Dot[] = []
  for (let bar = 0; bar < song.totalBars; bar++) {
    for (const beat of beats) {
      const t = bar * song.timeSignature * beatDur + (beat - 1) * beatDur
      dots.push({ time: t })
    }
  }
  return dots
}

function BeatViz({ beats, timeSig }: { beats: number[]; timeSig: number }) {
  return (
    <div style={{ display:'flex', gap:3, alignItems:'center' }}>
      {Array.from({length: timeSig}, (_, i) => {
        const beat = i + 1
        const active = beats.includes(beat)
        return (
          <div key={i} style={{
            width: beat === 1 ? 12 : 9,
            height: beat === 1 ? 12 : 9,
            borderRadius: '50%',
            background: active ? '#10B981' : 'transparent',
            border: `2px solid ${active ? '#10B981' : '#374151'}`,
            flexShrink: 0,
          }} />
        )
      })}
    </div>
  )
}

function stars(score: number) {
  if (score >= 95) return 5
  if (score >= 80) return 4
  if (score >= 65) return 3
  if (score >= 50) return 2
  return 1
}

function getResultMsg(score: number, levelDesc: string): { emoji: string; title: string; body: string; hint?: string } {
  if (score >= 95) return { emoji:'🏆', title:'XUẤT SẮC!', body:`Bạn cảm nhận nhịp rất tốt! Gần như hoàn hảo rồi!` }
  if (score >= 80) return { emoji:'🎉', title:'RẤT TỐT!', body:`Tai nghe nhịp của bạn đang rất tốt! Tiếp tục phát huy nhé!` }
  if (score >= 65) return { emoji:'💪', title:'KHÁ TỐT!', body:`Bạn đang cảm nhận được nhịp rồi! Luyện thêm một chút nữa thôi!` }
  if (score >= 50) return { emoji:'🎯', title:'TIẾP TỤC!', body:`Bạn đang đi đúng hướng! Thử nghe lại bài và cảm nhận chỗ nhấn nhé!`, hint:'💡 Gợi ý: Phách mạnh thường là nơi bài hát tạo cảm giác "nhấn" rõ hơn — hãy thử nghe lại và cảm nhận nhé!' }
  return { emoji:'🥁', title:'LUYỆN THÊM NHÉ!', body:`Đừng nản! Hãy nghe lại bài hát thật kỹ và cảm nhận chỗ nhịp được nhấn mạnh hơn.`, hint:'💡 Gợi ý: Phách mạnh thường là nơi bài hát tạo cảm giác "nhấn" rõ hơn — hãy thử nghe lại và cảm nhận nhé!' }
}

function Confetti({ show }: { show: boolean }) {
  if (!show) return null
  const colors = ['#10B981','#F59E0B','#60A5FA','#F472B6','#A78BFA','#34D399']
  return (
    <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:999, overflow:'hidden' }}>
      {Array.from({length:36},(_,i) => (
        <div key={i} style={{
          position:'absolute', left:`${Math.random()*100}%`, top:'-10px',
          width: 6+Math.random()*6, height: 6+Math.random()*6,
          borderRadius: Math.random()>0.5?'50%':2,
          background: colors[i%colors.length],
          animation:`cffall ${1.2+Math.random()*1.2}s ease-in forwards`,
          animationDelay:`${Math.random()*0.6}s`,
        }}/>
      ))}
      <style>{`@keyframes cffall{to{transform:translateY(110vh) rotate(720deg);opacity:0}}`}</style>
    </div>
  )
}

export function TapWithSong({ onClose, userRole }: { onClose: () => void; userRole?: string }) {
  const isTeacher = userRole === 'teacher' || userRole === 'admin'

  const [song, setSong] = useState<RhythmSong | null>(null)
  const [showSongList, setShowSongList] = useState(false)
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
  const [showResultPopup, setShowResultPopup] = useState(false)
  const [lastScore, setLastScore] = useState<number | null>(null)
  const [prevBest, setPrevBest] = useState(0)

  const [tapHistory, setTapHistory] = useState<TapRecord[]>([])
  const [currentDots, setCurrentDots] = useState<Dot[]>([])
  const [saveMsg, setSaveMsg] = useState('')
  const [pendingSave, setPendingSave] = useState(false)

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
    setSong(s); setCurrentDots([]); setTapHistory([])
    setShowTeacher(false); setLastScore(null); setPendingSave(false)
    setSongTime(0); songTimeRef.current = 0; setIsPlaying(false)
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
      if (e.code === 'Escape') { if (showResultPopup) setShowResultPopup(false); else onClose() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [song, onClose, handleTap, showResultPopup])

  const seekTo = (t: number) => {
    const c = Math.max(0, Math.min(t, totalDur))
    songTimeRef.current = c; setSongTime(c)
    wallRef.current = performance.now() - c * 1000
    if (isPlaying) startMetronome(c)
  }

  const beatDur = song ? 60 / song.tempo / speed : 0.5
  const levels = song ? getLevels(song.timeSignature) : []
  const levelConfig = levels[activeLevel - 1]

  // Dùng JSON để tính đáp án thay vì teacher_taps
  const targetDots = song && levelConfig
    ? generateTargetDots(song, levelConfig.beats)
    : []
  const targetDotsScaled = targetDots.map(d => ({ time: d.time / speed }))

  const scoredCurrent: ScoredDot[] = currentDots.map(d => {
    if (targetDotsScaled.length === 0) return { ...d, hit: false }
    const nearest = targetDotsScaled.reduce((a, b) => Math.abs(a.time - d.time) < Math.abs(b.time - d.time) ? a : b)
    return { ...d, hit: Math.abs(d.time - nearest.time) <= 0.3 }
  })
  const currentScore = targetDotsScaled.length > 0
    ? Math.round(scoredCurrent.filter(d => d.hit).length / targetDotsScaled.length * 100)
    : null

  const bestThisLevel = progress.best_scores[String(activeLevel)] ?? 0

  const handleShowResult = () => {
    if (currentDots.length === 0) return
    setLastScore(currentScore ?? 0)
    setPrevBest(bestThisLevel)
    setShowResultPopup(true)
  }

  const handleSave = async () => {
    if (!song?.title || currentDots.length === 0) return
    const score = currentScore ?? 0
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaveMsg('Chưa đăng nhập!'); return }

    await supabase.from('student_taps').insert({
      user_id: user.id, song_title: song.title,
      dots: currentDots, score, level: activeLevel,
    })

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

    setProgress(p => ({ ...p, best_scores: newBestScores, unlocked_levels: newUnlocked }))
    setTapHistory(prev => [{ id: Date.now().toString(), dots: currentDots, score, level: activeLevel, created_at: new Date().toISOString() }, ...prev.slice(0,4)])
    setCurrentDots([])
    setShowResultPopup(false)
    setPendingSave(false)

    if (leveledUp) {
      setShowConfetti(true); setShowLevelUp(true)
      setTimeout(() => { setShowConfetti(false); setShowLevelUp(false) }, 4000)
    } else if (score >= 80) {
      setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3000)
    }
    setSaveMsg('Đã lưu!'); setTimeout(() => setSaveMsg(''), 2000)
  }

  const handleDeleteHistory = async (id: string) => {
    await supabase.from('student_taps').delete().eq('id', id)
    setTapHistory(prev => prev.filter(h => h.id !== id))
  }

  const nowX = containerW * NOW_X_FRAC
  const scrollOffset = songTime * PX_PER_SEC
  const fmtTime = (t: number) => `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`

  const resultMsg = lastScore !== null ? getResultMsg(lastScore, levelConfig?.shortDesc ?? '') : null
  const starCount = lastScore !== null ? stars(lastScore) : 0

  return (
    <div style={{ position:'fixed', inset:0, background:'#0A0E1A', display:'flex', flexDirection:'column', zIndex:200, fontFamily:'Inter, sans-serif' }}>
      <Confetti show={showConfetti} />

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 16px', borderBottom:'1px solid #1E2533', flexShrink:0 }}>
        <span style={{ color:'#fff', fontWeight:800, fontSize:15 }}>🥁 Tap nhịp</span>
        <button onClick={() => setShowSongList(true)} style={{ padding:'4px 12px', background:'#1E2533', border:'1px solid #374151', borderRadius:6, color:'#10B981', fontWeight:700, cursor:'pointer', fontSize:12 }}>
          🎵 Chọn bài
        </button>
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

      {/* ── Chưa chọn bài ── */}
      {!song && (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:20, padding:32 }}>
          <div style={{ fontSize:52 }}>🥁</div>
          <div style={{ color:'#fff', fontWeight:800, fontSize:22, textAlign:'center' }}>Luyện nhịp cùng Thầy Văn Anh</div>
          <div style={{ background:'#0F1117', border:'1px solid #1E2533', borderRadius:12, padding:'20px 28px', maxWidth:400, width:'100%' }}>
            {[
              ['1️⃣', 'Chọn bài hát muốn luyện'],
              ['2️⃣', 'Bấm ▶ hoặc phím P để bắt đầu nhạc'],
              ['3️⃣', 'Nghe metronome — tiếng CLICK TO là phách mạnh'],
              ['4️⃣', 'Bấm nút TAP hoặc phím Space đúng phách'],
              ['5️⃣', 'Bấm Xem kết quả → Lưu điểm để lên level'],
            ].map(([num, text]) => (
              <div key={num} style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:12 }}>
                <span style={{ fontSize:18, flexShrink:0 }}>{num}</span>
                <span style={{ color:'#9CA3AF', fontSize:14, lineHeight:1.5 }}>{text}</span>
              </div>
            ))}
            <div style={{ marginTop:8, padding:'10px 14px', background:'rgba(16,185,129,0.1)', borderRadius:8, border:'1px solid rgba(16,185,129,0.3)', display:'flex', gap:8, alignItems:'center' }}>
              <span style={{ fontSize:16 }}>💡</span>
              <span style={{ color:'#10B981', fontSize:13 }}>Đạt <strong>80 điểm</strong> để mở khoá level tiếp theo!</span>
            </div>
          </div>
          <button onClick={() => setShowSongList(true)} style={{ padding:'14px 40px', background:'#10B981', border:'none', borderRadius:12, color:'#fff', fontWeight:800, fontSize:18, cursor:'pointer', boxShadow:'0 0 24px rgba(16,185,129,0.4)' }}>
            🎵 Chọn bài hát
          </button>
        </div>
      )}

      {/* ── Main ── */}
      {song && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* Level bar + nhiệm vụ */}
          <div style={{ padding:'6px 16px', background:'#080C14', borderBottom:'1px solid #1E2533', display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
            {levels.map((lv, i) => {
              const lvNum = i + 1
              const unlocked = progress.unlocked_levels.includes(lvNum)
              const isActive = activeLevel === lvNum
              const best = progress.best_scores[String(lvNum)] ?? 0
              return (
                <button key={lvNum} onClick={() => unlocked && setActiveLevel(lvNum)} style={{
                  display:'flex', flexDirection:'column', alignItems:'center', gap:2,
                  padding:'4px 10px', borderRadius:8,
                  background: isActive?'#10B981':unlocked?'#1E2533':'#0F1117',
                  border: isActive?'none':`1px solid ${unlocked?'#374151':'#1E2533'}`,
                  color: isActive?'#fff':unlocked?'#9CA3AF':'#374151',
                  cursor: unlocked?'pointer':'not-allowed', fontSize:11,
                  fontWeight: isActive?700:400, opacity: unlocked?1:0.45, minWidth:58,
                }}>
                  <span>{unlocked ? lv.label : `🔒 L${lvNum}`}</span>
                  {unlocked && <span style={{ fontSize:9, color: isActive?'rgba(255,255,255,0.7)':'#6B7280' }}>Tốt nhất: {best}</span>}
                </button>
              )
            })}

            {/* Nhiệm vụ + minh hoạ phách */}
            {levelConfig && (
              <div style={{ marginLeft:8, display:'flex', alignItems:'center', gap:8, flex:1, minWidth:0 }}>
                <div style={{ width:1, height:28, background:'#1E2533', flexShrink:0 }} />
                <div style={{ display:'flex', flexDirection:'column', gap:2, minWidth:0 }}>
                  <div style={{ color:'#10B981', fontWeight:700, fontSize:11, whiteSpace:'nowrap' }}>
                    🎯 Nhiệm vụ: {levelConfig.shortDesc}
                  </div>
                  <BeatViz beats={levelConfig.beats} timeSig={song.timeSignature} />
                </div>
              </div>
            )}

            <div style={{ marginLeft:'auto', fontSize:9, color:'#374151', flexShrink:0 }}>Cần {UNLOCK_SCORE}đ</div>
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

            {/* Đáp án Thầy (từ JSON) */}
            {showTeacher && (
              <div style={{ position:'absolute', top:'calc(10% + 50px)', left:0, right:0, height:20, transform:`translateX(${-scrollOffset+nowX}px)` }}>
                <div style={{ position:'absolute', left:-nowX, top:0, height:16, display:'flex', alignItems:'center', paddingLeft:4 }}>
                  <span style={{ fontSize:8, color:'#F59E0B', fontWeight:700 }}>Đáp án Thầy</span>
                </div>
                {targetDotsScaled.map((d,i) => (
                  <div key={'td'+i} style={{ position:'absolute', left:d.time*PX_PER_SEC, transform:'translateX(-50%)',
                    width:8, height:8, borderRadius:'50%', background:'#F59E0B', top:6,
                    boxShadow:'0 0 4px rgba(245,158,11,0.5)' }} />
                ))}
              </div>
            )}

            {/* Current dots */}
            <div style={{ position:'absolute', top:'calc(10% + 74px)', left:0, right:0, transform:`translateX(${-scrollOffset+nowX}px)` }}>
              <div style={{ position:'absolute', left:-nowX, top:0, height:16, display:'flex', alignItems:'center', paddingLeft:4 }}>
                <span style={{ fontSize:8, color:'#10B981', fontWeight:700 }}>{userName||'Bạn'} — Lần này</span>
              </div>
              {scoredCurrent.map((d,i) => (
                <div key={'cd'+i} style={{ position:'absolute', left:d.time*PX_PER_SEC, transform:'translateX(-50%)',
                  width:12, height:12, borderRadius:'50%', top:18,
                  background: targetDotsScaled.length>0?(d.hit?'#10B981':'#EF4444'):'#60A5FA',
                  boxShadow: targetDotsScaled.length===0?'0 0 8px rgba(96,165,250,0.7)':'none' }} />
              ))}
            </div>

            {/* History rows */}
            {tapHistory.map((h, hi) => {
              const opacity = Math.max(0.2, 0.65 - hi*0.12)
              const topPos = `calc(10% + ${74+38+hi*30}px)`
              return (
                <div key={h.id} style={{ position:'absolute', top:topPos, left:0, right:0, transform:`translateX(${-scrollOffset+nowX}px)` }}>
                  <div style={{ position:'absolute', left:-nowX, top:0, height:14, display:'flex', alignItems:'center', gap:5, paddingLeft:4 }}>
                    <span style={{ fontSize:8, color:'#A78BFA', opacity, whiteSpace:'nowrap' }}>
                      Lần {tapHistory.length-hi} · {h.score}đ · {'⭐'.repeat(stars(h.score))}
                    </span>
                    <button onClick={() => handleDeleteHistory(h.id)}
                      title="Xoá lần này"
                      style={{ fontSize:9, background:'none', border:'none', color:'#EF4444', cursor:'pointer', opacity:0.5, padding:0, lineHeight:1 }}>
                      ✕
                    </button>
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
                  background: isTarget?'rgba(16,185,129,0.5)':isBar?'#374151':'#1E2533',
                  transform:'translateX(-50%)', bottom:0 }} />
              })}
            </div>
          </div>

          {/* Live score */}
          {currentDots.length > 0 && currentScore !== null && (
            <div style={{ flexShrink:0, textAlign:'center', padding:'3px 0', borderTop:'1px solid #1E2533', background:'rgba(0,0,0,0.3)' }}>
              <span style={{ fontSize:12, color: currentScore>=80?'#10B981':currentScore>=60?'#F59E0B':'#EF4444', fontWeight:700 }}>
                {currentScore}/100 · {scoredCurrent.filter(d=>d.hit).length}/{targetDotsScaled.length} phách đúng
              </span>
            </div>
          )}

          {/* Controls */}
          <div style={{ padding:'8px 16px 8px', display:'flex', gap:10, justifyContent:'center', alignItems:'center', flexShrink:0, flexWrap:'wrap' }}>

            {/* Play/Pause */}
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
              <button onClick={() => setIsPlaying(p=>!p)} style={{ width:48, height:48, borderRadius:'50%', background:'#1E2533', border:'2px solid #374151', color:'#fff', fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {isPlaying?'⏸':'▶'}
              </button>
              <span style={{ fontSize:9, color:'#374151' }}>Phím P</span>
            </div>

            {/* TAP */}
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
              <button
                onMouseDown={e => { e.preventDefault(); e.stopPropagation(); handleTap() }}
                onTouchStart={e => { e.preventDefault(); e.stopPropagation(); handleTap() }}
                style={{ width:110, height:110, borderRadius:'50%',
                  background: isPlaying?'#10B981':'#1F2937', border:'none', color:'#fff',
                  fontSize: isPlaying?22:14, fontWeight:900, cursor:'pointer', userSelect:'none',
                  transition:'background 0.2s', boxShadow: isPlaying?'0 0 28px rgba(16,185,129,0.4)':'none' }}>
                {isPlaying?'TAP':'🎵'}
              </button>
              <span style={{ fontSize:9, color:'#374151' }}>Phím Space</span>
            </div>

            {/* Về đầu */}
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
              <button onClick={() => { seekTo(0); setIsPlaying(false) }} style={{ width:48, height:48, borderRadius:'50%', background:'#1E2533', border:'2px solid #374151', color:'#fff', fontSize:20, cursor:'pointer' }}>⏮</button>
              <span style={{ fontSize:9, color:'#374151' }}>Về đầu</span>
            </div>

            {/* Action buttons */}
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {/* Xem đáp án */}
              <button onClick={() => setShowTeacher(t=>!t)} style={{ padding:'6px 12px', borderRadius:6,
                background: showTeacher?'rgba(245,158,11,0.15)':'#1E2533',
                border:`1px solid ${showTeacher?'#F59E0B':'#374151'}`,
                color: showTeacher?'#F59E0B':'#9CA3AF', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                {showTeacher?'🙈 Ẩn đáp án Thầy':'👁 Xem đáp án Thầy'}
              </button>

              <div style={{ display:'flex', gap:6 }}>
                {/* Xoá lần này */}
                <button onClick={() => { setCurrentDots([]); setLastScore(null) }}
                  style={{ padding:'6px 12px', borderRadius:6, background:'#1E2533', border:'1px solid #374151', color:'#EF4444', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                  🗑 Xoá lần này
                </button>

                {/* Xem kết quả */}
                {currentDots.length > 0 && (
                  <button onClick={handleShowResult}
                    style={{ padding:'6px 12px', borderRadius:6, background:'#3B82F6', border:'none', color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', boxShadow:'0 0 10px rgba(59,130,246,0.3)' }}>
                    📊 Xem kết quả
                  </button>
                )}
              </div>
            </div>
          </div>

          {saveMsg && <div style={{ textAlign:'center', color:'#10B981', fontSize:11, paddingBottom:2, fontWeight:700 }}>{saveMsg}</div>}
          <div style={{ textAlign:'center', color:'#374151', fontSize:9, paddingBottom:5 }}>
            Space = TAP · P hoặc Enter = Phát/Dừng · ⏮ = Về đầu · Esc = Đóng
          </div>
        </div>
      )}

      {/* ── Popup kết quả ── */}
      {showResultPopup && lastScore !== null && resultMsg && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={() => setShowResultPopup(false)}>
          <div style={{ background:'#16213E', borderRadius:20, padding:'32px 28px', textAlign:'center', border:'1px solid #1E2533', maxWidth:340, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()}>

            <div style={{ fontSize:48, marginBottom:8 }}>{resultMsg.emoji}</div>
            <div style={{ color:'#fff', fontWeight:900, fontSize:24, marginBottom:4 }}>{resultMsg.title}</div>

            {/* Score */}
            <div style={{ fontSize:52, fontWeight:900, color: lastScore>=80?'#10B981':lastScore>=60?'#F59E0B':'#EF4444', lineHeight:1, marginBottom:4 }}>
              {lastScore}
              <span style={{ fontSize:20, color:'#6B7280' }}>/100</span>
            </div>
            <div style={{ fontSize:22, marginBottom:8 }}>{'⭐'.repeat(starCount)}{'☆'.repeat(5-starCount)}</div>

            {/* So sánh kỷ lục */}
            {prevBest > 0 && (
              <div style={{ fontSize:13, color: lastScore>prevBest?'#10B981':'#6B7280', marginBottom:8, fontWeight:600 }}>
                {lastScore>prevBest ? `📈 +${lastScore-prevBest} so với kỷ lục!` : lastScore===prevBest ? '🎯 Bằng kỷ lục của bạn!' : `📉 Kỷ lục của bạn: ${prevBest}`}
              </div>
            )}

            {/* Body message */}
            <div style={{ color:'#9CA3AF', fontSize:13, marginBottom: resultMsg.hint ? 8 : 16, lineHeight:1.5 }}>{resultMsg.body}</div>
            {resultMsg.hint && (
              <div style={{ marginBottom:16, padding:'10px 14px', background:'rgba(96,165,250,0.08)', borderRadius:10, border:'1px solid rgba(96,165,250,0.2)', fontSize:12, color:'#60A5FA', lineHeight:1.5 }}>
                {resultMsg.hint}
              </div>
            )}

            {/* Progress tới level tiếp */}
            {lastScore < UNLOCK_SCORE && activeLevel < levels.length && (
              <div style={{ marginBottom:16, padding:'10px 14px', background:'rgba(245,158,11,0.08)', borderRadius:10, border:'1px solid rgba(245,158,11,0.2)' }}>
                <div style={{ fontSize:12, color:'#F59E0B', marginBottom:6 }}>
                  Cần thêm <strong>{UNLOCK_SCORE-lastScore} điểm</strong> để mở Level {activeLevel+1}
                </div>
                <div style={{ height:6, background:'#1E2533', borderRadius:3, overflow:'hidden' }}>
                  <div style={{ width:`${Math.min(lastScore/UNLOCK_SCORE*100,100)}%`, height:'100%', background:'linear-gradient(90deg,#F59E0B,#FBBF24)', borderRadius:3, transition:'width 0.5s' }} />
                </div>
                <div style={{ fontSize:10, color:'#6B7280', marginTop:4 }}>{lastScore}/{UNLOCK_SCORE}</div>
              </div>
            )}

            {lastScore >= UNLOCK_SCORE && activeLevel < levels.length && (
              <div style={{ marginBottom:16, padding:'10px 14px', background:'rgba(16,185,129,0.1)', borderRadius:10, border:'1px solid rgba(16,185,129,0.3)' }}>
                <div style={{ fontSize:13, color:'#10B981', fontWeight:700 }}>🔓 Đủ điểm mở Level {activeLevel+1}! Lưu để nhận thưởng</div>
              </div>
            )}

            {/* Buttons */}
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button onClick={() => { setShowResultPopup(false); setCurrentDots([]); seekTo(0) }}
                style={{ padding:'10px 20px', background:'#1E2533', border:'1px solid #374151', borderRadius:10, color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                🔄 Thử lại
              </button>
              <button onClick={handleSave}
                style={{ padding:'10px 20px', background:'#10B981', border:'none', borderRadius:10, color:'#fff', fontWeight:800, fontSize:13, cursor:'pointer', boxShadow:'0 0 16px rgba(16,185,129,0.4)' }}>
                💾 Lưu điểm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Level Up Modal ── */}
      {showLevelUp && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#16213E', borderRadius:20, padding:40, textAlign:'center', border:'2px solid #10B981', maxWidth:320 }}>
            <div style={{ fontSize:56, marginBottom:8 }}>✨</div>
            <div style={{ color:'#10B981', fontWeight:900, fontSize:30, marginBottom:4 }}>LEVEL UP!</div>
            <div style={{ color:'#fff', fontWeight:700, fontSize:18, marginBottom:8 }}>🔓 Level {activeLevel+1} đã mở khoá!</div>
            <div style={{ color:'#9CA3AF', fontSize:14, marginBottom:8 }}>Thử thách mới:</div>
            <div style={{ color:'#10B981', fontSize:15, fontWeight:700, marginBottom:8 }}>{levels[activeLevel]?.desc}</div>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:20 }}>
              {song && levels[activeLevel] && <BeatViz beats={levels[activeLevel].beats} timeSig={song.timeSignature} />}
            </div>
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
