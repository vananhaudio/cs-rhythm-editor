// Hook Trò chuyện V1a. Chỉ biết interface ChatLive (polling hôm nay, realtime sau này) — không đụng timer/mạng trực tiếp.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { fetchConversations, fetchMessages, fetchSystemNotices, fetchSystemSummary, fetchUnreadCount, markRead, markSystemRead, sendMessage } from './chatApi'
import { pollingLive, type ChatLive } from './chatLive'
import { createNoticeSoundGate, getSoundEnabled, installAudioUnlock, onNoticeAudioReady, playPendingNotice, subscribeSound, tryResumeNoticeAudio, writeSoundEnabled } from './noticeSound'
import { PAGE, lastSeqOf, firstSeqOf, mergeMessages, mergeNotices, normalizeBody, NOTICE_PAGE, type ChatMessage, type ConversationItem, type PendingMessage, type SystemNotice, type SystemSummary } from './chatModel'

/** Badge menu Trò chuyện — MỘT nguồn ở SignedInShell: hội thoại cá nhân chưa đọc (dm) + thông báo Class 2.0 chưa đọc (tách trạng thái đọc). */
export function useChatUnread(live: ChatLive = pollingLive) {
  const [dm, setDm] = useState(0)
  const [system, setSystem] = useState<SystemSummary | null>(null)
  useEffect(() => live.watchUnread(setDm), [live])
  useEffect(() => live.watchSystem?.(setSystem) ?? (() => {}), [live])
  // Sound V1: tiếng "ting" khi có thông báo Class 2.0 MỚI (so với mốc phiên) — dùng chính tóm tắt đang polling
  const gate = useRef(createNoticeSoundGate())
  useEffect(() => installAudioUnlock(), [])
  // Tóm tắt mới → ghi nhận; kêu ngay nếu đủ điều kiện, nếu không thì GIỮ chờ (tab ẩn / âm thanh chưa mở khoá / iOS ngắt)
  useEffect(() => { gate.current.observe(system); playPendingNotice(gate.current) }, [system])
  useEffect(() => {
    const retry = () => { tryResumeNoticeAudio(); playPendingNotice(gate.current) }
    const offAudio = onNoticeAudioReady(() => { playPendingNotice(gate.current) })
    const offSound = subscribeSound(() => { if (!getSoundEnabled()) gate.current.clear() })   // Tắt → không phát bù khi bật lại
    document.addEventListener('visibilitychange', retry)
    window.addEventListener('focus', retry)
    window.addEventListener('pageshow', retry)
    return () => {
      offAudio(); offSound()
      document.removeEventListener('visibilitychange', retry)
      window.removeEventListener('focus', retry)
      window.removeEventListener('pageshow', retry)
    }
  }, [])
  const refresh = useCallback(async () => {
    const [a, b] = await Promise.all([fetchUnreadCount(), fetchSystemSummary()])
    if (a.ok) setDm(a.value)
    setSystem(b.ok ? b.value : null)
  }, [])
  return { count: dm + (system?.unread ?? 0), system, refresh }
}

/** Công tắc "Âm thanh thông báo" (lưu trên thiết bị). Bật bằng thao tác người dùng ⇒ cũng mở khoá âm thanh trình duyệt. */
export function useNoticeSound() {
  const enabled = useSyncExternalStore(subscribeSound, getSoundEnabled, () => true)
  const set = useCallback((on: boolean) => { writeSoundEnabled(on) }, [])
  return { enabled, set }
}

export type ListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; items: ConversationItem[] }

export function useConversationList(live: ChatLive = pollingLive) {
  const [state, setState] = useState<ListState>({ status: 'loading' })
  const apply = useCallback((r: Awaited<ReturnType<typeof fetchConversations>>) => {
    setState(prev => r.ok ? { status: 'ready', items: r.value } : prev.status === 'ready' ? prev : { status: 'error', message: r.message })
  }, [])
  useEffect(() => live.watchList(apply), [live, apply])
  const reload = useCallback(async () => { apply(await fetchConversations()) }, [apply])
  const retry = useCallback(() => { setState({ status: 'loading' }); void reload() }, [reload])
  return { state, reload, retry }
}

