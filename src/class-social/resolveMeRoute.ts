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
export function isSocialHost(hostname: string, isNative: boolean): boolean {
  return !isNative && hostname.startsWith('class.')
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

/** Màn đang mở trong /me: một mục (section), trang cá nhân, một learning thread, hoặc hàng đợi của Thầy. */
export type MeView =
  | { kind: 'section'; section: SocialSection }
  | { kind: 'profile'; userId: string }
  | { kind: 'thread'; threadId: string }
  | { kind: 'queue' }

export function viewFromPath(pathname: string): MeView {
  const userId = profileUserIdFromPath(pathname)
  if (userId) return { kind: 'profile', userId }
  const threadId = threadIdFromPath(pathname)
  if (threadId) return { kind: 'thread', threadId }
  if (pathname.replace(/\/+$/, '') === QUEUE_PATH) return { kind: 'queue' }
  return { kind: 'section', section: sectionFromPath(pathname) }
}

export function sameView(a: MeView, b: MeView): boolean {
  switch (a.kind) {
    case 'profile': return b.kind === 'profile' && a.userId === b.userId
    case 'thread': return b.kind === 'thread' && a.threadId === b.threadId
    case 'queue': return b.kind === 'queue'
    default: return b.kind === 'section' && a.section === b.section
  }
}

export function viewPath(view: MeView): string {
  switch (view.kind) {
    case 'profile': return profilePath(view.userId)
    case 'thread': return threadPath(view.threadId)
    case 'queue': return QUEUE_PATH
    default: return SECTION_PATHS[view.section]
  }
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
