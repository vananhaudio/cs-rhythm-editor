// Dòng tin: tin người kia bên trái, tin mình bên phải; chen nhãn giờ khi cách >30 phút; "Xem tin cũ hơn" ở đầu.
// Cuộn: tự xuống cuối khi mở/khi mình gửi/khi đang ở cuối; nếu đang đọc tin cũ thì hiện nút "Tin mới" thay vì giật màn.
import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowDown } from 'lucide-react'
import { firstSeqOf, lastSeqOf, layoutMessages, type ChatMessage, type PendingMessage } from './chatModel'

const NEAR_BOTTOM = 96

export default function MessageList({ messages, pending, hasMore, loadingOlder, onLoadOlder, onRetry, onDiscard }: {
  messages: ChatMessage[]
  pending: PendingMessage[]
  hasMore: boolean
  loadingOlder: boolean
  onLoadOlder: () => void
  onRetry: (localId: string) => void
  onDiscard: (localId: string) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const stick = useRef(true)               // đang ở cuối → tin mới kéo xuống
  const anchor = useRef<number | null>(null) // chiều cao trước khi tải tin cũ (giữ nguyên vị trí đọc)
  const seen = useRef({ last: 0, first: 0, pending: 0 })
  const [below, setBelow] = useState(false)
  const last = lastSeqOf(messages)
  const first = firstSeqOf(messages)

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const prev = seen.current
    if (anchor.current != null && first < prev.first) {
      el.scrollTop += el.scrollHeight - anchor.current        // tin cũ chèn lên đầu: giữ vị trí
      anchor.current = null
    } else if (prev.last === 0 || pending.length > prev.pending || stick.current) {
      el.scrollTop = el.scrollHeight                           // lần đầu / mình vừa gửi / đang ở cuối
      setBelow(false)
    } else if (last > prev.last) {
      setBelow(true)                                           // đang đọc tin cũ, có tin mới bên dưới
    }
    seen.current = { last, first, pending: pending.length }
  }, [last, first, pending.length])

  const onScroll = () => {
    const el = box.current
    if (!el) return
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM
    if (stick.current) setBelow(false)
  }
  const toBottom = () => { const el = box.current; if (el) { el.scrollTop = el.scrollHeight; stick.current = true; setBelow(false) } }

  const rows = layoutMessages(messages)
  const lastMine = messages.length > 0 && messages[messages.length - 1].mine
  return (
    <div className="cs-chat-scroll-wrap">
      <div ref={box} className="cs-chat-scroll" onScroll={onScroll} role="log" aria-live="polite" aria-label="Tin nhắn">
        {hasMore && (
          <button type="button" className="cs-chat-older" disabled={loadingOlder}
            onClick={() => { anchor.current = box.current?.scrollHeight ?? null; onLoadOlder() }}>
            {loadingOlder ? 'Đang tải…' : 'Xem tin cũ hơn'}
          </button>
        )}
        {rows.map(({ m, label, cont }) => (
          <div key={m.seq}>
            {label && <div className="cs-chat-divider">{label}</div>}
            <div className={'cs-msg-row ' + (m.mine ? 'is-mine' : 'is-theirs') + (cont ? ' is-cont' : '')}>
              <div className="cs-msg-bubble">{m.body}</div>
            </div>
          </div>
        ))}
        {pending.map((p, i) => (
          <div key={p.localId} className={'cs-msg-row is-mine' + (lastMine || i > 0 ? ' is-cont' : '')}>
            <div className={'cs-msg-bubble is-pending' + (p.state === 'failed' ? ' is-failed' : '')}>{p.body}</div>
            {p.state === 'failed' && (
              <div className="cs-msg-fail" role="alert">
                Chưa gửi được ·{' '}
                <button type="button" className="cs-link-btn" onClick={() => onRetry(p.localId)}>Thử lại</button>{' · '}
                <button type="button" className="cs-link-btn" onClick={() => onDiscard(p.localId)}>Xoá</button>
              </div>
            )}
          </div>
        ))}
      </div>
      {below && (
        <button type="button" className="cs-chat-below" onClick={toBottom}><ArrowDown size={16} aria-hidden="true" />Tin mới</button>
      )}
    </div>
  )
}
