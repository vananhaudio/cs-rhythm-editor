// Sidebar "LỚP HỌC": các lớp CỦA TÔI hiện TRỰC TIẾP (bấm là vào lớp) — không trộn lớp chưa tham gia.
// Lớp khác chỉ qua MỘT lối "Khám phá lớp khác" (/me/classes). Nhiều lớp hơn chỗ hiện → "Tất cả lớp của tôi" (/me?feed=classes).
// Component lá (không mạng, không CSS import) — dữ liệu từ useSocialClasses ở ClassSocialPage.
import { Compass, GraduationCap } from 'lucide-react'
import { classFullTitle, classShortName, type ClassCard } from './classModel'

const MY_CLASSES_IN_NAV = 5

export default function ClassNav({ mine, loaded, activeClassId, classesActive, collapsed, onOpenClass, onOpenClasses, onOpenMyClasses }: {
  mine: ClassCard[]
  loaded: boolean
  activeClassId: string | null
  classesActive: boolean
  collapsed: boolean
  onOpenClass: (id: string) => void
  /** /me/classes — Khám phá các lớp khác */
  onOpenClasses: () => void
  /** /me?feed=classes — Lớp của tôi */
  onOpenMyClasses: () => void
}) {
  const shown = mine.slice(0, MY_CLASSES_IN_NAV)
  return (
    <nav className="cs-nav-group" aria-label="Lớp học">
      <div className="cs-nav-title">Lớp học</div>
      {shown.map(c => {
        const active = c.id === activeClassId
        return (
          <button key={c.id} type="button" className={'cs-nav-item cs-class-item' + (active ? ' is-active' : '')}
            aria-current={active ? 'page' : undefined} title={classFullTitle(c)} onClick={() => onOpenClass(c.id)}>
            <span className="cs-class-dot is-mine" aria-hidden="true" />
            <span className="cs-nav-text">{classShortName(c)}</span>
          </button>
        )
      })}
      {loaded && mine.length === 0 && !collapsed && <p className="cs-nav-empty">Bạn chưa ở trong lớp nào.</p>}
      {mine.length > MY_CLASSES_IN_NAV && (
        <button type="button" className="cs-nav-item" title={collapsed ? 'Tất cả lớp của tôi' : undefined} onClick={onOpenMyClasses}>
          <GraduationCap size={21} strokeWidth={1.9} />
          <span className="cs-nav-text">Tất cả lớp của tôi</span>
        </button>
      )}
      <button type="button" className={'cs-nav-item' + (classesActive ? ' is-active' : '')} aria-current={classesActive ? 'page' : undefined}
        title={collapsed ? 'Khám phá lớp khác' : undefined} onClick={onOpenClasses}>
        <Compass size={21} strokeWidth={classesActive ? 2.2 : 1.9} />
        <span className="cs-nav-text">Khám phá lớp khác</span>
      </button>
    </nav>
  )
}
