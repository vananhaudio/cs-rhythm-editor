// ── Netlify Edge Function: Universal OG — thẻ chia sẻ cho MỌI URL của Class ──
// SPA: crawler Zalo/Facebook/iMessage chỉ đọc HTML thô. Hàm chạy ở CDN trên mọi trang HTML:
//   URL → registry (netlify/og/registry.ts) → resource adapter → ShareMeta → renderer → index.html
// Không resource / private / not_found / lỗi / quá giờ → thẻ mặc định Class, og:url vẫn đúng URL.
// Người và crawler nhận CÙNG HTML (không đoán User-Agent); SPA chạy như cũ. Không có danh sách URL ở đây:
// thêm loại resource = thêm adapter; route mới phải được phân loại ở netlify/og/routes.ts (test bắt).
// Header chẩn đoán: x-og-fn.

import type { Ctx } from '../og/adapter.ts'
import { resolveShare } from '../og/registry.ts'
import { canonicalUrl, renderShareMeta } from '../og/render.ts'

const SUPA = 'https://wojmdilyflffvdtpovmq.supabase.co'
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvam1kaWx5ZmxmZnZkdHBvdm1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNjk0OTYsImV4cCI6MjA5NDg0NTQ5Nn0.JxlY5iqBTK3q5BYnF1MgY8A5zS3R5okrD8uddsEFavY'
const HEADERS = { apikey: ANON, Authorization: `Bearer ${ANON}`, 'content-type': 'application/json' }
const FETCH_TIMEOUT_MS = 1500
const TOTAL_TIMEOUT_MS = 2500

async function call(path: string, init?: RequestInit): Promise<unknown> {
  const r = await fetch(`${SUPA}${path}`, { ...init, headers: HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!r.ok) throw new Error('db-' + r.status)
  return r.json()
}

function withNote(res: Response, note: string, body?: string): Response {
  const h = new Headers(res.headers)
  h.set('x-og-fn', note)
  if (body === undefined) return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h })
  h.set('content-type', 'text/html; charset=utf-8')
  h.delete('content-length')
  return new Response(body, { status: res.status, headers: h })
}

// Facebook (và vài crawler khác) gửi `Range: bytes=0-…` → origin/proxy trả 206 → trước đây bị 'skip' và crawler nhận HTML mặc định.
// Chỉ với route HTML (path không có đuôi file) mới bỏ Range/If-Range để nhận 200 đầy đủ; file tĩnh/media/API giữ nguyên Range.
const hasFileExtension = (pathname: string) => /\.[^/]+$/.test(pathname)
function nextRequest(req: Request): Request | undefined {
  if (req.method !== 'GET' || !req.headers.has('range') || hasFileExtension(new URL(req.url).pathname)) return undefined
  const headers = new Headers(req.headers)
  headers.delete('range')
  headers.delete('if-range')
  return new Request(req, { headers })
}

export default async function handler(req: Request, context: { next: (request?: Request) => Promise<Response> }) {
  const forwarded = nextRequest(req)
  const res = forwarded ? await context.next(forwarded) : await context.next()
  const ct = res.headers.get('content-type') || ''
  if (req.method !== 'GET' || res.status !== 200 || !ct.includes('text/html')) return withNote(res, 'skip')

  const url = new URL(req.url)
  let html: string
  try {
    html = await res.text()
  } catch {
    return withNote(res, 'error:read')
  }
  const ctx: Ctx = {
    origin: url.origin,
    get: path => call(path),
    rpc: (fn, body) => call(`/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(body) }),
    now: () => Date.now(),
  }
  try {
    const r = await Promise.race([
      resolveShare(url, ctx),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), TOTAL_TIMEOUT_MS)),
    ])
    return withNote(res, r.note, renderShareMeta(html, r.meta, r.canonicalUrl))
  } catch (e) {
    // fail closed: thẻ mặc định Class, chỉ sửa og:url về đúng URL được chia sẻ
    const fallback = canonicalUrl(url.origin, url.pathname)
    return withNote(res, 'error:' + (e instanceof Error ? e.message.slice(0, 40) : 'unknown'), renderShareMeta(html, null, fallback))
  }
}

// Mọi trang, trừ site khác được proxy qua _redirects (routes.ts kind 'proxy' — test đối chiếu) và file tĩnh.
export const config = {
  path: '/*',
  excludedPath: [
    '/teamlab', '/teamlab/*', '/azz', '/azz/*', '/khobaigiang', '/khobaigiang/*', '/login', '/login/*',
    '/api', '/api/*', '/_next', '/_next/*', '/privacy', '/privacy/*', '/tvaprivacy', '/tvaprivacy/*', '/assets/*',
  ],
  onError: 'bypass',
}
