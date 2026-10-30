// Một thông báo Class 2.0 — hàng gọn kiểu Facebook: biểu tượng theo loại · nhãn loại · nội dung · thời gian · chấm chưa đọc.
// Chỉ dùng dữ liệu đã có (kind, body, at, unread): không tự tạo avatar/tên người gửi. Tách riêng khỏi SystemNoticeView (không kéo hook/supabase) để test render thuần.
import { Bell, CheckCircle2, FileUp, HelpCircle, MessageCircle, MessageSquareReply, RotateCcw } from 'lucide-react'
import { noticeAction, noticeVariant, relativeTime, type NoticeTone, type SystemNotice } from './chatModel'

const ICONS: Record<NoticeTone, typeof Bell> = {
  submit: FileUp, resubmit: RotateCcw, comment: MessageCircle, pass: CheckCircle2, redo: RotateCcw, graded: CheckCircle2,
  question: HelpCircle, answer: MessageSquareReply, other: Bell,
}

export function Notice({ n, onOpen }: { n: SystemNotice; prev?: SystemNotice; onOpen: () => void }) {
  const action = noticeAction(n.kind)
  const v = noticeVariant(n.kind, n.body)
  const Icon = ICONS[v.tone]
  const time = relativeTime(n.at)
  return (
    <article className={'cs-nr is-' + v.tone + (n.unread ? ' is-unread' : '')} aria-label={n.body}>
      <button type="button" className="cs-nr-main" onClick={onOpen}>
        <span className="cs-nr-icon" aria-hidden="true"><Icon size={20} /></span>
        <span className="cs-nr-text">
          <span className="cs-nr-chip">{v.chip}</span>
          <span className="cs-nr-body">{n.body}</span>
          <span className="cs-nr-meta">{time && <span className="cs-nr-time">{time}</span>}<span className="cs-nr-act">{action.label} <span aria-hidden="true">→</span></span></span>
        </span>
        {n.unread && <span className="cs-nr-dot" role="img" aria-label="Chưa đọc" />}
      </button>
    </article>
  )
}
