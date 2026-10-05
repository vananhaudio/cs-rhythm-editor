// ── Netlify Edge Function: thẻ chia sẻ riêng cho Band / Lớp / Buổi / Showcase / landing công khai (Dynamic OG V1.1) ──
// Trang là SPA: crawler của Zalo/Facebook chỉ đọc HTML thô, không chạy JavaScript.
// Hàm chạy ở tầng CDN, thay thẻ <title>/description/og:*/twitter:* trong index.html trước khi trả về.
// Người và crawler nhận CÙNG một HTML (không đoán User-Agent); SPA vẫn chạy như cũ.
//
// Luật route + metadata + chuỗi ảnh (resolveOgImage) nằm ở netlify/og/ogMeta.ts (thuần, có test).
// /story/* vẫn do og-tags.ts lo.
// Lỗi / không tìm thấy dữ liệu → giữ thẻ mặc định, chỉ sửa og:url về đúng URL được chia sẻ.
// Header chẩn đoán: x-og-fn.

import {
  applyMeta, bandMeta, classMeta, courseImageCandidates, ogRouteFromPath, PROFILE_META, showcaseMeta, STATIC_META, staticMeta,
} from '../og/ogMeta.ts'
import type { ClassData, Meta, OgRoute, ShowcaseData, StaticKey } from '../og/ogMeta.ts'

const SUPA = 'https://wojmdilyflffvdtpovmq.supabase.co'
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvam1kaWx5ZmxmZnZkdHBvdm1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNjk0OTYsImV4cCI6MjA5NDg0NTQ5Nn0.JxlY5iqBTK3q5BYnF1MgY8A5zS3R5okrD8uddsEFavY'
const HEADERS = { apikey: ANON, Authorization: `Bearer ${ANON}`, 'content-type': 'application/json' }
const TIMEOUT_MS = 1500
const UUID_RE = /^[0-9a-f-]{36}$/i

async function getJson(path: string, init?: RequestInit): Promise<unknown> {
  const r = await fetch(`${SUPA}${path}`, { ...init, headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!r.ok) throw new Error('db-' + r.status)
  return r.json()
}
const first = async <T>(path: string): Promise<T | null> => ((await getJson(path)) as T[] | null)?.[0] ?? null

async function loadBand(slug: string) {
  const d = await getJson('/rest/v1/rpc/band_recruitment_public', { method: 'POST', body: JSON.stringify({ p_slug: slug }) })
  return (d as { band?: { name?: unknown; tagline?: unknown; cover_url?: unknown } } | null)?.band ?? null
}

type CourseRow = { image_url?: unknown; thumbnail_url?: unknown }

/** Lớp: chỉ tên + ảnh lớp + ảnh khoá chính — không lịch, giá, Zoom hay ghi chú. filter = `id=eq.<uuid>` / `program_code=eq.X`. */
async function loadClass(filter: string): Promise<ClassData> {
  const c = await first<{ name?: unknown; cover_url?: unknown; main_course_id?: unknown }>(
    `/rest/v1/class_schedule?select=name,cover_url,main_course_id&${filter}&order=start_date.desc.nullslast&limit=1`)
  if (!c) return null
  // Có ảnh lớp → không cần đọc khoá (bớt một lượt mạng)
  let course: CourseRow | null = null
  if (!c.cover_url && typeof c.main_course_id === 'string' && UUID_RE.test(c.main_course_id)) {
    course = await first<CourseRow>(`/rest/v1/edu_courses?select=image_url,thumbnail_url&id=eq.${c.main_course_id}&limit=1`)
  }
  const [course_image, course_thumbnail] = courseImageCandidates(course)
  return { name: c.name, cover_url: c.cover_url, course_image, course_thumbnail }
}

/** Ứng viên ảnh cho landing tĩnh theo entity nó đại diện. Lỗi → [] (landing vẫn có chữ riêng, ảnh mặc định). */
async function staticImageCandidates(key: StaticKey): Promise<unknown[]> {
  const m = STATIC_META[key]
  try {
    if (m.courseCode) {
      return courseImageCandidates(await first<CourseRow>(
        `/rest/v1/edu_courses?select=image_url,thumbnail_url&code=eq.${encodeURIComponent(m.courseCode)}&limit=1`))
    }
    if (m.programCode) {
      const c = await loadClass(`program_code=eq.${encodeURIComponent(m.programCode)}`)
      return [c?.cover_url, c?.course_image, c?.course_thumbnail]
    }
    if (m.toolRoute) {
      const t = await first<{ image_url?: unknown }>(
        `/rest/v1/edu_tools?select=image_url&route=eq.${encodeURIComponent(m.toolRoute)}&image_url=not.is.null&order=order_index&limit=1`)
      return [t?.image_url]
    }
  } catch { /* ảnh mặc định */ }
  return []
}

async function loadShowcase(slug: string): Promise<ShowcaseData> {
  return first<NonNullable<ShowcaseData>>(
    `/rest/v1/showcase_pages?select=title,seo_title,seo_description,summary,cover_image&slug=eq.${encodeURIComponent(slug)}&published=eq.true&limit=1`)
}

async function metaFor(route: OgRoute): Promise<Meta | null> {
  switch (route.kind) {
    case 'static': return staticMeta(route.key, await staticImageCandidates(route.key))
    case 'profile': return PROFILE_META
    case 'band': return bandMeta(await loadBand(route.slug))
    case 'class': return classMeta(await loadClass(`id=eq.${route.classId}`))
    case 'session': return classMeta(await loadClass(`id=eq.${route.classId}`), route.sessionNo)
    case 'showcase': return showcaseMeta(await loadShowcase(route.slug))
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
