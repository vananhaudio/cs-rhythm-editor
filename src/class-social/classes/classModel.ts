// Lớp học trong /me — domain THUẦN (test được). Lớp = class_schedule (không hệ lớp thứ hai).
// Dữ liệu từ RPC social_my_classes / social_discover_classes / social_class_detail: CHỈ phần công khai
// (không zoom_url, giá, metadata, email/SĐT). Thành viên lớp do server quyết (nhóm cohort / nhóm mã lớp).
import { safeImageUrl } from '../media/safeImageUrl'
import { toRelationship, type Relationship } from '../friends/friendModel'

export type ClassCard = {
  id: string
  code: string | null
  name: string
  status: string | null
  programCode: string | null
  stage: string | null
  startDate: string | null
  endDate: string | null
  schedule: string | null
  course: { code: string | null; name: string | null; track: string | null } | null
  memberCount: number
  teachers: { userId: string; name: string; avatarUrl: string | null }[]
  activityCount: number
  lastActivityAt: string | null
  isMember: boolean
  canViewMembers: boolean
}

type J = Record<string, unknown>
const obj = (v: unknown): J => (v && typeof v === 'object' && !Array.isArray(v) ? v as J : {})
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

export function toClassCard(v: unknown): ClassCard | null {
  const o = obj(v)
  if (!str(o.id)) return null
  const c = o.course ? obj(o.course) : null
  return {
    id: o.id as string,
    code: str(o.code),
    name: str(o.name) ?? str(o.code) ?? 'Lớp học',
    status: str(o.status),
    programCode: str(o.program_code),
    stage: str(o.stage),
    startDate: str(o.start_date),
    endDate: str(o.end_date),
    schedule: str(o.schedule),
    course: c ? { code: str(c.code), name: str(c.name), track: str(c.track) } : null,
    memberCount: num(o.member_count),
    teachers: (Array.isArray(o.teachers) ? o.teachers : []).map(obj).filter(t => str(t.user_id))
      .map(t => ({ userId: t.user_id as string, name: str(t.name) ?? 'Thầy', avatarUrl: safeImageUrl(str(t.avatar_url)) })),
    activityCount: num(o.activity_count),
    lastActivityAt: str(o.last_activity_at),
    isMember: o.is_member === true,
    canViewMembers: o.can_view_members === true,
  }
}

export const toClassCards = (rows: unknown): ClassCard[] =>
  (Array.isArray(rows) ? rows : []).map(toClassCard).filter((c): c is ClassCard => !!c)

const STATUS_LABEL: Record<string, string> = {
  recruiting: 'Đang tuyển sinh', ready_to_open: 'Sắp khai giảng', scheduled: 'Đã lên lịch', upcoming: 'Sắp khai giảng',
  active: 'Đang học', ending_soon: 'Sắp kết thúc', completed: 'Đã kết thúc', paused: 'Tạm dừng',
}
export const classStatusLabel = (s: string | null): string | null => (s ? STATUS_LABEL[s] ?? null : null)

/**
 * Tên NGƯỜI ĐỌC ĐƯỢC cho menu (chỉ trình bày — không đổi tên gốc trong DB):
 *   "Hành trình 2027 — 40 buổi thực hành"   → "Hành trình 2027"
 *   "Khởi đầu đam mê khóa 17 - KD17"        → "Khởi đầu đam mê khóa 17"
 *   "Solo Guitar Căn Bản"                    → giữ nguyên
 * Cắt tại dấu gạch ngăn cách đầu tiên (—, –, " - ") nếu phần đầu đủ nghĩa (≥ 6 ký tự, không phải mã lớp).
 * Không bao giờ trả MÃ lớp nếu có tên; tên quá dài → CSS tự cắt "…".
 */
export function classShortName(c: Pick<ClassCard, 'name' | 'code'>): string {
  const name = (c.name ?? '').trim()
  if (!name) return c.code ?? 'Lớp học'
  const m = /^(.+?)\s*(?:—|–|\s-\s)\s*(.+)$/.exec(name)
  if (m) {
    const head = m[1].trim()
    const looksLikeCode = !!c.code && head.toUpperCase() === c.code.toUpperCase()
    if (head.length >= 6 && !looksLikeCode) return head
  }
  return name
}

