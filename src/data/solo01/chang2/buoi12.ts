// ── SOLO-01 · CHẶNG 2 · BUỔI 4/8 — hệ thống đánh số là BUỔI 12 ──
// Chủ đề: Hợp âm bấm tắt — thế bấm rút gọn, ứng dụng Triad và Voicing.
// QUY ƯỚC GHI THẾ BẤM: sáu ký tự theo thứ tự dây 6 → 1; x = dây không chơi; 0 = dây buông; số = ngăn.
// Ví dụ Am x02210 (đầy đủ) · Am x0x555 (rút gọn: Bass La + Triad Am đảo 1 trên dây 3–2–1).
// ĐÃ KIỂM từng thế (cao độ thật): xem bảng ở khối study. Hợp âm của bài lấy từ MusicXML (Am, Dm, E, E7, F, G, C).
// "Hợp âm bấm tắt" KHÔNG đồng nghĩa với Triad — xem Nhịp 1.
import type { LessonDoc } from '../../../lesson/lessonTypes'

const one = (name: string, chord: string): string => `\\ts 4 4\n.\n(${chord}).1{ch "${name}"} |`

// alphaTex chord: ngăn.dây — các nốt đàn cùng lúc
const AM_FULL = one('Am x02210', '0.5 2.4 2.3 1.2 0.1')
const AM_TOP = one('Am xxx210', '2.3 1.2 0.1')
const AM_SHORT = one('Am x0x555', '0.5 5.3 5.2 5.1')
const AM_INV1 = one('Am xxx555', '5.3 5.2 5.1')
const AM_INV2 = one('Am xx221x', '2.4 2.3 1.2')

// Vòng Am – Dm – Am – E bằng thế rút gọn (Triad dây 3–2–1), mỗi ô một hợp âm
const PROG_SHORT = `\\ts 4 4
.
(2.3 1.2 0.1).2{ch "Am"} (2.3 1.2 0.1).2 |
(2.3 3.2 1.1).2{ch "Dm"} (2.3 3.2 1.1).2 |
(2.3 1.2 0.1).2{ch "Am"} (2.3 1.2 0.1).2 |
(1.3 0.2 0.1).2{ch "E"} (1.3 0.2 0.1).2 |`

