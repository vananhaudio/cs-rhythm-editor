// Khung Mira cạnh màn chấm bài (chỉ Thầy/admin, chỉ web, chỉ khi build bật VITE_MIRA_GRADING_URL).
// Class chỉ nói cho Mira "Thầy đang mở bài trả này" — Mira tự tra ngữ cảnh. Chạy hỏng/chưa bật thì màn chấm bài vẫn y nguyên.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { acceptChildMessage, PROTOCOL_VERSION, type ClearMessage, type ContextMessage } from './protocol'
import { createDockController, type DockStatus } from './controller'
import type { MiraGradingApi } from './api'

const WIDE = '(min-width: 1200px)'
// Không có matchMedia (môi trường kiểm thử) → coi như màn rộng.
const subscribeWide = (cb: () => void) => { if (typeof window.matchMedia !== 'function') return () => {}; const m = window.matchMedia(WIDE); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb) }
const isWide = () => (typeof window.matchMedia === 'function' ? window.matchMedia(WIDE).matches : true)
const COLLAPSE_KEY = 'cs-mira-dock-collapsed'
const readCollapsed = () => { try { return localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false } }
const STATUS_TEXT: Partial<Record<DockStatus, string>> = {
  unavailable: 'Mira chưa sẵn sàng cho màn này. Màn chấm bài vẫn dùng bình thường.',
  error: 'Chưa kết nối được Mira. Thầy có thể tiếp tục chấm bài; Mira sẽ thử lại khi Thầy đổi bài trả.',
  loading: 'Đang kết nối Mira với bài trả này…',
}

/** Tắt (cfg null hoặc enabled=false) → chỉ render children, y hệt khi chưa có tính năng. */
export default function DockView({ enabled, cfg, api, threadId, children }: {
  enabled: boolean; cfg: { url: string; origin: string } | null; api: MiraGradingApi; threadId: string; children: ReactNode
}) {
  if (!enabled || !cfg) return <>{children}</>
  return <Dock url={cfg.url} origin={cfg.origin} api={api} threadId={threadId}>{children}</Dock>
}

function Dock({ url, origin, api, threadId, children }: { url: string; origin: string; api: MiraGradingApi; threadId: string; children: ReactNode }) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [open, setOpen] = useState(false)              // nhỏ: ngăn đang mở
  const [everOpened, setEverOpened] = useState(false)  // giữ iframe sau lần mở đầu để không tải lại giữa cuộc
  const [collapsed, setCollapsed] = useState(readCollapsed)   // desktop: thu gọn cột Mira
  const [status, setStatus] = useState<DockStatus>('idle')
  const wide = useSyncExternalStore(subscribeWide, isWide, () => true)
  const ctl = useRef<ReturnType<typeof createDockController> | null>(null)
  // Màn rộng: nạp Mira ngay. Màn nhỏ: CHỈ nạp sau khi Thầy bấm nút Mira (không tốn mạng, không mở cuộc trao đổi khi chưa cần).
  const denied = status === 'denied'                   // server từ chối (không/không còn trong pilot): ẩn hẳn, không nạp Mira
  const active = !denied && ((wide && !collapsed) || everOpened)

  const post = useCallback((m: ContextMessage | ClearMessage) => {
    frameRef.current?.contentWindow?.postMessage(m, origin)   // đích CỤ THỂ, không '*'
  }, [origin])

  useEffect(() => {
    const c = createDockController({ api, post, onStatus: setStatus })
    ctl.current = c
    const onMsg = (ev: MessageEvent) => {
      const m = acceptChildMessage(ev, { child: frameRef.current?.contentWindow ?? null, origin })
      if (m) c.onChild(m)
    }
    window.addEventListener('message', onMsg)
    return () => { window.removeEventListener('message', onMsg); c.dispose(); ctl.current = null }
  }, [post, origin, api])

  useEffect(() => { ctl.current?.setThread(threadId) }, [threadId])

  const toggleCollapse = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0') } catch { /* không lưu được thì thôi */ }
  }
  const openSheet = () => { setEverOpened(true); setOpen(true) }
  const statusText = STATUS_TEXT[status]

  return (
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
  )
}
