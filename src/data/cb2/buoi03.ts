// ── GUITAR CĂN BẢN 2 (CB2.T3) · BUỔI 03 — Đệm hoàn chỉnh một bài & Ballad ──
// Chỉ dựng KHUNG. Owner sẽ soạn chi tiết sau khi dạy Buổi 01 và biết mặt bằng học viên.
import type { LessonDoc } from '../../lesson/lessonTypes'

export const CB2_BUOI03: LessonDoc = {
  meta: {
    programCode: 'CB2',
    programName: 'GUITAR CĂN BẢN 2',
    sessionNo: 3,
    title: 'Đệm hoàn chỉnh một bài & Ballad',
    stageLabel: 'Vòng 1 · Đệm hát',
    backHref: '/me',
  },
  sections: [
    {
      kind: 'objectives',
      title: 'Nội dung dự kiến',
      items: [
        'Cấu trúc và cách đệm một bài hát hoàn chỉnh.',
        'Phát triển phần đệm theo từng phần của bài.',
        'Điệu Ballad.',
      ],
    },
    { kind: 'note', title: 'Đang soạn', text: 'Giáo trình chi tiết của buổi này sẽ được thầy cập nhật sau.' },
    { kind: 'assignment', items: [{ label: 'Bài 1.', text: 'Sẽ cập nhật sau buổi học.' }] },
    { kind: 'checklist', items: ['Sẽ cập nhật sau buổi học.'] },
    { kind: 'studentNotes', lines: 8 },
  ],
}
