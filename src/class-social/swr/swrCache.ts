// Kho đệm SWR dùng chung cho /me (stale-while-revalidate) — THUẦN, không import supabase.
// Quy tắc an toàn:
//  • Mọi khoá gắn với CHỦ SỞ HỮU (userId của phiên hiện tại). Đổi tài khoản / đăng xuất → xoá sạch.
//  • Có TTL và giới hạn số mục (không giữ vô hạn). Chỉ lưu trong bộ nhớ trang (không localStorage).
//  • Chỉ cho dữ liệu ĐỌC. Nơi dùng vẫn LUÔN hỏi lại server; kết quả server thay thế bản đệm.
import { clearInboxCache } from '../chat/inboxCache'

const TTL_MS = 10 * 60_000
const MAX_ENTRIES = 80
const store = new Map<string, { at: number; value: unknown }>()
let owner: string | null = null

/** Đặt chủ sở hữu hiện tại; khác chủ cũ (kể cả null) → xoá toàn bộ để không lộ dữ liệu sang phiên khác. */
export function setSwrOwner(userId: string | null): void {
  if (owner === userId) return
  owner = userId
  store.clear()
}
export function getSwrOwner(): string | null { return owner }

/** Xoá hết (đăng xuất, mất quyền): gồm cả bộ đệm danh sách Chat. */
export function clearSwr(): void { store.clear(); clearInboxCache() }

const fullKey = (key: string) => (owner ? `${owner}|${key}` : null)

export function peekSwr<T>(key: string, now = Date.now()): T | undefined {
  const k = fullKey(key)
  if (!k) return undefined
  const e = store.get(k)
  if (!e) return undefined
  if (now - e.at > TTL_MS) { store.delete(k); return undefined }
  return e.value as T
}
export function putSwr<T>(key: string, value: T, now = Date.now()): void {
  const k = fullKey(key)
  if (!k) return
  store.delete(k)
  store.set(k, { at: now, value })
  while (store.size > MAX_ENTRIES) store.delete(store.keys().next().value as string)
}
export function dropSwr(key: string): void {
  const k = fullKey(key)
  if (k) store.delete(k)
}
