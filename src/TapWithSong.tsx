import { useState, useEffect, useRef, useCallback } from 'react'
import type { RhythmSong } from './types'
import { supabase } from './supabase'
import { SongList } from './SongList'

// ── DESIGN TOKENS ──────────────────────────────────────────
// Moss forest palette — matte, desaturated, organic
const C = {
  // Backgrounds — earth tones, không LED xanh
  bgHeader:   '#14532D',   // header — giữ nguyên brand
  bgDark:     '#1C3324',   // workspace — tối nhưng ấm, ngả nâu rêu
  bgMid:      '#213B2A',   // level bar — moss sẫm
  bgCard:     '#243D2C',   // card — rêu trung tính, không LED
  bgDeep:     '#192C21',   // timeline — tối nhất, focus zone
  bgControls: '#ECEFE6',   // controls — warm grey-green, không trắng

  // Borders — matte, không glow
  borderDark:  'rgba(220,230,210,0.09)',
  borderMid:   'rgba(220,230,210,0.13)',
  borderLight: '#B8CCAA',   // bớt tươi hơn C9DDB8
  borderGold:  'rgba(185,138,50,0.30)',

  // Accent — desaturated organic
  green:      '#3A6B35',   // active — moss green, bớt sáng
  greenLight: '#8DC470',   // highlight — sage green, không neon
  greenMid:   '#6A9E54',   // progress, hit dots — rêu trung
  gold:       '#B89040',   // dusty gold — ấm hơn C99700
  goldPale:   'rgba(184,144,64,0.10)',
  red:        '#7A3530',   // miss — đỏ trầm rêu

  // Text on dark
  textLight:  '#EAE8DC',   // trắng kem ấm, không trắng tinh
  textMuted:  '#A8BBA0',   // xanh xám muted
  textDim:    '#5A7260',   // dim — rêu tối

  // Text on light (controls)
  textDark:      '#1E2A1E',
  textDarkMuted: '#4A6050',

  // Controls area
  ctrlBg:     '#F4F7EE',   // trắng ngà xanh nhạt
  ctrlBorder: '#C4D4B0',   // border organic
  ctrlText:   '#2A4E2A',
}

type Dot = { time: number }
type ScoredDot = Dot & { hit: boolean }
type TapRecord = { id: string; dots: Dot[]; score: number; level: number; created_at: string }
type Progress = { current_level: number; best_scores: Record<string, number>; unlocked_levels: number[] }

