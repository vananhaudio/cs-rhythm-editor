// ── GIÁO TRÌNH CHUẨN (Golden Reference = SOLO01) — kiểm THUẦN cho mọi buổi soạn thêm ──
// Rút từ 5 buổi SOLO01 đã dạy thật (src/data/solo01/buoi01..05.ts = class_lesson_content production).
// Mục đích: buổi 06, 07… chỉ BỔ SUNG NỘI DUNG; không loại khối lạ, không đảo mạch, không trùng id bài trả.
// Dùng ở: test (tests/class-social/curriculum-standard.test.ts) + Admin trước khi Xuất bản. Xem docs/GIAO-TRINH-CHUAN.md.
import type { LessonDoc, LessonSection } from './lessonTypes'
import { checkpointAccepts, checkpointProblems, isCheckpoint } from './checkpoint'

/** Loại khối LessonDocument hiểu. Thêm loại mới = thêm CAPABILITY (renderer + app mới), không phải nội dung. */
export const KNOWN_SECTION_KINDS: LessonSection['kind'][] = [
  'objectives', 'recap', 'layers', 'note', 'strum', 'flow', 'fretboard', 'score', 'repertoire', 'assignment', 'checklist', 'studentNotes', 'study', 'checkpoint',
]

/** Đuôi buổi của SOLO01 — luôn kết thúc: Bài tập về nhà → Checklist cuối bài → Ghi chú cho thầy. */
export const SOLO01_TAIL: LessonSection['kind'][] = ['assignment', 'checklist', 'studentNotes']

/** Chuẩn Bài trả (03/10/2026): mỗi Nhịp kết thúc bằng một bài trả; kiểm kiến thức → trắc nghiệm tự chấm;
 *  thực hành tổng hợp → TỐI ĐA MỘT bài trả có video trong một buổi (Thầy chấm qua Learning Thread). */
export const SOLO01_MAX_VIDEO_CHECKPOINTS = 1

/** Kiểm một buổi theo chuẩn SOLO01. sessionNo = số buổi thật (để kiểm id bài trả "N.x"). Trả danh sách vấn đề (rỗng = đạt). */
export function solo01Problems(sections: LessonSection[], sessionNo: number): string[] {
  const out: string[] = []
  sections.forEach((s, i) => {
    if (!KNOWN_SECTION_KINDS.includes(s.kind)) out.push(`Phần #${i + 1}: loại "${String(s.kind)}" không có trong khuôn — dùng loại sẵn có`)
  })
  const body = sections.filter(s => !isCheckpoint(s)).map(s => s.kind)
  const head = body.slice(0, 3)
  if (!head.includes('objectives')) out.push('Thiếu "objectives" (Sau buổi này học viên làm được) ở đầu buổi')
  const tail = body.slice(-SOLO01_TAIL.length)
  if (tail.join('>') !== SOLO01_TAIL.join('>')) out.push(`Đuôi buổi phải là ${SOLO01_TAIL.join(' → ')} (đang là ${tail.join(' → ') || 'trống'})`)
  out.push(...checkpointProblems(sections))
  const lastBodyIdx = sections.findIndex(s => s.kind === 'checklist')
  sections.forEach((s, i) => {
    if (!isCheckpoint(s)) return
    if (typeof s.id === 'string' && !s.id.startsWith(`${sessionNo}.`)) out.push(`Bài trả ${s.id}: id nên bắt đầu bằng "${sessionNo}." (Buổi ${sessionNo})`)
    if (lastBodyIdx >= 0 && i > lastBodyIdx) out.push(`Bài trả ${s.id}: đặt TRONG mạch học (trước Checklist cuối bài), không đặt cuối trang`)
  })
  const videos = sections.filter(isCheckpoint).filter(cp => checkpointAccepts(cp).includes('video_link')).map(cp => cp.id)
  if (videos.length > SOLO01_MAX_VIDEO_CHECKPOINTS) {
    out.push(`Tối đa ${SOLO01_MAX_VIDEO_CHECKPOINTS} bài trả có video mỗi buổi (đang có ${videos.length}: ${videos.join(', ')}) — bài trả kiến thức dùng trắc nghiệm`)
  }
  return out
}

export function solo01DocProblems(doc: LessonDoc): string[] {
  const out = solo01Problems(doc.sections, doc.meta.sessionNo)
  // File TS viết 'SOLO-01' (nhãn hiển thị), DB/thread dùng 'SOLO01' (program_code) — cùng một chương trình.
  if (doc.meta.programCode.replace(/-/g, '') !== 'SOLO01') out.push(`programCode phải là SOLO01 (đang là "${doc.meta.programCode}")`)
  return out
}
