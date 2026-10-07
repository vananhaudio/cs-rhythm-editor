// "Gửi bạn bè" (Chat V1b): chọn MỘT người bạn accepted → gửi THAM CHIẾU tới object (không ghi chú, không sao chép nội dung).
// Tự chứa style (nằm trên cả trang tối BMS lẫn Feed sáng). Quyền do DB quyết (dm_share): hết bạn / object không còn → báo lỗi dịu.
import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchFriends } from '../friends/friendsApi'
import type { PersonCard } from '../friends/friendModel'
import { shareToFriend } from './chatApi'
import { chatConversationPath } from '../resolveMeRoute'

const FONT = `'Be Vietnam Pro',system-ui,sans-serif`
const S = {
  overlay: { position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(8,10,16,.62)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontFamily: FONT } as const,
  card: { width: 'min(100%, 440px)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: '#fff', color: '#16161a', borderRadius: '18px 18px 0 0', padding: '16px 16px max(16px, env(safe-area-inset-bottom))', boxShadow: '0 -8px 32px rgba(0,0,0,.3)' } as const,
  row: (on: boolean) => ({ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 48, padding: '8px 10px', border: `2px solid ${on ? '#6C63FF' : 'transparent'}`, borderRadius: 12, background: on ? '#f1f0ff' : '#f6f6f8', color: '#16161a', fontSize: 15, fontWeight: 600, textAlign: 'left', cursor: 'pointer', fontFamily: FONT } as const),
  btn: { minHeight: 46, border: 'none', borderRadius: 12, background: '#6C63FF', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, padding: '0 16px' } as const,
  ghost: { minHeight: 44, border: '1px solid #d8d8de', borderRadius: 12, background: '#fff', color: '#16161a', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, padding: '0 16px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } as const,
}

type Loaded = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; friends: PersonCard[] }

export default function ShareToFriendSheet({ artifactId, title, onClose }: { artifactId: string; title: string; onClose: () => void }) {
  const [state, setState] = useState<Loaded>({ status: 'loading' })
  const [picked, setPicked] = useState<PersonCard | null>(null)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ name: string; conversationId: string } | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let alive = true
    void fetchFriends().then(r => { if (alive) setState(r.ok ? { status: 'ready', friends: r.value } : { status: 'error', message: r.message }) })
    return () => { alive = false }
  }, [])
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const friends = useMemo(() => {
    if (state.status !== 'ready') return []
    const t = q.trim().toLowerCase()
    return t ? state.friends.filter(f => f.name.toLowerCase().includes(t)) : state.friends
  }, [state, q])

  const send = async () => {
    if (!picked || busyRef.current) return   // chống bấm đúp: MỘT lần gửi
    busyRef.current = true; setBusy(true); setError(null)
    const r = await shareToFriend(picked.userId, artifactId)
    if (r.ok) setDone({ name: picked.name, conversationId: r.value.conversationId })
    else { setError(r.message); busyRef.current = false }
    setBusy(false)
  }

  return (
    <div style={S.overlay} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={S.card} role="dialog" aria-modal="true" aria-label="Gửi bạn bè">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>Gửi bạn bè</div>
          <button ref={closeRef} type="button" onClick={onClose} style={{ ...S.ghost, minHeight: 36, padding: '0 12px' }}>Đóng</button>
        </div>
        <div style={{ fontSize: 13.5, color: '#5b5b66', marginBottom: 10, overflowWrap: 'anywhere' }}>{title}</div>

        {done ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p role="status" style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Đã gửi cho {done.name}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href={chatConversationPath(done.conversationId)} style={{ ...S.btn, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Mở cuộc trò chuyện</a>
              <button type="button" onClick={onClose} style={S.ghost}>Xong</button>
            </div>
          </div>
        ) : state.status === 'loading' ? (
          <p style={{ margin: '8px 0 16px', color: '#5b5b66' }}>Đang tải danh sách bạn bè…</p>
        ) : state.status === 'error' ? (
          <p role="alert" style={{ margin: '8px 0 16px', color: '#b42318' }}>{state.message}</p>
        ) : state.friends.length === 0 ? (
          <p style={{ margin: '8px 0 16px', color: '#5b5b66' }}>Bạn chưa có bạn bè nào để gửi. <a href="/me/friends" style={{ color: '#6C63FF', fontWeight: 700 }}>Kết bạn</a></p>
        ) : (
          <>
            {state.friends.length > 8 && (
              <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm bạn bè" aria-label="Tìm bạn bè"
                style={{ minHeight: 42, borderRadius: 10, border: '1px solid #d8d8de', padding: '0 12px', fontSize: 16, marginBottom: 8, fontFamily: FONT }} />
            )}
            <div role="radiogroup" aria-label="Chọn một người bạn" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0, marginBottom: 12 }}>
              {friends.map(f => (
                <button key={f.userId} type="button" role="radio" aria-checked={picked?.userId === f.userId} onClick={() => setPicked(f)} style={S.row(picked?.userId === f.userId)}>
                  {f.avatarUrl ? <img src={f.avatarUrl} alt="" width={32} height={32} style={{ borderRadius: '50%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                    : <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: '50%', background: '#dcdae8', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{f.name.slice(0, 1).toUpperCase()}</span>}
                  <span style={{ overflowWrap: 'anywhere' }}>{f.name}</span>
                </button>
              ))}
              {friends.length === 0 && <p style={{ margin: 0, color: '#5b5b66' }}>Không có ai khớp.</p>}
            </div>
            {error && <p role="alert" style={{ margin: '0 0 10px', color: '#b42318', fontSize: 14 }}>{error}</p>}
            <button type="button" onClick={() => void send()} disabled={!picked || busy} style={{ ...S.btn, opacity: !picked || busy ? 0.5 : 1 }}>
              {busy ? 'Đang gửi…' : picked ? `Gửi cho ${picked.name}` : 'Chọn một người bạn'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
