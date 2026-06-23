// ClassLandingPage — trang tuyển sinh class.vananhaudio.com (route /class)
// Cổng tuyển sinh "có đạo diễn": 3 cửa vào → showcase hành động → chat nhẹ →
// lớp sắp khai giảng → quyền lợi → form (ghi leads) → thanh toán (ẩn) → app/thầy/FAQ.
// Quy ước: dùng chung Supabase (anon ghi leads). Style: scoped CSS .tva-class (responsive/hover).
import { useState, useRef, useEffect } from 'react'
import { supabase } from './supabase'
import ClassJourney2027 from './ClassJourney2027'
import ClassDemHat from './ClassDemHat'
import ClassTiaNot from './ClassTiaNot'
import ClassQuiz from './ClassQuiz'

// ─── Lớp sắp khai giảng (tạm hardcode — sau đọc từ Google Sheet/Supabase) ───
const CLASSES = [
  { tag: 'Đệm hát · Trình độ 1', name: 'Khởi đầu đam mê – Đệm hát TĐ1', path: 'dem_hat', day: 'Thứ 3 · 19h00', date: 'Khai giảng 07/07/2026', price: '990k' },
  { tag: 'Tỉa nốt · Trình độ 1', name: 'Tỉa nốt trên nền karaoke – Khoá 11', path: 'tia_not', day: 'Thứ 5 · 19h00', date: 'Khai giảng 09/07/2026', price: '990k' },
  { tag: 'Đệm hát · Trình độ 2', name: 'Khởi đầu đam mê – Đệm hát TĐ2', path: 'dem_hat', day: 'Thứ 6 · 19h00', date: 'Khai giảng 10/07/2026', price: '990k' },
  { tag: 'Toàn diện · Combo', name: 'Hành trình Guitar 2027 (combo 10 khoá)', path: 'combo', day: 'Thứ 5 · 20h30', date: 'Khai giảng tháng 9/2026', price: 'Combo' },
]

// ─── 3 cửa vào — nút mở bài viết (nếu có) hoặc cuộn tới lớp/chat ───
const DOORS: { dq: string; badge: string; desc: string; cta: string; slot: string; fallback: string; native?: string }[] = [
  { dq: 'Tôi muốn vừa đàn vừa hát', badge: 'Đệm hát căn bản', desc: 'Dành cho người thích hát, hay hát karaoke, muốn tự đệm các bài yêu thích.', cta: 'Xem lớp Đệm hát', slot: 'cua-dem-hat', fallback: 'lichlop', native: 'demhat' },
  { dq: 'Tôi muốn học Guitar căn bản từ gốc', badge: 'Guitar căn bản / Tỉa nốt 1', desc: 'Dành cho người mới muốn làm quen với nốt nhạc, vị trí trên cần đàn và chơi những giai điệu đầu tiên.', cta: 'Xem lớp Guitar căn bản', slot: 'cua-tia-not', fallback: 'lichlop', native: 'tianot' },
  { dq: 'Tôi đã biết chơi nhưng muốn tiến xa hơn', badge: 'Cảm âm · Giai điệu · Thực chiến', desc: 'Dành cho người đã chơi một thời gian nhưng vẫn phụ thuộc tab, khó tự tìm giai điệu, khó hiểu nốt và âm giai.', cta: 'Hỏi trợ lý xếp đúng trình độ', slot: 'cua-cam-am', fallback: 'chat' },
]

// ─── Showcase hành động (tâm lý → 1 hành động nhỏ) ───
// slot: nếu có bài viết (articles) published cùng slot → thẻ "sống dậy", CTA mở bài viết.
const STARTERS: { t: string; d: string; cta: string; href?: string; modal?: string; ready: boolean; note?: string; slot?: string; articleCta?: string; native?: string }[] = [
  { t: 'Tìm điểm bắt đầu của tôi', d: 'Bài test 2 phút. Không cần biết trình độ — trả lời vài câu để biết mình phù hợp lớp nào.', cta: 'Làm bài test', ready: true, native: 'quiz' },
  { t: 'Mở bài học thử trên app', d: 'Dùng thử app TVA Guitar 7 ngày: trải nghiệm bài học đầu tiên, cách luyện tập và theo dõi tiến độ.', cta: 'Dùng thử miễn phí', href: '#chat', ready: false, note: 'cần link bản dùng thử app', slot: 'dung-thu-app', articleCta: 'Tìm hiểu dùng thử' },
  { t: 'Xem một buổi học vận hành thế nào', d: 'Lớp Zoom có thầy dẫn, nhóm Zalo nhắc lịch & giao bài, app lưu bài, có trả bài. Học online không phải tự bơi.', cta: 'Xem mô hình học', modal: 'mohinh', ready: false, note: 'cần ảnh Zoom/Zalo/app thật', slot: 'mo-hinh-hoc', articleCta: 'Xem mô hình học' },
  { t: '90 phút mỗi tuần cho cây đàn của bạn', d: 'Một tuần chỉ 90 phút, lộ trình 8 buổi. Nếu không đặt lịch cho ước mơ, nó sẽ bị việc khác chen vào.', cta: 'Đọc bài viết', href: '#chat', ready: false, note: 'cần bài viết', slot: '90-phut-moi-tuan', articleCta: 'Đọc bài viết' },
  { t: 'Những học viên lớn tuổi bắt đầu thế nào', d: 'Nhiều người bắt đầu khi đã 40, 50, 60. Quan trọng không phải tuổi — mà là đi chậm và đúng cách.', cta: 'Xem video lớp học', href: '#chat', ready: false, note: 'cần video', slot: 'hoc-vien-lon-tuoi', articleCta: 'Đọc bài viết' },
  { t: 'Bạn được hỗ trợ gì sau khi đăng ký', d: 'Chọn sai lớp? Không theo kịp? Bận một buổi? Mỗi lo lắng đều có cách hệ thống hỗ trợ bạn.', cta: 'Xem cam kết', modal: 'camket', ready: true, slot: 'cam-ket', articleCta: 'Xem cam kết' },
]

const CHAT_FAQ: Record<string, string> = {
  'Tôi nên bắt đầu từ đâu?': 'Người mới hoàn toàn nên bắt đầu từ <b>Nhập môn (miễn phí)</b>, rồi chọn nhánh Đệm hát hoặc Tỉa nốt. Bạn đang ở mức nào?',
  'Học phí thế nào?': 'Mỗi khoá <b>990k</b>, học 2 tháng (8 buổi). Nhập môn &amp; Nhạc lý căn bản miễn phí.',
  'Đệm hát hay tỉa nốt?': 'Muốn tự đàn hát → <b>Đệm hát</b>. Muốn chơi giai điệu, đọc nốt → <b>Tỉa nốt</b>. Bạn thiên về cái nào?',
  'Lịch học ra sao?': 'Các lớp sắp mở chủ yếu <b>tối trong tuần (19h–20h30)</b>. Xem mục "Lớp sắp khai giảng", hoặc cho mình biết khung giờ bạn rảnh.',
}

