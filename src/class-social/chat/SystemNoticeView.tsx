// Class 2.0 — màn thông báo hệ thống: lịch sử theo thời gian, CHỈ ĐỌC (không ô nhập). Mỗi thông báo = nội dung ngắn + "Xem kết quả →".
// Chat chỉ là cổng điều hướng: kết quả/nhận xét chi tiết nằm ở trang bài trả (hệ thống gốc), không sao chép vào đây.
import { useLayoutEffect, useRef } from 'react'
import { ArrowLeft, BellRing, RefreshCw } from 'lucide-react'
import { SYSTEM_FOOTNOTE, SYSTEM_NAME, noticeAction } from './chatModel'
import { Notice } from './SystemNoticeItem'
import { useSystemNotices } from './useChat'

export default function SystemNoticeView({ onBack, onActivity, onOpenThread, title = SYSTEM_NAME, bare = false }: {
  onBack: () => void
  onActivity: () => void
  onOpenThread: (threadId: string, search: string) => void
  /** Tên hiển thị ở đầu màn (Class Mobile: "Thông báo"). Mặc định như cũ. */
  title?: string
  /** Class Mobile: màn Thông báo đứng riêng trong khung — khung lo tiêu đề + nút Quay lại, không lặp header/chân trang "Class 2.0". */
  bare?: boolean
}) {
  const s = useSystemNotices(onActivity)
  const box = useRef<HTMLDivElement>(null)
  const last = s.notices.at(-1)?.seq ?? 0
  useLayoutEffect(() => { const el = box.current; if (el) el.scrollTop = el.scrollHeight }, [last, s.status])   // mở / có thông báo mới → xuống cuối như chat

  return (
    <>
      {!bare && <header className="cs-chat-head">
        <button type="button" className="cs-icon-btn cs-chat-back" onClick={onBack} aria-label="Quay lại danh sách trò chuyện">
          <ArrowLeft size={22} aria-hidden="true" />
        </button>
        <span className="cs-sys-avatar is-sm" aria-hidden="true"><BellRing size={20} /></span>
        <span className="cs-chat-peer-name">{title}</span>
      </header>}

      {s.status === 'loading' && <div className="cs-chat-body-state"><div className="cs-spinner" role="status" aria-label="Đang tải" /></div>}
      {s.status === 'error' && (
        <div className="cs-chat-body-state" role="alert">
          <p>{s.error}</p>
          <button type="button" className="cs-btn cs-btn-soft" onClick={s.reload}><RefreshCw size={16} aria-hidden="true" />Thử lại</button>
        </div>
      )}
      {s.status === 'ready' && (
        <div className="cs-chat-scroll-wrap">
          <div className="cs-chat-scroll cs-sys-scroll" ref={box} role="log" aria-label={bare ? 'Thông báo' : 'Thông báo từ Class 2.0'}>
            {s.hasMore && (
              <button type="button" className="cs-chat-older" onClick={() => void s.loadOlder()} disabled={s.loadingOlder}>
                {s.loadingOlder ? 'Đang tải…' : 'Xem thông báo cũ hơn'}
              </button>
            )}
            {s.notices.length === 0 && <p className="cs-sys-empty">{bare ? 'Chưa có thông báo nào. Khi có việc cần bạn quan tâm, ứng dụng sẽ báo tại đây.' : 'Chưa có thông báo nào. Khi có việc cần bạn quan tâm, Class 2.0 sẽ báo tại đây.'}</p>}
            {s.notices.map((n, i) => (
              <Notice key={n.seq} n={n} prev={s.notices[i - 1]} onOpen={() => onOpenThread(n.threadId, noticeAction(n.kind).search)} />
            ))}
          </div>
        </div>
      )}
      {s.status === 'ready' && s.error && <p className="cs-form-error cs-chat-error" role="alert">{s.error}</p>}
      {!bare && <div className="cs-chat-locked" role="note"><p>{SYSTEM_FOOTNOTE}</p></div>}
    </>
  )
}
