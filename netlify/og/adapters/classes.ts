// Lớp / Buổi / Chương trình — nguồn class_schedule (+ class_sessions, edu_courses ảnh).
// CÔNG KHAI chỉ khi lớp is_active và trạng thái không phải nháp / đã huỷ / đã gộp. Chỉ đọc tên + ảnh —
// không lịch, giá, Zoom, ghi chú hay nội dung buổi.
// Ảnh: class_schedule.cover_url → ảnh khoá chính (image_url → thumbnail_url) → mặc định. Buổi dùng chuỗi của Lớp.
import { first, UUID_RE, type Ctx } from '../adapter.ts'
import { courseImageCandidates, pad2, resolveOgImage, str } from '../contract.ts'

export const PRIVATE_CLASS_STATUSES = new Set(['draft', 'cancelled', 'merged'])

export type ClassRow = { name?: unknown; cover_url?: unknown; main_course_id?: unknown; status?: unknown; is_active?: unknown; total_sessions?: unknown }
export type ClassRecord = { name: string; isPublic: boolean; image: string | null; totalSessions: number }

export const classIsPublic = (c: ClassRow) =>
  c.is_active !== false && !PRIVATE_CLASS_STATUSES.has(str(c.status))

const CLASS_COLS = 'select=name,cover_url,main_course_id,status,is_active,total_sessions'

/** filter: `id=eq.<uuid>` hoặc `program_code=eq.X&…`. Không có dòng → null. */
export async function loadClass(ctx: Ctx, filter: string): Promise<ClassRecord | null> {
  const c = await first<ClassRow>(ctx, `/rest/v1/class_schedule?${CLASS_COLS}&${filter}&limit=1`)
  if (!c) return null
  const isPublic = classIsPublic(c)
  let course: { image_url?: unknown; thumbnail_url?: unknown } | null = null
  // Lớp chưa công khai hoặc đã có ảnh lớp → không đọc khoá (bớt một lượt mạng)
  if (isPublic && !c.cover_url && typeof c.main_course_id === 'string' && UUID_RE.test(c.main_course_id)) {
    course = await first(ctx, `/rest/v1/edu_courses?select=image_url,thumbnail_url&id=eq.${c.main_course_id}&limit=1`)
  }
  const totalSessions = typeof c.total_sessions === 'number' && c.total_sessions > 0 ? c.total_sessions : 0
  return { name: str(c.name), isPublic, image: resolveOgImage([c.cover_url, ...courseImageCandidates(course)]), totalSessions }
}

/** Lớp mới nhất đang công khai của một chương trình (class_schedule.program_code). */
export const loadProgram = (ctx: Ctx, programCode: string) =>
  loadClass(ctx, `program_code=eq.${encodeURIComponent(programCode)}&is_active=eq.true`
    + `&status=not.in.(${[...PRIVATE_CLASS_STATUSES].join(',')})&order=start_date.desc.nullslast`)

export const classTitle = (name: string, sessionNo?: number) =>
  sessionNo ? `Buổi ${pad2(sessionNo)} · ${name}` : name
export const classDescription = (name: string, sessionNo?: number) =>
  sessionNo ? `Buổi ${pad2(sessionNo)} của lớp ${name} — học guitar cùng Thầy Văn Anh.` : `Lớp ${name} — học guitar cùng Thầy Văn Anh.`
