// Trạng thái Trả/Hỏi bài của MỘT bài cho người đang đăng nhập (RPC lt_lessons_state).
// null = chưa tải / lỗi / tắt → khu vực Learning Thread ẨN (lỗi mạng hay RPC chưa có không phá bài học).
import { useCallback, useEffect, useState } from 'react'
import { fetchLessonStates } from './ltApi'
import type { LessonThreadState } from './ltModel'

export function useLessonThreadState(lessonId: string | null, enabled = true) {
  const [loaded, setLoaded] = useState<{ key: string; state: LessonThreadState | null } | null>(null)
  const [rev, setRev] = useState(0)
  useEffect(() => {
    if (!lessonId || !enabled) return
    let alive = true
    void fetchLessonStates([lessonId]).then(r => {
      if (alive) setLoaded({ key: lessonId, state: r.ok ? r.value.get(lessonId) ?? null : null })
    })
    return () => { alive = false }
  }, [lessonId, enabled, rev])
  const reload = useCallback(() => setRev(x => x + 1), [])
  const state = enabled && lessonId && loaded?.key === lessonId ? loaded.state : null
  return { state, reload }
}
