// ── SOLO-01 · CHẶNG 2 · BUỔI 3/8 — hệ thống đánh số là BUỔI 11 ──
// Chủ đề: Xếp ngón (Fingering) — xếp ngón tay trái, chọn vị trí và thế tay thuận lợi.
// BẢN PHỐI NÂNG MỘT QUÃNG 8 (works.ts): melody trải từ ngăn 1 đến ngăn 12 trên dây 1–2 → cần các Vị trí I · III · V · VII · IX và nhiều lần đổi vị trí.
// Quy tắc "một ngăn – một ngón" áp dụng TRONG MỘT VỊ TRÍ. Vị trí từng ô lấy từ works.ts (cdxFingered), chọn ít lần đổi nhất cho cả bài.
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
        { label: 'Buổi 2 đã có', items: ['Nốt Bass dưới melody.', 'Bass ở dây 6–5, chừa dây 4–2 cho hợp âm.'] },
        { label: 'Buổi 3 thêm', items: ['Xếp ngón tay trái cho cả câu melody.', 'Chọn vị trí (Position) và nhìn trước ngón kế tiếp.'] },
      ],
      message: 'Ở Chặng 1 bạn đã xếp ngón cho từng câu ngắn. Giờ ta nhìn cả bài: một bộ ngón sẽ còn phải chung sống với Bass và hợp âm ở các buổi sau.',
    },
    {
      kind: 'objectives',
      title: 'Cuối buổi, bạn làm được',
      items: [
        'Hiểu khái niệm Vị trí (Position): ngón 1 ở ngăn nào thì gọi tên vị trí theo ngăn đó. Melody của bài dùng Vị trí I, III, V, VII và IX.',
        'Áp dụng quy tắc một ngăn – một ngón TRONG MỘT VỊ TRÍ và biết khi nào phải đổi vị trí.',
        'Nhìn trước ngón kế tiếp để tay trái không phải nhảy.',
        'Nhận ra nốt cần giữ ngón (Guide Finger) khi chuyển hợp âm hoặc đổi vị trí.',
        '⭐ QUAN TRỌNG NHẤT — Tự xếp ngón cho một câu và nói được vì sao.',
      ],
    },
    // NHỊP HỌC (đề xuất): 11.1 trắc nghiệm → 11.2 trắc nghiệm → 11.3 video + chữ.
    {
      kind: 'note',
      title: 'Nhịp 1 · Vị trí (Position) và quy tắc một ngăn – một ngón',
      text: 'Phần 1 — Làm ngay: đàn ô 1–8 theo ngón đã ghi trên bản nhạc. Kết thúc nhịp: Bài trả 11.1 (trắc nghiệm).',
    },
    {
      kind: 'score',
      subtitle: 'Phần 1 — Làm ngay',
      title: 'Ô 1–8 với ngón tay trái đã ghi',
      lead: 'Mỗi vị trí phủ bốn ngăn liền nhau: ngón 1 giữ ngăn đầu, ngón 2 ngăn kế, ngón 3 ngăn kế nữa, ngón 4 ngăn cuối. Vị trí I phủ ngăn 1–4; Vị trí V phủ ngăn 5–8. Dây buông không ghi ngón. (Ngón 1 = trỏ, 2 = giữa, 3 = áp út, 4 = út.)',
      tempo: 'Tempo: ♩ = 60',
      tex: cdxFingered(1, 8),
      marks: [
        { at: 'Ô 1', text: 'dịch từ Vị trí I (Đô dây 2 ngăn 1, Sol ngăn 3) lên Vị trí V (La ngăn 5)' },
        { at: 'Ô 3', text: 'Vị trí III cho Rê và Mi (dây 2 ngăn 3 và ngăn 5; Mi → Rê luyến CÙNG dây), về Vị trí I cho Đô (ngăn 1), lại Vị trí III cho Rê, rồi La ngăn 5 bằng ngón 3' },
        { at: 'Ô 4', text: 'nốt tròn Mi dây buông: tay trái hoàn toàn rảnh — chỗ dịch về Vị trí I' },
        { at: 'Ô 7', text: 'Vị trí I (Mi → Fa) rồi dịch lên Vị trí V cho La – Đô trong chùm ba cuối ô' },
      ],
      guidance: [
        'Trong một vị trí, mỗi ngón "sở hữu" một ngăn: tay trái không phải nhảy.',
        'Đổi vị trí ở chỗ có dây buông hoặc nốt dài; nhìn trước để biết sắp dịch.',
        'Đặt ngón xuống ngay khi cần, nhấc ngay khi xong — không giữ thừa.',
        'Nghe: nốt nào bị đứt tiếng vì nhấc ngón sớm? Nốt nào bị chồng tiếng vì nhấc trễ?',
      ],
    },
    {
      kind: 'recap',
      title: 'Bốn khái niệm cần nhớ',
      steps: [
        { label: 'Vị trí (Position)', items: ['Gọi theo ngăn mà ngón 1 đang ở.', 'Vị trí I: ngón 1 ở ngăn 1, phủ ngăn 1–4. Vị trí V: ngón 1 ở ngăn 5, phủ ngăn 5–8.'] },
        { label: 'Một ngăn – một ngón', items: ['Trong một vị trí: ngăn đầu → ngón 1, ngăn kế → ngón 2, rồi ngón 3, ngón 4.', 'Là quy tắc mặc định; phá quy tắc khi có lý do (nối nốt, chuẩn bị ngón).'] },
        { label: 'Giữ ngón (Guide Finger)', items: ['Ngón nằm yên trên dây khi các nốt kế tiếp vẫn cần nó.', 'Làm tay trái ít di chuyển và tiếng nối mượt.'] },
        { label: 'Đổi vị trí (Position Shift)', items: ['Dịch cả bàn tay lên hoặc xuống cần đàn.', 'Làm ở dây buông, nốt dài, hoặc bằng ngón dẫn trượt sang nốt mới.'] },
      ],
      message: 'Giai điệu của bài (bản phối quãng 8 cao) trải từ ngăn 1 đến ngăn 12 trên dây 1–2, nên phải đổi vị trí nhiều lần. Đó là lý do bài hợp để học xếp ngón.',
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
      text: 'Đàn đoạn dài hơn (ô 18–25), nhìn trước ngón kế tiếp, tìm chỗ cần giữ ngón và chỗ đổi vị trí. Kết thúc nhịp: Bài trả 11.2 (trắc nghiệm).',
    },
    {
      kind: 'layers',
      title: 'Ô 18–19: cùng đoạn, có và chưa có ngón',
      lead: 'Hai ô đầu điệp khúc nhảy giữa nốt thấp và nốt cao trên dây 1: La (ngăn 5), Mi (ngăn 12), Rê (ngăn 10), Đô (ngăn 8). Nhìn ngón giúp tay trái biết trước chỗ cần đến.',
      layers: [
        { label: 'Chưa ghi ngón', what: 'Chỉ có nốt — bạn tự chọn ngón mỗi lần đàn, dễ lúng túng khi nhảy từ ngăn 5 lên ngăn 12.', tex: cdxTex(18, 19) },
        { label: 'Có ngón', what: 'Ô 18: Vị trí V cho La (ngăn 5, ngón 1), rồi Vị trí IX cho Mi (ngăn 12, ngón 4) và Rê (ngăn 10, ngón 2). Ô 19: Vị trí V cho Đô và La, rồi Vị trí VII cho Rê (ngón 4) và Đô (ngón 2).', tex: cdxFingered(18, 19), current: true },
      ],
      note: 'Hai ô này đi qua ba vùng: Vị trí V, IX và VII. Không có dây buông để nghỉ, nên dịch tay bằng ngón dẫn: ngón vừa đàn nốt cũ đi trước, các ngón khác theo sau.',
    },
    {
      kind: 'score',
      subtitle: 'Thực hành',
      title: 'Điệp khúc nửa đầu: ô 18–25',
      lead: 'Am – F – G – C – Am – Dm – C – Am. Chú ý: ô 20 mở đầu bằng Sol (dây 1 ngăn 3); ô 21 mở bằng Mi dây 1 buông và có một phách nghỉ — dùng để chuẩn bị ngón.',
      tempo: 'Tempo: ♩ = 60',
      tex: cdxFingered(18, 25),
      marks: [
        { at: 'Ô 18–19', text: 'nhảy giữa ngăn 5, 8, 10, 12 trên dây 1: Vị trí V → IX → V → VII' },
        { at: 'Ô 21', text: 'Mi buông và phách nghỉ: tay rảnh, chuẩn bị Vị trí V cho ô 22' },
        { at: 'Ô 24', text: 'Đô (dây 2 ngăn 1) lặp ba lần rồi Fa (dây 1 ngăn 1) — cùng một ngón 1 chuyển từ dây 2 sang dây 1' },
      ],
      guidance: [
        'Tìm những chỗ cùng một ngón phải đi từ dây này sang dây khác (ô 24): ngón 1 chuyển lên dây 1, đừng nhấc quá cao.',
        'Tìm chỗ nhấc ngón hoặc dịch vị trí sớm: dây buông (ô 21) là lúc tay trái được nghỉ.',
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
            '2. Chọn vị trí giữ tay (một vị trí có đủ không, hay phải đổi vị trí?).',
            '3. Ghi ngón cho từng nốt.',
            '4. Đàn thử: chỗ nào tay trái phải nhảy hoặc nhấc quá cao?',
            '5. Sửa và ghi: "Tôi xếp ngón này vì…"',
          ],
        },
        {
          title: 'Ô 34–41 — đoạn kết (đã ghi ngón mặc định)',
          composer: 'Châu Kỳ & Hồ Đình Phương · giọng Am',
          note: 'Đoạn kết đi lại giữa Vị trí I, III và V. Đàn với ngón mặc định, đổi chỗ nào bạn thấy thuận hơn.',
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
        { b: 'p', text: 'Trên guitar, cùng một cao độ thường có hai hoặc ba chỗ bấm. Ví dụ La4 (nốt hay gặp của bài) có thể là dây 1 ngăn 5, dây 2 ngăn 10 hoặc dây 3 ngăn 14. Bản phối này ưu tiên dây 1 (dây 2 khi nốt thấp): cùng một dây thì luyến và trượt tự nhiên, và dây 6–2 bên dưới còn trống cho Bass và hợp âm. Mi4 có thể là dây 1 buông (tay trái rảnh) hoặc dây 2 ngăn 5 (nếu muốn giữ tay ở Vị trí V).' },
        { b: 'h', text: 'Xếp ngón và hợp âm sắp tới' },
        { b: 'p', text: 'Sang Buổi 4–6 bạn sẽ thêm hợp âm dưới melody ở ngăn cao. Thế Am xx755x dùng ngón 1 ép ngăn 5 trên dây 3 và dây 2, ngón 3 ở ngăn 7 dây 4. Khi melody là La dây 1 ngăn 5 (ngón 1 ở Vị trí V), chính ngón 1 đó ép luôn dây 1: tay trái thành thế xx7555, một ngón ép ba dây. Đó là lý do nhiều nốt La được xếp ngón 1: xếp ngón của melody và của hợp âm hỗ trợ nhau. Vẫn có thể phải điều chỉnh khi ghép.' },
        { b: 'h', text: 'Đổi vị trí (Position Shift)' },
        { b: 'p', text: 'Ba cách dịch tay: (1) ở dây buông hoặc phách nghỉ, khi tay trái rảnh; (2) trượt bằng ngón dẫn — ngón vừa đàn nốt cũ trượt sang nốt mới rồi cả bàn tay theo; (3) trong lúc một nốt dài còn vang. Tránh dịch xa giữa hai nốt liền nhau không có chỗ thở.' },
        { b: 'callout', label: 'LƯU Ý CHUYÊN MÔN', text: 'Không có phương án xếp ngón "duy nhất đúng". Tiêu chí là: đúng cao độ, tay trái thoải mái, ghép được với các tầng khác. Phương án mặc định trong giáo án chỉ là điểm xuất phát.' },
        { b: 'callout', label: 'CẦN OWNER XEM LẠI', text: 'Phương án ngón trong giáo án chọn các vị trí I · III · V · VII · IX sao cho ít lần đổi vị trí nhất cho cả bài, rồi gán ngón theo một ngăn – một ngón trong từng vị trí (tự động); chưa được người chơi kiểm từng ô. Ô 32 trong nguồn ghi hợp âm F nhưng giai điệu giống Am → E; giữ nguyên nguồn, cần rà soát chuyên môn.' },
      ],
    },
    {
      kind: 'assignment',
      items: [
        { label: 'Bài 1.', text: 'Đàn ô 1–8 và ô 18–25 theo ngón đã ghi, chậm, 5 phút mỗi ngày.' },
        { label: 'Bài 2.', text: 'Đánh dấu trên bản in những chỗ tay trái phải nhảy xa hoặc nhấc ngón quá cao.' },
        { label: 'Bài 3.', text: 'Xếp lại ngón cho ô 18–19 theo ý bạn, ghi "Tôi xếp ngón này vì…".' },
        { label: 'Bài 4.', text: 'Tự xếp ngón cho ô 34–41 (đoạn kết) và so với phương án mặc định.' },
      ],
      message: 'Hai bạn có thể xếp ngón khác nhau cho cùng một câu. Mang lý do đến lớp.',
    },
    {
      kind: 'checklist',
      items: [
        'Tôi giải thích được Vị trí (Position) và biết đổi vị trí khi cần.',
        'Tôi áp dụng được quy tắc một ngăn – một ngón.',
        'Tôi nhìn trước ngón kế tiếp ở những chỗ đổi dây.',
        'Tôi biết chỗ nào nên giữ ngón.',
        '⭐ Tôi nói được vì sao mình xếp ngón như vậy.',
      ],
    },
    { kind: 'studentNotes', title: 'Tôi xếp ngón này vì…', lines: 8 },
  ],
}

