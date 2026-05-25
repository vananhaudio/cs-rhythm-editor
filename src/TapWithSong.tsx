import { useState, useEffect, useRef, useCallback } from 'react'
import type { RhythmSong } from './types'
import { supabase } from './supabase'
import { SongList } from './SongList'

// ── DESIGN TOKENS ──────────────────────────────────────────
const C = {
  // Header + Controls — kem sáng
  bgPage:     '#F5F2EA',
  bgPageBorder:'#E0D9C8',

  // Level bar — nâu gỗ
  bgWood:     '#F0E8D8',
  bgWoodBorder:'#D8C8A8',
  bgWoodCard: '#fff',
  bgWoodActive:'#3F7D3A',

  // Main area — dark forest
  bgMain:     '#1C2E22',
  bgMission:  '#243D2C',
  bgMissionBorder:'rgba(220,230,210,0.09)',

  // Dots
  dotGold:    '#C99700',
  dotBlue:    '#5BA8D0',
  dotPurple:  '#8B6FC0',
  dotRed:     '#8B3A35',

  // Accents
  green:      '#3F7D3A',
  greenLight: '#6AAD62',
  greenMid:   '#6A9E54',
  greenPale:  '#8DC470',
  gold:       '#C99700',

  // Text
  textDark:   '#1F2A1F',
  textWood:   '#2A2018',
  textMuted:  '#7A9A7A',
  textDim:    '#5A7260',
  textLight:  '#EAE8DC',
  textLegend: '#A8BBA0',

  // Controls
  ctrlBorder: '#D8C8A8',
  ctrlText:   '#2A2018',
}

type Dot = { time: number }
type ScoredDot = Dot & { hit: boolean }
type TapRecord = { id: string; dots: Dot[]; score: number; level: number; created_at: string }
type Progress = { current_level: number; best_scores: Record<string, number>; unlocked_levels: number[] }

const PX_PER_SEC = 120
const NOW_X_FRAC = 0.55
const UNLOCK_SCORE = 80
const GUEST_MAX_SONGS = 3

function getLevels(timeSig: number): { label: string; beats: number[]; desc: string; shortDesc: string }[] {
  if (timeSig === 4) return [
    { label: 'Level 1', beats: [1],       desc: 'Nghe bài hát và tap vào phách mạnh — thử cảm nhận xem nhịp nào được nhấn rõ nhất nhé!', shortDesc: 'Phách mạnh' },
    { label: 'Level 2', beats: [1,2,3,4], desc: 'Tap đều theo nhịp — giữ nhịp ổn định theo: 1 - 2 - 3 - 4', shortDesc: 'Đủ 4 phách' },
    { label: 'Level 3', beats: [1,3],     desc: 'Chỉ tap vào phách 1 và phách 3 — bỏ qua phách 2 và 4', shortDesc: 'Phách 1 và 3' },
    { label: 'Level 4', beats: [2,4],     desc: 'Tap vào phách 2 và phách 4 — những phách nhẹ nên sẽ khó cảm nhận hơn đấy!', shortDesc: 'Phách 2 và 4' },
  ]
  if (timeSig === 3) return [
    { label: 'Level 1', beats: [1],     desc: 'Nghe bài hát và tap vào phách mạnh — thử cảm nhận xem nhịp nào được nhấn rõ nhất nhé!', shortDesc: 'Phách mạnh' },
    { label: 'Level 2', beats: [1,2,3], desc: 'Tap đều theo nhịp — giữ nhịp ổn định theo: 1 - 2 - 3', shortDesc: 'Đủ 3 phách' },
    { label: 'Level 3', beats: [1,3],   desc: 'Chỉ tap vào phách 1 và phách 3 — bỏ qua phách 2', shortDesc: 'Phách 1 và 3' },
    { label: 'Level 4', beats: [2],     desc: 'Tap vào phách 2 — phách nhẹ nên sẽ khó cảm nhận hơn đấy!', shortDesc: 'Phách 2' },
  ]
  if (timeSig === 6) return [
    { label: 'Level 1', beats: [1],           desc: 'Nghe bài hát và tap vào phách mạnh — thử cảm nhận xem nhịp nào được nhấn rõ nhất nhé!', shortDesc: 'Phách mạnh' },
    { label: 'Level 2', beats: [1,2,3,4,5,6], desc: 'Tap đều theo nhịp — giữ nhịp ổn định theo: 1-2-3-4-5-6', shortDesc: 'Đủ 6 phách' },
    { label: 'Level 3', beats: [1,4],         desc: 'Chỉ tap vào phách 1 và phách 4 — bỏ qua các phách còn lại', shortDesc: 'Phách 1 và 4' },
    { label: 'Level 4', beats: [2,3,5,6],     desc: 'Tap vào phách 2-3 và 5-6 — những phách nhẹ nên sẽ khó cảm nhận hơn đấy!', shortDesc: 'Phách 2,3,5,6' },
  ]
  return [
    { label: 'Level 1', beats: [1],     desc: 'Tap vào phách mạnh', shortDesc: 'Phách mạnh' },
    { label: 'Level 2', beats: Array.from({length:timeSig},(_,i)=>i+1), desc: `Tap đủ ${timeSig} phách`, shortDesc: `Đủ ${timeSig} phách` },
    { label: 'Level 3', beats: [1,3],   desc: 'Tap phách 1 và 3', shortDesc: 'Phách 1 và 3' },
    { label: 'Level 4', beats: [2,4],   desc: 'Tap phách 2 và 4', shortDesc: 'Phách 2 và 4' },
  ]
}

