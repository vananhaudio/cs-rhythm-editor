// Phần hiển thị THUẦN của trang lớp (không mạng, không CSS import) — test render được.
import { Eye, UserCheck, Users } from 'lucide-react'
import { classMembersPath, classPath, classSpacePath } from '../resolveMeRoute'
import { Avatar, PersonLink } from '../ui'
import { IdentityBadges } from '../identity/IdentityBadges'
import { classCodeNote, classMetaLine, classStatusLabel, memberRelationUi, type ClassCard, type ClassMember } from './classModel'

export function ClassHeader({ c }: { c: ClassCard }) {
  const status = classStatusLabel(c.status)
  const meta = classMetaLine(c)
  const codes = classCodeNote(c)
  return (
    <section className="cs-card cs-class-head" aria-label={`Lớp ${c.name}`}>
      <div className="cs-class-head-top">
        <h1 className="cs-class-name">{c.name}</h1>
        {status && <span className="cs-class-status">{status}</span>}
      </div>
      <div className="cs-class-facts">
        {c.teachers.length > 0 && (
          <span className="cs-class-teachers">
            {c.teachers.slice(0, 3).map(t => <Avatar key={t.userId} name={t.name} url={t.avatarUrl} size={26} />)}
            {c.teachers.map(t => t.name).join(', ')}
          </span>
        )}
        {c.memberCount > 0 && <span><Users size={15} aria-hidden="true" /> {c.memberCount} học viên</span>}
        {meta && <span>{meta}</span>}
      </div>
      <p className={'cs-class-viewer' + (c.isMember ? ' is-member' : '')}>
        {c.isMember
          ? <><UserCheck size={15} aria-hidden="true" /> Bạn là thành viên lớp này</>
          : <><Eye size={15} aria-hidden="true" /> Bạn đang xem lớp này — bạn chưa tham gia.</>}
      </p>
      {codes && <p className="cs-class-codes">{codes}</p>}
    </section>
  )
}

export function MemberList({ members, busyId, onAct, onOpenProfile, excludeIdentity }: {
  members: ClassMember[]
  /** Chương trình của CHÍNH lớp này — không lặp nhãn đó cho mọi thành viên, chỉ hiện chương trình KHÁC */
  excludeIdentity?: string | null
  busyId: string | null
  onAct: (m: ClassMember, action: 'send' | 'accept') => void
  onOpenProfile?: (userId: string) => void
}) {
  return (
    <ul className="cs-card cs-member-list" aria-label="Thành viên lớp">
      {members.map(m => {
        const ui = memberRelationUi(m.relationship)
        return (
          <li key={m.userId} className="cs-member">
            <PersonLink userId={m.userId} onOpen={onOpenProfile} label={`Trang cá nhân của ${m.name}`}>
              <Avatar name={m.name} url={m.avatarUrl} size={40} />
            </PersonLink>
            <PersonLink userId={m.userId} onOpen={onOpenProfile} label={`Trang cá nhân của ${m.name}`} className="cs-member-name">{m.name}</PersonLink>
            {m.isTeacher ? <span className="cs-post-role">Giáo viên</span> : <IdentityBadges userId={m.userId} exclude={excludeIdentity} />}
            <span className="cs-member-rel">
              {ui.action
                ? <button type="button" className="cs-btn cs-btn-sm cs-btn-soft" disabled={busyId === m.userId} onClick={() => onAct(m, ui.action!)}>{ui.label}</button>
                : <span className="cs-member-rel-text">{ui.label}</span>}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** Điều hướng ba khu vực của CÙNG một lớp: Giáo trình (/me/classes/<id>) · Không gian lớp (…/space) · Thành viên (…/members).
 *  Ba route, hiển thị như một thanh phân đoạn nhẹ — không phải hệ tab mới, URL/reload/deep link giữ nguyên. */
export type ClassSection = 'syllabus' | 'space' | 'members'
export function ClassSectionNav({ classId, active, onOpenSyllabus, onOpenSpace, onOpenMembers }: {
  classId: string; active: ClassSection; onOpenSyllabus: () => void; onOpenSpace: () => void; onOpenMembers: () => void
}) {
  const item = (key: ClassSection, label: string, href: string, go: () => void, extra = '') => (
    <a key={key} className={'cs-secnav-item' + (active === key ? ' is-active' : '') + extra} href={href}
      aria-current={active === key ? 'page' : undefined}
      onClick={e => { if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); if (active !== key) go() }}>
      {label}
    </a>
  )
  return (
    <nav className="cs-secnav" aria-label="Khu vực của lớp">
      {item('syllabus', 'Giáo trình', classPath(classId), onOpenSyllabus)}
      {item('space', 'Không gian lớp', classSpacePath(classId), onOpenSpace, ' cs-secnav-space')}
      {item('members', 'Thành viên', classMembersPath(classId), onOpenMembers, ' cs-secnav-members')}
    </nav>
  )
}