/** Tooltip / dòng phụ: tên đầy đủ (+ mã lớp) — mã lớp chỉ là metadata nhỏ. */
export function classFullTitle(c: Pick<ClassCard, 'name' | 'code'>): string {
  return c.code && !c.name.toUpperCase().includes(c.code.toUpperCase()) ? `${c.name} · ${c.code}` : c.name
}

/** Dòng phụ CHO NGƯỜI ĐỌC: lịch học · khoá (không đưa mã lớp/mã khoá lên trước). */
export function classMetaLine(c: ClassCard): string {
  return [c.schedule, c.course?.name].filter(Boolean).join(' · ')
}

/** Metadata kỹ thuật (mã lớp · mã khoá) — hiện nhỏ, cuối cùng. */
export function classCodeNote(c: ClassCard): string | null {
  return [c.code, c.course?.code].filter(Boolean).join(' · ') || null
}

export function filterClasses(list: ClassCard[], q: string): ClassCard[] {
  const n = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
  const k = n(q.trim())
  if (!k) return list
  return list.filter(c => n([c.name, c.code, c.course?.name, c.programCode].filter(Boolean).join(' ')).includes(k))
}

// ── Thành viên lớp (RPC social_class_members — chỉ thành viên lớp + Thầy gọi được) ──
export type ClassMember = { userId: string; name: string; avatarUrl: string | null; isTeacher: boolean; relationship: Relationship }
export type ClassMemberRow = { user_id: string; name: string | null; avatar_url: string | null; role: string | null; relationship: string | null }

export function toClassMembers(rows: ClassMemberRow[] | null | undefined): ClassMember[] {
  return (rows ?? []).filter(r => !!r?.user_id).map(r => ({
    userId: r.user_id,
    name: (r.name ?? '').trim() || 'Thành viên Class',
    avatarUrl: safeImageUrl(r.avatar_url),
    isTeacher: r.role === 'teacher',
    relationship: toRelationship(r.relationship),
  }))
}

/** Nút/nhãn quan hệ gọn trong danh sách thành viên (flow Bạn bè sẵn có). */
export function memberRelationUi(r: Relationship): { label: string; action: 'send' | 'accept' | null } {
  switch (r) {
    case 'self': return { label: 'Bạn', action: null }
    case 'friends': return { label: 'Bạn bè', action: null }
    case 'outgoing': return { label: 'Đã gửi lời mời', action: null }
    case 'incoming': return { label: 'Chấp nhận', action: 'accept' }
    default: return { label: 'Kết bạn', action: 'send' }
  }
}

export const SC_ERROR_TEXT: Record<string, string> = {
  SC_NOT_MEMBER: 'Tài khoản của bạn chưa thuộc Class.',
  SC_NOT_FOUND: 'Không tìm thấy lớp này (có thể lớp đã kết thúc hoặc đã huỷ).',
  SC_MEMBERS_ONLY: 'Danh sách thành viên chỉ hiện với thành viên của lớp.',
  JOIN_INVALID: 'Mã lớp không đúng hoặc đã hết hiệu lực. Kiểm tra lại mã Thầy gửi nhé.',
  JOIN_CLOSED: 'Lớp này đã kết thúc hoặc không còn nhận học viên.',
  JOIN_NO_PROFILE: 'Tài khoản của bạn chưa có hồ sơ học viên. Liên hệ Thầy để được hỗ trợ.',
  JOIN_REMOVED: 'Bạn đã được Thầy chuyển khỏi lớp này. Liên hệ Thầy nếu cần vào lại.',
  JOIN_NOT_AUTHENTICATED: 'Đăng nhập để tham gia lớp.',
}
export function scErrorText(msg: string | undefined): string {
  const k = Object.keys(SC_ERROR_TEXT).find(x => (msg ?? '').includes(x))
  if (k) return SC_ERROR_TEXT[k]
  if (/failed to fetch|network|load failed/i.test(msg ?? '')) return 'Không có kết nối mạng. Kiểm tra mạng rồi thử lại.'
  return 'Chưa tải được lớp học. Hãy thử lại.'
}
