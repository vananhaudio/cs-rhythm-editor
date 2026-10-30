// Feed Likes V1 — mô hình THUẦN (không mạng/DOM). Một khoá (kind, id) cho cả ba nguồn Feed; id = id trong payload Feed:
// post → class_posts.id · learning_thread → learning_threads.id · teamlab_publication → publication_id.
export const LIKE_KINDS = ['post', 'learning_thread', 'teamlab_publication'] as const
export type LikeKind = (typeof LIKE_KINDS)[number]
export type LikeState = { count: number; liked: boolean }
export type LikeTarget = { kind: LikeKind; id: string }

export const likeKey = (kind: LikeKind, id: string): string => `${kind}:${id}`
export const SUMMARY_BATCH = 100   // khớp giới hạn của RPC feed_like_summary

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isLikeKind = (k: unknown): k is LikeKind => (LIKE_KINDS as readonly unknown[]).includes(k)

export type SummaryRow = { target_kind: unknown; target_id: unknown; like_count: unknown; liked: unknown }

/** Hàng RPC → Map(khoá → trạng thái). Bỏ hàng hỏng; số lượt ép về số nguyên ≥ 0. */
export function parseSummary(rows: unknown): Map<string, LikeState> {
  const out = new Map<string, LikeState>()
  if (!Array.isArray(rows)) return out
  for (const r of rows as SummaryRow[]) {
    if (!r || !isLikeKind(r.target_kind) || typeof r.target_id !== 'string' || !UUID_RE.test(r.target_id)) continue
    out.set(likeKey(r.target_kind, r.target_id.toLowerCase()), { count: Math.max(0, Math.trunc(Number(r.like_count)) || 0), liked: r.liked === true })
  }
  return out
}

/** Áp lạc quan: trạng thái mới = want; số lượt chỉnh ±1 khi đổi chiều, không bao giờ âm. */
export function applyOptimistic(s: LikeState, want: boolean): LikeState {
  if (s.liked === want) return s
  return { liked: want, count: Math.max(0, s.count + (want ? 1 : -1)) }
}

export function likeLabel(count: number): string {
  return count > 0 ? `${count} lượt thích` : ''
}

export function likeErrorText(code: string | undefined, online: boolean): string {
  if (!online) return 'Không có mạng — chưa lưu được lượt thích.'
  if (code === 'FEED_NOT_VISIBLE' || code === '42501') return 'Bài này không còn khả dụng.'
  return 'Chưa lưu được lượt thích. Thử lại sau.'
}
