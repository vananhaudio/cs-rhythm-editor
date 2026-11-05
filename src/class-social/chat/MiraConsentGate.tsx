// Màn xác nhận tham gia Mira (V1.1). Nội dung, phiên bản do SERVER trả (không hardcode ở bundle). Nói rõ đây là AI và dữ liệu đi đâu.
import { Sparkles } from 'lucide-react'
import type { MiraConsent } from './miraApi'

const NOTE: Record<string, string> = {
  withdrawn: 'Bạn đã rút lại đồng ý trước đó. Bạn có thể đồng ý lại bất cứ lúc nào.',
  outdated: 'Nội dung đồng ý đã được cập nhật. Bạn đọc và xác nhận lại nhé.',
}

export default function MiraConsentGate({ consent, busy, error, onGrant, onDecline }: {
  consent: MiraConsent; busy: boolean; error: string | null; onGrant: () => void; onDecline: () => void
}) {
  const n = consent.notice
  return (
    <div className="cs-chat-scroll-wrap">
      <div className="cs-chat-scroll" data-testid="mira-consent" role="region" aria-label="Xác nhận tham gia Mira">
        <div style={{ padding: '16px 16px 24px', display: 'grid', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}><Sparkles size={18} aria-hidden="true" />{n?.title ?? 'Mira (trợ lý AI)'}</h2>
          {NOTE[consent.state] && <p style={{ margin: 0 }} role="status">{NOTE[consent.state]}</p>}
          {n ? n.body.split(/\n{2,}/).map((para, i) => <p key={i} style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{para}</p>) : null}
          {n && <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>Phiên bản nội dung: {n.version}</p>}
          {error && <p role="alert" className="cs-feed-error" style={{ margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="cs-btn" disabled={busy || !n} onClick={onGrant} data-testid="mira-consent-grant">Tôi đã đọc và đồng ý tham gia</button>
            <button type="button" className="cs-btn cs-btn-soft" disabled={busy} onClick={onDecline} data-testid="mira-consent-decline">Không tham gia</button>
          </div>
        </div>
      </div>
    </div>
  )
}
