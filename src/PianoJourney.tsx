import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import LearningFlow from './piano/LearningFlow'

// ── Types ────────────────────────────────────────────────────────────────────
interface PianoNote { pitch: string; startBeat: number; duration: number }
interface Exercise { title: string; bpm: number; notes: PianoNote[] }

type FlowState = 'idle' | 'listening' | 'generating' | 'playing'

const SUPABASE_URL = 'https://wojmdilyflffvdtpovmq.supabase.co'

// ── Colors ────────────────────────────────────────────────────────────────────
const C = {
  bg1: '#F9F7F1', bg2: '#F0ECE3',
  ring: 'rgba(245,158,11,0.4)',
  text: '#2E2A24', dim: '#8A8478',
  accent: '#F59E0B',
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
  const startListening = useCallback(async () => {
    if (flowRef.current !== 'idle') return
    setError('')

    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

    // Request mic permission first — required on iOS for speech recognition
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach(t => t.stop()) // release immediately
      } catch {
        setError('Micro bị chặn — gõ yêu cầu bên dưới nhé ✍️')
        return
      }
    }

    if (!SpeechRecognition) {
      setError('Micro không khả dụng — gõ bên dưới nhé ✍️')
      return
    }

    setFlow('listening'); setTranscript(''); setElapsed(0)

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
        if (flowRef.current === 'listening') {
          try { rec.start() } catch {}
        }
      } else if (e.error === 'not-allowed') {
        setError('Micro bị chặn — gõ yêu cầu bên dưới nhé ✍️'); setFlow('idle')
      } else {
        setError('Micro không khả dụng — gõ bên dưới nhé ✍️'); setFlow('idle')
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
    let ex: Exercise | null = null

    // Thử gọi AI edge function nếu đã đăng nhập
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/piano-generate`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        })
        if (res.ok) { const data = await res.json(); if (data.notes) ex = data as Exercise }
      } catch { /* fallback bên dưới */ }
    }

    // Fallback: tự tạo bài tập mẫu — luôn chạy, không cần đăng nhập
    if (!ex) {
      ex = makeFallbackExercise(prompt)
    }

    setExercise(ex)
    setFlow('playing')
  }

  // ── Back to voice ──
  const backToVoice = () => { setFlow('idle'); setExercise(null); setTranscript('') }

  // ── If playing: show LearningFlow ──
  if (flow === 'playing') {
    if (exercise) {
      return (
        <LearningFlow
          exercise={exercise}
          onClose={onClose}
          onBack={backToVoice}
        />
      )
    }
    // safety fallback
    setFlow('idle'); setExercise(null);
  }

  // ── Voice UI ──
  const BUTTON = 120
  const isListening = flow === 'listening'
  const isGenerating = flow === 'generating'

  const rings = (isListening || isGenerating)
    ? [1,2,3].map(i => { const p = (elapsed*0.8 + i*1.2) % 4; return { scale: 1+p*0.55, opacity: Math.max(0, 0.5-p*0.12) } })
    : []

  const cfg = {
    idle:       { icon: '🎤', label: 'Chạm để nói', bg: 'linear-gradient(135deg,#F59E0B,#D97706)', shadow: '0 8px 40px rgba(245,158,11,.3)', scale:1, lc:C.dim },
    listening:  { icon: '🎙️', label: transcript || 'Đang nghe...', bg: 'linear-gradient(135deg,#F59E0B,#D97706)', shadow: '0 8px 60px rgba(251,191,36,.5),0 0 120px rgba(251,191,36,.2)', scale:1.05, lc:C.text },
    generating: { icon: '⏳', label: 'Đang tạo bài tập...', bg: 'linear-gradient(135deg,#6366F1,#4F46E5)', shadow: '0 8px 40px rgba(99,102,241,.35)', scale:1, lc:C.dim },
    playing:    { icon: '🎵', label: '', bg: 'linear-gradient(135deg,#F59E0B,#D97706)', shadow: '0 8px 40px rgba(245,158,11,.3)', scale:1, lc:C.text },
  }[flow] || cfgDefault

  const handleTap = () => {
    if (flow === 'idle') startListening()
  }

  return (
    <div style={{ height:'100dvh',background:`linear-gradient(180deg,${C.bg1} 0%,${C.bg2} 100%)`,display:'flex',flexDirection:'column',alignItems:'center',fontFamily:'Inter,system-ui,sans-serif',position:'relative',overflowX:'hidden',overflowY:'auto' }}>
      {onClose && <button onClick={onClose} style={{ position:'fixed',top:20,right:20,zIndex:100,background:'rgba(0,0,0,.06)',border:'1px solid rgba(0,0,0,.08)',borderRadius:50,width:44,height:44,fontSize:18,color:C.dim,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(12px)' }}>✕</button>}

      {/* Header */}
      <div style={{ width:'100%',textAlign:'center',paddingTop:36,paddingBottom:16 }}>
        <div style={{ fontSize:32,marginBottom:2 }}>🎹</div>
        <div style={{ fontSize:18,fontWeight:700,color:C.text,letterSpacing:'-.3px' }}>Piano Journey</div>
      </div>

      {/* Instruction */}
      <div style={{ fontSize:16,color:C.dim,textAlign:'center',padding:'0 40px',lineHeight:1.5,marginBottom:24 }}>
        {flow === 'idle' && 'Con muốn tập bài gì hôm nay?'}
        {flow === 'generating' && (
          <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:6 }}>
            <span style={{ fontSize:24,animation:'pj-pulse 2s ease-in-out infinite' }}>✨</span>
            <span style={{ fontSize:15,color:C.text,fontWeight:600 }}>Đang sáng tác bản nhạc...</span>
            <span style={{ fontSize:13,color:C.dim }}>"{transcript}"</span>
          </div>
        )}
      </div>

      {/* Button area */}
      <div style={{ display:'flex',flexDirection:'column',alignItems:'center',paddingBottom:40 }}>
        <div style={{ position:'relative',width:BUTTON*3,height:BUTTON*3,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:8 }}>
          {rings.map((r,i) => <div key={i} style={{ position:'absolute',width:BUTTON,height:BUTTON,borderRadius:'50%',border:`2px solid ${C.ring}`,transform:`scale(${r.scale})`,opacity:r.opacity }} />)}
          <button onClick={handleTap} disabled={flow !== 'idle'}
            style={{ width:BUTTON,height:BUTTON,borderRadius:'50%',background:cfg.bg,border:'none',cursor:flow==='idle'?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:cfg.shadow,transform:`scale(${cfg.scale})`,transition:'transform .3s ease,box-shadow .5s ease,background .5s ease',position:'relative',zIndex:2,outline:'none',fontSize:36 }}>
            {flow === 'generating' ? <Dots /> : cfg.icon}
          </button>
        </div>
        <div style={{ fontSize:15,fontWeight:600,color:cfg.lc,transition:'color .5s ease',textAlign:'center',maxWidth:320,lineHeight:1.4 }}>
          {cfg.label}
        </div>
        {error && <div style={{ fontSize:13,color:'#C2410C',textAlign:'center',marginTop:8 }}>{error}</div>}

        {/* Text input */}
        {flow === 'idle' && (
          <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:10,marginTop:24,width:'85%',maxWidth:340 }}>
            <textarea
              value={transcript} onChange={e => setTranscript(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && transcript.trim()) { e.preventDefault(); generateMission(transcript.trim()) } }}
              placeholder={'Ví dụ:\nCon muốn bài về khủng long\nCon muốn bài thiếu nhi\nCon muốn bài về mèo'}
              rows={3}
              style={{ width:'100%',padding:'12px 16px',fontSize:14,borderRadius:14,border:'1px solid #EAE4D8',background:'#fff',color:'#2E2A24',outline:'none',fontFamily:'inherit',textAlign:'center',resize:'none',lineHeight:1.6 }}
            />
            {transcript.trim() && (
              <button onClick={() => generateMission(transcript.trim())}
                style={{ padding:'11px 24px',fontSize:15,fontWeight:700,borderRadius:14,border:'none',background:'linear-gradient(135deg,#F59E0B,#D97706)',color:'#fff',cursor:'pointer',fontFamily:'inherit',boxShadow:'0 4px 20px rgba(245,158,11,.25)' }}>
                🎹 Tạo bài tập
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{ position:'absolute',top:'12%',left:-20,fontSize:64,opacity:.04,pointerEvents:'none' }}>🎵</div>
      <div style={{ position:'absolute',top:'30%',right:-16,fontSize:56,opacity:.04,pointerEvents:'none' }}>🎶</div>
    </div>
  )
}

function Dots() {
  return <div style={{display:'flex',gap:6}}>
    {[0,1,2].map(i=><div key={i} style={{width:8,height:8,borderRadius:'50%',background:'#fff',animation:`pj-bounce 1.2s ${i*.15}s infinite ease-in-out`}}/>)}
    <style>{`@keyframes pj-bounce{0%,80%,100%{transform:scale(.5);opacity:.4}40%{transform:scale(1);opacity:1}}@keyframes pj-pulse{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.15)}}`}</style>
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
