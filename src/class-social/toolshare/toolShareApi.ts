// Tool Share V1 — ghi (RPC social_share_tool_result: server kiểm payload + chống bấm đúp) và đọc payload theo lô
// (select class_posts.tool_share theo id — qua RLS đọc hiện có). supabase nạp ĐỘNG: component lá test được trên Node.
import { useEffect, useSyncExternalStore } from 'react'

export type ShareResult = { ok: true; postId: string } | { ok: false; message: string }

export function shareErrorText(msg: string | undefined, online = true): string {
  if (!online || /failed to fetch|network|load failed/i.test(msg ?? '')) return 'Không có kết nối mạng. Kiểm tra mạng rồi thử lại.'
  if ((msg ?? '').includes('TS_BAD_RESULT')) return 'Kết quả chưa hợp lệ để chia sẻ. Hãy kiểm tra lại rồi thử lại.'
  if ((msg ?? '').includes('TS_NOT_MEMBER')) return 'Tài khoản của bạn chưa thuộc Class nên chưa chia sẻ được.'
  if (/jwt|401/i.test(msg ?? '')) return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.'
  return 'Chưa chia sẻ được. Hãy thử lại.'
}

/** Chia sẻ MỘT kết quả công cụ. clientKey sinh một lần cho một kết quả → bấm lại không tạo bài thứ hai. */
export async function shareToolResult(tool: string, result: Record<string, unknown>, clientKey: string): Promise<ShareResult> {
  const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false
  try {
    const { supabase } = await import('../../supabase')
    const { data, error } = await supabase.rpc('social_share_tool_result', { p_tool: tool, p_result: result, p_client_key: clientKey })
    if (error || typeof data !== 'string') {
      if (import.meta.env.DEV) console.warn('[class-social] social_share_tool_result:', error?.code, error?.message)
      return { ok: false, message: shareErrorText(error?.message, online) }
    }
    return { ok: true, postId: data }
  } catch (e) {
    return { ok: false, message: shareErrorText((e as Error)?.message, online) }
  }
}

/** Chủ sản phẩm gỡ chia sẻ (mọi công cụ dùng artifact): xoá artifact + bài Feed trỏ tới nó (RPC, cùng transaction). */
export async function deleteToolArtifact(id: string): Promise<boolean> {
  try {
    const { supabase } = await import('../../supabase')
    const { data, error } = await supabase.rpc('social_delete_tool_artifact', { p_id: id })
    return !error && data === true
  } catch { return false }
}

// ── Đọc payload theo LÔ (không N+1): mọi card tool_share trong cùng nhịp → một select ────────────────
const cache = new Map<string, unknown>()     // postId → tool_share jsonb (null = không đọc được)
const pending = new Set<string>()
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | null = null

async function flush() {
  timer = null
  const ids = [...pending]; pending.clear()
  try {
    const { supabase } = await import('../../supabase')
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100)
      const { data, error } = await supabase.from('class_posts').select('id,tool_share').in('id', chunk)
      if (error && import.meta.env.DEV) console.warn('[class-social] tool_share:', error.code, error.message)
      for (const r of (error ? [] : data ?? []) as { id: string; tool_share: unknown }[]) cache.set(r.id, r.tool_share ?? null)
      for (const id of chunk) if (!cache.has(id)) cache.set(id, null)
    }
  } catch { for (const id of ids) if (!cache.has(id)) cache.set(id, null) }
  listeners.forEach(l => l())
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }

/** Payload tool_share của một bài (undefined = đang tải). */
export function useToolSharePayload(postId: string): unknown {
  const v = useSyncExternalStore(subscribe, () => (cache.has(postId) ? cache.get(postId) : undefined), () => undefined)
  useEffect(() => {
    if (cache.has(postId) || pending.has(postId)) return
    pending.add(postId)
    if (!timer) timer = setTimeout(() => void flush(), 0)
  }, [postId])
  return v
}
