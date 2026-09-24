// Domain bài đăng cộng đồng — hàm THUẦN (không đụng mạng/DOM) để test được.
import { parseExternalMedia, MEDIA_ERROR_TEXT, type ExternalMedia, type MediaProvider } from '../media/parseExternalMedia'
import { safeImageUrl } from '../media/safeImageUrl'

export type PostType = 'assignment' | 'question' | 'practice'
export const POST_TYPE_LABEL: Record<PostType, string> = {
  assignment: 'Trả bài',
  question: 'Hỏi bài',
  practice: 'Luyện tập',
}

export const MAX_BODY = 2000

// ── Soạn Trả bài (P1: bắt buộc có video) ────────────────────────────────────
export type AssignmentInsert = {
  type: 'assignment'
  body: string
  media_type: 'external_video'
  media_provider: MediaProvider
  media_url: string
  external_media_id: string | null
}

export type DraftCheck =
  | { ok: true; insert: AssignmentInsert; media: ExternalMedia }
  | { ok: false; videoError?: string; bodyError?: string }

/** Chuẩn hoá xuống dòng, bỏ khoảng trắng đầu/cuối. Plain text — không HTML. */
export function normalizeBody(body: string): string {
  return (body ?? '').replace(/\r\n?/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim()
}

export function checkAssignmentDraft(draft: { body: string; url: string }): DraftCheck {
  const body = normalizeBody(draft.body)
  const bodyError = body.length > MAX_BODY ? `Ghi chú tối đa ${MAX_BODY} ký tự.` : undefined
  const parsed = parseExternalMedia(draft.url)
  const videoError = parsed.ok ? undefined : MEDIA_ERROR_TEXT[parsed.error]
  if (!parsed.ok || bodyError) return { ok: false, videoError, bodyError }
  const m = parsed.media
  return {
    ok: true,
    media: m,
    insert: {
      type: 'assignment', body,
      media_type: 'external_video',
      media_provider: m.provider,
      media_url: m.canonicalUrl,
      external_media_id: m.externalId ?? null,
    },
  }
}

// ── Lỗi → câu tiếng Việt (không lộ lỗi thô) ─────────────────────────────────
export type ErrorLike = { message?: string; code?: string; status?: number } | null | undefined

export function friendlyError(err: ErrorLike, action: 'post' | 'feed', online = true): string {
  const msg = (err?.message ?? '').toLowerCase()
  if (!online || msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('network request failed') || msg.includes('load failed')) {
    return 'Không có kết nối mạng. Kiểm tra mạng rồi thử lại.'
  }
  if (err?.status === 401 || err?.code === 'PGRST301' || err?.code === 'PGRST303' || msg.includes('jwt')) {
    return 'Phiên đăng nhập đã hết hạn. Hãy tải lại trang và đăng nhập lại.'
  }
  if (action === 'post') {
    if (err?.code === '42501' || msg.includes('row-level security')) return 'Tài khoản của bạn chưa gửi được trong Class.'
    if (err?.code === '23514') return 'Nội dung chưa hợp lệ. Hãy kiểm tra lại rồi gửi.'
    return 'Chưa gửi được. Hãy thử lại.'
  }
  return 'Chưa tải được hoạt động của cộng đồng.'
}

// ── Feed ────────────────────────────────────────────────────────────────────
/** Một dòng trả về từ RPC class_feed() */
export type FeedRow = {
  id: string
  type: string
  body: string | null
  media_type: string | null
  media_provider: string | null
  media_url: string | null
  external_media_id: string | null
  created_at: string
  updated_at: string
  author_user_id: string
  author_name: string | null
  author_avatar_url: string | null
  author_role: string | null
  author_ht_member: boolean | null
  is_mine: boolean | null
  is_hidden?: boolean | null
  comment_count?: number | null
}

export type FeedPost = {
  id: string
  type: PostType
  body: string
  /** Parse LẠI từ media_url đã lưu — không tin provider/ID lưu trong DB để dựng iframe */
  media: ExternalMedia | null
  createdAt: string
  author: { userId: string; name: string; avatarUrl: string | null; isTeacher: boolean; htMember: boolean }
  isMine: boolean
  /** Bị Thầy ẩn — chỉ Thầy còn thấy */
  isHidden: boolean
  commentCount: number
}

const isPostType = (t: string): t is PostType => t === 'assignment' || t === 'question' || t === 'practice'

export function toFeedPost(r: FeedRow): FeedPost | null {
  if (!r?.id || !isPostType(r.type)) return null
  let media: ExternalMedia | null = null
  if (r.media_url) {
    const p = parseExternalMedia(r.media_url)
    media = p.ok ? p.media : null
  }
  return {
    id: r.id,
    type: r.type,
    body: r.body ?? '',
    media,
    createdAt: r.created_at,
    author: {
      userId: r.author_user_id,
      name: (r.author_name ?? '').trim() || 'Thành viên Class',
      avatarUrl: safeImageUrl(r.author_avatar_url),
      isTeacher: r.author_role === 'teacher',
      htMember: !!r.author_ht_member,
    },
    isMine: !!r.is_mine,
    isHidden: !!r.is_hidden,
    commentCount: Math.max(0, Number(r.comment_count) || 0),
  }
}

/** Hàng → bài hiển thị; bỏ hàng hỏng, mới nhất trước (server đã sắp, giữ ổn định). */
export function toFeedPosts(rows: FeedRow[]): FeedPost[] {
  return rows
    .map(toFeedPost)
    .filter((p): p is FeedPost => p !== null)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
}

/** Gộp trang mới vào danh sách (bỏ trùng id). */
export function mergePosts(current: FeedPost[], incoming: FeedPost[]): FeedPost[] {
  const seen = new Set(current.map(p => p.id))
  return [...current, ...incoming.filter(p => !seen.has(p.id))]
}

export function relativeTime(iso: string, now = new Date()): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const s = Math.max(0, Math.round((now.getTime() - t) / 1000))
  if (s < 60) return 'Vừa xong'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} phút trước`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} giờ trước`
  const d = Math.floor(h / 24)
  if (d === 1) return 'Hôm qua'
  if (d < 7) return `${d} ngày trước`
  const dt = new Date(t)
  return dt.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', year: dt.getFullYear() === now.getFullYear() ? undefined : 'numeric' })
}
