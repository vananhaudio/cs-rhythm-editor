// ClassJourney2027 — "Bản đồ hành trình" / showcase HÀNH TRÌNH 2027 (bản editorial xanh rêu – kem, serif Lora).
// Overlay toàn màn hình mở từ ClassLandingPage. Bám bản gốc của thầy: 4 chặng → 3 yếu tố → ý thức/tiềm thức
// → lộ trình 10 khoá (2 nhánh + hội tụ) → AZZ → combo → đăng ký. KHÔNG nói mã chuyên môn với học viên.
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

const C = {
  bg: '#F7F4EC', ink: '#10281B', deep: '#10281B', deeper: '#0B1E14',
  green: '#1A5334', greenDark: '#0E3A22', soft: '#4A5148', faint: '#6B7468',
  gold: '#B9822F', goldLight: '#C79A4E', line: 'rgba(16,40,27,0.12)', lineSoft: 'rgba(16,40,27,0.10)',
  creamText: '#F7F4EC',
}
const SERIF = "'Lora', Georgia, 'Times New Roman', serif"
const ZALO = '0983 259 893'
const ZALO_LINK = 'https://zalo.me/vananhguitarist'

// ── Dữ liệu lộ trình (hiển thị cho học viên — không dùng mã nội bộ) ──
const NHANH_A = [
  ['Đệm hát căn bản', 'Hợp âm nền · thế bấm · giữ nhịp đều tay'],
  ['Đệm hát 2', 'Đệm theo tai · tự cảm âm vòng hợp âm'],
  ['Đệm hát 3', 'Tạo tiết tấu riêng · làm chủ cả bài hát'],
]
const NHANH_B = [
  ['Tỉa nốt 1', 'Nghe và chơi lại giai điệu trên cần đàn'],
  ['Tỉa nốt 2', 'Tạo câu lót · dựng intro và outro'],
  ['Tỉa nốt 3', 'Phát triển cảm âm · bè giai điệu hoàn chỉnh'],
]
const NANG_CAO = [
  ['Đệm hát nâng cao 1', 'Bắt tông · chuyển giọng · đệm cho người khác hát'],
  ['Đệm hát nâng cao 2', 'Xử lý bài theo cảm xúc · phối tiết tấu tự do'],
  ['Solo Guitar 1', 'Gộp đệm và tỉa · tự soạn solo cho bài hát'],
  ['Solo Guitar 2', 'Ứng biến · sáng tạo · định hình phong cách riêng'],
]

const Eyebrow = ({ children, gold = false }: { children: React.ReactNode; gold?: boolean }) =>
  <div className={'jny-eyebrow' + (gold ? ' gold' : '')}>{children}</div>

