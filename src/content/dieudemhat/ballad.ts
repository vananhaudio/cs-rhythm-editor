import type { RhythmStyle } from './types.ts'

export const BALLAD: RhythmStyle = {
  id: 'ballad',
  // Owner 29/09/2026: nội dung quạt Ballad còn sai nhiều → giữ bản nháp, không dùng làm chuẩn template.
  status: 'draft',
  name: 'Ballad',
  meter: '4/4',
  beatDivision: 'Lời 1 móc mỗi phách chia 2, Lời 2 móc mỗi phách chia 4, điệp khúc chuyển sang quạt.',
  traits: [
    'Chùm 2 → Chùm 4 → Quạt: tiếng đàn dày dần lên, tới điệp khúc thì bung ra.',
  ],
  sections: [
    { kind: 'loi1', intensity: 'Nhẹ, thoáng, phù hợp mở đầu', patterns: ['ballad-moc-chum-2'] },
    { kind: 'loi2', intensity: 'Tăng mật độ nốt, tiết tấu rõ hơn Lời 1', patterns: ['ballad-moc-chum-4'] },
    {
      kind: 'diepkhuc', intensity: 'Tương phản rõ với phần móc, nâng cường độ',
      patterns: ['quat-chum-4', 'quat-acoustic-ballad'],
      choiceNote: 'Chọn một trong hai phong cách: cổ điển (Quạt Chùm 4) hoặc acoustic (cùng mẫu điệp khúc Bolero).',
    },
    { kind: 'loi3', intensity: 'Trở lại cách đệm của Lời 2', patterns: ['ballad-moc-chum-4'], reuseOf: 'loi2' },
  ],
  practiceNotes: [
    'Lời 1 nhẹ → Lời 2 ra tiết tấu → Điệp khúc tương phản → Lời 3 trở lại cách đệm Lời 2.',
    'Tập riêng chỗ chuyển giữa hai phần cùng máy đếm nhịp, giữ nhịp qua điểm chuyển.',
    'Điệp khúc lặp lại thì dùng lại lựa chọn điệp khúc đã chọn.',
  ],
  exercise: 'Chọn một bài Ballad 4/4 bạn đã biết hợp âm và ghép đủ Lời 1 → Lời 2 → Điệp khúc → Lời 3.',
  editorial: {
    sources: [
      'Móc Chùm 2 / Móc Chùm 4: Owner chốt ký hiệu và thời lượng 26–28/09/2026.',
      'Điệp khúc (Owner 12/10/2026): hai phong cách — cổ điển = Quạt Chùm 4; acoustic ballad = mục 3 của Bolero (XML Owner 06/10/2026). Thay hai mẫu cũ “Quạt Ballad 1/2” (Cách đệm 7/8, trang “BALLAD – 8 MẪU ĐỆM”).',
      'Mục tiêu/cường độ từng phần: bảng công thức Ballad Owner chốt (commit 7ca38e0).',
      'Bài tập: theo ví dụ Owner đưa ngày 29/09/2026.',
    ],
    missing: [
      'Hướng quạt lên/xuống và nhấn của Quạt Chùm 4 (đang ký âm 4 tiếng đều, không nhãn).',
      'Đặc điểm/cảm giác riêng của điệu Ballad (ngoài công thức) — chưa có, không tự viết.',
      'Lỗi thường gặp khi đệm Ballad.',
      'Bài hát gợi ý cho bài tập; Intro/Outro; audio/video mẫu.',
      'status vẫn “draft” cho tới khi Owner xác nhận cho hiện ở trang công khai.',
    ],
    notes: [
      'Quạt Ballad Acoustic dùng CHUNG nguồn với Cách 3 của Bolero (giáo trình CB2 Buổi 01) — sửa một chỗ là đủ.',
    ],
  },
}
