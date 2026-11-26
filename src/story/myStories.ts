// Danh sách "câu chuyện của tôi" ở Phòng viết = bài chưa đăng (đọc theo user_id) + bài đã đăng (RPC my_published_stories).
export type MyStoryRow = { id: string; title: string; status: string; updated_at: string; conversation?: unknown }

export function mergeMyStories<M>(own: MyStoryRow[], published: MyStoryRow[]): (MyStoryRow & { conversation: M[] })[] {
  const seen = new Set(own.map(s => s.id))
  return [...own, ...published.filter(p => !seen.has(p.id))]
    .map(s => ({ ...s, conversation: Array.isArray(s.conversation) ? (s.conversation as M[]) : [] }))
    .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
}
