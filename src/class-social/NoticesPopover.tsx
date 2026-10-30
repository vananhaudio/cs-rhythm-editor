// Popover Thông báo (desktop ≥1024px): nhỏ, dưới chuông, danh sách cuộn; đóng khi bấm ngoài / Escape; "Xem tất cả" → trang /me/notices.
// Mobile/iPad (<1024px) không dùng popover: chuông mở màn toàn trang. Mở popover = xem danh sách → đánh dấu đã đọc như trang đầy đủ (cùng hook).
import { useEffect, useRef } from 'react'
import SystemNoticeView from './chat/SystemNoticeView'
import { isOutsidePopover } from './noticesPopoverLogic'

export default function NoticesPopover({ bellRef, onClose, onViewAll, onActivity, onOpenThread }: {
  bellRef: React.RefObject<HTMLElement | null>
  onClose: () => void
  onViewAll: () => void
  onActivity: () => void
  onOpenThread: (threadId: string, search: string) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const down = (e: PointerEvent) => { if (isOutsidePopover(e.target as Node | null, box.current, bellRef.current)) onClose() }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { onClose(); bellRef.current?.focus() } }
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key) }
  }, [onClose, bellRef])
  return (
    <div className="cs-notif-pop" ref={box} role="dialog" aria-label="Thông báo">
      <div className="cs-notif-pop-head"><h2>Thông báo</h2></div>
      <div className="cs-notif-pop-body">
        <SystemNoticeView bare onBack={() => undefined} onActivity={onActivity} onOpenThread={(id, search) => { onClose(); onOpenThread(id, search) }} />
      </div>
      <div className="cs-notif-pop-foot">
        <button type="button" className="cs-notif-all" onClick={() => { onClose(); onViewAll() }}>Xem tất cả</button>
      </div>
    </div>
  )
}
