// Class Universal Share — vòng đời ARTIFACT dùng chung mọi tool (BMS, Nhịp & Phách): lưu riêng → đăng cộng đồng → gỡ khỏi cộng đồng → xoá.
// Một bài = một artifact: lưu riêng idempotent theo nội dung (server), đăng = nâng cấp CHÍNH artifact đó. supabase nạp ĐỘNG (test được trên Node).
import { shareErrorText } from '../class-social/toolshare/toolShareApi'

export type ArtifactTool = 'bms' | 'nhipphach'
export type ArtifactVisibility = 'class' | 'shared'
export type SaveResult = { ok: true; artifactId: string } | { ok: false; message: string }
export type PublishResult = { ok: true } | { ok: false; message: string }
export type UnpublishResult = { ok: true; result: 'private' | 'deleted' } | { ok: false; message: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isArtifactId = (s: string | null | undefined): s is string => !!s && UUID_RE.test(s)
const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)

export function rpcMessage(error: { code?: string; message?: string } | null | undefined, online: boolean): string {
  if (error?.code === '54000') return 'Bạn lưu quá nhiều bài trong thời gian ngắn. Hãy chờ một chút.'
  if (error?.code === '42501' && !/TS_NOT_MEMBER/.test(error.message ?? '')) return 'Bạn không có quyền thực hiện thao tác này với bài này.'
  return shareErrorText(error?.message, online)
}

/** Lưu RIÊNG (chưa đăng): lưu để có thể gửi cho bạn. Server idempotent theo (chủ bài, nội dung) → bấm đúp / mở lại vẫn MỘT bài, KHÔNG tạo bài Feed. */
export async function saveArtifactForShare(tool: ArtifactTool, payload: unknown): Promise<SaveResult> {
  try {
    const { supabase } = await import('../supabase')
    const { data, error } = await supabase.rpc('tool_artifact_save_for_share', { p_tool: tool, p_payload: payload })
    if (error || typeof data !== 'string' || !isArtifactId(data)) return { ok: false, message: rpcMessage(error, isOnline()) }
    return { ok: true, artifactId: data.toLowerCase() }
  } catch (e) {
    return { ok: false, message: shareErrorText((e as Error)?.message, isOnline()) }
  }
}

/** Đăng lên cộng đồng: PROMOTE chính artifact (riêng → cộng đồng) + một bài Feed. Idempotent; chỉ chủ bài. */
export async function publishArtifact(artifactId: string): Promise<PublishResult> {
  try {
    const { supabase } = await import('../supabase')
    const { data, error } = await supabase.rpc('social_publish_tool_artifact', { p_id: artifactId })
    if (error || typeof data !== 'string') return { ok: false, message: rpcMessage(error, isOnline()) }
    return { ok: true }
  } catch (e) {
    return { ok: false, message: shareErrorText((e as Error)?.message, isOnline()) }
  }
}

/** "Gỡ khỏi cộng đồng" ≠ xoá: gỡ bài Feed. Đã từng gửi cho bạn → artifact còn (chỉ người đã nhận mở được); chưa từng gửi → xoá hẳn. */
export async function unpublishArtifact(artifactId: string): Promise<UnpublishResult> {
  try {
    const { supabase } = await import('../supabase')
    const { data, error } = await supabase.rpc('social_unpublish_tool_artifact', { p_id: artifactId })
    if (error || (data !== 'private' && data !== 'deleted')) return { ok: false, message: rpcMessage(error, isOnline()) }
    return { ok: true, result: data }
  } catch (e) {
    return { ok: false, message: shareErrorText((e as Error)?.message, isOnline()) }
  }
}

/** Chủ bài XOÁ bài riêng (hành động chủ động, khác "Gỡ khỏi cộng đồng"): artifact xoá, tin Chat còn. */
export async function deleteArtifact(artifactId: string): Promise<boolean> {
  try {
    const { supabase } = await import('../supabase')
    const { data, error } = await supabase.rpc('social_delete_tool_artifact', { p_id: artifactId })
    return !error && data === true
  } catch { return false }
}
