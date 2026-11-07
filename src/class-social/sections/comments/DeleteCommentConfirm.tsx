// Hộp xác nhận xoá bình luận (thay window.confirm) — dùng ConfirmDialog chung của /me (Huỷ trái · Xoá đỏ phải; Esc / bấm nền = Huỷ).
// Chống xoá trùng (khoá + nút bận). Thất bại → hộp GIỮ nguyên, hiện lý do, nút đổi thành "Thử lại"; thành công → tự đóng.
import { useRef, useState } from 'react'
import { ConfirmDialog } from '../../ui'

/** Thông báo lỗi chung của API bình luận nói về việc GỬI → đổi sang lời nói về việc XOÁ (các lỗi khác giữ nguyên). */
export function deleteErrorText(m: string): string {
  if (/Không có mạng/.test(m)) return 'Không có mạng — chưa xoá được. Hãy thử lại khi có mạng.'
  if (/Chưa gửi được|vẫn được giữ/.test(m)) return 'Chưa xoá được. Hãy thử lại sau.'
  return m
}

export default function DeleteCommentConfirm({ isReply, onConfirm, onClose }: {
  isReply: boolean
  /** null = đã xoá; chuỗi = lý do thất bại */
  onConfirm: () => Promise<string | null>
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const lock = useRef(false)
  const run = async () => {
    if (lock.current) return
    lock.current = true; setBusy(true); setErr(null)
    let e: string | null
    try { e = await onConfirm() } catch { e = 'Chưa xoá được. Hãy thử lại.' }
    lock.current = false; setBusy(false)
    if (e) { setErr(deleteErrorText(e)); return }
    onClose()
  }
  // KHÔNG nêu số trả lời: màn hình chỉ biết những dòng đang nhìn thấy (trả lời bị ẩn / của người bị chặn / chưa tải vẫn bị xoá cascade).
  const lead = isReply
    ? 'Trả lời này sẽ bị xoá, cùng mọi trả lời bên dưới nó (nếu có). Không thể khôi phục.'
    : 'Bình luận này sẽ bị xoá, cùng mọi trả lời bên dưới (nếu có). Không thể khôi phục.'
  return (
    <ConfirmDialog title={isReply ? 'Xoá trả lời này?' : 'Xoá bình luận này?'} confirmLabel={err ? 'Thử lại' : 'Xoá'} danger busy={busy}
      onConfirm={() => void run()} onCancel={onClose}>
      {lead}
      {err && <span className="cs-confirm-err" role="alert">{err}</span>}
    </ConfirmDialog>
  )
}
