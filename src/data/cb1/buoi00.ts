// ── GUITAR CĂN BẢN 1 (CB1.T3) · BUỔI 00 — Nhập môn: làm quen với cây đàn ──
// KHÔNG có bài trả, KHÔNG có checkpoint: buổi chuẩn bị, không được làm điều kiện khoá Buổi 01.
// Lời tư thế ngồi lấy từ bài "Tư thế ngồi & đặt đàn" của Thầy (course Nhập Môn). Chưa đưa vào DB — xem ghi chú ở báo cáo (cơ chế mở khoá).
import type { LessonDoc } from '../../lesson/lessonTypes'

// Ngón tay trái trong alphaTex lệch 1 (xem solo01/buoi01.ts): ngón Việt n ⇒ `lf n+1`. Chỉ TAB, không khuông (chưa học nốt).
const NGON_1234 = `
\\tempo 60
\\ts 4 4
\\staff {tabs}
.
1.1{lf 2}.4 2.1{lf 3}.4 3.1{lf 4}.4 4.1{lf 5}.4
`.trim()

export const CB1_BUOI00: LessonDoc = {
  meta: {
    programCode: 'CB1',
    programName: 'GUITAR CĂN BẢN 1',
    sessionNo: 0,
    title: 'Nhập môn — Làm quen với cây đàn',
    stageLabel: 'Chuẩn bị trước Buổi 01',
    backHref: '/me',
  },
  sections: [
    {
      kind: 'objectives',
      items: [
        'Cầm đàn đúng, ngồi thoải mái, không gồng.',
        'Biết tay phải: p – i – m – a.',
        'Biết tay trái: ngón 1 – 2 – 3 – 4.',
        'Gảy được từng dây riêng, tiếng rõ.',
        'Sẵn sàng bước sang học nốt nhạc ở Buổi 01.',
      ],
    },
    {
      kind: 'study',
      tag: 'Phần 1',
      title: 'Cách cầm đàn',
      blocks: [
        { b: 'callout', label: 'MỤC TIÊU', text: 'Ngồi sao cho đàn vững, tay không gồng, lưng không mỏi.' },
        {
          b: 'ul',
          items: [
            'Ghế cao vừa, hai chân chạm đất.',
            'Eo đàn đặt lên đùi phải (cổ điển: đùi trái + kê chân).',
            'Cần đàn hơi chếch lên, lưng thẳng tự nhiên.',
            'Vai và cánh tay thả lỏng.',
          ],
        },
      ],
    },
    {
      kind: 'checklist',
      title: 'Tự kiểm tra tư thế',
      items: [
        'Hai vai thả lỏng, không nhô.',
        'Cổ tay phải không gồng.',
        'Đàn không trượt khi buông tay phải.',
      ],
    },
    {
      kind: 'study',
      tag: 'Phần 2',
      title: 'Bàn tay phải',
      blocks: [
        { b: 'table', rows: [['Ký hiệu', 'Ngón'], ['p', 'ngón cái'], ['i', 'ngón trỏ'], ['m', 'ngón giữa'], ['a', 'ngón áp út']] },
        { b: 'p', text: 'Đàn có 6 dây. Hãy gảy từng dây một, thật chậm.' },
        { b: 'callout', label: 'MỤC TIÊU', text: 'Gảy được từng dây riêng biệt, tiếng rõ, tay thư giãn.' },
      ],
    },
    {
      kind: 'study',
      tag: 'Phần 3',
      title: 'Bàn tay trái',
      blocks: [
        { b: 'table', rows: [['Số', 'Ngón'], ['1', 'ngón trỏ'], ['2', 'ngón giữa'], ['3', 'ngón áp út'], ['4', 'ngón út']] },
        {
          b: 'ul',
          items: [
            'Đầu ngón bấm dây.',
            'Ngón cong tự nhiên.',
            'Bấm gần phím.',
            'Không cần dùng lực quá mạnh.',
          ],
        },
      ],
    },
    {
      kind: 'score',
      subtitle: 'Làm quen',
      title: 'Ngón 1 – 2 – 3 – 4',
      lead: 'Mỗi ngón một ngăn: ngón 1 bấm ngăn 1, ngón 2 bấm ngăn 2, ngón 3 bấm ngăn 3, ngón 4 bấm ngăn 4. Số trên TAB là ngăn đàn.',
      tempo: '♩ = 60',
      tex: NGON_1234,
      guidance: ['Chỉ để làm quen: NGÓN TAY → NGĂN ĐÀN → ÂM THANH. Chưa cần đọc nốt.'],
    },
    {
      kind: 'flow',
      title: 'Sang Buổi 01',
      lead: 'Ở Buổi 01, chúng ta bắt đầu học cây đàn bằng NỐT NHẠC. Bạn sẽ học cách:',
      steps: [
        { label: 'Đọc', value: 'Nốt nhạc' },
        { label: 'Tìm', value: 'Nốt đó trên cần đàn' },
        { label: 'Chơi', value: 'Nốt đó' },
        { label: 'Ghép', value: 'Thành giai điệu' },
      ],
    },
  ],
}
