// ── SOLO-01 · BUỔI 02 — nội dung giáo trình ──
// Cùng khuôn LessonDoc với Buổi 01. Bản nhạc lưu ở dạng alphaTex.
// ⚠️ NGÓN TAY TRONG alphaTex LỆCH 1 (giống Buổi 01):
//    tay trái  `lf 2`=ngón 1 … `lf 5`=ngón 4   (lf 1 = ngón cái, in ra chữ "T")
//    tay phải  `rf 1`=p (ngón cái) · `rf 2`=i · `rf 3`=m · `rf 4`=a
import type { LessonDoc, FretDot, FretZone } from '../../lesson/lessonTypes'
import { WORK_DIEM_XUA_BASS } from './works'

const ZB = '#4338CA'

// Chỉ một vùng: thế I trên ba dây trầm — nơi ngón cái p làm việc.
const BASS_ZONES: FretZone[] = [
  { no: 1, label: 'Thế I — dây trầm (6 · 5 · 4)', tag: 'THẾ I', fromFret: 0, toFret: 3, strings: [4, 6], color: ZB,
    hint: 'ngón cái p chỉ chơi trong vùng này ở Buổi 02.' },
]

const d = (string: number, fret: number, name: string, root = false): FretDot =>
  ({ string, fret, name, zone: 1, root })

const BASS_DOTS: FretDot[] = [
  d(6, 0, 'E', true), d(6, 1, 'F'), d(6, 3, 'G', true),
  d(5, 0, 'A', true), d(5, 2, 'B'), d(5, 3, 'C', true),
  d(4, 0, 'D', true), d(4, 2, 'E'), d(4, 3, 'F'),
]

// ── Bài tập 01 — ép ngón i–m ──
// Chỉ dây buông: tai và mắt rảnh hoàn toàn để lo tay phải.
const EX1 = `
\\tempo 60
\\ts 4 4
.
0.1{rf 2}.4 0.1{rf 3}.4 0.1{rf 2}.4 0.1{rf 3}.4 |
0.2{rf 2}.4 0.2{rf 3}.4 0.2{rf 2}.4 0.2{rf 3}.4 |
0.3{rf 2}.4 0.3{rf 3}.4 0.3{rf 2}.4 0.3{rf 3}.4 |
0.3{rf 2}.4 0.2{rf 3}.4 0.1{rf 2}.4 0.2{rf 3}.4 |
0.1{rf 2}.8 0.1{rf 3}.8 0.1{rf 2}.8 0.1{rf 3}.8 0.2{rf 2}.8 0.2{rf 3}.8 0.1{rf 2}.8 0.1{rf 3}.8 |
0.1{rf 2}.1
`.trim()

// ── Bài tập 02 — âm giai có Bass buông ──
// Giai điệu ở dây 1–2–3 (Vùng 1) là BÈ 1; Bass là BÈ RIÊNG (\\voice) nên đuôi nốt
// quay xuống và ngân trọn ô nhịp. Tên hợp âm chỉ ghi ở chỗ đổi.
// CHỈ ghi ngón tay PHẢI ở đây: ngón trái của chính giai điệu này đã học ở Buổi 01,
// in cả hai sẽ chồng số lên nhau ngay cạnh đầu nốt.
const EX2 = `
\\tempo 60
\\ts 4 4
.
2.3{rf 2}.4 0.2{rf 3}.4 1.2{rf 2}.4 0.2{rf 3}.4 |
3.2{rf 2}.4 1.2{rf 3}.4 0.2{rf 2}.4 2.3{rf 3}.4 |
0.1.4 3.2.4 1.2.4 0.2.4 |
2.3.1 |
0.1.4 1.1.4 0.1.4 3.2.4 |
1.1.4 0.1.4 3.2.4 1.2.4 |
0.2.4 1.2.4 3.2.4 0.2.4 |
2.3.1
\\voice
0.5{ch "Am" rf 1}.1 |
0.4{ch "Dm" rf 1}.1 |
0.6{ch "E" rf 1}.1 |
0.5{ch "Am" rf 1}.1 |
0.5{rf 1}.1 |
0.4{ch "Dm" rf 1}.1 |
0.6{ch "E" rf 1}.1 |
0.5{ch "Am" rf 1}.1
`.trim()

