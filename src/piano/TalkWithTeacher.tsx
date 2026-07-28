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
import { LEVELS, getLevel, currentLevelId, setLevelId } from './rules'

type TalkState = 'idle' | 'connecting' | 'ready' | 'listening' | 'thinking' | 'speaking' | 'error'

interface Message { role: 'user' | 'assistant'; text: string }

const C = {
  bg1: '#2D1F0A', bg2: '#1C1408',
  ring: 'rgba(251,191,36,0.35)',
  text: '#FEF3C7', dim: '#A78B4A', err: '#FCA5A5',
  bubbleUser: '#3D2E0A', bubbleAsst: '#2D1F0A',
}

// Nút mic co theo bề ngang máy: iPhone SE (375px) ra ~127px, máy lớn giữ 140px.
const BTN = 'min(140px, 34vw)'
// Vùng an toàn iPhone (tai thỏ + vạch home). Không có thì tự về 0px.
const SAFE_TOP    = 'env(safe-area-inset-top, 0px)'
const SAFE_BOTTOM = 'env(safe-area-inset-bottom, 0px)'

const GOLD   = 'linear-gradient(135deg,#F59E0B,#D97706)'
const INDIGO = 'linear-gradient(135deg,#6366F1,#4F46E5)'
const GREEN  = 'linear-gradient(135deg,#16A34A,#15803D)'
const RED    = 'linear-gradient(135deg,#DC2626,#B91C1C)'

// ── Công cụ Cô Piano được phép gọi ───────────────────────────────────────────
// Khai báo TỪ CLIENT qua `session.update` chứ KHÔNG sửa edge function:
// file realtime-token trong repo để key là '***', bản deploy mới có key thật
// ⇒ deploy lại file đó là phá hỏng hội thoại. Đừng đụng vào nó.
const TOOL_TAO_BAI = {
  type: 'function',
  name: 'tao_bai_tap',
  description:
    'Tạo một bài tập piano ngắn cho bé. GỌI NGAY khi bé nói bé muốn tập/chơi/học bài gì, ' +
    'muốn bài về một con vật, đồ vật, câu chuyện hay cảm xúc nào đó. Đừng hỏi lại nhiều lần.',
  parameters: {
    type: 'object',
    properties: {
      chu_de: {
        type: 'string',
        description: 'Điều bé muốn, ghi bằng tiếng Việt theo đúng lời bé. Ví dụ: "bài về con khủng long".',
      },
    },
    required: ['chu_de'],
  },
}

const INSTRUCTIONS =
  'Bạn là Cô Piano, cô giáo dạy piano thân thiện cho trẻ 5–12 tuổi. Luôn nói tiếng Việt, ' +
  'ấm áp, ngắn gọn, tối đa 2 câu, không giảng giải dài. ' +
  'Nhiệm vụ chính: hỏi bé hôm nay muốn tập bài gì, rồi GỌI công cụ tao_bai_tap với điều bé nói. ' +
  'Ngay sau khi gọi công cụ, nói một câu vui để bé chờ, ví dụ "Cô soạn bài cho con ngay đây!". ' +
  'Nếu bé nói lan man, nhẹ nhàng hỏi lại bé muốn bài về cái gì.'

interface Props {
  onClose?: () => void
  /** Bé đã nói xong → tạo bài tập với chủ đề này */
  onCreateMission?: (chuDe: string) => void
  /** Đang soạn bài — giữ màn hội thoại để bé còn nghe cô nói */
  busy?: boolean
}

