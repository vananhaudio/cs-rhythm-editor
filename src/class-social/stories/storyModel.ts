// 1001 Câu Chuyện trong /me — logic THUẦN (không React/mạng). Dữ liệu đọc thẳng từ public.stories qua RPC
// (social_feed kind 'story', social_story_today, social_stories). Không bản sao nội dung.
export type StoryCardData = {
  storyId: string; slug: string; title: string; excerpt: string; coverUrl: string | null
  authorName: string; publishedAt: string; storyNumber: number | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/** Payload từ server → thẻ; hỏng / đường dẫn lạ → null (bỏ qua, không vỡ Feed). */
export function toStoryCard(raw: unknown): StoryCardData | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const storyId = str(o.story_id), slug = str(o.slug), title = str(o.title)
  if (!UUID_RE.test(storyId) || !SLUG_RE.test(slug) || slug.length > 200 || !title) return null
  const cover = str(o.cover_url)
  const name = str(o.author_name)
  return {
    storyId: storyId.toLowerCase(), slug, title,
    excerpt: str(o.excerpt),
    coverUrl: /^https:\/\//i.test(cover) ? cover : null,
    authorName: !name || name.includes('@') ? 'Người kể chuyện' : name,
    publishedAt: str(o.published_at),
    storyNumber: typeof o.story_number === 'number' ? o.story_number : null,
  }
}

/** Đường quay lại chỉ được là đường nội bộ của /me — không chuyển hướng ra ngoài. */
export function safeReturnPath(v: unknown): string | null {
  return typeof v === 'string' && /^\/(me|me\/stories|start)$/.test(v) ? v : null
}

/** Đường dẫn đã xuất bản giữ nguyên /story/<slug>; ?return chỉ để nút quay lại về đúng chỗ. */
export const storyHref = (slug: string, returnTo?: '/me' | '/me/stories') =>
  `/story/${slug}${returnTo ? `?return=${encodeURIComponent(returnTo)}` : ''}`

export type FeedSlot<T> = { type: 'entry'; entry: T } | { type: 'today'; card: StoryCardData }

/**
 * Trộn thẻ "Câu chuyện hôm nay" vào Feed: SAU BÀI THỨ BA (không tính thẻ truyện); ít bài hơn thì đặt cuối.
 * Không trùng: truyện đang là thẻ hôm nay bị bỏ khỏi dòng theo ngày. Không dồn: hai thẻ truyện không đứng liền nhau
 * (nếu chỗ định đặt sát một thẻ truyện thì lùi xuống sau bài kế tiếp).
 */
export function placeTodayCard<T>(entries: T[], today: StoryCardData | null, storyIdOf: (e: T) => string | null): FeedSlot<T>[] {
  const list = today ? entries.filter(e => storyIdOf(e) !== today.storyId) : entries
  const slots: FeedSlot<T>[] = list.map(entry => ({ type: 'entry', entry }))
  if (!today || !list.length) return slots
  const isStory = (i: number) => i >= 0 && i < list.length && storyIdOf(list[i]) !== null
  let at = list.length, seen = 0
  for (let i = 0; i < list.length; i++) {
    if (!isStory(i) && ++seen === 3) { at = i + 1; break }
  }
  // chỗ trống đầu tiên không sát thẻ truyện: tìm từ vị trí định đặt xuống dưới, hết thì lùi lên trên
  const free = (i: number) => !isStory(i - 1) && !isStory(i)
  const down = Array.from({ length: list.length - at + 1 }, (_, i) => at + i)
  const up = Array.from({ length: Math.max(0, at - 1) }, (_, i) => at - 1 - i)
  at = [...down, ...up].find(free) ?? list.length
  slots.splice(at, 0, { type: 'today', card: today })
  return slots
}
