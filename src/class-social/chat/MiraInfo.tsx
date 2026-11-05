// Thông tin AI + lựa chọn chia sẻ dữ liệu học tập (V1.3). KHÔNG phải cổng chặn: trò chuyện phổ thông luôn dùng được.
// Thông báo minh bạch (luôn có, gọn, mở rộng được). Phần "dùng hồ sơ học tập" CHỈ hiện khi SERVER có nội dung đồng ý đang hiệu lực
// (ai_consent_status ≠ unavailable); nội dung/phiên bản do server trả, client chỉ gửi "đồng ý phiên bản N" hoặc "rút lại".
import { useState } from 'react'
import { Info } from 'lucide-react'
import type { MiraConsentView } from './useMiraConsent'
import { MIRA_AI_NOTICE } from './useMiraChat'


export default function MiraInfo({ consent, busy, error, onGrant, onWithdraw }: {
  consent: MiraConsentView; busy: boolean; error: string | null; onGrant: () => void; onWithdraw: () => Promise<boolean>
}) {
  const [confirming, setConfirming] = useState(false)
  const c = consent.status === 'ready' ? consent.consent : null
  const offer = c && c.state !== 'unavailable' && c.notice ? c : null
  const granted = offer?.state === 'granted'
  return (
    <details className="cs-mira-info" data-testid="mira-info">
      <summary><Info size={14} aria-hidden="true" /> {granted ? 'Mira là AI · đang dùng hồ sơ học tập' : 'Mira là AI, có thể sai'} · <span className="cs-mira-info-more">Tìm hiểu</span></summary>
      <div className="cs-mira-info-body">
        {MIRA_AI_NOTICE.map((t, i) => <p key={i}>{t}</p>)}
        {offer && (
          <div className="cs-mira-info-data" data-testid="mira-data">
            <p><b>{offer.notice!.title}</b></p>
            {!granted && offer.notice!.body.split(/\n{2,}/).map((p, i) => <p key={i} style={{ whiteSpace: 'pre-wrap' }}>{p}</p>)}
            {!granted && offer.state === 'withdrawn' && <p role="status">Bạn đã ngừng chia sẻ trước đó.</p>}
            {!granted && offer.state === 'outdated' && <p role="status">Nội dung đã được cập nhật, bạn đọc lại nhé.</p>}
            {error && <p role="alert" className="cs-feed-error">{error}</p>}
            {!granted && <button type="button" className="cs-btn cs-btn-soft cs-btn-sm" disabled={busy} onClick={onGrant} data-testid="mira-consent-grant">Cho Mira dùng hồ sơ học tập</button>}
            {granted && !confirming && <button type="button" className="cs-btn cs-btn-soft cs-btn-sm" disabled={busy} onClick={() => setConfirming(true)} data-testid="mira-withdraw">Ngừng chia sẻ hồ sơ học tập</button>}
            {granted && confirming && (
              <div role="alertdialog" aria-label="Ngừng chia sẻ" data-testid="mira-withdraw-confirm" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span>Mira sẽ ngừng đọc hồ sơ học tập của bạn ngay; bạn vẫn hỏi chung được.</span>
                <button type="button" className="cs-btn cs-btn-sm" disabled={busy} data-testid="mira-withdraw-yes" onClick={async () => { if (await onWithdraw()) setConfirming(false) }}>Ngừng chia sẻ</button>
                <button type="button" className="cs-btn cs-btn-soft cs-btn-sm" disabled={busy} onClick={() => setConfirming(false)}>Giữ nguyên</button>
              </div>)}
          </div>)}
      </div>
    </details>
  )
}
