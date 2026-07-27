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
  ringOuter: 'rgba(251,191,36,0.10)',
  text:      '#FEF3C7',
  textDim:   '#A78B4A',
  textErr:   '#FCA5A5',
  bubbleUser:   '#3D2E0A',
  bubbleAsst:   '#2D1F0A',
}

interface Props {
  onClose?: () => void
}

export default function PianoJourney({ onClose }: Props) {
  const [state, setState]       = useState<VoiceState>('idle')
  const [messages, setMessages] = useState<Message[]>([])
  const [elapsed, setElapsed]   = useState(0)
  const [error, setError]       = useState<string | null>(null)

  const stateRef        = useRef<VoiceState>('idle')
  const pcRef           = useRef<RTCPeerConnection | null>(null)
  const dcRef           = useRef<RTCDataChannel | null>(null)
  const audioElRef      = useRef<HTMLAudioElement | null>(null)
  const streamRef       = useRef<MediaStream | null>(null)
  const pendingUserText = useRef<string>('')
  const pendingAiText   = useRef<string>('')
  const animFrameRef    = useRef<number>(0)

  // Keep ref in sync
  useEffect(() => { stateRef.current = state }, [state])

  // ── Animation tick ──
  useEffect(() => {
    if (state !== 'listening' && state !== 'thinking') return
    const tick = () => { setElapsed(prev => prev + 1); animFrameRef.current = requestAnimationFrame(tick) }
    animFrameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [state])

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      pcRef.current?.close()
      streamRef.current?.getTracks().forEach(t => t.stop())
      if (audioElRef.current) audioElRef.current.srcObject = null
    }
  }, [])

  // ── Connect to OpenAI Realtime ──
  const connect = useCallback(async () => {
    if (stateRef.current !== 'idle') return
    setState('connecting')
    setError(null)
    try {
      // 1. Get ephemeral token from Supabase Edge Function
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Vui lòng đăng nhập để sử dụng.'); setState('idle'); return }

      const fnUrl = `${SUPABASE_URL}/functions/v1/realtime-token`
      const tokenRes = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      })
      if (!tokenRes.ok) {
        const errData = await tokenRes.json().catch(() => ({}))
        setError(errData.error || `Server error (${tokenRes.status})`); setState('idle'); return
      }
      const { token } = await tokenRes.json()
      if (!token) { setError('Không lấy được token kết nối.'); setState('idle'); return }

      // 2. Create RTCPeerConnection
      const pc = new RTCPeerConnection()
      pcRef.current = pc

      // 3. Handle remote audio track (AI → speaker)
      const audioEl = audioElRef.current || new Audio()
      audioEl.autoplay = true
      audioElRef.current = audioEl
      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0]
      }

      // 4. Get microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      pc.addTrack(stream.getAudioTracks()[0], stream)

      // 5. Create data channel for events
      const dc = pc.createDataChannel('oai-events')
      dcRef.current = dc

      dc.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data)

          switch (event.type) {
            // User started speaking
            case 'input_audio_buffer.speech_started':
              setState('listening')
              setElapsed(0)
              pendingUserText.current = ''
              break

            // User stopped speaking → AI is thinking
            case 'input_audio_buffer.speech_stopped':
              setState('thinking')
              break

            // AI audio response started
            case 'response.audio.delta':
              if (stateRef.current !== 'speaking') {
                setState('speaking')
                pendingAiText.current = ''
              }
              break

            // AI response complete
            case 'response.done':
              setState('idle')
              const userText = pendingUserText.current.trim()
              if (userText) {
                setMessages(prev => [...prev, { role: 'user', text: userText }])
              }
              const aiText = pendingAiText.current.trim()
              if (aiText) {
                setMessages(prev => [...prev, { role: 'assistant', text: aiText }])
              }
              break

            // User speech transcript
            case 'conversation.item.input_audio_transcription.completed':
              if (event.transcript) {
                pendingUserText.current = event.transcript
              }
              break

            // AI speech transcript (streaming)
            case 'response.audio_transcript.delta':
              if (event.delta) {
                pendingAiText.current += event.delta
              }
              break

            // Error from OpenAI
            case 'error':
              console.error('OpenAI Realtime error:', event.error)
              setError(event.error?.message || 'Lỗi kết nối AI')
              break
          }
        } catch {
          // ignore parse errors
        }
      }

      // 6. Create SDP offer
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // 7. Send offer to OpenAI WebRTC endpoint
      const sdpRes = await fetch('https://api.openai.com/v1/realtime', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      })

      if (!sdpRes.ok) {
        const errText = await sdpRes.text()
        console.error('OpenAI WebRTC SDP error:', sdpRes.status, errText)
        throw new Error(`OpenAI SDP: ${sdpRes.status}`)
      }

      // 8. Set remote description
      const answerSdp = await sdpRes.text()
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })

      // Connected — ready for voice
      setState('idle')
    } catch (e: any) {
      console.error('Piano Journey connect error:', e)
      const msg = e?.message || String(e)
      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        setError('Vui lòng cho phép truy cập micro để trò chuyện.')
      } else if (msg.includes('NotFoundError')) {
        setError('Không tìm thấy micro. Hãy cắm micro và thử lại.')
      } else {
        setError(msg)
      }
      setState('error')
      pcRef.current?.close(); pcRef.current = null
      streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null
    }
  }, [])

  // ── Auto-connect on mount ──
  useEffect(() => {
    connect()
  }, [connect]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Button size ──
  const BUTTON = 140

  // ── State config ──
  const stateConfig: Record<VoiceState, { icon: React.ReactNode; label: string; bg: string; shadow: string; scale: number; labelColor: string }> = {
    idle: {
      icon: <MicIcon />, label: 'Chạm để nói',
      bg: 'linear-gradient(135deg, #F59E0B, #D97706)',
      shadow: '0 8px 40px rgba(245,158,11,0.3)',
      scale: 1, labelColor: C.textDim,
    },
    connecting: {
      icon: <SpinnerDots />, label: 'Đang kết nối...',
      bg: 'linear-gradient(135deg, #6366F1, #4F46E5)',
      shadow: '0 8px 40px rgba(99,102,241,0.35)',
      scale: 1, labelColor: C.textDim,
    },
    listening: {
      icon: <MicIcon active />, label: 'Đang nghe...',
      bg: 'linear-gradient(135deg, #F59E0B, #D97706)',
      shadow: '0 8px 60px rgba(251,191,36,0.5), 0 0 120px rgba(251,191,36,0.2)',
      scale: 1.05, labelColor: C.text,
    },
    thinking: {
      icon: <SpinnerDots />, label: 'Đang nghĩ...',
      bg: 'linear-gradient(135deg, #6366F1, #4F46E5)',
      shadow: '0 8px 40px rgba(99,102,241,0.35)',
      scale: 1, labelColor: C.textDim,
    },
    speaking: {
      icon: <WaveformBars />, label: 'Đang nói...',
      bg: 'linear-gradient(135deg, #16A34A, #15803D)',
      shadow: '0 8px 40px rgba(22,163,74,0.35)',
      scale: 1, labelColor: C.textDim,
    },
    error: {
      icon: <span style={{ fontSize: 36 }}>🔌</span>, label: error || 'Lỗi kết nối',
      bg: 'linear-gradient(135deg, #DC2626, #B91C1C)',
      shadow: '0 8px 40px rgba(220,38,38,0.35)',
      scale: 1, labelColor: C.textErr,
    },
  }

  const cfg = stateConfig[state]

  // ── Ring animation ──
  const showRings = state === 'listening' || state === 'connecting'
  const rings = showRings
    ? [1, 2, 3].map(i => {
        const phase = (elapsed * 0.8 + i * 1.2) % 4
        const opacity = Math.max(0, 0.5 - phase * 0.12)
        const scale = 1 + phase * 0.55
        return { scale, opacity }
      })
    : []

  // ── Retry button for error state ──
  const handleTap = () => {
    if (state === 'idle') {
      // Already connected — user just needs to speak (VAD will trigger)
      // Re-establish if connection dropped
      if (!pcRef.current || pcRef.current.connectionState === 'closed' || pcRef.current.connectionState === 'failed') {
        connect()
      }
    } else if (state === 'error') {
      connect()
    }
    // Other states: no action on tap (system is processing)
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: `linear-gradient(180deg, ${C.bgGrad1} 0%, ${C.bgGrad2} 100%)`,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      fontFamily: 'Inter, system-ui, sans-serif',
      position: 'relative', overflow: 'hidden', userSelect: 'none',
    }}>
      {/* Close button */}
      {onClose && (
        <button onClick={onClose} style={{
          position: 'absolute', top: 20, right: 20, zIndex: 10,
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 50,
          width: 44, height: 44, fontSize: 18, color: C.textDim,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(12px)',
        }}>✕</button>
      )}

      {/* Header */}
      <div style={{ width: '100%', textAlign: 'center', paddingTop: 72, paddingBottom: 24 }}>
        <div style={{ fontSize: 40, marginBottom: 4 }}>🎹</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.text, letterSpacing: '-0.3px' }}>
          Piano Journey
        </div>
      </div>

      {/* Chat bubbles */}
      <div style={{
        flex: 1, width: '100%', maxWidth: 420,
        overflowY: 'auto', padding: '0 20px 20px',
        display: 'flex', flexDirection: 'column', gap: 12,
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 40px)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 40px)',
      }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            background: m.role === 'user' ? C.bubbleUser : C.bubbleAsst,
            borderRadius: '18px 18px 4px 18px',
            padding: '14px 18px',
            border: `1px solid ${m.role === 'user' ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.06)'}`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {m.role === 'user' ? 'Con' : '🎹 Cô Piano'}
            </div>
            <div style={{ fontSize: 15, color: C.text, lineHeight: 1.6, fontWeight: 400 }}>
              {m.text}
            </div>
          </div>
        ))}
        <div style={{ height: BUTTON + 100 }} />
      </div>

      {/* Bottom: button area */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingBottom: 80,
      }}>
        {/* Rings container */}
        <div style={{
          position: 'relative',
          width: BUTTON * 4, height: BUTTON * 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 8,
        }}>
          {rings.map((ring, i) => (
            <div key={i} style={{
              position: 'absolute', width: BUTTON, height: BUTTON,
              borderRadius: '50%',
              border: `2px solid ${C.ring}`,
              transform: `scale(${ring.scale})`, opacity: ring.opacity,
            }} />
          ))}

          {/* Main button */}
          <button
            onClick={handleTap}
            disabled={state !== 'idle' && state !== 'error'}
            style={{
              width: BUTTON, height: BUTTON, borderRadius: '50%',
              background: cfg.bg, border: 'none',
              cursor: (state === 'idle' || state === 'error') ? 'pointer' : 'default',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              boxShadow: cfg.shadow,
              transform: `scale(${cfg.scale})`,
              transition: 'transform 0.3s ease, box-shadow 0.5s ease, background 0.5s ease',
              position: 'relative', zIndex: 2, outline: 'none',
            }}
          >
            {cfg.icon}
          </button>
        </div>

        {/* Label */}
        <div style={{
          fontSize: 15, fontWeight: 600, color: cfg.labelColor,
          transition: 'color 0.5s ease', textAlign: 'center',
          maxWidth: 320, lineHeight: 1.4,
        }}>
          {state === 'error' ? (
            <>
              <div>{cfg.label}</div>
              <div style={{ fontSize: 13, marginTop: 4, opacity: 0.8 }}>Chạm để thử lại</div>
            </>
          ) : cfg.label}
        </div>
      </div>

      {/* Background decorations */}
      <div style={{ position: 'absolute', top: '12%', left: -20, fontSize: 64, opacity: 0.04, pointerEvents: 'none' }}>🎵</div>
      <div style={{ position: 'absolute', top: '30%', right: -16, fontSize: 56, opacity: 0.04, pointerEvents: 'none' }}>🎶</div>
    </div>
  )
}

// ── Icon components ──────────────────────────────────────────────────────────

function MicIcon({ active }: { active?: boolean }) {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ opacity: active ? 1 : 0.85, transition: 'opacity .3s' }}>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

function SpinnerDots() {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: '50%', background: '#fff',
          animation: `pj-bounce 1.2s ${i * 0.15}s infinite ease-in-out`,
        }} />
      ))}
      <style>{`
        @keyframes pj-bounce {
          0%, 80%, 100% { transform: scale(0.5); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function WaveformBars() {
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 30 }}>
      {[0.6, 0.9, 0.5, 0.8, 0.4, 0.7, 0.5].map((_, i) => (
        <div key={i} style={{
          width: 4, borderRadius: 2, background: '#fff',
          animation: `pj-wave 0.8s ${i * 0.09}s infinite ease-in-out`,
        }} />
      ))}
      <style>{`
        @keyframes pj-wave {
          0%, 100% { height: 6px; opacity: 0.4; }
          50% { height: 28px; opacity: 1; }
        }
      `}</style>
    </div>
  )
}
