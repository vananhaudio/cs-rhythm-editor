// RPC cho 1001 Câu Chuyện trong /me. Lọc người bị chặn và chọn "hôm nay" nằm ở server.
import { supabase } from '../../supabase'
import { toStoryCard, type StoryCardData } from './storyModel'

export const STORIES_PAGE = 12

/** Lỗi / chưa có → null: Feed vẫn hiện bình thường, chỉ không có thẻ hôm nay. */
export async function fetchStoryToday(): Promise<StoryCardData | null> {
  try {
    const { data, error } = await supabase.rpc('social_story_today')
    return error ? null : toStoryCard(data)
  } catch { return null }
}

export type StoryCursor = { publishedAt: string; id: string }
export type StoriesPage = { items: StoryCardData[]; next: StoryCursor | null }

export async function fetchStoriesPage(cursor: StoryCursor | null): Promise<StoriesPage> {
  const { data, error } = await supabase.rpc('social_stories', {
    p_before: cursor?.publishedAt ?? null, p_before_id: cursor?.id ?? null, p_limit: STORIES_PAGE,
  })
  if (error) throw error
  const rows = (data ?? []) as { published_at: string; story_id: string; story: unknown }[]
  const last = rows[rows.length - 1]
  return {
    items: rows.map(r => toStoryCard(r.story)).filter((c): c is StoryCardData => c !== null),
    // con trỏ lấy từ hàng THÔ để thẻ hỏng không làm kẹt trang
    next: rows.length === STORIES_PAGE && last ? { publishedAt: last.published_at, id: last.story_id } : null,
  }
}
