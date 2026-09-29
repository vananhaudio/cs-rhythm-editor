// Gọi RPC Learning Thread (lt_*). Người học / Thầy / danh tính học tập KHÔNG gửi từ client:
// server tự lấy auth.uid(), tự kiểm quyền (cấu hình bài, quyền mở bài, vai trò) và tự đóng dấu danh tính.
import type { ResourceRef } from '../class-social/comments/commentModel'
import { toResourcePayload } from '../class-social/comments/commentModel'
import { parseExternalMedia } from '../class-social/media/parseExternalMedia'
import {
  ltErrorText, toLessonState, toMyThread, toQueueItem, toThreadDetail,
  type LessonStateRow, type LessonThreadState, type MyThread, type MyThreadRow, type QueueItem, type QueueRow,
  type StudentKind, type TeacherKind, type ThreadDetail, type ThreadStatus, type Verdict, type Visibility,
} from './ltModel'
import { toJourneyItem, type JourneyItem, type JourneyRow } from './feedModel'

export type Result<T> = { ok: true; value: T } | { ok: false; message: string }

// Nạp client Supabase khi GỌI (không lúc import) → component soạn/hiển thị render được trong test Node.
const db = () => import('../supabase').then(m => m.supabase)

const online = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)
const fail = <T>(what: string, e: { message?: string; code?: string } | null, status?: number): Result<T> => {
  if (import.meta.env?.DEV && e) console.warn(`[learning-thread] ${what}:`, e.code, e.message)
  return { ok: false, message: ltErrorText(e ? { ...e, status } : null, online()) }
}

/** Cấu hình Trả/Hỏi bài + thread đang mở CỦA MÌNH cho các bài (tối đa 500). */
export async function fetchLessonStates(lessonIds: string[]): Promise<Result<Map<string, LessonThreadState>>> {
  const ids = [...new Set(lessonIds)].slice(0, 500)
  if (ids.length === 0) return { ok: true, value: new Map() }
  try {
    const { data, error, status } = await (await db()).rpc('lt_lessons_state', { p_lesson_ids: ids })
    if (error) return fail('lessons_state', error, status)
    const map = new Map<string, LessonThreadState>()
    for (const r of (data ?? []) as LessonStateRow[]) map.set(r.lesson_id, toLessonState(r))
    return { ok: true, value: map }
  } catch (e) {
    return fail('lessons_state', e as Error)
  }
}

/** Media link ngoài → tham số RPC (cùng bộ chuẩn hoá với Social). Link sai → lỗi, không gửi. */
export function mediaParams(url: string): Result<{ p_media_url: string | null; p_media_provider: string | null; p_external_media_id: string | null }> {
  if (!url.trim()) return { ok: true, value: { p_media_url: null, p_media_provider: null, p_external_media_id: null } }
  const r = parseExternalMedia(url)
  if (!r.ok) return { ok: false, message: 'Liên kết video chưa đúng. Hãy sao chép lại liên kết.' }
  return { ok: true, value: { p_media_url: r.media.canonicalUrl, p_media_provider: r.media.provider, p_external_media_id: r.media.externalId ?? null } }
}

export async function submitStudentEvent(input: {
  lessonId: string; kind: StudentKind; body: string; mediaUrl: string; visibility?: Visibility
}): Promise<Result<{ threadId: string }>> {
  const m = mediaParams(input.mediaUrl)
  if (!m.ok) return m
  try {
    const { data, error, status } = await (await db()).rpc('lt_submit', {
      p_lesson_id: input.lessonId, p_kind: input.kind, p_body: input.body, ...m.value,
      p_visibility: input.visibility ?? null,
    })
    if (error || !data) return fail('submit', error, status)
    return { ok: true, value: { threadId: data as string } }
  } catch (e) {
    return fail('submit', e as Error)
  }
}

export async function respondAsTeacher(input: {
  threadId: string; kind: TeacherKind; body: string; verdict: Verdict | null; mediaUrl: string; tagIds: number[]; resources: ResourceRef[]
}): Promise<Result<{ eventId: string }>> {
  const m = mediaParams(input.mediaUrl)
  if (!m.ok) return m
  try {
    const { data, error, status } = await (await db()).rpc('lt_respond', {
      p_thread_id: input.threadId, p_kind: input.kind, p_body: input.body, p_verdict: input.verdict,
      p_tag_ids: input.tagIds, p_resources: toResourcePayload(input.resources), ...m.value,
    })
    if (error || !data) return fail('respond', error, status)
    return { ok: true, value: { eventId: data as string } }
  } catch (e) {
    return fail('respond', e as Error)
  }
}

export async function fetchThread(threadId: string): Promise<Result<ThreadDetail>> {
  try {
    const { data, error, status } = await (await db()).rpc('lt_detail', { p_thread_id: threadId })
    if (error) return fail('detail', error, status)
    const t = toThreadDetail(data)
    return t ? { ok: true, value: t } : { ok: false, message: ltErrorText({ message: 'LT_NOT_FOUND' }) }
  } catch (e) {
    return fail('detail', e as Error)
  }
}

export async function setVisibility(threadId: string, visibility: Visibility): Promise<Result<null>> {
  try {
    const { error, status } = await (await db()).rpc('lt_set_visibility', { p_thread_id: threadId, p_visibility: visibility })
    if (error) return fail('visibility', error, status)
    return { ok: true, value: null }
  } catch (e) {
    return fail('visibility', e as Error)
  }
}

export const QUEUE_PAGE = 30

export async function fetchTeacherQueue(status: ThreadStatus | null, after?: { at: string; id: string }): Promise<Result<{ items: QueueItem[]; hasMore: boolean }>> {
  try {
    const { data, error, status: http } = await (await db()).rpc('lt_teacher_queue', {
      p_status: status, p_after: after?.at ?? null, p_after_id: after?.id ?? null, p_limit: QUEUE_PAGE,
    })
    if (error) return fail('queue', error, http)
    const rows = (data ?? []) as QueueRow[]
    return { ok: true, value: { items: rows.map(toQueueItem).filter((x): x is QueueItem => !!x), hasMore: rows.length === QUEUE_PAGE } }
  } catch (e) {
    return fail('queue', e as Error)
  }
}

export async function fetchMyThreads(limit = 20): Promise<Result<MyThread[]>> {
  try {
    const { data, error, status } = await (await db()).rpc('lt_my_threads', { p_before: null, p_before_id: null, p_limit: limit })
    if (error) return fail('my_threads', error, status)
    return { ok: true, value: ((data ?? []) as MyThreadRow[]).map(toMyThread).filter((x): x is MyThread => !!x) }
  } catch (e) {
    return fail('my_threads', e as Error)
  }
}

/** Hành trình (P2): mọi thread của một người theo quyền server (chính chủ/Thầy: tất cả; người khác: community). */
export async function fetchJourney(userId: string): Promise<Result<JourneyItem[]>> {
  try {
    const { data, error, status } = await (await db()).rpc('learning_journey', { p_user: userId })
    if (error) return fail('journey', error, status)
    return { ok: true, value: ((data ?? []) as JourneyRow[]).map(toJourneyItem).filter((x): x is JourneyItem => !!x) }
  } catch (e) {
    return fail('journey', e as Error)
  }
}

export async function moderate(kind: 'thread' | 'event', id: string, hidden: boolean): Promise<Result<null>> {
  try {
    const { error, status } = await (await db()).rpc('lt_moderate', { p_kind: kind, p_id: id, p_hidden: hidden })
    if (error) return fail('moderate', error, status)
    return { ok: true, value: null }
  } catch (e) {
    return fail('moderate', e as Error)
  }
}