// ── Etude 02 — Melody + Bass (hai bè) ──
const ETUDE2 = `
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
\\voice
0.5{ch "Am" rf 1}.1 |
0.4{ch "Dm" rf 1}.1 |
0.6{ch "E" rf 1}.1 |
0.5{ch "Am" rf 1}.1 |
0.5{rf 1}.1 |
0.4{ch "Dm" rf 1}.1 |
0.6{ch "E" rf 1}.1 |
0.5{ch "Am" rf 1}.1 |
0.4{ch "Dm" rf 1}.1 |
0.5{ch "Am" rf 1}.1 |
0.6{ch "E" rf 1}.1 |
0.5{ch "Am" rf 1}.1
`.trim()

export const SOLO01_BUOI02: LessonDoc = {
  meta: {
    programCode: 'SOLO-01',
    programName: 'SOLO GUITAR CĂN BẢN',
    sessionNo: 2,
    title: 'Ép ngón tay phải & Bass đầu tiên',
    stageLabel: 'Chặng 1 · Từ giai điệu đến Solo Guitar',
    backHref: '/solo01',
  },
  sections: [
    {
      kind: 'objectives',
      items: [
        'Ép ngón i – m luân phiên, tiếng chắc và đều.',
        'Biết khi nào tỳ dây, khi nào không tỳ dây.',
        'Thuộc nốt gốc trên ba dây trầm.',
        'Chơi được giai điệu có Bass đi kèm.',
        'Thêm Bass vào tác phẩm đã tập ở Buổi 01.',
      ],
    },
    {
      kind: 'note',
      title: 'Ép ngón là gì',
      text: 'Ép ngón = hai ngón i (trỏ) và m (giữa) thay phiên nhau, KHÔNG bao giờ dùng một ngón đánh hai nốt liền nhau. Ngón vào dây rồi mới đẩy, tiếng mới chắc; đánh hất từ ngoài vào sẽ ra tiếng mỏng. Ngón cái p làm việc riêng ở ba dây trầm.',
    },
    {
      kind: 'fretboard',
      title: 'Nốt Bass ở thế I',
      lead: 'Ba dây trầm trong bốn ngăn đầu — chỗ làm việc của ngón cái p. Nốt tô đậm là nốt gốc hay gặp nhất.',
      frets: 5,
      zones: BASS_ZONES,
      dots: BASS_DOTS,
      legend: ['Am → gốc A (dây 5 buông)', 'Dm → gốc D (dây 4 buông)', 'E → gốc E (dây 6 buông)',
        'C → gốc C (dây 5, ngăn 3)', 'G → gốc G (dây 6, ngăn 3)'],
    },
    {
      kind: 'score',
      subtitle: 'Bài tập kỹ thuật 01',
      title: 'Ép ngón i – m',
      lead: 'Toàn dây buông — tay trái nghỉ, mắt và tai chỉ lo tay phải.',
      tempo: 'Tempo khởi đầu: ♩ = 60',
      tex: EX1,
      guidance: [
        'Chữ dưới nốt là ngón tay phải: i = trỏ, m = giữa, p = ngón cái.',
        'Ô 1–3: tỳ dây (ngón sau khi đánh tựa vào dây kế) để lấy tiếng chắc.',
        'Ô 4: đổi dây nhưng vẫn i – m luân phiên, không dùng một ngón hai lần.',
        'Ô 5: gấp đôi tốc độ — chỉ tăng khi ô 1–4 đã đều.',
      ],
    },
    {
      kind: 'score',
      subtitle: 'Bài tập kỹ thuật 02',
      title: 'Âm giai C–Am có Bass',
      lead: 'Giai điệu ở dây 1–2–3 như Buổi 01, thêm một nốt Bass buông ở đầu mỗi ô nhịp.',
      tempo: 'Tempo khởi đầu: ♩ = 60',
      tex: EX2,
      marks: [
        { at: 'Am', text: 'Bass A — dây 5 buông' },
        { at: 'Dm', text: 'Bass D — dây 4 buông' },
        { at: 'E', text: 'Bass E — dây 6 buông' },
      ],
      guidance: [
        'Bass là bè riêng — đuôi nốt quay xuống, ngân trọn ô nhịp; giai điệu là bè đuôi quay lên.',
        'Bass và nốt giai điệu đầu ô vang CÙNG LÚC: p và i bật ra một nhịp, không so le.',
        'Ngón cái p đi xuống, i – m đi lên — hai tay phải không vướng nhau.',
        'Ô 1–2 đã ghi sẵn ngón tay phải; từ ô 3 tự giữ nếp i – m luân phiên. Ngón tay trái lấy theo Buổi 01.',
      ],
    },
    {
      kind: 'score',
      subtitle: 'Etude 02',
      title: 'Giai điệu có Bass',
      lead: '12 ô nhịp, vòng Am – Dm – E – Am. Toàn bộ Bass là dây buông, giai điệu vẫn ở Vùng 1.',
      tempo: 'Tempo: ♩ = 66',
      tex: ETUDE2,
      guidance: [
        'Bass viết ở bè dưới (đuôi quay xuống): ngân hết ô nhịp, đừng nhấc ngón cái ra sớm.',
        'Bass nhẹ hơn giai điệu — người nghe phải nghe ra câu hát trước.',
      ],
    },
    {
      kind: 'repertoire',
      title: 'Tác phẩm thực hành',
      candidates: ['Diễm Xưa — thêm Bass', 'Thành Phố Buồn — ôn lại bản Buổi 01'],
      status: 'ready',
      pieces: [
        {
          title: 'Diễm Xưa — Melody + Bass',
          composer: 'Trịnh Công Sơn · giọng Am',
          note: 'Đúng bản giai điệu của Buổi 01, thêm bè Bass ở dưới (đuôi nốt quay xuống). Hợp âm đổi ở phách 1 hoặc phách 3, và ô nhịp nào cũng có Bass ở phách 1 — kể cả khi giai điệu bắt đầu bằng dấu lặng. Tất cả Bass đều là dây buông: E (dây 6) · A (dây 5) · D (dây 4).',
          tempo: 'Chậm, giữ Bass ngân',
          barsPerRow: 3,
          tex: WORK_DIEM_XUA_BASS,
          marks: [
            { at: 'Am · A7', text: 'Bass A — dây 5 buông' },
            { at: 'Dm', text: 'Bass D — dây 4 buông' },
            { at: 'E', text: 'Bass E — dây 6 buông' },
          ],
          guidance: [
            'Tập giai điệu trơn đã rồi mới thả Bass vào, đừng làm hai việc cùng lúc ngay từ đầu.',
            'Chỗ nào Bass làm đứt câu hát thì bỏ Bass ô đó, giữ giai điệu liền mạch trước.',
          ],
        },
      ],
      annotationTypes: ['Vị trí Bass', 'Ngón tay phải p – i – m', 'Câu melody', 'Điểm lấy hơi / ngắt câu',
        'Ghi chú của giáo viên'],
    },
    {
      kind: 'assignment',
      items: [
        { label: 'Bài 1.', text: 'Ép ngón i – m: 5 phút mỗi ngày ở ♩ = 60, dây buông, tiếng đều nhau.' },
        { label: 'Bài 2.', text: 'Âm giai C–Am có Bass, chậm, Bass và giai điệu bật cùng lúc.' },
        { label: 'Bài 3.', text: 'Chơi hoàn chỉnh Etude 02.' },
        { label: 'Bài 4.', text: 'Diễm Xưa: chơi trọn giai điệu, thả Bass vào ít nhất nửa bài.' },
        { label: 'Bài 5.', text: 'Khoanh trên bản nhạc 3 chỗ Bass còn làm đứt câu hát.' },
      ],
      message: 'Không cần tập hoàn hảo. Hãy mang đúng những chỗ chưa làm được đến buổi học.',
    },
    {
      kind: 'checklist',
      items: [
        'Tôi ép được i – m không lặp ngón.',
        'Tôi phân biệt được tỳ dây và không tỳ dây.',
        'Tôi nhớ nốt gốc E – A – D trên dây trầm.',
        'Tôi chơi được Etude 02.',
        'Tôi đã thả Bass vào tác phẩm.',
        'Tôi đã đánh dấu chỗ chưa làm được.',
      ],
    },
    { kind: 'studentNotes', lines: 8 },
  ],
}
