// Trò chuyện V1a — domain THUẦN (không mạng/DOM) để test được.
// Quyền nhắn tin do DB quyết (dm_* RPC); ở đây chỉ dựng giao diện từ dữ liệu server trả.
import { safeImageUrl } from '../media/safeImageUrl'
import { toShareRef, type ShareRef } from '../../share/shareRef'
import { teamAssetUrl } from '../posts/postModel'

/** Khớp CHECK của dm_messages.body (1..2000 ký tự) */
export const MAX_BODY = 2000
export const PAGE = 30

/** Id hội thoại của nhóm Band = `band:<band id>` (tách khỏi uuid hội thoại cá nhân; khớp resolveMeRoute.BAND_CONVERSATION_PREFIX) */
export const BAND_PREFIX = 'band:'
export const isBandConversation = (id: string): boolean => id.startsWith(BAND_PREFIX)
export const bandIdOf = (id: string): string => id.slice(BAND_PREFIX.length)

export type ConversationItem = {
  id: string
  /** 'band' = nhóm chat của Band (tên + ảnh lấy từ Band). Mặc định (hội thoại cá nhân) = 'dm'. */
  kind?: 'dm' | 'band'
  /** Nhóm Band chỉ đọc: 'archived' (Band lưu trữ) | 'support' (Thầy/Admin xem để hỗ trợ, không phải thành viên) */
  readOnly?: 'archived' | 'support' | null
  /** Chỉ nhóm Band: tên người gửi tin cuối (rỗng nếu chưa có tin) và số thành viên */
  lastSender?: string
  memberCount?: number
  /** Chỉ nhóm Band: Team chứa Band — để dẫn tới trang quản lý Band ở TeamLab */
  projectId?: string | null
  peerId: string
  name: string
  avatarUrl: string | null
  isTeacher: boolean
  lastSeq: number
  /** Tin cuối đã cắt 160 ký tự ở server */
  lastBody: string
  lastMine: boolean
  lastAt: string
  unread: number
  /** DB báo MÌNH còn gửi được cho người này không (hết bạn → chỉ đọc) */
  canSend: boolean
}

/** Màn đang chọn trong /me/chat: chưa chọn · một hội thoại có sẵn · bắt đầu với một người (hội thoại tạo khi gửi tin đầu) */
export type ChatSelection = { kind: 'none' } | { kind: 'conversation'; id: string } | { kind: 'with'; userId: string } | { kind: 'system' }

/** Chia sẻ nội bộ: CHỈ tham chiếu tới object gốc — Chat không giữ bản sao nội dung (loại/validate ở src/share/shareRef.ts) */
export type ChatShareRef = ShareRef
/** body cố định của tin share (DB ghi) — client V1a cũ hiện đúng chuỗi này như text */
export const SHARE_FALLBACK_BODY = 'Đã chia sẻ một nội dung'

/** Người gửi (chỉ nhóm Band — hội thoại 1-1 không cần) */
export type ChatSender = { id: string; name: string; avatarUrl: string | null }
export type ChatMessage = { seq: number; mine: boolean; body: string; at: string; ref?: ChatShareRef | null; sender?: ChatSender | null }

/** Tin đang gửi / gửi lỗi (chưa có seq) — hiện ở cuối, mờ */
export type PendingMessage = { localId: string; body: string; state: 'sending' | 'failed' }

export type ConversationRow = {
  conversation_id: string; peer_id: string; peer_name: string | null; peer_avatar_url: string | null; peer_role: string | null
  last_seq: number | string; last_body: string | null; last_mine: boolean | null; last_at: string | null
  unread: number | null; can_send: boolean | null
}
export type BandRoomRow = {
  band_id: string; band_name: string | null; cover_path: string | null; project_id: string | null; project_avatar_path: string | null
  last_seq: number | string | null; last_body: string | null; last_sender_name: string | null; last_mine: boolean | null; last_at: string | null
  unread: number | null; member_count: number | null
  /** Server quyết: gửi được / Band đã lưu trữ / nhóm xem với tư cách Thầy-Admin hỗ trợ (không phải thành viên) */
  can_send?: boolean | null; archived?: boolean | null; support?: boolean | null
}
export type BandMessageRow = {
  seq: number | string; sender_id: string | null; sender_name: string | null; sender_avatar_url: string | null
  mine: boolean | null; body: string | null; created_at: string | null
}
export type BandMemberRow = { user_id: string; name: string | null; avatar_url: string | null; role: string | null; group_role?: string | null }
/** Vai trò trong nhóm — server suy ra từ TeamLab: Trưởng Band → owner, Phó Band → admin, còn lại → member */
export type BandGroupRole = 'owner' | 'admin' | 'member'
export type BandMember = { id: string; name: string; avatarUrl: string | null; isTeacher: boolean; /** null = server chưa trả vai trò (backend chưa có V1.1) → không hiện chức danh và không báo thiếu Trưởng */
  groupRole: BandGroupRole | null }