export default function TalkWithTeacher({ onClose, onCreateMission, busy }: Props) {
  const [state, setState]       = useState<TalkState>('idle')
  const [messages, setMessages] = useState<Message[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [debug, setDebug]       = useState<string[]>([])
  // TẠM cho giai đoạn thí nghiệm: đổi bậc ngay trên máy. Khi có dữ liệu học viên
  // thật thì bỏ chip này đi, bậc lấy từ hồ sơ do thầy đặt ở /admin.
  const [levelId, setLvl]       = useState(currentLevelId)
  const level = getLevel(levelId)
  const cycleLevel = () => {
    const next = LEVELS[(LEVELS.findIndex(l => l.id === levelId) + 1) % LEVELS.length].id
    setLevelId(next); setLvl(next)
  }

  const stateRef  = useRef<TalkState>('idle')
  const pcRef     = useRef<RTCPeerConnection | null>(null)
  const dcRef     = useRef<RTCDataChannel | null>(null)
  const audioRef  = useRef<HTMLAudioElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const userText  = useRef('')
  const aiText    = useRef('')
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const doneCalls = useRef<Set<string>>(new Set())   // chống gọi tạo bài 2 lần
  const createRef = useRef(onCreateMission)

  useEffect(() => { createRef.current = onCreateMission }, [onCreateMission])

  /** Gửi sự kiện lên OpenAI qua data channel */
  const send = useCallback((obj: unknown) => {
    const dc = dcRef.current
    if (dc?.readyState === 'open') dc.send(JSON.stringify(obj))
  }, [])

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

  // ── Cô Piano gọi công cụ tạo bài tập ──
  const runToolCall = useCallback((callId: string, argsRaw: string) => {
    if (!callId || doneCalls.current.has(callId)) return
    doneCalls.current.add(callId)

    let chuDe = ''
    try { chuDe = String(JSON.parse(argsRaw || '{}')?.chu_de || '').trim() } catch { /* */ }
    log('Cô gọi tạo bài: ' + (chuDe || '(trống)'))

    // Báo lại cho model để cô nói câu chờ — bé nghe cô nói trong lúc đang soạn bài
    send({
      type: 'conversation.item.create',
      item: { type: 'function_call_output', call_id: callId, output: JSON.stringify({ ok: true, chu_de: chuDe }) },
    })
    send({ type: 'response.create' })

    if (chuDe) createRef.current?.(chuDe)
  }, [log, send])

  // ── Sự kiện từ OpenAI Realtime ──
  const handleEvent = useCallback((raw: string) => {
    let ev: {
      type?: string; transcript?: string; delta?: string; error?: unknown
      call_id?: string; name?: string; arguments?: string
      item?: { type?: string; name?: string; call_id?: string; arguments?: string }
    }
    try { ev = JSON.parse(raw) } catch { return }

    // Function call — API bắn 1 trong 2 dạng tuỳ phiên bản, đỡ cả hai
    if (ev.type === 'response.function_call_arguments.done' && ev.name === 'tao_bai_tap') {
      runToolCall(ev.call_id || '', ev.arguments || '')
      return
    }
    if (ev.type === 'response.output_item.done' && ev.item?.type === 'function_call' && ev.item?.name === 'tao_bai_tap') {
      runToolCall(ev.item.call_id || '', ev.item.arguments || '')
      return
    }

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
  }, [go, cur, log, runToolCall])

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
      dc.onopen = () => {
        log('Kênh sự kiện mở')
        // Nạp công cụ + lời dặn từ client. Làm ở đây để KHÔNG phải deploy lại
        // realtime-token (file repo có key '***', deploy đè là hỏng hội thoại).
        send({
          type: 'session.update',
          session: { type: 'realtime', instructions: INSTRUCTIONS, tools: [TOOL_TAO_BAI], tool_choice: 'auto' },
        })
        log('Đã nạp công cụ tao_bai_tap')
      }
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
  }, [go, cur, log, send, teardown, handleEvent])

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

  const hasChat = messages.length > 0

  return (
    <div style={{ height:'100dvh',width:'100%',background:`linear-gradient(180deg,${C.bg1} 0%,${C.bg2} 100%)`,display:'flex',flexDirection:'column',alignItems:'center',fontFamily:'Inter,system-ui,sans-serif',position:'relative',overflow:'hidden',userSelect:'none',WebkitTapHighlightColor:'transparent',overscrollBehavior:'contain' }}>
      <style>{KEYFRAMES}</style>

      {/* ✕ phải tránh status bar / tai thỏ — bản cũ để top:20 nên vẽ chồng lên chỗ pin */}
      {onClose && (
        <button onClick={onClose} aria-label="Đóng"
          style={{ position:'absolute',top:`calc(${SAFE_TOP} + 10px)`,right:14,zIndex:10,background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.12)',borderRadius:50,width:40,height:40,fontSize:17,color:C.dim,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(12px)',touchAction:'manipulation' }}>
          ✕
        </button>
      )}

      {/* Header — gọn lại khi đã có hội thoại để nhường chỗ cho bong bóng chat */}
      <div style={{ width:'100%',textAlign:'center',paddingTop:`calc(${SAFE_TOP} + ${hasChat ? 14 : 22}px)`,paddingBottom:hasChat ? 8 : 14,flexShrink:0,transition:'padding .3s ease' }}>
        <div style={{ fontSize:hasChat ? 24 : 34,lineHeight:1.1,marginBottom:2,transition:'font-size .3s ease' }}>🎹</div>
        <div style={{ fontSize:hasChat ? 16 : 19,fontWeight:700,color:C.text,letterSpacing:'-.3px' }}>Cô Piano</div>
      </div>

      {/* Hội thoại — chưa có tin thì căn giữa lời mời, đỡ khoảng trống hoác */}
      <div ref={scrollRef}
        style={{ flex:1,width:'100%',maxWidth:480,minHeight:0,overflowY:'auto',WebkitOverflowScrolling:'touch',padding:'0 16px 8px',display:'flex',flexDirection:'column',justifyContent:hasChat ? 'flex-start' : 'center',gap:10 }}>
        {!hasChat && state !== 'error' && (
          <div style={{ textAlign:'center',color:C.dim,fontSize:15,lineHeight:1.6,padding:'0 24px' }}>
            Con kể cho cô nghe hôm nay con muốn tập gì nhé
          </div>
        )}
        {messages.map((m, i) => (
          // textAlign:'left' là BẮT BUỘC — #root trong index.css đặt text-align:center
          // cho cả app, không sửa global được nên phải chặn tại bong bóng.
          <div key={i} style={{ alignSelf:m.role==='user'?'flex-end':'flex-start',maxWidth:'88%',background:m.role==='user'?C.bubbleUser:C.bubbleAsst,borderRadius:m.role==='user'?'18px 18px 4px 18px':'18px 18px 18px 4px',padding:'12px 15px',border:`1px solid ${m.role==='user'?'rgba(251,191,36,.15)':'rgba(255,255,255,.06)'}`,overflowWrap:'break-word',textAlign:'left',flexShrink:0 }}>
            <div style={{ fontSize:10,fontWeight:700,color:C.dim,marginBottom:3,textTransform:'uppercase',letterSpacing:'.5px' }}>{m.role==='user'?'Con':'🎹 Cô Piano'}</div>
            <div style={{ fontSize:15,color:C.text,lineHeight:1.55 }}>{m.text}</div>
          </div>
        ))}

        {busy && (
          <div style={{ alignSelf:'center',display:'flex',alignItems:'center',gap:8,color:C.text,fontSize:14,fontWeight:600,background:'rgba(251,191,36,.1)',border:'1px solid rgba(251,191,36,.2)',borderRadius:999,padding:'9px 16px',marginTop:4 }}>
            <span style={{ fontSize:17,animation:'pj-pulse 2s ease-in-out infinite' }}>✨</span>
            Cô đang soạn bài cho con…
          </div>
        )}
      </div>

      {/* Nút mic — chừa chỗ cho vạch home iPhone. Có lớp gradient để bong bóng chat
          mờ dần vào nền, tránh vòng sóng mic chồng lộn xộn lên tin nhắn. */}
      <div style={{ flexShrink:0,width:'100%',display:'flex',flexDirection:'column',alignItems:'center',paddingBottom:`calc(${SAFE_BOTTOM} + 18px)`,paddingTop:14,background:`linear-gradient(180deg,rgba(28,20,8,0) 0%,${C.bg2} 38%)`,zIndex:3 }}>
        <div style={{ position:'relative',width:BTN,height:BTN,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:10 }}>
          {showRings && [0,1,2].map(i => (
            <div key={i} style={{ position:'absolute',width:BTN,height:BTN,borderRadius:'50%',border:`2px solid ${C.ring}`,animation:`pj-ring 2.4s ${i*0.8}s ease-out infinite`,pointerEvents:'none' }} />
          ))}
          <button onClick={() => { if (canTap) void connect() }} disabled={!canTap} aria-label={f.label}
            style={{ width:BTN,height:BTN,borderRadius:'50%',background:f.bg,border:'none',cursor:canTap?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:f.shadow,transform:`scale(${f.scale})`,transition:'transform .3s ease,box-shadow .5s ease,background .5s ease',position:'relative',zIndex:2,outline:'none',WebkitTapHighlightColor:'transparent',touchAction:'manipulation',flexShrink:0 }}>
            {f.icon}
          </button>
        </div>
        <div style={{ fontSize:15,fontWeight:600,color:f.lc,textAlign:'center',maxWidth:330,lineHeight:1.4,minHeight:21,padding:'0 24px' }}>
          {f.label}
          {state === 'error' && <div style={{ fontSize:13,marginTop:4,opacity:.8 }}>Chạm để thử lại</div>}
        </div>

        {/* TẠM — chip đổi bậc để thí nghiệm luồng. Bỏ khi bậc lấy từ hồ sơ học viên. */}
        <button onClick={cycleLevel}
          style={{ marginTop:12,background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',borderRadius:999,padding:'6px 14px',fontSize:12,fontWeight:600,color:C.dim,cursor:'pointer',fontFamily:'inherit',touchAction:'manipulation' }}>
          Bậc {level.id} · {level.name} ⟳
        </button>
      </div>

      {/* Bảng chẩn đoán — là flex item, KHÔNG absolute, để không che nút mic */}
      {debug.length > 0 && (
        <details style={{ flexShrink:0,width:'100%',background:'rgba(0,0,0,.85)',fontSize:10,fontFamily:'monospace',color:'#10B981',paddingBottom:SAFE_BOTTOM }}>
          <summary style={{ padding:'5px 14px',cursor:'pointer',color:C.dim,fontSize:11,touchAction:'manipulation' }}>Chi tiết kết nối</summary>
          <div style={{ padding:'0 14px 8px',maxHeight:110,overflowY:'auto',WebkitOverflowScrolling:'touch' }}>
            {debug.map((d, i) => <div key={i}>{d}</div>)}
          </div>
        </details>
      )}

      <div style={{ position:'absolute',top:'14%',left:-24,fontSize:60,opacity:.04,pointerEvents:'none' }}>🎵</div>
      <div style={{ position:'absolute',top:'32%',right:-18,fontSize:52,opacity:.04,pointerEvents:'none' }}>🎶</div>
    </div>
  )
}

// Vòng sóng chạy bằng CSS — không re-render React mỗi frame như bản cũ
const KEYFRAMES = `
@keyframes pj-ring{0%{transform:scale(1);opacity:.4}100%{transform:scale(1.6);opacity:0}}
@keyframes pj-bounce{0%,80%,100%{transform:scale(.5);opacity:.4}40%{transform:scale(1);opacity:1}}
@keyframes pj-wave{0%,100%{height:6px;opacity:.4}50%{height:28px;opacity:1}}
@keyframes pj-pulse{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.15)}}
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
