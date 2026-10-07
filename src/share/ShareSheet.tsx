// Nút DUY NHẤT "Chia sẻ" → sheet theo KHẢ NĂNG của object: "Gửi cho bạn bè" (gửi riêng qua Chat) · "Đăng lên cộng đồng" (chỉ khi object hỗ trợ).
// Chỉ còn một lựa chọn hợp lệ → vào thẳng chọn bạn (không hiện menu một mục). Dùng chung mọi loại share (BMS, Nhịp & Phách, lớp, buổi học…).
// Với object lưu trên server (artifact): bản nháp chưa lưu được TỰ LƯU RIÊNG khi cần (idempotent theo nội dung), rồi
//   gửi cho bạn  → chỉ gửi tham chiếu; đăng cộng đồng → NÂNG CẤP chính object đó (không tạo bản sao).
// UX không hiện các từ kỹ thuật (artifact/shared/class/promote). Quyền do server quyết (RLS + RPC).
import { lazy, Suspense, useRef, useState } from 'react'
import type { ShareRef } from './shareRef'

const ShareToFriendSheet = lazy(() => import('./ShareToFriendSheet'))
const FONT = `'Be Vietnam Pro',system-ui,sans-serif`
const S = {
  overlay: { position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(8,10,16,.62)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontFamily: FONT } as const,
  card: { width: 'min(100%, 440px)', background: '#fff', color: '#16161a', borderRadius: '18px 18px 0 0', padding: '16px 16px max(16px, env(safe-area-inset-bottom))', boxShadow: '0 -8px 32px rgba(0,0,0,.3)' } as const,
  opt: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, width: '100%', minHeight: 60, padding: '10px 14px', border: '1px solid #e0e0e6', borderRadius: 14, background: '#f6f6f8', color: '#16161a', textAlign: 'left', cursor: 'pointer', fontFamily: FONT } as const,
  ghost: { minHeight: 40, border: '1px solid #d8d8de', borderRadius: 12, background: '#fff', color: '#16161a', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, padding: '0 14px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' } as const,
}

export type EnsureResult = { ok: true; target: ShareRef } | { ok: false; message: string }
type Phase = 'menu' | 'busy' | 'friends' | 'published'

export default function ShareSheet({ title, target, canPublish, ensureTarget, publish, onPublished, onClose }: {
  title: string
  /** Có sẵn (trang xem object) hoặc null (bản nháp chưa lưu → tự lưu riêng khi cần) */
  target: ShareRef | null
  /** Object hỗ trợ đăng cộng đồng VÀ người dùng được phép (chủ bài, chưa đăng) */
  canPublish: boolean
  ensureTarget: () => Promise<EnsureResult>
  /** Chỉ artifact: nhận id artifact */
  publish?: (target: ShareRef) => Promise<{ ok: true } | { ok: false; message: string }>
  onPublished?: (target: ShareRef) => void
  onClose: () => void
}) {
  const canCommunity = canPublish && !!publish
  const direct = !canCommunity && !!target
  const [phase, setPhase] = useState<Phase>(direct ? 'friends' : 'menu')
  const [id, setId] = useState<ShareRef | null>(target)
  const [error, setError] = useState<string | null>(null)
  const busyRef = useRef(false)

  const resolve = async (): Promise<ShareRef | null> => {
    if (id) return id
    const r = await ensureTarget()
    if (!r.ok) { setError(r.message); return null }
    setId(r.target)
    return r.target
  }
  const run = async (kind: 'friends' | 'publish') => {
    if (busyRef.current) return
    busyRef.current = true; setPhase('busy'); setError(null)
    try {
      const t = await resolve()
      if (!t) { setPhase('menu'); return }
      if (kind === 'friends' || !publish) { setPhase('friends'); return }
      const r = await publish(t)
      if (!r.ok) { setError(r.message); setPhase('menu'); return }
      onPublished?.(t)
      setPhase('published')
    } finally { busyRef.current = false }
  }

  if (phase === 'friends' && id) {
    return <Suspense fallback={null}><ShareToFriendSheet target={id} title={title} onClose={onClose} /></Suspense>
  }
  return (
    <div style={S.overlay} onMouseDown={e => { if (e.target === e.currentTarget && phase !== 'busy') onClose() }}>
      <div style={S.card} role="dialog" aria-modal="true" aria-label="Chia sẻ">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>Chia sẻ</div>
          <button type="button" onClick={onClose} disabled={phase === 'busy'} style={{ ...S.ghost, minHeight: 36 }}>Đóng</button>
        </div>
        <div style={{ fontSize: 13.5, color: '#5b5b66', marginBottom: 12, overflowWrap: 'anywhere' }}>{title}</div>
        {phase === 'published' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p role="status" style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Đã đăng lên cộng đồng</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href="/me" style={S.ghost}>Xem trên Trang chủ</a>
              <button type="button" onClick={() => setPhase('friends')} style={S.ghost}>Gửi cho bạn bè</button>
              <button type="button" onClick={onClose} style={S.ghost}>Xong</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button type="button" disabled={phase === 'busy'} onClick={() => void run('friends')} style={{ ...S.opt, opacity: phase === 'busy' ? 0.6 : 1 }}>
              <span style={{ fontSize: 15.5, fontWeight: 800 }}>Gửi cho bạn bè</span>
              <span style={{ fontSize: 13, color: '#5b5b66' }}>Gửi riêng qua Chat</span>
            </button>
            {canCommunity && (
              <button type="button" disabled={phase === 'busy'} onClick={() => void run('publish')} style={{ ...S.opt, opacity: phase === 'busy' ? 0.6 : 1 }}>
                <span style={{ fontSize: 15.5, fontWeight: 800 }}>Đăng lên cộng đồng</span>
                <span style={{ fontSize: 13, color: '#5b5b66' }}>Chia sẻ để mọi người trong Class cùng xem</span>
              </button>
            )}
            {phase === 'busy' && <p role="status" style={{ margin: '4px 0 0', fontSize: 13.5, color: '#5b5b66' }}>Đang xử lý…</p>}
            {error && <p role="alert" style={{ margin: '4px 0 0', fontSize: 14, color: '#b42318' }}>{error}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

