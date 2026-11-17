// ── SOLO-01 · CHẶNG 2 · BUỔI 6/8 — hệ thống đánh số là BUỔI 14 ──
// Chủ đề: Ghép Bass và hợp âm cho điệp khúc — phối hợp Bass, hợp âm và Melody.
// Điệp khúc (ĐỀ XUẤT từ cấu trúc hợp âm + lời, chờ Owner xác nhận): ô 18–25 (nửa 1) và ô 26–33 (nửa 2); hai nửa giống nhau 7 ô đầu, khác ở ô 31–33.
// ⚠️ Ô 32: nguồn ghi hợp âm F nhưng giai điệu là Đô – Mi – La – Sol♯ (giống Am → E). GIỮ NGUYÊN NGUỒN, đánh dấu cần rà soát; KHÔNG để cản các ô khác.
// Bè 2 trong ví dụ 2 bè = BẢN PHÁC dựng cơ học theo quy tắc Buổi 2 (Bass dây 6–5 dưới melody) và Buổi 4 (Triad/Dyad ngăn cao, dây 4–2), chưa phải bản phối đã xác nhận.
// Melody là bản nâng MỘT QUÃNG 8 (works.ts). Mọi nốt bè 2 thấp hơn nốt melody đang vang (bộ kiểm trong tests/class-social/solo01-chang2.test.ts).
import type { LessonDoc } from '../../../lesson/lessonTypes'
import { CDX_BARS, cdxFingered } from './works'

const twoVoice = (v1: string[], v2: string[]): string => `\\ts 4 4\n.\n\\voice\n${v1.join('\n')}\n\\voice\n${v2.join('\n')}`

export const V2_NUA1 = [
  '0.5.4 (7.4 5.3 5.2).4 0.6.2 |',             // ô 18 Am: Bass La · Triad Am xx755x ở phách 2 (melody giữ La dài) · Bass Mi dây 6
  '1.6.4 (7.4 5.3 6.2).4 3.5.2 |',             // ô 19 F: Bass Fa dây 6 ngăn 1 · Triad F xx756x (melody giữ Đô dài) · Bass Đô dây 5 ngăn 3
  '3.6.4 (5.4 4.3 3.2).4 5.5.2 |',             // ô 20 G: Bass Sol dây 6 ngăn 3 · Triad G xx543x (melody giữ Sol) · Bass Rê dây 5 ngăn 5
  '3.5.4 3.6.4 (5.4 5.3 5.2).4 3.5.4 |',       // ô 21 C: Bass Đô/Sol · phách 3 (melody nghỉ) Triad C xx555x
  '0.5.4 (7.4 5.3).4 0.6.2 |',                 // ô 22 Am: Bass La · Dyad xx75xx (melody Mi4 thấp, chỉ chừa chỗ hai nốt) · Bass Mi
  '5.5.4 (3.4 2.3).4 0.5.2 |',                 // ô 23 Dm: Bass Rê dây 5 ngăn 5 · Dyad xx32xx dưới Rê4 · Bass La
  '3.5.4 3.6.4 3.5.4 3.6.4 |',                 // ô 24 C: melody đi liên tục → chỉ Bass Đô/Sol
  '0.5.2 (7.4 5.3 5.2).4 0.6.4 |',             // ô 25 Am: Bass La (dưới La3 của melody) · phách 3 (melody nghỉ) Triad Am xx755x
]
const NUA1_SKETCH = twoVoice(CDX_BARS.slice(17, 25), V2_NUA1)

