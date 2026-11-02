// Chat List V2 — model THUẦN (không mạng/DOM) cho danh sách Trò chuyện: bộ lọc, gấp dấu tìm kiếm, ánh xạ hàng RPC chat_inbox → ConversationItem,
// con trỏ phân trang, ghép trang, và lọc cục bộ cho chế độ "legacy" (server chưa có chat_inbox). Quyền/tìm kiếm thật do DB quyết (db/chat_list_v2_setup.sql).
import { toBandConversations, toConversations, type BandRoomRow, type ConversationItem, type ConversationRow } from './chatModel'

/** Số hội thoại mỗi trang (server chặn ở 50) */
export const INBOX_PAGE = 30
/** Ghim tối đa mỗi người (khớp chat_pin_set) */
export const MAX_PINS = 10
/** Độ trễ gõ tìm kiếm trước khi hỏi server */
export const SEARCH_DEBOUNCE_MS = 250

export type InboxKind = 'all' | 'dm' | 'class' | 'band'
export type InboxScope = 'mine' | 'support'
export type InboxFilter = { kind: InboxKind; unreadOnly: boolean; query: string }
export const DEFAULT_FILTER: InboxFilter = { kind: 'all', unreadOnly: false, query: '' }

/** Nhãn hiển thị — đúng tên trong thiết kế đã duyệt */
export const KIND_TABS: readonly { id: InboxKind; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'dm', label: 'Cá nhân' },
  { id: 'class', label: 'Lớp học' },
  { id: 'band', label: 'Band' },
]
export const KIND_LABEL: Record<'dm' | 'band' | 'class', string> = { dm: 'Cá nhân', band: 'Band', class: 'Lớp học' }

/** Cùng bảng chuyển với SQL public.chat_fold: bỏ dấu tiếng Việt (HOA/thường) rồi hạ chữ thường */
const FOLD_FROM = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ'
const FOLD_TO = 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'
const FOLD_MAP = (() => {
  const m = new Map<string, string>()
  ;[...FOLD_FROM].forEach((c, i) => { m.set(c, FOLD_TO[i]); m.set(c.toUpperCase(), FOLD_TO[i]) })
  return m
})()
export function foldVi(s: string): string {
  return [...(s ?? '').normalize('NFC')].map(c => FOLD_MAP.get(c) ?? c).join('').toLowerCase()
}
/** Chuẩn hoá truy vấn gửi server: NFC + cắt khoảng trắng + giới hạn độ dài */
export const normalizeQuery = (q: string): string => (q ?? '').normalize('NFC').trim().slice(0, 80)

/** Hàng chat_inbox / chat_conversation_info (đúng tên cột SQL) */
export type InboxRow = {
  conv_key: string; kind: string; peer_id: string | null; name: string | null; avatar_url: string | null; cover_path: string | null
  project_id: string | null; project_avatar_path: string | null; peer_role: string | null
  last_seq: number | string | null; last_body: string | null; last_sender_name: string | null; last_mine: boolean | null
  last_at: string | null; sort_at: string | null; unread: number | null; member_count: number | null
  can_send: boolean | null; archived: boolean | null; support: boolean | null; pinned?: boolean | null
}
export type InboxSummaryRow = {
  dm_total: number | null; band_total: number | null; class_total: number | null; unread_dm: number | null; unread_band: number | null
  unread_class: number | null; pinned_total: number | null; support_total: number | null
}
export type InboxSummary = { dm: number; band: number; class: number; unreadDm: number; unreadBand: number; unreadClass: number; pinned: number; support: number }
const n0 = (v: unknown): number => { const x = Math.floor(Number(v)); return Number.isFinite(x) && x > 0 ? x : 0 }

export function toInboxSummary(r: InboxSummaryRow | null | undefined): InboxSummary {
  return { dm: n0(r?.dm_total), band: n0(r?.band_total), class: n0(r?.class_total), unreadDm: n0(r?.unread_dm), unreadBand: n0(r?.unread_band),
    unreadClass: n0(r?.unread_class), pinned: n0(r?.pinned_total), support: n0(r?.support_total) }
}
export const unreadTotal = (s: InboxSummary): number => s.unreadDm + s.unreadBand + s.unreadClass
export const totalOf = (s: InboxSummary, kind: InboxKind): number => kind === 'dm' ? s.dm : kind === 'band' ? s.band : kind === 'class' ? s.class : s.dm + s.band + s.class

