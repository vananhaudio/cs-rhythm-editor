// Supabase cho bạn bè + tường. MỌI thao tác qua RPC (bảng friendships không đọc/ghi thẳng được).
// Người chưa là bạn gọi get_user_wall nhận MẢNG RỖNG — bài không bao giờ về tới máy.
import { supabase } from '../../supabase'
import { friendlyError, toFeedPosts, type FeedPost, type FeedRow } from '../posts/postModel'
import { FEED_PAGE, type Result } from '../posts/postsApi'
import {
  toPeople, toProfile, toRelationship,
  type FriendRow, type PersonCard, type ProfileRow, type PublicProfile, type RequestRow, type Relationship,
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

const relResult = (r: Result<unknown>): Result<Relationship> => (r.ok ? { ok: true, value: toRelationship(r.value) } : r)

export const sendFriendRequest = async (userId: string) =>
  relResult(await rpc('send_friend_request', { p_user: userId }, 'action'))
export const respondFriendRequest = async (userId: string, accept: boolean) =>
  relResult(await rpc('respond_friend_request', { p_user: userId, p_accept: accept }, 'action'))
/** Huỷ kết bạn, hoặc rút lại lời mời mình đã gửi */
export const unfriend = async (userId: string) =>
  relResult(await rpc('unfriend', { p_user: userId }, 'action'))
