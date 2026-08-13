// ============================================================================
// Sinh SQL tái cấu trúc khoá DH1 "Khởi đầu đam mê — Đệm hát cơ bản" theo giáo
// trình sách "Đệm hát 1" (5 Level: Quạt–Nghe–Nhịp–Hát–Đệm).
//   Chạy:  node db/gen_dh1.cjs   →  db/dh1_restructure.sql
//
// NGUYÊN TẮC (theo tiền lệ gen_dh2.cjs + các file DH1 sẵn có):
//   • Idempotent: lookup khoá theo tên, module theo tên/id, bài theo UUID cố định.
//   • XOÁ HẲN 3 chương cũ (Hợp âm/Quạt/Nhịp phách) theo quyết định thầy 13/08/2026
//     (khối DELETE cuối file). GIỮ "Kiểm tra đầu vào" + Level 3 (module vòng hoà âm).
//   • Tái dùng: module "Vòng hoà âm" (319654a9) làm module Level 3 — giữ nguyên 8
//     bài strum đã có (progress học viên không mất), chỉ thêm bài flow 3.x lên trên.
//   • Mỗi bài = lesson_type 'flow'; slides theo khung 6 phần ①→⑥ của sách, gắn tag
//     logic app (NHAN/NGHI/LAM/NGAM/DAN) + tool sẵn có (guitar_chord, guitar_strum,
//     guitar_ear, guitar_tool tempo/tuner, embedded_tool chords). Chỗ app CHƯA có
//     tool (drone, Strum Score theo vòng, backing, chẩn đoán lỗi 2 tay, tách bass)
//     → slide callout "⏳ đang xây dựng" (backlog app/mapping.md).
//   • UUID bài mới: d1c00<L><NN>-0000-4000-8000-000000000000 (L=level, NN=chỉ số).
//     Tự kiểm mỗi Level: d1c00<L>99-...
// ============================================================================
const fs = require('fs')

// ---- Sơ đồ hợp âm (frets & freqs theo dây 6→1; -1 = câm) ----
const CH = {
  Am:    { frets:[-1,0,2,2,1,0],    freqs:[0,110.00,164.81,220.00,261.63,329.63],  cap:'Am (La thứ) — bass ở dây 5. Ngón 1 dây 2/f1, ngón 2 dây 4/f2, ngón 3 dây 3/f2.' },
  C:     { frets:[-1,3,2,0,1,0],    freqs:[0,130.81,164.81,196.00,261.63,329.63],  cap:'C (Đô trưởng) — bass ở dây 5. Ngón 1 dây 2/f1, ngón 2 dây 4/f2, ngón 3 dây 5/f3.' },
  Dm:    { frets:[-1,-1,0,2,3,1],   freqs:[0,0,146.83,220.00,293.66,349.23],        cap:'Dm (Rê thứ) — bass ở dây 4.' },
  Fmaj7: { frets:[-1,-1,3,2,1,0],   freqs:[0,0,174.61,220.00,261.63,329.63],        cap:'Fmaj7 — bass ở dây 4; giữ ngón 1 làm điểm tựa với C.' },
  E:     { frets:[0,2,2,1,0,0],     freqs:[82.41,123.47,164.81,207.65,246.94,329.63],cap:'E (Mi trưởng) — bass ở dây 6, quạt đủ 6 dây.' },
  G:     { frets:[3,2,0,0,0,3],     freqs:[98.00,123.47,146.83,196.00,246.94,392.00],cap:'G (Sol trưởng) — bass ở dây 6, quạt đủ 6 dây.' },
  G7:    { frets:[3,2,0,0,0,1],     freqs:[98.00,123.47,146.83,196.00,246.94,349.23],cap:'G7 — bass ở dây 6, quạt đủ 6 dây.' },
  E7:    { frets:[0,2,0,1,0,0],     freqs:[82.41,123.47,146.83,207.65,246.94,329.63],cap:'E7 — bass ở dây 6 (Mi trầm), quạt đủ 6 dây.' },
}

// ---- slide builders ----
let _sid = 0
const sid = () => 's' + (++_sid)
const P = (t) => `<p style='font-size:16px; line-height:1.7; margin:0 0 12px; color:#3A352F;'>${t}</p>`
const box = (label, t, accent='#BF5A37', bg='#FBF6ED') =>
  `<div style='background:${bg}; border-left:4px solid ${accent}; border-radius:6px; padding:14px 16px;'>` +
  (label ? `<div style='font-size:11px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:${accent}; margin-bottom:6px;'>${label}</div>` : '') +
  `<div style='font-size:16px; line-height:1.65; color:#2A2622;'>${t}</div></div>`

const t   = (logic, title, html) => ({ logic, type:'text', title, content: html })
const chord = (nm, extra='') => ({ logic:'NHAN', type:'guitar_chord', title:`Hợp âm ${nm}`,
  interactive:{ name:nm, frets:CH[nm].frets, freqs:CH[nm].freqs, caption: CH[nm].cap + (extra?' '+extra:'') + " Bấm <b>Nghe</b> rồi gảy thử trên đàn." } })
const drone = (nm='Am', seconds=12, caption='') => ({ logic:'LAM', type:'guitar_drone', title:`Ngân dài ${nm}`,
  interactive:{ name:nm, freqs: CH[nm].freqs.filter(f => f > 0), seconds, caption } })
const ear = (title, pool, rounds=5) => ({ logic:'LAM', type:'guitar_ear', title, interactive:{ pool, rounds, passScore: Math.ceil(rounds*0.6) } })
const strum = (title, sequence) => ({ logic:'LAM', type:'guitar_strum', title, interactive:{ sequence } })
const metro = (content) => ({ logic:'LAM', type:'guitar_metronome', title:'Metronome',
  interactive:{ tempo:70, beatsPerBar:4, caption:(content||'') } })
const tuner = (content) => ({ logic:'LAM', type:'guitar_tool', title:'Lên dây', content,
  interactive:{ tool:'tuner', label:'Mở Tuner — Lên dây', sub:'Chỉnh đàn trước khi tập', buttonPos:'inline' } })
const embedChord = (nm) => ({ logic:'LAM', type:'embedded_tool', title:`Luyện hợp âm ${nm}`,
  content:`Luyện hợp âm ${nm}`, interactive:{ url:`https://chords-vananhaudio.netlify.app?chord=${nm}` } })
const todo = (title, txt) => ({ logic:'LAM', type:'text', title,
  content: box('🎧 Trên App', txt + ` <span style='color:#9A8F7E;'>(⏳ tính năng đang xây dựng — hiện tập theo hướng dẫn trên; sẽ bổ sung công cụ này.)</span>`, '#3E7C74', '#EAF3F1') })
const check = (title, items) => ({ logic:'NGAM', type:'checklist', title, interactive:{ items } })
const fr = (nm) => CH[nm].freqs.filter(f => f > 0)   // freqs các dây kêu của hợp âm
const strumScore = (chords, o={}) => ({ logic:'LAM', type:'guitar_strumscore', title:o.title||'Strum Score',
  interactive:{ chords, beatsPerBar:o.bpb||4, tempo:o.tempo||70, freqsList:(o.freqsList||chords.map(c=>CH[c]?fr(c):[])), caption:o.caption||'' } })
const backing = (chords, o={}) => ({ logic:'LAM', type:'guitar_backing', title:o.title||'Nhạc nền',
  interactive:{ chords, tempo:o.tempo||70, beatsPerBar:o.bpb||4, freqsList:chords.map(c=>CH[c]?fr(c):[]), caption:o.caption||'' } })
const listen = (o) => ({ logic:'LAM', type:'guitar_listen', title:o.title||'Nghe & chọn',
  interactive:{ question:o.q, plays:o.plays, options:o.options, answer:o.answer, explain:o.explain } })

// helper phần: KHÁM PHÁ / HỌC / HIỂU / ĐẠT bằng text
const kham = (html) => t('DAN', '① Khám phá', html)
const hoc  = (html) => t('NHAN', '② Học', html)
const hieu = (html) => t('NGHI', '③ Hiểu', html)
const dat  = (line) => t('DAN', '⑥ Đạt', box('Bạn đạt bài này khi…', `<b>${line}</b>`, '#3E7C74', '#EAF3F1'))

