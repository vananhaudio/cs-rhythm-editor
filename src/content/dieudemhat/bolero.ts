import type { RhythmStyle } from './types.ts'

export const BOLERO: RhythmStyle = {
  id: 'bolero',
  name: 'Bolero',
  meter: '4/4',
  beatDivision: 'Phách 1 chia thành một móc đơn và hai móc kép; ba phách còn lại mỗi phách hai móc đơn.',
  traits: [
    'Hai kiểu móc Bolero dùng cùng một khung trường độ; Kiểu 2 thay các tiếng móc từ nửa sau phách 2 bằng Chát – Bùm – Chát – Bụm – Chát.',
    'Điệp khúc Bolero dùng Quạt Ballad, không có kiểu quạt Bolero riêng.',
  ],
  sections: [
    { kind: 'loi1', intensity: 'Nhẹ, thoáng, phù hợp phần đầu', patterns: ['bolero-moc-1'] },
    { kind: 'loi2', intensity: 'Tiết tấu rõ hơn nhưng giữ tính chất Bolero', patterns: ['bolero-moc-2'] },
    { kind: 'diepkhuc', intensity: 'Tương phản với Lời, nâng cường độ', patterns: ['quat-ballad-bolero-mini'] },
    { kind: 'loi3', intensity: 'Trở lại cách đệm của Lời 2', patterns: ['bolero-moc-2'], reuseOf: 'loi2' },
  ],
  practiceNotes: [
    'Lời 1 nhẹ → Lời 2 ra tiết tấu → Điệp khúc tương phản → Lời 3 trở lại cách đệm Lời 2.',
    'Tập riêng chỗ chuyển giữa hai phần cùng máy đếm nhịp, giữ nhịp qua điểm chuyển.',
    'Điệp khúc lặp lại thì dùng lại mẫu quạt điệp khúc.',
  ],
  exercise: 'Chọn một bài Bolero 4/4 bạn đã biết hợp âm và ghép đủ Lời 1 → Lời 2 → Điệp khúc → Lời 3.',
  editorial: {
    sources: [
      'Bolero Móc Kiểu 1 (B32123123) và Kiểu 2 (B321 – Chát – Bùm – Chát – Bụm – Chát), trường độ Đơn – Kép – Kép – Đơn × 6: Owner chốt 28/09/2026.',
      'Điệp khúc: Owner xác nhận là một mẫu Quạt Ballad, nguồn “Buổi học 04 - Đệm cho điệp khúc — Lớp Bolero Mini thầy Văn Anh”, ♩ = 65. Không tạo “Quạt Bolero”.',
      'Mục tiêu/cường độ từng phần: bảng công thức Bolero Owner chốt (commit 7ca38e0).',
      'Bài tập: theo ví dụ Owner đưa ngày 29/09/2026.',
    ],
    missing: [
      'Điệp khúc: trường độ của chuỗi Bùm – Chát – I – X – I – x – Chát và định nghĩa I / X / x → chưa ký âm được.',
      'Điệp khúc: mẫu này có trùng Quạt Ballad 1 (Cách đệm 7) / Quạt Ballad 2 (Cách đệm 8) không.',
      'Định nghĩa kỹ thuật tay phải của “Bùm”, “Chát”.',
      'Đặc điểm/cảm giác riêng của điệu Bolero — chưa có, không tự viết.',
      'Lỗi thường gặp khi đệm Bolero; bài hát gợi ý; Intro/Outro; audio/video mẫu.',
      'Đối chiếu Bài 4.3, 4.4, 4.5 với Kiểu 1/2 và mẫu điệp khúc.',
    ],
    notes: [
      'Bolero Kiểu 2: Chát, Bùm là EVENT móc đơn trong StrumScore (act chat/bum), cùng khung trường độ với Kiểu 1 — không còn là chữ chú thích.',
    ],
  },
}
