// /me/classes — LỚP CỦA TÔI + KHÁM PHÁ LỚP. Không phải trang bán khoá: chỉ lớp thật, người thật, hoạt động thật.
import { useState } from 'react'
import { GraduationCap, Search } from 'lucide-react'
import { EmptyState } from '../ui'
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

export default function ClassesPage({ classes, onOpenClass }: { classes: SocialClasses; onOpenClass: (id: string) => void }) {
  const [q, setQ] = useState('')
  const mine = filterClasses(classes.mine, q)
  const discover = filterClasses(classes.discover, q)
  return (
    <div className="cs-col cs-home">
      <h1 className="cs-page-title">Lớp học</h1>
      <label className="cs-class-search">
        <Search size={17} aria-hidden="true" />
        <input className="cs-input" type="search" placeholder="Tìm lớp theo tên hoặc mã" value={q} onChange={e => setQ(e.target.value)} aria-label="Tìm lớp" />
      </label>
      {!classes.loaded && <div className="cs-card" role="status">Đang tải lớp học…</div>}
      {classes.loaded && classes.error && <p className="cs-form-error" role="alert">{classes.error}</p>}
      {classes.loaded && (
        <>
          <section className="cs-classes-mine" aria-labelledby="cs-mine-title">
            <h2 id="cs-mine-title" className="cs-feed-title">Lớp của tôi</h2>
            {mine.length > 0
              ? <div className="cs-class-grid">{mine.map(c => <ClassTile key={c.id} c={c} onOpen={onOpenClass} />)}</div>
              : <div className="cs-card"><EmptyState icon={GraduationCap} title={q ? 'Không có lớp nào khớp' : 'Bạn chưa ở trong lớp nào'}>
                  {q ? 'Thử tìm bằng tên khác.' : 'Khi được xếp vào lớp, lớp sẽ hiện ở đây và trên thanh bên.'}
                </EmptyState></div>}
          </section>
          <section className="cs-classes-discover" aria-labelledby="cs-discover-title">
            <h2 id="cs-discover-title" className="cs-feed-title">Khám phá lớp</h2>
            <p className="cs-section-hint">Nhìn vào các lớp khác xem mọi người đang học gì — bài thật, Thầy sửa thật.</p>
            {discover.length > 0
              ? <div className="cs-class-grid">{discover.map(c => <ClassTile key={c.id} c={c} onOpen={onOpenClass} />)}</div>
              : <p className="cs-section-hint">Hiện chưa có lớp nào khác đang mở.</p>}
          </section>
        </>
      )}
    </div>
  )
}
