// ── Dynamic OG V1 — phần THUẦN (không fetch, không Deno API) để test được bằng node ──
// Edge Function netlify/edge-functions/og-meta.ts gọi các hàm ở đây:
//   1. ogRouteFromPath(pathname)  → route nào, cần dữ liệu gì
//   2. (edge fetch Supabase bằng anon key nếu route cần)
//   3. bandMeta / classMeta / staticMeta / showcaseMeta(data) → title / description / image
//   4. applyMeta(html, meta, url) → thay thẻ <title>, description, og:*, twitter:* trong index.html
//
// ẢNH (V1.1): resolveOgImage(candidates) — ảnh https đầu tiên theo thứ tự ưu tiên, không có → null = ảnh
// mặc định của index.html. Ứng viên là ẢNH CỦA ENTITY (cột mà giao diện cũng dùng), không có trường OG riêng:
//   Band     bands.cover_url → mặc định
//   Tool     edu_tools.image_url → mặc định
//   Lớp      class_schedule.cover_url → ảnh khoá chính (edu_courses.image_url → thumbnail_url) → mặc định
//   Buổi     (chưa có ảnh riêng) → chuỗi của Lớp
//   Khoá     edu_courses.image_url → thumbnail_url → mặc định
//   Showcase showcase_pages.cover_image → mặc định;  Story: og-tags.ts (photos) — không đổi
//
// RIÊNG TƯ: crawler là khách. Chỉ dùng dữ liệu anon đã đọc được sẵn (band_recruitment_public,
// class_schedule.name/cover_url, edu_courses ảnh, edu_tools.image_url, showcase đã publish).
// Profile KHÔNG đọc DB — luôn preview chung.
// /story/* KHÔNG đi qua đây (giữ og-tags.ts).

export const SITE = 'Thầy Văn Anh Guitar'
export const DEFAULT_IMAGE_PATH = '/og-default.png'

export type OgRoute =
  | { kind: 'static'; key: StaticKey }
  | { kind: 'band'; slug: string }
  | { kind: 'class'; classId: string }
  | { kind: 'session'; classId: string; sessionNo: number }
  | { kind: 'showcase'; slug: string }
  | { kind: 'profile' }
  | { kind: 'fallback' }

export type StaticKey = 'solo01' | 'hanhtrinh2027' | 'nhipphach' | 'thuvien'

export type Meta = { title: string; description: string; image: string | null }

/**
 * Landing tĩnh: chữ cố định; ẢNH lấy theo entity mà landing đại diện — không viết cứng URL ảnh:
 *   courseCode  → khoá học (edu_courses.code)
 *   programCode → lớp của chương trình (class_schedule.program_code) → chuỗi ảnh Lớp
 *   toolRoute   → công cụ (edu_tools.route)
 * Không khai entity (Thư viện) → ảnh mặc định.
 */
export type StaticMeta = Meta & { courseCode?: string; programCode?: string; toolRoute?: string }

export const STATIC_META: Record<StaticKey, StaticMeta> = {
  solo01: {
    title: 'Solo Guitar Căn Bản | Thầy Văn Anh Guitar',
    description: 'Khóa Solo Guitar Căn Bản 24 buổi – từ giai điệu, bass, hòa âm, kỹ thuật đến tự dựng bài hát yêu thích thành Solo Guitar.',
    image: null,
    courseCode: 'SOLO',   // logo khoá Solo Guitar Căn Bản
  },
  hanhtrinh2027: {
    title: '40 Buổi Thực Hành · Hành Trình 2027 | Thầy Văn Anh Guitar',
    description: 'Hành Trình 2027 — 40 buổi thực hành guitar theo lịch cố định, chia 5 chặng, cùng Thầy Văn Anh.',
    image: null,
    programCode: 'HT2027',
  },
  nhipphach: {
    title: 'Nhịp & Phách | Thầy Văn Anh Guitar',
    description: 'Công cụ đọc nhịp – phách trên bản nhạc: mở MusicXML, đánh số phách, đếm và luyện theo nhịp.',
    image: null,
    toolRoute: '/nhipphach',
  },
  thuvien: {
    title: 'Thư viện bản nhạc | Thầy Văn Anh Guitar',
    description: 'Thư viện bản nhạc MusicXML của lớp Thầy Văn Anh Guitar.',
    image: null,
  },
}

