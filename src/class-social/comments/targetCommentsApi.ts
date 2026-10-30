// Gọi RPC bình luận theo mục. supabase nạp ĐỘNG (test được trên Node). Không ném lỗi ra ngoài.
import type { LikeKind } from '../likes/likeModel'
import { buildThread, commentErrorText, type CommentKind, type CommentNode, type TargetCommentRow } from './targetCommentModel'

export type CommentResult<T> = { ok: true; value: T } | { ok: false; message: string; code?: string }
const online = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)
type Err = { code?: string; message?: string } | null
const fail = (e: Err): { ok: false; message: string; code?: string } => ({ ok: false, message: commentErrorText(e?.code, e?.message, online()), code: e?.code })

export type TargetCommentsApi = {
  list(kind: CommentKind, id: string): Promise<CommentResult<CommentNode[]>>
  add(kind: CommentKind, id: string, body: string, parentId: string | null): Promise<CommentResult<string>>
  edit(kind: LikeKind, commentId: string, body: string): Promise<CommentResult<null>>
  remove(kind: LikeKind, commentId: string): Promise<CommentResult<null>>
  hide(commentId: string, hidden: boolean): Promise<CommentResult<null>>
  counts(items: { kind: CommentKind; id: string }[]): Promise<CommentResult<Map<string, number>>>
}

async function rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: Err }> {
  const { supabase } = await import('../../supabase')
  return (await supabase.rpc(name, args)) as { data: unknown; error: Err }
}

export const supabaseTargetCommentsApi: TargetCommentsApi = {
  async list(kind, id) {
    try {
      const { data, error } = await rpc('feed_comment_list', { p_kind: kind, p_id: id, p_limit: 100 })
      if (error) return { ok: false, message: 'Chưa tải được bình luận.', code: error.code }
      return { ok: true, value: buildThread((data ?? []) as TargetCommentRow[]) }
    } catch { return { ok: false, message: 'Chưa tải được bình luận.' } }
  },
  async add(kind, id, body, parentId) {
    try {
      const { data, error } = await rpc('feed_comment_add', { p_kind: kind, p_id: id, p_body: body, p_parent: parentId })
      if (error || typeof data !== 'string') return fail(error)
      return { ok: true, value: data }
    } catch { return fail(null) }
  },
  async edit(kind, commentId, body) {
    try { const { error } = await rpc('feed_comment_edit', { p_kind: kind, p_comment: commentId, p_body: body }); return error ? fail(error) : { ok: true, value: null } } catch { return fail(null) }
  },
  async remove(kind, commentId) {
    try { const { error } = await rpc('feed_comment_delete', { p_kind: kind, p_comment: commentId }); return error ? fail(error) : { ok: true, value: null } } catch { return fail(null) }
  },
  async hide(commentId, hidden) {
    try { const { error } = await rpc('feed_comment_hide', { p_comment: commentId, p_hidden: hidden }); return error ? fail(error) : { ok: true, value: null } } catch { return fail(null) }
  },
  async counts(items) {
    try {
      const { data, error } = await rpc('feed_comment_counts', { p_kinds: items.map(i => i.kind), p_ids: items.map(i => i.id) })
      if (error) return { ok: false, message: '', code: error.code }
      const m = new Map<string, number>()
      for (const r of (data ?? []) as { target_kind: string; target_id: string; comment_count: number }[]) m.set(`${r.target_kind}:${String(r.target_id).toLowerCase()}`, Math.max(0, Number(r.comment_count) || 0))
      return { ok: true, value: m }
    } catch { return { ok: false, message: '' } }
  },
}
