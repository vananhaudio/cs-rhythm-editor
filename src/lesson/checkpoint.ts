// Bài trả (checkpoint) trong giáo trình — logic THUẦN dùng chung cho renderer, màn học /me và script kiểm giáo trình.
// Định nghĩa canonical nằm trong blocks của class_lesson_content; server (cl_session_checkpoints) đọc cùng luật này.
import type { CheckpointAccept, CheckpointSection, LessonSection } from './lessonTypes'

export const CHECKPOINT_ID_RE = /^[0-9A-Za-z][0-9A-Za-z._-]{0,15}$/
export const DEFAULT_ACCEPTS: CheckpointAccept[] = ['text', 'video_link']
/** Loại nộp V1 chạy được thật (hạ tầng hiện có). Loại khác: hiển thị nhưng chưa nhận bài — không giả chức năng. */
export const SUPPORTED_ACCEPTS: CheckpointAccept[] = ['text', 'video_link']

const ACCEPT_LABEL: Record<CheckpointAccept, string> = {
  text: 'văn bản', video_link: 'link video', image: 'hình ảnh', audio: 'âm thanh', quiz: 'trắc nghiệm', interaction: 'thao tác trong giáo trình',
}

export function checkpointAccepts(cp: Pick<CheckpointSection, 'accepts'>): CheckpointAccept[] {
  return Array.isArray(cp.accepts) && cp.accepts.length ? cp.accepts : DEFAULT_ACCEPTS
}

export function checkpointAcceptsLabel(accepts: CheckpointSection['accepts']): string {
  return checkpointAccepts({ accepts }).map(a => ACCEPT_LABEL[a] ?? a).join(', ')
}

/** Học viên nộp được bằng gì ở V1: chữ (ghi chú/bài viết) và/hoặc link video. */
export function submitModes(cp: Pick<CheckpointSection, 'accepts'>): { text: boolean; video: boolean; supported: boolean } {
  const a = checkpointAccepts(cp)
  const text = a.includes('text'), video = a.includes('video_link')
  return { text, video, supported: text || video }
}

export const isCheckpoint = (s: LessonSection): s is CheckpointSection => s.kind === 'checkpoint'

/** Kiểm checkpoint của MỘT buổi (Admin/script): id hợp lệ, không trùng, có tiêu đề, accepts thuộc danh sách. */
export function checkpointProblems(sections: LessonSection[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const known = new Set<string>(Object.keys(ACCEPT_LABEL))
  sections.filter(isCheckpoint).forEach((cp, i) => {
    const where = `Bài trả #${i + 1}${cp.id ? ` (${cp.id})` : ''}`
    if (typeof cp.id !== 'string' || !CHECKPOINT_ID_RE.test(cp.id)) out.push(`${where}: id không hợp lệ (ví dụ đúng: "4.1")`)
    else if (seen.has(cp.id)) out.push(`${where}: id bị trùng trong buổi`)
    else seen.add(cp.id)
    if (typeof cp.title !== 'string' || !cp.title.trim()) out.push(`${where}: thiếu tiêu đề`)
    if (cp.required !== undefined && typeof cp.required !== 'boolean') out.push(`${where}: required phải là true/false`)
    if (cp.accepts !== undefined && (!Array.isArray(cp.accepts) || cp.accepts.some(a => !known.has(a)))) out.push(`${where}: accepts có loại lạ`)
  })
  return out
}

// ── KHUNG XEM TRƯỚC "TRẢ BÀI" (CHỈ giáo viên/admin, CHỈ khi buổi chưa có bài trả thật) ──
// Trạng thái RỖNG / REVIEW giao diện — KHÔNG phải checkpoint: không lưu DB, không gọi RPC, không tạo thread/tiến độ,
// không in. Bài trả THẬT luôn hiện ĐÚNG VỊ TRÍ đặt trong giáo án, không gom xuống cuối như khung này.
export const PREVIEW_CHECKPOINT: CheckpointSection = {
  kind: 'checkpoint', id: 'xem-truoc', preview: true, title: 'Trả bài',
  prompt: 'Khi giáo án có bài trả, nút trả bài sẽ xuất hiện ngay tại vị trí được đặt trong bài học.',
}

export function withTeacherPreview(sections: LessonSection[], role: 'learner' | 'teacher'): LessonSection[] {
  if (role !== 'teacher' || sections.some(x => x.kind === 'checkpoint')) return sections
  return [...sections, PREVIEW_CHECKPOINT]
}