const PX_PER_SEC = 120
const NOW_X_FRAC = 0.3
const UNLOCK_SCORE = 80
const GUEST_MAX_SONGS = 3

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
    { label: 'Level 1', beats: [1],           desc: 'Nghe bài hát và tap vào phách mạnh — thử cảm nhận xem nhịp nào được nhấn rõ nhất nhé!', shortDesc: 'Phách mạnh (phách 1)' },
    { label: 'Level 2', beats: [1,2,3,4,5,6], desc: 'Tap đều theo nhịp — giữ nhịp ổn định theo: 1-2-3-4-5-6', shortDesc: 'Đủ 6 phách' },
    { label: 'Level 3', beats: [1,4],         desc: 'Chỉ tap vào phách 1 và phách 4 — bỏ qua các phách còn lại', shortDesc: 'Phách 1 và 4' },
    { label: 'Level 4', beats: [2,3,5,6],     desc: 'Tap vào phách 2-3 và 5-6 — những phách nhẹ nên sẽ khó cảm nhận hơn đấy!', shortDesc: 'Phách 2,3,5,6' },
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
    <div style={{ display:'flex', gap:4, alignItems:'center' }}>
      {Array.from({length: timeSig}, (_, i) => {
        const beat = i + 1
        const active = beats.includes(beat)
        return (
          <div key={i} style={{
            width: beat === 1 ? 13 : 10,
            height: beat === 1 ? 13 : 10,
            borderRadius: '50%',
            background: active ? C.greenLight : 'transparent',
            border: `1.5px solid ${active ? C.greenLight : C.borderMid}`,
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

function getResultMsg(score: number): { emoji: string; title: string; body: string; hint?: string } {
  if (score >= 95) return { emoji:'🏆', title:'XUẤT SẮC!', body:'Bạn cảm nhận nhịp rất tốt! Gần như hoàn hảo rồi!' }
  if (score >= 80) return { emoji:'🎉', title:'RẤT TỐT!', body:'Tai nghe nhịp của bạn đang rất tốt! Tiếp tục phát huy nhé!' }
  if (score >= 65) return { emoji:'💪', title:'KHÁ TỐT!', body:'Bạn đang cảm nhận được nhịp rồi! Luyện thêm một chút nữa thôi!' }
  if (score >= 50) return { emoji:'🎯', title:'TIẾP TỤC!', body:'Bạn đang đi đúng hướng! Thử nghe lại bài và cảm nhận chỗ nhấn nhé!', hint:'Phách mạnh thường là nơi bài hát tạo cảm giác "nhấn" rõ hơn — hãy thử nghe lại và cảm nhận nhé!' }
  return { emoji:'🥁', title:'LUYỆN THÊM NHÉ!', body:'Đừng nản! Hãy nghe lại bài hát thật kỹ và cảm nhận chỗ nhịp được nhấn mạnh hơn.', hint:'Phách mạnh thường là nơi bài hát tạo cảm giác "nhấn" rõ hơn — hãy thử nghe lại và cảm nhận nhé!' }
}

function Confetti({ show }: { show: boolean }) {
  if (!show) return null
  const colors = [C.greenLight, C.gold, '#60A5FA', '#F472B6', '#A78BFA', C.greenMid]
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
    setTapHistory(prev => [{ id: Date.now().toString(), dots: currentDots, score, level: activeLevel, created_at: new Date().toISOString() }, ...prev.slice(0,4)])
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

  // ── SHARED BUTTON STYLES ────────────────────────────────
  const btnKeyStyle = {
    width: 52, height: 52, borderRadius: 10,
    background: C.ctrlBg,
    border: `1.5px solid ${C.ctrlBorder}`,
    color: C.ctrlText, fontSize: 13, fontWeight: 700,
    cursor: 'pointer', display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', justifyContent: 'center', gap: 2,
    boxShadow: '0 2px 6px rgba(20,83,45,0.12), inset 0 1px 0 rgba(255,255,255,0.8)',
  }

  const btnActionStyle = {
    padding: '9px 16px', borderRadius: 10,
    border: `1px solid ${C.ctrlBorder}`,
    background: C.ctrlBg,
    color: C.ctrlText, fontSize: 12, fontWeight: 500,
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
    whiteSpace: 'nowrap' as const,
    boxShadow: '0 1px 4px rgba(20,83,45,0.08)',
  }

  return (
    <div style={{ position:'fixed', inset:0, background:C.bgDark, display:'flex', flexDirection:'column', zIndex:200, fontFamily:'Inter, sans-serif' }}>
      <Confetti show={showConfetti} />

      {/* ── GUEST BANNER ── */}
      {isGuest && (
        <div style={{ background:'rgba(167,216,138,0.1)', borderBottom:`1px solid rgba(167,216,138,0.2)`, padding:'6px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <span style={{ color:C.greenLight, fontSize:12 }}>
            🎵 Chế độ khách — đã thử <strong>{guestSongsPlayed.length}/{GUEST_MAX_SONGS}</strong> bài · Điểm không được lưu
          </span>
          <button onClick={handleLogin} style={{ background:C.green, border:'none', borderRadius:6, color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', padding:'4px 14px' }}>
            Đăng nhập để lưu điểm
          </button>
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{ background:C.bgHeader, borderBottom:`1px solid rgba(167,216,138,0.12)`, padding:'0 20px', height:52, display:'flex', alignItems:'center', gap:16, flexShrink:0 }}>
        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <img src="https://wojmdilyflffvdtpovmq.supabase.co/storage/v1/object/public/assets/Logo.svg"
            alt="Logo" style={{ width:32, height:32, filter:'brightness(0) saturate(100%) invert(72%) sepia(60%) saturate(800%) hue-rotate(5deg) brightness(105%)' }} />
          <div style={{ lineHeight:1.2 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.gold, letterSpacing:'0.01em' }}>Thầy Văn Anh Guitar</div>
            <div style={{ fontSize:9, color:C.textMuted, letterSpacing:'0.04em' }}>Học · Tập và Sống cùng Âm nhạc</div>
          </div>
        </div>

        {/* Tab active */}
        <div style={{ display:'flex', alignItems:'center', gap:6, borderBottom:`2px solid ${C.gold}`, paddingBottom:2, marginBottom:-2 }}>
          <span style={{ fontSize:13, fontWeight:600, color:C.gold }}>🎵 Tập nhịp</span>
        </div>

        {/* Chọn bài */}
        <button onClick={() => setShowSongList(true)} style={{ padding:'5px 14px', borderRadius:7, border:`1px solid rgba(167,216,138,0.3)`, background:'rgba(167,216,138,0.1)', color:C.greenLight, fontSize:12, fontWeight:600, cursor:'pointer' }}>
          Chọn bài
        </button>

        {/* Song info */}
        {song && (
          <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
            <span style={{ fontSize:14, fontWeight:700, color:C.textLight }}>{song.title}</span>
            {song.artist && <span style={{ fontSize:11, color:C.textMuted }}>— {song.artist}</span>}
            <span style={{ fontSize:10, color:C.textDim }}>{song.tempo} BPM · {song.timeSignature}/4</span>
          </div>
        )}

        {/* Speed + User */}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
          {song && (
            <div style={{ display:'flex', gap:3 }}>
              {[0.5,0.75,1,1.25].map(s => (
                <button key={s} onClick={() => { setSpeed(s); if(isPlaying){setIsPlaying(false); setTimeout(()=>setIsPlaying(true),50)} }}
                  style={{ padding:'3px 9px', borderRadius:5, border:'none', fontSize:10, cursor:'pointer', fontWeight: speed===s?700:400,
                    background: speed===s ? C.greenLight : 'rgba(244,241,232,0.1)',
                    color: speed===s ? C.bgHeader : C.textMuted }}>
                  {s===0.5?'50%':s===0.75?'75%':s===1?'100%':'125%'}
                </button>
              ))}
            </div>
          )}
          {userName && (
            <div style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:20, background:'rgba(244,241,232,0.1)', border:`1px solid rgba(244,241,232,0.12)` }}>
              <div style={{ width:20, height:20, borderRadius:'50%', background:C.green, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff' }}>
                {userName.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize:11, color:C.textMuted }}>{userName}</span>
            </div>
          )}
          <button onClick={onClose} style={{ width:28, height:28, borderRadius:6, border:`1px solid rgba(244,241,232,0.15)`, background:'none', color:C.textMuted, cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>
      </div>

      {/* ── CHƯA CHỌN BÀI ── */}
      {!song && (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:24, padding:40 }}>
          <div style={{ fontSize:56 }}>🥁</div>
          <div style={{ color:C.textLight, fontWeight:700, fontSize:24, textAlign:'center' }}>Luyện nhịp cùng Thầy Văn Anh</div>
          <div style={{ background:C.bgCard, border:`1px solid ${C.borderDark}`, borderRadius:16, padding:'24px 32px', maxWidth:420, width:'100%' }}>
            {[
              ['1️⃣', 'Chọn bài hát muốn luyện'],
              ['2️⃣', 'Bấm Bắt đầu hoặc phím P để phát nhạc'],
              ['3️⃣', 'Nghe metronome — tiếng CLICK TO là phách mạnh'],
              ['4️⃣', 'Bấm nút TAP hoặc phím Space đúng phách'],
              ['5️⃣', 'Bấm Xem kết quả → Lưu điểm để lên level'],
            ].map(([num, text]) => (
              <div key={num} style={{ display:'flex', gap:14, alignItems:'flex-start', marginBottom:14 }}>
                <span style={{ fontSize:18, flexShrink:0 }}>{num}</span>
                <span style={{ color:C.textMuted, fontSize:14, lineHeight:1.6 }}>{text}</span>
              </div>
            ))}
            <div style={{ marginTop:12, padding:'12px 16px', background:'rgba(167,216,138,0.08)', borderRadius:10, border:`1px solid rgba(167,216,138,0.2)`, display:'flex', gap:10, alignItems:'center' }}>
              <span>💡</span>
              <span style={{ color:C.greenLight, fontSize:13 }}>Đạt <strong>80 điểm</strong> để mở khoá level tiếp theo!</span>
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

          {/* LỘ TRÌNH LUYỆN TẬP */}
          <div style={{ background:C.bgMid, borderBottom:`1px solid ${C.borderDark}`, padding:'10px 20px', flexShrink:0 }}>
            <div style={{ fontSize:10, color:C.textDim, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>
              🌱 Lộ trình luyện tập
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              {levels.map((lv, i) => {
                const lvNum = i + 1
                const unlocked = progress.unlocked_levels.includes(lvNum)
                const isActive = activeLevel === lvNum
                const best = progress.best_scores[String(lvNum)] ?? 0
                return (
                  <button key={lvNum} onClick={() => unlocked && setActiveLevel(lvNum)} style={{
                    display:'flex', alignItems:'center', gap:10,
                    padding:'6px 14px', borderRadius:7,
                    background: isActive ? 'rgba(58,107,53,0.55)' : unlocked ? 'rgba(36,61,44,0.6)' : 'rgba(25,44,33,0.4)',
                    border: isActive ? `1px solid rgba(141,196,112,0.45)` : `1px solid ${C.borderDark}`,
                    borderLeft: isActive ? `3px solid ${C.greenLight}` : unlocked ? `3px solid ${C.borderMid}` : `3px solid transparent`,
                    color: isActive ? C.textLight : unlocked ? C.textMuted : C.textDim,
                    cursor: unlocked ? 'pointer' : 'not-allowed',
                    opacity: unlocked ? 1 : 0.4, minWidth:110,
                  }}>
                    <div style={{ textAlign:'left' }}>
                      <div style={{ fontSize:11, fontWeight: isActive ? 700 : 500, letterSpacing:'0.01em' }}>
                        {unlocked ? lv.label : `🔒 L${lvNum}`}
                      </div>
                      {unlocked && <div style={{ fontSize:9, opacity:0.65, marginTop:1, color: isActive ? C.greenLight : C.textDim }}>Best: {best}đ</div>}
                    </div>
                  </button>
                )
              })}
              <div style={{ marginLeft:'auto', fontSize:10, color:C.textDim }}>Cần {UNLOCK_SCORE}đ để mở khoá</div>
            </div>
          </div>

          {/* NHIỆM VỤ + PROGRESS */}
          <div style={{ background:C.bgCard, borderBottom:`1px solid ${C.borderDark}`, padding:'10px 20px', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
              <span style={{ fontSize:13, color:C.greenLight, fontWeight:500, flex:1, lineHeight:1.5 }}>
                🎯 {levelConfig?.desc}
              </span>
              {levelConfig && <BeatViz beats={levelConfig.beats} timeSig={song.timeSignature} />}
            </div>
            {/* Progress bar */}
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:10, color:C.textDim, width:32 }}>{fmtTime(songTime)}</span>
              <div style={{ flex:1, height:4, background:'rgba(244,241,232,0.1)', borderRadius:2, cursor:'pointer', position:'relative' }}
                onClick={e => { const r=e.currentTarget.getBoundingClientRect(); seekTo((e.clientX-r.left)/r.width*totalDur) }}>
                <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`${totalDur>0?songTime/totalDur*100:0}%`, background:C.greenMid, borderRadius:2 }} />
              </div>
              <span style={{ fontSize:10, color:C.textDim, width:32, textAlign:'right' }}>{fmtTime(totalDur)}</span>
            </div>
          </div>

          {/* TIMELINE / SCROLL AREA */}
          <div ref={scrollRef} style={{ flex:1, position:'relative', overflow:'hidden', background:C.bgDeep }}>
            {/* Now line */}
            <div style={{ position:'absolute', left:nowX, top:0, bottom:0, width:2, background:C.greenMid, opacity:0.45, zIndex:10, pointerEvents:'none' }} />

            {/* Lyrics */}
            <div style={{ position:'absolute', top:'12%', left:0, right:0, height:52, transform:`translateX(${-scrollOffset+nowX}px)` }}>
              {song.lyrics.map((l,i) => {
                const lx = l.time * PX_PER_SEC
                const nextTime = song.lyrics[i+1]?.time ?? l.time + beatDur*2
                const isActive = songTime*speed >= l.time && songTime*speed < nextTime
                return (
                  <div key={l.id} style={{ position:'absolute', left:lx/speed, transform:'translateX(-50%)',
                    fontSize: isActive?24:16, fontWeight: isActive?800:400,
                    color: isActive ? '#D4A84B' : C.textMuted,
                    transition:'all 0.08s', whiteSpace:'nowrap', userSelect:'none',
                    letterSpacing: isActive ? '0.02em' : 0 }}>
                    {l.text}
                  </div>
                )
              })}
            </div>

            {/* Separator */}
            <div style={{ position:'absolute', top:'calc(12% + 60px)', left:0, right:0, height:1, background:C.borderDark }} />

            {/* Teacher dots */}
            {showTeacher && (
              <div style={{ position:'absolute', top:'calc(12% + 62px)', left:0, right:0, height:24, transform:`translateX(${-scrollOffset+nowX}px)` }}>
                <div style={{ position:'absolute', left:-nowX+8, top:4, fontSize:9, color:C.gold, fontWeight:600 }}>Đáp án Thầy</div>
                {targetDotsScaled.map((d,i) => (
                  <div key={'td'+i} style={{ position:'absolute', left:d.time*PX_PER_SEC, transform:'translateX(-50%)',
                    width:9, height:9, borderRadius:'50%', background:C.gold, top:7, opacity:0.9 }} />
                ))}
              </div>
            )}

            {/* Player dots */}
            <div style={{ position:'absolute', top:'calc(12% + 90px)', left:0, right:0, transform:`translateX(${-scrollOffset+nowX}px)` }}>
              <div style={{ position:'absolute', left:-nowX+8, top:4, fontSize:9, color:C.greenLight, fontWeight:600 }}>{userName||'Bạn'} — Lần này</div>
              {scoredCurrent.map((d,i) => (
                <div key={'cd'+i} style={{ position:'absolute', left:d.time*PX_PER_SEC, transform:'translateX(-50%)',
                  width:12, height:12, borderRadius:'50%', top:18,
                  background: targetDotsScaled.length>0 ? (d.hit ? C.greenMid : C.red) : '#60A5FA' }} />
              ))}
            </div>

            {/* History */}
            {tapHistory.map((h, hi) => {
              const opacity = Math.max(0.18, 0.55 - hi*0.1)
              return (
                <div key={h.id} style={{ position:'absolute', top:`calc(12% + ${120+hi*28}px)`, left:0, right:0, transform:`translateX(${-scrollOffset+nowX}px)` }}>
                  <div style={{ position:'absolute', left:-nowX+8, top:0, height:14, display:'flex', alignItems:'center', gap:5 }}>
                    <span style={{ fontSize:8, color:'#A78BFA', opacity, whiteSpace:'nowrap' }}>
                      Lần {tapHistory.length-hi} · {h.score}đ
                    </span>
                    <button onClick={() => handleDeleteHistory(h.id)} style={{ fontSize:9, background:'none', border:'none', color:C.red, cursor:'pointer', opacity:0.4, padding:0 }}>✕</button>
                  </div>
                  {h.dots.map((d,di) => (
                    <div key={di} style={{ position:'absolute', left:d.time*PX_PER_SEC, transform:'translateX(-50%)',
                      width:7, height:7, borderRadius:'50%', top:12, background:'#A78BFA', opacity }} />
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
                  width:isBar?2:1, height:isBar?14:isTarget?10:5,
                  background: isTarget ? 'rgba(167,216,138,0.4)' : isBar ? 'rgba(244,241,232,0.18)' : 'rgba(244,241,232,0.08)',
                  transform:'translateX(-50%)', bottom:0 }} />
              })}
            </div>
          </div>

          {/* LIVE SCORE */}
          {currentDots.length > 0 && currentScore !== null && (
            <div style={{ flexShrink:0, textAlign:'center', padding:'5px 0', borderTop:`1px solid ${C.borderDark}`, background:C.bgDeep }}>
              <span style={{ fontSize:13, fontWeight:700,
                color: currentScore>=80 ? C.greenLight : currentScore>=60 ? C.gold : C.red }}>
                {currentScore}/100 · {scoredCurrent.filter(d=>d.hit).length}/{targetDotsScaled.length} phách đúng
              </span>
            </div>
          )}

          {/* ── CONTROLS AREA ── */}
          <div style={{ background:C.bgControls, borderTop:`2px solid rgba(20,83,45,0.12)`, padding:'16px 24px 12px', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:20, flexWrap:'wrap' }}>

              {/* Bắt đầu / Dừng */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
                <button onClick={() => setIsPlaying(p=>!p)} style={{ ...btnKeyStyle, width:60, height:60 }}>
                  <span style={{ fontSize:20 }}>{isPlaying ? '⏸' : '▶'}</span>
                  <span style={{ fontSize:8, color:C.textDarkMuted, fontWeight:400 }}>{isPlaying ? 'Dừng' : 'Bắt đầu'}</span>
                </button>
                <span style={{ fontSize:9, color:C.textDarkMuted }}>Phím P</span>
              </div>

              {/* TAP */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                <button
                  onMouseDown={e => { e.preventDefault(); e.stopPropagation(); handleTap() }}
                  onTouchStart={e => { e.preventDefault(); e.stopPropagation(); handleTap() }}
                  style={{
                    width:116, height:116, borderRadius:'50%',
                    background: isPlaying ? '#1A3D22' : '#D4D8CC',
                    border: `2px solid ${isPlaying ? 'rgba(141,196,112,0.45)' : '#B0C0A0'}`,
                    color: isPlaying ? C.greenLight : '#7A8C72',
                    fontSize:18, fontWeight:800, letterSpacing:'0.12em',
                    cursor:'pointer', userSelect:'none', transition:'all 0.2s',
                    boxShadow: isPlaying
                      ? `0 4px 18px rgba(15,40,20,0.5), inset 0 -3px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(141,196,112,0.1)`
                      : `0 3px 10px rgba(15,40,20,0.18), inset 0 2px 5px rgba(255,255,255,0.55), inset 0 -2px 4px rgba(0,0,0,0.1)`,
                  }}>
                  TAP
                </button>
                <span style={{ fontSize:9, color:C.textDarkMuted }}>Phím Space</span>
              </div>

              {/* Về đầu */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
                <button onClick={() => { seekTo(0); setIsPlaying(false) }} style={{ ...btnKeyStyle, width:60, height:60 }}>
                  <span style={{ fontSize:20 }}>⏮</span>
                  <span style={{ fontSize:8, color:C.textDarkMuted, fontWeight:400 }}>Về đầu</span>
                </button>
                <span style={{ fontSize:9, color:C.textDarkMuted }}>&nbsp;</span>
              </div>

              {/* Action buttons */}
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginLeft:8 }}>
                <button onClick={() => setShowTeacher(t=>!t)} style={{ ...btnActionStyle,
                  background: showTeacher ? 'rgba(201,151,0,0.1)' : C.ctrlBg,
                  borderColor: showTeacher ? C.borderGold : C.ctrlBorder,
                  color: showTeacher ? C.gold : C.ctrlText }}>
                  <span style={{ fontSize:15 }}>👁</span>
                  {showTeacher ? 'Ẩn đáp án Thầy' : 'Xem đáp án Thầy'}
                </button>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => { setCurrentDots([]); setLastScore(null) }}
                    style={{ ...btnActionStyle, color:'#7A3530', borderColor:'rgba(139,58,53,0.2)', background:'rgba(255,240,238,0.7)' }}>
                    <span style={{ fontSize:14 }}>🗑</span> Xoá lần này
                  </button>
                  {currentDots.length > 0 && (
                    <button onClick={handleShowResult}
                      style={{ ...btnActionStyle, background:C.bgHeader, border:'none', color:C.textLight, fontWeight:600, boxShadow:'0 2px 8px rgba(20,83,45,0.25)' }}>
                      <span style={{ fontSize:14 }}>📊</span> Xem kết quả
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom hints */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:10 }}>
              {saveMsg
                ? <span style={{ fontSize:11, color:C.green, fontWeight:600 }}>✓ {saveMsg}</span>
                : <span style={{ fontSize:9, color:C.textDarkMuted }}>Space = TAP · P = Bắt đầu/Dừng · ⏮ = Về đầu · Esc = Đóng</span>
              }
            </div>
          </div>
        </div>
      )}

      {/* ── POPUP KẾT QUẢ ── */}
      {showResultPopup && lastScore !== null && resultMsg && (
        <div style={{ position:'fixed', inset:0, background:'rgba(10,20,14,0.85)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={() => setShowResultPopup(false)}>
          <div style={{ background:C.bgCard, borderRadius:20, padding:'32px 28px', textAlign:'center', border:`1px solid ${C.borderMid}`, maxWidth:360, width:'100%' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:48, marginBottom:8 }}>{resultMsg.emoji}</div>
            <div style={{ color:C.textLight, fontWeight:800, fontSize:22, marginBottom:8 }}>{resultMsg.title}</div>
            <div style={{ fontSize:56, fontWeight:900, lineHeight:1, marginBottom:6,
              color: lastScore>=80 ? C.greenLight : lastScore>=60 ? C.gold : '#E57373' }}>
              {lastScore}<span style={{ fontSize:22, color:C.textMuted }}>/100</span>
            </div>
            <div style={{ fontSize:22, marginBottom:10 }}>{'⭐'.repeat(starCount)}{'☆'.repeat(5-starCount)}</div>
            {prevBest > 0 && (
              <div style={{ fontSize:13, marginBottom:10, fontWeight:600, color: lastScore>prevBest ? C.greenLight : C.textMuted }}>
                {lastScore>prevBest ? `📈 +${lastScore-prevBest} so với kỷ lục!` : lastScore===prevBest ? '🎯 Bằng kỷ lục của bạn!' : `📉 Kỷ lục: ${prevBest}`}
              </div>
            )}
            <div style={{ color:C.textMuted, fontSize:13, marginBottom: resultMsg.hint?8:16, lineHeight:1.6 }}>{resultMsg.body}</div>
            {resultMsg.hint && (
              <div style={{ marginBottom:16, padding:'10px 14px', background:'rgba(167,216,138,0.08)', borderRadius:10, border:`1px solid rgba(167,216,138,0.18)`, fontSize:12, color:C.greenLight, lineHeight:1.5 }}>
                💡 {resultMsg.hint}
              </div>
            )}
            {lastScore < UNLOCK_SCORE && activeLevel < levels.length && (
              <div style={{ marginBottom:16, padding:'10px 14px', background:C.goldPale, borderRadius:10, border:`1px solid ${C.borderGold}` }}>
                <div style={{ fontSize:12, color:C.gold, marginBottom:6 }}>Cần thêm <strong>{UNLOCK_SCORE-lastScore} điểm</strong> để mở Level {activeLevel+1}</div>
                <div style={{ height:5, background:C.borderDark, borderRadius:3, overflow:'hidden' }}>
                  <div style={{ width:`${Math.min(lastScore/UNLOCK_SCORE*100,100)}%`, height:'100%', background:C.gold, borderRadius:3, transition:'width 0.5s' }} />
                </div>
              </div>
            )}
            {lastScore >= UNLOCK_SCORE && activeLevel < levels.length && (
              <div style={{ marginBottom:16, padding:'10px 14px', background:'rgba(167,216,138,0.08)', borderRadius:10, border:`1px solid rgba(167,216,138,0.25)` }}>
                <div style={{ fontSize:13, color:C.greenLight, fontWeight:700 }}>🔓 Đủ điểm mở Level {activeLevel+1}! Lưu để nhận thưởng</div>
              </div>
            )}
            {isGuest ? (
              <div>
                <div style={{ marginBottom:12, padding:'10px 14px', background:'rgba(167,216,138,0.08)', borderRadius:10, border:`1px solid rgba(167,216,138,0.18)`, fontSize:13, color:C.greenLight }}>
                  💡 Đăng nhập để lưu điểm và xem lại lịch sử luyện tập!
                </div>
                <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
                  <button onClick={() => { setShowResultPopup(false); setCurrentDots([]) }}
                    style={{ padding:'10px 20px', background:C.bgMid, border:`1px solid ${C.borderMid}`, borderRadius:10, color:C.textLight, fontWeight:600, fontSize:13, cursor:'pointer' }}>
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
                  style={{ padding:'10px 20px', background:C.bgMid, border:`1px solid ${C.borderMid}`, borderRadius:10, color:C.textLight, fontWeight:600, fontSize:13, cursor:'pointer' }}>
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
        <div style={{ position:'fixed', inset:0, background:'rgba(10,20,14,0.9)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:C.bgCard, borderRadius:20, padding:40, textAlign:'center', border:`2px solid ${C.greenMid}`, maxWidth:340 }}>
            <div style={{ fontSize:56, marginBottom:8 }}>✨</div>
            <div style={{ color:C.greenLight, fontWeight:900, fontSize:28, marginBottom:4 }}>LEVEL UP!</div>
            <div style={{ color:C.textLight, fontWeight:700, fontSize:18, marginBottom:8 }}>🔓 Level {activeLevel+1} đã mở khoá!</div>
            <div style={{ color:C.textMuted, fontSize:13, marginBottom:6 }}>Thử thách mới:</div>
            <div style={{ color:C.greenLight, fontSize:14, fontWeight:600, marginBottom:8 }}>{levels[activeLevel]?.desc}</div>
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
        <div style={{ position:'fixed', inset:0, background:'rgba(10,20,14,0.9)', zIndex:700, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:C.bgCard, borderRadius:20, padding:'32px 28px', textAlign:'center', border:`1px solid ${C.borderMid}`, maxWidth:340, width:'100%' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🎵</div>
            <div style={{ color:C.textLight, fontWeight:800, fontSize:20, marginBottom:8 }}>Bạn đã thử {GUEST_MAX_SONGS} bài!</div>
            <div style={{ color:C.textMuted, fontSize:14, lineHeight:1.65, marginBottom:20 }}>
              Đăng nhập để tiếp tục luyện tập với tất cả bài hát, lưu điểm và theo dõi tiến độ.
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button onClick={() => setShowGuestLimit(false)}
                style={{ padding:'10px 20px', background:C.bgMid, border:`1px solid ${C.borderMid}`, borderRadius:10, color:C.textMuted, fontWeight:500, fontSize:13, cursor:'pointer' }}>
                Đóng
              </button>
              <button onClick={handleLogin}
                style={{ padding:'10px 24px', background:C.green, border:'none', borderRadius:10, color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                🔑 Đăng nhập ngay
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
