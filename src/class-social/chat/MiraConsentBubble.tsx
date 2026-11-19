// V3.1: lời đề nghị trong chính cuộc trò chuyện — Mira nói rõ mình sẽ dùng gì, học viên bấm một lần ngay tại đây.
// KHÔNG đổi cơ chế đồng ý: vẫn là thông báo do server cấp + grantMiraConsent(version) do chính học viên bấm; chưa bấm thì Mira không đọc hồ sơ.
import type { MiraConsentView } from './useMiraConsent'

export default function MiraConsentBubble({ consent, busy, error, onGrant }: {
  consent: MiraConsentView; busy: boolean; error: string | null; onGrant: () => void
}) {
  const c = consent.status === 'ready' ? consent.consent : null
  if (!c || c.state === 'unavailable' || c.state === 'granted' || !c.notice) return null
  return (
    <div className="cs-msg-row is-theirs" data-testid="mira-consent-bubble">
      <div className="cs-msg-bubble">
        <p style={{ margin: 0 }}>Để mình nhắc đúng bài và nhớ mạch học của bạn, mình cần xem bài làm, nhận xét của Thầy và tiến độ học của bạn trong Class. Dữ liệu này được gửi tới nhà cung cấp AI để soạn câu trả lời. Chưa đồng ý thì mình vẫn trả lời câu hỏi chung, không đọc hồ sơ của bạn.</p>
        <details style={{ marginTop: 8 }}>
          <summary>Đọc thông báo đầy đủ</summary>
          {c.notice.body.split(/\n{2,}/).map((p, i) => <p key={i} style={{ whiteSpace: 'pre-wrap', margin: '6px 0 0' }}>{p}</p>)}
        </details>
        {c.state === 'withdrawn' && <p role="status" style={{ margin: '8px 0 0' }}>Bạn đã ngừng chia sẻ trước đó; chỉ bật lại khi bạn muốn.</p>}
        {c.state === 'outdated' && <p role="status" style={{ margin: '8px 0 0' }}>Nội dung đã được cập nhật, bạn đọc lại nhé.</p>}
        {error && <p role="alert" className="cs-feed-error" style={{ margin: '8px 0 0' }}>{error}</p>}
        <div style={{ marginTop: 8 }}>
          <button type="button" className="cs-btn cs-btn-soft cs-btn-sm" disabled={busy} onClick={onGrant} data-testid="mira-consent-inline-grant">Tôi đã đọc và đồng ý</button>
        </div>
      </div>
    </div>
  )
}
