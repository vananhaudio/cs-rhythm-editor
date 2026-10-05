// Band — /band/<slug>. Nguồn: RPC công khai band_recruitment_public (chỉ Band active). Ảnh: bands.cover_url → mặc định.
import { defineAdapter, SLUG_RE } from '../adapter.ts'
import { publicMeta, resolveOgImage, SITE, str } from '../contract.ts'
import { canonicalUrl } from '../render.ts'

export const bandAdapter = defineAdapter<string>({
  type: 'band',
  match(path) {
    if (!path.startsWith('/band/')) return null
    const slug = path.slice('/band/'.length).toLowerCase()
    return SLUG_RE.test(slug) && slug.length <= 60 ? slug : null
  },
  async load(slug, ctx) {
    const d = await ctx.rpc('band_recruitment_public', { p_slug: slug })
    const b = (d as { band?: { slug?: unknown; name?: unknown; tagline?: unknown; cover_url?: unknown } } | null)?.band
    const name = str(b?.name)
    if (!b || !name) return null
    const tagline = str(b.tagline)
    return publicMeta({
      title: `${name} · Band · ${SITE}`,
      description: tagline || `${name} — Band của lớp Thầy Văn Anh Guitar.`,
      image: resolveOgImage([b.cover_url]),
      canonicalUrl: canonicalUrl(ctx.origin, `/band/${str(b.slug) || slug}`),
    })
  },
})
