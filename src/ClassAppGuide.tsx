// ClassAppGuide — "Hướng Dẫn Cài Đặt App" dựng native full màn hình.
// Tông đồng bộ trang /class (kem · indigo · honey), dùng logo app chuẩn.
const P = {
  bg: '#F2EEE7', surface: '#FFFFFF', ink: '#211C32', soft: '#5A5470', faint: '#8A8499',
  honey: '#C9711E', honeyTint: '#FBF1E4', line: '#E4DED4', indigo: '#4338CA', indigoTint: '#EEEBFB',
}
const APPSTORE = 'https://apps.apple.com/vn/app/id6776205968'
const CHPLAY = 'https://play.google.com/store/apps/details?id=com.vananhaudio.guitar'

const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <div className="ag-step"><span className="ag-step-n">{n}</span><div>{children}</div></div>
)
const Chip = ({ children, kind = 'plain' }: { children: React.ReactNode; kind?: 'plain' | 'green' | 'indigo' }) =>
  <span className={`ag-chip ag-chip-${kind}`}>{children}</span>

export default function ClassAppGuide({ onClose, onRegister }: { onClose: () => void; onRegister: () => void }) {
  return (
    <div className="tva-ag">
      <style>{CSS}</style>

      <div className="ag-top">
        <button className="ag-back" onClick={onClose}>← Quay lại</button>
        <button className="ag-cta" onClick={onRegister}>Xem lớp &amp; đăng ký →</button>
      </div>

      <div className="ag-scroll">
        <div className="ag-wrap">
          {/* HERO */}
          <div className="ag-hero">
            <img className="ag-logo" src="/tva-logo.png" alt="TVA Guitar" />
            <div>
              <h1>Hướng Dẫn Cài Đặt App<br />Thầy Văn Anh Guitar</h1>
              <p>Hành trình làm chủ đàn guitar của bạn bắt đầu từ đây.</p>
            </div>
          </div>

          <div className="ag-intro">
            <p>App Thầy Văn Anh Guitar là nơi bạn học bài, xem video, luyện tập và theo dõi hành trình học guitar của mình.</p>
            <p style={{ margin: 0 }}>Bạn chỉ cần cài app một lần, sau đó có thể học trực tiếp trên điện thoại bất cứ khi nào rảnh.</p>
          </div>

          {/* TẢI NHANH */}
          <div className="ag-stores">
            <a className="ag-store ag-store-ios" href={APPSTORE} target="_blank" rel="noreferrer"> Tải trên App Store</a>
            <a className="ag-store ag-store-and" href={CHPLAY} target="_blank" rel="noreferrer">▶ Tải trên CH Play</a>
          </div>

          {/* iPhone / iPad */}
          <div className="ag-sec">
            <div className="ag-sec-h"><span className="ag-sec-n">1</span> Cài đặt trên iPhone / iPad</div>
            <Step n={1}>Mở ứng dụng <b>App Store</b> trên iPhone hoặc iPad.</Step>
            <Step n={2}>Bấm vào ô tìm kiếm và gõ: <Chip kind="green">Thầy Văn Anh Guitar</Chip></Step>
            <Step n={3}>Chọn đúng ứng dụng tên <b>Thầy Văn Anh Guitar</b> — biểu tượng nền xanh, do <b>VAN ANH AUDIO</b> phát hành.</Step>
            <Step n={4}>Bấm <Chip>Nhận</Chip> hoặc <Chip kind="indigo">Tải về</Chip> để cài đặt.</Step>
            <Step n={5}>Sau khi cài xong, bấm <Chip>Mở</Chip> để vào app.</Step>
          </div>

          {/* Android */}
          <div className="ag-sec">
            <div className="ag-sec-h"><span className="ag-sec-n">2</span> Cài đặt trên điện thoại Android</div>
            <Step n={1}>Mở ứng dụng <b>CH Play</b> (Google Play) trên điện thoại.</Step>
            <Step n={2}>Bấm vào ô tìm kiếm và gõ: <Chip kind="green">Thầy Văn Anh Guitar</Chip></Step>
            <Step n={3}>Chọn đúng ứng dụng tên <b>Thầy Văn Anh Guitar</b>.</Step>
            <Step n={4}>Bấm <Chip kind="indigo">Cài đặt</Chip>.</Step>
            <Step n={5}>Sau khi cài xong, bấm <Chip>Mở</Chip> để bắt đầu sử dụng.</Step>
          </div>

          {/* MÀN HÌNH TRONG APP */}
          <div className="ag-sec">
            <div className="ag-sec-h"><span className="ag-sec-n">3</span> Các màn hình chính trong app</div>
            <div className="ag-shots">
              <figure><img src="/app-tiendo.png" alt="Trang chủ" /><figcaption>Trang chủ — hành trình &amp; nhịp luyện tập</figcaption></figure>
              <figure><img src="/app-khoahoc.png" alt="Khoá học" /><figcaption>Tất cả khoá học trong tài khoản</figcaption></figure>
              <figure><img src="/app-luyentap.png" alt="Công cụ luyện tập" /><figcaption>Công cụ luyện tập đa dạng</figcaption></figure>
            </div>
          </div>

          {/* KHÓA FREE + CỘNG ĐỒNG */}
          <div className="ag-sec">
            <div className="ag-sec-h"><span className="ag-sec-n">4</span> Có gì ngay khi mở app</div>
            <div className="ag-free">
              <div className="ag-free-h">Khoá học miễn phí có sẵn</div>
              <div className="ag-free-item"><b>Khởi Đầu Đam Mê — Nhập Môn</b><span>Dành cho người mới bắt đầu làm quen với guitar.</span></div>
              <div className="ag-free-item"><b>Chìa Khoá Nhạc Lý Cơ Bản 1</b><span>Giúp bạn hiểu những kiến thức nhạc lý nền tảng một cách đơn giản.</span></div>
            </div>
            <p className="ag-note">Khi bạn trở thành <b>học sinh chính thức</b>, các khoá đã đăng ký sẽ được mở thêm trong tài khoản, cùng nhiều công cụ tập luyện hơn trong app.</p>
            <div className="ag-comm">
              <div className="ag-comm-card"><div className="ag-comm-h">Cộng đồng Facebook</div><span>Nơi chia sẻ, cập nhật thông tin và kết nối với cộng đồng học guitar.</span></div>
              <div className="ag-comm-card"><div className="ag-comm-h">Nhóm lớp Zalo</div><span>Nhóm riêng đúng với lớp học của bạn — nhận thông báo, trao đổi bài học và được hỗ trợ.</span></div>
            </div>
          </div>

          {/* HỌC - TẬP - SỐNG */}
          <div className="ag-final">
            <div className="ag-final-h">Học — Tập — Sống cùng âm nhạc</div>
            <p>App Thầy Văn Anh Guitar được xây dựng theo tinh thần đó. Cài app, đăng nhập bằng tài khoản thầy cấp, và bắt đầu hành trình của bạn.</p>
            <button className="ag-final-btn" onClick={onRegister}>Xem lớp &amp; đăng ký →</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const CSS = `
.tva-ag{position:fixed;inset:0;z-index:120;background:${P.bg};display:flex;flex-direction:column;font-family:'Be Vietnam Pro',system-ui,sans-serif;color:${P.ink};text-align:left;}
.tva-ag *{box-sizing:border-box;}
.tva-ag .ag-top{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 20px;background:rgba(242,238,231,.92);backdrop-filter:blur(10px);border-bottom:1px solid ${P.line};}
.tva-ag .ag-back{border:1.5px solid #D3CEE8;background:#fff;color:${P.indigo};border-radius:10px;padding:9px 16px;font-weight:600;font-size:14px;cursor:pointer;font-family:inherit;}
.tva-ag .ag-cta{border:none;background:${P.indigo};color:#fff;border-radius:10px;padding:9px 16px;font-weight:600;font-size:14px;cursor:pointer;font-family:inherit;}
.tva-ag .ag-scroll{flex:1;overflow-y:auto;}
.tva-ag .ag-wrap{max-width:720px;margin:0 auto;padding:28px 24px 64px;}

.tva-ag .ag-hero{background:linear-gradient(150deg,${P.indigo},#6D63E6);border-radius:20px;padding:24px 26px;display:flex;align-items:center;gap:18px;color:#fff;}
.tva-ag .ag-logo{width:64px;height:64px;border-radius:15px;flex-shrink:0;}
.tva-ag .ag-hero h1{font-size:23px;font-weight:800;line-height:1.2;margin:0;}
.tva-ag .ag-hero p{font-size:14px;color:#E6E2F2;margin:8px 0 0;}
@media(max-width:520px){.tva-ag .ag-hero{flex-direction:column;text-align:center;}.tva-ag .ag-hero h1{font-size:21px;}}

.tva-ag .ag-intro{background:${P.indigoTint};border-left:3px solid ${P.indigo};border-radius:0 14px 14px 0;padding:18px 20px;margin:18px 0;}
.tva-ag .ag-intro p{font-size:15px;line-height:1.7;color:${P.soft};margin:0 0 12px;}

.tva-ag .ag-stores{display:flex;gap:12px;margin-bottom:8px;flex-wrap:wrap;}
.tva-ag .ag-store{flex:1;min-width:180px;text-align:center;text-decoration:none;border-radius:13px;padding:14px;font-size:15px;font-weight:700;border:none;cursor:pointer;}
.tva-ag .ag-store-ios{background:${P.ink};color:#fff;}
.tva-ag .ag-store-and{background:#fff;color:${P.ink};border:1.5px solid ${P.line};}

.tva-ag .ag-sec{margin-top:30px;}
.tva-ag .ag-sec-h{display:flex;align-items:center;gap:11px;font-size:19px;font-weight:800;color:${P.ink};margin-bottom:14px;}
.tva-ag .ag-sec-n{width:30px;height:30px;flex-shrink:0;border-radius:50%;background:${P.indigo};color:#fff;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;}
.tva-ag .ag-step{display:flex;gap:13px;padding:11px 0;border-top:1px solid ${P.line};font-size:15px;line-height:1.55;color:${P.soft};}
.tva-ag .ag-step b{color:${P.ink};}
.tva-ag .ag-step-n{width:24px;height:24px;flex-shrink:0;border-radius:50%;background:${P.indigoTint};color:${P.indigo};display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:800;}
.tva-ag .ag-chip{display:inline-block;border-radius:7px;padding:2px 9px;font-size:13px;font-weight:700;}
.tva-ag .ag-chip-plain{background:#EDEAE3;color:${P.ink};}
.tva-ag .ag-chip-green{background:#1F4D2E;color:#fff;}
.tva-ag .ag-chip-indigo{background:${P.indigo};color:#fff;}

.tva-ag .ag-shots{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
.tva-ag .ag-shots figure{margin:0;}
.tva-ag .ag-shots img{width:100%;display:block;border-radius:13px;border:1px solid ${P.line};box-shadow:0 8px 22px -12px rgba(33,28,50,.35);}
.tva-ag .ag-shots figcaption{font-size:12px;color:${P.faint};text-align:center;margin-top:8px;line-height:1.4;}
@media(max-width:560px){.tva-ag .ag-shots{grid-template-columns:1fr;max-width:280px;margin:0 auto;}}

.tva-ag .ag-free{background:${P.indigoTint};border-radius:14px;padding:18px 20px;}
.tva-ag .ag-free-h{font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:${P.indigo};margin-bottom:12px;}
.tva-ag .ag-free-item{padding:8px 0;}
.tva-ag .ag-free-item b{display:block;font-size:15px;color:${P.ink};}
.tva-ag .ag-free-item span{font-size:13.5px;color:${P.soft};}
.tva-ag .ag-note{font-size:14.5px;line-height:1.7;color:${P.soft};margin:16px 0;}
.tva-ag .ag-note b{color:${P.ink};}
.tva-ag .ag-comm{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.tva-ag .ag-comm-card{background:#fff;border:1px solid ${P.line};border-radius:14px;padding:16px;}
.tva-ag .ag-comm-h{font-size:14.5px;font-weight:700;color:${P.ink};margin-bottom:6px;}
.tva-ag .ag-comm-card span{font-size:13.5px;color:${P.soft};line-height:1.55;}
@media(max-width:520px){.tva-ag .ag-comm{grid-template-columns:1fr;}}

.tva-ag .ag-final{background:linear-gradient(160deg,#2A2440,#1B1730);border-radius:18px;padding:28px;margin-top:34px;text-align:center;color:#fff;}
.tva-ag .ag-final-h{font-size:21px;font-weight:800;margin-bottom:8px;}
.tva-ag .ag-final p{color:#C9C3DE;font-size:14.5px;line-height:1.6;margin:0 auto 18px;max-width:440px;}
.tva-ag .ag-final-btn{background:#fff;color:${P.indigo};border:none;border-radius:12px;padding:13px 24px;font-weight:700;font-size:15px;cursor:pointer;font-family:inherit;}
`
