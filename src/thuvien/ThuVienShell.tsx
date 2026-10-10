// Khung của website THƯ VIỆN ÂM NHẠC = KHUNG CỦA CLASS: cùng top bar (logo + "Trang Class" + tài khoản), sidebar (desktop,
// thu gọn được, nhớ lựa chọn như Class) và menu dạng sheet (mobile) — dùng đúng class `cs-*` + token trong classSocial.css,
// cùng Avatar / MoreMenu / ClassHomeLink của Class và cùng phiên đăng nhập (useClassSession). Chỉ DANH SÁCH MỤC là của Thư viện.
// Hành vi nhận diện y như ClassSocialLayout (cùng breakpoint 1024). Không có logic nghiệp vụ: chỉ điều hướng.
import { useEffect, useState, type ReactNode } from 'react'
import { FilePlus2, FileMusic, ListMusic, Menu, PanelLeftClose, PanelLeftOpen, Plus, Settings2, X, type LucideIcon } from 'lucide-react'
import { Avatar, ClassHomeLink, MoreMenu } from '../class-social/ui'
import { safeImageUrl } from '../class-social/media/safeImageUrl'
import { SECTION_PATHS } from '../class-social/resolveMeRoute'
import type { ClassSession } from '../class-social/useClassSession'
import type { NavId } from './sections.ts'

const COLLAPSE_KEY = 'cs-sidebar-collapsed'   // cùng khoá với Class: thu gọn ở Class thì Thư viện cũng thu gọn

type Entry = { id: NavId; label: string; icon: LucideIcon; href?: string }
type Group = { id: string; title: string; items: Entry[] }

/** Danh sách mục đã chốt. Nhóm theo cách dùng: XEM thư viện / NẠP mới / công cụ toàn Thư viện. */
export const TV_NAV_GROUPS: Group[] = [
  { id: 'view', title: 'Thư viện', items: [
    { id: 'chords', label: 'Danh sách bài hát có hợp âm', icon: ListMusic },
    { id: 'musicxml', label: 'Danh sách bản nhạc MusicXML', icon: FileMusic },
  ] },
  { id: 'add', title: 'Nạp mới', items: [
    { id: 'new-chords', label: 'Nạp hợp âm mới', icon: Plus },
    { id: 'upload-musicxml', label: 'Nạp bản nhạc mới', icon: FilePlus2 },
  ] },
  { id: 'tools', title: 'Công cụ', items: [
    { id: 'advanced', label: 'Nâng cao', icon: Settings2, href: '/admin' },
  ] },
]

function readCollapsed(): boolean {
  try { return localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false }
}

function Entries({ active, collapsed, onNavigate }: { active: NavId | null; collapsed: boolean; onNavigate: (id: NavId) => void }) {
  return <>
    {TV_NAV_GROUPS.map(group => <div key={group.id} className="cs-nav-block">
      <nav className="cs-nav-group" aria-label={group.title}>
        <div className="cs-nav-title">{group.title}</div>
        {group.items.map(item => {
          const Icon = item.icon
          const tip = collapsed ? item.label : undefined
          if (item.href) {
            // Liên kết ra khu quản trị — mở cùng tab, như các destination của Class
            return <a key={item.id} className="cs-nav-item" href={item.href} title={tip}>
              <Icon size={21} strokeWidth={1.9} /><span className="cs-nav-text">{item.label}</span>
            </a>
          }
          const on = item.id === active
          return <button key={item.id} type="button" className={'cs-nav-item' + (on ? ' is-active' : '')} aria-current={on ? 'page' : undefined} title={tip}
            onClick={() => { if (!on) onNavigate(item.id) }}>
            <Icon size={21} strokeWidth={on ? 2.2 : 1.9} /><span className="cs-nav-text">{item.label}</span>
          </button>
        })}
      </nav>
    </div>)}
  </>
}

function MobileMenu({ active, onClose, onNavigate }: { active: NavId | null; onClose: () => void; onNavigate: (id: NavId) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return <>
    <div className="cs-sheet-backdrop" onClick={onClose} />
    <div className="cs-sheet" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="cs-sheet-grip" />
      <div className="cs-sheet-head">
        <h2>Menu</h2>
        <button type="button" className="cs-icon-btn" onClick={onClose} aria-label="Đóng menu"><X size={22} /></button>
      </div>
      <Entries active={active} collapsed={false} onNavigate={id => { onNavigate(id); onClose() }} />
    </div>
  </>
}

/** Tài khoản trên top bar — cùng cách hiện của Class (avatar + menu); chưa đăng nhập → vào /me (nơi đăng nhập của Class). */
function Account({ session }: { session: ClassSession }) {
  if (session.status === 'loading') return <span className="cs-icon-btn" aria-hidden="true" />
  if (session.status === 'signed-out') return <a className="cs-btn cs-btn-primary cs-tv-login" href={SECTION_PATHS.home}>Đăng nhập</a>
  const name = session.status === 'ready' ? session.me.name : (session.email ?? 'Tài khoản')
  const url = session.status === 'ready' ? safeImageUrl(session.me.avatarUrl) : null
  return <MoreMenu className="cs-account" label={`Tài khoản: ${name}`} trigger={<Avatar name={name} url={url} size={32} />}
    items={[
      { label: 'Trang cá nhân của tôi', onSelect: () => { window.location.href = SECTION_PATHS.home } },
      { label: 'Đăng xuất', danger: true, onSelect: () => { void import('../class-social/profile/profileApi').then(api => api.signOut()) } },   // cùng hàm đăng xuất của Class
    ]} />
}

export default function ThuVienShell({ active, onNavigate, session, children }: {
  active: NavId | null
  onNavigate: (id: NavId) => void
  session: ClassSession
  children: ReactNode
}) {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [menuOpen, setMenuOpen] = useState(false)
  const toggle = () => setCollapsed(current => {
    try { localStorage.setItem(COLLAPSE_KEY, current ? '0' : '1') } catch { /* bỏ qua */ }
    return !current
  })

  return <div className="cs-root cs-tv-root">
    <header className="cs-topbar">
      <button type="button" className="cs-icon-btn cs-only-desktop" onClick={toggle} aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'} aria-expanded={!collapsed}>
        {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
      </button>
      <button type="button" className="cs-icon-btn cs-only-mobile cs-menu-btn" onClick={() => setMenuOpen(true)} aria-label="Mở menu"><Menu size={22} /></button>
      <a className="cs-brand" href={SECTION_PATHS.home} aria-label="Thầy Văn Anh Guitar — Trang chủ">
        <img className="cs-brand-logo" src="/logo-green.svg" alt="" width={30} height={29} />
        <span className="cs-brand-text">Thầy Văn Anh Guitar</span>
      </a>
      <span className="cs-tv-site">Thư viện âm nhạc</span>
      <div className="cs-topbar-spacer" />
      <ClassHomeLink />
      <Account session={session} />
    </header>
    <div className="cs-body">
      <aside className={'cs-sidebar' + (collapsed ? ' is-collapsed' : '')}>
        <Entries active={active} collapsed={collapsed} onNavigate={onNavigate} />
      </aside>
      <main className="cs-main cs-tv-main">{children}</main>
    </div>
    {menuOpen && <MobileMenu active={active} onClose={() => setMenuOpen(false)} onNavigate={onNavigate} />}
  </div>
}

