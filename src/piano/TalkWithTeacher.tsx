// ── Trò chuyện 2 chiều với Cô Piano — OpenAI Realtime API qua WebRTC ──────────
//
// PHỤC HỒI từ commit 1076ed5 (27/07). Bản này ĐÃ CHẠY MƯỢT rồi bị commit 0406b72
// thay bằng SpeechRecognition — đó là lý do mic "không trò chuyện được".
//
// ĐỪNG thay bằng Web Speech API: trong WKWebView (app iOS) `webkitSpeechRecognition`
// có mặt nhưng chết. WebRTC + getUserMedia thì chạy thật trong WKWebView.
//
// Giao thức: gửi SDP offer dạng JSON tới edge function `realtime-token`, function
// proxy sang OpenAI /v1/realtime/calls rồi trả về answer SDP. Gửi JSON (KHÔNG gửi
// raw text) để tránh lỗi ByteString header — xem commit bcfb8dd.

import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase, SUPABASE_URL } from '../supabase'

type TalkState = 'idle' | 'connecting' | 'ready' | 'listening' | 'thinking' | 'speaking' | 'error'

interface Message { role: 'user' | 'assistant'; text: string }

const C = {
  bg1: '#2D1F0A', bg2: '#1C1408',
  ring: 'rgba(251,191,36,0.35)',
  text: '#FEF3C7', dim: '#A78B4A', err: '#FCA5A5',
  bubbleUser: '#3D2E0A', bubbleAsst: '#2D1F0A',
}

const BUTTON = 140
const GOLD   = 'linear-gradient(135deg,#F59E0B,#D97706)'
const INDIGO = 'linear-gradient(135deg,#6366F1,#4F46E5)'
const GREEN  = 'linear-gradient(135deg,#16A34A,#15803D)'
const RED    = 'linear-gradient(135deg,#DC2626,#B91C1C)'

interface Props {
  onClose?: () => void
  /** Mở màn tạo bài tập (LearningFlow) */
  onOpenMission?: () => void
}

