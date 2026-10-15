// /hopam/<versionId> — trang CHỈ-XEM cho học viên đăng nhập: mở Play Scroll của MỘT phiên bản hợp âm đã duyệt (từ thẻ trên tường / Chat).
// Không có trình sửa, không có /thuvien, không quản trị. Quyền đọc do RPC chord_sheet_get quyết ở máy chủ (chỉ bản approved cho học viên);
// URL đoán/đổi id → máy chủ trả NOT_FOUND → "không còn khả dụng". Không tự phát nhạc khi mở.
import { useEffect, useMemo, useState } from 'react'
import RhythmScrollPage from './RhythmScrollPage.tsx'
import { getChordLibrary } from './chordLibrary.ts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const hopamVersionFromPath = (path: string): string | null => {
  const m = /^\/hopam\/([^/]+)\/?$/.exec(path)
  return m && UUID_RE.test(m[1]) ? m[1].toLowerCase() : null
}

/**
 * Quyền tạo video (V1, CHƯA có RPC kiểm quyền được duyệt): chỉ Admin hệ thống (app_users.role = 'admin', RLS đọc hàng của chính mình).
 * Học viên/thành viên Band KHÔNG thấy hành động này cho tới khi backend kiểm quyền xuất được Owner duyệt.
 */
export function useVideoExportAccess(): 'full' | undefined {
  const [access, setAccess] = useState<'full' | undefined>(undefined)
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const { supabase } = await import('../supabase.ts')
        const { data: auth } = await supabase.auth.getUser()
        const uid = auth.user?.id
        if (!uid) return
        const { data } = await supabase.from('app_users').select('role').eq('id', uid).maybeSingle<{ role: string | null }>()
        if (alive && data?.role === 'admin') setAccess('full')
      } catch { /* không có quyền → không hiện */ }
    })()
    return () => { alive = false }
  }, [])
  return access
}

export default function HopamViewPage({ versionId }: { versionId: string }) {
  const library = useMemo(() => getChordLibrary(), [])
  const videoExport = useVideoExportAccess()
  const back = () => { if (window.history.length > 1) window.history.back(); else window.location.href = '/me' }
  return <RhythmScrollPage key={versionId} library={library} versionId={versionId} onBack={back} branded videoExport={videoExport} />
}
