// Domain bạn bè — hàm THUẦN (không mạng/DOM) để test được.
// Quyền thật (ai xem được tường) do DB quyết (get_user_wall / RLS); ở đây chỉ dựng giao diện.
import { safeImageUrl } from '../media/safeImageUrl'

/** Quan hệ nhìn từ phía mình — khớp friendship_status() trên DB */
export type Relationship = 'self' | 'none' | 'outgoing' | 'incoming' | 'friends'

export function toRelationship(v: unknown): Relationship {
  return v === 'self' || v === 'outgoing' || v === 'incoming' || v === 'friends' ? v : 'none'
}

export type PersonCard = {
  userId: string
  name: string
  avatarUrl: string | null
  isTeacher: boolean
}

export type PublicProfile = PersonCard & {
  coverUrl: string | null
  relationship: Relationship
  /** DB đã quyết: chính mình | bạn bè | Thầy (kiểm duyệt) */
  canViewWall: boolean
}

type PersonRow = { user_id: string; name: string | null; avatar_url: string | null; role: string | null }

const person = (r: PersonRow): PersonCard => ({
  userId: r.user_id,
  name: (r.name ?? '').trim() || 'Thành viên Class',
  avatarUrl: safeImageUrl(r.avatar_url),
  isTeacher: r.role === 'teacher',
})

export type FriendRow = PersonRow & { cover_url?: string | null; since?: string | null }
export type RequestRow = PersonRow & { requested_at?: string | null }
export type ProfileRow = PersonRow & { cover_url: string | null; relationship: string | null; can_view_wall: boolean | null }

export function toPeople(rows: PersonRow[] | null | undefined): PersonCard[] {
  return (rows ?? []).filter(r => !!r?.user_id).map(person)
}

export function toProfile(row: ProfileRow | null | undefined): PublicProfile | null {
  if (!row?.user_id) return null
  return {
    ...person(row),
    coverUrl: safeImageUrl(row.cover_url),
    relationship: toRelationship(row.relationship),
    canViewWall: row.can_view_wall === true,
  }
}

// ── Nút theo quan hệ (kiểu Facebook) ────────────────────────────────────────
export type FriendAction = 'send' | 'cancel' | 'accept' | 'decline' | 'unfriend'

export type RelationshipUi = {
  /** Nhãn trạng thái hiện cạnh nút (không phải nút) */
  status: string | null
  actions: { id: FriendAction; label: string; tone: 'primary' | 'ghost' | 'danger' }[]
}

export function relationshipUi(rel: Relationship): RelationshipUi {
  switch (rel) {
    case 'none':
      return { status: null, actions: [{ id: 'send', label: 'Kết bạn', tone: 'primary' }] }
    case 'outgoing':
      return { status: 'Đã gửi lời mời', actions: [{ id: 'cancel', label: 'Huỷ lời mời', tone: 'ghost' }] }
    case 'incoming':
      return {
        status: 'Đã gửi cho bạn lời mời kết bạn',
        actions: [{ id: 'accept', label: 'Chấp nhận', tone: 'primary' }, { id: 'decline', label: 'Từ chối', tone: 'ghost' }],
      }
    case 'friends':
      return { status: 'Bạn bè', actions: [{ id: 'unfriend', label: 'Huỷ kết bạn', tone: 'danger' }] }
    default:
      return { status: null, actions: [] }
  }
}

/** Lý do không thấy tường — hiện thay cho bài đăng (bài KHÔNG được tải về máy). */
export function lockedWallText(rel: Relationship, name: string): string {
  if (rel === 'outgoing') return `Khi ${name} chấp nhận lời mời, bạn sẽ xem được bài đăng trên trang này.`
  if (rel === 'incoming') return `Chấp nhận lời mời để xem bài đăng của ${name}.`
  return `Kết bạn với ${name} để xem bài đăng trên trang này.`
}
