// ── SOLO-01 · BUỔI 04 — nội dung giáo trình ──
// "Tạm cất bass để soi sâu giai điệu." Bass đã học ở Buổi 02–03; buổi này chủ động
// tách ra để học viên dồn hết vào CHẤT LƯỢNG MELODY. Không bass, không hợp âm.
//
// NGUYÊN TẮC SƯ PHẠM (từ Buổi 04 trở đi):
//   QUY TẮC → CĂN CỨ ĐỂ CHỌN → TỰ LÀM → GIẢI THÍCH
// Không dạy học viên bắt chước ngón của Thầy. Không có đáp án duy nhất; hai người
// có thể xếp khác nhau, miễn mỗi người nói được vì sao mình chọn như vậy.
// Ví dụ so sánh luôn là HAI PHƯƠNG ÁN CÙNG CAO ĐỘ mà người chơi thật hay chọn —
// không dựng một cách vụng để bác bỏ.
//
// ⚠️ NGÓN TAY TRONG alphaTex LỆCH 1: tay trái `lf 2`=ngón 1 … `lf 5`=ngón 4;
//    tay phải `rf 2`=i · `rf 3`=m · `rf 4`=a (rf 1 = p — buổi này KHÔNG dùng).
//    KHÔNG ghi ngón trái và ngón phải trên cùng một bản: số chồng lên nhau.
import type { LessonDoc, FretDot, FretZone } from '../../lesson/lessonTypes'
import { WORK_DIEM_XUA, WORK_THANH_PHO_BUON } from './works'

// ── I. Tay trái — câu thật: Diễm Xưa ô 11–12 "Chiều nay còn mưa sao em không lại /
//        Nhớ mãi trong cơn đau". Mi – Fa – Mi (chùm ba) rồi La × 4; ô 12 Fa rồi La × 5.
// Bước 1: TỰ LÀM TRƯỚC — chỉ in khuông, không in TAB (TAB là chọn vị trí hộ mất rồi).
const CAU_TU_LAM = `
\\ts 4 4
.
\\staff {score}
r.4 0.1.8{tu 3} 1.1.8{tu 3} 0.1.8{tu 3} 5.1.8 5.1.8 5.1.8 5.1.8 |
6.2.4{d} 5.1.8 5.1.8 5.1.8 5.1.8 5.1.8
`.trim()

// Hai phương án CÙNG CAO ĐỘ, người chơi thật đều hay chọn:
// Mi dây 1 buông = Mi dây 2 ngăn 5 (E4) · Fa dây 1 ngăn 1 = Fa dây 2 ngăn 6 (F4).
// Phương án 1 — Mi dây 1 buông: dễ tìm, không phải bấm. Đây cũng là cách bản nhạc
// Buổi 01–03 đang in, học viên đã đàn ba tuần. Ngón 1 lên ngăn 5 lúc Mi buông đang kêu.
const PA_1 = `
\\ts 4 4
.
r.4 0.1.8{tu 3} 1.1{lf 2}.8{tu 3} 0.1.8{tu 3} 5.1{lf 2}.8 5.1{lf 2}.8 5.1{lf 2}.8 5.1{lf 2}.8 |
6.2{lf 3}.4{d} 5.1{lf 2}.8 5.1{lf 2}.8 5.1{lf 2}.8 5.1{lf 2}.8 5.1{lf 2}.8
`.trim()

// Phương án 2 — nhìn trước: cả câu nằm quanh La ngăn 5 nên đặt tay thế V ngay từ đầu.
// Mi dây 2 ngăn 5 (ngón 1) → La dây 1 ngăn 5 là ngón 1 lăn sang dây bên cùng ngăn.
const PA_2 = `
\\ts 4 4
.
r.4 5.2{lf 2}.8{tu 3} 6.2{lf 3}.8{tu 3} 5.2{lf 2}.8{tu 3} 5.1{lf 2}.8 5.1{lf 2}.8 5.1{lf 2}.8 5.1{lf 2}.8 |
6.2{lf 3}.4{d} 5.1{lf 2}.8 5.1{lf 2}.8 5.1{lf 2}.8 5.1{lf 2}.8 5.1{lf 2}.8
`.trim()

// ── II. Tay phải — câu thật: Diễm Xưa ô 9–10 "Chợt hồn xanh buốt cho mình xót xa".
// Câu đổi dây liên tục: Mi dây 4 → Sol♯ dây 3 → Si dây 2 → Rê dây 2 → Si → Sol♯ dây 3 → Si → La dây 3.
// Cách 1: i – m thay phiên đều tăm tắp (quy tắc nền áp nguyên xi).
const TP_1 = `
\\ts 4 4
.
r.8 2.4{rf 2}.8 1.3{rf 3}.8 0.2{rf 2}.8 3.2{rf 3}.8 0.2{rf 2}.8 1.3{rf 3}.8 0.2{rf 2}.8 |
2.3{rf 3}.1
`.trim()

