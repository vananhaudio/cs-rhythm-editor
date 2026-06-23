// ClassTiaNot — bài "Lớp Guitar Căn Bản · Tỉa Nốt 1" (bản 80/20, tập trung Tỉa Nốt 1).
// Trình độ 2-3 chỉ gợi mở ở timeline cuối. Editorial serif, tông đồng bộ trang /class.
const P = {
  bg: '#F2EEE7', surface: '#FFFFFF', ink: '#211C32', soft: '#5A5470', faint: '#8A8499',
  honey: '#C9711E', honeyTint: '#FBF1E4', terra: '#A8542A', line: '#E4DED4', indigo: '#4338CA', gold: '#E8B96B',
}
const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif"

const LEARN = [
  ['Nốt nhạc căn bản', 'Bạn làm quen với các nốt đầu tiên, hiểu nốt nằm ở đâu trên đàn và bấm như thế nào. Đây là phần gốc giúp bạn không chỉ nhìn dây và phím, mà bắt đầu nhìn cây đàn như một bản đồ âm thanh.'],
  ['Vị trí trên cần đàn', 'Bạn học cách tìm nốt, ghi nhớ vị trí và liên kết âm thanh với ngón tay. Khi vị trí nốt rõ hơn, việc học guitar sẽ bớt mơ hồ hơn rất nhiều.'],
  ['Chơi những giai điệu đầu tiên', 'Bạn tập từng câu nhạc ngắn, từng bài dễ, để cảm nhận rằng mình có thể tự chơi được giai điệu bằng guitar. Đây là cảm giác rất quan trọng với người mới: cây đàn bắt đầu cất tiếng.'],
  ['Làm quen với bản nhạc đơn giản', 'Bạn bắt đầu nhìn nốt nhạc, tìm nốt trên đàn và chơi theo từng bước nhỏ. Giai đoạn đầu chủ yếu ở các giọng đơn giản như C và Am, ít thăng giáng, để không bị quá tải.'],
]
const NEXT = [
  ['Tỉa Nốt 1 — Bạn đang ở đây', 'Nốt căn bản · Vị trí trên cần đàn · Giai điệu đầu tiên · Giọng C và Am', true],
  ['Tỉa Nốt 2', 'Áp dụng thị tấu · Chơi nhiều giọng khác nhau trên toàn cần đàn', false],
  ['Tỉa Nốt 3', 'Cảm âm · Khuôn hình · Chơi thực chiến trên nền bài hát thật', false],
]

