// ── SOLO-01 · CHẶNG 2 · BUỔI 7/8 — hệ thống đánh số là BUỔI 15 ──
// Chủ đề: Tự dựng bài Solo Bolero — vận dụng quy trình đã học để tự xây dựng bản Solo.
// Học viên TỰ dựng một đoạn của Con Đường Xưa em Đi (gợi ý ô 2–8 hoặc ô 34–41) bằng quy trình 6 bước của Chặng 2.
// Giáo án KHÔNG đưa bản dựng mẫu: Buổi này là buổi học viên làm, giáo viên chấm. Chỉ có melody (nguồn) và bảng dựng trống.
import type { LessonDoc } from '../../../lesson/lessonTypes'
import { cdxFingered } from './works'

export const SOLO01_BUOI15: LessonDoc = {
  meta: {
    programCode: 'SOLO-01',
    programName: 'SOLO GUITAR CĂN BẢN',
    sessionNo: 15,
    title: 'Chặng 2 – Buổi 7/8 · Tự dựng bài Solo Bolero',
    stageLabel: 'Chặng 2 · Solo Bolero',
    backHref: '/solo01',
  },
  sections: [
    {
      kind: 'recap',
      title: 'Sáu bước bạn đã học — Buổi 7 là chạy cả sáu',
      steps: [
        { label: 'Bước 1–2', items: ['Melody sạch + kỹ thuật chọn (Buổi 1).', 'Bass dưới melody (Buổi 2).'] },
        { label: 'Bước 3–4', items: ['Xếp ngón tay trái (Buổi 3).', 'Hợp âm bấm tắt (Buổi 4).'] },
        { label: 'Bước 5–6', items: ['Chèn hợp âm theo mô hình Bolero (Buổi 5).', 'Ghép ba tầng và kiểm bằng tai (Buổi 6).'] },
      ],
      message: 'Hôm nay không có bản dựng mẫu. Bạn tự chạy sáu bước cho một đoạn của bài, và Thầy chấm quy trình lẫn lý do của bạn.',
    },
    {
      kind: 'objectives',
      title: 'Cuối buổi, bạn làm được',
      items: [
        'Chạy đúng thứ tự sáu bước cho một đoạn 7–8 ô.',
        'Lập một "bảng dựng" ghi lại mọi lựa chọn (kỹ thuật, Bass, ngón, thế hợp âm, chỗ chèn).',
        'Tự phát hiện và sửa chỗ melody bị chìm hoặc Bass trùng nốt.',
        'Đàn trọn đoạn do chính mình dựng.',
        '⭐ QUAN TRỌNG NHẤT — Giải thích được từng lựa chọn bằng nguyên tắc đã học.',
      ],
    },
    // NHỊP HỌC (đề xuất): 15.1 trắc nghiệm → 15.2 trắc nghiệm → 15.3 video + chữ.
    {
      kind: 'note',
      title: 'Nhịp 1 · Quy trình dựng',
      text: 'Phần 1 — Làm ngay: đọc quy trình sáu bước và chọn đoạn bạn sẽ dựng. Kết thúc nhịp: Bài trả 15.1 (trắc nghiệm).',
    },
    {
      kind: 'study',
      tag: 'Phần 1 — Làm ngay',
      title: 'Quy trình dựng Solo Bolero — sáu bước',
      blocks: [
        { b: 'ol', items: [
          'MELODY: đàn đúng cao độ, trường độ đoạn đã chọn; chọn 1–2 chỗ thêm kỹ thuật (Hammer-on, Pull-off, Slide, Vibrato…).',
          'BASS: ghi nốt thấp nhất của melody mỗi ô; chọn Bass thuộc hợp âm và THẤP HƠN nó; đổi sang quãng 5/3 khi gốc trùng hoặc cao hơn.',
          'XẾP NGÓN: chọn vị trí và ngón tay trái cho melody; để ý Guide Finger và nhìn trước.',
          'HỢP ÂM BẤM TẮT: chọn thế rút gọn cho từng hợp âm; ghi ký hiệu sáu ký tự dây 6 → 1.',
          'CHÈN THEO MÔ HÌNH BOLERO: tìm nốt dài / phách nghỉ của melody; đặt Bass – hợp âm – Bass đổi – hợp âm ở chỗ trống; chỗ đầy thì chỉ để Bass.',
          'GHÉP VÀ KIỂM: đàn từng tầng, rồi ghép; nghe melody có còn là nốt cao nhất; sửa; đàn trọn đoạn.',
        ] },
        { b: 'callout', label: 'NHẮC LẠI', text: 'Đây là quy trình của Chặng 2, không phải luật cho mọi bản nhạc. Cùng một đoạn, mỗi người sẽ ra một bản dựng khác — Thầy chấm bạn nói được vì sao, không chấm bạn giống Thầy.' },
      ],
    },
    {
      kind: 'checkpoint',
      id: '15.1',
      title: 'Bài trả 15.1 — Quy trình dựng',
      required: true,
      accepts: ['quiz'],
      quiz: {
        mode: 'single',
        question: 'Theo quy trình sáu bước của Chặng 2, sau khi đã có melody đàn sạch, bước kế tiếp là gì?',
        options: [
          { id: 'a', text: 'Chọn Bass: nốt thuộc hợp âm và thấp hơn nốt thấp nhất của melody' },
          { id: 'b', text: 'Chèn hợp âm vào mọi phách trống' },
          { id: 'c', text: 'Đổi sang một bài khác' },
          { id: 'd', text: 'Bỏ kỹ thuật, chỉ giữ nốt gốc' },
        ],
        hint: 'Thứ tự: Melody → Bass → Xếp ngón → Hợp âm bấm tắt → Chèn theo mô hình Bolero → Ghép và kiểm.',
      },
    },
    {
      kind: 'note',
      title: 'Nhịp 2 · Lập bảng dựng cho đoạn của bạn',
      text: 'Chọn đoạn, điền bảng dựng cho từng ô, rồi kiểm lại. Kết thúc nhịp: Bài trả 15.2 (trắc nghiệm).',
    },
    {
      kind: 'repertoire',
      title: 'Chọn một trong hai đoạn để dựng',
      candidates: ['Đoạn A: ô 2–8 · Am Dm Am · Am Dm Am E', 'Đoạn B: ô 34–41 · Am Dm Am · Am Dm E Am (đoạn kết)'],
      status: 'ready',
      pieces: [
        {
          title: 'Đoạn A — ô 2–8 (melody nguyên văn, ngón mặc định)',
          composer: 'Châu Kỳ & Hồ Đình Phương · giọng Am',
          note: 'Hợp âm theo MusicXML: Am · Dm · Am · (Am) · Dm · Am · E. Đã dùng bảng Bass ở Buổi 2.',
          barsPerRow: 2,
          tex: cdxFingered(2, 8),
        },
        {
          title: 'Đoạn B — ô 34–41 (melody nguyên văn, ngón mặc định)',
          composer: 'Châu Kỳ & Hồ Đình Phương · giọng Am',
          note: 'Hợp âm theo MusicXML: Am · Dm · Am · (Am) · Dm · E · Am · (Am). Đoạn kết hát lại câu tên bài; nốt cuối là La dài.',
          barsPerRow: 2,
          tex: cdxFingered(34, 41),
        },
      ],
      annotationTypes: ['Kỹ thuật', 'Bass', 'Ngón', 'Thế hợp âm (6 → 1)', 'Chỗ chèn', 'Lý do chọn', 'Ghi chú của giáo viên'],
    },
    {
      kind: 'study',
      tag: 'Bảng dựng',
      title: 'Bảng dựng — bạn điền (ô trống ___ là của bạn)',
      blocks: [
        { b: 'table', rows: [
          ['Ô', 'Hợp âm', 'Nốt thấp nhất của melody', 'Bass bạn chọn', 'Thế hợp âm (6 → 1)', 'Chỗ chèn (phách)', 'Kỹ thuật'],
          ['___', '___', '___', '___', '___', '___', '___'],
          ['___', '___', '___', '___', '___', '___', '___'],
          ['___', '___', '___', '___', '___', '___', '___'],
          ['___', '___', '___', '___', '___', '___', '___'],
        ] },
        { b: 'write', label: 'Ghi chú: ô nào bạn đổi Bass vì gốc trùng / cao hơn melody?', lines: 3 },
        { b: 'write', label: 'Ghi chú: ô nào chỉ để Bass (chỗ đầy)?', lines: 3 },
      ],
    },
    {
      kind: 'checkpoint',
      id: '15.2',
      title: 'Bài trả 15.2 — Kiểm bản dựng',
      required: true,
      accepts: ['quiz'],
      quiz: {
        mode: 'single',
        question: 'Khi đàn thử bản dựng, bạn thấy melody bị chìm giữa Bass và hợp âm. Cách xử lý nào đúng với quy trình?',
        options: [
          { id: 'a', text: 'Kiểm Bass có thấp hơn melody không; giảm hoặc bỏ nốt hợp âm ở chỗ melody đi liên tục; giữ melody là nốt cao nhất' },
          { id: 'b', text: 'Đàn to hợp âm hơn nữa để lấp chỗ trống' },
          { id: 'c', text: 'Thêm kỹ thuật vào mọi nốt' },
          { id: 'd', text: 'Hạ tempo xuống thật chậm rồi giữ nguyên' },
        ],
        hint: 'Melody phải là nốt cao nhất và rõ nhất. Muốn nó rõ hơn thì bớt cái ở dưới, không thêm.',
      },
    },
    {
      kind: 'note',
      title: 'Nhịp 3 · Đàn bản dựng của bạn',
      text: 'Đàn trọn đoạn bạn dựng và thu video, kèm bảng dựng. Kết thúc nhịp: Bài trả 15.3 (video + bảng dựng).',
    },
    {
      kind: 'checkpoint',
      id: '15.3',
      title: 'Bài trả 15.3 — Bản dựng của tôi',
      prompt: 'Chơi trọn đoạn (ô 2–8 hoặc ô 34–41) do bạn tự dựng bằng sáu bước. Trong phần chữ: dán bảng dựng (ô, hợp âm, Bass, thế hợp âm sáu ký tự dây 6 → 1, chỗ chèn, kỹ thuật) và viết ‘Lựa chọn tôi tâm đắc nhất là … vì…’. Tiêu chí Đạt: (1) melody đúng cao độ, trường độ; (2) Bass thuộc hợp âm và dưới melody; (3) hợp âm chèn đúng chỗ, melody vẫn rõ; (4) bảng dựng đầy đủ, ký hiệu đúng quy ước; (5) lý do dựa vào nguyên tắc đã học.',
      required: true,
      accepts: ['video_link', 'text'],
    },
    {
      kind: 'study',
      tag: 'Phần 2',
      title: 'Phụ lục hiểu sâu — Dựng bài và phối khí',
      blocks: [
        { b: 'h', text: 'Từ làm theo đến tự quyết' },
        { b: 'p', text: 'Các buổi trước Thầy đưa ví dụ cho từng bước. Hôm nay bạn chạy trọn quy trình và chịu trách nhiệm cho mọi lựa chọn. Một bản dựng tốt không phải là bản nhiều nốt nhất, mà là bản mỗi nốt đều có lý do.' },
        { b: 'h', text: 'Nguyên tắc hòa âm và lựa chọn phối khí' },
        { b: 'table', rows: [
          ['Loại', 'Ví dụ trong bài dựng', 'Có thể khác giữa các học viên?'],
          ['Nguyên tắc', 'Bass thuộc hợp âm; melody là nốt cao nhất; hợp âm đúng tên; thế bấm đúng cao độ', 'Không (nếu sai thì sai)'],
          ['Lựa chọn phối khí', 'Dùng Bass gốc hay Bass đổi; chèn hợp âm ở phách nào; thêm kỹ thuật chỗ nào; thế rút gọn nào', 'Có (đều đúng nếu giải thích được)'],
        ] },
        { b: 'h', text: 'Cách tự kiểm bằng tai' },
        { b: 'ul', items: [
          'Hát lại melody trong lúc bản dựng chạy: nếu khó nghe ra, melody đang bị chìm.',
          'Nghe riêng Bass: nó có đi mượt và thuộc hợp âm không?',
          'Ghi âm và nghe lại ngày hôm sau: lỗi hiện ra rõ hơn khi tai đã nghỉ.',
        ] },
        { b: 'callout', label: 'CẦN OWNER XEM LẠI', text: 'Hai đoạn gợi ý (ô 2–8 và ô 34–41) và quy trình sáu bước là đề xuất của giáo án; Owner có thể đổi đoạn hoặc cho học viên chọn bài khác ở buổi này. Ô 32 (nghi vấn hợp âm F) cố ý không nằm trong hai đoạn gợi ý.' },
      ],
    },
    {
      kind: 'assignment',
      items: [
        { label: 'Bài 1.', text: 'Hoàn thành bảng dựng cho đoạn bạn chọn (đủ cột).' },
        { label: 'Bài 2.', text: 'Đàn từng tầng, rồi ghép; ghi âm và nghe lại.' },
        { label: 'Bài 3.', text: 'Sửa chỗ melody bị chìm hoặc Bass trùng nốt; ghi lại bạn đã sửa gì.' },
        { label: 'Bài 4.', text: 'Chuẩn bị đàn trọn bản dựng cho buổi cuối (Biểu diễn).' },
      ],
      message: 'Mang bảng dựng đến lớp. Ta nghe từng bản và hỏi nhau vì sao.',
    },
    {
      kind: 'checklist',
      items: [
        'Tôi chạy đủ sáu bước cho đoạn của mình.',
        'Tôi có bảng dựng ghi đủ lựa chọn.',
        'Bass của tôi thuộc hợp âm và nằm dưới melody.',
        'Melody vẫn là nốt cao nhất và rõ nhất.',
        '⭐ Tôi nói được vì sao mình chọn từng thứ.',
      ],
    },
    { kind: 'studentNotes', title: 'Lựa chọn tôi tâm đắc nhất trong bản dựng…', lines: 8 },
  ],
}
