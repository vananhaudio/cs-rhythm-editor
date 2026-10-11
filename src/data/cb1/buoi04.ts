// ── GUITAR CĂN BẢN 1 (CB1.T3) · BUỔI 04 — Ứng dụng hợp âm vào đệm hát · Đệm bài hoàn chỉnh & định hướng học tiếp ──
// BẢN NHÁP ĐỂ OWNER DUYỆT (12/10/2026). Buổi cuối của Vòng 1: dùng 6 hợp âm + vòng hợp âm (Buổi 03) để ĐỆM MỘT BÀI HÁT,
// rồi tự đánh giá và định hướng học tiếp. GIẢ ĐỊNH CỦA CLAUDE — Owner xác nhận hoặc sửa:
//   1. Hai cách đánh làm quen (CHƯA phải điệu Bolero/Slow Rock/Ballad của Căn bản 2):
//        Cách 1 = ↓ ↓ ↓ ↓ (xuống mỗi phách) · Cách 2 = ↓ | ↓ ↑ | ↓ | ↓ ↑ (đen · hai móc đơn · đen · hai móc đơn).
//   2. KHÔNG nêu tên bài hát cụ thể: học viên chọn một bài quen thuộc dùng các hợp âm đã học.
//   3. Định hướng học tiếp = Guitar căn bản 2 (lớp có trong lịch của Owner); KHÔNG hứa quy trình ghi danh — Thầy tư vấn trực tiếp.
// Chỉ bài trả văn bản/video (không trắc nghiệm → không cần đáp án server). Tối đa 1 video/buổi (4.1).
import type { LessonDoc, StrumBar } from '../../lesson/lessonTypes'

const D = (frac: number) => ({ frac, label: '↓', act: 'strum' as const, dir: 'D' as const })
const U = (frac: number) => ({ frac, label: '↑', act: 'strum' as const, dir: 'U' as const })

const CACH_1: StrumBar = { beatsPerBar: 4, beats: [[D(1)], [D(1)], [D(1)], [D(1)]] }
const CACH_2: StrumBar = { beatsPerBar: 4, beats: [[D(1)], [D(.5), U(.5)], [D(1)], [D(.5), U(.5)]] }

