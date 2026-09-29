// Mảnh giao diện dùng chung trong Class Social.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowLeft } from 'lucide-react'
import { safeImageUrl } from './media/safeImageUrl'
import { CLASS_HOME_PATH } from './resolveMeRoute'

/** Link về trang Class công khai (/) — cùng tab, tải trang đầy đủ; cùng phiên đăng nhập. */
export function ClassHomeLink() {
  return (
    <a className="cs-classhome" href={CLASS_HOME_PATH} aria-label="Về Trang Class">
      <ArrowLeft size={17} strokeWidth={2} aria-hidden="true" />
      <span>Trang Class</span>
    </a>
  )
}

export function Avatar({ name, url, size, className }: { name: string; url: string | null; size: number; className?: string }) {
  const safe = safeImageUrl(url)
  const [broken, setBroken] = useState<string | null>(null)   // URL đã lỗi → chữ cái đầu (đổi ảnh mới thì thử lại)
  const initial = (name.trim().charAt(0) || '?').toUpperCase()
  return (
    <span className={'cs-avatar' + (className ? ' ' + className : '')} style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }} aria-hidden="true">
      {safe && broken !== safe
        ? <img src={safe} alt="" onError={() => setBroken(safe)} />
        : initial}
    </span>
  )
}

/** Tên/avatar của một người: bấm → trang cá nhân (khi có onOpen); không có → chữ thường. */
export function PersonLink({ userId, onOpen, label, className, children }: {
  userId: string
  onOpen?: (userId: string) => void
  label: string
  className?: string
  children: ReactNode
}) {
  if (!onOpen) return <span className={className}>{children}</span>
  return (
    <button type="button" className={'cs-person-link' + (className ? ' ' + className : '')} aria-label={label}
      onClick={() => onOpen(userId)}>{children}</button>
  )
}

/** quiet = trạng thái trống NHẸ (không biểu tượng lớn, không khung): 1 dòng tiêu đề + 1 dòng gợi ý. */
export function EmptyState({ icon: Icon, title, children, action, quiet = false }: {
  icon: LucideIcon
  title: string
  children: ReactNode
  action?: ReactNode
  quiet?: boolean
}) {
  return (
    <div className={'cs-empty' + (quiet ? ' is-quiet' : '')}>
      {!quiet && <div className="cs-empty-icon"><Icon size={26} strokeWidth={1.8} /></div>}
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  )
}

/** Menu nhỏ "⋯" (kiểm duyệt / xoá). Đóng khi bấm ra ngoài hoặc Esc. */
export function MoreMenu({ label, items, trigger, className }: {
  label: string
  items: { label: string; onSelect: () => void; danger?: boolean }[]
  /** Nội dung nút mở menu (mặc định "⋯") */
  trigger?: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey) }
  }, [open])
  if (items.length === 0) return null
  return (
    <div className={'cs-more' + (className ? ' ' + className : '')} ref={ref}>
      <button type="button" className={trigger ? 'cs-more-trigger' : 'cs-more-btn'} aria-label={label} aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen(o => !o)}>{trigger ?? '⋯'}</button>
      {open && (
        <div className="cs-more-menu" role="menu">
          {items.map(it => (
            <button key={it.label} type="button" role="menuitem" className={'cs-more-item' + (it.danger ? ' is-danger' : '')}
              onClick={() => { setOpen(false); it.onSelect() }}>{it.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}
