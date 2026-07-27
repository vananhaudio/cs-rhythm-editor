// ── 1001 Câu chuyện cùng Guitar — Landing Page (/story) ──
// Trang con của class.vananhaudio.com. Spec: ~/App/1001 câu chuyện/PROJECT_CONTEXT.md
// MVP V1: trang tĩnh, chưa có database. CTA gửi bài tạm qua Zalo (form /story/submit làm sau).

const ZALO_LINK = 'https://zalo.me/vananhguitarist'

const WHY = [
  {
    icon: '📔',
    t: 'Lưu giữ',
    d: 'Những kỷ niệm cùng cây đàn rất dễ trôi mất theo thời gian. Viết lại là cách giữ chúng ở lại — cho chính bạn, và cho những người đến sau.',
  },
  {
    icon: '🤝',
    t: 'Nâng đỡ',
    d: 'Một người đang chững lại, định bỏ cuộc, có thể đọc được câu chuyện của bạn và quyết định tập thêm một ngày nữa. Thế là đủ.',
  },
  {
    icon: '✨',
    t: 'Truyền cảm hứng',
    d: '1001 câu chuyện là 1001 lý do có thật để một ai đó cầm đàn lên — hoặc quay lại với cây đàn đã phủ bụi.',
  },
]

const WHO = [
  { t: 'Người mới học đàn', d: 'Những bỡ ngỡ, đau tay, và niềm vui bấm được hợp âm đầu tiên.' },
  { t: 'Người chơi lâu năm', d: 'Cây đàn đã đi cùng bạn qua những chặng nào của cuộc đời?' },
  { t: 'Người từng bỏ dở', d: 'Vì sao dừng lại — và điều gì khiến bạn (muốn) quay lại?' },
  { t: 'Phụ huynh', d: 'Câu chuyện của con và cây đàn, dưới góc nhìn của cha mẹ.' },
  { t: 'Giáo viên guitar', d: 'Những học trò và khoảnh khắc khiến bạn nhớ mãi.' },
  { t: 'Bất kỳ ai', d: 'Chỉ cần có một kỷ niệm thật với cây đàn guitar.' },
]

const TOPICS = [
  'Cây đàn đầu tiên',
  'Bài hát thay đổi tôi',
  'Guitar và tuổi thơ',
  'Vượt qua giai đoạn khó khăn',
  'Guitar trong gia đình',
  'Người thầy đầu tiên',
  'Đau tay và chai sạn',
  'Lần đầu đàn trước mọi người',
  'Bỏ dở rồi quay lại',
  'Cây đàn và người thân',
]

const STEPS = [
  { n: '1', t: 'Viết', d: 'Kể tự nhiên như đang trò chuyện. Không cần văn hay — chỉ cần thật.' },
  { n: '2', t: 'Gửi', d: 'Gửi câu chuyện về dự án, kèm tên hoặc bút danh và địa phương của bạn.' },
  { n: '3', t: 'Duyệt', d: 'Thầy Văn Anh đọc từng câu chuyện trước khi xuất bản — để nơi này luôn là những câu chuyện thật.' },
  { n: '4', t: 'Xuất bản', d: 'Câu chuyện của bạn vào thư viện, để cộng đồng cùng đọc và sẻ chia.' },
]