export const CB1_BUOI04: LessonDoc = {
  meta: {
    programCode: 'CB1',
    programName: 'GUITAR CĂN BẢN 1',
    sessionNo: 4,
    title: 'Ứng dụng hợp âm vào đệm hát — Đệm bài hoàn chỉnh & định hướng học tiếp',
    stageLabel: 'Vòng 1 · Học đàn bằng nốt nhạc',
    backHref: '/me',
  },
  sections: [
    {
      kind: 'recap',
      title: 'Ba buổi gộp lại',
      steps: [
        { label: 'Buổi 01–02', items: ['Đọc và chơi nốt trong 3 ngăn đầu, kể cả ♯ / ♭.'] },
        { label: 'Buổi 03', items: ['Sáu hợp âm C, Am, Dm, Em, G, F; chuyển cặp; hai vòng hợp âm.'] },
        { label: 'Buổi 04', items: ['Đem vòng hợp âm vào MỘT bài hát: vừa đệm vừa hát.'] },
      ],
      message: 'Đây là buổi bạn biến những gì đã học thành một bài hát thật.',
    },
    {
      kind: 'objectives',
      items: [
        'Nhận ra bài hát được xây trên một vòng hợp âm lặp lại.',
        'Đánh theo nhịp với hai cách đánh cơ bản.',
        'Đệm trọn một bài hát bằng các hợp âm đã học.',
        'Tự xác định trình độ hiện tại và định hướng học tiếp.',
      ],
    },
    // ── NHỊP 1 — TỪ VÒNG HỢP ÂM ĐẾN ĐỆM HÁT ──
    {
      kind: 'note',
      title: 'Nhịp 1 · Từ vòng hợp âm đến đệm hát',
      text: 'Đệm hát = hợp âm đúng chỗ + nhịp đều. Hôm nay bạn thêm cách đánh để tiếng đàn có nhịp, rồi đệm một bài của bạn. Kết thúc nhịp: Bài trả 4.1.',
    },
    {
      kind: 'study',
      tag: 'Phần 1',
      title: 'Một bài hát là một vòng hợp âm lặp lại',
      blocks: [
        { b: 'p', text: 'Phần lớn bài hát quen thuộc chỉ xoay quanh một vòng hợp âm vài ô nhịp, lặp đi lặp lại theo lời. Bạn đã chơi hai vòng như thế ở Buổi 03.' },
        { b: 'callout', label: 'ĐIỀU CẦN NHỚ', text: 'Biết hợp âm chưa đủ. Phải đổi hợp âm ĐÚNG PHÁCH và giữ nhịp đều từ đầu đến cuối.' },
      ],
    },
    {
      kind: 'strum',
      label: 'Cách 1',
      name: 'Xuống mỗi phách',
      strum: CACH_1,
      guitar: '↓ – ↓ – ↓ – ↓',
      durations: 'Đen – Đen – Đen – Đen',
      legend: '↓ = đánh xuống · mỗi hợp âm 4 phách, đếm 1 – 2 – 3 – 4',
      howTo: 'Mỗi phách đánh xuống một lần, đều tay. Đổi hợp âm ở phách 1 của ô nhịp kế.',
    },
    {
      kind: 'note',
      title: '✋ Điểm dừng luyện tập 1',
      text: 'Chơi Vòng 1 (C – Am – F – G) với Cách 1, máy đếm nhịp chậm. Khi đi trọn 4 vòng không dừng mới sang Cách 2.',
    },
    {
      kind: 'strum',
      label: 'Cách 2',
      name: 'Xuống – xuống lên',
      strum: CACH_2,
      guitar: '↓ – ↓↑ – ↓ – ↓↑',
      durations: 'Đen – Đơn – Đơn – Đen – Đơn – Đơn',
      legend: '↓ xuống · ↑ lên · phách 2 và phách 4 chia đôi: xuống rồi lên',
      howTo: 'Phách 1 và 3 đánh xuống một lần. Phách 2 và 4 đánh xuống rồi lên, mỗi tiếng nửa phách.',
    },
    {
      kind: 'note',
      title: '✋ Điểm dừng luyện tập 2',
      text: 'Chơi Vòng 2 (Am – Dm – G – C) với Cách 2. Sau đó thử đổi Cách 1 ↔ Cách 2 giữa hai vòng mà không dừng nhịp.',
    },
    {
      kind: 'study',
      tag: 'Phần 2',
      title: 'Đệm một bài của bạn',
      blocks: [
        {
          b: 'ol',
          items: [
            'Chọn một bài quen thuộc dùng các hợp âm đã học (C, Am, Dm, Em, G, F).',
            'Ghi hợp âm lên trên lời bài hát, đánh dấu chỗ đổi hợp âm.',
            'Chọn Cách 1 hoặc Cách 2 cho cả bài.',
            'Chơi liên tục, chậm; vừa đệm vừa hát, không dừng khi đổi hợp âm.',
          ],
        },
        { b: 'write', label: 'Bài tôi chọn · vòng hợp âm · cách đánh', lines: 5 },
      ],
    },
    {
      kind: 'checkpoint',
      id: '4.1',
      title: 'Bài trả 4.1 — Đệm một bài hoàn chỉnh',
      prompt: 'Quay video bạn đệm (và hát nếu được) một bài hoàn chỉnh bằng các hợp âm đã học, thể hiện: đúng hợp âm · đổi hợp âm đúng phách · nhịp đều, không dừng giữa chừng. Không cần kỹ thuật hoàn hảo. Kèm một dòng: "Tôi đang gặp khó nhất ở: ______".',
      required: true,
      accepts: ['text', 'video_link'],
    },
    // ── NHỊP 2 — TỔNG KẾT & ĐỊNH HƯỚNG ──
    {
      kind: 'note',
      title: 'Nhịp 2 · Tổng kết và định hướng',
      text: 'Nhìn lại cả Vòng 1 để biết bạn đang ở đâu và cần gì tiếp theo. Kết thúc nhịp: Bài trả 4.2.',
    },
    {
      kind: 'study',
      tag: 'Phần 3',
      title: '✋ Tự đánh giá — làm thật, không cần đẹp',
      blocks: [
        { b: 'p', text: 'Với mỗi việc dưới đây, đánh dấu đúng với bạn lúc này. Hãy thử làm trên đàn chứ đừng chỉ nghĩ.' },
        {
          b: 'table',
          rows: [
            ['Việc', 'Làm chắc', 'Còn vấp', 'Chưa làm được'],
            ['Gọi tên 6 dây và các nốt trong 3 ngăn đầu', '☐', '☐', '☐'],
            ['Tìm nốt ♯ / ♭ bằng cách dịch một ngăn', '☐', '☐', '☐'],
            ['Bấm đúng 6 hợp âm C, Am, Dm, Em, G, F', '☐', '☐', '☐'],
            ['Chuyển hợp âm không dừng nhịp', '☐', '☐', '☐'],
            ['Chơi một vòng hợp âm với Cách 1 hoặc Cách 2', '☐', '☐', '☐'],
            ['Đệm trọn một bài hát', '☐', '☐', '☐'],
          ],
        },
        { b: 'write', label: 'Việc tôi thấy khó nhất · vì sao', lines: 4 },
      ],
    },
    {
      kind: 'study',
      tag: 'Phần 4',
      title: 'Định hướng học tiếp',
      blocks: [
        {
          b: 'ul',
          items: [
            'Còn dòng "Chưa làm được" hoặc nhiều "Còn vấp" → củng cố trước: quay lại đúng buổi của việc đó, tập theo điểm dừng luyện tập rồi mới học tiếp.',
            'Hầu hết "Làm chắc" → bạn sẵn sàng học tiếp Guitar căn bản 2: đệm hát trọn bài với nhiều điệu, chọn tông giọng vừa với giọng hát.',
          ],
        },
        { b: 'callout', label: 'LƯU Ý', text: 'Hướng đi tiếp phụ thuộc mục tiêu của bạn. Thầy sẽ trao đổi và gợi ý dựa trên bài tổng kết bạn gửi ở dưới.' },
        { b: 'write', label: 'Mục tiêu guitar của tôi trong 6 tháng tới', lines: 4 },
      ],
    },
    {
      kind: 'checkpoint',
      id: '4.2',
      title: 'Bài trả 4.2 — Tổng kết & định hướng của tôi',
      prompt: 'Gửi ba điều, mỗi điều một hai câu: (1) Việc tôi làm chắc nhất sau Vòng 1 là ______. (2) Việc tôi còn thiếu nhất là ______ — tôi sẽ luyện bằng cách ______. (3) Mục tiêu guitar của tôi trong 6 tháng tới là ______.',
      required: true,
      accepts: ['text'],
    },
    // ── ĐUÔI BUỔI ──
    {
      kind: 'assignment',
      items: [
        { label: 'Bài 1.', text: 'Tập Cách 1 và Cách 2 với hai vòng hợp âm, chậm và đều.' },
        { label: 'Bài 2.', text: 'Đệm trọn bài bạn chọn, rồi gửi Bài trả 4.1.' },
        { label: 'Bài 3.', text: 'Hoàn thành bảng tự đánh giá bằng cách thử làm thật trên đàn, rồi gửi Bài trả 4.2.' },
      ],
      message: 'Không có điểm đạt hay trượt ở bài tổng kết — chỉ có điểm xuất phát rõ ràng cho chặng sau.',
    },
    {
      kind: 'checklist',
      items: [
        'Tôi nhận ra vòng hợp âm của một bài hát.',
        'Tôi đánh được Cách 1 và Cách 2.',
        'Tôi đệm được trọn một bài bằng các hợp âm đã học.',
        'Tôi biết việc nào cần củng cố trước.',
        'Tôi đã gửi Bài trả 4.1 và 4.2.',
      ],
    },
    { kind: 'studentNotes', lines: 8 },
  ],
}
