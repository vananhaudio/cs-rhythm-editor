import { useState, useEffect, useRef, useCallback } from 'react'
import type { RhythmSong } from './types'
import { supabase } from './supabase'
import { SongList } from './SongList'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 640)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 640)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

// ── DESIGN TOKENS ── Dark Studio theme
const C = {
  // Backgrounds
  bg:          '#0D0F14',
  bgSurface:   '#141720',
  bgCard:      '#1C2030',
  bgCardHover: '#222638',
  bgInput:     '#252840',

  // Brand
  accent:      '#6C63FF',
  accentGlow:  'rgba(108,99,255,0.25)',
  accentLight: '#8B84FF',
  green:       '#22C55E',
  greenDim:    'rgba(34,197,94,0.15)',
  gold:        '#F59E0B',
  goldDim:     'rgba(245,158,11,0.15)',
  red:         '#EF4444',

  // Dots
  dotCurrent:  '#38BDF8',
  dotTarget:   '#F59E0B',
  dotHistory:  '#A78BFA',

  // Text
  text1:       '#F1F5F9',
  text2:       '#94A3B8',
  text3:       '#475569',

  // Borders
  border:      'rgba(255,255,255,0.06)',
  borderMid:   'rgba(255,255,255,0.10)',
  borderAccent:'rgba(108,99,255,0.3)',
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
    { label: 'Level 1', beats: [1],       desc: 'Tap vào phách mạnh — cảm nhận chỗ nhấn rõ nhất', shortDesc: 'Phách 1' },
    { label: 'Level 2', beats: [1,2,3,4], desc: 'Tap đều 4 phách — giữ nhịp ổn định 1-2-3-4',     shortDesc: '4 phách' },
    { label: 'Level 3', beats: [1,3],     desc: 'Chỉ tap phách 1 và 3',                            shortDesc: 'Phách 1·3' },
    { label: 'Level 4', beats: [2,4],     desc: 'Chỉ tap phách 2 và 4 — phách nhẹ',               shortDesc: 'Phách 2·4' },
  ]
  if (timeSig === 3) return [
    { label: 'Level 1', beats: [1],     desc: 'Tap vào phách mạnh',     shortDesc: 'Phách 1' },
    { label: 'Level 2', beats: [1,2,3], desc: 'Tap đủ 3 phách 1-2-3',   shortDesc: '3 phách' },
    { label: 'Level 3', beats: [1,3],   desc: 'Tap phách 1 và 3',       shortDesc: 'Phách 1·3' },
    { label: 'Level 4', beats: [2],     desc: 'Chỉ tap phách 2',        shortDesc: 'Phách 2' },
  ]
  return [
    { label: 'Level 1', beats: [1], desc: 'Tap vào phách mạnh', shortDesc: 'Phách mạnh' },
    { label: 'Level 2', beats: Array.from({length:timeSig},(_,i)=>i+1), desc: `Tap đủ ${timeSig} phách`, shortDesc: `${timeSig} phách` },
    { label: 'Level 3', beats: [1,3], desc: 'Tap phách 1 và 3', shortDesc: 'Phách 1·3' },
    { label: 'Level 4', beats: [2,4], desc: 'Tap phách 2 và 4', shortDesc: 'Phách 2·4' },
  ]
}

function generateTargetDots(song: RhythmSong, beats: number[]): Dot[] {
  const beatDur = 60 / song.tempo
  const dots: Dot[] = []
  for (let bar = 0; bar < song.totalBars; bar++)
    for (const beat of beats)
      dots.push({ time: bar * song.timeSignature * beatDur + (beat - 1) * beatDur })
  return dots
}

