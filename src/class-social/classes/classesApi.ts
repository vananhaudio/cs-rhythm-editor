// Lớp học trong /me — CHỈ qua RPC đọc (social_*). Không query thẳng edu_group_members/class_schedule
// (membership + dữ liệu nhạy cảm do server lọc). Client không gửi learner/membership.
import type { Result } from '../posts/postsApi'
import { toFeedEntries, type FeedEntry, type MixedRow } from '../posts/postModel'
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
