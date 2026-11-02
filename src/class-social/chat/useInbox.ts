// Chat List V2 — hook danh sách: trang đầu + Đã ghim, tải thêm bằng con trỏ, tìm kiếm phía server (debounce), lọc loại/chưa đọc, ghim (lạc quan),
// polling nhẹ làm mới trang đầu (không mất các trang đã tải). Chỉ biết InboxSource → test/Preview thay nguồn được.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ConversationItem } from './chatModel'
import { defaultInboxSource, type InboxMode, type InboxSource } from './inboxApi'
import {
  DEFAULT_FILTER, INBOX_PAGE, MAX_PINS, SEARCH_DEBOUNCE_MS, cursorOf, mergePages, normalizeQuery,
  type InboxFilter, type InboxKind, type InboxScope, type InboxSummary,
} from './inboxModel'
import { POLL_MS, startPolling } from './polling'

export type InboxState = {
  status: 'loading' | 'ready' | 'error'
  error: string | null
  /** Mục "Đã ghim" (chỉ khi không tìm kiếm) */
  pinned: ConversationItem[]
  items: ConversationItem[]
  hasMore: boolean
  loadingMore: boolean
  /** Đang tải lại do đổi bộ lọc/tìm kiếm (giữ danh sách cũ mờ đi, không nhấp nháy) */
  /** khoá bộ lọc của dữ liệu đang hiện (khác khoá hiện tại = đang tải lại) */
  loadedKey: string
  loadMoreError: string | null
  summary: InboxSummary | null
  mode: InboxMode
}
const INITIAL: InboxState = { status: 'loading', error: null, pinned: [], items: [], hasMore: false, loadingMore: false, loadedKey: '', loadMoreError: null, summary: null, mode: 'server' }

export function useInbox(source: InboxSource = defaultInboxSource, opts: { scope?: InboxScope; pageSize?: number } = {}) {
  const scope: InboxScope = opts.scope ?? 'mine'
  const pageSize = opts.pageSize ?? INBOX_PAGE
  const [state, setState] = useState<InboxState>(INITIAL)
  const [kind, setKindState] = useState<InboxKind>('all')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [rawQuery, setRawQuery] = useState('')
  const [debounced, setDebounced] = useState('')   // đã debounce
  const [pinError, setPinError] = useState<string | null>(null)
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state })
  const refreshRef = useRef<() => Promise<void>>(async () => {})

  // debounce tìm kiếm: gõ xong 250 ms mới hỏi server; xoá hết → tức thì
  useEffect(() => {
    const q = normalizeQuery(rawQuery)
    if (!q) return
    const t = setTimeout(() => setDebounced(q), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [rawQuery])
  const query = normalizeQuery(rawQuery) ? debounced : ''   // xoá hết → tức thì, không chờ debounce

  const filter: InboxFilter = useMemo(() => ({ kind, unreadOnly, query }), [kind, unreadOnly, query])
  const searching = query !== ''
  const filterKey = `${scope}|${kind}|${unreadOnly}|${query}`

  useEffect(() => {
    let alive = true
    let first = true
    const fetchHead = async () => {
      if (searching) {
        const r = await source.page({ scope, filter, pinned: 'any', cursor: null, limit: pageSize })
        return r.ok ? { ok: true as const, pinned: [] as ConversationItem[], page: r.value } : r
      }
      const [p, m] = await Promise.all([
        scope === 'mine' ? source.page({ scope, filter, pinned: 'only', cursor: null, limit: pageSize }) : Promise.resolve({ ok: true as const, value: { items: [] as ConversationItem[], hasMore: false } }),
        source.page({ scope, filter, pinned: 'exclude', cursor: null, limit: pageSize }),
      ])
      if (!m.ok) return m
      return { ok: true as const, pinned: p.ok ? p.value.items : [], page: m.value }
    }
    const tick = async (): Promise<boolean> => {
      const fresh = first; first = false
      const [head, sum] = await Promise.all([fetchHead(), scope === 'mine' ? source.summary() : Promise.resolve(null)])
      if (!alive) return head.ok
      if (!head.ok) {
        setState(s => s.status === 'ready' && !fresh ? s : ({ ...s, status: s.items.length || s.pinned.length ? 'ready' : 'error', error: head.message }))
        return false
      }
      setState(s => {
        const keepDeep = !fresh && s.items.length > pageSize
        return {
          ...s, status: 'ready', error: null, loadedKey: filterKey, loadMoreError: null, mode: source.mode(),
          pinned: head.pinned,
          items: fresh ? head.page.items : mergePages(s.items, head.page.items),
          hasMore: keepDeep ? s.hasMore : head.page.hasMore,
          summary: sum && sum.ok ? sum.value : s.summary,
        }
      })
      return true
    }
    refreshRef.current = async () => { first = false; await tick() }
    const stop = startPolling(tick, POLL_MS.list)
    return () => { alive = false; stop() }
  }, [source, scope, filter, searching, pageSize, filterKey])

  const loadMore = useCallback(async () => {
    const s = stateRef.current
    if (!s.hasMore || s.loadingMore || s.status !== 'ready') return
    const cursor = cursorOf(s.items)
    if (!cursor) return
    setState(x => ({ ...x, loadingMore: true, loadMoreError: null }))
    const r = await source.page({ scope, filter, pinned: searching ? 'any' : 'exclude', cursor, limit: pageSize })
    setState(x => r.ok
      ? { ...x, loadingMore: false, items: mergePages(x.items, r.value.items), hasMore: r.value.hasMore }
      : { ...x, loadingMore: false, loadMoreError: r.message })
  }, [source, scope, filter, searching, pageSize])

  const reload = useCallback(() => refreshRef.current(), [])
  const retry = useCallback(() => { setState(INITIAL); void refreshRef.current() }, [])

  const togglePin = useCallback(async (c: ConversationItem) => {
    if (source.mode() === 'legacy' || c.readOnly === 'support') return
    const want = !c.pinned
    const s0 = stateRef.current
    if (want && (s0.summary?.pinned ?? s0.pinned.length) >= MAX_PINS && !s0.pinned.some(p => p.id === c.id) && !c.pinned) { setPinError('Chỉ ghim tối đa 10 cuộc trò chuyện. Hãy bỏ ghim một cuộc trước.'); return }
    setPinError(null)
    const flip = (x: ConversationItem) => (x.id === c.id ? { ...x, pinned: want } : x)
    // lạc quan: ghim → lên mục Đã ghim; bỏ ghim → về danh sách theo giờ
    setState(s => searching
      ? { ...s, items: s.items.map(flip) }
      : want
        ? { ...s, items: s.items.filter(x => x.id !== c.id), pinned: [{ ...c, pinned: true }, ...s.pinned.filter(x => x.id !== c.id)] }
        : { ...s, pinned: s.pinned.filter(x => x.id !== c.id), items: mergePages(s.items, [{ ...c, pinned: false }]) })
    const r = await source.pin(c.id, want)
    if (!r.ok) { setPinError(r.message); setState(s0) }   // hoàn tác
    void refreshRef.current()
  }, [source, searching])

  const busy = state.status === 'ready' && state.loadedKey !== filterKey
  return {
    state, busy, filter, rawQuery, searching, pinError,
    setKind: setKindState, setUnreadOnly, setQuery: setRawQuery,
    clearFilters: () => { setKindState(DEFAULT_FILTER.kind); setUnreadOnly(false); setRawQuery('') },
    loadMore, reload, retry, togglePin, dismissPinError: () => setPinError(null),
  }
}
