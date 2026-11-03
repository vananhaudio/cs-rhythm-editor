// Giao thức mira-context v1 — phía Class (trang cha). Bản đối xứng với lib/grading/protocol.ts của Mira.
// Nguyên tắc: gửi MÃ bài trả + VÉ ngắn hạn do chính DB Class cấp. KHÔNG gửi access token, KHÔNG gửi nội dung học viên.
export const PROTOCOL_VERSION = 1 as const

export type ContextMessage = { v: 1; type: 'mira-context'; kind: 'learning_thread'; id: string; ticket: string; expiresAt?: string; seq: number }
export type ClearMessage = { v: 1; type: 'mira-context-clear'; seq: number }
/** Nháp nhận xét Mira → ô "Thầy phản hồi". CHỈ là chữ để điền vào ô soạn; không có quyền gửi hay đổi trạng thái. */
export type DraftMessage = { v: 1; type: 'mira-grading-draft'; id: string; text: string }
export type ChildMessage = { v: 1; type: 'mira-grading-ready' } | { v: 1; type: 'mira-grading-need-ticket'; id: string } | DraftMessage

/** = MAX_EVENT_BODY (learning-thread/ltModel) — giới hạn nội dung một lượt phản hồi; có test giữ hai số khớp. */
export const MAX_DRAFT_CHARS = 4000

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (s: unknown): s is string => typeof s === 'string' && UUID.test(s)

/** Origin của iframe Mira từ URL cấu hình; null nếu URL không an toàn (chỉ https, hoặc http với localhost). */
export function miraOriginOf(url: string | undefined | null): string | null {
  try {
    const u = new URL(String(url ?? ''))
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname.endsWith('.localhost')
    return u.protocol === 'https:' || (u.protocol === 'http:' && local) ? u.origin : null
  } catch { return null }
}

/** Kiểm tin từ iframe: đúng cửa sổ con, đúng origin Mira, đúng hình dạng. */
export function acceptChildMessage(ev: { origin: string; source: unknown; data: unknown }, ctx: { child: unknown; origin: string }): ChildMessage | null {
  if (!ctx.child || ev.source !== ctx.child || ev.origin !== ctx.origin) return null
  const d = ev.data as Record<string, unknown> | null
  if (!d || typeof d !== 'object' || d.v !== PROTOCOL_VERSION) return null
  if (d.type === 'mira-grading-ready') return { v: 1, type: 'mira-grading-ready' }
  if (d.type === 'mira-grading-need-ticket' && isUuid(d.id)) return { v: 1, type: 'mira-grading-need-ticket', id: d.id }
  if (d.type === 'mira-grading-draft') {
    if (!isUuid(d.id) || typeof d.text !== 'string') return null
    const text = d.text.trim()
    if (!text || text.length > MAX_DRAFT_CHARS) return null   // rỗng / quá dài → bỏ, không cắt ngầm
    return { v: 1, type: 'mira-grading-draft', id: d.id, text }
  }
  return null
}
