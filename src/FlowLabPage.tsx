// ── Flow Lab — xem thử engine Flow mới (GĐ1) với bài mẫu, KHÔNG đụng dữ liệu thật ──
// Chỉ teacher vào /flow-lab. Dùng để DUYỆT CẢM GIÁC trước khi migrate 11 bài.
import FlowPlayer from './FlowPlayer'

// Bài 4 "Tên 6 dây đàn" dựng theo engine mới (slide tương tác guitar)
const SAMPLE_FLOW = {
  id: 'sample-bai4',
  title: 'Tên 6 dây đàn',
  reward_xp: 10,
  slides: [
    { id: 's1', order: 1, logic: 'DAN', type: 'callout', title: 'Tên 6 dây đàn',
      interactive: { variant: 'teacher' },
      content: 'Cùng làm quen <b>tên 6 dây</b> nhé. Không cần học thuộc ngay — cứ lướt qua, nghe tiếng, rồi thử trên cây đàn của bạn.' },
    { id: 's2', order: 2, logic: 'NHAN', type: 'note_chart', title: '6 dây đàn dùng những chữ cái nào?',
      interactive: {} },
    { id: 's3', order: 3, logic: 'NHAN', type: 'text', title: 'Dây dày nhất & mỏng nhất',
      content: '• <b>Dây 6</b> dày nhất — nốt <b>Mi trầm (E)</b>, nằm dưới cùng.<br/>• <b>Dây 1</b> mỏng nhất — nốt <b>Mí cao (E)</b>, nằm trên cùng.' },
    { id: 's4', order: 4, logic: 'DAN', type: 'callout', title: '',
      interactive: { variant: 'tip' },
      content: 'Mẹo nhớ thứ tự dây 6→1: <b>"Em Ăn Dứa Giòn Bên Em"</b> → E A D G B E.' },
    { id: 's5', order: 5, logic: 'LAM', type: 'guitar_neck', title: 'Đâu là dây số 1?',
      interactive: { target: 1 } },
    { id: 's6', order: 6, logic: 'NGAM', type: 'checklist', title: 'Tự kiểm tra nhanh',
      interactive: { items: ['Mình nhớ dây 6 trầm nhất, dây 1 cao nhất', 'Mình chỉ đúng dây số 1 trên cần đàn'] } },
    { id: 's7', order: 7, logic: 'DAN', type: 'support', title: 'Cần hỗ trợ?',
      interactive: { oaUrl: 'https://zalo.me/', teacherUrl: 'https://zalo.me/' },
      content: 'Chưa hiểu, làm chưa được, hay muốn hiểu sâu hơn về tên dây? Bấm vào đây để cùng gỡ.' },
    { id: 's8', order: 8, logic: 'DAN', type: 'callout', title: 'Lời thầy',
      interactive: { variant: 'teacher' },
      content: 'Tốt lắm! Tên dây sẽ ngấm dần khi bạn chơi. Cứ thong thả nhé. 🎸' },
  ],
}

// Bài 8 "Gảy dây cho đàn kêu rõ" — mẫu cho mô phỏng gảy dây + luyện tai nghe
const SAMPLE_FLOW_8 = {
  id: 'sample-bai8',
  title: 'Gảy dây cho đàn kêu rõ',
  reward_xp: 10,
  slides: [
    { id: 'a1', order: 1, logic: 'DAN', type: 'callout', title: 'Gảy cho đàn kêu rõ',
      interactive: { variant: 'teacher' },
      content: 'Mục tiêu đơn giản: gảy từng dây nghe <b>tròn và rõ</b>, không bị tịt. Cùng thử nhé.' },
    { id: 'a2', order: 2, logic: 'NHAN', type: 'text', title: 'Tay phải thả lỏng',
      content: '• Cổ tay mềm, không gồng.<br/>• Gảy dứt khoát qua dây, không ấn quá sâu.<br/>• Nghe: tiếng tròn, vang — không bị cụt.' },
    { id: 'a3', order: 3, logic: 'LAM', type: 'guitar_strum', title: 'Gảy lần lượt 6 dây buông',
      interactive: { sequence: [1, 2, 3, 4, 5, 6] } },
    { id: 'a4', order: 4, logic: 'LAM', type: 'guitar_ear', title: 'Luyện tai: âm này là dây nào?',
      interactive: { rounds: 5 } },
    { id: 'a5', order: 5, logic: 'NGAM', type: 'checklist', title: 'Tự kiểm tra',
      interactive: { items: ['Từng dây nghe rõ, không tịt', 'Cổ tay phải thả lỏng, không gồng'] } },
    { id: 'a6', order: 6, logic: 'DAN', type: 'callout', title: '',
      interactive: { variant: 'teacher' },
      content: 'Tuyệt! Tiếng rõ là nền của mọi bài sau. Mỗi ngày gảy buông 6 dây vài lượt cho quen tay nhé. 🎸' },
  ],
}

