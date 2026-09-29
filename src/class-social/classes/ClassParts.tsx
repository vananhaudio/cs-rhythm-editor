// Phần hiển thị THUẦN của trang lớp (không mạng, không CSS import) — test render được.
import { Eye, UserCheck, Users } from 'lucide-react'
import { Avatar, PersonLink } from '../ui'
import { classMetaLine, classStatusLabel, memberRelationUi, type ClassCard, type ClassMember } from './classModel'

export function ClassHeader({ c }: { c: ClassCard }) {
  const status = classStatusLabel(c.status)
  return (
    <section className="cs-card cs-class-head" aria-label={`Lớp ${c.name}`}>
      <div className="cs-class-head-top">
        <h1 className="cs-class-name">{c.name}</h1>
        {status && <span className="cs-class-status">{status}</span>}
      </div>
      {classMetaLine(c) && <p className="cs-class-meta">{classMetaLine(c)}</p>}
      <div className="cs-class-facts">
        {c.teachers.length > 0 && (
          <span className="cs-class-teachers">
            {c.teachers.slice(0, 3).map(t => <Avatar key={t.userId} name={t.name} url={t.avatarUrl} size={24} />)}
            {c.teachers.map(t => t.name).join(', ')}
          </span>
        )}
        <span><Users size={15} aria-hidden="true" /> {c.memberCount} học viên</span>
      </div>
      <p className={'cs-class-viewer' + (c.isMember ? ' is-member' : '')}>
        {c.isMember
          ? <><UserCheck size={15} aria-hidden="true" /> Bạn là thành viên lớp này</>
          : <><Eye size={15} aria-hidden="true" /> Bạn đang xem lớp {c.code ?? c.name} — bạn chưa tham gia lớp này.</>}
      </p>
    </section>
  )
}

export function MemberList({ members, busyId, onAct, onOpenProfile }: {
  members: ClassMember[]
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
            {m.isTeacher && <span className="cs-post-role">Giáo viên</span>}
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

