// ── SOLO-01 · CHẶNG 2 · BUỔI 6/8 — hệ thống đánh số là BUỔI 14 ──
// Chủ đề: Ghép Bass và hợp âm cho điệp khúc — phối hợp Bass, hợp âm và Melody.
// Điệp khúc (ĐỀ XUẤT từ cấu trúc hợp âm + lời, chờ Owner xác nhận): ô 18–25 (nửa 1) và ô 26–33 (nửa 2); hai nửa giống nhau 7 ô đầu, khác ở ô 31–33.
// ⚠️ Ô 32: nguồn ghi hợp âm F nhưng giai điệu là Đô – Mi – La – Sol♯ (giống Am → E). GIỮ NGUYÊN NGUỒN, đánh dấu cần rà soát; KHÔNG để cản các ô khác.
// Bè 2 trong ví dụ 2 bè = BẢN PHÁC dựng cơ học theo quy tắc Buổi 2 (Bass dưới melody) và Buổi 4 (hợp âm rút gọn), chưa phải bản phối đã xác nhận.
import type { LessonDoc } from '../../../lesson/lessonTypes'
import { CDX_BARS, cdxFingered } from './works'

const twoVoice = (v1: string[], v2: string[]): string => `\\ts 4 4\n.\n\\voice\n${v1.join('\n')}\n\\voice\n${v2.join('\n')}`