// Tỉa nốt căn bản — Bài 1 "Nốt Mi — dây 1 buông" (demo bài tập đánh-theo-mẫu)
const SAMPLE_FLOW_MI = {
  id: 'sample-mi',
  title: 'Nốt Mi — dây 1 buông',
  reward_xp: 10,
  slides: [
    { id: 'mi1', order: 1, logic: 'DAN', type: 'callout', title: 'Nốt Mi — dây 1 buông',
      interactive: { variant: 'teacher' },
      content: 'Hôm nay bạn làm quen nốt nhạc đầu tiên: <b>nốt Mi</b>. Cùng nhìn, nghe và đánh theo nhé!' },
    { id: 'mi2', order: 2, logic: 'NHAN', type: 'note_show', title: 'Nhìn trên khuông nhạc',
      interactive: { label: 'Mi', freq: 329.63, string: 1, fret: 0, staff: 7, showStaff: true, showFretboard: false, caption: 'Đây là nốt <b>Mi</b> — guitar viết ở <b>khe thứ 4</b> trên khuông nhạc.' } },
    { id: 'mi2b', order: 3, logic: 'NHAN', type: 'note_show', title: 'Chơi trên đàn',
      interactive: { label: 'Mi', freq: 329.63, string: 1, fret: 0, showStaff: false, showFretboard: true, caption: 'Nốt Mi = <b>dây 1 buông</b> (mỏng nhất). Bấm nghe thử rồi gảy theo.' } },
    { id: 'mi3', order: 3, logic: 'LAM', type: 'note_practice', title: 'Đánh theo: nốt Mi',
      interactive: { notes: Array.from({ length: 4 }, () => ({ label: 'Mi', freq: 329.63, string: 1, fret: 0, staff: 7 })) } },
    { id: 'mi4', order: 4, logic: 'NGAM', type: 'checklist', title: 'Tự kiểm tra',
      interactive: { items: ['Mình gảy đúng dây 1 (mỏng nhất)', 'Tiếng đều theo nhịp, không vội'] } },
    { id: 'mi5', order: 5, logic: 'DAN', type: 'callout', title: 'Lời thầy',
      interactive: { variant: 'teacher' },
      content: 'Tốt lắm! Mi là nốt đầu tiên — cứ gảy đều cho quen tay. Mai mình thêm nốt mới nhé. 🎸' },
  ],
}

