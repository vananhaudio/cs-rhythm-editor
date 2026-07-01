// ClassJourney2027 — bài viết "HÀNH TRÌNH 2027" dựng native (full màn hình).
// Tông màu đồng bộ trang /class: kem #F2EEE7 · indigo #4338CA · honey #C9711E,
// dải tối dùng indigo đậm (#211C32) thay vì đen-vàng của PDF gốc.
const P = {
  bg: '#F2EEE7', surface: '#FFFFFF', ink: '#211C32', soft: '#5A5470', faint: '#8A8499',
  indigo: '#4338CA', indigoDark: '#352BA3', indigoTint: '#EEEBFB',
  honey: '#C9711E', honeyTint: '#FBF1E4', line: '#E4DED4',
  green: '#2E7D32', greenTint: '#E8F3E2', blue: '#1E5FBF', blueTint: '#E7EEFB',
  purple: '#6D3B9E', purpleTint: '#F0E9FA', danger: '#C0392B', dangerTint: '#FBECEA',
}

const Eyebrow = ({ children, color = P.honey }: { children: React.ReactNode; color?: string }) =>
  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color, marginBottom: 8 }}>{children}</div>
const H2 = ({ children }: { children: React.ReactNode }) =>
  <h2 style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2, letterSpacing: '-.4px', color: P.ink, margin: '0 0 6px' }}>{children}</h2>

