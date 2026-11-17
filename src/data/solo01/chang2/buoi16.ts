// ── SOLO-01 · CHẶNG 2 · BUỔI 8/8 — hệ thống đánh số là BUỔI 16 ──
// Chủ đề: Tổng kết – Ôn tập – Biểu diễn — hoàn thiện, trình bày và đánh giá các kỹ năng của Chặng 2.
// Buổi này không thêm kiến thức mới: ôn bản đồ kỹ năng, chuẩn bị biểu diễn bản dựng của Buổi 7, tự đánh giá bằng thang tiêu chí.
import type { LessonDoc } from '../../../lesson/lessonTypes'
import { cdxFingered } from './works'

export const SOLO01_BUOI16: LessonDoc = {
  meta: {
    programCode: 'SOLO-01',
    programName: 'SOLO GUITAR CĂN BẢN',
    sessionNo: 16,
    title: 'Chặng 2 – Buổi 8/8 · Tổng kết – Ôn tập – Biểu diễn',
    stageLabel: 'Chặng 2 · Solo Bolero',
    backHref: '/solo01',
  },
  sections: [
    {
      kind: 'recap',
      title: 'Bản đồ Chặng 2 — mỗi buổi một kỹ năng, mỗi kỹ năng một tiêu chí',
      steps: [
        { label: 'Buổi 1–2', items: ['Melody & kỹ thuật diễn tấu.', 'Bass: Root Note, Bass Note, Bass dây 6–5 dưới melody.'] },
        { label: 'Buổi 3–4', items: ['Xếp ngón: các Vị trí, một ngăn – một ngón, đổi vị trí, giữ ngón.', 'Hợp âm bấm tắt: Triad và Dyad ngăn cao, Voicing, Chord Inversion.'] },
        { label: 'Buổi 5–6', items: ['Chèn hợp âm theo mô hình Bolero.', 'Ghép Bass + hợp âm + melody cho điệp khúc.'] },
        { label: 'Buổi 7–8', items: ['Tự dựng bản Solo Bolero (sáu bước).', 'Hoàn thiện, biểu diễn và đánh giá.'] },
      ],
      message: 'Tám buổi là một đường thẳng: mỗi buổi là một bước của quy trình dựng Solo, và cũng là một tiêu chí để đánh giá bạn đã làm chủ chặng này chưa.',
    },
    {
      kind: 'objectives',
      title: 'Cuối buổi, bạn làm được',
      items: [
        'Nói được mỗi buổi của Chặng 2 dạy kỹ năng nào và dùng nó ở đâu trong bản dựng.',
        'Hoàn thiện một bản Solo Bolero ngắn (từ 7 ô trở lên) do chính bạn dựng.',
        'Biểu diễn trọn bản dựng đều tay, đúng nhịp.',
        'Tự đánh giá bản biểu diễn bằng thang tiêu chí và chỉ ra điều cần luyện tiếp.',
        '⭐ QUAN TRỌNG NHẤT — Biểu diễn và giải thích được bản dựng của chính mình.',
      ],
    },
    // NHỊP HỌC (đề xuất): 16.1 trắc nghiệm → 16.2 trắc nghiệm → 16.3 video + chữ (Biểu diễn).
    {
      kind: 'note',
      title: 'Nhịp 1 · Ôn tập — nối kỹ năng với buổi học',
      text: 'Phần 1 — Làm ngay: ôn lại bản đồ kỹ năng và đàn lại đoạn bạn đã dựng ở Buổi 7. Kết thúc nhịp: Bài trả 16.1 (trắc nghiệm).',
    },
    {
      kind: 'study',
      tag: 'Phần 1 — Làm ngay',
      title: 'Ôn nhanh — bảng kỹ năng',
      blocks: [
        { b: 'table', rows: [
          ['Buổi', 'Kỹ năng', 'Câu hỏi tự kiểm', 'Bạn làm được?'],
          ['1', 'Melody & kỹ thuật', 'Tôi đàn đúng cao độ/trường độ và chọn được kỹ thuật hợp chỗ?', '___'],
          ['2', 'Bass', 'Bass của tôi thuộc hợp âm, ở dây 6–5 và thấp hơn melody?', '___'],
          ['3', 'Xếp ngón', 'Tay trái tôi có nhảy không? Tôi có nhìn trước ngón kế tiếp và đổi vị trí đúng chỗ?', '___'],
          ['4', 'Hợp âm bấm tắt', 'Tôi nêu được Root, 3rd, 5th, phân biệt Triad với Dyad, và bấm được thế rút gọn ngăn cao đúng?', '___'],
          ['5', 'Chèn theo công thức Bolero', 'Tôi tìm được chỗ trống và đặt Bass – hợp âm đúng phách?', '___'],
          ['6', 'Ghép ba tầng cho điệp khúc', 'Melody có còn là nốt cao nhất khi đủ ba tầng?', '___'],
          ['7', 'Tự dựng', 'Tôi chạy đủ sáu bước và giải thích được lựa chọn?', '___'],
        ] },
        { b: 'callout', label: 'LÀM NGAY', text: 'Đàn lại đoạn bản dựng Buổi 7 của bạn, chậm, ghi âm. Nghe và khoanh những ô bạn chưa hài lòng.' },
      ],
    },
    {
      kind: 'checkpoint',
      id: '16.1',
      title: 'Bài trả 16.1 — Ôn tập',
      required: true,
      accepts: ['quiz'],
      quiz: {
        mode: 'single',
        question: 'Việc "chọn nốt Bass thuộc hợp âm và thấp hơn nốt thấp nhất của melody" thuộc kỹ năng của buổi nào trong Chặng 2?',
        options: [
          { id: 'a', text: 'Buổi 2 — Bass' },
          { id: 'b', text: 'Buổi 1 — Melody & kỹ thuật diễn tấu' },
          { id: 'c', text: 'Buổi 3 — Xếp ngón' },
          { id: 'd', text: 'Buổi 4 — Hợp âm bấm tắt' },
        ],
        hint: 'Buổi nào bàn về Root Note, Bass Note và âm vực của Bass so với melody?',
      },
    },
    {
      kind: 'note',
      title: 'Nhịp 2 · Chuẩn bị biểu diễn',
      text: 'Hoàn thiện bản dựng, chuẩn bị tinh thần và chiến lược khi biểu diễn. Kết thúc nhịp: Bài trả 16.2 (trắc nghiệm).',
    },
    {
      kind: 'repertoire',
      title: 'Hai đoạn để bạn chọn lại (melody nâng quãng 8)',
      candidates: ['Đoạn A: ô 2–8', 'Đoạn B: ô 34–41'],
      status: 'ready',
      pieces: [
        {
          title: 'Đoạn A — ô 2–8',
          composer: 'Châu Kỳ & Hồ Đình Phương · giọng Am',
          note: 'Melody nâng quãng 8; bạn đặt Bass, hợp âm và kỹ thuật theo bản dựng Buổi 7.',
          barsPerRow: 2,
          tex: cdxFingered(2, 8),
        },
        {
          title: 'Đoạn B — ô 34–41',
          composer: 'Châu Kỳ & Hồ Đình Phương · giọng Am',
          note: 'Melody nâng quãng 8; bạn đặt Bass, hợp âm và kỹ thuật theo bản dựng Buổi 7.',
          barsPerRow: 2,
          tex: cdxFingered(34, 41),
        },
      ],
      annotationTypes: ['Điểm cần luyện', 'Chỗ dễ hỏng', 'Chiến lược khi vấp', 'Ghi chú của giáo viên'],
    },
    {
      kind: 'checkpoint',
      id: '16.2',
      title: 'Bài trả 16.2 — Chiến lược biểu diễn',
      required: true,
      accepts: ['quiz'],
      quiz: {
        mode: 'single',
        question: 'Đang biểu diễn, bạn đàn sai một nốt. Cách xử lý tốt nhất là gì?',
        options: [
          { id: 'a', text: 'Giữ nhịp và tempo, đi tiếp, không dừng lại sửa' },
          { id: 'b', text: 'Dừng lại, xin lỗi và đàn lại từ đầu' },
          { id: 'c', text: 'Đàn nhanh hơn để bù' },
          { id: 'd', text: 'Bỏ luôn phần còn lại' },
        ],
        hint: 'Người nghe nhớ nhịp và mạch bài hơn một nốt sai thoáng qua.',
      },
    },
    {
      kind: 'note',
      title: 'Nhịp 3 · Biểu diễn và đánh giá',
      text: 'Biểu diễn bản dựng của bạn, thu video, tự đánh giá bằng thang tiêu chí. Kết thúc nhịp: Bài trả 16.3 (video + tự đánh giá).',
    },
    {
      kind: 'study',
      tag: 'Thang tiêu chí',
      title: 'Thang đánh giá biểu diễn Chặng 2 (cũng là tiêu chí chấm của Thầy)',
      blocks: [
        { b: 'p', text: 'Mỗi tiêu chí chấm mức: Chưa đạt / Đạt / Tốt. Bài trả Đạt khi KHÔNG có tiêu chí nào ở mức Chưa đạt.' },
        { b: 'table', rows: [
          ['Tiêu chí', 'Buổi tương ứng', 'Chưa đạt', 'Đạt', 'Tốt'],
          ['Melody', '1', 'Sai cao độ/trường độ nhiều chỗ', 'Đúng, đôi chỗ chưa đều', 'Đúng, đều, có kỹ thuật hợp chỗ'],
          ['Bass', '2', 'Bass không thuộc hợp âm hoặc cao hơn/trùng melody', 'Bass đúng, ở dây 6–5 và thấp hơn melody', 'Bass đúng, chừa chỗ cho hợp âm, đi mượt'],
          ['Xếp ngón', '3', 'Tay trái nhảy, đứt tiếng', 'Liền mạch, thoải mái, đổi vị trí gọn', 'Nhìn trước, giữ ngón và đổi vị trí hợp lý'],
          ['Hợp âm', '4', 'Thế bấm sai nốt, hoặc gọi thế thiếu nốt là hợp âm đầy đủ', 'Thế đúng, phân biệt Triad/Dyad, ký hiệu 6 → 1 đúng', 'Chọn thế ngăn cao có lý do, chuyển mượt'],
          ['Công thức Bolero', '5–6', 'Chèn bừa, che melody', 'Chèn đúng chỗ trống', 'Nhường chỗ khéo, giữ nhịp đu'],
          ['Quy trình & lý do', '7', 'Không giải thích được lựa chọn', 'Giải thích dựa trên nguyên tắc', 'Phân biệt rõ nguyên tắc và lựa chọn phối khí'],
        ] },
        { b: 'callout', label: 'CẦN OWNER XEM LẠI', text: 'Thang tiêu chí và ngưỡng "Đạt / Tốt" là đề xuất của giáo án, mô phỏng cách Chặng 1 chấm bằng checklist + prompt. Owner chỉnh để khớp cách chấm thật.' },
      ],
    },
    {
      kind: 'checkpoint',
      id: '16.3',
      title: 'Bài trả 16.3 — Biểu diễn Solo Bolero',
      prompt: 'Biểu diễn trọn bản dựng của bạn (từ 7 ô trở lên; ô 2–8 hoặc ô 34–41 hoặc đoạn khác bạn dựng được). Trong phần chữ: tự đánh giá theo thang tiêu chí (mức từng tiêu chí) và viết ‘Điều tôi tiến bộ nhất là … và điều tôi sẽ luyện tiếp là …’. Tiêu chí Đạt: không có tiêu chí nào ở mức Chưa đạt trong thang; giữ được nhịp xuyên suốt; tự đánh giá trung thực, nêu được ít nhất một điều cần luyện.',
      required: true,
      accepts: ['video_link', 'text'],
    },
    {
      kind: 'study',
      tag: 'Phần 2',
      title: 'Phụ lục hiểu sâu — Bước tiếp theo',
      blocks: [
        { b: 'h', text: 'Chặng 2 để lại cho bạn cái gì' },
        { b: 'p', text: 'Một quy trình bạn có thể mang sang bất kỳ bản nhạc nào: Melody → Bass → Xếp ngón → Hợp âm bấm tắt → Chèn theo mô hình → Ghép và kiểm. Mỗi bài mới là một lần chạy lại quy trình, nhanh hơn và có lựa chọn riêng hơn.' },
        { b: 'h', text: 'Chặng 3 sẽ làm gì' },
        { b: 'p', text: 'Chặng 3 (Tự dựng bài Solo Guitar) yêu cầu bạn chọn một bài hát mình yêu thích và tự tìm cả melody, hợp âm lẫn bản dựng. Quy trình Chặng 2 là hành trang chính.' },
        { b: 'h', text: 'Hai thói quen nên giữ' },
        { b: 'ul', items: [
          'Ghi chép lựa chọn bằng bảng dựng — để vài tuần sau còn hiểu vì sao mình làm thế.',
          'Phân biệt nguyên tắc (đúng/sai) với lựa chọn phối khí (nhiều đáp án đúng) mỗi khi nghe bản của người khác.',
        ] },
        { b: 'callout', label: 'CẦN OWNER XEM LẠI', text: 'Nội dung nối sang Chặng 3 chỉ mô tả theo chương trình đã công bố; Owner xác nhận cách nối.' },
      ],
    },
    {
      kind: 'assignment',
      items: [
        { label: 'Bài 1.', text: 'Hoàn thiện bản dựng, đàn trọn ít nhất ba lần liên tiếp không dừng.' },
        { label: 'Bài 2.', text: 'Ghi âm/ghi hình một lần, nghe lại và chấm bằng thang tiêu chí.' },
        { label: 'Bài 3.', text: 'Viết "Điều tôi tiến bộ nhất là … và điều tôi sẽ luyện tiếp là …".' },
        { label: 'Bài 4.', text: 'Chọn bài hát yêu thích bạn muốn dựng ở Chặng 3 và ghi lại lý do chọn.' },
      ],
      message: 'Biểu diễn không để chứng minh bạn hoàn hảo. Nó để bạn nghe chính mình và biết đi tiếp từ đâu.',
    },
    {
      kind: 'checklist',
      items: [
        'Tôi nối được từng buổi của Chặng 2 với một kỹ năng.',
        'Tôi hoàn thiện được bản dựng của mình.',
        'Tôi biểu diễn trọn bản dựng, giữ được nhịp.',
        'Tôi tự chấm bằng thang tiêu chí và chỉ ra điều cần luyện tiếp.',
        '⭐ Tôi giải thích được bản dựng của mình bằng nguyên tắc đã học.',
      ],
    },
    { kind: 'studentNotes', title: 'Điều tôi tiến bộ nhất và sẽ luyện tiếp…', lines: 8 },
  ],
}
