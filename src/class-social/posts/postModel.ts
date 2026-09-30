// Domain bài đăng cộng đồng — hàm THUẦN (không đụng mạng/DOM) để test được.
import { toThreadCard, type ThreadCard } from '../../learning-thread/feedModel'
import { parseExternalMedia, MEDIA_ERROR_TEXT, type ExternalMedia, type MediaProvider } from '../media/parseExternalMedia'
import { safeImageUrl } from '../media/safeImageUrl'

export type PostType = 'assignment' | 'question' | 'practice' | 'status' | 'tool_share'
export const POST_TYPE_LABEL: Record<PostType, string> = {
  assignment: 'Trả bài',
  question: 'Hỏi bài',
  practice: 'Luyện tập',
  status: 'Bài viết',
  tool_share: 'Kết quả công cụ',   // Tool Share V1: payload hiển thị theo registry (toolshare/registry.ts)
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

// ── Bài viết trên tường: CHỈ bạn bè (+ Thầy kiểm duyệt). Chữ bắt buộc nếu không có link. ──
export type WallInsert = {
  type: 'status'
  audience: 'friends'
  body: string
  media_type: 'external_video' | null
  media_provider: MediaProvider | null
  media_url: string | null
  external_media_id: string | null
}

/** Một kiểu (không phải union) cho mọi bài mới — DB (CHECK + RLS) kiểm cặp loại ↔ quyền xem. */
export type NewPost = {
  type: 'assignment' | 'status'
  audience?: 'friends'
  body: string
  media_type: 'external_video' | null
  media_provider: MediaProvider | null
  media_url: string | null
  external_media_id: string | null
}

export type WallDraftCheck =
  | { ok: true; insert: WallInsert; media: ExternalMedia | null }
  | { ok: false; videoError?: string; bodyError?: string }

export function checkWallDraft(draft: { body: string; url: string }): WallDraftCheck {
  const body = normalizeBody(draft.body)
  const url = (draft.url ?? '').trim()
  const parsed = url ? parseExternalMedia(url) : null
  const videoError = parsed && !parsed.ok ? MEDIA_ERROR_TEXT[parsed.error] : undefined
  const bodyError = body.length > MAX_BODY ? `Bài viết tối đa ${MAX_BODY} ký tự.`
    : !body && !url ? 'Hãy viết gì đó hoặc dán một liên kết video.' : undefined
  if (videoError || bodyError || (parsed && !parsed.ok)) return { ok: false, videoError, bodyError }
  const m = parsed && parsed.ok ? parsed.media : null
  return {
    ok: true,
    media: m,
    insert: {
      type: 'status', audience: 'friends', body,
      media_type: m ? 'external_video' : null,
      media_provider: m ? m.provider : null,
      media_url: m ? m.canonicalUrl : null,
      external_media_id: m?.externalId ?? null,
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
  /** get_user_wall: 'class' (Trả bài) | 'friends' (bài viết trên tường) */
  audience?: string | null
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
  /** Chỉ bạn bè xem (bài viết trên tường) */
  friendsOnly: boolean
}

const isPostType = (t: string): t is PostType => t === 'assignment' || t === 'question' || t === 'practice' || t === 'status' || t === 'tool_share'

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
    friendsOnly: r.audience === 'friends' || r.type === 'status',
  }
}

/** Hàng → bài hiển thị; bỏ hàng hỏng, mới nhất trước (server đã sắp, giữ ổn định). */
export function toFeedPosts(rows: FeedRow[]): FeedPost[] {
  return rows
    .map(toFeedPost)
    .filter((p): p is FeedPost => p !== null)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
}

// ── Feed trộn (P2): bài Social + thẻ Learning Thread — RPC social_feed / user_wall ──
// Learning Thread KHÔNG phải class_posts: chỉ là một "mục" khác loại trong cùng dòng hoạt động (không copy dữ liệu).
export type ThreadEntry = { entry: 'learning_thread'; id: string; createdAt: string; card: ThreadCard }
export type FeedEntry = FeedPost | ThreadEntry
export const isThreadEntry = (e: FeedEntry): e is ThreadEntry => (e as ThreadEntry).entry === 'learning_thread'
export const isPostEntry = (e: FeedEntry): e is FeedPost => !isThreadEntry(e)
/** Khoá phân trang ổn định (khớp sort_key của server): 'p:<id>' | 't:<id>' */
export const entryKey = (e: FeedEntry): string => (isThreadEntry(e) ? 't:' : 'p:') + e.id

export type MixedRow = { kind: string; sort_at: string; sort_key: string; post: unknown; thread: unknown }

/** Hàng social_feed / user_wall → mục hiển thị. Thứ tự GIỮ theo server (sort_at, sort_key giảm dần). */
export function toFeedEntries(rows: MixedRow[]): FeedEntry[] {
  const out: FeedEntry[] = []
  for (const r of rows) {
    if (r.kind === 'post') {
      const p = r.post ? toFeedPost(r.post as FeedRow) : null
      if (p) out.push(p)
    } else if (r.kind === 'learning_thread') {
      const c = toThreadCard(r.thread)
      if (c) out.push({ entry: 'learning_thread', id: c.id, createdAt: r.sort_at, card: c })
    }
  }
  return out
}

/** Gộp trang mới vào danh sách (bỏ trùng id). */
export function mergePosts<T extends { id: string }>(current: T[], incoming: T[]): T[] {
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