const V2_NUA1 = [
  '0.5.4 2.4.4 0.6.2 |',                       // ô 18 Am
  '1.6.4 3.5.4 1.6.2 |',                       // ô 19 F: Fa dây 6 ngăn 1 · Đô dây 5 ngăn 3
  '3.6.4 0.4.4 3.6.2 |',                       // ô 20 G: Sol dây 6 ngăn 3 · Rê dây 4 buông
  '3.5.4 3.6.4 (0.3 1.2 0.1).4 3.5.4 |',       // ô 21 C: Bass Đô/Sol · phách 3 (melody nghỉ) chèn hợp âm C xxx010
  '0.5.4 0.6.4 0.5.2 |',                       // ô 22 Am
  '0.5.4 1.6.4 0.5.2 |',                       // ô 23 Dm/A · Dm/F (Rê dây 4 sẽ trùng melody)
  '3.6.4 0.6.4 3.6.4 0.6.4 |',                 // ô 24 C/G · C/E (Đô dây 5 sẽ trùng melody)
  '0.6.2 (2.3 1.2 0.1).4 0.6.4 |',             // ô 25 Am/E · phách 3 (melody nghỉ) hợp âm Am xxx210
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
        'Chọn Bass cho từng ô dưới nốt thấp nhất của melody.',
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
      title: 'Bảng Bass cho điệp khúc (nốt thấp nhất của melody → Bass gợi ý)',
      blocks: [
        { b: 'p', text: 'Nốt thấp nhất của melody lấy từ MusicXML. Bass gợi ý theo quy tắc Buổi 2: thuộc hợp âm, thấp hơn nốt thấp nhất của melody. Cột cuối cho biết ô nào nốt gốc VI PHẠM nên phải đổi.' },
        { b: 'table', rows: [
          ['Ô', 'Hợp âm', 'Melody thấp nhất', 'Bass gợi ý', 'Gốc có dùng được?'],
          ['18, 26', 'Am', 'La3 (dây 3 ngăn 2)', 'La dây 5 buông (hoặc Mi dây 6)', 'Được'],
          ['19, 27', 'F', 'La3', 'Fa dây 6 ngăn 1 · Đô dây 5 ngăn 3', 'Được'],
          ['20, 28', 'G', 'Sol3 (dây 3 buông)', 'Sol dây 6 ngăn 3 · Rê dây 4 buông', 'Được'],
          ['21, 29', 'C', 'Mi3 (dây 4 ngăn 2)', 'Đô dây 5 ngăn 3 · Sol dây 6 ngăn 3', 'Được'],
          ['22, 30', 'Am', 'Mi3', 'La dây 5 buông · Mi dây 6 buông', 'Được'],
          ['23, 31', 'Dm', 'Rê3 (dây 4 buông)', 'La dây 5 buông · Fa dây 6 ngăn 1', 'KHÔNG: Rê trùng melody'],
          ['24', 'C', 'Đô3 (dây 5 ngăn 3)', 'Sol dây 6 ngăn 3 · Mi dây 6 buông', 'KHÔNG: Đô trùng melody'],
          ['25', 'Am', 'La2 (dây 5 buông)', 'Mi dây 6 buông', 'KHÔNG: La trùng melody'],
          ['32', 'F (nguồn ghi)', 'Đô3', 'Fa dây 6 ngăn 1 (nếu giữ F)', 'Chờ rà soát — xem cảnh báo'],
          ['33', 'E7', 'Si3 (dây 2 buông)', 'Mi dây 6 buông', 'Được'],
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
        question: 'Ô 23 có hợp âm Dm, nốt thấp nhất của melody là Rê (dây 4 buông). Bass nào hợp lý hơn nốt gốc Rê dây 4 buông?',
        options: [
          { id: 'a', text: 'Vẫn dùng Rê dây 4 buông vì Bass luôn là nốt gốc' },
          { id: 'b', text: 'La dây 5 buông (Dm/A) hoặc Fa dây 6 ngăn 1 (Dm/F): vẫn thuộc hợp âm Dm và thấp hơn melody' },
          { id: 'c', text: 'Si dây 5 ngăn 2' },
          { id: 'd', text: 'Bỏ hẳn hợp âm Dm' },
        ],
        hint: 'Đổi sang nốt KHÁC của hợp âm Dm (Rê – Fa – La) mà thấp hơn Rê dây 4 buông.',
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
          note: 'Bè 2 dựng theo quy tắc: Bass dưới melody; hợp âm chỉ chèn ở phách melody nghỉ (ô 21, ô 25). Ô 23, 24, 25 dùng Bass đổi vì nốt gốc trùng melody. VÍ DỤ PHÁC THẢO — chờ Owner xác nhận.',
          barsPerRow: 2,
          tex: NUA1_SKETCH,
          marks: [
            { at: 'Ô 21', text: 'phách 3: melody nghỉ → hợp âm C xxx010 (Sol – Đô – Mi)' },
            { at: 'Ô 23', text: 'Dm/A và Dm/F: tránh Rê trùng melody' },
            { at: 'Ô 24', text: 'C/G và C/E: tránh Đô trùng melody' },
            { at: 'Ô 25', text: 'Am/E; phách 3 (melody nghỉ) hợp âm Am xxx210' },
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
      lead: 'Cùng một ô 18 (Am) qua các tầng: melody một mình → thêm Bass → (ô sau) thêm hợp âm ở chỗ trống.',
      layers: [
        { label: 'Tầng 1', what: 'Melody một mình (Buổi 1).', tex: `\\ts 4 4\n.\n${CDX_BARS[17]}` },
        { label: 'Tầng 2', what: 'Thêm Bass dưới melody (Buổi 2): La – Mi – Mi dây 6 buông.', tex: twoVoice([CDX_BARS[17]], ['0.5.4 2.4.4 0.6.2 |']), current: true },
      ],
      note: 'Ô 18 melody đi liên tục nên chỉ thêm Bass. Tầng hợp âm chỉ chèn ở ô 21 và 25, nơi melody nghỉ.',
    },
    {
      kind: 'checkpoint',
      id: '14.2',
      title: 'Bài trả 14.2 — Ghép ba tầng',
      required: true,
      accepts: ['quiz'],
      quiz: {
        mode: 'single',
        question: 'Vì sao bản phác chèn hợp âm ở phách 3 của ô 21 và ô 25 mà không chèn ở ô 18?',
        options: [
          { id: 'a', text: 'Vì ô 21 và ô 25 melody nghỉ ở phách 3, còn ô 18 melody đi liên tục nên chỉ để Bass' },
          { id: 'b', text: 'Vì ô 18 không có hợp âm' },
          { id: 'c', text: 'Vì hợp âm chỉ được chèn ở phách 3' },
          { id: 'd', text: 'Vì ô 21 và 25 là nốt cao nhất của bài' },
        ],
        hint: 'Hãy nhìn phách nghỉ trong melody ô 21 và ô 25.',
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
          note: 'Ô 26–31 giống ô 18–23 nên dùng lại bản phác nếu bạn muốn. Ô 32 CẦN RÀ SOÁT (xem cảnh báo) — bạn có thể bỏ qua ô này khi làm bài. Ô 33 là E7 với melody Si dây 2 buông.',
          barsPerRow: 2,
          tex: cdxFingered(26, 33),
          guidance: [
            '1. Chọn 2–4 ô (gợi ý ô 26–29 hoặc 30–31 và 33).',
            '2. Bass: dưới nốt thấp nhất của melody, thuộc hợp âm.',
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
        { b: 'p', text: 'Khi thêm Bass và hợp âm, ngón tay trái phải làm việc ở nhiều dây cùng lúc, nên xếp ngón của melody ở Buổi 3 có thể phải đổi. Ví dụ ô 18: La dây 3 ngăn 2 cùng lúc với Mi dây 4 ngăn 2 (thế giống Am), nên ngón 2–3 sẽ chia khác phương án mặc định. Đây là bước hoàn thiện bình thường, không phải lỗi ở Buổi 3.' },
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
