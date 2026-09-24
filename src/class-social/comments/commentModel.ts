// Domain bình luận / nhận xét của Thầy — hàm THUẦN để test được.
// Nhận xét của Thầy VẪN là bình luận; tag + đính kèm là metadata có cấu trúc.
import { safeImageUrl } from '../media/safeImageUrl'

export const MAX_COMMENT = 2000
export const MAX_TAG = 40
export const MAX_EXCERPT = 500
export const COMMENTS_PREVIEW = 3        // số bình luận mới nhất hiện sẵn dưới mỗi bài
export const COMMENTS_ALL = 200          // "Xem thêm bình luận"

export type Tag = { id: number; name: string }

/** Tham chiếu tài nguyên trong Kho bài giảng — KHÔNG chứa nội dung bài giảng. */
export type ResourceRef = {
  resourceType: 'kho_video'
  resourceId: string          // kho_videos.video_id (ID YouTube)
  title: string | null        // bản chụp tiêu đề lúc đính kèm
  startSeconds: number | null
  excerpt: string | null      // trích đoạn ngắn Thầy tự chọn (bản chụp)
}

export type CommentRow = {
  id: string
  post_id: string
  parent_comment_id: string | null
  body: string
  created_at: string
  updated_at: string
  author_user_id: string
  author_name: string | null
  author_avatar_url: string | null
  author_role: string | null
  is_mine: boolean | null
  is_hidden: boolean | null
  tags: { id: number; name: string }[] | null
  resources: { id: string; resource_type: string; resource_id: string; title: string | null; start_seconds: number | null; excerpt: string | null }[] | null
  post_comment_count?: number | null
}

export type Comment = {
  id: string
  postId: string
  body: string
  createdAt: string
  author: { userId: string; name: string; avatarUrl: string | null; isTeacher: boolean }
  isMine: boolean
  isHidden: boolean
  tags: Tag[]
  resources: (ResourceRef & { id: string })[]
}

const KHO_ID = /^[A-Za-z0-9_-]{1,64}$/

export function toComment(r: CommentRow): Comment | null {
  if (!r?.id || !r.post_id) return null
  return {
    id: r.id,
    postId: r.post_id,
    body: r.body ?? '',
    createdAt: r.created_at,
    author: {
      userId: r.author_user_id,
      name: (r.author_name ?? '').trim() || 'Thành viên Class',
      avatarUrl: safeImageUrl(r.author_avatar_url),
      isTeacher: r.author_role === 'teacher',
    },
    isMine: !!r.is_mine,
    isHidden: !!r.is_hidden,
    tags: (r.tags ?? []).filter(t => Number.isFinite(t?.id) && typeof t?.name === 'string'),
    resources: (r.resources ?? [])
      .filter(x => x?.resource_type === 'kho_video' && KHO_ID.test(x.resource_id ?? ''))
      .map(x => ({
        id: x.id, resourceType: 'kho_video' as const, resourceId: x.resource_id,
        title: x.title ?? null,
        startSeconds: Number.isFinite(x.start_seconds) && (x.start_seconds as number) >= 0 ? x.start_seconds : null,
        excerpt: x.excerpt ?? null,
      })),
  }
}

/** Tổng số bình luận của từng bài (từ lần tải gần nhất). */
export function totalsByPost(rows: CommentRow[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of rows) if (r?.post_id && Number.isFinite(r.post_comment_count)) m.set(r.post_id, r.post_comment_count as number)
  return m
}

/** Nhóm bình luận theo bài, thứ tự CŨ → MỚI. */
export function groupByPost(rows: CommentRow[]): Map<string, Comment[]> {
  const m = new Map<string, Comment[]>()
  for (const c of rows.map(toComment).filter((x): x is Comment => x !== null)) {
    const list = m.get(c.postId) ?? []
    list.push(c)
    m.set(c.postId, list)
  }
  // Server đã sắp theo thứ tự ghi (seq). sort ổn định → trùng giờ thì GIỮ thứ tự server.
  for (const list of m.values()) list.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
  return m
}

export function checkCommentBody(body: string): { ok: true; body: string } | { ok: false; error: string } {
  const b = (body ?? '').replace(/\r\n?/g, '\n').trim()
  if (!b) return { ok: false, error: 'Hãy viết nội dung bình luận.' }
  if (b.length > MAX_COMMENT) return { ok: false, error: `Bình luận tối đa ${MAX_COMMENT} ký tự.` }
  return { ok: true, body: b }
}

/**
 * Chuẩn hoá tên tag do Thầy gõ: bỏ '#', bỏ ký tự cấm, ghép các từ kiểu CamelCase.
 * "nhịp" → "Nhịp" · "chuyển hợp âm" → "ChuyểnHợpÂm" · "#Bass" → "Bass". Rỗng/quá dài → null.
 */
export function normalizeTagName(input: string): string | null {
  const words = (input ?? '')
    .normalize('NFC')
    .replace(/[#,<>"'`]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return null
  const name = words.map(w => w.charAt(0).toLocaleUpperCase('vi') + w.slice(1)).join('')
  if (name.length > MAX_TAG) return null
  return name
}

/** Tag đã có trùng tên (không phân biệt hoa/thường) — tránh tạo trùng. */
export function findTag(tags: Tag[], name: string): Tag | undefined {
  const key = name.toLocaleLowerCase('vi')
  return tags.find(t => t.name.toLocaleLowerCase('vi') === key)
}

/** "03:42" · "3:42" · "1:02:03" · "222" → giây. Rỗng → null. Sai → undefined. */
export function parseTimecode(input: string): number | null | undefined {
  const s = (input ?? '').trim()
  if (!s) return null
  if (/^\d{1,5}$/.test(s)) return Number(s)
  const m = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/.exec(s)
  if (!m) return undefined
  const h = Number(m[1] ?? 0), mi = Number(m[2]), se = Number(m[3])
  if (se > 59 || (m[1] !== undefined && mi > 59)) return undefined
  return h * 3600 + mi * 60 + se
}

export function formatTimecode(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`
}

/** Link bài giảng trong Kho — quyền xem do Kho quyết định khi mở (không tự cấp quyền). */
export function khoVideoHref(ref: Pick<ResourceRef, 'resourceId' | 'startSeconds'>): string | null {
  if (!KHO_ID.test(ref.resourceId)) return null
  const base = `/khobaigiang/video/${encodeURIComponent(ref.resourceId)}`
  return ref.startSeconds && ref.startSeconds > 0 ? `${base}?t=${Math.floor(ref.startSeconds)}` : base
}

/** Payload p_resources cho RPC class_add_comment */
export function toResourcePayload(refs: ResourceRef[]) {
  return refs.map(r => ({
    resource_type: r.resourceType,
    resource_id: r.resourceId,
    title_snapshot: r.title?.trim().slice(0, 200) || null,
    start_seconds: r.startSeconds,
    excerpt: r.excerpt?.trim().slice(0, MAX_EXCERPT) || null,
  }))
}
