// ClassNangCao — bài "Tôi đã biết chơi, nhưng muốn tiến xa hơn" (nút 3).
// Dẫn dắt người đã học: chẩn đoán đang kẹt ở đâu → bản đồ các chặng → mở Hành Trình 2027.
const P = {
  bg: '#F2EEE7', surface: '#FFFFFF', ink: '#211C32', soft: '#5A5470', faint: '#8A8499',
  honey: '#C9711E', honeyTint: '#FBF1E4', terra: '#A8542A', line: '#E4DED4', indigo: '#4338CA',
  green: '#2E7D32', gold: '#E8B96B',
}
const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif"

const PIECES = [
  ['Tab', 'Bài nào có tab thì chơi được. Nhưng sang bài mới lại bắt đầu từ đầu.'],
  ['Hợp âm', 'Biết khá nhiều thế bấm. Nhưng phần đệm vẫn đều đều, thiếu bố cục.'],
  ['Điệu', 'Biết Ballad, Slow, Valse… Nhưng không chắc bài nào dùng điệu nào.'],
  ['Kỹ thuật', 'Biết vài câu chạy ngón, vài đoạn solo. Nhưng ghép vào bài hát vẫn rời rạc.'],
]
const ROUTES = [
  { eb: 'Nếu bạn kẹt ở phần đệm hát', title: 'Đệm Hát 2 — Tiết tấu, điệu và bố cục', c: P.terra,
    q: 'Bạn đệm được vài bài nhưng bài nào cũng nghe gần giống nhau? Bạn biết vài điệu nhưng không chắc điệu nào hợp với bài nào?',
    body: 'Ở chặng này, bạn học cách phân bổ phần đệm theo bố cục bài hát — đoạn nào cần nhẹ, đoạn nào cần đẩy, đoạn nào cần dồn nhịp để dẫn sang phần tiếp theo.',
    from: 'Biết đệm một bài hát', to: 'Phần đệm có bố cục và cảm xúc' },
  { eb: 'Nếu bạn kẹt ở phần giai điệu và nốt', title: 'Tỉa Nốt 2 — Thị tấu và toàn cần đàn', c: P.honey,
    q: 'Bạn chơi theo tab được nhưng không biết mình đang bấm nốt gì? Bạn chỉ quen ở vài vị trí đầu cần đàn?',
    body: 'Ở chặng này, bạn mở rộng bản đồ cần đàn — không còn quanh quẩn ở ô phím đầu tiên, không chỉ ở các giọng dễ, không chỉ dựa vào tab có sẵn.',
    from: 'Giai điệu cơ bản ở vài giọng dễ', to: 'Nhìn bản nhạc, chơi nhiều giọng trên toàn cần' },
  { eb: 'Nếu bạn muốn chơi thực chiến hơn', title: 'Tỉa Nốt 3 — Cảm âm, khuôn hình và thực chiến', c: P.green,
    q: 'Bạn muốn nghe một bài hát rồi tự tìm ra giai điệu? Bạn muốn chơi trên nền karaoke, backing track, bài hát thật — không chỉ bấm theo tờ tab?',
    body: 'Ở chặng này, bạn dùng tai nghe, cảm nhận và khuôn hình để tìm giai điệu. Bạn học cách nghe — tìm nốt — nối câu — xử lý giai điệu trên nền bài hát thật.',
    from: 'Nhìn bản nhạc để chơi', to: 'Nghe – cảm nhận – tìm nốt – chơi thực chiến' },
  { eb: 'Nếu bạn muốn phần đệm sâu hơn', title: 'Đệm Hát 3 — Nâng cấp phần đệm', c: P.terra,
    q: 'Phần đệm không chỉ là quạt hoặc rải hợp âm nữa.',
    body: 'Bạn học cách tạo chiều sâu cho tiếng đàn — tuyến bè bass, bè chord, tách bass–treble, hợp âm chặn, dồn nhịp, ngắt nghỉ, câu nối giữa các đoạn.',
    from: 'Đệm được bài hát', to: 'Biết xử lý phần đệm' },
]
const SUMMARY = [
  ['Đệm hát 2', 'Bạn đệm được vài bài nhưng phần đệm còn đều đều'],
  ['Tỉa nốt 2', 'Bạn biết nốt cơ bản nhưng chưa chơi được nhiều giọng'],
  ['Tỉa nốt 3', 'Bạn muốn nghe và tự tìm giai điệu trên đàn'],
  ['Hành trình', 'Bạn muốn kết nối đệm hát, tỉa nốt, cảm âm, hòa âm và solo thành một hệ thống'],
]

