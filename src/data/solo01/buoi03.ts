// ── SOLO-01 · BUỔI 03 — nội dung giáo trình ──
// ⚠️ NGÓN TAY TRONG alphaTex LỆCH 1: tay trái `lf 2`=ngón 1 … `lf 5`=ngón 4
//    (lf 1 = ngón cái, in ra chữ "T"); tay phải `rf 1`=p · `rf 2`=i · `rf 3`=m.
//    `{ss}` = trượt ngón đổi thế, đặt ở nốt TRƯỚC khi trượt.
import type { LessonDoc, FretDot, FretZone } from '../../lesson/lessonTypes'
import { WORK_LY_CAY_BONG_THAP, WORK_LY_CAY_BONG_CAO } from './works'

// Ba quãng tám = ba MÀU, không phải ba khung vùng: các nốt cùng quãng tám nằm rải
// trên cần đàn chứ không gọn trong một ô chữ nhật (nên zone đặt hidden).
const OCTAVES: FretZone[] = [
  { no: 1, label: 'Quãng tám 1 — trầm', tag: '', fromFret: 0, toFret: 3, strings: [1, 6],
    color: '#4338CA', hidden: true, hint: 'dây trầm buông và ba ngăn đầu.' },
  { no: 2, label: 'Quãng tám 2 — giữa', tag: '', fromFret: 0, toFret: 3, strings: [1, 6],
    color: '#7C3AED', hidden: true, hint: 'vẫn ở thế I nhưng trên dây 2 – 3.' },
  { no: 3, label: 'Quãng tám 3 — cao', tag: '', fromFret: 5, toFret: 8, strings: [1, 2],
    color: '#A855F7', hidden: true, hint: 'dây 1, vùng giữa cần đàn.' },
]

const d = (string: number, fret: number, name: string, zone: number, root = false): FretDot =>
  ({ string, fret, name, zone, root })

// Chỉ lấy hai nốt LA và ĐÔ — đủ để nghe ra quãng tám mà sơ đồ không rối.
const OCT_DOTS: FretDot[] = [
  d(5, 0, 'A', 1, true), d(5, 3, 'C', 1),
  d(3, 2, 'A', 2, true), d(2, 1, 'C', 2),
  d(1, 5, 'A', 3, true), d(1, 8, 'C', 3),
]

// ── Bài tập 01 — nghe quãng tám ──
const EX1 = `
\\tempo 60
\\ts 4 4
.
0.5{rf 1}.2 2.3{lf 3 rf 3}.2 |
2.3{lf 3}.2 5.1{lf 2}.2 |
3.5{lf 4 rf 1}.2 1.2{lf 2 rf 3}.2 |
1.2{lf 2}.2 8.1{lf 5}.2 |
2.3{lf 3}.1
`.trim()

// ── Bài tập 02 — trượt ngón (slide) ──
// Trượt chỉ có nghĩa khi đi DỌC MỘT DÂY: ngón giữ nguyên áp lực, không nhấc lên.
const EX2 = `
\\tempo 60
\\ts 4 4
.
2.3{lf 3 ss}.2 4.3{lf 3}.2 |
4.3{lf 3 ss}.2 5.3{lf 3}.2 |
1.2{lf 2 ss}.2 3.2{lf 2}.2 |
3.2{lf 2 ss}.2 5.2{lf 2}.2 |
3.1{lf 2 ss}.2 5.1{lf 2}.2 |
5.1{lf 2 ss}.2 7.1{lf 2}.2 |
7.1{lf 4 ss}.2 5.1{lf 2}.2 |
5.1{lf 2 ss}.2 3.1{lf 2}.2
`.trim()

// ── Etude 03 — Đường trượt ──
// Câu nhạc đi từ Vùng 1 lên Vùng 2 bằng một cú trượt trên dây 3, rồi trượt về đúng
// đường cũ — không nhảy vùng ngang qua dây khác.
const ETUDE3 = `
\\tempo 66
\\ts 4 4
.
0.3.4 2.3{lf 3}.4 0.2.2 |
1.2{lf 2}.4 0.2.4 2.3{lf 3}.2 |
2.3{lf 3}.4 4.3{lf 5 ss}.4 5.3{lf 2}.2 |
7.3{lf 4}.4 5.2{lf 2}.4 6.2{lf 3}.2 |
8.2{lf 5}.4 5.1{lf 2}.4 7.1{lf 4}.2 |
8.1{lf 5}.2 7.1{lf 4}.2 |
5.1{lf 2}.4 8.2{lf 5}.4 6.2{lf 3}.2 |
5.2{lf 2}.4 7.3{lf 4}.4 5.3{lf 2 ss}.2 |
4.3{lf 5}.4 2.3{lf 3}.4 0.3.2 |
3.4{lf 4}.4 2.4{lf 3}.4 0.4.2 |
0.2.4 1.2{lf 2}.4 2.3{lf 3}.2 |
2.3{lf 3}.1
`.trim()

