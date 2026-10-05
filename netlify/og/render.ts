// ── Universal OG — renderer: ghi ShareMeta vào index.html (regex; Netlify Edge không có HTMLRewriter) ──
// Không biết loại resource. Không phải 'public' → chỉ sửa og:url, giữ toàn bộ thẻ mặc định Class.
import type { ShareMeta } from './contract.ts'

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Thay content của một thẻ meta theo property (og:*) hoặc name. Không có thẻ → giữ nguyên. */
export function setMeta(html: string, key: string, value: string): string {
  const attr = key.startsWith('og:') ? 'property' : 'name'
  const re = new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`, 'i')
  return html.replace(re, (_m, a: string, b: string) => a + esc(value) + b)
}

/** URL chia sẻ chuẩn: https + host + path, bỏ hash/gạch chéo cuối; query giữ khi resource cần (vd ?id=). */
export function canonicalUrl(origin: string, path: string, search = ''): string {
  const host = new URL(origin).host
  const p = path.replace(/\/+$/, '') || '/'
  return `https://${host}${p}${search}`
}

export function renderShareMeta(html: string, meta: ShareMeta | null, canonical: string): string {
  let out = setMeta(html, 'og:url', canonical)
  if (!meta || meta.visibility !== 'public') return out
  out = out.replace(/<title>[^<]*<\/title>/i, () => `<title>${esc(meta.title)}</title>`)
  for (const k of ['og:title', 'twitter:title']) out = setMeta(out, k, meta.title)
  for (const k of ['description', 'og:description', 'twitter:description']) out = setMeta(out, k, meta.description)
  if (meta.type) out = setMeta(out, 'og:type', meta.type)
  if (meta.image) {
    for (const k of ['og:image', 'twitter:image']) out = setMeta(out, k, meta.image)
    // ảnh entity không chắc 1200x630 → bỏ kích thước cố định của ảnh mặc định
    out = out.replace(/<meta property="og:image:(width|height)"[^>]*>\s*/gi, '')
  }
  return out
}