function BeatViz({ beats, timeSig }: { beats: number[]; timeSig: number }) {
  return (
    <div style={{ display:'flex', gap:5, alignItems:'center' }}>
      {Array.from({length: timeSig}, (_, i) => {
        const active = beats.includes(i + 1)
        return (
          <div key={i} style={{
            width: i === 0 ? 12 : 9, height: i === 0 ? 12 : 9,
            borderRadius: '50%',
            background: active ? C.accent : 'transparent',
            border: `2px solid ${active ? C.accent : C.border}`,
            boxShadow: active ? `0 0 8px ${C.accentGlow}` : 'none',
            transition: 'all 0.2s',
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
  if (score >= 95) return { emoji:'🏆', title:'XUẤT SẮC!',      body:'Cảm nhận nhịp hoàn hảo!' }
  if (score >= 80) return { emoji:'🎉', title:'RẤT TỐT!',       body:'Tai nghe nhịp đang rất tốt! Tiếp tục phát huy!' }
  if (score >= 65) return { emoji:'💪', title:'KHÁ TỐT!',       body:'Bạn đang cảm nhận được nhịp! Luyện thêm một chút!' }
  if (score >= 50) return { emoji:'🎯', title:'TIẾP TỤC!',      body:'Đi đúng hướng rồi! Nghe lại và cảm nhận chỗ nhấn.', hint:'Phách mạnh là nơi bài tạo cảm giác "nhấn" rõ nhất.' }
  return           { emoji:'🥁', title:'LUYỆN THÊM NHÉ!', body:'Đừng nản! Nghe thật kỹ trước khi tap.', hint:'Phách mạnh là nơi bài tạo cảm giác "nhấn" rõ nhất.' }
}

function Confetti({ show }: { show: boolean }) {
  if (!show) return null
  const colors = [C.accent, C.green, C.gold, '#F472B6', C.dotHistory]
  return (
    <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:999, overflow:'hidden' }}>
      {Array.from({length:40},(_,i) => (
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

// Score ring component
function ScoreRing({ score, size = 72 }: { score: number; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - score / 100)
  const color = score >= 80 ? C.green : score >= 60 ? C.gold : C.red
  return (
    <svg width={size} height={size} style={{ transform:'rotate(-90deg)', flexShrink:0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition:'stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)', filter:`drop-shadow(0 0 6px ${color}80)` }} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize={size * 0.22} fontWeight="800" fontFamily="system-ui"
        style={{ transform:'rotate(90deg)', transformOrigin:`${size/2}px ${size/2}px` }}>
        {score}
      </text>
    </svg>
  )
}

export function TapWithSong({ onClose, userRole }: { onClose?: () => void; userRole?: string }) {
  const isTeacher = userRole === 'teacher' || userRole === 'admin'
  const isGuest   = userRole === 'guest'
  const isMobile  = useIsMobile()

  const [song, setSong]           = useState<RhythmSong | null>(null)
  const [showSongList, setShowSongList] = useState(false)
  const [songListDefaultSearch, setSongListDefaultSearch] = useState('')
  const [showTeacher, setShowTeacher]   = useState(false)
  const [speed, setSpeed]         = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [songTime, setSongTime]   = useState(0)
  const songTimeRef  = useRef(0)
  const wallRef      = useRef(0)
  const rafRef       = useRef<number>(0)
  const isPlayingRef = useRef(false)

  const [progress, setProgress]   = useState<Progress>({ current_level:1, best_scores:{'1':0,'2':0,'3':0,'4':0}, unlocked_levels:[1] })
  const [activeLevel, setActiveLevel] = useState(1)
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showResultPopup, setShowResultPopup] = useState(false)
  const [lastScore, setLastScore] = useState<number | null>(null)
  const [prevBest, setPrevBest]   = useState(0)
  const [tapHistory, setTapHistory]   = useState<TapRecord[]>([])
  const [currentDots, setCurrentDots] = useState<Dot[]>([])
  const [saveMsg, setSaveMsg]     = useState('')
  const [guestSongsPlayed, setGuestSongsPlayed] = useState<string[]>([])
  const [otherStudentsCount, setOtherStudentsCount] = useState(0)
  const [otherResults, setOtherResults] = useState<{name:string; score:number; level:number}[]>([])
  const [showOtherResults, setShowOtherResults] = useState(false)
  const [showGuestLimit, setShowGuestLimit] = useState(false)
  const [tapPulse, setTapPulse]   = useState(false)

  const scrollRef       = useRef<HTMLDivElement>(null)
  const autoShowResultRef = useRef(false)
  const [containerW, setContainerW] = useState(window.innerWidth) // khởi tạo bằng width thật
  const [userName, setUserName]   = useState('')

  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])

  // Re-attach khi song load xong (scrollRef div xuất hiện trong DOM)
  useEffect(() => {
    if (!scrollRef.current) return
    const ro = new ResizeObserver(e => setContainerW(e[0].contentRect.width))
    ro.observe(scrollRef.current)
    setContainerW(scrollRef.current.clientWidth || window.innerWidth)
    return () => ro.disconnect()
  }, [song])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user)
        supabase.from('app_users').select('name').eq('id', data.user.id).single()
          .then(({ data: u }) => { if (u?.name) setUserName(u.name) })
    })
  }, [])

  // ── Auto-load bài từ URL param ?title= (từ journey "Nhịp") ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const titleParam = params.get('title')
    if (!titleParam) return
    supabase.from('timming_songs')
      .select('id, title, artist, tone, tempo, time_signature, song_data')
      .order('title', { ascending: true })
      .then(({ data }) => {
        if (!data?.length) { setSongListDefaultSearch(titleParam); setShowSongList(true); return }
        const lower = titleParam.toLowerCase()
        // Tìm khớp chính xác trước, rồi partial
        const exact   = data.find(s => s.title.toLowerCase() === lower)
        const partial = data.find(s => s.title.toLowerCase().includes(lower) || lower.includes(s.title.toLowerCase()))
        const match   = exact ?? partial
        if (match?.song_data) {
          loadSong(match.song_data)
        } else {
          // Không có bài khớp → mở SongList với search sẵn tên bài
          setSongListDefaultSearch(titleParam)
          setShowSongList(true)
        }
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    setShowTeacher(false); setLastScore(null); setSongTime(0)
    songTimeRef.current = 0; setIsPlaying(false)
    await loadProgress(s.title)
    const { data: { user } } = await supabase.auth.getUser()
    const query = supabase.from('student_taps')
      .select('user_id, score, level, app_users(name)')
      .eq('song_title', s.title).order('created_at', { ascending: false })
    if (user) query.neq('user_id', user.id)
    const { data: others } = await query.limit(20)
    if (others && others.length > 0) {
      const seen = new Set<string>()
      const unique: {name:string; score:number; level:number}[] = []
      others.forEach((r: any) => {
        if (!seen.has(r.user_id)) { seen.add(r.user_id); unique.push({ name: r.app_users?.name ?? 'Học sinh', score: r.score, level: r.level }) }
      })
      setOtherStudentsCount(unique.length); setOtherResults(unique)
    } else { setOtherStudentsCount(0); setOtherResults([]) }
  }

  useEffect(() => { if (song) loadHistory(song.title, activeLevel) }, [activeLevel, song?.title])

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

  const audioCtxRef    = useRef<AudioContext | null>(null)
  const schedulerRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const nextBeatRef    = useRef(0)
  const beatIdxRef     = useRef(0)

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
        osc.frequency.value = isBar1 ? 1000 : 500
        gain.gain.setValueAtTime(0.4, nextBeatRef.current)
        gain.gain.exponentialRampToValueAtTime(0.001, nextBeatRef.current + 0.06)
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
    setTapPulse(true)
    setTimeout(() => setTapPulse(false), 100)
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.code === 'Space') { e.preventDefault(); handleTap() }
      if (e.code === 'KeyP' || e.code === 'Enter') { e.preventDefault(); if (song) setIsPlaying(p => !p) }
      if (e.code === 'KeyR') { e.preventDefault(); handleReset() }
      if (e.code === 'KeyT') { e.preventDefault(); setShowTeacher(t => !t) }
      if (e.code === 'Escape') { if (showResultPopup) setShowResultPopup(false); else onClose?.() }
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

  const beatDur           = song ? 60 / song.tempo / speed : 0.5
  const levels            = song ? getLevels(song.timeSignature) : []
  const levelConfig       = levels[activeLevel - 1]
  const targetDots        = song && levelConfig ? generateTargetDots(song, levelConfig.beats) : []
  const targetDotsScaled  = targetDots.map(d => ({ time: d.time / speed }))

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
    const newUnlocked   = [...progress.unlocked_levels]
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
    setCurrentDots([]); setShowResultPopup(false)
    if (leveledUp) { setShowConfetti(true); setShowLevelUp(true); setTimeout(() => { setShowConfetti(false); setShowLevelUp(false) }, 4000) }
    else if (score >= 80) { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3000) }
    setSaveMsg('Đã lưu!'); setTimeout(() => setSaveMsg(''), 2000)
  }

  const handleDeleteHistory = async (id: string) => {
    await supabase.from('student_taps').delete().eq('id', id)
    setTapHistory(prev => prev.filter(h => h.id !== id))
  }

  const handleLogin = async () => {
    const email    = prompt('Email:')
    const password = prompt('Mật khẩu:')
    if (email && password) await supabase.auth.signInWithPassword({ email, password })
  }

  const nowX         = containerW * NOW_X_FRAC
  const scrollOffset = songTime * PX_PER_SEC
  const fmtTime      = (t: number) => `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`
  const resultMsg    = lastScore !== null ? getResultMsg(lastScore) : null
  const starCount    = lastScore !== null ? stars(lastScore) : 0
  const histOpacity  = [1, 0.55, 0.3]
  const progress_pct = totalDur > 0 ? (songTime / totalDur) * 100 : 0

  // ── Track (multi-measure vertical scroll — theo PlayerView) ──
  const TRACK_H      = 100
  const beatsPerTrack = song ? song.timeSignature : 4
  const chunkDur      = beatsPerTrack * beatDur           // clock time / chunk (đã nhân speed)
  const totalChunks   = song ? song.totalBars : 0
  const currentChunk  = chunkDur > 0
    ? Math.min(Math.floor(songTime / chunkDur), Math.max(0, totalChunks - 1))
    : 0
  const timeInChunk   = songTime - currentChunk * chunkDur
  const chunkDone     = currentChunk < totalChunks - 1 && timeInChunk >= chunkDur - beatDur && beatDur > 0
  const scrollProgress = chunkDone
    ? Math.min(1, (timeInChunk - (chunkDur - beatDur)) / beatDur)
    : 0
  const trackTranslateY = -((currentChunk + scrollProgress) * TRACK_H)

  // PPS: 1 measure vừa khít chiều rộng track viewport
  // Desktop: trừ 180px legend panel; Mobile: full width
  const trackViewportW = containerW > 0 ? (isMobile ? containerW : Math.max(containerW - 180, 200)) : 300
  const PPS_track = trackViewportW > 0 && beatsPerTrack > 0 && beatDur > 0
    ? trackViewportW / ((beatsPerTrack + 1) * beatDur)
    : 60
  const nowX_track = PPS_track * beatDur * 0.5   // nửa ô nhịp từ trái — vị trí playhead
  const currentBeatInMeasure = beatDur > 0 ? Math.floor(songTime / beatDur) % beatsPerTrack : 0

  return (
    <div style={{ position:'fixed', inset:0, background:C.bg, display:'flex', flexDirection:'column', zIndex:200, fontFamily:'"DM Sans", system-ui, sans-serif', color:C.text1 }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        .tap-btn-glow { box-shadow: 0 0 32px ${C.accentGlow}, 0 0 64px ${C.accentGlow}; }
        .tap-btn-idle { box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
        .tap-pulse { animation: tapRipple 0.12s ease-out; }
        @keyframes tapRipple { 0%{transform:scale(1)} 50%{transform:scale(0.94)} 100%{transform:scale(1)} }
        .ctrl-btn:hover { background: ${C.bgCardHover} !important; border-color: ${C.borderMid} !important; }
        .speed-btn:hover { background: ${C.bgCard} !important; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
      `}</style>

      <Confetti show={showConfetti} />

      {/* ══ HEADER ══ */}
      {isMobile ? (
        /* ── Mobile header: gọn, icon-based ── */
        <div style={{ background:C.bgSurface, borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', paddingLeft:4, paddingRight:8, paddingTop:'env(safe-area-inset-top, 0px)', height:52, gap:2, flexShrink:0 }}>
          {/* Back / Close */}
          {onClose && (
            <button onClick={onClose} style={{ width:44, height:44, borderRadius:12, border:'none', background:'none', color:C.text2, fontSize:22, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              ←
            </button>
          )}
          {/* Title */}
          <div style={{ flex:1, overflow:'hidden', padding:'0 4px' }}>
            {song ? (
              <>
                <div style={{ fontSize:15, fontWeight:700, color:C.text1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', letterSpacing:'-0.02em', lineHeight:1.2 }}>
                  {song.title}
                </div>
                <div style={{ fontSize:11, color:C.text3, marginTop:1 }}>{song.tempo} BPM · {song.timeSignature}/4</div>
              </>
            ) : (
              <div style={{ fontSize:14, color:C.text3 }}>🥁 Tap Nhịp</div>
            )}
          </div>
          {/* Song picker */}
          <button onClick={() => setShowSongList(true)} style={{ width:40, height:40, borderRadius:10, border:`1px solid ${C.borderMid}`, background:C.bgCard, fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            🎵
          </button>
          {/* Teacher → Player */}
          {isTeacher && (
            <button onClick={() => { window.location.href='/player' }} style={{ width:40, height:40, borderRadius:10, border:`1px solid rgba(108,99,255,0.3)`, background:'rgba(108,99,255,0.1)', fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              🎸
            </button>
          )}
          {/* User avatar / login */}
          {userName ? (
            <div style={{ width:32, height:32, borderRadius:'50%', background:`linear-gradient(135deg,${C.accent},${C.accentLight})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff', flexShrink:0 }}>
              {userName.charAt(0).toUpperCase()}
            </div>
          ) : !isGuest && (
            <button onClick={handleLogin} style={{ width:40, height:40, borderRadius:10, border:`1px solid ${C.border}`, background:'none', color:C.text3, fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              👤
            </button>
          )}
        </div>
      ) : (
        /* ── Desktop header ── */
        <div style={{ background:C.bgSurface, borderBottom:`1px solid ${C.border}`, paddingLeft:20, paddingRight:20, minHeight:56, display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:`linear-gradient(135deg,${C.accent},${C.accentLight})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>🥁</div>
          <span style={{ fontSize:13, fontWeight:700, color:C.text1, flexShrink:0 }}>Tap Nhịp</span>
          <button onClick={() => setShowSongList(true)} style={{ padding:'6px 12px', borderRadius:8, border:`1px solid ${C.borderMid}`, background:C.bgCard, color:C.text2, fontSize:12, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
            🎵 Chọn bài hát ▾
          </button>
          <div style={{ flex:1, textAlign:'center', overflow:'hidden' }}>
            {song ? (
              <div>
                <div style={{ fontSize:16, fontWeight:800, letterSpacing:'-0.03em', color:C.text1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{song.title}</div>
                <div style={{ fontSize:11, color:C.text3, marginTop:1 }}>{song.tempo} BPM · {song.timeSignature}/4 · {fmtTime(totalDur)}</div>
              </div>
            ) : <span style={{ fontSize:13, color:C.text3 }}>Chưa chọn bài</span>}
          </div>
          {song && (
            <div style={{ display:'flex', gap:2, background:C.bgCard, borderRadius:8, padding:2, border:`1px solid ${C.border}`, flexShrink:0 }}>
              {[0.5,0.75,1,1.25].map(s => (
                <button key={s} className="speed-btn" onClick={() => { setSpeed(s); if(isPlaying){setIsPlaying(false); setTimeout(()=>setIsPlaying(true),50)} }}
                  style={{ padding:'4px 10px', borderRadius:6, border:'none', fontSize:11, cursor:'pointer', fontFamily:'inherit', fontWeight:600, transition:'all 0.15s', background:speed===s?C.accent:'transparent', color:speed===s?'#fff':C.text3 }}>
                  {s===1?'1×':s+'×'}
                </button>
              ))}
            </div>
          )}
          {userName ? (
            <div style={{ display:'flex', alignItems:'center', gap:7, padding:'5px 10px', borderRadius:20, border:`1px solid ${C.border}`, background:C.bgCard, flexShrink:0 }}>
              <div style={{ width:22, height:22, borderRadius:'50%', background:`linear-gradient(135deg,${C.accent},${C.accentLight})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff' }}>{userName.charAt(0).toUpperCase()}</div>
              <span style={{ fontSize:12, color:C.text2 }}>{userName}</span>
            </div>
          ) : (
            <button onClick={handleLogin} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:20, border:`1px solid ${C.border}`, background:'none', color:C.text3, fontSize:12, cursor:'pointer', flexShrink:0 }}>👤 Đăng nhập</button>
          )}
          {isTeacher && (
            <button onClick={() => { window.location.href='/player' }} style={{ padding:'5px 10px', borderRadius:8, border:`1px solid rgba(108,99,255,0.4)`, background:'rgba(108,99,255,0.12)', color:'#A5B4FC', cursor:'pointer', fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
              🎸 Player
            </button>
          )}
          {onClose && <button onClick={onClose} style={{ width:32, height:32, borderRadius:8, border:`1px solid ${C.border}`, background:'none', color:C.text3, cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }} onMouseEnter={e=>(e.currentTarget.style.background=C.bgCard)} onMouseLeave={e=>(e.currentTarget.style.background='none')}>✕</button>}
        </div>
      )}

      {/* Guest banner */}
      {isGuest && (
        <div style={{ background:'rgba(108,99,255,0.08)', borderBottom:`1px solid rgba(108,99,255,0.15)`, padding:'6px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <span style={{ color:C.accentLight, fontSize:12 }}>✦ Chế độ khách — đã thử <strong>{guestSongsPlayed.length}/{GUEST_MAX_SONGS}</strong> bài</span>
          <button onClick={handleLogin} style={{ background:C.accent, border:'none', borderRadius:6, color:'#fff', fontSize:11, fontWeight:600, cursor:'pointer', padding:'4px 12px' }}>Đăng nhập</button>
        </div>
      )}

      {/* ══ EMPTY STATE ══ */}
      {!song && (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:24, padding:40 }}>
          <div style={{ position:'relative' }}>
            <div style={{ width:80, height:80, borderRadius:'50%', background:`linear-gradient(135deg,${C.accent}22,${C.accent}44)`, border:`2px solid ${C.accent}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:36 }}>
              🥁
            </div>
            <div style={{ position:'absolute', inset:-8, borderRadius:'50%', border:`1px solid ${C.accent}22`, animation:'ping 2s cubic-bezier(0,0,0.2,1) infinite' }} />
            <style>{`@keyframes ping{0%,100%{opacity:0.3;transform:scale(1)}50%{opacity:0;transform:scale(1.3)}}`}</style>
          </div>

          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize: isMobile?20:26, fontWeight:800, letterSpacing:'-0.03em', marginBottom:8 }}>Luyện cảm nhận nhịp</div>
            <div style={{ fontSize:14, color:C.text3, maxWidth:360, lineHeight:1.6 }}>Nghe nhạc, tap theo phách — rèn tai nghe nhịp điệu chuẩn như nhạc sĩ chuyên nghiệp.</div>
          </div>

          <div style={{ background:C.bgSurface, border:`1px solid ${C.border}`, borderRadius:16, padding:'20px 24px', maxWidth:380, width:'100%', display:'flex', flexDirection:'column', gap:12 }}>
            {[
              ['🎵', 'Chọn bài hát', 'Hàng chục bài đa thể loại'],
              ['▶',  'Phát nhạc',   'Nhấn P hoặc nút Bắt đầu'],
              ['👂', 'Nghe metronome', 'Click TO là phách mạnh'],
              ['✋', 'Tap theo nhịp', 'Space hoặc nút TAP lớn'],
              ['🏆', 'Xem điểm & lên level', 'Đạt 80 điểm để mở level mới'],
            ].map(([icon, title, sub]) => (
              <div key={title} style={{ display:'flex', gap:12, alignItems:'center' }}>
                <div style={{ width:36, height:36, borderRadius:10, background:C.bgCard, border:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{icon}</div>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:C.text1 }}>{title}</div>
                  <div style={{ fontSize:11, color:C.text3 }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => setShowSongList(true)}
            style={{ padding:'14px 48px', background:`linear-gradient(135deg,${C.accent},${C.accentLight})`, border:'none', borderRadius:12, color:'#fff', fontWeight:700, fontSize:16, cursor:'pointer', boxShadow:`0 8px 24px ${C.accentGlow}`, letterSpacing:'-0.02em' }}>
            🎵 Chọn bài hát
          </button>
        </div>
      )}

      {/* ══ MAIN ══ */}
      {song && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* LEVEL BAR */}
          {isMobile ? (
            /* Mobile: compact pill bar + shortDesc + BeatViz + best score */
            <div style={{ background:C.bgSurface, borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', padding:'0 10px', height:44, gap:6, flexShrink:0, overflowX:'auto' }}>
              {levels.map((lv, i) => {
                const lvNum    = i + 1
                const unlocked = progress.unlocked_levels.includes(lvNum)
                const isActive = activeLevel === lvNum
                const best     = progress.best_scores[String(lvNum)] ?? 0
                return (
                  <button key={lvNum} onClick={() => unlocked && setActiveLevel(lvNum)}
                    style={{ height:30, padding:'0 12px', borderRadius:20, border:`1px solid ${isActive?C.accent:C.border}`, background:isActive?C.accent:'transparent', color:isActive?'#fff':unlocked?C.text2:C.text3, fontSize:12, fontWeight:700, cursor:unlocked?'pointer':'not-allowed', flexShrink:0, fontFamily:'inherit', opacity:unlocked?1:0.4, display:'flex', alignItems:'center', gap:4 }}>
                    {!unlocked && <span style={{ fontSize:10 }}>🔒</span>}
                    L{lvNum}
                    {unlocked && best >= 80 && <span style={{ fontSize:9, color:isActive?'rgba(255,255,255,0.8)':C.green }}>★</span>}
                  </button>
                )
              })}
              <div style={{ width:1, height:20, background:C.border, flexShrink:0, marginLeft:2 }} />
              {levelConfig && (
                <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                  <span style={{ fontSize:11, color:C.text3, whiteSpace:'nowrap' }}>{levelConfig.shortDesc}</span>
                  <BeatViz beats={levelConfig.beats} timeSig={song.timeSignature} />
                </div>
              )}
              <div style={{ flex:1 }} />
              <div style={{ fontSize:12, fontWeight:700, color:bestThisLevel>=80?C.green:bestThisLevel>=60?C.gold:C.text3, flexShrink:0 }}>
                {bestThisLevel}<span style={{ fontSize:10, fontWeight:400, color:C.text3 }}>/100</span>
              </div>
            </div>
          ) : (
            /* Desktop: giữ nguyên layout cũ */
            <>
              <div style={{ background:C.bgSurface, borderBottom:`1px solid ${C.border}`, padding:'10px 20px', display:'flex', alignItems:'center', gap:8, flexShrink:0, overflowX:'auto' }}>
                {levels.map((lv, i) => {
                  const lvNum    = i + 1
                  const unlocked = progress.unlocked_levels.includes(lvNum)
                  const isActive = activeLevel === lvNum
                  const best     = progress.best_scores[String(lvNum)] ?? 0
                  return (
                    <button key={lvNum} onClick={() => unlocked && setActiveLevel(lvNum)}
                      style={{ padding:'7px 16px', borderRadius:8, cursor:unlocked?'pointer':'not-allowed', fontFamily:'inherit', fontSize:12, fontWeight:600, flexShrink:0, transition:'all 0.15s', background:isActive?C.accent:C.bgCard, color:isActive?'#fff':unlocked?C.text2:C.text3, border:`1px solid ${isActive?C.accent:C.border}`, opacity:unlocked?1:0.4, boxShadow:isActive?`0 2px 12px ${C.accentGlow}`:'none' }}>
                      {!unlocked && <span style={{ marginRight:4 }}>🔒</span>}
                      {lv.label}
                      {unlocked && best > 0 && <span style={{ marginLeft:6, fontSize:10, opacity:0.7, fontWeight:400 }}>{best}đ</span>}
                    </button>
                  )
                })}
                <div style={{ flex:1 }} />
                <div style={{ fontSize:13, fontWeight:700, color:bestThisLevel>=80?C.green:bestThisLevel>=60?C.gold:C.text2 }}>
                  {bestThisLevel}<span style={{ fontSize:10, color:C.text3, fontWeight:400 }}>/100</span>
                </div>
              </div>
              <div style={{ background:C.bg, borderBottom:`1px solid ${C.border}`, padding:'10px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexShrink:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:28, height:28, borderRadius:7, background:C.accentGlow, border:`1px solid ${C.borderAccent}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0 }}>🎯</div>
                  <span style={{ fontSize:13, color:C.text2, lineHeight:1.4 }}>{levelConfig?.desc}</span>
                </div>
                {levelConfig && <BeatViz beats={levelConfig.beats} timeSig={song.timeSignature} />}
              </div>
            </>
          )}

          {/* ══ TRACK AREA — multi-measure vertical scroll (theo PlayerView) ══ */}
          <div ref={scrollRef} style={{ flex:1, background:C.bg, position:'relative', overflow:'hidden', display:'flex' }}>

            {/* Track viewport */}
            <div style={{ flex:1, position:'relative', overflow:'hidden' }}>

              {/* Playhead line (cố định) */}
              <div style={{ position:'absolute', left:nowX_track, top:0, bottom:0, width:1, background:C.accent, opacity:0.35, zIndex:20, pointerEvents:'none' }} />
              {/* Playhead arrow */}
              <div style={{ position:'absolute', left:nowX_track, top:0, zIndex:21, transform:'translateX(-50%)', pointerEvents:'none' }}>
                <div style={{ width:0, height:0, borderLeft:'5px solid transparent', borderRight:'5px solid transparent', borderTop:`7px solid ${C.accent}`, filter:`drop-shadow(0 0 4px ${C.accent})` }} />
              </div>

              {/* Scrolling tracks container — translateY theo thời gian */}
              <div style={{ position:'absolute', top:0, left:0, right:0, transform:`translateY(${trackTranslateY}px)`, willChange:'transform' }}>

                {/* ── Track chuẩn bị — đẩy chunk 0 xuống giữa viewport (track 2) ── */}
                <div style={{
                  height: TRACK_H,
                  flexShrink: 0,
                  borderTop: `1px solid ${C.border}`,
                  background: isPlaying ? C.bgSurface : C.bg,
                  opacity: isPlaying ? 1 : 0.4,
                  transition: 'opacity 0.2s, background 0.2s',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  {/* Beat markers + animated dots theo currentBeatInMeasure */}
                  {Array.from({ length: beatsPerTrack }, (_, bi) => {
                    const isBar1 = bi === 0
                    const cellX  = nowX_track + bi * beatDur * PPS_track
                    const lit    = isPlaying && bi === currentBeatInMeasure
                    return (
                      <div key={bi} style={{
                        position: 'absolute', left: cellX, top: 0, height: 44,
                        width: PPS_track * beatDur,
                        transform: 'translateX(-50%)',
                        borderLeft: isBar1
                          ? `1.5px solid rgba(108,99,255,0.18)`
                          : `1px solid rgba(255,255,255,0.04)`,
                      }}>
                        <div style={{
                          position: 'absolute', left: '50%', top: 10,
                          transform: `translateX(-50%) scale(${lit ? 1.45 : 1})`,
                          width: isBar1 ? 11 : 9, height: isBar1 ? 11 : 9,
                          borderRadius: '50%',
                          background: isBar1 ? C.dotTarget : '#2DD4BF',
                          opacity: lit ? 1 : 0.25,
                          boxShadow: lit
                            ? (isBar1 ? '0 0 10px rgba(245,158,11,0.8)' : '0 0 10px rgba(45,212,191,0.8)')
                            : 'none',
                          transition: 'all 0.08s',
                        }} />
                      </div>
                    )
                  })}
                  {/* Separator */}
                  <div style={{ position:'absolute', top:44, left:0, right:0, height:1, background:C.border }} />
                  {/* "Chuẩn bị…" text — căn giữa measure, sáng lên khi đang phát */}
                  <div style={{
                    position: 'absolute',
                    left: nowX_track + (beatsPerTrack / 2) * beatDur * PPS_track,
                    top: 44 + (TRACK_H - 44) / 2,
                    transform: 'translate(-50%, -50%)',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                  }}>
                    <span style={{
                      fontSize: isMobile ? 14 : 16,
                      color: isPlaying ? 'rgba(45,212,191,0.9)' : 'rgba(255,255,255,0.3)',
                      fontFamily: '"Helvetica Neue",Arial,sans-serif',
                      letterSpacing: '0.05em',
                      transition: 'color 0.2s',
                    }}>Chuẩn bị…</span>
                  </div>
                </div>

                {Array.from({ length: totalChunks }, (_, ci) => {
                  const isActive  = ci === currentChunk
                  const chunkStart = ci * chunkDur
                  const chunkEnd   = (ci + 1) * chunkDur

                  // Filter dữ liệu cho chunk này
                  const chunkTargets = showTeacher
                    ? targetDotsScaled.filter(d => d.time >= chunkStart && d.time < chunkEnd)
                    : []
                  const chunkCurrent = scoredCurrent.filter(d => d.time >= chunkStart && d.time < chunkEnd)
                  const chunkLyrics  = (song.lyrics ?? []).filter(l => {
                    const ct = l.time / speed
                    return ct >= chunkStart && ct < chunkEnd
                  })

                  return (
                    <div key={ci} style={{
                      height: TRACK_H,
                      flexShrink: 0,
                      borderTop: `1px solid ${C.border}`,
                      background: isActive ? C.bgSurface : C.bg,
                      opacity: isActive ? 1 : 0.5,
                      transition: 'opacity 0.3s, background 0.3s',
                      position: 'relative',
                      overflow: 'hidden',
                    }}>
                      {/* Số nhịp */}
                      <div style={{ position:'absolute', top:3, left:6, fontSize:8, fontFamily:'monospace', color:'rgba(108,99,255,0.5)', zIndex:5, pointerEvents:'none' }}>
                        M{ci + 1}
                      </div>

                      {/* Beat markers (cột dọc) + dots */}
                      {Array.from({ length: beatsPerTrack }, (_, bi) => {
                        const beatIdx   = ci * beatsPerTrack + bi
                        const beatTime  = beatIdx * beatDur          // clock time
                        const cellX     = nowX_track + bi * beatDur * PPS_track
                        const isBar1    = bi === 0
                        const isBeatNow = isActive && bi === currentBeatInMeasure && isPlaying
                        return (
                          <div key={bi} style={{
                            position: 'absolute', left: cellX, top: 0, height: 44,
                            width: PPS_track * beatDur,
                            transform: 'translateX(-50%)',
                            borderLeft: isBar1
                              ? `1.5px solid rgba(108,99,255,0.3)`
                              : `1px solid rgba(255,255,255,0.05)`,
                          }}>
                            {/* Target dot */}
                            {chunkTargets.some(d => Math.abs(d.time - beatTime) < beatDur * 0.3) && (
                              <div style={{
                                position:'absolute', left:'50%', top:10,
                                transform: `translateX(-50%) scale(${isBeatNow ? 1.4 : 1})`,
                                width: isBar1 ? 11 : 9, height: isBar1 ? 11 : 9,
                                borderRadius:'50%', background: C.dotTarget,
                                opacity: isBeatNow ? 1 : 0.55,
                                boxShadow: isBeatNow ? `0 0 10px ${C.dotTarget}` : 'none',
                                transition: 'all 0.08s',
                              }} />
                            )}
                            {/* Beat ghost (khi không có target dot) */}
                            {!chunkTargets.some(d => Math.abs(d.time - beatTime) < beatDur * 0.3) && showTeacher && (
                              <div style={{
                                position:'absolute', left:'50%', top:12,
                                transform:'translateX(-50%)',
                                width: isBar1 ? 9 : 7, height: isBar1 ? 9 : 7,
                                borderRadius:'50%',
                                background: isBar1 ? 'rgba(245,158,11,0.15)' : 'rgba(45,212,191,0.1)',
                                border: `1px solid ${isBar1 ? 'rgba(245,158,11,0.25)' : 'rgba(45,212,191,0.18)'}`,
                              }} />
                            )}
                          </div>
                        )
                      })}

                      {/* User's current tap dots */}
                      {chunkCurrent.map((d, di) => (
                        <div key={'cd'+di} style={{
                          position:'absolute',
                          left: nowX_track + (d.time - chunkStart) * PPS_track,
                          top: 26,
                          transform:'translateX(-50%)',
                          width:11, height:11, borderRadius:'50%',
                          background: targetDotsScaled.length > 0 ? (d.hit ? C.dotCurrent : 'transparent') : C.dotCurrent,
                          border: targetDotsScaled.length > 0 && !d.hit ? `2px solid ${C.dotCurrent}` : 'none',
                          boxShadow: d.hit ? `0 0 6px ${C.dotCurrent}88` : 'none',
                        }} />
                      ))}

                      {/* History dots */}
                      {tapHistory.slice(0, 3).map((h, hi) =>
                        h.dots
                          .filter(d => d.time >= chunkStart && d.time < chunkEnd)
                          .map((d, di) => (
                            <div key={'hd'+hi+'_'+di} style={{
                              position:'absolute',
                              left: nowX_track + (d.time - chunkStart) * PPS_track,
                              top: 26,
                              transform:'translateX(-50%)',
                              width:8, height:8, borderRadius:'50%',
                              background: C.dotHistory,
                              opacity: histOpacity[hi] * 0.7,
                            }} />
                          ))
                      )}

                      {/* Separator */}
                      <div style={{ position:'absolute', top:44, left:0, right:0, height:1, background:C.border }} />

                      {/* Lyrics */}
                      {chunkLyrics.map((l, li) => {
                        const lct   = l.time / speed
                        const nextL = chunkLyrics[li + 1]
                        const nt    = nextL ? nextL.time / speed : lct + beatDur * 2
                        const active = isActive && songTime >= lct && songTime < nt
                        const past   = isActive && songTime >= nt
                        const pct    = active
                          ? Math.min(100, Math.max(0, (songTime - lct) / Math.max(0.05, nt - lct) * 100))
                          : 0
                        const cellW  = PPS_track * beatDur
                        // Font scale theo bề rộng ô nhịp, tối đa 18px mobile / 20px desktop
                        const lyricFs = Math.min(isMobile ? 18 : 20, cellW / 4.2)
                        return (
                          <div key={l.id} style={{
                            position: 'absolute',
                            left: nowX_track + (lct - chunkStart) * PPS_track,
                            top: 46,
                            height: TRACK_H - 46,
                            width: cellW,                   // khớp đúng bề rộng ô nhịp
                            transform: 'translateX(-50%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            pointerEvents: 'none',
                            overflow: 'hidden',             // cắt nếu vẫn tràn
                          }}>
                            <span style={{
                              fontSize: lyricFs,
                              fontWeight: 400,
                              fontFamily: '"Helvetica Neue",Arial,sans-serif',
                              whiteSpace: 'nowrap',
                              maxWidth: '100%',
                              ...(active ? {
                                backgroundImage: `linear-gradient(to right,#2DD4BF ${pct}%,rgba(255,255,255,1) ${pct}%)`,
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                              } : {
                                color: past ? 'rgba(45,212,191,0.65)' : 'rgba(255,255,255,0.85)',
                              }),
                            }}>
                              {l.text}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Legend panel — desktop */}
            {!isMobile && (
              <div style={{ width:180, flexShrink:0, padding:'12px 12px', display:'flex', flexDirection:'column', gap:0, borderLeft:`1px solid ${C.border}`, overflowY:'auto' }}>
                {/* Teacher dots */}
                <div style={{ height:30, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:C.dotTarget }}>
                    <div style={{ width:10, height:10, borderRadius:'50%', background:C.dotTarget, boxShadow:`0 0 6px ${C.dotTarget}` }} />
                    <span>Đáp án Thầy</span>
                  </div>
                  <button onClick={() => setShowTeacher(t=>!t)}
                    style={{ padding:'2px 8px', borderRadius:4, border:`1px solid ${C.border}`, background:showTeacher?C.bgCard:'none', fontSize:10, color:C.text3, cursor:'pointer', fontFamily:'inherit' }}>
                    {showTeacher ? 'Ẩn' : 'Xem'}
                  </button>
                </div>
                <div style={{ height:30, display:'flex', alignItems:'center' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:C.dotCurrent }}>
                    <div style={{ width:10, height:10, borderRadius:'50%', background:C.dotCurrent, boxShadow:`0 0 6px ${C.dotCurrent}` }} />
                    <span>Lần này</span>
                  </div>
                </div>
                {tapHistory.map((h, hi) => (
                  <div key={h.id} style={{ height:26, display:'flex', alignItems:'center', justifyContent:'space-between', opacity:histOpacity[hi] }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:11, color:C.dotHistory }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background:C.dotHistory }} />
                      <span>Lần {tapHistory.length-hi} · {h.score}đ</span>
                    </div>
                    <button onClick={() => handleDeleteHistory(h.id)}
                      style={{ width:16, height:16, borderRadius:3, border:`1px solid ${C.border}`, background:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:C.text3, fontSize:9, fontFamily:'inherit' }}>✕</button>
                  </div>
                ))}
                <div style={{ height:1, background:C.border, margin:'10px 0' }} />
                {otherStudentsCount > 0 && (
                  <div style={{ fontSize:11, color:C.text3 }}>
                    <div style={{ marginBottom:6, color:C.text2 }}>
                      <span style={{ color:C.green, fontWeight:700 }}>{otherStudentsCount}</span> bạn đang tập bài này
                    </div>
                    <button onClick={() => setShowOtherResults(t=>!t)}
                      style={{ width:'100%', padding:'5px 8px', borderRadius:6, border:`1px solid ${C.green}33`, background:`${C.green}11`, color:C.green, fontSize:10, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                      {showOtherResults ? 'Ẩn' : '👥 Xem kết quả bạn bè'}
                    </button>
                    {showOtherResults && (
                      <div style={{ marginTop:6, display:'flex', flexDirection:'column', gap:4 }}>
                        {otherResults.slice(0,5).map((r,i) => (
                          <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:10 }}>
                            <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:90, color:C.text2 }}>{r.name}</span>
                            <span style={{ color:C.green, fontWeight:700 }}>{r.score}đ</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ══ BOTTOM SECTION ══ */}
          {isMobile ? (
            /* ── Mobile bottom: score compact + progress + controls redesign ── */
            <>
              {/* Score + progress strip */}
              <div style={{ background:C.bgSurface, borderTop:`1px solid ${C.border}`, padding:'8px 12px', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                <ScoreRing score={currentScore ?? 0} size={40} />
                <div style={{ flex:1 }}>
                  <div style={{ height:4, background:C.bgCard, borderRadius:2, overflow:'hidden', marginBottom:4 }}>
                    <div style={{ height:'100%', width:`${progress_pct}%`, background:`linear-gradient(90deg,${C.accent},${C.accentLight})`, transition:'width 0.1s linear' }} />
                  </div>
                  <div style={{ fontSize:11, color:C.text3 }}>
                    {scoredCurrent.filter(d=>d.hit).length}/{targetDotsScaled.length} phách
                    {currentScore !== null && <span style={{ color: currentScore>=80?C.green:currentScore>=60?C.gold:C.text3, fontWeight:600 }}> · {currentScore}%</span>}
                  </div>
                </div>
                {saveMsg && <span style={{ fontSize:11, color:C.green, fontWeight:700 }}>✓</span>}
                {currentDots.length > 0 && (
                  <button onClick={handleShowResult} style={{ padding:'6px 14px', borderRadius:20, background:C.accent, border:'none', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0, fontFamily:'inherit', boxShadow:`0 2px 10px ${C.accentGlow}` }}>
                    Kết quả →
                  </button>
                )}
              </div>

              {/* Controls */}
              <div style={{ background:C.bgSurface, paddingTop:10, paddingLeft:12, paddingRight:12, paddingBottom:'max(16px, env(safe-area-inset-bottom, 16px))', flexShrink:0, display:'flex', flexDirection:'column', gap:8 }}>
                {/* Row 1: phụ — Reset / Play / Đáp án / Tốc độ */}
                <div style={{ display:'flex', gap:8 }}>
                  <button className="ctrl-btn" onClick={handleReset}
                    style={{ flex:1, height:44, borderRadius:12, border:`1px solid ${C.border}`, background:C.bgCard, color:C.text2, fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5, fontFamily:'inherit', transition:'all 0.15s' }}>
                    <span style={{ fontSize:16 }}>↺</span> Lại
                  </button>
                  <button className="ctrl-btn" onClick={() => setIsPlaying(p=>!p)}
                    style={{ flex:2, height:44, borderRadius:12, border:`1px solid ${isPlaying?C.accent+'55':C.border}`, background:isPlaying?`${C.accent}1A`:C.bgCard, color:isPlaying?C.accentLight:C.text2, fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontFamily:'inherit', transition:'all 0.15s' }}>
                    {isPlaying ? '⏸ Dừng' : '▶ Bắt đầu'}
                  </button>
                  <button className="ctrl-btn" onClick={() => setShowTeacher(t=>!t)}
                    style={{ flex:1, height:44, borderRadius:12, border:`1px solid ${showTeacher?C.gold+'55':C.border}`, background:showTeacher?`${C.gold}15`:C.bgCard, color:showTeacher?C.gold:C.text2, fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit', transition:'all 0.15s' }}>
                    👁
                  </button>
                  <select value={speed} onChange={e => setSpeed(Number(e.target.value))}
                    style={{ flex:1, height:44, borderRadius:12, border:`1px solid ${C.border}`, background:C.bgCard, color:C.text2, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', outline:'none', textAlign:'center' }}>
                    {[0.5,0.75,1,1.25].map(s=><option key={s} value={s}>{s===1?'1×':s+'×'}</option>)}
                  </select>
                </div>

                {/* Row 2: TAP hero — full width */}
                <button
                  className={tapPulse ? 'tap-pulse' : (isPlaying ? 'tap-btn-glow' : 'tap-btn-idle')}
                  onMouseDown={e => { e.preventDefault(); handleTap() }}
                  onTouchStart={e => { e.preventDefault(); handleTap() }}
                  style={{
                    width:'100%', height:62, borderRadius:16,
                    border:`2px solid ${isPlaying?C.accent:C.border}`,
                    background: isPlaying
                      ? `linear-gradient(135deg,${C.accentLight},${C.accent})`
                      : C.bgCard,
                    color: isPlaying?'#fff':C.text3,
                    cursor:'pointer', outline:'none',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:14,
                    fontSize:17, fontWeight:800, letterSpacing:'0.12em',
                    userSelect:'none', WebkitUserSelect:'none', fontFamily:'inherit',
                    transition:'all 0.2s',
                  }}>
                  <span style={{ fontSize:24 }}>✋</span>
                  TAP
                  <span style={{ fontSize:24 }}>✋</span>
                </button>
              </div>
            </>
          ) : (
            /* ── Desktop bottom: layout cũ ── */
            <>
              <div style={{ background:C.bgSurface, borderTop:`1px solid ${C.border}`, padding:'10px 20px', display:'flex', alignItems:'center', justifyContent:'center', gap:16, flexShrink:0 }}>
                <ScoreRing score={currentScore ?? 0} size={60} />
                <div>
                  <div style={{ fontSize:22, fontWeight:800, color:C.text1, lineHeight:1, letterSpacing:'-0.03em' }}>
                    {scoredCurrent.filter(d=>d.hit).length}
                    <span style={{ fontSize:13, color:C.text3, fontWeight:400 }}> / {targetDotsScaled.length} phách</span>
                  </div>
                  <div style={{ fontSize:11, color:C.text3, marginTop:2 }}>
                    {currentScore !== null ? `Chính xác ${currentScore}%` : 'Chưa có dữ liệu'}
                  </div>
                </div>
                <div style={{ flex:1 }} />
                {saveMsg && <span style={{ fontSize:12, color:C.green, fontWeight:600 }}>✓ {saveMsg}</span>}
                {currentDots.length > 0 && (
                  <button onClick={handleShowResult} style={{ padding:'8px 16px', borderRadius:8, background:C.accent, border:'none', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', boxShadow:`0 2px 12px ${C.accentGlow}`, fontFamily:'inherit' }}>
                    Xem kết quả →
                  </button>
                )}
              </div>
              <div style={{ height:2, background:C.bgCard, flexShrink:0 }}>
                <div style={{ height:'100%', width:`${progress_pct}%`, background:`linear-gradient(90deg,${C.accent},${C.accentLight})`, transition:'width 0.1s linear' }} />
              </div>
              <div style={{ background:C.bgSurface, borderTop:`1px solid ${C.border}`, paddingTop:16, paddingLeft:20, paddingRight:20, paddingBottom:18, flexShrink:0 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:16 }}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flex:1, maxWidth:110 }}>
                    <button className="ctrl-btn" onClick={handleReset} style={{ width:'100%', padding:'13px 0', borderRadius:12, border:`1px solid ${C.border}`, background:C.bgCard, color:C.text2, fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontFamily:'inherit', transition:'all 0.15s' }}>
                      <span>↺</span><span>Làm lại</span>
                    </button>
                    <span style={{ fontSize:10, color:C.text3 }}>Phím R</span>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flex:1, maxWidth:110 }}>
                    <button className="ctrl-btn" onClick={() => setIsPlaying(p=>!p)} style={{ width:'100%', padding:'13px 0', borderRadius:12, border:`1px solid ${isPlaying?C.accent+'44':C.border}`, background:isPlaying?`${C.accent}22`:C.bgCard, color:isPlaying?C.accentLight:C.text2, fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontFamily:'inherit', transition:'all 0.15s' }}>
                      <span>{isPlaying?'⏸':'▶'}</span><span>{isPlaying?'Dừng':'Bắt đầu'}</span>
                    </button>
                    <span style={{ fontSize:10, color:C.text3 }}>Phím P</span>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flexShrink:0 }}>
                    <button className={tapPulse?'tap-pulse':(isPlaying?'tap-btn-glow':'tap-btn-idle')} onMouseDown={e=>{e.preventDefault();handleTap()}} onTouchStart={e=>{e.preventDefault();handleTap()}}
                      style={{ width:100, height:100, borderRadius:'50%', border:`2px solid ${isPlaying?C.accent:C.border}`, background:isPlaying?`radial-gradient(circle at 40% 35%,${C.accentLight},${C.accent})`:C.bgCard, color:isPlaying?'#fff':C.text3, cursor:'pointer', outline:'none', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:4, transition:'all 0.2s', userSelect:'none', WebkitUserSelect:'none' }}>
                      <span style={{ fontSize:26 }}>✋</span>
                      <span style={{ fontSize:12, fontWeight:800, letterSpacing:'0.08em', lineHeight:1 }}>TAP</span>
                    </button>
                    <span style={{ fontSize:10, color:C.text3 }}>Space</span>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flex:1, maxWidth:110 }}>
                    <button className="ctrl-btn" onClick={() => setShowTeacher(t=>!t)} style={{ width:'100%', padding:'13px 0', borderRadius:12, border:`1px solid ${showTeacher?C.gold+'44':C.border}`, background:showTeacher?`${C.gold}11`:C.bgCard, color:showTeacher?C.gold:C.text2, fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontFamily:'inherit', transition:'all 0.15s' }}>
                      <span>👁</span><span>Đáp án</span>
                    </button>
                    <span style={{ fontSize:10, color:C.text3 }}>Phím T</span>
                  </div>
                </div>
                <div style={{ textAlign:'center', fontSize:10, color:C.text3, marginTop:10, letterSpacing:'0.05em' }}>
                  SPACE = TAP &nbsp;·&nbsp; P = Phát/Dừng &nbsp;·&nbsp; R = Làm lại &nbsp;·&nbsp; T = Đáp án &nbsp;·&nbsp; ESC = Đóng
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ POPUP KẾT QUẢ ══ */}
      {showResultPopup && lastScore !== null && resultMsg && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', backdropFilter:'blur(8px)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={() => setShowResultPopup(false)}>
          <div style={{ background:C.bgSurface, border:`1px solid ${C.border}`, borderRadius:20, padding: isMobile?'28px 20px':'32px 28px', textAlign:'center', maxWidth:380, width:'100%', boxShadow:`0 24px 64px rgba(0,0,0,0.6)` }}
            onClick={e => e.stopPropagation()}>

            <div style={{ fontSize:44, marginBottom:12 }}>{resultMsg.emoji}</div>
            <div style={{ fontWeight:800, fontSize:20, letterSpacing:'-0.03em', marginBottom:16 }}>{resultMsg.title}</div>

            {/* Score ring big */}
            <div style={{ display:'flex', justifyContent:'center', marginBottom:16 }}>
              <ScoreRing score={lastScore} size={100} />
            </div>

            {/* Stars */}
            <div style={{ fontSize:22, marginBottom:12, letterSpacing:2 }}>
              {'⭐'.repeat(starCount)}{'☆'.repeat(5-starCount)}
            </div>

            {prevBest > 0 && (
              <div style={{ fontSize:13, marginBottom:12, fontWeight:600, color: lastScore>prevBest ? C.green : C.text3 }}>
                {lastScore>prevBest ? `📈 +${lastScore-prevBest} so với kỷ lục!` : lastScore===prevBest ? '🎯 Bằng kỷ lục!' : `Kỷ lục: ${prevBest}đ`}
              </div>
            )}

            <div style={{ color:C.text2, fontSize:13, marginBottom:resultMsg.hint?12:20, lineHeight:1.6 }}>{resultMsg.body}</div>

            {resultMsg.hint && (
              <div style={{ marginBottom:20, padding:'10px 14px', background:`${C.accent}11`, borderRadius:10, border:`1px solid ${C.accent}22`, fontSize:12, color:C.accentLight, lineHeight:1.5 }}>
                💡 {resultMsg.hint}
              </div>
            )}

            {lastScore < UNLOCK_SCORE && activeLevel < levels.length && (
              <div style={{ marginBottom:16, padding:'10px 14px', background:C.goldDim, borderRadius:10, border:`1px solid ${C.gold}33` }}>
                <div style={{ fontSize:12, color:C.gold, marginBottom:6 }}>Cần thêm <strong>{UNLOCK_SCORE-lastScore} điểm</strong> để mở Level {activeLevel+1}</div>
                <div style={{ height:4, background:C.bgCard, borderRadius:2, overflow:'hidden' }}>
                  <div style={{ width:`${Math.min(lastScore/UNLOCK_SCORE*100,100)}%`, height:'100%', background:C.gold, borderRadius:2, transition:'width 0.5s' }} />
                </div>
              </div>
            )}

            {lastScore >= UNLOCK_SCORE && activeLevel < levels.length && (
              <div style={{ marginBottom:16, padding:'10px 14px', background:C.greenDim, borderRadius:10, border:`1px solid ${C.green}33`, fontSize:13, color:C.green, fontWeight:700 }}>
                🔓 Đủ điểm mở Level {activeLevel+1}! Lưu để nhận thưởng
              </div>
            )}

            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button onClick={() => { setShowResultPopup(false); setCurrentDots([]) }}
                style={{ padding:'10px 20px', background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:10, color:C.text2, fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                ↺ Thử lại
              </button>
              {!isGuest ? (
                <button onClick={handleSave}
                  style={{ padding:'10px 24px', background:`linear-gradient(135deg,${C.accent},${C.accentLight})`, border:'none', borderRadius:10, color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit', boxShadow:`0 4px 14px ${C.accentGlow}` }}>
                  💾 Lưu điểm
                </button>
              ) : (
                <button onClick={handleLogin}
                  style={{ padding:'10px 24px', background:`linear-gradient(135deg,${C.accent},${C.accentLight})`, border:'none', borderRadius:10, color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                  Đăng nhập để lưu
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ LEVEL UP ══ */}
      {showLevelUp && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', backdropFilter:'blur(12px)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:C.bgSurface, border:`2px solid ${C.accent}`, borderRadius:20, padding:40, textAlign:'center', maxWidth:340, boxShadow:`0 0 60px ${C.accentGlow}` }}>
            <div style={{ fontSize:54, marginBottom:8 }}>✨</div>
            <div style={{ color:C.accent, fontWeight:900, fontSize:28, letterSpacing:'-0.04em', marginBottom:4 }}>LEVEL UP!</div>
            <div style={{ fontWeight:700, fontSize:18, marginBottom:8 }}>🔓 Level {activeLevel+1} đã mở khoá!</div>
            <div style={{ color:C.text2, fontSize:14, marginBottom:16 }}>{levels[activeLevel]?.desc}</div>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:20 }}>
              {song && levels[activeLevel] && <BeatViz beats={levels[activeLevel].beats} timeSig={song.timeSignature} />}
            </div>
            <button onClick={() => { setShowLevelUp(false); setActiveLevel(activeLevel+1) }}
              style={{ padding:'12px 32px', background:`linear-gradient(135deg,${C.accent},${C.accentLight})`, border:'none', borderRadius:10, color:'#fff', fontWeight:700, fontSize:15, cursor:'pointer', fontFamily:'inherit', boxShadow:`0 4px 20px ${C.accentGlow}` }}>
              Thử ngay →
            </button>
          </div>
        </div>
      )}

      {/* ══ GUEST LIMIT ══ */}
      {showGuestLimit && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', backdropFilter:'blur(8px)', zIndex:700, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:C.bgSurface, border:`1px solid ${C.border}`, borderRadius:20, padding:'32px 28px', textAlign:'center', maxWidth:340, width:'100%' }}>
            <div style={{ fontSize:44, marginBottom:12 }}>🎵</div>
            <div style={{ fontWeight:800, fontSize:18, marginBottom:8, letterSpacing:'-0.03em' }}>Bạn đã thử {GUEST_MAX_SONGS} bài!</div>
            <div style={{ color:C.text2, fontSize:13, lineHeight:1.65, marginBottom:20 }}>Đăng nhập để luyện tập không giới hạn và lưu điểm.</div>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button onClick={() => setShowGuestLimit(false)}
                style={{ padding:'10px 20px', background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:10, color:C.text2, fontWeight:500, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                Đóng
              </button>
              <button onClick={handleLogin}
                style={{ padding:'10px 24px', background:`linear-gradient(135deg,${C.accent},${C.accentLight})`, border:'none', borderRadius:10, color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
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
          isTeacher={isTeacher}
          defaultSearch={songListDefaultSearch}
        />
      )}
    </div>
  )
}
