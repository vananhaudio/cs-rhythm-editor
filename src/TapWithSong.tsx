import { useState, useEffect, useRef, useCallback } from 'react'
import type { RhythmSong } from './types'
import { supabase } from './supabase'
import { SongList } from './SongList'

// ── THEME: Xanh rừng tối ──
const T = {
  bg:           '#0D1A12',  // nền chính — xanh rừng sâu
  bgAlt:        '#0A1510',  // nền phụ tối hơn
  bgCard:       '#112018',  // card/panel
  bgCardHover:  '#162A1E',
  border:       '#1E3328',  // border mặc định
  borderLight:  '#2A4A38',  // border sáng hơn
  green:        '#3F7D3A',  // xanh mầm non — accent chính
  greenLight:   '#A8D18D',  // xanh lá nhạt — highlight
  greenPale:    'rgba(168,209,141,0.12)', // nền xanh nhạt
  greenGlow:    'rgba(63,125,58,0.35)',
  gold:         '#C99700',  // gold điểm nhấn
  goldPale:     'rgba(201,151,0,0.12)',
  goldBorder:   'rgba(201,151,0,0.35)',
  red:          '#C0392B',  // đỏ lỗi — bớt gay gắt
  redPale:      'rgba(192,57,43,0.15)',
  text:         '#E8F0E0',  // text chính — trắng ấm ngả xanh
  textMuted:    '#7A9A7A',  // text phụ
  textDim:      '#3D6B4A',  // text rất mờ
  purple:       '#7C6FAF',  // history dots
  blue:         '#3B82F6',  // nút xem kết quả
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
    <div style={{ display:'flex', gap:3, alignItems:'center' }}>
      {Array.from({length: timeSig}, (_, i) => {
        const beat = i + 1
        const active = beats.includes(beat)
        return (
          <div key={i} style={{
            width: beat === 1 ? 12 : 9,
            height: beat === 1 ? 12 : 9,
            borderRadius: '50%',
            background: active ? T.greenLight : 'transparent',
            border: `2px solid ${active ? T.greenLight : T.borderLight}`,
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
  if (score >= 95) return { emoji:'🏆', title:'XUẤT SẮC!', body:'Bạn cảm nhận nhịp rất tốt! Gần như hoàn hảo rồi!' }
  if (score >= 80) return { emoji:'🎉', title:'RẤT TỐT!', body:'Tai nghe nhịp của bạn đang rất tốt! Tiếp tục phát huy nhé!' }
  if (score >= 65) return { emoji:'💪', title:'KHÁ TỐT!', body:'Bạn đang cảm nhận được nhịp rồi! Luyện thêm một chút nữa thôi!' }
  if (score >= 50) return { emoji:'🎯', title:'TIẾP TỤC!', body:'Bạn đang đi đúng hướng! Thử nghe lại bài và cảm nhận chỗ nhấn nhé!', hint:'💡 Phách mạnh thường là nơi bài hát tạo cảm giác "nhấn" rõ hơn — hãy thử nghe lại và cảm nhận nhé!' }
  return { emoji:'🥁', title:'LUYỆN THÊM NHÉ!', body:'Đừng nản! Hãy nghe lại bài hát thật kỹ và cảm nhận chỗ nhịp được nhấn mạnh hơn.', hint:'💡 Phách mạnh thường là nơi bài hát tạo cảm giác "nhấn" rõ hơn — hãy thử nghe lại và cảm nhận nhé!' }
}

function Confetti({ show }: { show: boolean }) {
  if (!show) return null
  const colors = [T.greenLight, T.gold, '#60A5FA', '#F472B6', T.purple, '#34D399']
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
      if (!alreadyPlayed && guestSongsPlayed.length >= GUEST_MAX_SONGS) {
        setShowGuestLimit(true)
        return
      }
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

  const handleLogin = async () => {
    const email = prompt('Email:')
    const password = prompt('Mật khẩu:')
    if (email && password) await supabase.auth.signInWithPassword({ email, password })
  }

  return (
    <div style={{ position:'fixed', inset:0, background:T.bg, display:'flex', flexDirection:'column', zIndex:200, fontFamily:'Inter, sans-serif' }}>
      <Confetti show={showConfetti} />

      {/* Banner khách */}
      {isGuest && (
        <div style={{ background:T.greenPale, borderBottom:`1px solid rgba(168,209,141,0.25)`, padding:'6px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <span style={{ color:T.greenLight, fontSize:12 }}>
            🎵 Chế độ khách — đã thử <strong>{guestSongsPlayed.length}/{GUEST_MAX_SONGS}</strong> bài · Điểm không được lưu
          </span>
          <button onClick={handleLogin} style={{ background:T.green, border:'none', borderRadius:6, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', padding:'4px 12px' }}>
            🔑 Đăng nhập để lưu điểm
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 16px', borderBottom:`1px solid ${T.border}`, flexShrink:0, background:T.bgAlt }}>
        <span style={{ color:T.greenLight, fontWeight:800, fontSize:15 }}>🥁 Tap nhịp</span>
        <button onClick={() => setShowSongList(true)} style={{ padding:'4px 12px', background:T.bgCard, border:`1px solid ${T.borderLight}`, borderRadius:6, color:T.greenLight, fontWeight:700, cursor:'pointer', fontSize:12 }}>
          🎵 Chọn bài
        </button>
        {song && <>
          <span style={{ color:T.text, fontWeight:700, fontSize:14 }}>{song.title}</span>
          {song.artist && <span style={{ color:T.textMuted, fontSize:11 }}>— {song.artist}</span>}
          <span style={{ color:T.textDim, fontSize:10 }}>{song.tempo} BPM · {song.timeSignature}/4</span>
        </>}
        {song && (
          <div style={{ display:'flex', gap:2, marginLeft:'auto' }}>
            {[0.5,0.75,1,1.25].map(s => (
              <button key={s} onClick={() => { setSpeed(s); if(isPlaying){setIsPlaying(false); setTimeout(()=>setIsPlaying(true),50)} }}
                style={{ padding:'2px 7px', borderRadius:4, border:'none', background: speed===s?T.green:T.bgCard, color: speed===s?'#fff':T.textMuted, fontSize:10, cursor:'pointer', fontWeight: speed===s?700:400 }}>
                {s===0.5?'50%':s===0.75?'75%':s===1?'100%':'125%'}
              </button>
            ))}
          </div>
        )}
        {userName && <span style={{ color:T.textMuted, fontSize:11 }}>👤 {userName}</span>}
        <button onClick={onClose} style={{ background:'none', border:`1px solid ${T.borderLight}`, borderRadius:6, color:T.textMuted, cursor:'pointer', padding:'3px 10px', fontSize:12, marginLeft: song?0:'auto' }}>✕</button>
      </div>

      {/* Chưa chọn bài */}
      {!song && (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:20, padding:32 }}>
          <div style={{ fontSize:52 }}>🥁</div>
          <div style={{ color:T.text, fontWeight:800, fontSize:22, textAlign:'center' }}>Luyện nhịp cùng Thầy Văn Anh</div>
          <div style={{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:12, padding:'20px 28px', maxWidth:400, width:'100%' }}>
            {[
              ['1️⃣', 'Chọn bài hát muốn luyện'],
              ['2️⃣', 'Bấm ▶ hoặc phím P để bắt đầu nhạc'],
              ['3️⃣', 'Nghe metronome — tiếng CLICK TO là phách mạnh'],
              ['4️⃣', 'Bấm nút TAP hoặc phím Space đúng phách'],
              ['5️⃣', 'Bấm Xem kết quả → Lưu điểm để lên level'],
            ].map(([num, text]) => (
              <div key={num} style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:12 }}>
                <span style={{ fontSize:18, flexShrink:0 }}>{num}</span>
                <span style={{ color:T.textMuted, fontSize:14, lineHeight:1.5 }}>{text}</span>
              </div>
            ))}
            <div style={{ marginTop:8, padding:'10px 14px', background:T.greenPale, borderRadius:8, border:`1px solid rgba(168,209,141,0.25)`, display:'flex', gap:8, alignItems:'center' }}>
              <span style={{ fontSize:16 }}>💡</span>
              <span style={{ color:T.greenLight, fontSize:13 }}>Đạt <strong>80 điểm</strong> để mở khoá level tiếp theo!</span>
            </div>
          </div>
          <button onClick={() => setShowSongList(true)} style={{ padding:'14px 40px', background:T.green, border:'none', borderRadius:12, color:'#fff', fontWeight:800, fontSize:18, cursor:'pointer', boxShadow:`0 0 24px ${T.greenGlow}` }}>
            🎵 Chọn bài hát
          </button>
        </div>
      )}

      {/* Main */}
      {song && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* Level bar */}
          <div style={{ padding:'6px 16px', background:T.bgAlt, borderBottom:`1px solid ${T.border}`, display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
            {levels.map((lv, i) => {
              const lvNum = i + 1
              const unlocked = progress.unlocked_levels.includes(lvNum)
              const isActive = activeLevel === lvNum
              const best = progress.best_scores[String(lvNum)] ?? 0
              return (
                <button key={lvNum} onClick={() => unlocked && setActiveLevel(lvNum)} style={{
                  display:'flex', flexDirection:'column', alignItems:'center', gap:2,
                  padding:'4px 10px', borderRadius:8,
                  background: isActive ? T.green : unlocked ? T.bgCard : T.bgAlt,
                  border: isActive ? 'none' : `1px solid ${unlocked ? T.borderLight : T.border}`,
                  color: isActive ? '#fff' : unlocked ? T.textMuted : T.textDim,
                  cursor: unlocked ? 'pointer' : 'not-allowed', fontSize:11,
                  fontWeight: isActive ? 700 : 400, opacity: unlocked ? 1 : 0.45, minWidth:58,
                }}>
                  <span>{unlocked ? lv.label : `🔒 L${lvNum}`}</span>
                  {unlocked && <span style={{ fontSize:9, color: isActive ? 'rgba(255,255,255,0.7)' : T.textMuted }}>Tốt nhất: {best}</span>}
                </button>
              )
            })}
            <div style={{ marginLeft:'auto', fontSize:9, color:T.textDim, flexShrink:0 }}>Cần {UNLOCK_SCORE}đ</div>
          </div>

          {/* Nhiệm vụ */}
          {levelConfig && (
            <div style={{ padding:'8px 16px', background:T.bgCard, borderBottom:`1px solid ${T.border}`, flexShrink:0, display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ flex:1 }}>
                <div style={{ color:T.greenLight, fontWeight:700, fontSize:14 }}>
                  🎯 {levelConfig.desc}
                </div>
              </div>
              <BeatViz beats={levelConfig.beats} timeSig={song.timeSignature} />
            </div>
          )}

          {/* Progress bar */}
          <div style={{ padding:'5px 16px', display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
            <span style={{ color:T.textDim, fontSize:10, width:32 }}>{fmtTime(songTime)}</span>
            <div style={{ flex:1, height:3, background:T.border, borderRadius:2, cursor:'pointer', position:'relative' }}
              onClick={e => { const r=e.currentTarget.getBoundingClientRect(); seekTo((e.clientX-r.left)/r.width*totalDur) }}>
              <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`${totalDur>0?songTime/totalDur*100:0}%`, background:T.green, borderRadius:2 }} />
            </div>
            <span style={{ color:T.textDim, fontSize:10, width:32, textAlign:'right' }}>{fmtTime(totalDur)}</span>
          </div>

          {/* Scroll area */}
          <div ref={scrollRef} style={{ flex:1, position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', left:nowX, top:0, bottom:0, width:2, background:T.green, opacity:0.5, zIndex:10, pointerEvents:'none' }} />

            {/* Lời */}
            <div style={{ position:'absolute', top:'10%', left:0, right:0, height:44, transform:`translateX(${-scrollOffset+nowX}px)` }}>
              {song.lyrics.map((l,i) => {
                const lx = l.time * PX_PER_SEC
                const nextTime = song.lyrics[i+1]?.time ?? l.time + beatDur*2
                const isActive = songTime*speed >= l.time && songTime*speed < nextTime
                return (
                  <div key={l.id} style={{ position:'absolute', left:lx/speed, transform:'translateX(-50%)',
                    fontSize: isActive?21:16, fontWeight: isActive?800:500,
                    color: isActive ? T.greenLight : T.text,
                    transition:'all 0.08s', whiteSpace:'nowrap', userSelect:'none' }}>
                    {l.text}
                  </div>
                )
              })}
            </div>

            <div style={{ position:'absolute', top:'calc(10% + 48px)', left:0, right:0, height:1, background:T.border }} />

            {/* Đáp án Thầy */}
            {showTeacher && (
              <div style={{ position:'absolute', top:'calc(10% + 50px)', left:0, right:0, height:20, transform:`translateX(${-scrollOffset+nowX}px)` }}>
                <div style={{ position:'absolute', left:-nowX, top:0, height:16, display:'flex', alignItems:'center', paddingLeft:4 }}>
                  <span style={{ fontSize:8, color:T.gold, fontWeight:700 }}>Đáp án Thầy</span>
                </div>
                {targetDotsScaled.map((d,i) => (
                  <div key={'td'+i} style={{ position:'absolute', left:d.time*PX_PER_SEC, transform:'translateX(-50%)',
                    width:8, height:8, borderRadius:'50%', background:T.gold, top:6,
                    boxShadow:`0 0 4px ${T.goldPale}` }} />
                ))}
              </div>
            )}

            {/* Current dots */}
            <div style={{ position:'absolute', top:'calc(10% + 74px)', left:0, right:0, transform:`translateX(${-scrollOffset+nowX}px)` }}>
              <div style={{ position:'absolute', left:-nowX, top:0, height:16, display:'flex', alignItems:'center', paddingLeft:4 }}>
                <span style={{ fontSize:8, color:T.greenLight, fontWeight:700 }}>{userName||'Bạn'} — Lần này</span>
              </div>
              {scoredCurrent.map((d,i) => (
                <div key={'cd'+i} style={{ position:'absolute', left:d.time*PX_PER_SEC, transform:'translateX(-50%)',
                  width:12, height:12, borderRadius:'50%', top:18,
                  background: targetDotsScaled.length>0 ? (d.hit ? T.greenLight : T.red) : '#60A5FA',
                  boxShadow: targetDotsScaled.length===0 ? '0 0 8px rgba(96,165,250,0.7)' : 'none' }} />
              ))}
            </div>

            {/* History rows */}
            {tapHistory.map((h, hi) => {
              const opacity = Math.max(0.2, 0.65 - hi*0.12)
              const topPos = `calc(10% + ${74+38+hi*30}px)`
              return (
                <div key={h.id} style={{ position:'absolute', top:topPos, left:0, right:0, transform:`translateX(${-scrollOffset+nowX}px)` }}>
                  <div style={{ position:'absolute', left:-nowX, top:0, height:14, display:'flex', alignItems:'center', gap:5, paddingLeft:4 }}>
                    <span style={{ fontSize:8, color:T.purple, opacity, whiteSpace:'nowrap' }}>
                      Lần {tapHistory.length-hi} · {h.score}đ · {'⭐'.repeat(stars(h.score))}
                    </span>
                    <button onClick={() => handleDeleteHistory(h.id)} title="Xoá lần này"
                      style={{ fontSize:9, background:'none', border:'none', color:T.red, cursor:'pointer', opacity:0.5, padding:0, lineHeight:1 }}>
                      ✕
                    </button>
                  </div>
                  {h.dots.map((d,di) => (
                    <div key={di} style={{ position:'absolute', left:d.time*PX_PER_SEC, transform:'translateX(-50%)',
                      width:8, height:8, borderRadius:'50%', top:15, background:T.purple, opacity }} />
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
                  background: isTarget ? `rgba(168,209,141,0.45)` : isBar ? T.borderLight : T.border,
                  transform:'translateX(-50%)', bottom:0 }} />
              })}
            </div>
          </div>

          {/* Live score */}
          {currentDots.length > 0 && currentScore !== null && (
            <div style={{ flexShrink:0, textAlign:'center', padding:'3px 0', borderTop:`1px solid ${T.border}`, background:'rgba(0,0,0,0.2)' }}>
              <span style={{ fontSize:12, color: currentScore>=80 ? T.greenLight : currentScore>=60 ? T.gold : T.red, fontWeight:700 }}>
                {currentScore}/100 · {scoredCurrent.filter(d=>d.hit).length}/{targetDotsScaled.length} phách đúng
              </span>
            </div>
          )}

          {/* Controls */}
          <div style={{ padding:'8px 16px', display:'flex', gap:10, justifyContent:'center', alignItems:'center', flexShrink:0, flexWrap:'wrap', background:T.bgAlt, borderTop:`1px solid ${T.border}` }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
              <button onClick={() => setIsPlaying(p=>!p)} style={{ width:48, height:48, borderRadius:'50%', background:T.bgCard, border:`2px solid ${T.borderLight}`, color:T.text, fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {isPlaying?'⏸':'▶'}
              </button>
              <span style={{ fontSize:9, color:T.textDim }}>Phím P</span>
            </div>

            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
              <button
                onMouseDown={e => { e.preventDefault(); e.stopPropagation(); handleTap() }}
                onTouchStart={e => { e.preventDefault(); e.stopPropagation(); handleTap() }}
                style={{ width:110, height:110, borderRadius:'50%',
                  background: isPlaying ? T.green : T.bgCard,
                  border: isPlaying ? 'none' : `2px solid ${T.borderLight}`,
                  color:'#fff', fontSize: isPlaying?22:14, fontWeight:900,
                  cursor:'pointer', userSelect:'none', transition:'background 0.2s',
                  boxShadow: isPlaying ? `0 0 28px ${T.greenGlow}` : 'none' }}>
                {isPlaying?'TAP':'🎵'}
              </button>
              <span style={{ fontSize:9, color:T.textDim }}>Phím Space</span>
            </div>

            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
              <button onClick={() => { seekTo(0); setIsPlaying(false) }} style={{ width:48, height:48, borderRadius:'50%', background:T.bgCard, border:`2px solid ${T.borderLight}`, color:T.text, fontSize:20, cursor:'pointer' }}>⏮</button>
              <span style={{ fontSize:9, color:T.textDim }}>Về đầu</span>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <button onClick={() => setShowTeacher(t=>!t)} style={{ padding:'6px 12px', borderRadius:6,
                background: showTeacher ? T.goldPale : T.bgCard,
                border: `1px solid ${showTeacher ? T.gold : T.borderLight}`,
                color: showTeacher ? T.gold : T.textMuted, fontSize:11, fontWeight:700, cursor:'pointer' }}>
                {showTeacher?'🙈 Ẩn đáp án Thầy':'👁 Xem đáp án Thầy'}
              </button>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={() => { setCurrentDots([]); setLastScore(null) }}
                  style={{ padding:'6px 12px', borderRadius:6, background:T.bgCard, border:`1px solid ${T.borderLight}`, color:T.red, fontSize:11, fontWeight:700, cursor:'pointer' }}>
                  🗑 Xoá lần này
                </button>
                {currentDots.length > 0 && (
                  <button onClick={handleShowResult}
                    style={{ padding:'6px 12px', borderRadius:6, background:T.green, border:'none', color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', boxShadow:`0 0 10px ${T.greenGlow}` }}>
                    📊 Xem kết quả
                  </button>
                )}
              </div>
            </div>
          </div>

          {saveMsg && <div style={{ textAlign:'center', color:T.greenLight, fontSize:11, padding:'4px 0', fontWeight:700, background:T.bgAlt }}>✓ {saveMsg}</div>}
          <div style={{ textAlign:'center', color:T.textDim, fontSize:9, padding:'4px 0 6px', background:T.bgAlt }}>
            Space = TAP · P hoặc Enter = Phát/Dừng · ⏮ = Về đầu · Esc = Đóng
          </div>
        </div>
      )}

      {/* Popup kết quả */}
      {showResultPopup && lastScore !== null && resultMsg && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={() => setShowResultPopup(false)}>
          <div style={{ background:T.bgCard, borderRadius:20, padding:'32px 28px', textAlign:'center', border:`1px solid ${T.borderLight}`, maxWidth:340, width:'100%', boxShadow:`0 20px 60px rgba(0,0,0,0.5)` }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:48, marginBottom:8 }}>{resultMsg.emoji}</div>
            <div style={{ color:T.text, fontWeight:900, fontSize:24, marginBottom:4 }}>{resultMsg.title}</div>
            <div style={{ fontSize:52, fontWeight:900, lineHeight:1, marginBottom:4,
              color: lastScore>=80 ? T.greenLight : lastScore>=60 ? T.gold : T.red }}>
              {lastScore}<span style={{ fontSize:20, color:T.textMuted }}>/100</span>
            </div>
            <div style={{ fontSize:22, marginBottom:8 }}>{'⭐'.repeat(starCount)}{'☆'.repeat(5-starCount)}</div>
            {prevBest > 0 && (
              <div style={{ fontSize:13, marginBottom:8, fontWeight:600,
                color: lastScore>prevBest ? T.greenLight : T.textMuted }}>
                {lastScore>prevBest ? `📈 +${lastScore-prevBest} so với kỷ lục!` : lastScore===prevBest ? '🎯 Bằng kỷ lục của bạn!' : `📉 Kỷ lục của bạn: ${prevBest}`}
              </div>
            )}
            <div style={{ color:T.textMuted, fontSize:13, marginBottom: resultMsg.hint ? 8 : 16, lineHeight:1.5 }}>{resultMsg.body}</div>
            {resultMsg.hint && (
              <div style={{ marginBottom:16, padding:'10px 14px', background:T.greenPale, borderRadius:10, border:`1px solid rgba(168,209,141,0.2)`, fontSize:12, color:T.greenLight, lineHeight:1.5 }}>
                {resultMsg.hint}
              </div>
            )}
            {lastScore < UNLOCK_SCORE && activeLevel < levels.length && (
              <div style={{ marginBottom:16, padding:'10px 14px', background:T.goldPale, borderRadius:10, border:`1px solid ${T.goldBorder}` }}>
                <div style={{ fontSize:12, color:T.gold, marginBottom:6 }}>Cần thêm <strong>{UNLOCK_SCORE-lastScore} điểm</strong> để mở Level {activeLevel+1}</div>
                <div style={{ height:6, background:T.border, borderRadius:3, overflow:'hidden' }}>
                  <div style={{ width:`${Math.min(lastScore/UNLOCK_SCORE*100,100)}%`, height:'100%', background:`linear-gradient(90deg,${T.gold},#E6C040)`, borderRadius:3, transition:'width 0.5s' }} />
                </div>
                <div style={{ fontSize:10, color:T.textMuted, marginTop:4 }}>{lastScore}/{UNLOCK_SCORE}</div>
              </div>
            )}
            {lastScore >= UNLOCK_SCORE && activeLevel < levels.length && (
              <div style={{ marginBottom:16, padding:'10px 14px', background:T.greenPale, borderRadius:10, border:`1px solid rgba(168,209,141,0.3)` }}>
                <div style={{ fontSize:13, color:T.greenLight, fontWeight:700 }}>🔓 Đủ điểm mở Level {activeLevel+1}! Lưu để nhận thưởng</div>
              </div>
            )}
            {isGuest ? (
              <div>
                <div style={{ marginBottom:12, padding:'10px 14px', background:T.greenPale, borderRadius:10, border:`1px solid rgba(168,209,141,0.2)`, fontSize:13, color:T.greenLight }}>
                  💡 Đăng nhập để lưu điểm và xem lại lịch sử luyện tập!
                </div>
                <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
                  <button onClick={() => { setShowResultPopup(false); setCurrentDots([]); seekTo(0) }}
                    style={{ padding:'10px 20px', background:T.bgCard, border:`1px solid ${T.borderLight}`, borderRadius:10, color:T.text, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                    🔄 Thử lại
                  </button>
                  <button onClick={handleLogin}
                    style={{ padding:'10px 20px', background:T.green, border:'none', borderRadius:10, color:'#fff', fontWeight:800, fontSize:13, cursor:'pointer' }}>
                    🔑 Đăng nhập
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
                <button onClick={() => { setShowResultPopup(false); setCurrentDots([]); seekTo(0) }}
                  style={{ padding:'10px 20px', background:T.bgCard, border:`1px solid ${T.borderLight}`, borderRadius:10, color:T.text, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                  🔄 Thử lại
                </button>
                <button onClick={handleSave}
                  style={{ padding:'10px 20px', background:T.green, border:'none', borderRadius:10, color:'#fff', fontWeight:800, fontSize:13, cursor:'pointer', boxShadow:`0 0 16px ${T.greenGlow}` }}>
                  💾 Lưu điểm
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Level Up Modal */}
      {showLevelUp && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:T.bgCard, borderRadius:20, padding:40, textAlign:'center', border:`2px solid ${T.green}`, maxWidth:320 }}>
            <div style={{ fontSize:56, marginBottom:8 }}>✨</div>
            <div style={{ color:T.greenLight, fontWeight:900, fontSize:30, marginBottom:4 }}>LEVEL UP!</div>
            <div style={{ color:T.text, fontWeight:700, fontSize:18, marginBottom:8 }}>🔓 Level {activeLevel+1} đã mở khoá!</div>
            <div style={{ color:T.textMuted, fontSize:14, marginBottom:8 }}>Thử thách mới:</div>
            <div style={{ color:T.greenLight, fontSize:15, fontWeight:700, marginBottom:8 }}>{levels[activeLevel]?.desc}</div>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:20 }}>
              {song && levels[activeLevel] && <BeatViz beats={levels[activeLevel].beats} timeSig={song.timeSignature} />}
            </div>
            <button onClick={() => { setShowLevelUp(false); setActiveLevel(activeLevel+1) }}
              style={{ padding:'12px 32px', background:T.green, border:'none', borderRadius:10, color:'#fff', fontWeight:800, fontSize:16, cursor:'pointer' }}>
              Thử ngay! →
            </button>
          </div>
        </div>
      )}

      {/* Popup giới hạn khách */}
      {showGuestLimit && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:700, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.bgCard, borderRadius:20, padding:'32px 28px', textAlign:'center', border:`1px solid ${T.borderLight}`, maxWidth:340, width:'100%' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🎵</div>
            <div style={{ color:T.text, fontWeight:900, fontSize:22, marginBottom:8 }}>Bạn đã thử {GUEST_MAX_SONGS} bài!</div>
            <div style={{ color:T.textMuted, fontSize:14, lineHeight:1.6, marginBottom:20 }}>
              Đăng nhập để tiếp tục luyện tập với tất cả bài hát, lưu điểm và theo dõi tiến độ của bạn.
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button onClick={() => setShowGuestLimit(false)}
                style={{ padding:'10px 20px', background:T.bgCard, border:`1px solid ${T.borderLight}`, borderRadius:10, color:T.textMuted, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                Đóng
              </button>
              <button onClick={handleLogin}
                style={{ padding:'10px 24px', background:T.green, border:'none', borderRadius:10, color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer', boxShadow:`0 0 16px ${T.greenGlow}` }}>
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
