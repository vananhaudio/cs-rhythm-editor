// Thẻ lời mời của Mira: ở /me (mode 'ensure': nhận diện tình huống) và đầu khung Mira (mode 'pending': chỉ hiện lời đang chờ).
// Lựa chọn rõ ràng: Trò chuyện · Không cần (không nhắc lại việc này) · Tắt lời nhắc. Không có gì chạy ngoài Class.
import { useEffect, useState } from 'react'
import MiraAvatar from './MiraAvatar'
import { declineInvitation, ensureInvitation, openInvitation, pendingInvitation, setProactive, type MiraInvitation } from './miraInviteApi'

export default function MiraInvitationBanner({ mode, enabled = true, onStart }: { mode: 'ensure' | 'pending'; enabled?: boolean; onStart: (r: { text: string; conversationId: string | null }) => void }) {
  const [inv, setInv] = useState<MiraInvitation | null>(null)
  const [busy, setBusy] = useState(false)
  const [off, setOff] = useState(false)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    void (mode === 'ensure' ? ensureInvitation() : pendingInvitation()).then(v => { if (alive) setInv(v) })
    return () => { alive = false }
  }, [mode, enabled])
  if (!enabled || (!inv && !off)) return null
  if (off) return <p className="cs-inbox-note" role="status" data-testid="mira-invite-off">Đã tắt lời nhắc của Mira. Bạn có thể bật lại trong khung Mira.</p>
  if (!inv) return null
  const start = async () => {
    setBusy(true)
    const r = await openInvitation(inv.id)
    setBusy(false)
    if (!r) { setInv(null); return }   // hết hạn/đã xử lý: gỡ thẻ, không báo lỗi khó hiểu
    setInv(null); onStart(r)
  }
  const decline = async () => { setBusy(true); await declineInvitation(inv.id); setBusy(false); setInv(null) }
  const turnOff = async () => { setBusy(true); const ok = await setProactive(false); setBusy(false); setInv(null); if (ok === false) setOff(true) }
  return (
    <section className="cs-card cs-mira-invite" aria-label="Lời mời từ Mira" data-testid="mira-invite" style={{ display: 'flex', gap: 12, padding: 14, alignItems: 'flex-start' }}>
      <MiraAvatar size={40} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Mira</div>
        <p style={{ margin: '4px 0 10px', lineHeight: 1.45, overflowWrap: 'anywhere' }} data-testid="mira-invite-text">{inv.text}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="cs-btn cs-btn-primary cs-btn-sm" disabled={busy} onClick={() => void start()} data-testid="mira-invite-start">Trò chuyện với Mira</button>
          <button type="button" className="cs-btn cs-btn-soft cs-btn-sm" disabled={busy} onClick={() => void decline()} data-testid="mira-invite-decline">Không cần</button>
          <button type="button" className="cs-link-btn" disabled={busy} onClick={() => void turnOff()} data-testid="mira-invite-off-btn">Tắt lời nhắc</button>
        </div>
      </div>
    </section>
  )
}