// Cách 2: chọn ngón theo dây — dây thấp ngón thấp, dây cao ngón cao (i – m – a).
const TP_2 = `
\\ts 4 4
.
r.8 2.4{rf 2}.8 1.3{rf 3}.8 0.2{rf 4}.8 3.2{rf 3}.8 0.2{rf 4}.8 1.3{rf 3}.8 0.2{rf 4}.8 |
2.3{rf 3}.1
`.trim()

// ── III. ♯/♭ — bài tập: nốt đã biết → dịch một ngăn → nốt biến hoá ──
// Thứ tự các cặp được xếp để không ngón nào bấm liên tiếp hai nốt ở hai dây.
const EX_THANG_GIANG = `
\\tempo 60
\\ts 4 4
.
0.3.2 1.3{lf 2}.2 |
2.4{lf 3}.2 1.4{lf 2}.2 |
4.3{lf 5}.2 3.3{lf 4}.2 |
1.1{lf 2}.2 2.1{lf 3}.2 |
1.3{lf 2}.2 2.3{lf 3}.2
`.trim()

// ── Áp dụng — câu trục đầy đủ (Diễm Xưa ô 7–10), ngón trái GỢI Ý + lời ──
const CAU_TRUC = `
\\ts 4 4
\\lyrics "Đường dài hun hút cho mắt thêm sâu Chợt hồn xanh buốt cho mình xót xa"
.
r.8 2.4{lf 3}.8 1.3{lf 2}.8 0.2.8 3.2{lf 4}.8 3.2{lf 4}.8 0.1.8 3.2{lf 4}.8 |
1.2{lf 2}.1 |
r.8 2.4{lf 3}.8 1.3{lf 2}.8 0.2.8 3.2{lf 4}.8 0.2.8 1.3{lf 2}.8 0.2.8 |
2.3{lf 3}.1
`.trim()

// ── Sơ đồ ♯/♭ — nốt đã biết (vòng xanh) và nốt biến hoá ngay ngăn bên (tô cam) ──
const LOAI: FretZone[] = [
  { no: 1, label: 'Nốt đã biết', tag: '', fromFret: 0, toFret: 0, strings: [1, 6], color: '#4338CA',
    hidden: true, hint: 'lấy từ bản đồ C–Am của Buổi 01.' },
  { no: 2, label: 'Nốt ♯ / ♭', tag: '', fromFret: 0, toFret: 0, strings: [1, 6], color: '#A85F0E',
    hidden: true, hint: 'dịch đúng MỘT ngăn: lên là ♯, xuống là ♭.' },
]
const d = (string: number, fret: number, name: string, zone: number): FretDot =>
  ({ string, fret, name, zone, root: zone === 2 })
const THANG_GIANG_DOTS: FretDot[] = [
  d(3, 0, 'G', 1), d(3, 1, 'G♯', 2),     // G → G♯ (chính nốt trong Diễm Xưa)
  d(1, 3, 'G', 1), d(1, 4, 'G♯', 2),
  d(1, 1, 'F', 1), d(1, 2, 'F♯', 2),     // F → F♯
  d(4, 2, 'E', 1), d(4, 1, 'E♭', 2),     // E → E♭
  d(3, 4, 'B', 1), d(3, 3, 'B♭', 2),     // B → B♭ (Si dây 2 buông thì KHÔNG hạ được)
]

