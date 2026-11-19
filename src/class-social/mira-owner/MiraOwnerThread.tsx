// Khung đọc MỘT hội thoại học viên ↔ Mira ngay trong Hộp thư (/me/chat). CHỈ ĐỌC: không có ô nhập, không gửi tin thay Mira.
// Quyền do RPC mira_owner_conversation_get quyết (server); mỗi lần mở có nhật ký truy cập ở server.
import { useEffect, useRef, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import ChatHeader from '../chat/ChatHeader'
import MiraAvatar from '../chat/MiraAvatar'
import { getConversation, student360Href, type MiraConvDetail } from './miraOwnerApi'

export const fmtTime = (iso: string) => { const d = new Date(iso); return Number.isNaN(+d) ? '' : d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) }

export default function MiraOwnerThread({ conversationId, onBack }: { conversationId: string; onBack: () => void }) {
  const [state, setState] = useState<{ s: 'loading' } | { s: 'error' | 'forbidden' | 'missing' } | { s: 'ok'; d: MiraConvDetail }>({ s: 'loading' })
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let alive = true
    setState({ s: 'loading' })
    void getConversation(conversationId).then(r => {
      if (!alive) return
      if (!r.ok) setState({ s: r.reason === 'forbidden' ? 'forbidden' : 'error' })
      else setState(r.data ? { s: 'ok', d: r.data } : { s: 'missing' })
    })
    return () => { alive = false }
  }, [conversationId])
  useEffect(() => { const el = box.current; if (el) el.scrollTop = 0 }, [conversationId])

  const d = state.s === 'ok' ? state.d : null
  const href = d ? student360Href(d.student_id) : null
  const name = d ? (d.display_name ?? 'Học viên') : null
  return (
    <>
      <ChatHeader name={name} avatarUrl={null} onBack={onBack} tag={d ? `Hội thoại với Mira · ${d.turn_count} lượt · chỉ đọc` : undefined}
        actionLabel="Hội thoại của học viên với Mira"
        menu={href ? <a className="cs-btn cs-btn-soft cs-btn-sm" href={href} data-testid="mira-360-link"><ExternalLink size={14} aria-hidden="true" /> Student 360°</a> : undefined} />
      <div className="cs-chat-scroll-wrap">
        <div ref={box} className="cs-chat-scroll" role="log" aria-label="Hội thoại của học viên với Mira (chỉ đọc)">
          {state.s === 'loading' && <div className="cs-skeleton" style={{ width: 220, height: 18, margin: 16 }} aria-label="Đang tải" />}
          {state.s === 'forbidden' && <p className="cs-inbox-note" role="alert">Mục này chỉ dành cho Owner.</p>}
          {state.s === 'error' && <p className="cs-inbox-note" role="alert">Chưa tải được hội thoại này. Bạn thử lại sau nhé.</p>}
          {state.s === 'missing' && <p className="cs-inbox-note" role="alert">Không tìm thấy hội thoại này.</p>}
          {d?.messages.map(m => (
            <div key={m.seq} className={'cs-msg-row ' + (m.role === 'assistant' ? 'is-mine' : 'is-theirs')} data-role={m.role}>
              <div className="cs-inbox-note" style={{ margin: '0 6px 2px', display: 'flex', alignItems: 'center', gap: 6 }}>
                {m.role === 'assistant' ? <><MiraAvatar size={16} /> Mira</> : name} · {fmtTime(m.created_at)}
              </div>
              <div className="cs-msg-bubble">{m.content}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="cs-inbox-note" style={{ padding: '8px 14px' }}>Chỉ đọc — Owner không gửi tin thay Mira.</div>
    </>
  )
}
