// ── Dynamic OG V1 — phần THUẦN (không fetch, không Deno API) để test được bằng node ──
// Edge Function netlify/edge-functions/og-meta.ts gọi các hàm ở đây:
//   1. ogRouteFromPath(pathname)  → route nào, cần dữ liệu gì
//   2. (edge fetch Supabase bằng anon key nếu route cần)
//   3. metaForRoute(route, data)  → title / description / image
//   4. applyMeta(html, meta, url) → thay thẻ <title>, description, og:*, twitter:* trong index.html
//
// RIÊNG TƯ: crawler là khách. Chỉ dùng dữ liệu anon đã đọc được sẵn (band_recruitment_public,
// class_schedule.name, edu_courses ảnh). Profile KHÔNG đọc DB — luôn preview chung.
// /story/* KHÔNG đi qua đây (giữ og-tags.ts).

export const SITE = 'Thầy Văn Anh Guitar'
export const DEFAULT_IMAGE_PATH = '/og-default.png'

export type OgRoute =
  | { kind: 'static'; key: StaticKey }
  | { kind: 'band'; slug: string }
  | { kind: 'class'; classId: string }
  | { kind: 'session'; classId: string; sessionNo: number }
  | { kind: 'profile' }
  | { kind: 'fallback' }

export type StaticKey = 'solo01' | 'hanhtrinh2027' | 'nhipphach' | 'thuvien'

export type Meta = { title: string; description: string; image: string | null }

/** Landing tĩnh: chữ cố định; ảnh lấy từ DB theo mã khoá (edu_courses.code) nếu có — không viết cứng URL ảnh. */
export type StaticMeta = Meta & { courseCode?: string }

// Metadata tĩnh của các landing công khai. image null + không courseCode = ảnh mặc định
// (05/10: Hành trình 2027 / Nhịp & Phách / Thư viện chưa có ảnh phù hợp trong hệ thống).
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
  },
  nhipphach: {
    title: 'Nhịp & Phách | Thầy Văn Anh Guitar',
    description: 'Công cụ đọc nhịp – phách trên bản nhạc: mở MusicXML, đánh số phách, đếm và luyện theo nhịp.',
    image: null,
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

  const prof = /^\/me\/u\/([0-9a-f-]{36})$/i.exec(p)
  if (prof && UUID_RE.test(prof[1])) return { kind: 'profile' }

  return { kind: 'fallback' }
}

/** Landing tĩnh + ảnh khoá (nếu đọc được). */
export function staticMeta(key: StaticKey, courseImage: unknown): Meta {
  const m = STATIC_META[key]
  return { title: m.title, description: m.description, image: safeImage(courseImage) ?? m.image }
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

export type BandData = { name?: unknown; tagline?: unknown } | null
export type ClassData = { name?: unknown; image?: unknown } | null

const pad2 = (n: number) => String(n).padStart(2, '0')
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export function bandMeta(band: BandData): Meta | null {
  const name = str(band?.name)
  if (!name) return null
  const tagline = str(band?.tagline)
  return {
    title: `${name} · Band · ${SITE}`,
    description: tagline ? summarize(tagline) : `${name} — Band của lớp Thầy Văn Anh Guitar.`,
    image: null,
  }
}

/** Lớp / buổi: chỉ tên lớp + ảnh khoá học. Không lịch, không giá, không nội dung buổi. */
export function classMeta(cls: ClassData, sessionNo?: number): Meta | null {
  const name = str(cls?.name)
  if (!name) return null
  const image = safeImage(cls?.image)
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
