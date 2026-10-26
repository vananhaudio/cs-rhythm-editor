// Danh sách người đã chặn + bỏ chặn (Tôi → Tài khoản & cài đặt).
import { useEffect, useState } from 'react'
import { fetchMyBlocks, type BlockedUser } from './api'
import { Avatar } from '../class-social/ui'
import BlockConfirm from './BlockConfirm'

type St = { s: 'loading' } | { s: 'error'; msg: string } | { s: 'ready'; items: BlockedUser[] }

export default function BlockedUsersPage({ onBack }: { onBack: () => void }) {
  const [st, setSt] = useState<St>({ s: 'loading' })
  const [target, setTarget] = useState<BlockedUser | null>(null)
  const [rev, setRev] = useState(0)
  const reload = () => { setSt({ s: 'loading' }); setRev(x => x + 1) }
  useEffect(() => {
    let alive = true
    void fetchMyBlocks().then(r => { if (alive) setSt(r.ok ? { s: 'ready', items: r.value } : { s: 'error', msg: r.message }) })
    return () => { alive = false }
  }, [rev])

  return (
    <div className="cm-page">
      <button type="button" className="csafe-mini" onClick={onBack}>‹ Quay lại</button>
      <h1 className="cm-title">Người đã chặn</h1>
      <p className="cm-note" style={{ marginTop: 0 }}>Bạn không thấy nội dung của những người này (và họ không thấy của bạn). Bỏ chặn để thấy lại.</p>
      {st.s === 'loading' && <p className="cm-note" role="status">Đang tải…</p>}
      {st.s === 'error' && (
        <div className="cm-note" role="alert">{st.msg} <button type="button" className="csafe-mini" onClick={reload}>Thử lại</button></div>
      )}
      {st.s === 'ready' && st.items.length === 0 && <p className="cm-note">Bạn chưa chặn ai.</p>}
      {st.s === 'ready' && st.items.length > 0 && (
        <ul className="csafe-blocked">
          {st.items.map(u => (
            <li key={u.userId}>
              <Avatar name={u.name} url={u.avatarUrl} size={40} />
              <span className="nm">{u.name}</span>
              <button type="button" className="csafe-mini" onClick={() => setTarget(u)}>Bỏ chặn</button>
            </li>
          ))}
        </ul>
      )}
      {target && <BlockConfirm userId={target.userId} name={target.name} unblock onClose={() => setTarget(null)} onDone={reload} />}
    </div>
  )
}
