// Menu của Class Social — DỮ LIỆU, không chứa logic hiển thị.
// Trang chủ (/me = Tôi + Cộng đồng) KHÔNG nằm trong menu: logo đưa về /me.
// Cộng đồng = mục trong chính Social; Học tập / Công cụ = destination ra app hiện có.
import type { LucideIcon } from 'lucide-react'
import { BookMarked, BookOpen, GraduationCap, LayoutGrid, Library, MessageCircle, Users } from 'lucide-react'
import { LEARN_PATH, type SocialSection } from './resolveMeRoute'
import { TOOLS } from './tools'

export type NavItem =
  | { kind: 'section'; id: SocialSection; label: string; icon: LucideIcon }
  // Mở cùng tab, tải trang đầy đủ (không iframe) — Back của trình duyệt quay lại /me
  | { kind: 'destination'; id: string; label: string; icon: LucideIcon; href: string; hint: string }
  // Chưa mở đại trà: hiện khoá, KHÔNG bấm được (không tự đặt luật phân quyền mới)
  | { kind: 'restricted'; id: string; label: string; icon: LucideIcon; note: string }

export type NavGroup = { id: string; title: string; items: NavItem[] }

export const HT_ONLY_NOTE = 'Dành cho học sinh lớp Hành trình'

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'community',
    title: 'Cộng đồng',
    items: [
      { kind: 'section', id: 'friends', label: 'Bạn bè', icon: Users },
      { kind: 'section', id: 'chat', label: 'Trò chuyện', icon: MessageCircle },
    ],
  },
  {
    id: 'learning',
    title: 'Học tập',
    items: [
      { kind: 'destination', id: 'learn', label: 'App học', icon: GraduationCap, href: LEARN_PATH, hint: 'Bài học, luyện tập và tiến độ của bạn' },
      { kind: 'destination', id: 'khobaigiang', label: 'Kho bài giảng', icon: BookOpen, href: '/khobaigiang', hint: 'Video bài giảng của Thầy' },
      { kind: 'restricted', id: 'giaotrinh', label: 'Kho giáo trình', icon: BookMarked, note: HT_ONLY_NOTE },
      { kind: 'restricted', id: 'thuvien', label: 'Thư viện bản nhạc', icon: Library, note: HT_ONLY_NOTE },
    ],
  },
  {
    id: 'tools',
    title: 'Công cụ âm nhạc',
    items: [
      // Công cụ dùng nhiều nhất hiện ngay; đủ danh sách ở "Tất cả công cụ" (/me/tools)
      ...TOOLS.filter(t => t.featured).map(t => ({ kind: 'destination' as const, id: t.id, label: t.label, icon: t.icon, href: t.href, hint: t.hint })),
      { kind: 'section', id: 'tools', label: 'Tất cả công cụ', icon: LayoutGrid },
    ],
  },
]