export default function ClassJourney2027({ onClose, onRegister, onFreeTrial }: { onClose: () => void; onRegister: () => void; onFreeTrial?: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLElement>(null)

  // Đóng bằng phím Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Hiệu ứng hiện dần khi cuộn (tôn trọng prefers-reduced-motion)
  useEffect(() => {
    const rootEl = scrollRef.current
    if (!rootEl) return
    const nodes = Array.from(rootEl.querySelectorAll<HTMLElement>('[data-rv]'))
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || typeof IntersectionObserver === 'undefined' || !nodes.length) return
    nodes.forEach(n => { n.style.opacity = '0' })
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return
        ;(e.target as HTMLElement).style.animation = 'jny-rise .7s cubic-bezier(.22,.7,.2,1) forwards'
        io.unobserve(e.target)
      })
    }, { root: rootEl, rootMargin: '0px 0px -10% 0px', threshold: 0.05 })
    nodes.forEach(n => io.observe(n))
    return () => io.disconnect()
  }, [])

  // Render qua portal ra <body> để CSS của .tva-class (landing) không rò rỉ vào overlay
  return createPortal(
    <div className="tva-jny">
      <style>{CSS}</style>

      {/* Thanh trên: quay lại + CTA */}
      <div className="jny-top">
        <button className="jny-back" onClick={onClose}>← Quay lại</button>
        <div className="jny-top-brand">
          <img src="/logo.png" alt="" />
          <span>Hành Trình <i>2027</i></span>
        </div>
        <button className="jny-top-cta" onClick={onRegister}>Xem lớp &amp; đăng ký</button>
      </div>

      <div className="jny-scroll" ref={scrollRef}>

        {/* ── HERO ── */}
        <section className="jny-hero">
          <div className="jny-circle c1" /><div className="jny-circle c2" />
          <div className="jny-wrap">
            <div className="jny-kicker"><span className="dash" />Lộ trình học guitar 2027</div>
            <h1>Hành Trình<br /><span className="hl">2027</span></h1>
            <p className="jny-sub">Lộ trình làm chủ cây đàn guitar — từ những nốt đầu tiên đến ngày bạn chơi được theo cảm nhận của chính mình.</p>
            <div className="jny-hero-btns">
              <button className="jny-btn-solid" onClick={onRegister}>Đăng ký Combo Hành Trình 2027</button>
              <button className="jny-btn-ghost" onClick={() => mapRef.current?.scrollIntoView({ behavior: 'smooth' })}>Xem toàn bộ lộ trình</button>
            </div>
            <div className="jny-stats">
              <div><b>25<span className="plus">+</span></b><span>năm học, chơi và dạy đàn</span></div>
              <div><b>10</b><span>khoá học chính trong hệ thống</span></div>
              <div><b>01</b><span>lộ trình duy nhất, đi từ đầu đến cuối</span></div>
            </div>
          </div>
        </section>

        {/* ── 1. BỐN CHẶNG AI CŨNG ĐI QUA ── */}
        <section className="jny-sec band">
          <div className="jny-wrap">
            <div className="jny-split" data-rv="">
              <div>
                <Eyebrow>Điều thầy quan sát</Eyebrow>
                <h2>Gần như ai cũng đi qua bốn chặng này</h2>
              </div>
              <p className="jny-lead">Hơn 25 năm học, chơi và dạy guitar, thầy đã đi qua gần như mọi con đường mà người học đàn thường trải qua. Điều đáng nói là hầu hết mọi người đều lặp lại cùng một lối đi — và dừng lại ở cùng một chỗ.</p>
            </div>
            <div className="jny-grid4 cells" data-rv="">
              {([['01', 'Học theo tab', 'Nhìn bản nhạc có sẵn và bấm theo từng nốt.'], ['02', 'Học thuộc hợp âm', 'Ghi nhớ vị trí ngón trên cần đàn.'], ['03', 'Luyện kỹ thuật', 'Tập từng kỹ thuật riêng lẻ, tách rời khỏi bài hát.']] as const).map(([n, t, d]) => (
                <div className="jny-cell" key={n}>
                  <div className="num">{n}</div><b>{t}</b><span>{d}</span>
                </div>
              ))}
              <div className="jny-cell dark">
                <div className="num">04</div><b>Rồi chững lại</b><span>Chơi được vài bài, nhưng không biết phải đi tiếp thế nào.</span>
              </div>
            </div>
            <div className="jny-quote" data-rv="">
              <p>“Vấn đề không nằm ở người học — mà nằm ở cách người học đang học.”</p>
              <div className="by">Thầy Văn Anh</div>
            </div>
            <div data-rv="">
              <div className="jny-center-note">Học nhiều năm, nhưng vẫn còn ba việc chưa làm được:</div>
              <div className="jny-grid3 nos">
                {['Tự đệm một bài hát khi không có sẵn hợp âm', 'Bắt tông và đệm cho người khác hát', 'Chơi một bài theo cảm nhận của riêng mình'].map(t => (
                  <div className="jny-no" key={t}><span className="x">✕</span><span>{t}</span></div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. BẢN CHẤT ── */}
        <section className="jny-sec">
          <div className="jny-wrap">
            <div data-rv="" style={{ maxWidth: 720, marginBottom: 44 }}>
              <Eyebrow>Bản chất của việc chơi guitar</Eyebrow>
              <h2 className="big">Chơi đàn không phải là ghi nhớ.<br /><span className="hl-italic">Là làm chủ âm thanh.</span></h2>
            </div>
            <div className="jny-grid3 pillars" data-rv="">
              {([['01', 'Tai nghe', 'Nghe ra tông, hợp âm và giai điệu trong bất kỳ bài hát nào — không cần ai chỉ trước.'], ['02', 'Tay đàn', 'Chơi ra được đúng những gì mình đang nghe thấy và cảm nhận trong đầu.'], ['03', 'Tư duy âm nhạc', 'Hiểu, xử lý và tái tạo một bài hát theo cách của riêng mình.']] as const).map(([n, t, d]) => (
                <div className="jny-pillar" key={n}>
                  <div className="num">{n}</div>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              ))}
            </div>
            <div className="jny-callout" data-rv="">Khi ba yếu tố này nối liền với nhau, bạn không còn cần nhìn hợp âm, không còn phụ thuộc vào tab. <b>Bạn tự chơi theo cảm nhận của mình.</b></div>
          </div>
        </section>

        {/* ── 3. Ý THỨC vs TIỀM THỨC ── */}
        <section className="jny-sec">
          <div className="jny-wrap">
            <div className="jny-split" data-rv="">
              <div>
                <Eyebrow>Điểm khác biệt cốt lõi</Eyebrow>
                <h2>Khác biệt không nằm ở nội dung dạy, mà ở cách học được thiết kế</h2>
              </div>
              <p className="jny-lead">Người học hôm nay không thiếu kiến thức. Thứ họ thiếu là khả năng cảm âm và phản xạ âm nhạc đến từ bên trong.</p>
            </div>
            <div className="jny-compare" data-rv="">
              <div className="jny-col">
                <div className="col-tag">Cách học thường gặp</div>
                <h3>Học bằng ý thức</h3>
                <div className="rows">
                  {['Nhớ hợp âm', 'Nhớ bài', 'Nhớ vị trí nốt'].map(t => <div key={t}><span className="d">—</span>{t}</div>)}
                </div>
                <div className="verdict">Biết nhiều, nhưng không chơi được.</div>
              </div>
              <div className="jny-col good">
                <div className="col-tag">Phương pháp của thầy</div>
                <h3>Học vào tiềm thức</h3>
                <div className="rows">
                  {['Nghe → phản xạ → chơi ngay', 'Không phải dừng lại để suy nghĩ', 'Âm nhạc bật ra tự nhiên'].map(t => <div key={t}><span className="d">—</span>{t}</div>)}
                </div>
                <div className="verdict gold">Nghe là biết. Chơi là ra.</div>
              </div>
            </div>
            <div className="jny-split late" data-rv="">
              <div>
                <Eyebrow>Cách phương pháp hoạt động</Eyebrow>
                <h2 className="mid">Đưa âm nhạc từ ý thức vào tiềm thức</h2>
                <p className="jny-lead tight">Âm nhạc thật sự diễn ra ở tiềm thức — nơi bạn nghe và chơi ngay, không cần suy nghĩ. Thầy xây phương pháp để đưa bạn tới đó.</p>
              </div>
              <div className="jny-grid2 cells">
                {['Luyện tai nghe theo hệ thống', 'Lặp lại có chủ đích', 'Gắn âm thanh với cảm nhận thực tế', 'Tạo phản xạ thay vì ghi nhớ'].map(t => (
                  <div className="jny-cell flatcell" key={t}>{t}</div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── 4. LỘ TRÌNH (nền tối) ── */}
        <section className="jny-sec dark" ref={mapRef}>
          <div className="jny-wrap">
            <div data-rv="" style={{ maxWidth: 820, marginBottom: 52 }}>
              <Eyebrow gold>Lộ trình · Hệ thống hoàn chỉnh</Eyebrow>
              <h2 className="big onDark">Hành Trình <span className="gold-italic">2027</span></h2>
              <p className="jny-lead onDark">Không phải một khoá học riêng lẻ, mà là một hệ thống hoàn chỉnh — giúp bạn đi đúng ngay từ đầu, phát triển đúng hướng, và hình thành phản xạ âm nhạc thật sự.</p>
            </div>

            {/* Bước 1 */}
            <div data-rv="">
              <div className="jny-steprow"><span className="lbl">Bước 1</span><span className="rule" /><span className="note">Miễn phí · Chuẩn hoá đầu vào</span></div>
              <div className="jny-nhapmon">
                <h3>Nhập môn Guitar</h3>
                <div className="desc">Cầm đàn · Chỉnh dây · Luyện ngón cơ bản · Làm quen nhạc cụ</div>
                <span className="badge">Miễn phí</span>
              </div>
            </div>

            <div className="jny-connector"><span /></div>

            {/* Bước 2 — hai nhánh */}
            <div data-rv="">
              <div className="jny-steprow"><span className="lbl">Bước 2</span><span className="rule" /><span className="note">Hai nhánh phát triển song song · 6 khoá</span></div>
              <div className="jny-grid2 branches">
                <div className="jny-branch">
                  <div className="branch-head"><i>Nhánh A</i><span className="pill">3 khoá</span></div>
                  <h3>Đệm hát · bè nền</h3>
                  {NHANH_A.map(([t, d], i) => (
                    <div className="course" key={t}><span className="cnum">{String(i + 1).padStart(2, '0')}</span><span><b>{t}</b><em>{d}</em></span></div>
                  ))}
                </div>
                <div className="jny-branch">
                  <div className="branch-head"><i>Nhánh B</i><span className="pill">3 khoá</span></div>
                  <h3>Tỉa nốt · bè giai điệu</h3>
                  {NHANH_B.map(([t, d], i) => (
                    <div className="course" key={t}><span className="cnum">{String(i + 4).padStart(2, '0')}</span><span><b>{t}</b><em>{d}</em></span></div>
                  ))}
                </div>
              </div>
            </div>

            {/* Công thức */}
            <div className="jny-formula" data-rv="">
              <Eyebrow gold>Sự thật quan trọng nhất</Eyebrow>
              <div className="eq"><span className="gold">SOLO</span><i>=</i><span>ĐỆM</span><i>+</i><span>TỈA</span></div>
              <p>Thiếu một trong hai nền tảng, solo chỉ còn là bấm nốt theo tab người khác soạn — không có hồn, không có phong cách riêng.</p>
            </div>

            {/* Bước 3 */}
            <div data-rv="">
              <div className="jny-steprow"><span className="lbl">Bước 3</span><span className="rule" /><span className="note">Nâng cao &amp; hội tụ · 4 khoá</span></div>
              <div className="jny-converge">
                <div className="conv-head"><h3>Bắt đầu thật sự chơi nhạc</h3><span>Hai nhánh hội tụ lại — đây là nơi ứng biến và phong cách riêng hình thành.</span></div>
                <div className="jny-grid4 cells onDark">
                  {NANG_CAO.map(([t, d], i) => (
                    <div className="jny-cell darkcell" key={t}><div className="num">{String(i + 7).padStart(2, '0')}</div><b>{t}</b><span>{d}</span></div>
                  ))}
                </div>
              </div>
            </div>

            <div className="jny-connector"><span /></div>

            <div className="jny-grid3 tally" data-rv="">
              <div><b>3</b><span>khoá Đệm hát (nhánh A)</span></div>
              <div><b>3</b><span>khoá Tỉa nốt (nhánh B)</span></div>
              <div><b>4</b><span>khoá Nâng cao &amp; Solo</span></div>
            </div>

            <div className="jny-dich" data-rv="">
              <div className="tag">Đích đến</div>
              <div className="txt">Làm chủ cây đàn guitar</div>
            </div>
          </div>
        </section>

        {/* ── 5. BA ĐIỀU LÀM ĐƯỢC ── */}
        <section className="jny-sec band">
          <div className="jny-wrap">
            <div data-rv="" style={{ maxWidth: 680, marginBottom: 40 }}>
              <Eyebrow>Khi đi hết hành trình</Eyebrow>
              <h2 className="big">Ba điều bạn sẽ làm được</h2>
            </div>
            <div className="jny-grid3 outcomes" data-rv="">
              {([['01', 'Tự cảm nhận được tiếng đàn của mình', 'Không cần ai phán xét — bạn tự biết trong lòng rằng mình đang dần làm chủ cây đàn.'], ['02', 'Đệm hát cho mình và cho người khác', 'Chọn đúng tông, đúng giọng, giữ được nhịp và điều khiển nhanh chậm theo cảm xúc người hát.'], ['03', 'Chơi một bài theo cách của riêng bạn', 'Không còn phụ thuộc vào tab có sẵn: tự đệm, tự tỉa, tự soạn solo hợp với phong cách của mình.']] as const).map(([n, t, d]) => (
                <div className="jny-outcome" key={n}>
                  <div className="ghost">{n}</div>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 6. MÔ HÌNH AZZ ── */}
        <section className="jny-sec">
          <div className="jny-wrap">
            <div data-rv="" style={{ maxWidth: 760, marginBottom: 40 }}>
              <Eyebrow>Phương pháp học liên hoàn</Eyebrow>
              <h2 className="big">Mô hình <span className="hl-italic">AZZ</span></h2>
              <p className="jny-lead tight">Ba lớp học bổ trợ cho nhau: học nền tảng mỗi ngày, được sửa sát từng lỗi, và gặp thầy trực tiếp để đi sâu.</p>
            </div>
            <div className="jny-grid3 azz" data-rv="">
              {([['A', 'App', 'Bước một', 'Học kiến thức nền tảng mỗi ngày, linh hoạt theo nhịp sống của bạn.'], ['Z', 'Zalo', 'Bước hai', 'Sửa bài, kèm sát, chỉnh lỗi trực tiếp cùng thầy và cộng đồng học viên.'], ['Z', 'Zoom', 'Bước ba', 'Thầy giảng trực tiếp: hiểu sâu, được quan sát và cùng nhau phát triển.']] as const).map(([l, t, step, d], i) => (
                <div className="jny-azz-card" key={i}>
                  <div className="watermark">{l}</div>
                  <div className="step">{step}</div>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              ))}
            </div>
            <div className="jny-callout" data-rv="">Thời đại Google và AI, kiến thức không còn khan hiếm. Giá trị nằm ở chỗ <b>kiến thức nào đến với bạn — đúng lúc, đúng chỗ đang vướng</b>. Thầy quan sát quá trình học của từng học viên để đưa đúng bước tiếp theo, đúng thời điểm bạn cần.</div>
          </div>
        </section>

        {/* ── 7. HAI CÁCH THAM GIA ── */}
        <section className="jny-sec band">
          <div className="jny-wrap">
            <div data-rv="" style={{ maxWidth: 760, marginBottom: 40 }}>
              <Eyebrow>Hai cách tham gia</Eyebrow>
              <h2 className="big">Đi từng bước, hay đi trọn hành trình?</h2>
            </div>
            <div className="jny-ways" data-rv="">
              <div className="jny-way">
                <h3>Học từng khoá lẻ</h3>
                <p>Phù hợp nếu bạn muốn đi từng bước, thử trước rồi mới quyết định đi tiếp.</p>
                <div className="price"><b>990.000đ</b><span>mỗi khoá · 2 tháng · 8 buổi</span></div>
              </div>
              <div className="jny-way hot">
                <div className="way-head"><h3>Combo Hành Trình 2027</h3><span className="badge">Trọn lộ trình</span></div>
                <div className="perks">
                  {['Học full toàn bộ lộ trình', 'Thích học lớp nào cũng được', 'Học đi học lại mấy lần cũng được', 'Tiết kiệm hơn rất nhiều', 'Đặc biệt: 40 buổi học Thực hành trong 1 năm'].map(t => (
                    <div key={t}><span className="d">—</span>{t}</div>
                  ))}
                </div>
                <div className="way-foot">
                  <div><b>9.990.000đ</b><span>10 khoá chính + khoá phụ trợ + 40 buổi thực hành Zoom</span></div>
                  <button onClick={onRegister}>Đăng ký ngay →</button>
                </div>
              </div>
            </div>

            <div className="jny-split late" data-rv="">
              <div>
                <Eyebrow>Combo gồm những gì</Eyebrow>
                <h2 className="mid">Trọn lộ trình — không chỉ là 10 khoá lẻ gộp lại</h2>
                <div className="jny-notneed">
                  <div className="h">Bạn không cần:</div>
                  <div className="chips"><s>Năng khiếu đặc biệt</s><s>Biết nhạc lý trước</s><s>Nhiều năm kinh nghiệm</s></div>
                  <div className="yes">Bạn chỉ cần đi đúng phương pháp.</div>
                </div>
              </div>
              <div className="jny-grid2 cells">
                {([['01', '10 khoá học chính', '3 khoá Đệm hát · 3 khoá Tỉa nốt · 2 khoá Đệm hát nâng cao · 2 khoá Solo Guitar. Học lớp nào cũng được.'], ['02', 'Các khoá phụ trợ', 'Cảm nhận tông nhạc, thị tấu và nền nhạc lý — bổ trợ cảm âm và đọc bản.'], ['03', '40 buổi Zoom thực hành', 'Tập trung 100% vào thực hành: thầy kèm trực tiếp, sửa bài, luyện phản xạ.'], ['04', 'Chi phí trọn gói', 'So với mua từng khoá lẻ và học riêng: một mức chi phí, đi trọn hành trình.']] as const).map(([n, t, d]) => (
                  <div className="jny-cell" key={n}><div className="num">{n}</div><b>{t}</b><span>{d}</span></div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── 8. ĐĂNG KÝ ── */}
        <section className="jny-sec dark final">
          <div className="jny-wrap">
            <div className="jny-split reg" data-rv="">
              <div>
                <Eyebrow gold>Bắt đầu hành trình</Eyebrow>
                <h2 className="big onDark">Đăng ký Combo <span className="gold-italic">Hành Trình 2027</span></h2>
                <p className="jny-lead onDark">Nếu bạn vẫn còn phân vân, hãy bắt đầu từ khoá Nhập môn miễn phí. Đúng nền tảng trước, rồi mới bước vào lộ trình.</p>
                <div className="jny-hero-btns">
                  <button className="jny-btn-gold" onClick={onRegister}>Xem lớp &amp; đăng ký ngay</button>
                  <button className="jny-btn-ghost onDark" onClick={onFreeTrial || onRegister}>Học thử miễn phí trên App</button>
                </div>
              </div>
              <div className="jny-regcard">
                <div className="tag">Đăng ký qua Zalo</div>
                <a href={ZALO_LINK} target="_blank" rel="noreferrer" className="phone">{ZALO}</a>
                <div className="who">Thầy Văn Anh</div>
                <div className="lines">
                  <div><span>Nhập môn Guitar</span><b className="gold">Miễn phí</b></div>
                  <div><span>Học lẻ từng khoá</span><b>990.000đ</b></div>
                  <div><span>Combo Hành Trình 2027</span><b>9.990.000đ</b></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="jny-foot">
          <div className="jny-wrap">
            <p>Hành Trình 2027 không dạy bạn chơi đàn theo cách thông thường — mà giúp bạn làm chủ cây đàn từ bên trong.</p>
            <div className="row">
              <img src="/logo.png" alt="" />
              <span>Thầy Văn Anh · Guitar</span>
              <span className="right">Zalo {ZALO}</span>
            </div>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  )
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400..700;1,400..600&family=Be+Vietnam+Pro:wght@300;400;500;600;700&display=swap');
@keyframes jny-rise{from{opacity:0;transform:translateY(22px);}to{opacity:1;transform:none;}}

.tva-jny{position:fixed;inset:0;z-index:120;background:${C.bg};display:flex;flex-direction:column;font-family:'Be Vietnam Pro',system-ui,sans-serif;color:${C.ink};text-align:left;line-height:1.55;}
.tva-jny *{box-sizing:border-box;margin:0;}
.tva-jny ::selection{background:${C.green};color:${C.bg};}
.tva-jny h2{font-family:${SERIF};font-weight:500;font-size:clamp(26px,3.4vw,40px);line-height:1.14;letter-spacing:-.025em;color:${C.ink};text-wrap:pretty;}
.tva-jny h2.big{font-size:clamp(30px,4.4vw,52px);line-height:1.08;letter-spacing:-.03em;}
.tva-jny h2.mid{font-size:clamp(26px,3.2vw,38px);margin-bottom:16px;}
.tva-jny h2.onDark{color:${C.creamText};}
.tva-jny .hl-italic{color:${C.green};font-style:italic;}
.tva-jny .gold-italic{color:${C.goldLight};font-style:italic;}
.tva-jny .jny-eyebrow{font-size:12px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:${C.gold};margin-bottom:16px;}
.tva-jny .jny-eyebrow.gold{color:${C.goldLight};}
.tva-jny .jny-lead{font-size:17px;line-height:1.72;color:${C.soft};text-wrap:pretty;}
.tva-jny .jny-lead.onDark{color:rgba(247,244,236,.72);}
.tva-jny .jny-lead.tight{margin-top:14px;}

/* thanh trên */
.tva-jny .jny-top{flex-shrink:0;display:flex;align-items:center;gap:14px;padding:12px 20px;background:rgba(247,244,236,.92);backdrop-filter:blur(12px);border-bottom:1px solid ${C.lineSoft};}
.tva-jny .jny-back{border:1px solid rgba(26,83,52,.3);background:transparent;color:${C.green};border-radius:999px;padding:9px 17px;font-weight:600;font-size:13.5px;cursor:pointer;font-family:inherit;}
.tva-jny .jny-back:hover{border-color:${C.green};background:rgba(26,83,52,.05);}
.tva-jny .jny-top-brand{display:flex;align-items:center;gap:9px;margin:0 auto;font-size:13.5px;font-weight:600;color:${C.ink};}
.tva-jny .jny-top-brand img{width:26px;height:26px;display:block;}
.tva-jny .jny-top-brand i{font-family:${SERIF};color:${C.green};}
.tva-jny .jny-top-cta{border:none;background:${C.green};color:${C.creamText};border-radius:999px;padding:10px 18px;font-weight:600;font-size:13.5px;cursor:pointer;font-family:inherit;}
.tva-jny .jny-top-cta:hover{background:${C.greenDark};}
@media(max-width:560px){.tva-jny .jny-top-brand span{display:none;}}

.tva-jny .jny-scroll{flex:1;overflow-y:auto;overflow-x:hidden;}
.tva-jny .jny-wrap{max-width:1080px;margin:0 auto;padding:0 24px;position:relative;}
.tva-jny .jny-sec{padding:72px 0;}
.tva-jny .jny-sec.band{background:#fff;border-top:1px solid ${C.lineSoft};border-bottom:1px solid ${C.lineSoft};}
.tva-jny .jny-sec.dark{background:${C.deep};color:${C.creamText};}
.tva-jny .jny-sec.final{padding:84px 0;}

/* hero */
.tva-jny .jny-hero{position:relative;padding:64px 0 56px;overflow:hidden;}
.tva-jny .jny-circle{position:absolute;border:1px solid rgba(26,83,52,.12);border-radius:50%;pointer-events:none;}
.tva-jny .jny-circle.c1{right:-140px;top:-60px;width:460px;height:460px;}
.tva-jny .jny-circle.c2{right:-30px;top:40px;width:290px;height:290px;border-color:rgba(26,83,52,.09);}
.tva-jny .jny-kicker{display:flex;align-items:center;gap:12px;margin-bottom:24px;font-size:12px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:${C.gold};}
.tva-jny .jny-kicker .dash{width:28px;height:1px;background:${C.gold};display:block;}
.tva-jny .jny-hero h1{font-family:${SERIF};font-weight:500;font-size:clamp(48px,8vw,100px);line-height:.94;letter-spacing:-.035em;color:${C.ink};margin-bottom:26px;}
.tva-jny .jny-hero h1 .hl{color:${C.green};font-style:italic;}
.tva-jny .jny-sub{font-size:clamp(17px,2vw,21px);line-height:1.62;color:${C.soft};max-width:620px;margin-bottom:36px;text-wrap:pretty;}
.tva-jny .jny-hero-btns{display:flex;flex-wrap:wrap;gap:12px;}
.tva-jny .jny-btn-solid{font-size:15px;font-weight:600;color:${C.creamText};background:${C.green};padding:15px 28px;border-radius:999px;border:none;cursor:pointer;font-family:inherit;}
.tva-jny .jny-btn-solid:hover{background:${C.greenDark};}
.tva-jny .jny-btn-ghost{font-size:15px;font-weight:600;color:${C.green};background:transparent;padding:15px 26px;border-radius:999px;border:1px solid rgba(26,83,52,.3);cursor:pointer;font-family:inherit;}
.tva-jny .jny-btn-ghost:hover{border-color:${C.green};background:rgba(26,83,52,.05);}
.tva-jny .jny-btn-ghost.onDark{color:${C.creamText};border-color:rgba(247,244,236,.3);}
.tva-jny .jny-btn-ghost.onDark:hover{border-color:${C.goldLight};color:${C.goldLight};background:transparent;}
.tva-jny .jny-btn-gold{font-size:15px;font-weight:600;color:${C.deep};background:${C.goldLight};padding:15px 28px;border-radius:999px;border:none;cursor:pointer;font-family:inherit;}
.tva-jny .jny-btn-gold:hover{background:${C.creamText};}
.tva-jny .jny-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:1px solid rgba(16,40,27,.14);margin-top:52px;max-width:780px;}
.tva-jny .jny-stats>div{padding:24px 24px 0 0;border-right:1px solid ${C.lineSoft};}
.tva-jny .jny-stats>div:nth-child(2){padding-left:24px;}
.tva-jny .jny-stats>div:last-child{border-right:none;padding-left:24px;}
.tva-jny .jny-stats b{display:block;font-family:${SERIF};font-weight:500;font-size:44px;line-height:1;color:${C.green};letter-spacing:-.03em;}
.tva-jny .jny-stats b .plus{display:inline;font-size:26px;color:${C.gold};margin:0;}
.tva-jny .jny-stats span{display:block;font-size:13.5px;color:${C.faint};margin-top:8px;}
@media(max-width:700px){.tva-jny .jny-stats{grid-template-columns:1fr;}.tva-jny .jny-stats>div{border-right:none;padding:18px 0 0;}.tva-jny .jny-stats>div:nth-child(2),.tva-jny .jny-stats>div:last-child{padding-left:0;}}

/* bố cục chung */
.tva-jny .jny-split{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:44px;align-items:start;margin-bottom:44px;}
.tva-jny .jny-split.late{margin-top:56px;margin-bottom:0;}
.tva-jny .jny-split.reg{margin-bottom:0;gap:56px;}
.tva-jny .jny-split .jny-lead{padding-top:4px;}
@media(max-width:860px){.tva-jny .jny-split{grid-template-columns:1fr;gap:20px;}}
.tva-jny .jny-grid4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));}
.tva-jny .jny-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));}
.tva-jny .jny-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));}
@media(max-width:860px){.tva-jny .jny-grid4{grid-template-columns:repeat(2,minmax(0,1fr));}}
@media(max-width:620px){.tva-jny .jny-grid4,.tva-jny .jny-grid3,.tva-jny .jny-grid2{grid-template-columns:1fr;}}

