// ClassDemHat — bài "Lớp Đệm Hát Căn Bản" (bản cập nhật 80/20, tập trung Khởi Đầu Đam Mê 1).
// Trình độ 2-3 chỉ nhắc nhẹ ở cuối. Editorial serif, tông đồng bộ trang /class.
const P = {
  bg: '#F2EEE7', surface: '#FFFFFF', ink: '#211C32', soft: '#5A5470', faint: '#8A8499',
  honey: '#C9711E', honeyTint: '#FBF1E4', terra: '#A8542A', line: '#E4DED4', indigo: '#4338CA',
}
const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif"

const LEARN = [
  ['Hợp âm căn bản', 'Bạn học cách bấm hợp âm, chuyển hợp âm và đưa hợp âm vào những bài hát đơn giản. Mục tiêu không phải học thật nhiều hợp âm ngay, mà là bấm đúng, chuyển ổn và bắt đầu dùng được trong bài hát.'],
  ['Phách và nhịp', 'Đây là phần rất nhiều người học lâu năm vẫn bị sai. Khi nhịp phách chưa chắc, càng học nhiều điệu càng dễ rối. Ở khóa đầu tiên, bạn sẽ được học cách giữ phách, hiểu nhịp và không bị lệch khi vào bài hát.'],
  ['Đàn và hát cho khớp tông', 'Nhiều người học trên mạng biết hợp âm nhưng không ai sửa tông, không ai hướng dẫn cách chọn tông cho hợp giọng. Trong lớp, bạn sẽ được định hướng để đàn và hát khớp với nhau hơn, tránh cảm giác đàn một nơi, hát một nơi.'],
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
          <div className="dh-eyebrow">Khóa học Đàn &amp; Hát</div>
          <h1 className="dh-h1">Lớp Đệm Hát<br />Căn Bản</h1>
          <div className="dh-subline"><b>Khởi Đầu Đam Mê 1</b> <span>· dành cho người mới muốn vừa đàn vừa hát</span></div>
          <hr className="dh-hr" />

          <p className="dh-p">Nếu bạn thích hát, hay hát karaoke, hoặc từng muốn tự ôm đàn và hát một bài mình yêu thích, thì <b>Đệm hát căn bản</b> là một cửa vào rất phù hợp.</p>
          <p className="dh-p">Ở giai đoạn đầu, bạn chưa cần học quá nhiều kỹ thuật. Điều quan trọng là có một nền tảng đủ chắc để đàn không bị rối, hát không bị lệch và bài hát có thể bắt đầu vang lên một cách tự nhiên.</p>
          <p className="dh-p">Nhiều người tự học thường biết vài hợp âm, nhưng khi vào bài hát thật lại thấy tay chuyển không kịp, nhịp không chắc, hoặc hát vào thì bị lạc tông. Lớp Đệm hát căn bản được xây dựng để xử lý chính những điểm nền tảng đó.</p>

          {/* BẠN SẼ HỌC GÌ */}
          <div className="dh-learn-h">Bạn sẽ được học những gì?</div>
          {LEARN.map(([t, d], i) => (
            <div className="dh-learn" key={i}>
              <span className="dh-num">{i + 1}</span>
              <div>
                <b>{t}</b>
                <span>{d}</span>
              </div>
            </div>
          ))}

          {/* MỤC TIÊU CỦA KHÓA */}
          <div className="dh-goalbox">
            <div className="dh-goalbox-h">Mục tiêu của khóa</div>
            <p>Sau khóa này, bạn có nền tảng: <b>Hợp âm – Nhịp phách – Tông giọng</b>. Đây là phần móng để bắt đầu đệm hát chắc hơn, không học theo kiểu mò mẫm lan man.</p>
          </div>

          {/* SAU KHÓA NÀY HỌC TIẾP GÌ (nhắc nhẹ) */}
          <h2 className="dh-h2">Sau khóa này có thể học tiếp gì?</h2>
          <p className="dh-p">Nếu muốn đi tiếp, bạn có thể học <b>Đệm hát 2</b> để phát triển chùm nốt, tiết tấu, điệu và bố cục đệm hát. Sau đó, <b>Đệm hát 3</b> giúp bạn đi sâu hơn vào bass, chord, hợp âm chặn, dồn nhịp và ngắt nghỉ.</p>
          <p className="dh-p" style={{ marginBottom: 0 }}>Nhưng trước mắt, bạn không cần học hết toàn bộ lộ trình. Chỉ cần bắt đầu bằng đúng khóa đầu tiên phù hợp với mục tiêu vừa đàn vừa hát.</p>

          {/* CTA */}
          <div className="dh-final">
            <div className="dh-final-h">Bắt đầu lớp Đệm Hát Căn Bản?</div>
            <button className="dh-final-link" onClick={onRegister}><span>→</span> Xem lớp Đệm hát sắp khai giảng</button>
            <button className="dh-final-link" onClick={onChat}><span>→</span> Hỏi trợ lý nếu chưa chắc</button>
            <button className="dh-final-link" onClick={onRegister}><span>→</span> Đăng ký giữ chỗ lớp Đệm hát</button>
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
.tva-dh .dh-h1{font-family:${SERIF};font-size:48px;font-weight:700;line-height:1.04;letter-spacing:-.5px;color:${P.ink};margin:0;}
.tva-dh .dh-subline{margin-top:14px;font-size:16px;color:${P.soft};}
.tva-dh .dh-subline b{font-family:${SERIF};font-weight:600;color:${P.ink};font-size:18px;}
.tva-dh .dh-subline span{font-style:italic;color:${P.faint};font-size:14.5px;}
.tva-dh .dh-hr{border:none;border-top:2px solid ${P.ink};margin:22px 0 26px;opacity:.85;}
.tva-dh .dh-p{font-size:16px;line-height:1.75;color:${P.soft};margin:0 0 16px;}
.tva-dh .dh-p b{color:${P.ink};}
.tva-dh .dh-h2{font-family:${SERIF};font-size:28px;font-weight:600;color:${P.ink};margin:32px 0 14px;}
@media(max-width:560px){.tva-dh .dh-h1{font-size:38px;}.tva-dh .dh-h2{font-size:24px;}}

.tva-dh .dh-learn-h{font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${P.honey};margin:30px 0 6px;}
.tva-dh .dh-learn{display:flex;gap:16px;padding:18px 0;border-top:1px solid ${P.line};}
.tva-dh .dh-num{flex-shrink:0;width:34px;height:34px;border-radius:50%;background:${P.terra};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;}
.tva-dh .dh-learn b{display:block;font-size:16px;color:${P.ink};margin-bottom:5px;}
.tva-dh .dh-learn span{font-size:14.5px;color:${P.soft};line-height:1.65;}

.tva-dh .dh-goalbox{background:${P.honeyTint};border-left:3px solid ${P.terra};border-radius:0 14px 14px 0;padding:18px 22px;margin:26px 0 6px;}
.tva-dh .dh-goalbox-h{font-size:11.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${P.terra};margin-bottom:8px;}
.tva-dh .dh-goalbox p{font-size:15px;line-height:1.65;color:${P.soft};margin:0;}
.tva-dh .dh-goalbox b{color:${P.ink};}

.tva-dh .dh-final{background:linear-gradient(160deg,#2A2440,#1B1730);border-radius:18px;padding:26px 28px;margin-top:34px;}
.tva-dh .dh-final-h{font-family:${SERIF};font-size:21px;font-style:italic;color:#fff;margin-bottom:16px;}
.tva-dh .dh-final-link{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:none;border:none;color:#EDE9F6;font-size:15.5px;font-family:inherit;cursor:pointer;padding:9px 0;}
.tva-dh .dh-final-link span{color:${P.honey};font-weight:700;}
.tva-dh .dh-final-link:hover{color:#fff;}
`
