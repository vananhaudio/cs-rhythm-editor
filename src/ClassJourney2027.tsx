// ClassJourney2027 — bài showcase "HÀNH TRÌNH 2027" (bám bản gốc của thầy).
// Viết tự nhiên, chạm nỗi lo thầm kín, cho thấy "vào rất dễ". 2 nhánh (Đệm + Tỉa), đích = Nghệ sĩ Guitar.
// KHÔNG nói chuyên môn/mã; Nhạc lý chỉ là nền đi kèm (không nêu như 1 nhánh). Editorial serif, tông /class.
const P = {
  bg: '#F2EEE7', surface: '#FFFFFF', ink: '#211C32', soft: '#5A5470', faint: '#8A8499',
  indigo: '#4338CA', indigoDark: '#352BA3', indigoTint: '#EEEBFB',
  honey: '#C9711E', honeyTint: '#FBF1E4', line: '#E4DED4',
  green: '#2E7D32', greenTint: '#E8F3E2', blue: '#1E5FBF', blueTint: '#E7EEFB',
  purple: '#6D3B9E', purpleTint: '#F0E9FA', danger: '#C0392B', dangerTint: '#FBECEA',
}
const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif"

const Eyebrow = ({ children, color = P.honey }: { children: React.ReactNode; color?: string }) =>
  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color, marginBottom: 8 }}>{children}</div>
const H2 = ({ children }: { children: React.ReactNode }) =>
  <h2 style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-.4px', color: P.ink, margin: '0 0 8px' }}>{children}</h2>
const Bul = ({ items }: { items: string[] }) =>
  <ul className="jny-bul">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>

