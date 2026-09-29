// Thầy/admin: một dòng nhỏ "N bài đang chờ phản hồi ›" trên Home (chỉ khi N > 0).
// Học sinh: danh sách "Trả bài / Hỏi bài của tôi" (dùng ở nơi cần; Home không còn hiện — xem tab Hành trình).
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
    // Home = con người + hoạt động: chỉ hiện MỘT dòng nhỏ khi thật sự có bài chờ; 0 bài → không dựng thẻ.
    if (!waiting) return null
    return (
      <button type="button" className="cs-queue-entry" onClick={onOpenQueue} aria-label="Hàng đợi Trả bài / Hỏi bài">
        <ListChecks size={18} aria-hidden="true" />
        <span>{waiting}{waiting >= 30 ? '+' : ''} bài đang chờ phản hồi</span>
        <span aria-hidden="true">›</span>
      </button>
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
