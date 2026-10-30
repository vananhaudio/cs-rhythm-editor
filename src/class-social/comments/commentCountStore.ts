// Số bình luận của thẻ thread / publication (bài Social có sẵn commentCount trong payload Feed). Nạp THEO LÔ như Like store; panel bình luận
// cập nhật lại số sau khi tải/gửi/xoá để thanh tương tác và panel luôn khớp.
import { useSyncExternalStore } from 'react'
import { likeKey } from '../likes/likeModel'
import { supabaseTargetCommentsApi, type TargetCommentsApi } from './targetCommentsApi'
import type { CommentKind } from './targetCommentModel'

const counts = new Map<string, number>()
const loaded = new Set<string>()
const queue = new Map<string, { kind: CommentKind; id: string }>()
const listeners = new Set<() => void>()
let scheduled = false
let api: TargetCommentsApi = supabaseTargetCommentsApi
const emit = () => listeners.forEach(l => l())

async function flush() {
  scheduled = false
  const batch = [...queue.values()]; queue.clear()
  for (let i = 0; i < batch.length; i += 100) {
    const chunk = batch.slice(i, i + 100)
    const res = await api.counts(chunk)
    if (!res.ok) continue
    for (const t of chunk) { const k = likeKey(t.kind, t.id); loaded.add(k); if (res.value.has(k)) counts.set(k, res.value.get(k)!) }
    emit()
  }
}
export function ensureCommentCount(kind: CommentKind, id: string) {
  const k = likeKey(kind, id)
  if (loaded.has(k) || queue.has(k)) return
  queue.set(k, { kind, id })
  if (!scheduled) { scheduled = true; setTimeout(() => { void flush() }, 0) }
}
export function setCommentCount(kind: CommentKind, id: string, n: number) {
  const k = likeKey(kind, id)
  if (counts.get(k) === n) return
  counts.set(k, Math.max(0, n)); loaded.add(k); emit()
}
export function useCommentCount(kind: CommentKind, id: string): number | undefined {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => { listeners.delete(cb) } }, () => counts.get(likeKey(kind, id)), () => undefined)
}
export const __peekCount = (kind: CommentKind, id: string) => counts.get(likeKey(kind, id))
export function __setCountsApi(a: TargetCommentsApi | null) { api = a ?? supabaseTargetCommentsApi }
export function __resetCountStore() { counts.clear(); loaded.clear(); queue.clear(); listeners.clear(); scheduled = false }
