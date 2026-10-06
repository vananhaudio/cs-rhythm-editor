// ─────────────────────────────────────────────────────────────────────────────
// Route /me của Class Social — hàm THUẦN (không đụng window) để test được.
//
//  class.<domain>/me, /me/…     → Class Social (cửa chính mới của học sinh)
//  class.<domain>/me?tab=…      → /learn?tab=… (deep link cũ của App học vẫn chạy)
//  native (Capacitor), timming., localhost… → null = giữ routing cũ (/me vẫn là App học)
//
// App học hiện tại sống ở /learn (và /start như cũ) — xem AppRouter.
// ─────────────────────────────────────────────────────────────────────────────

// /me = TÔI + CỘNG ĐỒNG (một trang duy nhất); Bạn bè / Trò chuyện là mục con.
export type SocialSection = 'home' | 'friends' | 'chat' | 'tools'

export type MeRoute =
  | { kind: 'social'; section: SocialSection }
  | { kind: 'redirect'; to: string }

/** Path của từng mục. `home` là chính /me. */
export const SECTION_PATHS: Record<SocialSection, string> = {
  home: '/me',
  friends: '/me/friends',
  chat: '/me/chat',
  tools: '/me/tools',
}

export const LEARN_PATH = '/learn'

/** Trang Class công khai (tuyển sinh) — cổng thứ hai, dùng chung phiên đăng nhập với /me. */
export const CLASS_HOME_PATH = '/'

export function isMePath(pathname: string): boolean {
  return pathname === '/me' || pathname.startsWith('/me/')
}

export function isLearnPath(pathname: string): boolean {
  return pathname === LEARN_PATH || pathname.startsWith(LEARN_PATH + '/')
}

/** Social chỉ bật trên web ở host class.* — đúng phạm vi đã audit. */
// Bản draft (deploy preview Netlify: <deploy id 24 hex>--<site>.netlify.app) chạy cùng bundle với class.* →
// /me ở draft phải là Class Social như production, nếu không trang quản trị (/me/bands/…) không mở được để nghiệm thu.
const DEPLOY_PREVIEW_RE = /^[0-9a-f]{24}--[a-z0-9-]+\.netlify\.app$/

export function isSocialHost(hostname: string, isNative: boolean): boolean {
  return !isNative && (hostname.startsWith('class.') || DEPLOY_PREVIEW_RE.test(hostname))
}

export function sectionFromPath(pathname: string): SocialSection {
  const p = pathname.replace(/\/+$/, '') || '/'
  const hit = (Object.keys(SECTION_PATHS) as SocialSection[]).find(k => SECTION_PATHS[k] === p)
  return hit ?? 'home'
}

// ── Trang cá nhân / tường: /me/u/<auth user id> ────────────────────────────
// Không có hệ username: định danh trên URL là auth.users.id (UUID). Chỉ nhận UUID hợp lệ.
export const PROFILE_PREFIX = '/me/u/'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function profilePath(userId: string): string {
  return PROFILE_PREFIX + userId
}

export function profileUserIdFromPath(pathname: string): string | null {
  const p = pathname.replace(/\/+$/, '')
  if (!p.startsWith(PROFILE_PREFIX)) return null
  const id = p.slice(PROFILE_PREFIX.length)
  return UUID_RE.test(id) ? id.toLowerCase() : null
}

// ── Learning Thread (Trả bài / Hỏi bài theo bài học): /me/t/<thread id> · hàng đợi Thầy: /me/queue ──
// Quyền xem do server quyết định (RPC lt_detail / lt_teacher_queue) — route chỉ nhận UUID hợp lệ.
export const THREAD_PREFIX = '/me/t/'
export const QUEUE_PATH = '/me/queue'

export function threadPath(threadId: string): string {
  return THREAD_PREFIX + threadId
}

export function threadIdFromPath(pathname: string): string | null {
  const p = pathname.replace(/\/+$/, '')
  if (!p.startsWith(THREAD_PREFIX)) return null
  const id = p.slice(THREAD_PREFIX.length)
  return UUID_RE.test(id) ? id.toLowerCase() : null
}

// ── Lớp học: /me/classes (Lớp của tôi + Khám phá) · /me/classes/<class_schedule.id> (không gian của lớp) ──
export const CLASSES_PATH = '/me/classes'

export function classPath(classId: string): string {
  return CLASSES_PATH + '/' + classId
}

export function classIdFromPath(pathname: string): string | null {
  const p = pathname.replace(/\/+$/, '')
  if (!p.startsWith(CLASSES_PATH + '/')) return null
  const id = p.slice(CLASSES_PATH.length + 1)
  return UUID_RE.test(id) ? id.toLowerCase() : null
}

// ── Trang BUỔI (phòng học): /me/classes/<class id>/sessions/<số buổi> — URL riêng, reload/deep link được ──
// Buổi 0 = NHẬP MÔN (db/class_session_zero_intro.sql) nên số buổi được phép là 0.
// Trang lớp = BẢN ĐỒ (chọn buổi); trang buổi = nơi HỌC. Quyền xem giáo án vẫn do RLS + RPC quyết, không do URL.
export function sessionPath(classId: string, sessionNo: number): string {
  return `${classPath(classId)}/sessions/${sessionNo}`
}

const SESSION_RE = /^\/me\/classes\/([0-9a-f-]{36})\/sessions\/(0|[1-9][0-9]{0,3})$/i
export function sessionFromPath(pathname: string): { classId: string; sessionNo: number } | null {
  const m = SESSION_RE.exec(pathname.replace(/\/+$/, ''))
  return m && UUID_RE.test(m[1]) ? { classId: m[1].toLowerCase(), sessionNo: Number(m[2]) } : null
}

