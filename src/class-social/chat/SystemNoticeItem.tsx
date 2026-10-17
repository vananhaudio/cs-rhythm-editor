// Một thông báo Class 2.0: nội dung ngắn + nút điều hướng theo loại. Tách riêng khỏi SystemNoticeView (không kéo hook/supabase) để test render thuần.
import { dividerLabel, noticeAction, type SystemNotice } from './chatModel'

export function Notice({ n, prev, onOpen }: { n: SystemNotice; prev?: SystemNotice; onOpen: () => void }) {
  const label = dividerLabel(prev?.at ?? null, n.at)
  const action = noticeAction(n.kind)
  return (
    <>
      {label && <div className="cs-chat-divider">{label}</div>}
      <article className={'cs-sys-notice' + (n.unread ? ' is-unread' : '')} aria-label={n.body}>
        <p className="cs-sys-body">{n.body}</p>
        <button type="button" className="cs-sys-action" onClick={onOpen}>{action.label} <span aria-hidden="true">→</span></button>
      </article>
    </>
  )
}
