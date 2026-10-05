// ── Netlify Edge Function: thẻ chia sẻ riêng cho Band / Lớp / Buổi / landing công khai (Dynamic OG V1) ──
// Trang là SPA: crawler của Zalo/Facebook chỉ đọc HTML thô, không chạy JavaScript.
// Hàm chạy ở tầng CDN, thay thẻ <title>/description/og:*/twitter:* trong index.html trước khi trả về.
// Người và crawler nhận CÙNG một HTML (không đoán User-Agent); SPA vẫn chạy như cũ.
//
// Luật route + metadata nằm ở netlify/og/ogMeta.ts (thuần, có test). /story/* vẫn do og-tags.ts lo.
// Lỗi / không tìm thấy dữ liệu → giữ thẻ mặc định, chỉ sửa og:url về đúng URL được chia sẻ.
// Header chẩn đoán: x-og-fn.

import { applyMeta, bandMeta, classMeta, ogRouteFromPath, PROFILE_META, safeImage, STATIC_META, staticMeta } from '../og/ogMeta.ts'
import type { Meta, OgRoute } from '../og/ogMeta.ts'

const SUPA = 'https://wojmdilyflffvdtpovmq.supabase.co'
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvam1kaWx5ZmxmZnZkdHBvdm1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNjk0OTYsImV4cCI6MjA5NDg0NTQ5Nn0.JxlY5iqBTK3q5BYnF1MgY8A5zS3R5okrD8uddsEFavY'
const HEADERS = { apikey: ANON, Authorization: `Bearer ${ANON}`, 'content-type': 'application/json' }
const TIMEOUT_MS = 1500

async function getJson(path: string, init?: RequestInit): Promise<unknown> {
  const r = await fetch(`${SUPA}${path}`, { ...init, headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!r.ok) throw new Error('db-' + r.status)
  return r.json()
}

async function loadBand(slug: string) {
  const d = await getJson('/rest/v1/rpc/band_recruitment_public', { method: 'POST', body: JSON.stringify({ p_slug: slug }) })
  return (d as { band?: { name?: unknown; tagline?: unknown } } | null)?.band ?? null
}

/** Chỉ đọc tên lớp + ảnh khoá học chính — không lịch, giá, Zoom hay ghi chú. */
async function loadClass(classId: string) {
  const rows = await getJson(`/rest/v1/class_schedule?select=name,main_course_id&id=eq.${classId}&limit=1`) as
    { name?: unknown; main_course_id?: unknown }[]
  const c = rows?.[0]
  if (!c) return null
  let image: string | null = null
  if (typeof c.main_course_id === 'string' && /^[0-9a-f-]{36}$/i.test(c.main_course_id)) {
    const cs = await getJson(`/rest/v1/edu_courses?select=image_url,thumbnail_url&id=eq.${c.main_course_id}&limit=1`) as
      { image_url?: unknown; thumbnail_url?: unknown }[]
    image = safeImage(cs?.[0]?.image_url) ?? safeImage(cs?.[0]?.thumbnail_url)
  }
  return { name: c.name, image }
}

/** Ảnh khoá theo mã (landing tĩnh). Lỗi → null, landing vẫn có chữ riêng. */
async function loadCourseImage(code: string | undefined): Promise<string | null> {
  if (!code) return null
  try {
    const cs = await getJson(`/rest/v1/edu_courses?select=image_url,thumbnail_url&code=eq.${encodeURIComponent(code)}&limit=1`) as
      { image_url?: unknown; thumbnail_url?: unknown }[]
    return safeImage(cs?.[0]?.image_url) ?? safeImage(cs?.[0]?.thumbnail_url)
  } catch {
    return null
  }
}

async function metaFor(route: OgRoute): Promise<Meta | null> {
  switch (route.kind) {
    case 'static': return staticMeta(route.key, await loadCourseImage(STATIC_META[route.key].courseCode))
    case 'profile': return PROFILE_META
    case 'band': return bandMeta(await loadBand(route.slug))
    case 'class': return classMeta(await loadClass(route.classId))
    case 'session': return classMeta(await loadClass(route.classId), route.sessionNo)
    default: return null
  }
}

function withNote(res: Response, note: string, body?: string): Response {
  const h = new Headers(res.headers)
  h.set('x-og-fn', note)
  if (body === undefined) return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h })
  h.set('content-type', 'text/html; charset=utf-8')
  h.delete('content-length')
  return new Response(body, { status: res.status, headers: h })
}

export default async function handler(req: Request, context: { next: () => Promise<Response> }) {
  const res = await context.next()
  const ct = res.headers.get('content-type') || ''
  if (res.status !== 200 || !ct.includes('text/html')) return withNote(res, 'skip-not-html')

  const route = ogRouteFromPath(new URL(req.url).pathname)
  let html: string
  try {
    html = await res.text()
  } catch {
    return withNote(res, 'error:read')
  }
  try {
    const meta = await metaFor(route)
    return withNote(res, meta ? `ok-${route.kind}` : `fallback-${route.kind}`, applyMeta(html, meta, req.url))
  } catch (e) {
    // DB lỗi / quá giờ → vẫn sửa og:url, giữ thẻ mặc định
    return withNote(res, 'error:' + (e instanceof Error ? e.name : 'unknown'), applyMeta(html, null, req.url))
  }
}
