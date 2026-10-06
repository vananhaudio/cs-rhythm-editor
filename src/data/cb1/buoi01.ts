// ── GUITAR CĂN BẢN 1 (CB1.T3) · BUỔI 01 — Các nốt nhạc 3 ngăn đầu cần đàn ──
// Triết lý: học guitar bằng NỐT NHẠC ngay từ đầu; TAB chỉ giúp biết nốt nằm ở đâu.
// KẾ THỪA từ SOLO01 (không sửa file SOLO01): khối score (khuông + TAB, alphaTex), khối fretboard, lyrics = tên nốt dưới khuông.
//   · BAI_1_2 = Bài tập 01 "Âm giai C–Am" của SOLO01 Buổi 01 (trọn trong 3 ngăn đầu).
//   · ETUDE   = Etude 02 của SOLO01 Buổi 02, CHỈ bè giai điệu (bỏ bè Bass).
// Mạch: HỌC 6 DÂY → TRẢ 1.1 → HỌC NỐT → TRẢ 1.2 → GIAI ĐIỆU → TRẢ 1.3. Không có "điểm dừng luyện tập" riêng.
// Quy ước alphaTab: dây 1 = Mi cao … 6 = Mi trầm; fret.dây.trườngđộ; ngón Việt n ⇒ `lf n+1`; dây buông không ghi ngón.
import type { FretDot, FretZone, LessonDoc } from '../../lesson/lessonTypes'

const Z = '#4338CA'
const ZONES: FretZone[] = [
  { no: 1, label: 'Ba ngăn đầu cần đàn', tag: '3 NGĂN ĐẦU', fromFret: 0, toFret: 3, strings: [1, 6], color: Z, hint: 'ngăn 0 (dây buông) đến ngăn 3, cả 6 dây.' },
]
const d = (string: number, fret: number, name: string, root = false): FretDot => ({ string, fret, name, zone: 1, root })

// Dây buông — chính là các nốt ở ngăn 0
const DAY_BUONG: FretDot[] = [d(1, 0, 'E'), d(2, 0, 'B'), d(3, 0, 'G'), d(4, 0, 'D'), d(5, 0, 'A'), d(6, 0, 'E')]
// Nốt tự nhiên trong 3 ngăn đầu
const BA_NGAN: FretDot[] = [
  d(6, 0, 'E'), d(6, 1, 'F'), d(6, 3, 'G'),
  d(5, 0, 'A'), d(5, 2, 'B'), d(5, 3, 'C', true),
  d(4, 0, 'D'), d(4, 2, 'E'), d(4, 3, 'F'),
  d(3, 0, 'G'), d(3, 2, 'A'),
  d(2, 0, 'B'), d(2, 1, 'C', true), d(2, 3, 'D'),
  d(1, 0, 'E'), d(1, 1, 'F'), d(1, 3, 'G'),
]

// ── PHẦN 1 — 6 dây buông: dây 1 → 6, rồi 6 → 1. Tên nốt viết dưới khuông (lyrics). ──
const SAU_DAY = `
\\tempo 60
\\ts 6 4
\\lyrics "E B G D A E E A D G B E"
.
0.1.4 0.2.4 0.3.4 0.4.4 0.5.4 0.6.4 |
0.6.4 0.5.4 0.4.4 0.3.4 0.2.4 0.1.4
`.trim()

// ── PHẦN 2 — từng cụm 2 dây. Ngăn 1 = ngón 1 (lf 2), ngăn 2 = ngón 2 (lf 3), ngăn 3 = ngón 3 (lf 4). ──
const CUM_1_2 = `
\\tempo 60
\\ts 3 4
\\lyrics "E F G B C D"
.
0.1.4 1.1{lf 2}.4 3.1{lf 4}.4 |
0.2.4 1.2{lf 2}.4 3.2{lf 4}.4
`.trim()

const CUM_3_4 = `
\\tempo 60
\\ts 3 4
\\lyrics "G A D E F"
.
0.3.4 2.3{lf 3}.2 |
0.4.4 2.4{lf 3}.4 3.4{lf 4}.4
`.trim()

const CUM_5_6 = `
\\tempo 60
\\ts 3 4
\\lyrics "A B C E F G"
.
0.5.4 2.5{lf 3}.4 3.5{lf 4}.4 |
0.6.4 1.6{lf 2}.4 3.6{lf 4}.4
`.trim()

// Bài tập 01 của SOLO01 Buổi 01 (âm giai C–Am, Vùng 1) — dùng nguyên cho Bài trả 1.2
const BAI_1_2 = `
\\tempo 60
\\ts 4 4
.
3.5{lf 4}.4 0.4.4 2.4{lf 3}.4 3.4{lf 4}.4 |
0.3.4 2.3{lf 3}.4 0.2.4 1.2{lf 2}.4 |
1.2{lf 2}.4 0.2.4 2.3{lf 3}.4 0.3.4 |
3.4{lf 4}.4 2.4{lf 3}.4 0.4.2 |
3.5{lf 4}.1
`.trim()