export default function TalkWithTeacher({ onClose, onOpenMission }: Props) {
  const [state, setState]       = useState<TalkState>('idle')
  const [messages, setMessages] = useState<Message[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [debug, setDebug]       = useState<string[]>([])

  const stateRef  = useRef<TalkState>('idle')
  const pcRef     = useRef<RTCPeerConnection | null>(null)
  const dcRef     = useRef<RTCDataChannel | null>(null)
  const audioRef  = useRef<HTMLAudioElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const userText  = useRef('')
  const aiText    = useRef('')
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const go = useCallback((s: TalkState) => { stateRef.current = s; setState(s) }, [])
  const cur = useCallback((): TalkState => stateRef.current, [])

  const log = useCallback((m: string) => {
    setDebug(prev => [...prev.slice(-19), m])
  }, [])

  // Cuộn xuống tin mới
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const teardown = useCallback(() => {
    try { dcRef.current?.close() } catch { /* */ }
    try { pcRef.current?.close() } catch { /* */ }
    dcRef.current = null; pcRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null
    if (audioRef.current) audioRef.current.srcObject = null
  }, [])

  // Rời màn hình → ngắt kết nối, nhả micro
  useEffect(() => () => teardown(), [teardown])

  // ── Sự kiện từ OpenAI Realtime ──
  const handleEvent = useCallback((raw: string) => {
    let ev: { type?: string; transcript?: string; delta?: string; error?: unknown }
    try { ev = JSON.parse(raw) } catch { return }

    switch (ev.type) {
      case 'input_audio_buffer.speech_started':
        go('listening'); userText.current = ''
        break
      case 'input_audio_buffer.speech_stopped':
        go('thinking')
        break
      case 'response.audio.delta':
        if (cur() !== 'speaking') { go('speaking'); aiText.current = '' }
        break
      case 'response.done': {
        go('ready')
        const ut = userText.current.trim()
        const at = aiText.current.trim()
        setMessages(p => [
          ...p,
          ...(ut ? [{ role: 'user' as const, text: ut }] : []),
          ...(at ? [{ role: 'assistant' as const, text: at }] : []),
        ])
        userText.current = ''; aiText.current = ''
        break
      }
      case 'conversation.item.input_audio_transcription.completed':
        if (ev.transcript) { userText.current = ev.transcript; log('Nghe: ' + ev.transcript) }
        break
      case 'response.audio_transcript.delta':
        if (ev.delta) aiText.current += ev.delta
        break
      case 'error':
        log('OpenAI lỗi: ' + JSON.stringify(ev.error))
        break
      default:
        break
    }
  }, [go, cur, log])

  // ── Kết nối ──
  // Gọi TỪ CÚ CHẠM của trẻ: iOS cần user gesture để mở micro và phát tiếng AI.
  const connect = useCallback(async () => {
    if (cur() !== 'idle' && cur() !== 'error') return
    go('connecting'); setErrorMsg(''); setDebug([])
    log('Bắt đầu kết nối…')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setErrorMsg('Con cần đăng nhập để trò chuyện với Cô Piano nhé.')
        go('error'); return
      }
      log('Đã đăng nhập')

      const pc = new RTCPeerConnection()
      pcRef.current = pc

      // Tiếng AI → loa. Tạo & cấu hình xong mới cất vào ref.
      let audioEl = audioRef.current
      if (!audioEl) {
        const el = new Audio()
        el.autoplay = true
        audioRef.current = el
        audioEl = el
      }
      const out = audioEl
      pc.ontrack = e => { log('Nhận tiếng Cô Piano'); out.srcObject = e.streams[0] }

      // Micro → AI
      log('Xin quyền micro…')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      pc.addTrack(stream.getAudioTracks()[0], stream)
      log('Micro OK')

      const dc = pc.createDataChannel('oai-events')
      dcRef.current = dc
      dc.onopen = () => log('Kênh sự kiện mở')
      dc.onmessage = e => handleEvent(e.data)

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      log('Đã tạo SDP offer')

      // Gửi SDP dạng JSON — raw text gây lỗi ByteString header (bcfb8dd)
      const res = await fetch(`${SUPABASE_URL}/functions/v1/realtime-token`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sdp: offer.sdp }),
      })
      if (!res.ok) {
        const txt = await res.text()
        log(`Edge function lỗi ${res.status}: ${txt.slice(0, 200)}`)
        let msg = `Server lỗi (${res.status})`
        try { const j = JSON.parse(txt); if (j.error) msg = j.error } catch { /* */ }
        throw new Error(msg)
      }

      const data = await res.json()
      if (!data?.sdp) throw new Error('Không nhận được SDP từ server')
      log(`Nhận answer SDP (${data.sdp.length} bytes)`)
      await pc.setRemoteDescription({ type: 'answer', sdp: data.sdp })

      log('Kết nối xong — con nói đi!')
      go('ready')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      log('LỖI: ' + msg)
      setErrorMsg(
        /NotAllowed|Permission/i.test(msg) ? 'Con chưa cho phép dùng micro. Bấm cho phép rồi thử lại nhé.'
        : /NotFound/i.test(msg)            ? 'Không tìm thấy micro trên máy.'
        : msg
      )
      go('error')
      teardown()
    }
  }, [go, cur, log, teardown, handleEvent])

  // ── Mặt nút theo trạng thái ──
  const face: Record<TalkState, { icon: React.ReactNode; label: string; bg: string; shadow: string; scale: number; lc: string }> = {
    idle:       { icon: <MicIcon />,            label: 'Chạm để nói với Cô Piano', bg: GOLD,   shadow: '0 8px 40px rgba(245,158,11,.3)',                                  scale: 1,    lc: C.dim  },
    connecting: { icon: <Dots />,               label: 'Đang kết nối…',            bg: INDIGO, shadow: '0 8px 40px rgba(99,102,241,.35)',                                 scale: 1,    lc: C.dim  },
    ready:      { icon: <MicIcon active />,     label: 'Cô đang nghe — con nói đi', bg: GOLD,  shadow: '0 8px 60px rgba(251,191,36,.4)',                                  scale: 1.02, lc: C.text },
    listening:  { icon: <MicIcon active />,     label: 'Đang nghe con…',           bg: GOLD,   shadow: '0 8px 60px rgba(251,191,36,.5),0 0 120px rgba(251,191,36,.2)',   scale: 1.05, lc: C.text },
    thinking:   { icon: <Dots />,               label: 'Cô đang nghĩ…',            bg: INDIGO, shadow: '0 8px 40px rgba(99,102,241,.35)',                                 scale: 1,    lc: C.dim  },
    speaking:   { icon: <Bars />,               label: 'Cô đang nói…',             bg: GREEN,  shadow: '0 8px 40px rgba(22,163,74,.35)',                                  scale: 1,    lc: C.dim  },
    error:      { icon: <span style={{ fontSize: 36 }}>🔌</span>, label: errorMsg || 'Lỗi kết nối', bg: RED, shadow: '0 8px 40px rgba(220,38,38,.35)',                    scale: 1,    lc: C.err  },
  }
  const f = face[state]

  const canTap = state === 'idle' || state === 'error'
  const showRings = state === 'listening' || state === 'connecting' || state === 'ready'

  return (
    <div style={{ height:'100dvh',background:`linear-gradient(180deg,${C.bg1} 0%,${C.bg2} 100%)`,display:'flex',flexDirection:'column',alignItems:'center',fontFamily:'Inter,system-ui,sans-serif',position:'relative',overflow:'hidden',userSelect:'none' }}>
      <style>{KEYFRAMES}</style>

      {onClose && <button onClick={onClose} style={{ position:'absolute',top:20,right:20,zIndex:10,background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.1)',borderRadius:50,width:44,height:44,fontSize:18,color:C.dim,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(12px)' }}>✕</button>}

      <div style={{ width:'100%',textAlign:'center',paddingTop:56,paddingBottom:16,flexShrink:0 }}>
        <div style={{ fontSize:36,marginBottom:4 }}>🎹</div>
        <div style={{ fontSize:20,fontWeight:700,color:C.text,letterSpacing:'-.3px' }}>Cô Piano</div>
      </div>

      {/* Hội thoại */}
      <div ref={scrollRef} style={{ flex:1,width:'100%',maxWidth:420,overflowY:'auto',padding:'0 20px 12px',display:'flex',flexDirection:'column',gap:12 }}>
        {messages.length === 0 && state !== 'error' && (
          <div style={{ textAlign:'center',color:C.dim,fontSize:14,lineHeight:1.6,padding:'12px 20px' }}>
            Con kể cho cô nghe hôm nay con muốn tập gì nhé
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf:m.role==='user'?'flex-end':'flex-start',maxWidth:'85%',background:m.role==='user'?C.bubbleUser:C.bubbleAsst,borderRadius:m.role==='user'?'18px 18px 4px 18px':'18px 18px 18px 4px',padding:'14px 18px',border:`1px solid ${m.role==='user'?'rgba(251,191,36,.15)':'rgba(255,255,255,.06)'}` }}>
            <div style={{ fontSize:11,fontWeight:700,color:C.dim,marginBottom:4,textTransform:'uppercase',letterSpacing:'.5px' }}>{m.role==='user'?'Con':'🎹 Cô Piano'}</div>
            <div style={{ fontSize:15,color:C.text,lineHeight:1.6 }}>{m.text}</div>
          </div>
        ))}
      </div>

      {/* Nút mic */}
      <div style={{ flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',paddingBottom:24 }}>
        <div style={{ position:'relative',width:BUTTON,height:BUTTON,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:10 }}>
          {showRings && [0,1,2].map(i => (
            <div key={i} style={{ position:'absolute',width:BUTTON,height:BUTTON,borderRadius:'50%',border:`2px solid ${C.ring}`,animation:`pj-ring 2.4s ${i*0.8}s ease-out infinite`,pointerEvents:'none' }} />
          ))}
          <button onClick={() => { if (canTap) void connect() }} disabled={!canTap}
            style={{ width:BUTTON,height:BUTTON,borderRadius:'50%',background:f.bg,border:'none',cursor:canTap?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:f.shadow,transform:`scale(${f.scale})`,transition:'transform .3s ease,box-shadow .5s ease,background .5s ease',position:'relative',zIndex:2,outline:'none',WebkitTapHighlightColor:'transparent' }}>
            {f.icon}
          </button>
        </div>
        <div style={{ fontSize:15,fontWeight:600,color:f.lc,textAlign:'center',maxWidth:320,lineHeight:1.4,minHeight:21,padding:'0 20px' }}>
          {f.label}
          {state === 'error' && <div style={{ fontSize:13,marginTop:4,opacity:.8 }}>Chạm để thử lại</div>}
        </div>

        {onOpenMission && (
          <button onClick={onOpenMission}
            style={{ marginTop:14,background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.1)',borderRadius:999,padding:'9px 18px',fontSize:14,fontWeight:600,color:C.dim,cursor:'pointer',fontFamily:'inherit' }}>
            🎼 Tập bài tập
          </button>
        )}
      </div>

      {/* Bảng chẩn đoán — giữ lại để soi lỗi trên máy thật */}
      {debug.length > 0 && (
        <details style={{ position:'absolute',bottom:0,left:0,right:0,background:'rgba(0,0,0,.85)',zIndex:5,fontSize:10,fontFamily:'monospace',color:'#10B981' }}>
          <summary style={{ padding:'6px 12px',cursor:'pointer',color:C.dim,fontSize:11 }}>Chi tiết kết nối</summary>
          <div style={{ padding:'0 12px 8px',maxHeight:120,overflowY:'auto' }}>
            {debug.map((d, i) => <div key={i}>{d}</div>)}
          </div>
        </details>
      )}

      <div style={{ position:'absolute',top:'12%',left:-20,fontSize:64,opacity:.04,pointerEvents:'none' }}>🎵</div>
      <div style={{ position:'absolute',top:'30%',right:-16,fontSize:56,opacity:.04,pointerEvents:'none' }}>🎶</div>
    </div>
  )
}

// Vòng sóng chạy bằng CSS — không re-render React mỗi frame như bản cũ
const KEYFRAMES = `
@keyframes pj-ring{0%{transform:scale(1);opacity:.45}100%{transform:scale(2.1);opacity:0}}
@keyframes pj-bounce{0%,80%,100%{transform:scale(.5);opacity:.4}40%{transform:scale(1);opacity:1}}
@keyframes pj-wave{0%,100%{height:6px;opacity:.4}50%{height:28px;opacity:1}}
`

function MicIcon({ active }: { active?: boolean }) {
  return <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: active ? 1 : .85 }}>
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
  </svg>
}
function Dots() {
  return <div style={{ display:'flex',gap:6 }}>
    {[0,1,2].map(i => <div key={i} style={{ width:8,height:8,borderRadius:'50%',background:'#fff',animation:`pj-bounce 1.2s ${i*.15}s infinite ease-in-out` }} />)}
  </div>
}
function Bars() {
  return <div style={{ display:'flex',gap:3,alignItems:'flex-end',height:30 }}>
    {[0,1,2,3,4,5,6].map((_, i) => <div key={i} style={{ width:4,borderRadius:2,background:'#fff',animation:`pj-wave .8s ${i*.09}s infinite ease-in-out` }} />)}
  </div>
}