export const SOLO01_BUOI12: LessonDoc = {
  meta: {
    programCode: 'SOLO-01',
    programName: 'SOLO GUITAR CĂN BẢN',
    sessionNo: 12,
    title: 'Chặng 2 – Buổi 4/8 · Hợp âm bấm tắt',
    stageLabel: 'Chặng 2 · Solo Bolero',
    backHref: '/solo01',
  },
  sections: [
    {
      kind: 'recap',
      title: 'Từ Buổi 3 sang Buổi 4',
      steps: [
        { label: 'Buổi 3 đã có', items: ['Ngón tay trái cho melody ở Vị trí I.', 'Biết nhìn trước và giữ ngón.'] },
        { label: 'Buổi 4 thêm', items: ['Tầng hợp âm — nhưng ở dạng RÚT GỌN để chen dưới melody.', 'Hiểu Triad, Voicing, Chord Inversion.'] },
      ],
      message: 'Chặng này đặt Bass dưới melody. Giờ ta cần thêm hợp âm — nhưng thế bấm đầy đủ 5–6 dây sẽ che mất melody. Cách giải: bấm tắt.',
    },
    {
      kind: 'objectives',
      title: 'Cuối buổi, bạn làm được',
      items: [
        'Nói đúng: hợp âm bấm tắt là cách bấm RÚT GỌN; Triad là cấu trúc 3 nốt — hai khái niệm khác nhau.',
        'Đọc được ký hiệu thế bấm sáu ký tự theo thứ tự dây 6 → 1.',
        'Nêu Root, 3rd, 5th (Chord Tone) của Am, Dm, E, F, G, C.',
        'Bấm được Triad ở ba trạng thái: Root Position, 1st Inversion, 2nd Inversion.',
        '⭐ QUAN TRỌNG NHẤT — Chọn thế rút gọn cho hợp âm của bài và nói được vì sao.',
      ],
    },
    // NHỊP HỌC (đề xuất): 12.1 trắc nghiệm → 12.2 trắc nghiệm → 12.3 video + chữ.
    {
      kind: 'note',
      title: 'Nhịp 1 · Bấm tắt là gì, Triad là gì',
      text: 'Phần 1 — Làm ngay: bấm và nghe ba cách bấm hợp âm Am. Kết thúc nhịp: Bài trả 12.1 (trắc nghiệm).',
    },
    {
      kind: 'layers',
      title: 'Phần 1 — Làm ngay: cùng một hợp âm Am, ba cách bấm',
      lead: 'Thế bấm viết sáu ký tự theo thứ tự dây 6 → 1; x là dây không chơi, 0 là dây buông. Sơ đồ hợp âm cho biết ngón ở đâu; TAB cho biết cao độ từng dây; hai thứ khác nhau.',
      layers: [
        { label: 'x02210', what: 'Thế ĐẦY ĐỦ: La – Mi – La – Đô – Mi (năm dây). Chắc tiếng nhưng dày, che melody ở dây 1–2.', tex: AM_FULL },
        { label: 'xxx210', what: 'Thế RÚT GỌN: chỉ ba dây cao, La – Đô – Mi = Triad Am (Root Position). Nhẹ, nằm gọn trên dây 3–2–1.', tex: AM_TOP },
        { label: 'x0x555', what: 'Thế RÚT GỌN có Bass: La dây 5 buông + Triad Am đảo 1 (Đô – Mi – La) ở ngăn 5 dây 3–2–1.', tex: AM_SHORT, current: true },
      ],
      note: 'Cả ba đều là hợp âm La thứ. Khác nhau ở số nốt, thứ tự nốt và độ dày — không khác ở tên.',
    },
    {
      kind: 'recap',
      title: 'Phân biệt rõ bốn khái niệm',
      steps: [
        { label: 'Triad', items: ['Cấu trúc ba nốt: Root – 3rd – 5th.', 'Am = La – Đô – Mi.'] },
        { label: 'Hợp âm bấm tắt', items: ['Cách BẤM rút gọn một hợp âm: bớt dây, bớt nốt trùng.', 'Có thể chứa Triad, nhưng có thể thêm Bass hoặc nhân đôi nốt.'] },
        { label: 'Chord Voicing', items: ['Cách SẮP XẾP các nốt của hợp âm (nốt nào ở dưới, nốt nào ở trên, nhân đôi nốt nào).', 'Partial Voicing: voicing bỏ bớt một số nốt.'] },
        { label: 'Chord Inversion', items: ['Thể đảo: nốt thấp nhất KHÔNG phải Root.', '1st Inversion: 3rd ở dưới. 2nd Inversion: 5th ở dưới.'] },
      ],
      message: 'Một thế như x0x555 vừa là hợp âm bấm tắt, vừa có Triad Am đảo 1 ở trên, vừa có Bass La — nên Bấm tắt ≠ Triad.',
    },
    {
      kind: 'checkpoint',
      id: '12.1',
      title: 'Bài trả 12.1 — Bấm tắt và Triad',
      required: true,
      accepts: ['quiz'],
      quiz: {
        mode: 'single',
        question: 'Phát biểu nào đúng nhất về "hợp âm bấm tắt" và "Triad"?',
        options: [
          { id: 'a', text: 'Hai khái niệm đồng nghĩa: bấm tắt chính là Triad.' },
          { id: 'b', text: 'Bấm tắt là cách bấm rút gọn; Triad là cấu trúc ba nốt Root–3rd–5th. Thế bấm tắt có thể chứa một Triad nhưng không đồng nhất với Triad.' },
          { id: 'c', text: 'Triad luôn có 6 nốt, bấm tắt chỉ có 2 nốt.' },
          { id: 'd', text: 'Bấm tắt chỉ dùng cho hợp âm thứ.' },
        ],
        hint: 'Một thế bấm tắt có thể gồm Bass cộng Triad, hoặc nhân đôi nốt. Triad chỉ nói về BA nốt Root, 3rd, 5th.',
      },
    },
    {
      kind: 'note',
      title: 'Nhịp 2 · Triad, thể đảo và bảng thế bấm của bài',
      text: 'Bấm Am ở ba trạng thái, rồi nhìn bảng thế rút gọn cho cả bảy hợp âm của bài. Kết thúc nhịp: Bài trả 12.2 (trắc nghiệm).',
    },
    {
      kind: 'layers',
      title: 'Triad Am ở ba trạng thái (Chord Inversion)',
      lead: 'Cùng ba nốt La – Đô – Mi, sắp xếp khác nhau. Nốt THẤP NHẤT quyết định trạng thái.',
      layers: [
        { label: 'Root Position', what: 'xxx210 — La thấp nhất (Root).', tex: AM_TOP },
        { label: '1st Inversion', what: 'xxx555 — Đô thấp nhất (3rd).', tex: AM_INV1 },
        { label: '2nd Inversion', what: 'xx221x — Mi thấp nhất (5th).', tex: AM_INV2, current: true },
      ],
      note: 'Cả ba cùng là Am. Chọn trạng thái nào là chọn nốt thấp nhất của hợp âm — liên quan trực tiếp tới Bass và melody ở Buổi 5–6.',
    },
    {
      kind: 'study',
      tag: 'Bảng',
      title: 'Thế bấm đầy đủ và thế rút gọn cho hợp âm của bài',
      blocks: [
        { b: 'p', text: 'Thứ tự sáu ký tự: dây 6 → dây 1. Chord Tone ghi theo tên nốt. Đã kiểm cao độ từng thế. Thế rút gọn dưới đây CHỈ là gợi ý (Partial Voicing); không có thế "duy nhất đúng".' },
        { b: 'table', rows: [
          ['Hợp âm', 'Đầy đủ', 'Nốt (dây 6→1)', 'Rút gọn', 'Nốt', 'Ghi chú'],
          ['Am', 'x02210', 'La Mi La Đô Mi', 'xxx210', 'La Đô Mi', 'Triad, Root Position'],
          ['Dm', 'xx0231', 'Rê La Rê Fa', 'xxx231', 'La Rê Fa', 'Triad, 2nd Inversion'],
          ['E', '022100', 'Mi Si Mi Sol♯ Si Mi', 'xxx100', 'Sol♯ Si Mi', 'Triad, 1st Inversion'],
          ['E7', '020100', 'Mi Si Rê Sol♯ Si Mi', 'xx2130', 'Mi Sol♯ Rê Mi', 'Root–3rd–7th, thiếu 5th (Shell Voicing)'],
          ['F', 'xx3211', 'Fa Đô Fa La', 'xxx211', 'La Đô Fa', 'Triad, 1st Inversion'],
          ['G', '320003', 'Sol Si Rê Sol Si Sol', 'xx000x', 'Rê Sol Si', 'Triad, 2nd Inversion (dây 4–3–2)'],
          ['C', 'x32010', 'Đô Mi Sol Đô Mi', 'xxx010', 'Sol Đô Mi', 'Triad, 2nd Inversion'],
        ] },
        { b: 'callout', label: 'CẦN OWNER XEM LẠI', text: 'Bảng chọn thế quen thuộc, kiểm đúng cao độ. Việc chọn thế nào cho bản phối Solo Bolero (và tên gọi Shell Voicing cho E7) là quyết định phối khí chờ Owner xác nhận. Ô 32 trong nguồn ghi hợp âm F nhưng giai điệu giống Am → E; giữ nguyên nguồn, cần rà soát.' },
      ],
    },
    {
      kind: 'score',
      subtitle: 'Thực hành',
      title: 'Vòng Am – Dm – Am – E bằng thế rút gọn',
      lead: 'Mỗi hợp âm bấm trên dây 3–2–1: xxx210 → xxx231 → xxx210 → xxx100. Hai lần gảy mỗi ô (nốt trắng). Chú ý ngón di chuyển rất ít giữa các thế.',
      tempo: 'Tempo: ♩ = 60',
      tex: PROG_SHORT,
      guidance: [
        'Gảy ba dây cùng lúc bằng p–i–m hoặc cả bàn tay; tiếng đều ba dây.',
        'Chuyển hợp âm: ngón nào có thể giữ nguyên? Nhìn xem Am → Dm → Am → E có nốt chung.',
        'Nghe: ba dây cao nghe sáng, mỏng. Vì nằm ở dây cao nên thế này hợp khi melody ĐANG Ở dây thấp hoặc đang nghỉ; khi melody ở dây 1–3, hợp âm phải dùng dây thấp hơn (Buổi 5–6).',
      ],
    },
    {
      kind: 'checkpoint',
      id: '12.2',
      title: 'Bài trả 12.2 — Triad và thể đảo',
      required: true,
      accepts: ['quiz'],
      quiz: {
        mode: 'single',
        question: 'Thế xxx555 (dây 3, 2, 1 cùng ở ngăn 5) tạo ra các nốt Đô – Mi – La. Đây là hợp âm nào, ở trạng thái nào?',
        options: [
          { id: 'a', text: 'Am, Root Position' },
          { id: 'b', text: 'Am, 1st Inversion (Đô — 3rd — thấp nhất)' },
          { id: 'c', text: 'C, Root Position' },
          { id: 'd', text: 'Am, 2nd Inversion' },
        ],
        hint: 'Gọi tên hợp âm từ ba nốt Đô, Mi, La, rồi xem nốt nào thấp nhất: Đô là Root, 3rd hay 5th của hợp âm đó?',
      },
    },
    {
      kind: 'note',
      title: 'Nhịp 3 · Chọn thế rút gọn cho bài',
      text: 'Chọn thế rút gọn cho các hợp âm và đàn một vòng hợp âm. Kết thúc nhịp: Bài trả 12.3 (video + giải thích).',
    },
    {
      kind: 'repertoire',
      title: 'Phần thực hành — vòng hợp âm của bài',
      candidates: ['Con Đường Xưa em Đi — vòng Am – Dm – Am – E (ô 2–8)'],
      status: 'ready',
      pieces: [
        {
          title: 'Vòng hợp âm ô 2–4 và ô 6–8 bằng thế rút gọn',
          composer: 'Châu Kỳ & Hồ Đình Phương · hợp âm theo MusicXML',
          note: 'Hợp âm của ô 2–8 theo MusicXML: Am · Dm · Am · (Am) · Dm · Am · E. Bạn đàn vòng hợp âm bằng thế rút gọn; có thể đổi thế nếu bạn thấy hợp hơn.',
          barsPerRow: 2,
          tex: PROG_SHORT,
          guidance: [
            '1. Chọn thế rút gọn cho từng hợp âm (bảng ở trên).',
            '2. Đàn từng hợp âm, nghe có đủ ba nốt Root–3rd–5th (hoặc nốt bạn chủ ý bỏ).',
            '3. Đàn cả vòng, chú ý ngón di chuyển ít nhất.',
            '4. Ghi lại: "Tôi chọn thế này vì…"',
          ],
        },
      ],
      annotationTypes: ['Thế bấm (6 → 1)', 'Triad / thể đảo', 'Nốt bỏ', 'Lý do chọn', 'Ghi chú của giáo viên'],
    },
    {
      kind: 'checkpoint',
      id: '12.3',
      title: 'Bài trả 12.3 — Thế rút gọn của tôi',
      prompt: 'Chơi vòng Am – Dm – Am – E (mỗi hợp âm một ô, 2 lần gảy/ô) bằng thế rút gọn bạn chọn. Viết ngắn: ‘Tôi chọn thế … cho hợp âm … vì…’, kèm ký hiệu thế bấm sáu ký tự dây 6 → 1. Tiêu chí Đạt: (1) tiếng ba dây đều, không dây câm ngoài ý định; (2) thế bấm đúng hợp âm (nêu đúng nốt Root/3rd/5th); (3) ký hiệu thế viết đúng quy ước 6 → 1 và giải thích có lý do.',
      required: true,
      accepts: ['video_link', 'text'],
    },
    {
      kind: 'study',
      tag: 'Phần 2',
      title: 'Phụ lục hiểu sâu — Triad và Voicing',
      blocks: [
        { b: 'h', text: 'Cấu tạo Triad' },
        { b: 'p', text: 'Triad thứ gồm Root, quãng 3 thứ (3rd), quãng 5 đúng (5th). Am: La – Đô – Mi. Triad trưởng: quãng 3 trưởng, ví dụ E: Mi – Sol♯ – Si. Hợp âm của bài đều là Triad (Am, Dm, E, F, G, C) hoặc Triad cộng quãng 7 (E7).' },
        { b: 'h', text: 'Chord Tone ≠ nốt trong thế bấm' },
        { b: 'p', text: 'Thế đầy đủ nhiều khi nhân đôi nốt (x02210 có hai La, hai Mi). Rút gọn là bỏ bớt nốt trùng, chỉ giữ nốt mang tính hợp âm. Hợp âm vẫn nghe là Am khi còn La, Đô, Mi, dù chỉ ba dây.' },
        { b: 'h', text: 'Thứ nào quan trọng để nghe ra hợp âm' },
        { b: 'p', text: '3rd quyết định màu thứ / trưởng. 5th thường bỏ được mà hợp âm vẫn rõ. Root có thể để cho Bass đảm nhiệm. Đó là cơ sở của thế rút gọn: bớt cái ít ảnh hưởng, giữ cái quyết định màu.' },
        { b: 'callout', label: 'LƯU Ý CHUYÊN MÔN', text: 'Nguyên tắc hòa âm: hợp âm cần đủ Chord Tone quyết định màu (thường là Root và 3rd). Lựa chọn phối khí: giữ nốt nào, bỏ nốt nào, đặt Triad ở thể đảo nào. Cùng một hợp âm có nhiều thế đúng.' },
        { b: 'h', text: 'Sơ đồ, thế bấm và TAB' },
        { b: 'ul', items: [
          'Sơ đồ hợp âm (chord diagram): hình cần đàn với chấm ngón.',
          'Thế bấm sáu ký tự: ký hiệu chữ-số theo thứ tự dây 6 → 1, ví dụ Am x02210.',
          'TAB: sáu dòng dây, số là ngăn, đọc theo thời gian — dùng cho cả nốt đơn lẫn hợp âm.',
        ] },
      ],
    },
    {
      kind: 'assignment',
      items: [
        { label: 'Bài 1.', text: 'Am ở ba trạng thái (xxx210, xxx555, xx221x): đàn, nghe, nói tên trạng thái.' },
        { label: 'Bài 2.', text: 'Đàn thế rút gọn của cả bảy hợp âm trong bảng, từng hợp âm một.' },
        { label: 'Bài 3.', text: 'Đàn vòng Am – Dm – Am – E bằng thế rút gọn bạn chọn, ghi ký hiệu 6 → 1.' },
        { label: 'Bài 4.', text: 'Viết ra nốt Root, 3rd, 5th của F, G, C và xác nhận thế rút gọn trong bảng có đủ nốt nào.' },
      ],
      message: 'Thế rút gọn của bạn có thể khác bạn bên cạnh. Mang ký hiệu 6 → 1 và lý do đến lớp.',
    },
    {
      kind: 'checklist',
      items: [
        'Tôi nói được hợp âm bấm tắt khác Triad ở đâu.',
        'Tôi đọc và viết được thế bấm sáu ký tự theo thứ tự dây 6 → 1.',
        'Tôi nêu được Root, 3rd, 5th của các hợp âm trong bài.',
        'Tôi bấm được Triad Am ở ba trạng thái.',
        '⭐ Tôi nói được vì sao mình chọn thế rút gọn đó.',
      ],
    },
    { kind: 'studentNotes', title: 'Tôi chọn thế bấm này vì…', lines: 8 },
  ],
}
