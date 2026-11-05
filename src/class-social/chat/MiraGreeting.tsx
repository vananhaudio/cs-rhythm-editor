// Bong bóng lời chào của Mira (dùng chung cho khung hội thoại thật và màn "đang chuẩn bị").
import { Sparkles } from 'lucide-react'
import { MIRA_GREETING } from './useMiraChat'

export default function MiraGreeting() {
  return (
    <div className="cs-msg-row is-theirs"><div className="cs-msg-bubble">
      {MIRA_GREETING.split('\n\n').map((t, i) => (
        <p key={i} style={{ margin: i ? '8px 0 0' : 0, fontWeight: i ? undefined : 700 }}>{i === 0 && <Sparkles size={14} aria-hidden="true" />}{i === 0 ? ' ' : ''}{t}</p>
      ))}
    </div></div>
  )
}
