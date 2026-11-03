// Khung Mira cạnh màn chấm bài (chỉ Thầy/admin, chỉ web, chỉ khi build bật VITE_MIRA_GRADING_URL).
// Class chỉ nói cho Mira "Thầy đang mở bài trả này" — Mira tự tra ngữ cảnh. Chạy hỏng/chưa bật thì màn chấm bài vẫn y nguyên.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { acceptChildMessage, PROTOCOL_VERSION, type ClearMessage, type ContextMessage, type DraftResultMessage, type DraftStatus } from './protocol'
import { MiraDraftContext, type DraftOutcome, type MiraDraft } from './draftContext'
import { createDockController, type DockStatus } from './controller'
import type { MiraGradingApi } from './api'

const WIDE = '(min-width: 1200px)'
// Không có matchMedia (môi trường kiểm thử) → coi như màn rộng.
const subscribeWide = (cb: () => void) => { if (typeof window.matchMedia !== 'function') return () => {}; const m = window.matchMedia(WIDE); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb) }
const isWide = () => (typeof window.matchMedia === 'function' ? window.matchMedia(WIDE).matches : true)
/** Không có ô soạn nào nhận nháp trong khoảng này → báo 'unavailable' và bỏ nháp (không để nó điền muộn). */
export const DRAFT_ACK_TIMEOUT_MS = 2000
const COLLAPSE_KEY = 'cs-mira-dock-collapsed'
const readCollapsed = () => { try { return localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false } }
const STATUS_TEXT: Partial<Record<DockStatus, string>> = {
  unavailable: 'Mira chưa sẵn sàng cho màn này. Màn chấm bài vẫn dùng bình thường.',
  error: 'Chưa kết nối được Mira. Thầy có thể tiếp tục chấm bài; Mira sẽ thử lại khi Thầy đổi bài trả.',
  loading: 'Đang kết nối Mira với bài trả này…',
}

/** Tắt (cfg null hoặc enabled=false) → chỉ render children, y hệt khi chưa có tính năng. */
export default function DockView({ enabled, cfg, api, threadId, children, ackTimeoutMs = DRAFT_ACK_TIMEOUT_MS }: {
  enabled: boolean; cfg: { url: string; origin: string } | null; api: MiraGradingApi; threadId: string; children: ReactNode; ackTimeoutMs?: number
}) {
  if (!enabled || !cfg) return <>{children}</>
  return <Dock url={cfg.url} origin={cfg.origin} api={api} threadId={threadId} ackTimeoutMs={ackTimeoutMs}>{children}</Dock>
}

