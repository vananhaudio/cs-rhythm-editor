// Phần đầu DÙNG CHUNG của trang lớp (Giáo trình · Không gian lớp): [← Lớp của tôi · Chia sẻ] → tên lớp → lịch → thanh phân đoạn.
// Hai khu vực render cùng cấu trúc + cùng nguồn dữ liệu (social_class_detail) nên tên lớp / thanh điều hướng không đổi toạ độ khi chuyển.
// Thông báo theo vai trò (xem trước, chưa tham gia) KHÔNG nằm ở đây — đặt ở vùng nội dung bên dưới để không làm dịch header.
import { useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import ShareButton from '../../share/ShareButton'
import type { ClassCard } from './classModel'
import { ClassSectionNav } from './ClassParts'

// Giữ tên/lịch đã biết của lớp trong phiên: sang khu vực kia header vẽ ngay đúng chữ cũ, không chờ mạng rồi giật.
const known = new Map<string, { name: string | null; schedule: string | null }>()

export default function ClassHead({ classId, card, fallbackName, canShare, active, onOpenClasses, onOpenSyllabus, onOpenSpace }: {
  classId: string
  card: ClassCard | null
  fallbackName?: string | null
  canShare: boolean
  active: 'syllabus' | 'space'
  onOpenClasses: () => void
  onOpenSyllabus: () => void
  onOpenSpace: () => void
}) {
  const prev = known.get(classId)
  const name = card?.name ?? fallbackName ?? prev?.name ?? null
  const schedule = card ? card.schedule : prev?.schedule ?? null
  useEffect(() => { if (card) known.set(classId, { name: card.name, schedule: card.schedule }) }, [classId, card])
  return (
    <header className="cs-classhead">
      <div className="cs-classhead-top">
        <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm cs-profile-back" onClick={onOpenClasses}><ArrowLeft size={16} /> Lớp của tôi</button>
        {canShare && name && <ShareButton target={{ type: 'class', key: classId.toLowerCase() }} title={name} />}
      </div>
      <div className="cs-classv2-head">
        <h1 className="cs-class-name">{name ?? ' '}</h1>
        {schedule && <p className="cs-classv2-meta">{schedule}</p>}
      </div>
      <ClassSectionNav classId={classId} active={active} onOpenSyllabus={onOpenSyllabus} onOpenSpace={onOpenSpace} />
    </header>
  )
}
