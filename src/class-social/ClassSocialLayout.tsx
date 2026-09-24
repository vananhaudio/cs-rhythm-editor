// Khung (shell) của Class Social: top bar tối giản + sidebar (desktop) / menu sheet (mobile).
// Logo = Trang chủ (/me). Sidebar chỉ chứa nơi KHÁC để đi, không chứa trang đang đứng.
import { useEffect, useState, type ReactNode } from 'react'
import { Lock, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { NAV_GROUPS, type NavItem } from './nav'
import { SECTION_PATHS, type SocialSection } from './resolveMeRoute'
import type { ClassIdentity } from './useClassSession'
import { Avatar, MoreMenu } from './ui'
import { safeImageUrl } from './media/safeImageUrl'
import type { ImageKind } from './profile/imageFile'

const COLLAPSE_KEY = 'cs-sidebar-collapsed'

function readCollapsed(): boolean {
  try { return localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false }
}

function NavEntry({ item, active, collapsed, onSection }: {
  item: NavItem
  active: boolean
  collapsed: boolean
  onSection: (s: SocialSection) => void
}) {
  const Icon = item.icon
  const tip = collapsed ? item.label : undefined
  if (item.kind === 'section') {
    return (
      <button type="button" className={'cs-nav-item' + (active ? ' is-active' : '')}
        aria-current={active ? 'page' : undefined} title={tip}
        onClick={() => onSection(item.id)}>
        <Icon size={21} strokeWidth={active ? 2.2 : 1.9} />
        <span className="cs-nav-text">{item.label}</span>
      </button>
    )
  }
  if (item.kind === 'destination') {
    // Mở cùng tab, tải trang đầy đủ — app đích chạy y như khi vào thẳng URL của nó
    return (
      <a className="cs-nav-item" href={item.href} title={tip ?? item.hint}>
        <Icon size={21} strokeWidth={1.9} />
        <span className="cs-nav-text">{item.label}</span>
      </a>
    )
  }
  return (
    <div className="cs-nav-item is-restricted" aria-disabled="true" title={collapsed ? `${item.label} — ${item.note}` : undefined}>
      <Icon size={21} strokeWidth={1.9} />
      <span className="cs-nav-text">
        <span className="cs-nav-label">{item.label}<Lock className="cs-nav-lock" size={13} aria-label="Đang khoá" /></span>
        <span className="cs-nav-note">{item.note}</span>
      </span>
    </div>
  )
}

function NavGroups({ section, collapsed, onSection }: {
  section: SocialSection
  collapsed: boolean
  onSection: (s: SocialSection) => void
}) {
  return (
    <>
      {NAV_GROUPS.map(g => (
        <nav key={g.id} className="cs-nav-group" aria-label={g.title}>
          <div className="cs-nav-title">{g.title}</div>
          {g.items.map(item => (
            <NavEntry key={item.id} item={item} collapsed={collapsed} onSection={onSection}
              active={item.kind === 'section' && item.id === section} />
          ))}
        </nav>
      ))}
    </>
  )
}

function MobileMenu({ section, onClose, onSection }: {
  section: SocialSection
  onClose: () => void
  onSection: (s: SocialSection) => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <>
      <div className="cs-sheet-backdrop" onClick={onClose} />
      <div className="cs-sheet" role="dialog" aria-modal="true" aria-label="Menu">
        <div className="cs-sheet-grip" />
        <div className="cs-sheet-head">
          <h2>Menu</h2>
          <button type="button" className="cs-icon-btn" onClick={onClose} aria-label="Đóng menu"><X size={22} /></button>
        </div>
        <NavGroups section={section} collapsed={false} onSection={s => { onSection(s); onClose() }} />
      </div>
    </>
  )
}

export default function ClassSocialLayout({ me, section, onSection, children, canEditAvatar, onEditMedia, onSignOut }: {
  me: ClassIdentity
  section: SocialSection
  onSection: (s: SocialSection) => void
  children: ReactNode
  canEditAvatar?: boolean
  onEditMedia?: (kind: ImageKind) => void
  onSignOut?: () => void
}) {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [menuOpen, setMenuOpen] = useState(false)

  const toggleCollapsed = () => {
    setCollapsed(c => {
      try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1') } catch { /* bỏ qua */ }
      return !c
    })
  }

  return (
    <div className="cs-root">
      <header className="cs-topbar">
        <button type="button" className="cs-icon-btn cs-only-desktop" onClick={toggleCollapsed}
          aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'} aria-expanded={!collapsed}>
          {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>
        <button type="button" className="cs-icon-btn cs-only-mobile" onClick={() => setMenuOpen(true)} aria-label="Mở menu">
          <Menu size={22} />
        </button>
        {/* Logo chuẩn — cùng cặp logo + chữ mà trang tuyển sinh class.vananhaudio.com đang dùng */}
        <a className="cs-brand" href={SECTION_PATHS.home} aria-label="Thầy Văn Anh Guitar — Trang chủ"
          onClick={e => { e.preventDefault(); onSection('home') }}>
          <img className="cs-brand-logo" src="/logo-green.svg" alt="" width={30} height={29} />
          <span className="cs-brand-text">Thầy Văn Anh Guitar</span>
        </a>
        <div className="cs-topbar-spacer" />
        <MoreMenu className="cs-account" label={`Tài khoản: ${me.name}`}
          trigger={<Avatar name={me.name} url={safeImageUrl(me.avatarUrl)} size={34} />}
          items={[
            ...(onEditMedia && canEditAvatar ? [{ label: 'Đổi ảnh đại diện', onSelect: () => onEditMedia('avatar') }] : []),
            ...(onEditMedia ? [{ label: 'Đổi ảnh bìa', onSelect: () => onEditMedia('cover') }] : []),
            ...(onSignOut ? [{ label: 'Đăng xuất', danger: true, onSelect: onSignOut }] : []),
          ]} />
      </header>

      <div className="cs-body">
        <aside className={'cs-sidebar' + (collapsed ? ' is-collapsed' : '')}>
          <NavGroups section={section} collapsed={collapsed} onSection={onSection} />
        </aside>
        <main className="cs-main">{children}</main>
      </div>

      {menuOpen && <MobileMenu section={section} onClose={() => setMenuOpen(false)} onSection={onSection} />}
    </div>
  )
}
