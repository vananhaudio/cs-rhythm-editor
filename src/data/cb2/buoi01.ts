// ── GUITAR CĂN BẢN 2 (CB2.T3) · BUỔI 01 — Cấu trúc bài hát & Bolero ──
// KHUNG theo khuôn SOLO01 (docs/GIAO-TRINH-CHUAN.md). Chỗ [ĐIỀN] chờ Owner — không tự quyết chuyên môn.
import type { LessonDoc } from '../../lesson/lessonTypes'

export const CB2_BUOI01: LessonDoc = {
  meta: {
    programCode: 'CB2',
    programName: 'GUITAR CĂN BẢN 2',
    sessionNo: 1,
    title: 'Cấu trúc bài hát & Bolero',
    stageLabel: 'Vòng 1 · Đệm hát',
    backHref: '/me',
  },
  sections: [
    {
      kind: 'objectives',
      items: [
        'Hiểu cấu trúc cơ bản của một bài hát.',
        'Áp dụng cấu trúc đó vào đệm hát thực tế.',
        'Học điệu Bolero.',
        'Biết dùng 3 cách đánh khác nhau cho 3 phần của bài hát.',
        'Tiến gần tới việc đệm được một bài trọn vẹn — không đánh một kiểu từ đầu đến cuối.',
      ],
    },
    {
      kind: 'note',
      title: 'Đang soạn',
      text: 'Nội dung chi tiết Buổi 1 (cấu trúc bài hát · điệu Bolero · 3 cách đánh cho 3 phần) sẽ được thầy cập nhật.',
    },
    {
      kind: 'checkpoint',
      id: '1.1',
      title: 'Đệm một đoạn bài hát bằng 3 cách đánh',
      prompt: '[ĐIỀN: bài hát + yêu cầu cụ thể] Gửi video bạn đệm đoạn bài với 3 cách đánh khác nhau cho 3 phần, kèm 1–2 câu: bạn chọn cách đánh cho từng phần vì…',
      required: true,
      accepts: ['text', 'video_link'],
    },
    {
      kind: 'assignment',
      items: [{ label: 'Bài 1.', text: '[ĐIỀN: bài tập về nhà Buổi 1]' }],
      message: 'Không cần tập hoàn hảo. Hãy mang đúng những chỗ chưa làm được đến buổi học.',
    },
    { kind: 'checklist', items: ['[ĐIỀN: checklist cuối Buổi 1]'] },
    { kind: 'studentNotes', lines: 8 },
  ],
}
