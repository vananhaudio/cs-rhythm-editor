// Feed Likes V1 — store dùng chung cho mọi nơi hiện thẻ Feed (/me, Tường, Lớp, Class Mobile/TVA Guitar): cùng khoá (kind,id)
// → cùng trạng thái, nên Thích ở đâu cũng đồng bộ ngay trong phiên; đồng bộ giữa thiết bị qua DB (feed_likes).
//  • Nạp THEO LÔ: các thẻ mount trong cùng nhịp gộp thành 1 lần feed_like_summary (không N+1).
//  • Bấm Thích: cập nhật lạc quan ngay; MỖI mục tối đa 1 yêu cầu đang bay, bấm liên tiếp chỉ giữ ý muốn cuối cùng
//    (RPC đặt theo TRẠNG THÁI nên gửi lại an toàn); lỗi → trả về trạng thái đã xác nhận gần nhất + thông báo ngắn.
import { useSyncExternalStore } from 'react'
import { SUMMARY_BATCH, applyOptimistic, likeErrorText, likeKey, type LikeKind, type LikeState, type LikeTarget } from './likeModel'
import { supabaseLikeApi, type LikeApi } from './likesApi'

export type LikeView = {
  /** undefined = chưa biết (đang nạp / nạp lỗi) — nút vẫn bấm được, chưa hiện số */
  state?: LikeState
  /** server không cho thấy mục này (chưa đăng nhập / ngoài Class / bị ẩn) → không hiện thanh Thích */
  hidden: boolean
  busy: boolean
  error: string | null
}
const EMPTY: LikeView = { hidden: false, busy: false, error: null }

type Entry = LikeView & { confirmed?: LikeState; want?: boolean; inflight: boolean; loaded: boolean; view: LikeView }
const entries = new Map<string, Entry>()
const listeners = new Set<() => void>()
const queue = new Map<string, LikeTarget>()
let scheduled = false
let api: LikeApi = supabaseLikeApi
const emit = () => listeners.forEach(l => l())
const online = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)

function patch(key: string, p: Partial<Entry>) {
  const cur: Entry = entries.get(key) ?? { ...EMPTY, inflight: false, loaded: false, view: EMPTY }
  const next: Entry = { ...cur, ...p }
  // snapshot ổn định cho useSyncExternalStore: view là object mới chỉ khi nội dung đổi
  next.view = { state: next.state, hidden: next.hidden, busy: next.busy, error: next.error }
  entries.set(key, next)
}
const viewOf = (key: string): LikeView => entries.get(key)?.view ?? EMPTY

async function flush() {
  scheduled = false
  const batch = [...queue.values()]
  queue.clear()
  for (let i = 0; i < batch.length; i += SUMMARY_BATCH) {
    const chunk = batch.slice(i, i + SUMMARY_BATCH)
    const res = await api.summary(chunk)
    for (const t of chunk) {
      const key = likeKey(t.kind, t.id)
      const e = entries.get(key)
      if (e?.inflight) continue            // đang có thao tác của người dùng — không ghi đè
      if (!res.ok) { patch(key, { loaded: false }); continue }
      const s = res.rows.get(key)
      if (s) patch(key, { state: s, confirmed: s, hidden: false, loaded: true })
      else patch(key, { state: undefined, confirmed: undefined, hidden: true, loaded: true })
    }
    emit()
  }
}

/** Đăng ký mục cần nạp (gọi khi thẻ mount). Đã nạp / đang chờ → bỏ qua. */
export function ensureLike(kind: LikeKind, id: string) {
  const key = likeKey(kind, id)
  const e = entries.get(key)
  if (e?.loaded || queue.has(key)) return
  queue.set(key, { kind, id })
  if (!scheduled) { scheduled = true; setTimeout(() => { void flush() }, 0) }
}

async function drain(target: LikeTarget) {
  const key = likeKey(target.kind, target.id)
  for (;;) {
    const e = entries.get(key)
    if (!e || e.want === undefined) break
    const want = e.want
    if (e.confirmed && e.confirmed.liked === want) { patch(key, { want: undefined, inflight: false, busy: false }); break }
    const res = await api.set(target, want)
    const after = entries.get(key)!
    if (res.ok) {
      if (after.want === want) { patch(key, { state: res.state, confirmed: res.state, want: undefined, inflight: false, busy: false, error: null }); break }
      patch(key, { confirmed: res.state })                                // người dùng đã đổi ý trong lúc bay → gửi tiếp ý mới
      continue
    }
    const hide = res.error.code === 'FEED_NOT_VISIBLE' || res.error.code === '42501'
    patch(key, { state: after.confirmed, want: undefined, inflight: false, busy: false, hidden: hide, error: likeErrorText(res.error.code, online()) })
    break
  }
  emit()
  const msg = entries.get(key)?.error
  if (msg) setTimeout(() => { if (entries.get(key)?.error === msg) { patch(key, { error: null }); emit() } }, 4000)
}

/** Bấm Thích/Bỏ thích. Trả về ngay sau khi áp lạc quan. */
export function toggleLike(kind: LikeKind, id: string) {
  const key = likeKey(kind, id)
  const e = entries.get(key)
  if (e?.hidden) return
  if (!online()) { patch(key, { error: likeErrorText(undefined, false) }); emit(); return }
  const base: LikeState = e?.state ?? e?.confirmed ?? { count: 0, liked: false }
  const want = !(e?.want ?? base.liked)
  const next = applyOptimistic(e?.state ?? base, want)
  patch(key, { state: next, want, error: null, busy: true, hidden: false })
  emit()
  if (e?.inflight) return                 // vòng drain đang chạy sẽ đọc `want` mới
  patch(key, { inflight: true })
  void drain({ kind, id })
}

export function useLike(kind: LikeKind, id: string): LikeView {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => { listeners.delete(cb) } },
    () => viewOf(likeKey(kind, id)),
    () => EMPTY,
  )
}

/** Chỉ cho test. */
export function __setLikeApi(a: LikeApi | null) { api = a ?? supabaseLikeApi }
export function __resetLikeStore() { entries.clear(); queue.clear(); scheduled = false; listeners.clear() }
export const __peek = (kind: LikeKind, id: string): LikeView => viewOf(likeKey(kind, id))