// Khởi đầu đam mê — Đệm hát cơ bản — Bài 1 "Hợp âm là gì?" (tách từ thiết kế của thầy)
const SAMPLE_FLOW_HOPAM = {
  id: 'sample-hopam',
  title: 'Hợp âm là gì?',
  reward_xp: 10,
  slides: [
    { id: 'h1', order: 1, logic: 'NHAN', type: 'text', title: 'Mục tiêu',
      content: '<div style="display:flex; gap:13px; align-items:flex-start; background:#FBF6ED; border:1px solid #E6D8C2; border-left:4px solid #BF5A37; border-radius:6px; padding:18px;"><div style="flex:none; width:34px; height:34px; border-radius:50%; background:#F3E0D2; display:flex; align-items:center; justify-content:center; font-style:italic; font-weight:700; font-size:19px; color:#BF5A37;">i</div><div><div style="font-size:11px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:#BF5A37; margin-bottom:6px;">Mục tiêu</div><div style="font-size:17px; line-height:1.5; color:#2A2622;">Sau bài này, bạn chỉ cần hiểu một điều: <b>hợp âm là nhiều nốt vang lên cùng lúc.</b></div></div></div>' },
    { id: 'h2', order: 2, logic: 'NHAN', type: 'text', title: 'Mở đầu',
      content: '<p style="font-size:16px; line-height:1.75; margin:0 0 14px; color:#3A352F;">Khi ta gảy <i>một</i> dây đàn, ta nghe một âm thanh — một <b>nốt</b>. Mỏng, đơn lẻ, như tiếng <span style="font-style:italic; color:#BF5A37;">ting…</span></p><p style="font-size:16px; line-height:1.75; margin:0; color:#3A352F;">Nhưng khi gảy <i>nhiều</i> dây cùng lúc, âm thanh dày hơn, đầy hơn — tiếng <span style="font-style:italic; color:#BF5A37;">reng…</span> Đó chính là <b>hợp âm</b>.</p>' },
    { id: 'h3', order: 3, logic: 'NHAN', type: 'text', title: 'Giải thích thật dễ',
      content: '<p style="font-size:16px; line-height:1.7; margin:0 0 16px; color:#3A352F;">Cách dễ nhất là nghĩ về tiếng hát:</p><div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;"><div style="background:#FBF6ED; border:1px solid #E6D8C2; border-radius:8px; padding:16px;"><div style="display:flex; gap:5px; align-items:flex-end; height:30px; margin-bottom:12px;"><span style="width:4px; height:26px; background:#C9BBA4; border-radius:2px;"></span></div><div style="font-size:11px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#9A8F7E; margin-bottom:5px;">Một nốt</div><div style="font-size:14px; line-height:1.5; color:#3A352F;"><b>Một người</b> hát một mình. Nghe mỏng.</div></div><div style="background:#F6E7D8; border:1px solid #E2C3A6; border-radius:8px; padding:16px;"><div style="display:flex; gap:4px; align-items:flex-end; height:30px; margin-bottom:12px;"><span style="width:4px;height:16px;background:#BF5A37;border-radius:2px;"></span><span style="width:4px;height:26px;background:#BF5A37;border-radius:2px;"></span><span style="width:4px;height:21px;background:#BF5A37;border-radius:2px;"></span><span style="width:4px;height:30px;background:#BF5A37;border-radius:2px;"></span></div><div style="font-size:11px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#BF5A37; margin-bottom:5px;">Một hợp âm</div><div style="font-size:14px; line-height:1.5; color:#3A352F;"><b>Nhiều người</b> hát cùng lúc. Nghe đầy hơn.</div></div></div>' },
    { id: 'h4', order: 4, logic: 'NHAN', type: 'guitar_chord', title: 'Hợp âm trên guitar',
      interactive: { name: 'Em', caption: 'Trên guitar, tay trái bấm cần đàn, tay phải gảy nhiều dây → nhiều nốt vang cùng lúc = một hợp âm. Đây là thế bấm <b>Em</b>. Bấm <b>Nghe</b> rồi gảy thử trên đàn của bạn.' } },
    { id: 'h5', order: 5, logic: 'NHAN', type: 'text', title: 'Hợp âm dùng để làm gì?',
      content: '<p style="font-size:16px; line-height:1.7; margin:0 0 16px; color:#3A352F;">Hợp âm dùng để <b>đệm hát</b>. Người hát giữ giai điệu, guitar đánh hợp âm phía sau làm nền.</p><div style="display:flex; border:1px solid #E6D8C2; border-radius:8px; overflow:hidden;"><div style="flex:1; padding:16px 18px; background:#FBF6ED;"><div style="font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:#9A8F7E; margin-bottom:4px;">Giai điệu</div><div style="font-size:14px; color:#3A352F;">Phần ta hát</div></div><div style="width:1px; background:#E6D8C2;"></div><div style="flex:1; padding:16px 18px; background:#F6E7D8;"><div style="font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:#BF5A37; margin-bottom:4px;">Hợp âm</div><div style="font-size:14px; color:#3A352F;">Guitar đệm phía sau</div></div></div>' },
    { id: 'h6', order: 6, logic: 'NGAM', type: 'checklist', title: 'Bài tập nhỏ — tự kiểm',
      interactive: { items: ['Mình đã gảy 1 dây — nghe tiếng mỏng (ting)', 'Mình đã bấm Em rồi gảy nhiều dây — nghe tiếng đầy (reng)', 'Mình nghe được sự khác nhau giữa một nốt và một hợp âm'] } },
    { id: 'h7', order: 7, logic: 'DAN', type: 'text', title: 'Câu chốt',
      content: '<div style="background:#2A2622; border-radius:10px; padding:24px 22px; color:#F4ECDF;"><div style="font-size:11px; font-weight:700; letter-spacing:0.16em; text-transform:uppercase; color:#D89B72; margin-bottom:12px;">Câu chốt</div><div style="font-size:19px; line-height:1.45; margin-bottom:18px; color:#FBF6ED;">Hợp âm là nhiều nốt vang lên cùng lúc. Trên guitar, đó là một thế bấm giúp tạo âm thanh đầy hơn để đệm hát.</div><div style="height:1px; background:rgba(244,236,223,0.18); margin-bottom:16px;"></div><div style="font-size:13px; color:#C9BBA4; margin-bottom:10px;">Mục tiêu đầu tiên khi học hợp âm:</div><div style="display:flex; gap:8px; flex-wrap:wrap;"><span style="font-size:13px; font-weight:700; color:#2A2622; background:#D89B72; border-radius:16px; padding:5px 14px;">Bấm đúng</span><span style="font-size:13px; font-weight:700; color:#2A2622; background:#D89B72; border-radius:16px; padding:5px 14px;">Gảy rõ</span><span style="font-size:13px; font-weight:700; color:#F4ECDF; background:rgba(244,236,223,0.12); border-radius:16px; padding:5px 14px;">Không rè</span><span style="font-size:13px; font-weight:700; color:#F4ECDF; background:rgba(244,236,223,0.12); border-radius:16px; padding:5px 14px;">Không tịt</span></div></div>' },
  ],
}

