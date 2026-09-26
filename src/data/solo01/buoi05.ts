// ── SOLO-01 · BUỔI 05 — nội dung giáo trình ──
// Bass quay lại sau Buổi 04, nhưng lần này BẠN chọn bass chứ không phải Thầy ghi sẵn.
// Thêm luyến (hammer-on / pull-off) — cách thứ ba để nối hai nốt, sau "gảy lại"
// (Buổi 01–02) và "trượt" (Buổi 03).
// ⚠️ alphaTex: tay trái `lf 2`=ngón 1 … `lf 5`=ngón 4 · tay phải `rf 1`=p · `rf 2`=i · `rf 3`=m.
//    Dấu luyến `{h}` đặt ở NỐT TRƯỚC (nốt gảy), không phải nốt sau — ngược với dấu nối {t}.
//    Trượt thì hai nốt CÙNG ngón; luyến thì hai nốt KHÁC ngón.
import type { LessonDoc, FretDot, FretZone } from '../../lesson/lessonTypes'
import { WORK_DIEM_XUA, WORK_DIEM_XUA_B5 } from './works'

// ── Bài tập 01 — Bass luân phiên: nốt gốc ↔ quãng 5 ──
// Chỉ ngón cái p. Si (dây 5 ngăn 2) là nốt bass ĐẦU TIÊN phải bấm — từ trước tới nay
// bass toàn dây buông.
const EX1 = `
\\tempo 60
\\ts 4 4
.
0.5{ch "Am" rf 1}.2 0.6{rf 1}.2 |
0.5{rf 1}.2 0.6{rf 1}.2 |
0.4{ch "Dm" rf 1}.2 0.5{rf 1}.2 |
0.4{rf 1}.2 0.5{rf 1}.2 |
0.6{ch "E" rf 1}.2 2.5{lf 3 rf 1}.2 |
0.6{rf 1}.2 2.5{lf 3 rf 1}.2 |
0.5{ch "Am" rf 1}.2 0.6{rf 1}.2 |
0.5{rf 1}.1
`.trim()

// ── Bài tập 02 — Luyến lên và luyến xuống ──
// Chỉ gảy nốt ĐẦU; nốt sau vang bằng chính cú gõ (luyến lên) hoặc cú móc (luyến xuống).
const EX2 = `
\\tempo 60
\\ts 4 4
.
0.3{h}.4 2.3{lf 3}.4 0.3{h}.4 2.3{lf 3}.4 |
2.3{lf 3 h}.4 0.3.4 2.3{lf 3 h}.4 0.3.4 |
0.2{h}.4 1.2{lf 2}.4 1.2{lf 2 h}.4 0.2.4 |
1.2{lf 2 h}.4 3.2{lf 4}.4 3.2{lf 4 h}.4 1.2{lf 2}.4 |
0.1{h}.4 1.1{lf 2}.4 1.1{lf 2 h}.4 3.1{lf 4}.4 |
3.1{lf 4 h}.4 1.1{lf 2}.4 0.1.2
`.trim()

// ── Ba cách nối cùng một chỗ: Diễm Xưa ô 3–4, dây 1 ngăn 3 → 5 (Sol → La) ──
const NOI_1 = `
\\ts 4 4
.
r.8 2.3{lf 3}.8 1.2{lf 2}.8 0.1.8 3.1{lf 2}.8 3.1{lf 2}.8 5.1{lf 4}.8 0.1.8 |
3.2{lf 2}.1
`.trim()
const NOI_2 = `
\\ts 4 4
.
r.8 2.3{lf 3}.8 1.2{lf 2}.8 0.1.8 3.1{lf 2}.8 3.1{lf 2 ss}.8 5.1{lf 2}.8 0.1.8 |
3.2{lf 2}.1
`.trim()
const NOI_3 = `
\\ts 4 4
.
r.8 2.3{lf 3}.8 1.2{lf 2}.8 0.1.8 3.1{lf 2}.8 3.1{lf 2 h}.8 5.1{lf 4}.8 0.1.8 |
3.2{lf 2}.1
`.trim()