function generateTargetDots(song: RhythmSong, beats: number[]): Dot[] {
  const beatDur = 60 / song.tempo
  const dots: Dot[] = []
  for (let bar = 0; bar < song.totalBars; bar++) {
    for (const beat of beats) {
      dots.push({ time: bar * song.timeSignature * beatDur + (beat - 1) * beatDur })
    }
  }
  return dots
}

function BeatViz({ beats, timeSig }: { beats: number[]; timeSig: number }) {
  return (
    <div style={{ display:'flex', gap:4, alignItems:'center' }}>
      {Array.from({length: timeSig}, (_, i) => {
        const active = beats.includes(i + 1)
        return (
          <div key={i} style={{
            width: i === 0 ? 11 : 8, height: i === 0 ? 11 : 8,
            borderRadius: '50%',
            background: active ? C.greenPale : 'transparent',
            border: `1.5px solid ${active ? C.greenPale : 'rgba(220,230,210,0.2)'}`,
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

function getResultMsg(score: number): { emoji: string; title: string; body: string; hint?: string } {
  if (score >= 95) return { emoji:'🏆', title:'XUẤT SẮC!', body:'Bạn cảm nhận nhịp rất tốt! Gần như hoàn hảo rồi!' }
  if (score >= 80) return { emoji:'🎉', title:'RẤT TỐT!', body:'Tai nghe nhịp của bạn đang rất tốt! Tiếp tục phát huy nhé!' }
  if (score >= 65) return { emoji:'💪', title:'KHÁ TỐT!', body:'Bạn đang cảm nhận được nhịp rồi! Luyện thêm một chút nữa thôi!' }
  if (score >= 50) return { emoji:'🎯', title:'TIẾP TỤC!', body:'Bạn đang đi đúng hướng! Thử nghe lại bài và cảm nhận chỗ nhấn nhé!', hint:'Phách mạnh thường là nơi bài hát tạo cảm giác "nhấn" rõ hơn.' }
  return { emoji:'🥁', title:'LUYỆN THÊM NHÉ!', body:'Đừng nản! Hãy nghe lại bài hát thật kỹ.', hint:'Phách mạnh thường là nơi bài hát tạo cảm giác "nhấn" rõ hơn.' }
}

function Confetti({ show }: { show: boolean }) {
  if (!show) return null
  const colors = [C.greenPale, C.gold, '#60A5FA', '#F472B6', C.dotPurple]
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

// ── TapLandingPage — trang chào cho khách ──
function TapLandingPage({ onGuest }: { onGuest: () => void }) {
  const handleLogin = async () => {
    const email = prompt('Email:')
    const password = prompt('Mật khẩu:')
    if (email && password) await supabase.auth.signInWithPassword({ email, password })
  }
  return (
    <div style={{ minHeight:'100vh', background:C.bgPage, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:24, padding:32, fontFamily:'Inter, sans-serif' }}>
      <div style={{ fontSize:52 }}>🥁</div>
      <h1 style={{ fontSize:26, fontWeight:800, color:C.textDark, textAlign:'center', margin:0 }}>Luyện nhịp cùng Thầy Văn Anh</h1>
      <p style={{ color:'#8A8070', maxWidth:400, textAlign:'center', lineHeight:1.7, margin:0, fontSize:15 }}>
        Nếu bạn là <strong style={{ color:C.green }}>học sinh của Thầy Văn Anh</strong>, hãy đăng nhập để lưu điểm và theo dõi tiến độ học tập.
      </p>
      <button onClick={handleLogin} style={{ background:C.green, border:'none', borderRadius:12, color:'#fff', cursor:'pointer', padding:'13px 36px', fontSize:15, fontWeight:700 }}>
        Đăng nhập
      </button>
      <div style={{ color:'#B0A898', fontSize:13 }}>hoặc</div>
      <button onClick={onGuest} style={{ background:'none', border:`1px solid ${C.ctrlBorder}`, borderRadius:12, color:'#8A8070', cursor:'pointer', padding:'11px 28px', fontSize:13, lineHeight:1.5 }}>
        Xem thử 3 bài<br/><span style={{ fontSize:11, color:'#B0A898' }}>(không cần đăng nhập)</span>
      </button>
    </div>
  )
}

export function TapWithSong({ onClose, userRole }: { onClose: () => void; userRole?: string }) {
  const isTeacher = userRole === 'teacher' || userRole === 'admin'
  const isGuest = userRole === 'guest'

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
  const [guestSongsPlayed, setGuestSongsPlayed] = useState<string[]>([])
  const [showGuestLimit, setShowGuestLimit] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const autoShowResultRef = useRef(false)
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
      .order('created_at', { ascending: false }).limit(3)
    setTapHistory((data ?? []) as TapRecord[])
  }

  const loadSong = async (s: RhythmSong) => {
    if (isGuest) {
      const alreadyPlayed = guestSongsPlayed.includes(s.title)
      if (!alreadyPlayed && guestSongsPlayed.length >= GUEST_MAX_SONGS) { setShowGuestLimit(true); return }
      if (!alreadyPlayed) setGuestSongsPlayed(prev => [...prev, s.title])
    }
    setSong(s); setCurrentDots([]); setTapHistory([])
    setShowTeacher(false); setLastScore(null); setPendingSave(false)
    setSongTime(0); songTimeRef.current = 0; setIsPlaying(false)
    await loadProgress(s.title)
  }

  useEffect(() => { if (song) loadHistory(song.title, activeLevel) }, [activeLevel, song?.title])

  // Auto hiện kết quả khi bài kết thúc
  useEffect(() => {
    if (!isPlaying && autoShowResultRef.current) {
      autoShowResultRef.current = false
      setTimeout(() => {
        if (currentDots.length > 0) {
          setLastScore(currentScore ?? 0)
          setPrevBest(progress.best_scores[String(activeLevel)] ?? 0)
          setShowResultPopup(true)
        }
      }, 600)
    }
  }, [isPlaying])

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
    nextBeatRef.current = ctx.currentTime + (beatsElapsed * beatDur - fromTime)
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
        if (t >= totalDur) { songTimeRef.current = totalDur; setSongTime(totalDur); setIsPlaying(false); stopMetronome(); autoShowResultRef.current = true; return }
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
      if (e.code === 'KeyR') { e.preventDefault(); setCurrentDots([]); setLastScore(null); seekTo(0); setIsPlaying(false) }
      if (e.code === 'KeyT') { e.preventDefault(); setShowTeacher(t => !t) }
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
  const targetDots = song && levelConfig ? generateTargetDots(song, levelConfig.beats) : []
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

  const handleReset = () => { setCurrentDots([]); setLastScore(null); seekTo(0); setIsPlaying(false); autoShowResultRef.current = false }

  const handleShowResult = () => {
    if (currentDots.length === 0) return
    setLastScore(currentScore ?? 0); setPrevBest(bestThisLevel); setShowResultPopup(true)
  }

  const handleSave = async () => {
    if (!song?.title || currentDots.length === 0) return
    const score = currentScore ?? 0
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaveMsg('Chưa đăng nhập!'); return }
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
    setProgress(p => ({ ...p, best_scores: newBestScores, unlocked_levels: newUnlocked }))
    setTapHistory(prev => [{ id: Date.now().toString(), dots: currentDots, score, level: activeLevel, created_at: new Date().toISOString() }, ...prev.slice(0,2)])
    setCurrentDots([]); setShowResultPopup(false); setPendingSave(false)
    if (leveledUp) { setShowConfetti(true); setShowLevelUp(true); setTimeout(() => { setShowConfetti(false); setShowLevelUp(false) }, 4000) }
    else if (score >= 80) { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3000) }
    setSaveMsg('Đã lưu!'); setTimeout(() => setSaveMsg(''), 2000)
  }

  const handleDeleteHistory = async (id: string) => {
    await supabase.from('student_taps').delete().eq('id', id)
    setTapHistory(prev => prev.filter(h => h.id !== id))
  }

  const handleLogin = async () => {
    const email = prompt('Email:')
    const password = prompt('Mật khẩu:')
    if (email && password) await supabase.auth.signInWithPassword({ email, password })
  }

  const nowX = containerW * NOW_X_FRAC
  const scrollOffset = songTime * PX_PER_SEC
  const fmtTime = (t: number) => `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`
  const resultMsg = lastScore !== null ? getResultMsg(lastScore) : null
  const starCount = lastScore !== null ? stars(lastScore) : 0

  // History colors — mờ dần
  const histColors = [C.dotPurple, C.dotPurple, C.dotPurple]
  const histOpacity = [1, 0.65, 0.38]

  return (
    <div style={{ position:'fixed', inset:0, background:C.bgPage, display:'flex', flexDirection:'column', zIndex:200, fontFamily:'Inter, sans-serif' }}>
      <Confetti show={showConfetti} />

      {/* ── HEADER — kem sáng ── */}
      <div style={{ background:C.bgPage, borderBottom:`1px solid ${C.bgPageBorder}`, padding:'0 20px', height:52, display:'flex', alignItems:'center', gap:14, flexShrink:0 }}>
        {/* Logo */}
        <img src="https://wojmdilyflffvdtpovmq.supabase.co/storage/v1/object/public/assets/Logo.svg"
          alt="Logo" style={{ width:28, height:28, flexShrink:0 }} />
        <span style={{ fontSize:13, fontWeight:700, color:C.textDark, flexShrink:0 }}>Thầy Văn Anh Guitar</span>

        {/* Chọn bài */}
        <button onClick={() => setShowSongList(true)} style={{ padding:'5px 13px', borderRadius:8, border:`1px solid ${C.ctrlBorder}`, background:C.bgWoodCard, color:C.textWood, fontSize:12, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
          🎵 Chọn bài ▾
        </button>

        {/* Tên bài — trung tâm */}
        <div style={{ flex:1, textAlign:'center' }}>
          {song ? (
            <span style={{ fontSize:17, fontWeight:800, color:C.textDark, letterSpacing:'0.02em' }}>
              {song.title.toUpperCase()}
            </span>
          ) : (
            <span style={{ fontSize:13, color:'#B0A898' }}>Chưa chọn bài</span>
          )}
          {song && <span style={{ fontSize:10, color:'#8A8070', marginLeft:8 }}>{song.tempo} BPM · {song.timeSignature}/4</span>}
        </div>

        {/* Speed + User */}
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          {song && (
            <div style={{ display:'flex', gap:3 }}>
              {[0.5,0.75,1,1.25].map(s => (
                <button key={s} onClick={() => { setSpeed(s); if(isPlaying){setIsPlaying(false); setTimeout(()=>setIsPlaying(true),50)} }}
                  style={{ padding:'3px 8px', borderRadius:5, border:`1px solid ${C.ctrlBorder}`, fontSize:10, cursor:'pointer', fontWeight: speed===s?700:400,
                    background: speed===s ? C.green : C.bgWoodCard,
                    color: speed===s ? '#fff' : '#8A8070' }}>
                  {s===0.5?'50%':s===0.75?'75%':s===1?'100%':'125%'}
                </button>
              ))}
            </div>
          )}
          {userName ? (
            <div style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:20, border:`1px solid ${C.ctrlBorder}`, background:C.bgWoodCard }}>
              <div style={{ width:20, height:20, borderRadius:'50%', background:C.green, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'#fff' }}>
                {userName.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize:11, color:'#5A4A30' }}>{userName}</span>
            </div>
          ) : (
            <button onClick={handleLogin} style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 12px', borderRadius:20, border:`1px solid ${C.ctrlBorder}`, background:'none', color:'#8A8070', fontSize:12, cursor:'pointer' }}>
              👤 Đăng nhập
            </button>
          )}
          <button onClick={onClose} style={{ width:28, height:28, borderRadius:6, border:`1px solid ${C.ctrlBorder}`, background:'none', color:'#8A8070', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>
      </div>

      {/* ── GUEST BANNER ── */}
      {isGuest && (
        <div style={{ background:'rgba(63,125,58,0.08)', borderBottom:`1px solid rgba(63,125,58,0.15)`, padding:'5px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <span style={{ color:C.green, fontSize:12 }}>🎵 Chế độ khách — đã thử <strong>{guestSongsPlayed.length}/{GUEST_MAX_SONGS}</strong> bài · Điểm không được lưu</span>
          <button onClick={handleLogin} style={{ background:C.green, border:'none', borderRadius:6, color:'#fff', fontSize:11, fontWeight:600, cursor:'pointer', padding:'3px 12px' }}>Đăng nhập để lưu điểm</button>
        </div>
      )}

      {/* ── CHƯA CHỌN BÀI ── */}
      {!song && (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:20, padding:40 }}>
          <div style={{ fontSize:52 }}>🥁</div>
          <div style={{ color:C.textDark, fontWeight:800, fontSize:22, textAlign:'center' }}>Luyện nhịp cùng Thầy Văn Anh</div>
          <div style={{ background:C.bgWoodCard, border:`1px solid ${C.ctrlBorder}`, borderRadius:16, padding:'24px 32px', maxWidth:420, width:'100%' }}>
            {[['1️⃣','Chọn bài hát muốn luyện'],['2️⃣','Bấm Bắt đầu hoặc phím P để phát nhạc'],['3️⃣','Nghe metronome — tiếng CLICK TO là phách mạnh'],['4️⃣','Bấm nút TAP hoặc phím Space đúng phách'],['5️⃣','Bấm Xem kết quả → Lưu điểm để lên level']].map(([n,t]) => (
              <div key={n} style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:12 }}>
                <span style={{ fontSize:17, flexShrink:0 }}>{n}</span>
                <span style={{ color:'#8A8070', fontSize:14, lineHeight:1.6 }}>{t}</span>
              </div>
            ))}
            <div style={{ marginTop:10, padding:'10px 14px', background:'rgba(63,125,58,0.06)', borderRadius:10, border:`1px solid rgba(63,125,58,0.15)`, display:'flex', gap:8, alignItems:'center' }}>
              <span>💡</span>
              <span style={{ color:C.green, fontSize:13 }}>Đạt <strong>80 điểm</strong> để mở khoá level tiếp theo!</span>
            </div>
          </div>
          <button onClick={() => setShowSongList(true)} style={{ padding:'14px 44px', background:C.green, border:'none', borderRadius:12, color:'#fff', fontWeight:700, fontSize:17, cursor:'pointer' }}>
            🎵 Chọn bài hát
          </button>
        </div>
      )}

      {/* ── MAIN ── */}
      {song && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* LEVEL BAR — nâu gỗ */}
          <div style={{ background:C.bgWood, borderBottom:`1px solid ${C.bgWoodBorder}`, padding:'9px 20px', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
            {levels.map((lv, i) => {
              const lvNum = i + 1
              const unlocked = progress.unlocked_levels.includes(lvNum)
              const isActive = activeLevel === lvNum
              const best = progress.best_scores[String(lvNum)] ?? 0
              return (
                <button key={lvNum} onClick={() => unlocked && setActiveLevel(lvNum)} style={{
                  padding:'7px 18px', borderRadius:8,
                  border: `1px solid ${isActive ? C.green : C.bgWoodBorder}`,
                  background: isActive ? C.green : C.bgWoodCard,
                  color: isActive ? '#fff' : unlocked ? C.textWood : '#ACA090',
                  fontSize:12, fontWeight:600, cursor: unlocked ? 'pointer' : 'not-allowed',
                  opacity: unlocked ? 1 : 0.5,
                  display:'flex', alignItems:'center', gap:5,
                }}>
                  {!unlocked && <span style={{ fontSize:11 }}>🔒</span>}
                  {lv.label}
                  {unlocked && best > 0 && <span style={{ fontSize:9, opacity:0.7 }}>· {best}đ</span>}
                </button>
              )
            })}
            <div style={{ flex:1, textAlign:'center', fontSize:12, color:'#8A7A5A' }}>
              Cần <strong style={{ color:C.gold, fontSize:13 }}>{UNLOCK_SCORE}</strong> điểm để mở khoá
            </div>
            <div style={{ fontSize:12, color:'#8A7A5A', flexShrink:0 }}>
              Điểm hiện tại: <strong style={{ color:C.green }}>{bestThisLevel}</strong> / 100
            </div>
          </div>

          {/* MISSION — căn giữa, chữ sáng */}
          <div style={{ background:C.bgMission, borderBottom:`1px solid ${C.bgMissionBorder}`, padding:'10px 20px', display:'flex', flexDirection:'column', alignItems:'center', gap:7, flexShrink:0 }}>
            <div style={{ fontSize:13, color:C.textLight, fontWeight:500, textAlign:'center', lineHeight:1.5 }}>
              🎯 {levelConfig?.desc}
            </div>
            {levelConfig && <BeatViz beats={levelConfig.beats} timeSig={song.timeSignature} />}
          </div>

          {/* PROGRESS + BEAT gộp */}
          <div style={{ background:'#192C21', borderBottom:`1px solid rgba(220,230,210,0.07)`, padding:'7px 20px', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
            <span style={{ fontSize:10, color:C.textDim, width:30, flexShrink:0 }}>{fmtTime(songTime)}</span>
            <div style={{ flex:1, display:'flex', flexDirection:'column', gap:4 }}>
              {/* Progress bar */}
              <div style={{ height:3, background:'rgba(220,230,210,0.1)', borderRadius:2, cursor:'pointer', position:'relative' }}
                onClick={e => { const r=e.currentTarget.getBoundingClientRect(); seekTo((e.clientX-r.left)/r.width*totalDur) }}>
                <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`${totalDur>0?songTime/totalDur*100:0}%`, background:C.greenMid, borderRadius:2 }} />
              </div>
              {/* Beat marks */}
              <div style={{ height:8, position:'relative' }}>
                {Array.from({length: song.totalBars*song.timeSignature}, (_,i) => {
                  const t = i * beatDur
                  const pct = totalDur > 0 ? (t/speed/totalDur*100) : 0
                  const isBar = i % song.timeSignature === 0
                  const isTarget = levelConfig?.beats.includes(i%song.timeSignature+1)
                  return (
                    <div key={i} style={{ position:'absolute', bottom:0, left:`${pct}%`,
                      width: isBar ? 2 : 1,
                      height: isBar ? 8 : isTarget ? 6 : 4,
                      background: isTarget ? 'rgba(141,196,112,0.3)' : isBar ? 'rgba(220,210,190,0.12)' : 'rgba(220,210,190,0.05)',
                    }} />
                  )
                })}
              </div>
            </div>
            <span style={{ fontSize:10, color:C.textDim, width:30, textAlign:'right', flexShrink:0 }}>{fmtTime(totalDur)}</span>
          </div>

          {/* MAIN SCROLL AREA */}
          <div ref={scrollRef} style={{ flex:1, background:C.bgMain, position:'relative', overflow:'hidden', display:'flex' }}>

            {/* Dot tracks */}
            <div style={{ flex:1, position:'relative', overflow:'hidden' }}>

              {/* Playhead arrow — đầu mũi tên trên cùng */}
              <div style={{ position:'absolute', left:nowX, top:0, zIndex:11, transform:'translateX(-50%)', pointerEvents:'none' }}>
                <div style={{ width:0, height:0, borderLeft:'7px solid transparent', borderRight:'7px solid transparent', borderTop:`10px solid ${C.greenPale}` }} />
              </div>

              {/* Playhead line — bắt đầu dưới vùng lyrics, không cắt qua chữ */}
              <div style={{ position:'absolute', left:nowX, top:58, bottom:0, width:2, background:C.greenPale, opacity:0.45, zIndex:10, pointerEvents:'none' }} />

              {/* Lyrics */}
              <div style={{ position:'absolute', top:14, left:0, right:0, height:40, transform:`translateX(${-scrollOffset+nowX}px)` }}>
                {song.lyrics.map((l,i) => {
                  const lx = l.time * PX_PER_SEC
                  const nextTime = song.lyrics[i+1]?.time ?? l.time + beatDur*2
                  const isActive = songTime*speed >= l.time && songTime*speed < nextTime
                  return (
                    <div key={l.id} style={{ position:'absolute', left:lx/speed, transform:'translateX(-50%)',
                      fontSize: 18,
                      fontWeight: 500,
                      color: isActive ? C.gold : '#D0CFCA',
                      transition:'color 0.08s', whiteSpace:'nowrap', userSelect:'none',
                      letterSpacing: '0.02em' }}>
                      {l.text}
                    </div>
                  )
                })}
              </div>

              {/* Separator */}
              <div style={{ position:'absolute', top:62, left:0, right:0, height:1, background:'rgba(220,230,210,0.08)' }} />

              {/* Teacher dots */}
              {showTeacher && (
                <div style={{ position:'absolute', top:65, left:0, right:0, height:26, transform:`translateX(${-scrollOffset+nowX}px)` }}>
                  {targetDotsScaled.map((d,i) => (
                    <div key={'td'+i} style={{ position:'absolute', left:d.time*PX_PER_SEC, transform:'translateX(-50%)',
                      width:10, height:10, borderRadius:'50%', background:C.dotGold, top:8, opacity:0.9 }} />
                  ))}
                </div>
              )}

              {/* Current dots */}
              <div style={{ position:'absolute', top: showTeacher ? 93 : 67, left:0, right:0, height:28, transform:`translateX(${-scrollOffset+nowX}px)` }}>
                {scoredCurrent.map((d,i) => (
                  <div key={'cd'+i} style={{ position:'absolute', left:d.time*PX_PER_SEC, transform:'translateX(-50%)',
                    width:11, height:11, borderRadius:'50%', top:8,
                    background: targetDotsScaled.length>0 ? (d.hit ? C.dotBlue : 'transparent') : C.dotBlue,
                    border: targetDotsScaled.length>0 && !d.hit ? `2px solid ${C.dotBlue}` : 'none' }} />
                ))}
              </div>

              {/* History rows */}
              {tapHistory.map((h, hi) => {
                const topBase = (showTeacher ? 93 : 67) + 30 + hi * 26
                return (
                  <div key={h.id} style={{ position:'absolute', top:topBase, left:0, right:0, height:24, transform:`translateX(${-scrollOffset+nowX}px)`, opacity:histOpacity[hi] }}>
                    {h.dots.map((d,di) => (
                      <div key={di} style={{ position:'absolute', left:d.time*PX_PER_SEC, transform:'translateX(-50%)',
                        width:9, height:9, borderRadius:'50%', top:7,
                        background:histColors[hi] }} />
                    ))}
                  </div>
                )
              })}
            </div>

            {/* Legend — cố định bên phải */}
            <div style={{ width:130, flexShrink:0, padding:'10px 12px', display:'flex', flexDirection:'column', justifyContent:'flex-start', gap:0, borderLeft:`1px solid rgba(220,230,210,0.08)` }}>
              {/* Đáp án Thầy */}
              <div style={{ height:26, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, fontWeight:600, color:C.dotGold }}>
                  <div style={{ width:12, height:2, borderRadius:1, background:C.dotGold }} />
                  Đáp án Thầy
                </div>
                <button onClick={() => setShowTeacher(t=>!t)}
                  style={{ padding:'2px 6px', borderRadius:4, border:`1px solid rgba(220,230,210,0.15)`, background:'rgba(220,230,210,0.06)', fontSize:9, color:C.textLegend, cursor:'pointer' }}>
                  {showTeacher ? 'Ẩn' : 'Xem'}
                </button>
              </div>

              {/* Lần này */}
              <div style={{ height: showTeacher ? 26 : 26, display:'flex', alignItems:'center', marginTop: showTeacher ? 28 : 0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, fontWeight:600, color:C.dotBlue }}>
                  <div style={{ width:12, height:2, borderRadius:1, background:C.dotBlue }} />
                  Lần này
                </div>
              </div>

              {/* History labels */}
              {tapHistory.map((h, hi) => (
                <div key={h.id} style={{ height:26, display:'flex', alignItems:'center', justifyContent:'space-between', opacity:histOpacity[hi], marginTop:4 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, fontWeight:600, color:C.dotPurple }}>
                    <div style={{ width:12, height:2, borderRadius:1, background:C.dotPurple }} />
                    Lần {tapHistory.length - hi} · {h.score}đ
                  </div>
                  <button onClick={() => handleDeleteHistory(h.id)}
                    style={{ width:18, height:18, borderRadius:4, border:`1px solid rgba(220,230,210,0.15)`, background:'rgba(220,230,210,0.06)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#A88080', fontSize:10 }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* SCORE ROW */}
          <div style={{ background:C.bgMain, borderTop:`1px solid rgba(220,230,210,0.08)`, padding:'8px 20px', display:'flex', alignItems:'center', justifyContent:'center', gap:14, flexShrink:0 }}>
            <div style={{ width:28, height:28, borderRadius:'50%', border:`2px solid ${C.gold}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13 }}>⭐</div>
            <span style={{ fontSize:22, fontWeight:800, color:C.greenPale }}>{currentScore ?? 0}</span>
            <span style={{ fontSize:13, color:C.textMuted }}>/ 100</span>
            <div style={{ width:4, height:4, borderRadius:'50%', background:'#5A7260' }} />
            <span style={{ fontSize:13, color:C.greenPale, fontWeight:600 }}>
              {scoredCurrent.filter(d=>d.hit).length} <span style={{ color:C.textMuted, fontWeight:400 }}>/ {targetDotsScaled.length} phách đúng</span>
            </span>
            {currentDots.length > 0 && isPlaying && (
              <button onClick={handleShowResult} style={{ padding:'7px 16px', borderRadius:8, background:'#243D2C', border:`1px solid rgba(141,196,112,0.3)`, color:C.greenPale, fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:5, cursor:'pointer' }}>
                📊 Xem kết quả
              </button>
            )}
            {saveMsg && <span style={{ fontSize:11, color:C.greenPale, fontWeight:600 }}>✓ {saveMsg}</span>}
          </div>

          {/* ── CONTROLS — kem sáng ── */}
          <div style={{ background:C.bgPage, borderTop:`1px solid ${C.bgPageBorder}`, padding:'14px 20px 10px', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12 }}>

              {/* Làm lại */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flex:1, maxWidth:130 }}>
                <button onClick={handleReset} style={{ width:'100%', padding:'12px 10px', borderRadius:12, border:`1px solid ${C.ctrlBorder}`, background:C.bgWoodCard, color:C.textWood, fontSize:12, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                  🔄 Làm lại
                </button>
                <span style={{ fontSize:10, color:'#8A8070' }}>Phím R</span>
              </div>

              {/* Bắt đầu / Dừng */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flex:1, maxWidth:130 }}>
                <button onClick={() => setIsPlaying(p=>!p)} style={{ width:'100%', padding:'12px 10px', borderRadius:12, border:`1px solid ${C.ctrlBorder}`, background:C.bgWoodCard, color:C.textWood, fontSize:12, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                  {isPlaying ? '⏸ Dừng' : '▶ Bắt đầu'}
                </button>
                <span style={{ fontSize:10, color:'#8A8070' }}>Phím P</span>
              </div>

              {/* TAP — SVG tròn xanh lá, chính tâm, không nhảy */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flexShrink:0 }}>
                <svg width="104" height="104" viewBox="0 0 104 104"
                  style={{ cursor:'pointer', display:'block', flexShrink:0 }}
                  onMouseDown={e => { e.preventDefault(); handleTap() }}
                  onTouchStart={e => { e.preventDefault(); handleTap() }}
                  aria-label="TAP" role="button">
                  <circle cx="52" cy="52" r="48" fill={isPlaying ? C.green : '#D8D4C8'} stroke={isPlaying ? C.greenLight : '#B8B4A8'} strokeWidth="2.5"/>
                  <circle cx="52" cy="52" r="44" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
                  <text x="52" y="52" textAnchor="middle" dominantBaseline="central"
                    fill={isPlaying ? '#ffffff' : '#8A8070'}
                    fontFamily="Inter, sans-serif" fontSize="19" fontWeight="800" letterSpacing="3">
                    TAP
                  </text>
                </svg>
                <span style={{ fontSize:10, color:'#8A8070' }}>Phím Space</span>
              </div>

              {/* Đáp án */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flex:1, maxWidth:130 }}>
                <button onClick={() => setShowTeacher(t=>!t)} style={{ width:'100%', padding:'12px 10px', borderRadius:12,
                  border:`1px solid ${showTeacher ? 'rgba(201,151,0,0.4)' : C.ctrlBorder}`,
                  background: showTeacher ? 'rgba(201,151,0,0.08)' : C.bgWoodCard,
                  color: showTeacher ? C.gold : '#8A6A00',
                  fontSize:12, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                  👁 Đáp án
                </button>
                <span style={{ fontSize:10, color:'#8A8070' }}>Phím T</span>
              </div>

            </div>

            <div style={{ textAlign:'center', fontSize:9, color:'#B0A898', marginTop:8, letterSpacing:'0.03em' }}>
              Space = TAP &nbsp;·&nbsp; P = Bắt đầu/Dừng &nbsp;·&nbsp; R = Làm lại &nbsp;·&nbsp; T = Đáp án &nbsp;·&nbsp; Esc = Đóng
            </div>
          </div>

        </div>
      )}

      {/* ── POPUP KẾT QUẢ ── */}
      {showResultPopup && lastScore !== null && resultMsg && (
        <div style={{ position:'fixed', inset:0, background:'rgba(20,30,20,0.8)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={() => setShowResultPopup(false)}>
          <div style={{ background:C.bgWoodCard, borderRadius:20, padding:'32px 28px', textAlign:'center', border:`1px solid ${C.ctrlBorder}`, maxWidth:360, width:'100%' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:48, marginBottom:8 }}>{resultMsg.emoji}</div>
            <div style={{ color:C.textDark, fontWeight:800, fontSize:22, marginBottom:8 }}>{resultMsg.title}</div>
            <div style={{ fontSize:54, fontWeight:900, lineHeight:1, marginBottom:6, color: lastScore>=80?C.green:lastScore>=60?C.gold:'#C0392B' }}>
              {lastScore}<span style={{ fontSize:22, color:'#8A8070' }}>/100</span>
            </div>
            <div style={{ fontSize:22, marginBottom:10 }}>{'⭐'.repeat(starCount)}{'☆'.repeat(5-starCount)}</div>
            {prevBest > 0 && (
              <div style={{ fontSize:13, marginBottom:10, fontWeight:600, color: lastScore>prevBest?C.green:'#8A8070' }}>
                {lastScore>prevBest?`📈 +${lastScore-prevBest} so với kỷ lục!`:lastScore===prevBest?'🎯 Bằng kỷ lục!':` Kỷ lục: ${prevBest}`}
              </div>
            )}
            <div style={{ color:'#6A6A6A', fontSize:13, marginBottom:resultMsg.hint?8:16, lineHeight:1.6 }}>{resultMsg.body}</div>
            {resultMsg.hint && (
              <div style={{ marginBottom:16, padding:'10px 14px', background:'rgba(63,125,58,0.06)', borderRadius:10, border:`1px solid rgba(63,125,58,0.15)`, fontSize:12, color:C.green, lineHeight:1.5 }}>
                💡 {resultMsg.hint}
              </div>
            )}
            {lastScore < UNLOCK_SCORE && activeLevel < levels.length && (
              <div style={{ marginBottom:16, padding:'10px 14px', background:'rgba(201,151,0,0.06)', borderRadius:10, border:`1px solid rgba(201,151,0,0.2)` }}>
                <div style={{ fontSize:12, color:C.gold, marginBottom:6 }}>Cần thêm <strong>{UNLOCK_SCORE-lastScore} điểm</strong> để mở Level {activeLevel+1}</div>
                <div style={{ height:5, background:'#E8E4D8', borderRadius:3, overflow:'hidden' }}>
                  <div style={{ width:`${Math.min(lastScore/UNLOCK_SCORE*100,100)}%`, height:'100%', background:C.gold, borderRadius:3, transition:'width 0.5s' }} />
                </div>
              </div>
            )}
            {lastScore >= UNLOCK_SCORE && activeLevel < levels.length && (
              <div style={{ marginBottom:16, padding:'10px 14px', background:'rgba(63,125,58,0.06)', borderRadius:10, border:`1px solid rgba(63,125,58,0.2)` }}>
                <div style={{ fontSize:13, color:C.green, fontWeight:700 }}>🔓 Đủ điểm mở Level {activeLevel+1}! Lưu để nhận thưởng</div>
              </div>
            )}
            {isGuest ? (
              <div>
                <div style={{ marginBottom:12, padding:'10px 14px', background:'rgba(63,125,58,0.06)', borderRadius:10, border:`1px solid rgba(63,125,58,0.15)`, fontSize:13, color:C.green }}>
                  💡 Đăng nhập để lưu điểm và xem lại lịch sử!
                </div>
                <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
                  <button onClick={() => { setShowResultPopup(false); setCurrentDots([]) }}
                    style={{ padding:'10px 20px', background:C.bgWoodCard, border:`1px solid ${C.ctrlBorder}`, borderRadius:10, color:C.textDark, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                    🔄 Thử lại
                  </button>
                  <button onClick={handleLogin}
                    style={{ padding:'10px 20px', background:C.green, border:'none', borderRadius:10, color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                    Đăng nhập
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
                <button onClick={() => { setShowResultPopup(false); setCurrentDots([]) }}
                  style={{ padding:'10px 20px', background:C.bgWoodCard, border:`1px solid ${C.ctrlBorder}`, borderRadius:10, color:C.textDark, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                  🔄 Thử lại
                </button>
                <button onClick={handleSave}
                  style={{ padding:'10px 24px', background:C.green, border:'none', borderRadius:10, color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                  💾 Lưu điểm
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── LEVEL UP ── */}
      {showLevelUp && (
        <div style={{ position:'fixed', inset:0, background:'rgba(20,30,20,0.88)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:C.bgWoodCard, borderRadius:20, padding:40, textAlign:'center', border:`2px solid ${C.green}`, maxWidth:340 }}>
            <div style={{ fontSize:54, marginBottom:8 }}>✨</div>
            <div style={{ color:C.green, fontWeight:900, fontSize:28, marginBottom:4 }}>LEVEL UP!</div>
            <div style={{ color:C.textDark, fontWeight:700, fontSize:18, marginBottom:8 }}>🔓 Level {activeLevel+1} đã mở khoá!</div>
            <div style={{ color:'#6A6A6A', fontSize:13, marginBottom:6 }}>Thử thách mới:</div>
            <div style={{ color:C.green, fontSize:14, fontWeight:600, marginBottom:8 }}>{levels[activeLevel]?.desc}</div>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:20 }}>
              {song && levels[activeLevel] && <BeatViz beats={levels[activeLevel].beats} timeSig={song.timeSignature} />}
            </div>
            <button onClick={() => { setShowLevelUp(false); setActiveLevel(activeLevel+1) }}
              style={{ padding:'12px 32px', background:C.green, border:'none', borderRadius:10, color:'#fff', fontWeight:700, fontSize:15, cursor:'pointer' }}>
              Thử ngay →
            </button>
          </div>
        </div>
      )}

      {/* ── GUEST LIMIT ── */}
      {showGuestLimit && (
        <div style={{ position:'fixed', inset:0, background:'rgba(20,30,20,0.85)', zIndex:700, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:C.bgWoodCard, borderRadius:20, padding:'32px 28px', textAlign:'center', border:`1px solid ${C.ctrlBorder}`, maxWidth:340, width:'100%' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🎵</div>
            <div style={{ color:C.textDark, fontWeight:800, fontSize:20, marginBottom:8 }}>Bạn đã thử {GUEST_MAX_SONGS} bài!</div>
            <div style={{ color:'#6A6A6A', fontSize:14, lineHeight:1.65, marginBottom:20 }}>
              Đăng nhập để tiếp tục luyện tập với tất cả bài hát và lưu điểm.
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button onClick={() => setShowGuestLimit(false)}
                style={{ padding:'10px 20px', background:C.bgWoodCard, border:`1px solid ${C.ctrlBorder}`, borderRadius:10, color:'#8A8070', fontWeight:500, fontSize:13, cursor:'pointer' }}>
                Đóng
              </button>
              <button onClick={handleLogin}
                style={{ padding:'10px 24px', background:C.green, border:'none', borderRadius:10, color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                Đăng nhập ngay
              </button>
            </div>
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
