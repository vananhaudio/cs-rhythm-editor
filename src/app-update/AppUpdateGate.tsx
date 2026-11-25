// Cổng cập nhật: chỉ gắn trong app native. Kiểm khi mở app và mỗi lần quay lại.
import { useCallback, useEffect, useRef, useState } from 'react'
import { checkForUpdate, type UpdateDeps } from './check'
import { SNOOZE_MS, isSnoozed, parseSnooze, type Decision } from './policy'

export const SNOOZE_KEY = 'tva-app-update-snooze'
/** Quay lại app liên tục (đổi qua lại giữa hai app) → không hỏi máy chủ quá dày. */
const MIN_GAP_MS = 60_000

const readSnooze = () => { try { return parseSnooze(localStorage.getItem(SNOOZE_KEY)) } catch { return null } }

export default function AppUpdateGate({ deps, openStore, now = Date.now }: {
  deps: UpdateDeps; openStore: () => Promise<void>; now?: () => number
}) {
  const [shown, setShown] = useState<Exclude<Decision, { kind: 'none' }> | null>(null)
  const [openFailed, setOpenFailed] = useState(false)
  const last = useRef(-Infinity)
  const busy = useRef(false)
  const forced = useRef(false)

  const run = useCallback(async () => {
    if (busy.current) return
    // Đang khoá bắt buộc → kiểm lại ngay (Owner vừa tắt, hoặc học viên vừa quay về từ kho)
    if (!forced.current && now() - last.current < MIN_GAP_MS) return
    busy.current = true
    last.current = now()
    const d = await checkForUpdate(deps)
    busy.current = false
    const next = d.kind === 'none' || isSnoozed(d, readSnooze(), now()) ? null : d
    forced.current = next?.kind === 'force'
    setShown(next)
  }, [deps, now])

  useEffect(() => {
    void run()
    const onVisible = () => { if (document.visibilityState === 'visible') void run() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [run])

  if (!shown) return null
  const force = shown.kind === 'force'
  const later = () => {
    try { localStorage.setItem(SNOOZE_KEY, JSON.stringify({ target: shown.target, until: now() + SNOOZE_MS })) } catch { /* không lưu được → lần kiểm sau báo lại */ }
    setShown(null)
  }
  const update = () => { setOpenFailed(false); void openStore().catch(() => setOpenFailed(true)) }

  return (
    <div className={force ? 'au-backdrop is-force' : 'au-backdrop'}>
      <div className="au-alert" role="alertdialog" aria-modal="true" aria-labelledby="au-title" aria-describedby="au-body">
        <div className="au-text">
          <h2 id="au-title">{force ? 'Cần cập nhật ứng dụng' : 'Đã có phiên bản mới'}</h2>
          <p id="au-body">
            {force
              ? 'Phiên bản đang dùng không còn được hỗ trợ. Bạn vui lòng cập nhật TVA Guitar để tiếp tục.'
              : `TVA Guitar${shown.version ? ` ${shown.version}` : ''} đã sẵn sàng để tải về.`}
          </p>
          {shown.notes && <p className="au-notes">{shown.notes}</p>}
          {openFailed && <p className="au-error" role="alert">Chưa mở được kho ứng dụng. Bạn mở App Store hoặc CH Play và tìm “Thầy Văn Anh Guitar”.</p>}
        </div>
        <div className="au-actions">
          <button type="button" className="au-primary" onClick={update}>Cập nhật ngay</button>
          {!force && <button type="button" onClick={later}>Để sau</button>}
        </div>
      </div>
    </div>
  )
}
