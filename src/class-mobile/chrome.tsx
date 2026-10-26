// Class Mobile V1 — khung: thanh trên (thương hiệu Class + Thông báo + Chức năng khác) và thanh tab dưới (5 tab).
// Không có nút tìm kiếm: Class chưa có chức năng tìm kiếm hoàn chỉnh → không đặt nút giả (ghi nhận cho giai đoạn sau).
import { Bell, ChevronLeft, Drum, GraduationCap, House, LayoutGrid, MessageCircle, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { MOBILE_TABS, type MobileTab } from './mobileNav'

const TAB_ICON: Record<MobileTab, ReactNode> = {
  home: <House aria-hidden="true" />,
  class: <GraduationCap aria-hidden="true" />,
  band: <Drum aria-hidden="true" />,
  chat: <MessageCircle aria-hidden="true" />,
  me: <UserRound aria-hidden="true" />,
}

const badgeText = (n: number) => (n > 99 ? '99+' : String(n))

export function TopBar({ noticeCount, title, onBack, onHome, onNotices, onMore }: {
  noticeCount: number
  /** null = thương hiệu; chữ = tên màn (thanh điều hướng duy nhất) */
  title: string | null
  /** Có = hiện "‹" quay lại ngay trên thanh */
  onBack?: (() => void) | null
  onHome: () => void
  onNotices: () => void
  onMore: () => void
}) {
  return (
    <header className="cm-top">
      <div className="cm-top-row">
        {onBack && (
          <button type="button" className="cm-top-back" onClick={onBack} aria-label="Quay lại"><ChevronLeft aria-hidden="true" /></button>
        )}
        {title === null || !onBack ? (
          <button type="button" className="cm-brand" onClick={onHome} aria-label={title === null ? 'Thầy Văn Anh Guitar — về Trang chủ' : `${title} — về Trang chủ`}>
            <img src="/logo-green.svg" alt="" width={28} height={27} />
            <span>{title === null ? 'Thầy Văn Anh Guitar' : title}</span>
          </button>
        ) : (
          <h1 className="cm-top-title">{title}</h1>
        )}
        <div className="cm-top-spacer" />
        <button type="button" className="cm-icon-btn" onClick={onNotices}
          aria-label={noticeCount > 0 ? `Thông báo, ${noticeCount} chưa đọc` : 'Thông báo'}>
          <Bell aria-hidden="true" />
          {noticeCount > 0 && <span className="cm-badge" aria-hidden="true">{badgeText(noticeCount)}</span>}
        </button>
        <button type="button" className="cm-icon-btn" onClick={onMore} aria-label="Chức năng khác: công cụ, thư viện, TeamLab">
          <LayoutGrid aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}

export function TabBar({ tab, badges, onSelect }: {
  tab: MobileTab
  badges: Partial<Record<MobileTab, number>>
  onSelect: (t: MobileTab) => void
}) {
  return (
    <nav className="cm-tabbar" aria-label="Điều hướng chính">
      {MOBILE_TABS.map(t => {
        const n = badges[t.id] ?? 0
        return (
          <button key={t.id} type="button" className="cm-tab" aria-current={tab === t.id ? 'page' : undefined}
            aria-label={n > 0 ? `${t.label}, ${n} chưa đọc` : t.label} onClick={() => onSelect(t.id)}>
            {TAB_ICON[t.id]}
            <span className="cm-tab-l">{t.label}</span>
            {n > 0 && <span className="cm-badge" aria-hidden="true">{badgeText(n)}</span>}
          </button>
        )
      })}
    </nav>
  )
}

export function BackBar({ onBack, label = 'Quay lại' }: { onBack: () => void; label?: string }) {
  return (
    <div className="cm-backbar">
      <button type="button" className="cm-back" onClick={onBack}><ChevronLeft aria-hidden="true" />{label}</button>
    </div>
  )
}
