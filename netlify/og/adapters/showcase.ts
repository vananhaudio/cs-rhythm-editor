// Showcase — /showcase/<slug>. Chỉ trang đã publish. seo_title/seo_description (→ title/summary). Ảnh: cover_image → mặc định.
import { defineAdapter, first, SLUG_RE } from '../adapter.ts'
import { publicMeta, resolveOgImage, str } from '../contract.ts'
import { canonicalUrl } from '../render.ts'

export const showcaseAdapter = defineAdapter<string>({
  type: 'showcase',
  match(path) {
    if (!path.startsWith('/showcase/')) return null
    const slug = path.slice('/showcase/'.length).toLowerCase()
    return SLUG_RE.test(slug) && slug.length <= 120 ? slug : null
  },
  async load(slug, ctx) {
    const p = await first<{ title?: unknown; seo_title?: unknown; seo_description?: unknown; summary?: unknown; cover_image?: unknown }>(ctx,
      `/rest/v1/showcase_pages?select=title,seo_title,seo_description,summary,cover_image&slug=eq.${encodeURIComponent(slug)}&published=eq.true&limit=1`)
    if (!p) return null
    const title = str(p.seo_title) || str(p.title)
    return publicMeta({
      title, description: str(p.seo_description) || str(p.summary) || title,
      image: resolveOgImage([p.cover_image]), canonicalUrl: canonicalUrl(ctx.origin, `/showcase/${slug}`),
    })
  },
})