// Dữ liệu Diễm Xưa ô 1–8 (nốt + lời, parse từ score.xml) — dùng chung cho bar_split
const DX_LINES = [
  { bars: [
    { lead: true, hold: false, words: ['Mưa', 'vẫn', 'mưa', 'bay', 'trên', 'tầng', 'tháp'], notes: [{ rest: true, dur: 'e' }, { pos: 7, dur: 'e' }, { pos: 8, dur: 'e' }, { pos: 7, dur: 'e' }, { pos: 7, dur: 'e' }, { pos: 5, dur: 'e' }, { pos: 3, dur: 'e' }, { pos: 5, dur: 'e' }] },
    { lead: false, hold: true, words: ['cổ'], notes: [{ pos: 0, dur: 'w' }] },
  ] },
  { bars: [
    { lead: true, hold: false, words: ['Dài', 'tay', 'em', 'mấy', 'thuở', 'mắt', 'xanh'], notes: [{ rest: true, dur: 'e' }, { pos: 3, dur: 'e' }, { pos: 5, dur: 'e' }, { pos: 7, dur: 'e' }, { pos: 9, dur: 'e' }, { pos: 9, dur: 'e' }, { pos: 10, dur: 'e' }, { pos: 7, dur: 'e' }] },
    { lead: false, hold: true, words: ['xao'], notes: [{ pos: 6, dur: 'w' }] },
  ] },
  { bars: [
    { lead: true, hold: false, words: ['Nghe', 'lá', 'thu', 'mưa', 'reo', 'mòn', 'gót'], notes: [{ rest: true, dur: 'e' }, { pos: 7, dur: 'e' }, { pos: 8, dur: 'e' }, { pos: 7, dur: 'e' }, { pos: 7, dur: 'e' }, { pos: 5, dur: 'e' }, { pos: 3, dur: 'e' }, { pos: 5, dur: 'e' }] },
    { lead: false, hold: true, words: ['nhỏ'], notes: [{ pos: 0, dur: 'w' }] },
  ] },
  { bars: [
    { lead: true, hold: false, words: ['Đường', 'dài', 'hun', 'hút', 'cho', 'mắt', 'thêm'], notes: [{ rest: true, dur: 'e' }, { pos: 0, dur: 'e' }, { pos: 2, dur: 'e' }, { pos: 4, dur: 'e' }, { pos: 6, dur: 'e' }, { pos: 6, dur: 'e' }, { pos: 7, dur: 'e' }, { pos: 6, dur: 'e' }] },
    { lead: false, hold: true, words: ['sâu'], notes: [{ pos: 5, dur: 'w' }] },
  ] },
]

// Đệm hát — bài "Chia ô nhịp trên lời bài hát" (Diễm Xưa, đối chiếu sheet ↔ lời)
const SAMPLE_FLOW_BARSPLIT = {
  id: 'sample-barsplit',
  title: 'Chia ô nhịp trên lời bài hát',
  reward_xp: 10,
  slides: [
    { id: 'bs1', order: 1, logic: 'DAN', type: 'callout', title: 'Chia ô nhịp trên lời',
      interactive: { variant: 'teacher' },
      content: 'Trước khi đệm hát chắc nhịp, ta cần chia lời thành những <b>ô nhịp</b> đều nhau. Cùng nhìn sheet và kẻ vạch nhé.' },
    { id: 'bs2', order: 2, logic: 'NHAN', type: 'text', title: 'Vạch nhịp là gì?',
      content: '<p style="font-size:16px;line-height:1.7;margin:0;color:#3A352F;"><b>Vạch nhịp</b> ( | ) là đường kẻ dọc chia bài hát thành từng <b>ô nhịp</b>. Nhịp 4/4 nghĩa là mỗi ô gồm <b>4 phách</b> — không tính theo số chữ.</p>' },
    { id: 'bs3', order: 3, logic: 'NHAN', type: 'bar_split', title: 'Nhìn sheet → kẻ vạch vào lời',
      interactive: {
        lines: DX_LINES,
        caption: 'Mỗi <b>ô nhịp</b> đủ 4 phách — cả câu hát dồn vào một ô, rồi chữ cuối ngân trọn ô kế. Để ý <b style="color:#C2622E">vạch cam</b>: đó là chỗ <b>hết câu này sang câu sau</b> — chỗ người mới hay đọc dính (vd "cổ" và "Dài" là HAI ô khác nhau, đừng đọc liền).',
      } },
    { id: 'bs4', order: 4, logic: 'NGAM', type: 'checklist', title: 'Tự kiểm tra',
      interactive: { items: ['Mình hiểu vạch nhịp chia lời thành từng ô', 'Mình thấy một ô có thể chứa nhiều chữ, hoặc chỉ một chữ ngân dài'] } },
    { id: 'bs5', order: 5, logic: 'DAN', type: 'callout', title: 'Lời thầy',
      interactive: { variant: 'teacher' },
      content: 'Giỏi lắm! Khi đã chia được ô nhịp, bài kế ta sẽ tìm <b>phách mạnh</b> trong mỗi ô — chỗ đặt cú bass khi đệm.' },
  ],
}

