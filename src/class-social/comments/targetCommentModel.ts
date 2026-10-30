// Feed Comments V2 — mô hình THUẦN bình luận theo mục (thread / publication; bài Social đọc bảng cũ). Hai tầng: gốc + trả lời MỘT cấp.
import { safeImageUrl } from '../media/safeImageUrl'
import { MAX_COMMENT } from './commentModel'
import type { LikeKind } from '../likes/likeModel'

export type CommentKind = Exclude<LikeKind, 'post'>
export const isCommentKind = (k: string): k is CommentKind => k === 'learning_thread' || k === 'teamlab_publication'

export type TargetCommentRow = {
  id: string; parent_comment_id: string | null; body: string; created_at: string; edited_at: string | null
  author_user_id: string; author_name: string | null; author_avatar_url: string | null; author_role: string | null
  is_mine: boolean | null; is_hidden: boolean | null
}
export type TargetComment = {
  id: string; parentId: string | null; body: string; createdAt: string; edited: boolean
  author: { userId: string; name: string; avatarUrl: string | null; isTeacher: boolean }
  isMine: boolean; isHidden: boolean
}
export type CommentNode = { comment: TargetComment; replies: TargetComment[] }

export function toTargetComment(r: TargetCommentRow): TargetComment | null {
  if (!r?.id || typeof r.body !== 'string' || !r.author_user_id) return null
  return {
    id: r.id, parentId: r.parent_comment_id ?? null, body: r.body, createdAt: r.created_at, edited: !!r.edited_at,
    author: { userId: r.author_user_id, name: (r.author_name ?? '').trim() || 'Thành viên Class', avatarUrl: safeImageUrl(r.author_avatar_url), isTeacher: r.author_role === 'teacher' },
    isMine: !!r.is_mine, isHidden: !!r.is_hidden,
  }
}

/** Hàng (đã sắp cũ → mới) → cây hai tầng. Trả lời mồ côi (cha không còn/không tải) bị bỏ; trả lời của trả lời bị bỏ. */
export function buildThread(rows: TargetCommentRow[]): CommentNode[] {
  const all = rows.map(toTargetComment).filter((c): c is TargetComment => c !== null)
  const roots = new Map<string, CommentNode>()
  const out: CommentNode[] = []
  for (const c of all) if (!c.parentId) { const n = { comment: c, replies: [] as TargetComment[] }; roots.set(c.id, n); out.push(n) }
  for (const c of all) if (c.parentId) roots.get(c.parentId)?.replies.push(c)
  return out
}
export const countComments = (nodes: CommentNode[]): number => nodes.reduce((n, x) => n + 1 + x.replies.length, 0)

export function checkTargetBody(raw: string): { ok: true; body: string } | { ok: false; error: string } {
  const body = (raw ?? '').replace(/\r\n?/g, '\n').trim()
  if (!body) return { ok: false, error: 'Hãy viết nội dung bình luận.' }
  if (body.length > MAX_COMMENT) return { ok: false, error: `Bình luận tối đa ${MAX_COMMENT} ký tự.` }
  return { ok: true, body }
}

export function commentErrorText(code: string | undefined, message: string | undefined, online: boolean): string {
  if (!online) return 'Không có mạng — chưa gửi được. Nội dung của bạn vẫn được giữ.'
  if (/UGC01|ugc_blocked/.test(`${code} ${message}`)) return 'Nội dung chưa phù hợp với quy tắc cộng đồng.'
  if (/UGC03|account_suspended/.test(`${code} ${message}`)) return 'Tài khoản đang bị tạm dừng tương tác.'
  if (/FEED_NOT_VISIBLE|FEED_BAD_PARENT|FEED_NOT_FOUND|42501|P0002/.test(`${code} ${message}`)) return 'Bình luận hoặc bài này không còn khả dụng.'
  return 'Chưa gửi được. Thử lại sau — nội dung của bạn vẫn được giữ.'
}

export const commentCountLabel = (n: number): string => (n > 0 ? `Bình luận (${n})` : 'Bình luận')