// ── Sơ đồ nốt Bass ở thế I ──
const LOAI: FretZone[] = [
  { no: 1, label: 'Bass đã quen — dây buông', tag: '', fromFret: 0, toFret: 0, strings: [1, 6],
    color: '#4338CA', hidden: true, hint: 'E · A · D, dùng từ Buổi 02.' },
  { no: 2, label: 'Bass phải bấm', tag: '', fromFret: 0, toFret: 0, strings: [1, 6],
    color: '#A85F0E', hidden: true, hint: 'Si (dây 5 ngăn 2) là nốt bass đầu tiên phải bấm.' },
]
const d = (string: number, fret: number, name: string, zone: number, root = false): FretDot =>
  ({ string, fret, name, zone, root })
const BASS_DOTS: FretDot[] = [
  d(6, 0, 'E', 1, true), d(5, 0, 'A', 1, true), d(4, 0, 'D', 1, true),
  d(5, 2, 'B', 2, true),
  d(6, 3, 'G', 1), d(5, 3, 'C', 1), d(4, 3, 'F', 1),
]

export const SOLO01_BUOI05: LessonDoc = {
  meta: {
    programCode: 'SOLO-01',
    programName: 'SOLO GUITAR CĂN BẢN',
    sessionNo: 5,
    title: 'Bass theo hợp âm & Luyến (hammer-on / pull-off)',
    stageLabel: 'Chặng 1 · Từ giai điệu đến Solo Guitar',
    backHref: '/solo01',
  },
  sections: [
    {
      kind: 'recap',
      title: 'Từ Buổi 04 sang Buổi 05',
      steps: [
        { label: 'Buổi 04 đã có', items: ['Bạn tự xếp ngón cho giai điệu.', 'Bạn nói được vì sao mình chọn.'] },
        { label: 'Buổi 05 thêm', items: ['Bass quay lại — lần này BẠN chọn bass.', 'Luyến: cách thứ ba để nối hai nốt.'] },
      ],
      message: 'Vẫn Diễm Xưa. Trước đây Thầy ghi sẵn bass; từ hôm nay bạn nhìn tên hợp âm rồi tự chọn nốt bass.',
    },
    {
      kind: 'objectives',
      title: 'Cuối buổi, bạn làm được',
      items: [
        'Nhìn tên hợp âm là biết nốt bass gốc nằm ở đâu.',
        'Thêm được bass thứ hai (quãng 5) để phần nền đỡ đơn điệu.',
        'Luyến lên và luyến xuống sạch tiếng, nốt sau nghe rõ như nốt gảy.',
        'Biết ba cách nối hai nốt: gảy lại · trượt · luyến — và khác nhau ở đâu.',
        '⭐ QUAN TRỌNG NHẤT — Tự chọn bass và cách nối cho câu của mình, rồi nói được vì sao.',
      ],
    },
    {
      kind: 'recap',
      title: 'Phần 1 — Hợp âm nào thì bass nào',
      steps: [
        { label: 'Am', items: ['Gốc: La — dây 5 buông', 'Quãng 5: Mi — dây 6 buông'] },
        { label: 'A7', items: ['Cũng gốc La — dây 5 buông', 'Quãng 5: Mi — dây 6 buông'] },
        { label: 'Dm', items: ['Gốc: Rê — dây 4 buông', 'Quãng 5: La — dây 5 buông'] },
        { label: 'E', items: ['Gốc: Mi — dây 6 buông', 'Quãng 5: Si — dây 5 ngăn 2 (phải bấm)'] },
      ],
      message: 'Quy tắc: nốt bass đầu tiên trùng TÊN hợp âm. Bass thứ hai lấy quãng 5. Chọn dây nào thì xem dây đó có gần tay và có vướng nốt melody đang bấm không — đó là căn cứ của bạn.',
    },
    {
      kind: 'fretboard',
      title: 'Nốt Bass ở thế I',
      lead: 'Ba dây trầm, bốn ngăn đầu — chỗ làm việc của ngón cái p. Si (dây 5 ngăn 2) là nốt bass đầu tiên bạn phải bấm.',
      frets: 5,
      zones: LOAI,
      dots: BASS_DOTS,
      legend: ['E · A · D là dây buông, đã dùng từ Buổi 02',
        'B (dây 5 ngăn 2) — quãng 5 của hợp âm E',
        'G · C · F ở ngăn 3 — để dành cho các hợp âm sau này'],
    },
    {
      kind: 'score',
      subtitle: 'Bài tập kỹ thuật 01',
      title: 'Bass luân phiên: gốc ↔ quãng 5',
      lead: '8 ô nhịp, chỉ ngón cái p. Vòng Am – Dm – E – Am như Etude các buổi trước.',
      tempo: 'Tempo: ♩ = 60',
      tex: EX1,
      guidance: [
        'Mỗi ô hai nốt bass: gốc trước, quãng 5 sau. Nghe phần nền đi bước một, không còn đứng yên.',
        'Ô 5–6: Si phải bấm bằng ngón 2 — ngón cái p vẫn gảy, tay trái mới là tay bấm.',
        'Đây là mẫu gợi ý. Bạn đảo lại (quãng 5 trước, gốc sau) cũng được — nghe thử rồi chọn.',
      ],
    },
    {
      kind: 'note',
      title: 'Phần 2 — Luyến khác trượt chỗ nào',
      text: 'Luyến lên (hammer-on): gảy nốt đầu rồi GÕ mạnh ngón kia xuống nốt sau. Luyến xuống (pull-off): gảy nốt đầu rồi MÓC ngón ra cho nốt sau vang. Cả hai đều chỉ gảy một lần, đều đi trên một dây — nhưng dùng HAI NGÓN KHÁC NHAU, khác với trượt vốn giữ nguyên một ngón đi dọc dây.',
    },
    {
      kind: 'score',
      subtitle: 'Bài tập kỹ thuật 02',
      title: 'Luyến lên và luyến xuống',
      lead: '6 ô nhịp: dây 3, dây 2, rồi dây 1 — mỗi dây làm cả luyến lên lẫn luyến xuống.',
      tempo: 'Tempo: ♩ = 60',
      tex: EX2,
      marks: [
        { at: 'Ô 1', text: 'luyến lên từ dây buông — gõ ngón 2 xuống ngăn 2' },
        { at: 'Ô 2', text: 'luyến xuống về dây buông — móc ngón ra' },
        { at: 'Ô 4', text: 'hai nốt đều bấm: ngón 1 và ngón 3' },
      ],
      guidance: [
        'Nốt sau phải nghe RÕ BẰNG nốt gảy. Nghe nhỏ hơn hẳn là gõ chưa dứt khoát hoặc móc chưa đủ.',
        'Gõ bằng đầu ngón, sát ngăn phím — không gõ vào giữa ô phím.',
        'Luyến xuống không phải là nhấc ngón lên: phải MÓC ngón sang ngang thì dây mới kêu.',
      ],
    },
    {
      kind: 'layers',
      title: 'Phần 3 — Cùng một chỗ, ba cách nối',
      lead: 'Diễm Xưa ô 3–4, "Dài tay em mấy thuở mắt xanh xao". Chỗ Sol → La (dây 1, ngăn 3 → 5) nối được bằng cả ba cách. Đàn cả ba rồi nghe.',
      layers: [
        { label: 'Cách 1', what: 'Gảy lại — như Buổi 01–02. Hai nốt rõ ràng, chắc chắn, nhưng nghe tách bạch.', tex: NOI_1 },
        { label: 'Cách 2', what: 'Trượt — như Buổi 03. Nghe được cả đường đi giữa hai nốt; cùng một ngón đi dọc dây.', tex: NOI_2 },
        { label: 'Cách 3', what: 'Luyến lên — mới hôm nay. Hai nốt dính liền, nốt sau mềm hơn; hai ngón khác nhau.', tex: NOI_3, current: true },
      ],
      note: 'Cả ba đều đúng. Câu này bạn chọn cách nào? Nghe thử ba lần rồi ghi lại: "Tôi chọn cách này vì…" — Thầy không chấm bạn chọn giống Thầy.',
    },
    {
      kind: 'repertoire',
      title: 'Phần 4 — Áp dụng vào bài',
      candidates: ['Diễm Xưa — tự điền bass, tự chọn chỗ luyến'],
      status: 'ready',
      pieces: [
        {
          title: 'Diễm Xưa ô 1–8 — bass để trống',
          composer: 'Trịnh Công Sơn · giọng Am',
          note: 'Bản này CHỈ có melody và tên hợp âm — phần bass để trống có chủ ý. Nhìn tên hợp âm, tự chọn nốt bass rồi viết vào bản in. Thầy chỉ luyến sẵn một chỗ ở ô 3 làm mẫu.',
          barsPerRow: 2,
          tex: WORK_DIEM_XUA_B5,
          marks: [
            { at: 'Am · A7', text: 'gốc La dây 5 buông · quãng 5 Mi dây 6 buông' },
            { at: 'Dm', text: 'gốc Rê dây 4 buông · quãng 5 La dây 5 buông' },
            { at: 'E', text: 'gốc Mi dây 6 buông · quãng 5 Si dây 5 ngăn 2' },
          ],
          guidance: [
            '1. Nhìn tên hợp âm trên khuông.',
            '2. Viết nốt bass bạn chọn vào đầu ô nhịp.',
            '3. Đàn thử cả câu: bass có làm melody yếu đi không?',
            '4. Ô nào bass làm đứt câu hát thì bỏ bass ô đó — melody quan trọng hơn.',
            '5. Ghi lại: "Tôi chọn bass này vì…"',
          ],
        },
        {
          title: 'Diễm Xưa — toàn bài (melody + hợp âm)',
          composer: 'Trịnh Công Sơn · giọng Am',
          note: 'Trong cả bài còn 4 chỗ nữa luyến được, ngoài ô 3. Tìm ít nhất một chỗ, đánh dấu và giải thích vì sao chỗ đó hợp luyến.',
          barsPerRow: 3,
          tex: WORK_DIEM_XUA,
        },
      ],
      annotationTypes: ['Nốt bass bạn chọn', 'Chỗ luyến', 'Cách nối (gảy lại / trượt / luyến)',
        'Ngón tay trái', 'Lý do chọn', 'Ghi chú của giáo viên'],
    },
    {
      kind: 'assignment',
      items: [
        { label: 'Bài 1.', text: 'Bass luân phiên gốc ↔ quãng 5: 5 phút mỗi ngày, chậm, tiếng đều.' },
        { label: 'Bài 2.', text: 'Luyến lên và luyến xuống trên ba dây — nốt sau phải nghe rõ bằng nốt gảy.' },
        { label: 'Bài 3.', text: 'Ô 3 Diễm Xưa: đàn cả ba cách nối, chọn một và ghi "Tôi chọn cách này vì…".' },
        { label: 'Bài 4.', text: 'Điền nốt bass cho 8 ô đầu Diễm Xưa theo tên hợp âm, ghi "Tôi chọn bass này vì…".' },
        { label: 'Bài 5.', text: 'Tìm thêm ít nhất một chỗ trong bài có thể luyến, đánh dấu và giải thích.' },
      ],
      message: 'Bass của bạn có thể khác bass của bạn bên cạnh. Mang lý do đến lớp, ta nghe từng phương án một.',
    },
    {
      kind: 'checklist',
      items: [
        'Tôi nhìn tên hợp âm là biết bass gốc ở đâu.',
        'Tôi thêm được bass quãng 5, kể cả nốt Si phải bấm.',
        'Tôi luyến lên và luyến xuống mà nốt sau vẫn rõ tiếng.',
        'Tôi phân biệt được gảy lại · trượt · luyến.',
        'Tôi tự điền bass cho 8 ô đầu Diễm Xưa.',
        '⭐ Tôi nói được vì sao mình chọn bass và cách nối đó.',
      ],
    },
    { kind: 'studentNotes', title: 'Tôi chọn bass / cách nối này vì…', lines: 8 },
  ],
}