export type MessageRow = {
  seq: number | string; mine: boolean | null; body: string | null; created_at: string | null
  ref_type?: string | null; ref_key?: string | null
}

export { toShareRef }

export function toConversations(rows: ConversationRow[] | null | undefined): ConversationItem[] {
  return (rows ?? []).filter(r => !!r?.conversation_id && !!r.peer_id).map(r => ({
    kind: 'dm' as const,
    lastSender: '',
    memberCount: 0,
    id: r.conversation_id,
    peerId: r.peer_id,
    name: (r.peer_name ?? '').trim() || 'Thành viên Class',
    avatarUrl: safeImageUrl(r.peer_avatar_url),
    isTeacher: r.peer_role === 'teacher',
    lastSeq: Number(r.last_seq) || 0,
    lastBody: r.last_body ?? '',
    lastMine: r.last_mine === true,
    lastAt: r.last_at ?? '',
    unread: Math.max(0, Number(r.unread) || 0),
    canSend: r.can_send === true,
  }))
}

/** Nhóm Band → hàng trong danh sách. Tên + ảnh: của Band (bìa Band, rồi ảnh Team); không có thì chữ cái đầu. Nhóm chưa có tin vẫn hiện. */
export function toBandConversations(rows: BandRoomRow[] | null | undefined): ConversationItem[] {
  return (rows ?? []).filter(r => !!r?.band_id && !!(r.band_name ?? '').trim()).map(r => ({
    kind: 'band' as const,
    id: BAND_PREFIX + String(r.band_id).toLowerCase(),
    peerId: '',
    name: (r.band_name ?? '').trim(),
    avatarUrl: teamAssetUrl(r.project_id, r.cover_path, 'cover') ?? teamAssetUrl(r.project_id, r.project_avatar_path, 'avatar'),
    isTeacher: false,
    lastSeq: Number(r.last_seq) || 0,
    lastBody: r.last_body ?? '',
    lastMine: r.last_mine === true,
    lastSender: (r.last_sender_name ?? '').trim(),
    lastAt: r.last_at ?? '',
    unread: Math.max(0, Number(r.unread) || 0),
    canSend: r.can_send === true,   // server quyết (lưu trữ / hỗ trợ → chỉ đọc); không biết = KHÔNG gửi được
    readOnly: r.support === true ? 'support' as const : r.archived === true ? 'archived' as const : null,
    memberCount: Math.max(0, Number(r.member_count) || 0),
    projectId: r.project_id ?? null,
  }))
}

export function toBandMessages(rows: BandMessageRow[] | null | undefined): ChatMessage[] {
  return (rows ?? []).filter(r => r?.seq != null).map(r => ({
    seq: Number(r.seq), mine: r.mine === true, body: r.body ?? '', at: r.created_at ?? '', ref: null,
    sender: { id: r.sender_id ?? '', name: (r.sender_name ?? '').trim() || 'Thành viên Band', avatarUrl: safeImageUrl(r.sender_avatar_url) },
  })).sort((a, b) => a.seq - b.seq)
}

export function toBandMembers(rows: BandMemberRow[] | null | undefined): BandMember[] {
  return (rows ?? []).filter(r => !!r?.user_id).map(r => ({
    id: r.user_id, name: (r.name ?? '').trim() || 'Thành viên Band', avatarUrl: safeImageUrl(r.avatar_url), isTeacher: r.role === 'teacher',
    groupRole: r.group_role == null ? null : r.group_role === 'owner' ? 'owner' as const : r.group_role === 'admin' ? 'admin' as const : 'member' as const,
  }))
}

/** Danh sách gộp: nhóm có tin mới nhất trước, nhóm chưa có tin xếp cuối (theo tên) — ổn định, không nhảy khi poll */
export function mergeConversationLists(dm: ConversationItem[], bands: ConversationItem[]): ConversationItem[] {
  const t = (c: ConversationItem) => { const n = Date.parse(c.lastAt); return Number.isNaN(n) ? -Infinity : n }
  return [...dm, ...bands].sort((a, b) => (t(b) - t(a)) || a.name.localeCompare(b.name, 'vi') || a.id.localeCompare(b.id))
}

/** Trần số hội thoại khi lấy "hộp thư" toàn cục — bằng trần của RPC dm_conversations (least(p_limit, 100)) */
export const INBOX_LIMIT = 100

