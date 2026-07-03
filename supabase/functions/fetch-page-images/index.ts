// Edge Function: fetch-page-images
// Strum Builder — tìm sheet: học sinh bấm 1 kết quả "Web" (thường Hợp Âm Việt), thay vì
// đẩy hẳn sang trang đó, ta lục ẢNH ngay TRONG trang đó (server-side, tránh CORS) rồi trả
// về danh sách cho app hiển thị lưới ảnh — bấm chọn tại chỗ, giống hệt tab Hình ảnh.
// Chỉ ĐỌC trang công khai, KHÔNG ghi gì — nhưng vẫn yêu cầu đăng nhập để tránh bị lợi dụng
// làm proxy quét web tự do.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Chặn SSRF cơ bản: chỉ cho http(s), không cho trỏ vào mạng nội bộ.
function isSafeUrl(u: URL): boolean {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  const h = u.hostname.toLowerCase()
  if (h === 'localhost' || h === '0.0.0.0' || h === '::1') return false
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)) return false
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false
  return true
}

// Đuôi ảnh chấp nhận + từ khoá loại (icon/logo/quảng cáo…) — thà sót còn hơn quét rác.
const IMG_EXT = /\.(jpe?g|png|webp|gif)(\?|#|$)/i
const SKIP_HINT = /(icon|logo|avatar|spinner|loading|pixel|1x1|blank\.gif|sprite|favicon)/i

function extractImageUrls(html: string, baseUrl: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  // Bắt src / data-src / data-lazy-src trong thẻ <img ...>
  const re = /<img\b[^>]*?(?:data-src|data-lazy-src|src)\s*=\s*["']([^"']+)["']/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim()
    if (!raw || raw.startsWith('data:')) continue
    let abs: string
    try { abs = new URL(raw, baseUrl).toString() } catch { continue }
    if (!IMG_EXT.test(abs)) continue
    if (SKIP_HINT.test(abs)) continue
    if (seen.has(abs)) continue
    seen.add(abs)
    out.push(abs)
    if (out.length >= 30) break
  }
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Chỉ chấp nhận POST' }, 405)

  // Yêu cầu đăng nhập (học sinh hoặc thầy đều dùng được) — chặn proxy-quét-web vô danh.
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return json({ error: 'Chưa đăng nhập' }, 401)
  const anon = createClient(SUPABASE_URL, ANON_KEY)
  const { data: { user }, error: authErr } = await anon.auth.getUser(jwt)
  if (authErr || !user) return json({ error: 'Phiên không hợp lệ' }, 401)

  let body: any
  try { body = await req.json() } catch { return json({ error: 'Body không hợp lệ' }, 400) }
  const rawUrl = (body?.url || '').trim()
  if (!rawUrl) return json({ error: 'Thiếu url' }, 400)

  let target: URL
  try { target = new URL(rawUrl) } catch { return json({ error: 'Link không hợp lệ' }, 400) }
  if (!isSafeUrl(target)) return json({ error: 'Link không được phép' }, 400)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(target.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })
    clearTimeout(timer)
    if (!res.ok) return json({ error: `Trang trả lỗi ${res.status}` }, 502)
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('text/html')) return json({ error: 'Không phải trang HTML' }, 502)
    const html = (await res.text()).slice(0, 2_000_000)   // trần 2MB, tránh trang khổng lồ
    const images = extractImageUrls(html, res.url || target.toString())
    return json({ images, sourceUrl: res.url || target.toString() })
  } catch (e) {
    clearTimeout(timer)
    const msg = (e as Error)?.name === 'AbortError' ? 'Trang tải quá lâu, thử lại sau' : 'Không tải được trang'
    return json({ error: msg }, 502)
  }
})
