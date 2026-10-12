import { useEffect, useState } from 'react'
import ThuVienPage from './ThuVienPage.tsx'
import { canAddToLibrary } from './masterLibrary.ts'

/**
 * Cổng /thuvien cho tài khoản KHÔNG phải admin: chỉ người đang giữ vai Biên tập âm nhạc (ít nhất một Band) vào được,
 * và chỉ thấy mục MusicXML (xem / nạp / sửa-gỡ bài của mình). Người khác về /start như trước.
 * Quyền thật vẫn do RLS ở musicxml_library; cổng này chỉ quyết định có hiện trang hay không.
 */
export default function ThuVienEditorGate({ userId }: { userId: string }) {
  const [allowed, setAllowed] = useState(false)
  useEffect(() => {
    let alive = true
    void canAddToLibrary(userId, false).then(ok => {
      if (!alive) return
      if (ok) setAllowed(true)
      else window.location.href = '/start'
    })
    return () => { alive = false }
  }, [userId])
  if (!allowed) return <div style={{ padding: 32 }}>Đang mở thư viện…</div>
  return <ThuVienPage musicXmlOnly />
}
