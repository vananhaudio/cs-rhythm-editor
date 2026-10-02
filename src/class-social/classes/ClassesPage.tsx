// /me/classes — KHÁM PHÁ CÁC LỚP KHÁC (lớp mình CHƯA tham gia). Lớp của mình ở /me?feed=classes (bảng Lớp của tôi).
// Không phải trang bán khoá: chỉ lớp thật, người thật, hoạt động thật.
import { useState } from 'react'
import { ArrowLeft, Search } from 'lucide-react'
import { classMetaLine, classStatusLabel, filterClasses, type ClassCard } from './classModel'
import type { SocialClasses } from './useSocialClasses'

export function ClassTile({ c, onOpen }: { c: ClassCard; onOpen: (id: string) => void }) {
  const status = classStatusLabel(c.status)
  const meta = classMetaLine(c)
  return (
    <button type="button" className={'cs-card cs-class-tile' + (c.isMember ? ' is-mine' : '')} onClick={() => onOpen(c.id)} aria-label={`Mở lớp ${c.name}`}>
      <span className="cs-class-tile-name">{c.name}</span>
      {meta && <span className="cs-class-tile-meta">{meta}</span>}
      <span className="cs-class-tile-facts">
        {c.isMember && <span className="cs-badge">Bạn đang tham gia</span>}
        {status && <span className="cs-class-status">{status}</span>}
        {!c.isMember && c.memberCount > 0 && <span>{c.memberCount} học viên</span>}
        {c.activityCount > 0 && <span>{c.activityCount} hoạt động</span>}
      </span>
    </button>
  )
}

export default function ClassesPage({ classes, onOpenClass, onOpenMyClasses }: {
  classes: SocialClasses; onOpenClass: (id: string) => void; onOpenMyClasses: () => void
}) {
  const [q, setQ] = useState('')
  const discover = filterClasses(classes.discover, q)
  return (
    <div className="cs-col cs-home">
      <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm cs-profile-back" onClick={onOpenMyClasses}><ArrowLeft size={16} /> Lớp của tôi</button>
      <h1 className="cs-page-title">Khám phá các lớp khác</h1>
      <p className="cs-section-hint">Xem các lớp khác đang học gì. Lớp bạn đang tham gia nằm ở “Lớp của tôi”.</p>
      <label className="cs-class-search">
        <Search size={17} aria-hidden="true" />
        <input className="cs-input" type="search" placeholder="Tìm lớp theo tên hoặc mã" value={q} onChange={e => setQ(e.target.value)} aria-label="Tìm lớp" />
      </label>
      {!classes.loaded && <p className="cs-loading" role="status">Đang tải lớp học…</p>}
      {classes.loaded && classes.error && <p className="cs-form-error" role="alert">{classes.error}</p>}
      {classes.loaded && (
        <section className="cs-classes-discover" aria-label="Khám phá các lớp khác">
          {discover.length > 0
            ? <div className="cs-class-grid">{discover.map(c => <ClassTile key={c.id} c={c} onOpen={onOpenClass} />)}</div>
            : <p className="cs-section-hint">{q ? 'Không tìm thấy lớp phù hợp.' : 'Hiện chưa có lớp nào khác đang mở.'}</p>}
        </section>
      )}
    </div>
  )
}
