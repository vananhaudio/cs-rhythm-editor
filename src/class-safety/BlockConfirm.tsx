// Xác nhận Chặn / Bỏ chặn một người dùng, có giải thích hệ quả (class_block_user / class_unblock_user).
import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { blockUser, unblockUser } from './api'
import { markBlocked, markUnblocked } from './blockedStore'

export default function BlockConfirm({ userId, name, unblock = false, onClose, onDone }: {
  userId: string; name: string; unblock?: boolean; onClose: () => void; onDone?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const lock = useRef(false)

  const run = async () => {
    if (lock.current) return
    lock.current = true; setBusy(true); setErr('')
    const r = await (unblock ? unblockUser(userId) : blockUser(userId))
    lock.current = false; setBusy(false)
    if (!r.ok) { setErr(r.message); return }
    if (unblock) markUnblocked(userId); else markBlocked(userId)
    onDone?.()
    onClose()
  }

  return createPortal(
    <div className="csafe-layer" onClick={() => { if (!lock.current) onClose() }}>
      <div className="csafe-sheet" role="alertdialog" aria-modal="true" aria-label={unblock ? 'Bỏ chặn' : 'Chặn người dùng'} onClick={e => e.stopPropagation()}>
        <h2>{unblock ? `Bỏ chặn ${name}?` : `Chặn ${name}?`}</h2>
        <p className="csafe-sub">
          {unblock
            ? 'Bạn và người này sẽ có thể thấy nội dung của nhau và nhắn tin lại. Quan hệ bạn bè đã huỷ trước đó không tự khôi phục.'
            : 'Bạn sẽ không còn thấy bài đăng, bình luận và tin nhắn của người này, và họ cũng không thấy của bạn. Quan hệ bạn bè (nếu có) sẽ bị huỷ. Việc học và lớp của bạn không bị ảnh hưởng. Bạn có thể bỏ chặn trong Tôi → Tài khoản & cài đặt.'}
        </p>
        {err && <div className="csafe-err" role="alert">{err}</div>}
        <button type="button" className={'csafe-btn ' + (unblock ? 'primary' : 'danger')} onClick={() => void run()} disabled={busy}>
          {busy ? 'Đang xử lý…' : err ? 'Thử lại' : unblock ? 'Bỏ chặn' : 'Chặn'}
        </button>
        <button type="button" className="csafe-btn" onClick={onClose} disabled={busy}>Huỷ</button>
      </div>
    </div>,
    document.body,
  )
}
