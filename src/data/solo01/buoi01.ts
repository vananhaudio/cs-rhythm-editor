// ── SOLO-01 · BUỔI 01 — nội dung giáo trình (dữ liệu, không phải giao diện) ──
// Bản nhạc lưu ở dạng alphaTex (có cấu trúc) → alphaTab dựng khuông + TAB.
// Quy ước dây alphaTab: 1 = Mi cao … 6 = Mi trầm. Cú pháp nốt: fret.dây.trườngđộ
// (trường độ: 1 = tròn, 2 = trắng, 4 = đen, 8 = móc đơn).
import type { LessonDoc, FretDot, FretZone } from '../../lesson/lessonTypes'
import { WORK_DIEM_XUA, WORK_THANH_PHO_BUON } from './works'

const Z1 = '#4338CA', Z2 = '#7C3AED', Z3 = '#A855F7'

const ZONES: FretZone[] = [
  { no: 1, label: 'Vùng 1 — Đầu cần', fromFret: 0, toFret: 3, strings: [1, 6], color: Z1,
    hint: 'ngăn 0–3, dùng cả 6 dây. Đây là vùng nền tảng.' },
  { no: 2, label: 'Vùng 2 — Giữa cần', fromFret: 5, toFret: 8, strings: [1, 3], color: Z2,
    hint: 'tập trung dây 1 – 2 – 3.' },
  { no: 3, label: 'Vùng 3 — Vùng cao', fromFret: 10, toFret: 17, strings: [1, 2], color: Z3,
    hint: 'tập trung dây 1 – 2.' },
]

const d = (string: number, fret: number, name: string, zone: number, root = false): FretDot =>
  ({ string, fret, name, zone, root })

const DOTS: FretDot[] = [
  // Vùng 1 — đầu cần, cả 6 dây
  d(6, 0, 'E', 1), d(6, 1, 'F', 1), d(6, 3, 'G', 1),
  d(5, 0, 'A', 1), d(5, 2, 'B', 1), d(5, 3, 'C', 1, true),
  d(4, 0, 'D', 1), d(4, 2, 'E', 1), d(4, 3, 'F', 1),
  d(3, 0, 'G', 1), d(3, 2, 'A', 1, true),
  d(2, 0, 'B', 1), d(2, 1, 'C', 1, true), d(2, 3, 'D', 1),
  d(1, 0, 'E', 1), d(1, 1, 'F', 1), d(1, 3, 'G', 1),
  // Vùng 2 — giữa cần, dây 1–2–3
  d(3, 5, 'C', 2, true), d(3, 7, 'D', 2),
  d(2, 5, 'E', 2), d(2, 6, 'F', 2), d(2, 8, 'G', 2),
  d(1, 5, 'A', 2, true), d(1, 7, 'B', 2), d(1, 8, 'C', 2, true),
  // Vùng 3 — vùng cao, dây 1–2
  d(2, 10, 'A', 3, true), d(2, 12, 'B', 3), d(2, 13, 'C', 3, true),
  d(1, 10, 'D', 3), d(1, 12, 'E', 3), d(1, 13, 'F', 3), d(1, 15, 'G', 3), d(1, 17, 'A', 3, true),
]

// ⚠️ NGÓN TAY TRÁI TRONG alphaTex LỆCH 1: `lf 1` = NGÓN CÁI (in ra chữ "T"),
// `lf 2` = ngón 1 (trỏ) … `lf 5` = ngón 4 (út). Ngón Việt n  ⇒  viết `lf n+1`.
// Dây buông KHÔNG ghi ngón. `{ss}` = trượt ngón đổi thế (đặt ở nốt TRƯỚC khi chuyển).

// ── Bài tập 01 — âm giai C–Am ở Vùng 1, đi lên rồi đi xuống ──
const EX1 = `
\\tempo 60
\\ts 4 4
.
3.5{lf 4}.4 0.4.4 2.4{lf 3}.4 3.4{lf 4}.4 |
0.3.4 2.3{lf 3}.4 0.2.4 1.2{lf 2}.4 |
1.2{lf 2}.4 0.2.4 2.3{lf 3}.4 0.3.4 |
3.4{lf 4}.4 2.4{lf 3}.4 0.4.2 |
3.5{lf 4}.1
`.trim()

