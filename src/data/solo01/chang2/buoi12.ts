// ── SOLO-01 · CHẶNG 2 · BUỔI 4/8 — hệ thống đánh số là BUỔI 12 ──
// Chủ đề: Hợp âm bấm tắt — thế bấm rút gọn, ứng dụng Triad và Voicing.
// QUY ƯỚC GHI THẾ BẤM: sáu ký tự theo thứ tự dây 6 → 1; x = dây không chơi; 0 = dây buông; số = ngăn (thế có ngăn ≥ 10 không dùng ở đây).
// BẢN PHỐI QUÃNG 8 CAO: hợp âm là thế 2–3 nốt ở NGĂN 3–8, dây 4–3–2 (hoặc dây 4–3), nằm ngay dưới melody ở dây 1–2. Thế mở ở ngăn đầu KHÔNG phải nội dung chính.
// Thế lấy từ works.ts (TRIAD, DYAD) — đã kiểm cao độ thật, nốt thuộc hợp âm, độ giãn ≤ 4 ngăn, mỗi nốt một ngón. Hợp âm của bài lấy từ MusicXML (Am, Dm, E, E7, F, G, C).
// Chỉ gọi là Triad khi đủ Root–3rd–5th. E7 (3rd–7th–Root) là Partial Voicing thiếu 5th; thế hai nốt là Dyad. "Hợp âm bấm tắt" KHÔNG đồng nghĩa với Triad — xem Nhịp 1.
import type { LessonDoc } from '../../../lesson/lessonTypes'
import { TRIAD, DYAD } from './works'

const one = (name: string, chord: string): string => `\\ts 4 4\n.\n(${chord}).1{ch "${name}"} |`

// alphaTex chord: ngăn.dây — các nốt đàn cùng lúc
const AM_FULL = one('Am x07555', '0.5 7.4 5.3 5.2 5.1')   // La2 La3 Đô4 Mi4 La4
const AM_TRIAD = one(`Am ${TRIAD.Am.code}`, TRIAD.Am.tex)    // La3 Đô4 Mi4
const AM_BASS = one('Am x0755x', `0.5 ${TRIAD.Am.tex}`)    // Bass La2 + Triad
// Ba trạng thái của Triad E (cùng ba nốt Mi – Sol♯ – Si), đều trong ngăn 4–9
const E_ROOT = one('E x764xx', '7.5 6.4 4.3')
const E_INV1 = one(`E ${TRIAD.E.code}`, TRIAD.E.tex)
const E_INV2 = one('E xx999x', '9.4 9.3 9.2')

// Vòng Am – Dm – Am – E bằng Triad ngăn cao (dây 4–3–2), mỗi ô một hợp âm
const PROG_SHORT = `\\ts 4 4
.
(${TRIAD.Am.tex}).2{ch "Am"} (${TRIAD.Am.tex}).2 |
(${TRIAD.Dm.tex}).2{ch "Dm"} (${TRIAD.Dm.tex}).2 |
(${TRIAD.Am.tex}).2{ch "Am"} (${TRIAD.Am.tex}).2 |
(${TRIAD.E.tex}).2{ch "E"} (${TRIAD.E.tex}).2 |`