const MODALS: Record<string, string> = {
  mohinh: `<h3>Một buổi học vận hành thế nào?</h3>
    <p class="lead" style="margin-top:6px">Học ở đây không phải tự xem video rồi tự bơi — có cả một mô hình hỗ trợ quanh bạn.</p>
    <div class="mh-grid">
      <div class="mh-card"><div class="mh-ph">Ảnh lớp Zoom thật</div><h4>Lớp Zoom có người dẫn</h4><p>Học theo lịch cố định, thầy giảng trực tiếp.</p></div>
      <div class="mh-card"><div class="mh-ph">Ảnh nhóm Zalo lớp</div><h4>Nhóm Zalo lớp</h4><p>Nhắc lịch, giao bài, hỏi đáp sau buổi học.</p></div>
      <div class="mh-card"><div class="mh-ph">Ảnh màn hình app</div><h4>App TVA Guitar</h4><p>Bài học, bài tập, tiến độ được lưu để ôn lại.</p></div>
      <div class="mh-card"><div class="mh-ph">Ảnh hướng dẫn trả bài</div><h4>Trả bài có góp ý</h4><p>Gửi bài để thầy/trợ lý xem và sửa cho bạn.</p></div>
    </div>`,
  camket: `<h3>Bạn được hỗ trợ gì sau khi đăng ký?</h3>
    <p class="lead" style="margin-top:6px">Bạn không bị ném vào một khoá học rồi tự xoay xở.</p>
    <table class="ck-table"><tbody>
      <tr><td>Chọn sai lớp</td><td>Được tư vấn trước khi vào lớp</td></tr>
      <tr><td>Không theo kịp</td><td>App xem lại bài + bài tập sau buổi</td></tr>
      <tr><td>Bận một buổi</td><td>Có nội dung ôn lại trong app / nhóm lớp</td></tr>
      <tr><td>Không biết tập gì</td><td>Có bài tập rõ sau mỗi buổi học</td></tr>
      <tr><td>Vào lớp chưa phù hợp</td><td>Thầy/trợ lý sẽ định hướng lại</td></tr>
    </tbody></table>`,
  banDo: `<h3>Bản đồ hành trình dài hạn</h3>
    <p class="lead" style="margin-top:6px">Bạn không cần học hết ngay — chỉ cần bắt đầu bằng khóa đầu tiên phù hợp. Đây là con đường nếu bạn muốn đi xa.</p>
    <div class="bando">
      <div class="b-row"><span class="b-node b-free">Nhập môn (miễn phí)</span></div>
      <div class="b-row"><span class="b-branch">Nhạc lý</span> căn bản → nâng cao → hoà âm cảm âm</div>
      <div class="b-row"><span class="b-branch">Đệm hát</span> TĐ1 → TĐ2 → TĐ3 (bứt phá)</div>
      <div class="b-row"><span class="b-branch">Tỉa nốt</span> TĐ1 → TĐ2 → nâng cao</div>
      <div class="b-row b-converge">↓ hội tụ: Đệm hát nâng cao → Solo Guitar → Nghệ sĩ Guitar</div>
    </div>`,
}

const ZALO = '0983 259 893'

type Msg = { who: 'ai' | 'me'; html: string }