// ============================================================================
// NỘI DUNG 5 LEVEL — mỗi lesson: { slug, title, codes, xp, slides:[...] }
// ============================================================================
const LEVELS = [
  { lvl:1, name:'Level 1: Một hợp âm · Quạt đều · Nghe chủ động', lessons:[
    { slug:'dh11', n:1, title:'Bài 1.1 — Am, một tiếng sạch', xp:20, slides:[
      kham(P('Cầm đàn thoải mái, vai và tay thả lỏng. Bấm Am rồi gảy lần lượt từng dây (dây 5, 4, 3, 2, 1). Nghe xem dây nào kêu trong, dây nào bị tịt hoặc rè.')),
      chord('Am','Ba mẹo để dây kêu sạch: đặt đầu ngón sát bên trái thanh phím; dựng ngón thẳng đứng; bấm bằng đầu ngón, đủ lực nhưng không gồng.'),
      hieu(P('“Tiếng sạch” là mọi dây trong hợp âm đều kêu rõ — không dây nào bị <b>tịt</b> (không kêu) hay <b>rè</b> (rẹt rẹt). Dây tịt thường do bấm chưa đủ lực hoặc bụng ngón chạm dây; dây rè do ngón chưa sát phím.')),
      t('NHAN','④ Nghe', box('🎧 Trên App','Nghe hai mẫu — một tiếng Am sạch và một tiếng Am bị tịt — tập phân biệt tới khi nghe ra ngay. Có <b>video thầy đánh mẫu</b> cách bấm Am sạch.','#3E7C74','#EAF3F1')),
      strum('⑤ Làm — gảy rời 5 dây của Am', [5,4,3,2,1]),
      dat('Bấm Am và quạt xuống một cái — cả 5 dây kêu rõ, tiếng gọn, không rè, không tịt.'),
    ]},
    { slug:'dh12', n:2, title:'Bài 1.2 — Quạt đều như nhịp tim', xp:20, slides:[
      kham(P('Trước khi cầm đàn, vỗ tay đều như tiếng đồng hồ tích – tắc – tích – tắc. Giữ các tiếng vỗ cách nhau bằng nhau. Đó chính là “đều”.')),
      hoc(P('Mỗi tiếng đều đó là một <b>phách</b> — ta chơi bằng một nốt đen. Mỗi phách quạt xuống một cái, vừa quạt vừa đếm thành tiếng: 1 – 2 – 3 – 4.')),
      hieu(P('“Đều” có hai phần: khoảng cách giữa các lần quạt bằng nhau, và độ mạnh gần như nhau. Metronome là “nhịp tim” của buổi tập — giữ khoảng cách luôn đều để tai bạn rảnh mà lắng nghe.')),
      metro('④⑤ Bật metronome ở khoảng 60. Quạt sao cho tiếng đàn rơi đúng vào tiếng “click”, đếm 1–2–3–4 theo. Khi quen thì tăng dần 70 → 80.'),
      strumScore(['Am','Am','Am','Am'], { tempo:60, caption:'Bấm ▶ — ô phách sáng chạy theo nhịp, phách 1 tự gảy Am. Quạt xuống mỗi phách sao cho khớp ô đang sáng.' }),
      dat('Quạt nốt đen đều, khớp metronome, giữ liên tục ít nhất 16 nhịp; miệng đếm 1–2–3–4 không rối.'),
    ]},
    { slug:'dh13', n:3, title:'Bài 1.3 — Nghe cả khối hợp âm', xp:20, slides:[
      kham(P('Quạt Am một cái, rồi nhắm mắt và im lặng nghe. Đừng quạt tiếp. Nghe cho tới khi tiếng đàn tắt hẳn. Tiếng ngân kéo dài bao lâu?')),
      hoc(P('Mỗi lần quạt tạo ra một “đám mây âm thanh” gồm nhiều dây hoà quyện. Việc của bạn là hướng tai vào cả khối âm đó và nghe nó trọn vẹn — chưa cần tách riêng dây nào.')),
      hieu(P('Người mới thường “chơi cho xong” rồi vội quạt cái tiếp theo, nên chưa bao giờ thật sự nghe hợp âm của mình. Nghe được cả khối âm cho tới khi tắt là bước đầu của tai nghe chủ động.')),
      drone('Am', 12, 'Bấm nút để Am ngân dài. Nghe trọn tiếng ngân tới khi tắt — thử đếm xem bạn còn nghe được âm trong bao nhiêu giây.'),
      dat('Quạt Am và nghe trọn khối âm cho tới khi tắt, nói được lúc nào tiếng còn vang, lúc nào đã hết.'),
    ]},
    { slug:'dh14', n:4, title:'Bài 1.4 — Đi vào bên trong: dây trầm và dây 1', xp:20, slides:[
      kham(P('Quạt Am và nghe cả khối như bài trước. Bây giờ thử “tìm” trong khối âm đó dây trầm nhất — dây nghe dày và thấp nhất.')),
      hoc(P('Với Am, dây thấp nhất đang vang là <b>dây 5 — nốt La</b>. Dây cao nhất là <b>dây 1 — nốt Mi</b>. Đây là hai “mỏ neo” để tai bám vào hai đầu của khối âm.')),
      hieu(P('Nghe chủ động là: hướng chú ý vào MỘT dây trong khi vẫn nghe cả khối. Cùng lúc, đọc tên dây/nốt bằng miệng để tai và trí nhớ gắn tên vào âm thanh.')),
      ear('④ Nghe & đoán: dây trầm (5) hay dây 1?', [5,1], 6),
      dat('Nghe và gọi đúng dây trầm nhất (dây 5 · La) và dây 1 (Mi) khoảng 4/5 lần, trong khi vẫn nghe được cả khối.'),
    ]},
    { slug:'dh15', n:5, title:'Bài 1.5 — “Ừm…” giọng hoà vào đàn', xp:20, slides:[
      kham(P('Quạt Am, rồi ngân bằng giọng một âm “ừm…” bất kỳ. Nghe xem giọng bạn có êm với tiếng đàn không, hay nghe cấn.')),
      hoc(P('Một âm “hợp” nghe êm, như tan vào tiếng đàn. Một âm “chỏi” nghe cấn tai, chông chênh. Nếu đang chỏi, nhích giọng lên/xuống một chút để tìm âm hợp.')),
      hieu(P('Khi ngân, giọng bạn giống như một dây đàn nữa cộng thêm vào hợp âm. Đây là bước đầu để sau này tiếng đàn hoà vào tiếng hát của bạn.')),
      drone('Am', 14, 'Cho Am ngân dài rồi ngân giọng “ừm” bám theo tiếng đàn. Tìm âm nghe êm (tan vào tiếng đàn), tránh âm cấn tai.'),
      dat('Ngân được ít nhất 2 âm hoà hợp với Am và tự nhận ra khi nào âm của mình hợp, khi nào chỏi.'),
    ]},
    { slug:'dh16', n:6, title:'Bài 1.6 — Ghép lại: quạt · đếm · nghe · ừm', xp:30, slides:[
      kham(P('Thử làm mọi thứ cùng lúc: quạt đều, đếm 1–2–3–4, nghe dây, thỉnh thoảng ngân. Thấy quá tải là bình thường — ta ghép từng lớp.')),
      hoc(P('Khi quá tải, có thứ tự ưu tiên: <b>giữ nhịp trước, nghe sau</b>. Thà nghe ít mà tay vẫn đều, còn hơn nghe kỹ mà rớt nhịp.')),
      metro('⑤ Bật metronome, chạy bài ghép theo lớp: (1) quạt đều → (2) thêm đếm → (3) thêm nghe một dây → (4) thỉnh thoảng ngân một âm hợp. Rớt nhịp thì bỏ bớt một lớp rồi thêm lại.'),
      dat('Giữ quạt đều và đếm suốt 8 ô nhịp, xen kẽ nghe được dây hoặc ngân một âm hợp, mà không rớt nhịp.'),
    ]},
  ], check:{ slug:'dh1check', title:'Tự kiểm Level 1', items:[
    'N1 — Bấm Am, cả 5 dây kêu rõ, không rè','N2 — Quạt xuống cả khối, tiếng gọn rõ','N3 — Quạt nốt đen đều ≥ 16 nhịp liên tục',
    'N4 — Vừa quạt vừa đếm 1–2–3–4 khớp click','N5 — Nghe trọn khối âm tới khi tắt','N6 — Nghe & gọi đúng dây thấp nhất (dây 5 · La)',
    'N7 — Nghe & gọi đúng dây 1 (Mi)','N8 — Đọc tên dây/nốt trong khi vẫn nghe','N9 — Ngân ≥ 2 âm hoà hợp với Am, nhận ra hợp/chỏi',
  ]}},

  { lvl:2, name:'Level 2: Đổi hai hợp âm · Nhịp không vỡ', lessons:[
    { slug:'dh21', n:1, title:'Bài 2.1 — Hai thế & tư duy ngón', xp:20, slides:[
      kham(P('Bấm Am, rồi bấm C, rồi lại Am. Chưa cần nhanh. Quan sát: ngón nào phải nhấc lên, ngón nào giữ nguyên, ngón nào đi xa nhất?')),
      chord('C','Bí mật khiến Am↔C dễ: ngón 1 (dây 2) và ngón 2 (dây 4) GIỮ NGUYÊN ở cả hai hợp âm; chỉ ngón 3 di từ dây 3 sang dây 5.'),
      hieu(P('Đây là “tư duy ngón trụ”: đừng nhấc cả bàn tay rồi đặt lại. Tìm ngón nào ở yên làm điểm tựa, ngón nào di ít nhất. Tay đi ít thì đổi nhanh và nhịp không vỡ.')),
      t('NHAN','④ Nghe', box('🎧 Trên App','Nghe mẫu C sạch; vừa bấm vừa nghe: khi ghì quá chặt tiếng có gì khác so với bấm vừa đủ? Có <b>video thầy đánh mẫu</b> ngón trụ Am↔C.','#3E7C74','#EAF3F1')),
      embedChord('C'),
      dat('Đổi được Am ↔ C với ngón 1 và ngón 2 giữ nguyên làm điểm tựa, chỉ ngón 3 di; bấm vừa đủ lực.'),
    ]},
    { slug:'dh22', n:2, title:'Bài 2.2 — Nhấc & chuẩn bị: vào đúng phách', xp:20, slides:[
      kham(P('Đổi Am → C nhưng cố ý đợi đến khi cần mới nhấc ngón. Bạn sẽ thấy hợp âm mới luôn vào trễ. Vấn đề không phải tay chậm — mà là chuẩn bị quá muộn.')),
      hoc(P('Một ô nhịp có 4 phách. Hợp âm mới cần vang ở phách 1 của ô sau. Muốn vậy, tay trái phải bắt đầu chuẩn bị ngay <b>sau phách 4</b> của ô trước — không đợi đến phách 1.')),
      hieu(P('Ngón 3 rời dây 3 và “bay” sang dây 5 trong khoảng lặng ngắn sau phách 4, để đúng phách 1 nó đã ở chỗ mới. Đếm “…4-và-1”: chữ “và” là lúc ngón bắt đầu bay.')),
      metro('④⑤ Metronome ~60. Tập |Am · · · | C · · · | thật chậm, bắt đầu chuyển ngay sau phách 4; nghe C có vang đúng tiếng click phách 1 không. Có <b>video thầy đánh mẫu</b> ngón bay.'),
      dat('Hợp âm mới vang đúng phách 1, nhờ đã bắt đầu chuẩn bị từ sau phách 4.'),
    ]},
    { slug:'dh23', n:3, title:'Bài 2.3 — Tay phải không đứt', xp:20, slides:[
      kham(P('Quạt đều Am theo metronome, rồi thử đổi sang C. Rất có thể tay phải khựng lại đúng lúc đổi. Đó là điều Level 2 phải sửa.')),
      hoc(P('Nguyên tắc: <b>tay phải là dòng chảy</b> — không dừng, không chậm lại vì tay trái đang bận đổi. Kể cả khi tay trái chưa kịp bấm sạch, tay phải vẫn quạt đúng nhịp. Giữ nhịp trước, tiếng sạch sau.')),
      hieu(P('Miệng đếm chính là “dây an toàn” của nhịp. Khi tay trái đổi, nếu miệng vẫn đếm 1–2–3–4 đều, tay phải sẽ bám theo tiếng đếm mà không khựng.')),
      metro('⑤ Metronome bật liên tục. Quạt đều + đổi + miệng đếm to; giữ 8 ô nhịp có điểm đổi, không hụt phách nào.'),
      strumScore(['Am','C','Am','C'], { tempo:60, caption:'Quạt đều theo ô sáng, đổi hợp âm đúng phách 1 mỗi ô — chú ý KHÔNG khựng tay phải ở điểm đổi.' }),
      dat('Tay phải quạt nốt đen đều xuyên qua điểm đổi Am↔C, không khựng, không đổi tốc độ; miệng vẫn đếm.'),
    ]},
    { slug:'dh24', n:4, title:'Bài 2.4 — Tai kiểm soát: dây 1 và bass', xp:20, slides:[
      kham(P('Đổi Am ↔ C và tự hỏi: có phải MỌI thứ đều đổi không? Nghe kỹ, có thứ đổi và có thứ giữ nguyên.')),
      hoc(P('Hai điểm neo: <b>dây 1 (Mi) GIỮ NGUYÊN</b> ở cả Am và C — mỏ neo soát tay phải. <b>Bass ĐỔI: La (Am) → Đô (C)</b> — chỗ nghe “hợp âm đã sang chưa”.')),
      hieu(P('Nghe chủ động ở Level 2 là biết cái gì phải đều (dây 1) và cái gì phải đổi (bass). Nghe được cả hai, không cần nhìn tay cũng biết đổi đúng hay chưa.')),
      ear('④ Nghe & đoán: dây 1 (giữ) hay bass (đổi)?', [1,5], 6),
      dat('Khi đổi Am↔C, nghe được dây 1 giữ đều và bass đổi La→Đô, nghe ra sự thay đổi màu hoà âm — không nhìn tay.'),
    ]},
    { slug:'dh25', n:5, title:'Bài 2.5 — Tai sửa tay', xp:20, slides:[
      kham(P('Lần này, khi đổi bị lỗi, đừng vội nhìn tay. Nhắm mắt và hỏi: lỗi này nghe ra ở đâu?')),
      hoc(P('Tai chỉ ra lỗi ở tay nào. <b>Âm cao / dây 1 hụt, mất, không đều → lỗi TAY PHẢI</b> (quạt không tới, khựng). <b>Bass đổi đúng lúc nhưng tiếng đứt / rè → lỗi TAY TRÁI</b> (cách chuyển ngón, bấm chưa kịp sạch).')),
      hieu(P('Đây là lúc tai trở thành bộ phận kiểm tra kỹ thuật. Thay vì đoán mò rồi sửa lung tung, bạn nghe ra lỗi ở đâu rồi chỉ sửa đúng chỗ đó.')),
      listen({ q:'Khi đổi hợp âm, nếu ÂM CAO (dây 1) bỗng hụt hoặc không đều — lỗi thường ở tay nào?', plays:[{label:'Nghe đổi Am → C', chords:[fr('Am'),fr('C')]}], options:['Tay phải (quạt không tới, hoặc khựng)','Tay trái (bấm chưa kịp sạch)'], answer:0, explain:'Dây 1 do tay phải quạt tới. Nếu bass đổi đúng lúc mà tiếng vẫn đứt/rè thì mới là lỗi tay trái. Tai chỉ đúng chỗ để sửa.' }),
      dat('Chỉ bằng cách nghe, đoán đúng lỗi đang ở tay phải hay tay trái, và sửa trúng chỗ.'),
    ]},
    { slug:'dh26', n:6, title:'Bài 2.6 — Ghép Am ↔ C, rồi mở rộng cặp', xp:30, slides:[
      kham(P('Chạy vòng |Am |C |Am |C | với đầy đủ: quạt đều, đếm, nghe dây 1 và bass. Ghép từng lớp.')),
      hoc(P('Khi Am↔C đã mượt, tư duy vừa xây (ngón trụ · chuẩn bị trước · hai điểm neo) mang thẳng sang các cặp khác: <b>C↔Fmaj7, C↔Dm, Am↔Dm</b> (bass vẫn ở dây 5/dây 4).')),
      chord('Dm'), chord('Fmaj7'),
      metro('⑤ Backing/metronome: chạy Am–C tới khi 8 lần đổi liên tục không vỡ nhịp, rồi áp cùng cách sang C–Fmaj7, C–Dm, Am–Dm.'),
      dat('Đổi qua lại hai hợp âm, giữ nhịp liên tục, tay phải không khựng, tai nghe được dây 1 và bass — với Am↔C và ít nhất một cặp mở rộng.'),
    ]},
    { slug:'dh27', n:7, title:'Bài 2.7 — Bắt đầu từ dây bass (chặn ngón cái)', xp:30, slides:[
      kham(P('Bấm E và quạt cả 6 dây — nghe tiếng trầm mới, sâu hơn Am/C. Rồi bấm C mà quạt cả 6 dây: dây 6 lọt vào làm hợp âm nghe đục. Vậy mỗi hợp âm cần bắt đầu quạt từ một dây khác nhau.')),
      hoc(P('Mỗi hợp âm có một <b>dây bass</b> — bắt đầu quạt từ đúng dây đó. Am, C bass ở dây 5 → không để dây 6 kêu. E, G, G7 bass ở dây 6 → quạt cả 6 dây.')),
      chord('E'), chord('G'), chord('G7'),
      hieu(box('Chặn bằng ngón cái','Với hợp âm bass ở dây 5 (Am, C), vắt ngón cái qua đầu cần đàn, chạm nhẹ dây 6 cho nó câm. Ngón cái không bấm phím — chỉ “đậu” lên dây 6. Nhờ vậy tay phải cứ quạt cả 6 dây mà dây 6 vẫn im.')),
      t('NHAN','④ Nghe', box('🎧 Trên App','Nghe C quạt cả 6 dây (đục) và C chặn dây 6 (gọn); nghe Am → E bass “rơi xuống” dây 6. Có <b>video thầy đánh mẫu</b> chặn ngón cái (thumb-mute).','#3E7C74','#EAF3F1')),
      dat('Quạt Am/C mà dây 6 im (nhờ ngón cái), quạt E/G/G7 đủ 6 dây bass rõ, và chỉnh được phạm vi quạt khi đổi qua lại.'),
    ]},
    { slug:'dh28', n:8, title:'Bài 2.8 — Ba cặp có bass dây 6', xp:30, slides:[
      kham(P('Mang mọi thứ đã học — ngón trụ, chuẩn bị trước, tay phải đều, hai điểm neo — vào ba cặp mới. Việc mới duy nhất là chỉnh phạm vi quạt khi đổi giữa dây 5 và dây 6.')),
      hoc(P('<b>Am↔E</b>: gần cùng thế bấm, dời một dây; bass La(d5)→Mi(d6), dây 1 giữ. <b>C↔G7</b>: bass Đô(d5)→Sol(d6). <b>C↔G</b>: xa nhất, bass Đô→Sol và cả dây 1 đổi (Mi→Sol) — để cuối.')),
      hieu(P('Điểm mới duy nhất: sang hợp âm dây 6 thì mở phạm vi quạt xuống dây 6; về hợp âm dây 5 thì ngón cái chặn lại. Tư duy ngón trụ và chuẩn bị vẫn y như cũ.')),
      backing(['Am','E','C','G','C','G7'], { tempo:64, caption:'Bật nền các cặp có bass dây 6. Nghe bass “nhảy” giữa dây 5 và dây 6; quạt theo và chỉnh phạm vi quạt cho khớp.' }),
      dat('Đổi được cả ba cặp bass dây 6 mà nhịp không vỡ, phạm vi quạt đổi đúng, tai nghe được bass nhảy dây.'),
    ]},
  ], check:{ slug:'dh2check', title:'Tự kiểm Level 2', items:[
    'Đổi Am↔C mà tay phải không khựng','Hợp âm mới vào đúng phách 1 (chuẩn bị từ sau phách 4)','Vẫn đếm 1–2–3–4 xuyên điểm đổi',
    'Nghe dây 1 (Mi) đều và bass (La→Đô) đổi','Chỉ nghe, đoán được lỗi ở tay phải hay tay trái','Nghe ra sự thay đổi màu hoà âm Am→C',
    'Tận dụng ngón trụ (ngón 1&2 giữ, chỉ ngón 3 di)','Bấm vừa đủ lực, tay không đau khi luyện lâu','Quạt được cặp bass dây 6 (Am–E, C–G7…), chỉnh phạm vi quạt',
  ]}},

  { lvl:3, name:'Level 3: Vòng hoà âm · Biết mình đang ở đâu', reuseModule:'319654a9-f926-4b68-8adb-d5a1f566718d', lessons:[
    { slug:'dh30', n:0, title:'Bài 3.0 — Ôn dây 6 & hợp âm mới E7', xp:20, slides:[
      kham(P('Nhớ lại Bài 2.7: hợp âm bass ở dây 5 (Am, C) thì chặn dây 6 bằng ngón cái; bass ở dây 6 thì quạt đủ 6 dây. Level 3 dùng nhiều hợp âm dây 6 hơn — và một hợp âm mới: E7.')),
      chord('E7'),
      hieu(P('Trong một vòng, hợp âm bass dây 5/4 (C, Am, Dm) và bass dây 6 (G, G7, E7) đứng xen nhau, nên phạm vi quạt đổi liên tục. Ngón cái chặn dây 6 giúp quạt “một mạch” mà không phải né.')),
      t('NHAN','④ Nghe', box('🎧 Trên App','Nghe E7 và so với E; nghe bass dây 6 “xuống sâu”. Có <b>video thầy đánh mẫu</b> phạm vi quạt dây 6.','#3E7C74','#EAF3F1')),
      dat('Bấm E7 rõ, quạt đủ 6 dây; khi xen hợp âm dây 5 với dây 6, chỉnh được phạm vi quạt đúng lúc.'),
    ]},
    { slug:'dh31', n:1, title:'Bài 3.1 — Ghép 4 hợp âm thành một vòng', xp:20, slides:[
      kham(P('Đến giờ bạn đổi qua lại hai hợp âm. Bây giờ đi một chuỗi bốn hợp âm rồi quay lại đầu — đó là một “vòng”. Ví dụ xuyên suốt: C → Am → Dm → G7 → (về) C.')),
      chord('C'), chord('Am'), chord('Dm'), chord('G7'),
      hieu(P('Hết hợp âm thứ tư (G7) thì quay lại hợp âm thứ nhất (C) — gọi là “khép vòng”. Vòng cứ thế lặp mãi. Nhiệm vụ đầu tiên: đi trọn vòng mà tay phải vẫn đều.')),
      metro('⑤ Đi hết vòng thật chậm: mỗi hợp âm một ô nhịp (4 phách), quạt đều, đếm 1–2–3–4. C/Am/Dm chặn dây 6; G7 quạt đủ 6 dây. Khép về C rồi đi tiếp.'),
      dat('Đi trọn vòng C–Am–Dm–G7 rồi khép về C, lặp được vài vòng, tay phải đều và không đứt.'),
    ]},
    { slug:'dh32', n:2, title:'Bài 3.2 — Giữ dòng chảy: chuẩn bị liên tục', xp:20, slides:[
      kham(P('Trong một vòng, vừa xong hợp âm này thì đã phải nghĩ tới hợp âm kế — không lúc nào được “nghỉ tay”.')),
      hoc(P('“Không reset”: tay trái đừng buông hẳn rồi mới đi tìm hợp âm kế. Vòng có bốn mối nối (C→Am, Am→Dm, Dm→G7, G7→C), mỗi mối nối chuẩn bị sau phách 4 — nay là một chuỗi liên tục.')),
      metro('⑤ Metronome liên tục; mỗi mối nối chuẩn bị ngay sau phách 4. Mối nối nào yếu → tách luyện riêng như một cặp rồi ghép lại.'),
      strumScore(['C','Am','Dm','G7'], { tempo:66, caption:'Ô phách sáng chạy quanh vòng, phách 1 mỗi ô tự đổi hợp âm. Quạt đều, chuẩn bị hợp âm kế ngay sau phách 4 — không để “khoảng chết” ở mối nối.' }),
      dat('Lặp vòng nhiều lần liên tục, mỗi hợp âm mới vào đúng phách 1, không còn “khoảng chết” ở mối nối nào.'),
    ]},
    { slug:'dh33', n:3, title:'Bài 3.3 — Biết mình đang ở đâu', xp:20, slides:[
      kham(P('Khi lặp vòng nhiều lần, rất dễ “trôi” — đang chơi mà không biết mình đang ở hợp âm thứ mấy.')),
      hoc(P('Đánh số vị trí trong vòng: C là 1, Am là 2, Dm là 3, G7 là 4. Lúc nào cũng biết mình đang ở vị trí nào và hợp âm nào sẽ đến tiếp.')),
      hieu(P('Nhớ vị trí không phải đọc thuộc tên bốn hợp âm, mà là cảm được “đang ở đoạn nào của vòng” và hợp âm kế sắp tới — để tay chuẩn bị trước.')),
      listen({ q:'Trong vòng C–Am–Dm–G7, ngay sau Dm là hợp âm nào?', plays:[{label:'Nghe vòng', chords:[fr('C'),fr('Am'),fr('Dm'),fr('G7')]}], options:['G7','C','Am','Dm'], answer:0, explain:'Thứ tự vòng: C → Am → Dm → G7 → (về) C. Luôn biết mình đang ở đâu và hợp âm kế là gì để tay chuẩn bị trước.' }),
      dat('Bất cứ lúc nào cũng nói được mình đang ở hợp âm thứ mấy và hợp âm tiếp theo là gì.'),
    ]},
    { slug:'dh34', n:4, title:'Bài 3.4 — Đi và về: hợp âm chủ', xp:20, slides:[
      kham(P('Lặp vòng và để ý: có một hợp âm nghe như “đặt chân về nhà” — yên ổn hơn các hợp âm khác.')),
      hoc(P('Trong vòng C–Am–Dm–G7, hợp âm đó là <b>C</b>. G7 tạo cảm giác “đang chờ, chưa xong”, rồi về C là “xong, ổn rồi”. Bass đi Đô → La → Rê → Sol, rồi Sol (G7) kéo về Đô (C).')),
      hieu(P('Bạn không cần định nghĩa lý thuyết. Cứ nghe: chỗ nào làm bạn thấy “kết thúc, ổn” — đó là hợp âm chủ, điểm về nhà của vòng.')),
      listen({ q:'Nghe vòng C–Am–Dm–G7. Hợp âm nào cho cảm giác “kết, đã về nhà”?', plays:[{label:'Nghe vòng', chords:[fr('C'),fr('Am'),fr('Dm'),fr('G7')]}], options:['C','Am','Dm','G7'], answer:0, explain:'G7 tạo cảm giác “đang chờ”, rồi về C là “xong, ổn”. C là hợp âm chủ — điểm về nhà của vòng này.' }),
      dat('Chỉ ra được điểm “về nhà” của vòng bằng tai, và cảm được G7 “kéo” về C.'),
    ]},
    { slug:'dh35', n:5, title:'Bài 3.5 — Hát ầm ừ trong vòng', xp:20, slides:[
      kham(P('Giữ vòng chạy bằng tay, rồi đưa giọng vào — chưa hát ca khúc có lời, chỉ ngân “ầm ừ” như tiếng “ừm” ở Level 1.')),
      hoc(P('Ngân một âm hợp với hợp âm đang vang, và đổi âm khi vòng đổi hợp âm. Ở hợp âm chủ (C), giọng dễ “về” nhất — lấy đó làm điểm tựa.')),
      hieu(P('Tay giữ dòng chảy, giọng “ầm ừ” đi trên dòng chảy đó. Mục tiêu là giọng hoà vào vòng, chưa phải hát đúng lời (để dành Level 5). Nếu phải chọn, giữ nhịp trước.')),
      backing(['C','Am','Dm','G7'], { tempo:68, caption:'Bật nền vòng rồi ngân “ầm ừ” bám theo. Nghe âm của mình có hợp với hợp âm đang vang không; mỗi khi vòng về C, ngân về âm hợp âm chủ.' }),
      dat('Vừa giữ vòng vừa ngân “ầm ừ” khớp với hợp âm đang vang, tay phải không khựng.'),
    ]},
    { slug:'dh36', n:6, title:'Bài 3.6 — Lạc & tìm lại', xp:20, slides:[
      kham(P('Khi vừa đàn vừa ngân, rất dễ lạc: hoặc sai vị trí hợp âm (lạc vòng), hoặc giọng trôi cao độ (lạc cao độ).')),
      hoc(box('Hai kiểu lạc','• <b>Lạc vòng</b>: tay chơi sai vị trí, hợp âm không khớp chỗ đang ở.<br>• <b>Lạc cao độ</b>: giọng trôi lên/xuống, không còn khớp hợp âm.<br><br>Cách tìm lại: đừng dừng. Dùng tiếng đàn đang chạy — bass hoặc hợp âm chủ — làm mốc, chờ tới điểm “về nhà” rồi vào lại cho đúng.')),
      hieu(P('Người mới lạc thì dừng hẳn. Người điều khiển vòng thì giữ tay chạy, chỉ đưa giọng và vị trí về đúng chỗ — thường là ở hợp âm chủ.')),
      listen({ q:'Đang đàn mà bị lạc vòng — nên làm gì?', options:['Dừng hẳn, dò lại từ đầu','Giữ tay chạy đều, chờ tới hợp âm chủ rồi vào lại','Bỏ, chơi bài khác'], answer:1, explain:'Người điều khiển vòng không dừng: dùng tiếng đàn đang chạy (bass, hợp âm chủ) làm mốc, chờ điểm “về nhà” rồi vào lại đúng chỗ.' }),
      dat('Khi lạc, bạn không dừng — dùng tiếng đàn đang chạy để tìm lại điểm đứng và vào lại vòng.'),
    ]},
    { slug:'dh37', n:7, title:'Bài 3.7 — Điều khiển một vòng (Capstone)', xp:40, slides:[
      kham(P('Giờ làm tất cả cùng lúc trên một vòng, lặp như một bản loop không dứt.')),
      hoc(P('Quy trình: chọn vòng → giữ nhịp → khép vòng đều → biết mình đang ở đâu → cảm hợp âm chủ → hát khớp → nếu lạc thì tự tìm lại.')),
      metro('⑤ Chạy vòng C–Am–Dm–G7 như loop nhiều vòng liên tục, có ngân ầm ừ. Khi vững, thử một vòng khác (vd Am–Dm–E7–Am về Am) để kiểm tra chuyển năng lực.'),
      t('DAN','Luyện thêm', box('Các bài "Tập vòng" bên dưới','Ngay trong Level này có các bài <b>Tập vòng</b> trên nền trống–bass (Strum Score) cho cả 5 vòng hoà âm — dùng để luyện tay cho tới khi loop mượt.','#3E7C74','#EAF3F1')),
      dat('Đàn một vòng → lặp liên tục → giữ nhịp → ngân “ầm ừ” khớp → tự nhận ra khi lạc → tự tìm lại → cảm nhận hợp âm chủ.'),
    ]},
  ], check:{ slug:'dh3check', title:'Tự kiểm Level 3', items:[
    'Quạt đều trọn một vòng 4 hợp âm','Giữ nhịp & đếm qua nhiều lần lặp vòng','Chuẩn bị hợp âm kế trước phách đổi (mọi mối nối)',
    'Nghe được sự thay đổi liên tục của vòng','Nói được đang ở hợp âm thứ mấy','Đoán được hợp âm tiếp theo',
    'Chỉ ra được hợp âm chủ (điểm “về nhà”)','Ngân “ầm ừ” khớp với vòng','Nhận ra khi mình lạc & dùng tiếng đàn tìm lại',
  ]}},

  { lvl:4, name:'Level 4: Nhịp và phách', lessons:[
    { slug:'dh41', n:1, title:'Bài 4.1 — Ba loại nhịp: 2/4 · 3/4 · 4/4', xp:20, slides:[
      kham(P('Đếm 1–2, rồi 1–2–3, rồi 1–2–3–4. Mỗi kiểu đếm là một loại nhịp — số phách trong mỗi ô khác nhau.')),
      hoc(P('<b>2/4</b> có 2 phách mỗi ô, <b>3/4</b> có 3 phách, <b>4/4</b> có 4 phách. Quạt xuống một cái mỗi phách; phách 1 là phách mạnh.')),
      metro('④⑤ Chọn nhịp trên metronome (2/4, 3/4, 4/4). Nghe mỗi ô có mấy tiếng click trước khi quay lại phách 1. Quạt + đếm, giữ đều 8 ô mỗi loại nhịp.'),
      dat('Quạt đều và đếm đúng số phách trong cả 2/4, 3/4 và 4/4, khớp metronome.'),
    ]},
    { slug:'dh42', n:2, title:'Bài 4.2 — Phách mạnh, phách nhẹ', xp:20, slides:[
      kham(P('Quạt đều theo metronome và để ý: phách 1 nghe có “nặng” hơn các phách khác không? Đừng cố nhấn — chỉ lắng nghe.')),
      hoc(box('Trọng âm mỗi nhịp','2/4: <b>MẠNH</b> – nhẹ · 3/4: <b>MẠNH</b> – nhẹ – nhẹ · 4/4: <b>MẠNH</b> – nhẹ – vừa – nhẹ (phách 3 hơi nhấn). Trọng âm là một <b>cảm giác</b>, không phải luật “đập mạnh phách 1” — khi quạt đều cùng metronome, phách mạnh tự nổi lên; việc của bạn là nghe ra nó.')),
      metro('④ Metronome nhấn phách 1. Quạt đều, lắng nghe phách nào “nặng” hơn; rồi nhắm mắt nghe một đoạn có nhấn, đoán 2/4, 3/4 hay 4/4.'),
      dat('Nghe và tự cảm nhận được phách mạnh, và nhận ra loại nhịp qua trọng âm — không cần đếm.'),
    ]},
    { slug:'dh43', n:3, title:'Bài 4.3 — Hợp âm bắt đầu ở phách nào', xp:20, slides:[
      kham(P('Khi đổi hợp âm, hợp âm mới bắt đầu vang ở phách nào? Ở bài này, mỗi ô một hợp âm, và hợp âm mới vào phách 1.')),
      hoc(P('Một hợp âm cho cả ô nhịp; đổi ở phách 1 của ô sau. Tay phải quạt đều bốn phách. Ví dụ: | C · · · | G7 · · · | — đổi đúng phách 1.')),
      hieu(P('Tay phải là dòng nhịp — không dừng vì đổi, nay đặt rõ trên khung phách. <b>Hợp âm đi theo phách.</b>')),
      metro('⑤ Metronome 4/4. Tập | C · · · | G7 · · · | — đổi đúng phách 1, miệng đếm 1–2–3–4, hợp âm mới rơi đúng “1”.'),
      dat('Đổi hợp âm đúng phách 1, tay phải không dừng, miệng vẫn đếm.'),
    ]},
    { slug:'dh44', n:4, title:'Bài 4.4 — Hai hợp âm trong một ô nhịp', xp:20, slides:[
      kham(P('Một ô nhịp có thể chứa hai hợp âm — hợp âm đổi ngay giữa ô, không chờ sang ô mới.')),
      hoc(P('Hai cách chia thường gặp trong 4/4: <b>| C · G7 · |</b> (C phách 1–2, G7 vào phách 3 — kiểu 2+2) và <b>| C · · G7 |</b> (C phách 1–3, G7 vào phách 4 — kiểu 3+1).')),
      hieu(P('Điểm đổi giờ không chỉ ở phách 1 mà ở giữa ô (phách 3 hoặc 4). Tay trái chuẩn bị ngón trước phách sẽ đổi; tay phải vẫn quạt đều.')),
      metro('⑤ Metronome 4/4. Tập | C · G7 · | (đổi phách 3) rồi | C · · G7 | (đổi phách 4). Khựng thì chỉ đếm và nói to phách sẽ đổi trước, rồi mới thêm tay trái.'),
      dat('Đổi hai hợp âm trong một ô đúng phách (3 hoặc 4), tay phải không dừng, miệng vẫn đếm.'),
    ]},
    { slug:'dh45', n:5, title:'Bài 4.5 — Ba hợp âm trong một ô nhịp', xp:20, slides:[
      kham(P('Tăng thêm một bậc: ba hợp âm trong một ô. Dễ nhất là nhịp 3/4 — mỗi phách một hợp âm.')),
      hoc(P('Ví dụ 3/4: <b>| C G7 Am |</b> — mỗi phách một hợp âm. Rồi 4/4 vị trí KHÔNG đều: <b>| C · G7 Am |</b> — C phách 1–2, G7 phách 3, Am phách 4.')),
      hieu(P('Trong 4/4 không chia đều — bạn phải đọc điểm đổi theo phách, không chép mẫu. Đây là bậc khó hơn hai hợp âm/ô, nên tập vững Bài 4.4 trước.')),
      metro('⑤ Metronome. Tập 3/4 | C G7 Am | (đổi mỗi phách) rồi 4/4 | C · G7 Am | (đổi đúng phách 3 và 4), nhịp không vỡ.'),
      dat('Chơi được ba hợp âm trong một ô (3/4 và 4/4 vị trí không đều), đổi đúng phách, nhịp không vỡ.'),
    ]},
    { slug:'dh46', n:6, title:'Bài 4.6 — Nghe vị trí đổi trong dòng nhịp', xp:20, slides:[
      kham(P('Đến giờ bạn đổi theo mẫu cho sẵn. Bây giờ nghe một đoạn CHƯA học và tự tìm: hợp âm đổi ở phách nào?')),
      hoc(P('Một bước chuyển lớn — từ “làm theo mẫu” sang “tự nghe và xác định”. Cách làm: vừa nghe vừa đếm phách, và đánh dấu phách nào có điểm đổi.')),
      hieu(P('Tai kết hợp với đếm: nghe màu hoà âm đổi + biết mình đang ở phách mấy = biết hợp âm đổi ở phách nào.')),
      listen({ q:'Nghe ô nhịp: C vang trước, rồi đổi sang G7. G7 đổi vào khoảng phách nào?', plays:[{label:'Nghe ô nhịp (C… G7)', chords:[fr('C'),fr('G7')], gap:1200}], options:['Phách 1','Phách 2','Phách 3','Phách 4'], answer:2, explain:'C giữ phách 1–2, G7 vào phách 3 (chia 2+2). Vừa nghe vừa đếm 1–2–3–4 để bắt đúng điểm đổi.' }),
      dat('Nghe một đoạn chưa học và xác định đúng hợp âm đổi ở phách nào.'),
    ]},
    { slug:'dh47', n:7, title:'Bài 4.7 — Đọc nhịp một đoạn mới (Capstone)', xp:40, slides:[
      kham(P('Gộp tất cả: nhận một đoạn nhạc mới và tự đọc nhịp của nó trước khi đàn.')),
      hoc(box('Quy trình 5 bước','1) Xác định nhịp — 2/4, 3/4 hay 4/4? 2) Đếm phách theo nhịp đó. 3) Xác định điểm đổi hợp âm — mỗi hợp âm bắt đầu ở phách nào? 4) Quạt đều theo phách. 5) Đổi hợp âm đúng phách, kể cả 2–3 hợp âm/ô.')),
      metro('⑤ Nhận một đoạn mới → chạy đủ 5 bước với metronome → đệm được đoạn đó.'),
      listen({ q:'Nhận một đoạn nhạc MỚI để đệm — bước đầu tiên nên làm gì?', options:['Đàn luôn cho quen tay','Xác định nhịp (2/4·3/4·4/4) rồi đếm phách','Học thuộc lời trước'], answer:1, explain:'Quy trình: xác định nhịp → đếm phách → tìm điểm đổi hợp âm → quạt đều → đổi đúng phách. Nhìn nhịp trước, đàn sau.' }),
      dat('Nhận đoạn mới → xác định nhịp → đếm phách → xác định điểm đổi → quạt đều → đổi đúng phách, kể cả 2–3 hợp âm/ô.'),
    ]},
  ], check:{ slug:'dh4check', title:'Tự kiểm Level 4', items:[
    'Quạt đều trong 2/4, 3/4, 4/4','Vừa quạt vừa đếm phách','Giữ nhịp ổn định cùng metronome',
    'Nghe & tự cảm nhận phách mạnh/nhẹ, nhận ra nhịp','Biết hợp âm bắt đầu ở phách nào','Xử lý 2 hợp âm/ô, đổi đúng phách',
    'Xử lý 3 hợp âm/ô (3/4 và 4/4 vị trí không đều)','Đổi đúng phách mà tay phải không dừng','Nghe đoạn chưa học, xác định điểm đổi theo phách',
  ]}},

  { lvl:5, name:'Level 5: Tự chuẩn bị & đệm một bài hát mới', lessons:[
    { slug:'dh51', n:1, title:'Bài 5.1 — Tìm tông dễ chơi', xp:20, slides:[
      kham(P('Bạn nhận một bài có sẵn hợp âm. Có thể trong đó có hợp âm khó (chặn, ngoài vốn của bạn). Việc đầu tiên: đưa bài về một tông dễ.')),
      hoc(P('Cùng một bài có thể chơi ở nhiều tông. Chọn tông mà bạn chỉ cần các hợp âm đã học — thường là <b>Am hoặc C</b>.')),
      hieu(P('Đưa về Am/C không làm đổi bài — chỉ đổi “chỗ đứng” để tay dễ chơi. Cao độ để hát sẽ chỉnh bằng capo ở bài sau.')),
      listen({ q:'Đưa một bài về tông Am hoặc C để làm gì?', plays:[{label:'Nghe vòng tông C', chords:[fr('C'),fr('Am'),fr('Fmaj7'),fr('G7')]}], options:['Cho bài hay hơn','Để chỉ cần dùng những hợp âm dễ đã học','Để hát cao hơn'], answer:1, explain:'Dịch tông không đổi bài — chỉ đổi “chỗ đứng” để tay bạn chỉ gặp hợp âm quen. Cao độ hát sẽ chỉnh riêng bằng capo.' }),
      dat('Đưa được một bài về Am hoặc C, chỉ dùng những hợp âm bạn đã học.'),
    ]},
    { slug:'dh52', n:2, title:'Bài 5.2 — Capo để hát dễ hơn', xp:20, slides:[
      kham(P('Tông C dễ chơi, nhưng có thể quá thấp hoặc quá cao so với giọng bạn. Đừng đổi hợp âm khó — hãy dùng capo.')),
      hoc(P('Capo là một thanh kẹp ngang cần đàn. Nó nâng cao độ của cả cây đàn lên, trong khi bạn vẫn bấm những thế hợp âm dễ như cũ.')),
      hieu(P('Không cần tính toán lý thuyết. Chỉ cần thử: kẹp capo ở vài ngăn, hát thử, và chọn chỗ giọng thấy thoải mái nhất.')),
      listen({ q:'Nghe cùng hợp âm C ở hai vị trí. Capo dùng để làm gì?', plays:[{label:'C — không capo', chords:[fr('C')]},{label:'C — như capo ngăn 2', chords:[fr('C').map(f=>f*Math.pow(2,2/12))]}], options:['Đổi sang hợp âm khó hơn','Nâng cao độ mà vẫn bấm thế dễ như cũ','Giúp chơi nhanh hơn'], answer:1, explain:'Capo nâng cao độ cả cây đàn; bạn vẫn bấm C, Am dễ như cũ. Thử vài ngăn, chọn chỗ hát thoải mái nhất. Có video thầy đánh mẫu.' }),
      dat('Chọn được vị trí capo hợp giọng — bằng cách thử và nghe, không cần tính lý thuyết.'),
    ]},
    { slug:'dh53', n:3, title:'Bài 5.3 — Biên soạn bảng hợp âm', xp:20, slides:[
      kham(P('Một bản hợp âm chép lộn xộn rất khó đàn. Hãy trình bày lại cho sạch.')),
      hoc(P('Viết lại bài ở tông đã chọn, ghi hợp âm đúng chỗ đổi, gọn gàng dễ đọc. Bài mẫu dùng bốn hợp âm quen thuộc: C, Am, Fmaj7, G7.')),
      chord('C'), chord('Am'), chord('Fmaj7'), chord('G7'),
      hieu(P('Bảng gọn giúp mắt đọc trước một bước, để tay trái kịp chuẩn bị hợp âm sắp tới.')),
      dat('Có một bảng hợp âm sạch, dễ đọc và dễ đàn cho bài.'),
    ]},
    { slug:'dh54', n:4, title:'Bài 5.4 — Điền phách vào lời', xp:20, slides:[
      kham(P('Hát một câu và vỗ tay theo — mỗi tiếng vỗ là một phách. Chữ nào rơi vào phách nào?')),
      hoc(P('Đọc lời, đếm nhịp, ghi số phách. Hợp âm ghi phía trên, đổi đúng phách — đây là “bảng hợp âm + phách”. Điểm đổi không phải lúc nào cũng ở đầu ô; có khi đổi ngay giữa câu.')),
      metro('④⑤ Metronome: đặt hợp âm vào đúng phách của lời. Điền số phách cho lời bài của bạn và đánh dấu chỗ đổi hợp âm — kể cả khi đổi giữa câu.'),
      dat('Điền được số phách vào lời và xác định đúng hợp âm đổi ở phách nào (kể cả đổi giữa câu).'),
    ]},
    { slug:'dh55', n:5, title:'Bài 5.5 — Chưa được cầm đàn', xp:20, slides:[
      kham(P('Cất đàn sang một bên. Chỉ hát + vỗ tay + metronome.')),
      hoc(P('Làm cho bài hát chạy đúng nhịp bằng giọng trước. Tay vỗ giữ phách, metronome giữ đều, miệng hát theo bảng phách đã điền.')),
      hieu(P('Nếu chưa hát trôi được trong nhịp, cầm đàn vào sẽ càng loạn. Giọng phải chạy được trước — cây đàn chỉ vào khi bài đã vững.')),
      metro('⑤ Metronome giữ nhịp; hát cả bài + vỗ tay tới khi trôi chảy, đúng nhịp. Nếu có, thu âm phần hát + vỗ tay rồi nghe lại.'),
      dat('Hát trôi chảy cả bài đúng nhịp cùng vỗ tay và metronome — chưa cần đàn.'),
    ]},
    { slug:'dh56', n:6, title:'Bài 5.6 — Vào hát từ hợp âm', xp:20, slides:[
      kham(P('Quạt hợp âm đầu bài, rồi thử cất giọng vào. Bạn có vào đúng tông không, hay bị chênh?')),
      hoc(P('Nghe hợp âm đang vang, tìm trong đó một nốt làm “điểm tựa”, ngân nhẹ (như tiếng “ừm” ở Level 1), rồi vào câu hát từ nốt đó.')),
      hieu(P('Hợp âm cho bạn một “nốt mồi” để vào hát đúng cao độ — không phải đoán mò rồi chênh.')),
      listen({ q:'Để cất giọng vào ĐÚNG cao độ, nên làm gì trước?', plays:[{label:'Nghe hợp âm đầu (Am)', chords:[fr('Am')]}], options:['Đoán đại rồi hát','Nghe hợp âm, lấy một nốt trong đó làm “điểm tựa” rồi vào','Hát thật to cho chắc'], answer:1, explain:'Hợp âm đang vang cho bạn một “nốt mồi”. Ngân nhẹ nốt đó (như tiếng “ừm” ở Level 1) rồi vào câu hát — không bị chênh. Có video thầy đánh mẫu.' }),
      dat('Vào câu hát đúng cao độ nhờ nghe hợp âm và lấy một nốt trong đó làm điểm tựa.'),
    ]},
    { slug:'dh57', n:7, title:'Bài 5.7 — Tìm nơi bài hát muốn “về”', xp:20, slides:[
      kham(P('Hát hoặc đàn hết bài, để ý: chỗ nào cho bạn cảm giác “xong, đã về nhà”?')),
      hoc(P('Chỗ đó là âm chủ / hợp âm chủ — chính là “điểm về nhà” bạn đã cảm ở Level 3, nay áp cho cả một bài hát. Thường là hợp âm bài kết thúc.')),
      hieu(P('Biết hợp âm chủ giúp bạn tạo cảm giác kết đúng chỗ và biết bài “về” đâu — rất cần khi tự đệm.')),
      listen({ q:'Nghe và cảm nhận: hợp âm nào cho cảm giác bài “đã kết, về nhà”?', plays:[{label:'Nghe kết về C', chords:[fr('Dm'),fr('G7'),fr('C')]}], options:['C','G7','Dm'], answer:0, explain:'Chỗ cho cảm giác “xong, ổn” là âm chủ / hợp âm chủ — thường là hợp âm bài kết thúc. Biết nó giúp tạo cảm giác kết đúng chỗ.' }),
      dat('Nhận ra âm chủ/hợp âm chủ của bài và cảm nhận được điểm kết.'),
    ]},
    { slug:'dh58', n:8, title:'Bài 5.8 — Ghép đàn', xp:30, slides:[
      kham(P('Bây giờ mới cầm đàn — đưa quạt và hợp âm vào bài bạn ĐÃ chuẩn bị.')),
      hoc(P('Bài đã chạy được bằng giọng + nhịp. Cây đàn giờ chỉ làm ba việc: giữ nhịp, đưa hợp âm vào đúng phách đã điền, và nâng đỡ giọng hát.')),
      hieu(P('Vì đã chuẩn bị kỹ, cây đàn không phải “tìm đường” nữa. Bạn đã biết bài đi thế nào — đàn chỉ việc theo.')),
      metro('⑤ Backing/metronome nền: hát + đệm cả bài; đổi hợp âm đúng phách đã điền, tay phải giữ đều. Có <b>video thầy đánh mẫu</b> cách ghép đàn.'),
      dat('Vừa hát vừa tự đệm trôi chảy bài đã chuẩn bị, hợp âm vào đúng phách, nhịp không vỡ.'),
    ]},
    { slug:'dh59', n:9, title:'Bài 5.9 — Một bài hát hoàn toàn mới (Capstone)', xp:50, slides:[
      kham(P('Chọn một bài bạn chưa từng đệm. Không học thuộc trước — bạn sẽ tự xử lý nó.')),
      hoc(box('Checklist quy trình 9 bước','1) Chọn tông dễ (Am/C). 2) Chọn capo hợp giọng. 3) Chỉnh hợp âm. 4) Điền số phách vào lời. 5) Xác định điểm đổi hợp âm. 6) Hát + vỗ tay + metronome (chưa đàn). 7) Vào hát đúng cao độ. 8) Xác định âm chủ / hợp âm chủ. 9) Ghép đàn → tự đệm hoàn chỉnh.')),
      hieu(P('Đây là đích của cả Đệm hát 1: bạn không cần thuộc bài trước, vẫn tự đệm được một bài mới.')),
      metro('⑤ Làm đủ 9 bước trên một bài mới → đệm hoàn chỉnh. Tự chấm từng bước; nghe lại bản đệm của mình.'),
      dat('Nhận một bài chưa từng học và tự: chuẩn bị → tông/capo → xử lý hợp âm → phách & điểm đổi → hát+vỗ tay+metronome → vào hát đúng cao độ → nhận nơi kết → ghép đàn & đệm hoàn chỉnh.'),
    ]},
  ], check:{ slug:'dh5check', title:'Tự kiểm Level 5', items:[
    'Đưa được một bài về tông Am hoặc C','Chọn được capo hợp giọng (thử & nghe)','Có bảng hợp âm sạch, dễ đọc',
    'Điền được số phách vào lời','Xác định đúng chỗ đổi hợp âm trong lời','Hát + vỗ tay + metronome trôi chảy (chưa đàn)',
    'Vào câu hát đúng cao độ nhờ nghe hợp âm','Nhận ra âm chủ/hợp âm chủ, tạo được cảm giác kết','Tự chuẩn bị & đệm trọn một bài mới',
  ]}},
]

