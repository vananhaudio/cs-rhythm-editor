// /hopam/<versionId> — trang CHỈ-XEM cho học viên đăng nhập: mở Play Scroll của MỘT phiên bản hợp âm đã duyệt (từ thẻ trên tường / Chat).
// Không có trình sửa, không có /thuvien, không quản trị. Quyền đọc do RPC chord_sheet_get quyết ở máy chủ (chỉ bản approved cho học viên);
// URL đoán/đổi id → máy chủ trả NOT_FOUND → "không còn khả dụng". Không tự phát nhạc khi mở.
import { useMemo } from 'react'
import RhythmScrollPage from './RhythmScrollPage.tsx'
import { getChordLibrary } from './chordLibrary.ts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const hopamVersionFromPath = (path: string): string | null => {
  const m = /^\/hopam\/([^/]+)\/?$/.exec(path)
  return m && UUID_RE.test(m[1]) ? m[1].toLowerCase() : null
}

export default function HopamViewPage({ versionId }: { versionId: string }) {
  const library = useMemo(() => getChordLibrary(), [])
  const back = () => { if (window.history.length > 1) window.history.back(); else window.location.href = '/me' }
  return <RhythmScrollPage key={versionId} library={library} versionId={versionId} onBack={back} branded />
}
