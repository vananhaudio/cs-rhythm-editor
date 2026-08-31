/**
 * ClassLearningWays — section "Bạn muốn học theo cách nào?" trên /class.
 *
 * 2 sản phẩm KHÔNG thay thế nhau (GÓI THỰC HÀNH = CAM · linh hoạt · đi sâu /
 * GÓI HỌC THEO LỚP = TÍM · cố định · đi lên) + link mở bài viết giải thích sâu
 * (modal full-screen, không kéo dài landing). Có thể chọn MỘT hoặc kết hợp CẢ HAI.
 * Giá Gói Thực hành: 499.000đ/tháng · đăng ký dài hạn 396.000đ/tháng (không invent thời hạn).
 *
 * Bài viết ẩn: modal đè lên landing (không đổi URL, không mất vị trí cuộn),
 * đóng bằng ✕ hoặc Escape, khóa cuộn nền, focus quay lại nút mở — cùng pattern
 * ClassBenefitDetail.
 */
import { useEffect, useRef, useState } from 'react'

const COPY = {
  kicker: 'Chọn cách học phù hợp',
  title: 'Bạn muốn học theo cách nào?',
  sub: 'Bạn có thể chọn một cách phù hợp với mình — hoặc kết hợp cả hai.',
  card1: {
    label: 'Gói Thực hành',
    title: 'Linh hoạt theo thời gian của bạn',
    body: 'Phù hợp nếu bạn bận hoặc lịch sinh hoạt thường xuyên thay đổi. Bạn học qua hệ thống theo tiến độ của mình và tham gia các buổi thực hành khi phù hợp.',
    points: ['Học qua hệ thống', 'Thực hành theo năng lực', 'Không cần theo một lớp cố định'],
    price: '499.000đ/tháng',
    priceSub: 'Đăng ký dài hạn: 396.000đ/tháng',
  },
  card2: {
    label: 'Gói Học theo lớp',
    title: 'Cố định để đi cùng nhau',
    body: 'Phù hợp nếu bạn có thể dành một khung giờ cố định mỗi tuần và muốn học theo một chương trình cụ thể từ đầu đến cuối.',
    points: ['Có lịch khai giảng', 'Học theo chương trình', 'Bài học tiếp nối nhau'],
  },
  articleLink: 'Hai cách học khác nhau thế nào?',
}

export default function ClassLearningWays() {
  const [open, setOpen] = useState(false)
  return (
    <section id="cach-hoc" className="lw-sec">
      <div className="wrap">
        <div className="eyebrow">{COPY.kicker}</div>
        <h2>{COPY.title}</h2>
        <p className="lead">{COPY.sub}</p>

        <div className="lw-grid">
          <div className="lw-card lw-card-mem">
            <span className="lw-label">{COPY.card1.label}</span>
            <h3>{COPY.card1.title}</h3>
            <p className="lw-body">{COPY.card1.body}</p>
            <ul className="lw-points">
              {COPY.card1.points.map(p => <li key={p}>✓ {p}</li>)}
            </ul>
            <div className="lw-price">{COPY.card1.price}</div>
            <div className="lw-price-sub">{COPY.card1.priceSub}</div>
          </div>
          <div className="lw-card lw-card-cls">
            <span className="lw-label">{COPY.card2.label}</span>
            <h3>{COPY.card2.title}</h3>
            <p className="lw-body">{COPY.card2.body}</p>
            <ul className="lw-points">
              {COPY.card2.points.map(p => <li key={p}>✓ {p}</li>)}
            </ul>
          </div>
        </div>

        <div className="lw-link">
          <button type="button" className="lw-article-btn" onClick={() => setOpen(true)}>
            {COPY.articleLink}
            <span aria-hidden> →</span>
          </button>
        </div>
      </div>

      {open && <LearningWaysArticle onClose={() => setOpen(false)} />}
      <style>{CSS}</style>
    </section>
  )
}

