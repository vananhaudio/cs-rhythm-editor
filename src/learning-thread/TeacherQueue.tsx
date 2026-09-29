// /me/queue — hàng đợi Trả/Hỏi bài cho Thầy/admin (mọi giáo viên dùng chung; server kiểm vai trò).
// Mặc định: đang chờ Thầy, cũ nhất trước. Bấm một dòng → /me/t/<id> để phản hồi / làm lại / đạt.
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import './styles'
import { fetchTeacherQueue } from './ltApi'
import { QueueList } from './QueueList'
import type { QueueItem, ThreadStatus } from './ltModel'

const TABS: { status: ThreadStatus; label: string }[] = [
  { status: 'waiting_teacher', label: 'Chờ Thầy' },
  { status: 'needs_retry', label: 'Cần làm lại' },
  { status: 'teacher_responded', label: 'Đã phản hồi' },
  { status: 'passed', label: 'Đã đạt' },
]

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; items: QueueItem[]; hasMore: boolean }

export default function TeacherQueue({ onOpenThread, onBack }: { onOpenThread: (id: string) => void; onBack: () => void }) {
  const [tab, setTab] = useState<ThreadStatus>('waiting_teacher')
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [more, setMore] = useState(false)

  const [rev, setRev] = useState(0)
  useEffect(() => {
    let alive = true
    void fetchTeacherQueue(tab).then(r => {
      if (alive) setLoad(r.ok ? { status: 'ready', ...r.value } : { status: 'error', message: r.message })
    })
    return () => { alive = false }
  }, [tab, rev])
  const reload = useCallback(() => { setLoad({ status: 'loading' }); setRev(x => x + 1) }, [])
  const pickTab = (t: ThreadStatus) => { if (t !== tab) { setLoad({ status: 'loading' }); setTab(t) } }
  useEffect(() => { document.title = 'Hàng đợi Trả/Hỏi bài · Thầy Văn Anh Guitar' }, [])

  const loadMore = async () => {
    if (load.status !== 'ready' || more) return
    const last = load.items[load.items.length - 1]
    if (!last?.lastStudentEventAt) return
    setMore(true)
    const r = await fetchTeacherQueue(tab, { at: last.lastStudentEventAt, id: last.id })
    setMore(false)
    if (r.ok) setLoad({ status: 'ready', items: [...load.items, ...r.value.items], hasMore: r.value.hasMore })
  }

  return (
    <div className="cs-col cs-home lt-page">
      <div className="lt-actions">
        <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm" onClick={onBack}><ArrowLeft size={16} /> Quay lại</button>
      </div>
      <section className="lt-card" aria-labelledby="lt-queue-title">
        <h2 id="lt-queue-title" style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 800 }}>Hàng đợi Trả bài / Hỏi bài</h2>
        <div className="lt-tabs" role="group" aria-label="Lọc theo trạng thái">
          {TABS.map(t => <button key={t.status} type="button" aria-pressed={tab === t.status} onClick={() => pickTab(t.status)}>{t.label}</button>)}
        </div>
      </section>
      {load.status === 'loading' && <div className="lt-card lt-empty" role="status">Đang tải…</div>}
      {load.status === 'error' && (
        <div className="lt-card lt-empty" role="alert">{load.message}{' '}
          <button type="button" className="lt-link-btn" onClick={reload}>Thử lại</button>
        </div>
      )}
      {load.status === 'ready' && (
        <>
          <QueueList items={load.items} onOpen={onOpenThread}
            empty={tab === 'waiting_teacher' ? 'Không có bài nào đang chờ Thầy.' : 'Chưa có cuộc trao đổi nào ở mục này.'} />
          {load.hasMore && <button type="button" className="lt-btn is-ghost" disabled={more} onClick={() => void loadMore()}>{more ? 'Đang tải…' : 'Xem thêm'}</button>}
        </>
      )}
    </div>
  )
}
