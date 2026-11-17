// Phục hồi an toàn khi một chunk JS (import động) không tải được — thường do học viên mở trang TRƯỚC deploy rồi dùng tiếp SAU deploy:
// Netlify thay toàn bộ /assets/* bằng bản băm mới, chunk cũ biến mất. Không thể "tải lại chunk cũ"; chỉ có thể tải lại trang để lấy bản mới.
// Module này (thuần, không React, chạy được trong Node test) gồm: nhận diện lỗi, giữ bản nháp qua lần tải lại, và chốt chống vòng lặp tải lại.

/** Lỗi tải module động của các trình duyệt (Chrome/Edge · Firefox · Safari) + lỗi preload CSS của Vite. */
export function isChunkLoadError(e: unknown): boolean {
  const m = e instanceof Error ? `${e.name} ${e.message}` : typeof e === 'string' ? e : ''
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk/i.test(m)
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
function store(): Store | null {
  try { return typeof sessionStorage === 'undefined' ? null : sessionStorage } catch { return null }
}

const DRAFT_PREFIX = 'tva-recover:'
export const DRAFT_TTL_MS = 15 * 60 * 1000

/** Giữ một bản nháp (JSON) qua lần tải lại; hết hạn sau 15 phút. Không bao giờ ném lỗi (sessionStorage có thể bị chặn / đầy). */
export function stashDraft(key: string, value: unknown, s: Store | null = store(), now = Date.now()): boolean {
  try { s?.setItem(DRAFT_PREFIX + key, JSON.stringify({ t: now, v: value })); return !!s } catch { return false }
}
/** Đọc bản nháp còn hạn (không xoá — gọi clearDraft khi đã dùng xong). Hỏng / hết hạn → null. */
export function peekDraft<T = unknown>(key: string, s: Store | null = store(), now = Date.now()): T | null {
  try {
    const raw = s?.getItem(DRAFT_PREFIX + key)
    if (!raw) return null
    const o = JSON.parse(raw) as { t?: number; v?: T }
    if (typeof o.t !== 'number' || now - o.t > DRAFT_TTL_MS || now < o.t - 60_000) { s?.removeItem(DRAFT_PREFIX + key); return null }
    return (o.v ?? null) as T | null
  } catch { return null }
}
export function clearDraft(key: string, s: Store | null = store()): void {
  try { s?.removeItem(DRAFT_PREFIX + key) } catch { /* bỏ qua */ }
}

const RELOAD_FLAG = 'tva-chunk-reload-at'
export const RELOAD_GUARD_MS = 60_000
/** Chốt chống vòng lặp: cho tự tải lại tối đa MỘT lần / 60 giây. Trả true (và ghi dấu) nếu được phép. Không có storage → KHÔNG tự tải lại. */
export function claimAutoReload(s: Store | null = store(), now = Date.now()): boolean {
  try {
    if (!s) return false
    const last = Number(s.getItem(RELOAD_FLAG) ?? 0)
    if (last && now - last < RELOAD_GUARD_MS && now >= last) return false
    s.setItem(RELOAD_FLAG, String(now))
    return true
  } catch { return false }
}

/** import() thử lại MỘT lần sau 400ms (mạng chập chờn); chunk đã bị xoá khỏi bản deploy sẽ vẫn lỗi → ném ra cho ChunkErrorBoundary. */
export function importWithRetry<T>(factory: () => Promise<T>, delayMs = 400): Promise<T> {
  return factory().catch(e => {
    if (!isChunkLoadError(e)) throw e
    return new Promise<T>((resolve, reject) => setTimeout(() => factory().then(resolve, reject), delayMs))
  })
}
