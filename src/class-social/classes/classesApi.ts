// Lớp học trong /me — CHỈ qua RPC đọc (social_*). Không query thẳng edu_group_members/class_schedule
// (membership + dữ liệu nhạy cảm do server lọc). Client không gửi learner/membership.
import type { Result } from '../posts/postsApi'
import { entryKey, toFeedEntries, type FeedEntry, type MixedRow } from '../posts/postModel'
import { scErrorText, toClassCard, toClassCards, toClassMembers, type ClassCard, type ClassMember, type ClassMemberRow } from './classModel'

// Nạp client khi GỌI → component render được trong test Node.
const db = () => import('../../supabase').then(m => m.supabase)
const FEED_PAGE = 20   // = postsApi.FEED_PAGE (không import giá trị để khỏi nạp supabase lúc import)
const warn = (w: string, e: { code?: string; message?: string } | null) => {
  if (import.meta.env?.DEV && e) console.warn(`[class-social] ${w}:`, e.code, e.message)
}

export async function fetchMyClasses(): Promise<Result<ClassCard[]>> {
  try {
    const { data, error } = await (await db()).rpc('social_my_classes')
    if (error) { warn('my_classes', error); return { ok: false, message: scErrorText(error.message) } }
    return { ok: true, value: toClassCards(data) }
  } catch (e) { return { ok: false, message: scErrorText((e as Error).message) } }
}

/** Thầy/admin: MỌI lớp (bỏ huỷ/gộp/nháp) — quyền is_teacher() ở server; học sinh gọi → 42501. Không phải membership. */
export async function fetchAllClasses(): Promise<Result<ClassCard[]>> {
  try {
    const { data, error } = await (await db()).rpc('social_all_classes')
    if (error) { warn('all_classes', error); return { ok: false, message: scErrorText(error.message) } }
    return { ok: true, value: toClassCards(data) }
  } catch (e) { return { ok: false, message: scErrorText((e as Error).message) } }
}

export async function fetchDiscoverClasses(limit = 50): Promise<Result<ClassCard[]>> {
  try {
    const { data, error } = await (await db()).rpc('social_discover_classes', { p_limit: limit })
    if (error) { warn('discover', error); return { ok: false, message: scErrorText(error.message) } }
    return { ok: true, value: toClassCards(data) }
  } catch (e) { return { ok: false, message: scErrorText((e as Error).message) } }
}

export async function fetchClassDetail(classId: string): Promise<Result<ClassCard>> {
  try {
    const { data, error } = await (await db()).rpc('social_class_detail', { p_class: classId })
    if (error) { warn('class_detail', error); return { ok: false, message: scErrorText(error.message) } }
    const c = toClassCard(data)
    return c ? { ok: true, value: c } : { ok: false, message: scErrorText('SC_NOT_FOUND') }
  } catch (e) { return { ok: false, message: scErrorText((e as Error).message) } }
}

/** Hoạt động công khai của lớp (Learning Thread community thuộc lớp) — cùng dạng mục với Feed. */
export async function fetchClassActivityPage(classId: string, cursor?: { createdAt: string; key: string }): Promise<Result<{ posts: FeedEntry[]; hasMore: boolean }>> {
  try {
    const { data, error } = await (await db()).rpc('social_class_activity', {
      p_class: classId, p_before: cursor?.createdAt ?? null, p_before_key: cursor?.key ?? null, p_limit: FEED_PAGE,
    })
    if (error) { warn('class_activity', error); return { ok: false, message: scErrorText(error.message) } }
    const rows = (data ?? []) as MixedRow[]
    return { ok: true, value: { posts: toFeedEntries(rows), hasMore: rows.length === FEED_PAGE } }
  } catch (e) { return { ok: false, message: scErrorText((e as Error).message) } }
}

export async function fetchClassMembers(classId: string): Promise<Result<ClassMember[]>> {
  try {
    const { data, error } = await (await db()).rpc('social_class_members', { p_class: classId })
    if (error) { warn('class_members', error); return { ok: false, message: scErrorText(error.message) } }
    return { ok: true, value: toClassMembers(data as ClassMemberRow[]) }
  } catch (e) { return { ok: false, message: scErrorText((e as Error).message) } }
}

