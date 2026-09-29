import type { RhythmStyle } from './types.ts'

export const SLOW_ROCK: RhythmStyle = {
  id: 'slow-rock',
  name: 'Slow Rock',
  meter: '4/4',
  beatDivision: 'Mỗi phách chia làm 3 phần bằng nhau (liên ba): 4 phách = 4 nhóm ba = 12 tiếng đều nhau mỗi ô nhịp.',
  traits: [
    'Trên bản nhạc, mỗi nhóm có số 3 là một phách.',
    'Kiểu 3 mang màu Blues, dùng cho điệp khúc.',
  ],
  count: '1-trip-let | 2-trip-let | 3-trip-let | 4-trip-let',
  sections: [
    { kind: 'loi1', intensity: 'Nhẹ, phù hợp phần đầu', patterns: ['slowrock-1'] },
    { kind: 'loi2', intensity: 'Tiết tấu rõ hơn, cường độ vừa phải', patterns: ['slowrock-2'] },
    { kind: 'diepkhuc', intensity: 'Tương phản và tăng năng lượng so với Lời', patterns: ['slowrock-3'] },
    { kind: 'loi3', intensity: 'Trở lại cách đệm của Lời 2', patterns: ['slowrock-2'], reuseOf: 'loi2' },
  ],
  practiceNotes: [
    'Lời 1 nhẹ → Lời 2 ra tiết tấu → Điệp khúc tương phản → Lời 3 trở lại cách đệm Lời 2.',
    'Tập riêng chỗ chuyển giữa hai phần cùng máy đếm nhịp, giữ nhịp qua điểm chuyển.',
    'Điệp khúc lặp lại thì dùng lại Kiểu 3.',
  ],
  exercise: 'Chọn một bài Slow Rock 4/4 bạn đã biết hợp âm và ghép đủ Lời 1 → Lời 2 → Điệp khúc → Lời 3.',
  editorial: {
    sources: [
      'Quy ước 4/4 = 4 phách = 4 liên ba = 12 vị trí chia ba; Kiểu 1, 2, 3 và công thức theo phần: Owner chốt 26–28/09/2026.',
      'Mục tiêu/cường độ từng phần: bảng công thức Slow Rock Owner chốt (commit 7ca38e0).',
      'Bài tập: theo ví dụ Owner đưa ngày 29/09/2026.',
    ],
    missing: [
      'Hướng quạt lên/xuống cho Kiểu 2/3 (Owner mới xác nhận x = đánh xuống nhẹ).',
      'Lỗi thường gặp khi đệm Slow Rock; bài hát gợi ý; Intro/Outro; audio/video mẫu.',
      'Đối chiếu Bài 3.6 “Mẫu Slowrock cơ bản”, 3.7 “Nền tập Slowrock” với ba kiểu trước khi ghi “ôn Bài …”.',
    ],
  },
}
