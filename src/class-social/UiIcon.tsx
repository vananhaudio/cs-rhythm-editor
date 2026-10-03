// /ME VISUAL SYSTEM V1 — MỘT thư viện icon cho UI (Lucide). Dữ liệu/model vẫn mang emoji (vd feedModel, sharePrompts,
// tiền tố "🎸 Đang tập:" trong BÀI ĐĂNG là NỘI DUNG — giữ); chỉ lớp HIỂN THỊ chrome đổi emoji → icon cùng cỡ, cùng nét.
// Emoji lạ (không nằm trong bảng) hiện nguyên như nội dung. Không mang nghĩa bằng màu: icon kế thừa màu chữ.
import type { LucideIcon } from 'lucide-react'
import { BookOpen, CircleCheck, CircleHelp, Guitar, HandHelping, MessageCircle, Music, PenLine, RotateCcw } from 'lucide-react'

const MAP: Record<string, LucideIcon> = {
  '🎸': Guitar, '❓': CircleHelp, '💬': MessageCircle, '✅': CircleCheck, '🔄': RotateCcw,
  '📘': BookOpen, '🎵': Music, '🙋': HandHelping, '✍️': PenLine,
}

/** Icon UI chuẩn: inline 16px (metadata/action), nét 2 — căn baseline với chữ. */
export default function UiIcon({ emoji, size = 16 }: { emoji: string; size?: number }) {
  const Icon = MAP[emoji]
  if (!Icon) return <span aria-hidden="true">{emoji}</span>
  return <Icon size={size} strokeWidth={2} aria-hidden="true" className="cs-uiicon" />
}
