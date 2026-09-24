// Gọi Supabase cho bài đăng cộng đồng. Tác giả KHÔNG gửi từ client — DB tự lấy auth.uid()
// (cột author_user_id default auth.uid(), policy INSERT bắt buộc = auth.uid()).
import { supabase } from '../../supabase'
import { friendlyError, toFeedPosts, type AssignmentInsert, type FeedPost, type FeedRow } from './postModel'

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

export async function createAssignmentPost(insert: AssignmentInsert): Promise<Result<{ id: string }>> {
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
