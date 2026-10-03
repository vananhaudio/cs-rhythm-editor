// Feed V1 — ba góc nhìn trên Home: Dành cho bạn | Lớp | Bạn bè ("Lớp" = hoạt động từ các lớp mình thuộc; quản lý lớp ở /me/classes "Lớp của tôi"). THUẦN (test được, không mạng).
// Góc nhìn chỉ LỌC những gì server vốn cho xem (RPC social_feed / social_feed_scoped) — client không tự suy quyền.
// URL: /me (mặc định) · /me?feed=classes · /me?feed=friends — KHÔNG dùng ?tab= (đã dành cho chuyển hướng sang App học).

export type FeedScope = 'for_you' | 'my_classes' | 'friends'

export const FEED_SCOPES: { id: FeedScope; label: string; param: string | null }[] = [
  { id: 'for_you', label: 'Dành cho bạn', param: null },
  { id: 'my_classes', label: 'Lớp', param: 'classes' },
  { id: 'friends', label: 'Bạn bè', param: 'friends' },
]

/** ?feed=… → góc nhìn (lạ / thiếu → Dành cho bạn). */
export function scopeFromSearch(search: string): FeedScope {
  const v = new URLSearchParams(search).get('feed')
  return FEED_SCOPES.find(s => s.param !== null && s.param === v)?.id ?? 'for_you'
}

/** Góc nhìn → query string mới, GIỮ các tham số khác (Dành cho bạn = bỏ ?feed). */
export function searchForScope(search: string, scope: FeedScope): string {
  const p = new URLSearchParams(search)
  const param = FEED_SCOPES.find(s => s.id === scope)?.param ?? null
  if (param) p.set('feed', param); else p.delete('feed')
  const q = p.toString()
  return q ? '?' + q : ''
}

/** Trạng thái trống theo góc nhìn: ngắn, nói điều gì sẽ xuất hiện. */
export const FEED_EMPTY: Record<FeedScope, { title: string; hint: string }> = {
  for_you: { title: 'Chưa có hoạt động mới', hint: 'Bài chia sẻ và câu chuyện học tập của bạn bè, lớp sẽ xuất hiện tại đây.' },
  my_classes: { title: 'Chưa có hoạt động mới từ các lớp của bạn.', hint: 'Bài trả, câu hỏi và phản hồi của Thầy trong các lớp bạn tham gia sẽ xuất hiện tại đây.' },
  friends: { title: 'Chưa có hoạt động mới từ bạn bè.', hint: 'Kết bạn với những người cùng học để thấy hoạt động của họ tại đây.' },
}
