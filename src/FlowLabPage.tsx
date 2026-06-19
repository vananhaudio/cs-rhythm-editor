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
    { id: 's7', order: 7, logic: 'DAN', type: 'callout', title: '',
      interactive: { variant: 'teacher' },
      content: 'Tốt lắm! Tên dây sẽ ngấm dần khi bạn chơi. Vấp ở đâu, <b>nhắn thầy Văn Anh</b> ở đó nhé. 🎸' },
  ],
}

export default function FlowLabPage() {
  return (
    <FlowPlayer
      lessonId="sample"
      studentId=""
      previewFlow={SAMPLE_FLOW}
      fullScreen
      onComplete={() => { /* preview — không ghi gì */ }}
      onBack={() => { window.location.href = '/admin' }}
      onOpenTool={(tool) => window.open('/' + (tool === 'tempo' ? 'tempo' : 'tuner') + '?embedded=1', '_blank')}
    />
  )
}