export const SOLO01_BUOI14: LessonDoc = {
  meta: {
    programCode: 'SOLO-01',
    programName: 'SOLO GUITAR CĂN BẢN',
    sessionNo: 14,
    title: 'Chặng 2 – Buổi 6/8 · Ghép Bass và hợp âm cho điệp khúc',
    stageLabel: 'Chặng 2 · Solo Bolero',
    backHref: '/solo01',
  },
  sections: [
    {
      kind: 'recap',
      title: 'Từ Buổi 5 sang Buổi 6',
      steps: [
        { label: 'Buổi 5 đã có', items: ['Mô hình Bolero Bass – hợp âm – Bass đổi – hợp âm.', 'Tìm chỗ trống để chèn.'] },
        { label: 'Buổi 6 thêm', items: ['Ghép trọn ba tầng — Melody, Bass, hợp âm — cho CẢ MỘT ĐIỆP KHÚC (ô 18–33).', 'Nhìn từng ô: Bass nào, có chèn hợp âm không, ở phách nào.'] },
      ],
      message: 'Điệp khúc là chỗ bài hát "mở lòng". Ở đây ta ghép tầng đầy đủ nhất của Solo Bolero trong bài này.',
    },
    {
      kind: 'objectives',
      title: 'Cuối buổi, bạn làm được',
      items: [
        'Đọc cấu trúc hợp âm của điệp khúc: Am – F – G – C – Am – Dm – C – Am, rồi phần cuối khác nhau.',
        'Chọn Bass cho từng ô: thuộc hợp âm, ở dây 6–5, dưới nốt thấp nhất của melody.',
        'Chọn ô nào chèn hợp âm (nốt dài, phách nghỉ) và thế bấm nào.',
        'Ghép đủ ba tầng cho 8 ô điệp khúc mà melody vẫn là nốt cao nhất.',
        '⭐ QUAN TRỌNG NHẤT — Ghép ba tầng cho một đoạn điệp khúc và nói được lựa chọn của mình.',
      ],
    },
    // NHỊP HỌC (đề xuất): 14.1 trắc nghiệm → 14.2 trắc nghiệm → 14.3 video + chữ.
    {
      kind: 'note',
      title: 'Nhịp 1 · Đọc điệp khúc',
      text: 'Phần 1 — Làm ngay: đàn melody 8 ô đầu điệp khúc, nhìn hợp âm và bảng Bass. Kết thúc nhịp: Bài trả 14.1 (trắc nghiệm).',
    },
    {
      kind: 'score',
      subtitle: 'Phần 1 — Làm ngay',
      title: 'Điệp khúc nửa 1: melody ô 18–25 (ngón mặc định)',
      lead: 'Hợp âm theo MusicXML: Am – F – G – C – Am – Dm – C – Am. Đây là melody nguyên văn từ nguồn.',
      tempo: 'Tempo: ♩ = 60',
      tex: cdxFingered(18, 25),
      guidance: [
        'Đàn từng nhóm hai ô. Chú ý nốt thấp nhất của melody trong mỗi ô (bảng bên dưới).',
        'Ô 21 và ô 25 có phách nghỉ ở giữa: chỗ đặt hợp âm.',
      ],
    },
    {
      kind: 'study',
      tag: 'Bảng',
      title: 'Bảng Bass và hợp âm cho điệp khúc (nốt thấp nhất của melody → Bass và thế chèn)',
      blocks: [
        { b: 'p', text: 'Nốt thấp nhất của melody lấy từ MusicXML nâng một quãng 8. Bass gợi ý theo quy tắc Buổi 2: thuộc hợp âm, ở dây 6–5, thấp hơn melody. Cột cuối là thế hợp âm chèn (Buổi 4) và chỗ chèn. Thế hai nốt (Dyad) dùng khi melody thấp, chỉ chừa chỗ cho hai nốt.' },
        { b: 'table', rows: [
          ['Ô', 'Hợp âm', 'Melody thấp nhất', 'Bass gợi ý', 'Thế chèn'],
          ['18, 26', 'Am', 'La4 (dây 1 ngăn 5)', 'La dây 5 buông · Mi dây 6 buông', 'Triad xx755x, phách 2'],
          ['19, 27', 'F', 'La4 (dây 1 ngăn 5)', 'Fa dây 6 ngăn 1 · Đô dây 5 ngăn 3', 'Triad xx756x, phách 2'],
          ['20, 28', 'G', 'Sol4 (dây 1 ngăn 3)', 'Sol dây 6 ngăn 3 · Rê dây 5 ngăn 5', 'Triad xx543x, phách 2'],
          ['21, 29', 'C', 'Mi4 (dây 1 buông)', 'Đô dây 5 ngăn 3 · Sol dây 6 ngăn 3', 'Triad xx555x, phách 3 (melody nghỉ)'],
          ['22, 30', 'Am', 'Mi4 (dây 1 buông)', 'La dây 5 buông · Mi dây 6 buông', 'Dyad xx75xx, phách 2'],
          ['23, 31', 'Dm', 'Rê4 (dây 2 ngăn 3)', 'Rê dây 5 ngăn 5 · La dây 5 buông', 'Dyad xx32xx, phách 2'],
          ['24', 'C', 'Đô4 (dây 2 ngăn 1)', 'Đô dây 5 ngăn 3 · Sol dây 6 ngăn 3', 'Không chèn: melody đi liên tục, chỉ Bass'],
          ['25', 'Am', 'La3 (dây 3 ngăn 2)', 'La dây 5 buông · Mi dây 6 buông', 'Triad xx755x, phách 3 (melody nghỉ)'],
          ['32', 'F (nguồn ghi)', 'Đô4 (dây 2 ngăn 1)', 'Fa dây 6 ngăn 1 (nếu giữ F)', 'Chờ rà soát — xem cảnh báo'],
          ['33', 'E7', 'Si4 (dây 1 ngăn 7)', 'Mi dây 6 buông', 'Partial Voicing xx675x, phách 2 (melody nghỉ)'],
        ] },
        { b: 'callout', label: 'CẦN RÀ SOÁT Ô 32', text: 'Nguồn MusicXML ghi hợp âm F ở ô 32 nhưng giai điệu là Đô – Mi – La – Sol♯, vốn khớp Am (La – Đô – Mi) rồi chuyển E (Sol♯). Có thể do ghi nhầm trong nguồn. Giáo án GIỮ NGUYÊN nguồn và không dựng ví dụ nào trên ô 32; học viên và Owner đối chiếu sau.' },
      ],
    },
    {
      kind: 'checkpoint',
      id: '14.1',
      title: 'Bài trả 14.1 — Bass cho điệp khúc',
      required: true,
      accepts: ['quiz'],
      quiz: {
        mode: 'single',
        question: 'Ô 23 có hợp âm Dm; melody giữ Rê (dây 2 ngăn 3). Bạn muốn chèn thế hai nốt Fa – La trên dây 4–3 ở phách 2. Bass nên đàn ở đâu?',
        options: [
          { id: 'a', text: 'Rê dây 4 buông, vì Bass luôn đàn ở dây 4 với Dm' },
          { id: 'b', text: 'Rê dây 5 ngăn 5 (hoặc La dây 5 buông, Fa dây 6 ngăn 1): vẫn thuộc Dm, Bass ở dây 6–5 và nhường dây 4–3 cho hợp âm' },
          { id: 'c', text: 'Si dây 5 ngăn 2' },
          { id: 'd', text: 'Bỏ hẳn Bass' },
        ],
        hint: 'Bass không nên chiếm dây mà hợp âm cần. Dm gồm Rê – Fa – La: chọn nốt thuộc Dm trên dây 6–5.',
      },
    },
    {
      kind: 'note',
      title: 'Nhịp 2 · Ghép ba tầng',
      text: 'Nghe và đàn bản phác 2 bè cho ô 18–25, rồi đối chiếu từng ô với bảng. Kết thúc nhịp: Bài trả 14.2 (trắc nghiệm).',
    },
    {
      kind: 'repertoire',
      title: 'Bản phác điệp khúc nửa 1 — melody (bè 1) + Bass/hợp âm (bè 2)',
      candidates: ['Con Đường Xưa em Đi — điệp khúc ô 18–25'],
      status: 'ready',
      pieces: [
        {
          title: 'Ô 18–25 — melody + Bass + hợp âm chèn',
          composer: 'Châu Kỳ & Hồ Đình Phương · bè 1 = MusicXML nguyên văn',
          note: 'Bè 2 dựng theo quy tắc: Bass ở dây 6–5, dưới melody; hợp âm chèn ở nốt dài hoặc phách melody nghỉ (ô 18–23, 25), ô 24 chỉ Bass vì melody đi liên tục. Ô 22–23 dùng thế hai nốt vì melody thấp. VÍ DỤ PHÁC THẢO — chờ Owner xác nhận.',
          barsPerRow: 2,
          tex: NUA1_SKETCH,
          marks: [
            { at: 'Ô 18–20', text: 'phách 2: melody còn giữ nốt dài → Triad Am xx755x · F xx756x · G xx543x' },
            { at: 'Ô 21', text: 'phách 3: melody nghỉ → Triad C xx555x (Sol – Đô – Mi)' },
            { at: 'Ô 22–23', text: 'melody thấp (Mi4, Rê4) → chỉ thế hai nốt: xx75xx (La – Đô) và xx32xx (Fa – La); Bass Rê ở dây 5 ngăn 5' },
            { at: 'Ô 24', text: 'melody đi liên tục → chỉ Bass Đô – Sol' },
            { at: 'Ô 25', text: 'Bass La dưới La3 của melody; phách 3 (melody nghỉ) Triad Am xx755x' },
          ],
          guidance: [
            'Đàn bè 1 trước, rồi bè 2 riêng, rồi ghép. Tay phải: p cho Bass, i–m–a cho melody và hợp âm.',
            'Nghe: chỗ nào hợp âm nghe che melody? Bớt nốt cho hợp âm đó.',
            'Một số chỗ bấm có thể cần đổi ngón so với xếp ngón mặc định ở Buổi 3 — đó là điều bình thường khi ghép tầng.',
          ],
        },
      ],
      annotationTypes: ['Bass chọn', 'Chỗ chèn hợp âm', 'Thế bấm', 'Đổi ngón', 'Lý do chọn', 'Ghi chú của giáo viên'],
    },
    {
      kind: 'layers',
      title: 'Từ melody đến ba tầng — ô 18',
      lead: 'Cùng một ô 18 (Am) qua các tầng: melody một mình → thêm Bass → thêm hợp âm ở phách 2, lúc melody giữ nốt dài.',
      layers: [
        { label: 'Tầng 1', what: 'Melody một mình (Buổi 1).', tex: `\\ts 4 4\n.\n${CDX_BARS[17]}` },
        { label: 'Tầng 2', what: 'Thêm Bass dưới melody (Buổi 2): La dây 5 buông, rồi Mi dây 6 buông.', tex: twoVoice([CDX_BARS[17]], ['0.5.4 r.4 0.6.2 |']) },
        { label: 'Tầng 3', what: 'Thêm Triad Am xx755x ở phách 2 (Buổi 4–5), dưới nốt La dài của melody.', tex: twoVoice([CDX_BARS[17]], [V2_NUA1[0]]), current: true },
      ],
      note: 'Ô 18 melody giữ La dài hai phách đầu nên có chỗ chèn Triad ở phách 2; nửa sau ô melody đi chùm ba nên chỉ giữ Bass.',
    },
    {
      kind: 'checkpoint',
      id: '14.2',
      title: 'Bài trả 14.2 — Ghép ba tầng',
      required: true,
      accepts: ['quiz'],
      quiz: {
        mode: 'single',
        question: 'Vì sao bản phác chèn hợp âm ở phách 3 của ô 21 và ô 25, còn ô 24 chỉ có Bass?',
        options: [
          { id: 'a', text: 'Vì ô 21 và ô 25 melody nghỉ ở phách 3, còn ô 24 melody đi nốt liên tục nên chỉ để Bass' },
          { id: 'b', text: 'Vì ô 24 không có hợp âm' },
          { id: 'c', text: 'Vì hợp âm chỉ được chèn ở phách 3' },
          { id: 'd', text: 'Vì ô 21 và 25 là nốt cao nhất của bài' },
        ],
        hint: 'Hãy nhìn phách nghỉ trong melody ô 21, ô 25 và các nốt dày ở ô 24.',
      },
    },
    {
      kind: 'note',
      title: 'Nhịp 3 · Tự ghép một đoạn điệp khúc',
      text: 'Chọn một đoạn 2–4 ô trong điệp khúc, tự ghép ba tầng, đàn và thu video. Kết thúc nhịp: Bài trả 14.3 (video + giải thích).',
    },
    {
      kind: 'repertoire',
      title: 'Phần thực hành — điệp khúc nửa 2 (để bạn tự ghép)',
      candidates: ['Con Đường Xưa em Đi — điệp khúc nửa 2, ô 26–33'],
      status: 'ready',
      pieces: [
        {
          title: 'Ô 26–33 — melody (tự ghép Bass và hợp âm)',
          composer: 'Châu Kỳ & Hồ Đình Phương · giọng Am',
          note: 'Ô 26–31 giống ô 18–23 nên dùng lại bản phác nếu bạn muốn. Ô 32 CẦN RÀ SOÁT (xem cảnh báo) — bạn có thể bỏ qua ô này khi làm bài. Ô 33 là E7 với melody Si dây 1 ngăn 7.',
          barsPerRow: 2,
          tex: cdxFingered(26, 33),
          guidance: [
            '1. Chọn 2–4 ô (gợi ý ô 26–29 hoặc 30–31 và 33).',
            '2. Bass: dưới nốt thấp nhất của melody, thuộc hợp âm, ở dây 6–5.',
            '3. Hợp âm: chỉ chèn ở nốt dài hoặc phách nghỉ.',
            '4. Đàn từng tầng riêng rồi ghép; nghe còn rõ melody không.',
            '5. Ghi lại: "Tôi chọn … vì…"',
          ],
        },
      ],
      annotationTypes: ['Bass chọn', 'Chỗ chèn hợp âm', 'Thế bấm', 'Lý do chọn', 'Ghi chú của giáo viên'],
    },
    {
      kind: 'checkpoint',
      id: '14.3',
      title: 'Bài trả 14.3 — Điệp khúc của tôi',
      prompt: 'Chơi một đoạn 2–4 ô trong điệp khúc (không cần ô 32) với melody + Bass + hợp âm do bạn ghép. Viết ngắn: ‘Ở ô … tôi chọn Bass … và hợp âm … vì…’. Tiêu chí Đạt: (1) melody đúng và rõ, là nốt cao nhất; (2) Bass thuộc hợp âm và thấp hơn melody (có xử lý ô trùng nốt); (3) hợp âm chèn đúng chỗ trống; (4) giải thích dựa trên bảng Bass và âm vực.',
      required: true,
      accepts: ['video_link', 'text'],
    },
    {
      kind: 'study',
      tag: 'Phần 2',
      title: 'Phụ lục hiểu sâu — Ghép ba tầng',
      blocks: [
        { b: 'h', text: 'Ba tầng, ba vai' },
        { b: 'ul', items: [
          'Melody: dòng hát, nốt cao nhất, luôn rõ.',
          'Bass: nền và nhịp, thấp nhất, thuộc hợp âm.',
          'Hợp âm: màu sắc ở giữa, chỉ chèn khi có chỗ.',
        ] },
        { b: 'h', text: 'Ghép tầng làm đổi xếp ngón' },
        { b: 'p', text: 'Khi thêm Bass và hợp âm, ngón tay trái làm việc ở nhiều dây cùng lúc, nên xếp ngón của melody ở Buổi 3 có thể phải đổi. Có chỗ khớp rất đẹp: ô 18, La dây 1 ngăn 5 (ngón 1) cùng lúc với Triad Am xx755x — ngón 1 ép cả dây 3, 2, 1 ở ngăn 5 (thế xx7555) và ngón 3 giữ ngăn 7 dây 4. Ô 20: Sol dây 1 ngăn 3 với Triad G xx543x — ngón 1 ép dây 2 và dây 1 ở ngăn 3. Chỗ khác thì phải đổi ngón; đó là bước hoàn thiện bình thường, không phải lỗi ở Buổi 3.' },
        { b: 'h', text: 'Điệp khúc và cấu trúc bài' },
        { b: 'p', text: 'Phần ô 18–33 dài 16 ô, gồm hai nửa 8 ô giống nhau ở bảy ô đầu (Am F G C Am Dm …) và khác ở nửa cuối. Cấu trúc này gợi ý đó là Chorus (điệp khúc). Còn ô 34–41 hát lại câu tên bài nên gọi là đoạn kết (có tính chất Refrain). Việc đặt tên đoạn là gợi ý của giáo án, Owner xác nhận.' },
        { b: 'callout', label: 'CẦN OWNER XEM LẠI', text: 'Ô 32 (hợp âm F, giai điệu Đô – Mi – La – Sol♯) nghi ngờ trong nguồn. Giữ nguyên, chưa sửa. Bản phác 2 bè ở ô 18–25 chưa được người chơi kiểm từng thế tay.' },
      ],
    },
    {
      kind: 'assignment',
      items: [
        { label: 'Bài 1.', text: 'Đàn bè 2 (Bass + hợp âm chèn) của ô 18–25 riêng, thật đều.' },
        { label: 'Bài 2.', text: 'Ghép bè 1 + bè 2 từng nhóm 2 ô, rồi cả 8 ô, tempo ♩ = 60.' },
        { label: 'Bài 3.', text: 'Tự ghép ba tầng cho 2–4 ô ở điệp khúc nửa 2; ghi "Tôi chọn … vì…".' },
        { label: 'Bài 4.', text: 'Điền bảng Bass cho ô 26–31 và ô 33 (tự tìm nốt thấp nhất của melody, tự chọn Bass).' },
      ],
      message: 'Hai bạn có thể có hai bản ghép khác nhau cho cùng một điệp khúc. Mang lý do đến lớp.',
    },
    {
      kind: 'checklist',
      items: [
        'Tôi đọc được cấu trúc hợp âm điệp khúc.',
        'Tôi chọn Bass dưới nốt thấp nhất của melody.',
        'Tôi biết ô nào nốt gốc bị trùng melody và đã đổi.',
        'Tôi chèn hợp âm đúng chỗ trống.',
        '⭐ Tôi nói được vì sao mình ghép như vậy.',
      ],
    },
    { kind: 'studentNotes', title: 'Tôi ghép Bass và hợp âm này vì…', lines: 8 },
  ],
}
