import { createBrowserClient } from '@supabase/ssr'

export const SUPABASE_URL = 'https://wojmdilyflffvdtpovmq.supabase.co'
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvam1kaWx5ZmxmZnZkdHBvdm1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNjk0OTYsImV4cCI6MjA5NDg0NTQ5Nn0.JxlY5iqBTK3q5BYnF1MgY8A5zS3R5okrD8uddsEFavY'

// ── SSO cross-subdomain ─────────────────────────────────────────────────────
// Session lưu bằng COOKIE trên domain cha `.vananhaudio.com` (thay vì
// localStorage theo từng origin) → đăng nhập ở class.vananhaudio.com là
// shop.vananhaudio.com thấy luôn, và ngược lại. Phần cấu hình cookie dưới đây
// phải GIỐNG HỆT Shop.vananhaudio.com/src/lib/supabase.ts.
//
// Cookie name mặc định = "sb-<project-ref>-auth-token". Hai app cùng project
// ref nên tên cookie tự trùng — KHÔNG được set storageKey/cookieOptions.name
// riêng ở một bên.
const ROOT_DOMAIN = 'vananhaudio.com'
const host = typeof window !== 'undefined' ? window.location.hostname : ''

// Chỉ gắn domain cha ở đúng nơi dùng được:
// - *.vananhaudio.com → '.vananhaudio.com' (đây là SSO thật).
// - *.test (dev, khai trong /etc/hosts, vd class.vanlocal.test) → 2 nhãn cuối.
// - còn lại (localhost, *.localhost, deploy preview *.netlify.app) → KHÔNG set
//   domain, dùng cookie host-only. Set domain cha ở netlify.app thì trình duyệt
//   vứt cookie = mất đăng nhập; còn "localhost" bị Chrome coi là public suffix
//   nên MỌI cookie có Domain=…localhost đều bị từ chối (đã thử, không chạy).
function parentCookieDomain(h: string): string | undefined {
  if (!h) return undefined
  if (h === ROOT_DOMAIN || h.endsWith('.' + ROOT_DOMAIN)) return '.' + ROOT_DOMAIN
  if (h.endsWith('.test')) return '.' + h.split('.').slice(-2).join('.')
  return undefined
}

const cookieDomain = parentCookieDomain(host)
const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'

export const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  cookieOptions: {
    domain: cookieDomain,
    path: '/',
    sameSite: 'lax', // mọi subdomain là same-site → lax là đủ
    secure: isHttps, // trang http (dev) mà bật secure là cookie bị bỏ
    // maxAge do @supabase/ssr quyết định (400 ngày) — truyền vào cũng bị ghi đè.
  },
  // Token dài sẽ được @supabase/ssr tự chunk (…-auth-token.0/.1) — không tự nhồi.
})
