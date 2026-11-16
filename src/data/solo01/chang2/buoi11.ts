// ── SOLO-01 · CHẶNG 2 · BUỔI 3/8 — hệ thống đánh số là BUỔI 11 ──
// Chủ đề: Xếp ngón (Fingering) — xếp ngón tay trái, chọn vị trí và thế tay thuận lợi.
// SỰ THẬT TỪ NGUỒN (đã kiểm trên MusicXML): mọi nốt melody của bài nằm trong ngăn 0–3 (Vị trí I) → quy tắc "một ngăn – một ngón" dùng được cho cả bài.
// Phương án ngón trong giáo án là MẶC ĐỊNH để học; có nhiều phương án đúng.
import type { LessonDoc } from '../../../lesson/lessonTypes'
import { cdxFingered, cdxTex } from './works'

export const SOLO01_BUOI11: LessonDoc = {
  meta: {
    programCode: 'SOLO-01',
    programName: 'SOLO GUITAR CĂN BẢN',
    sessionNo: 11,
    title: 'Chặng 2 – Buổi 3/8 · Xếp ngón (Fingering)',
    stageLabel: 'Chặng 2 · Solo Bolero',
    backHref: '/solo01',
  },
  sections: [
    {
      kind: 'recap',
      title: 'Từ Buổi 2 sang Buổi 3',
      steps: [
        { label: 'Buổi 2 đã có', items: ['Nốt Bass dưới melody.', 'Biết đổi Bass khi nốt gốc va melody.'] },
        { label: 'Buổi 3 thêm', items: ['Xếp ngón tay trái cho cả câu melody.', 'Chọn vị trí (Position) và nhìn trước ngón kế tiếp.'] },
      ],
      message: 'Ở Chặng 1 bạn đã xếp ngón cho từng câu ngắn. Giờ ta nhìn cả bài: một bộ ngón sẽ còn phải chung sống với Bass và hợp âm ở các buổi sau.',
    },
    {
      kind: 'objectives',
      title: 'Cuối buổi, bạn làm được',
      items: [
        'Hiểu khái niệm Vị trí (Position) và nhận ra cả melody bài nằm ở Vị trí I.',
        'Áp dụng quy tắc một ngăn – một ngón và biết khi nào được phá quy tắc.',
        'Nhìn trước ngón kế tiếp để tay trái không phải nhảy.',
        'Nhận ra nốt cần giữ ngón (Guide Finger) khi chuyển hợp âm.',
        '⭐ QUAN TRỌNG NHẤT — Tự xếp ngón cho một câu và nói được vì sao.',
      ],
    },
    // NHỊP HỌC (đề xuất): 11.1 trắc nghiệm → 11.2 trắc nghiệm → 11.3 video + chữ.
    {
      kind: 'note',
      title: 'Nhịp 1 · Vị trí I và quy tắc một ngăn – một ngón',
      text: 'Phần 1 — Làm ngay: đàn ô 1–8 theo ngón đã ghi trên bản nhạc. Kết thúc nhịp: Bài trả 11.1 (trắc nghiệm).',
    },
    {
      kind: 'score',
      subtitle: 'Phần 1 — Làm ngay',
      title: 'Ô 1–8 với ngón tay trái đã ghi',
      lead: 'Vị trí I: ngón 1 giữ ngăn 1, ngón 2 giữ ngăn 2, ngón 3 giữ ngăn 3, ngón 4 giữ ngăn 4. Dây buông không ghi ngón. (Ngón 1 = trỏ, 2 = giữa, 3 = áp út, 4 = út.)',
      tempo: 'Tempo: ♩ = 60',
      tex: cdxFingered(1, 8),
      guidance: [
        'Mỗi ngón "sở hữu" một ngăn: tay trái gần như không phải nhảy.',
        'Đặt ngón xuống ngay khi cần, nhấc ngay khi xong — không giữ thừa.',
        'Nghe: nốt nào bị đứt tiếng vì nhấc ngón sớm? Nốt nào bị chồng tiếng vì nhấc trễ?',
      ],
    },
    {
      kind: 'recap',
      title: 'Ba khái niệm cần nhớ',
      steps: [
        { label: 'Vị trí (Position)', items: ['Gọi theo ngăn mà ngón 1 đang ở.', 'Vị trí I: ngón 1 ở ngăn 1; tay trái phủ ngăn 1–4 (và dây buông).'] },
        { label: 'Một ngăn – một ngón', items: ['Ngăn n → ngón n (trong ngăn 1–4).', 'Là quy tắc mặc định; phá quy tắc khi có lý do (nối nốt, chuẩn bị ngón).'] },
        { label: 'Giữ ngón (Guide Finger)', items: ['Ngón nằm yên trên dây khi các nốt kế tiếp vẫn cần nó.', 'Làm tay trái ít di chuyển và tiếng nối mượt.'] },
      ],
      message: 'Nguồn nhạc của bài không có nốt nào cao hơn ngăn 3 — nên toàn bộ melody ở Vị trí I. Đó là lý do bài hợp để học xếp ngón.',
    },
    {
      kind: 'checkpoint',
      id: '11.1',
      title: 'Bài trả 11.1 — Vị trí và quy tắc ngón',
      required: true,
      accepts: ['quiz'],
      quiz: {
        mode: 'single',
        question: 'Theo quy tắc một ngăn – một ngón ở Vị trí I, một nốt bấm ở ngăn 3 nên dùng ngón nào?',
        options: [
          { id: 'a', text: 'Ngón 1 (trỏ)' },
          { id: 'b', text: 'Ngón 2 (giữa)' },
          { id: 'c', text: 'Ngón 3 (áp út)' },
          { id: 'd', text: 'Ngón 4 (út)' },
        ],
        hint: 'Ở Vị trí I, ngón nào đứng ở ngăn nào thì số ngón bằng số ngăn.',
      },
    },
    {
      kind: 'note',
      title: 'Nhịp 2 · Nhìn cả câu: điệp khúc và chuyển hợp âm',
      text: 'Đàn đoạn dài hơn (ô 18–25), nhìn trước ngón kế tiếp và tìm chỗ cần giữ ngón. Kết thúc nhịp: Bài trả 11.2 (trắc nghiệm).',
    },
    {
      kind: 'layers',
      title: 'Ô 18–19: cùng đoạn, có và chưa có ngón',
      lead: 'Hai ô đầu điệp khúc đi qua dây 3, dây 1, dây 2: nhiều lần đổi dây. Nhìn ngón giúp tay trái biết trước chỗ cần đến.',
      layers: [
        { label: 'Chưa ghi ngón', what: 'Chỉ có nốt — bạn tự chọn ngón mỗi lần đàn, dễ bị lúng túng khi đổi dây.', tex: cdxTex(18, 19) },
        { label: 'Có ngón', what: 'Theo quy tắc một ngăn – một ngón: La (3/2) ngón 2 · Đô (2/1) ngón 1 · Rê (2/3) ngón 3.', tex: cdxFingered(18, 19), current: true },
      ],
      note: 'Cả hai ô đều chỉ dùng ngăn 0–3, nên có thể giữ tay ở Vị trí I trọn đoạn.',
    },
    {
      kind: 'score',
      subtitle: 'Thực hành',
      title: 'Điệp khúc nửa đầu: ô 18–25',
      lead: 'Am – F – G – C – Am – Dm – C – Am. Chú ý: ô 20 mở đầu bằng Sol dây 3 buông; ô 21 có một phách nghỉ — dùng để chuẩn bị ngón.',
      tempo: 'Tempo: ♩ = 60',
      tex: cdxFingered(18, 25),
      marks: [
        { at: 'Ô 18–19', text: 'đổi dây nhiều: La (dây 3) → Mi (dây 1 buông) → Rê (dây 2)' },
        { at: 'Ô 21', text: 'phách nghỉ: chỗ chuẩn bị ngón cho ô 22' },
        { at: 'Ô 24', text: 'Đô (dây 5 ngăn 3) lặp ba lần rồi Fa (dây 4 ngăn 3) — cùng một ngón 3 chuyển dây' },
      ],
      guidance: [
        'Tìm những chỗ cùng một ngón phải đi từ dây này sang dây khác (ô 24): ngón 3 chuyển xuống, đừng nhấc quá cao.',
        'Tìm chỗ nhấc ngón được sớm: dây buông (ô 20) là lúc ngón tay trái được nghỉ.',
        'Chưa cần nhanh. Đàn chậm cho đến khi tay trái không "nhảy".',
      ],
    },
    {
      kind: 'checkpoint',
      id: '11.2',
      title: 'Bài trả 11.2 — Nhìn trước ngón',
      required: true,
      accepts: ['quiz'],
      quiz: {
        mode: 'single',
        question: 'Trong lúc đàn một nốt dây buông, tay trái được rảnh. Cách dùng khoảng rảnh đó tốt nhất là gì?',
        options: [
          { id: 'a', text: 'Đặt sẵn ngón cho nốt kế tiếp' },
          { id: 'b', text: 'Nhấc toàn bộ tay trái ra khỏi cần đàn' },
          { id: 'c', text: 'Giữ nguyên ngón cũ cho đến hết ô' },
          { id: 'd', text: 'Không làm gì, chờ nốt tới rồi mới đặt ngón' },
        ],
        hint: 'Đây là ý "nhìn trước": ngón hôm nay chuẩn bị cho nốt tiếp theo.',
      },
    },
    {
      kind: 'note',
      title: 'Nhịp 3 · Tự xếp ngón và giải thích',
      text: 'Xếp ngón cho ô 18–19 (hoặc đoạn bạn chọn) theo ý mình, đàn và thu video. Kết thúc nhịp: Bài trả 11.3 (video + giải thích).',
    },
    {
      kind: 'repertoire',
      title: 'Phần thực hành — xếp ngón của bạn',
      candidates: ['Con Đường Xưa em Đi — tự xếp ngón cho một câu'],
      status: 'ready',
      pieces: [
        {
          title: 'Ô 18–19 — chưa ghi ngón',
          composer: 'Châu Kỳ & Hồ Đình Phương · giọng Am',
          note: 'Bản này chưa ghi ngón. Bạn có thể giữ phương án mặc định hoặc đổi, miễn nói được vì sao.',
          barsPerRow: 2,
          tex: cdxTex(18, 19),
          guidance: [
            '1. Nhìn cả câu: nốt thấp nhất và cao nhất ở ngăn nào?',
            '2. Chọn vị trí giữ tay (Vị trí I có đủ không?).',
            '3. Ghi ngón cho từng nốt.',
            '4. Đàn thử: chỗ nào tay trái phải nhảy hoặc nhấc quá cao?',
            '5. Sửa và ghi: "Tôi xếp ngón này vì…"',
          ],
        },
        {
          title: 'Ô 34–41 — đoạn kết (đã ghi ngón mặc định)',
          composer: 'Châu Kỳ & Hồ Đình Phương · giọng Am',
          note: 'Đoạn kết cũng nằm hoàn toàn trong ngăn 0–3. Đàn với ngón mặc định, đổi chỗ nào bạn thấy thuận hơn.',
          barsPerRow: 2,
          tex: cdxFingered(34, 41),
        },
      ],
      annotationTypes: ['Ngón tay trái', 'Vị trí', 'Chỗ giữ ngón', 'Lý do chọn', 'Ghi chú của giáo viên'],
    },
    {
      kind: 'checkpoint',
      id: '11.3',
      title: 'Bài trả 11.3 — Xếp ngón của tôi',
      prompt: 'Chơi ô 18–19 Con Đường Xưa em Đi theo cách xếp ngón của bạn (quay rõ tay trái nếu được). Không cần hoàn hảo. Viết ngắn: ‘Tôi xếp ngón … ở chỗ … vì…’. Tiêu chí Đạt: (1) ngón đúng với nốt (không ngăn nào dùng ngón làm hỏng cao độ); (2) tay trái không nhảy và không nhấc quá cao; (3) giải thích có lý do về vị trí hoặc ngón kế tiếp.',
      required: true,
      accepts: ['video_link', 'text'],
    },
    {
      kind: 'study',
      tag: 'Phần 2',
      title: 'Phụ lục hiểu sâu — Xếp ngón',
      blocks: [
        { b: 'h', text: 'Ba nguyên tắc chọn ngón' },
        { b: 'ol', items: [
          'Tiết kiệm di chuyển: chọn bộ ngón sao cho tay trái đi quãng ngắn nhất.',
          'Nhìn trước: ngón của nốt hiện tại giúp ngón của nốt kế tiếp đến chỗ sớm.',
          'Giữ ngón khi có thể: ngón nào còn cần ở nốt kế thì để yên trên dây.',
        ] },
        { b: 'h', text: 'Cùng một nốt có thể bấm ở nhiều chỗ' },
        { b: 'p', text: 'Trên guitar, cùng một cao độ thường có hai hoặc ba vị trí bấm. Ví dụ La3 có thể là dây 3 ngăn 2 (Vị trí I), hoặc dây 4 ngăn 7. Bài này chọn Vị trí I cho cả melody vì nốt thấp, gần dây buông, dễ ghép Bass và hợp âm ở các buổi sau.' },
        { b: 'h', text: 'Xếp ngón và hợp âm sắp tới' },
        { b: 'p', text: 'Sang Buổi 4–6 bạn sẽ thêm hợp âm dưới melody. Thế Am đầy đủ (x02210) dùng ngón 2 ở dây 4, ngón 3 ở dây 3, ngón 1 ở dây 2. Nếu melody xếp ngón 2 cho La dây 3 ngăn 2, khi ghép hợp âm có thể phải đổi cho khớp thế bấm (ngón 3 cho La dây 3). Vì thế xếp ngón cho melody là bước đầu, có thể điều chỉnh khi ghép.' },
        { b: 'callout', label: 'LƯU Ý CHUYÊN MÔN', text: 'Không có phương án xếp ngón "duy nhất đúng". Tiêu chí là: đúng cao độ, tay trái thoải mái, ghép được với các tầng khác. Phương án mặc định trong giáo án chỉ là điểm xuất phát.' },
        { b: 'callout', label: 'CẦN OWNER XEM LẠI', text: 'Phương án ngón trong giáo án sinh theo quy tắc một ngăn – một ngón (tự động); chưa được người chơi kiểm từng ô. Ô 32 trong nguồn ghi hợp âm F nhưng giai điệu giống Am → E; giữ nguyên nguồn, cần rà soát chuyên môn.' },
      ],
    },
    {
      kind: 'assignment',
      items: [
        { label: 'Bài 1.', text: 'Đàn ô 1–8 và ô 18–25 theo ngón đã ghi, chậm, 5 phút mỗi ngày.' },
        { label: 'Bài 2.', text: 'Đánh dấu trên bản in những chỗ tay trái phải nhảy hoặc nhấc ngón quá cao.' },
        { label: 'Bài 3.', text: 'Xếp lại ngón cho ô 18–19 theo ý bạn, ghi "Tôi xếp ngón này vì…".' },
        { label: 'Bài 4.', text: 'Tự xếp ngón cho ô 34–41 (đoạn kết) và so với phương án mặc định.' },
      ],
      message: 'Hai bạn có thể xếp ngón khác nhau cho cùng một câu. Mang lý do đến lớp.',
    },
    {
      kind: 'checklist',
      items: [
        'Tôi giải thích được Vị trí I.',
        'Tôi áp dụng được quy tắc một ngăn – một ngón.',
        'Tôi nhìn trước ngón kế tiếp ở những chỗ đổi dây.',
        'Tôi biết chỗ nào nên giữ ngón.',
        '⭐ Tôi nói được vì sao mình xếp ngón như vậy.',
      ],
    },
    { kind: 'studentNotes', title: 'Tôi xếp ngón này vì…', lines: 8 },
  ],
}

