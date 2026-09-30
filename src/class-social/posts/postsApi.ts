// Gọi Supabase cho bài đăng cộng đồng. Tác giả KHÔNG gửi từ client — DB tự lấy auth.uid()
// (cột author_user_id default auth.uid(), policy INSERT bắt buộc = auth.uid()).
import { supabase } from '../../supabase'
import type { FeedScope } from './feedScope'
import { friendlyError, toFeedEntries, toFeedPosts, type AssignmentInsert, type FeedEntry, type FeedPost, type FeedRow, type MixedRow, type NewPost, type WallInsert } from './postModel'

export const FEED_PAGE = 20

export type Result<T> = { ok: true; value: T } | { ok: false; message: string }

const online = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)

export async function fetchFeedPage(cursor?: { createdAt: string; id: string }): Promise<Result<{ posts: FeedPost[]; hasMore: boolean }>> {
  try {
    const { data, error, status } = await supabase.rpc('class_feed', {
      p_before: cursor?.createdAt ?? null,
      p_before_id: cursor?.id ?? null,
      p_limit: FEED_PAGE,
    })
    if (error) {
      if (import.meta.env.DEV) console.warn('[class-social] feed:', error.code, error.message)
      return { ok: false, message: friendlyError({ ...error, status }, 'feed', online()) }
    }
    const rows = (data ?? []) as FeedRow[]
    return { ok: true, value: { posts: toFeedPosts(rows), hasMore: rows.length === FEED_PAGE } }
  } catch (e) {
    return { ok: false, message: friendlyError(e as Error, 'feed', online()) }
  }
}

/** Feed /me (P2): bài Social (đúng luật class_feed) + thread community — một thread = một mục, theo hoạt động mới nhất. */
export async function fetchSocialFeedPage(cursor?: { createdAt: string; key: string }): Promise<Result<{ posts: FeedEntry[]; hasMore: boolean }>> {
  try {
    const { data, error, status } = await supabase.rpc('social_feed', {
      p_before: cursor?.createdAt ?? null,
      p_before_key: cursor?.key ?? null,
      p_limit: FEED_PAGE,
    })
    if (error) {
      if (import.meta.env.DEV) console.warn('[class-social] social_feed:', error.code, error.message)
      return { ok: false, message: friendlyError({ ...error, status }, 'feed', online()) }
    }
    const rows = (data ?? []) as MixedRow[]
    return { ok: true, value: { posts: toFeedEntries(rows), hasMore: rows.length === FEED_PAGE } }
  } catch (e) {
    return { ok: false, message: friendlyError(e as Error, 'feed', online()) }
  }
}

/**
 * Feed V1 theo góc nhìn. "Dành cho bạn" = ĐÚNG social_feed hiện có; "Lớp của tôi" / "Bạn bè" = social_feed_scoped
 * (server lọc trong tập người xem vốn được xem). Cùng dạng hàng + keyset với social_feed.
 */
export async function fetchScopedFeedPage(scope: FeedScope, cursor?: { createdAt: string; key: string }): Promise<Result<{ posts: FeedEntry[]; hasMore: boolean }>> {
  if (scope === 'for_you') return fetchSocialFeedPage(cursor)
  try {
    const { data, error, status } = await supabase.rpc('social_feed_scoped', {
      p_scope: scope,
      p_before: cursor?.createdAt ?? null,
      p_before_key: cursor?.key ?? null,
      p_limit: FEED_PAGE,
    })
    if (error) {
      if (import.meta.env.DEV) console.warn('[class-social] social_feed_scoped:', error.code, error.message)
      return { ok: false, message: friendlyError({ ...error, status }, 'feed', online()) }
    }
    const rows = (data ?? []) as MixedRow[]
    return { ok: true, value: { posts: toFeedEntries(rows), hasMore: rows.length === FEED_PAGE } }
  } catch (e) {
    return { ok: false, message: friendlyError(e as Error, 'feed', online()) }
  }
}

/** Trả bài (bài của Class) hoặc bài viết trên tường (chỉ bạn bè) — cùng bảng class_posts, RLS kiểm cặp loại ↔ quyền xem. */
export async function createPost(insert: NewPost): Promise<Result<{ id: string }>> {
  try {
    const { data, error, status } = await supabase.from('class_posts').insert(insert).select('id').single()
    if (error || !data) {
      if (import.meta.env.DEV) console.warn('[class-social] post:', error?.code, error?.message)
      return { ok: false, message: friendlyError(error ? { ...error, status } : null, 'post', online()) }
    }
    return { ok: true, value: { id: (data as { id: string }).id } }
  } catch (e) {
    return { ok: false, message: friendlyError(e as Error, 'post', online()) }
  }
}

export const createAssignmentPost = (insert: AssignmentInsert) => createPost(insert)
export const createWallPost = (insert: WallInsert) => createPost(insert)
