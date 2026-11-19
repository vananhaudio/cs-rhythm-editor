// Hội thoại học viên ↔ Mira — CHỈ OWNER. Mọi quyền do RPC mira_owner_* quyết ở server (app_users.role='admin'); UI chỉ hiển thị.
// Không có đường ghi/sửa từ client ngoài xoá theo học viên (RPC riêng, có nhật ký).

export interface MiraConvItem {
  conversation_id: string; student_user_id: string; student_id: string | null; display_name: string | null
  started_at: string; last_at: string; turn_count: number; snippet: string; matched: boolean
}
export interface MiraConvList { items: MiraConvItem[]; total_conversations: number; total_students: number; next_before: string | null }
export interface MiraMsg { seq: number; role: 'user' | 'assistant'; content: string; created_at: string; meta: Record<string, unknown> }
export interface MiraConvDetail {
  conversation_id: string; student_user_id: string; student_id: string | null; display_name: string | null
  started_at: string; last_at: string; turn_count: number; notice_version: number | null; messages: MiraMsg[]
}
export type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string; code?: string } | null }>
let rpc: Rpc = async (fn, args) => (await import('../../supabase')).supabase.rpc(fn, args) as unknown as ReturnType<Rpc>   // nạp lười: test thay bằng giả
export function setMiraOwnerRpc(r: Rpc) { rpc = r }

export type Result<T> = { ok: true; data: T } | { ok: false; reason: 'forbidden' | 'failed' }
const fail = (e: { message?: string; code?: string } | null): { ok: false; reason: 'forbidden' | 'failed' } =>
  ({ ok: false, reason: e?.code === '42501' || /MIRA_OWNER_ONLY/.test(e?.message ?? '') ? 'forbidden' : 'failed' })

export async function listConversations(args: { q?: string; studentUserId?: string; before?: string | null }): Promise<Result<MiraConvList>> {
  const { data, error } = await rpc('mira_owner_conversations', { p_args: {
    ...(args.q?.trim() ? { q: args.q.trim() } : {}), ...(args.studentUserId ? { student_user_id: args.studentUserId } : {}), ...(args.before ? { before: args.before } : {}), limit: 30 } })
  if (error) return fail(error)
  const d = data as MiraConvList | null
  if (!d || !Array.isArray(d.items)) return { ok: false, reason: 'failed' }
  return { ok: true, data: d }
}
export async function getConversation(id: string): Promise<Result<MiraConvDetail | null>> {
  const { data, error } = await rpc('mira_owner_conversation_get', { p_conversation: id })
  if (error) return fail(error)
  return { ok: true, data: (data as MiraConvDetail | null) ?? null }
}
/** Liên kết hồ sơ Student 360° (trang hồ sơ học viên của Thầy). Chỉ khi có edu_students.id. */
export const student360Href = (studentId: string | null): string | null => (studentId && /^[0-9a-f-]{36}$/i.test(studentId) ? `/student?id=${studentId}` : null)
