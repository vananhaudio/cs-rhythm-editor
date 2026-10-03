// Home → tab "Lớp": phần đầu = LỚP CỦA TÔI (tổng quan cực gọn) — rồi mới tới hoạt động từ các lớp.
// Cùng NGUỒN với sidebar và /me/classes (useSocialClasses → currentClasses, thứ tự server); khác cách trình bày:
// chỉ tên lớp (link vào lớp) + lịch nếu có. Không trạng thái/tiến độ/buổi/sĩ số; lớp trước đây & lớp khác ở /me/classes.
// "+ Nhập mã lớp" mở đúng ô Join Code sẵn có (không RPC/modal mới); tham gia xong lớp hiện ngay tại đây.
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { currentClasses } from './classModel'
import type { SocialClasses } from './useSocialClasses'
import JoinClassByCode from './JoinClassByCode'
import { ClassRow } from './ClassesPage'

export default function HomeClasses({ classes, onOpenClass, onJoined }: {
  classes: SocialClasses
  onOpenClass: (id: string) => void
  /** Vừa tham gia bằng mã: nạp lại danh sách lớp (sidebar · tab Lớp · /me/classes) + danh tính học tập — ở lại tab */
  onJoined?: (id: string) => void
}) {
  const [joining, setJoining] = useState(false)
  const current = currentClasses(classes.mine)
  return (
    <section className="cs-home-classes" aria-labelledby="cs-home-classes-title" aria-busy={!classes.loaded}>
      <h2 id="cs-home-classes-title" className="cs-subtle-title">Lớp của tôi</h2>
      {!classes.loaded
        ? <p className="cs-loading cs-home-classes-loading" role="status">Đang tải lớp học…</p>
        : classes.mineFailed
          ? <p className="cs-section-hint">Chưa tải được danh sách lớp.</p>
          : current.length > 0
            ? <ul className="cs-classrows">{current.map(c => <ClassRow key={c.id} c={c} onOpen={onOpenClass} meta={c.schedule} />)}</ul>
            : <p className="cs-section-hint">Bạn chưa có lớp nào.</p>}
      {classes.loaded && (joining
        ? <JoinClassByCode onOpen={onOpenClass} onJoined={id => { setJoining(false); (onJoined ?? onOpenClass)(id) }} />
        : <button type="button" className="cs-linkbtn cs-join-open" onClick={() => setJoining(true)}>
            <Plus size={16} aria-hidden="true" /> Nhập mã lớp
          </button>)}
    </section>
  )
}