// ============================================================================
// SINH SQL
// ============================================================================
const esc = (s) => String(s).replace(/'/g, "''")
const UU = (lvl, nn) => `d1c00${lvl}${String(nn).padStart(2,'0')}-0000-4000-8000-000000000000`
const slides = (arr) => {
  let o = 0
  const withOrder = arr.map(s => ({ id: sid(), order: ++o, ...s }))
  return JSON.stringify(withOrder)
}

let sql = `-- ============================================================================
-- DH1 RESTRUCTURE — tái cấu trúc khoá "Khởi đầu đam mê — Đệm hát cơ bản" theo
-- giáo trình sách Đệm hát 1 (5 Level). SINH TỰ ĐỘNG từ db/gen_dh1.cjs — ĐỪNG SỬA TAY.
-- Chạy trên Supabase SQL editor. Idempotent (lookup khoá theo tên, module theo
-- tên/id, bài theo UUID cố định d1c00...). Xoá hẳn 3 chương cũ ở cuối file.
-- CHẠY SAU qr_links_demhat.sql (slug QR phải tồn tại trước — đuôi file UPDATE
--   target QR về đúng lesson id; chạy khi chưa có slug thì QR không trỏ được).
-- ============================================================================
DO $$
DECLARE
  v_course uuid;
  v_mod    uuid;
  v_les    uuid;
BEGIN
  SELECT id INTO v_course FROM edu_courses WHERE name ILIKE '%Đệm hát cơ bản%' LIMIT 1;
  IF v_course IS NULL THEN RAISE EXCEPTION 'Không tìm thấy khoá "Đệm hát cơ bản"'; END IF;
`

LEVELS.forEach((L, li) => {
  const order = li + 1 // Level 1..5 → order 1..5 (chừa order 0 cho "Kiểm tra đầu vào")
  sql += `
  -- ===== ${L.name} =====\n`
  if (L.reuseModule) {
    sql += `  -- Tái dùng module "Vòng hoà âm" đã có (giữ nguyên 8 bài strum bên dưới).\n`
    sql += `  v_mod := '${L.reuseModule}';\n`
    sql += `  UPDATE edu_modules SET name = '${esc(L.name)}', order_index = ${order} WHERE id = v_mod;\n`
  } else {
    sql += `  SELECT id INTO v_mod FROM edu_modules WHERE course_id = v_course AND name ILIKE 'Level ${L.lvl}%' LIMIT 1;\n`
    sql += `  IF v_mod IS NULL THEN\n`
    sql += `    INSERT INTO edu_modules (course_id, name, order_index) VALUES (v_course, '${esc(L.name)}', ${order}) RETURNING id INTO v_mod;\n`
    sql += `  ELSE\n    UPDATE edu_modules SET name = '${esc(L.name)}', order_index = ${order} WHERE id = v_mod;\n  END IF;\n`
  }

  const lessons = [...L.lessons]
  // tự kiểm là bài cuối
  lessons.push({ slug:L.check.slug, n:99, title:L.check.title, xp:20, check:true, slides:[
    t('DAN','Tự kiểm', box('Đánh dấu khi bạn làm được','Chỗ nào chưa đạt, quay lại đúng bài rèn năng lực đó. Khi cả bảng đều đạt, bạn sẵn sàng cho Level tiếp theo.','#3E7C74','#EAF3F1')),
    check('Bảng tự kiểm', L.check.items),
  ]})

  lessons.forEach((les, idx) => {
    const uu = UU(L.lvl, les.n)
    const ord = idx // flow lessons đứng đầu; với Level 3, bài strum cũ giữ order lớn hơn (xem ghi chú)
    sql += `\n  -- ${les.title}  (${les.slug})\n`
    sql += `  v_les := '${uu}';\n`
    sql += `  INSERT INTO edu_course_lessons (id, module_id, title, lesson_type, order_index, tier, tools, content_url)\n`
    sql += `    VALUES (v_les, v_mod, '${esc(les.title)}', 'flow', ${ord}, 'free', '[]'::jsonb, 'qr:${les.slug}')\n`
    sql += `    ON CONFLICT (id) DO UPDATE SET module_id = v_mod, title = EXCLUDED.title, lesson_type = 'flow', order_index = ${ord}, content_url = 'qr:${les.slug}';\n`
    sql += `  DELETE FROM flows WHERE lesson_id = v_les;\n`
    sql += `  INSERT INTO flows (lesson_id, title, reward_xp, status, slides) VALUES (\n`
    sql += `    v_les, '${esc(les.title)}', ${les.xp}, 'published', $json$${slides(les.slides)}$json$::jsonb);\n`
  })

  if (L.reuseModule) {
    sql += `\n  -- Đẩy 8 bài strum "Tập vòng" cũ xuống sau các bài flow 3.x (giữ nguyên nội dung & id).\n`
    sql += `  -- Chỉ đẩy khi còn ở đầu (idempotent — chạy lại không cộng dồn).\n`
    sql += `  UPDATE edu_course_lessons SET order_index = order_index + 20 WHERE module_id = v_mod AND lesson_type IN ('strum','native') AND order_index < 20;\n`
  }
})

sql += `
  RAISE NOTICE 'DH1 restructure xong. Nhớ trỏ QR về lesson id (phần dưới).';
END $$;

NOTIFY pgrst, 'reload schema';

-- ── Trỏ QR sách về đúng bài (thay đích tạm /start) ──────────────────────────
-- Chạy SAU qr_links_demhat.sql. content_url mỗi bài = 'qr:<slug>' để tra ngược.
UPDATE qr_links q SET target = '/course?id=' || l.id
  FROM edu_course_lessons l
  WHERE l.content_url = 'qr:' || q.slug AND q.slug LIKE 'dh%';

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- XOÁ HẲN 3 chương cũ (quyết định của thầy 13/08/2026). GIỮ: "Kiểm tra đầu vào"
-- + Level 3 (module vòng hoà âm 319654a9 tái dùng làm Level 3). Xoá theo ID cố
-- định để KHÔNG đụng nhầm module khác. Thứ tự theo FK: flows → bài → module.
-- ⚠️ Mất tiến độ/XP học viên ở các bài này (không khôi phục được) — thầy đã đồng ý.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_old uuid[] := ARRAY[
    'd23be114-45ec-4b2c-bcb2-ce9cbcd9f436',  -- Chương 1: Hợp âm
    '2b1a0bcf-f90f-4c3f-ad8b-b5beecb8db3e',  -- Chương 2: Quạt hợp âm
    'f9fb42d8-df87-4636-839f-3e1d6d338012'   -- Chương 4: Kiến thức nhịp phách
  ]::uuid[];
BEGIN
  DELETE FROM flows WHERE lesson_id IN (SELECT id FROM edu_course_lessons WHERE module_id = ANY(v_old));
  DELETE FROM edu_course_lessons WHERE module_id = ANY(v_old);
  DELETE FROM edu_modules WHERE id = ANY(v_old);
  RAISE NOTICE 'Đã xoá 3 chương cũ (Hợp âm/Quạt/Nhịp phách).';
END $$;

NOTIFY pgrst, 'reload schema';
`

fs.writeFileSync(__dirname + '/dh1_restructure.sql', sql)
console.log('WROTE db/dh1_restructure.sql —', LEVELS.reduce((a,L)=>a+L.lessons.length+1,0), 'bài (gồm tự kiểm) qua', LEVELS.length, 'Level')