// ── Tham gia lớp bằng MÃ (RPC class_join_preview / class_join). Server tự lấy auth.uid(), resolve mã → lớp → nhóm
// thành viên canonical. Client chỉ gửi mã người dùng gõ.
export type JoinPreview = {
  classId: string; code: string | null; name: string; status: string | null; schedule: string | null
  course: { code: string | null; name: string } | null; memberCount: number; alreadyMember: boolean
}
export async function previewJoinClass(code: string): Promise<Result<JoinPreview>> {
  try {
    const { data, error } = await (await db()).rpc('class_join_preview', { p_code: code })
    if (error) { warn('join_preview', error); return { ok: false, message: scErrorText(error.message) } }
    const d = (data ?? {}) as Record<string, unknown>
    return { ok: true, value: {
      classId: String(d.class_id), code: (d.code as string) ?? null, name: String(d.name ?? 'Lớp học'), status: (d.status as string) ?? null,
      schedule: (d.schedule as string) ?? null, course: (d.course as JoinPreview['course']) ?? null,
      memberCount: Number(d.member_count ?? 0), alreadyMember: d.already_member === true,
    } }
  } catch (e) { return { ok: false, message: scErrorText((e as Error).message) } }
}
export async function joinClassByCode(code: string): Promise<Result<{ classId: string; alreadyMember: boolean }>> {
  try {
    const { data, error } = await (await db()).rpc('class_join', { p_code: code })
    if (error) { warn('join', error); return { ok: false, message: scErrorText(error.message) } }
    const d = (data ?? {}) as Record<string, unknown>
    return { ok: true, value: { classId: String(d.class_id), alreadyMember: d.already_member === true } }
  } catch (e) { return { ok: false, message: scErrorText((e as Error).message) } }
}

// ── Lối vào HỌC của lớp (RPC class_learning_entry): khoá chính + quyền học (server) · Giáo trình lớp báo riêng.
export type LearningEntry = {
  course: { id: string; code: string | null; name: string; hasAccess: boolean } | null
  curriculum: { published: boolean; hasAccess: boolean }
}
export async function fetchLearningEntry(classId: string): Promise<Result<LearningEntry>> {
  try {
    const { data, error } = await (await db()).rpc('class_learning_entry', { p_class: classId })
    if (error) { warn('learning_entry', error); return { ok: false, message: scErrorText(error.message) } }
    const d = (data ?? {}) as { course?: { id: string; code: string | null; name: string; has_access: boolean } | null; curriculum?: { published: boolean; has_access: boolean } }
    return { ok: true, value: {
      course: d.course ? { id: d.course.id, code: d.course.code, name: d.course.name, hasAccess: d.course.has_access === true } : null,
      curriculum: { published: d.curriculum?.published === true, hasAccess: d.curriculum?.has_access === true },
    } }
  } catch (e) { return { ok: false, message: scErrorText((e as Error).message) } }
}

/**
 * Tab "Lớp" trên Home: hoạt động học tập của MỌI lớp mình thuộc — ghép các trang social_class_activity (server lọc
 * quyền từng lớp) theo CÙNG con trỏ, sắp như server (sort_at ↓, sort_key ↓), lấy đúng một trang. Không backend mới.
 */
export async function fetchMyClassesActivityPage(classIds: string[], cursor?: { createdAt: string; key: string }): Promise<Result<{ posts: FeedEntry[]; hasMore: boolean }>> {
  if (classIds.length === 0) return { ok: true, value: { posts: [], hasMore: false } }
  const pages = await Promise.all(classIds.map(id => fetchClassActivityPage(id, cursor)))
  const bad = pages.find(p => !p.ok)
  if (bad && !bad.ok && pages.every(p => !p.ok)) return bad
  const key = entryKey
  const seen = new Set<string>()
  const all = pages.flatMap(p => (p.ok ? p.value.posts : []))
    .filter(e => { const k = key(e); if (seen.has(k)) return false; seen.add(k); return true })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : key(a) < key(b) ? 1 : key(a) > key(b) ? -1 : 0))
  return { ok: true, value: { posts: all.slice(0, FEED_PAGE), hasMore: all.length > FEED_PAGE || pages.some(p => p.ok && p.value.hasMore) } }
}
