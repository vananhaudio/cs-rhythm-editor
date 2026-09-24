// V1: MỘT hành động duy nhất ngay dưới identity — TRẢ BÀI (hiểu rộng: gửi bài để Thầy nhận xét,
// hỏi Thầy về một chỗ trong bài, chia sẻ đoạn đang luyện). Không bắt học sinh phân loại.
import { useCallback, useState } from 'react'
import { Upload } from 'lucide-react'
import type { ClassIdentity } from '../useClassSession'
import { Avatar } from '../ui'
import AssignmentComposer from './AssignmentComposer'

export default function TraBaiCta({ me, onPosted }: { me: ClassIdentity; onPosted: () => void }) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const posted = useCallback(() => { setOpen(false); onPosted() }, [onPosted])
  return (
    <section className="cs-card cs-cta-card" aria-label="Trả bài">
      <Avatar name={me.name} url={me.avatarUrl} size={40} />
      <button type="button" className="cs-cta-main" onClick={() => setOpen(true)}>
        <Upload size={19} strokeWidth={2.2} />
        <span>Trả bài</span>
      </button>
      {open && <AssignmentComposer me={me} onClose={close} onPosted={posted} />}
    </section>
  )
}
