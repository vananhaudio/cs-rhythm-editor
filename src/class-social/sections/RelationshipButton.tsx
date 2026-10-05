// Nút quan hệ trên trang cá nhân người khác — MỘT nút cho mỗi trạng thái (mô hình Facebook):
// [Kết bạn] làm ngay · [Đã gửi lời mời ▾] · [Phản hồi lời mời ▾] · [Bạn bè ▾] mở menu lựa chọn.
// Menu nằm NGOÀI luồng thẻ hồ sơ (thẻ cắt tràn để bo ảnh bìa): desktop = popover cố định theo vị trí nút,
// mobile (<1024) = action sheet đáy màn hình như Facebook (CSS ghi đè vị trí).
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Clock, UserCheck, UserPlus } from 'lucide-react'
import { relationshipUi, type FriendAction, type Relationship } from '../friends/friendModel'

const ICON = { none: UserPlus, outgoing: Clock, incoming: UserPlus, friends: UserCheck } as const

export default function RelationshipButton({ relationship, name, busy, onAct }: {
  relationship: Relationship
  name: string
  busy: boolean
  onAct: (a: FriendAction) => void
}) {
  const ui = relationshipUi(relationship)
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState<{ top: number; left: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const [prevRel, setPrevRel] = useState(relationship)
  if (prevRel !== relationship) { setPrevRel(relationship); setOpen(false) }   // trạng thái đổi → đóng menu cũ

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const close = () => setOpen(false)
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])
  const toggle = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    setAt({ top: Math.round(r.bottom + 6), left: Math.round(Math.max(8, Math.min(r.left, window.innerWidth - 228))) })
    setOpen(o => !o)
  }

  if (!ui || relationship === 'self') return null
  const Icon = ICON[relationship as keyof typeof ICON] ?? UserPlus
  const cls = 'cs-btn cs-rel-btn ' + (ui.tone === 'primary' ? 'cs-btn-primary' : 'cs-btn-soft')

  if (ui.direct) {
    const a = ui.direct
    return (
      <div className="cs-rel-actions">
        <button type="button" className={cls} disabled={busy} aria-busy={busy} onClick={() => onAct(a)}>
          <Icon size={18} aria-hidden="true" />{busy ? 'Đang gửi…' : ui.label}
        </button>
      </div>
    )
  }
  return (
    <div className="cs-rel-actions cs-rel-menu-wrap" ref={ref}>
      <button type="button" className={cls} disabled={busy} aria-busy={busy} aria-haspopup="menu" aria-expanded={open}
        aria-label={`${ui.label} — ${name}`} onClick={e => toggle(e.currentTarget)}>
        <Icon size={18} aria-hidden="true" />{ui.label}<ChevronDown size={16} aria-hidden="true" className="cs-rel-chev" />
      </button>
      {open && <>
        <div className="cs-rel-sheet-backdrop" onClick={() => setOpen(false)} />
        <div className="cs-more-menu cs-rel-menu" role="menu" aria-label={name} style={at ?? undefined}>
          <div className="cs-rel-sheet-title" aria-hidden="true">{name}</div>
          {ui.menu.map(it => (
            <button key={it.id} type="button" role="menuitem" className={'cs-more-item' + (it.danger ? ' is-danger' : '')}
              onClick={() => { setOpen(false); onAct(it.id) }}>{it.label}</button>
          ))}
        </div>
      </>}
    </div>
  )
}
