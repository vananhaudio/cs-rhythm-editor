// Supabase cho bạn bè + tường. MỌI thao tác qua RPC (bảng friendships không đọc/ghi thẳng được).
// Người chưa là bạn gọi get_user_wall nhận MẢNG RỖNG — bài không bao giờ về tới máy.
import { supabase } from '../../supabase'
import { friendlyError, toFeedEntries, toFeedPosts, type FeedEntry, type FeedPost, type FeedRow, type MixedRow } from '../posts/postModel'
import { FEED_PAGE, type Result } from '../posts/postsApi'
import {
  toPeople, toProfile, toRelationship,
  type FriendAction, type FriendRow, type PersonCard, type ProfileRow, type PublicProfile, type RequestRow, type Relationship,
} from './friendModel'

const online = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)
const devWarn = (what: string, e: { code?: string; message?: string } | null) => {
  if (import.meta.env.DEV && e) console.warn(`[class-social] ${what}:`, e.code, e.message)
}
type RpcError = { code?: string; message?: string; status?: number } | null
type Kind = 'load' | 'action'

/** Lỗi → câu tiếng Việt. Mạng / hết phiên dùng chung câu của Social; lỗi nghiệp vụ RPC đã raise câu dễ hiểu. */
function toMessage(error: RpcError, kind: Kind): string {
  if (kind === 'action' && (error?.code === 'P0002' || error?.code === '22023') && error.message) return error.message
  const common = friendlyError(error, 'feed', online())
  if (common !== friendlyError(null, 'feed')) return common
  return kind === 'load' ? 'Chưa tải được dữ liệu. Hãy thử lại.' : 'Chưa thực hiện được. Hãy thử lại.'
}

async function rpc<T>(fn: string, args: Record<string, unknown>, kind: Kind): Promise<Result<T>> {
  try {
    const { data, error, status } = await supabase.rpc(fn, args)
    if (error) {
      devWarn(fn, error)
      return { ok: false, message: toMessage({ ...error, status }, kind) }
    }
    return { ok: true, value: data as T }
  } catch (e) {
    return { ok: false, message: toMessage(e as Error, kind) }
  }
}

export async function fetchFriends(): Promise<Result<PersonCard[]>> {
  const r = await rpc<FriendRow[]>('my_friends', {}, 'load')
  return r.ok ? { ok: true, value: toPeople(r.value) } : r
}

export async function fetchIncomingRequests(): Promise<Result<PersonCard[]>> {
  const r = await rpc<RequestRow[]>('incoming_friend_requests', {}, 'load')
  return r.ok ? { ok: true, value: toPeople(r.value) } : r
}

/** Lời mời MÌNH đã gửi, chưa được chấp nhận (Friends UX V2) */
export async function fetchOutgoingRequests(): Promise<Result<PersonCard[]>> {
  const r = await rpc<RequestRow[]>('outgoing_friend_requests', {}, 'load')
  return r.ok ? { ok: true, value: toPeople(r.value) } : r
}

/** null = không có thành viên này (hoặc mình không phải thành viên Class) */
export async function fetchProfile(userId: string): Promise<Result<PublicProfile | null>> {
  const r = await rpc<ProfileRow[]>('get_user_profile', { p_user: userId }, 'load')
  return r.ok ? { ok: true, value: toProfile(r.value?.[0]) } : r
}

export async function fetchWallPage(userId: string, cursor?: { createdAt: string; id: string }): Promise<Result<{ posts: FeedPost[]; hasMore: boolean }>> {
  const r = await rpc<FeedRow[]>('get_user_wall', {
    p_user: userId,
    p_before: cursor?.createdAt ?? null,
    p_before_id: cursor?.id ?? null,
    p_limit: FEED_PAGE,
  }, 'load')
  if (!r.ok) return r
  const rows = r.value ?? []
  return { ok: true, value: { posts: toFeedPosts(rows), hasMore: rows.length === FEED_PAGE } }
}

/** Tường (P2): bài của người đó (đúng luật get_user_wall) + thread của họ theo quyền — RPC user_wall. */
export async function fetchWallMixedPage(userId: string, cursor?: { createdAt: string; key: string }): Promise<Result<{ posts: FeedEntry[]; hasMore: boolean }>> {
  const r = await rpc<MixedRow[]>('user_wall', {
    p_user: userId,
    p_before: cursor?.createdAt ?? null,
    p_before_key: cursor?.key ?? null,
    p_limit: FEED_PAGE,
  }, 'load')
  if (!r.ok) return r
  const rows = r.value ?? []
  return { ok: true, value: { posts: toFeedEntries(rows), hasMore: rows.length === FEED_PAGE } }
}

const relResult = (r: Result<unknown>): Result<Relationship> => (r.ok ? { ok: true, value: toRelationship(r.value) } : r)

export const sendFriendRequest = async (userId: string) =>
  relResult(await rpc('send_friend_request', { p_user: userId }, 'action'))
/** accept=false = "Xóa" lời mời: DB xoá lời mời ở cả hai phía (như Facebook) */
export const respondFriendRequest = async (userId: string, accept: boolean) =>
  relResult(await rpc('respond_friend_request', { p_user: userId, p_accept: accept }, 'action'))
/** Huỷ kết bạn, hoặc rút lại lời mời mình đã gửi (cùng RPC unfriend) */
export const unfriend = async (userId: string) =>
  relResult(await rpc('unfriend', { p_user: userId }, 'action'))

/** Một hành động quan hệ → đúng RPC. Trả quan hệ MỚI do DB báo. */
export function runFriendAction(action: FriendAction, userId: string): Promise<Result<Relationship>> {
  switch (action) {
    case 'send': return sendFriendRequest(userId)
    case 'accept': return respondFriendRequest(userId, true)
    case 'decline': return respondFriendRequest(userId, false)
    case 'cancel': case 'unfriend': return unfriend(userId)
  }
}
