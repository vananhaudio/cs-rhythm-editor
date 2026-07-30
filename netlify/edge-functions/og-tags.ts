// ── Netlify Edge Function: thẻ chia sẻ riêng cho từng câu chuyện ──
// Vì trang là SPA, trình thu thập của Zalo/Facebook KHÔNG chạy JavaScript —
// chúng chỉ đọc HTML thô. Hàm này chạy ở tầng CDN, chèn thẳng tiêu đề +
// ảnh bìa của bài vào <head> trước khi trả về, nên share link ra là có
// đúng ảnh và tên câu chuyện.
//
// Khai báo đường dẫn trong netlify.toml. Trang khác vẫn dùng thẻ mặc định
// trong index.html.

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

export default async function handler(req: Request, context: { next: () => Promise<Response> }) {
  const res = await context.next()
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('text/html')) return res

  const url = new URL(req.url)
  const slug = decodeURIComponent(url.pathname.replace(/^\/story\//, '').replace(/\/$/, ''))
  if (!slug || slug.includes('/') || SKIP.has(slug)) return res

  try {
    const q = `${SUPA}/rest/v1/stories?select=title,content,photos,pen_name,story_number`
      + `&slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1`
    const r = await fetch(q, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } })
    if (!r.ok) return res
    const rows = await r.json()
    const s = rows?.[0]
    if (!s) return res

    const title = `${s.title} — 1001 Câu chuyện cùng Guitar`
    const desc = summarize(s.content || '')
      || `Một câu chuyện thật của cộng đồng người yêu guitar${s.pen_name ? ` — ${s.pen_name}` : ''}.`
    const img = s.photos?.[0]?.url || `${url.origin}/og-default.png`

    return new HTMLRewriter()
      .on('title', { element: (el) => el.setInnerContent(esc(title)) })
      .on('meta', {
        element(el) {
          const key = el.getAttribute('property') || el.getAttribute('name')
          if (!key) return
          if (key === 'og:title' || key === 'twitter:title') el.setAttribute('content', title)
          else if (key === 'og:description' || key === 'twitter:description' || key === 'description') el.setAttribute('content', desc)
          else if (key === 'og:image' || key === 'twitter:image') el.setAttribute('content', img)
          else if (key === 'og:url') el.setAttribute('content', url.href)
          else if (key === 'og:type') el.setAttribute('content', 'article')
          // ảnh bìa mỗi bài mỗi khác → bỏ kích thước cố định 1200x630
          else if (key === 'og:image:width' || key === 'og:image:height') el.remove()
        },
      })
      .transform(res)
  } catch {
    return res   // có trục trặc thì trả trang gốc, không bao giờ làm hỏng trang
  }
}
