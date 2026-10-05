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
  /** Lời mời: lúc gửi · bạn bè: lúc thành bạn (nếu RPC trả) */
  at?: string | null
}

export type PublicProfile = PersonCard & {
  coverUrl: string | null
  relationship: Relationship
  /** DB đã quyết: chính mình | bạn bè | Thầy (kiểm duyệt) */
  canViewWall: boolean
}

type PersonRow = { user_id: string; name: string | null; avatar_url: string | null; role: string | null }

const person = (r: PersonRow & { requested_at?: string | null; since?: string | null }): PersonCard => ({
  userId: r.user_id,
  name: (r.name ?? '').trim() || 'Thành viên Class',
  avatarUrl: safeImageUrl(r.avatar_url),
  isTeacher: r.role === 'teacher',
  at: r.requested_at ?? r.since ?? null,
})

export type FriendRow = PersonRow & { cover_url?: string | null; since?: string | null }
export type RequestRow = PersonRow & { requested_at?: string | null }
export type ProfileRow = PersonRow & { cover_url: string | null; relationship: string | null; can_view_wall: boolean | null }

export function toPeople(rows: (PersonRow & { requested_at?: string | null; since?: string | null })[] | null | undefined): PersonCard[] {
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

// ── Danh sách trang Bạn bè: sửa ngay sau khi server xác nhận ─────────────────
export type PeopleList = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; items: PersonCard[] }

const byName = (a: PersonCard, b: PersonCard) => a.name.localeCompare(b.name, 'vi') || a.userId.localeCompare(b.userId)

export function patchList(list: PeopleList, fn: (xs: PersonCard[]) => PersonCard[]): PeopleList {
  return list.status === 'ready' ? { status: 'ready', items: fn(list.items) } : list
}
export const without = (id: string) => (xs: PersonCard[]) => xs.filter(x => x.userId !== id)
export const withPerson = (p: PersonCard) => (xs: PersonCard[]) => [...xs.filter(x => x.userId !== p.userId), p].sort(byName)

// ── Nút quan hệ trên trang cá nhân (mô hình Facebook) ──────────────────────
// NONE → [Kết bạn] làm ngay · OUTGOING → [Đã gửi lời mời ▾] Huỷ lời mời · INCOMING → [Phản hồi lời mời ▾] Xác nhận / Xóa lời mời
// · FRIENDS → [Bạn bè ▾] Huỷ kết bạn (luôn hỏi xác nhận). Mỗi trạng thái đúng MỘT nút — không có trạng thái lưng chừng.
export type FriendAction = 'send' | 'cancel' | 'accept' | 'decline' | 'unfriend'

export type RelationshipUi = {
  label: string
  tone: 'primary' | 'soft'
  /** Bấm nút là làm ngay (chỉ "Kết bạn"); null → mở menu */
  direct: FriendAction | null
  menu: { id: FriendAction; label: string; danger?: boolean }[]
}

export function relationshipUi(rel: Relationship): RelationshipUi | null {
  switch (rel) {
    case 'none':
      return { label: 'Kết bạn', tone: 'primary', direct: 'send', menu: [] }
    case 'outgoing':
      return { label: 'Đã gửi lời mời', tone: 'soft', direct: null, menu: [{ id: 'cancel', label: 'Huỷ lời mời' }] }
    case 'incoming':
      return {
        label: 'Phản hồi lời mời', tone: 'primary', direct: null,
        menu: [{ id: 'accept', label: 'Xác nhận' }, { id: 'decline', label: 'Xóa lời mời' }],
      }
    case 'friends':
      return { label: 'Bạn bè', tone: 'soft', direct: null, menu: [{ id: 'unfriend', label: 'Huỷ kết bạn', danger: true }] }
    default:
      return null
  }
}

/** Hành động nào phải hỏi lại trước khi gọi RPC */
export const needsConfirm = (a: FriendAction) => a === 'unfriend'

export function unfriendConfirm(name: string) {
  return {
    title: `Huỷ kết bạn với ${name}?`,
    body: `${name} sẽ không còn trong danh sách bạn bè của bạn và hai bạn không xem được bài đăng chỉ dành cho bạn bè của nhau.`,
    confirm: 'Huỷ kết bạn',
    cancel: 'Huỷ',
  }
}

/** Câu báo sau khi SERVER xác nhận — theo trạng thái DB trả về, không theo nút đã bấm */
export function actionNotice(action: FriendAction, result: Relationship, name: string): string {
  if (result === 'friends') return action === 'send' || action === 'accept' ? `Bạn và ${name} đã là bạn bè.` : ''
  if (result === 'outgoing') return action === 'send' ? 'Đã gửi lời mời — chờ người kia chấp nhận.' : ''
  if (result === 'none') {
    if (action === 'cancel') return 'Đã huỷ lời mời.'
    if (action === 'decline') return 'Đã xoá lời mời.'
    if (action === 'unfriend') return `Đã huỷ kết bạn với ${name}.`
  }
  return ''
}

/** Lý do không thấy tường — hiện thay cho bài đăng (bài KHÔNG được tải về máy). */
export function lockedWallText(rel: Relationship, name: string): string {
  if (rel === 'outgoing') return `Khi ${name} chấp nhận lời mời, bạn sẽ xem được bài đăng trên trang này.`
  if (rel === 'incoming') return `Xác nhận lời mời để xem bài đăng của ${name}.`
  return `Kết bạn với ${name} để xem bài đăng trên trang này.`
}
