// ── GUITAR CĂN BẢN 2 (CB2.T3) · BUỔI 04 — Tổng kết & Định hướng ──
// Chỉ dựng KHUNG. Owner sẽ soạn chi tiết sau khi dạy Buổi 01 và biết mặt bằng học viên.
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
      kind: 'objectives',
      title: 'Nội dung dự kiến',
      items: [
        'Tổng kết.',
        'Xác định trình độ và những điểm học viên còn thiếu.',
        'Định hướng học tiếp chương trình dài hạn / nâng cao.',
      ],
    },
    { kind: 'note', title: 'Đang soạn', text: 'Giáo trình chi tiết của buổi này sẽ được thầy cập nhật sau.' },
    { kind: 'assignment', items: [{ label: 'Bài 1.', text: 'Sẽ cập nhật sau buổi học.' }] },
    { kind: 'checklist', items: ['Sẽ cập nhật sau buổi học.'] },
    { kind: 'studentNotes', lines: 8 },
  ],
}
