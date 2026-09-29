// Lớp của tôi + Khám phá — MỘT nguồn cho sidebar và trang /me/classes. Lỗi → danh sách rỗng (không phá khung).
import { useCallback, useEffect, useState } from 'react'
import { fetchDiscoverClasses, fetchMyClasses } from './classesApi'
import type { ClassCard } from './classModel'

export type SocialClasses = { loaded: boolean; mine: ClassCard[]; discover: ClassCard[]; error: string | null; reload: () => void }

export function useSocialClasses(): SocialClasses {
  const [state, setState] = useState<{ loaded: boolean; mine: ClassCard[]; discover: ClassCard[]; error: string | null }>(
    { loaded: false, mine: [], discover: [], error: null })
  const [rev, setRev] = useState(0)
  useEffect(() => {
    let alive = true
    void Promise.all([fetchMyClasses(), fetchDiscoverClasses()]).then(([m, d]) => {
      if (!alive) return
      setState({ loaded: true, mine: m.ok ? m.value : [], discover: d.ok ? d.value : [], error: !m.ok ? m.message : !d.ok ? d.message : null })
    })
    return () => { alive = false }
  }, [rev])
  const reload = useCallback(() => setRev(x => x + 1), [])
  return { ...state, reload }
}