// ── Bài tập 02 — liên thông Vùng 1 → 2 → 3 rồi quay về ──
// Nguyên tắc: KHÔNG nhảy vùng giữa hai dây khác nhau. Mỗi lần đổi thế tay đều đi
// dọc MỘT sợi dây (dây 3 nối Vùng 1↔2, dây 1 nối Vùng 2↔3) và có dấu trượt ngón,
// để tai và tay đều nghe/thấy đường đi liền mạch.
const EX2 = `
\\tempo 60
\\ts 4 4
.
3.5{lf 4}.4 0.4.4 2.4{lf 3}.4 3.4{lf 4}.4 |
0.3.4 2.3{lf 3}.4 0.2.4 1.2{lf 2}.4 |
2.3{lf 2}.4 4.3{lf 4}.4 5.3{lf 5 ss}.4 7.3{lf 5}.4 |
5.2{lf 2}.4 6.2{lf 3}.4 8.2{lf 5}.4 5.1{lf 2}.4 |
7.1{lf 2}.4 8.1{lf 3}.4 10.1{lf 5 ss}.4 12.1{lf 5}.4 |
13.1{lf 5}.2 12.1{lf 4}.2 |
10.1{lf 5}.4 8.1{lf 3}.4 7.1{lf 2 ss}.4 5.1{lf 2}.4 |
8.2{lf 5}.4 6.2{lf 3}.4 5.2{lf 2}.4 7.3{lf 4}.4 |
5.3{lf 5 ss}.4 4.3{lf 5}.4 2.3{lf 3}.4 0.3.4 |
3.4{lf 4}.4 2.4{lf 3}.4 0.4.2 |
3.5{lf 4}.1
`.trim()

// ── Etude 01 — Đường giai điệu (nguyên bản, C–Am) ──
// Chuyển vùng cũng đi dọc DÂY 2 (C4 → D4 → trượt lên E4) và về đúng đường cũ.
const ETUDE1 = `
\\tempo 66
\\ts 4 4
.
2.3{lf 3}.4 1.2{lf 2}.4 0.2.2 |
0.3.4 2.3{lf 3}.4 3.4{lf 4}.2 |
2.4{lf 3}.4 3.4{lf 4}.4 0.3.4 2.3{lf 3}.4 |
1.2{lf 2}.4 3.2{lf 2 ss}.4 5.2{lf 2}.2 |
6.2{lf 3}.4 8.2{lf 5}.4 5.1{lf 2}.2 |
8.2{lf 5}.4 6.2{lf 3}.4 5.2{lf 2 ss}.2 |
3.2{lf 2}.4 1.2{lf 2}.4 0.2.2 |
2.3{lf 3}.1 |
0.2.4 1.2{lf 2}.4 0.2.4 2.3{lf 3}.4 |
0.3.4 2.3{lf 3}.4 0.2.2 |
1.2{lf 2}.4 0.2.4 2.3{lf 3}.4 0.3.4 |
2.3{lf 3}.1
`.trim()

