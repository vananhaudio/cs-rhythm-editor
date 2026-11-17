// ── SOLO-01 · CHẶNG 2 · BUỔI 5/8 — hệ thống đánh số là BUỔI 13 ──
// Chủ đề: Chèn hợp âm theo công thức Bolero — bổ sung hợp âm vào giai điệu theo mô hình tiết tấu Bolero.
// ⚠️ "Công thức Bolero" ở đây là MỘT MÔ HÌNH TIẾT TẤU PHỔ BIẾN (Bass – hợp âm – Bass đổi – hợp âm trên 4 phách), dùng để HỌC.
//    KHÔNG phải quy luật bắt buộc cho mọi bài; Bolero còn nhiều cách phối khác. Owner rà soát / thay bằng mô hình của mình nếu muốn.
// Ví dụ 2 bè (melody + Bass/hợp âm) ở Nhịp 3 là BẢN PHÁC dựng cơ học từ MusicXML nâng quãng 8 (bè 1) + quy tắc Buổi 2, 4 (bè 2); chưa phải bản phối đã xác nhận.
import type { LessonDoc } from '../../../lesson/lessonTypes'
import { CDX_BARS, cdxFingered, TRIAD, BASS } from './works'

const twoVoice = (v1: string[], v2: string[]): string => `\\ts 4 4\n.\n\\voice\n${v1.join('\n')}\n\\voice\n${v2.join('\n')}`

// Mô hình ví dụ: phách 1 Bass gốc · phách 2 Triad ngăn cao · phách 3 Bass đổi (quãng 5) · phách 4 Triad. Bass dây 6–5, Triad dây 4–3–2.
const patBar = (chord: string, name: string): string =>
  `${BASS[chord].root}{ch "${name}"}.4 (${TRIAD[chord].tex}).4 ${BASS[chord].fifth}.4 (${TRIAD[chord].tex}).4 |`
const BOLERO_PATTERN = `\\ts 4 4
.
${patBar('Am', 'Am')}
${patBar('Dm', 'Dm')}
${patBar('Am', 'Am')}
${patBar('E', 'E')}`

// Bản phác (bè 2 dựng theo quy tắc Buổi 2, 4: Bass dây 6–5 · Triad/hợp âm dây 4–2 · mọi nốt bè 2 THẤP HƠN nốt melody đang vang). Bè 1 = melody NGUYÊN VĂN.
// Ô 18 (Am): Bass La, Triad Am chen ở phách 2 (melody còn giữ La dài), Bass Mi dây 6 buông ở phách 3–4.
export const O18_V2 = ['0.5.4 (7.4 5.3 5.2).4 0.6.2 |']
// Ô 20 (G): Bass Sol, Triad G chen ở phách 2 (melody còn giữ Sol), Bass Rê dây 5 ngăn 5.
export const O20_V2 = ['3.6.4 (5.4 4.3 3.2).4 5.5.2 |']
// Ô 21 (C): melody giữ Mi 2 phách, NGHỈ phách 3, Mi phách 4. Bass Đô – Sol, Triad C chen đúng phách 3.
export const O21_V2 = ['3.5.4 3.6.4 (5.4 5.3 5.2).4 3.5.4 |']
const O18 = twoVoice([CDX_BARS[17]], O18_V2)
const O20 = twoVoice([CDX_BARS[19]], O20_V2)
const O21 = twoVoice([CDX_BARS[20]], O21_V2)

