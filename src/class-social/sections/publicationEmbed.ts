// Nhúng Published Player công khai của TeamLab vào thẻ Feed (iframe cùng origin). THUẦN + một store nhỏ "đang mở".
// Không copy player, không URL tự ghép từ tên: chỉ slug đã kiểm dạng (SLUG_RE ở postModel) và slug Team từ server.
import { useSyncExternalStore } from 'react'

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
export const SHARE_ORIGIN = 'https://class.vananhaudio.com'
export const EMBED_MIN_H = 96
export const EMBED_MAX_H = 640
export const EMBED_DEFAULT_H = 168
/** Native không nhận được thông điệp chiều cao (TeamLab chỉ gửi cho cùng origin) → chiều cao cố định đủ cho player, cuộn được. */
export const EMBED_NATIVE_H = 320

export const isSlug = (s: unknown): s is string => typeof s === 'string' && s.length > 0 && s.length <= 60 && SLUG_RE.test(s)
export const songPath = (slug: string) => `/teamlab/song/${slug}`
/** Vỏ native (TVA Guitar, Capacitor): app nạp bundle cục bộ nên đường dẫn tương đối /teamlab/... trỏ vào CHÍNH app, không phải TeamLab. */
export const isNativeShell = (): boolean =>
  typeof window !== 'undefined' && !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
/** Gốc web của TeamLab: native → tuyệt đối; web thường → cùng origin (để rỗng). */
export const webBase = (native: boolean = isNativeShell()): string => (native ? SHARE_ORIGIN : '')
/** Origin mà thông điệp chiều cao phải đến từ đó. */
export const embedOrigin = (selfOrigin: string, native: boolean = isNativeShell()): string => (native ? SHARE_ORIGIN : selfOrigin)
export const embedSrc = (slug: string, native: boolean = isNativeShell()) => `${webBase(native)}${songPath(slug)}?embed=1`
export const bandPath = (projectSlug: string | null | undefined, native: boolean = isNativeShell()): string | null => (isSlug(projectSlug) ? `${webBase(native)}/teamlab/band/${projectSlug}` : null)
export const publicSongUrl = (slug: string) => SHARE_ORIGIN + songPath(slug)

/** Thông điệp chiều cao từ iframe: chỉ nhận cùng origin, đúng slug, số hợp lệ; kẹp trong [MIN, MAX]. */
export function heightFromMessage(ev: { origin: string; data: unknown }, selfOrigin: string, slug: string): number | null {
  if (ev.origin !== selfOrigin) return null
  const d = ev.data as { type?: unknown; slug?: unknown; height?: unknown } | null
  if (!d || typeof d !== 'object' || d.type !== 'teamlab-embed-height' || d.slug !== slug) return null
  const h = Number(d.height)
  if (!Number.isFinite(h) || h <= 0) return null
  return Math.min(EMBED_MAX_H, Math.max(EMBED_MIN_H, Math.ceil(h)))
}

// Một bài đang mở tại một thời điểm: mở bài khác → bài cũ tự gỡ iframe (dừng âm thanh, giải phóng tài nguyên).
let activeId: string | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())
export const openEmbed = (id: string) => { if (activeId !== id) { activeId = id; emit() } }
export const closeEmbed = (id: string) => { if (activeId === id) { activeId = null; emit() } }
export const activeEmbedId = () => activeId
export function useActiveEmbed(): string | null {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => { listeners.delete(cb) } },
    () => activeId,
    () => null,
  )
}
export function resetEmbedStore() { activeId = null }
