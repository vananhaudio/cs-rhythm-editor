// Adapter ĐỌC Kho bài giảng qua API có sẵn của Kho (/api/hocsinh/*, cùng origin qua proxy
// Netlify, xác thực bằng cookie phiên chung). KHÔNG đọc thẳng bảng kho_* (RLS thầy-only,
// và sẽ bỏ qua luật "khoá học ẩn" mà chỉ server Kho áp). KHÔNG dùng /api/hocsinh/tim
// (tìm kiếm bằng AI — tốn phí mỗi lần gõ). KHÔNG sửa gì bên Kho.
//
// Hợp đồng (audit kho-tri-thuc/app/api/hocsinh):
//   GET /api/hocsinh/catalog        → {ok, courses:[{playlist_id,title,count,...}]}
//   GET /api/hocsinh/khoa/<id>      → {ok, course:{playlist_id,title,videos:[{video_id,title,thumbnail_url,duration_sec}]}}
//   401 chưa đăng nhập · 403 chưa được cấp quyền Kho · 404 khoá ẩn/không có

export type KhoCourse = { id: string; title: string; count: number }
export type KhoVideo = { id: string; title: string; thumbnailUrl: string | null; durationSec: number | null }
export type KhoResult<T> = { ok: true; value: T } | { ok: false; message: string }

const ID = /^[A-Za-z0-9_-]{1,64}$/

function khoError(status: number): string {
  if (status === 401) return 'Phiên đăng nhập Kho đã hết. Hãy tải lại trang.'
  if (status === 403) return 'Tài khoản chưa được cấp quyền vào Kho bài giảng.'
  if (status === 404) return 'Không tìm thấy khoá học này trong Kho.'
  return 'Chưa tải được Kho bài giảng. Hãy thử lại.'
}

async function getJson(path: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(path, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
  let body: unknown = null
  try { body = await res.json() } catch { /* không phải JSON (vd: dev server không proxy Kho) */ }
  return { status: res.status, body }
}

export function parseCatalog(body: unknown): KhoCourse[] {
  const courses = (body as { courses?: unknown[] })?.courses
  if (!Array.isArray(courses)) return []
  return courses
    .map(c => c as { playlist_id?: unknown; title?: unknown; count?: unknown })
    .filter(c => typeof c.playlist_id === 'string' && ID.test(c.playlist_id) && typeof c.title === 'string')
    .map(c => ({ id: c.playlist_id as string, title: (c.title as string).trim(), count: Number(c.count) || 0 }))
}

export function parseCourseVideos(body: unknown): KhoVideo[] {
  const videos = (body as { course?: { videos?: unknown[] } })?.course?.videos
  if (!Array.isArray(videos)) return []
  return videos
    .map(v => v as { video_id?: unknown; title?: unknown; thumbnail_url?: unknown; duration_sec?: unknown })
    .filter(v => typeof v.video_id === 'string' && ID.test(v.video_id) && typeof v.title === 'string')
    .map(v => ({
      id: v.video_id as string,
      title: (v.title as string).trim(),
      thumbnailUrl: typeof v.thumbnail_url === 'string' && /^https:\/\//.test(v.thumbnail_url) ? v.thumbnail_url : null,
      durationSec: Number.isFinite(Number(v.duration_sec)) && Number(v.duration_sec) > 0 ? Number(v.duration_sec) : null,
    }))
}

export async function listKhoCourses(): Promise<KhoResult<KhoCourse[]>> {
  try {
    const { status, body } = await getJson('/api/hocsinh/catalog')
    if (status !== 200 || !(body as { ok?: boolean })?.ok) return { ok: false, message: khoError(status) }
    return { ok: true, value: parseCatalog(body) }
  } catch {
    return { ok: false, message: 'Không có kết nối mạng. Kiểm tra mạng rồi thử lại.' }
  }
}

export async function listKhoCourseVideos(courseId: string): Promise<KhoResult<KhoVideo[]>> {
  if (!ID.test(courseId)) return { ok: false, message: khoError(404) }
  try {
    const { status, body } = await getJson(`/api/hocsinh/khoa/${encodeURIComponent(courseId)}`)
    if (status !== 200 || !(body as { ok?: boolean })?.ok) return { ok: false, message: khoError(status) }
    return { ok: true, value: parseCourseVideos(body) }
  } catch {
    return { ok: false, message: 'Không có kết nối mạng. Kiểm tra mạng rồi thử lại.' }
  }
}

/** Lọc theo tên (không dấu, không phân biệt hoa/thường) — lọc tại chỗ, không gọi AI. */
export function foldVi(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
}
export function filterByTitle<T extends { title: string }>(items: T[], q: string): T[] {
  const k = foldVi(q.trim())
  return k ? items.filter(i => foldVi(i.title).includes(k)) : items
}
