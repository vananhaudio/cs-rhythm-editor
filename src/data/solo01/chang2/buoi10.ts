// ── SOLO-01 · CHẶNG 2 · BUỔI 2/8 — hệ thống đánh số là BUỔI 10 ──
// Chủ đề: Bass — xác định nốt Bass, chọn vị trí Bass phù hợp với giai điệu và hòa âm.
// Nguồn nhạc: MusicXML "Con Đường Xưa em Đi" (CHỈ có melody + tên hợp âm, KHÔNG có Bass). Mọi nốt Bass ở đây do GIÁO ÁN suy từ tên hợp âm
// (nốt gốc / quãng 5) và kiểm với nốt thấp nhất của melody — là VÍ DỤ MINH HOẠ NGUYÊN TẮC, KHÔNG phải bản phối đã xác nhận.
// alphaTex: dây 1 = e cao … dây 6 = E trầm; ghi "ngăn.dây" (vd 0.5 = dây 5 buông = La2).
import type { LessonDoc, FretDot, FretZone } from '../../../lesson/lessonTypes'
import { cdxFingered } from './works'

const bars = (list: string[]): string => '\\ts 4 4\n.\n' + list.join('\n')

// Khung bass GỐC cho ô 2–8 (mỗi ô một nốt tròn). Lưu ý ô 3 và 6: Rê dây 4 buông CAO HƠN nốt thấp nhất của melody.
const SK_ROOT = bars([
  '0.5{ch "Am"}.1 |', '0.4{ch "Dm"}.1 |', '0.5{ch "Am"}.1 |', '0.5.1 |', '0.4{ch "Dm"}.1 |', '0.5{ch "Am"}.1 |', '0.6{ch "E"}.1 |',
])
// Khung đã chỉnh để mọi nốt Bass nằm DƯỚI nốt thấp nhất của melody trong ô.
const SK_BELOW = bars([
  '0.5{ch "Am"}.1 |', '0.5{ch "Dm/A"}.1 |', '0.5{ch "Am"}.1 |', '0.6{ch "Am/E"}.1 |', '0.5{ch "Dm/A"}.1 |', '0.5{ch "Am"}.1 |', '0.6{ch "E"}.1 |',
])

const ZONES: FretZone[] = [
  { no: 1, label: 'Bass dây buông', tag: '', fromFret: 0, toFret: 0, strings: [1, 6], color: '#4338CA', hidden: true, hint: 'E · A · D buông.' },
  { no: 2, label: 'Bass phải bấm', tag: '', fromFret: 1, toFret: 3, strings: [1, 6], color: '#A85F0E', hidden: true, hint: 'F · G · B · C.' },
]
const d = (string: number, fret: number, name: string, nameVi: string, zone: number, root = false): FretDot => ({ string, fret, name, nameVi, zone, root })
const BASS_DOTS: FretDot[] = [
  d(6, 0, 'E', 'Mi', 1, true), d(6, 1, 'F', 'Fa', 2), d(6, 3, 'G', 'Sol', 2),
  d(5, 0, 'A', 'La', 1, true), d(5, 2, 'B', 'Si', 2), d(5, 3, 'C', 'Đô', 2),
  d(4, 0, 'D', 'Rê', 1, true), d(4, 3, 'F', 'Fa', 2),
]