/** Bài viết ẩn — giải thích 2 chiều học (đi lên / đi sâu), mở full-screen. */
function LearningWaysArticle({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const prevFocus = useRef<Element | null>(null)

  useEffect(() => {
    prevFocus.current = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
      if (prevFocus.current instanceof HTMLElement) prevFocus.current.focus()
    }
  }, [onClose])

  return (
    <div className="lwa-overlay" role="dialog" aria-modal="true" aria-label="Gói Thực hành và Gói Học theo lớp khác nhau thế nào?">
      <div className="lwa-card">
        <div className="lwa-head">
          <h2 className="lwa-title">Gói Thực hành và Gói Học theo lớp khác nhau thế nào?</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="lwa-close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="lwa-body">
          <p className="lwa-intro">
            Hai cách học này không thay thế nhau. Chúng giải quyết hai phần khác nhau của việc học Guitar.
          </p>
          <p className="lwa-intro">
            Bạn có thể chọn một trong hai — hoặc kết hợp cả hai để học hiệu quả hơn.
          </p>

          {/* Phần 1 — Học theo lớp: đi lên */}
          <section className="lwa-sec">
            <h3 className="lwa-h3">Học theo lớp: tiếp tục đi lên</h3>
            <p className="lwa-p">
              Học theo lớp chủ yếu giúp bạn tiếp nhận kiến thức và kỹ năng mới theo một lộ trình có thứ tự.
            </p>
            <p className="lwa-p">
              Mỗi buổi học đưa bạn đi thêm một bước: từ điều đã biết sang điều chưa biết, từ kỹ năng đơn giản đến kỹ năng cao hơn.
            </p>
            <p className="lwa-p">Có thể hình dung đây là chiều đi lên của việc học:</p>
            <div className="lwa-chain" aria-label="Bài 1 → Bài 2 → Bài 3 → kiến thức mới → kỹ năng mới → trình độ mới">
              {['Bài 1', 'Bài 2', 'Bài 3', 'Kiến thức mới', 'Kỹ năng mới', 'Trình độ mới'].map((s, i) => (
                <span className="lwa-chain-item" key={s}>
                  {s}
                  {i < 5 && <span className="lwa-chain-arrow" aria-hidden>→</span>}
                </span>
              ))}
            </div>
            <p className="lwa-p">
              Vì vậy, học theo lớp phù hợp với người có thể dành một khung giờ cố định mỗi tuần và muốn đi cùng một chương trình từ đầu đến cuối.
            </p>
          </section>

          {/* Phần 2 — Thực hành: đi sâu */}
          <section className="lwa-sec">
            <h3 className="lwa-h3">Thực hành: làm cho kỹ năng trở nên thật</h3>
            <p className="lwa-p">
              Biết một điều chưa có nghĩa là đã làm được điều đó thành thạo.
            </p>
            <p className="lwa-p">
              Sau khi học, người chơi cần lặp lại kỹ năng nhiều lần: nghe lại, đàn lại, sửa lại, thử ở bài khác, tốc độ khác và tình huống khác.
            </p>
            <p className="lwa-p">Đó là vai trò của các buổi thực hành.</p>
            <p className="lwa-p">
              Nếu học theo lớp là <b>đi lên</b>, thì thực hành là <b>đi sâu</b>.
            </p>
            <div className="lwa-example">
              <p className="lwa-example-title">Ví dụ</p>
              <p className="lwa-p">
                Bạn đã học cách nghe một vòng hợp âm.
              </p>
              <p className="lwa-p">
                Trong lớp, Thầy có thể dạy nguyên lý và sau đó tiếp tục đưa bạn sang kiến thức mới.
              </p>
              <p className="lwa-p">
                Nhưng để thực sự nghe được hợp âm khi một bài hát vang lên, bạn cần thực hành kỹ năng đó rất nhiều lần.
              </p>
            </div>
          </section>

          {/* Phần 3 — Tốc độ riêng của nhóm thực hành */}
          <section className="lwa-sec">
            <h3 className="lwa-h3">Mỗi người có thể tiến theo tốc độ của mình</h3>
            <p className="lwa-p">
              Trong lớp học, cả lớp thường đi theo cùng một chương trình.
            </p>
            <p className="lwa-p">
              Nhưng trong các nhóm thực hành, mỗi người có thể tiến theo tốc độ của chính mình.
            </p>
            <p className="lwa-p">
              Khi những kỹ năng của nhóm hiện tại đã đủ chắc, bạn có thể chuyển sang nhóm thực hành cao hơn.
            </p>
            <p className="lwa-p">
              Nếu bạn cần thêm thời gian, bạn vẫn có thể tiếp tục luyện tập ở nhóm phù hợp cho đến khi kỹ năng đủ vững.
            </p>
            <p className="lwa-p">
              Không cần chạy theo tốc độ của người khác.
            </p>
          </section>

          {/* Phân luồng sau một khoá — Class → Practice / Next Class / cả hai */}
          <section className="lwa-sec">
            <h3 className="lwa-h3">Đi tiếp thế nào sau một khoá?</h3>
            <p className="lwa-p">
              Sau khi hoàn thành một khoá, bạn có mấy lựa chọn — tuỳ theo kỹ năng của mình:
            </p>
            <div className="lwa-flow">
              <div className="lwa-flow-row">
                <span className="lwa-flow-opt">A</span>
                <p className="lwa-p"><b>Vào nhóm thực hành phù hợp</b> nếu kỹ năng chưa đủ chắc — để luyện sâu hơn.</p>
              </div>
              <div className="lwa-flow-row">
                <span className="lwa-flow-opt">B</span>
                <p className="lwa-p"><b>Học tiếp khoá mới</b> nếu đã sẵn sàng tiếp nhận kiến thức mới — để tiếp tục đi lên.</p>
              </div>
              <div className="lwa-flow-row">
                <span className="lwa-flow-opt">C</span>
                <p className="lwa-p"><b>Làm cả hai</b>: vừa học khoá tiếp theo, vừa tham gia thực hành — vừa đi lên vừa đi sâu.</p>
              </div>
            </div>
            <div className="lwa-example">
              <p className="lwa-example-title">Ví dụ</p>
              <p className="lwa-p">
                Sau khoá <b>Đệm hát cơ bản</b>, bạn có thể vào nhóm thực hành cơ bản, hoặc học tiếp <b>Đệm hát 2</b>, hoặc kết hợp cả hai.
              </p>
            </div>
          </section>

          {/* Phần 4 — Có thể học cả hai */}
          <section className="lwa-sec">
            <h3 className="lwa-h3">Bạn hoàn toàn có thể học cả hai</h3>
            <p className="lwa-p">
              Bạn có thể chọn một trong hai — hoặc kết hợp cả hai để học hiệu quả hơn.
            </p>
            <p className="lwa-p">
              Gói Học theo lớp và Gói Thực hành không loại trừ nhau.
            </p>
            <p className="lwa-p">
              Bạn có thể vừa học theo lớp, vừa tham gia Gói Thực hành.
            </p>
            <p className="lwa-p">
              Lớp học giúp bạn tiếp tục <b>đi lên</b> — tiếp nhận kiến thức và kỹ năng mới.
            </p>
            <p className="lwa-p">
              Các buổi thực hành giúp bạn <b>đi sâu</b> — lặp lại, sửa lỗi và biến những điều đã học thành khả năng thực sự trên cây đàn.
            </p>
            <div className="lwa-qa">
              <p className="lwa-p">Một bên trả lời: <b>“Tiếp theo tôi cần học gì?”</b></p>
              <p className="lwa-p">Một bên trả lời: <b>“Tôi đã thực sự làm được điều mình học chưa?”</b></p>
            </div>
          </section>

          {/* Câu kết */}
          <div className="lwa-closer">
            <p className="lwa-closer-line">Học giúp bạn biết con đường phía trước.</p>
            <p className="lwa-closer-line">Thực hành giúp đôi tay thực sự đi được trên con đường đó.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Style scoped — dùng đúng design token của .tva-class ─── */
const CSS = `
.tva-class{--mem:#EA580C;--mem-soft:#FDF0E7;--mem-line:#F5CFB6;}
.tva-class .lw-sec{padding:58px 0;}
.tva-class .lw-grid{display:grid;gap:16px;margin-top:28px;grid-template-columns:1fr;}
@media(min-width:860px){.tva-class .lw-grid{grid-template-columns:1fr 1fr;gap:20px;}}
.tva-class .lw-card{border:1.5px solid var(--line);border-radius:16px;background:var(--surface);padding:26px 24px;box-shadow:0 1px 3px rgba(33,28,50,.05);display:flex;flex-direction:column;position:relative;overflow:hidden;}
.tva-class .lw-card::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;}
/* Nhánh Gói Thực hành — CAM */
.tva-class .lw-card-mem{background:linear-gradient(180deg,#FFFBF6 0%,var(--surface) 46%);}
.tva-class .lw-card-mem::before{background:var(--mem);}
.tva-class .lw-card-mem .lw-label{color:var(--mem);background:var(--mem-soft);border:1px solid var(--mem-line);}
/* Nhánh Gói Học theo lớp — TÍM */
.tva-class .lw-card-cls{background:linear-gradient(180deg,#F9F7FE 0%,var(--surface) 46%);}
.tva-class .lw-card-cls::before{background:var(--indigo);}
.tva-class .lw-card-cls .lw-label{color:var(--indigo);background:var(--indigo-tint);border:1px solid #D3CEE8;}
.tva-class .lw-label{display:inline-flex;align-self:flex-start;font-size:11.5px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;border-radius:999px;padding:5px 12px;}
.tva-class .lw-card h3{font-size:20px;font-weight:800;letter-spacing:-.3px;color:var(--ink);margin:14px 0 0;}
.tva-class .lw-body{margin:10px 0 0;font-size:14.5px;line-height:1.65;color:var(--ink-soft);}
.tva-class .lw-points{margin:16px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px;}
.tva-class .lw-points li{font-size:13.5px;font-weight:600;color:var(--ink);}
.tva-class .lw-points li::before{content:'✓ ';color:var(--online);font-weight:800;}
.tva-class .lw-price{margin-top:16px;font-size:19px;font-weight:800;letter-spacing:-.3px;color:var(--mem);}
.tva-class .lw-price-sub{margin-top:2px;font-size:12.5px;font-weight:600;color:var(--ink-soft);}
.tva-class .lw-link{margin-top:22px;text-align:center;}
.tva-class .lw-article-btn{background:none;border:none;padding:8px 14px;font-family:inherit;font-size:14.5px;font-weight:700;color:var(--indigo);cursor:pointer;text-decoration:underline;text-underline-offset:4px;text-decoration-color:rgba(67,56,202,.35);transition:color .15s;}
.tva-class .lw-article-btn:hover{color:var(--indigo-dark);text-decoration-color:var(--indigo);}

/* Bài viết ẩn — full-screen, đọc thoải mái */
.tva-class .lwa-overlay{position:fixed;inset:0;z-index:130;background:rgba(33,28,50,.7);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:0;}
@media(min-width:768px){.tva-class .lwa-overlay{padding:24px;}}
.tva-class .lwa-card{background:var(--surface);width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 70px -20px rgba(0,0,0,.45);}
@media(min-width:768px){.tva-class .lwa-card{height:auto;max-height:92vh;max-width:760px;border-radius:16px;}}
.tva-class .lwa-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:16px 20px;border-bottom:1px solid var(--line);}
@media(min-width:768px){.tva-class .lwa-head{padding:20px 28px;}}
.tva-class .lwa-title{font-size:19px;font-weight:800;letter-spacing:-.3px;color:var(--ink);margin:0;line-height:1.35;}
@media(min-width:768px){.tva-class .lwa-title{font-size:22px;}}
.tva-class .lwa-close{flex-shrink:0;width:38px;height:38px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--ink-soft);display:flex;align-items:center;justify-content:center;cursor:pointer;font-family:inherit;box-shadow:0 1px 3px rgba(33,28,50,.08);}
.tva-class .lwa-close:hover{color:var(--ink);}
.tva-class .lwa-body{flex:1;overflow-y:auto;padding:22px 20px 32px;}
@media(min-width:768px){.tva-class .lwa-body{padding:26px 28px 36px;}}
.tva-class .lwa-intro{margin:0 0 12px;font-size:15px;line-height:1.7;color:var(--ink-soft);}
.tva-class .lwa-sec{margin-top:30px;border-top:1px solid var(--line);padding-top:24px;}
.tva-class .lwa-h3{font-size:17.5px;font-weight:800;letter-spacing:-.2px;color:var(--ink);margin:0;}
.tva-class .lwa-p{margin:10px 0 0;font-size:14.5px;line-height:1.7;color:var(--ink-soft);}
.tva-class .lwa-p b{color:var(--ink);}
.tva-class .lwa-chain{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:16px 0 4px;}
.tva-class .lwa-chain-item{display:inline-flex;align-items:center;gap:8px;background:var(--indigo-tint);color:var(--indigo);border-radius:999px;padding:7px 14px;font-size:13px;font-weight:700;}
.tva-class .lwa-chain-arrow{color:var(--indigo);opacity:.5;font-weight:800;}
.tva-class .lwa-example{margin-top:18px;border:1px solid var(--line);border-radius:14px;background:var(--bg);padding:16px 18px;}
.tva-class .lwa-example-title{margin:0 0 4px;font-size:11.5px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:var(--honey);}
.tva-class .lwa-qa{margin-top:14px;border-left:3px solid var(--honey);padding:4px 0 4px 16px;}
.tva-class .lwa-flow{display:flex;flex-direction:column;gap:10px;margin-top:16px;}
.tva-class .lwa-flow-row{display:flex;align-items:flex-start;gap:12px;border:1px solid var(--line);border-radius:12px;background:var(--bg);padding:12px 14px;}
.tva-class .lwa-flow-opt{flex-shrink:0;width:26px;height:26px;border-radius:999px;background:var(--indigo);color:#fff;display:grid;place-items:center;font-size:12.5px;font-weight:800;margin-top:1px;}
.tva-class .lwa-flow-row .lwa-p{margin-top:0;font-size:13.5px;}
.tva-class .lwa-closer{margin-top:30px;background:var(--indigo);border-radius:14px;padding:24px 20px;text-align:center;}
.tva-class .lwa-closer-line{margin:0;font-size:16.5px;font-weight:700;line-height:1.6;color:#fff;}
`