export const SOLO01_BUOI13: LessonDoc = {
  meta: {
    programCode: 'SOLO-01',
    programName: 'SOLO GUITAR CĂN BẢN',
    sessionNo: 13,
    title: 'Chặng 2 – Buổi 5/8 · Chèn hợp âm theo công thức Bolero',
    stageLabel: 'Chặng 2 · Solo Bolero',
    backHref: '/solo01',
  },
  sections: [
    {
      kind: 'recap',
      title: 'Từ Buổi 4 sang Buổi 5',
      steps: [
        { label: 'Đã có', items: ['Melody (B1) · Bass dưới melody (B2) · Ngón tay trái (B3) · Hợp âm bấm tắt (B4).'] },
        { label: 'Buổi 5 thêm', items: ['GHÉP: đặt hợp âm vào những chỗ trống của melody, theo một mô hình tiết tấu Bolero.', 'Biết chỗ nào chèn được, chỗ nào chỉ nên có Bass.'] },
      ],
      message: 'Đến hôm nay mỗi tầng được học riêng. Buổi này bắt đầu ghép tầng hợp âm vào cùng một nhịp với Bass và melody.',
    },
    {
      kind: 'objectives',
      title: 'Cuối buổi, bạn làm được',
      items: [
        'Đọc một mô hình tiết tấu Bolero trên 4 phách: Bass – hợp âm – Bass đổi – hợp âm.',
        'Tìm "chỗ trống" của melody (nốt dài, nốt nghỉ) để chèn hợp âm.',
        'Biết nhường chỗ: khi melody di chuyển nhiều hoặc đang thấp thì chỉ giữ Bass.',
        'Biết mô hình Bolero là MỘT lựa chọn phối khí, không phải quy luật.',
        '⭐ QUAN TRỌNG NHẤT — Tự chèn hợp âm vào hai ô và nói được vì sao chọn chỗ đó.',
      ],
    },
    // NHỊP HỌC (đề xuất): 13.1 trắc nghiệm → 13.2 trắc nghiệm → 13.3 video + chữ.
    {
      kind: 'note',
      title: 'Nhịp 1 · Chỗ trống của melody',
      text: 'Phần 1 — Làm ngay: nhìn melody và tìm chỗ có thể chèn hợp âm. Kết thúc nhịp: Bài trả 13.1 (trắc nghiệm).',
    },
    {
      kind: 'recap',
      title: 'Phần 1 — Làm ngay: tìm chỗ trống',
      steps: [
        { label: 'Chỗ TRỐNG (chèn được)', items: ['Nốt dài của melody: ô 4, 8, 12, 16, 21, 25, 29, 37 (nốt tròn hoặc trắng).', 'Phách nghỉ của melody: ô 17, 21, 25, 29, 33.'] },
        { label: 'Chỗ ĐẦY (nhường)', items: ['Melody đi nốt liên tục (ô 3, 6, 24…).', 'Ở đó thường chỉ giữ Bass, hoặc một hợp âm ngắn ở phách mà melody dừng.'] },
        { label: 'Lưu ý âm vực', items: ['Chèn hợp âm bên DƯỚI melody (nốt melody là nốt cao nhất).', 'Melody ở dây 1 thì dây 4–2 bên dưới còn chỗ cho Triad; melody xuống dây 2 thì chỉ còn thế hai nốt (Dyad) ở dây 4–3.', 'Nốt La3 (dây 3 ngăn 2, ở ô 5, 13, 25, 38) là nốt thấp nhất của bài: dưới nó không còn chỗ cho hợp âm, chỉ giữ Bass.'] },
      ],
      message: 'Chuyên viên không chèn hợp âm "ở mọi nơi". Họ nghe melody trước và chỉ chèn nơi melody để chỗ cho nó.',
    },
    {
      kind: 'checkpoint',
      id: '13.1',
      title: 'Bài trả 13.1 — Chỗ trống của melody',
      required: true,
      accepts: ['quiz'],
      quiz: {
        mode: 'single',
        question: 'Trong một ô mà melody có nốt tròn (giữ cả 4 phách), nên làm gì với hợp âm?',
        options: [
          { id: 'a', text: 'Có chỗ trống: có thể chèn Bass và hợp âm theo mô hình tiết tấu, miễn là hợp âm nằm dưới nốt melody' },
          { id: 'b', text: 'Tuyệt đối không chèn gì' },
          { id: 'c', text: 'Chèn hợp âm CAO HƠN nốt melody cho vang' },
          { id: 'd', text: 'Đổi melody sang nốt khác' },
        ],
        hint: 'Nốt dài của melody để lại cho các phách còn lại. Nhưng melody vẫn nên là nốt cao nhất.',
      },
    },
    {
      kind: 'note',
      title: 'Nhịp 2 · Mô hình tiết tấu Bolero',
      text: 'Luyện một mô hình Bass – hợp âm trên 4 phách qua vòng Am – Dm – Am – E. Kết thúc nhịp: Bài trả 13.2 (trắc nghiệm).',
    },
    {
      kind: 'score',
      subtitle: 'Mô hình ví dụ',
      title: 'Bass – hợp âm – Bass đổi – hợp âm',
      lead: 'Phách 1: Bass gốc (dây 6–5). Phách 2: Triad ở ngăn cao (dây 4–3–2). Phách 3: Bass đổi sang quãng 5. Phách 4: Triad. Một ô một hợp âm: Am – Dm – Am – E.',
      tempo: 'Tempo: ♩ = 60',
      tex: BOLERO_PATTERN,
      marks: [
        { at: 'Am', text: 'Bass: La dây 5 buông → Mi dây 6 buông · Triad xx755x' },
        { at: 'Dm', text: 'Bass: Rê dây 5 ngăn 5 → La dây 5 buông · Triad xx776x' },
        { at: 'E', text: 'Bass: Mi dây 6 buông → Si dây 5 ngăn 2 · Triad xx645x' },
      ],
      guidance: [
        'Bass gảy bằng ngón cái p ở dây 6–5; Triad gảy bằng i–m–a cùng lúc trên dây 4–3–2.',
        'Phách 1 và 3 (Bass) hơi nặng, phách 2 và 4 (hợp âm) nhẹ hơn — đó là "nhịp đu" của mô hình.',
        'Đây là MỘT mô hình. Người chơi Bolero còn dùng nhiều mô hình khác (thêm nốt đệm, đảo phách...). Bạn học mô hình này để có điểm xuất phát.',
      ],
    },
    {
      kind: 'checkpoint',
      id: '13.2',
      title: 'Bài trả 13.2 — Mô hình tiết tấu',
      required: true,
      accepts: ['quiz'],
      quiz: {
        mode: 'single',
        question: 'Trong mô hình ví dụ của buổi này (Bass – hợp âm – Bass đổi – hợp âm), phách 1 và phách 3 thường là gì?',
        options: [
          { id: 'a', text: 'Hợp âm gảy cả dây' },
          { id: 'b', text: 'Bass: phách 1 Bass gốc, phách 3 Bass đổi (thường quãng 5)' },
          { id: 'c', text: 'Nghỉ cả hai phách' },
          { id: 'd', text: 'Melody' },
        ],
        hint: 'Phách 2 và 4 là hợp âm; phách 1 và 3 là hai nốt Bass khác nhau.',
      },
    },
    {
      kind: 'note',
      title: 'Nhịp 3 · Chèn vào melody thật',
      text: 'Ghép mô hình vào melody của bài ở các ô có chỗ trống; tự chèn hai ô và giải thích. Kết thúc nhịp: Bài trả 13.3 (video + giải thích).',
    },
    {
      kind: 'repertoire',
      title: 'Bản phác — melody (bè 1) + Bass/hợp âm (bè 2)',
      candidates: ['Con Đường Xưa em Đi — ô 18, 20, 21'],
      status: 'ready',
      pieces: [
        {
          title: 'Ô 18 · Am — melody trên dây 1',
          composer: 'Châu Kỳ & Hồ Đình Phương · bè 1 = MusicXML',
          note: 'Bè 1 là melody nguyên văn. Bè 2: Bass La dây 5 buông (phách 1), Triad Am xx755x ở phách 2 lúc melody còn giữ nốt La dài, rồi Bass Mi dây 6 buông (phách 3–4). Mọi nốt bè 2 thấp hơn melody. Ví dụ phác thảo, chờ Owner xác nhận.',
          barsPerRow: 1,
          tex: O18,
        },
        {
          title: 'Ô 20 · G — Sol dây 1 ngăn 3 lặp nhiều lần',
          composer: 'Châu Kỳ & Hồ Đình Phương · bè 1 = MusicXML',
          note: 'Bass: Sol dây 6 ngăn 3 (phách 1), Triad G xx543x ở phách 2 lúc melody còn giữ Sol, rồi Rê dây 5 ngăn 5. Ví dụ phác thảo.',
          barsPerRow: 1,
          tex: O20,
        },
        {
          title: 'Ô 21 · C — melody có phách nghỉ',
          composer: 'Châu Kỳ & Hồ Đình Phương · bè 1 = MusicXML',
          note: 'Melody giữ Mi dây 1 buông hai phách, nghỉ phách 3, rồi Mi ở phách 4. Bass Đô dây 5 ngăn 3 và Sol dây 6 ngăn 3; Triad C xx555x chen đúng vào phách 3 (melody nghỉ). Ví dụ phác thảo.',
          barsPerRow: 1,
          tex: O21,
        },
        {
          title: 'Ô 18–21 — melody (để bạn tự chèn)',
          composer: 'Châu Kỳ & Hồ Đình Phương · giọng Am',
          note: 'Bản chỉ có melody và hợp âm. Bạn chèn Bass/hợp âm cho ô 19 (F) và ô 18–21 theo mô hình, hoặc theo cách của bạn.',
          barsPerRow: 2,
          tex: cdxFingered(18, 21),
          guidance: [
            '1. Tìm nốt thấp nhất của melody trong ô.',
            '2. Chọn Bass thấp hơn (Buổi 2) và chỗ cho hợp âm rút gọn (Buổi 4).',
            '3. Đặt mô hình Bolero vào chỗ trống; ô đầy thì chỉ để Bass.',
            '4. Đàn thử, nghe còn rõ melody không.',
            '5. Ghi lại: "Tôi chèn ở … vì…"',
          ],
        },
      ],
      annotationTypes: ['Chỗ trống bạn tìm', 'Bass chọn', 'Hợp âm chèn', 'Chỗ nhường', 'Lý do chọn', 'Ghi chú của giáo viên'],
    },
    {
      kind: 'checkpoint',
      id: '13.3',
      title: 'Bài trả 13.3 — Chèn hợp âm của tôi',
      prompt: 'Chơi hai ô của điệp khúc (gợi ý ô 18 và ô 21, hoặc hai ô bạn chọn) với melody + Bass + hợp âm do bạn tự chèn. Viết ngắn: ‘Ở ô … tôi chèn … ở phách … vì…’. Tiêu chí Đạt: (1) nốt melody vẫn rõ, là nốt cao nhất; (2) Bass và hợp âm đúng tên hợp âm trong ô; (3) chèn đúng chỗ trống và nêu được lý do (nốt dài / phách nghỉ / âm vực).',
      required: true,
      accepts: ['video_link', 'text'],
    },
    {
      kind: 'study',
      tag: 'Phần 2',
      title: 'Phụ lục hiểu sâu — Tiết tấu Bolero và nghệ thuật chèn',
      blocks: [
        { b: 'h', text: 'Bolero và nhịp 4/4' },
        { b: 'p', text: 'Bolero Việt Nam thường chậm, cảm giác nhịp đều và êm, trong nhịp 4/4 (bài này cũng ở 4/4). Tiết tấu đệm hay nhấn vào phách 1 và 3 bằng Bass, phách 2 và 4 bằng hợp âm. Đó là mô hình giáo án dùng. Ngoài ra còn nhiều biến thể.' },
        { b: 'callout', label: 'NGUYÊN TẮC vs LỰA CHỌN', text: 'Nguyên tắc: Bass/hợp âm không lấn melody; hợp âm đúng tên. Lựa chọn phối khí: nhấn phách nào, dùng mô hình nào, chèn dày hay thưa. Hai người cùng biết nguyên tắc vẫn sẽ chèn khác nhau.' },
        { b: 'h', text: 'Vì sao chèn hợp âm cần "chỗ trống"' },
        { b: 'p', text: 'Guitar có sáu dây nhưng bàn tay chỉ có bốn ngón gảy (p, i, m, a). Mỗi lúc chỉ chơi được một lượng nốt hữu hạn. Khi melody đi nốt dày, tay phải bận cho melody, nên hợp âm nhường. Khi melody dừng, tay phải rảnh để chèn.' },
        { b: 'h', text: 'Âm vực của bản phối quãng 8 cao' },
        { b: 'p', text: 'Melody nay nằm từ La3 (dây 3 ngăn 2, chỉ ở ô 5, 13, 25, 38) đến Mi5 (dây 1 ngăn 12). Phần lớn thời gian melody ở dây 1, nên dây 4–2 bên dưới trống cho hợp âm — rộng hơn nhiều so với bản gốc. Chỗ hẹp nhất là bốn ô có La3: hợp âm không còn chỗ dưới melody, chỉ giữ Bass.' },
        { b: 'callout', label: 'CẦN OWNER XEM LẠI', text: 'Mô hình Bolero, các bản phác 2 bè (ô 18, 20, 21) và việc chọn ô để chèn là đề xuất của giáo án, dựng cơ học từ MusicXML nâng quãng 8 (bè 1) và quy tắc Buổi 2, 4; chưa được người chơi kiểm từng thế tay. Ô 32 trong nguồn ghi hợp âm F nhưng giai điệu giống Am → E; giữ nguyên nguồn, cần rà soát chuyên môn.' },
      ],
    },
    {
      kind: 'assignment',
      items: [
        { label: 'Bài 1.', text: 'Mô hình Bass – hợp âm trên vòng Am – Dm – Am – E, chậm, đều, 5 phút mỗi ngày.' },
        { label: 'Bài 2.', text: 'Đàn ba bản phác ô 18, 20, 21: nghe melody còn rõ không.' },
        { label: 'Bài 3.', text: 'Tự chèn Bass/hợp âm cho ô 19 (F) rồi ghi "Tôi chèn ở … vì…".' },
        { label: 'Bài 4.', text: 'Đánh dấu trên bản in ô nào là chỗ trống, ô nào là chỗ đầy cho ô 18–25.' },
      ],
      message: 'Mỗi người nghe chỗ trống khác nhau một chút. Mang lý do đến lớp.',
    },
    {
      kind: 'checklist',
      items: [
        'Tôi tìm được chỗ trống của melody.',
        'Tôi đàn được mô hình Bass – hợp âm trên 4 phách.',
        'Tôi giữ melody là nốt cao nhất khi chèn.',
        'Tôi biết khi nào chỉ để Bass.',
        '⭐ Tôi nói được vì sao mình chèn ở chỗ đó.',
      ],
    },
    { kind: 'studentNotes', title: 'Tôi chèn hợp âm ở chỗ này vì…', lines: 8 },
  ],
}
