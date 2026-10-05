// ── Universal OG — hợp đồng metadata chung (ShareMeta) + tiện ích thuần ──
// Mọi resource adapter (netlify/og/adapters) trả ShareMeta; renderer chỉ biết ShareMeta, không biết loại resource.
// Thuần (không fetch, không Deno API) → test bằng node.

export const SITE = 'Thầy Văn Anh Guitar'

/** public = được ghi metadata; private / not_found = fail closed về thẻ mặc định Class (og:url vẫn đúng). */
export type Visibility = 'public' | 'private' | 'not_found'

export type ShareMeta = {
  title: string
  description: string
  /** https; null = ảnh mặc định của index.html */
  image: string | null
  /** dựng từ DANH TÍNH resource (không chép URL request) */
  canonicalUrl: string
  visibility: Visibility
  /** og:type — bỏ trống = giữ 'website' của index.html */
  type?: 'website' | 'article'
}

export const TITLE_MAX = 200
export const DESCRIPTION_MAX = 200

export const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
export const pad2 = (n: number) => String(n).padStart(2, '0')

/** Cắt mô tả gọn cho thẻ share. */
export function summarize(text: string, max = DESCRIPTION_MAX): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 120 ? cut.slice(0, lastSpace) : cut) + '…'
}

/** Chỉ nhận ảnh https tuyệt đối — crawler không theo được đường dẫn tương đối / http. */
export function safeImage(url: unknown): string | null {
  if (typeof url !== 'string' || url.length > 1000) return null
  try {
    const u = new URL(url)
    return u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}

/**
 * Ảnh chia sẻ = ảnh https hợp lệ ĐẦU TIÊN trong danh sách ứng viên (đã xếp theo ưu tiên của entity).
 * Không có → null (renderer giữ ảnh mặc định). Ứng viên là ẢNH CỦA ENTITY — cột giao diện cũng dùng.
 */
export function resolveOgImage(candidates: readonly unknown[]): string | null {
  for (const c of candidates) {
    const u = safeImage(c)
    if (u) return u
  }
  return null
}

/** Chuỗi ảnh của Khoá: image_url → thumbnail_url. */
export const courseImageCandidates = (c: { image_url?: unknown; thumbnail_url?: unknown } | null | undefined): unknown[] =>
  [c?.image_url, c?.thumbnail_url]

/** Metadata chưa công khai: không mang chữ/ảnh nào của resource. */
export function hidden(visibility: Exclude<Visibility, 'public'>, canonicalUrl: string): ShareMeta {
  return { title: '', description: '', image: null, canonicalUrl, visibility }
}

/** Metadata công khai đã chuẩn hoá: cắt độ dài, ảnh chỉ https. Tiêu đề trống → not_found. */
export function publicMeta(m: { title: string; description: string; image: unknown; canonicalUrl: string; type?: ShareMeta['type'] }): ShareMeta {
  const title = summarize(m.title, TITLE_MAX)
  if (!title) return hidden('not_found', m.canonicalUrl)
  return {
    title,
    description: summarize(m.description) || title,
    image: safeImage(m.image),
    canonicalUrl: m.canonicalUrl,
    visibility: 'public',
    ...(m.type ? { type: m.type } : {}),
  }
}
