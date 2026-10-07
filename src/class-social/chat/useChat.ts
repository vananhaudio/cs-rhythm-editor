// Hook Trò chuyện V1a. Chỉ biết interface ChatLive (polling hôm nay, realtime sau này) — không đụng timer/mạng trực tiếp.
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchConversations, fetchMessages, fetchUnreadCount, markRead, sendMessage } from './chatApi'
import { pollingLive, type ChatLive } from './chatLive'
import { PAGE, lastSeqOf, firstSeqOf, mergeMessages, normalizeBody, type ChatMessage, type ConversationItem, type PendingMessage } from './chatModel'

/** Số hội thoại chưa đọc cho badge menu — MỘT nguồn ở SignedInShell */
export function useChatUnread(live: ChatLive = pollingLive) {
  const [count, setCount] = useState(0)
  useEffect(() => live.watchUnread(setCount), [live])
  const refresh = useCallback(async () => {
    const r = await fetchUnreadCount()
    if (r.ok) setCount(r.value)
  }, [])
  return { count, refresh }
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
