// Trạng thái HỌC của một lớp — dùng chung cho Trang Lớp (bản đồ) và Trang Buổi (phòng học).
// Nguồn (không migration, không nới quyền):
//   • class_learning_state (RPC): lớp có checkpoint → chế độ checkpoint (server mở/khoá buổi, tiến độ, trả bài).
//   • fetchClassOutline (RLS sẵn có): chỉ chặng + buổi + TRẠNG THÁI giáo án (session_id, status) — KHÔNG tải blocks
//     của 24 buổi. Có giáo trình đọc được (HAS_CURRICULUM) → chế độ giáo trình (chỉ xem).
//   • social_class_detail: tên lớp / mã chương trình cho header.
// Không đọc được giáo trình nào → learn = null (Trang Lớp cũ; Trang Buổi báo không có quyền, không lộ nội dung).
import { useMemo } from 'react'
import { fetchClassDetail } from './classesApi'
import type { ClassCard } from './classModel'
import { fetchClassLearningState } from '../../classLearning/progressApi'
import { curriculumState, type ClassLearningState } from '../../classLearning/progress'
import { fetchClassOutline, type ClassOutlineData } from '../../classLearning/api'
import { useSwrLoad } from '../swr/useSwrLoad'

export type Load<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; value: T }
export type LearnReady = Extract<ClassLearningState, { enabled: true }>

export function useClassLearning(classId: string, isTeacher: boolean) {
  // Dữ liệu lớp đã mở một lần → lần sau hiện NGAY từ bộ đệm SWR, đồng thời hỏi lại server ở nền (xem swr/useSwrLoad).
  const det = useSwrLoad<ClassCard>(`class:${classId}:detail`, () => fetchClassDetail(classId))
  const detail: Load<ClassCard> = det.state
  const rs = useSwrLoad<ClassLearningState>(`class:${classId}:learning`, () => fetchClassLearningState(classId))
  const reload = rs.reload   // chỉ nạp lại trạng thái học (như trước)
  const rpc: ClassLearningState | 'loading' | 'off' = rs.state.status === 'ready' ? rs.state.value : rs.state.status === 'error' ? 'off' : 'loading'

  const ol = useSwrLoad<ClassOutlineData>(`class:${classId}:outline`, () =>
    import('../../supabase').then(({ supabase }) => fetchClassOutline(supabase, classId))
      .then((o): { ok: true; value: ClassOutlineData } => ({ ok: true, value: o }),
        (): { ok: false; message: string } => ({ ok: false, message: 'outline' })))
  const outline: ClassOutlineData | 'loading' | 'off' = ol.state.status === 'ready' ? ol.state.value : ol.state.status === 'error' ? 'off' : 'loading'

  const checkpointReady = rpc !== 'loading' && rpc !== 'off' && rpc.enabled ? rpc : null
  const curriculumReady = useMemo(() => (!checkpointReady && rpc !== 'loading' && outline !== 'loading' && outline !== 'off' && detail.status === 'ready'
    ? curriculumState({ classId, programCode: detail.value.programCode, classCode: detail.value.code, className: detail.value.name,
        role: isTeacher ? 'teacher' : 'learner', ...outline })
    : null), [checkpointReady, rpc, outline, detail, classId, isTeacher])
  const learn: LearnReady | null = checkpointReady ?? curriculumReady
  const loading = rpc === 'loading' || outline === 'loading' || detail.status === 'loading'
  return { detail, learn, loading, reload }
}

// Bấm một BÀI TRẢ chưa trả trên Mục lục → Trang Buổi mở rồi đưa ĐÚNG khối bài trả đó vào màn hình (một lần, 2 phút).
// Vào lớp KHÔNG tự cuộn (con đường cố định: lần đầu = lần thứ 20 đều thấy mục lục từ đầu).
const FOCUS_KEY = (classId: string) => `csCheckpointFocus:${classId}`
const FOCUS_TTL_MS = 2 * 60_000
export function rememberCheckpointFocus(classId: string, sessionNo: number, checkpointId: string) {
  try { sessionStorage.setItem(FOCUS_KEY(classId), JSON.stringify({ no: sessionNo, cp: checkpointId, at: Date.now() })) } catch { /* bỏ qua */ }
}
export function takeCheckpointFocus(classId: string, sessionNo: number): string | null {
  try {
    const raw = sessionStorage.getItem(FOCUS_KEY(classId))
    sessionStorage.removeItem(FOCUS_KEY(classId))
    const v = raw ? JSON.parse(raw) as { no: number; cp: string; at: number } : null
    return v && v.no === sessionNo && typeof v.cp === 'string' && Date.now() - v.at < FOCUS_TTL_MS ? v.cp : null
  } catch { return null }
}
