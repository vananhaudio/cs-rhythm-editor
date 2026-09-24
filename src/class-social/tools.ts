// Công cụ âm nhạc cho học sinh — CHỈ những công cụ THẬT đang bật cho học sinh.
// Nguồn đối chiếu (audit 24/09/2026): bảng edu_tools (enabled + status 'on', có route) và nhánh route
// trong AppRouter. Social chỉ ĐIỀU HƯỚNG (cùng tab, tải trang đầy đủ): quyền vào từng công cụ vẫn do
// ToolRouteGate/my_tool_route_access của app quyết định — không tự cấp quyền.
// Không đưa: route THỬ NGHIỆM (/chord-trainer, /chord-ame, /piano-player, /groove, /gp-editor), chỉ-thầy
// (/editor, /strum-builder), công cụ đã tắt (/tempo), "Bài luyện" (chỉ chạy trong App học, không có link).
import type { LucideIcon } from 'lucide-react'
import { AudioWaveform, Disc3, FileMusic, Grid3x3, Guitar, Hand, ListMusic, Piano, Timer } from 'lucide-react'

export type ToolGroup = 'nhip' | 'cao-do' | 'ban-nhac' | 'sang-tao'
export type Tool = {
  id: string            // = edu_tools.id
  label: string
  hint: string
  href: string
  icon: LucideIcon
  group: ToolGroup
  /** Hiện ngay trên sidebar (các công cụ dùng nhiều nhất); còn lại ở "Tất cả công cụ" */
  featured?: boolean
}

export const TOOL_GROUP_LABEL: Record<ToolGroup, string> = {
  'nhip': 'Nhịp & luyện tập',
  'cao-do': 'Cao độ',
  'ban-nhac': 'Bản nhạc & hợp âm',
  'sang-tao': 'Cần đàn & khám phá',
}

// Thứ tự theo nhu cầu học sinh: luyện hằng ngày → nhịp → cao độ → bản nhạc → khám phá.
export const TOOLS: Tool[] = [
  { id: 'metronome', label: 'Máy đập nhịp', hint: 'Giữ nhịp khi luyện mỗi ngày', href: '/metronome', icon: Timer, group: 'nhip', featured: true },
  { id: 'nhipphach', label: 'Nhịp & Phách', hint: 'Đọc nhịp – phách trên bản nhạc', href: '/nhipphach', icon: ListMusic, group: 'nhip', featured: true },
  { id: 'tap-beat', label: 'Tap Beat', hint: 'Gõ nhịp theo bài hát', href: '/tap', icon: Hand, group: 'nhip', featured: true },
  { id: 'song-builder', label: 'BMS — Beat my Songs', hint: 'Đánh theo nhịp bài hát của bạn', href: '/song-builder', icon: Disc3, group: 'nhip' },
  { id: 'tuner', label: 'Tune Lab', hint: 'Lên dây đàn guitar', href: '/tuner', icon: AudioWaveform, group: 'cao-do', featured: true },
  { id: 'chord-seeing', label: 'Hợp âm', hint: 'Tra thế bấm hợp âm', href: '/chords', icon: Guitar, group: 'ban-nhac', featured: true },
  { id: 'note-sheet', label: 'Note Sheet', hint: 'Luyện nhận diện nốt nhạc', href: '/notesheet', icon: FileMusic, group: 'ban-nhac' },
  { id: 'guitar-board', label: 'GuitarBoard', hint: 'Khám phá nốt trên cần đàn', href: '/guitarboard', icon: Grid3x3, group: 'sang-tao' },
  { id: 'piano-journey', label: 'Piano Journey', hint: 'Hành trình piano cùng Cô Piano', href: '/piano-journey', icon: Piano, group: 'sang-tao' },
]
