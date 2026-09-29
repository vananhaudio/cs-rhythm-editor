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
      patterns: ['quat-ballad-1', 'quat-ballad-2'],
      choiceNote: 'Chọn một trong hai mẫu.',
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
      'Quạt Ballad 1 = Cách đệm 7, Quạt Ballad 2 = Cách đệm 8, trang “BALLAD – 8 MẪU ĐỆM”; tiết tấu do Owner đọc và chốt. Mẫu gốc 2/4, trình bày 4/4 = lặp 2 lần. Không dùng Cách đệm 1–6.',
      'Mục tiêu/cường độ từng phần: bảng công thức Ballad Owner chốt (commit 7ca38e0).',
      'Bài tập: theo ví dụ Owner đưa ngày 29/09/2026.',
    ],
    missing: [
      'Owner 29/09/2026: nội dung quạt Ballad hiện còn sai nhiều — Owner sẽ chỉnh. Đang là bản nháp.',
      'Hướng quạt lên/xuống của Quạt Ballad 1/2.',
      'Đặc điểm/cảm giác riêng của điệu Ballad (ngoài công thức) — chưa có, không tự viết.',
      'Lỗi thường gặp khi đệm Ballad.',
      'Bài hát gợi ý cho bài tập; Intro/Outro; audio/video mẫu.',
      'Đối chiếu Bài 1.8 “Mẫu quạt Ballad cơ bản”, 4.5, 4.6 “Mẫu rải Ballad đơn giản” với các âm hình trên trước khi ghi “ôn Bài …”.',
    ],
    notes: [
      'Ký âm StrumScore: Quạt Ballad 2 đánh dấu nhấn (>) ở đầu phách 1 và 3 (phách 3 = đầu lần lặp thứ hai của mẫu 2/4).',
      'Quạt Ballad 1/2 chưa có hướng quạt → event không nhãn, không mũi tên.',
      '“(21)” là hai dây móc cùng lúc = một event.',
      'Câu “Chọn một mẫu rồi giữ nguyên suốt điệp khúc” là Claude viết thêm ở vòng trước — đã bỏ khỏi nội dung học sinh, chờ Owner xác nhận nếu muốn giữ.',
    ],
  },
}