export default function ClassLandingPage() {
  const [form, setForm] = useState({ name: '', phone: '', zalo: '', email: '', className: CLASSES[0].name, note: '' })
  const [formErr, setFormErr] = useState(false)
  const [showPay, setShowPay] = useState(false)
  const [sent, setSent] = useState(false)
  const [okBox, setOkBox] = useState(false)
  const [modal, setModal] = useState<string | null>(null)
  const [showJourney, setShowJourney] = useState(false)
  const [showDemHat, setShowDemHat] = useState(false)
  const [showTiaNot, setShowTiaNot] = useState(false)
  const [showQuiz, setShowQuiz] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([
    { who: 'ai', html: 'Chào bạn 👋 Mình là trợ lý tư vấn của Thầy Văn Anh. Bạn đang ở đâu trên hành trình, hay còn băn khoăn gì? Chọn một câu hoặc nhập câu hỏi nhé.' },
  ])
  const [chatInput, setChatInput] = useState('')
  const [articles, setArticles] = useState<Record<string, { title: string; body: string }>>({})
  const chatBodyRef = useRef<HTMLDivElement>(null)
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  // Đọc bài viết published → map theo slot (thẻ showcase sống dậy khi thầy đăng bài)
  useEffect(() => {
    supabase.from('articles').select('slot,title,body').eq('published', true).then(({ data }) => {
      if (!data) return
      const m: Record<string, { title: string; body: string }> = {}
      data.forEach((a: { slot: string | null; title: string; body: string | null }) => {
        if (a.slot) m[a.slot] = { title: a.title, body: a.body ?? '' }
      })
      setArticles(m)
    })
  }, [])

  useEffect(() => {
    if (chatBodyRef.current) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight
  }, [msgs])

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setModal(null) }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [])

  const goto = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  const pickClass = (name: string) => { set('className', name); goto('dangky') }

  const chatPush = (m: Msg) => setMsgs(prev => [...prev, m])
  const askChip = (q: string) => { chatPush({ who: 'me', html: q }); setTimeout(() => chatPush({ who: 'ai', html: CHAT_FAQ[q] }), 350) }
  const chatSend = () => {
    const v = chatInput.trim(); if (!v) return
    chatPush({ who: 'me', html: v }); setChatInput('')
    setTimeout(() => chatPush({ who: 'ai', html: `Cảm ơn câu hỏi! Trợ lý đang ở mức cơ bản nên câu này thầy sẽ trả lời kỹ hơn. Bạn để lại số <b>Zalo</b> (hoặc nhắn ${ZALO}) nhé, hoặc chọn một gợi ý phía trên.` }), 450)
  }

  const submitReg = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.className) { setFormErr(true); return }
    setFormErr(false)
    const cls = CLASSES.find(c => c.name === form.className)
    const { error } = await supabase.from('leads').insert({
      name: form.name.trim(), phone: form.phone.trim(), zalo: form.zalo.trim() || null,
      email: form.email.trim() || null, class_name: form.className, path: cls?.path ?? null,
      intent: 'dang_ky', note: form.note.trim() || null, source: 'landing', status: 'Mới đăng ký',
    })
    if (error) { console.error('Ghi leads lỗi:', error); alert('Có lỗi khi gửi đăng ký, bạn thử lại hoặc nhắn Zalo ' + ZALO + ' giúp thầy nhé.'); return }
    setShowPay(true)
    setTimeout(() => goto('thanhtoan'), 60)
  }

  return (
    <div className="tva-class">
      <style>{CSS}</style>

      <nav>
        <div className="wrap nav-in">
          <div className="brand"><img className="mark" src="/tva-logo.png" alt="TVA Guitar" /> Thầy Văn Anh Guitar</div>
          <div className="nav-links">
            <a onClick={() => goto('cuavao')}>Cửa vào</a>
            <a onClick={() => goto('chat')}>Tư vấn</a>
            <a onClick={() => goto('batdau')}>Bắt đầu</a>
            <a onClick={() => goto('lichlop')}>Lịch lớp</a>
            <a onClick={() => goto('dangky')}>Đăng ký</a>
          </div>
          <button className="btn btn-primary nav-cta" onClick={() => goto('dangky')}>Đăng ký lớp</button>
        </div>
      </nav>

      {/* HERO */}
      <header className="hero">
        <div className="wrap hero-grid">
          <div>
            <h1>Bắt đầu học Guitar bằng <span className="hl">một khóa nhỏ phù hợp với bạn</span></h1>
            <p>Thích hát, thích chơi giai điệu, hay đã chơi nhưng muốn tiến xa hơn — mỗi người một cửa vào. Bạn không cần học cả hành trình ngay từ đầu, chỉ cần chọn đúng khóa nhỏ đầu tiên. Khi sẵn sàng, bản đồ dài hạn luôn ở đó để bạn đi tiếp.</p>
            <div className="hero-cta">
              <button className="btn btn-primary" onClick={() => goto('cuavao')}>Chọn cửa vào của tôi →</button>
              <button className="btn btn-ghost" onClick={() => goto('chat')}>Tư vấn với trợ lý</button>
            </div>
          </div>
          <div className="hero-art">
            <h3>Bắt đầu bằng đúng một bước</h3>
            <p>Chọn một khóa nhỏ hợp với bạn ngay hôm nay. Đi xa tới đâu, lúc nào — hoàn toàn tùy bạn.</p>
            <div className="hero-stats">
              <div><b>3</b><span>cửa vào dễ chọn</span></div>
              <div><b>8 buổi</b><span>/ khóa · 2 tháng</span></div>
              <div><b>990k</b><span>/ khóa</span></div>
            </div>
          </div>
        </div>
      </header>

      {/* 3 CỬA VÀO */}
      <section id="cuavao" className="band">
        <div className="wrap">
          <div className="eyebrow">Chọn điểm bắt đầu</div>
          <h2>Chọn cửa vào phù hợp với bạn</h2>
          <p className="lead">Bạn không cần học cả một hành trình dài ngay từ đầu. Trước mắt, chọn một cửa vào hợp với mình.</p>
          <div className="doors">
            {DOORS.map((d, i) => {
              const art = articles[d.slot]
              return (
                <div className="door" key={i}>
                  <div className="dq">{d.dq}</div>
                  <span className="dbadge">{d.badge}</span>
                  <p>{d.desc}</p>
                  {d.native === 'demhat'
                    ? <button className="btn btn-primary" onClick={() => setShowDemHat(true)}>{d.cta} →</button>
                    : d.native === 'tianot'
                    ? <button className="btn btn-primary" onClick={() => setShowTiaNot(true)}>{d.cta} →</button>
                    : art
                    ? <button className="btn btn-primary" onClick={() => setModal('art:' + d.slot)}>{d.cta} →</button>
                    : <button className="btn btn-primary" onClick={() => goto(d.fallback)}>{d.cta} →</button>}
                </div>
              )
            })}
          </div>
          <div className="map-hint">
            Sau khóa đầu tiên, bạn có thể đi tiếp theo bản đồ hành trình dài hạn khi sẵn sàng.
            <button className="btn btn-ghost" onClick={() => setShowJourney(true)}>Xem bản đồ hành trình đầy đủ</button>
          </div>
        </div>
      </section>

      {/* SHOWCASE HÀNH ĐỘNG */}
      <section id="batdau" className="band">
        <div className="wrap">
          <div className="eyebrow">Chọn một bước nhỏ</div>
          <h2>Bắt đầu theo cách phù hợp với bạn</h2>
          <p className="lead">Mỗi người có một điểm bắt đầu khác nhau. Làm bài test, xem thử cách học, đọc một bài ngắn — hoặc hỏi trợ lý, trước khi đăng ký.</p>
          <div className="worries">
            {STARTERS.map((x, i) => {
              const art = x.slot ? articles[x.slot] : undefined
              const live = x.ready || !!art
              return (
              <div className="worry" key={i}>
                <h3>{x.t}</h3>
                <p>{x.d}</p>
                {x.native === 'quiz'
                  ? <button className="btn btn-primary" onClick={() => setShowQuiz(true)}>{x.cta} →</button>
                  : art
                  ? <button className="btn btn-primary" onClick={() => setModal('art:' + x.slot)}>{x.articleCta ?? 'Đọc bài viết'} →</button>
                  : x.modal
                  ? <button className="btn btn-ghost" onClick={() => setModal(x.modal!)}>{x.cta} →</button>
                  : <button className={`btn ${x.ready ? 'btn-primary' : 'btn-ghost'}`} onClick={() => goto((x.href ?? '#chat').replace('#', ''))}>{x.cta} →</button>}
                <a className="askline" onClick={() => goto('chat')}>Hỏi trợ lý về bước này →</a>
                {!live && <div className="soon">Sắp có · {x.note}</div>}
              </div>
            )})}
          </div>
        </div>
      </section>

      {/* CHAT */}
      <section className="chat-sec" id="chat">
        <div className="wrap chat-grid">
          <div>
            <div className="eyebrow">Trợ lý tư vấn</div>
            <h2>Còn câu hỏi riêng? Cứ hỏi trợ lý</h2>
            <p className="lead">Trợ lý giúp bạn tìm đúng vị trí trên hành trình và trả lời mọi thắc mắc riêng của bạn — trước khi quyết định đăng ký.</p>
          </div>
          <div className="chat-card">
            <div className="cc-head">
              <div className="av">VA<span className="dot" /></div>
              <div><h4>Trợ lý tư vấn TVA Guitar</h4><p><b>● Đang trực tuyến</b> · trả lời ngay</p></div>
            </div>
            <div className="cc-body" ref={chatBodyRef}>
              {msgs.map((m, i) => <div key={i} className={`msg ${m.who}`} dangerouslySetInnerHTML={{ __html: m.html }} />)}
            </div>
            <div className="cc-foot">
              <div className="cc-chips">
                {Object.keys(CHAT_FAQ).map(q => <button key={q} className="cc-chip" onClick={() => askChip(q)}>{q}</button>)}
              </div>
              <div className="cc-input">
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') chatSend() }} placeholder="Nhập câu hỏi của bạn..." />
                <button onClick={chatSend}>Gửi</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LỚP SẮP KHAI GIẢNG */}
      <section id="lichlop">
        <div className="wrap">
          <div className="eyebrow">Lịch khai giảng</div>
          <h2>Lớp sắp khai giảng</h2>
          <p className="lead">990k/khoá · 2 tháng · 8 buổi. Nhập môn miễn phí. Đã quyết thì đăng ký luôn, còn lăn tăn thì hỏi thêm.</p>
          <div className="cls-list">
            {CLASSES.map((c, i) => (
              <div className="cls-item" key={i}>
                <span className="tag">{c.tag}</span>
                <h3>{c.name}</h3>
                <div className="meta"><span><b>{c.day}</b></span><span>{c.date}</span><span className="price">{c.price}</span></div>
                <div className="acts">
                  <button className="btn btn-primary" onClick={() => pickClass(c.name)}>Đăng ký lớp này</button>
                  <button className="btn btn-ghost" onClick={() => goto('chat')}>Hỏi thêm</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* QUYỀN LỢI */}
      <section id="quyenloi" className="band">
        <div className="wrap">
          <div className="eyebrow">Quyền lợi</div>
          <h2>Một khóa học gồm những gì?</h2>
          <div className="benefits">
            {[['📅', '<b>8 buổi học</b> theo lịch lớp cố định'], ['🎥', '<b>Zoom trực tiếp cùng thầy</b> mỗi buổi'], ['📱', '<b>App TVA Guitar</b> để xem bài & ôn tập'], ['✍️', '<b>Bài tập</b> rõ ràng sau mỗi buổi'], ['👥', '<b>Nhóm lớp</b> nhận thông báo & hỗ trợ'], ['🎯', '<b>Tư vấn chọn đúng trình độ</b> trước khi vào lớp']].map(([ic, t], i) => (
              <div className="bf" key={i}><span className="bi">{ic}</span><div dangerouslySetInnerHTML={{ __html: t }} /></div>
            ))}
          </div>
          <div className="tuition">Học phí khóa học: <b>990.000đ</b></div>
        </div>
      </section>

      {/* ĐĂNG KÝ */}
      <section id="dangky" className="band">
        <div className="wrap">
          <div className="eyebrow">Đăng ký</div>
          <h2>Xác nhận đăng ký lớp</h2>
          <p className="lead">Điền vài thông tin, thầy sẽ giữ chỗ và kích hoạt tài khoản app cho bạn.</p>
          <div className="panel">
            <div className="frm">
              <div><label>Họ và tên</label><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nguyễn Văn A" /></div>
              <div><label>Số điện thoại</label><input value={form.phone} onChange={e => set('phone', e.target.value)} type="tel" inputMode="tel" placeholder="09xx xxx xxx" /></div>
              <div><label>Zalo / Facebook đang dùng</label><input value={form.zalo} onChange={e => set('zalo', e.target.value)} placeholder="Số Zalo hoặc link FB" /></div>
              <div><label>Email (tạo tài khoản app)</label><input value={form.email} onChange={e => set('email', e.target.value)} type="email" placeholder="email@..." /></div>
              <div className="full"><label>Lớp muốn đăng ký</label>
                <select value={form.className} onChange={e => set('className', e.target.value)}>
                  {CLASSES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="full"><label>Ghi chú thêm (không bắt buộc)</label><textarea value={form.note} onChange={e => set('note', e.target.value)} rows={2} placeholder="Khung giờ rảnh, câu muốn hỏi thầy..." /></div>
              {formErr && <div className="full err">Bạn vui lòng nhập Họ tên, Số điện thoại và chọn lớp nhé.</div>}
              <div className="full"><button className="btn btn-primary" style={{ width: '100%' }} onClick={submitReg}>Xác nhận đăng ký lớp →</button></div>
            </div>
          </div>
        </div>
      </section>

      {/* THANH TOÁN (ẩn đến khi xác nhận) */}
      {showPay && (
        <section id="thanhtoan">
          <div className="wrap">
            <div className="eyebrow">Bước hoàn tất</div>
            <h2>Hoàn tất học phí để giữ chỗ</h2>
            <p className="lead">Sau khi thanh toán, tài khoản app TVA Guitar sẽ được kích hoạt và bạn được thêm vào nhóm lớp.</p>
            <div className="panel">
              <div className="pay-grid">
                <div className="ph qr-ph">Ảnh QR chuyển khoản<br />(thầy thả vào đây)</div>
                <div className="pay-info">
                  <div><span>Ngân hàng</span><span>[ Tên ngân hàng ]</span></div>
                  <div><span>Số tài khoản</span><span>[ Số TK ]</span></div>
                  <div><span>Chủ tài khoản</span><span>VAN ANH AUDIO</span></div>
                  <div><span>Số tiền</span><span className="price">990.000đ</span></div>
                  <div><span>Nội dung CK</span><span>TVA {form.name} {form.className}</span></div>
                </div>
              </div>
              <div className="pay-note">💡 Ghi đúng nội dung chuyển khoản giúp thầy kích hoạt tài khoản của bạn nhanh hơn.</div>
              {!okBox
                ? <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={() => setOkBox(true)}>Tôi đã chuyển khoản</button>
                : <div className="ok-box">
                    <h4>✓ Cảm ơn bạn đã đăng ký!</h4>
                    <p>Thầy sẽ kiểm tra và <b>kích hoạt tài khoản app</b> cho bạn, rồi thêm bạn vào <b>nhóm lớp</b>. Trong lúc chờ, bạn có thể tải app TVA Guitar để xem trước bài định hướng.</p>
                  </div>}
            </div>
          </div>
        </section>
      )}
      {sent && null}

      {/* SAU KHI THANH TOÁN */}
      <section className="band">
        <div className="wrap">
          <div className="eyebrow">Sau khi thanh toán</div>
          <h2>Bạn đã chính thức bước vào hành trình</h2>
          <div className="steps">
            {[['1', 'Giữ chỗ lớp', 'Chọn lớp & xác nhận thông tin.'], ['2', 'Hoàn tất học phí', 'Hệ thống kích hoạt tài khoản.'], ['3', 'Tải app TVA Guitar', 'Mở bài định hướng đầu tiên.'], ['4', 'Vào nhóm lớp', 'Chuẩn bị buổi học đầu cùng thầy.']].map(([n, h, p]) => (
              <div className="step" key={n}><div className="num">{n}</div><h4>{h}</h4><p>{p}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* APP */}
      <section>
        <div className="wrap">
          <div className="app-sec">
            <div className="app-grid">
              <div>
                <div className="eyebrow" style={{ color: '#A89FF0' }}>App TVA Guitar</div>
                <h2>Học, tập và theo dõi tiến độ — suốt hành trình</h2>
                <p className="lead">Không chỉ là nơi xem video. Đây là cổng học tập cá nhân đi cùng bạn từ buổi đầu.</p>
                <div className="app-feats">
                  {[['📚', 'Bài học chia nhỏ, có bài tập sau mỗi nội dung'], ['🎚️', 'Công cụ luyện tập: nhịp, tỉa nốt, chỉnh dây, karaoke'], ['📈', 'Nhật ký học tập & theo dõi tiến bộ của riêng bạn']].map(([ic, t], i) => (
                    <div className="app-feat" key={i}><span className="ic">{ic}</span><div>{t}</div></div>
                  ))}
                </div>
              </div>
              <div className="app-shots">
                <img className="shot" src="/app-khoahoc.png" alt="Màn hình Khoá học" />
                <img className="shot" src="/app-luyentap.png" alt="Màn hình Công cụ luyện tập" />
                <img className="shot" src="/app-tiendo.png" alt="Màn hình Tiến độ học tập" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* THẦY */}
      <section className="band-top">
        <div className="wrap teacher">
          <img className="t-photo" src="/thay-van-anh.png" alt="Thầy Văn Anh" />
          <div>
            <div className="eyebrow">Người dẫn đường</div>
            <h2>Học cùng Thầy Văn Anh</h2>
            <p className="lead">Nhiều năm giảng dạy guitar, xây dựng hệ thống bài học cho người mới và cộng đồng học viên online. Phương pháp: dễ hiểu, dễ làm theo, chia nhỏ, luyện đều, theo dõi tiến độ, sửa lỗi từng bước.</p>
            <div className="quote">"Tôi không dạy bạn trở nên cao siêu. Tôi giúp bạn làm chủ cây đàn một cách đơn giản nhất."</div>
            <p className="lead" style={{ marginTop: 14 }}>Hệ thống bài học được chia nhỏ để người mới dễ theo, dễ luyện và biết mình đang tiến bộ ở đâu.</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ background: '#fff', paddingTop: 0 }}>
        <div className="wrap">
          <div className="faq-list">
            <details><summary>Tôi chưa biết gì, có học được không?</summary><p>Được. Lộ trình Nhập môn được thiết kế cho người bắt đầu từ con số 0, đi chậm và chắc.</p></details>
            <details><summary>Tôi có cần mua đàn đắt tiền không?</summary><p>Không cần. Giai đoạn đầu chỉ cần một cây đàn phù hợp, dễ bấm và đúng âm.</p></details>
            <details><summary>Tôi học online có được sửa lỗi không?</summary><p>Có. Bạn học qua app, Zoom, nhóm lớp và gửi bài để thầy hướng dẫn thêm.</p></details>
          </div>
        </div>
      </section>

      {/* CTA cuối */}
      <section>
        <div className="wrap">
          <div className="final">
            <h2>Bắt đầu hành trình guitar của bạn hôm nay</h2>
            <p>Chọn lớp phù hợp và giữ chỗ ngay — thầy sẽ đồng hành cùng bạn từ buổi đầu tiên.</p>
            <button className="btn btn-primary" onClick={() => goto('lichlop')}>Xem lớp &amp; đăng ký</button>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap foot-in">
          <div><b>VAN ANH AUDIO</b> · TVA Guitar · vananhaudio.com</div>
          <div>Đăng ký qua Zalo thầy: <b>{ZALO}</b></div>
        </div>
      </footer>

      <button className="fab" onClick={() => goto('chat')}>💬 Tư vấn chọn lớp</button>

      {/* HÀNH TRÌNH 2027 — bài viết thiết kế native, full màn hình */}
      {showJourney && (
        <ClassJourney2027
          onClose={() => setShowJourney(false)}
          onRegister={() => { setShowJourney(false); setTimeout(() => goto('lichlop'), 60) }}
        />
      )}

      {showDemHat && (
        <ClassDemHat
          onClose={() => setShowDemHat(false)}
          onRegister={() => { setShowDemHat(false); setTimeout(() => goto('lichlop'), 60) }}
          onChat={() => { setShowDemHat(false); setTimeout(() => goto('chat'), 60) }}
        />
      )}

      {showTiaNot && (
        <ClassTiaNot
          onClose={() => setShowTiaNot(false)}
          onRegister={() => { setShowTiaNot(false); setTimeout(() => goto('lichlop'), 60) }}
          onChat={() => { setShowTiaNot(false); setTimeout(() => goto('chat'), 60) }}
        />
      )}

      {showQuiz && (
        <ClassQuiz
          onClose={() => setShowQuiz(false)}
          onRegister={() => { setShowQuiz(false); setTimeout(() => goto('lichlop'), 60) }}
          onChat={() => { setShowQuiz(false); setTimeout(() => goto('chat'), 60) }}
        />
      )}

      {/* BÀI VIẾT — mở full màn hình (dài, có ảnh) */}
      {modal?.startsWith('art:') && (() => {
        const a = articles[modal.slice(4)]
        return (
          <div className="art-page">
            <div className="art-top">
              <button className="art-close" onClick={() => setModal(null)}>← Quay lại</button>
              <button className="btn btn-primary art-top-cta" onClick={() => { setModal(null); setTimeout(() => goto('lichlop'), 60) }}>Xem lớp &amp; đăng ký →</button>
            </div>
            <div className="art-scroll">
              <div className="art-inner">
                {a ? <>
                  <h1 className="art-h1">{a.title}</h1>
                  <div className="art-body" dangerouslySetInnerHTML={{ __html: a.body }} />
                  <button className="btn btn-primary" style={{ marginTop: 28 }} onClick={() => { setModal(null); setTimeout(() => goto('lichlop'), 60) }}>Xem lớp &amp; đăng ký →</button>
                </> : <div>Bài viết không còn.</div>}
              </div>
            </div>
          </div>
        )
      })()}

      {/* POPUP NGẮN dùng chung (mô hình học / cam kết / bản đồ rút gọn) */}
      {modal && !modal.startsWith('art:') && (
        <div className="modal open" onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="modal-box">
            <button className="x" onClick={() => setModal(null)}>×</button>
            <div dangerouslySetInnerHTML={{ __html: MODALS[modal] ?? '' }} />
          </div>
        </div>
      )}
    </div>
  )
}

