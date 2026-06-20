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

const SAMPLES: Record<string, typeof SAMPLE_FLOW> = { '4': SAMPLE_FLOW, '8': SAMPLE_FLOW_8, 'mi': SAMPLE_FLOW_MI, 'hopam': SAMPLE_FLOW_HOPAM }

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
