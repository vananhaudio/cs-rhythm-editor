// Chat List V2 — nguồn dữ liệu danh sách. Mặc định gọi RPC chat_inbox* (phân trang con trỏ, tìm kiếm + lọc phía server, ghim đồng bộ).
// Server CHƯA có chat_inbox (chưa migrate) → tự rơi về chế độ "legacy": 100 hội thoại gần nhất từ RPC cũ, lọc/tìm tại máy, KHÔNG ghim.
// Giao diện chỉ biết interface InboxSource nên Preview/test thay nguồn được mà không đụng mạng.
import { supabase } from '../../supabase'
import type { Result } from '../posts/postsApi'
import { fetchConversations } from './chatApi'
import { chatErrorText, type ConversationItem } from './chatModel'
import {
  INBOX_PAGE, cursorOf, filterLocal, summarizeLocal, toInboxItems, toInboxSummary, type Cursor, type InboxFilter, type InboxRow, type InboxScope,
  type InboxSummary, type InboxSummaryRow,
} from './inboxModel'

export type PinnedMode = 'exclude' | 'only' | 'any'
export type InboxPageArgs = { scope: InboxScope; filter: InboxFilter; pinned: PinnedMode; cursor: Cursor | null; limit?: number }
export type InboxPage = { items: ConversationItem[]; hasMore: boolean }
export type InboxMode = 'server' | 'legacy'

export interface InboxSource {
  /** 'legacy' khi server chưa có chat_inbox (biết sau lần gọi đầu tiên) */
  mode(): InboxMode
  page(a: InboxPageArgs): Promise<Result<InboxPage>>
  summary(): Promise<Result<InboxSummary>>
  pin(key: string, pinned: boolean): Promise<Result<number>>
  /** Một hội thoại (kể cả ngoài trang đang tải) — liên kết trực tiếp tới hội thoại */
  info(key: string): Promise<Result<ConversationItem | null>>
}

const online = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)

type Raw<T> = { ok: true; value: T } | { ok: false; message: string; missing: boolean }
/** RPC có báo "hàm chưa tồn tại" (PGRST202 / 404) để rơi về legacy */
async function rpc<T>(fn: string, args: Record<string, unknown>, ctx?: 'pin'): Promise<Raw<T>> {
  try {
    const { data, error, status } = await supabase.rpc(fn, args)
    if (error) {
      if (import.meta.env.DEV) console.warn(`[class-chat] ${fn}:`, error.code, error.message)
      const missing = error.code === 'PGRST202' || status === 404 || /could not find the function/i.test(error.message ?? '')
      return { ok: false, message: chatErrorText({ ...error, status }, !online(), ctx), missing }
    }
    return { ok: true, value: data as T }
  } catch (e) {
    return { ok: false, message: chatErrorText(e as Error, !online()), missing: false }
  }
}

export function createRpcInboxSource(): InboxSource {
  let mode: InboxMode = 'server'
  let legacyCache: { at: number; items: ConversationItem[] } | null = null

  const legacyAll = async (force = false): Promise<Result<ConversationItem[]>> => {
    if (!force && legacyCache && Date.now() - legacyCache.at < 3000) return { ok: true, value: legacyCache.items }
    const r = await fetchConversations(100)
    if (!r.ok) return r
    // RPC cũ trả tới 100 cá nhân + 100 Band: giữ 100 gần nhất để thông báo "100 gần nhất" luôn đúng
    const items = r.value.slice(0, 100)
    legacyCache = { at: Date.now(), items }
    return { ok: true, value: items }
  }

  return {
    mode: () => mode,
    async page(a) {
      const limit = a.limit ?? INBOX_PAGE
      if (mode === 'server') {
        const r = await rpc<InboxRow[]>('chat_inbox', {
          p_scope: a.scope, p_kind: a.filter.kind, p_query: a.filter.query.trim() || null, p_unread: a.filter.unreadOnly, p_pinned: a.pinned,
          p_limit: limit, p_cursor_at: a.cursor?.at ?? null, p_cursor_key: a.cursor?.key ?? null,
        })
        if (r.ok) { const items = toInboxItems(r.value); return { ok: true, value: { items, hasMore: a.pinned !== 'only' && (r.value?.length ?? 0) >= limit } } }
        if (!r.missing) return { ok: false, message: r.message }
        mode = 'legacy'
      }
      // legacy: một lần tải 100 gần nhất; không có ghim; lọc tại máy; không phân trang
      if (a.pinned === 'only') return { ok: true, value: { items: [], hasMore: false } }
      const all = await legacyAll(a.cursor === null)
      if (!all.ok) return all
      const inScope = all.value.filter(c => (c.readOnly === 'support') === (a.scope === 'support'))
      return { ok: true, value: { items: filterLocal(inScope, a.filter), hasMore: false } }
    },
    async summary() {
      if (mode === 'server') {
        const r = await rpc<InboxSummaryRow[]>('chat_inbox_summary', {})
        if (r.ok) return { ok: true, value: toInboxSummary(Array.isArray(r.value) ? r.value[0] : (r.value as unknown as InboxSummaryRow)) }
        if (!r.missing) return { ok: false, message: r.message }
        mode = 'legacy'
      }
      const all = await legacyAll()
      if (!all.ok) return all
      const mine = all.value.filter(c => c.readOnly !== 'support')
      return { ok: true, value: summarizeLocal(mine, all.value.length - mine.length) }
    },
    async pin(key, pinned) {
      if (mode === 'legacy') return { ok: false, message: 'Tính năng ghim chưa sẵn sàng.' }
      const r = await rpc<number>('chat_pin_set', { p_key: key, p_pinned: pinned }, 'pin')
      if (r.ok) return { ok: true, value: Number(r.value) || 0 }
      return { ok: false, message: r.message }
    },
    async info(key) {
      if (mode === 'server') {
        const r = await rpc<InboxRow[]>('chat_conversation_info', { p_key: key })
        if (r.ok) return { ok: true, value: toInboxItems(r.value)[0] ?? null }
        if (!r.missing) return { ok: false, message: r.message }
        mode = 'legacy'
      }
      const all = await legacyAll()
      return all.ok ? { ok: true, value: all.value.find(c => c.id === key) ?? null } : all
    },
  }
}

export const defaultInboxSource: InboxSource = createRpcInboxSource()
export { cursorOf }