export const SOLO01_BUOI01: LessonDoc = {
  meta: {
    programCode: 'SOLO-01',
    programName: 'SOLO GUITAR CĂN BẢN',
    sessionNo: 1,
    title: 'Bản đồ nốt giản lược C–Am và ứng dụng vào giai điệu Solo',
    stageLabel: 'Chặng 1 · Từ giai điệu đến Solo Guitar',
    backHref: '/solo01',
  },
  sections: [
    {
      kind: 'objectives',
      items: [
        'Nhìn được bản đồ nốt C–Am giản lược.',
        'Chơi được bài tập âm giai liên thông.',
        'Bắt đầu di chuyển từ vùng thấp lên vùng cao.',
        'Đọc và chơi được một Etude ngắn.',
        'Áp dụng vào một đoạn giai điệu thực tế.',
      ],
    },
    {
      kind: 'fretboard',
      title: 'Bản đồ nốt C–Am',
      lead: '7 nốt · C – D – E – F – G – A – B (Đô – Rê – Mi – Fa – Sol – La – Si), chia thành 3 vùng.',
      frets: 17,
      zones: ZONES,
      dots: DOTS,
      legend: ['C = Đô', 'D = Rê', 'E = Mi', 'F = Fa', 'G = Sol', 'A = La', 'B = Si',
        'nốt tô đậm = nốt trụ của vùng'],
    },
    {
      kind: 'note',
      title: 'Nguyên tắc “giản lược”',
      text: 'Một nốt có thể xuất hiện ở nhiều vị trí trên Guitar. Bản đồ giản lược chỉ chọn những vị trí cần ghi nhớ trước để học viên dễ sử dụng khi chơi melody.',
    },
    {
      kind: 'score',
      subtitle: 'Bài tập kỹ thuật 01',
      title: 'Âm giai C–Am',
      lead: 'Đi lên C – D – E – F – G – A – B – C, đi xuống C – B – A – G – F – E – D – C. Toàn bộ ở Vùng 1.',
      tempo: 'Tempo khởi đầu: ♩ = 60',
      tex: EX1,
      guidance: [
        'Tay phải luân phiên i – m, không dùng một ngón đánh liên tiếp.',
        'Số cạnh nốt là ngón tay trái: 1 = trỏ, 2 = giữa, 3 = áp út, 4 = út. Dây buông không ghi số.',
        'Đúng nốt và đều trước, nhanh sau.',
      ],
    },
    {
      kind: 'score',
      subtitle: 'Bài tập kỹ thuật 02',
      title: 'Liên thông các vùng',
      lead: '12 ô nhịp: bắt đầu ở Vùng 1, đi dần lên Vùng 2, lên Vùng 3, rồi quay trở lại.',
      tempo: 'Tempo khởi đầu: ♩ = 60',
      tex: EX2,
      marks: [
        { at: 'Ô 1–2', text: 'Vùng 1 — đầu cần' },
        { at: 'Ô 3', text: 'cầu nối DÂY 3: ngón 4 trượt từ ngăn 5 lên ngăn 7 (sang Vùng 2)' },
        { at: 'Ô 5', text: 'cầu nối DÂY 1: ngón 4 trượt từ ngăn 10 lên ngăn 12 (sang Vùng 3)' },
        { at: 'Ô 7', text: 'về Vùng 2 — ngón 1 trượt từ ngăn 7 xuống ngăn 5' },
        { at: 'Ô 9', text: 'về Vùng 1 — ngón 4 trượt từ ngăn 5 xuống ngăn 4' },
      ],
      guidance: [
        'Đây là bài tập quan trọng nhất của Buổi 01 — học tư duy ĐƯỜNG ĐI, không phải học nốt lẻ.',
        'Mỗi lần đổi vùng đều đi dọc MỘT sợi dây: dây 3 nối Vùng 1 với Vùng 2, dây 1 nối Vùng 2 với Vùng 3. Không nhảy vùng ngang qua dây khác.',
        'Trượt thì HAI NỐT CÙNG MỘT NGÓN: ngón đó giữ nguyên trên dây và đi dọc, không đổi sang ngón khác giữa chừng.',
        'Chậm – đều – không đứt tiếng.',
      ],
    },
    {
      kind: 'score',
      subtitle: 'Etude 01',
      title: 'Đường giai điệu',
      lead: 'Cầu nối từ “chạy nốt” sang “chơi nhạc”: 12 ô nhịp, chỉ dùng nốt C–Am, có một lần chuyển vùng.',
      tempo: 'Tempo: ♩ = 66',
      tex: ETUDE1,
      marks: [
        { at: 'Ô 4', text: 'ngón 1 trượt trên DÂY 2 từ ngăn 3 lên ngăn 5 (sang Vùng 2)' },
        { at: 'Ô 6', text: 'ngón 1 trượt ngược từ ngăn 5 xuống ngăn 3' },
      ],
      guidance: [
        'Hát thầm câu nhạc trước khi chơi — Etude này là một melody, không phải bài chạy âm giai.',
        'Ngân đủ nốt trắng và nốt tròn ở cuối câu.',
      ],
    },
    {
      kind: 'repertoire',
      title: 'Tác phẩm thực hành',
      candidates: ['Thành Phố Buồn — Lam Phương (Am)', 'Diễm Xưa — Trịnh Công Sơn (Am)'],
      status: 'ready',
      pieces: [
        {
          title: 'Thành Phố Buồn',
          composer: 'Lam Phương · chuyển về Am',
          note: 'Bản gốc ở Sol trưởng/Em, đã hạ về Am. Toàn bộ giai điệu nằm gọn trong Vùng 1 (ngăn 0–5, dây 1–4) — tay trái không phải đổi thế lần nào. Đây là tác phẩm chính của Buổi 01.',
          tempo: 'Slow rock · chậm, đủ chỗ cho nhịp chùm ba',
          tex: WORK_THANH_PHO_BUON,
          marks: [
            { at: 'Cả bài', text: 'Vùng 1 — ngăn 0–5, không đổi thế tay lần nào' },
          ],
          guidance: [
            'Bài viết theo cảm giác Slow rock: mỗi phách chia 3 — đếm “một-hai-ba” đều cho từng phách.',
            'Hát thầm lời trong lúc chơi để giữ đúng câu nhạc.',
          ],
        },
        {
          title: 'Diễm Xưa',
          composer: 'Trịnh Công Sơn · giọng Am',
          note: 'Giọng Am, đã hạ một quãng tám cho vừa tay. Thế bấm xếp theo bản đồ: gần như cả bài ở Vùng 1 (ngăn 0–5), chỉ ô 11–12 lên Vùng 2 rồi về ngay. Dây 5–6 để trống — chỗ của Bass sẽ thêm ở các buổi sau.',
          tempo: 'Chậm, ngân đủ nốt tròn cuối câu',
          barsPerRow: 3,   // bản có lời — 3 ô nhịp/dòng để chữ không chồng nhau
          tex: WORK_DIEM_XUA,
          marks: [
            { at: 'Ô 1–10', text: 'Vùng 1 — ngăn 0–5, dây 1–4' },
            { at: 'Ô 11–12', text: 'lên Vùng 2 (ngón 1 đặt ngăn 5)' },
            { at: 'Ô 13', text: 'về lại Vùng 1' },
          ],
          guidance: [
            'Hợp âm trên khuông chỉ dùng 4 thế dễ: Am · A7 · Dm · E — để thầy đệm, học viên tập giai điệu trước.',
            'Lời in dưới khuông: hát thầm theo để câu nhạc không bị đứt.',
          ],
        },
      ],
      annotationTypes: ['Vị trí chuyển vùng', 'Số ngón', 'Nốt cần chú ý', 'Câu melody',
        'Điểm lấy hơi / ngắt câu', 'Vị trí kỹ thuật', 'Ghi chú của giáo viên'],
    },
    {
      kind: 'assignment',
      items: [
        { label: 'Bài 1.', text: 'Chơi âm giai C–Am lên/xuống 3 lần liên tục ở ♩ = 60.' },
        { label: 'Bài 2.', text: 'Chơi bài liên thông 3 vùng: chậm, đều, không dừng tại điểm đổi vị trí.' },
        { label: 'Bài 3.', text: 'Chơi hoàn chỉnh Etude 01.' },
        { label: 'Bài 4.', text: 'Tập phần tác phẩm được giao.' },
        { label: 'Bài 5.', text: 'Khoanh trực tiếp trên bản nhạc 3 vị trí mình còn bị vướng.' },
      ],
      message: 'Không cần tập hoàn hảo. Hãy mang đúng những chỗ chưa làm được đến buổi học.',
    },
    {
      kind: 'checklist',
      items: [
        'Tôi nhận diện được 7 nốt C–Am.',
        'Tôi chơi được bài âm giai.',
        'Tôi đã thử nối 3 vùng.',
        'Tôi chơi được Etude 01.',
        'Tôi đã tập tác phẩm.',
        'Tôi đã đánh dấu chỗ chưa làm được.',
      ],
    },
    { kind: 'studentNotes', lines: 8 },
  ],
}