export const SOLO01_BUOI10: LessonDoc = {
  meta: {
    programCode: 'SOLO-01',
    programName: 'SOLO GUITAR CĂN BẢN',
    sessionNo: 10,
    title: 'Chặng 2 – Buổi 2/8 · Bass',
    stageLabel: 'Chặng 2 · Solo Bolero',
    backHref: '/solo01',
  },
  sections: [
    {
      kind: 'recap',
      title: 'Từ Buổi 1 sang Buổi 2',
      steps: [
        { label: 'Buổi 1 đã có', items: ['Melody ô 1–8 sạch tiếng.', 'Năm kỹ thuật: Hammer-on, Pull-off, Vibrato, Slide, Bend.'] },
        { label: 'Buổi 2 thêm', items: ['Tầng Bass nằm DƯỚI melody.', 'Chọn nốt Bass theo hợp âm và theo âm vực của melody.'] },
      ],
      message: 'Vẫn Con Đường Xưa em Đi. Nguồn nhạc cho bạn melody và tên hợp âm; phần Bass chưa có — buổi này bạn học cách tự xác định và tự chọn.',
    },
    {
      kind: 'objectives',
      title: 'Cuối buổi, bạn làm được',
      items: [
        'Phân biệt Root Note (nốt gốc của hợp âm) và Bass Note (nốt thấp nhất đang vang).',
        'Biết vị trí các nốt Bass trên ba dây trầm (dây 6, 5, 4).',
        'Kiểm được nốt Bass có nằm DƯỚI nốt thấp nhất của melody trong ô hay không.',
        'Biết cách xử lý khi nốt gốc trùng hoặc cao hơn melody.',
        '⭐ QUAN TRỌNG NHẤT — Tự chọn Bass cho ô 2–8 và nói được vì sao.',
      ],
    },
    // NHỊP HỌC (đề xuất): 10.1 trắc nghiệm → 10.2 trắc nghiệm → 10.3 video + chữ.
    {
      kind: 'note',
      title: 'Nhịp 1 · Nốt gốc, Bass Note và bản đồ Bass',
      text: 'Phần 1 — Làm ngay: tìm đủ các nốt Bass trên ba dây trầm, rồi đàn khung Bass gốc cho ô 2–8. Kết thúc nhịp: Bài trả 10.1 (trắc nghiệm).',
    },
    {
      kind: 'fretboard',
      title: 'Phần 1 — Nốt Bass trên ba dây trầm',
      lead: 'Dây 6 (E), dây 5 (A), dây 4 (D), bốn ngăn đầu. Chấm đậm là nốt dây buông. Nốt thấp nhất bạn đàn được trên guitar chuẩn là Mi dây 6 buông (E2).',
      frets: 5,
      zones: ZONES,
      dots: BASS_DOTS,
      legend: ['E · A · D buông: bass dễ nhất, vang nhất', 'F (dây 6 ngăn 1) · G (dây 6 ngăn 3): bass cho hợp âm F, G', 'B (dây 5 ngăn 2) · C (dây 5 ngăn 3): bass cho hợp âm E7/E (quãng 5) và C'],
    },
    {
      kind: 'recap',
      title: 'Root Note và Bass Note',
      steps: [
        { label: 'Root Note', items: ['Nốt gốc: nốt đặt TÊN cho hợp âm.', 'Am → La · Dm → Rê · E → Mi · F → Fa · G → Sol · C → Đô.'] },
        { label: 'Bass Note', items: ['Nốt THẤP NHẤT đang vang.', 'Thường là Root Note, nhưng có thể là nốt khác của hợp âm.'] },
        { label: 'Ký hiệu', items: ['Am/E đọc "Am trên Mi": hợp âm Am, nốt Bass là Mi.', 'Khi Bass Note ≠ Root Note gọi là Chord Inversion (thể đảo) hoặc hợp âm có bass khác gốc.'] },
      ],
      message: 'Mọi hợp âm của bài (Am, Dm, E, E7, F, G, C) đều có nốt gốc nằm được trên ba dây trầm — nhưng "nằm được" chưa có nghĩa là "nên đàn" trong ô đó. Tiếp theo bạn sẽ thấy vì sao.',
    },
    {
      kind: 'score',
      subtitle: 'Phần 1 — Làm ngay',
      title: 'Khung Bass gốc, ô 2–8 (mỗi ô một nốt tròn)',
      lead: 'Chỉ ngón cái p. Nốt gốc theo đúng tên hợp âm trong MusicXML (ô 5 giữ hợp âm Am của ô 4). Đây là bản khung để nghe nền hòa âm, CHƯA ghép với melody.',
      tempo: 'Tempo: ♩ = 60',
      tex: SK_ROOT,
      guidance: [
        'Ô 2, 4, 5, 7: La dây 5 buông. Ô 3, 6: Rê dây 4 buông. Ô 8: Mi dây 6 buông.',
        'Đàn đều, mỗi nốt vang trọn 4 phách; nghe nền hòa âm đổi Am → Dm → Am → E.',
        '⚠️ Ô 3 và 6: Rê dây 4 buông (D3) CAO HƠN nốt thấp nhất của melody trong ô (Đô, dây 5 ngăn 3). Nhịp 2 sẽ xử lý chỗ này.',
      ],
    },
    {
      kind: 'checkpoint',
      id: '10.1',
      title: 'Bài trả 10.1 — Root Note và Bass Note',
      required: true,
      accepts: ['quiz'],
      quiz: {
        mode: 'single',
        question: 'Ký hiệu Am/E cho biết điều gì?',
        options: [
          { id: 'a', text: 'Hợp âm Am, với Mi là nốt thấp nhất (Bass Note)' },
          { id: 'b', text: 'Hợp âm E, với La là nốt thấp nhất' },
          { id: 'c', text: 'Đàn hợp âm Am rồi đàn hợp âm E' },
          { id: 'd', text: 'Hợp âm Am nhưng bỏ nốt Mi' },
        ],
        hint: 'Phần đứng TRƯỚC dấu gạch chéo là hợp âm; phần đứng SAU là nốt thấp nhất.',
      },
    },
    {
      kind: 'note',
      title: 'Nhịp 2 · Bass phải nằm dưới melody',
      text: 'Kiểm từng ô: nốt Bass có thấp hơn nốt thấp nhất của melody không? Kết thúc nhịp: Bài trả 10.2 (trắc nghiệm).',
    },
    {
      kind: 'score',
      subtitle: 'Cùng đoạn, đối chiếu',
      title: 'Melody ô 2–8 (để so với khung Bass)',
      lead: 'Nốt thấp nhất của melody trong từng ô: ô 2 Mi (dây 4 ngăn 2) · ô 3 Đô (dây 5 ngăn 3) · ô 4 Mi · ô 5 La (dây 5 buông) · ô 6 Đô (dây 5 ngăn 3) · ô 7 Mi · ô 8 Si (dây 2 buông).',
      tempo: 'Tempo: ♩ = 60',
      tex: cdxFingered(2, 8),
      guidance: [
        'Bass phải THẤP HƠN nốt thấp nhất của melody trong ô, nếu không melody không còn là nốt cao nhất và nghe "chìm".',
        'Bass trùng cao độ với nốt melody thì hai nốt hòa làm một — nghe mất một tầng.',
      ],
    },
    {
      kind: 'recap',
      title: 'Bảng kiểm Bass cho ô 2–8',
      steps: [
        { label: 'Ô 2, 4, 7 · Am', items: ['Melody thấp nhất: Mi (dây 4 ngăn 2).', 'La dây 5 buông nằm dưới → DÙNG ĐƯỢC nốt gốc.'] },
        { label: 'Ô 3, 6 · Dm', items: ['Melody thấp nhất: Đô (dây 5 ngăn 3).', 'Rê dây 4 buông nằm TRÊN Đô → KHÔNG hợp.', 'Đổi: La dây 5 buông (Dm/A, quãng 5) hoặc Fa dây 6 ngăn 1 (Dm/F, quãng 3).'] },
        { label: 'Ô 5 · Am (tiếp)', items: ['Melody thấp nhất: chính La dây 5 buông → bass gốc TRÙNG nốt melody.', 'Đổi: Mi dây 6 buông (Am/E, quãng 5).'] },
        { label: 'Ô 8 · E', items: ['Melody: Si dây 2 buông.', 'Mi dây 6 buông nằm dưới nhiều quãng → DÙNG ĐƯỢC nốt gốc.'] },
      ],
      message: 'Quy tắc: Bass dưới melody, không trùng cao độ. Khi nốt gốc vi phạm, đổi sang một nốt khác CỦA CHÍNH HỢP ÂM đó (quãng 5 hoặc quãng 3) nằm thấp hơn.',
    },
    {
      kind: 'layers',
      title: 'Cùng một đoạn, hai khung Bass',
      lead: 'Khung A giữ nốt gốc cho mọi ô. Khung B chỉnh lại để mọi Bass nằm dưới melody. Cả hai đều là lựa chọn; khung B tránh được những chỗ đụng melody.',
      layers: [
        { label: 'Khung A', what: 'Bass gốc ở mọi ô — đơn giản, nhưng ô 3, 5, 6 đụng melody.', tex: SK_ROOT },
        { label: 'Khung B', what: 'Chỉnh ô 3, 5, 6 thành Dm/A, Am/E, Dm/A — mọi Bass nằm dưới melody.', tex: SK_BELOW, current: true },
      ],
      note: 'Khung B không phải đáp án duy nhất. Ô 3 và 6 còn có thể dùng Fa dây 6 ngăn 1 (Dm/F). Chọn nốt nào, hãy nghe thử rồi giải thích.',
    },
    {
      kind: 'checkpoint',
      id: '10.2',
      title: 'Bài trả 10.2 — Bass và melody',
      required: true,
      accepts: ['quiz'],
      quiz: {
        mode: 'single',
        question: 'Ô 24 có hợp âm C, nốt thấp nhất của melody là Đô (dây 5 ngăn 3). Nếu đàn Bass gốc Đô ở đúng dây 5 ngăn 3, điều gì xảy ra?',
        options: [
          { id: 'a', text: 'Bass trùng cao độ với nốt melody nên hai tầng hòa làm một; nên chọn nốt Bass khác của hợp âm C, thấp hơn (Sol dây 6 ngăn 3 hoặc Mi dây 6 buông)' },
          { id: 'b', text: 'Không sao, Bass luôn phải là nốt gốc' },
          { id: 'c', text: 'Phải bỏ hẳn Bass trong cả bài' },
          { id: 'd', text: 'Phải đổi sang hợp âm khác' },
        ],
        hint: 'Bass và melody nên ở HAI cao độ khác nhau, Bass thấp hơn. Hợp âm C gồm những nốt nào?',
      },
    },
    {
      kind: 'note',
      title: 'Nhịp 3 · Tự chọn Bass cho ô 2–8',
      text: 'Tự điền nốt Bass từng ô theo bảng kiểm, nghe thử rồi giải thích. Kết thúc nhịp: Bài trả 10.3 (video + giải thích).',
    },
    {
      kind: 'repertoire',
      title: 'Phần 2 (thực hành) — Điền Bass cho ô 2–8',
      candidates: ['Con Đường Xưa em Đi — tự chọn Bass cho ô 2–8'],
      status: 'ready',
      pieces: [
        {
          title: 'Ô 2–8 — melody (Bass để trống có chủ ý)',
          composer: 'Châu Kỳ & Hồ Đình Phương · giọng Am',
          note: 'Bản này CHỈ có melody và tên hợp âm — Bass để trống. Nhìn tên hợp âm và bảng kiểm, viết nốt Bass (tên nốt + dây + ngăn) vào bản in.',
          barsPerRow: 2,
          tex: cdxFingered(2, 8),
          guidance: [
            '1. Ghi nốt gốc của hợp âm.',
            '2. Tìm nốt thấp nhất của melody trong ô.',
            '3. Nốt gốc có thấp hơn không? Có → dùng. Không → đổi sang quãng 5 hoặc quãng 3 thấp hơn.',
            '4. Đàn thử Bass với melody. Nghe còn rõ melody không?',
            '5. Ghi lại: "Tôi chọn Bass này vì…"',
          ],
        },
      ],
      annotationTypes: ['Nốt Bass bạn chọn', 'Dây · ngăn', 'Root hay đảo', 'Lý do chọn', 'Ghi chú của giáo viên'],
    },
    {
      kind: 'checkpoint',
      id: '10.3',
      title: 'Bài trả 10.3 — Bass của tôi',
      prompt: 'Chơi melody ô 2–5 kèm nốt Bass bạn đã chọn ở đầu mỗi ô (Bass gảy bằng ngón cái p). Không cần hoàn hảo. Sau đó viết ngắn: ‘Ở ô … tôi chọn Bass … vì…’. Tiêu chí Đạt: (1) Bass đúng tên hợp âm hoặc đúng thể đảo ghi rõ; (2) Bass nằm dưới melody, không trùng nốt; (3) giải thích dựa trên hợp âm và âm vực.',
      required: true,
      accepts: ['video_link', 'text'],
    },
    {
      kind: 'study',
      tag: 'Phần 2',
      title: 'Phụ lục hiểu sâu — Bass',
      blocks: [
        { b: 'h', text: 'Nguyên tắc và lựa chọn' },
        { b: 'p', text: 'Nguyên tắc hòa âm: nốt Bass nên thuộc hợp âm đang vang, và thường là nốt gốc khi không có lý do khác. Lựa chọn phối khí: dùng nốt gốc hay quãng 5, bass dây buông hay bass bấm, bass một nốt hay đi bước. Hai việc này khác nhau — nguyên tắc ít khi bị phá, còn lựa chọn thì mỗi người một cách.' },
        { b: 'h', text: 'Bảng nốt Bass của bài (từ tên hợp âm trong MusicXML)' },
        { b: 'table', rows: [
          ['Hợp âm', 'Root Note', 'Bass gốc ở đâu', 'Quãng 5', 'Ghi chú'],
          ['Am', 'La', 'dây 5 buông', 'Mi — dây 6 buông', 'bài chủ yếu ở Am'],
          ['Dm', 'Rê', 'dây 4 buông', 'La — dây 5 buông', 'hay va melody thấp (Đô)'],
          ['E · E7', 'Mi', 'dây 6 buông', 'Si — dây 5 ngăn 2', 'E7 thêm Rê (quãng 7)'],
          ['F', 'Fa', 'dây 6 ngăn 1', 'Đô — dây 5 ngăn 3', 'xem ô 32 bên dưới'],
          ['G', 'Sol', 'dây 6 ngăn 3', 'Rê — dây 4 buông', ''],
          ['C', 'Đô', 'dây 5 ngăn 3', 'Sol — dây 6 ngăn 3', 'có thể trùng melody ở ô 24'],
        ] },
        { b: 'h', text: 'Vì sao Bass thấp hơn melody' },
        { b: 'p', text: 'Tai người nghe giai điệu như nốt cao nhất trong một cụm. Khi Bass chen lên trên hoặc trùng melody, tai mất điểm tựa và bài nghe lẫn. Đó là lý do phần lớn bản Solo Guitar giữ melody làm nốt cao nhất và dành ba dây trầm cho Bass.' },
        { b: 'h', text: 'Thể đảo và Bass Note' },
        { b: 'p', text: 'Khi Bass Note không phải nốt gốc, ta có hợp âm đảo (Chord Inversion), viết dạng X/Y. Ví dụ Dm/A: hợp âm Rê thứ với La ở thấp nhất. Thể đảo thường làm đường Bass đi mượt hơn và tránh va melody.' },
        { b: 'callout', label: 'CẦN OWNER XEM LẠI', text: 'Hợp âm trong MusicXML là nguồn duy nhất; Bass và thể đảo trong buổi này do giáo án đề xuất. Ô 32 trong nguồn ghi hợp âm F nhưng giai điệu (Đô, Mi, La, Sol♯) giống Am → E; giữ nguyên nguồn, cần rà soát chuyên môn (không ảnh hưởng ô 2–8).' },
      ],
    },
    {
      kind: 'assignment',
      items: [
        { label: 'Bài 1.', text: 'Đàn khung Bass gốc ô 2–8 (chậm, đều, 5 phút mỗi ngày).' },
        { label: 'Bài 2.', text: 'Điền nốt Bass cho ô 2–8 vào bản in, ghi rõ dây · ngăn, và thể đảo nếu có.' },
        { label: 'Bài 3.', text: 'Đàn melody ô 2–8 kèm Bass của bạn, nghe còn rõ melody không.' },
        { label: 'Bài 4.', text: 'Làm tương tự cho ô 18–21 (Am, F, G, C): tìm nốt thấp nhất của melody, rồi chọn Bass dưới nó.' },
      ],
      message: 'Bass của bạn có thể khác bạn bên cạnh. Mang lý do đến lớp, ta nghe từng phương án.',
    },
    {
      kind: 'checklist',
      items: [
        'Tôi phân biệt được Root Note và Bass Note.',
        'Tôi tìm được các nốt Bass trên dây 6, 5, 4.',
        'Tôi kiểm được Bass có nằm dưới melody không.',
        'Tôi biết đổi sang quãng 5 hoặc quãng 3 khi nốt gốc không hợp.',
        '⭐ Tôi nói được vì sao mình chọn Bass đó.',
      ],
    },
    { kind: 'studentNotes', title: 'Tôi chọn Bass này vì…', lines: 8 },
  ],
}
