import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import MusicPlayer from './piano/MusicPlayer'

// ── Types ────────────────────────────────────────────────────────────────────
interface PianoNote { pitch: string; startBeat: number; duration: number }
interface Exercise { title: string; bpm: number; notes: PianoNote[] }

type FlowState = 'idle' | 'listening' | 'generating' | 'playing'

const SUPABASE_URL = 'https://wojmdilyflffvdtpovmq.supabase.co'

// ── Colors ────────────────────────────────────────────────────────────────────
const C = {
  bg1: '#2D1F0A', bg2: '#1C1408',
  ring: 'rgba(251,191,36,0.35)',
  text: '#FEF3C7', dim: '#A78B4A',
}

interface Props { onClose?: () => void }

export default function PianoJourney({ onClose }: Props) {
  const [flow, setFlow]           = useState<FlowState>('idle')
  const [transcript, setTranscript] = useState('')
  const [exercise, setExercise]   = useState<Exercise | null>(null)
  const [error, setError]         = useState('')
  const [elapsed, setElapsed]     = useState(0)

  const flowRef       = useRef<FlowState>('idle')
  const recognitionRef = useRef<any>(null)
  const animRef       = useRef(0)

  useEffect(() => { flowRef.current = flow }, [flow])

  // Animation tick
  useEffect(() => {
    if (flow !== 'listening' && flow !== 'generating') return
    const tick = () => { setElapsed(p => p + 1); animRef.current = requestAnimationFrame(tick) }
    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [flow])

  // ── Voice: SpeechRecognition ──
  const startListening = useCallback(() => {
    if (flowRef.current !== 'idle') return
    setFlow('listening'); setTranscript(''); setError(''); setElapsed(0)

    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) { setError('Trình duyệt không hỗ trợ nhận giọng nói. Dùng Chrome nhé!'); setFlow('idle'); return }

    const rec = new SpeechRecognition()
    rec.lang = 'vi-VN'
    rec.interimResults = true
    rec.continuous = false

    let finalText = ''
    rec.onresult = (e: any) => {
      let t = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        t += e.results[i][0].transcript
        if (e.results[i].isFinal) finalText = t
      }
      setTranscript(t || finalText)
    }

    rec.onerror = (e: any) => {
      if (e.error === 'no-speech') {
        // Thử lại
        if (flowRef.current === 'listening') {
          try { rec.start() } catch {}
        }
      } else {
        setError('Lỗi micro: ' + e.error); setFlow('idle')
      }
    }

    rec.onend = () => {
      const text = finalText || transcript
      if (text.trim() && flowRef.current === 'listening') {
        generateMission(text.trim())
      } else if (flowRef.current === 'listening') {
        setFlow('idle')
      }
    }

    recognitionRef.current = rec
    rec.start()
  }, [transcript])

  // ── Generate mission (AI hoặc fallback) ──
  const generateMission = async (prompt: string) => {
    setFlow('generating'); setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Vui lòng đăng nhập'); setFlow('idle'); return }

      // Thử gọi edge function
      let ex: Exercise | null = null
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/piano-generate`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        })
        if (res.ok) { const data = await res.json(); if (data.notes) ex = data as Exercise }
      } catch { /* fallback bên dưới */ }

      // Fallback: tự tạo bài tập mẫu nếu edge function chưa sẵn sàng
      if (!ex) {
        ex = makeFallbackExercise(prompt)
      }

      setExercise(ex)
      setFlow('playing')
    } catch (e: any) {
      setError(e.message); setFlow('idle')
    }
  }

  // ── Back to voice ──
  const backToVoice = () => { setFlow('idle'); setExercise(null); setTranscript('') }

  // ── If playing: show MusicPlayer ──
  if (flow === 'playing' && exercise) {
    return (
      <MusicPlayer
        exercise={exercise}
        onClose={onClose}
        onBack={backToVoice}
      />
    )
  }

  // ── Voice UI ──
  const BUTTON = 140
  const isListening = flow === 'listening'
  const isGenerating = flow === 'generating'

  const rings = (isListening || isGenerating)
    ? [1,2,3].map(i => { const p = (elapsed*0.8 + i*1.2) % 4; return { scale: 1+p*0.55, opacity: Math.max(0, 0.5-p*0.12) } })
    : []

  const cfg = {
    idle:       { icon: '🎤', label: 'Chạm để nói', bg: 'linear-gradient(135deg,#F59E0B,#D97706)', shadow: '0 8px 40px rgba(245,158,11,.3)', scale:1, lc:C.dim },
    listening:  { icon: '🎙️', label: transcript || 'Đang nghe...', bg: 'linear-gradient(135deg,#F59E0B,#D97706)', shadow: '0 8px 60px rgba(251,191,36,.5),0 0 120px rgba(251,191,36,.2)', scale:1.05, lc:C.text },
    generating: { icon: '⏳', label: 'Đang tạo bài tập...', bg: 'linear-gradient(135deg,#6366F1,#4F46E5)', shadow: '0 8px 40px rgba(99,102,241,.35)', scale:1, lc:C.dim },
  }[flow] || cfgDefault

  const handleTap = () => {
    if (flow === 'idle') startListening()
  }

  return (
    <div style={{ minHeight:'100dvh',background:`linear-gradient(180deg,${C.bg1} 0%,${C.bg2} 100%)`,display:'flex',flexDirection:'column',alignItems:'center',fontFamily:'Inter,system-ui,sans-serif',position:'relative',overflow:'hidden',userSelect:'none' }}>
      {onClose && <button onClick={onClose} style={{ position:'absolute',top:20,right:20,zIndex:10,background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.1)',borderRadius:50,width:44,height:44,fontSize:18,color:C.dim,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(12px)' }}>✕</button>}

      {/* Header */}
      <div style={{ width:'100%',textAlign:'center',paddingTop:72,paddingBottom:24 }}>
        <div style={{ fontSize:40,marginBottom:4 }}>🎹</div>
        <div style={{ fontSize:20,fontWeight:700,color:C.text,letterSpacing:'-.3px' }}>Piano Journey</div>
      </div>

      {/* Instruction */}
      <div style={{ fontSize:18,color:C.dim,textAlign:'center',padding:'0 40px',lineHeight:1.6,marginBottom:40 }}>
        {flow === 'idle' && 'Con muốn tập bài gì hôm nay?'}
        {flow === 'generating' && `Cherry đang soạn bài "${transcript}"...`}
      </div>

      {/* Spacer */}
      <div style={{ flex:1 }} />

      {/* Button area */}
      <div style={{ display:'flex',flexDirection:'column',alignItems:'center',paddingBottom:100 }}>
        <div style={{ position:'relative',width:BUTTON*4,height:BUTTON*4,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:8 }}>
          {rings.map((r,i) => <div key={i} style={{ position:'absolute',width:BUTTON,height:BUTTON,borderRadius:'50%',border:`2px solid ${C.ring}`,transform:`scale(${r.scale})`,opacity:r.opacity }} />)}
          <button onClick={handleTap} disabled={flow !== 'idle'}
            style={{ width:BUTTON,height:BUTTON,borderRadius:'50%',background:cfg.bg,border:'none',cursor:flow==='idle'?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:cfg.shadow,transform:`scale(${cfg.scale})`,transition:'transform .3s ease,box-shadow .5s ease,background .5s ease',position:'relative',zIndex:2,outline:'none',fontSize:36 }}>
            {flow === 'generating' ? <Dots /> : cfg.icon}
          </button>
        </div>
        <div style={{ fontSize:15,fontWeight:600,color:cfg.lc,transition:'color .5s ease',textAlign:'center',maxWidth:320,lineHeight:1.4 }}>
          {cfg.label}
        </div>
        {error && <div style={{ fontSize:13,color:'#FCA5A5',textAlign:'center',marginTop:8 }}>{error}</div>}
      </div>

      <div style={{ position:'absolute',top:'12%',left:-20,fontSize:64,opacity:.04,pointerEvents:'none' }}>🎵</div>
      <div style={{ position:'absolute',top:'30%',right:-16,fontSize:56,opacity:.04,pointerEvents:'none' }}>🎶</div>
    </div>
  )
}

function Dots() {
  return <div style={{display:'flex',gap:6}}>
    {[0,1,2].map(i=><div key={i} style={{width:8,height:8,borderRadius:'50%',background:'#fff',animation:`pj-bounce 1.2s ${i*.15}s infinite ease-in-out`}}/>)}
    <style>{`@keyframes pj-bounce{0%,80%,100%{transform:scale(.5);opacity:.4}40%{transform:scale(1);opacity:1}}`}</style>
  </div>
}

// ── Fallback: tự tạo bài tập mẫu ──
function makeFallbackExercise(prompt: string): Exercise {
  const patterns: [string, number[]][] = [
    ['Đô Rê Mi', [0,1,2,3,2,1,0,-1]],
    ['bậc thang', [0,0,1,1,2,2,3,3,4,4,5,5]],
    ['lên xuống', [0,2,4,2,0,2,4,2,0,-1]],
    ['bước nhảy', [0,3,0,3,2,0,2,0,-1]],
  ]
  const p = patterns.find(([name]) => prompt.toLowerCase().includes(name.toLowerCase()))
  const steps = p ? p[1] : [0,0,1,1,2,2,1,-1]
  const pitches = ['C4','D4','E4','F4','G4','A4','B4','C5']

  return {
    title: prompt.slice(0, 60) || 'Bài tập mới',
    bpm: 90,
    notes: steps.filter(s => s >= 0).map((s, i) => ({
      pitch: pitches[Math.min(s, pitches.length - 1)],
      startBeat: i,
      duration: i === steps.filter(s => s >= 0).length - 1 ? 2 : 1,
    })),
  }
}

const cfgDefault = { icon:'🎤',label:'',bg:'',shadow:'',scale:1,lc:C.dim }
