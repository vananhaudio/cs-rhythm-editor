// Lớp của tôi V1 — gọi RPC class_learning_state (server đồng bộ lười tiến độ: mở Buổi 1 lần đầu, mở buổi kế đã xuất bản).
// Người học / quyền / buổi mở do SERVER quyết từ auth.uid(); client chỉ gửi id lớp.
import { toClassLearningState, type ClassLearningState } from './progress'
import { ltErrorText, type Visibility } from '../learning-thread/ltModel'
import { mediaParams } from '../learning-thread/ltApi'

export type Result<T> = { ok: true; value: T } | { ok: false; message: string }

const db = () => import('../supabase').then(m => m.supabase)

export async function fetchClassLearningState(classId: string): Promise<Result<ClassLearningState>> {
  try {
    const { data, error, status } = await (await db()).rpc('class_learning_state', { p_class: classId })
    if (error) {
      // Hàm chưa có trên server (chưa migration) → coi như lớp chưa bật V1: giữ nguyên trang lớp cũ.
      if (error.code === 'PGRST202' || (status === 404 && /class_learning_state/.test(error.message ?? ''))) return { ok: true, value: { enabled: false, classId } }
      if (import.meta.env?.DEV) console.warn('[class-learning] state:', error.code, error.message)
      return { ok: false, message: ltErrorText({ ...error, status }) }
    }
    return { ok: true, value: toClassLearningState(data, classId) }
  } catch (e) {
    return { ok: false, message: ltErrorText(e as Error) }
  }
}

/** Trả bài tại một CHECKPOINT của giáo trình lớp. Client chỉ gửi TOẠ ĐỘ (lớp · buổi · id checkpoint) + nội dung.
 *  Server tự kiểm: người gọi thuộc lớp + có quyền giáo trình, buổi đã mở với chính họ, checkpoint có thật trong blocks
 *  canonical, loại nộp; tự đóng dấu lớp/buổi/checkpoint/danh tính. Không gửi learner / vai trò / danh tính. */
export async function submitCheckpoint(input: {
  classId: string; sessionNo: number; checkpointId: string; body: string; mediaUrl: string; visibility?: Visibility
}): Promise<Result<{ threadId: string }>> {
  const m = mediaParams(input.mediaUrl)
  if (!m.ok) return m
  try {
    const { data, error, status } = await (await db()).rpc('lt_submit_checkpoint', {
      p_class: input.classId, p_session_no: input.sessionNo, p_checkpoint_id: input.checkpointId, p_body: input.body,
      ...m.value, p_visibility: input.visibility ?? null,
    })
    if (error || !data) {
      if (import.meta.env?.DEV && error) console.warn('[class-learning] submit:', error.code, error.message)
      return { ok: false, message: ltErrorText(error ? { ...error, status } : null) }
    }
    return { ok: true, value: { threadId: data as string } }
  } catch (e) {
    return { ok: false, message: ltErrorText(e as Error) }
  }
}