export const PROFILE_META: Meta = {
  title: `Trang cá nhân · ${SITE}`,
  description: 'Trang cá nhân trong cộng đồng học guitar cùng Thầy Văn Anh.',
  image: null,
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Đường dẫn → route OG. Khớp đúng luật của SPA (resolveMeRoute.ts, bandModel.ts, AppRouter.tsx). */
export function ogRouteFromPath(pathname: string): OgRoute {
  const p = pathname.replace(/\/+$/, '') || '/'

  if (/^\/solo01(\/.*)?$/.test(p)) return { kind: 'static', key: 'solo01' }
  if (/^\/hanhtrinh2027(\/.*)?$/.test(p)) return { kind: 'static', key: 'hanhtrinh2027' }
  if (p === '/nhipphach') return { kind: 'static', key: 'nhipphach' }
  if (p === '/thuvien') return { kind: 'static', key: 'thuvien' }

  if (p.startsWith('/band/')) {
    const slug = p.slice('/band/'.length).toLowerCase()
    if (SLUG_RE.test(slug) && slug.length <= 60) return { kind: 'band', slug }
    return { kind: 'fallback' }
  }

  const ses = /^\/me\/classes\/([0-9a-f-]{36})\/sessions\/([1-9][0-9]{0,3})$/i.exec(p)
  if (ses && UUID_RE.test(ses[1])) return { kind: 'session', classId: ses[1].toLowerCase(), sessionNo: Number(ses[2]) }
  const cls = /^\/me\/classes\/([0-9a-f-]{36})(\/space)?$/i.exec(p)
  if (cls && UUID_RE.test(cls[1])) return { kind: 'class', classId: cls[1].toLowerCase() }

  if (p.startsWith('/showcase/')) {
    const slug = p.slice('/showcase/'.length).toLowerCase()
    if (SLUG_RE.test(slug) && slug.length <= 120) return { kind: 'showcase', slug }
    return { kind: 'fallback' }
  }

  const prof = /^\/me\/u\/([0-9a-f-]{36})$/i.exec(p)
  if (prof && UUID_RE.test(prof[1])) return { kind: 'profile' }

  return { kind: 'fallback' }
}

/** Landing tĩnh + ảnh entity (nếu đọc được). imageCandidates theo thứ tự ưu tiên. */
export function staticMeta(key: StaticKey, imageCandidates: readonly unknown[] = []): Meta {
  const m = STATIC_META[key]
  return { title: m.title, description: m.description, image: resolveOgImage([...imageCandidates, m.image]) }
}

/** Cắt mô tả gọn cho thẻ share. */
export function summarize(text: string, max = 200): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 120 ? cut.slice(0, lastSpace) : cut) + '…'
}

