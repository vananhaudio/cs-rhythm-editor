// Cấu trúc menu + ánh xạ URL của khung Admin (/admin). Thuần dữ liệu để test được.
// id = khoá nội bộ; slug = đoạn sau /admin/ (giữ nguyên các URL đã chạy trước đây).

export type AdminSection =
  | 'dashboard' | 'lop' | 'schedule' | 'ht2027' | 'students' | 'leads' | 'community'
  | 'courses' | 'journey' | 'tools' | 'nhipphach'
  | 'newsfeed' | 'articles' | 'showcase' | 'dailymail' | 'chatmail'
  | 'aichat' | 'assistant'

export interface AdminNavItem { id: AdminSection; slug: string; icon: string; label: string }
export interface AdminNavGroup { title: string | null; items: AdminNavItem[] }

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  { title: null, items: [
    { id: 'dashboard', slug: '', icon: '⊞', label: 'Tổng quan' },
  ] },
  { title: 'Lớp học', items: [
    { id: 'lop',       slug: 'lop',       icon: '🏫', label: 'Danh sách lớp' },
    { id: 'schedule',  slug: 'schedule',  icon: '🗓', label: 'Lớp & lịch' },
    { id: 'ht2027',    slug: 'ht2027',    icon: '🎸', label: 'Thực hành HT2027' },
    { id: 'students',  slug: 'students',  icon: '👥', label: 'Học viên' },
    { id: 'leads',     slug: 'leads',     icon: '📝', label: 'Đăng ký' },
    { id: 'community', slug: 'community', icon: '🌱', label: 'Nhóm cộng đồng' },
  ] },
  { title: 'Học liệu', items: [
    { id: 'courses',   slug: 'courses',   icon: '📚', label: 'Khoá học' },
    { id: 'journey',   slug: 'journey',   icon: '🗺', label: 'Hành trình' },
    { id: 'tools',     slug: 'tools',     icon: '🛠', label: 'Công cụ' },
    { id: 'nhipphach', slug: 'nhipphach', icon: '🎼', label: 'Nhịp phách' },
  ] },
  { title: 'Nội dung & truyền thông', items: [
    { id: 'newsfeed',  slug: 'newsfeed',   icon: '🗞', label: 'Bản tin trong app' },
    { id: 'articles',  slug: 'articles',   icon: '📰', label: 'Bài viết tuyển sinh' },
    { id: 'showcase',  slug: 'showcase',   icon: '📄', label: 'Trang Showcase' },
    { id: 'dailymail', slug: 'daily-mail', icon: '📧', label: 'Thư hàng ngày' },
    { id: 'chatmail',  slug: 'chat-mail',  icon: '✉️', label: 'Chat Mail' },
  ] },
  { title: 'Trợ lý AI', items: [
    { id: 'aichat',    slug: 'aichat',    icon: '💬', label: 'AI tuyển sinh' },
    { id: 'assistant', slug: 'assistant', icon: '🤖', label: 'Trợ lý quản trị' },
  ] },
]

export const ADMIN_NAV: AdminNavItem[] = ADMIN_NAV_GROUPS.flatMap(g => g.items)

// Slug cũ vẫn mở được (trước đây slug = id nội bộ).
// 'classes' (mục "Giáo trình lớp" cũ) đã gộp vào không gian lớp: tab Giáo trình của /admin/lop/<id>.
const SLUG_ALIASES: Record<string, AdminSection> = { dailymail: 'dailymail', chatmail: 'chatmail', classes: 'lop' }

/** Đường dẫn cũ cần đổi sang đường mới (giữ query/hash ở nơi gọi). null = không cần đổi. */
export function adminLegacyRedirect(pathname: string): string | null {
  return /^\/admin\/classes(?:\/.*)?$/.test(pathname) ? '/admin/lop' : null
}

const BY_SLUG = new Map<string, AdminSection>(ADMIN_NAV.filter(n => n.slug).map(n => [n.slug, n.id]))

/** Mục suy từ pathname. null = không phải mục hợp lệ (ví dụ /admin/abc). */
export function adminSectionFromPath(pathname: string): AdminSection | null {
  const m = /^\/admin(?:\/([^/]+))?(?:\/.*)?$/.exec(pathname)
  if (!m) return null
  const slug = m[1]
  if (!slug) return 'dashboard'
  return BY_SLUG.get(slug) ?? SLUG_ALIASES[slug] ?? null
}

export function adminPathForSection(id: AdminSection): string {
  const item = ADMIN_NAV.find(n => n.id === id)
  return item && item.slug ? `/admin/${item.slug}` : '/admin'
}

export function adminLabel(id: AdminSection): string {
  return ADMIN_NAV.find(n => n.id === id)?.label ?? 'Admin'
}

export interface QuickLink { label: string; icon: string; href: string; external?: boolean }

/** Trang nằm ngoài khung Admin; quyền do chính trang đích quyết. /me/* chỉ chạy ở host Class. */
export function adminQuickLinks(meBase: string): QuickLink[] {
  return [
    { icon: '🎼', label: 'Thư viện nhạc',      href: '/thuvien' },
    { icon: '🎤', label: 'Quản lý Band',       href: `${meBase}/me/bands` },
    { icon: '📥', label: 'Hàng đợi trả bài',   href: `${meBase}/me/queue` },
    { icon: '⚑',  label: 'Báo cáo nội dung',   href: '/story/reports' },
    { icon: '🧠', label: 'Kho Tri Thức',        href: 'https://khotrithuc.netlify.app', external: true },
    { icon: '🎚', label: 'TeamLab',             href: 'https://class.vananhaudio.com/teamlab', external: true },
    { icon: '↗',  label: 'Trang học sinh',     href: '/start' },
  ]
}

// ── Không gian một lớp: /admin/lop/<classKey>[/<tab>] ─────────────────────────
// classKey = id lớp (class_schedule.id). Mã lớp (code) không có ràng buộc duy nhất đã xác minh nên không dùng làm khoá URL.
export type ClassTab = 'overview' | 'schedule' | 'students' | 'curriculum' | 'settings'
export const CLASS_TABS: { id: ClassTab; slug: string; label: string }[] = [
  { id: 'overview',   slug: '',           label: 'Tổng quan' },
  { id: 'schedule',   slug: 'lich',       label: 'Lịch học' },
  { id: 'students',   slug: 'hoc-vien',   label: 'Học viên' },
  { id: 'curriculum', slug: 'giao-trinh', label: 'Giáo trình' },
  { id: 'settings',   slug: 'thiet-lap',  label: 'Thiết lập' },
]

export interface AdminClassRoute { classKey: string; tab: ClassTab; tabValid: boolean }

/** null = không phải đường dẫn vào một lớp (kể cả danh sách /admin/lop). */
export function parseAdminClassPath(pathname: string): AdminClassRoute | null {
  const m = /^\/admin\/lop\/([^/]+)(?:\/([^/]+))?\/?$/.exec(pathname)
  if (!m) return null
  let classKey: string
  try { classKey = decodeURIComponent(m[1]) } catch { return null }
  const slug = m[2] ?? ''
  const tab = CLASS_TABS.find(t => t.slug === slug)
  return { classKey, tab: tab?.id ?? 'overview', tabValid: !!tab }
}

export function adminClassPath(classKey: string, tab: ClassTab = 'overview'): string {
  const slug = CLASS_TABS.find(t => t.id === tab)?.slug ?? ''
  return `/admin/lop/${encodeURIComponent(classKey)}${slug ? `/${slug}` : ''}`
}
