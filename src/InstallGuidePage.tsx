// ── Trang HƯỚNG DẪN CÀI APP TVA Guitar — để chia sẻ cho học viên ───────────────
// Link chia sẻ: timming.vananhaudio.com/cai-app  (hoặc class.vananhaudio.com/cai-app)
const ZALO = '0983 259 893'
const ZALO_LINK = 'https://zalo.me/vananhguitarist'
const WEB_APP = 'https://timming.vananhaudio.com/me'
// ⬇️ DÁN LINK PUBLIC TESTFLIGHT vào đây khi có (App Store Connect → TestFlight → Public Link)
const TESTFLIGHT_LINK = ''

const C = { ind: '#4338CA', ink: '#1F2430', sub: '#5A6072', bg: '#F0F2F5', surface: '#fff', border: '#E5E7EB', orange: '#EA580C' }

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
      <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: C.ind, color: '#fff', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.6 }}>{children}</div>
      </div>
    </div>
  )
}

export default function InstallGuidePage() {
  const card: React.CSSProperties = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 18px', marginBottom: 16, boxShadow: '0 1px 4px rgba(17,24,39,.05)' }
  return (
    <div style={{ minHeight: '100dvh', background: C.bg, fontFamily: 'system-ui, sans-serif', padding: 'calc(env(safe-area-inset-top,0px) + 24px) 16px 48px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <img src="/tva-logo.png" alt="TVA Guitar" style={{ width: 56, height: 56, borderRadius: 14, marginBottom: 10 }} />
          <div style={{ fontSize: 22, fontWeight: 900, color: C.ink }}>Cài app TVA Guitar</div>
          <div style={{ fontSize: 14, color: C.sub, marginTop: 4 }}>Học · Tập · Sống cùng âm nhạc — ngay trên điện thoại của bạn</div>
        </div>

        {/* Cách nhanh nhất: Web */}
        <div style={card}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ECFDF5', color: '#059669', borderRadius: 20, padding: '3px 11px', fontSize: 12.5, fontWeight: 700, marginBottom: 12 }}>✓ NHANH NHẤT · không cần cài</div>
          <Step n={1} title="Mở bằng trình duyệt">Bấm nút bên dưới (hoặc gõ <b>timming.vananhaudio.com/me</b> trên Safari/Chrome).</Step>
          <Step n={2} title="Đăng nhập">Dùng tài khoản thầy đã cấp (mật khẩu mặc định <b>12345678</b>, đổi lại trong Hồ sơ).</Step>
          <Step n={3} title="Thêm vào màn hình chính">
            <b>iPhone (Safari):</b> bấm nút Chia sẻ <span style={{ color: C.ind }}>⬆️</span> → “Thêm vào MH chính”.<br />
            <b>Android (Chrome):</b> bấm ⋮ → “Thêm vào màn hình chính”.<br />
            → App hiện như icon thật, mở 1 chạm.
          </Step>
          <a href={WEB_APP} style={{ display: 'block', textAlign: 'center', marginTop: 8, background: C.ind, color: '#fff', borderRadius: 12, padding: 13, fontSize: 15, fontWeight: 800, textDecoration: 'none' }}>▶ Mở app & đăng nhập →</a>
        </div>

        {/* iPhone qua TestFlight */}
        <div style={card}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#EEF2FF', color: C.ind, borderRadius: 20, padding: '3px 11px', fontSize: 12.5, fontWeight: 700, marginBottom: 12 }}> iPhone / iPad · bản app riêng</div>
          {TESTFLIGHT_LINK ? (
            <>
              <Step n={1} title="Cài app TestFlight">Vào App Store, tải <b>TestFlight</b> (của Apple) — miễn phí.</Step>
              <Step n={2} title="Mở link mời">Bấm nút dưới, TestFlight mở ra → bấm <b>Cài đặt / Install</b>.</Step>
              <Step n={3} title="Mở app TVA Guitar">Icon hiện trên màn hình. Đăng nhập như trên.</Step>
              <a href={TESTFLIGHT_LINK} style={{ display: 'block', textAlign: 'center', marginTop: 8, background: '#fff', color: C.ind, border: `1.5px solid ${C.ind}`, borderRadius: 12, padding: 13, fontSize: 15, fontWeight: 800, textDecoration: 'none' }}>📲 Cài qua TestFlight →</a>
            </>
          ) : (
            <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.6 }}>
              Bản app iOS riêng đang qua <b>TestFlight</b>. Nhắn Zalo thầy để nhận link cài, hoặc dùng cách Web ở trên (đầy đủ tính năng như app).
            </div>
          )}
        </div>

        {/* Cần giúp */}
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: C.ink, marginBottom: 4 }}>Cài chưa được? Thầy hỗ trợ ngay</div>
          <div style={{ fontSize: 13.5, color: C.sub, marginBottom: 12 }}>Nhắn Zalo, thầy chỉ từng bước trong 1 phút.</div>
          <a href={ZALO_LINK} target="_blank" rel="noreferrer" style={{ display: 'inline-block', background: '#0068FF', color: '#fff', borderRadius: 12, padding: '11px 22px', fontSize: 14.5, fontWeight: 700, textDecoration: 'none' }}>💬 Nhắn Zalo thầy ({ZALO})</a>
        </div>

        <div style={{ textAlign: 'center', fontSize: 12.5, color: '#9AA0B0', marginTop: 8 }}>Thầy Văn Anh Guitar · timming.vananhaudio.com</div>
      </div>
    </div>
  )
}