/** Hàng RPC → ConversationItem (dùng lại bộ ánh xạ có sẵn của DM/Band để mọi quy tắc tên/ảnh/canSend giữ nguyên). Giữ nguyên thứ tự server. */
export function toInboxItems(rows: InboxRow[] | null | undefined): ConversationItem[] {
  const out: ConversationItem[] = []
  for (const r of rows ?? []) {
    if (!r?.conv_key) continue
    let it: ConversationItem | undefined
    if (r.kind === 'band') {
      it = toBandConversations([{
        band_id: r.conv_key.replace(/^band:/, ''), band_name: r.name, cover_path: r.cover_path, project_id: r.project_id, project_avatar_path: r.project_avatar_path,
        last_seq: r.last_seq, last_body: r.last_body, last_sender_name: r.last_sender_name, last_mine: r.last_mine, last_at: r.last_at, unread: r.unread,
        member_count: r.member_count, can_send: r.can_send, archived: r.archived, support: r.support,
      } as BandRoomRow])[0]
    } else if (r.kind === 'dm' && r.peer_id) {
      it = toConversations([{
        conversation_id: r.conv_key, peer_id: r.peer_id, peer_name: r.name, peer_avatar_url: r.avatar_url, peer_role: r.peer_role,
        last_seq: r.last_seq ?? 0, last_body: r.last_body, last_mine: r.last_mine, last_at: r.last_at, unread: r.unread, can_send: r.can_send,
      } as ConversationRow])[0]
    }
    if (it) out.push({ ...it, pinned: r.pinned === true, sortAt: r.sort_at ?? r.last_at ?? '' })
  }
  return out
}

export type Cursor = { at: string; key: string }
export const cursorOf = (items: ConversationItem[]): Cursor | null => {
  const last = items[items.length - 1]
  return last ? { at: last.sortAt ?? last.lastAt ?? '', key: last.id } : null
}

/** Thứ tự danh sách = thứ tự server: sort_at giảm dần, rồi khoá tăng dần */
export const byRecency = (a: ConversationItem, b: ConversationItem): number => {
  const ta = Date.parse(a.sortAt || a.lastAt), tb = Date.parse(b.sortAt || b.lastAt)
  const x = (Number.isNaN(tb) ? -Infinity : tb) - (Number.isNaN(ta) ? -Infinity : ta)
  return x !== 0 && !Number.isNaN(x) ? x : a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** Ghép trang mới vào danh sách đang có: khử trùng theo id (bản mới thắng), giữ thứ tự server */
export function mergePages(prev: ConversationItem[], incoming: ConversationItem[]): ConversationItem[] {
  if (incoming.length === 0) return prev
  const m = new Map<string, ConversationItem>()
  for (const c of prev) m.set(c.id, c)
  for (const c of incoming) m.set(c.id, c)
  return [...m.values()].sort(byRecency)
}

/** Làm mới trang đầu khi polling: bản mới của trang đầu ghi đè; mục đã tải sâu hơn giữ nguyên (không mất vị trí cuộn) */
export function refreshFirstPage(prev: ConversationItem[], firstPage: ConversationItem[]): ConversationItem[] {
  return mergePages(prev, firstPage)
}

export function kindOf(c: ConversationItem): 'dm' | 'band' | 'class' { return c.kind === 'band' ? 'band' : c.kind === 'class' ? 'class' : 'dm' }

/** Lọc CỤC BỘ — chỉ dùng ở chế độ legacy (server chưa có chat_inbox). Server mới tự lọc/tìm trên toàn bộ dữ liệu. */
export function filterLocal(items: ConversationItem[], f: InboxFilter): ConversationItem[] {
  const q = foldVi(normalizeQuery(f.query))
  return items.filter(c =>
    (f.kind === 'all' || kindOf(c) === f.kind) && (!f.unreadOnly || c.unread > 0) && (!q || foldVi(c.name).includes(q)))
}

/** Tóm tắt tính từ danh sách đã tải (legacy) */
export function summarizeLocal(items: ConversationItem[], support: number): InboxSummary {
  let dm = 0, band = 0, uDm = 0, uBand = 0
  for (const c of items) { if (kindOf(c) === 'band') { band++; if (c.unread > 0) uBand++ } else { dm++; if (c.unread > 0) uDm++ } }
  return { dm, band, class: 0, unreadDm: uDm, unreadBand: uBand, unreadClass: 0, pinned: 0, support }
}

/** Lý do danh sách trống → nội dung trạng thái trống phù hợp (THUẦN, để test) */
export type EmptyReason = 'none' | 'search' | 'unread' | 'kind-dm' | 'kind-band' | 'kind-class' | 'all'
export function emptyReason(f: InboxFilter, s: InboxSummary | null): EmptyReason {
  if (normalizeQuery(f.query)) return 'search'
  if (f.unreadOnly) return 'unread'
  if (f.kind === 'dm') return 'kind-dm'
  if (f.kind === 'band') return 'kind-band'
  if (f.kind === 'class') return 'kind-class'
  return s && totalOf(s, 'all') > 0 ? 'none' : 'all'
}
