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

/** Tên hiển thị ngắn trong sidebar: mã lớp nếu tên dài, ngược lại tên. */
export function classShortName(c: Pick<ClassCard, 'name' | 'code'>): string {
  return c.name.length <= 28 ? c.name : (c.code ?? c.name)
}

/** Dòng phụ: "DH2 · Đệm hát 2 · Thứ 3 · 20:00" */
export function classMetaLine(c: ClassCard): string {
  return [c.code && c.code !== c.name ? c.code : null, c.course?.name, c.schedule].filter(Boolean).join(' · ')
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
}
export function scErrorText(msg: string | undefined): string {
  const k = Object.keys(SC_ERROR_TEXT).find(x => (msg ?? '').includes(x))
  if (k) return SC_ERROR_TEXT[k]
  if (/failed to fetch|network|load failed/i.test(msg ?? '')) return 'Không có kết nối mạng. Kiểm tra mạng rồi thử lại.'
  return 'Chưa tải được lớp học. Hãy thử lại.'
}