// ── Minh hoạ HTML (palette ấm) dùng trong các slide text ──────────────────────
const EX1_LOI1 = `<div style="display:flex;flex-direction:column;gap:11px">
  <div style="display:flex;gap:10px;flex-wrap:wrap">
    <div style="flex:1 1 150px;background:#FBF6ED;border:1px solid #E6D8C2;border-radius:10px;padding:11px 12px">
      <div style="font-size:10.5px;font-weight:700;color:#9A8F7E;text-transform:uppercase;letter-spacing:.05em;margin-bottom:13px">Bản hợp âm mạng</div>
      <div style="line-height:2.1;font-size:15px;color:#3A352F">
        <span style="position:relative"><b style="position:absolute;top:-13px;left:0;font-size:11.5px;color:#BF5A37">Am</b>Chiều</span> buông
        <span style="position:relative"><b style="position:absolute;top:-13px;left:0;font-size:11.5px;color:#BF5A37">C</b>ngả</span> bên
        <span style="position:relative"><b style="position:absolute;top:-13px;left:0;font-size:11.5px;color:#BF5A37">Dm</b>thềm</span>
      </div>
      <div style="margin-top:8px;font-size:12.5px;color:#9A8F7E">Đếm hợp âm: <b style="color:#C0392B">3</b></div>
    </div>
    <div style="flex:1 1 150px;background:#fff;border:1.5px solid #BF5A37;border-radius:10px;padding:11px 12px">
      <div style="font-size:10.5px;font-weight:700;color:#9A8F7E;text-transform:uppercase;letter-spacing:.05em;margin-bottom:13px">Ô nhịp thật</div>
      <div style="display:flex;border:1px solid #E6D8C2;border-radius:6px;overflow:hidden;font-weight:700;text-align:center;font-size:15px">
        <div style="flex:1;padding:8px 0;background:#FBF0D8;color:#B07A14;border-right:1px solid #E6D8C2">Am</div>
        <div style="flex:1;padding:8px 0;background:#FBF0D8;color:#B07A14;border-right:1px solid #E6D8C2">Am</div>
        <div style="flex:1;padding:8px 0;border-right:1px solid #E6D8C2;color:#3A352F">C</div>
        <div style="flex:1;padding:8px 0;color:#3A352F">Dm</div>
      </div>
      <div style="margin-top:8px;font-size:12.5px;color:#9A8F7E">Ô thật: <b style="color:#3F6B4E">4</b> · Am giữ <b style="color:#B07A14">2 ô</b></div>
    </div>
  </div>
  <div style="background:#F6E7D8;border-radius:8px;padding:11px 13px;font-size:14px;line-height:1.5;color:#3A352F">Hợp âm lặp (Am sang ô 2) không ghi lại trên bản mạng → <b>số hợp âm ≠ số ô nhịp thật</b>.</div>
</div>`
const EX2_LOI2 = `<div style="display:flex;flex-direction:column;gap:10px;max-width:380px">
  <div style="border:2px solid #2A2622;border-radius:10px;overflow:hidden;display:flex">
    <div style="flex:1;border-right:2px dashed #C9BBA4">
      <div style="text-align:center;padding:8px 0 3px;font-size:20px;font-weight:700;color:#BF5A37">C</div>
      <div style="display:flex;border-top:1px solid #E6D8C2"><div style="flex:1;text-align:center;padding:5px 0;font-size:12.5px;color:#9A8F7E">1</div><div style="flex:1;text-align:center;padding:5px 0;font-size:12.5px;color:#9A8F7E">2</div></div>
      <div style="display:flex;justify-content:space-around;padding:5px 0;font-size:18px;color:#BF5A37"><span>↓</span><span>↓</span></div>
    </div>
    <div style="flex:1">
      <div style="text-align:center;padding:8px 0 3px;font-size:20px;font-weight:700;color:#3F6B4E">E7</div>
      <div style="display:flex;border-top:1px solid #E6D8C2"><div style="flex:1;text-align:center;padding:5px 0;font-size:12.5px;color:#9A8F7E">3</div><div style="flex:1;text-align:center;padding:5px 0;font-size:12.5px;color:#9A8F7E">4</div></div>
      <div style="display:flex;justify-content:space-around;padding:5px 0;font-size:18px;color:#3F6B4E"><span>↓</span><span>↓</span></div>
    </div>
  </div>
  <div style="text-align:center;font-size:11.5px;color:#9A8F7E">một ô nhịp 4/4 — 4 phách</div>
  <div style="background:#F6E7D8;border-radius:8px;padding:11px 13px;font-size:14px;line-height:1.5;color:#3A352F"><b style="color:#BF5A37">C</b> giữ phách 1–2, <b style="color:#3F6B4E">E7</b> giữ phách 3–4 — mỗi hợp âm <b>2 phách</b>.</div>
</div>`
const EXFINAL = `<div style="display:flex;flex-direction:column;gap:11px">
  <div style="display:flex;align-items:stretch;border:1px solid #E6D8C2;border-radius:10px;overflow:hidden;background:#fff">
    <div style="width:3px;background:#2A2622"></div>
    <div style="flex:1;padding:9px 4px;text-align:center;border-right:1px solid #E6D8C2"><div style="font-size:16px;font-weight:700;color:#BF5A37">Am</div><div style="font-size:13.5px;margin-top:6px;color:#3A352F">Chiều buông</div></div>
    <div style="width:3px;background:#2A2622"></div>
    <div style="flex:1;padding:9px 4px;text-align:center;border-right:1px solid #E6D8C2;background:#FBF0D8"><div style="font-size:16px;font-weight:700;color:#B07A14">Am</div><div style="font-size:13.5px;margin-top:6px;color:#3A352F">nắng rơi</div></div>
    <div style="width:3px;background:#2A2622"></div>
    <div style="flex:1.3;padding:9px 4px;text-align:center;border-right:1px solid #E6D8C2"><div style="display:flex;justify-content:space-around"><span style="font-size:16px;font-weight:700;color:#BF5A37">C</span><span style="font-size:16px;font-weight:700;color:#3F6B4E">E7</span></div><div style="font-size:13.5px;margin-top:6px;color:#3A352F">bên thềm xưa</div></div>
    <div style="width:3px;background:#2A2622"></div>
    <div style="flex:1;padding:9px 4px;text-align:center"><div style="font-size:16px;font-weight:700;color:#BF5A37">Dm</div><div style="font-size:13.5px;margin-top:6px;color:#3A352F">ấy</div></div>
    <div style="width:3px;background:#2A2622"></div>
  </div>
  <div style="display:flex;flex-direction:column;gap:5px;font-size:13px;color:#3A352F">
    <div>✓ Ô nhịp kẻ sẵn, lời rõ</div>
    <div>✓ Hợp âm lặp vẫn ghi (Am · Am)</div>
    <div>✓ Ô 2 hợp âm rõ (C · E7)</div>
    <div>✓ Nhìn lướt là đệm được, đổi tông chỉ thay tên hợp âm</div>
  </div>
</div>`
const txtSlide = (heading: string, body: string, extra = '') =>
  `<div style="display:flex;flex-direction:column;gap:12px"><div><div style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#BF5A37;margin-bottom:6px">${heading}</div><div style="font-size:15.5px;line-height:1.6;color:#3A352F">${body}</div></div>${extra}</div>`