export default function ClassTiaNot({ onClose, onRegister, onChat }: { onClose: () => void; onRegister: () => void; onChat: () => void }) {
  return (
    <div className="tva-tn">
      <style>{CSS}</style>

      <div className="tn-top">
        <button className="tn-back" onClick={onClose}>← Quay lại</button>
        <button className="tn-cta" onClick={onRegister}>Xem lớp &amp; đăng ký →</button>
      </div>

      <div className="tn-scroll">
        <div className="tn-wrap">
          {/* HERO */}
          <div className="tn-eyebrow">Lớp Guitar Căn Bản</div>
          <h1 className="tn-h1">Tỉa Nốt 1</h1>
          <p className="tn-sub"><i>Học guitar từ gốc theo hướng chơi giai điệu</i></p>
          <hr className="tn-hr" />

          <p className="tn-p">Khi mới bắt đầu học guitar, nhiều người chỉ có một mong muốn rất đơn giản: <i>Tôi muốn học guitar.</i></p>
          <p className="tn-p">Không phải ai cũng muốn vừa đàn vừa hát ngay từ đầu. Có người chỉ thích tiếng đàn. Có người muốn cây đàn tự vang lên giai điệu của bài hát. Có người muốn hiểu nốt nhạc nằm ở đâu, bấm thế nào và vì sao âm thanh lại đi như vậy.</p>
          <p className="tn-p">Với những người muốn học guitar từ gốc, <b>Tỉa Nốt 1</b> chính là lớp Guitar căn bản rất quan trọng. Ở giai đoạn này, bạn chưa cần hiểu "tỉa nốt" theo nghĩa phức tạp. Bạn chỉ cần hình dung: mình sẽ học từng nốt, từng vị trí, từng câu nhạc nhỏ, rồi dần dần chơi được những giai điệu đầu tiên trên cây đàn.</p>

          {/* BẠN SẼ HỌC GÌ */}
          <h2 className="tn-h2">Bạn sẽ được học những gì?</h2>
          {LEARN.map(([t, d], i) => (
            <div className="tn-learn" key={i}>
              <span className="tn-num">{i + 1}</span>
              <div><b>{t}</b><span>{d}</span></div>
            </div>
          ))}

          {/* MỤC TIÊU CỦA KHÓA (nền tối) */}
          <div className="tn-goalbox">
            <div className="tn-goalbox-h">Mục tiêu của khóa</div>
            <div className="tn-goalbox-t">Sau khóa này, bạn có nền tảng:</div>
            <div className="tn-goalbox-chips"><span>Nốt nhạc</span><span>Vị trí trên đàn</span><span>Giai điệu đơn giản</span></div>
            <p>Đây là nền gốc để sau này học thị tấu, cảm âm, hòa âm, solo hoặc bổ sung cho đệm hát.</p>
          </div>

          {/* SO SÁNH */}
          <h2 className="tn-h2">Tỉa Nốt 1 và Đệm Hát 1 khác nhau thế nào?</h2>
          <div className="tn-compare">
            <div className="tn-cmp">
              <div className="tn-cmp-h">Đệm Hát 1</div>
              <div>Giúp bạn <b>bước nhanh vào việc vừa đàn vừa hát</b>: hợp âm, nhịp phách, bắt tông.</div>
            </div>
            <div className="tn-cmp">
              <div className="tn-cmp-h">Tỉa Nốt 1</div>
              <div>Giúp bạn <b>hiểu cây đàn từ gốc</b>: nốt nhạc, vị trí và giai điệu.</div>
            </div>
          </div>
          <p className="tn-p">Bạn có thể bắt đầu bằng Đệm Hát nếu mục tiêu trước mắt là hát ngay. Nhưng nếu muốn học guitar bài bản và hiểu cây đàn sâu hơn, <b>Tỉa Nốt 1 là lớp nền rất nên học</b>, dù học trước hay bổ sung sau.</p>

          {/* SAU KHÓA NÀY HỌC TIẾP GÌ (timeline, nhắc nhẹ 2-3) */}
          <h2 className="tn-h2">Sau khóa này có thể học tiếp gì?</h2>
          <div className="tn-timeline">
            {NEXT.map(([t, d, here], i) => (
              <div className={`tn-tl-item${here ? ' here' : ''}`} key={i}>
                <span className="tn-tl-dot" />
                <div><b>{t as string}</b><span>{d as string}</span></div>
              </div>
            ))}
          </div>
          <p className="tn-note">Nhưng trước mắt, bạn không cần học hết lộ trình. Chỉ cần bắt đầu bằng lớp Guitar căn bản để đặt nền thật rõ.</p>

          {/* CTA */}
          <div className="tn-final">
            <div className="tn-final-h">Bắt đầu lớp Guitar Căn Bản?</div>
            <button className="tn-final-link" onClick={onRegister}><span>→</span> Xem lớp Guitar căn bản sắp khai giảng</button>
            <button className="tn-final-link" onClick={onChat}><span>→</span> Hỏi trợ lý nếu chưa chắc</button>
            <button className="tn-final-link" onClick={onRegister}><span>→</span> Đăng ký giữ chỗ lớp Guitar căn bản</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const CSS = `
.tva-tn{position:fixed;inset:0;z-index:120;background:${P.bg};display:flex;flex-direction:column;font-family:'Be Vietnam Pro',system-ui,sans-serif;color:${P.ink};text-align:left;}
.tva-tn *{box-sizing:border-box;}
.tva-tn .tn-top{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 20px;background:rgba(242,238,231,.92);backdrop-filter:blur(10px);border-bottom:1px solid ${P.line};}
.tva-tn .tn-back{border:1.5px solid #D3CEE8;background:#fff;color:${P.indigo};border-radius:10px;padding:9px 16px;font-weight:600;font-size:14px;cursor:pointer;font-family:inherit;}
.tva-tn .tn-cta{border:none;background:${P.indigo};color:#fff;border-radius:10px;padding:9px 16px;font-weight:600;font-size:14px;cursor:pointer;font-family:inherit;}
.tva-tn .tn-scroll{flex:1;overflow-y:auto;}
.tva-tn .tn-wrap{max-width:720px;margin:0 auto;padding:40px 24px 72px;}

.tva-tn .tn-eyebrow{font-size:11.5px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${P.honey};margin-bottom:14px;}
.tva-tn .tn-h1{font-family:${SERIF};font-size:46px;font-weight:700;line-height:1.04;letter-spacing:-.5px;color:${P.ink};margin:0;}
.tva-tn .tn-sub{font-size:17px;color:${P.soft};margin:12px 0 0;}
.tva-tn .tn-sub i{font-style:italic;}
.tva-tn .tn-hr{border:none;border-top:1px solid ${P.line};margin:24px 0 26px;}
.tva-tn .tn-p{font-size:16px;line-height:1.75;color:${P.soft};margin:0 0 16px;}
.tva-tn .tn-p b{color:${P.ink};}.tva-tn .tn-p i{font-style:italic;}
.tva-tn .tn-h2{font-family:${SERIF};font-size:27px;font-weight:600;color:${P.ink};margin:32px 0 14px;}
@media(max-width:560px){.tva-tn .tn-h1{font-size:38px;}.tva-tn .tn-h2{font-size:23px;}}

.tva-tn .tn-learn{display:flex;gap:16px;padding:18px 0;border-top:1px solid ${P.line};}
.tva-tn .tn-num{flex-shrink:0;width:34px;height:34px;border-radius:50%;background:${P.terra};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;}
.tva-tn .tn-learn b{display:block;font-size:16px;color:${P.ink};margin-bottom:5px;}
.tva-tn .tn-learn span{font-size:14.5px;color:${P.soft};line-height:1.65;}

.tva-tn .tn-goalbox{background:linear-gradient(160deg,#2A2440,#1B1730);border-radius:16px;padding:24px 26px;margin:28px 0 6px;}
.tva-tn .tn-goalbox-h{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${P.gold};margin-bottom:10px;}
.tva-tn .tn-goalbox-t{font-family:${SERIF};font-size:19px;color:#fff;margin-bottom:12px;}
.tva-tn .tn-goalbox-chips{display:flex;flex-wrap:wrap;gap:9px;margin-bottom:14px;}
.tva-tn .tn-goalbox-chips span{background:rgba(232,185,107,.16);color:${P.gold};border:1px solid rgba(232,185,107,.3);border-radius:8px;padding:7px 13px;font-size:13.5px;font-weight:600;}
.tva-tn .tn-goalbox p{font-size:14px;line-height:1.6;color:#C9C3DE;margin:0;}

.tva-tn .tn-compare{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:6px 0 18px;}
.tva-tn .tn-cmp{background:#fff;border:1px solid ${P.line};border-radius:14px;padding:16px;font-size:14px;color:${P.soft};line-height:1.55;}
.tva-tn .tn-cmp b{color:${P.ink};}
.tva-tn .tn-cmp-h{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${P.honey};margin-bottom:8px;}
@media(max-width:560px){.tva-tn .tn-compare{grid-template-columns:1fr;}}

.tva-tn .tn-timeline{border-left:2px solid ${P.line};margin:6px 0 0 6px;padding-left:0;}
.tva-tn .tn-tl-item{position:relative;padding:0 0 18px 24px;}
.tva-tn .tn-tl-dot{position:absolute;left:-7px;top:3px;width:12px;height:12px;border-radius:50%;background:#fff;border:2px solid ${P.line};}
.tva-tn .tn-tl-item.here .tn-tl-dot{background:${P.terra};border-color:${P.terra};}
.tva-tn .tn-tl-item b{display:block;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:${P.honey};margin-bottom:3px;}
.tva-tn .tn-tl-item.here b{color:${P.terra};}
.tva-tn .tn-tl-item span{font-size:14px;color:${P.soft};}
.tva-tn .tn-note{font-size:14px;font-style:italic;color:${P.faint};line-height:1.65;margin:14px 0 0;}

.tva-tn .tn-final{background:linear-gradient(160deg,#2A2440,#1B1730);border-radius:18px;padding:26px 28px;margin-top:30px;}
.tva-tn .tn-final-h{font-family:${SERIF};font-size:21px;font-style:italic;color:#fff;margin-bottom:16px;}
.tva-tn .tn-final-link{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:none;border:none;color:#EDE9F6;font-size:15.5px;font-family:inherit;cursor:pointer;padding:9px 0;}
.tva-tn .tn-final-link span{color:${P.honey};font-weight:700;}
.tva-tn .tn-final-link:hover{color:#fff;}
`
