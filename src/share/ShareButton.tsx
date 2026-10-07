// Nút "Chia sẻ" cho object có QUYỀN RIÊNG (lớp, buổi học…): chỉ gửi THAM CHIẾU cho bạn bè qua Chat (không đăng cộng đồng, không tạo artifact).
// Bấm → chọn thẳng bạn (một lựa chọn hợp lệ → không menu). Quyền xem của người nhận do CHÍNH object quyết; người gửi phải có quyền (server kiểm).
import { lazy, Suspense, useState } from 'react'
import type { ShareRef } from './shareRef'

const ShareSheet = lazy(() => import('./ShareSheet'))

export default function ShareButton({ target, title, className = 'cs-btn cs-btn-ghost cs-btn-sm', label = 'Chia sẻ' }: { target: ShareRef; title: string; className?: string; label?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={className + ' cs-share-btn'} onClick={() => setOpen(true)}>{label}</button>
      {open && (
        <Suspense fallback={null}>
          <ShareSheet title={title} target={target} canPublish={false}
            ensureTarget={async () => ({ ok: true, target })} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  )
}
