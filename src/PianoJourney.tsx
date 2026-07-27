import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

// ── Constants ────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://wojmdilyflffvdtpovmq.supabase.co'

// ── Types ────────────────────────────────────────────────────────────────────
type VoiceState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error'

interface Message {
  role: 'user' | 'assistant'
  text: string
}

// ── Styles ────────────────────────────────────────────────────────────────────
const C = {
  bgGrad1:   '#2D1F0A',
  bgGrad2:   '#1C1408',
  ring:      'rgba(251,191,36,0.35)',
  text:      '#FEF3C7',
  textDim:   '#A78B4A',
  textErr:   '#FCA5A5',
  bubbleUser:   '#3D2E0A',
  bubbleAsst:   '#2D1F0A',
}

interface Props { onClose?: () => void }

export default function PianoJourney({ onClose }: Props) {
  const [state, setState]       = useState<VoiceState>('idle')
  const [messages, setMessages] = useState<Message[]>([])
  const [elapsed, setElapsed]   = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [debug, setDebug]       = useState<string[]>([])

  const stateRef        = useRef<VoiceState>('idle')
  const pcRef           = useRef<RTCPeerConnection | null>(null)
  const dcRef           = useRef<RTCDataChannel | null>(null)
  const audioElRef      = useRef<HTMLAudioElement | null>(null)
  const streamRef       = useRef<MediaStream | null>(null)
  const pendingUserText = useRef('')
  const pendingAiText   = useRef('')
  const animRef         = useRef(0)

  const log = (msg: string) => { console.log('[PJ]', msg); setDebug(prev => [...prev.slice(-19), msg]) }

  useEffect(() => { stateRef.current = state }, [state])

  // Animation tick
  useEffect(() => {
    if (state !== 'listening' && state !== 'thinking') return
    const tick = () => { setElapsed(p => p + 1); animRef.current = requestAnimationFrame(tick) }
    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [state])

  // Cleanup
  useEffect(() => () => {
    pcRef.current?.close()
    streamRef.current?.getTracks().forEach(t => t.stop())
    if (audioElRef.current) audioElRef.current.srcObject = null
  }, [])

  // ── Connect ──
  const connect = useCallback(async () => {
    if (stateRef.current !== 'idle' && stateRef.current !== 'error') return
    setState('connecting'); setErrorMsg(null); setDebug([])
    log('Bắt đầu kết nối...')

    try {
      // 1. Auth
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setErrorMsg('Vui lòng đăng nhập để sử dụng.'); setState('idle'); return }
      log('Đã đăng nhập: ' + (session.user.email || 'ok'))

      // 2. Create PeerConnection
      const pc = new RTCPeerConnection()
      pcRef.current = pc
      log('PeerConnection created')

      // 3. Audio output
      const audioEl = audioElRef.current || new Audio()
      audioEl.autoplay = true
      audioElRef.current = audioEl
      pc.ontrack = (e) => {
        log('Nhận audio track từ AI')
        audioEl.srcObject = e.streams[0]
      }

      // 4. Microphone
      log('Yêu cầu micro...')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      pc.addTrack(stream.getAudioTracks()[0], stream)
      log('Micro OK')

      // 5. Data channel
      const dc = pc.createDataChannel('oai-events')
      dcRef.current = dc
      log('Data channel created')

      dc.onopen = () => log('Data channel OPEN')

      dc.onmessage = (e) => {
        try {
          const ev = JSON.parse(e.data)
          // Log non-audio events for debugging
          if (!['response.audio.delta', 'input_audio_buffer.speech_started', 'input_audio_buffer.speech_stopped'].includes(ev.type)) {
            log('Event: ' + ev.type)
          }

          switch (ev.type) {
            case 'input_audio_buffer.speech_started':
              setState('listening'); setElapsed(0); pendingUserText.current = ''; break
            case 'input_audio_buffer.speech_stopped':
              setState('thinking'); break
            case 'response.audio.delta':
              if (stateRef.current !== 'speaking') { setState('speaking'); pendingAiText.current = '' }; break
            case 'response.done':
              setState('idle')
              const ut = pendingUserText.current.trim()
              if (ut) setMessages(p => [...p, { role: 'user', text: ut }])
              const at = pendingAiText.current.trim()
              if (at) setMessages(p => [...p, { role: 'assistant', text: at }])
              break
            case 'conversation.item.input_audio_transcription.completed':
              if (ev.transcript) { pendingUserText.current = ev.transcript; log('Nghe: ' + ev.transcript) }; break
            case 'response.audio_transcript.delta':
              if (ev.delta) pendingAiText.current += ev.delta; break
            case 'error':
              log('OpenAI error: ' + JSON.stringify(ev.error)); break
          }
        } catch { /* ignore */ }
      }

      // 6. SDP offer
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      log('SDP offer created')

      // 7. Send to edge function
      const fnUrl = `${SUPABASE_URL}/functions/v1/realtime-token`
      log('Gửi SDP đến edge function...')
      const sdpRes = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      })

      if (!sdpRes.ok) {
        const errText = await sdpRes.text()
        log('Edge function error: ' + sdpRes.status + ' ' + errText.slice(0, 200))
        let errMsg = `Server error (${sdpRes.status})`
        try { const j = JSON.parse(errText); if (j.error) errMsg = j.error } catch {}
        throw new Error(errMsg)
      }

      // 8. Answer SDP
      const answerSdp = await sdpRes.text()
      log('Nhận answer SDP (' + answerSdp.length + ' bytes)')
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })
      log('Kết nối thành công! Hãy nói gì đó...')
      setState('idle')

    } catch (e: any) {
      const msg = e?.message || String(e)
      log('LỖI: ' + msg)
      if (msg.includes('NotAllowed') || msg.includes('Permission')) setErrorMsg('Vui lòng cho phép truy cập micro.')
      else if (msg.includes('NotFound')) setErrorMsg('Không tìm thấy micro.')
      else setErrorMsg(msg)
      setState('error')
      pcRef.current?.close(); pcRef.current = null
      streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null
    }
  }, [])

  useEffect(() => { connect() }, [connect]) // eslint-disable-line

  // ── UI helpers ──
  const BUTTON = 140

  const cfg: Record<VoiceState, { icon: React.ReactNode; label: string; bg: string; shadow: string; scale: number; lc: string }> = {
    idle:       { icon: <MicSVG />, label: 'Chạm để nói', bg: 'linear-gradient(135deg,#F59E0B,#D97706)', shadow: '0 8px 40px rgba(245,158,11,.3)', scale: 1, lc: C.textDim },
    connecting: { icon: <Dots />, label: 'Đang kết nối...', bg: 'linear-gradient(135deg,#6366F1,#4F46E5)', shadow: '0 8px 40px rgba(99,102,241,.35)', scale: 1, lc: C.textDim },
    listening:  { icon: <MicSVG active />, label: 'Đang nghe...', bg: 'linear-gradient(135deg,#F59E0B,#D97706)', shadow: '0 8px 60px rgba(251,191,36,.5),0 0 120px rgba(251,191,36,.2)', scale: 1.05, lc: C.text },
    thinking:   { icon: <Dots />, label: 'Đang nghĩ...', bg: 'linear-gradient(135deg,#6366F1,#4F46E5)', shadow: '0 8px 40px rgba(99,102,241,.35)', scale: 1, lc: C.textDim },
    speaking:   { icon: <Bars />, label: 'Đang nói...', bg: 'linear-gradient(135deg,#16A34A,#15803D)', shadow: '0 8px 40px rgba(22,163,74,.35)', scale: 1, lc: C.textDim },
    error:      { icon: <span style={{fontSize:36}}>🔌</span>, label: errorMsg || 'Lỗi', bg: 'linear-gradient(135deg,#DC2626,#B91C1C)', shadow: '0 8px 40px rgba(220,38,38,.35)', scale: 1, lc: C.textErr },
  }
  const c = cfg[state]

  const rings = (state === 'listening' || state === 'connecting')
    ? [1,2,3].map(i => {
        const p = (elapsed * 0.8 + i * 1.2) % 4
        return { scale: 1 + p * 0.55, opacity: Math.max(0, 0.5 - p * 0.12) }
      })
    : []

  const tap = () => {
    if (state === 'idle' && (!pcRef.current || pcRef.current.connectionState === 'closed' || pcRef.current.connectionState === 'failed')) connect()
    else if (state === 'error') connect()
  }

  return (
    <div style={{ minHeight:'100dvh',background:`linear-gradient(180deg,${C.bgGrad1} 0%,${C.bgGrad2} 100%)`,display:'flex',flexDirection:'column',alignItems:'center',fontFamily:'Inter,system-ui,sans-serif',position:'relative',overflow:'hidden',userSelect:'none' }}>
      {onClose && <button onClick={onClose} style={{ position:'absolute',top:20,right:20,zIndex:10,background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.1)',borderRadius:50,width:44,height:44,fontSize:18,color:C.textDim,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(12px)' }}>✕</button>}

      <div style={{ width:'100%',textAlign:'center',paddingTop:72,paddingBottom:24 }}>
        <div style={{ fontSize:40,marginBottom:4 }}>🎹</div>
        <div style={{ fontSize:20,fontWeight:700,color:C.text,letterSpacing:'-.3px' }}>Piano Journey</div>
      </div>

      {/* Chat bubbles */}
      <div style={{ flex:1,width:'100%',maxWidth:420,overflowY:'auto',padding:'0 20px 20px',display:'flex',flexDirection:'column',gap:12,maskImage:'linear-gradient(to bottom,transparent 0%,black 40px)',WebkitMaskImage:'linear-gradient(to bottom,transparent 0%,black 40px)' }}>
        {messages.map((m,i) => (
          <div key={i} style={{ alignSelf:m.role==='user'?'flex-end':'flex-start',maxWidth:'85%',background:m.role==='user'?C.bubbleUser:C.bubbleAsst,borderRadius:'18px 18px 4px 18px',padding:'14px 18px',border:`1px solid ${m.role==='user'?'rgba(251,191,36,.15)':'rgba(255,255,255,.06)'}` }}>
            <div style={{ fontSize:11,fontWeight:700,color:C.textDim,marginBottom:4,textTransform:'uppercase',letterSpacing:'.5px' }}>{m.role==='user'?'Con':'🎹 Cô Piano'}</div>
            <div style={{ fontSize:15,color:C.text,lineHeight:1.6 }}>{m.text}</div>
          </div>
        ))}
        <div style={{ height:BUTTON+100 }} />
      </div>

      {/* Bottom button */}
      <div style={{ position:'absolute',bottom:0,left:0,right:0,display:'flex',flexDirection:'column',alignItems:'center',paddingBottom:80 }}>
        <div style={{ position:'relative',width:BUTTON*4,height:BUTTON*4,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:8 }}>
          {rings.map((r,i) => <div key={i} style={{ position:'absolute',width:BUTTON,height:BUTTON,borderRadius:'50%',border:`2px solid ${C.ring}`,transform:`scale(${r.scale})`,opacity:r.opacity }} />)}
          <button onClick={tap} disabled={state!=='idle'&&state!=='error'}
            style={{ width:BUTTON,height:BUTTON,borderRadius:'50%',background:c.bg,border:'none',cursor:(state==='idle'||state==='error')?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:c.shadow,transform:`scale(${c.scale})`,transition:'transform .3s ease,box-shadow .5s ease,background .5s ease',position:'relative',zIndex:2,outline:'none' }}>
            {c.icon}
          </button>
        </div>
        <div style={{ fontSize:15,fontWeight:600,color:c.lc,transition:'color .5s ease',textAlign:'center',maxWidth:320,lineHeight:1.4 }}>
          {state==='error' ? <><div>{c.label}</div><div style={{fontSize:13,marginTop:4,opacity:.8}}>Chạm để thử lại</div></> : c.label}
        </div>
      </div>

      {/* Debug panel */}
      {debug.length > 0 && (
        <div style={{ position:'absolute',bottom:0,left:0,right:0,background:'rgba(0,0,0,.85)',padding:'8px 12px',maxHeight:120,overflowY:'auto',fontSize:10,fontFamily:'monospace',color:'#10B981',zIndex:5 }}>
          {debug.map((d,i) => <div key={i}>{d}</div>)}
        </div>
      )}

      <div style={{ position:'absolute',top:'12%',left:-20,fontSize:64,opacity:.04,pointerEvents:'none' }}>🎵</div>
      <div style={{ position:'absolute',top:'30%',right:-16,fontSize:56,opacity:.04,pointerEvents:'none' }}>🎶</div>
    </div>
  )
}

// ── Icons ──
function MicSVG({ active }: { active?: boolean }) {
  return <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{opacity:active?1:.85}}>
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
}
function Dots() {
  return <div style={{display:'flex',gap:6}}>
    {[0,1,2].map(i=><div key={i} style={{width:8,height:8,borderRadius:'50%',background:'#fff',animation:`pj-bounce 1.2s ${i*.15}s infinite ease-in-out`}}/>)}
    <style>{`@keyframes pj-bounce{0%,80%,100%{transform:scale(.5);opacity:.4}40%{transform:scale(1);opacity:1}}`}</style>
  </div>
}
function Bars() {
  return <div style={{display:'flex',gap:3,alignItems:'flex-end',height:30}}>
    {[0,1,2,3,4,5,6].map((_,i)=><div key={i} style={{width:4,borderRadius:2,background:'#fff',animation:`pj-wave .8s ${i*.09}s infinite ease-in-out`}}/>)}
    <style>{`@keyframes pj-wave{0%,100%{height:6px;opacity:.4}50%{height:28px;opacity:1}}`}</style>
  </div>
}
