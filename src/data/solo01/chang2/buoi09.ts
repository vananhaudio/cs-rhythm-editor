// ── SOLO-01 · CHẶNG 2 (SOLO BOLERO) · BUỔI 1/8 — hệ thống đánh số là BUỔI 9 ──
// Chủ đề: Melody & Kỹ thuật diễn tấu (Hammer-on · Pull-off · Vibrato · Slide · Bend).
// Bài mẫu xuyên suốt cả chặng: "Con Đường Xưa em Đi" — nốt nhạc lấy từ MusicXML trong thư viện, bản phối DẪN XUẤT nâng một quãng 8 (xem works.ts).
// QUY ƯỚC ID: bài trả bắt đầu bằng SỐ BUỔI CỦA HỆ THỐNG ("9.1"), vì bộ kiểm + server đòi vậy.
// ⚠️ alphaTex: tay trái lf 2 = ngón 1 … lf 5 = ngón 4. Luyến {h} đặt ở NỐT TRƯỚC (như Buổi 05 Chặng 1). {v} rung · {ss} trượt · {b (0 4)} bend 1 cung.
// ⚠️ BẢN NHÁP. Mọi chỗ "gợi ý" là LỰA CHỌN PHỐI KHÍ, không phải quy luật — Owner rà soát trước khi xuất bản.
import type { LessonDoc } from '../../../lesson/lessonTypes'
import { CDX_BARS, cdxFingered } from './works'

const swap = (s: string, a: string, b: string): string => {
  if (!s.includes(a)) throw new Error(`swap: không thấy "${a}"`)
  return s.replace(a, b)
}
const bars = (list: string[]): string => '\\ts 4 4\n.\n' + list.join('\n')

// Ô 7: Mi (dây 1 buông) → Fa (dây 1 ngăn 1): Hammer-on TỪ DÂY BUÔNG
const B7_HAM = swap(CDX_BARS[6], '0.1.16 1.1.16', '0.1{h}.16 1.1{lf 2}.16')
// Ô 8: nốt Si tròn (dây 1 ngăn 7) — nốt bấm, rung được
const B8_VIB = swap(CDX_BARS[7], '7.1{ch "E"}.1', '7.1{lf 4 v ch "E"}.1')
// Ô 9: Sol♯ → La trên cùng dây 1 (ngăn 4 → ngăn 5), MỘT ngón trượt
const B9_SLIDE = swap(CDX_BARS[8], '4.1.8{tu 3} 5.1.8{tu 3}', '4.1{lf 2 ss}.8{tu 3} 5.1{lf 2}.8{tu 3}')
// Ô 18: Mi → Rê (dây 1 ngăn 12 → ngăn 10): Pull-off. Luyến đặt ở nốt TRƯỚC.
const B18_PLAIN = CDX_BARS[17]
const B18_PO = swap(CDX_BARS[17], '12.1.4{tu 3} 10.1.4{tu 3}', '12.1{lf 5 h}.4{tu 3} 10.1{lf 3}.4{tu 3}')

// Bài tập kỹ thuật (KHÔNG phải nốt của bản nhạc) — đặt cùng vùng dây 1 với melody
const DRILL_HP = bars([
  '5.1{lf 2 h}.4 7.1{lf 4}.4 7.1{lf 4 h}.4 5.1{lf 2}.4 |',
  '5.1{lf 2 h}.4 8.1{lf 5}.4 8.1{lf 5 h}.4 5.1{lf 2}.4 |',
  '0.1{h}.4 1.1{lf 2}.4 1.1{lf 2 h}.4 0.1.4 |',
])
const DRILL_SLIDE = bars([
  '1.2{lf 2 ss}.4 3.2{lf 2}.4 3.2{lf 2 ss}.4 1.2{lf 2}.4 |',
  '5.1{lf 2 ss}.4 8.1{lf 2}.4 8.1{lf 2 ss}.4 5.1{lf 2}.4 |',
])
const DRILL_VIB = bars(['7.1{lf 4 v}.2 7.1{lf 4 v}.2 |', '5.1{lf 2 v}.1 |'])
const DRILL_BEND = bars([
  '5.1{lf 4 b (0 4)}.2 r.2 |',
  '5.1{lf 4 b (0 4 0)}.2 r.2 |',
  '5.1{lf 4}.4 7.1{lf 4}.4 5.1{lf 4}.2 |',
])

