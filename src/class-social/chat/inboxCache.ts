// Bộ nhớ đệm danh sách Trò chuyện (stale-while-revalidate) — THUẦN, theo (người dùng, bộ lọc).
// Mở Chat lần sau: hiện ngay dữ liệu đã có, đồng thời hỏi server; kết quả server thay thế (không nhấp nháy).
// Khoá theo userId nên không bao giờ hiện dữ liệu của tài khoản khác; đăng xuất → xoá hết.
import type { ConversationItem } from './chatModel'
import type { InboxSummary } from './inboxModel'

export type InboxSnapshot = { pinned: ConversationItem[]; items: ConversationItem[]; hasMore: boolean; summary: InboxSummary | null }
const TTL_MS = 10 * 60_000
const MAX_ENTRIES = 12
const store = new Map<string, { at: number; snap: InboxSnapshot }>()

const keyOf = (userId: string, filterKey: string) => `${userId}|${filterKey}`
/** Chỉ cache danh sách của MÌNH, không lọc theo chữ tìm kiếm */
export const cacheable = (userId: string | undefined, filterKey: string) => !!userId && filterKey.startsWith('mine|') && filterKey.endsWith('|')

export function getInboxCache(userId: string | undefined, filterKey: string, now = Date.now()): InboxSnapshot | null {
  if (!cacheable(userId, filterKey)) return null
  const e = store.get(keyOf(userId!, filterKey))
  if (!e) return null
  if (now - e.at > TTL_MS) { store.delete(keyOf(userId!, filterKey)); return null }
  return e.snap
}
export function putInboxCache(userId: string | undefined, filterKey: string, snap: InboxSnapshot, now = Date.now()): void {
  if (!cacheable(userId, filterKey)) return
  const k = keyOf(userId!, filterKey)
  store.delete(k)
  store.set(k, { at: now, snap })
  while (store.size > MAX_ENTRIES) store.delete(store.keys().next().value as string)
}
export function clearInboxCache(): void { store.clear() }
