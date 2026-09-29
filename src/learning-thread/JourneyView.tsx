// Tab HÀNH TRÌNH trên trang cá nhân (/me/u/<id>) — tải learning_journey (quyền do server: chính chủ/Thầy thấy
// tất cả; thành viên khác chỉ thấy thread community). Nguồn duy nhất = Learning Thread + snapshot (không bảng journey).
import { useEffect, useState } from 'react'
import './styles'
import { fetchJourney } from './ltApi'
import type { JourneyItem } from './feedModel'
import JourneyTimeline from './JourneyTimeline'

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; items: JourneyItem[] }

export default function JourneyView({ userId, ownerName, onOpenThread }: { userId: string; ownerName: string; onOpenThread: (id: string) => void }) {
  const [load, setLoad] = useState<{ key: string; value: Load } | null>(null)
  const [rev, setRev] = useState(0)
  useEffect(() => {
    let alive = true
    void fetchJourney(userId).then(r => {
      if (alive) setLoad({ key: userId + ':' + rev, value: r.ok ? { status: 'ready', items: r.value } : { status: 'error', message: r.message } })
    })
    return () => { alive = false }
  }, [userId, rev])
  const cur: Load = load?.key === userId + ':' + rev ? load.value : { status: 'loading' }
  if (cur.status === 'loading') return <div className="lt-card lt-empty lt-page" role="status">Đang tải Hành trình…</div>
  if (cur.status === 'error') {
    return (
      <div className="lt-card lt-empty lt-page" role="alert">{cur.message}{' '}
        <button type="button" className="lt-link-btn" onClick={() => setRev(x => x + 1)}>Thử lại</button>
      </div>
    )
  }
  return <div className="lt-page"><JourneyTimeline items={cur.items} ownerName={ownerName} onOpenThread={onOpenThread} /></div>
}