export const SOLO01_BUOI09: LessonDoc = {
  meta: {
    programCode: 'SOLO-01',
    programName: 'SOLO GUITAR CĂN BẢN',
    sessionNo: 9,
    title: 'Chặng 2 – Buổi 1/8 · Melody & Kỹ thuật diễn tấu',
    stageLabel: 'Chặng 2 · Solo Bolero',
    backHref: '/solo01',
  },
  sections: [
    {
      kind: 'recap',
      title: 'Từ Chặng 1 sang Chặng 2',
      steps: [
        { label: 'Chặng 1 đã có', items: ['Tìm nốt melody trên cần đàn.', 'Ép ngón i–m, thêm bass đầu tiên.', 'Slide, luyến, xếp ngón.'] },
        { label: 'Chặng 2 xây thêm', items: ['Một quy trình trọn vẹn dựng Solo Bolero — mỗi buổi là một bước.', 'Bài mẫu xuyên suốt 8 buổi: Con Đường Xưa em Đi.'] },
      ],
      message: 'Bài mẫu được phối ở QUÃNG 8 CAO: giai điệu nằm trên dây 1 (dây 2 khi nốt thấp) và ở ngăn cao hơn so với bản gốc, để chừa chỗ bên dưới cho Bass và hợp âm. Lộ trình 8 buổi: Melody & kỹ thuật → Bass → Xếp ngón → Hợp âm bấm tắt → Chèn hợp âm theo công thức Bolero → Ghép Bass + hợp âm cho điệp khúc → Tự dựng → Tổng kết & biểu diễn. Buổi này là bước đầu: có một melody sạch, rồi làm nó biết hát.',
    },
    {
      kind: 'objectives',
      title: 'Cuối buổi, bạn làm được',
      items: [
        'Đọc đúng melody ô 1–8 của Con Đường Xưa em Đi: cao độ, trường độ, nốt chấm, chùm ba.',
        'Phân biệt và thực hiện được 5 kỹ thuật: Hammer-on, Pull-off, Vibrato, Slide, Bend.',
        'Biết kỹ thuật nào hợp với kiểu nốt nào (nốt liền bậc, nốt dài, nốt đổi ngăn…).',
        'Hiểu kỹ thuật là LỰA CHỌN diễn tấu của người chơi, không phải luật bắt buộc.',
        '⭐ QUAN TRỌNG NHẤT — Chọn một kỹ thuật cho một chỗ trong bài và nói được vì sao.',
      ],
    },
    // NHỊP HỌC (đề xuất — Owner chốt điểm ngắt): 9.1 trắc nghiệm → 9.2 trắc nghiệm → 9.3 video + chữ (video DUY NHẤT).
    {
      kind: 'note',
      title: 'Nhịp 1 · Đọc melody Con Đường Xưa em Đi',
      text: 'Phần 1 — Làm ngay: đàn chậm ô 1–8 theo bản nhạc. Kết thúc nhịp: Bài trả 9.1 (trắc nghiệm).',
    },
    {
      kind: 'score',
      subtitle: 'Phần 1 — Làm ngay',
      title: 'Ô 1–8: melody gốc, chưa kỹ thuật',
      lead: 'Giọng La thứ (Am), nhịp 4/4, bản phối nâng một quãng 8. Tay trái ghi theo VỊ TRÍ: trong một vị trí, ngón 1 giữ ngăn đầu của vị trí, ngón 2 giữ ngăn kế, ngón 3 ngăn kế nữa, ngón 4 ngăn cuối (xem kỹ ở Buổi 3). Dây buông không ghi ngón. Dây 1 là dây e cao, dây 6 là dây E trầm.',
      tempo: 'Tempo: ♩ = 60',
      tex: cdxFingered(1, 8),
      marks: [
        { at: 'Ô 1', text: 'ô vào: nghỉ một phách, rồi 4 nốt, có chùm ba (ba nốt chia đều trong hai phách)' },
        { at: 'Ô 2', text: 'nốt đen chấm đầu ô = 1,5 phách' },
        { at: 'Ô 4', text: 'một nốt tròn (4 phách) trên dây 1 BUÔNG — nốt dài đầu tiên của bài, nhưng dây buông nên không rung được (xem Nhịp 2)' },
        { at: 'Ô 8', text: 'nốt Si dây 1 ngăn 7, tròn, kéo dài cả ô' },
      ],
      guidance: [
        'Đàn từng ô riêng, rồi ghép 2 ô. Đừng đàn cả đoạn khi chưa đều.',
        'Giai điệu nằm ở hai vùng: nốt thấp (dây 2–1, ngăn 1–3) và nốt cao (dây 1, ngăn 5–8; có chỗ lên ngăn 10–12). Chuyển vùng bằng cách dịch cả bàn tay, đừng với ngón.',
        'Mi dây 1 buông xuất hiện nhiều: đó là lúc tay trái được nghỉ để dịch vị trí.',
        'Chưa thêm kỹ thuật vội. Có một melody sạch rồi mới trang trí.',
      ],
    },
    {
      kind: 'checkpoint',
      id: '9.1',
      title: 'Bài trả 9.1 — Đọc melody',
      required: true,
      accepts: ['quiz'],
      quiz: {
        mode: 'single',
        question: 'Nốt đầu tiên của ô 2 là nốt đen chấm (La, dây 1 ngăn 5). Trong nhịp 4/4, nốt đen chấm kéo dài bao nhiêu phách?',
        options: [
          { id: 'a', text: '1 phách' },
          { id: 'b', text: '1,5 phách' },
          { id: 'c', text: '2 phách' },
          { id: 'd', text: '3 phách' },
        ],
        hint: 'Dấu chấm cộng thêm MỘT NỬA giá trị của nốt đứng trước nó. Nốt đen = 1 phách.',
      },
    },
    {
      kind: 'note',
      title: 'Nhịp 2 · Năm kỹ thuật diễn tấu',
      text: 'Luyện từng kỹ thuật ở bài tập riêng, rồi tìm chúng trong bài. Kết thúc nhịp: Bài trả 9.2 (trắc nghiệm).',
    },
    {
      kind: 'recap',
      title: 'Năm kỹ thuật — nhìn nhanh',
      steps: [
        { label: 'Hammer-on (luyến lên)', items: ['Gảy nốt thấp, GÕ ngón khác xuống nốt cao hơn trên cùng dây.', 'Chỉ gảy một lần.'] },
        { label: 'Pull-off (luyến xuống)', items: ['Gảy nốt cao, MÓC ngón ra để nốt thấp hơn vang lên.', 'Chỉ gảy một lần.'] },
        { label: 'Slide (trượt)', items: ['Giữ MỘT ngón, trượt dọc dây từ ngăn này sang ngăn kia.', 'Nghe cả đường đi giữa hai nốt.'] },
        { label: 'Vibrato (rung)', items: ['Làm cao độ của nốt dài dao động nhẹ.', 'Chỉ làm được trên nốt đang BẤM — dây buông thì không rung được.'] },
        { label: 'Bend (vuốt dây)', items: ['Đẩy dây để nâng cao độ liên tục.', 'Điểm đến thường là nửa cung hoặc một cung.'] },
      ],
      message: 'Hammer-on và Pull-off thuộc nhóm luyến (legato). Slide, Vibrato, Bend biến đổi cao độ bằng tay trái. Cả năm chỉ là cách làm đẹp thêm cho một nốt đã đúng.',
    },
    {
      kind: 'score',
      subtitle: 'Bài tập kỹ thuật 01',
      title: 'Hammer-on và Pull-off',
      lead: 'Ba ô nhịp trên dây 1: ngăn 5 ↔ 7, ngăn 5 ↔ 8, rồi dây buông ↔ ngăn 1. Chỉ gảy nốt đầu của mỗi cặp.',
      tempo: 'Tempo: ♩ = 60',
      tex: DRILL_HP,
      guidance: [
        'Hammer-on: gõ bằng đầu ngón, sát ngăn phím, dứt khoát — nốt sau phải nghe rõ gần bằng nốt gảy.',
        'Pull-off: móc ngón sang ngang (không chỉ nhấc lên) thì dây mới kêu.',
        'Hai nốt của một cặp luyến dùng HAI NGÓN KHÁC NHAU; slide thì dùng một ngón.',
      ],
    },
    {
      kind: 'score',
      subtitle: 'Bài tập kỹ thuật 02',
      title: 'Slide',
      lead: 'Một ngón trượt trên dây 2 (ngăn 1 ↔ ngăn 3) và trên dây 1 (ngăn 5 ↔ ngăn 8).',
      tempo: 'Tempo: ♩ = 60',
      tex: DRILL_SLIDE,
      guidance: [
        'Giữ ngón ép nhẹ trên dây suốt đường trượt, đừng nhấc ra giữa chừng.',
        'Gảy nốt đầu một lần; nốt đến vang lên nhờ đường trượt.',
        'Trượt quá ngắn nghe như luyến; trượt đủ dài mới nghe thấy "đường đi".',
      ],
    },
    {
      kind: 'score',
      subtitle: 'Bài tập kỹ thuật 03',
      title: 'Vibrato',
      lead: 'Hai nốt dài: Si (dây 1 ngăn 7) và La (dây 1 ngăn 5). Rung đều, nhẹ, không làm nốt lệch tông.',
      tempo: 'Tempo: ♩ = 60',
      tex: DRILL_VIB,
      guidance: [
        'Cách phổ biến: xoay nhẹ cổ tay để kéo – đẩy dây; mỗi người có thói quen riêng.',
        'Chỉ rung khi nốt đủ dài. Nốt ngắn mà rung nghe run và mờ.',
        'Nốt dây buông (như Mi dây 1 buông ở ô 4) không rung được bằng tay trái — muốn rung phải bấm cùng cao độ ở chỗ khác (Mi cũng có ở dây 2 ngăn 5). Nốt tròn Si ở ô 8 là nốt bấm nên rung được.',
      ],
    },
    {
      kind: 'score',
      subtitle: 'Bài tập kỹ thuật 04',
      title: 'Bend',
      lead: 'La (dây 1 ngăn 5) vuốt lên một cung chạm Si (dây 1 ngăn 7). Ô 1: bend đến đích. Ô 2: bend rồi nhả về. Ô 3: đàn nốt Si thật (ngăn 7) để so cao độ.',
      tempo: 'Tempo: ♩ = 60',
      tex: DRILL_BEND,
      guidance: [
        'Bend bằng ngón 3 ở ngăn 5, đặt ngón 1 và 2 ở ngăn 3 và 4 phía sau trợ lực.',
        'Đẩy dây bằng sức cả cổ tay, không chỉ ngón. Nghe đích đến rồi mới chỉnh.',
        'Mục tiêu là cao độ đúng: thiếu nghe như hụt, thừa nghe như lệch nốt.',
      ],
    },
    {
      kind: 'checkpoint',
      id: '9.2',
      title: 'Bài trả 9.2 — Kỹ thuật diễn tấu',
      required: true,
      accepts: ['quiz'],
      quiz: {
        mode: 'single',
        question: 'Nốt nào dưới đây KHÔNG thể rung (vibrato) bằng tay trái?',
        options: [
          { id: 'a', text: 'Si — dây 1 ngăn 7 (nốt tròn ô 8)' },
          { id: 'b', text: 'Mi — dây 1 buông (nốt tròn ô 4)' },
          { id: 'c', text: 'La — dây 1 ngăn 5 (nốt trắng ô 16)' },
          { id: 'd', text: 'Rê — dây 1 ngăn 10 (ô 18)' },
        ],
        hint: 'Vibrato làm đổi cao độ nhờ tay trái ép dây. Nốt nào không có ngón nào đang ép dây?',
      },
    },
    {
      kind: 'note',
      title: 'Nhịp 3 · Chọn kỹ thuật cho bài',
      text: 'Tìm những chỗ trong bài có thể thêm kỹ thuật, chọn một, đàn và thu video. Kết thúc nhịp: Bài trả 9.3 (video + giải thích).',
    },
    {
      kind: 'layers',
      title: 'Cùng một ô, hai cách đàn',
      lead: 'Ô 18 có Mi → Rê liền nhau trên dây 1 (ngăn 12 → ngăn 10). Có thể gảy từng nốt, hoặc gảy Mi rồi luyến xuống Rê bằng Pull-off. Cả hai đều đúng, nghe khác nhau.',
      layers: [
        { label: 'Cách 1', what: 'Gảy từng nốt — rõ ràng, tách bạch.', tex: bars([B18_PLAIN]) },
        { label: 'Cách 2', what: 'Gảy Mi, Pull-off xuống Rê — hai nốt dính liền, mềm hơn.', tex: bars([B18_PO]), current: true },
      ],
      note: 'Thầy chấm bạn nói được vì sao chọn, không chấm bạn chọn giống Thầy.',
    },
    {
      kind: 'repertoire',
      title: 'Những chỗ trong bài có thể thêm kỹ thuật',
      candidates: ['Con Đường Xưa em Đi — chọn một chỗ, tự quyết định kỹ thuật'],
      status: 'ready',
      pieces: [
        { title: 'Ô 7 — Mi → Fa (dây 1, buông → ngăn 1)', composer: 'Châu Kỳ & Hồ Đình Phương', note: 'Gợi ý: Hammer-on từ dây buông lên Fa. Hai nốt rất ngắn (nốt 16), luyến cho gọn.', barsPerRow: 1, tex: bars([B7_HAM]) },
        { title: 'Ô 8 — nốt Si dài 4 phách (dây 1 ngăn 7)', composer: 'Châu Kỳ & Hồ Đình Phương', note: 'Gợi ý: Vibrato. Nốt tròn bấm ở ngăn 7 — chỗ rung rõ nhất của đoạn đầu. (Nốt tròn ô 4 là Mi dây buông nên không rung được.)', barsPerRow: 1, tex: bars([B8_VIB]) },
        { title: 'Ô 9 — Sol♯ → La (dây 1, ngăn 4 → ngăn 5)', composer: 'Châu Kỳ & Hồ Đình Phương', note: 'Gợi ý: Slide một ngón từ ngăn 4 sang ngăn 5. Ô 9 nằm ngoài ô 1–8, nhưng gặp lại ở ô 34.', barsPerRow: 1, tex: bars([B9_SLIDE]) },
        { title: 'Ô 18 — Mi → Rê (dây 1, ngăn 12 → ngăn 10)', composer: 'Châu Kỳ & Hồ Đình Phương', note: 'Gợi ý: Pull-off từ Mi xuống Rê, hai ngón khác nhau (ngón 4 → ngón 2). Cả cụm ba nốt chùm ba vẫn phải đều.', barsPerRow: 1, tex: bars([B18_PO]) },
      ],
      annotationTypes: ['Kỹ thuật bạn chọn', 'Ô nhịp', 'Ngón tay trái', 'Lý do chọn', 'Ghi chú của giáo viên'],
    },
    {
      kind: 'checkpoint',
      id: '9.3',
      title: 'Bài trả 9.3 — Kỹ thuật tôi chọn',
      prompt: 'Chơi ô 1–8 Con Đường Xưa em Đi, thêm MỘT kỹ thuật (Hammer-on, Pull-off, Vibrato hoặc Slide) vào một chỗ bạn chọn. Không cần cả đoạn hoàn hảo. Viết ngắn: ‘Tôi chọn kỹ thuật … ở ô … vì…’. Tiêu chí Đạt: (1) cao độ và nhịp của melody đúng; (2) kỹ thuật nghe rõ, đúng bản chất; (3) giải thích có lý do âm nhạc.',
      required: true,
      accepts: ['video_link', 'text'],
    },
    {
      kind: 'study',
      tag: 'Phần 2',
      title: 'Phụ lục hiểu sâu — Melody và kỹ thuật',
      blocks: [
        { b: 'h', text: 'Melody là gì' },
        { b: 'p', text: 'Melody (giai điệu) là dòng nốt có cao độ và trường độ mà người nghe nhận ra như "câu hát". Trong Solo Guitar, melody thường nằm ở âm vực cao nhất của tiếng đàn; Bass và hợp âm nằm bên dưới. Các buổi sau thêm hai tầng đó dưới chính melody này.' },
        { b: 'h', text: 'Chùm ba (Triplet) trong bài' },
        { b: 'p', text: 'Nhiều ô chia một phách thành ba nốt đều nhau. Cảm giác "lắc nhẹ" ấy là một phần màu sắc của bài. Khi thêm kỹ thuật, đừng làm mất nhịp lắc đó: luyến hay trượt trong chùm ba phải giữ ba nốt đều.' },
        { b: 'h', text: 'Ký hiệu thường gặp trên bản nhạc và TAB' },
        { b: 'table', rows: [
          ['Kỹ thuật', 'Ký hiệu thường thấy', 'Ghi chú'],
          ['Hammer-on / Pull-off', 'Dấu luyến (nối cong) giữa hai nốt, có thể kèm chữ H / P trên TAB', 'Hai nốt khác cao độ, cùng một dây'],
          ['Slide', 'Gạch chéo giữa hai nốt', 'Một ngón, hai ngăn khác nhau, cùng một dây'],
          ['Vibrato', 'Đường lượn sóng phía trên nốt', 'Thường đặt trên nốt dài'],
          ['Bend', 'Mũi tên cong phía trên TAB, kèm số cung (½, 1…)', 'Có thể có Release (nhả về)'],
        ] },
        { b: 'callout', label: 'LƯU Ý CHUYÊN MÔN', text: 'Kỹ thuật là LỰA CHỌN diễn tấu. Cùng một melody, hai người chơi có thể chọn hai bộ kỹ thuật khác nhau và cả hai đều đúng. Chỉ cao độ và trường độ mới "đúng – sai" theo bản nhạc.' },
        { b: 'h', text: 'Vibrato' },
        { b: 'p', text: 'Có thể rung theo hướng song song với phím đàn hoặc vuông góc với phím đàn; người chơi chọn theo hợp thế tay. Quan trọng là rung ĐỀU và trở về đúng cao độ gốc.' },
        { b: 'h', text: 'Bend: hai điều dễ sai' },
        { b: 'ul', items: [
          'Một cung = hai ngăn; nửa cung = một ngăn. Bend "một cung" nâng cao độ bằng hai ngăn.',
          'Nên đàn nốt đích thật (ở ngăn khác) để tai nhớ cao độ trước khi tay đẩy dây.',
        ] },
        { b: 'callout', label: 'CẦN OWNER XEM LẠI', text: 'MusicXML không ghi kỹ thuật (luyến, trượt, rung, bend). Mọi chỗ gắn kỹ thuật trong buổi này (ô 7, 8, 9, 18) là gợi ý của giáo án, chưa phải bản phối đã xác nhận.' },
      ],
    },
    {
      kind: 'assignment',
      items: [
        { label: 'Bài 1.', text: 'Mỗi kỹ thuật ở bài tập riêng: 3 phút mỗi ngày, chậm, tiếng đều.' },
        { label: 'Bài 2.', text: 'Đàn ô 1–8 melody gốc (không kỹ thuật) cho sạch tiếng, tempo ♩ = 60.' },
        { label: 'Bài 3.', text: 'Thử cả bốn gợi ý ở các ô 7, 8, 9, 18 rồi chọn một; ghi "Tôi chọn kỹ thuật này vì…".' },
        { label: 'Bài 4.', text: 'Tìm thêm ít nhất một chỗ trong ô 10–41 có thể thêm kỹ thuật, đánh dấu và giải thích.' },
      ],
      message: 'Hai bạn cùng lớp có thể chọn hai kỹ thuật khác nhau cho cùng một chỗ. Hãy mang lý do đến lớp.',
    },
    {
      kind: 'checklist',
      items: [
        'Tôi đàn đúng cao độ và trường độ ô 1–8.',
        'Tôi phân biệt được Hammer-on, Pull-off, Slide, Vibrato, Bend.',
        'Tôi biết vì sao nốt dây buông không rung được.',
        'Tôi làm được ít nhất ba trong năm kỹ thuật cho sạch tiếng.',
        '⭐ Tôi nói được vì sao mình chọn kỹ thuật đó ở chỗ đó.',
      ],
    },
    { kind: 'studentNotes', title: 'Tôi chọn kỹ thuật này vì…', lines: 8 },
  ],
}
