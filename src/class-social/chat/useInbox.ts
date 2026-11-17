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
import { loadInboxHead } from './inboxLoad'
import { getInboxCache, putInboxCache } from './inboxCache'

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

export function useInbox(source: InboxSource = defaultInboxSource, opts: { scope?: InboxScope; pageSize?: number; kind?: InboxKind; /** id người dùng — bật bộ nhớ đệm mở-lần-sau (không có = không cache) */ cacheUser?: string } = {}) {
  const scope: InboxScope = opts.scope ?? 'mine'
  const pageSize = opts.pageSize ?? INBOX_PAGE
  const [state, setState] = useState<InboxState>(() => {
    const k = `${scope}|${opts.kind ?? 'all'}|false|`
    const c = source.mode() === 'server' ? getInboxCache(opts.cacheUser, k) : null
    return c ? { ...INITIAL, ...c, status: 'ready', loadedKey: k, mode: 'server' } : INITIAL
  })
  const [kind, setKindState] = useState<InboxKind>(opts.kind ?? 'all')
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

  // ghi đệm mỗi khi dữ liệu của bộ lọc hiện tại đã sẵn sàng (lần sau mở Chat hiện ngay)
  useEffect(() => {
    if (state.status === 'ready' && state.loadedKey === filterKey && source.mode() === 'server')
      putInboxCache(opts.cacheUser, filterKey, { pinned: state.pinned, items: state.items, hasMore: state.hasMore, summary: state.summary })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, filterKey, opts.cacheUser])

  useEffect(() => {
    let alive = true
    let first = true
    const tick = async (): Promise<boolean> => {
      const fresh = first; first = false
      return loadInboxHead({
        source, scope, filter, searching, pageSize, alive: () => alive,
        on: {
          // danh sách chính hiện NGAY khi chat_inbox trả về
          onMain: page => setState(s => {
            const keepDeep = !fresh && s.items.length > pageSize
            const pinnedIds = new Set(s.pinned.map(x => x.id))
            const merged = fresh ? page.items : mergePages(s.items, page.items)
            return {
              ...s, status: 'ready', error: null, loadedKey: filterKey, loadMoreError: null, mode: source.mode(),
              items: merged.filter(x => !pinnedIds.has(x.id)),
              hasMore: keepDeep ? s.hasMore : page.hasMore,
            }
          }),
          onMainError: message => setState(s => s.status === 'ready' && !fresh ? s : ({ ...s, status: s.items.length || s.pinned.length ? 'ready' : 'error', error: message })),
          onPinned: items => setState(s => {
            const ids = new Set(items.map(x => x.id))
            return { ...s, pinned: items, items: s.items.filter(x => !ids.has(x.id)) }
          }),
          onSummary: sum => setState(s => ({ ...s, summary: sum })),
        },
      })
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
