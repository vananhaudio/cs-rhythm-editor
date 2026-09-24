// Supabase cho bình luận / tag / kiểm duyệt. Tác giả KHÔNG gửi từ client (DB lấy auth.uid()).
// Quyền (ai được gắn tag, đính kèm, kiểm duyệt) do RLS + RPC phía server quyết định.
import { supabase } from '../../supabase'
import { friendlyError } from '../posts/postModel'
import type { Result } from '../posts/postsApi'
import { groupByPost, totalsByPost, toResourcePayload, type Comment, type CommentRow, type ResourceRef, type Tag } from './commentModel'

const online = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)
const devWarn = (what: string, e: { code?: string; message?: string } | null) => {
  if (import.meta.env.DEV && e) console.warn(`[class-social] ${what}:`, e.code, e.message)
}

/** Bình luận của NHIỀU bài trong một lần gọi (không N+1). */
export type CommentsPage = { byPost: Map<string, Comment[]>; totals: Map<string, number> }

export async function fetchComments(postIds: string[], perPost: number): Promise<Result<CommentsPage>> {
  if (postIds.length === 0) return { ok: true, value: { byPost: new Map(), totals: new Map() } }
  try {
    const { data, error, status } = await supabase.rpc('class_comments_for_posts', { p_post_ids: postIds.slice(0, 50), p_per_post: perPost })
    if (error) { devWarn('comments', error); return { ok: false, message: 'Chưa tải được bình luận.' + (status === 401 ? ' Hãy tải lại trang.' : '') } }
    const rows = (data ?? []) as CommentRow[]
    return { ok: true, value: { byPost: groupByPost(rows), totals: totalsByPost(rows) } }
  } catch (e) {
    return { ok: false, message: friendlyError(e as Error, 'feed', online()) }
  }
}

export async function addComment(input: { postId: string; body: string; tagIds?: number[]; resources?: ResourceRef[] }): Promise<Result<{ id: string }>> {
  try {
    const { data, error, status } = await supabase.rpc('class_add_comment', {
      p_post_id: input.postId,
      p_body: input.body,
      p_tag_ids: input.tagIds ?? [],
      p_resources: toResourcePayload(input.resources ?? []),
    })
    if (error || !data) { devWarn('add comment', error); return { ok: false, message: friendlyError(error ? { ...error, status } : null, 'post', online()) } }
    return { ok: true, value: { id: data as string } }
  } catch (e) {
    return { ok: false, message: friendlyError(e as Error, 'post', online()) }
  }
}

export async function deleteComment(id: string): Promise<Result<null>> {
  try {
    const { error, status } = await supabase.from('class_post_comments').delete().eq('id', id)
    if (error) { devWarn('delete comment', error); return { ok: false, message: friendlyError({ ...error, status }, 'post', online()) } }
    return { ok: true, value: null }
  } catch (e) {
    return { ok: false, message: friendlyError(e as Error, 'post', online()) }
  }
}

/** Ẩn / bỏ ẩn — chỉ thầy/admin (server kiểm is_teacher()). */
export async function moderate(kind: 'post' | 'comment', id: string, hidden: boolean): Promise<Result<null>> {
  try {
    const { error, status } = await supabase.rpc('class_moderate', { p_kind: kind, p_id: id, p_hidden: hidden })
    if (error) {
      devWarn('moderate', error)
      return { ok: false, message: error.code === '42501' ? 'Tài khoản của bạn không có quyền kiểm duyệt.' : friendlyError({ ...error, status }, 'post', online()) }
    }
    return { ok: true, value: null }
  } catch (e) {
    return { ok: false, message: friendlyError(e as Error, 'post', online()) }
  }
}

// ── Tag kiến thức (chỉ Thầy tạo) ────────────────────────────────────────────
export async function searchTags(q: string): Promise<Result<Tag[]>> {
  try {
    let query = supabase.from('class_tags').select('id,name').order('name').limit(20)
    const term = q.replace(/[#%_,]/g, '').trim()
    if (term) query = query.ilike('name', `%${term}%`)
    const { data, error } = await query
    if (error) { devWarn('tags', error); return { ok: false, message: 'Chưa tải được danh sách tag.' } }
    return { ok: true, value: (data ?? []) as Tag[] }
  } catch (e) {
    return { ok: false, message: friendlyError(e as Error, 'feed', online()) }
  }
}

export async function createTag(name: string): Promise<Result<Tag>> {
  try {
    const { data, error } = await supabase.from('class_tags').insert({ name }).select('id,name').single()
    if (error?.code === '23505') {   // đã có (khác hoa/thường) → dùng lại tag cũ
      const { data: found } = await supabase.from('class_tags').select('id,name').ilike('name', name.replace(/[%_]/g, '')).limit(1).maybeSingle()
      if (found) return { ok: true, value: found as Tag }
    }
    if (error || !data) { devWarn('create tag', error); return { ok: false, message: error?.code === '42501' ? 'Chỉ Thầy tạo được tag.' : 'Chưa tạo được tag. Hãy thử lại.' } }
    return { ok: true, value: data as Tag }
  } catch (e) {
    return { ok: false, message: friendlyError(e as Error, 'post', online()) }
  }
}
