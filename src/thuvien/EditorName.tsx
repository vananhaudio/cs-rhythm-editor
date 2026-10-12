import { useEffect, useState } from 'react'
import { EDITOR_UNKNOWN, editorName } from './masterLibrary.ts'

/** "Người biên tập: <tên>" — người đưa bài vào Thư viện (created_by), không phải nhạc sĩ/tác giả. Chỉ đọc, không sửa được. */
export default function EditorName({ userId, className = 'tv-editor' }: { userId: string | null | undefined; className?: string }) {
  const [name, setName] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    setName(null)
    if (!userId) { setName(EDITOR_UNKNOWN); return }
    void editorName(userId).then(value => { if (alive) setName(value) })
    return () => { alive = false }
  }, [userId])
  return <small className={className}>Người biên tập: {name ?? '…'}</small>
}
