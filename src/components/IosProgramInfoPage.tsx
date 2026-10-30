// Trang trung tính cho app iOS native thay các trang TUYỂN SINH (/class*): không giá, không hướng dẫn thanh toán ngoài app,
// không đăng ký ngoài app, không iframe Mira shop. Xem docs/IOS-PAYMENT-POLICY-V1.md (Guideline 3.1.1).
// Shop nhạc cụ = hàng vật lý (3.1.3(e)) nên vẫn có, nhưng mở ra Safari bằng openExternalUrl (không thay WebView của app).
import { openExternalUrl } from '../iosPaymentPolicy'

const SHOP_URL = 'https://shop.vananhaudio.com'

export default function IosProgramInfoPage() {
  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: '40px 20px', fontFamily: "'Be Vietnam Pro', system-ui, sans-serif", color: '#211C32', lineHeight: 1.6 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 12px' }}>Thầy Văn Anh Guitar</h1>
      <p style={{ margin: '0 0 14px' }}>
        Học, tập và sống cùng âm nhạc: giáo trình theo lớp, công cụ luyện tập, bài trả và cộng đồng học viên
        ngay trong ứng dụng.
      </p>
      <p style={{ margin: '0 0 24px', color: '#5A5470' }}>
        Gói học trong ứng dụng được đăng ký tại mục <b>Gói của tôi</b>.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <a href="/" style={{ background: '#4338CA', color: '#fff', textAlign: 'center', padding: '13px 20px', borderRadius: 12, fontWeight: 600, textDecoration: 'none' }}>Về ứng dụng</a>
        <a href="/subscribe" style={{ border: '1.5px solid #D3CEE8', color: '#4338CA', textAlign: 'center', padding: '13px 20px', borderRadius: 12, fontWeight: 600, textDecoration: 'none' }}>Gói của tôi</a>
        {/* Hàng vật lý (nhạc cụ): hợp lệ ngoài IAP — mở trình duyệt ngoài, không thay WebView của app */}
        <button type="button" onClick={() => openExternalUrl(SHOP_URL)}
          style={{ border: '1.5px solid #F5CFB6', background: '#FDF0E7', color: '#C2570C', padding: '13px 20px', borderRadius: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 15 }}>
          Shop nhạc cụ (mở trên trình duyệt)
        </button>
      </div>
    </main>
  )
}