export type ConversationState = {
  status: 'loading' | 'ready' | 'error' | 'notfound'
  error: string | null
  messages: ChatMessage[]
  pending: PendingMessage[]
  hasMore: boolean
  loadingOlder: boolean
  send: (body: string) => void
  retry: (localId: string) => void
  discard: (localId: string) => void
  loadOlder: () => Promise<void>
  reload: () => void
}

const NOT_FOUND = 'Không tìm thấy cuộc trò chuyện.'

/** Một hội thoại đang mở: trang mới nhất → polling chỉ tin mới → đánh dấu đã đọc → gửi tin (lạc quan, tuần tự) */
export function useConversation(id: string, onActivity: () => void, live: ChatLive = pollingLive): ConversationState {
  const [status, setStatus] = useState<ConversationState['status']>('loading')
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pending, setPending] = useState<PendingMessage[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [rev, setRev] = useState(0)

  const messagesRef = useRef<ChatMessage[]>([])
  const markedRef = useRef(0)
  const queueRef = useRef<Promise<void>>(Promise.resolve())
  const pendingRef = useRef<PendingMessage[]>([])
  const activityRef = useRef(onActivity)
  useEffect(() => { activityRef.current = onActivity }, [onActivity])
  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { pendingRef.current = pending }, [pending])

  // Mở hội thoại: tải trang mới nhất. Nơi dùng PHẢI đặt key={id} (đổi hội thoại = mount lại → state sạch).
  useEffect(() => {
    let alive = true
    markedRef.current = 0
    messagesRef.current = []
    void fetchMessages(id, { limit: PAGE }).then(r => {
      if (!alive) return
      if (r.ok) { setMessages(r.value); messagesRef.current = r.value; setHasMore(r.value.length >= PAGE && firstSeqOf(r.value) > 1); setStatus('ready') }
      else if (r.message === NOT_FOUND) setStatus('notfound')
      else { setError(r.message); setStatus('error') }
    })
    return () => { alive = false }
  }, [id, rev])

  // Tin mới (polling): chỉ hỏi seq > đã có
  useEffect(() => {
    if (status !== 'ready') return
    return live.watchConversation(id, () => lastSeqOf(messagesRef.current), r => {
      if (!r.ok || r.value.length === 0) return
      setMessages(prev => { const next = mergeMessages(prev, r.value); messagesRef.current = next; return next })
      activityRef.current()
    })
  }, [id, status, live])

  // Đã đọc tới tin cuối khi tab đang hiển thị
  const lastSeq = lastSeqOf(messages)
  useEffect(() => {
    if (status !== 'ready' || lastSeq <= markedRef.current) return
    const mark = () => {
      if (document.visibilityState === 'hidden' || lastSeq <= markedRef.current) return
      markedRef.current = lastSeq
      void markRead(id, lastSeq).then(r => { if (r.ok) activityRef.current(); else markedRef.current = 0 })
    }
    mark()
    document.addEventListener('visibilitychange', mark)
    return () => document.removeEventListener('visibilitychange', mark)
  }, [id, status, lastSeq])

  const deliver = useCallback((localId: string, body: string) => {
    queueRef.current = queueRef.current.then(async () => {
      setPending(ps => ps.map(p => p.localId === localId ? { ...p, state: 'sending' } : p))
      const r = await sendMessage(id, body)
      if (r.ok) {
        setPending(ps => ps.filter(p => p.localId !== localId))
        const more = await fetchMessages(id, { afterSeq: lastSeqOf(messagesRef.current), limit: 100 })
        if (more.ok) setMessages(prev => { const next = mergeMessages(prev, more.value); messagesRef.current = next; return next })
        activityRef.current()
      } else {
        setError(r.message)
        setPending(ps => ps.map(p => p.localId === localId ? { ...p, state: 'failed' } : p))
      }
    })
  }, [id])

  const send = useCallback((body: string) => {
    const text = normalizeBody(body)
    if (!text) return
    const localId = `L${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setError(null)
    setPending(ps => [...ps, { localId, body: text, state: 'sending' }])
    deliver(localId, text)
  }, [deliver])

  const retry = useCallback((localId: string) => {
    const hit = pendingRef.current.find(x => x.localId === localId)
    if (!hit || hit.state === 'sending') return
    setError(null)
    deliver(localId, hit.body)
  }, [deliver])
  const discard = useCallback((localId: string) => setPending(ps => ps.filter(p => p.localId !== localId)), [])

  const loadOlder = useCallback(async () => {
    const first = firstSeqOf(messagesRef.current)
    if (loadingOlder || first <= 1) return
    setLoadingOlder(true)
    const r = await fetchMessages(id, { beforeSeq: first, limit: PAGE })
    if (r.ok) {
      setMessages(prev => { const next = mergeMessages(prev, r.value); messagesRef.current = next; return next })
      setHasMore(r.value.length >= PAGE && firstSeqOf(r.value) > 1)
    } else setError(r.message)
    setLoadingOlder(false)
  }, [id, loadingOlder])

  const reload = useCallback(() => { setStatus('loading'); setError(null); setRev(x => x + 1) }, [])
  return { status, error, messages, pending, hasMore, loadingOlder, send, retry, discard, loadOlder, reload }
}

export type SystemNoticesState = {
  status: 'loading' | 'ready' | 'error'
  error: string | null
  notices: SystemNotice[]
  hasMore: boolean
  loadingOlder: boolean
  loadOlder: () => Promise<void>
  reload: () => void
}

/** Màn Class 2.0: trang mới nhất → làm mới định kỳ → đánh dấu đã đọc tới thông báo mới nhất (chỉ khi màn này đang mở). */
export function useSystemNotices(onActivity: () => void): SystemNoticesState {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; error: string | null; notices: SystemNotice[]; hasMore: boolean }>(
    { status: 'loading', error: null, notices: [], hasMore: false })
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [rev, setRev] = useState(0)
  const marked = useRef(0)
  const noticesRef = useRef<SystemNotice[]>([])
  noticesRef.current = state.notices

  useEffect(() => {
    let alive = true
    void fetchSystemNotices({ limit: NOTICE_PAGE }).then(r => {
      if (!alive) return
      if (!r.ok) { setState(s => ({ ...s, status: s.status === 'ready' ? 'ready' : 'error', error: r.message })); return }
      setState(s => ({ status: 'ready', error: null, notices: mergeNotices(s.notices, r.value), hasMore: s.status === 'ready' ? s.hasMore : r.value.length >= NOTICE_PAGE }))
    })
    return () => { alive = false }
  }, [rev])

  // Làm mới nhẹ (thông báo mới tới khi đang mở màn): cùng nhịp với danh sách
  useEffect(() => {
    const stop = (pollingLive.watchSystem ? pollingLive.watchSystem(sum => {
      const have = noticesRef.current.at(-1)?.seq ?? 0
      if (sum && sum.lastSeq > have) setRev(x => x + 1)
    }) : () => {})
    return stop
  }, [])

  // Đã đọc: chỉ khi màn đang mở, tới thông báo mới nhất đã hiện; chỉ tăng, không lặp lại
  useEffect(() => {
    const top = state.notices.at(-1)?.seq ?? 0
    if (state.status !== 'ready' || top === 0 || top <= marked.current) return
    marked.current = top
    void markSystemRead(top).then(r => { if (r.ok) onActivity(); else marked.current = 0 })
  }, [state.status, state.notices, onActivity])

  const loadOlder = useCallback(async () => {
    const first = noticesRef.current[0]?.seq
    if (!first || loadingOlder) return
    setLoadingOlder(true)
    const r = await fetchSystemNotices({ beforeSeq: first, limit: NOTICE_PAGE })
    setLoadingOlder(false)
    if (!r.ok) { setState(s => ({ ...s, error: r.message })); return }
    setState(s => ({ ...s, error: null, notices: mergeNotices(s.notices, r.value.map(n => ({ ...n, unread: false }))), hasMore: r.value.length >= NOTICE_PAGE }))
  }, [loadingOlder])

  const reload = useCallback(() => { setState(s => ({ ...s, status: 'loading', error: null })); setRev(x => x + 1) }, [])
  return { ...state, loadingOlder, loadOlder, reload }
}
