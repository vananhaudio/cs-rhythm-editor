// ── GUITAR CĂN BẢN 1 (CB1.T3) · BUỔI 02 — Dấu thăng & dấu giáng ──
// BẢN NHÁP ĐỂ OWNER DUYỆT (12/10/2026). KẾ THỪA từ SOLO01 Buổi 04 (không sửa file SOLO01), thu về 3 ngăn đầu cần đàn:
//   · Quy tắc "dịch một ngăn: lên = ♯, xuống = ♭" + 4 bước gặp ♯/♭ = Phần 3 của SOLO01 Buổi 04.
//   · EX = EX_THANG_GIANG của SOLO01 Buổi 04, riêng ô 3 đổi sang Si dây 5 → Si♭ dây 5 (ngăn 2 → 1) để KHÔNG vượt 3 ngăn đầu.
//   · CAU_TRUC = "Diễm Xưa" ô 7–10 (có Sol♯, trọn trong 3 ngăn đầu) của SOLO01 Buổi 04, dùng nguyên khuông + ngón + lời.
// Mạch: HỌC NỬA CUNG/♯/♭ → TRẢ 2.1 → 4 BƯỚC + CÂU NHẠC → TRẢ 2.2. Chỉ bài trả văn bản/video (không trắc nghiệm → không cần đáp án server).
// Quy ước alphaTab: dây 1 = Mi cao … 6 = Mi trầm; fret.dây.trườngđộ; ngón Việt n ⇒ `lf n+1`.
import type { FretDot, FretZone, LessonDoc } from '../../lesson/lessonTypes'

const LOAI: FretZone[] = [
  { no: 1, label: 'Nốt tự nhiên', tag: '', fromFret: 0, toFret: 3, strings: [1, 6], color: '#4338CA', hidden: true, hint: 'các nốt đã học ở Buổi 01.' },
  { no: 2, label: 'Nốt ♯ / ♭', tag: '', fromFret: 0, toFret: 3, strings: [1, 6], color: '#A85F0E', hidden: true, hint: 'ngăn nằm giữa hai nốt tự nhiên: dịch đúng MỘT ngăn.' },
]
const n = (string: number, fret: number, name: string): FretDot => ({ string, fret, name, zone: 1 })
const b = (string: number, fret: number, name: string): FretDot => ({ string, fret, name, zone: 2, root: true })

// Toàn bộ 3 ngăn đầu: nốt tự nhiên (tím) + nốt ♯/♭ (cam)
const BA_NGAN_DAY_DU: FretDot[] = [
  n(1, 0, 'E'), n(1, 1, 'F'), b(1, 2, 'F♯'), n(1, 3, 'G'),
  n(2, 0, 'B'), n(2, 1, 'C'), b(2, 2, 'C♯'), n(2, 3, 'D'),
  n(3, 0, 'G'), b(3, 1, 'G♯'), n(3, 2, 'A'), b(3, 3, 'B♭'),
  n(4, 0, 'D'), b(4, 1, 'E♭'), n(4, 2, 'E'), n(4, 3, 'F'),
  n(5, 0, 'A'), b(5, 1, 'B♭'), n(5, 2, 'B'), n(5, 3, 'C'),
  n(6, 0, 'E'), n(6, 1, 'F'), b(6, 2, 'F♯'), n(6, 3, 'G'),
]

// Mỗi ô một cặp: nốt đã biết rồi nốt biến hoá ngay ngăn bên (ngón 1 = ngăn 1, ngón 2 = ngăn 2).
const EX = `
\\tempo 60
\\ts 4 4
.
0.3.2 1.3{lf 2}.2 |
2.4{lf 3}.2 1.4{lf 2}.2 |
2.5{lf 3}.2 1.5{lf 2}.2 |
1.1{lf 2}.2 2.1{lf 3}.2 |
1.3{lf 2}.2 2.3{lf 3}.2
`.trim()

// "Diễm Xưa" ô 7–10 (SOLO01 Buổi 04) — toàn bộ trong 3 ngăn đầu, có Sol♯ ở ô 7 và ô 9.
const CAU_TRUC = `
\\ts 4 4
\\lyrics "Đường dài hun hút cho mắt thêm sâu Chợt hồn xanh buốt cho mình xót xa"
.
r.8 2.4{lf 3}.8 1.3{lf 2}.8 0.2.8 3.2{lf 4}.8 3.2{lf 4}.8 0.1.8 3.2{lf 4}.8 |
1.2{lf 2}.1 |
r.8 2.4{lf 3}.8 1.3{lf 2}.8 0.2.8 3.2{lf 4}.8 0.2.8 1.3{lf 2}.8 0.2.8 |
2.3{lf 3}.1
`.trim()

