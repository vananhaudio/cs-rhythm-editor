// Sidebar "LỚP HỌC": các lớp CỦA TÔI hiện TRỰC TIẾP (bấm là vào lớp), rồi vài lớp KHÁM PHÁ (xác định:
// đang học/tuyển sinh, mới nhất), rồi "Tất cả lớp". Không bắt học sinh mở thêm một trang mới thấy lớp mình.
// Component lá (không mạng, không CSS import) — dữ liệu từ useSocialClasses ở ClassSocialPage.
import { Compass } from 'lucide-react'
import { classFullTitle, classShortName, type ClassCard } from './classModel'

const MY_CLASSES_IN_NAV = 5
const DISCOVER_IN_NAV = 3

function Dot({ filled }: { filled: boolean }) {
  return <span className={'cs-class-dot' + (filled ? ' is-mine' : '')} aria-hidden="true" />
}

export default function ClassNav({ mine, discover, loaded, activeClassId, classesActive, collapsed, onOpenClass, onOpenClasses }: {
  mine: ClassCard[]
  discover: ClassCard[]
  loaded: boolean
  activeClassId: string | null
  classesActive: boolean
  collapsed: boolean
  onOpenClass: (id: string) => void
  onOpenClasses: () => void
}) {
  const shownMine = mine.slice(0, MY_CLASSES_IN_NAV)
  const shownDiscover = discover.slice(0, DISCOVER_IN_NAV)
  const entry = (c: ClassCard, mineRow: boolean) => {
    const active = c.id === activeClassId
    return (
      <button key={c.id} type="button" className={'cs-nav-item cs-class-item' + (active ? ' is-active' : '')}
        aria-current={active ? 'page' : undefined} title={classFullTitle(c)}
        onClick={() => onOpenClass(c.id)}>
        <Dot filled={mineRow} />
        <span className="cs-nav-text">{classShortName(c)}</span>
      </button>
    )
  }
  return (
    <nav className="cs-nav-group" aria-label="Lớp học">
      <div className="cs-nav-title">Lớp học</div>
      {shownMine.map(c => entry(c, true))}
      {loaded && mine.length === 0 && !collapsed && <p className="cs-nav-empty">Bạn chưa ở trong lớp nào.</p>}
      {shownDiscover.length > 0 && (
        <>
          {!collapsed && <div className="cs-nav-subtitle">Khám phá</div>}
          {shownDiscover.map(c => entry(c, false))}
        </>
      )}
      <button type="button" className={'cs-nav-item' + (classesActive ? ' is-active' : '')} aria-current={classesActive ? 'page' : undefined}
        title={collapsed ? 'Tất cả lớp' : undefined} onClick={onOpenClasses}>
        <Compass size={21} strokeWidth={classesActive ? 2.2 : 1.9} />
        <span className="cs-nav-text">{mine.length > MY_CLASSES_IN_NAV ? 'Xem tất cả lớp' : 'Tất cả lớp'}</span>
      </button>
    </nav>
  )
}