export default function ClassJourney2027({ onClose, onRegister }: { onClose: () => void; onRegister: () => void }) {
  const arrow = <div style={{ textAlign: 'center', color: P.faint, fontSize: 16, lineHeight: 1, margin: '2px 0' }}>↓</div>
  return (
    <div className="tva-jny">
      <style>{CSS}</style>

      <div className="jny-top">
        <button className="jny-back" onClick={onClose}>← Quay lại</button>
        <button className="jny-cta" onClick={onRegister}>Xem lớp &amp; đăng ký →</button>
      </div>

      <div className="jny-scroll">
        {/* HERO */}
        <section className="jny-hero">
          <div className="jny-wrap">
            <div className="jny-tag">Thầy Văn Anh · Guitar</div>
            <h1>HÀNH TRÌNH <span className="hl">2027</span></h1>
            <p>Lộ trình <b>làm chủ cây đàn guitar</b> — từ số 0 đến khi tự chơi theo cảm xúc của mình.</p>
            <div className="jny-stats">
              <div><b>25+</b><span>năm kinh nghiệm</span></div>
              <div><b>10</b><span>khoá học</span></div>
              <div><b>1</b><span>lộ trình rõ ràng</span></div>
            </div>
          </div>
        </section>

        {/* 1. VẤN ĐỀ */}
        <section className="jny-sec">
          <div className="jny-wrap">
            <p className="jny-lead">Trong hơn <b>25 năm học và chơi guitar</b>, thầy Văn Anh đã đi qua gần như mọi con đường mà người học đàn thường trải qua:</p>
            <div className="jny-grid4">
              {[['Học theo tab', 'Nhìn và bấm theo bản nhạc có sẵn'], ['Học thuộc hợp âm', 'Ghi nhớ vị trí ngón trên cần đàn'], ['Luyện kỹ thuật', 'Tập từng kỹ thuật riêng lẻ'], ['"Chững lại"', 'Không biết phải đi tiếp thế nào']].map(([t, d], i) => (
                <div className="jny-card" key={i}><b>{t}</b><span>{d}</span></div>
              ))}
            </div>
            <div className="jny-quote">
              <div>Vấn đề không nằm ở người học —<br /><span className="hl">mà nằm ở cách mà người học đang học.</span></div>
              <div className="jny-quote-by">— Thầy Văn Anh</div>
            </div>
            <p className="jny-lead">Rất nhiều người học guitar nhiều năm, nhưng vẫn không thể:</p>
            <div className="jny-list">
              {['Tự đệm một bài hát khi không có sẵn hợp âm', 'Bắt tông và đệm cho người khác hát', 'Chơi theo cảm nhận của chính mình'].map((t, i) => (
                <div className="jny-no" key={i}><span className="x">✕</span>{t}</div>
              ))}
            </div>
          </div>
        </section>

        {/* 2. BẢN CHẤT — 3 yếu tố */}
        <section className="jny-sec band">
          <div className="jny-wrap">
            <Eyebrow>Bản chất của việc chơi guitar</Eyebrow>
            <H2>Chơi guitar không phải là ghi nhớ — mà là làm chủ âm thanh trên cây đàn</H2>
            <div className="jny-grid3" style={{ marginTop: 18 }}>
              {[['01', 'Tai nghe', 'Nghe được tông – hợp âm – giai điệu trong bất kỳ bài hát nào', P.green, P.greenTint], ['02', 'Tay đàn', 'Chơi được những gì mình nghe thấy và cảm nhận trong đầu', P.blue, P.blueTint], ['03', 'Tư duy âm nhạc', 'Hiểu, xử lý và tái tạo bài hát theo cách của riêng mình', P.purple, P.purpleTint]].map(([n, t, d, c, tint], i) => (
                <div className="jny-num-card" key={i} style={{ background: tint as string, borderColor: (c as string) + '33' }}>
                  <div style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 800, fontStyle: 'italic', color: c as string }}>{n}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: c as string, margin: '6px 0' }}>{t}</div>
                  <div style={{ fontSize: 13.5, color: P.soft, lineHeight: 1.5 }}>{d}</div>
                </div>
              ))}
            </div>
            <div className="jny-callout" style={{ marginTop: 18 }}>Khi 3 yếu tố này kết nối: không cần nhìn hợp âm, không phụ thuộc tab — <b>bạn tự chơi theo cảm nhận của mình.</b></div>
          </div>
        </section>

        {/* 3. ĐIỂM KHÁC BIỆT CỐT LÕI */}
        <section className="jny-sec">
          <div className="jny-wrap">
            <Eyebrow>Điểm khác biệt cốt lõi</Eyebrow>
            <H2>Khác biệt không nằm ở nội dung dạy — mà ở cách học được thiết kế</H2>
            <p className="jny-lead" style={{ marginTop: 10 }}>Sau nhiều năm nghiên cứu, thầy nhận ra một điều: người học <b>không thiếu kiến thức</b> — mà thiếu <b>khả năng cảm âm và phản xạ âm nhạc từ bên trong</b>.</p>

            <div className="jny-compare">
              <div className="jny-col dim">
                <div className="jny-col-h">Học bằng ý thức (cách thường)</div>
                {['Nhớ hợp âm', 'Nhớ bài', 'Nhớ vị trí nốt'].map((t, i) => <div className="jny-row" key={i}>{t}</div>)}
                <div className="jny-row bad">Biết nhiều — nhưng không chơi được</div>
              </div>
              <div className="jny-col good">
                <div className="jny-col-h" style={{ color: P.green }}>Học vào tiềm thức (phương pháp thầy)</div>
                {['Nghe → phản xạ → chơi ngay', 'Không cần dừng lại suy nghĩ', 'Âm nhạc bật ra tự nhiên'].map((t, i) => <div className="jny-row" key={i}>{t}</div>)}
                <div className="jny-row ok">Nghe là biết — chơi là ra</div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. PHƯƠNG PHÁP TÁC ĐỘNG VÀO TIỀM THỨC */}
        <section className="jny-sec band">
          <div className="jny-wrap">
            <Eyebrow>Cách phương pháp hoạt động</Eyebrow>
            <H2>Đưa âm nhạc đi từ ý thức vào tiềm thức</H2>
            <p className="jny-lead" style={{ marginTop: 10 }}>Âm nhạc thực sự diễn ra ở <b>tiềm thức</b> — nơi bạn nghe và chơi ngay, không cần suy nghĩ. Thầy xây phương pháp để đưa bạn tới đó, thông qua:</p>
            <div className="jny-grid4">
              {[['Luyện tai nghe theo hệ thống', ''], ['Lặp lại có chủ đích', ''], ['Gắn âm thanh với cảm nhận thực tế', ''], ['Tạo phản xạ thay vì ghi nhớ', '']].map(([t], i) => (
                <div className="jny-card" key={i} style={{ display: 'flex', alignItems: 'center', minHeight: 64 }}><b style={{ margin: 0 }}>{t}</b></div>
              ))}
            </div>
            <div className="jny-callout" style={{ marginTop: 6 }}>Người học theo cách thường → biết nhiều nhưng không chơi được.<br /><b>Người học theo phương pháp này → chơi được thực chiến, dù không cần biết quá nhiều.</b></div>
          </div>
        </section>

        {/* 5. BẢN ĐỒ HÀNH TRÌNH */}
        <section className="jny-sec">
          <div className="jny-wrap">
            <Eyebrow>Lộ trình · Hệ thống hoàn chỉnh</Eyebrow>
            <H2>Hành Trình 2027</H2>
            <p className="jny-lead">Không phải một khóa học riêng lẻ — mà là một hệ thống hoàn chỉnh, giúp bạn <b>đi đúng ngay từ đầu</b>, phát triển đúng hướng, và hình thành phản xạ âm nhạc thực sự.</p>

            <div className="jny-map">
              <div className="jny-step-lbl">Bước 1 · Miễn phí — chuẩn hoá đầu vào</div>
              <div className="jny-nhapmon">
                <b>NHẬP MÔN GUITAR</b>
                <span>Cầm đàn · Chỉnh dây · Luyện ngón cơ bản · Làm quen nhạc cụ</span>
              </div>
              {arrow}
              <div className="jny-step-lbl">Bước 2 · Phát triển theo 2 nhánh song song</div>
              <div className="jny-branches2">
                <div className="jny-branch" style={{ borderColor: P.green + '55' }}>
                  <div className="jny-branch-h" style={{ color: P.green }}>🎸 Đệm hát <span style={{ color: P.faint, fontWeight: 500 }}>· bè nền</span></div>
                  <Bul items={['Đệm hát căn bản', 'Đệm hát theo tai', 'Tự cảm âm hợp âm', 'Giữ nhịp – tạo tiết tấu', 'Làm chủ bài hát']} />
                </div>
                <div className="jny-branch" style={{ borderColor: P.blue + '55' }}>
                  <div className="jny-branch-h" style={{ color: P.blue }}>🎼 Tỉa nốt <span style={{ color: P.faint, fontWeight: 500 }}>· bè giai điệu</span></div>
                  <Bul items={['Nghe và chơi lại giai điệu', 'Tạo câu lót', 'Tạo intro – outro', 'Phát triển cảm âm']} />
                </div>
              </div>
            </div>

            <div className="jny-formula" style={{ margin: '24px 0' }}>
              <Eyebrow>Sự thật quan trọng nhất</Eyebrow>
              <div className="jny-eq"><span className="b1">SOLO</span><i>=</i><span className="b2">ĐỆM</span><i>+</i><span className="b3">TỈA</span></div>
              <p>Thiếu một trong hai nền tảng, solo chỉ là bấm nốt theo tab người khác soạn — không có hồn, không có phong cách riêng.</p>
            </div>

            <div className="jny-map">
              <div className="jny-step-lbl">Bước 3 · Nâng cao &amp; hội tụ</div>
              <div className="jny-branch" style={{ borderColor: P.indigo + '40' }}>
                <div className="jny-branch-h" style={{ color: P.indigo }}>Bắt đầu thực sự chơi nhạc</div>
                <Bul items={['Đệm hát nâng cao', 'Solo guitar', 'Ứng biến và sáng tạo']} />
              </div>
              {arrow}
              <div className="jny-dich">Đích đến · LÀM CHỦ CÂY ĐÀN GUITAR</div>
              <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                {[
                  ['Tự mình cảm nhận được tiếng đàn', 'Không cần ai phán xét, bạn tự biết trong tâm rằng mình đang dần làm chủ cây đàn.'],
                  ['Đệm hát được cho mình và cho người khác', 'Biết chọn đúng tông, đúng giọng, biết giữ nhịp và điều khiển nhanh chậm theo cảm xúc của người hát.'],
                  ['Chơi được bài hát theo cách của mình', 'Không còn phụ thuộc hoàn toàn vào tab có sẵn, mà có thể tự đệm, tự tỉa, tự soạn solo phù hợp với kỹ năng và phong cách riêng.'],
                ].map(([t, d], i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, background: P.surface, border: `1px solid ${P.line}`, borderRadius: 12, padding: '14px 16px' }}>
                    <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: P.indigoTint, color: P.indigo, fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                    <div>
                      <b style={{ display: 'block', color: P.ink, fontSize: 15.5, marginBottom: 3 }}>{t}</b>
                      <span style={{ color: P.soft, fontSize: 14, lineHeight: 1.55 }}>{d}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 6. AZZ */}
        <section className="jny-sec band">
          <div className="jny-wrap">
            <Eyebrow>Phương pháp học liên hoàn</Eyebrow>
            <H2>Mô hình AZZ — App · Zalo · Zoom</H2>
            <div className="jny-grid3" style={{ marginTop: 16 }}>
              {[['A', 'App', 'Học kiến thức nền tảng mỗi ngày — linh hoạt theo nhịp sống của bạn', P.honey], ['Z', 'Zalo', 'Sửa bài – kèm sát – chỉnh lỗi trực tiếp với thầy và cộng đồng học viên', P.green], ['Z', 'Zoom', 'Thầy giảng trực tiếp — hiểu sâu, quan sát, phát triển cùng nhau', P.blue]].map(([l, t, d, c], i) => (
                <div className="jny-card2" key={i}>
                  <div style={{ fontFamily: SERIF, fontSize: 36, fontWeight: 800, color: c as string, lineHeight: 1 }}>{l}</div>
                  <b style={{ display: 'block', margin: '8px 0 4px', color: P.ink }}>{t}</b>
                  <span style={{ fontSize: 13.5, color: P.soft, lineHeight: 1.5 }}>{d}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 7. GIÁ TRỊ THẬT + HAI CÁCH */}
        <section className="jny-sec">
          <div className="jny-wrap">
            <div className="jny-quote">
              <div>Thời đại có Google và AI, kiến thức không còn là lợi thế.<br /><span className="hl">Kinh nghiệm – phản xạ – bí kíp thực chiến mới quyết định bạn có chơi được hay không.</span></div>
            </div>

            <Eyebrow>Hai cách tham gia hành trình</Eyebrow>
            <H2>Đi từng bước, hay đi trọn combo?</H2>
            <div className="jny-way">
              <div className="jny-way-card">
                <div className="jny-way-h">Học từng khóa lẻ</div>
                <p style={{ fontSize: 14, color: P.soft, lineHeight: 1.6, margin: 0 }}>Phù hợp nếu bạn muốn đi từng bước, thử trước rồi quyết định tiếp.</p>
              </div>
              <div className="jny-way-card hot">
                <div className="jny-way-h" style={{ color: P.honey }}>Combo Hành Trình 2027</div>
                <Bul items={['Học toàn bộ lộ trình', 'Thích học lớp nào cũng được', 'Không bị giới hạn hướng đi', 'Tiết kiệm chi phí hơn rất nhiều']} />
              </div>
            </div>

            <div className="jny-notneed">
              <div className="jny-notneed-h">Bạn không cần…</div>
              <div className="jny-notneed-items"><s>Năng khiếu đặc biệt</s><s>Biết nhạc lý trước</s><s>Nhiều năm kinh nghiệm</s></div>
              <div className="jny-notneed-yes">Bạn chỉ cần: đi đúng phương pháp</div>
            </div>
          </div>
        </section>

        {/* 8. QUYỀN LỢI COMBO + CTA + KẾT LUẬN */}
        <section className="jny-sec">
          <div className="jny-wrap">
            <Eyebrow>Combo Hành Trình 2027 gồm gì?</Eyebrow>
            <H2>Trọn lộ trình — không chỉ 10 khoá lẻ</H2>
            <div style={{ display: 'grid', gap: 10, marginTop: 14, marginBottom: 26 }}>
              {[
                ['🎓', '10 khoá học chính', 'Toàn bộ lộ trình Đệm hát · Tỉa nốt · Nâng cao · Solo — thích học lớp nào cũng được, không giới hạn hướng đi.'],
                ['🧩', 'Các khoá phụ trợ', 'Cảm nhận tông nhạc, Thị tấu và các nền nhạc lý — bổ trợ cảm âm và đọc bản, giúp bạn tiến nhanh và chắc hơn.'],
                ['🎥', '40 buổi học Zoom chuyên thực hành', 'Các buổi Zoom tập trung 100% vào THỰC HÀNH: thầy kèm trực tiếp, sửa bài, luyện phản xạ thực chiến — phần mà học lẻ không có.'],
                ['💰', 'Tiết kiệm hơn rất nhiều', 'So với mua từng khoá lẻ cộng học riêng — một mức chi phí, đi trọn hành trình.'],
              ].map(([ic, t, d], i) => (
                <div key={i} style={{ display: 'flex', gap: 13, background: P.surface, border: `1px solid ${P.line}`, borderRadius: 12, padding: '14px 16px' }}>
                  <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1.1 }}>{ic}</span>
                  <div>
                    <b style={{ display: 'block', color: P.ink, fontSize: 15.5, marginBottom: 3 }}>{t}</b>
                    <span style={{ color: P.soft, fontSize: 14, lineHeight: 1.55 }}>{d}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="jny-final">
              <Eyebrow color="#E8B96B">Bắt đầu hành trình</Eyebrow>
              <h3>Bắt đầu từ Nhập môn — Miễn phí</h3>
              <p>Trải nghiệm trước khi quyết định. Đúng nền tảng trước khi bước vào lớp học.</p>
              <div className="jny-final-row">
                <div><span>Combo Hành Trình 2027</span><b>9.990.000đ</b><small>10 khoá + phụ trợ + 40 buổi Zoom chuyên thực hành</small></div>
                <div><span>Học lẻ từng khoá</span><b>990.000đ</b><small>2 tháng · 8 buổi / khoá</small></div>
                <div><span>Đăng ký qua Zalo</span><b className="zalo">0983 259 893</b><small>Thầy Văn Anh</small></div>
              </div>
              <button className="jny-final-btn" onClick={onRegister}>Xem lớp &amp; đăng ký ngay →</button>
              <p style={{ marginTop: 20, fontStyle: 'italic', color: '#C9C3DE' }}>Hành Trình 2027 không dạy bạn chơi đàn theo cách thông thường — mà giúp bạn <b style={{ color: '#fff' }}>làm chủ cây đàn từ bên trong.</b></p>
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
.tva-jny .jny-wrap{max-width:860px;margin:0 auto;padding:0 22px;}
.tva-jny .jny-sec{padding:44px 0;}
.tva-jny .jny-sec.band{background:#fff;border-top:1px solid ${P.line};border-bottom:1px solid ${P.line};}
.tva-jny .jny-lead{font-size:16.5px;line-height:1.75;color:${P.soft};margin:0 0 18px;}
.tva-jny .jny-lead b{color:${P.ink};}

.tva-jny .jny-hero{padding:48px 0 26px;}
.tva-jny .jny-hero .jny-tag{display:inline-block;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${P.honey};margin-bottom:14px;}
.tva-jny .jny-hero h1{font-family:${SERIF};font-size:56px;font-weight:800;line-height:1.03;letter-spacing:-1px;margin:0;color:${P.ink};}
.tva-jny .jny-hero h1 .hl{color:${P.honey};}
.tva-jny .jny-hero p{margin:16px 0 0;color:${P.soft};font-size:17px;line-height:1.6;}
.tva-jny .jny-hero p b{color:${P.ink};}
.tva-jny .jny-stats{display:flex;gap:28px;margin-top:24px;border-top:1px solid ${P.line};padding-top:18px;}
.tva-jny .jny-stats b{display:block;font-family:${SERIF};font-size:30px;font-weight:800;color:${P.ink};}
.tva-jny .jny-stats span{font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:${P.faint};}
@media(max-width:560px){.tva-jny .jny-hero h1{font-size:38px;}}

.tva-jny .jny-grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px;}
.tva-jny .jny-card{border:1px solid ${P.line};border-radius:12px;padding:13px;background:#fff;}
.tva-jny .jny-card b{display:block;font-size:14px;color:${P.ink};margin-bottom:4px;}
.tva-jny .jny-card span{font-size:12.5px;color:${P.faint};line-height:1.45;}
@media(max-width:680px){.tva-jny .jny-grid4{grid-template-columns:1fr 1fr;}}

.tva-jny .jny-quote{background:${P.honeyTint};border-left:3px solid ${P.honey};border-radius:0 16px 16px 0;padding:24px 28px;margin:8px 0 26px;}
.tva-jny .jny-quote>div:first-child{font-family:${SERIF};font-size:23px;font-weight:700;font-style:italic;line-height:1.4;color:${P.ink};}
.tva-jny .jny-quote .hl{color:${P.honey};}
.tva-jny .jny-quote-by{margin-top:14px;font-size:12.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${P.faint};}

.tva-jny .jny-list{display:flex;flex-direction:column;gap:9px;}
.tva-jny .jny-no{display:flex;align-items:center;gap:11px;background:${P.dangerTint};border:1px solid #F1C9C4;border-radius:11px;padding:12px 15px;font-size:14.5px;color:${P.ink};font-weight:500;}
.tva-jny .jny-no .x{width:22px;height:22px;flex-shrink:0;border-radius:50%;background:${P.danger};color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;}

.tva-jny .jny-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
.tva-jny .jny-num-card{border:1px solid;border-radius:14px;padding:18px;}
@media(max-width:680px){.tva-jny .jny-grid3{grid-template-columns:1fr;}}

.tva-jny .jny-callout{background:${P.greenTint};border-left:3px solid ${P.green};border-radius:0 12px 12px 0;padding:14px 18px;font-size:15px;color:${P.soft};line-height:1.6;}
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

.tva-jny .jny-map{margin-top:16px;}
.tva-jny .jny-step-lbl{text-align:center;font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${P.faint};margin:10px 0 8px;}
.tva-jny .jny-nhapmon{background:linear-gradient(150deg,${P.honey},#E08A3C);border-radius:13px;padding:16px;text-align:center;color:#fff;}
.tva-jny .jny-nhapmon b{display:block;font-size:17px;font-weight:800;letter-spacing:.02em;}
.tva-jny .jny-nhapmon span{font-size:12.5px;opacity:.92;}
.tva-jny .jny-branches2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
@media(max-width:680px){.tva-jny .jny-branches2{grid-template-columns:1fr;}}
.tva-jny .jny-branch{border:1.5px solid;border-radius:14px;padding:16px;background:#fff;}
.tva-jny .jny-branch-h{font-size:15px;font-weight:800;margin-bottom:4px;}
.tva-jny .jny-bul{list-style:none;margin:6px 0 0;padding:0;}
.tva-jny .jny-bul li{position:relative;padding:4px 0 4px 18px;font-size:14px;color:${P.soft};line-height:1.5;}
.tva-jny .jny-bul li:before{content:'';position:absolute;left:2px;top:11px;width:6px;height:6px;border-radius:50%;background:${P.honey};}
.tva-jny .jny-dich{background:linear-gradient(150deg,${P.indigo},#6D63E6);border-radius:14px;padding:18px;text-align:center;color:#fff;font-family:${SERIF};font-size:22px;font-weight:800;letter-spacing:.02em;}

.tva-jny .jny-formula{border:1.5px solid ${P.honey}66;border-radius:16px;padding:24px;text-align:center;background:${P.honeyTint}66;}
.tva-jny .jny-eq{display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;margin:6px 0 12px;}
.tva-jny .jny-eq span{padding:11px 22px;border-radius:11px;color:#fff;font-weight:800;font-style:italic;font-size:18px;}
.tva-jny .jny-eq .b1{background:${P.indigo};}.tva-jny .jny-eq .b2{background:${P.green};}.tva-jny .jny-eq .b3{background:${P.blue};}
.tva-jny .jny-eq i{font-style:normal;font-size:22px;font-weight:700;color:${P.faint};}
.tva-jny .jny-formula p{font-size:14.5px;color:${P.soft};max-width:520px;margin:0 auto;line-height:1.6;}

.tva-jny .jny-card2{border:1px solid ${P.line};border-radius:14px;padding:18px;background:#fff;}
.tva-jny .jny-way{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px;margin-bottom:8px;}
@media(max-width:600px){.tva-jny .jny-way{grid-template-columns:1fr;}}
.tva-jny .jny-way-card{border:1px solid ${P.line};border-radius:14px;padding:18px;background:#fff;}
.tva-jny .jny-way-card.hot{border-color:${P.honey}66;background:${P.honeyTint}88;}
.tva-jny .jny-way-h{font-family:${SERIF};font-size:19px;font-weight:800;color:${P.ink};margin-bottom:8px;}
.tva-jny .jny-notneed{margin-top:24px;background:#F4F2EC;border-radius:16px;padding:24px;text-align:center;}
.tva-jny .jny-notneed-h{font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${P.faint};}
.tva-jny .jny-notneed-items{display:flex;gap:18px;justify-content:center;flex-wrap:wrap;margin:12px 0;}
.tva-jny .jny-notneed-items s{color:${P.faint};font-size:14.5px;}
.tva-jny .jny-notneed-yes{font-size:17px;font-weight:800;color:${P.green};}

.tva-jny .jny-final{background:linear-gradient(160deg,#2A2440,#1B1730);border-radius:20px;padding:34px;text-align:center;color:#fff;}
.tva-jny .jny-final h3{font-family:${SERIF};font-size:30px;font-weight:800;margin:0 0 8px;}
.tva-jny .jny-final p{color:#C9C3DE;font-size:14.5px;margin:0 auto;max-width:460px;line-height:1.6;}
.tva-jny .jny-final-row{display:flex;gap:30px;justify-content:center;flex-wrap:wrap;margin:24px 0;padding-top:20px;border-top:1px solid rgba(255,255,255,.14);text-align:left;}
.tva-jny .jny-final-row span{display:block;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#9C95B8;margin-bottom:5px;}
.tva-jny .jny-final-row b{display:block;font-size:24px;font-weight:800;color:#fff;}
.tva-jny .jny-final-row b.zalo{color:#E8B96B;font-style:italic;}
.tva-jny .jny-final-row small{font-size:12px;color:#9C95B8;}
.tva-jny .jny-final-btn{margin-top:6px;background:#fff;color:${P.indigo};border:none;border-radius:12px;padding:14px 26px;font-weight:700;font-size:15px;cursor:pointer;font-family:inherit;}
`