/** Số hội thoại chưa đọc — CÙNG ngữ nghĩa dm_unread_count (đếm hội thoại có last_seq > last_read_seq, không đếm số tin) */
export function inboxUnread(rows: ConversationItem[]): number {
  return rows.reduce((n, c) => n + (c.unread > 0 ? 1 : 0), 0)
}

export function toMessages(rows: MessageRow[] | null | undefined): ChatMessage[] {
  return (rows ?? []).filter(r => r?.seq != null).map(r => ({
    seq: Number(r.seq), mine: r.mine === true, body: r.body ?? '', at: r.created_at ?? '', ref: toShareRef(r.ref_type, r.ref_key),
  })).sort((a, b) => a.seq - b.seq)
}

/** Gộp tin mới vào danh sách đang có: khử trùng theo seq, luôn tăng dần */
export function mergeMessages(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (incoming.length === 0) return prev
  const bySeq = new Map<number, ChatMessage>()
  for (const m of prev) bySeq.set(m.seq, m)
  for (const m of incoming) bySeq.set(m.seq, m)
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq)
}

export const lastSeqOf = (xs: ChatMessage[]): number => (xs.length ? xs[xs.length - 1].seq : 0)
export const firstSeqOf = (xs: ChatMessage[]): number => (xs.length ? xs[0].seq : 0)

/** Chuẩn hoá giống server (cắt khoảng trắng hai đầu) để quyết định có gửi được không */
export const normalizeBody = (s: string): string => s.replace(/^\s+|\s+$/g, '')
export const canSendBody = (s: string): boolean => {
  const t = normalizeBody(s)
  return t.length > 0 && [...t].length <= MAX_BODY
}

/** Một dòng xem trước trong danh sách: "Bạn: …" khi tin cuối là của mình; xuống dòng → khoảng trắng */
export function previewText(c: Pick<ConversationItem, 'lastBody' | 'lastMine'> & { kind?: 'dm' | 'band'; lastSender?: string; readOnly?: 'archived' | 'support' | null }): string {
  const one = c.lastBody.replace(/\s+/g, ' ').trim()
  // Nhóm chỉ đọc (hỗ trợ/lưu trữ): không mời "chào cả nhóm" vì người xem không gửi được
  if (c.kind === 'band' && !one) return c.readOnly ? 'Chưa có tin nhắn' : 'Chưa có tin nhắn — hãy chào cả nhóm'
  const who = c.lastMine ? 'Bạn: ' : c.kind === 'band' && c.lastSender ? c.lastSender + ': ' : ''
  return who + one
}

