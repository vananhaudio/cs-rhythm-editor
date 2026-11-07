// Domain bình luận / nhận xét của Thầy — hàm THUẦN để test được.
// Nhận xét của Thầy VẪN là bình luận; tag + đính kèm là metadata có cấu trúc.
import { safeImageUrl } from '../media/safeImageUrl'
import { toSeq } from './paging'

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
  // Chỉ có từ class_comments_page_safe (Paging V1)
  seq?: number | string | null
  root_seq?: number | string | null
  older_roots?: number | null
}

export type Comment = {
  id: string
  postId: string
  /** Bình luận được trả lời trực tiếp (null = bình luận gốc). */
  parentId: string | null
  seq: number | null          // thứ tự ghi (Paging V1); null = dữ liệu từ hàm cũ
  rootSeq: number | null      // seq của bình luận gốc chứa nó
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
    parentId: r.parent_comment_id ?? null,
    seq: toSeq(r.seq),
    rootSeq: toSeq(r.root_seq),
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

// ── Hội thoại hai tầng (Lát C) ──────────────────────────────────────────────
// DB lưu parent_comment_id = bình luận được trả lời TRỰC TIẾP (cùng bài). Giao diện chỉ có hai tầng: gốc → trả lời.
// Trả lời một câu trả lời: parent = câu trả lời đó (biết đúng người được phản hồi, không chèn tên vào nội dung),
// nhưng hiển thị phẳng dưới bình luận gốc kèm "Trả lời <tên>".
export type ThreadReply = { c: Comment; replyTo: Comment | null }
export type Thread = {
  /** null = bình luận gốc chưa được tải (cũ hơn cửa sổ đã lấy, hoặc bị lọc) → nhóm "mồ côi", không mất trả lời. */
  root: Comment | null
  replies: ThreadReply[]
}

const MAX_DEPTH = 64

/** Cửa sổ `limit` bình luận mới nhất + tổ tiên ĐÃ TẢI của chúng (để trả lời không bị tách khỏi bình luận gốc). Giữ thứ tự gốc. */
export function visibleWithContext(all: Comment[], limit: number): Comment[] {
  const tail = all.length > limit ? all.slice(-limit) : all
  if (tail.length === all.length) return all
  const byId = new Map(all.map(c => [c.id, c]))
  const keep = new Set(tail.map(c => c.id))
  for (const c of tail) {
    let cur: Comment | undefined = c, n = 0
    while (cur?.parentId && n++ < MAX_DEPTH) { cur = byId.get(cur.parentId); if (cur) keep.add(cur.id) }
  }
  return all.filter(c => keep.has(c.id))
}

/** Nhóm danh sách phẳng (CŨ → MỚI) thành hội thoại hai tầng. Gốc xếp theo thời gian của gốc; trả lời theo thời gian. */
export function buildThreads(items: Comment[]): Thread[] {
  const byId = new Map(items.map(c => [c.id, c]))
  const threads = new Map<string, Thread>()
  const order: string[] = []
  for (const c of items) {
    // Đi lên theo chuỗi cha; dừng ở gốc thật (parentId null) hoặc ở cha chưa tải.
    let top = c, n = 0
    while (top.parentId && byId.has(top.parentId) && n++ < MAX_DEPTH) top = byId.get(top.parentId) as Comment
    const key = top.parentId == null ? top.id : `missing:${top.parentId}`   // lặp vô hạn (dữ liệu hỏng) → coi như mồ côi
    let t = threads.get(key)
    if (!t) { t = { root: top.parentId == null ? top : null, replies: [] }; threads.set(key, t); order.push(key) }
    if (c.id === t.root?.id) continue
    const parent = c.parentId ? byId.get(c.parentId) ?? null : null
    t.replies.push({ c, replyTo: parent && parent.id !== t.root?.id ? parent : null })
  }
  const anchor = (t: Thread) => Date.parse((t.root ?? t.replies[0].c).createdAt)
  return order.map(k => threads.get(k) as Thread).sort((a, b) => anchor(a) - anchor(b))
}

/** Số bình luận bị xoá cùng khi xoá `id` (DB cascade theo parent_comment_id): chính các hậu duệ đã tải. */
export function descendantCount(items: Comment[], id: string): number {
  const kids = new Map<string, string[]>()
  for (const c of items) if (c.parentId) kids.set(c.parentId, [...(kids.get(c.parentId) ?? []), c.id])
  let n = 0
  const seen = new Set<string>([id])
  const stack = [id]
  while (stack.length) for (const k of kids.get(stack.pop() as string) ?? []) if (!seen.has(k)) { seen.add(k); n++; stack.push(k) }
  return n
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
