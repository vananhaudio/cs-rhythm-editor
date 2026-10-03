// /me/classes — LỚP CỦA TÔI = BẢN ĐỒ CÁC LỚP CỦA HỌC SINH (không dashboard tiến độ, không feed, không học trực tiếp).
// Nhìn là nhận ra "lớp của mình đây": TÊN LỚP chính là lối vào lớp (không nút "Vào lớp"/"Tiếp tục học").
// Thứ tự cố định: lớp đang tham gia → "+ Nhập mã lớp" (hành động thật) → Lớp trước đây (nhẹ) → Các lớp khác (nhẹ).
// Không nhãn "Đang học" trên từng lớp; trạng thái chỉ còn nơi nó thật sự phân biệt (lớp đã kết thúc ở vùng riêng).
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { classMetaLine, currentClasses, filterClasses, PAST_CLASS_STATUSES, type ClassCard } from './classModel'
import { classPath } from '../resolveMeRoute'
import type { SocialClasses } from './useSocialClasses'
import JoinClassByCode from './JoinClassByCode'

const SEARCH_MIN = 7   // ít lớp khác thì không cần ô tìm

/** Một dòng lớp: tên (LINK vào lớp — mở tab mới/sao chép được) + một dòng phụ gọn. Không card, không nút phụ.
 *  meta: mặc định lịch · khoá; Home truyền riêng (chỉ lịch). */
export function ClassRow({ c, onOpen, quiet = false, meta = classMetaLine(c) }: {
  c: ClassCard; onOpen: (id: string) => void; quiet?: boolean; meta?: string | null
}) {
  return (
    <li className={'cs-classrow' + (quiet ? ' is-quiet' : '')}>
      <a className="cs-classrow-name" href={classPath(c.id)} onClick={e => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        e.preventDefault(); onOpen(c.id)
      }}>{c.name}</a>
      {meta && <span className="cs-classrow-meta">{meta}</span>}
    </li>
  )
}

export default function ClassesPage({ classes, onOpenClass, onJoined }: {
  classes: SocialClasses; onOpenClass: (id: string) => void
  /** Vừa tham gia bằng mã: nạp lại Lớp của tôi/sidebar + danh tính học tập, rồi mở lớp */
  onJoined?: (id: string) => void
}) {
  const [q, setQ] = useState('')
  const [joining, setJoining] = useState(false)
  const current = currentClasses(classes.mine)
  const past = classes.mine.filter(c => PAST_CLASS_STATUSES.has(c.status ?? ''))
  const others = filterClasses(classes.discover, q)
  const noClass = classes.loaded && classes.mine.length === 0
  return (
    <div className="cs-col cs-home cs-myclasses-page">
      <h1 className="cs-page-title">Lớp của tôi</h1>
      {!classes.loaded && <p className="cs-loading" role="status">Đang tải lớp học…</p>}
      {classes.loaded && classes.error && <p className="cs-form-error" role="alert">{classes.error}</p>}

      {current.length > 0 && <ul className="cs-classrows" aria-label="Lớp đang tham gia">{current.map(c => <ClassRow key={c.id} c={c} onOpen={onOpenClass} />)}</ul>}
      {noClass && <p className="cs-section-hint">Bạn chưa ở trong lớp nào. Nhập mã lớp Thầy gửi để vào lớp.</p>}

      {classes.loaded && (noClass || joining
        ? <JoinClassByCode onJoined={id => (onJoined ?? onOpenClass)(id)} />
        : <button type="button" className="cs-linkbtn cs-join-open" onClick={() => setJoining(true)}>
            <Plus size={16} aria-hidden="true" /> Nhập mã lớp
          </button>)}

      {past.length > 0 && (
        <section className="cs-classes-past" aria-labelledby="cs-past-title">
          <h2 id="cs-past-title" className="cs-subtle-title">Lớp trước đây</h2>
          <ul className="cs-classrows">{past.map(c => <ClassRow key={c.id} c={c} onOpen={onOpenClass} quiet />)}</ul>
        </section>
      )}

      {classes.loaded && classes.discover.length > 0 && (
        <section className="cs-classes-discover" aria-labelledby="cs-others-title">
          <h2 id="cs-others-title" className="cs-subtle-title">Các lớp khác</h2>
          {classes.discover.length >= SEARCH_MIN && (
            <input className="cs-input cs-classes-search" type="search" placeholder="Tìm lớp theo tên hoặc mã" value={q}
              onChange={e => setQ(e.target.value)} aria-label="Tìm lớp" />
          )}
          {others.length > 0
            ? <ul className="cs-classrows">{others.map(c => <ClassRow key={c.id} c={c} onOpen={onOpenClass} quiet />)}</ul>
            : <p className="cs-section-hint">Không tìm thấy lớp phù hợp.</p>}
        </section>
      )}
    </div>
  )
}
