// Gợi ý nhỏ của ô chia sẻ Home — chèn câu mở đầu, KHÔNG phải loại bài riêng (vẫn là bài 'status').
// Không dùng "Bạn đang nghĩ gì?": định hướng là chia sẻ về âm nhạc.
export const SHARE_PROMPTS: { icon: string; label: string; prefix: string }[] = [
  { icon: '🎸', label: 'Đang tập', prefix: '🎸 Đang tập: ' },
  { icon: '🎵', label: 'Vừa đàn', prefix: '🎵 Vừa đàn: ' },
  { icon: '🙋', label: 'Nhờ góp ý', prefix: '🙋 Nhờ mọi người góp ý: ' },
  { icon: '✍️', label: 'Chia sẻ', prefix: '✍️ ' },
]
