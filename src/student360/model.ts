// Student 360° — logic hiển thị thuần (nhãn tiếng Việt, nhóm, trạng thái xác minh). Không phụ thuộc React/Supabase.
import type { Category, Fact, Origin, SourceKind, Verification, Visibility } from './types'

export const CATEGORY_ORDER: Category[] = ['goal', 'music_taste', 'difficulty', 'support_need', 'key_topic', 'commitment']
export const CATEGORY_LABEL: Record<Category, string> = {
  goal: 'Mục tiêu', music_taste: 'Sở thích âm nhạc', difficulty: 'Khó khăn khi học',
  support_need: 'Nhu cầu hỗ trợ', key_topic: 'Tương tác quan trọng', commitment: 'Cam kết / việc còn dang dở',
}

export const ORIGIN_LABEL: Record<Origin, string> = {
  self_reported: 'Học viên tự nêu', class_confirmed: 'Class xác nhận', inferred: 'Suy luận',
}
export const VERIFICATION_LABEL: Record<Verification, string> = {
  unverified: 'Chưa xác minh', student_confirmed: 'Học viên đã xác nhận', teacher_verified: 'Thầy đã xác minh',
}
export const SOURCE_LABEL: Record<SourceKind, string> = {
  student: 'Học viên', teacher: 'Giáo viên', class: 'Dữ liệu Class', crm_zalo: 'Lịch sử Zalo (CRM)', mira: 'Mira',
}
export const VISIBILITY_LABEL: Record<Visibility, string> = {
  teacher: 'Chỉ giáo viên thấy', student_and_teacher: 'Học viên cũng thấy',
}

// Suy luận KHÔNG bao giờ được trình bày như sự thật: luôn có chữ "Suy luận" kèm mức xác minh thực tế.
export function trustLine(f: Pick<Fact, 'origin' | 'verification'>): string {
  const v = VERIFICATION_LABEL[f.verification]
  return f.origin === 'inferred' ? `Suy luận · ${v}` : `${ORIGIN_LABEL[f.origin]} · ${v}`
}

export function isVerified(f: Pick<Fact, 'verification'>): boolean { return f.verification !== 'unverified' }

export interface FactGroup { category: Category; label: string; facts: Fact[] }

/** Nhóm theo danh mục (đúng thứ tự cố định), bỏ nhóm rỗng; trong nhóm: mới cập nhật trước, mục đã thu hồi xuống cuối. */
export function groupFacts(facts: Fact[]): FactGroup[] {
  return CATEGORY_ORDER.map(category => ({
    category, label: CATEGORY_LABEL[category],
    facts: facts.filter(f => f.category === category).sort((a, b) =>
      (a.status === 'revoked' ? 1 : 0) - (b.status === 'revoked' ? 1 : 0) || +new Date(b.updated_at) - +new Date(a.updated_at)),
  })).filter(g => g.facts.length > 0)
}

export function actionLabel(action: string): string {
  const map: Record<string, string> = {
    create: 'Tạo mục', edit: 'Sửa nội dung', revoke: 'Thu hồi', revoke_by_source: 'Thu hồi theo nguồn',
    'verify:teacher_verified': 'Thầy xác minh', 'verify:student_confirmed': 'Học viên xác nhận', 'verify:unverified': 'Bỏ xác minh',
    'visibility:student_and_teacher': 'Cho học viên xem', 'visibility:teacher': 'Chuyển về chỉ giáo viên',
  }
  return map[action] ?? action
}

/** Cách Thầy thêm mục: gắn đúng nguồn/loại thông tin, không có lựa chọn nào tự thành "đã xác minh". */
export const ADD_MODES = [
  { key: 'told', label: 'Học viên nói với Thầy', origin: 'self_reported', sourceKind: 'teacher' },
  { key: 'observed', label: 'Thầy ghi nhận trong Class', origin: 'class_confirmed', sourceKind: 'teacher' },
  { key: 'guess', label: 'Thầy suy đoán (chưa chắc)', origin: 'inferred', sourceKind: 'teacher' },
] as const satisfies readonly { key: string; label: string; origin: Origin; sourceKind: SourceKind }[]
export type AddModeKey = typeof ADD_MODES[number]['key']

export const MAX_CONTENT = 500

export function fmtVN(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(+d) ? '' : d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function fmtDateVN(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(+d) ? '' : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })
}
