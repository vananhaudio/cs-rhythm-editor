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
      content: 'Hôm nay em làm quen nốt nhạc đầu tiên: <b>nốt Mi</b>. Cùng nhìn, nghe và đánh theo nhé!' },
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
    { id: 'h1', order: 1, logic: 'DAN', type: 'callout', title: 'Hợp âm là gì?',
      interactive: { variant: 'teacher' },
      content: 'Hôm nay mình làm quen điều cốt lõi của đệm hát: <b>hợp âm</b>. Sau bài này em chỉ cần nhớ một điều — <b>hợp âm là nhiều nốt vang lên cùng lúc</b>.' },
    { id: 'h2', order: 2, logic: 'NHAN', type: 'text', title: 'Một dây & nhiều dây',
      content: '• Gảy <b>một</b> dây → một <b>nốt</b>, mỏng, đơn lẻ (tiếng <i>ting…</i>).<br/>• Gảy <b>nhiều</b> dây cùng lúc → dày, đầy hơn (tiếng <i>reng…</i>) — đó là <b>hợp âm</b>.' },
    { id: 'h3', order: 3, logic: 'NHAN', type: 'callout', title: 'Dễ hình dung',
      interactive: { variant: 'tip' },
      content: 'Nghĩ về tiếng hát: <b>một nốt</b> = một người hát (nghe mỏng); <b>một hợp âm</b> = nhiều người hát cùng lúc (nghe đầy hơn).' },
    { id: 'h4', order: 4, logic: 'NHAN', type: 'guitar_chord', title: 'Hợp âm Em trên guitar',
      interactive: { name: 'Em', caption: 'Đây là thế bấm <b>Em</b> (2 ngón ở phím 2). Bấm <b>Nghe</b> để nghe hợp âm, rồi bấm Em và gảy thử nhiều dây trên cây đàn của em.' } },
    { id: 'h5', order: 5, logic: 'NHAN', type: 'callout', title: 'Hợp âm để làm gì?',
      interactive: { variant: 'teacher' },
      content: 'Hợp âm dùng để <b>đệm hát</b>: người hát giữ <b>giai điệu</b>, guitar đánh <b>hợp âm</b> phía sau làm nền nhạc.' },
    { id: 'h6', order: 6, logic: 'NGAM', type: 'checklist', title: 'Bài tập nhỏ — tự kiểm',
      interactive: { items: ['Mình đã gảy 1 dây — nghe tiếng mỏng (ting)', 'Mình đã bấm Em rồi gảy nhiều dây — nghe tiếng đầy (reng)', 'Mình nghe được sự khác nhau giữa một nốt và một hợp âm'] } },
    { id: 'h7', order: 7, logic: 'DAN', type: 'callout', title: 'Câu chốt',
      interactive: { variant: 'teacher' },
      content: '<b>Hợp âm là nhiều nốt vang lên cùng lúc</b> — trên guitar là một thế bấm để tạo âm thanh đầy hơn, dùng để đệm hát.<br/>Mục tiêu khi học hợp âm: <b>bấm đúng · gảy rõ · không rè · không tịt</b>.' },
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
