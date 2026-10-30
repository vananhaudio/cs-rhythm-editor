// Gọi RPC Thích. supabase nạp ĐỘNG để model/store test được trên Node. Không bao giờ ném lỗi ra ngoài.
import { SUMMARY_BATCH, parseSummary, type LikeState, type LikeTarget } from './likeModel'

export type LikeApiError = { code?: string }
export type LikeApi = {
  summary(targets: LikeTarget[]): Promise<{ ok: true; rows: Map<string, LikeState> } | { ok: false; error: LikeApiError }>
  set(target: LikeTarget, liked: boolean): Promise<{ ok: true; state: LikeState } | { ok: false; error: LikeApiError }>
}

export const supabaseLikeApi: LikeApi = {
  async summary(targets) {
    try {
      const { supabase } = await import('../../supabase')
      const batch = targets.slice(0, SUMMARY_BATCH)
      const { data, error } = await supabase.rpc('feed_like_summary', { p_kinds: batch.map(t => t.kind), p_ids: batch.map(t => t.id) })
      if (error) return { ok: false, error: { code: error.code } }
      return { ok: true, rows: parseSummary(data) }
    } catch { return { ok: false, error: {} } }
  },
  async set(target, liked) {
    try {
      const { supabase } = await import('../../supabase')
      const { data, error } = await supabase.rpc('feed_like_set', { p_kind: target.kind, p_id: target.id, p_liked: liked })
      if (error) return { ok: false, error: { code: /FEED_NOT_VISIBLE/.test(error.message ?? '') ? 'FEED_NOT_VISIBLE' : error.code } }
      const d = data as { liked?: unknown; count?: unknown } | null
      return { ok: true, state: { liked: d?.liked === true, count: Math.max(0, Math.trunc(Number(d?.count)) || 0) } }
    } catch { return { ok: false, error: {} } }
  },
}
