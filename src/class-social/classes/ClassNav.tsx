// Sidebar "LỚP HỌC": các lớp HIỆN TẠI của tôi hiện TRỰC TIẾP (bấm là vào lớp; thứ tự do server, không xếp lại theo hoạt động)
// + MỘT mục cố định "Lớp của tôi" (/me/classes — bản đồ các lớp, mã tham gia, lớp trước đây, các lớp khác).
// Component lá (không mạng, không CSS import) — dữ liệu từ useSocialClasses ở ClassSocialPage.
import { GraduationCap } from 'lucide-react'
import { classFullTitle, classShortName, currentClasses, type ClassCard } from './classModel'

const MY_CLASSES_IN_NAV = 5

export default function ClassNav({ mine, activeClassId, classesActive, collapsed, onOpenClass, onOpenClasses }: {
  mine: ClassCard[]
  /** (giữ trong hợp đồng props; danh sách rỗng khi chưa tải) */
  loaded: boolean
  activeClassId: string | null
  classesActive: boolean
  collapsed: boolean
  onOpenClass: (id: string) => void
  /** /me/classes — Lớp của tôi */
  onOpenClasses: () => void
}) {
  const shown = currentClasses(mine).slice(0, MY_CLASSES_IN_NAV)   // cùng tập + thứ tự với tab "Lớp" và /me/classes
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
            <button type="button" className={'cs-nav-item' + (classesActive ? ' is-active' : '')} aria-current={classesActive ? 'page' : undefined}
        title={collapsed ? 'Lớp của tôi' : undefined} onClick={onOpenClasses}>
        <GraduationCap size={21} strokeWidth={classesActive ? 2.2 : 1.9} />
        <span className="cs-nav-text">Lớp của tôi</span>
      </button>
    </nav>
  )
}
