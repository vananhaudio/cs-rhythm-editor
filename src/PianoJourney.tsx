import { useState, useRef, useEffect, useCallback } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────
type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface Message {
  role: 'user' | 'assistant'
  text: string
}

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_RESPONSES = [
  'Hay quá! Mình cùng tập bài "Twinkle Twinkle Little Star" nhé! ⭐',
  'Tuyệt vời! Con muốn chơi bằng tay phải hay cả hai tay? 🎹',
  'Bài hát thiếu nhi hả? Để cô soạn cho con một bài thật vui! 🎵',
  'Ý tưởng hay đấy! Mình bắt đầu từ nốt Đô nhé! 🎼',
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ── Styles ────────────────────────────────────────────────────────────────────
const COLORS = {
  bg:        '#1C1408',
  bgGrad1:   '#2D1F0A',
  bgGrad2:   '#1C1408',
  ring:      'rgba(251,191,36,0.35)',
  ringOuter: 'rgba(251,191,36,0.12)',
  button:    '#F59E0B',
  buttonLit: '#FBBF24',
  text:      '#FEF3C7',
  textDim:   '#A78B4A',
  bubbleUser:   '#3D2E0A',
  bubbleAsst:   '#2D1F0A',
  gradient:  'linear-gradient(135deg, #F59E0B, #D97706)',
}

interface Props {
  onClose?: () => void
}

export default function PianoJourney({ onClose }: Props) {
  const [state, setState]       = useState<VoiceState>('idle')
  const [messages, setMessages] = useState<Message[]>([])
  const stateRef                = useRef<VoiceState>('idle')
  const [elapsed, setElapsed]   = useState(0)

  // Keep ref in sync
  useEffect(() => { stateRef.current = state }, [state])

  // ── Animation tick for listening waveform ──
  useEffect(() => {
    if (state !== 'listening') return
    let frame: number
    const tick = () => {
      setElapsed(prev => prev + 1)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [state])

  // ── Tap handler ──
  const handleTap = useCallback(() => {
    if (stateRef.current !== 'idle') return

    setState('listening')
    setElapsed(0)

    // Mock: sau 3s "nghe" → thinking
    setTimeout(() => {
      if (stateRef.current !== 'listening') return
      setState('thinking')

      // Mock: sau 2s "nghĩ" → speaking
      setTimeout(() => {
        if (stateRef.current !== 'thinking') return
        setState('speaking')

        const userText = pick([
          'Con muốn tập bài hát thiếu nhi',
          'Dạy con chơi Twinkle Twinkle',
          'Con thích bài Happy Birthday',
          'Cho con tập nốt Đô Rê Mi',
        ])
        const reply = pick(MOCK_RESPONSES)

        setMessages(prev => [...prev, { role: 'user', text: userText }, { role: 'assistant', text: reply }])

        // Mock: sau 3.5s "nói" → idle
        setTimeout(() => {
          if (stateRef.current !== 'speaking') return
          setState('idle')
        }, 3500)
      }, 2000)
    }, 3000)
  }, [])

  // ── Button style per state ──
  const buttonSize    = 140
  const ringBaseSize  = buttonSize
  const ringAnimating = state === 'listening'

  const stateConfig: Record<VoiceState, { scale: number; bg: string; shadow: string; icon: string; label: string; labelColor: string }> = {
    idle: {
      scale: 1, bg: COLORS.gradient,
      shadow: '0 8px 40px rgba(245,158,11,0.3)',
      icon: '🎤', label: 'Chạm để nói', labelColor: COLORS.textDim,
    },
    listening: {
      scale: 1.05, bg: COLORS.gradient,
      shadow: '0 8px 60px rgba(251,191,36,0.5), 0 0 120px rgba(251,191,36,0.2)',
      icon: '🎙️', label: 'Đang nghe...', labelColor: COLORS.text,
    },
    thinking: {
      scale: 1, bg: 'linear-gradient(135deg, #6366F1, #4F46E5)',
      shadow: '0 8px 40px rgba(99,102,241,0.35)',
      icon: '💭', label: 'Đang nghĩ...', labelColor: COLORS.textDim,
    },
    speaking: {
      scale: 1, bg: 'linear-gradient(135deg, #16A34A, #15803D)',
      shadow: '0 8px 40px rgba(22,163,74,0.35)',
      icon: '🔊', label: 'Đang nói...', labelColor: COLORS.textDim,
    },
  }

  const cfg = stateConfig[state]

  // ── Ring animation values ──
  const rings = ringAnimating
    ? [1, 2, 3].map(i => {
        const phase = (elapsed * 0.8 + i * 1.2) % 4
        const opacity = Math.max(0, 0.5 - phase * 0.12)
        const scale = 1 + phase * 0.55
        return { scale, opacity }
      })
    : []

  return (
    <div style={{
      minHeight: '100dvh',
      background: `linear-gradient(180deg, ${COLORS.bgGrad1} 0%, ${COLORS.bgGrad2} 100%)`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      fontFamily: 'Inter, system-ui, sans-serif',
      position: 'relative',
      overflow: 'hidden',
      userSelect: 'none',
    }}>
      {/* Nút đóng */}
      {onClose && (
        <button onClick={onClose} style={{
          position: 'absolute', top: 20, right: 20, zIndex: 10,
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 50, width: 44, height: 44,
          fontSize: 18, color: COLORS.textDim,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(12px)',
        }}>✕</button>
      )}

      {/* ── Header ── */}
      <div style={{
        width: '100%', textAlign: 'center',
        paddingTop: 72, paddingBottom: 24,
      }}>
        <div style={{ fontSize: 40, marginBottom: 4 }}>🎹</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.text, letterSpacing: '-0.3px' }}>
          Piano Journey
        </div>
      </div>

      {/* ── Conversation area ── */}
      <div style={{
        flex: 1, width: '100%', maxWidth: 420,
        overflowY: 'auto',
        padding: '0 20px 20px',
        display: 'flex', flexDirection: 'column',
        gap: 12,
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 40px)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 40px)',
      }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            background: m.role === 'user' ? COLORS.bubbleUser : COLORS.bubbleAsst,
            borderRadius: '18px 18px 4px 18px',
            padding: '14px 18px',
            border: `1px solid ${m.role === 'user' ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.06)'}`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textDim, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {m.role === 'user' ? 'Con' : '🎹 Piano'}
            </div>
            <div style={{ fontSize: 15, color: COLORS.text, lineHeight: 1.6, fontWeight: 400 }}>
              {m.text}
            </div>
          </div>
        ))}

        {/* Spacer for button area */}
        <div style={{ height: buttonSize + 100 }} />
      </div>

      {/* ── Bottom: button area ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
        paddingBottom: 80,
      }}>
        {/* Rings */}
        <div style={{
          position: 'relative',
          width: ringBaseSize * 4, height: ringBaseSize * 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 8,
        }}>
          {rings.map((ring, i) => (
            <div key={i} style={{
              position: 'absolute',
              width: ringBaseSize, height: ringBaseSize,
              borderRadius: '50%',
              border: `2px solid ${COLORS.ring}`,
              transform: `scale(${ring.scale})`,
              opacity: ring.opacity,
              transition: 'none',
            }} />
          ))}

          {/* ── Main button ── */}
          <button
            onClick={handleTap}
            disabled={state !== 'idle'}
            style={{
              width: buttonSize,
              height: buttonSize,
              borderRadius: '50%',
              background: cfg.bg,
              border: 'none',
              cursor: state === 'idle' ? 'pointer' : 'default',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              boxShadow: cfg.shadow,
              transform: `scale(${cfg.scale})`,
              transition: 'transform 0.3s ease, box-shadow 0.5s ease, background 0.5s ease',
              position: 'relative', zIndex: 2,
              outline: 'none',
            }}
          >
            {/* Icon inside button */}
            <span style={{
              fontSize: 36,
              transition: 'transform 0.3s ease',
              transform: state === 'listening' ? 'scale(1.1)' : 'scale(1)',
            }}>
              {state === 'thinking'
                ? <Spinner />
                : state === 'speaking'
                  ? <Waveform active />
                  : cfg.icon}
            </span>
          </button>
        </div>

        {/* Status label */}
        <div style={{
          fontSize: 15,
          fontWeight: 600,
          color: cfg.labelColor,
          transition: 'color 0.5s ease',
          textAlign: 'center',
        }}>
          {cfg.label}
        </div>
      </div>

      {/* Background decorations */}
      <div style={{ position: 'absolute', top: '12%', left: -20, fontSize: 64, opacity: 0.04, pointerEvents: 'none' }}>🎵</div>
      <div style={{ position: 'absolute', top: '30%', right: -16, fontSize: 56, opacity: 0.04, pointerEvents: 'none' }}>🎶</div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Spinning dots for "thinking" */
function Spinner() {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
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

/** Animated bars for "speaking" */
function Waveform({ active }: { active: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 30, justifyContent: 'center' }}>
      {[0.6, 0.9, 0.5, 0.8, 0.4, 0.7, 0.5].map((h, i) => (
        <div key={i} style={{
          width: 4, borderRadius: 2, background: '#fff',
          height: active ? undefined : 6,
          animation: active ? `pj-wave 0.8s ${i * 0.09}s infinite ease-in-out` : undefined,
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
