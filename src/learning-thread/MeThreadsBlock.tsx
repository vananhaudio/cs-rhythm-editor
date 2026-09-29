// Khối trên /me: học sinh → "Trả bài / Hỏi bài của tôi" (tiếp tục thread đã có ngữ cảnh bài học);
// Thầy/admin → lối vào hàng đợi. Không có gì để hiện → không render (không làm rối trang chủ).
// Khởi tạo Trả/Hỏi bài vẫn ở App học (đúng bài đang học) — ở đây chỉ tiếp tục.
import { useEffect, useState } from 'react'
import { ListChecks } from 'lucide-react'
import './styles'
import { fetchMyThreads, fetchTeacherQueue } from './ltApi'
import { MyThreadList } from './QueueList'
import type { MyThread } from './ltModel'

export default function MeThreadsBlock({ isTeacher, onOpenThread, onOpenQueue }: {
  isTeacher: boolean
  onOpenThread: (id: string) => void
  onOpenQueue: () => void
}) {
  const [mine, setMine] = useState<MyThread[] | null>(null)
  const [waiting, setWaiting] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    if (isTeacher) {
      void fetchTeacherQueue('waiting_teacher').then(r => { if (alive && r.ok) setWaiting(r.value.items.length) })
    } else {
      void fetchMyThreads(5).then(r => { if (alive && r.ok) setMine(r.value.filter(t => t.status !== 'archived')) })
    }
    return () => { alive = false }
  }, [isTeacher])

  if (isTeacher) {
    return (
      <section className="cs-card lt-page" style={{ padding: 14 }} aria-label="Hàng đợi Trả bài / Hỏi bài">
        <button type="button" className="lt-row" onClick={onOpenQueue} style={{ border: 'none', padding: 0 }}>
          <ListChecks size={22} aria-hidden="true" />
          <span className="lt-row-main">
            <span className="lt-row-title">Hàng đợi Trả bài / Hỏi bài</span>
            <span className="lt-row-sub">{waiting === null ? 'Xem các bài học sinh đang chờ Thầy' : waiting === 0 ? 'Không có bài nào đang chờ' : `${waiting}${waiting >= 30 ? '+' : ''} cuộc trao đổi đang chờ Thầy`}</span>
          </span>
        </button>
      </section>
    )
  }
  if (!mine || mine.length === 0) return null
  return (
    <section className="cs-card lt-page" style={{ padding: 14, gap: 10 }} aria-labelledby="lt-mine-title">
      <h2 id="lt-mine-title" style={{ margin: 0, fontSize: 16 }}>Trả bài / Hỏi bài của tôi</h2>
      <MyThreadList items={mine} onOpen={onOpenThread} />
    </section>
  )
}
