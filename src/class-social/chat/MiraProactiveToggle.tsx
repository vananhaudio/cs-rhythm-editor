// Dòng nhỏ dưới khung Mira: bật/tắt lời nhắc chủ động. Chỉ hiện khi server xác nhận học viên đang trong pilot (proactiveEnabled ≠ null).
import { useEffect, useState } from 'react'
import { proactiveEnabled, setProactive } from './miraInviteApi'

export default function MiraProactiveToggle() {
  const [on, setOn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { let a = true; void proactiveEnabled().then(v => { if (a) setOn(v) }); return () => { a = false } }, [])
  if (on === null) return null
  const flip = async () => { setBusy(true); const v = await setProactive(!on); setBusy(false); if (v !== null) setOn(v) }
  return (
    <div className="cs-inbox-note" style={{ padding: '4px 14px', display: 'flex', gap: 8, alignItems: 'center' }} data-testid="mira-proactive-toggle">
      <span>{on ? 'Mira có thể mời bạn trò chuyện khi có việc học đang chờ.' : 'Lời nhắc của Mira đang tắt.'}</span>
      <button type="button" className="cs-link-btn" disabled={busy} onClick={() => void flip()}>{on ? 'Tắt lời nhắc' : 'Bật lại'}</button>
    </div>
  )
}