export default function StoryLandingPage() {
  const goto = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div className="tva-story">
      <style>{CSS}</style>

      <nav>
        <div className="wrap nav-in">
          <div className="brand">
            <img className="mark" src="/logo-green.svg" alt="Thầy Văn Anh Guitar" />
            1001 Câu chuyện cùng Guitar
          </div>
          <div className="nav-links">
            <a onClick={() => goto('loi-ngo')}>Lời ngỏ</a>
            <a onClick={() => goto('vi-sao')}>Vì sao</a>
            <a onClick={() => goto('chu-de')}>Chủ đề</a>
            <a onClick={() => goto('quy-trinh')}>Quy trình</a>
          </div>
          <button className="btn btn-primary nav-cta" onClick={() => { window.location.href = '/story/tell' }}>Kể câu chuyện</button>
        </div>
      </nav>

      {/* HERO */}
      <header className="hero">
        <div className="wrap hero-grid">
          <div>
            <div className="eyebrow">Dự án cộng đồng · Thầy Văn Anh Guitar</div>
            <h1>1001 <span className="hl">Câu chuyện</span> cùng Guitar</h1>
            <blockquote className="motto">“Nếu câu chuyện của bạn giúp được một người khác, hãy kể lại nhé.”</blockquote>
            <p>
              Nơi lưu giữ những câu chuyện thật của những người yêu guitar.
              Không phải mạng xã hội. Không phải cuộc thi. Chỉ là những câu chuyện thật — được kể lại và giữ gìn.
            </p>
            <div className="hero-cta">
              <button className="btn btn-primary" onClick={() => { window.location.href = '/story/tell' }}>Tôi muốn kể câu chuyện của mình</button>
              <button className="btn btn-ghost" onClick={() => goto('loi-ngo')}>Đọc lời ngỏ</button>
            </div>
          </div>
          <div className="hero-art">
            <div className="story-card">
              <div className="sc-topic">Cây đàn đầu tiên</div>
              <h3>Cây đàn 800 nghìn của bố</h3>
              <p>
                “Năm lớp 9, bố mua cho tôi cây đàn cũ ở tiệm cầm đồ. Action cao, dây rỉ,
                nhưng tối nào tôi cũng ôm nó đến khi ngón tay hằn vết dây đàn.
                Hai mươi năm sau, tôi vẫn giữ nó — và giờ con gái tôi đang tập trên chính cây đàn ấy…”
              </p>
              <div className="sc-by">— Một người yêu guitar, Hà Nội</div>
            </div>
            <div className="hero-stats">
              <div><b>1001</b><span>câu chuyện là đích đến</span></div>
              <div><b>1</b><span>câu chuyện thật của bạn là khởi đầu</span></div>
            </div>
          </div>
        </div>
      </header>

      {/* LỜI NGỎ */}
      <section id="loi-ngo" className="band">
        <div className="wrap letter-wrap">
          <div className="eyebrow">Lời ngỏ</div>
          <h2>Gửi bạn — người đang giữ một câu chuyện</h2>
          <div className="letter">
            <p>
              Hơn hai mươi năm dạy đàn, điều tôi nhớ nhất không phải là những bản nhạc,
              mà là những câu chuyện. Cậu học trò tập đàn để hát tặng mẹ. Người cha ngoài năm mươi
              học lại từ đầu vì lời hứa thời trẻ. Cô bé rụt rè dần tự tin lên sau từng buổi tập.
            </p>
            <p>
              Những câu chuyện ấy quý lắm — nhưng nếu không ai kể lại, chúng sẽ lặng lẽ trôi đi.
              Vì thế dự án này ra đời: một nơi để <b>1001 câu chuyện thật</b> của những người yêu guitar
              được viết xuống, giữ gìn, và trao lại cho những người đến sau.
            </p>
            <p>
              Bạn không cần viết hay. Chỉ cần viết thật. Nếu câu chuyện của bạn giúp được
              một người khác — dù chỉ một người — thì nó xứng đáng được kể lại.
            </p>
            <div className="sign">Thầy Văn Anh</div>
          </div>
        </div>
      </section>

      {/* VÌ SAO CÓ DỰ ÁN */}
      <section id="vi-sao">
        <div className="wrap">
          <div className="eyebrow">Vì sao có dự án này</div>
          <h2>Một câu chuyện thật có thể làm được nhiều điều</h2>
          <div className="cards3">
            {WHY.map((w, i) => (
              <div className="card" key={i}>
                <div className="ic">{w.icon}</div>
                <h3>{w.t}</h3>
                <p>{w.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI CÓ THỂ THAM GIA */}
      <section id="ai-tham-gia" className="band">
        <div className="wrap">
          <div className="eyebrow">Ai có thể tham gia</div>
          <h2>Nếu bạn có một kỷ niệm cùng cây đàn — bạn có một câu chuyện</h2>
          <div className="cards3 who">
            {WHO.map((w, i) => (
              <div className="card" key={i}>
                <h3>{w.t}</h3>
                <p>{w.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GỢI Ý CHỦ ĐỀ */}
      <section id="chu-de">
        <div className="wrap">
          <div className="eyebrow">Gợi ý chủ đề</div>
          <h2>Chưa biết kể gì? Bắt đầu từ một trong những chủ đề này</h2>
          <p className="lead">Đây chỉ là gợi ý — câu chuyện của bạn có thể là bất cứ điều gì thật sự đã xảy ra cùng cây đàn.</p>
          <div className="topics">
            {TOPICS.map((t, i) => <span className="topic" key={i}>{t}</span>)}
          </div>
        </div>
      </section>

      {/* QUY TRÌNH */}
      <section id="quy-trinh" className="band">
        <div className="wrap">
          <div className="eyebrow">Quy trình</div>
          <h2>Từ kỷ niệm của bạn đến thư viện chung — 4 bước</h2>
          <div className="steps">
            {STEPS.map((s, i) => (
              <div className="step" key={i}>
                <div className="sn">{s.n}</div>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
          <p className="note">Câu chuyện luôn thuộc về bạn. Dự án chỉ giúp lưu giữ và lan tỏa — bạn có thể dùng tên thật hoặc bút danh.</p>
        </div>
      </section>

      {/* CTA CUỐI */}
      <section id="ke-chuyen" className="cta-sec">
        <div className="wrap cta-in">
          <h2>Câu chuyện của bạn có thể là điều ai đó đang cần</h2>
          <p>
            Bạn không cần biết viết — Mira sẽ trò chuyện cùng bạn, đặt câu hỏi,
            gợi nhớ kỷ niệm, rồi viết lại thành bài hoàn chỉnh. Bạn chỉ cần kể.
          </p>
          <a className="btn btn-light" href="/story/tell">🌿 Kể cùng Mira ngay</a>
          <div className="cta-alt">hoặc <a href={ZALO_LINK} target="_blank" rel="noreferrer">gửi câu chuyện qua Zalo cho thầy Văn Anh</a></div>
        </div>
      </section>

      <footer>
        <div className="wrap foot-in">
          <div>1001 Câu chuyện cùng Guitar — một dự án của <b>Thầy Văn Anh Guitar</b></div>
          <a href="/class">← Về trang lớp học</a>
        </div>
      </footer>
    </div>
  )
}

const CSS = `
.tva-story{--bg:#F2EEE7;--surface:#FFFFFF;--ink:#211C32;--ink-soft:#5A5470;--ink-faint:#8A8499;--indigo:#4338CA;--indigo-dark:#352BA3;--indigo-tint:#EEEBFB;--honey:#C9711E;--honey-tint:#FBF1E4;--line:#E4DED4;font-family:'Be Vietnam Pro',system-ui,sans-serif;background:var(--bg);color:var(--ink);line-height:1.55;font-size:16px;min-height:100vh;text-align:left;color-scheme:light;}
.tva-story *{box-sizing:border-box;}
.tva-story .wrap{max-width:1080px;margin:0 auto;padding:0 20px;}
.tva-story section{padding:58px 0;}
.tva-story .band{background:#fff;border-top:1px solid var(--line);border-bottom:1px solid var(--line);}
.tva-story h1,.tva-story h2,.tva-story h3{color:var(--ink);margin:0;}
.tva-story h2{font-size:30px;font-weight:800;line-height:1.15;letter-spacing:-.5px;}
.tva-story .eyebrow{font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--honey);margin-bottom:10px;}
.tva-story .lead{color:var(--ink-soft);font-size:16.5px;max-width:640px;margin-top:12px;}
.tva-story .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:600;font-size:15px;border-radius:12px;padding:13px 22px;cursor:pointer;border:none;font-family:inherit;text-decoration:none;transition:all .15s;}
.tva-story .btn-primary{background:var(--indigo);color:#fff;}
.tva-story .btn-primary:hover{background:var(--indigo-dark);}
.tva-story .btn-ghost{background:transparent;color:var(--indigo);border:1.5px solid #D3CEE8;}
.tva-story .btn-ghost:hover{background:var(--indigo-tint);}
.tva-story nav{position:sticky;top:0;z-index:40;background:rgba(242,238,231,.9);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);}
.tva-story .nav-in{display:flex;align-items:center;justify-content:space-between;height:62px;gap:12px;}
.tva-story .brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:15px;}
.tva-story .brand .mark{width:34px;height:34px;border-radius:9px;object-fit:contain;display:block;}
.tva-story .nav-links{display:flex;gap:22px;font-size:14.5px;font-weight:500;}
.tva-story .nav-links a{color:var(--ink-soft);text-decoration:none;cursor:pointer;}
.tva-story .nav-links a:hover{color:var(--indigo);}
.tva-story .nav-cta{font-size:14px;padding:9px 16px;white-space:nowrap;}
@media(max-width:860px){.tva-story .nav-links{display:none;}}
.tva-story .hero{padding:60px 0 46px;}
.tva-story .hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:44px;align-items:center;}
.tva-story .hero h1{font-size:42px;font-weight:800;line-height:1.1;letter-spacing:-1px;}
.tva-story .hero h1 .hl{color:var(--indigo);}
.tva-story .motto{margin:18px 0 0;padding:10px 0 10px 16px;border-left:3px solid var(--honey);color:var(--honey);font-size:17px;font-weight:600;font-style:italic;}
.tva-story .hero p{margin-top:16px;color:var(--ink-soft);font-size:17px;max-width:500px;}
.tva-story .hero-cta{display:flex;gap:12px;margin-top:28px;flex-wrap:wrap;}
.tva-story .hero-art{background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:26px;box-shadow:0 20px 50px -24px rgba(33,28,50,.25);}
.tva-story .story-card .sc-topic{display:inline-block;font-size:11.5px;font-weight:700;color:var(--honey);background:var(--honey-tint);padding:3px 9px;border-radius:6px;margin-bottom:10px;}
.tva-story .story-card h3{font-size:18px;font-weight:700;margin-bottom:8px;}
.tva-story .story-card p{font-size:14px;color:var(--ink-soft);font-style:italic;margin:0;}
.tva-story .story-card .sc-by{font-size:12.5px;color:var(--ink-faint);margin-top:10px;}
.tva-story .hero-stats{display:flex;gap:22px;margin-top:18px;border-top:1px solid var(--line);padding-top:16px;}
.tva-story .hero-stats div b{display:block;font-size:22px;font-weight:800;color:var(--indigo);}
.tva-story .hero-stats div span{font-size:12px;color:var(--ink-faint);}
@media(max-width:860px){.tva-story .hero-grid{grid-template-columns:1fr;gap:28px;}.tva-story .hero h1{font-size:32px;}}
.tva-story .letter-wrap{max-width:720px;}
.tva-story .letter{margin-top:18px;}
.tva-story .letter p{color:var(--ink-soft);font-size:16.5px;margin:0 0 16px;}
.tva-story .letter .sign{font-family:Lora,Georgia,serif;font-style:italic;font-size:20px;font-weight:600;color:var(--ink);margin-top:22px;}
.tva-story .cards3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:26px;}
.tva-story .card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:22px;}
.tva-story .band .card{background:var(--bg);}
.tva-story .card .ic{font-size:26px;margin-bottom:10px;}
.tva-story .card h3{font-size:16.5px;font-weight:700;margin-bottom:8px;}
.tva-story .card p{font-size:13.5px;color:var(--ink-soft);margin:0;line-height:1.5;}
@media(max-width:860px){.tva-story .cards3{grid-template-columns:1fr;}}
@media(min-width:861px){.tva-story .who{grid-template-columns:repeat(3,1fr);}}
.tva-story .topics{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px;}
.tva-story .topic{background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:9px 18px;font-size:14.5px;font-weight:600;color:var(--ink-soft);}
.tva-story .steps{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:26px;}
.tva-story .step{background:var(--bg);border:1px solid var(--line);border-radius:16px;padding:20px;}
.tva-story .step .sn{width:32px;height:32px;border-radius:999px;background:var(--indigo);color:#fff;font-weight:800;font-size:15px;display:flex;align-items:center;justify-content:center;margin-bottom:12px;}
.tva-story .step h3{font-size:16px;font-weight:700;margin-bottom:6px;}
.tva-story .step p{font-size:13.5px;color:var(--ink-soft);margin:0;line-height:1.5;}
@media(max-width:860px){.tva-story .steps{grid-template-columns:1fr 1fr;}}
.tva-story .note{margin-top:20px;font-size:13.5px;color:var(--ink-faint);}
.tva-story .cta-sec{background:var(--indigo);}
.tva-story .cta-in{text-align:center;max-width:640px;}
.tva-story .cta-sec h2{color:#fff;}
.tva-story .cta-sec p{color:#D8D4F5;font-size:16px;margin:16px 0 26px;}
.tva-story .btn-light{background:#fff;color:var(--indigo);font-weight:700;}
.tva-story .cta-alt{margin-top:14px;font-size:13.5px;color:#B9B3E8;}
.tva-story .cta-alt a{color:#fff;text-decoration:underline;}
.tva-story footer{padding:26px 0;background:var(--bg);}
.tva-story .foot-in{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;font-size:13.5px;color:var(--ink-faint);}
.tva-story footer a{color:var(--indigo);text-decoration:none;font-weight:600;}
`