// Đệm hát — bài "Biên soạn bản hợp âm có chia nhịp chuẩn" (12 slide, dựng ở lab)
const SAMPLE_FLOW_BIENSOAN = {
  id: 'sample-biensoan',
  title: 'Biên soạn bản hợp âm có chia nhịp chuẩn',
  reward_xp: 15,
  slides: [
    { id: 'b1', order: 1, logic: 'DAN', type: 'callout', title: 'Biên soạn bản hợp âm có chia nhịp chuẩn',
      interactive: { variant: 'teacher' },
      content: 'Từ <b>sheet nhạc</b> và <b>hợp âm trên mạng</b> → một bản đệm hát <b>dễ chơi, đúng nhịp</b>. Cùng học cách làm nhé.' },
    { id: 'b2', order: 2, logic: 'NHAN', type: 'text', title: 'Vì sao chưa đủ?',
      content: txtSlide('Vì sao chưa đủ', 'Bản hợp âm trên mạng chỉ đánh dấu <b>chỗ đổi hợp âm</b> → không cho thấy <b>ô nhịp</b>.<br/>Sheet nhạc chữ nhỏ, cố định một tông, cần màn hình lớn → khó dùng khi vừa hát vừa đàn.') },
    { id: 'b3', order: 3, logic: 'NGHI', type: 'text', title: 'Lỗi 1',
      content: txtSlide('Lỗi 1', 'Tưởng <b>1 hợp âm = 1 ô nhịp</b> → đếm nhịp theo số hợp âm, bị <b>thiếu ô</b>, chơi nhanh và lệch nhịp.', EX1_LOI1) },
    { id: 'b4', order: 4, logic: 'NGHI', type: 'text', title: 'Lỗi 2',
      content: txtSlide('Lỗi 2', 'Không hiểu <b>1 ô nhịp có thể chứa 2 hợp âm</b> → mỗi hợp âm thật ra chỉ giữ <b>2 phách</b> (trong nhịp 4/4).', EX2_LOI2) },
    { id: 'b5', order: 5, logic: 'DAN', type: 'callout', title: 'Kết luận',
      interactive: { variant: 'tip' },
      content: 'Muốn đệm đúng, phải biến bản hợp âm <b>"mơ hồ"</b> thành bản có <b>ô nhịp rõ ràng</b> trước khi chơi.' },
    { id: 'b6', order: 6, logic: 'NHAN', type: 'text', title: 'Bước 0: Chuẩn bị',
      content: txtSlide('Bước 0 · Chuẩn bị', 'Cần 3 thứ:<br/>• <b>Sheet nhạc gốc</b> (để xác định ô nhịp)<br/>• <b>Bản hợp âm lời</b> (copy text — để lấy lời + hợp âm)<br/>• <b>Bút</b> hoặc trình soạn cho phép gạch "|"') },
    { id: 'b7', order: 7, logic: 'LAM', type: 'bar_split', title: 'Bước 1: Kẻ vạch nhịp',
      interactive: { lines: DX_LINES, caption: 'Đếm số ô trên sheet → gạch <b>|</b> đúng vị trí đó lên lời. <b style="color:#C2622E">Vạch cam</b> = chỗ hết câu này sang câu sau (dễ kẻ nhầm).' } },
    { id: 'b8', order: 8, logic: 'LAM', type: 'text', title: 'Bước 2: Chép hợp âm vào từng ô',
      content: txtSlide('Bước 2 · Chép hợp âm', 'Tại <b>mỗi ô</b>, ghi lại hợp âm đang giữ — <b>trùng cũng ghi</b>.<br/>Không để ô trống.') },
    { id: 'b9', order: 9, logic: 'LAM', type: 'text', title: 'Bước 3: Xử lý ô có 2 hợp âm',
      content: txtSlide('Bước 3 · Ô 2 hợp âm', 'Chia ô 4/4 thành 2 phần: phách 1–2 & phách 3–4. Ghi <b>| C&nbsp;&nbsp;E7 |</b> — C giữ 2 phách đầu, E7 giữ 2 phách sau.', EX2_LOI2) },
    { id: 'b10', order: 10, logic: 'LAM', type: 'text', title: 'Bước 4: Ô giữ nguyên hợp âm',
      content: txtSlide('Bước 4 · Ô giữ nguyên', 'Nếu sheet cho biết ô tiếp theo <b>không đổi hợp âm</b>, vẫn <b>chép lặp lại</b> hợp âm ấy để tránh nhầm.<br/>Ví dụ: <b>| Am | Am | C | Dm |</b>') },
    { id: 'b11', order: 11, logic: 'NGAM', type: 'checklist', title: 'Bước 5: Kiểm tra',
      interactive: { items: ['Đếm 1-2-3-4, gõ nhịp — quạt thử điệu 4 phách nghe có khít giai điệu', 'Số ô nhịp khớp với sheet', 'Đổi hợp âm rơi đúng phách'] } },
    { id: 'b12', order: 12, logic: 'THUONG', type: 'text', title: 'Kết quả',
      content: txtSlide('Kết quả · Bản hoàn thiện', 'Một bản hợp âm <b>rõ ô nhịp</b> — nhìn lướt là đệm được, không lệch nhịp.', EXFINAL) },
  ],
}

