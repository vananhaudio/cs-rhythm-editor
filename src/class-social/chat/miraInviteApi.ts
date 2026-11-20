// Lời mời chủ động của Mira (V3). Mọi quyết định do SERVER: có mời hay không (đồng ý có phạm vi, pilot, tần suất ≤ 2/tuần, không lặp việc đã từ chối),
// nội dung lời mời (mẫu cố định từ dữ liệu thật, KHÔNG do mô hình viết). Client chỉ hiện và báo lại lựa chọn. Không kênh ngoài.
import { miraRpc } from './miraApi'   // quyền hiện = useMiraEnabled() ở nơi render (cờ build + pilot); mọi RPC vẫn do server kiểm

export interface MiraInvitation { id: string; kind: string; text: string }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function parse(d: unknown): MiraInvitation | null {
  const o = d as { id?: unknown; kind?: unknown; text?: unknown } | null
  return o && typeof o.id === 'string' && UUID.test(o.id) && typeof o.text === 'string' && o.text.trim() ? { id: o.id.toLowerCase(), kind: String(o.kind ?? ''), text: o.text.slice(0, 600) } : null
}
async function call(fn: string, args?: Record<string, unknown>): Promise<unknown> {
  try { const { data, error } = await miraRpc(fn, args); return error ? null : data } catch { return null }
}
/** Vào /me: nhận diện tình huống và (nếu được phép + còn hạn mức) tạo/nhận lời mời đang chờ. Mọi lỗi/không đủ điều kiện ⇒ null (không hiện gì). */
export const ensureInvitation = async () => parse(await call('mira_invitation_ensure'))
/** Chỉ đọc lời mời đang chờ (Hộp thư / khung Mira) — không tạo mới. */
export const pendingInvitation = async () => parse(await call('mira_invitation_pending'))
export async function openInvitation(id: string): Promise<{ text: string; conversationId: string | null } | null> {
  const d = await call('mira_invitation_open', { p_id: id }) as { text?: unknown; conversation_id?: unknown } | null
  if (!d || typeof d.text !== 'string') return null
  return { text: d.text, conversationId: typeof d.conversation_id === 'string' && UUID.test(d.conversation_id) ? d.conversation_id.toLowerCase() : null }
}
export const declineInvitation = async (id: string) => { await call('mira_invitation_decline', { p_id: id }) }
export const setProactive = async (enabled: boolean): Promise<boolean | null> => { const d = await call('mira_proactive_set', { p_enabled: enabled }); return typeof d === 'boolean' ? d : null }
export const proactiveEnabled = async (): Promise<boolean | null> => { const d = await call('mira_proactive_enabled'); return typeof d === 'boolean' ? d : null }

/** Chuyển lời mời đã mở sang khung chat (một lần): lời của Mira + hội thoại đã lưu cho Owner */
let handoff: { text: string; conversationId: string | null } | null = null
export const setInviteHandoff = (h: { text: string; conversationId: string | null }) => { handoff = h }
export const takeInviteHandoff = () => { const h = handoff; handoff = null; return h }

/** V3.2: lời chào trước đồng ý — chỉ tên + cờ "chưa mở" do server trả; không đọc hồ sơ, không gọi mô hình. Lỗi ⇒ null (dùng lời chào chung). */
export interface MiraWelcome { firstName: string | null; unread: boolean }
export async function welcomeGet(): Promise<MiraWelcome | null> {
  const d = await call('mira_welcome_get') as { first_name?: unknown; unread?: unknown } | null
  if (!d || typeof d !== 'object') return null
  const n = typeof d.first_name === 'string' ? d.first_name.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40) : ''
  return { firstName: n || null, unread: d.unread === true }
}
export const welcomeOpened = async () => { await call('mira_welcome_opened') }