/** Chỉ nhận ảnh https tuyệt đối — crawler không theo được đường dẫn tương đối / http. */
export function safeImage(url: unknown): string | null {
  if (typeof url !== 'string') return null
  try {
    const u = new URL(url)
    return u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}

/**
 * Ảnh chia sẻ = ảnh https hợp lệ ĐẦU TIÊN trong danh sách ứng viên (đã xếp theo ưu tiên của entity).
 * Không có → null (applyMeta giữ ảnh mặc định của index.html).
 */
export function resolveOgImage(candidates: readonly unknown[]): string | null {
  for (const c of candidates) {
    const u = safeImage(c)
    if (u) return u
  }
  return null
}

/** Chuỗi ảnh của Lớp (Buổi dùng chung): ảnh lớp → ảnh khoá chính → thumbnail khoá. */
export const classImageCandidates = (c: ClassData): unknown[] => [c?.cover_url, c?.course_image, c?.course_thumbnail]
/** Chuỗi ảnh của Khoá: image_url → thumbnail_url. */
export const courseImageCandidates = (c: { image_url?: unknown; thumbnail_url?: unknown } | null | undefined): unknown[] =>
  [c?.image_url, c?.thumbnail_url]

export type BandData = { name?: unknown; tagline?: unknown; cover_url?: unknown } | null
export type ClassData = { name?: unknown; cover_url?: unknown; course_image?: unknown; course_thumbnail?: unknown } | null
export type ShowcaseData = { title?: unknown; seo_title?: unknown; seo_description?: unknown; summary?: unknown; cover_image?: unknown } | null

const pad2 = (n: number) => String(n).padStart(2, '0')
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export function bandMeta(band: BandData): Meta | null {
  const name = str(band?.name)
  if (!name) return null
  const tagline = str(band?.tagline)
  return {
    title: `${name} · Band · ${SITE}`,
    description: tagline ? summarize(tagline) : `${name} — Band của lớp Thầy Văn Anh Guitar.`,
    image: resolveOgImage([band?.cover_url]),
  }
}

/** Lớp / buổi: chỉ tên lớp + ảnh khoá học. Không lịch, không giá, không nội dung buổi. */
export function classMeta(cls: ClassData, sessionNo?: number): Meta | null {
  const name = str(cls?.name)
  if (!name) return null
  const image = resolveOgImage(classImageCandidates(cls))
  if (sessionNo) {
    return {
      title: `Buổi ${pad2(sessionNo)} · ${name} · ${SITE}`,
      description: `Buổi ${pad2(sessionNo)} của lớp ${name} — học guitar cùng Thầy Văn Anh.`,
      image,
    }
  }
  return {
    title: `${name} · ${SITE}`,
    description: `Lớp ${name} — học guitar cùng Thầy Văn Anh.`,
    image,
  }
}

/** Showcase đã publish: tiêu đề/mô tả SEO của trang + ảnh bìa. */
export function showcaseMeta(page: ShowcaseData): Meta | null {
  const title = str(page?.seo_title) || str(page?.title)
  if (!title) return null
  const desc = str(page?.seo_description) || str(page?.summary)
  return { title, description: desc ? summarize(desc) : title, image: resolveOgImage([page?.cover_image]) }
}

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Thay content của một thẻ meta theo property (og:*) hoặc name. Không có thẻ → giữ nguyên. */
export function setMeta(html: string, key: string, value: string): string {
  const attr = key.startsWith('og:') ? 'property' : 'name'
  const re = new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`, 'i')
  return html.replace(re, (_m, a: string, b: string) => a + esc(value) + b)
}

/** URL chia sẻ chuẩn: https, bỏ query + hash + gạch chéo cuối. */
export function canonicalUrl(href: string): string {
  const u = new URL(href)
  const path = u.pathname.replace(/\/+$/, '') || '/'
  return `https://${u.host}${path}`
}

/**
 * Ghi metadata vào index.html. meta null = fallback: giữ title/ảnh mặc định, chỉ sửa og:url
 * về đúng URL được chia sẻ (index.html cứng og:url = trang chủ → Facebook gom mọi link về trang chủ).
 */
export function applyMeta(html: string, meta: Meta | null, href: string): string {
  const url = canonicalUrl(href)
  let out = setMeta(html, 'og:url', url)
  if (!meta) return out
  out = out.replace(/<title>[^<]*<\/title>/i, () => `<title>${esc(meta.title)}</title>`)
  for (const k of ['og:title', 'twitter:title']) out = setMeta(out, k, meta.title)
  for (const k of ['description', 'og:description', 'twitter:description']) out = setMeta(out, k, meta.description)
  if (meta.image) {
    for (const k of ['og:image', 'twitter:image']) out = setMeta(out, k, meta.image)
    // ảnh khoá học không chắc 1200x630 → bỏ kích thước cố định của ảnh mặc định
    out = out.replace(/<meta property="og:image:(width|height)"[^>]*>\s*/gi, '')
  }
  return out
}
