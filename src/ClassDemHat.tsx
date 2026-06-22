// ClassDemHat — bài viết "Đệm Hát Guitar" dựng native (full màn hình).
// Phong cách editorial (serif + kem + đồng), tông đồng bộ trang /class.
const P = {
  bg: '#F2EEE7', surface: '#FFFFFF', ink: '#211C32', soft: '#5A5470', faint: '#8A8499',
  honey: '#C9711E', honeyTint: '#FBF1E4', terra: '#A8542A', line: '#E4DED4', indigo: '#4338CA',
}
const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif"

const levels = [
  {
    no: 'I', title: 'Khởi Đầu Đam Mê 1', sub: 'Dành cho người mới bắt đầu từ số 0',
    intro: 'Đây là khóa đầu tiên cho người mới học đệm hát. Ở khóa này, bạn sẽ được học các nền tảng quan trọng:',
    items: [
      ['Hợp âm căn bản', 'Bạn học cách bấm hợp âm, chuyển hợp âm và đưa hợp âm vào những bài hát đơn giản.'],
      ['Phách và nhịp', 'Khi nhịp phách chưa chắc, càng học nhiều điệu càng dễ rối. Ở trình độ 1, bạn học kỹ cách giữ phách, hiểu nhịp và không bị lệch khi vào bài hát.'],
      ['Đàn và hát cho khớp tông', 'Bạn sẽ được định hướng để đàn và hát khớp với nhau — bắt tông đúng giọng, tránh sai lệch mà nhiều người học tự phát thường mắc phải.'],
    ],
    goal: 'Hợp âm · Nhịp phách · Tổng giọng',
  },
  {
    no: '2', title: 'Khởi Đầu Đam Mê 2', sub: 'Dành cho người đã biết sơ qua về đệm hát',
    intro: 'Khi đã có nền tảng cơ bản, bạn sẽ bắt đầu phát triển phần đệm cho sinh động hơn.',
    items: [
      ['Chùm nốt', 'Hiểu cách chia nhỏ nhịp để phần đệm có chuyển động, không còn chỉ đánh đơn giản theo phách.'],
      ['Tiết tấu và điệu', 'Bạn học các điệu đệm hát phổ biến, hiểu điệu nào phù hợp với kiểu bài hát nào, và cách dùng tiết tấu để tạo cảm xúc.'],
      ['Bố cục đệm hát', 'Một bài hát không nên đệm y chang từ đầu đến cuối. Bạn học cách phân bổ phần đệm: đoạn nào nhẹ, đoạn nào đẩy, khi nào nhấn, khi nào ngắt, khi nào thay đổi tiết tấu.'],
    ],
    goal: 'Tiết tấu · Điệu · Bố cục',
  },
  {
    no: '3', title: 'Đệm Hát Trình Độ 3', sub: 'Dành cho người muốn nâng cấp phần đệm',
    intro: 'Khi đã đệm được cơ bản, bạn sẽ cần làm cho tiếng đàn có chiều sâu hơn.',
    items: [
      ['Tuyến bè bass và bè chord', 'Giúp phần đệm chắc hơn, có hướng đi hơn, không bị phẳng.'],
      ['Tách bass, treble', 'Biết cách tạo lớp âm thanh trầm và cao để tiếng đàn rõ ràng, có chiều sâu.'],
      ['Hợp âm chặn, bộ hợp âm, hợp âm bấm tắt', 'Mở rộng khả năng xử lý hợp âm và làm phần đệm linh hoạt hơn.'],
      ['Dồn nhịp, ngắt nghỉ giữa các đoạn', 'Biết cách tạo điểm nhấn, câu nối, khoảng dừng và cao trào cho bài hát.'],
    ],
    goal: 'Từ đệm được bài hát → biết xử lý phần đệm',
  },
]

