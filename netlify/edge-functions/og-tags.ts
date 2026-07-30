// ── Netlify Edge Function: thẻ chia sẻ riêng cho từng câu chuyện ──
// Vì trang là SPA, trình thu thập của Zalo/Facebook KHÔNG chạy JavaScript —
// chúng chỉ đọc HTML thô. Hàm này chạy ở tầng CDN, thay thẳng thẻ og:* trong
// <head> bằng tiêu đề + ảnh bìa của bài trước khi trả về.
//
// LƯU Ý: KHÔNG dùng HTMLRewriter — đó là API của Cloudflare Workers, Netlify
// Edge Functions không có. Bản đầu dùng nó nên hàm ném lỗi (header chẩn đoán
// x-og-fn trả 'error'), trang bài vẫn ra thẻ mặc định. Ở đây đọc HTML thành
// chuỗi rồi thay bằng regex.
//
// Đường dẫn khai trong netlify.toml. Trang khác dùng thẻ mặc định ở index.html.

const SUPA = 'https://wojmdilyflffvdtpovmq.supabase.co'
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvam1kaWx5ZmxmZnZkdHBvdm1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNjk0OTYsImV4cCI6MjA5NDg0NTQ5Nn0.JxlY5iqBTK3q5BYnF1MgY8A5zS3R5okrD8uddsEFavY'

// Các nhánh /story/* KHÔNG phải trang đọc bài
const SKIP = new Set(['tell', 'write', 'reports', 'home', 'topic', 'series'])

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Cắt nội dung thành đoạn mô tả gọn cho thẻ share. */
function summarize(content: string, max = 200): string {
  const flat = content.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 120 ? cut.slice(0, lastSpace) : cut) + '…'
}

/** Thay content của một thẻ meta theo property (og:*) hoặc name. */
function setMeta(html: string, key: string, value: string): string {
  const attr = key.startsWith('og:') ? 'property' : 'name'
  const re = new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`, 'i')
  return html.replace(re, `$1${esc(value)}$2`)
}

/** Trả trang gốc, kèm dấu hiệu chẩn đoán. */
function passthrough(res: Response, note: string): Response {
  const h = new Headers(res.headers)
  h.set('x-og-fn', note)
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h })
}

export default async function handler(req: Request, context: { next: () => Promise<Response> }) {
  const res = await context.next()
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('text/html')) return passthrough(res, 'skip-not-html')

  const url = new URL(req.url)
  const slug = decodeURIComponent(url.pathname.replace(/^\/story\//, '').replace(/\/$/, ''))
  if (!slug || slug.includes('/') || SKIP.has(slug)) return passthrough(res, 'skip-' + (slug || 'root'))

  try {
    const q = `${SUPA}/rest/v1/stories?select=title,content,photos,pen_name`
      + `&slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1`
    const r = await fetch(q, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } })
    if (!r.ok) return passthrough(res, 'db-' + r.status)
    const rows = await r.json()
    const s = rows?.[0]
    if (!s) return passthrough(res, 'no-story')

    const title = `${s.title} — 1001 Câu chuyện cùng Guitar`
    const desc = summarize(s.content || '')
      || `Một câu chuyện thật của cộng đồng người yêu guitar${s.pen_name ? ` — ${s.pen_name}` : ''}.`
    const img = s.photos?.[0]?.url || `${url.origin}/og-default.png`

    let html = await res.text()
    html = html.replace(/<title>[^<]*<\/title>/i, `<title>${esc(title)}</title>`)
    html = setMeta(html, 'og:title', title)
    html = setMeta(html, 'twitter:title', title)
    html = setMeta(html, 'og:description', desc)
    html = setMeta(html, 'twitter:description', desc)
    html = setMeta(html, 'description', desc)
    html = setMeta(html, 'og:image', img)
    html = setMeta(html, 'twitter:image', img)
    html = setMeta(html, 'og:url', url.href)
    html = setMeta(html, 'og:type', 'article')
    // ảnh bìa mỗi bài mỗi khác → bỏ kích thước cố định 1200x630
    html = html.replace(/<meta property="og:image:(width|height)"[^>]*>\s*/gi, '')

    const h = new Headers(res.headers)
    h.set('x-og-fn', 'ok')
    h.set('content-type', 'text/html; charset=utf-8')
    return new Response(html, { status: res.status, headers: h })
  } catch (e) {
    return passthrough(res, 'error:' + (e instanceof Error ? e.name : 'unknown'))
  }
}
