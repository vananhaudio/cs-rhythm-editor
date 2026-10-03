// Bài trả (checkpoint) trong giáo trình — logic THUẦN dùng chung cho renderer, màn học /me và script kiểm giáo trình.
// Định nghĩa canonical nằm trong blocks của class_lesson_content; server (cl_session_checkpoints) đọc cùng luật này.
import type { CheckpointAccept, CheckpointQuiz, CheckpointSection, LessonSection } from './lessonTypes'

export const CHECKPOINT_ID_RE = /^[0-9A-Za-z][0-9A-Za-z._-]{0,15}$/
export const DEFAULT_ACCEPTS: CheckpointAccept[] = ['text', 'video_link']
/** Loại nộp chạy được thật qua Learning Thread (Thầy chấm). Trắc nghiệm ('quiz') đi đường riêng: quizOf(). */
export const SUPPORTED_ACCEPTS: CheckpointAccept[] = ['text', 'video_link']
export const QUIZ_OPTION_ID_RE = /^[0-9A-Za-z][0-9A-Za-z_-]{0,15}$/
/** Khoá KHÔNG được có trong khối trắc nghiệm công khai (chặn lỡ tay dán đáp án vào giáo án). */
const QUIZ_FORBIDDEN_KEYS = ['correct', 'answer', 'answers', 'key', 'isCorrect', 'is_correct', 'right']

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
    const isQuiz = Array.isArray(cp.accepts) && cp.accepts.includes('quiz')
    if (isQuiz && cp.accepts!.length !== 1) out.push(`${where}: trắc nghiệm không trộn với loại nộp khác (accepts phải đúng ['quiz'])`)
    if (cp.quiz !== undefined && !isQuiz) out.push(`${where}: có câu trắc nghiệm nhưng accepts thiếu 'quiz'`)
    if (isQuiz || cp.quiz !== undefined) out.push(...quizProblems(cp.quiz).map(p => `${where}: ${p}`))
  })
  return out
}

/** Kiểm MỘT câu trắc nghiệm công khai: câu hỏi · ≥ 2 lựa chọn · id lựa chọn hợp lệ, không trùng · mode · KHÔNG chứa đáp án. */
export function quizProblems(q: unknown): string[] {
  const out: string[] = []
  if (!q || typeof q !== 'object' || Array.isArray(q)) return ['trắc nghiệm thiếu câu hỏi (quiz)']
  const z = q as Record<string, unknown>
  if (z.mode !== 'single' && z.mode !== 'multiple') out.push("trắc nghiệm: mode phải là 'single' hoặc 'multiple'")
  if (typeof z.question !== 'string' || !z.question.trim()) out.push('trắc nghiệm: thiếu câu hỏi')
  if (z.hint !== undefined && typeof z.hint !== 'string') out.push('trắc nghiệm: hint phải là chữ')
  const opts = Array.isArray(z.options) ? z.options : null
  if (!opts || opts.length < 2) out.push('trắc nghiệm: cần ít nhất 2 lựa chọn')
  const ids = new Set<string>()
  for (const [i, o] of (opts ?? []).entries()) {
    const r = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>
    if (typeof r.id !== 'string' || !QUIZ_OPTION_ID_RE.test(r.id)) out.push(`trắc nghiệm: lựa chọn #${i + 1} id không hợp lệ`)
    else if (ids.has(r.id)) out.push(`trắc nghiệm: id lựa chọn "${r.id}" bị trùng`)
    else ids.add(r.id)
    if (typeof r.text !== 'string' || !r.text.trim()) out.push(`trắc nghiệm: lựa chọn #${i + 1} thiếu nội dung`)
    if (QUIZ_FORBIDDEN_KEYS.some(k => k in r)) out.push(`trắc nghiệm: lựa chọn #${i + 1} chứa ĐÁP ÁN — đáp án chỉ ở server`)
  }
  if (QUIZ_FORBIDDEN_KEYS.some(k => k in z)) out.push('trắc nghiệm: chứa ĐÁP ÁN — đáp án chỉ ở server')
  return out
}

/** Câu trắc nghiệm DÙNG ĐƯỢC của checkpoint (accepts đúng ['quiz'] + câu hợp lệ), ngược lại null → hiện như chưa hỗ trợ. */
export function quizOf(cp: Pick<CheckpointSection, 'accepts' | 'quiz'>): CheckpointQuiz | null {
  if (!Array.isArray(cp.accepts) || cp.accepts.length !== 1 || cp.accepts[0] !== 'quiz') return null
  return quizProblems(cp.quiz).length ? null : cp.quiz!
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