const SHAPE_ROWS = ['Am', 'Dm', 'E', 'E7', 'F', 'G', 'C'].map(c => [
  c, TRIAD[c].code, TRIAD[c].notes.join(' '), TRIAD[c].kind, DYAD[c].code, `${DYAD[c].notes.join(' ')} (${DYAD[c].kind.replace('Dyad · ', '')})`,
])

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
        { label: 'Buổi 3 đã có', items: ['Ngón tay trái cho melody qua nhiều Vị trí.', 'Biết nhìn trước, giữ ngón và đổi vị trí.'] },
        { label: 'Buổi 4 thêm', items: ['Tầng hợp âm — dạng RÚT GỌN 2–3 nốt, ở NGĂN CAO trên dây 4–2, ngay dưới melody.', 'Hiểu Triad, Voicing, Chord Inversion.'] },
      ],
      message: 'Melody đã lên dây 1–2 ở ngăn cao; Bass ở dây 6–5. Dây 4–2 còn trống cho hợp âm. Thế mở 5–6 dây ở ngăn đầu vừa nặng vừa nằm xa vị trí tay của melody, nên ta bấm tắt: 2–3 nốt, ở ngăn 3–8, gần melody.',
    },
    {
      kind: 'objectives',
      title: 'Cuối buổi, bạn làm được',
      items: [
        'Nói đúng: hợp âm bấm tắt là cách bấm RÚT GỌN; Triad là cấu trúc 3 nốt — hai khái niệm khác nhau.',
        'Đọc được ký hiệu thế bấm sáu ký tự theo thứ tự dây 6 → 1.',
        'Nêu Root, 3rd, 5th (Chord Tone) của Am, Dm, E, F, G, C.',
        'Bấm được Triad ở ba trạng thái: Root Position, 1st Inversion, 2nd Inversion (ví dụ hợp âm E).',
        '⭐ QUAN TRỌNG NHẤT — Chọn thế rút gọn cho hợp âm của bài và nói được vì sao.',
      ],
    },
    // NHỊP HỌC (đề xuất): 12.1 trắc nghiệm → 12.2 trắc nghiệm → 12.3 video + chữ.
    {
      kind: 'note',
      title: 'Nhịp 1 · Bấm tắt là gì, Triad là gì',
      text: 'Phần 1 — Làm ngay: bấm và nghe ba cách bấm hợp âm Am ở ngăn cao. Kết thúc nhịp: Bài trả 12.1 (trắc nghiệm).',
    },
    {
      kind: 'layers',
      title: 'Phần 1 — Làm ngay: cùng một hợp âm Am, ba cách bấm ở ngăn cao',
      lead: 'Thế bấm viết sáu ký tự theo thứ tự dây 6 → 1; x là dây không chơi, 0 là dây buông, số là ngăn. Sơ đồ hợp âm cho biết ngón ở đâu; TAB cho biết cao độ từng dây; hai thứ khác nhau.',
      layers: [
        { label: 'x07555', what: 'Thế ĐẦY ĐỦ ở ngăn cao: La – La – Đô – Mi – La (năm dây, nhân đôi La). Chắc tiếng nhưng dày; dây 1 là chỗ của melody.', tex: AM_FULL },
        { label: 'xx755x', what: 'Thế RÚT GỌN: Triad Am (Root Position) La – Đô – Mi trên dây 4–3–2, ngăn 5–7. Nhẹ, nằm ngay dưới melody.', tex: AM_TRIAD, current: true },
        { label: 'x0755x', what: 'Thế RÚT GỌN có Bass: La dây 5 buông + Triad xx755x — bốn nốt: một Bass và một Triad.', tex: AM_BASS },
      ],
      note: 'Cả ba đều là hợp âm La thứ. Khác nhau ở số nốt, thứ tự nốt và độ dày — không khác ở tên. Thế mở ở ngăn đầu (như Am x02210) vẫn đúng, nhưng không phải nội dung chính ở đây vì nằm xa vị trí tay của melody.',
    },
    {
      kind: 'recap',
      title: 'Phân biệt rõ bốn khái niệm',
      steps: [
        { label: 'Triad', items: ['Cấu trúc ba nốt: Root – 3rd – 5th.', 'Am = La – Đô – Mi.'] },
        { label: 'Hợp âm bấm tắt', items: ['Cách BẤM rút gọn một hợp âm: bớt dây, bớt nốt trùng.', 'Có thể chứa Triad, nhưng có thể thêm Bass hoặc nhân đôi nốt.'] },
        { label: 'Dyad (thế hai nốt)', items: ['Chỉ HAI nốt của hợp âm (vd. La – Đô).', 'KHÔNG phải hợp âm đầy đủ: tên hợp âm do Bass quyết định — La – Đô với Bass La là Am, với Bass Fa là F.'] },
        { label: 'Chord Voicing', items: ['Cách SẮP XẾP các nốt của hợp âm (nốt nào ở dưới, nốt nào ở trên, nhân đôi nốt nào).', 'Partial Voicing: voicing bỏ bớt một số nốt.'] },
        { label: 'Chord Inversion', items: ['Thể đảo: nốt thấp nhất KHÔNG phải Root.', '1st Inversion: 3rd ở dưới. 2nd Inversion: 5th ở dưới.'] },
      ],
      message: 'Một thế như x0755x vừa là hợp âm bấm tắt, vừa có Triad Am ở trên, vừa có Bass La — nên Bấm tắt ≠ Triad. Và một thế hai nốt chưa phải hợp âm đầy đủ.',
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
      text: 'Bấm hợp âm E ở ba trạng thái, rồi nhìn bảng thế rút gọn cho cả bảy hợp âm của bài. Kết thúc nhịp: Bài trả 12.2 (trắc nghiệm).',
    },
    {
      kind: 'layers',
      title: 'Triad E ở ba trạng thái (Chord Inversion)',
      lead: 'Cùng ba nốt Mi – Sol♯ – Si, sắp xếp khác nhau. Nốt THẤP NHẤT quyết định trạng thái. Cả ba nằm trong ngăn 4–9.',
      layers: [
        { label: 'Root Position', what: 'x764xx — Mi thấp nhất (Root), dây 5–4–3.', tex: E_ROOT },
        { label: '1st Inversion', what: 'xx645x — Sol♯ thấp nhất (3rd), dây 4–3–2.', tex: E_INV1, current: true },
        { label: '2nd Inversion', what: 'xx999x — Si thấp nhất (5th), dây 4–3–2: một ngón ép ba dây.', tex: E_INV2 },
      ],
      note: 'Cả ba cùng là E. Chọn trạng thái nào là chọn nốt thấp nhất của hợp âm — liên quan trực tiếp tới Bass và melody ở Buổi 5–6.',
    },
    {
      kind: 'study',
      tag: 'Bảng',
      title: 'Thế bấm đầy đủ và thế rút gọn cho hợp âm của bài',
      blocks: [
        { b: 'p', text: 'Thứ tự sáu ký tự: dây 6 → dây 1. Mọi thế nằm ở ngăn 2–8, dây 4–2 (thế 3 nốt) hoặc dây 4–3 (Dyad), ngay dưới melody. Đã kiểm cao độ từng thế và khả năng bấm (độ giãn ≤ 4 ngăn, mỗi nốt một ngón). Chỉ gọi là Triad khi đủ Root – 3rd – 5th; E7 là Partial Voicing thiếu 5th; thế hai nốt là Dyad. Đây là gợi ý (Partial Voicing); không có thế "duy nhất đúng".' },
        { b: 'table', rows: [
          ['Hợp âm', 'Thế 3 nốt', 'Nốt (thấp → cao)', 'Loại', 'Thế 2 nốt', 'Nốt'],
          ...SHAPE_ROWS,
        ] },
        { b: 'callout', label: 'ĐIỀU NÊN BIẾT', text: 'Hai nốt La – Đô (xx75xx) là Am khi Bass đàn La, nhưng là F khi Bass đàn Fa. Dyad chưa đủ để gọi tên hợp âm — Bass quyết định. Vì thế khi bấm Dyad hãy nói "thế hai nốt của Am", không nói "hợp âm Am đầy đủ".' },
        { b: 'callout', label: 'CẦN OWNER XEM LẠI', text: 'Bảng thế được chọn theo tiêu chí: ngăn cao 2–8, dây 4–2, 2–3 nốt, bấm được trên đàn thật. Việc chọn thế nào cho bản phối Solo Bolero (và tên gọi Partial Voicing cho E7) là quyết định phối khí chờ Owner xác nhận. Ô 32 trong nguồn ghi hợp âm F nhưng giai điệu giống Am → E; giữ nguyên nguồn, cần rà soát.' },
      ],
    },
    {
      kind: 'score',
      subtitle: 'Thực hành',
      title: 'Vòng Am – Dm – Am – E bằng Triad ngăn cao',
      lead: 'Mỗi hợp âm bấm trên dây 4–3–2: xx755x → xx776x → xx755x → xx645x. Hai lần gảy mỗi ô (nốt trắng). Chú ý ngón di chuyển rất ít giữa các thế.',
      tempo: 'Tempo: ♩ = 60',
      tex: PROG_SHORT,
      guidance: [
        'Gảy ba dây 4–3–2 cùng lúc bằng i–m–a (i ở dây 4, m ở dây 3, a ở dây 2); tiếng đều ba dây.',
        'Chuyển hợp âm: ngón nào có thể giữ nguyên? Am → Dm → Am đều có La dây 4 ngăn 7 (ngón 3 giữ nguyên làm Guide Finger).',
        'Nghe: ba dây giữa nghe đầy và ấm. Vì nằm dưới dây 1–2 nên hợp khi melody ở dây 1; khi melody xuống dây 2 (Đô, Rê thấp), dùng thế hai nốt trên dây 4–3 (Dyad) — Buổi 5–6 sẽ ghép.',
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
        question: 'Thế xx645x (dây 4, 3, 2) tạo ra các nốt Sol♯ – Si – Mi. Đây là hợp âm nào, ở trạng thái nào?',
        options: [
          { id: 'a', text: 'E, Root Position' },
          { id: 'b', text: 'E, 1st Inversion (Sol♯ — 3rd — thấp nhất)' },
          { id: 'c', text: 'G♯m, Root Position' },
          { id: 'd', text: 'E, 2nd Inversion' },
        ],
        hint: 'Gọi tên hợp âm từ ba nốt Sol♯, Si, Mi (Triad trưởng), rồi xem nốt nào thấp nhất: Sol♯ là Root, 3rd hay 5th của hợp âm đó?',
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
        { b: 'p', text: 'Thế đầy đủ nhiều khi nhân đôi nốt (x07555 có ba nốt La). Rút gọn là bỏ bớt nốt trùng, chỉ giữ nốt mang tính hợp âm. Hợp âm vẫn nghe là Am khi còn La, Đô, Mi, dù chỉ ba dây.' },
        { b: 'h', text: 'Vì sao hợp âm ở ngăn cao, 2–3 nốt' },
        { b: 'p', text: 'Ba lý do: (1) gần vị trí tay của melody (ngăn 5–8 trên dây 1), nên tay trái ít phải dịch khi ghép tầng; (2) nằm dưới melody nên melody vẫn là nốt cao nhất; (3) ít nốt thì Bass còn rõ và melody không bị che. Thế mở đầy đủ ở ngăn đầu vẫn đúng và quen thuộc, nhưng nặng và xa vị trí tay của melody.' },
        { b: 'h', text: 'Thứ nào quan trọng để nghe ra hợp âm' },
        { b: 'p', text: '3rd quyết định màu thứ / trưởng. 5th thường bỏ được mà hợp âm vẫn rõ. Root có thể để cho Bass đảm nhiệm. Đó là cơ sở của thế rút gọn: bớt cái ít ảnh hưởng, giữ cái quyết định màu.' },
        { b: 'callout', label: 'LƯU Ý CHUYÊN MÔN', text: 'Nguyên tắc hòa âm: hợp âm cần đủ Chord Tone quyết định màu (thường là Root và 3rd). Lựa chọn phối khí: giữ nốt nào, bỏ nốt nào, đặt Triad ở thể đảo nào. Cùng một hợp âm có nhiều thế đúng.' },
        { b: 'h', text: 'Sơ đồ, thế bấm và TAB' },
        { b: 'ul', items: [
          'Sơ đồ hợp âm (chord diagram): hình cần đàn với chấm ngón.',
          'Thế bấm sáu ký tự: ký hiệu chữ-số theo thứ tự dây 6 → 1, ví dụ Am x07555.',
          'TAB: sáu dòng dây, số là ngăn, đọc theo thời gian — dùng cho cả nốt đơn lẫn hợp âm.',
        ] },
      ],
    },
    {
      kind: 'assignment',
      items: [
        { label: 'Bài 1.', text: 'E ở ba trạng thái (x764xx, xx645x, xx999x): đàn, nghe, nói tên trạng thái.' },
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
        'Tôi bấm được Triad E ở ba trạng thái.',
        '⭐ Tôi nói được vì sao mình chọn thế rút gọn đó.',
      ],
    },
    { kind: 'studentNotes', title: 'Tôi chọn thế bấm này vì…', lines: 8 },
  ],
}