function Dock({ url, origin, api, threadId, children, ackTimeoutMs }: { url: string; origin: string; api: MiraGradingApi; threadId: string; children: ReactNode; ackTimeoutMs: number }) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [open, setOpen] = useState(false)              // nhỏ: ngăn đang mở
  const [everOpened, setEverOpened] = useState(false)  // giữ iframe sau lần mở đầu để không tải lại giữa cuộc
  const [collapsed, setCollapsed] = useState(readCollapsed)   // desktop: thu gọn cột Mira
  const [status, setStatus] = useState<DockStatus>('idle')
  const wide = useSyncExternalStore(subscribeWide, isWide, () => true)
  const ctl = useRef<ReturnType<typeof createDockController> | null>(null)
  const [draft, setDraft] = useState<MiraDraft | null>(null)
  const threadRef = useRef(threadId)
  const nRef = useRef(0)
  const finishRef = useRef<(n: number, s: DraftStatus) => void>(() => {})
  const ackTimeoutRef = useRef(ackTimeoutMs)
  useEffect(() => { ackTimeoutRef.current = ackTimeoutMs }, [ackTimeoutMs])
  // Yêu cầu nháp đang chờ kết quả: n → mã yêu cầu (rid) + mã bài lúc nhận. Kết quả chỉ gửi về khi còn khớp bài đang mở.
  const reqs = useRef(new Map<number, { rid: string; id: string; timer: ReturnType<typeof setTimeout> | null }>())
  // Màn rộng: nạp Mira ngay. Màn nhỏ: CHỈ nạp sau khi Thầy bấm nút Mira (không tốn mạng, không mở cuộc trao đổi khi chưa cần).
  const denied = status === 'denied'                   // server từ chối (không/không còn trong pilot): ẩn hẳn, không nạp Mira
  const active = !denied && ((wide && !collapsed) || everOpened)

  const post = useCallback((m: ContextMessage | ClearMessage) => {
    frameRef.current?.contentWindow?.postMessage(m, origin)   // đích CỤ THỂ, không '*'
  }, [origin])

  useEffect(() => {
    const c = createDockController({ api, post, onStatus: setStatus })
    ctl.current = c
    const reply0 = (id: string, rid: string, status: DraftStatus) => {
      const msg: DraftResultMessage = { v: 1, type: 'mira-draft-result', id, rid, status }
      frameRef.current?.contentWindow?.postMessage(msg, origin)   // đích CỤ THỂ, không '*'
    }
    // Kết thúc yêu cầu n: bỏ nháp khỏi hàng chờ và báo Mira — nhưng CHỈ khi còn đúng bài lúc nhận (không gửi kết quả cũ sang bài mới).
    const finish = (n: number, status: DraftStatus) => {
      const r = reqs.current.get(n); if (!r) return
      if (r.timer) clearTimeout(r.timer)
      reqs.current.delete(n)
      setDraft(d => (d && d.n === n ? null : d))
      if (r.id.toLowerCase() === threadRef.current.toLowerCase()) reply0(r.id, r.rid, status)
    }
    finishRef.current = finish
    const onMsg = (ev: MessageEvent) => {
      const m = acceptChildMessage(ev, { child: frameRef.current?.contentWindow ?? null, origin })
      if (!m) return
      if (m.type === 'mira-grading-draft') {
        const reply = (status: DraftStatus) => reply0(m.id, m.rid, status)
        // Chỉ nhận nháp của ĐÚNG bài đang mở ở Class; nháp mang mã bài khác (Mira chưa kịp đổi bài) bị từ chối.
        if (m.id.toLowerCase() !== threadRef.current.toLowerCase()) { reply('rejected'); return }
        // Nháp trước chưa ai nhận (ô chưa mount) bị nháp mới thay → báo 'declined' cho nháp trước.
        for (const [pn, r] of reqs.current) if (r.timer) finish(pn, 'declined')
        const n = ++nRef.current
        const timer = setTimeout(() => finish(n, 'unavailable'), ackTimeoutRef.current)
        reqs.current.set(n, { rid: m.rid, id: m.id, timer })
        setDraft({ threadId: threadRef.current, text: m.text, n })
        setOpen(false)   // màn nhỏ: đóng ngăn Mira để Thầy về lại ô phản hồi (màn rộng: không có ngăn)
        return
      }
      c.onChild(m)
    }
    window.addEventListener('message', onMsg)
    const pend = reqs.current
    return () => { window.removeEventListener('message', onMsg); c.dispose(); ctl.current = null; for (const r of pend.values()) if (r.timer) clearTimeout(r.timer); pend.clear() }
  }, [post, origin, api])

  useEffect(() => { ctl.current?.setThread(threadId) }, [threadId])
  // Đổi bài: huỷ nháp chưa dùng của bài cũ (không điền sang bài mới, kể cả khi quay lại bài cũ).
  useEffect(() => {
    threadRef.current = threadId
    // Đổi bài: mọi yêu cầu nháp đang chờ thuộc bài cũ bị huỷ, KHÔNG báo kết quả (Mira cũng bỏ yêu cầu của bài cũ).
    for (const r of reqs.current.values()) if (r.timer) clearTimeout(r.timer)
    reqs.current.clear()
  }, [threadId])
  const [draftThread, setDraftThread] = useState(threadId)
  if (draftThread !== threadId) { setDraftThread(threadId); setDraft(null) }   // đổi bài ngay trong lúc render: nháp cũ không tồn tại ở bài mới

  const toggleCollapse = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0') } catch { /* không lưu được thì thôi */ }
  }
  const openSheet = () => { setEverOpened(true); setOpen(true) }
  const statusText = STATUS_TEXT[status]
  const report = useCallback((n: number, o: DraftOutcome) => {
    if (o === 'received') {   // ô soạn đã nhận và đang hỏi Thầy: ngừng đếm giờ, giữ yêu cầu chờ kết quả cuối
      const r = reqs.current.get(n)
      if (r?.timer) { clearTimeout(r.timer); r.timer = null }
      setDraft(d => (d && d.n === n ? null : d))
      return
    }
    finishRef.current(n, o)
  }, [])
  const ctxValue = useMemo(() => ({ draft, report }), [draft, report])

  return (
    <MiraDraftContext.Provider value={ctxValue}>
    <div className={'mira-dock-wrap' + (collapsed ? ' is-collapsed' : '') + (denied ? ' is-denied' : '')} data-protocol={PROTOCOL_VERSION}>
      <div className="mira-dock-main">{children}</div>
      <div className={'mira-dock-backdrop' + (open ? ' is-open' : '')} onClick={() => setOpen(false)} aria-hidden="true" />
      <aside className={'mira-dock-panel' + (open ? ' is-open' : '') + (collapsed ? ' is-collapsed' : '')} aria-label="Mira — trao đổi khi chấm bài" data-testid="mira-panel">
        <div className="mira-dock-head">
          <b>Mira · trao đổi khi chấm bài</b>
          <button type="button" className="mira-dock-collapse" onClick={toggleCollapse} aria-label="Thu gọn Mira" title="Thu gọn">⇥</button>
          <button type="button" className="mira-dock-close" onClick={() => setOpen(false)} aria-label="Đóng Mira">✕</button>
        </div>
        {statusText && <p className="mira-dock-status" role="status">{statusText}</p>}
        <iframe ref={frameRef} className="mira-dock-frame" title="Mira · trao đổi khi chấm bài" src={active ? url : undefined}
          referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin" allow="" />
      </aside>
      <button type="button" className={'mira-dock-fab' + (collapsed ? ' is-desktop-collapsed' : ' desktop-hide')} hidden={open}
        onClick={() => { if (collapsed && wide) toggleCollapse(); else openSheet() }}>Mira</button>
    </div>
    </MiraDraftContext.Provider>
  )
}
