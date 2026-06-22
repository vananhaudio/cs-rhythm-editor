// ClassTiaNot — bài viết "Lớp Tỉa Nốt Guitar" dựng native (full màn hình).
// Cùng ngôn ngữ editorial với Đệm Hát; thêm khối "Chuyển từ → Sang", dải tối, so sánh.
const P = {
  bg: '#F2EEE7', surface: '#FFFFFF', ink: '#211C32', soft: '#5A5470', faint: '#8A8499',
  honey: '#C9711E', honeyTint: '#FBF1E4', terra: '#A8542A', line: '#E4DED4', indigo: '#4338CA', gold: '#E8B96B',
}
const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif"

const levels = [
  {
    no: '01', title: 'Tỉa Nốt Trình Độ 1', sub: 'Guitar căn bản dành cho người mới',
    intro: 'Lớp căn bản dành cho người mới bắt đầu học guitar theo hướng giai điệu. Mục tiêu là giúp bạn làm quen với cây đàn và chơi được những giai điệu đầu tiên.',
    items: [
      ['Nốt nhạc căn bản', 'Làm quen với các nốt đầu tiên, hiểu nốt nằm ở đâu trên đàn và bấm như thế nào.'],
      ['Vị trí trên cần đàn', 'Biết cách tìm nốt, ghi nhớ vị trí và hình dung cây đàn như một bản đồ âm thanh.'],
      ['Chơi giai điệu đơn giản', 'Tập từng câu nhạc ngắn, từng bài dễ, để cảm nhận rằng mình có thể tự chơi giai điệu bằng guitar.'],
      ['Làm quen với bản nhạc', 'Bắt đầu nhìn nốt nhạc, tìm nốt trên đàn và chơi theo từng bước nhỏ.'],
      ['Giọng C và Am', 'Làm quen với các giọng đơn giản, ít thăng giáng, để không bị quá tải ở giai đoạn đầu.'],
    ],
  },
  {
    no: '02', title: 'Tỉa Nốt Trình Độ 2', sub: 'Thị tấu và chơi nhiều giọng trên toàn cần đàn',
    intro: 'Sau khi đã quen với nốt nhạc căn bản và các giai điệu đơn giản, học viên bước sang giai đoạn mở rộng — chơi được nhiều giọng khác nhau trên toàn cần đàn.',
    items: [
      ['Thị tấu', 'Tập nhìn bản nhạc và chơi theo, thay vì chỉ nhớ tay hoặc nhìn tab.'],
      ['Các giọng khác nhau', 'Học cách xử lý bài nhạc có dấu thăng, dấu giáng — không chỉ quanh quẩn ở C và Am.'],
      ['Toàn cần đàn', 'Mở rộng vị trí chơi, không bị bó hẹp ở vài ô phím đầu tiên.'],
      ['Liên kết bản nhạc với cây đàn', 'Khi nhìn bản nhạc, dần hiểu nốt đó nằm ở đâu và nên chọn vị trí nào cho phù hợp.'],
    ],
    from: 'Chơi giai điệu căn bản ở vài giọng dễ', to: 'Nhìn bản nhạc và chơi được nhiều giọng hơn trên toàn cần đàn',
  },
  {
    no: '03', title: 'Tỉa Nốt Trình Độ 3', sub: 'Cảm âm, khuôn hình và thực chiến trên nền bài hát',
    intro: 'Bước đưa việc chơi giai điệu vào thực chiến — nghe nhạc, cảm nhận giai điệu, tìm nốt và chơi theo nền bài hát thật.',
    items: [
      ['Cảm âm', 'Tập nghe giai điệu, nhận ra hướng đi của nốt và tìm lại trên đàn.'],
      ['Khuôn hình', 'Dùng các khuôn hình trên cần đàn để định vị nốt, tìm giai điệu nhanh hơn.'],
      ['Tỉa nốt trên nền nhạc thật', 'Áp dụng vào bài hát, backing track hoặc karaoke — không chỉ chơi bài trong sách.'],
      ['Thực chiến bài hát', 'Tập tìm giai điệu, xử lý câu nhạc, nối các đoạn và chơi sao cho ra bài hát thật.'],
    ],
    from: 'Nhìn bản nhạc để chơi', to: 'Nghe – cảm nhận – tìm nốt – chơi trên nền bài hát thật',
  },
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
          <div className="tn-eyebrow">Lộ trình học Guitar · Thầy Văn Anh</div>
          <h1 className="tn-h1">Lớp Tỉa Nốt Guitar</h1>
          <div className="tn-rule" />
          <p className="tn-sub"><i>Guitar căn bản theo hướng chơi giai điệu — từ những nốt nhạc đầu tiên đến việc nghe, cảm nhận và tỉa nốt trên nền bài hát thật.</i></p>
          <hr className="tn-hr" />
          <p className="tn-p">Khi mới bắt đầu học guitar, nhiều người chỉ có một mong muốn rất đơn giản: <b>Tôi muốn học guitar.</b> Lúc đó, người học chưa cần phải hiểu quá nhiều khái niệm như đệm hát, tỉa nốt, thị tấu, cảm âm hay solo.</p>
          <p className="tn-p">Cây đàn guitar không chỉ dùng để đệm cho giọng hát — nó còn có thể tự vang lên giai điệu của một bài hát. Với những người yêu tiếng đàn, thích những giai điệu vang lên từ chính cây guitar, <b>Tỉa Nốt</b> là một con đường rất phù hợp.</p>
          <p className="tn-p">Ở giai đoạn đầu, bạn không cần hiểu "tỉa nốt" theo nghĩa phức tạp. Bạn chỉ cần hình dung đơn giản: bạn sẽ học cách chơi từng nốt, từng câu nhạc nhỏ, rồi dần dần chơi được giai điệu của bài hát bằng cây đàn guitar.</p>
          <hr className="tn-hr" />
          <h2 className="tn-h2">Lộ trình Tỉa Nốt gồm 3 trình độ</h2>
          <p className="tn-p">Bạn không cần học hết cả hành trình ngay từ đầu. Trước mắt, chỉ cần chọn đúng chặng phù hợp với hiện tại của mình.</p>

          {/* 3 TRÌNH ĐỘ */}
          {levels.map((lv, i) => (
            <div className="tn-level" key={i}>
              <div className="tn-no">{lv.no}</div>
              <div className="tn-level-title">{lv.title}</div>
              <div className="tn-level-sub">{lv.sub}</div>
              <p className="tn-level-intro">{lv.intro}</p>
              <div className="tn-items">
                {lv.items.map(([t, d], j) => (
                  <div className="tn-item" key={j}><b>— {t}</b><span>{d}</span></div>
                ))}
              </div>
              {lv.from && (
                <div className="tn-transition">
                  <div><i>Chuyển từ: {lv.from}</i></div>
                  <div className="tn-arrow">↓</div>
                  <div><i>Sang: {lv.to}</i></div>
                </div>
              )}
            </div>
          ))}

          {/* SAU TỈA NỐT 3 */}
          <h2 className="tn-h2">Sau Tỉa Nốt 3 thì học gì tiếp?</h2>
          <p className="tn-p">Sau khi hoàn thành Tỉa Nốt 1–2–3, nếu muốn đi sâu hơn, học viên có thể tham gia <b>Lớp Hành Trình</b> — giai đoạn phát triển tiếp về cảm âm, hòa âm, ứng dụng nhạc lý, solo guitar và tư duy làm chủ giai điệu trên cây đàn.</p>
          <div className="tn-band">
            <p>Tỉa Nốt 1–2–3 giúp bạn <span className="hl">xây nền và mở đường.</span></p>
            <p>Còn Lớp Hành Trình giúp bạn đi sâu hơn vào thế giới <span className="hl">cảm âm, hòa âm và solo.</span></p>
          </div>

          {/* SO SÁNH */}
          <h2 className="tn-h2">Tỉa Nốt và Đệm Hát liên quan với nhau thế nào?</h2>
          <p className="tn-p">Nếu nhìn theo hướng sư phạm, <b>Tỉa Nốt 1</b> là nền tảng rất gốc của guitar — giúp bạn hiểu cây đàn từ nốt nhạc, vị trí và giai điệu. <b>Đệm Hát 1</b> là lớp căn bản theo nhu cầu đàn hát, giúp bạn học hợp âm, nhịp phách và vừa đàn vừa hát.</p>
          <div className="tn-compare">
            <div className="tn-cmp">
              <div className="tn-cmp-h">Đệm Hát 1</div>
              <div>Giúp bạn <b>bước nhanh vào việc vừa đàn vừa hát</b> — hợp âm, nhịp phách, bắt tông.</div>
            </div>
            <div className="tn-cmp">
              <div className="tn-cmp-h">Tỉa Nốt 1</div>
              <div>Giúp bạn <b>hiểu cây đàn từ gốc</b> — nốt nhạc, vị trí và giai điệu.</div>
            </div>
          </div>
          <p className="tn-p">Bạn có thể bắt đầu bằng Đệm Hát 1 nếu muốn đàn hát ngay. Nhưng nếu muốn học guitar bài bản và hiểu cây đàn sâu hơn, Tỉa Nốt 1 là một lớp nền rất nên học — dù học trước hay bổ sung sau.</p>

          {/* CHỌN CHẶNG */}
          <div className="tn-choose">
            <div className="tn-choose-eyebrow">Bạn muốn bắt đầu từ đâu?</div>
            <div className="tn-choose-h">Chọn đúng chặng phù hợp với mình</div>
            {[['Mới bắt đầu, muốn học từ nền tảng gốc', 'Tỉa Nốt Trình Độ 1'], ['Đã biết nốt căn bản, muốn chơi được nhiều giọng', 'Tỉa Nốt Trình Độ 2'], ['Muốn cảm âm, khuôn hình, chơi trên nền karaoke', 'Tỉa Nốt Trình Độ 3']].map(([a, b], i) => (
              <div className="tn-choose-row" key={i}>{a} → <b>{b}</b></div>
            ))}
            <p className="tn-note">Những nội dung trên là phần khung nổi bật của lộ trình Tỉa Nốt. Khi vào lớp, bạn sẽ được hướng dẫn chi tiết hơn qua bài học, bài tập, app TVA Guitar, nhóm lớp và sự theo dõi trong suốt quá trình học.</p>
          </div>

          {/* CTA */}
          <div className="tn-final">
            <div className="tn-final-h">Bạn muốn biết mình phù hợp trình độ nào?</div>
            <button className="tn-final-link" onClick={onRegister}><span>→</span> Xem lớp Tỉa Nốt sắp khai giảng</button>
            <button className="tn-final-link" onClick={onChat}><span>→</span> Hỏi trợ lý xem mình phù hợp trình độ nào</button>
            <button className="tn-final-link" onClick={onRegister}><span>→</span> Đăng ký giữ chỗ lớp Tỉa Nốt</button>
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
.tva-tn .tn-h1{font-family:${SERIF};font-size:44px;font-weight:600;line-height:1.08;letter-spacing:-.5px;color:${P.ink};margin:0;}
.tva-tn .tn-rule{width:54px;height:3px;background:${P.honey};border-radius:2px;margin:16px 0;}
.tva-tn .tn-sub{font-size:16px;color:${P.soft};margin:0;line-height:1.6;}
.tva-tn .tn-hr{border:none;border-top:1px solid ${P.line};margin:26px 0;}
.tva-tn .tn-p{font-size:16px;line-height:1.75;color:${P.soft};margin:0 0 16px;}
.tva-tn .tn-p b{color:${P.ink};}
.tva-tn .tn-h2{font-family:${SERIF};font-size:29px;font-weight:600;color:${P.ink};margin:32px 0 14px;}
@media(max-width:560px){.tva-tn .tn-h1{font-size:34px;}.tva-tn .tn-h2{font-size:24px;}}

.tva-tn .tn-level{background:#FCFAF6;border-left:3px solid ${P.terra};border-radius:0 16px 16px 0;padding:24px 26px;margin:18px 0;}
.tva-tn .tn-no{font-family:${SERIF};font-size:34px;font-weight:700;color:${P.honey};opacity:.5;line-height:1;}
.tva-tn .tn-level-title{font-family:${SERIF};font-size:23px;font-weight:600;color:${P.ink};margin-top:6px;}
.tva-tn .tn-level-sub{font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:${P.honey};margin:4px 0 12px;}
.tva-tn .tn-level-intro{font-size:15px;color:${P.soft};line-height:1.65;margin:0 0 12px;}
.tva-tn .tn-items{display:flex;flex-direction:column;}
.tva-tn .tn-item{padding:12px 0;border-top:1px solid ${P.line};}
.tva-tn .tn-item b{display:block;font-size:14.5px;color:${P.ink};margin-bottom:3px;}
.tva-tn .tn-item span{font-size:13.5px;color:${P.soft};line-height:1.55;}
.tva-tn .tn-transition{margin-top:14px;padding-top:14px;border-top:1px solid ${P.line};text-align:center;font-size:13.5px;color:${P.soft};}
.tva-tn .tn-transition i{font-style:italic;}
.tva-tn .tn-arrow{color:${P.honey};margin:4px 0;}

.tva-tn .tn-band{background:linear-gradient(160deg,#2A2440,#1B1730);border-radius:16px;padding:24px 28px;margin:8px 0 8px;}
.tva-tn .tn-band p{font-family:${SERIF};font-size:18px;color:#EDE9F6;line-height:1.5;margin:0 0 10px;}
.tva-tn .tn-band p:last-child{margin:0;}
.tva-tn .tn-band .hl{color:${P.gold};font-style:italic;}

.tva-tn .tn-compare{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:6px 0 18px;}
.tva-tn .tn-cmp{background:#fff;border:1px solid ${P.line};border-radius:14px;padding:16px;font-size:14px;color:${P.soft};line-height:1.55;}
.tva-tn .tn-cmp b{color:${P.ink};}
.tva-tn .tn-cmp-h{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${P.honey};margin-bottom:8px;}
@media(max-width:560px){.tva-tn .tn-compare{grid-template-columns:1fr;}}

.tva-tn .tn-choose{background:${P.honeyTint};border-radius:18px;padding:26px;margin-top:30px;}
.tva-tn .tn-choose-eyebrow{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${P.faint};}
.tva-tn .tn-choose-h{font-family:${SERIF};font-size:24px;font-weight:600;color:${P.ink};margin:6px 0 16px;}
.tva-tn .tn-choose-row{background:#fff;border-left:3px solid ${P.honey};border-radius:0 10px 10px 0;padding:13px 16px;font-size:14.5px;color:${P.soft};margin-bottom:9px;}
.tva-tn .tn-choose-row b{color:${P.ink};}
.tva-tn .tn-note{font-size:13.5px;font-style:italic;color:${P.faint};line-height:1.65;margin:14px 0 0;}

.tva-tn .tn-final{background:linear-gradient(160deg,#2A2440,#1B1730);border-radius:18px;padding:26px 28px;margin-top:30px;}
.tva-tn .tn-final-h{font-family:${SERIF};font-size:21px;font-style:italic;color:#fff;margin-bottom:16px;}
.tva-tn .tn-final-link{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:none;border:none;color:#EDE9F6;font-size:15.5px;font-family:inherit;cursor:pointer;padding:9px 0;}
.tva-tn .tn-final-link span{color:${P.honey};font-weight:700;}
.tva-tn .tn-final-link:hover{color:#fff;}
`
