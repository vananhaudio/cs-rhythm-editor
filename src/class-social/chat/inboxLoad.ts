// Tải đầu danh sách — THUẦN (chỉ kiểu, không supabase) để test được trong Node.
// Mỗi phần (trang chính, mục ghim, summary) báo kết quả ĐỘC LẬP ngay khi xong: danh sách chính hiện khi chat_inbox trả về,
// không chờ ghim/summary; ghim/summary lỗi hay chậm không làm Chat đứng chờ.
import type { ConversationItem } from './chatModel'
import type { InboxSource } from './inboxApi'
import type { InboxFilter, InboxScope, InboxSummary } from './inboxModel'

export type HeadPage = { items: ConversationItem[]; hasMore: boolean }
export type HeadHandlers = {
  onMain: (page: HeadPage) => void
  onMainError: (message: string) => void
  /** chỉ gọi khi lấy được mục ghim (lỗi → giữ nguyên mục ghim đang hiện) */
  onPinned: (items: ConversationItem[]) => void
  onSummary: (s: InboxSummary) => void
}

/** Trả true khi trang chính thành công. Chờ cả ba phần xong (để polling không chồng lượt) nhưng báo từng phần ngay khi xong. */
export async function loadInboxHead(a: {
  source: InboxSource; scope: InboxScope; filter: InboxFilter; searching: boolean; pageSize: number
  alive: () => boolean; on: HeadHandlers
}): Promise<boolean> {
  const { source, scope, filter, searching, pageSize, alive, on } = a
  const safe = <T,>(p: Promise<T>) => p.catch(() => null)
  const main = (async () => {
    const r = await source.page({ scope, filter, pinned: searching ? 'any' : 'exclude', cursor: null, limit: pageSize }).catch(() => null)
    if (!alive()) return r?.ok ?? false
    if (!r) { on.onMainError('Không tải được danh sách.'); return false }
    if (!r.ok) { on.onMainError(r.message); return false }
    on.onMain(r.value)
    if (searching) on.onPinned([])
    return true
  })()
  const pinned = !searching && scope === 'mine'
    ? safe(source.page({ scope, filter, pinned: 'only', cursor: null, limit: pageSize })).then(r => { if (alive() && r && r.ok) on.onPinned(r.value.items) })
    : Promise.resolve()
  const summary = scope === 'mine'
    ? safe(source.summary()).then(r => { if (alive() && r && r.ok) on.onSummary(r.value) })
    : Promise.resolve()
  const [ok] = await Promise.all([main, pinned, summary])
  return ok
}
