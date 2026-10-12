import { useEffect, useState } from 'react'
import ThuVienPage from './ThuVienPage.tsx'
import { thuVienAccess } from './masterLibrary.ts'
import type { ThuVienAccess } from './masterLibrary.ts'

/**
 * Cổng /thuvien cho tài khoản KHÔNG phải admin: chỉ người đang giữ vai Biên tập âm nhạc (đăng/sửa/gỡ bài của mình)
 * hoặc Trưởng Band (chỉ xem/tìm/dùng) vào được; người khác về /start như trước. Không thấy "Nâng cao" (/admin).
 * Quyền thật vẫn do máy chủ (RLS + RPC); cổng này chỉ quyết định có hiện trang và hiện những nút nào.
 */
export default function ThuVienEditorGate({ userId }: { userId: string }) {
  const [access, setAccess] = useState<ThuVienAccess | null>(null)
  useEffect(() => {
    let alive = true
    void thuVienAccess(userId).then(result => {
      if (!alive) return
      if (result) setAccess(result)
      else window.location.href = '/start'
    })
    return () => { alive = false }
  }, [userId])
  if (!access) return <div style={{ padding: 32 }}>Đang mở thư viện…</div>
  return <ThuVienPage access={access} />
}