// Etude 02 của SOLO01 Buổi 02 — chỉ bè giai điệu, toàn bộ trong 3 ngăn đầu
const ETUDE = `
\\tempo 66
\\ts 4 4
.
2.3{lf 3}.4 1.2{lf 2}.4 0.2.2 |
3.2{lf 4}.4 1.2{lf 2}.4 2.3{lf 3}.2 |
0.2.4 1.2{lf 2}.4 3.2{lf 4}.4 0.2.4 |
2.3{lf 3}.1 |
0.1.4 1.1{lf 2}.4 0.1.2 |
3.2{lf 4}.4 1.1{lf 2}.4 0.1.2 |
3.2{lf 4}.4 1.2{lf 2}.4 0.2.2 |
2.3{lf 3}.1 |
1.2{lf 2}.4 3.2{lf 4}.4 1.1{lf 2}.2 |
0.1.4 3.2{lf 4}.4 1.2{lf 2}.4 0.2.4 |
2.3{lf 3}.4 0.2.4 1.2{lf 2}.2 |
2.3{lf 3}.1
`.trim()

export const CB1_BUOI01: LessonDoc = {
  meta: {
    programCode: 'CB1',
    programName: 'GUITAR CĂN BẢN 1',
    sessionNo: 1,
    title: 'Các nốt nhạc 3 ngăn đầu cần đàn',
    stageLabel: 'Vòng 1 · Học đàn bằng nốt nhạc',
    backHref: '/me',
  },
  sections: [
    {
      kind: 'objectives',
      items: [
        'Biết tên 6 dây đàn.',
        'Biết các nốt tự nhiên trong 3 ngăn đầu cần đàn.',
        'Nhìn nốt nhạc + TAB và tìm được vị trí trên đàn.',
        'Chơi được các câu nhạc ngắn.',
        'Bắt đầu hiểu guitar là nhạc cụ tạo ra NỐT NHẠC, không chỉ là các thế hợp âm.',
      ],
    },
    // ── PHẦN 1 — 6 DÂY BUÔNG ──
    {
      kind: 'note',
      title: 'Nhịp 1 · Sáu dây buông',
      text: 'Nốt trên khuông → tên nốt → vị trí trên đàn (TAB) → chơi. Kết thúc nhịp: Bài trả 1.1.',
    },
    {
      kind: 'score',
      subtitle: 'Phần 1',
      title: 'Sáu dây buông',
      lead: 'Dây 1 = E · dây 2 = B · dây 3 = G · dây 4 = D · dây 5 = A · dây 6 = E. Dòng đầu đi từ dây 1 đến dây 6, dòng sau đi ngược lại. Tên nốt viết dưới khuông.',
      tempo: '♩ = 60',
      tex: SAU_DAY,
      guidance: [
        'Gảy thật chậm, vừa gảy vừa đọc tên nốt.',
        'Số trên TAB là ngăn đàn: 0 nghĩa là dây buông, không bấm.',
      ],
    },
    {
      kind: 'fretboard',
      title: 'Sáu dây buông trên cần đàn',
      lead: 'Mỗi dây buông là một nốt: E – B – G – D – A – E (dây 1 → dây 6).',
      frets: 3,
      zones: ZONES,
      dots: DAY_BUONG,
      legend: ['E = Mi', 'B = Si', 'G = Sol', 'D = Rê', 'A = La'],
    },
    {
      kind: 'checkpoint',
      id: '1.1',
      title: 'Bài trả 1.1 — Sáu dây buông',
      prompt: 'Viết tên nốt của 6 dây buông, từ dây 1 đến dây 6 (ví dụ: dây 1 = …). Sau đó chơi lần lượt 6 dây thật chậm, vừa gảy vừa đọc tên nốt. Kèm một dòng: dây nào bạn còn hay nhầm?',
      required: true,
      accepts: ['text'],
    },
    // ── PHẦN 2 — CÁC NỐT TRONG 3 NGĂN ĐẦU ──
    {
      kind: 'note',
      title: 'Nhịp 2 · Các nốt trong 3 ngăn đầu',
      text: 'Học theo từng cụm hai dây để không bị ngợp. Chưa cần thuộc lòng: tạo phản xạ THẤY NỐT → GỌI TÊN → TÌM TRÊN ĐÀN → CHƠI. Kết thúc nhịp: Bài trả 1.2.',
    },
    {
      kind: 'fretboard',
      title: 'Các nốt tự nhiên trong 3 ngăn đầu',
      lead: 'Dây 1: E F G · dây 2: B C D · dây 3: G A · dây 4: D E F · dây 5: A B C · dây 6: E F G.',
      frets: 3,
      zones: ZONES,
      dots: BA_NGAN,
      legend: ['C = Đô', 'D = Rê', 'E = Mi', 'F = Fa', 'G = Sol', 'A = La', 'B = Si', 'nốt tô đậm = nốt C (Đô)'],
    },
    {
      kind: 'score',
      subtitle: 'Cụm 1',
      title: 'Dây 1 và dây 2',
      lead: 'Dây 1: E – F – G. Dây 2: B – C – D.',
      tempo: '♩ = 60',
      tex: CUM_1_2,
      guidance: ['Số cạnh nốt là ngón tay trái: 1 = trỏ, 2 = giữa, 3 = áp út.'],
    },
    {
      kind: 'score',
      subtitle: 'Cụm 2',
      title: 'Dây 3 và dây 4',
      lead: 'Dây 3: G – A. Dây 4: D – E – F.',
      tempo: '♩ = 60',
      tex: CUM_3_4,
    },
    {
      kind: 'score',
      subtitle: 'Cụm 3',
      title: 'Dây 5 và dây 6',
      lead: 'Dây 5: A – B – C. Dây 6: E – F – G.',
      tempo: '♩ = 60',
      tex: CUM_5_6,
    },
    {
      kind: 'score',
      subtitle: 'Đọc và chơi',
      title: 'Chuỗi nốt trong 3 ngăn đầu',
      lead: 'Nhìn khuông, đọc tên nốt, tìm trên đàn bằng TAB rồi chơi. Chậm và đều, không cần nhanh.',
      tempo: '♩ = 60',
      tex: BAI_1_2,
      guidance: ['Đúng nốt và đều trước, nhanh sau.'],
    },
    {
      kind: 'checkpoint',
      id: '1.2',
      title: 'Bài trả 1.2 — Đọc và chơi nốt trong 3 ngăn đầu',
      prompt: 'Nhìn 2 ô nhịp đầu của chuỗi nốt trên: ghi tên từng nốt và vị trí của nó, theo dạng “nốt: dây … ngăn …” (ví dụ: C: dây 5 ngăn 3). Sau đó chơi cả chuỗi chậm và đều. Không cần video.',
      required: true,
      accepts: ['text'],
    },
    // ── PHẦN 3 — GIAI ĐIỆU ĐẦU TIÊN ──
    {
      kind: 'note',
      title: 'Nhịp 3 · Giai điệu đầu tiên',
      text: 'Từ chạy nốt sang chơi nhạc: một đoạn giai điệu chỉ dùng những nốt bạn vừa học. Kết thúc nhịp: Bài trả 1.3.',
    },
    {
      kind: 'score',
      subtitle: 'Etude',
      title: 'Giai điệu đầu tiên',
      lead: '12 ô nhịp, chỉ dùng nốt trong 3 ngăn đầu. Khuông nhạc và TAB đi cùng nhau.',
      tempo: '♩ = 66',
      tex: ETUDE,
      guidance: ['Chậm cũng được. Quan trọng là đúng nốt, đúng vị trí và dòng nhạc liên tục.'],
    },
    {
      kind: 'checkpoint',
      id: '1.3',
      title: 'Bài trả 1.3 — Giai điệu đầu tiên',
      prompt: 'Quay video bạn chơi hoàn chỉnh đoạn giai điệu trên. Không cần nhanh. Thầy xem: đúng nốt · đúng vị trí · dòng nhạc liên tục.',
      required: true,
      accepts: ['text', 'video_link'],
    },
    // ── ĐUÔI BUỔI ──
    {
      kind: 'assignment',
      items: [
        { label: 'Bài 1.', text: 'Gảy 6 dây buông thật chậm, vừa gảy vừa đọc tên nốt.' },
        { label: 'Bài 2.', text: 'Mỗi ngày đọc và chơi từng cụm nốt trong 3 ngăn đầu: dây 1–2, dây 3–4, dây 5–6.' },
        { label: 'Bài 3.', text: 'Chơi giai điệu đầu tiên thật chậm và liên tục.' },
      ],
      message: 'Không cần tập hoàn hảo. Hãy mang đúng những chỗ chưa làm được đến buổi học.',
    },
    {
      kind: 'checklist',
      items: [
        'Tôi biết tên 6 dây đàn.',
        'Tôi đọc được tên các nốt tự nhiên trong 3 ngăn đầu.',
        'Tôi nhìn nốt nhạc và TAB tìm được vị trí trên đàn.',
        'Tôi chơi được giai điệu đầu tiên.',
        'Tôi đã gửi Bài trả 1.1, 1.2 và 1.3.',
      ],
    },
    { kind: 'studentNotes', lines: 8 },
  ],
}
