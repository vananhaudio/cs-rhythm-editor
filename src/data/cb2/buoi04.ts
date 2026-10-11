// ── GUITAR CĂN BẢN 2 (CB2.T3) · BUỔI 04 — Tổng kết & Định hướng ──
// BẢN NHÁP ĐỂ OWNER DUYỆT (12/10/2026). Buổi cuối của Vòng 1: không có điệu mới — chỉ tổng kết 3 buổi, để học viên tự xác định
// trình độ + chỗ còn thiếu, rồi định hướng học tiếp. Mọi mục tiêu bám đúng 3 mục Owner đã chốt ở khung.
// KHÔNG nêu tên khoá/lớp tiếp theo và KHÔNG hứa quy trình ghi danh: Owner chưa chốt chương trình dài hạn → Thầy tư vấn trực tiếp.
// Bài trả 4.1 là văn bản (Thầy chấm) — không trắc nghiệm nên không cần đáp án server; không video (Buổi 03 đã có video tổng hợp).
import type { LessonDoc } from '../../lesson/lessonTypes'

export const CB2_BUOI04: LessonDoc = {
  meta: {
    programCode: 'CB2',
    programName: 'GUITAR CĂN BẢN 2',
    sessionNo: 4,
    title: 'Tổng kết & Định hướng',
    stageLabel: 'Vòng 1 · Đệm hát',
    backHref: '/me',
  },
  sections: [
    {
      kind: 'recap',
      title: 'Vòng 1 — bạn đã đi qua',
      steps: [
        { label: 'Buổi 01', items: ['Cấu trúc bài hát; Bolero với ba cách đánh cho các phần.'] },
        { label: 'Buổi 02', items: ['Tông giọng, đổi tông bằng capo; Slow Rock.'] },
        { label: 'Buổi 03', items: ['Đệm hoàn chỉnh một bài theo năm bước; Ballad.'] },
      ],
      message: 'Ba buổi, một mạch: biết bài có phần nào → đúng tông người hát → chọn điệu và cách đánh cho từng phần.',
    },
    {
      kind: 'objectives',
      items: [
        'Nhìn lại và tổng kết những gì đã học ở Vòng 1.',
        'Tự xác định trình độ hiện tại và những điểm còn thiếu.',
        'Biết mình nên củng cố gì trước và định hướng học tiếp chương trình dài hạn / nâng cao.',
      ],
    },
    // ── PHẦN 1 — TỔNG KẾT ──
    {
      kind: 'study',
      tag: 'Phần 1',
      title: 'Bạn đã làm được gì',
      blocks: [
        { b: 'callout', label: 'ĐIỀU CẦN NHỚ', text: 'Đến đây, đích không phải "đánh được nhiều điệu" mà là "đệm được một bài trọn vẹn, vừa giọng người hát".' },
        { b: 'p', text: 'Năm bước bạn đã dùng ở Buổi 03 chính là cách đệm một bài hát bất kỳ: xác định cấu trúc → chọn tông → chọn điệu → gán cách đánh cho từng phần → chơi liên tục.' },
      ],
    },
    // ── PHẦN 2 — TỰ XÁC ĐỊNH TRÌNH ĐỘ ──
    {
      kind: 'study',
      tag: 'Phần 2',
      title: '✋ Tự đánh giá — làm thật, không cần đẹp',
      blocks: [
        { b: 'p', text: 'Với mỗi việc dưới đây, đánh dấu đúng với bạn lúc này. Hãy thử làm trên đàn chứ đừng chỉ nghĩ.' },
        {
          b: 'table',
          rows: [
            ['Việc', 'Làm chắc', 'Còn vấp', 'Chưa làm được'],
            ['Chỉ ra các phần của một bài hát (Lời 1, Lời 2, Điệp khúc, Lời 3)', '☐', '☐', '☐'],
            ['Chơi liên tục ba cách đánh Bolero, chuyển cách không dừng nhịp', '☐', '☐', '☐'],
            ['Tìm ngăn capo vừa giọng mình cho một bài', '☐', '☐', '☐'],
            ['Chơi ba kiểu Slow Rock, đếm trip-let đều', '☐', '☐', '☐'],
            ['Chơi Móc Chùm 2, Móc Chùm 4 và một mẫu Quạt Ballad', '☐', '☐', '☐'],
            ['Đệm trọn một bài, đổi cách đánh giữa các phần', '☐', '☐', '☐'],
          ],
        },
        { b: 'write', label: 'Việc tôi thấy khó nhất · vì sao', lines: 4 },
      ],
    },
    // ── PHẦN 3 — ĐỊNH HƯỚNG ──
    {
      kind: 'study',
      tag: 'Phần 3',
      title: 'Định hướng học tiếp',
      blocks: [
        { b: 'p', text: 'Đọc lại bảng tự đánh giá rồi đối chiếu:' },
        {
          b: 'ul',
          items: [
            'Còn dòng "Chưa làm được" hoặc nhiều "Còn vấp" → củng cố trước: quay lại đúng buổi của việc đó, tập theo điểm dừng luyện tập rồi mới học tiếp.',
            'Hầu hết "Làm chắc" → bạn sẵn sàng học tiếp chương trình dài hạn / nâng cao.',
          ],
        },
        { b: 'callout', label: 'LƯU Ý', text: 'Chương trình học tiếp phụ thuộc mục tiêu của bạn (đệm hát, solo, hay cả hai). Thầy sẽ trao đổi và gợi ý hướng đi dựa trên bài tổng kết bạn gửi ở dưới.' },
        { b: 'write', label: 'Mục tiêu guitar của tôi trong 6 tháng tới', lines: 4 },
      ],
    },
    // ── BÀI TRẢ 4.1 — TỔNG KẾT (văn bản, Thầy chấm) ──
    {
      kind: 'checkpoint',
      id: '4.1',
      title: 'Bài trả 4.1 — Tổng kết & định hướng của tôi',
      prompt: 'Gửi ba điều, mỗi điều một hai câu: (1) Việc tôi làm chắc nhất sau Vòng 1 là ______. (2) Việc tôi còn thiếu nhất là ______ — tôi sẽ luyện bằng cách ______. (3) Mục tiêu guitar của tôi trong 6 tháng tới là ______.',
      required: true,
      accepts: ['text'],
    },
    // ── ĐUÔI BUỔI ──
    {
      kind: 'assignment',
      items: [
        { label: 'Bài 1.', text: 'Hoàn thành bảng tự đánh giá ở Phần 2 bằng cách thử làm thật trên đàn.' },
        { label: 'Bài 2.', text: 'Chọn một việc còn thiếu nhất, quay lại điểm dừng luyện tập của buổi đó và tập thêm.' },
        { label: 'Bài 3.', text: 'Viết mục tiêu 6 tháng và gửi Bài trả 4.1.' },
      ],
      message: 'Không có điểm đạt hay trượt ở bài tổng kết — chỉ có điểm xuất phát rõ ràng cho chặng sau.',
    },
    {
      kind: 'checklist',
      items: [
        'Tôi nói lại được năm bước đệm một bài hoàn chỉnh.',
        'Tôi đã tự đánh giá thật từng việc của Vòng 1.',
        'Tôi biết việc nào cần củng cố trước.',
        'Tôi đã viết mục tiêu guitar của mình.',
        'Tôi đã gửi Bài trả 4.1.',
      ],
    },
    { kind: 'studentNotes', lines: 8 },
  ],
}
