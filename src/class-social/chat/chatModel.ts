// Trò chuyện V1a — domain THUẦN (không mạng/DOM) để test được.
// Quyền nhắn tin do DB quyết (dm_* RPC); ở đây chỉ dựng giao diện từ dữ liệu server trả.
import { safeImageUrl } from '../media/safeImageUrl'

/** Khớp CHECK của dm_messages.body (1..2000 ký tự) */
export const MAX_BODY = 2000
export const PAGE = 30

export type ConversationItem = {
  id: string
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
export type ChatSelection = { kind: 'none' } | { kind: 'conversation'; id: string } | { kind: 'with'; userId: string }

/** Chia sẻ nội bộ (V1b): CHỈ tham chiếu tới object gốc — Chat không giữ bản sao nội dung */
export type ChatShareRef = { type: 'tool_artifact'; key: string }
/** body cố định của tin share (DB ghi) — client V1a cũ hiện đúng chuỗi này như text */
export const SHARE_FALLBACK_BODY = 'Đã chia sẻ một nội dung'

export type ChatMessage = { seq: number; mine: boolean; body: string; at: string; ref?: ChatShareRef | null }

/** Tin đang gửi / gửi lỗi (chưa có seq) — hiện ở cuối, mờ */
export type PendingMessage = { localId: string; body: string; state: 'sending' | 'failed' }

export type ConversationRow = {
  conversation_id: string; peer_id: string; peer_name: string | null; peer_avatar_url: string | null; peer_role: string | null
  last_seq: number | string; last_body: string | null; last_mine: boolean | null; last_at: string | null
  unread: number | null; can_send: boolean | null
}
export type MessageRow = {
  seq: number | string; mine: boolean | null; body: string | null; created_at: string | null
  ref_type?: string | null; ref_key?: string | null
}

const REF_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** Tham chiếu hợp lệ (loại biết + uuid) hoặc null. Loại lạ/khoá hỏng → null → tin hiện như text (body cố định), không lỗi */
export function toShareRef(type: string | null | undefined, key: string | null | undefined): ChatShareRef | null {
  const k = (key ?? '').toLowerCase()
  return type === 'tool_artifact' && REF_UUID_RE.test(k) ? { type: 'tool_artifact', key: k } : null
}

export function toConversations(rows: ConversationRow[] | null | undefined): ConversationItem[] {
  return (rows ?? []).filter(r => !!r?.conversation_id && !!r.peer_id).map(r => ({
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
export function previewText(c: Pick<ConversationItem, 'lastBody' | 'lastMine'>): string {
  const one = c.lastBody.replace(/\s+/g, ' ').trim()
  return (c.lastMine ? 'Bạn: ' : '') + one
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
  if (err?.code === '42501') return 'Bạn chưa thể nhắn tin cho người này.'
  return 'Chưa thực hiện được. Hãy thử lại.'
}

export type MessageRowLayout = { m: ChatMessage; label: string | null; cont: boolean }

/** Dựng bố cục dòng tin (THUẦN): nhãn giờ khi cách >30 phút; cont = liền tin trước cùng người (khít hơn) */
export function layoutMessages(messages: ChatMessage[], now = new Date()): MessageRowLayout[] {
  return messages.map((m, i) => {
    const prev = i > 0 ? messages[i - 1] : null
    const label = dividerLabel(prev ? prev.at : null, m.at, now)
    return { m, label, cont: !label && prev !== null && prev.mine === m.mine }
  })
}