export const CB1_BUOI02: LessonDoc = {
  meta: {
    programCode: 'CB1',
    programName: 'GUITAR CĂN BẢN 1',
    sessionNo: 2,
    title: 'Dấu thăng & dấu giáng',
    stageLabel: 'Vòng 1 · Học đàn bằng nốt nhạc',
    backHref: '/me',
  },
  sections: [
    {
      kind: 'recap',
      title: 'Từ Buổi 01 sang Buổi 02',
      steps: [
        { label: 'Buổi 01', items: ['Các nốt tự nhiên trong 3 ngăn đầu: E F G · B C D · G A · D E F · A B C · E F G.'] },
        { label: 'Buổi 02', items: ['Những ngăn còn "trống" giữa các nốt đó cũng là nốt — nốt có dấu thăng ♯ hoặc dấu giáng ♭.'] },
      ],
      message: 'Vẫn là 3 ngăn đầu cần đàn. Hôm nay bạn gọi tên được TẤT CẢ các ngăn trong đó.',
    },
    {
      kind: 'objectives',
      items: [
        'Hiểu nửa cung: trên một dây, một ngăn đàn là một nửa cung.',
        'Biết dấu thăng ♯ nâng nốt lên nửa cung, dấu giáng ♭ hạ nốt xuống nửa cung.',
        'Tìm được nốt có ♯ / ♭ từ một nốt đã biết, trong 3 ngăn đầu.',
        'Đọc và chơi được một câu nhạc có nốt ♯.',
      ],
    },
    // ── NHỊP 1 — NỬA CUNG, ♯ VÀ ♭ ──
    {
      kind: 'note',
      title: 'Nhịp 1 · Nửa cung, ♯ và ♭',
      text: 'Không cần học thuộc vị trí các nốt ♯ / ♭. Chỉ cần biết một việc: từ nốt đã biết, dịch đúng MỘT ngăn. Kết thúc nhịp: Bài trả 2.1.',
    },
    {
      kind: 'study',
      tag: 'Phần 1',
      title: 'Nửa cung, dấu thăng và dấu giáng',
      blocks: [
        { b: 'p', text: 'Trên một dây, hai ngăn đàn liền nhau cách nhau một nửa cung.' },
        {
          b: 'ul',
          items: [
            'Dấu thăng ♯ nâng nốt lên nửa cung: tiến một ngăn về phía thân đàn.',
            'Dấu giáng ♭ hạ nốt xuống nửa cung: lùi một ngăn về phía đầu đàn.',
          ],
        },
        { b: 'callout', label: 'ĐIỀU CẦN NHỚ', text: 'E–F và B–C đã sát nhau (chỉ cách nửa cung), nên giữa chúng không có nốt ♯ nào. Ở Buổi 01, dây 1 đi E rồi F ngay ngăn 1 — đúng như vậy.' },
        { b: 'p', text: 'Một vị trí có thể có hai tên (F♯ cũng là G♭). Buổi này bạn chỉ cần nhận ra một tên.' },
      ],
    },
    {
      kind: 'fretboard',
      title: 'Các nốt trong 3 ngăn đầu — đủ ♯ / ♭',
      lead: 'Chấm tím là nốt tự nhiên đã học. Chấm cam là nốt ♯ / ♭ nằm ngay ngăn bên cạnh.',
      frets: 3,
      zones: LOAI,
      dots: BA_NGAN_DAY_DU,
      legend: [
        'F♯ = F nâng lên nửa cung',
        'B♭ = B hạ xuống nửa cung',
        'Si dây 2 BUÔNG không hạ được — muốn B♭ phải sang dây 3 ngăn 3 hoặc dây 5 ngăn 1',
      ],
    },
    {
      kind: 'score',
      subtitle: 'Bài tập',
      title: 'Nốt đã biết → dịch một ngăn',
      lead: 'Mỗi ô một cặp: nốt đã biết rồi nốt biến hoá ngay ngăn bên. Ô cuối đưa Sol♯ về La.',
      tempo: '♩ = 60',
      tex: EX,
      marks: [
        { at: 'Ô 1', text: 'Sol → Sol♯ (dây 3)' },
        { at: 'Ô 2', text: 'Mi → Mi♭ (dây 4)' },
        { at: 'Ô 3', text: 'Si → Si♭ (dây 5)' },
        { at: 'Ô 4', text: 'Fa → Fa♯ (dây 1)' },
        { at: 'Ô 5', text: 'Sol♯ → La (dây 3)' },
      ],
      guidance: [
        'Đọc tên nốt thành tiếng trong lúc bấm: "Sol… Sol thăng".',
        'Nghe cho ra nửa cung: nốt biến hoá sát ngay nốt gốc, không phải một nốt xa lạ.',
      ],
    },
    {
      kind: 'checkpoint',
      id: '2.1',
      title: 'Bài trả 2.1 — Dịch một ngăn',
      prompt: 'Viết tên nốt tìm được: (a) từ Sol dây 3 buông, dịch lên 1 ngăn; (b) từ Mi dây 4 ngăn 2, dịch xuống 1 ngăn; (c) từ Fa dây 1 ngăn 1, dịch lên 1 ngăn. Rồi chơi từng nốt và đọc tên. Không cần video.',
      required: true,
      accepts: ['text'],
    },
    // ── NHỊP 2 — GẶP ♯/♭ TRONG MỘT CÂU NHẠC ──
    {
      kind: 'note',
      title: 'Nhịp 2 · Gặp ♯ / ♭ trong một câu nhạc',
      text: 'Bài hát thật vẫn có nốt ngoài bản đồ nốt tự nhiên, như Sol♯ trong câu sau. Kết thúc nhịp: Bài trả 2.2.',
    },
    {
      kind: 'study',
      tag: 'Phần 2',
      title: 'Bốn bước khi gặp nốt ♯ / ♭',
      blocks: [
        {
          b: 'ol',
          items: [
            'Xác định nốt: tên nốt và dấu ♯ hay ♭.',
            'Tìm vị trí từ nốt đã biết: dịch đúng một ngăn.',
            'Nhìn cả câu: nốt trước và sau nằm ở đâu.',
            'Quyết định ngón tay trái.',
          ],
        },
      ],
    },
    {
      kind: 'score',
      subtitle: 'Áp dụng',
      title: 'Một câu có Sol♯',
      lead: 'Trích từ "Diễm Xưa" (Trịnh Công Sơn), giọng Am. Toàn câu nằm trong 3 ngăn đầu. Ngón tay trái ghi trên bản là GỢI Ý.',
      tempo: '♩ = 60',
      tex: CAU_TRUC,
      marks: [
        { at: 'Sol♯', text: 'ô 1 và ô 3 của câu — dây 3 ngăn 1, ngón 1' },
      ],
      guidance: [
        'Chơi chậm và liên tục, đúng nốt trước rồi mới nhanh.',
        'Tìm Sol♯ bằng đúng quy tắc: từ Sol dây 3 buông, dịch lên một ngăn.',
      ],
    },
    {
      kind: 'checkpoint',
      id: '2.2',
      title: 'Bài trả 2.2 — Câu nhạc có Sol♯',
      prompt: 'Quay video bạn chơi liên tục câu nhạc trên. Trước khi chơi, nói tên nốt có dấu ♯ và vị trí của nó. Kèm một dòng: "Tôi tìm Sol♯ bằng cách…". Không cần nhanh, thầy xem: đúng nốt · đúng vị trí · dòng nhạc liên tục.',
      required: true,
      accepts: ['text', 'video_link'],
    },
    // ── ĐUÔI BUỔI ──
    {
      kind: 'assignment',
      items: [
        { label: 'Bài 1.', text: 'Mỗi ngày chơi bài tập "nốt đã biết → dịch một ngăn" chậm, vừa chơi vừa đọc tên nốt.' },
        { label: 'Bài 2.', text: 'Chọn một dây bất kỳ, đọc tên tất cả các ngăn từ 0 đến 3, kể cả nốt ♯ / ♭.' },
        { label: 'Bài 3.', text: 'Chơi câu nhạc có Sol♯ thật chậm và liên tục.' },
      ],
      message: 'Không cần tập hoàn hảo. Hãy mang đúng những chỗ chưa làm được đến buổi học.',
    },
    {
      kind: 'checklist',
      items: [
        'Tôi giải thích được nửa cung, dấu ♯ và dấu ♭.',
        'Tôi tìm được nốt ♯ / ♭ từ một nốt đã biết bằng cách dịch một ngăn.',
        'Tôi biết vì sao giữa E–F và B–C không có nốt ♯.',
        'Tôi chơi được câu nhạc có Sol♯.',
        'Tôi đã gửi Bài trả 2.1 và 2.2.',
      ],
    },
    { kind: 'studentNotes', lines: 8 },
  ],
}
