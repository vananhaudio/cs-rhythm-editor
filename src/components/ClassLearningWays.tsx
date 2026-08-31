/**
 * ClassLearningWays — section "Bạn muốn học theo cách nào?" trên /class.
 *
 * 2 TAB sản phẩm: GÓI THỰC HÀNH (CAM · linh hoạt · đi sâu) / GÓI HỌC THEO LỚP
 * (TÍM · cố định · đi lên). Mỗi tab chứa: giải thích ngắn + giá (CAM) +
 * LỊCH tương ứng (lịch thực hành thật trong tab CAM · các lớp sắp khai giảng
 * trong tab TÍM) — KHÔNG còn 2 card lớn / không còn lịch riêng phía dưới.
 *
 * - Không reload khi đổi tab, aria-selected/role tab + phím mũi tên.
 * - Link "Hai cách học khác nhau thế nào?" mở modal bài viết (không đổi).
 * - Query/data 2 lịch KHÔNG đổi (classPractice tự fetch; lịch lớp nhận qua props
 *   từ ClassLandingPage — nguồn query cũ).
 */
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import ClassPracticeSchedule from './ClassPracticeSchedule'

/** 1 lớp sắp khai giảng (shape từ ClassLandingPage schedToCard — không đổi query). */
export interface ClassSchedItem {
  name: string
  code: string
  schedule: string
  start: string
  price?: string
  courseTitle?: string
  tag?: string
  dateLabel?: string
  title?: string
  className?: string
  regName?: string
  path?: string
  day?: string
  date?: string
}
export interface SchedState {
  upcoming: ClassSchedItem[]
  active: ClassSchedItem[]
  smallGroup: { schedule: string }[]
  oneOnOneCount: number
  activeCount: number
}

interface Props {
  tab: 'practice' | 'class'
  onTabChange: (t: 'practice' | 'class') => void
  sched: SchedState | null
  onRegister: (name: string) => void
  onShowActive: () => void
  onChat: () => void
}

const COPY = {
  kicker: 'Chọn cách học phù hợp',
  title: 'Bạn muốn học theo cách nào?',
  sub: 'Bạn có thể chọn một gói hoặc kết hợp cả hai.',
  caption: 'Học theo lớp để đi lên. Thực hành để đi sâu.',
  articleLink: 'Hai cách học khác nhau thế nào?',
  tab1: { label: 'Gói Thực hành', sub: 'Linh hoạt · đi sâu' },
  tab2: { label: 'Gói Học theo lớp', sub: 'Cố định · đi lên' },
  practice: {
    title: 'Linh hoạt theo thời gian và hướng học của bạn',
    price: '499.000đ/tháng',
    priceSub: 'Đăng ký dài hạn: 396.000đ/tháng',
    flex3: [
      { label: 'Học gì', body: 'Chọn hướng học trên App: <b>Đệm hát · Tỉa nốt · Solo...</b>' },
      { label: 'Học ở mức nào', body: 'Tham gia nhóm thực hành phù hợp: <b>Cơ bản · Trung cấp · Nâng cao</b>' },
      { label: 'Học buổi nào', body: 'Chủ động chọn buổi thực hành theo lịch — không cần cố định một ngày hàng tuần.' },
    ],
    points: ['Học và luyện theo tiến độ riêng.', 'Gặp chỗ vướng thì hỏi Thầy.'],
  },
  cls: {
    title: 'Cố định để đi cùng nhau',
    points: [
      'Chọn một lớp cụ thể.',
      'Có ngày khai giảng.',
      'Học theo lịch cố định.',
      'Bài học tiếp nối nhau theo chương trình.',
      'Cả lớp đi cùng một nhịp từ đầu đến cuối.',
    ],
  },
}