const CSS = `
.tva-class{--bg:#F2EEE7;--surface:#FFFFFF;--ink:#211C32;--ink-soft:#5A5470;--ink-faint:#8A8499;--indigo:#4338CA;--indigo-dark:#352BA3;--indigo-tint:#EEEBFB;--honey:#C9711E;--honey-tint:#FBF1E4;--line:#E4DED4;--online:#16A34A;--orange:#EE7D3C;font-family:'Be Vietnam Pro',system-ui,sans-serif;background:var(--bg);color:var(--ink);line-height:1.55;font-size:16px;min-height:100vh;}
.tva-class *{box-sizing:border-box;}
.tva-class .wrap{max-width:1080px;margin:0 auto;padding:0 20px;}
.tva-class section{padding:58px 0;}
.tva-class .band{background:#fff;border-top:1px solid var(--line);border-bottom:1px solid var(--line);}
.tva-class .band-top{background:#fff;border-top:1px solid var(--line);}
.tva-class h2{font-size:30px;font-weight:800;line-height:1.15;letter-spacing:-.5px;}
.tva-class .eyebrow{font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--honey);margin-bottom:10px;}
.tva-class .lead{color:var(--ink-soft);font-size:16.5px;max-width:640px;margin-top:12px;}
.tva-class .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:600;font-size:15px;border-radius:12px;padding:13px 22px;cursor:pointer;border:none;font-family:inherit;text-decoration:none;transition:all .15s;}
.tva-class .btn-primary{background:var(--indigo);color:#fff;}
.tva-class .btn-primary:hover{background:var(--indigo-dark);}
.tva-class .btn-ghost{background:transparent;color:var(--indigo);border:1.5px solid #D3CEE8;}
.tva-class .btn-ghost:hover{background:var(--indigo-tint);}
.tva-class .ph{border:2px dashed #CFC9DA;border-radius:14px;display:flex;align-items:center;justify-content:center;text-align:center;color:var(--ink-faint);font-size:12.5px;font-weight:600;padding:14px;background:#FBFAF7;}
.tva-class nav{position:sticky;top:0;z-index:40;background:rgba(242,238,231,.9);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);}
.tva-class .nav-in{display:flex;align-items:center;justify-content:space-between;height:62px;}
.tva-class .brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:16px;}
.tva-class .brand .mark{width:36px;height:36px;border-radius:9px;object-fit:contain;display:block;}
.tva-class .nav-links{display:flex;gap:22px;font-size:14.5px;font-weight:500;}
.tva-class .nav-links a{color:var(--ink-soft);text-decoration:none;cursor:pointer;}
.tva-class .nav-links a:hover{color:var(--indigo);}
.tva-class .nav-cta{font-size:14px;padding:9px 16px;}
@media(max-width:860px){.tva-class .nav-links{display:none;}}
.tva-class .hero{padding:60px 0 46px;}
.tva-class .hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:44px;align-items:center;}
.tva-class .hero h1{font-size:42px;font-weight:800;line-height:1.1;letter-spacing:-1px;}
.tva-class .hero h1 .hl{color:var(--indigo);}
.tva-class .hero p{margin-top:18px;color:var(--ink-soft);font-size:17px;max-width:500px;}
.tva-class .hero-cta{display:flex;gap:12px;margin-top:28px;flex-wrap:wrap;}
.tva-class .hero-art{background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:26px;box-shadow:0 20px 50px -24px rgba(33,28,50,.25);}
.tva-class .hero-art h3{margin:0 0 6px;font-size:18px;font-weight:700;}
.tva-class .hero-art p{font-size:14px;color:var(--ink-soft);}
.tva-class .hero-stats{display:flex;gap:22px;margin-top:18px;border-top:1px solid var(--line);padding-top:16px;}
.tva-class .hero-stats div b{display:block;font-size:22px;font-weight:800;color:var(--indigo);}
.tva-class .hero-stats div span{font-size:12px;color:var(--ink-faint);}
@media(max-width:860px){.tva-class .hero-grid{grid-template-columns:1fr;gap:28px;}.tva-class .hero h1{font-size:32px;}}
.tva-class .doors{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:26px;}
.tva-class .door{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:20px;display:flex;flex-direction:column;}
.tva-class .door .dq{font-size:16.5px;font-weight:700;line-height:1.3;}
.tva-class .door .dbadge{font-size:11.5px;font-weight:700;color:var(--honey);background:var(--honey-tint);padding:3px 9px;border-radius:6px;align-self:flex-start;margin:9px 0 10px;}
.tva-class .door p{font-size:13.5px;color:var(--ink-soft);flex:1;margin-bottom:14px;line-height:1.45;}
.tva-class .door .btn{font-size:13.5px;padding:10px;}
.tva-class .map-hint{margin-top:24px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;background:#FAF8F4;border:1px dashed var(--line);border-radius:14px;padding:16px 18px;font-size:14px;color:var(--ink-soft);}
@media(max-width:860px){.tva-class .doors{grid-template-columns:1fr;}}
.tva-class .worries{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:28px;}
.tva-class .worry{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:18px;display:flex;flex-direction:column;}
.tva-class .worry h3{font-size:15.5px;font-weight:700;line-height:1.3;}
.tva-class .worry p{font-size:13.5px;color:var(--ink-soft);margin:8px 0 14px;flex:1;}
.tva-class .worry .askline{font-size:13px;font-weight:600;color:var(--ink-faint);margin-top:10px;cursor:pointer;}
.tva-class .worry .askline:hover{color:var(--indigo);}
.tva-class .worry .soon{font-size:11.5px;color:var(--honey);background:var(--honey-tint);border-radius:6px;padding:5px 9px;margin-top:10px;}
@media(max-width:860px){.tva-class .worries{grid-template-columns:1fr;}}
.tva-class .chat-sec{background:linear-gradient(180deg,#fff,#FAF8F4);border-top:1px solid var(--line);border-bottom:1px solid var(--line);}
.tva-class .chat-grid{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center;}
.tva-class .chat-card{background:var(--surface);border:1px solid var(--line);border-radius:20px;box-shadow:0 18px 44px -22px rgba(33,28,50,.22);overflow:hidden;display:flex;flex-direction:column;height:470px;}
.tva-class .cc-head{display:flex;align-items:center;gap:11px;padding:14px 16px;border-bottom:1px solid var(--line);}
.tva-class .cc-head .av{width:40px;height:40px;border-radius:50%;background:linear-gradient(150deg,var(--indigo),#6D63E6);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;position:relative;flex-shrink:0;}
.tva-class .cc-head .av .dot{position:absolute;right:0;bottom:1px;width:10px;height:10px;border-radius:50%;background:var(--online);border:2px solid #fff;}
.tva-class .cc-head h4{font-size:14.5px;font-weight:700;}.tva-class .cc-head p{font-size:12px;color:var(--ink-soft);}.tva-class .cc-head p b{color:var(--online);}
.tva-class .cc-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;}
.tva-class .msg{max-width:84%;padding:10px 13px;font-size:14px;line-height:1.5;border-radius:14px;}
.tva-class .msg.ai{background:#F4F2EE;border-bottom-left-radius:4px;align-self:flex-start;}
.tva-class .msg.me{background:var(--indigo);color:#fff;border-bottom-right-radius:4px;align-self:flex-end;}
.tva-class .cc-foot{border-top:1px solid var(--line);padding:11px 13px;}
.tva-class .cc-chips{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:9px;}
.tva-class .cc-chip{border:1.4px solid #D8D2E6;background:#fff;color:var(--ink);padding:7px 12px;border-radius:999px;font-size:12.5px;font-weight:500;cursor:pointer;font-family:inherit;}
.tva-class .cc-chip:hover{border-color:var(--indigo);background:var(--indigo-tint);color:var(--indigo-dark);}
.tva-class .cc-input{display:flex;gap:8px;}
.tva-class .cc-input input{flex:1;border:1.4px solid var(--line);background:#F7F5F1;border-radius:10px;padding:10px 12px;font-family:inherit;font-size:14px;}
.tva-class .cc-input input:focus{outline:none;border-color:var(--indigo);background:#fff;}
.tva-class .cc-input button{background:var(--indigo);color:#fff;border:none;border-radius:10px;padding:0 15px;font-weight:600;cursor:pointer;font-family:inherit;}
@media(max-width:860px){.tva-class .chat-grid{grid-template-columns:1fr;gap:24px;}.tva-class .chat-card{height:440px;}}
.tva-class .cls-list{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:28px;}
.tva-class .cls-item{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:18px;display:flex;flex-direction:column;}
.tva-class .cls-item .tag{font-size:11px;font-weight:700;color:var(--honey);background:var(--honey-tint);display:inline-block;padding:3px 9px;border-radius:6px;align-self:flex-start;}
.tva-class .cls-item h3{font-size:16px;font-weight:700;margin:10px 0 8px;line-height:1.3;}
.tva-class .cls-item .meta{font-size:13.5px;color:var(--ink-soft);display:flex;flex-direction:column;gap:3px;margin-bottom:14px;}
.tva-class .cls-item .meta b{color:var(--indigo);}
.tva-class .cls-item .price{font-weight:800;color:var(--honey);}
.tva-class .cls-item .acts{margin-top:auto;display:flex;gap:8px;}
.tva-class .cls-item .acts .btn{flex:1;font-size:13.5px;padding:10px;}
@media(max-width:860px){.tva-class .cls-list{grid-template-columns:1fr;}}
.tva-class .benefits{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:26px;}
.tva-class .bf{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px;display:flex;gap:12px;align-items:flex-start;font-size:14.5px;line-height:1.4;}
.tva-class .bf .bi{font-size:20px;flex-shrink:0;}
.tva-class .tuition{margin-top:22px;font-size:18px;font-weight:600;color:var(--ink-soft);}
.tva-class .tuition b{color:var(--honey);font-size:24px;font-weight:800;}
@media(max-width:860px){.tva-class .benefits{grid-template-columns:1fr;}}
.tva-class .panel{background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:26px;margin-top:26px;max-width:640px;}
.tva-class .frm{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.tva-class .frm .full{grid-column:1/-1;}
.tva-class .frm label{font-size:12.5px;font-weight:600;color:var(--ink-soft);display:block;margin-bottom:5px;}
.tva-class .frm input,.tva-class .frm select,.tva-class .frm textarea{width:100%;font-family:inherit;font-size:14.5px;color:var(--ink);background:#F7F5F1;border:1.5px solid var(--line);border-radius:11px;padding:11px 13px;resize:none;}
.tva-class .frm input:focus,.tva-class .frm select:focus,.tva-class .frm textarea:focus{outline:none;border-color:var(--indigo);background:#fff;}
.tva-class .frm .err{color:#B91C1C;font-size:13px;font-weight:600;}
@media(max-width:560px){.tva-class .frm{grid-template-columns:1fr;}}
.tva-class .pay-grid{display:grid;grid-template-columns:200px 1fr;gap:20px;align-items:center;}
.tva-class .qr-ph{height:180px;}
.tva-class .pay-info div{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--line);font-size:14px;}
.tva-class .pay-info div span:first-child{color:var(--ink-soft);}
.tva-class .pay-info div span:last-child{font-weight:600;}
.tva-class .pay-info .price{color:var(--honey);}
.tva-class .pay-note{margin-top:14px;font-size:13px;color:var(--ink-soft);background:var(--honey-tint);border-radius:10px;padding:11px 14px;}
.tva-class .ok-box{margin-top:16px;background:#EAF7EE;border:1px solid #BFE6CC;border-radius:13px;padding:16px;}
.tva-class .ok-box h4{color:var(--green-d,#2E7D32);font-size:16px;font-weight:700;margin-bottom:6px;}
.tva-class .ok-box p{font-size:14px;color:var(--ink-soft);}
@media(max-width:560px){.tva-class .pay-grid{grid-template-columns:1fr;}}
.tva-class .steps{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:26px;}
.tva-class .step{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:18px;}
.tva-class .step .num{width:30px;height:30px;border-radius:9px;background:var(--indigo-tint);color:var(--indigo);font-weight:800;display:flex;align-items:center;justify-content:center;margin-bottom:10px;}
.tva-class .step h4{font-size:14.5px;font-weight:700;}
.tva-class .step p{font-size:13px;color:var(--ink-soft);margin-top:4px;}
@media(max-width:860px){.tva-class .steps{grid-template-columns:1fr 1fr;}}
.tva-class .app-sec{background:linear-gradient(160deg,#2A2440,#211C32);border-radius:24px;padding:38px;color:#fff;}
.tva-class .app-grid{display:grid;grid-template-columns:1fr 1fr;gap:34px;align-items:center;}
.tva-class .app-sec h2{color:#fff;}.tva-class .app-sec .lead{color:#C9C3DE;}
.tva-class .app-feats{margin-top:20px;display:flex;flex-direction:column;gap:12px;}
.tva-class .app-feat{display:flex;gap:12px;align-items:flex-start;font-size:14.5px;color:#E6E2F2;}
.tva-class .app-feat .ic{font-size:20px;}
.tva-class .app-shots{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
.tva-class img.shot{width:100%;display:block;border-radius:14px;border:1px solid rgba(255,255,255,.12);box-shadow:0 10px 30px -12px rgba(0,0,0,.5);}
@media(max-width:860px){.tva-class .app-grid{grid-template-columns:1fr;gap:24px;}}
.tva-class .teacher{display:grid;grid-template-columns:280px 1fr;gap:34px;align-items:center;}
.tva-class img.t-photo{width:100%;height:380px;object-fit:contain;object-position:center bottom;border-radius:18px;background:linear-gradient(160deg,#FBF1E4,#F2EEE7);display:block;}
.tva-class .quote{margin-top:18px;font-size:16px;font-style:italic;color:var(--ink);border-left:3px solid var(--honey);padding-left:16px;}
@media(max-width:860px){.tva-class .teacher{grid-template-columns:1fr;}.tva-class .t-photo{height:220px;}}
.tva-class .faq-list{display:flex;flex-direction:column;gap:10px;max-width:760px;}
.tva-class .faq-list details{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px 18px;}
.tva-class .faq-list summary{font-weight:600;font-size:15px;cursor:pointer;}
.tva-class .faq-list p{margin-top:10px;font-size:14px;color:var(--ink-soft);}
.tva-class .final{background:linear-gradient(150deg,var(--indigo),#6D63E6);border-radius:22px;padding:44px;text-align:center;color:#fff;}
.tva-class .final h2{color:#fff;}
.tva-class .final p{margin:12px auto 22px;max-width:480px;color:#E6E2F2;}
.tva-class .final .btn-primary{background:#fff;color:var(--indigo);}
.tva-class footer{background:#211C32;color:#C9C3DE;padding:26px 0;font-size:13.5px;}
.tva-class .foot-in{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;}
.tva-class .foot-in b{color:#fff;}
.tva-class .fab{position:fixed;right:18px;bottom:18px;z-index:50;background:var(--indigo);color:#fff;border:none;border-radius:999px;padding:13px 18px;font-weight:600;font-size:14px;cursor:pointer;font-family:inherit;box-shadow:0 10px 26px -8px rgba(67,56,202,.6);}
.tva-class .modal{position:fixed;inset:0;z-index:100;background:rgba(20,16,32,.55);display:flex;align-items:center;justify-content:center;padding:20px;}
.tva-class .modal-box{background:var(--surface);border-radius:20px;padding:28px;max-width:620px;width:100%;max-height:86vh;overflow-y:auto;position:relative;}
.tva-class .modal-box.wide{max-width:760px;padding:32px 36px;}
.tva-class .modal-box.wide h3{font-size:24px;line-height:1.25;}
.tva-class .modal-box .x{position:absolute;right:16px;top:14px;border:none;background:#F1EFF9;width:32px;height:32px;border-radius:9px;font-size:18px;cursor:pointer;color:var(--ink-soft);}
.tva-class .modal-box h3{font-size:20px;font-weight:800;}
.tva-class .mh-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px;}
.tva-class .mh-card{border:1px solid var(--line);border-radius:13px;padding:14px;}
.tva-class .mh-card .mh-ph{height:88px;border-radius:9px;margin-bottom:10px;border:2px dashed #CFC9DA;display:flex;align-items:center;justify-content:center;text-align:center;color:var(--ink-faint);font-size:11px;font-weight:600;background:#FBFAF7;}
.tva-class .mh-card h4{font-size:14px;font-weight:700;}.tva-class .mh-card p{font-size:12.5px;color:var(--ink-soft);margin-top:3px;}
.tva-class .ck-table{width:100%;border-collapse:collapse;margin-top:14px;}
.tva-class .ck-table td{padding:11px 12px;border-bottom:1px solid var(--line);vertical-align:top;font-size:14px;}
.tva-class .ck-table td:first-child{color:var(--ink-soft);width:42%;}
.tva-class .ck-table td:last-child{font-weight:600;}
.tva-class .bando{margin-top:16px;display:flex;flex-direction:column;gap:10px;}
.tva-class .bando .b-row{font-size:14px;color:var(--ink-soft);}
.tva-class .bando .b-node{display:inline-block;padding:6px 12px;border-radius:9px;font-weight:700;color:#fff;}
.tva-class .bando .b-free{background:var(--orange);}
.tva-class .bando .b-branch{display:inline-block;min-width:74px;font-weight:800;color:var(--indigo);}
.tva-class .bando .b-converge{font-weight:700;color:var(--honey);}
@media(max-width:560px){.tva-class .mh-grid{grid-template-columns:1fr;}}
.tva-class .art-page{position:fixed;inset:0;z-index:120;background:var(--bg);display:flex;flex-direction:column;}
.tva-class .art-top{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 20px;background:rgba(242,238,231,.92);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);}
.tva-class .art-close{border:1.5px solid #D3CEE8;background:#fff;color:var(--indigo);border-radius:10px;padding:9px 16px;font-weight:600;font-size:14px;cursor:pointer;font-family:inherit;}
.tva-class .art-close:hover{background:var(--indigo-tint);}
.tva-class .art-top-cta{font-size:14px;padding:9px 16px;}
.tva-class .art-scroll{flex:1;overflow-y:auto;}
.tva-class .art-inner{max-width:760px;margin:0 auto;padding:32px 22px 64px;}
.tva-class .art-h1{font-size:30px;font-weight:800;line-height:1.2;letter-spacing:-.5px;margin-bottom:18px;color:var(--ink);}
@media(max-width:560px){.tva-class .art-h1{font-size:24px;}.tva-class .art-top-cta{display:none;}}
.tva-class .art-body{font-size:16px;line-height:1.8;color:var(--ink-soft);}
.tva-class .art-body p{margin:0 0 12px;}
.tva-class .art-body h2,.tva-class .art-body h3{color:var(--ink);margin:16px 0 8px;}
.tva-class .art-body ul,.tva-class .art-body ol{margin:0 0 12px;padding-left:20px;}
.tva-class .art-body img{max-width:100%;border-radius:10px;margin:8px 0;}
.tva-class .art-body b,.tva-class .art-body strong{color:var(--ink);}
`