// Tỉa nốt 1 — Bài 2 "Cụm Mi–Fa–Sol" (cụm nốt đầu tiên; trục = nốt, không phải dây)
const SAMPLE_FLOW_CUMMFS = {
  id: 'sample-cummfs',
  title: 'Cụm Mi – Fa – Sol',
  reward_xp: 10,
  slides: [
    { id: 'c1', order: 1, logic: 'DAN', type: 'callout', title: 'Cụm Mi – Fa – Sol',
      interactive: { variant: 'teacher' },
      content: 'Bạn đã chơi được nốt <b>Mi</b>. Hôm nay thêm <b>2 nốt mới</b> ngay cạnh nó — <b>Fa</b> và <b>Sol</b> — để có <b>cụm nốt đầu tiên</b>. Cùng một dây vẫn tạo ra nhiều nốt khác nhau.' },
    { id: 'c2', order: 2, logic: 'NHAN', type: 'note_show', title: 'Mi — ôn lại',
      interactive: { label: 'Mi', freq: 329.63, string: 1, fret: 0, staff: 7, showStaff: true, showFretboard: true, caption: '<b>Mi</b> bạn đã biết — dây 1 <b>buông</b> (○). Nghe lại cho chắc tai.' } },
    { id: 'c3', order: 3, logic: 'NHAN', type: 'note_show', title: 'Fa — nốt mới',
      interactive: { label: 'Fa', freq: 349.23, string: 1, fret: 1, staff: 8, showStaff: true, showFretboard: true, caption: '<b>Fa</b> — nốt mới: cùng dây, bấm <b>ngăn 1</b>. Trên khuông, Fa nằm ngay <b>trên</b> Mi một bậc.' } },
    { id: 'c4', order: 4, logic: 'NHAN', type: 'note_show', title: 'Sol — nốt mới',
      interactive: { label: 'Sol', freq: 392.00, string: 1, fret: 3, staff: 9, showStaff: true, showFretboard: true, caption: '<b>Sol</b> — nốt mới: cùng dây, bấm <b>ngăn 3</b>. Cao hơn Fa một bậc nữa.' } },
    { id: 'c5', order: 5, logic: 'LAM', type: 'note_practice', title: 'Đánh theo: Mi – Fa – Sol',
      interactive: { notes: [
        { label: 'Mi', freq: 329.63, string: 1, fret: 0, staff: 7 },
        { label: 'Fa', freq: 349.23, string: 1, fret: 1, staff: 8 },
        { label: 'Sol', freq: 392.00, string: 1, fret: 3, staff: 9 },
        { label: 'Mi', freq: 329.63, string: 1, fret: 0, staff: 7 },
        { label: 'Fa', freq: 349.23, string: 1, fret: 1, staff: 8 },
        { label: 'Sol', freq: 392.00, string: 1, fret: 3, staff: 9 },
      ] } },
    { id: 'c6', order: 6, logic: 'NGAM', type: 'checklist', title: 'Tự kiểm tra',
      interactive: { items: ['Mình gảy được 3 nốt Mi – Fa – Sol, tiếng rõ', 'Mình thấy 3 nốt đi LÊN dần trên khuông nhạc', 'Cùng một dây mà ra được 3 nốt khác nhau'] } },
    { id: 'c7', order: 7, logic: 'DAN', type: 'callout', title: 'Lời thầy',
      interactive: { variant: 'teacher' },
      content: 'Giỏi lắm! Bạn đã có <b>cụm nốt đầu tiên</b>. Bài sau, ta ghép 3 nốt này thành một <b>câu nhạc</b> — để thấy nốt là để tạo giai điệu, không phải học thuộc.' },
  ],
}

const SAMPLES: Record<string, typeof SAMPLE_FLOW> = { '4': SAMPLE_FLOW, '8': SAMPLE_FLOW_8, 'mi': SAMPLE_FLOW_MI, 'hopam': SAMPLE_FLOW_HOPAM, 'barsplit': SAMPLE_FLOW_BARSPLIT, 'biensoan': SAMPLE_FLOW_BIENSOAN, 'cummfs': SAMPLE_FLOW_CUMMFS }

export default function FlowLabPage() {
  const bai = new URLSearchParams(window.location.search).get('bai') ?? '4'
  const flow = SAMPLES[bai] ?? SAMPLE_FLOW
  return (
    <FlowPlayer
      key={flow.id}
      lessonId="sample"
      studentId=""
      previewFlow={flow}
      fullScreen
      onComplete={() => { /* preview — không ghi gì */ }}
      onBack={() => { window.location.href = '/admin' }}
      onOpenTool={(tool) => window.open('/' + (tool === 'tempo' ? 'tempo' : 'tuner') + '?embedded=1', '_blank')}
    />
  )
}