// ── KHÔNG GIAN LỚP (Class UX V3): /me/classes/<class id>/space — Feed của đúng một lớp + Thành viên (tách khỏi trang học) ──
export function classSpacePath(classId: string): string {
  return `${classPath(classId)}/space`
}

const SPACE_RE = /^\/me\/classes\/([0-9a-f-]{36})\/space$/i
export function classSpaceFromPath(pathname: string): string | null {
  const m = SPACE_RE.exec(pathname.replace(/\/+$/, ''))
  return m && UUID_RE.test(m[1]) ? m[1].toLowerCase() : null
}

// ── Quản lý Band (Recruit V1 + Quản lý V1): /me/bands · /me/bands/<slug> — quyền do server (band_can_manage) quyết ──
export const BANDS_PATH = '/me/bands'
const BAND_SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

export function bandAdminPath(slug: string): string {
  return BANDS_PATH + '/' + slug
}

export function bandAdminSlugFromPath(pathname: string): string | null {
  const p = pathname.replace(/\/+$/, '')
  if (!p.startsWith(BANDS_PATH + '/')) return null
  const slug = p.slice(BANDS_PATH.length + 1)
  return BAND_SLUG_RE.test(slug) && slug.length <= 60 ? slug : null
}

/** Màn đang mở trong /me: mục, trang cá nhân, learning thread, hàng đợi Thầy, danh sách lớp, hoặc một lớp. */
export type MeView =
  | { kind: 'section'; section: SocialSection }
  | { kind: 'profile'; userId: string }
  | { kind: 'thread'; threadId: string }
  | { kind: 'queue' }
  | { kind: 'classes' }
  | { kind: 'class'; classId: string }
  | { kind: 'session'; classId: string; sessionNo: number }
  | { kind: 'classSpace'; classId: string }
  | { kind: 'bands' }
  | { kind: 'bandAdmin'; slug: string }

export function viewFromPath(pathname: string): MeView {
  const userId = profileUserIdFromPath(pathname)
  if (userId) return { kind: 'profile', userId }
  const threadId = threadIdFromPath(pathname)
  if (threadId) return { kind: 'thread', threadId }
  const ses = sessionFromPath(pathname)
  if (ses) return { kind: 'session', ...ses }
  const spaceId = classSpaceFromPath(pathname)
  if (spaceId) return { kind: 'classSpace', classId: spaceId }
  const classId = classIdFromPath(pathname)
  if (classId) return { kind: 'class', classId }
  const bandSlug = bandAdminSlugFromPath(pathname)
  if (bandSlug) return { kind: 'bandAdmin', slug: bandSlug }
  const p = pathname.replace(/\/+$/, '')
  if (p === BANDS_PATH) return { kind: 'bands' }
  if (p === QUEUE_PATH) return { kind: 'queue' }
  if (p === CLASSES_PATH) return { kind: 'classes' }
  return { kind: 'section', section: sectionFromPath(pathname) }
}

export function sameView(a: MeView, b: MeView): boolean {
  switch (a.kind) {
    case 'profile': return b.kind === 'profile' && a.userId === b.userId
    case 'thread': return b.kind === 'thread' && a.threadId === b.threadId
    case 'class': return b.kind === 'class' && a.classId === b.classId
    case 'session': return b.kind === 'session' && a.classId === b.classId && a.sessionNo === b.sessionNo
    case 'classSpace': return b.kind === 'classSpace' && a.classId === b.classId
    case 'queue': return b.kind === 'queue'
    case 'classes': return b.kind === 'classes'
    case 'bands': return b.kind === 'bands'
    case 'bandAdmin': return b.kind === 'bandAdmin' && a.slug === b.slug
    default: return b.kind === 'section' && a.section === b.section
  }
}

export function viewPath(view: MeView): string {
  switch (view.kind) {
    case 'profile': return profilePath(view.userId)
    case 'thread': return threadPath(view.threadId)
    case 'class': return classPath(view.classId)
    case 'session': return sessionPath(view.classId, view.sessionNo)
    case 'classSpace': return classSpacePath(view.classId)
    case 'queue': return QUEUE_PATH
    case 'classes': return CLASSES_PATH
    case 'bands': return BANDS_PATH
    case 'bandAdmin': return bandAdminPath(view.slug)
    default: return SECTION_PATHS[view.section]
  }
}

/** Link sâu nên GIỮ qua bước đăng nhập (khách → đăng nhập tại chỗ → đúng trang). */
export function keepsPathForGuest(view: MeView): boolean {
  return view.kind === 'thread' || view.kind === 'class' || view.kind === 'classes' || view.kind === 'session'
    || view.kind === 'classSpace'
    || view.kind === 'bands' || view.kind === 'bandAdmin'
}

export function resolveMeRoute(input: {
  hostname: string
  pathname: string
  search: string
  isNative: boolean
}): MeRoute | null {
  const { hostname, pathname, search, isNative } = input
  if (!isSocialHost(hostname, isNative) || !isMePath(pathname)) return null
  // Deep link cũ (/me?tab=hoc…) → App học, giữ nguyên toàn bộ query
  if (new URLSearchParams(search).has('tab')) {
    return { kind: 'redirect', to: LEARN_PATH + (search.startsWith('?') ? search : '?' + search) }
  }
  return { kind: 'social', section: sectionFromPath(pathname) }
}
