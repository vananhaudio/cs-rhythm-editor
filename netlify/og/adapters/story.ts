// Story — /story/<slug> (1001 Câu chuyện cùng Guitar). Chỉ bài đã publish. Ảnh: photos[0].url → mặc định.
// Các nhánh /story/tell|write|reports|home|topic|series là trang ứng dụng, không phải bài.
import { defineAdapter, first } from '../adapter.ts'
import { publicMeta, resolveOgImage, str } from '../contract.ts'
import { canonicalUrl } from '../render.ts'

export const STORY_PAGES = new Set(['tell', 'write', 'reports', 'home', 'topic', 'series'])

export const storyAdapter = defineAdapter<string>({
  type: 'story',
  match(path) {
    if (!path.startsWith('/story/')) return null
    let slug: string
    try { slug = decodeURIComponent(path.slice('/story/'.length)) } catch { return null }
    return slug && !slug.includes('/') && !STORY_PAGES.has(slug) && slug.length <= 200 ? slug : null
  },
  async load(slug, ctx) {
    const s = await first<{ slug?: unknown; title?: unknown; content?: unknown; photos?: unknown; pen_name?: unknown }>(ctx,
      `/rest/v1/stories?select=slug,title,content,photos,pen_name&slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1`)
    if (!s) return null
    const pen = str(s.pen_name)
    const photo = Array.isArray(s.photos) ? (s.photos[0] as { url?: unknown } | undefined)?.url : null
    return publicMeta({
      title: `${str(s.title)} — 1001 Câu chuyện cùng Guitar`,
      description: str(s.content) || `Một câu chuyện thật của cộng đồng người yêu guitar${pen ? ` — ${pen}` : ''}.`,
      image: resolveOgImage([photo]),
      canonicalUrl: canonicalUrl(ctx.origin, `/story/${encodeURIComponent(str(s.slug) || slug)}`),
      type: 'article',
    })
  },
})