export default function ClassDemHat({ onClose, onRegister, onChat }: { onClose: () => void; onRegister: () => void; onChat: () => void }) {
  return (
    <div className="tva-dh">
      <style>{CSS}</style>

      <div className="dh-top">
        <button className="dh-back" onClick={onClose}>← Quay lại</button>
        <button className="dh-cta" onClick={onRegister}>Xem lớp &amp; đăng ký →</button>
      </div>

      <div className="dh-scroll">
        <div className="dh-wrap">
          {/* HERO */}
          <div className="dh-eyebrow">Lớp học Guitar · Thầy Văn Anh</div>
          <h1 className="dh-h1">Đệm Hát<br /><i>Guitar</i></h1>
          <p className="dh-sub">Dành cho người muốn tự ôm đàn và hát những bài mình yêu thích</p>
          <hr className="dh-hr" />

          <p className="dh-p">Nếu bạn thích hát, hay hát karaoke, hoặc từng mơ một ngày có thể tự ôm đàn và hát một bài mình yêu thích, thì <b>Đệm Hát</b> là một cửa vào rất phù hợp.</p>
          <p className="dh-p">Nhiều người nghĩ học đệm hát chỉ là học vài hợp âm rồi quạt theo. Nhưng khi bước vào bài hát thật, vấn đề bắt đầu xuất hiện:</p>

          <div className="dh-trouble">
            <div className="dh-trouble-h">Những khó khăn thường gặp</div>
            {['Biết hợp âm nhưng chuyển không kịp.', 'Tay phải đánh được, nhưng hát vào lại lệch nhịp.', 'Đàn một tông, hát một tông — không biết bắt tông sao cho hợp giọng.', 'Học nhiều điệu nhưng bài nào cũng đệm giống bài nào.', 'Không biết đoạn nào nên nhẹ, đoạn nào nên đẩy, khi nào dồn nhịp, khi nào ngắt nghỉ.'].map((t, i) => (
              <div className="dh-dash" key={i}>— {t}</div>
            ))}
          </div>

          <p className="dh-p">Vì vậy, lớp Đệm Hát của Thầy Văn Anh không chỉ dạy bạn "đánh được vài hợp âm", mà giúp bạn đi theo từng chặng rõ ràng để thật sự biết cách đệm cho một bài hát.</p>

          <h2 className="dh-h2">Lộ trình 3 trình độ</h2>
          <p className="dh-p">Bạn không cần học hết cả hành trình ngay từ đầu. Trước mắt, chỉ cần chọn đúng chặng phù hợp với hiện tại của mình.</p>

          {/* 3 TRÌNH ĐỘ */}
          {levels.map((lv, i) => (
            <div className="dh-level" key={i}>
              <div className="dh-level-head">
                <span className="dh-no">{lv.no}</span>
                <div>
                  <div className="dh-level-title">{lv.title}</div>
                  <div className="dh-level-sub">{lv.sub}</div>
                </div>
              </div>
              <div className="dh-level-body">
                <p className="dh-level-intro">{lv.intro}</p>
                <hr className="dh-line" />
                {lv.items.map(([t, d], j) => (
                  <div className="dh-item" key={j}>
                    <b>{t}</b>
                    <span>{d}</span>
                  </div>
                ))}
                <hr className="dh-line" />
                <div className="dh-goal"><span>Mục tiêu</span> <i>{lv.goal}</i></div>
              </div>
            </div>
          ))}

          {/* SAU 3 TRÌNH ĐỘ */}
          <h2 className="dh-h2">Sau 3 trình độ</h2>
          <div className="dh-hanhtrinh">
            <div className="dh-ht-title">Lớp Hành Trình</div>
            <p className="dh-p" style={{ marginTop: 6 }}>Sau khi hoàn thành Đệm Hát trình độ 1–2–3, nếu muốn học sâu hơn, bạn có thể gia nhập <b>Lớp Hành Trình</b> — dành cho học viên từ trình độ 3 trở lên.</p>
            <div className="dh-chips">
              {['Đệm hát nâng cao', 'Hòa âm ứng dụng', 'Cảm âm', 'Xử lý bài hát sâu hơn', 'Solo Guitar', 'Tư duy làm chủ cây đàn'].map((c, i) => <span key={i}>{c}</span>)}
            </div>
            <hr className="dh-line" />
            <p className="dh-note">Mỗi khóa là một dấu mốc. Học xong một chặng, bạn có thể dừng lại luyện thêm. Khi có thời gian, bạn học tiếp chặng sau mà vẫn biết mình đang ở đâu trên hành trình.</p>
          </div>

          {/* BẠN BẮT ĐẦU TỪ ĐÂU */}
          <h2 className="dh-h2">Bạn bắt đầu từ đâu?</h2>
          <div className="dh-start3">
            {[['Khởi Đầu Đam Mê 1', 'Mới bắt đầu từ số 0, chưa từng học đệm hát.'], ['Khởi Đầu Đam Mê 2', 'Đã biết vài hợp âm, từng đệm sơ qua nhưng chưa chắc nhịp, chưa biết phát triển điệu.'], ['Đệm Hát Trình Độ 3', 'Đã đệm được cơ bản và muốn nâng cấp phần đệm lên sâu hơn.']].map(([t, d], i) => (
              <div className="dh-start-card" key={i}>
                <div className="dh-start-eyebrow">Nếu bạn</div>
                <div className="dh-start-title">{t}</div>
                <div className="dh-start-desc">{d}</div>
              </div>
            ))}
          </div>
          <p className="dh-note">Những nội dung trên chỉ là phần khung nổi bật của lộ trình. Khi vào lớp, bạn sẽ được hướng dẫn chi tiết hơn qua bài học, bài tập, app TVA Guitar, nhóm lớp và sự theo dõi trong suốt quá trình học.</p>

          {/* CTA */}
          <div className="dh-final">
            <div className="dh-final-h">Bạn muốn biết mình phù hợp trình độ nào?</div>
            <button className="dh-final-link" onClick={onRegister}><span>→</span> Xem lớp Đệm Hát sắp khai giảng</button>
            <button className="dh-final-link" onClick={onChat}><span>→</span> Hỏi trợ lý xem mình phù hợp trình độ nào</button>
            <button className="dh-final-link" onClick={onRegister}><span>→</span> Đăng ký giữ chỗ lớp Đệm Hát</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const CSS = `
.tva-dh{position:fixed;inset:0;z-index:120;background:${P.bg};display:flex;flex-direction:column;font-family:'Be Vietnam Pro',system-ui,sans-serif;color:${P.ink};text-align:left;}
.tva-dh *{box-sizing:border-box;}
.tva-dh .dh-top{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 20px;background:rgba(242,238,231,.92);backdrop-filter:blur(10px);border-bottom:1px solid ${P.line};}
.tva-dh .dh-back{border:1.5px solid #D3CEE8;background:#fff;color:${P.indigo};border-radius:10px;padding:9px 16px;font-weight:600;font-size:14px;cursor:pointer;font-family:inherit;}
.tva-dh .dh-cta{border:none;background:${P.indigo};color:#fff;border-radius:10px;padding:9px 16px;font-weight:600;font-size:14px;cursor:pointer;font-family:inherit;}
.tva-dh .dh-scroll{flex:1;overflow-y:auto;}
.tva-dh .dh-wrap{max-width:720px;margin:0 auto;padding:40px 24px 72px;}

.tva-dh .dh-eyebrow{font-size:11.5px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${P.honey};margin-bottom:14px;}
.tva-dh .dh-h1{font-family:${SERIF};font-size:50px;font-weight:600;line-height:1.05;letter-spacing:-.5px;color:${P.ink};margin:0;}
.tva-dh .dh-h1 i{color:${P.terra};font-style:italic;}
.tva-dh .dh-sub{font-size:16px;color:${P.soft};margin:16px 0 0;}
.tva-dh .dh-hr{border:none;border-top:1px solid ${P.line};margin:26px 0;}
.tva-dh .dh-p{font-size:16px;line-height:1.75;color:${P.soft};margin:0 0 16px;}
.tva-dh .dh-p b{color:${P.ink};}
.tva-dh .dh-h2{font-family:${SERIF};font-size:30px;font-weight:600;color:${P.ink};margin:34px 0 14px;}
@media(max-width:560px){.tva-dh .dh-h1{font-size:38px;}.tva-dh .dh-h2{font-size:25px;}}

.tva-dh .dh-trouble{background:${P.honeyTint};border-left:3px solid ${P.terra};border-radius:0 14px 14px 0;padding:20px 24px;margin:8px 0 22px;}
.tva-dh .dh-trouble-h{font-size:11.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${P.terra};margin-bottom:12px;}
.tva-dh .dh-dash{font-size:14.5px;color:${P.soft};line-height:1.5;padding:5px 0;}

.tva-dh .dh-level{background:#fff;border:1px solid ${P.line};border-radius:18px;padding:22px 24px;margin:18px 0;}
.tva-dh .dh-level-head{display:flex;align-items:center;gap:14px;margin-bottom:16px;}
.tva-dh .dh-no{font-family:${SERIF};font-size:34px;font-style:italic;color:${P.honey};opacity:.55;flex-shrink:0;width:34px;text-align:center;}
.tva-dh .dh-level-title{font-family:${SERIF};font-size:23px;font-weight:600;color:${P.ink};}
.tva-dh .dh-level-sub{font-size:13px;font-style:italic;color:${P.faint};margin-top:2px;}
.tva-dh .dh-level-intro{font-size:15px;color:${P.soft};line-height:1.6;margin:0 0 4px;}
.tva-dh .dh-line{border:none;border-top:1px solid ${P.line};margin:14px 0;}
.tva-dh .dh-item{margin-bottom:14px;}
.tva-dh .dh-item b{display:block;font-size:15px;color:${P.ink};margin-bottom:3px;}
.tva-dh .dh-item span{font-size:14px;color:${P.soft};line-height:1.6;}
.tva-dh .dh-goal{font-size:14px;}
.tva-dh .dh-goal span{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${P.honey};margin-right:10px;}
.tva-dh .dh-goal i{color:${P.soft};font-style:italic;}

.tva-dh .dh-hanhtrinh{border:1px solid ${P.line};border-radius:18px;padding:24px;background:#FCFAF6;}
.tva-dh .dh-ht-title{font-family:${SERIF};font-size:21px;font-weight:600;color:${P.ink};}
.tva-dh .dh-chips{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0;}
.tva-dh .dh-chips span{font-size:13px;color:${P.terra};border:1px solid ${P.honey}55;background:${P.honeyTint};border-radius:999px;padding:6px 13px;}
.tva-dh .dh-note{font-size:14px;font-style:italic;color:${P.faint};line-height:1.65;margin:14px 0 0;}

.tva-dh .dh-start3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:6px;}
.tva-dh .dh-start-card{background:#fff;border:1px solid ${P.line};border-radius:14px;padding:16px;}
.tva-dh .dh-start-eyebrow{font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${P.faint};}
.tva-dh .dh-start-title{font-family:${SERIF};font-size:17px;font-weight:600;color:${P.terra};margin:8px 0 6px;}
.tva-dh .dh-start-desc{font-size:13.5px;color:${P.soft};line-height:1.55;}
@media(max-width:600px){.tva-dh .dh-start3{grid-template-columns:1fr;}}

.tva-dh .dh-final{background:linear-gradient(160deg,#2A2440,#1B1730);border-radius:18px;padding:26px 28px;margin-top:36px;}
.tva-dh .dh-final-h{font-family:${SERIF};font-size:21px;font-style:italic;color:#fff;margin-bottom:16px;}
.tva-dh .dh-final-link{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:none;border:none;color:#EDE9F6;font-size:15.5px;font-family:inherit;cursor:pointer;padding:9px 0;}
.tva-dh .dh-final-link span{color:${P.honey};font-weight:700;}
.tva-dh .dh-final-link:hover{color:#fff;}
`