function Node({ title, sub, bg, fg, tint }: { title: string; sub?: string; bg: string; fg: string; tint?: string }) {
  return (
    <div style={{ background: tint ?? bg, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: fg }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: P.soft, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default function ClassJourney2027({ onClose, onRegister }: { onClose: () => void; onRegister: () => void }) {
  const arrow = <div style={{ textAlign: 'center', color: P.faint, fontSize: 16, lineHeight: 1 }}>↓</div>
  return (
    <div className="tva-jny">
      <style>{CSS}</style>

      {/* Thanh trên */}
      <div className="jny-top">
        <button className="jny-back" onClick={onClose}>← Quay lại</button>
        <button className="jny-cta" onClick={onRegister}>Xem lớp &amp; đăng ký →</button>
      </div>

      <div className="jny-scroll">
        {/* 1. HERO */}
        <section className="jny-hero">
          <div className="jny-wrap">
            <div className="jny-tag">Thầy Văn Anh · Guitar</div>
            <h1>HÀNH TRÌNH<br /><span className="hl">2027</span></h1>
            <p>Lộ trình làm chủ cây đàn Guitar — từ số 0.</p>
            <div className="jny-stats">
              <div><b>25+</b><span>năm kinh nghiệm</span></div>
              <div><b>10</b><span>khoá học</span></div>
              <div><b>3</b><span>yếu tố cốt lõi</span></div>
            </div>
          </div>
        </section>

        {/* 2. VẤN ĐỀ */}
        <section className="jny-sec">
          <div className="jny-wrap">
            <p className="jny-lead">Trong hơn <b>25 năm học và chơi guitar</b>, thầy Văn Anh đã đi qua gần như mọi con đường mà người học đàn thường trải qua:</p>
            <div className="jny-grid4">
              {[['Học theo tab', 'Nhìn và bấm theo bản nhạc có sẵn'], ['Học thuộc hợp âm', 'Ghi nhớ vị trí ngón tay trên cần đàn'], ['Luyện kỹ thuật', 'Tập từng kỹ thuật riêng lẻ'], ['"Chững lại"', 'Không biết phải đi tiếp như thế nào']].map(([t, d], i) => (
                <div className="jny-card" key={i}><b>{t}</b><span>{d}</span></div>
              ))}
            </div>

            <div className="jny-quote">
              <div>"Vấn đề không nằm ở người học —<br /><span className="hl">mà nằm ở cách mà người học đang học."</span></div>
              <div className="jny-quote-by">— Thầy Văn Anh</div>
            </div>

            <p className="jny-lead">Rất nhiều người học guitar nhiều năm, nhưng vẫn không thể:</p>
            <div className="jny-list">
              {['Tự đệm một bài hát khi không có hợp âm cho trước', 'Bắt tông và đệm cho người khác hát', 'Chơi theo cảm nhận của mình, không phụ thuộc tab'].map((t, i) => (
                <div className="jny-no" key={i}><span className="x">✕</span>{t}</div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. BẢN CHẤT — 3 yếu tố */}
        <section className="jny-sec band">
          <div className="jny-wrap">
            <Eyebrow>Bản chất</Eyebrow>
            <H2>Chơi guitar không phải là ghi nhớ — là làm chủ âm thanh trên cây đàn</H2>
            <div className="jny-grid3" style={{ marginTop: 18 }}>
              {[['01', 'Tai nghe', 'Nghe được tông – hợp âm – giai điệu trong bất kỳ bài hát nào', P.green, P.greenTint], ['02', 'Tay đàn', 'Chơi được những gì mình nghe thấy và cảm nhận trong đầu', P.blue, P.blueTint], ['03', 'Tư duy âm nhạc', 'Hiểu cấu trúc, xử lý và tái tạo bài hát theo phong cách riêng', P.purple, P.purpleTint]].map(([n, t, d, c, tint], i) => (
                <div className="jny-num-card" key={i} style={{ background: tint as string, borderColor: (c as string) + '33' }}>
                  <div style={{ fontSize: 30, fontWeight: 800, fontStyle: 'italic', color: c as string }}>{n}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: c as string, margin: '6px 0 6px' }}>{t}</div>
                  <div style={{ fontSize: 13.5, color: P.soft, lineHeight: 1.5 }}>{d}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. Ý THỨC vs TIỀM THỨC */}
        <section className="jny-sec">
          <div className="jny-wrap">
            <div className="jny-callout">Khi 3 yếu tố này kết nối: không cần nhìn hợp âm, không phụ thuộc tab — <b>bạn nghe là biết, chơi là ra.</b></div>
            <Eyebrow>Điểm khác biệt cốt lõi</Eyebrow>
            <H2>Âm nhạc thực sự diễn ra ở tiềm thức — không phải ý thức</H2>
            <div className="jny-compare">
              <div className="jny-col dim">
                <div className="jny-col-h">Cách học thông thường</div>
                {['Nhớ hợp âm → biểu diễn', 'Nhớ bài → chơi lại', 'Nhớ vị trí nốt → bấm'].map((t, i) => <div className="jny-row" key={i}>{t}</div>)}
                <div className="jny-row bad">Biết nhiều — nhưng không chơi được</div>
              </div>
              <div className="jny-col good">
                <div className="jny-col-h" style={{ color: P.green }}>Phương pháp Thầy Văn Anh</div>
                {['Luyện tai nghe theo hệ thống', 'Gắn âm thanh với cảm nhận thực tế', 'Tạo phản xạ thay vì ghi nhớ'].map((t, i) => <div className="jny-row" key={i}>{t}</div>)}
                <div className="jny-row ok">Nghe là biết — chơi là ra</div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. SƠ ĐỒ HÀNH TRÌNH */}
        <section className="jny-sec band">
          <div className="jny-wrap">
            <Eyebrow>Lộ trình · Combo 10 khoá học</Eyebrow>
            <H2>Hành Trình 2027</H2>
            <p className="jny-lead">Một hệ thống hoàn chỉnh — không phải khóa học riêng lẻ. Đi đúng ngay từ đầu, phát triển đúng hướng, hình thành phản xạ âm nhạc thực sự.</p>

            <div className="jny-map">
              <div className="jny-step-lbl">Bước 1 · Miễn phí</div>
              <div className="jny-nhapmon">
                <b>NHẬP MÔN GUITAR</b>
                <span>Cầm đàn · Chỉnh dây · Luyện ngón cơ bản</span>
              </div>
              {arrow}
              <div className="jny-step-lbl">Bước 2 · Phát triển song song</div>
              <div className="jny-branches">
                <div className="jny-branch" style={{ borderColor: P.purple + '40' }}>
                  <div className="jny-branch-h" style={{ color: P.purple }}>Nhạc lý</div>
                  <Node title="Chìa khoá căn bản" sub="Free" bg="" fg={P.ink} tint={P.purpleTint} />
                  {arrow}<Node title="Chìa khoá nâng cao" bg="" fg={P.ink} tint={P.purpleTint} />
                  {arrow}<Node title="Hoà âm cảm âm" bg={P.purple} fg="#fff" />
                </div>
                <div className="jny-branch" style={{ borderColor: P.green + '40' }}>
                  <div className="jny-branch-h" style={{ color: P.green }}>Đệm hát · bè nền</div>
                  <Node title="Khởi đầu đam mê T1" bg="" fg={P.ink} tint={P.greenTint} />
                  {arrow}<Node title="Khởi đầu đam mê T2" bg="" fg={P.ink} tint={P.greenTint} />
                  {arrow}<Node title="Bứt phá đam mê T3" bg={P.green} fg="#fff" />
                </div>
                <div className="jny-branch" style={{ borderColor: P.blue + '40' }}>
                  <div className="jny-branch-h" style={{ color: P.blue }}>Tỉa nốt · bè giai điệu</div>
                  <Node title="Tỉa nốt Trình độ 1" bg="" fg={P.ink} tint={P.blueTint} />
                  {arrow}<Node title="Tỉa nốt Trình độ 2" bg="" fg={P.ink} tint={P.blueTint} />
                  {arrow}<Node title="Tỉa nốt Trình độ 3" bg={P.blue} fg="#fff" />
                </div>
              </div>
              {arrow}
              <div className="jny-step-lbl">Bước 3 · Nâng cao &amp; hội tụ</div>
              <Node title="Đệm hát Nâng cao" sub="Hội tụ Đệm + Tỉa + Nhạc lý" bg="" fg={P.ink} tint="#fff" />
              {arrow}
              <Node title="Solo Guitar" sub="Độc tấu · đỉnh cao hành trình" bg={P.honey} fg="#fff" />
              {arrow}
              <div className="jny-dich">Đích đến · LÀM CHỦ GUITAR</div>
            </div>
          </div>
        </section>

        {/* 5b. HỌC CÓ ĐIỀU KIỆN — không nhảy cóc */}
        <section className="jny-sec">
          <div className="jny-wrap">
            <Eyebrow>Vì sao bạn không "học sai đường"</Eyebrow>
            <H2>Học có điều kiện — không nhảy cóc, không hổng nền</H2>
            <p className="jny-lead">Mỗi khoá chỉ mở khi bạn đã đủ nền tảng. App tự dẫn đường theo bản đồ — bạn không thể vô tình bỏ sót gốc rễ.</p>
            <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
              {[
                ['Đệm hát 2', 'Đệm hát 1 + Nhạc lý 1'],
                ['Đệm hát 3', 'Đệm hát 2 + Nhạc lý 2'],
                ['Tỉa nốt 2', 'Tỉa nốt 1 + Nhạc lý 1'],
                ['Tỉa nốt 3', 'Tỉa nốt 2 + Nhạc lý 2'],
                ['Đệm hát Nâng cao', 'đủ Đệm 1-3 · Tỉa 1-3 · Nhạc lý'],
                ['Solo Guitar', 'Đệm hát Nâng cao'],
              ].map(([a, b], i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: P.surface, border: `1px solid ${P.line}`, borderRadius: 10, padding: '10px 14px' }}>
                  <b style={{ color: P.ink, fontSize: 14.5 }}>{a}</b>
                  <span style={{ color: P.faint, fontSize: 12.5 }}>chỉ mở khi xong</span>
                  <em style={{ color: P.indigo, fontWeight: 700, fontStyle: 'normal', fontSize: 14 }}>{b}</em>
                </div>
              ))}
            </div>
            <div className="jny-callout" style={{ marginTop: 16 }}>Đi nhanh nếu đủ năng lực — nhưng không quên nền tảng. Nếu bạn học vượt cấp (được thầy duyệt), app vẫn nhắc phần nền còn thiếu để bạn bổ sung, để hành trình luôn chắc.</div>
          </div>
        </section>

        {/* 6. SOLO = ĐỆM + TỈA + AZZ */}
        <section className="jny-sec">
          <div className="jny-wrap">
            <div className="jny-formula">
              <Eyebrow>Sự thật quan trọng nhất</Eyebrow>
              <div className="jny-eq">
                <span className="b1">SOLO</span><i>=</i><span className="b2">ĐỆM</span><i>+</i><span className="b3">TỈA</span>
              </div>
              <p>Thiếu một trong hai nền tảng, solo chỉ là bấm nốt theo tab người khác soạn — không có hồn, không có phong cách riêng.</p>
            </div>

            <Eyebrow>Phương pháp học</Eyebrow>
            <H2>Mô hình AZZ — học liên hoàn mỗi ngày</H2>
            <div className="jny-grid3" style={{ marginTop: 16 }}>
              {[['A', 'App', 'Học kiến thức nền tảng mỗi ngày — linh hoạt theo nhịp sống của bạn', P.honey], ['Z', 'Zalo', 'Sửa bài – kèm sát – chỉnh lỗi trực tiếp với thầy và cộng đồng học viên', P.green], ['Z', 'Zoom', 'Thầy giảng trực tiếp trên lớp — hiểu sâu, quan sát, phát triển cùng nhau', P.blue]].map(([l, t, d, c], i) => (
                <div className="jny-card2" key={i}>
                  <div style={{ fontSize: 34, fontWeight: 800, fontFamily: 'Georgia, serif', color: c as string, lineHeight: 1 }}>{l}</div>
                  <b style={{ display: 'block', margin: '8px 0 4px', color: P.ink }}>{t}</b>
                  <span style={{ fontSize: 13.5, color: P.soft, lineHeight: 1.5 }}>{d}</span>
                </div>
              ))}
            </div>

            <div className="jny-notneed">
              <div className="jny-notneed-h">Bạn không cần…</div>
              <div className="jny-notneed-items"><s>Năng khiếu đặc biệt</s><s>Biết nhạc lý trước</s><s>Nhiều năm kinh nghiệm</s></div>
              <div className="jny-notneed-yes">Bạn chỉ cần: đi đúng phương pháp</div>
            </div>
          </div>
        </section>

        {/* 7. CTA */}
        <section className="jny-sec">
          <div className="jny-wrap">
            <div className="jny-final">
              <Eyebrow color="#E8B96B">Bắt đầu hành trình</Eyebrow>
              <h3>Bắt đầu từ Nhập môn — Miễn phí</h3>
              <p>Trải nghiệm trước khi quyết định. Đúng nền tảng trước khi bước vào lớp học.</p>
              <div className="jny-final-row">
                <div><span>Combo Hành Trình 2027 (10 khoá)</span><b>9.990.000đ</b><small>tiết kiệm so với học lẻ</small></div>
                <div><span>Học lẻ từng khoá</span><b>990.000đ</b><small>2 tháng · 8 buổi / khoá</small></div>
                <div><span>Đăng ký qua Zalo</span><b className="zalo">0983 259 893</b><small>Thầy Văn Anh</small></div>
              </div>
              <button className="jny-final-btn" onClick={onRegister}>Xem lớp &amp; đăng ký ngay →</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

const CSS = `
.tva-jny{position:fixed;inset:0;z-index:120;background:${P.bg};display:flex;flex-direction:column;font-family:'Be Vietnam Pro',system-ui,sans-serif;color:${P.ink};text-align:left;}
.tva-jny *{box-sizing:border-box;}
.tva-jny .jny-top{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 20px;background:rgba(242,238,231,.92);backdrop-filter:blur(10px);border-bottom:1px solid ${P.line};}
.tva-jny .jny-back{border:1.5px solid #D3CEE8;background:#fff;color:${P.indigo};border-radius:10px;padding:9px 16px;font-weight:600;font-size:14px;cursor:pointer;font-family:inherit;}
.tva-jny .jny-cta{border:none;background:${P.indigo};color:#fff;border-radius:10px;padding:9px 16px;font-weight:600;font-size:14px;cursor:pointer;font-family:inherit;}
.tva-jny .jny-scroll{flex:1;overflow-y:auto;}
.tva-jny .jny-wrap{max-width:880px;margin:0 auto;padding:0 22px;}
.tva-jny .jny-sec{padding:44px 0;}
.tva-jny .jny-sec.band{background:#fff;border-top:1px solid ${P.line};border-bottom:1px solid ${P.line};}
.tva-jny .jny-lead{font-size:16px;line-height:1.7;color:${P.soft};margin:0 0 18px;}
.tva-jny .jny-lead b{color:${P.ink};}

.tva-jny .jny-hero{background:linear-gradient(160deg,#2A2440,#1B1730);color:#fff;padding:52px 0 46px;}
.tva-jny .jny-hero .jny-tag{display:inline-block;font-size:11.5px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#E8B96B;background:rgba(232,185,107,.12);padding:5px 11px;border-radius:6px;margin-bottom:16px;}
.tva-jny .jny-hero h1{font-size:48px;font-weight:800;line-height:1.02;letter-spacing:-1px;margin:0;}
.tva-jny .jny-hero h1 .hl{color:#E8B96B;font-style:italic;}
.tva-jny .jny-hero p{margin:14px 0 0;color:#C9C3DE;font-size:16px;}
.tva-jny .jny-stats{display:flex;gap:26px;margin-top:26px;border-top:1px solid rgba(255,255,255,.14);padding-top:18px;}
.tva-jny .jny-stats b{display:block;font-size:26px;font-weight:800;font-style:italic;color:#fff;}
.tva-jny .jny-stats span{font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:#9C95B8;}
@media(max-width:560px){.tva-jny .jny-hero h1{font-size:36px;}}

.tva-jny .jny-grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px;}
.tva-jny .jny-card{border:1px solid ${P.line};border-radius:12px;padding:13px;background:#fff;}
.tva-jny .jny-card b{display:block;font-size:14px;color:${P.ink};margin-bottom:4px;}
.tva-jny .jny-card span{font-size:12.5px;color:${P.faint};line-height:1.45;}
@media(max-width:680px){.tva-jny .jny-grid4{grid-template-columns:1fr 1fr;}}

.tva-jny .jny-quote{background:linear-gradient(160deg,#2A2440,#1B1730);border-radius:16px;padding:26px 28px;margin:8px 0 26px;}
.tva-jny .jny-quote>div:first-child{font-size:19px;font-weight:700;font-style:italic;line-height:1.4;color:#fff;}
.tva-jny .jny-quote .hl{color:#E8B96B;}
.tva-jny .jny-quote-by{margin-top:14px;font-size:12.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#9C95B8;}

.tva-jny .jny-list{display:flex;flex-direction:column;gap:9px;}
.tva-jny .jny-no{display:flex;align-items:center;gap:11px;background:${P.dangerTint};border:1px solid #F1C9C4;border-radius:11px;padding:12px 15px;font-size:14.5px;color:${P.ink};font-weight:500;}
.tva-jny .jny-no .x{width:22px;height:22px;flex-shrink:0;border-radius:50%;background:${P.danger};color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;}

.tva-jny .jny-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
.tva-jny .jny-num-card{border:1px solid;border-radius:14px;padding:18px;}
@media(max-width:680px){.tva-jny .jny-grid3{grid-template-columns:1fr;}}

.tva-jny .jny-callout{background:${P.greenTint};border-left:3px solid ${P.green};border-radius:0 12px 12px 0;padding:14px 18px;font-size:15px;color:${P.soft};line-height:1.6;margin-bottom:24px;}
.tva-jny .jny-callout b{color:${P.ink};}
.tva-jny .jny-compare{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px;}
.tva-jny .jny-col{border:1px solid ${P.line};border-radius:14px;padding:16px;background:#fff;}
.tva-jny .jny-col.good{border-color:${P.green}55;background:${P.greenTint}66;}
.tva-jny .jny-col-h{font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:${P.faint};margin-bottom:12px;}
.tva-jny .jny-row{background:#F7F5F1;border-radius:9px;padding:10px 12px;font-size:13.5px;color:${P.soft};margin-bottom:8px;}
.tva-jny .jny-col.good .jny-row{background:#fff;}
.tva-jny .jny-row.bad{background:${P.dangerTint};color:${P.danger};font-weight:700;}
.tva-jny .jny-row.ok{background:${P.green};color:#fff;font-weight:700;}
@media(max-width:560px){.tva-jny .jny-compare{grid-template-columns:1fr;}}

.tva-jny .jny-map{margin-top:18px;}
.tva-jny .jny-step-lbl{text-align:center;font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${P.faint};margin:6px 0;}
.tva-jny .jny-nhapmon{background:linear-gradient(150deg,${P.honey},#E08A3C);border-radius:13px;padding:16px;text-align:center;color:#fff;}
.tva-jny .jny-nhapmon b{display:block;font-size:17px;font-weight:800;letter-spacing:.02em;}
.tva-jny .jny-nhapmon span{font-size:12.5px;opacity:.92;}
.tva-jny .jny-branches{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
.tva-jny .jny-branch{border:1.5px solid;border-radius:14px;padding:14px;background:#fff;display:flex;flex-direction:column;gap:7px;}
.tva-jny .jny-branch-h{font-size:11.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;margin-bottom:2px;}
@media(max-width:680px){.tva-jny .jny-branches{grid-template-columns:1fr;}}
.tva-jny .jny-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.tva-jny .jny-grid2>div{border:1px solid ${P.line};}
.tva-jny .jny-dich{background:linear-gradient(150deg,${P.indigo},#6D63E6);border-radius:14px;padding:20px;text-align:center;color:#fff;font-size:20px;font-weight:800;font-style:italic;letter-spacing:.02em;}

.tva-jny .jny-formula{border:1.5px solid ${P.honey}66;border-radius:16px;padding:24px;text-align:center;margin-bottom:30px;background:${P.honeyTint}66;}
.tva-jny .jny-eq{display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;margin:6px 0 12px;}
.tva-jny .jny-eq span{padding:11px 22px;border-radius:11px;color:#fff;font-weight:800;font-style:italic;font-size:18px;}
.tva-jny .jny-eq .b1{background:${P.indigo};}.tva-jny .jny-eq .b2{background:${P.green};}.tva-jny .jny-eq .b3{background:${P.blue};}
.tva-jny .jny-eq i{font-style:normal;font-size:22px;font-weight:700;color:${P.faint};}
.tva-jny .jny-formula p{font-size:14.5px;color:${P.soft};max-width:520px;margin:0 auto;line-height:1.6;}

.tva-jny .jny-card2{border:1px solid ${P.line};border-radius:14px;padding:18px;background:#fff;}
.tva-jny .jny-notneed{margin-top:28px;background:#F4F2EC;border-radius:16px;padding:24px;text-align:center;}
.tva-jny .jny-notneed-h{font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${P.faint};}
.tva-jny .jny-notneed-items{display:flex;gap:18px;justify-content:center;flex-wrap:wrap;margin:12px 0;}
.tva-jny .jny-notneed-items s{color:${P.faint};font-size:14.5px;}
.tva-jny .jny-notneed-yes{font-size:17px;font-weight:800;color:${P.green};}

.tva-jny .jny-final{background:linear-gradient(160deg,#2A2440,#1B1730);border-radius:20px;padding:34px;text-align:center;color:#fff;}
.tva-jny .jny-final h3{font-size:26px;font-weight:800;font-style:italic;margin:0 0 8px;}
.tva-jny .jny-final p{color:#C9C3DE;font-size:14.5px;margin:0 auto;max-width:440px;}
.tva-jny .jny-final-row{display:flex;gap:30px;justify-content:center;flex-wrap:wrap;margin:24px 0;padding-top:20px;border-top:1px solid rgba(255,255,255,.14);text-align:left;}
.tva-jny .jny-final-row span{display:block;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#9C95B8;margin-bottom:5px;}
.tva-jny .jny-final-row b{display:block;font-size:24px;font-weight:800;color:#fff;}
.tva-jny .jny-final-row b.zalo{color:#E8B96B;font-style:italic;}
.tva-jny .jny-final-row small{font-size:12px;color:#9C95B8;}
.tva-jny .jny-final-btn{margin-top:6px;background:#fff;color:${P.indigo};border:none;border-radius:12px;padding:14px 26px;font-weight:700;font-size:15px;cursor:pointer;font-family:inherit;}
`