export const SOLO01_BUOI04: LessonDoc = {
  meta: {
    programCode: 'SOLO-01',
    programName: 'SOLO GUITAR CĂN BẢN',
    sessionNo: 4,
    title: 'Xếp ngón giai điệu & nốt ngoài âm giai (♯/♭)',
    stageLabel: 'Chặng 1 · Từ giai điệu đến Solo Guitar',
    backHref: '/solo01',
  },
  sections: [
    {
      kind: 'recap',
      title: 'Từ Buổi 03 sang Buổi 04',
      steps: [
        { label: 'Buổi 01–03', items: ['Bạn đàn theo ngón Thầy gợi ý.', 'Đã có ép ngón, Bass, Slide.'] },
        { label: 'Buổi 04', items: ['Tạm cất Bass, soi kỹ giai điệu.', 'BẠN tự chọn cách đàn.', 'Bạn nói được VÌ SAO chọn vậy.'] },
      ],
      message: 'Vẫn là Diễm Xưa. Từ tuần này, câu Thầy hay hỏi nhất sẽ là: "Tại sao bạn xếp như vậy?"',
    },
    {
      kind: 'objectives',
      title: 'Cuối buổi, bạn làm được',
      items: [
        'Gặp một câu melody chưa ghi ngón, tự xếp ngón tay trái.',
        'Tự kiểm bằng 4 câu hỏi: đi có thuận – tiếng có liền – câu sắp đi đâu – sắp có bass/hợp âm không.',
        'Tự chọn i / m / a thay vì chép ký hiệu có sẵn.',
        'Gặp nốt ♯/♭, tìm được nốt và đưa nó vào câu melody.',
        '⭐ QUAN TRỌNG NHẤT — Khi Thầy hỏi "Tại sao bạn xếp như vậy?", bạn giải thích được.',
      ],
    },
    {
      kind: 'note',
      title: 'Điều quan trọng nhất của buổi hôm nay',
      text: 'Kết quả của buổi học KHÔNG phải là bạn xếp ngón giống Thầy — mà là bạn tự biện luận được cách xếp ngón của mình. Không có một đáp án duy nhất: hai người có thể xếp ngón khác nhau, miễn là mỗi người giải thích được tại sao mình chọn như vậy.',
    },
    {
      kind: 'recap',
      title: 'Phần 1 — 4 câu hỏi trước khi xếp ngón',
      steps: [
        { label: '1. Đi có thuận không?', items: ['Từ nốt này sang các nốt sau, tay di chuyển có hợp lý không?'] },
        { label: '2. Tiếng có liền không?', items: ['Cách bấm này có vô tình làm câu nhạc bị gãy không?'] },
        { label: '3. Câu sắp đi đâu?', items: ['Nhìn trước vài nốt: câu sắp nằm ở vùng nào thì đặt tay sẵn ở đó.'] },
        { label: '4. Sắp có Bass / hợp âm không?', items: ['Cách thuận khi chỉ chơi melody chưa chắc còn thuận khi thêm Bass. Nghĩ trước một chút.'] },
      ],
      message: 'Không có một đáp án duy nhất: hai người có thể xếp ngón khác nhau, miễn là mỗi người giải thích được tại sao mình chọn như vậy.',
    },
    {
      kind: 'score',
      subtitle: 'Tự làm trước',
      title: 'Bạn tự xếp ngón câu này',
      lead: 'Diễm Xưa ô 11–12, "Chiều nay còn mưa sao em không lại / Nhớ mãi trong cơn đau". Bản này cố ý KHÔNG in TAB: bạn tự chọn đàn ở dây nào, ngăn nào, ngón nào.',
      tex: CAU_TU_LAM,
      guidance: [
        'Bước 1 — Tự xếp ngón, ghi bút chì lên bản nhạc.',
        'Bước 2 — Đàn thử cả câu.',
        'Bước 3 — Tự kiểm bằng 4 câu hỏi ở trên.',
        'Bước 4 — Chỗ nào bí thì đổi cách, đàn lại.',
        'Bước 5 — Viết một câu: "Tôi chọn cách này vì…"',
        'Bạn không cần đoán cách của Thầy. Cách của bạn đúng khi bạn giải thích được nó.',
      ],
    },
    {
      kind: 'layers',
      title: 'Hai cách người chơi hay chọn',
      lead: 'Xem sau khi đã tự làm. Hai cách dưới CÙNG CAO ĐỘ (Mi dây 1 buông = Mi dây 2 ngăn 5; Fa dây 1 ngăn 1 = Fa dây 2 ngăn 6). Cả hai đều đúng — khác nhau ở căn cứ chọn.',
      layers: [
        { label: 'Cách 1', what: 'Mi dây 1 BUÔNG: dễ tìm, khỏi bấm. Trong lúc Mi buông đang kêu, ngón 1 dời lên ngăn 5 cho La. Đây là cách bản nhạc Buổi 01–03 đang in.', tex: PA_1 },
        { label: 'Cách 2', what: 'Nhìn trước: cả câu nằm quanh La ngăn 5, nên đặt tay ở thế V ngay từ đầu — Mi dây 2 ngăn 5, Fa ngăn 6. Tay đứng yên suốt hai ô; La là ngón 1 lăn sang dây bên, cùng ngăn.', tex: PA_2 },
      ],
      note: 'Soi bằng 4 câu hỏi: Cách 2 mạnh ở câu 3 (câu sắp đi đâu) — tay không phải đổi thế giữa chùm ba nhanh. Nhưng Cách 1 mạnh ở câu 4: Mi dây 1 buông để tay trái rảnh, sau này thêm hợp âm ở thế I sẽ dễ hơn. Bạn chọn cách nào cũng được — hãy nói vì sao.',
    },
    {
      kind: 'note',
      title: 'Phần 2 — Tay phải: i, m, a là dụng cụ',
      text: 'Quy tắc nền: thay phiên ngón thì tay đều và không ngón nào phải làm quá nhiều — đó là lý do Buổi 02 luyện i – m. Nhưng đó là quy tắc NỀN, không phải công thức áp máy móc cho mọi câu. Câu dưới đây đổi dây liên tục; thử hai cách rồi tự nghe.',
    },
    {
      kind: 'layers',
      title: 'Cùng một câu, hai cách gảy',
      lead: 'Diễm Xưa ô 9–10, "Chợt hồn xanh buốt cho mình xót xa". Câu leo từ dây 4 lên dây 3, dây 2 rồi đi lại.',
      layers: [
        { label: 'Cách 1', what: 'i – m thay phiên đều. Để ý nốt Si dây 2: i phải vươn qua m để gảy dây cao hơn — hai ngón bắt chéo nhau.', tex: TP_1 },
        { label: 'Cách 2', what: 'Chọn ngón theo dây: dây thấp ngón thấp, dây cao ngón cao — i dây 4, m dây 3, a dây 2. Không ngón nào bắt chéo.', tex: TP_2 },
      ],
      note: 'Mục tiêu không phải "i – m – a tốt hơn i – m". Câu khác có khi i – m lại thuận hơn. Chọn ngón để câu chạy đều và sẵn sàng cho nốt tiếp theo. ⚠️ Mi dây 4 ở đây là GIAI ĐIỆU nên gảy bằng i, không phải p — dây trầm không có nghĩa phải dùng ngón cái, p chỉ dành cho Bass.',
    },
    {
      kind: 'note',
      title: 'Phần 3 — Gặp nốt ♯/♭',
      text: 'Bản đồ C–Am là bản đồ NỀN — bài hát thật vẫn có nốt ngoài bản đồ, như Sol♯ trong Diễm Xưa. Gặp ♯/♭ thì làm 4 bước: (1) xác định nốt, (2) tìm vị trí từ nốt đã biết, (3) nhìn cả câu, (4) quyết định ngón. Không cần học thuộc vị trí ♯/♭ — chỉ cần biết dịch một ngăn.',
    },
    {
      kind: 'fretboard',
      title: 'Tìm ♯ / ♭ từ nốt đã biết',
      lead: 'Lấy nốt đã thuộc, dịch đúng MỘT ngăn: lên một ngăn là ♯, xuống một ngăn là ♭.',
      frets: 6,
      zones: LOAI,
      dots: THANG_GIANG_DOTS,
      legend: ['F♯ = F nâng lên nửa cung', 'B♭ = B hạ xuống nửa cung',
        'Si dây 2 BUÔNG không hạ được — muốn B♭ phải sang dây 3 ngăn 3 (cùng tư duy đổi dây như lúc làm slide)'],
    },
    {
      kind: 'score',
      subtitle: 'Bài tập',
      title: 'Nốt đã biết → dịch một ngăn',
      lead: 'Mỗi ô một cặp: nốt đã biết rồi nốt biến hoá ngay ngăn bên. Ô cuối đưa Sol♯ về La — đúng như trong Diễm Xưa.',
      tempo: 'Tempo: ♩ = 60',
      tex: EX_THANG_GIANG,
      marks: [
        { at: 'Ô 1', text: 'Sol → Sol♯ (dây 3)' },
        { at: 'Ô 2', text: 'Mi → Mi♭ (dây 4)' },
        { at: 'Ô 3', text: 'Si → Si♭ (dây 3)' },
        { at: 'Ô 4', text: 'Fa → Fa♯ (dây 1)' },
        { at: 'Ô 5', text: 'Sol♯ → La' },
      ],
      guidance: [
        'Đọc tên nốt thành tiếng trong lúc bấm: "Sol… Sol thăng".',
        'Nghe cho ra nửa cung — nốt biến hoá sát rạt nốt gốc, không phải một nốt xa lạ.',
      ],
    },
    {
      kind: 'repertoire',
      title: 'Phần 4 — Áp dụng vào bài',
      candidates: ['Diễm Xưa — câu có Sol♯ (ô 7–10)', 'Thành Phố Buồn — tự xếp ngón'],
      status: 'ready',
      pieces: [
        {
          title: 'Diễm Xưa — câu có Sol♯ (ô 7–10)',
          composer: 'Trịnh Công Sơn · giọng Am · melody thuần, không Bass',
          note: 'Đây là phần chính của buổi. Hai câu cùng một hình giai điệu, đều có Sol♯. Ngón ghi trên bản là GỢI Ý của Thầy — bạn đi đủ 8 bước bên dưới, có thể ra cách khác, miễn nói được vì sao.',
          barsPerRow: 2,
          tex: CAU_TRUC,
          marks: [
            { at: 'Sol♯', text: 'ô 7 và ô 9 — gợi ý: dây 3 ngăn 1, ngón 1' },
            { at: 'Vì sao?', text: 'Mi dây 4 ngăn 2 và Si dây 2 đều quanh thế I — Sol♯ ở dây 3 ngăn 1 nằm ngay giữa' },
          ],
          guidance: [
            '1. Xác định từng nốt.',
            '2. Xác định đúng cao độ — nhìn khuông, đừng chỉ nhìn tên.',
            '3. Chọn vùng đàn cho CẢ CÂU.',
            '4. Nhận ra nốt ngoài âm giai (Sol♯).',
            '5. Chọn ngón tay trái — dùng 4 câu hỏi.',
            '6. Chọn ngón tay phải.',
            '7. Slide nếu nó giúp câu tự nhiên hơn. Câu này ở thế I tay đã đứng yên nên Thầy không dùng — bạn thấy cần thì thử và giải thích.',
            '8. Đàn cả câu liền mạch, rồi viết: "Tôi chọn cách này vì…"',
          ],
        },
        {
          title: 'Diễm Xưa — toàn bài (melody)',
          composer: 'Trịnh Công Sơn · giọng Am',
          note: 'Hình giai điệu có Sol♯ còn lặp lại ở ô 22 và ô 24. Tự áp cách của mình sang hai chỗ đó.',
          barsPerRow: 3,
          tex: WORK_DIEM_XUA,
        },
        {
          title: 'Thành Phố Buồn — tự xếp ngón',
          composer: 'Lam Phương · giọng Am',
          note: 'Bản nhạc chưa ghi ngón. Chọn một câu, tự xếp ngón tay trái và tay phải bằng 4 câu hỏi, rồi viết "Tôi chọn cách này vì…". Không có đáp án duy nhất.',
          barsPerRow: 4,
          tex: WORK_THANH_PHO_BUON,
        },
      ],
      annotationTypes: ['Ngón tay trái', 'Ngón tay phải i – m – a', 'Nốt ♯ / ♭', 'Chỗ đổi thế',
        'Lý do chọn', 'Ghi chú của giáo viên'],
    },
    {
      kind: 'assignment',
      items: [
        { label: 'Bài 1.', text: 'Chọn một câu Thành Phố Buồn (chưa ghi ngón). Tự xếp ngón tay trái, ghi: "Tôi chọn cách này vì…"' },
        { label: 'Bài 2.', text: 'Cũng câu đó, tự chọn i / m / a và ghi vì sao chỗ này dùng ngón đó.' },
        { label: 'Bài 3.', text: 'Khoanh mọi nốt ♯/♭ trong đoạn Diễm Xưa đang tập, ghi vị trí bạn chọn cho từng nốt.' },
        { label: 'Bài 4.', text: 'Tìm ít nhất 2 vị trí cho một đoạn ngắn, đàn thử cả hai, chọn một và giải thích.' },
      ],
      message: 'Thầy không chấm bạn có xếp giống Thầy hay không. Thầy chỉ hỏi một câu: "Tại sao bạn xếp như vậy?" — hãy mang câu trả lời của bạn đến lớp.',
    },
    {
      kind: 'checklist',
      items: [
        'Tôi tự xếp ngón được một câu chưa ghi ngón.',
        'Tôi tự kiểm bằng 4 câu hỏi.',
        'Tôi tự chọn i / m / a, không chỉ chép theo bản.',
        'Tôi tìm được Sol♯ và các nốt ♯/♭ khác từ nốt đã biết.',
        'Tôi đàn được câu có Sol♯ của Diễm Xưa liền mạch.',
        'Tôi viết được "Tôi chọn cách này vì…".',
        '⭐ Tôi giải thích được cách xếp ngón của mình, kể cả khi nó khác cách của Thầy.',
      ],
    },
    { kind: 'studentNotes', title: 'Tôi chọn cách này vì…', lines: 8 },
  ],
}
