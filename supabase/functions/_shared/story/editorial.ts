// 1001 Câu Chuyện — luật dùng chung của hai Edge Function story-ai và publish-story.

/** Chỉ teacher/admin. `db` phải là client service role (đọc app_users bỏ qua RLS). Lỗi truy vấn → từ chối. */
// deno-lint-ignore no-explicit-any
export async function isEditor(db: any, userId: string): Promise<boolean> {
  const { data, error } = await db.from('app_users').select('role').eq('id', userId).maybeSingle()
  return !error && !!data && ['teacher', 'admin'].includes(data.role)
}

export const bearer = (req: Request): string =>
  (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()

export function slugify(text: string): string {
  return text.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

type Published = { title?: string | null; story_number?: number | null; slug?: string | null; published_at?: string | null }

/** Số bài · đường dẫn · ngày đăng: đã có thì GIỮ NGUYÊN; chưa có mới cấp. */
export function publishStamp(story: Published, nextNumber: number, nowIso: string) {
  const story_number = story.story_number ?? nextNumber
  return {
    story_number,
    slug: story.slug || `${slugify(story.title || 'cau-chuyen')}-${story_number}`,
    published_at: story.published_at || nowIso,
  }
}

export const SAFE_AUTHOR = 'Người kể chuyện'

/** Tên tác giả công khai không được là địa chỉ email. Trả về đúng những cột cần thay. */
export function safeNamePatch(story: { pen_name?: string | null; author_name?: string | null }) {
  const patch: { pen_name?: string; author_name?: string } = {}
  if (story.pen_name?.includes('@')) patch.pen_name = SAFE_AUTHOR
  if (story.author_name?.includes('@')) patch.author_name = SAFE_AUTHOR
  return patch
}