export default function ClassNangCao({ onClose, onChat, onJourney, onQuiz }: { onClose: () => void; onChat: () => void; onJourney: () => void; onQuiz: () => void }) {
  return (
    <div className="tva-nc">
      <style>{CSS}</style>

      <div className="nc-top">
        <button className="nc-back" onClick={onClose}>← Quay lại</button>
        <button className="nc-cta" onClick={onJourney}>Xem bản đồ Hành Trình →</button>
      </div>

      <div className="nc-scroll">
        <div className="nc-wrap">
          {/* HERO */}
          <div className="nc-eyebrow">Dành cho người đã học guitar</div>
          <h1 className="nc-h1">Tôi đã biết chơi guitar,<br /><i>nhưng muốn tiến xa hơn</i></h1>
          <p className="nc-sub">Một bản đồ cho người đã học một thời gian — nhưng vẫn cảm thấy mình chưa thật sự làm chủ cây đàn.</p>
          <hr className="nc-hr" />

          {/* MỞ ĐẦU */}
          <p className="nc-p">Có một tình huống rất quen.</p>
          <p className="nc-p">Bạn đã học guitar một thời gian. Bạn biết vài hợp âm. Bạn từng tập một số bài. Bạn có thể đã chơi được vài đoạn tab. Bạn cũng có thể biết vài điệu quạt, vài mẫu rải, vài kỹ thuật quen thuộc.</p>
          <p className="nc-p">Rồi một hôm, có người bạn đến nhà chơi. Bạn ấy nói:</p>
          <div className="nc-quote">"Nghe bảo bạn học guitar lâu rồi, đàn cho mình hát một bài đi."</div>
          <p className="nc-p">Một câu nói rất bình thường. Nhưng ngay lúc đó, bạn bắt đầu hơi lúng túng.</p>
          <ul className="nc-list">
            <li>Bạn không chắc bài đó đang ở tông nào.</li>
            <li>Bạn không biết nên bắt đầu bằng hợp âm nào.</li>
            <li>Bạn muốn tìm hợp âm trên mạng, nhưng nếu không có trước mặt thì hơi bí.</li>
            <li>Bạn thử đánh vài vòng quen thuộc, nhưng giọng người hát lại cao hơn hoặc thấp hơn.</li>
            <li>Bạn muốn đổi tông cho vừa giọng, nhưng tay đàn chưa kịp đi theo.</li>
          </ul>
          <p className="nc-p">Không khí vẫn vui. Nhưng bên trong, bạn bắt đầu nhận ra:</p>
          <div className="nc-emph">Mình đã học khá lâu, nhưng hình như vẫn chưa thật sự chủ động với cây đàn.</div>

          {/* TỜ GIẤY TRƯỚC MẶT */}
          <h2 className="nc-h2">Khi cây đàn vẫn cần "tờ giấy trước mặt"</h2>
          <p className="nc-p">Bạn nghe một bài hát quen. Bạn biết bài đó. Bạn có thể ngân nga được giai điệu trong đầu. Bạn thậm chí còn thuộc lời. Nhưng khi cầm đàn lên, bạn lại không biết nên bắt đầu từ đâu.</p>
          <p className="nc-p">Nếu có tab, bạn có thể nhìn và bấm theo. Nếu có video hướng dẫn, bạn có thể tua chậm và tập lại. Nhưng nếu chỉ có bài hát và cây đàn, mọi thứ bắt đầu mơ hồ.</p>
          <ul className="nc-list">
            <li>Nốt đầu tiên nằm ở đâu?</li>
            <li>Bài này đang ở giọng nào?</li>
            <li>Nếu muốn đổi tông cho hợp giọng thì phải làm sao?</li>
            <li>Nếu muốn đệm khác đi một chút thì nên thay đổi ở đâu?</li>
          </ul>
          <div className="nc-emph small">Mình không còn là người mới. Nhưng cũng chưa thật sự tự do với cây đàn.</div>

          {/* BIẾT NHIỀU, CHƯA HỆ THỐNG */}
          <h2 className="nc-h2">Biết nhiều thứ, nhưng chưa nối lại thành hệ thống</h2>
          <div className="nc-pieces">
            {PIECES.map(([t, d], i) => (
              <div className="nc-piece" key={i}><div className="nc-piece-h">{t}</div><span>{d}</span></div>
            ))}
          </div>
          <p className="nc-p" style={{ marginTop: 18 }}>Bạn không thiếu cố gắng. <b style={{ color: P.terra }}>Có thể bạn chỉ đang thiếu một bản đồ để nối những mảnh đó lại.</b></p>

          {/* KHÔNG PHẢI HỌC THÊM NHIỀU */}
          <h2 className="nc-h2">Điều quan trọng không phải là học thêm thật nhiều</h2>
          <p className="nc-p">Khi đã biết chơi một chút, nhiều người thường nghĩ mình cần học thêm nhiều bài hơn, nhiều hợp âm hơn, nhiều điệu hơn, nhiều kỹ thuật hơn. Nhưng đôi khi, học thêm chưa chắc đã giải quyết được vấn đề — vì nếu các mảnh cũ chưa được kết nối, càng học thêm, bạn càng có thêm nhiều mảnh rời rạc.</p>
          <p className="nc-p">Điều quan trọng hơn là biết: <b>Mình đang kẹt ở đâu? Mình thiếu mảnh nào? Mình nên đi tiếp bằng chặng nào?</b></p>

          {/* BẢN ĐỒ CÁC CHẶNG */}
          <div className="nc-eyebrow" style={{ marginTop: 36 }}>Bản đồ lộ trình</div>
          <h2 className="nc-h2" style={{ marginTop: 4 }}>Bạn đang ở đâu trên hành trình?</h2>
          {ROUTES.map((r, i) => (
            <div className="nc-route" key={i} style={{ borderLeftColor: r.c }}>
              <div className="nc-route-eb" style={{ color: r.c }}>{r.eb}</div>
              <div className="nc-route-title">{r.title}</div>
              <p className="nc-route-q">{r.q}</p>
              <p className="nc-route-body">{r.body}</p>
              <div className="nc-route-from"><i>Từ:</i> {r.from} <span style={{ color: r.c }}>→</span> <b>{r.to}</b></div>
            </div>
          ))}

          {/* LỚP HÀNH TRÌNH (dark) */}
          <div className="nc-darkbox">
            <div className="nc-darkbox-eb">Khi các mảnh bắt đầu rõ hơn</div>
            <div className="nc-darkbox-h">Lớp Hành Trình</div>
            <p className="nc-darkbox-p">Đệm hát và tỉa nốt không tách rời nhau. Khi đã đi qua những nền tảng nhất định, bạn sẽ thấy tất cả kết nối với nhau.</p>
            <div className="nc-darkbox-grid">
              {[['Đệm hát', 'Tạo bè nền'], ['Tỉa nốt', 'Làm chủ giai điệu'], ['Nhạc lý & Hòa âm', 'Hiểu cấu trúc bài hát'], ['Cảm âm & Solo', 'Nghe, tìm và tái tạo']].map(([a, b], i) => (
                <div className="nc-dbcell" key={i}><b>{a}</b><span>{b}</span></div>
              ))}
            </div>
            <p className="nc-darkbox-note">Ở Lớp Hành Trình, bạn không chỉ học thêm bài mới. Bạn học cách nghe, phân tích, tái tạo — và dần dần làm chủ cây đàn theo cách của mình.</p>
          </div>

          {/* KHÔNG CẦN HỌC LẠI TỪ ĐẦU */}
          <h2 className="nc-h2">Có thể bạn không cần học lại từ đầu</h2>
          <p className="nc-p">Nếu bạn đã học guitar một thời gian nhưng vẫn bị chững lại, điều bạn cần không phải lúc nào cũng là quay về số 0. Có thể bạn chỉ cần được xếp đúng vị trí.</p>
          <div className="nc-summary">
            {SUMMARY.map(([t, d], i) => (
              <div className="nc-sum-row" key={i}><span className="nc-sum-tag">{t}</span><span className="nc-sum-d">{d}</span></div>
            ))}
          </div>

          <div className="nc-closing">
            <i>Bạn không cần tự đoán một mình.</i>
            <b>Điều quan trọng là nhìn ra mình đang ở đâu trên bản đồ.</b>
          </div>

          {/* CTA */}
          <div className="nc-final">
            <div className="nc-final-eb">Bắt đầu tại đây</div>
            <div className="nc-final-h">Xem bản đồ Hành Trình 2027</div>
            <p>Không phải để học tất cả ngay. Mà để biết mình đang ở đâu, đang thiếu mảnh nào, và chặng tiếp theo nên là gì.</p>
            <button className="nc-final-btn" onClick={onJourney}>Xem bản đồ Hành Trình 2027 →</button>
            <button className="nc-final-link" onClick={onQuiz}>Làm bài test định hướng nhanh</button>
            <button className="nc-final-link" onClick={onChat}>Hỏi trợ lý xếp đúng trình độ</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const CSS = `
.tva-nc{position:fixed;inset:0;z-index:120;background:${P.bg};display:flex;flex-direction:column;font-family:'Be Vietnam Pro',system-ui,sans-serif;color:${P.ink};text-align:left;}
.tva-nc *{box-sizing:border-box;}
.tva-nc .nc-top{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 20px;background:rgba(242,238,231,.92);backdrop-filter:blur(10px);border-bottom:1px solid ${P.line};}
.tva-nc .nc-back{border:1.5px solid #D3CEE8;background:#fff;color:${P.indigo};border-radius:10px;padding:9px 16px;font-weight:600;font-size:14px;cursor:pointer;font-family:inherit;}
.tva-nc .nc-cta{border:none;background:${P.indigo};color:#fff;border-radius:10px;padding:9px 16px;font-weight:600;font-size:14px;cursor:pointer;font-family:inherit;}
.tva-nc .nc-scroll{flex:1;overflow-y:auto;}
.tva-nc .nc-wrap{max-width:720px;margin:0 auto;padding:40px 24px 72px;}

.tva-nc .nc-eyebrow{font-size:11.5px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${P.honey};margin-bottom:14px;}
.tva-nc .nc-h1{font-family:${SERIF};font-size:40px;font-weight:600;line-height:1.1;letter-spacing:-.5px;color:${P.ink};margin:0;}
.tva-nc .nc-h1 i{color:${P.terra};font-style:italic;}
.tva-nc .nc-sub{font-size:16px;line-height:1.6;color:${P.soft};margin:16px 0 0;max-width:560px;}
.tva-nc .nc-hr{border:none;border-top:1px solid ${P.line};margin:26px 0;}
.tva-nc .nc-p{font-size:16px;line-height:1.75;color:${P.soft};margin:0 0 16px;}
.tva-nc .nc-p b{color:${P.ink};}
.tva-nc .nc-h2{font-family:${SERIF};font-size:27px;font-weight:600;line-height:1.25;color:${P.ink};margin:34px 0 14px;}
@media(max-width:560px){.tva-nc .nc-h1{font-size:31px;}.tva-nc .nc-h2{font-size:23px;}}

.tva-nc .nc-quote{background:${P.honeyTint};border-left:3px solid ${P.terra};border-radius:0 12px 12px 0;padding:18px 22px;margin:6px 0 18px;font-family:${SERIF};font-size:19px;font-style:italic;color:${P.ink};line-height:1.45;}
.tva-nc .nc-list{margin:0 0 18px;padding:0;list-style:none;border-left:2px solid ${P.honey}66;}
.tva-nc .nc-list li{font-size:15px;color:${P.soft};line-height:1.5;padding:6px 0 6px 18px;}
.tva-nc .nc-emph{text-align:center;font-family:${SERIF};font-size:20px;font-style:italic;color:${P.terra};line-height:1.45;margin:22px auto;max-width:520px;}
.tva-nc .nc-emph.small{font-size:18px;color:${P.faint};}

.tva-nc .nc-pieces{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.tva-nc .nc-piece{background:${P.honeyTint};border-radius:13px;padding:15px 17px;}
.tva-nc .nc-piece-h{font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${P.terra};margin-bottom:7px;}
.tva-nc .nc-piece span{font-size:14px;color:${P.soft};line-height:1.55;}
@media(max-width:520px){.tva-nc .nc-pieces{grid-template-columns:1fr;}}

.tva-nc .nc-route{background:#FCFAF6;border:1px solid ${P.line};border-left:4px solid;border-radius:0 14px 14px 0;padding:18px 22px;margin:14px 0;}
.tva-nc .nc-route-eb{font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;margin-bottom:7px;}
.tva-nc .nc-route-title{font-family:${SERIF};font-size:21px;font-weight:600;color:${P.ink};margin-bottom:10px;}
.tva-nc .nc-route-q{font-size:14.5px;color:${P.soft};line-height:1.6;margin:0 0 10px;font-style:italic;}
.tva-nc .nc-route-body{font-size:14.5px;color:${P.soft};line-height:1.65;margin:0 0 12px;}
.tva-nc .nc-route-from{font-size:13.5px;color:${P.soft};border-top:1px solid ${P.line};padding-top:10px;}
.tva-nc .nc-route-from i{color:${P.faint};font-style:italic;margin-right:4px;}
.tva-nc .nc-route-from b{color:${P.ink};}

.tva-nc .nc-darkbox{background:linear-gradient(160deg,#2A2440,#1B1730);border-radius:18px;padding:26px 28px;margin:30px 0;}
.tva-nc .nc-darkbox-eb{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${P.gold};margin-bottom:8px;}
.tva-nc .nc-darkbox-h{font-family:${SERIF};font-size:24px;color:#fff;margin-bottom:10px;}
.tva-nc .nc-darkbox-p{font-size:14.5px;line-height:1.6;color:#C9C3DE;margin:0 0 16px;}
.tva-nc .nc-darkbox-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;}
.tva-nc .nc-dbcell{background:rgba(255,255,255,.06);border-radius:11px;padding:13px 15px;}
.tva-nc .nc-dbcell b{display:block;font-size:14.5px;color:#fff;margin-bottom:2px;}
.tva-nc .nc-dbcell span{font-size:13px;color:#9C95B8;}
.tva-nc .nc-darkbox-note{font-size:13.5px;font-style:italic;color:#A89FB5;line-height:1.6;margin:0;}
@media(max-width:520px){.tva-nc .nc-darkbox-grid{grid-template-columns:1fr;}}

.tva-nc .nc-summary{background:${P.honeyTint};border-radius:14px;padding:8px 18px;}
.tva-nc .nc-sum-row{display:flex;gap:12px;align-items:baseline;padding:11px 0;border-bottom:1px solid ${P.honey}22;}
.tva-nc .nc-sum-row:last-child{border-bottom:none;}
.tva-nc .nc-sum-tag{flex-shrink:0;width:88px;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:${P.terra};}
.tva-nc .nc-sum-d{font-size:14px;color:${P.soft};line-height:1.5;}

.tva-nc .nc-closing{text-align:center;margin:34px auto;max-width:560px;}
.tva-nc .nc-closing i{display:block;font-family:${SERIF};font-style:italic;font-size:17px;color:${P.faint};margin-bottom:6px;}
.tva-nc .nc-closing b{display:block;font-family:${SERIF};font-weight:600;font-size:23px;color:${P.ink};line-height:1.35;}

.tva-nc .nc-final{background:linear-gradient(160deg,#2A2440,#1B1730);border-radius:18px;padding:30px 28px;margin-top:20px;text-align:center;}
.tva-nc .nc-final-eb{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${P.gold};margin-bottom:8px;}
.tva-nc .nc-final-h{font-family:${SERIF};font-size:26px;color:#fff;margin-bottom:10px;}
.tva-nc .nc-final p{font-size:14.5px;color:#C9C3DE;line-height:1.6;margin:0 auto 18px;max-width:420px;}
.tva-nc .nc-final-btn{background:#fff;color:${P.indigo};border:none;border-radius:12px;padding:14px 26px;font-weight:700;font-size:15px;cursor:pointer;font-family:inherit;}
.tva-nc .nc-final-link{display:block;margin:14px auto 0;background:none;border:none;color:${P.gold};font-size:14.5px;cursor:pointer;font-family:inherit;}
.tva-nc .nc-final-link:hover{color:#fff;}
`