/* ô lưới kẻ mảnh */
.tva-jny .cells{gap:1px;background:${C.line};border:1px solid ${C.line};}
.tva-jny .jny-cell{background:#fff;padding:26px 22px 30px;}
.tva-jny .jny-cell .num{font-family:${SERIF};font-size:14px;color:${C.gold};letter-spacing:.08em;margin-bottom:18px;}
.tva-jny .jny-cell b{display:block;font-size:16.5px;font-weight:600;letter-spacing:-.015em;margin-bottom:8px;color:${C.ink};}
.tva-jny .jny-cell span{font-size:14px;line-height:1.6;color:${C.faint};}
.tva-jny .jny-cell.dark{background:${C.deep};}
.tva-jny .jny-cell.dark .num{color:${C.goldLight};}
.tva-jny .jny-cell.dark b{color:${C.creamText};}
.tva-jny .jny-cell.dark span{color:rgba(247,244,236,.66);}
.tva-jny .jny-cell.flatcell{background:${C.bg};font-size:15px;line-height:1.55;color:#2B3A2E;padding:22px 20px;}
.tva-jny .cells.onDark{background:rgba(247,244,236,.14);border-color:rgba(247,244,236,.14);}
.tva-jny .jny-cell.darkcell{background:${C.deep};padding:20px 20px 24px;}
.tva-jny .jny-cell.darkcell .num{color:rgba(199,154,78,.85);margin-bottom:12px;font-size:12.5px;}
.tva-jny .jny-cell.darkcell b{color:${C.creamText};font-size:16px;}
.tva-jny .jny-cell.darkcell span{color:rgba(247,244,236,.55);font-size:13.5px;}

/* trích dẫn + 3 việc chưa làm được */
.tva-jny .jny-quote{margin:56px auto;max-width:760px;text-align:center;}
.tva-jny .jny-quote p{font-family:${SERIF};font-style:italic;font-size:clamp(23px,3vw,34px);line-height:1.34;letter-spacing:-.02em;color:${C.green};margin-bottom:18px;text-wrap:balance;}
.tva-jny .jny-quote .by{font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;color:${C.faint};}
.tva-jny .jny-center-note{font-size:16px;color:${C.soft};margin-bottom:18px;text-align:center;}
.tva-jny .nos{gap:14px;}
.tva-jny .jny-no{display:flex;gap:13px;align-items:flex-start;padding:18px;background:${C.bg};border:1px solid ${C.lineSoft};font-size:15px;line-height:1.55;color:#2B3A2E;}
.tva-jny .jny-no .x{flex:0 0 auto;width:20px;height:20px;border-radius:50%;border:1px solid rgba(185,130,47,.55);color:${C.gold};font-size:10.5px;display:flex;align-items:center;justify-content:center;margin-top:2px;}

/* 3 trụ cột */
.tva-jny .pillars{gap:26px;}
.tva-jny .jny-pillar{border-top:2px solid ${C.green};padding-top:22px;}
.tva-jny .jny-pillar .num{font-family:${SERIF};font-size:12.5px;letter-spacing:.1em;color:${C.gold};margin-bottom:14px;}
.tva-jny .jny-pillar h3{font-family:${SERIF};font-weight:500;font-size:26px;letter-spacing:-.02em;margin-bottom:12px;color:${C.ink};}
.tva-jny .jny-pillar p{font-size:15.5px;line-height:1.66;color:${C.soft};}
.tva-jny .jny-callout{margin-top:36px;padding:24px 28px;background:rgba(26,83,52,.06);border-left:2px solid ${C.green};max-width:860px;font-size:16px;line-height:1.66;color:#2B3A2E;text-wrap:pretty;}
.tva-jny .jny-callout b{color:${C.ink};}

/* so sánh ý thức / tiềm thức */
.tva-jny .jny-compare{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;}
@media(max-width:720px){.tva-jny .jny-compare{grid-template-columns:1fr;}}
.tva-jny .jny-col{background:#fff;border:1px solid ${C.line};padding:32px 30px;display:flex;flex-direction:column;}
.tva-jny .jny-col .col-tag{font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;color:#8A9285;margin-bottom:10px;}
.tva-jny .jny-col h3{font-family:${SERIF};font-weight:500;font-size:24px;letter-spacing:-.02em;margin-bottom:22px;color:${C.soft};}
.tva-jny .jny-col .rows{display:flex;flex-direction:column;gap:12px;margin-bottom:26px;}
.tva-jny .jny-col .rows>div{display:flex;gap:11px;align-items:baseline;font-size:15.5px;color:${C.soft};}
.tva-jny .jny-col .rows .d{color:#B6BDB1;}
.tva-jny .jny-col .verdict{margin-top:auto;padding-top:18px;border-top:1px solid ${C.lineSoft};font-family:${SERIF};font-style:italic;font-size:18px;color:#8A9285;}
.tva-jny .jny-col.good{background:${C.deep};border-color:${C.deep};position:relative;overflow:hidden;}
.tva-jny .jny-col.good:after{content:'';position:absolute;right:-60px;bottom:-60px;width:220px;height:220px;border:1px solid rgba(199,154,78,.22);border-radius:50%;}
.tva-jny .jny-col.good .col-tag{color:${C.goldLight};}
.tva-jny .jny-col.good h3{color:${C.creamText};}
.tva-jny .jny-col.good .rows>div{color:rgba(247,244,236,.88);}
.tva-jny .jny-col.good .rows .d{color:${C.goldLight};}
.tva-jny .jny-col.good .verdict{border-top-color:rgba(247,244,236,.18);color:${C.goldLight};}
.tva-jny .jny-col.good .verdict.gold{color:${C.goldLight};}

/* lộ trình tối */
.tva-jny .jny-steprow{display:flex;align-items:center;gap:16px;margin-bottom:16px;}
.tva-jny .jny-steprow .lbl{font-size:12px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:${C.goldLight};}
.tva-jny .jny-steprow .rule{height:1px;flex:1;background:rgba(247,244,236,.18);}
.tva-jny .jny-steprow .note{font-size:12.5px;color:rgba(247,244,236,.6);}
.tva-jny .jny-nhapmon{border:1px solid rgba(199,154,78,.45);background:rgba(199,154,78,.08);padding:28px 30px;display:flex;flex-wrap:wrap;align-items:baseline;gap:14px 26px;}
.tva-jny .jny-nhapmon h3{font-family:${SERIF};font-weight:500;font-size:27px;letter-spacing:-.02em;color:${C.creamText};}
.tva-jny .jny-nhapmon .desc{font-size:14.5px;color:rgba(247,244,236,.72);line-height:1.6;}
.tva-jny .jny-nhapmon .badge{margin-left:auto;font-size:11.5px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:${C.deep};background:${C.goldLight};padding:7px 14px;border-radius:999px;}
.tva-jny .jny-connector{display:flex;justify-content:center;padding:20px 0;}
.tva-jny .jny-connector span{width:1px;height:40px;background:linear-gradient(rgba(247,244,236,.1),rgba(199,154,78,.7));}
.tva-jny .branches{gap:20px;}
.tva-jny .jny-branch{border:1px solid rgba(247,244,236,.18);padding:28px 26px 24px;}
.tva-jny .branch-head{display:flex;align-items:baseline;gap:12px;margin-bottom:6px;}
.tva-jny .branch-head i{font-family:${SERIF};font-style:italic;font-size:14px;color:${C.goldLight};}
.tva-jny .branch-head .pill{margin-left:auto;font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:rgba(247,244,236,.55);border:1px solid rgba(247,244,236,.22);padding:4px 10px;border-radius:999px;}
.tva-jny .jny-branch h3{font-family:${SERIF};font-weight:500;font-size:23px;letter-spacing:-.02em;color:${C.creamText};margin-bottom:18px;}
.tva-jny .course{display:flex;gap:14px;align-items:baseline;padding:13px 0;border-top:1px solid rgba(247,244,236,.12);}
.tva-jny .course .cnum{font-family:${SERIF};font-size:12px;color:rgba(199,154,78,.85);min-width:18px;}
.tva-jny .course b{display:block;font-size:15.5px;font-weight:500;color:${C.creamText};}
.tva-jny .course em{display:block;font-style:normal;font-size:13.5px;line-height:1.5;color:rgba(247,244,236,.55);margin-top:3px;}
.tva-jny .jny-formula{margin:40px 0;padding:38px 30px;background:rgba(247,244,236,.05);border:1px solid rgba(199,154,78,.3);text-align:center;}
.tva-jny .jny-formula .jny-eyebrow{margin-bottom:22px;}
.tva-jny .jny-formula .eq{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:14px 20px;margin-bottom:20px;}
.tva-jny .jny-formula .eq span{font-family:${SERIF};font-size:clamp(30px,4.6vw,50px);letter-spacing:-.02em;color:${C.creamText};}
.tva-jny .jny-formula .eq span.gold{color:${C.goldLight};}
.tva-jny .jny-formula .eq i{font-family:${SERIF};font-style:normal;font-size:clamp(22px,3vw,34px);color:rgba(247,244,236,.45);}
.tva-jny .jny-formula p{font-size:15.5px;line-height:1.66;color:rgba(247,244,236,.68);max-width:580px;margin:0 auto;text-wrap:pretty;}
.tva-jny .jny-converge{border:1px solid rgba(247,244,236,.18);padding:28px 26px;}
.tva-jny .conv-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 16px;margin-bottom:20px;}
.tva-jny .conv-head h3{font-family:${SERIF};font-weight:500;font-size:23px;letter-spacing:-.02em;color:${C.creamText};}
.tva-jny .conv-head span{font-size:14px;color:rgba(247,244,236,.55);}
.tva-jny .tally{gap:1px;background:rgba(247,244,236,.14);border:1px solid rgba(247,244,236,.14);margin-bottom:36px;}
.tva-jny .tally>div{background:${C.deep};padding:22px 24px;}
.tva-jny .tally b{font-family:${SERIF};font-weight:500;font-size:30px;color:${C.goldLight};line-height:1;}
.tva-jny .tally span{display:block;font-size:13.5px;color:rgba(247,244,236,.6);margin-top:7px;}
.tva-jny .jny-dich{background:${C.goldLight};color:${C.deep};padding:36px 32px;text-align:center;}
.tva-jny .jny-dich .tag{font-size:11.5px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;margin-bottom:12px;color:rgba(16,40,27,.7);}
.tva-jny .jny-dich .txt{font-family:${SERIF};font-weight:500;font-size:clamp(26px,3.8vw,42px);letter-spacing:-.03em;line-height:1.1;}

/* ba điều làm được */
.tva-jny .outcomes{gap:34px;}
.tva-jny .jny-outcome .ghost{font-family:${SERIF};font-size:40px;color:rgba(26,83,52,.22);line-height:1;margin-bottom:16px;}
.tva-jny .jny-outcome h3{font-family:${SERIF};font-weight:500;font-size:21px;letter-spacing:-.02em;line-height:1.3;margin-bottom:10px;color:${C.ink};}
.tva-jny .jny-outcome p{font-size:15px;line-height:1.66;color:${C.soft};}

/* AZZ */
.tva-jny .azz{gap:18px;}
.tva-jny .jny-azz-card{background:#fff;border:1px solid ${C.line};padding:32px 28px;position:relative;overflow:hidden;}
.tva-jny .jny-azz-card .watermark{position:absolute;right:16px;top:4px;font-family:${SERIF};font-size:110px;line-height:1;color:rgba(26,83,52,.07);pointer-events:none;}
.tva-jny .jny-azz-card .step{font-size:11.5px;letter-spacing:.18em;text-transform:uppercase;color:${C.gold};margin-bottom:12px;position:relative;}
.tva-jny .jny-azz-card h3{font-family:${SERIF};font-weight:500;font-size:26px;letter-spacing:-.02em;margin-bottom:12px;position:relative;color:${C.ink};}
.tva-jny .jny-azz-card p{font-size:15px;line-height:1.66;color:${C.soft};position:relative;}

/* hai cách tham gia */
.tva-jny .jny-ways{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:20px;align-items:stretch;}
@media(max-width:820px){.tva-jny .jny-ways{grid-template-columns:1fr;}}
.tva-jny .jny-way{border:1px solid ${C.line};padding:32px 28px;display:flex;flex-direction:column;background:#fff;}
.tva-jny .jny-way h3{font-family:${SERIF};font-weight:500;font-size:23px;letter-spacing:-.02em;color:${C.soft};margin-bottom:12px;}
.tva-jny .jny-way p{font-size:15px;line-height:1.66;color:${C.faint};margin-bottom:24px;}
.tva-jny .jny-way .price{margin-top:auto;padding-top:20px;border-top:1px solid ${C.lineSoft};}
.tva-jny .jny-way .price b{display:block;font-family:${SERIF};font-weight:500;font-size:28px;color:${C.ink};letter-spacing:-.02em;}
.tva-jny .jny-way .price span{display:block;font-size:13.5px;color:${C.faint};margin-top:5px;}
.tva-jny .jny-way.hot{background:${C.deep};border-color:${C.deep};position:relative;overflow:hidden;}
.tva-jny .jny-way.hot:after{content:'';position:absolute;right:-80px;top:-80px;width:260px;height:260px;border:1px solid rgba(199,154,78,.25);border-radius:50%;}
.tva-jny .way-head{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-bottom:16px;position:relative;}
.tva-jny .jny-way.hot h3{color:${C.creamText};margin-bottom:0;font-size:26px;}
.tva-jny .way-head .badge{font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:${C.deep};background:${C.goldLight};padding:6px 12px;border-radius:999px;}
.tva-jny .jny-way .perks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 24px;margin-bottom:28px;position:relative;}
@media(max-width:560px){.tva-jny .jny-way .perks{grid-template-columns:1fr;}}
.tva-jny .jny-way .perks>div{display:flex;gap:11px;align-items:baseline;font-size:15px;color:rgba(247,244,236,.9);line-height:1.5;}
.tva-jny .jny-way .perks .d{color:${C.goldLight};}
.tva-jny .jny-way .perks>div:last-child{grid-column:1 / -1;}
.tva-jny .way-foot{position:relative;margin-top:auto;padding-top:22px;border-top:1px solid rgba(247,244,236,.18);display:flex;flex-wrap:wrap;align-items:flex-end;gap:18px;}
.tva-jny .way-foot b{display:block;font-family:${SERIF};font-weight:500;font-size:38px;color:${C.goldLight};letter-spacing:-.03em;line-height:1;}
.tva-jny .way-foot span{display:block;font-size:13.5px;color:rgba(247,244,236,.65);margin-top:7px;max-width:340px;}
.tva-jny .way-foot button{margin-left:auto;font-size:14.5px;font-weight:600;color:${C.deep};background:${C.goldLight};padding:13px 22px;border-radius:999px;border:none;cursor:pointer;font-family:inherit;}
.tva-jny .way-foot button:hover{background:${C.creamText};}

/* không cần */
.tva-jny .jny-notneed{margin-top:22px;padding:22px 24px;background:${C.bg};border:1px solid ${C.lineSoft};}
.tva-jny .jny-notneed .h{font-size:14px;color:${C.faint};margin-bottom:12px;}
.tva-jny .jny-notneed .chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;}
.tva-jny .jny-notneed .chips s{font-size:13.5px;color:${C.faint};border:1px solid rgba(16,40,27,.16);padding:6px 13px;border-radius:999px;}
.tva-jny .jny-notneed .yes{font-family:${SERIF};font-size:19px;color:${C.green};letter-spacing:-.01em;}

/* đăng ký */
.tva-jny .jny-regcard{border:1px solid rgba(247,244,236,.2);padding:30px 28px;}
.tva-jny .jny-regcard .tag{font-size:11.5px;letter-spacing:.18em;text-transform:uppercase;color:rgba(247,244,236,.55);margin-bottom:20px;}
.tva-jny .jny-regcard .phone{font-family:${SERIF};font-size:clamp(30px,3.4vw,40px);letter-spacing:-.02em;color:${C.goldLight};display:block;line-height:1.1;text-decoration:none;}
.tva-jny .jny-regcard .phone:hover{color:${C.creamText};}
.tva-jny .jny-regcard .who{font-size:15px;color:rgba(247,244,236,.7);margin-top:10px;}
.tva-jny .jny-regcard .lines{margin-top:24px;padding-top:22px;border-top:1px solid rgba(247,244,236,.16);display:flex;flex-direction:column;gap:14px;}
.tva-jny .jny-regcard .lines>div{display:flex;justify-content:space-between;gap:18px;align-items:baseline;}
.tva-jny .jny-regcard .lines span{font-size:14.5px;color:rgba(247,244,236,.8);}
.tva-jny .jny-regcard .lines b{font-size:14.5px;font-weight:600;color:${C.creamText};}
.tva-jny .jny-regcard .lines b.gold{color:${C.goldLight};}

/* footer */
.tva-jny .jny-foot{background:${C.deeper};color:rgba(247,244,236,.72);padding:52px 0 44px;}
.tva-jny .jny-foot p{font-family:${SERIF};font-style:italic;font-size:clamp(19px,2.4vw,26px);line-height:1.4;letter-spacing:-.02em;color:${C.creamText};margin-bottom:34px;max-width:820px;text-wrap:pretty;}
.tva-jny .jny-foot .row{display:flex;flex-wrap:wrap;gap:18px;align-items:center;padding-top:24px;border-top:1px solid rgba(247,244,236,.14);font-size:13.5px;}
.tva-jny .jny-foot .row img{width:26px;height:26px;display:block;filter:brightness(0) invert(1);opacity:.85;}
.tva-jny .jny-foot .row .right{margin-left:auto;color:rgba(247,244,236,.5);}
`