const parseVNDate = (s: string): number | null => { const m = (s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? new Date(+m[3], +m[2] - 1, +m[1]).getTime() : null }

// Suy ra nhãn/lộ trình từ tên khoá (display — giữ nguyên hành vi lịch lớp cũ)
const inferTag = (n: string) => { const s = n.toLowerCase()
  if (s.includes('nhập môn')) return 'Nhập môn · Miễn phí'
  if (s.includes('hành trình')) return 'Toàn diện · Combo'
  if (s.includes('đệm hát')) return 'Đệm hát'
  if (s.includes('tỉa nốt') || s.includes('guitar cho') || s.includes('guitar căn')) return 'Tỉa nốt / Guitar'
  if (s.includes('cảm nhận') || s.includes('cảm âm') || s.includes('nhạc lý')) return 'Cảm âm / Nhạc lý'
  if (s.includes('bolero')) return 'Chuyên đề'
  return 'Guitar' }
const inferPath = (n: string) => { const s = n.toLowerCase()
  if (s.includes('đệm hát')) return 'dem_hat'
  if (s.includes('tỉa nốt') || s.includes('guitar')) return 'tia_not'
  if (s.includes('hành trình')) return 'combo'
  return '' }
// Map item thô (từ ClassLandingPage sched) → card hiển thị (giữ nguyên regName KÈM MÃ — form đăng ký khớp option)
const schedToCard = (it: ClassSchedItem) => ({
  tag: it.tag || inferTag(it.courseTitle || it.name),
  title: it.courseTitle || it.name,
  className: it.code ? `${it.name} · ${it.code}` : it.name,
  regName: it.code ? `${it.name} · ${it.code}` : it.name,
  path: inferPath(it.courseTitle || it.name),
  day: it.schedule || 'Đang cập nhật',
  date: it.dateLabel || (it.start ? 'Khai giảng ' + it.start : 'Đang xếp lịch'),
  price: it.price || (/nhập môn|miễn phí/i.test(it.name) ? 'Free' : '990k'),
})

export default function ClassLearningWays({ tab, onTabChange, sched, onRegister, onShowActive, onChat }: Props) {
  const [open, setOpen] = useState(false)

  const onTabsKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next: 'practice' | 'class' = tab === 'practice' ? 'class' : 'practice'
    onTabChange(next)
    const btns = e.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="tab"]')
    btns[next === 'practice' ? 0 : 1]?.focus()
  }

  return (
    <section id="cach-hoc" className="lw-sec">
      <div className="wrap">
        <div className="eyebrow">{COPY.kicker}</div>
        <h2>{COPY.title}</h2>
        <p className="lead">{COPY.sub}</p>

        {/* 2 TAB sản phẩm — CAM / TÍM */}
        <div className="lw-tabs" role="tablist" aria-label="Cách học" onKeyDown={onTabsKey}>
          <button type="button" role="tab" id="lw-tab-practice" aria-selected={tab === 'practice'} aria-controls="lw-panel-practice"
            className={'lw-tab lw-tab-mem' + (tab === 'practice' ? ' on' : '')}
            onClick={() => onTabChange('practice')}>
            <span className="lw-tab-name">{COPY.tab1.label}</span>
            <span className="lw-tab-sub">{COPY.tab1.sub}</span>
          </button>
          <button type="button" role="tab" id="lw-tab-class" aria-selected={tab === 'class'} aria-controls="lw-panel-class"
            className={'lw-tab lw-tab-cls' + (tab === 'class' ? ' on' : '')}
            onClick={() => onTabChange('class')}>
            <span className="lw-tab-name">{COPY.tab2.label}</span>
            <span className="lw-tab-sub">{COPY.tab2.sub}</span>
          </button>
        </div>

        {/* Câu giải thích ngắn + link bài viết */}
        <div className="lw-tabnote">
          <p className="lw-caption"><b>{COPY.caption}</b></p>
          <button type="button" className="lw-article-btn" onClick={() => setOpen(true)}>
            {COPY.articleLink}
            <span aria-hidden> →</span>
          </button>
        </div>

        {/* TAB CAM — Gói Thực hành: cách học + giá + LỊCH THỰC HÀNH */}
        {tab === 'practice' && (
          <div className="lw-panel lw-panel-mem" id="lw-panel-practice" role="tabpanel" aria-labelledby="lw-tab-practice">
            <h3 className="lw-panel-title">{COPY.practice.title}</h3>
            <div className="lw-flex3">
              {COPY.practice.flex3.map(f => (
                <div className="lw-f3" key={f.label}>
                  <span className="lw-f3-label">{f.label}</span>
                  <p dangerouslySetInnerHTML={{ __html: f.body }} />
                </div>
              ))}
            </div>
            <ul className="lw-bullets">
              {COPY.practice.points.map(p => <li key={p}>{p}</li>)}
            </ul>
            <div className="lw-price-row">
              <span className="lw-price">{COPY.practice.price}</span>
              <span className="lw-price-sub">{COPY.practice.priceSub}</span>
            </div>

            {/* Lịch thực hành thật — nằm TRONG tab Gói Thực hành (không duplicate) */}
            <ClassPracticeSchedule />
          </div>
        )}

        {/* TAB TÍM — Gói Học theo lớp: cách học + CÁC LỚP SẮP KHAI GIẢNG */}
        {tab === 'class' && (
          <div className="lw-panel lw-panel-cls" id="lw-panel-class" role="tabpanel" aria-labelledby="lw-tab-class">
            <h3 className="lw-panel-title">{COPY.cls.title}</h3>
            <ul className="lw-bullets">
              {COPY.cls.points.map(p => <li key={p}>{p}</li>)}
            </ul>

            {/* Lịch lớp thật — nằm TRONG tab Gói Học theo lớp (query/CTA/registration cũ) */}
            <div className="lw-cls-sched cls-sec">
              <div className="cls-kicker"><span className="eyebrow">Lịch khai giảng</span><span className="cls-pill">Gói Học theo lớp</span></div>
              <h3 className="lw-cls-h">Các lớp sắp khai giảng</h3>
              <p className="lead">Dành cho bạn muốn học theo một chương trình và khung giờ cố định. Tất cả lớp đều <b>học online trực tiếp qua Zoom</b> — 990k/khoá · 2 tháng · 8 buổi. Chọn lớp phù hợp với bạn bên dưới, hoặc để thầy tư vấn giúp bạn đúng cửa vào.</p>
              {/* Chưa tải xong lịch → chờ; KHÔNG hiện dữ liệu cứng (dễ thành lớp ma ngày cũ) */}
              {sched === null && <div style={{ textAlign: 'center', color: '#8A8A93', padding: '28px 0', fontSize: 15 }}>Đang tải lịch lớp…</div>}
              {/* Hết lớp sắp khai giảng → nói thật + mời giữ chỗ, thay vì hiện lớp cũ */}
              {sched !== null && sched.upcoming.length === 0 && (
                <div className="panel" style={{ textAlign: 'center', padding: '30px 22px' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
                  <h3 style={{ margin: '0 0 8px' }}>Các khoá hiện tại đã khai giảng — lớp mới đang được xếp lịch</h3>
                  <p style={{ color: '#52525B', margin: '0 auto 18px', maxWidth: 520 }}>Để lại thông tin bên dưới, thầy sẽ giữ chỗ và báo bạn ngay khi mở lớp mới. Bạn cũng có thể hỏi Mira xem lớp nào phù hợp với mình.</p>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" onClick={() => onRegister('')}>Để lại thông tin giữ chỗ →</button>
                    <button className="btn btn-ghost" onClick={onChat}>Hỏi Mira</button>
                  </div>
                </div>
              )}
              <div className="cls-list">
                {(sched?.upcoming?.length
                  ? [...sched.upcoming].sort((a, b) => { const da = parseVNDate(a.start), db = parseVNDate(b.start); if (da == null && db == null) return 0; if (da == null) return 1; if (db == null) return -1; return da - db }).map(schedToCard)
                  : []
                ).map((raw, i) => {
                  const c = raw
                  const title = c.title
                  const reg = c.regName
                  return (
                  <div className="cls-item" key={i}>
                    <span className="tag">{c.tag}</span>
                    <h3>{title}</h3>
                    {c.className && <div style={{ fontSize: 13.5, color: '#8A5A2B', fontWeight: 700, margin: '-2px 0 8px' }}>🎓 Lớp: {c.className}</div>}
                    <div className="cls-format">🎥 Online qua Zoom · {c.path === 'combo' ? 'combo 10 khoá' : '8 buổi · mỗi buổi 90 phút'}</div>
                    <div className="meta"><span><b>{c.day}</b></span><span>{c.date}</span><span className="price">{c.price}</span></div>
                    <div className="acts">
                      <button className="btn btn-primary" onClick={() => onRegister(reg)}>Đăng ký lớp này</button>
                      <button className="btn btn-ghost" onClick={onChat}>Hỏi thêm</button>
                    </div>
                  </div>
                  )
                })}
              </div>
              {sched && sched.activeCount > 0 && (
                <div style={{ textAlign: 'center', marginTop: 26 }}>
                  <button className="btn btn-ghost" onClick={onShowActive}>👀 Xem thêm {sched.activeCount} lớp đang học →</button>
                </div>
              )}
            </div>
          </div>
        )}
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
/* 2 TAB sản phẩm */
.tva-class .lw-tabs{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:26px;}
@media(min-width:860px){.tva-class .lw-tabs{display:inline-flex;gap:10px;}}
.tva-class .lw-tab{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;border:1.5px solid var(--line);border-radius:14px;background:rgba(255,255,255,.6);padding:12px 18px;cursor:pointer;font-family:inherit;transition:all .15s;}
.tva-class .lw-tab:hover{border-color:#CFC9DA;}
.tva-class .lw-tab.on{background:var(--surface);box-shadow:0 12px 30px -18px rgba(33,28,50,.35);}
.tva-class .lw-tab-mem.on{border-color:var(--mem);}
.tva-class .lw-tab-cls.on{border-color:var(--indigo);}
.tva-class .lw-tab-name{font-size:15px;font-weight:800;color:var(--ink);line-height:1.3;}
.tva-class .lw-tab-sub{font-size:10.5px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;}
.tva-class .lw-tab-mem .lw-tab-sub{color:var(--mem);}
.tva-class .lw-tab-cls .lw-tab-sub{color:var(--indigo);}
.tva-class .lw-tab-mem.on .lw-tab-name,.tva-class .lw-tab-mem.on .lw-tab-sub{color:var(--mem);}
.tva-class .lw-tab-cls.on .lw-tab-name,.tva-class .lw-tab-cls.on .lw-tab-sub{color:var(--indigo);}
.tva-class .lw-tabnote{display:flex;flex-wrap:wrap;align-items:center;gap:8px 18px;margin-top:16px;}
.tva-class .lw-caption{margin:0;font-size:14.5px;font-weight:600;color:var(--ink-soft);}
.tva-class .lw-caption b{color:var(--ink);}
.tva-class .lw-article-btn{background:none;border:none;padding:6px 4px;font-family:inherit;font-size:14px;font-weight:700;color:var(--indigo);cursor:pointer;text-decoration:underline;text-underline-offset:4px;text-decoration-color:rgba(67,56,202,.35);transition:color .15s;}
.tva-class .lw-article-btn:hover{color:var(--indigo-dark);text-decoration-color:var(--indigo);}
/* Panel nội dung tab */
.tva-class .lw-panel{margin-top:20px;border:1.5px solid var(--line);border-top:4px solid var(--mem);border-radius:16px;background:var(--surface);padding:24px 22px;box-shadow:0 1px 3px rgba(33,28,50,.05);}
.tva-class .lw-panel-cls{border-top-color:var(--indigo);}
.tva-class .lw-panel-title{font-size:20px;font-weight:800;letter-spacing:-.3px;color:var(--ink);margin:0;}
.tva-class .lw-flex3{display:grid;gap:12px;margin-top:18px;grid-template-columns:1fr;}
@media(min-width:640px){.tva-class .lw-flex3{grid-template-columns:repeat(3,1fr);gap:14px;}}
.tva-class .lw-f3{border:1px solid var(--line);border-radius:12px;background:var(--bg);padding:14px 16px;}
.tva-class .lw-f3-label{display:inline-block;font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--mem);background:var(--mem-soft);border-radius:999px;padding:3px 10px;}
.tva-class .lw-f3 p{margin:9px 0 0;font-size:13.5px;line-height:1.6;color:var(--ink-soft);}
.tva-class .lw-f3 p b{color:var(--ink);}
.tva-class .lw-bullets{margin:16px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:7px;}
.tva-class .lw-bullets li{font-size:14px;font-weight:600;color:var(--ink);}
.tva-class .lw-bullets li::before{content:'✓ ';color:var(--online);font-weight:800;}
.tva-class .lw-price-row{margin-top:16px;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;}
.tva-class .lw-price{font-size:21px;font-weight:800;letter-spacing:-.3px;color:var(--mem);}
.tva-class .lw-price-sub{font-size:13px;font-weight:600;color:var(--ink-soft);}
/* Lịch thực hành + lịch lớp embedded trong tab */
.tva-class .lw-panel .cps-sec{padding:24px 0 0;}
.tva-class .lw-cls-sched{margin-top:26px;border-top:1px solid var(--line);padding-top:24px;}
.tva-class .lw-panel .cls-sec{padding-top:0;}
.tva-class .lw-cls-h{font-size:20px;font-weight:800;letter-spacing:-.3px;color:var(--ink);margin:10px 0 0;}

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