export const SOLO01_BUOI03: LessonDoc = {
  meta: {
    programCode: 'SOLO-01',
    programName: 'SOLO GUITAR CĂN BẢN',
    sessionNo: 3,
    title: 'Cao độ – quãng tám & Slide',
    stageLabel: 'Chặng 1 · Từ giai điệu đến Solo Guitar',
    backHref: '/solo01',
  },
  sections: [
    {
      kind: 'objectives',
      items: [
        'Hiểu đúng tên nốt chưa đủ — phải đúng cao độ.',
        'Tìm được cùng một nốt ở ba quãng tám trên cần đàn.',
        'Trượt ngón (slide) sạch tiếng, không đứt.',
        'Dùng slide để đổi vùng thay vì nhấc tay nhảy cóc.',
        'Chơi được một giai điệu ở hai quãng tám khác nhau.',
      ],
    },
    {
      kind: 'note',
      title: 'Đúng tên nốt chưa đủ',
      text: 'La ở dây 5 buông và La ở dây 1 ngăn 5 cùng tên là LA, nhưng cách nhau hai quãng tám — nghe ra hai giọng khác hẳn. Chơi đúng tên nốt mà sai quãng tám thì câu nhạc vẫn sai. Khi đọc bản nhạc, nhìn nốt nằm ở dòng/khe nào trên khuông để biết quãng tám, đừng chỉ nhớ tên.',
    },
    {
      kind: 'fretboard',
      title: 'Một nốt – ba quãng tám',
      lead: 'Lấy LA và ĐÔ làm ví dụ. Cùng một tên nốt, ba chỗ khác nhau trên cần đàn, ba độ cao khác nhau. Màu đậm dần theo quãng tám cao dần.',
      frets: 9,
      zones: OCTAVES,
      dots: OCT_DOTS,
      legend: ['LA: dây 5 buông → dây 3 ngăn 2 → dây 1 ngăn 5',
        'ĐÔ: dây 5 ngăn 3 → dây 2 ngăn 1 → dây 1 ngăn 8',
        'mỗi bước sang phải là cao thêm một quãng tám'],
    },
    {
      kind: 'score',
      subtitle: 'Bài tập kỹ thuật 01',
      title: 'Nghe quãng tám',
      lead: 'Mỗi ô nhịp là một cặp cùng tên nốt, cách nhau đúng một quãng tám. Chơi chậm, nghe kỹ trước khi sang cặp sau.',
      tempo: 'Tempo: ♩ = 60',
      tex: EX1,
      guidance: [
        'Hát theo nốt thấp rồi hát theo nốt cao — tai phải nhận ra hai độ cao, không chỉ hai vị trí.',
        'Ngón cái p chơi nốt trầm ở dây 5, i – m lo dây 1 – 3.',
      ],
    },
    {
      kind: 'score',
      subtitle: 'Bài tập kỹ thuật 02',
      title: 'Trượt ngón',
      lead: 'Trượt trên từng dây một: dây 3, rồi dây 2, rồi dây 1 — lên và xuống.',
      tempo: 'Tempo: ♩ = 60',
      tex: EX2,
      guidance: [
        'Ngón giữ nguyên áp lực trong lúc trượt, KHÔNG nhấc khỏi dây — nhấc lên là mất tiếng.',
        'Chỉ gảy nốt đầu; nốt sau vang bằng chính cú trượt.',
        'Trượt chỉ đi dọc MỘT dây. Muốn sang dây khác thì gảy lại, không gọi là trượt.',
      ],
    },
    {
      kind: 'score',
      subtitle: 'Etude 03',
      title: 'Đường trượt',
      lead: '12 ô nhịp: câu nhạc lên Vùng 2 bằng một cú trượt trên dây 3, rồi trượt về đúng đường cũ.',
      tempo: 'Tempo: ♩ = 66',
      tex: ETUDE3,
      marks: [
        { at: 'Ô 3', text: 'trượt trên DÂY 3 lên Vùng 2 (ngón 4 ngăn 4 → ngón 1 ngăn 5)' },
        { at: 'Ô 8', text: 'trượt về Vùng 1, vẫn trên dây 3' },
      ],
      guidance: [
        'Giữ nhịp đều ở chỗ trượt — đừng dừng lại nghe ngóng rồi mới đi tiếp.',
        'So với Buổi 01: cùng đường đi, nhưng nay nối bằng tiếng trượt chứ không nhấc tay.',
      ],
    },
    {
      kind: 'repertoire',
      title: 'Tác phẩm thực hành',
      candidates: ['Lý Cây Bông — dân ca Nam Bộ'],
      status: 'ready',
      pieces: [
        {
          title: 'Lý Cây Bông — quãng tám thấp',
          composer: 'Dân ca Nam Bộ · giọng Đô',
          note: 'Bản hạ một quãng tám: trọn vẹn trong Vùng 1 (ngăn 0–3). Tập bản này cho thuộc giai điệu và lời trước.',
          tempo: 'Nhịp 2/4 · thong thả, đúng chất dân ca',
          barsPerRow: 4,
          tex: WORK_LY_CAY_BONG_THAP,
          guidance: [
            'Hát lời trong lúc chơi — dân ca mà chơi cứng nhịp thì mất duyên.',
            'Nốt ngân cuối câu phải đủ, đừng cắt ngắn để chạy sang câu sau.',
          ],
        },
        {
          title: 'Lý Cây Bông — quãng tám cao',
          composer: 'Dân ca Nam Bộ · cùng giai điệu, cao hơn một quãng tám',
          note: 'Đúng giai điệu vừa tập nhưng dựng ở Vùng 2 – Vùng 3 (ngăn 5–15). Chỗ đổi vùng trên cùng một dây đã đánh dấu TRƯỢT NGÓN — đây là chỗ dùng kỹ thuật của buổi hôm nay.',
          tempo: 'Chậm hơn bản thấp cho tới khi các cú trượt sạch tiếng',
          barsPerRow: 4,
          tex: WORK_LY_CAY_BONG_CAO,
          marks: [
            { at: 'Vùng 2', text: 'ngăn 5–8, dây 1–3' },
            { at: 'Vùng 3', text: 'các câu lên ngăn 10–15, dây 1' },
          ],
          guidance: [
            'So hai bản: cùng một bài, cùng tên nốt, chỉ khác cao độ — đó chính là bài học hôm nay.',
            'Mỗi chỗ có dấu trượt: nghe xem tiếng có liền không, đứt là tay đã nhấc.',
          ],
        },
      ],
      annotationTypes: ['Vị trí trượt ngón', 'Quãng tám', 'Số ngón', 'Câu melody',
        'Điểm lấy hơi / ngắt câu', 'Ghi chú của giáo viên'],
    },
    {
      kind: 'assignment',
      items: [
        { label: 'Bài 1.', text: 'Bài tập quãng tám: chơi và HÁT theo cả nốt thấp lẫn nốt cao.' },
        { label: 'Bài 2.', text: 'Trượt ngón trên cả ba dây, lên và xuống, tiếng phải liền.' },
        { label: 'Bài 3.', text: 'Chơi hoàn chỉnh Etude 03.' },
        { label: 'Bài 4.', text: 'Lý Cây Bông bản thấp: thuộc giai điệu và lời.' },
        { label: 'Bài 5.', text: 'Lý Cây Bông bản cao: chơi chậm, khoanh những cú trượt còn đứt tiếng.' },
      ],
      message: 'Không cần tập hoàn hảo. Hãy mang đúng những chỗ chưa làm được đến buổi học.',
    },
    {
      kind: 'checklist',
      items: [
        'Tôi phân biệt được cùng tên nốt ở hai quãng tám.',
        'Tôi tìm được LA và ĐÔ ở ba quãng tám trên cần đàn.',
        'Tôi trượt ngón không bị đứt tiếng.',
        'Tôi chơi được Etude 03.',
        'Tôi chơi được Lý Cây Bông ở quãng tám thấp.',
        'Tôi đã thử bản quãng tám cao.',
      ],
    },
    { kind: 'studentNotes', lines: 8 },
  ],
}
