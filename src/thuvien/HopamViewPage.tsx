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

type VideoGrant = 'clip' | 'full' | undefined
type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> }

/**
 * Quyền tạo video do MÁY CHỦ quyết (RPC chord_video_export_ok: danh tính từ phiên, Admin = Full, thành viên Band = clip 14 giây).
 * Trình duyệt chỉ hiện/ẩn hành động; không gửi user, role hay thời lượng. Lỗi mạng/RPC → không cấp quyền.
 */
export async function fetchVideoGrant(versionId: string, client?: RpcClient): Promise<VideoGrant> {
  try {
    const c = client ?? (await import('../supabase.ts')).supabase as unknown as RpcClient
    const ask = async (mode: 'full' | 'clip') => {
      const { data, error } = await c.rpc('chord_video_export_ok', { p_version: versionId, p_mode: mode })
      return !error && (data as { ok?: boolean } | null)?.ok === true
    }
    if (await ask('full')) return 'full'
    if (await ask('clip')) return 'clip'
  } catch { /* không xác minh được → không hiện */ }
  return undefined
}

export function useVideoExportAccess(versionId: string): VideoGrant {
  const [grant, setGrant] = useState<VideoGrant>(undefined)
  useEffect(() => {
    let alive = true
    setGrant(undefined)
    void fetchVideoGrant(versionId).then(g => { if (alive) setGrant(g) })
    return () => { alive = false }
  }, [versionId])
  return grant
}

export default function HopamViewPage({ versionId }: { versionId: string }) {
  const library = useMemo(() => getChordLibrary(), [])
  const videoExport = useVideoExportAccess(versionId)
  const back = () => { if (window.history.length > 1) window.history.back(); else window.location.href = '/me' }
  return <RhythmScrollPage key={versionId} library={library} versionId={versionId} onBack={back} branded videoExport={videoExport} videoRecheck={() => fetchVideoGrant(versionId)} />
}