const pad = (n: number) => String(n).padStart(2, '0')
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** Giờ ngắn cho danh sách: hôm nay → HH:mm · hôm qua → "Hôm qua" · tuần này → thứ · cũ hơn → dd/MM */
export function shortTime(iso: string, now = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  if (sameDay(d, now)) return hm(d)
  const yest = new Date(now); yest.setDate(now.getDate() - 1)
  if (sameDay(d, yest)) return 'Hôm qua'
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (days < 7) return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()]
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}${d.getFullYear() === now.getFullYear() ? '' : '/' + d.getFullYear()}`
}

export const GAP_MS = 30 * 60_000

/** Nhãn thời gian chen giữa các tin: tin đầu, hoặc cách tin trước > 30 phút. null = không chen */
export function dividerLabel(prevIso: string | null, curIso: string, now = new Date()): string | null {
  const cur = new Date(curIso)
  if (Number.isNaN(cur.getTime())) return null
  if (prevIso) {
    const prev = new Date(prevIso)
    if (!Number.isNaN(prev.getTime()) && cur.getTime() - prev.getTime() <= GAP_MS) return null
  }
  if (sameDay(cur, now)) return hm(cur)
  return `${pad(cur.getDate())}/${pad(cur.getMonth() + 1)}${cur.getFullYear() === now.getFullYear() ? '' : '/' + cur.getFullYear()} ${hm(cur)}`
}

/** Nhãn badge cho trình đọc màn hình */
export const unreadLabel = (n: number) => `${n} cuộc trò chuyện chưa đọc`

/** Lỗi RPC → câu tiếng Việt, KHÔNG lộ chi tiết (mọi "không thuộc về mình" đều là "không tìm thấy") */
export function chatErrorText(err: { code?: string; message?: string; status?: number } | null | undefined, offline: boolean, ctx?: 'share'): string {
  const msg = (err?.message ?? '').toLowerCase()
  if (offline || msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('network request failed') || msg.includes('load failed')) {
    return 'Không có kết nối mạng. Kiểm tra mạng rồi thử lại.'
  }
  if (err?.status === 401 || err?.code === 'PGRST301' || err?.code === 'PGRST303' || msg.includes('jwt')) {
    return 'Phiên đăng nhập đã hết hạn. Hãy tải lại trang và đăng nhập lại.'
  }
  if (err?.code === 'P0002') return 'Không tìm thấy cuộc trò chuyện.'
  if (err?.code === '54000') return 'Bạn gửi quá nhanh. Hãy chờ một chút rồi gửi tiếp.'
  if (ctx === 'share' && err?.code === '22023') return 'Nội dung này không thể chia sẻ nữa.'
  if (err?.code === '22023') return err.message && /quá dài|trống/i.test(err.message) ? err.message : 'Tin nhắn chưa hợp lệ.'
  if (err?.code === '42501' && /chỉ đọc/i.test(err.message ?? '')) return 'Nhóm này đang ở chế độ chỉ đọc.'
  if (err?.code === '42501') return 'Bạn chưa thể nhắn tin cho người này.'
  return 'Chưa thực hiện được. Hãy thử lại.'
}

export type MessageRowLayout = { m: ChatMessage; label: string | null; cont: boolean }

/** Dựng bố cục dòng tin (THUẦN): nhãn giờ khi cách >30 phút; cont = liền tin trước cùng người (khít hơn) */
export function layoutMessages(messages: ChatMessage[], now = new Date()): MessageRowLayout[] {
  return messages.map((m, i) => {
    const prev = i > 0 ? messages[i - 1] : null
    const label = dividerLabel(prev ? prev.at : null, m.at, now)
    const sameSender = prev !== null && prev.mine === m.mine && (prev.sender?.id ?? '') === (m.sender?.id ?? '')
    return { m, label, cont: !label && sameSender }
  })
}

// ── Class 2.0 (System Chat V1): thông báo hệ thống hiện trong Trò chuyện. Chat chỉ là CỔNG + liên kết — dữ liệu nghiệp vụ ở hệ thống gốc. ──
export const SYSTEM_NAME = 'Class 2.0'
export const SYSTEM_FOOTNOTE = 'Đây là thông báo chính thức từ Class 2.0.'
export const NOTICE_PAGE = 30
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type SystemNoticeRow = {
  seq: number | string; kind: string | null; body: string | null; ref_type: string | null; ref_key: string | null
  created_at: string | null; unread: boolean | null
}
/** Một thông báo: chỉ nội dung ngắn + đích điều hướng (thread bài trả). Không giữ nhận xét/kết quả. */
export type SystemNotice = { seq: number; body: string; threadId: string; at: string; unread: boolean }

export type SystemSummaryRow = { last_seq: number | string | null; last_body: string | null; last_at: string | null; unread: number | null }
/** Tóm tắt cho hàng "Class 2.0" trong danh sách. lastSeq 0 = chưa có thông báo. */
export type SystemSummary = { lastSeq: number; lastBody: string; lastAt: string; unread: number }

export function toSystemNotices(rows: SystemNoticeRow[] | null | undefined): SystemNotice[] {
  return (rows ?? [])
    .filter(r => r?.seq != null && r.ref_type === 'thread' && !!r.ref_key && UUID_RE.test(r.ref_key) && !!(r.body ?? '').trim())
    .map(r => ({ seq: Number(r.seq), body: (r.body ?? '').trim(), threadId: (r.ref_key as string).toLowerCase(), at: r.created_at ?? '', unread: r.unread === true }))
    .sort((a, b) => a.seq - b.seq)
}

export function toSystemSummary(rows: SystemSummaryRow[] | null | undefined): SystemSummary {
  const r = rows?.[0]
  return {
    lastSeq: Number(r?.last_seq) || 0,
    lastBody: (r?.last_body ?? '').trim(),
    lastAt: r?.last_at ?? '',
    unread: Math.max(0, Number(r?.unread) || 0),
  }
}

/** Gộp theo seq (khử trùng), tăng dần */
export function mergeNotices(prev: SystemNotice[], incoming: SystemNotice[]): SystemNotice[] {
  if (incoming.length === 0) return prev
  const m = new Map<number, SystemNotice>()
  for (const n of prev) m.set(n.seq, n)
  for (const n of incoming) m.set(n.seq, n.unread || !m.has(n.seq) ? n : { ...n, unread: m.get(n.seq)!.unread })
  return [...m.values()].sort((a, b) => a.seq - b.seq)
}

/** Đích điều hướng của thông báo: trang cuộc trao đổi bài trả (quyền do chính trang đó quyết) + focus vào khu vực kết quả */
export const NOTICE_TARGET_SEARCH = '?focus=ket-qua'
