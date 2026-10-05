// Lớp của tôi + Khám phá — MỘT nguồn cho sidebar và trang /me/classes. Lỗi → danh sách rỗng (không phá khung).
// Thầy/admin (isTeacher): thêm `all` = MỌI lớp từ social_all_classes (quyền server, không phải membership) cho /me/classes;
// `mine` vẫn là lớp mình là thành viên (sidebar/Home/tab "Lớp" giữ đúng nghĩa). Thầy không cần "Khám phá".
import { useCallback, useEffect, useState } from 'react'
import { fetchAllClasses, fetchDiscoverClasses, fetchMyClasses } from './classesApi'
import type { ClassCard } from './classModel'
import type { Result } from '../posts/postsApi'

/** mineFailed: riêng danh sách CỦA TÔI không tải được (Home chỉ cần biết điều này, không cần lỗi Khám phá).
 *  all: null/vắng = không phải Thầy/admin. */
export type SocialClasses = {
  loaded: boolean; mine: ClassCard[]; discover: ClassCard[]; all?: ClassCard[] | null
  error: string | null; mineFailed?: boolean; reload: () => void
}
type State = Omit<SocialClasses, 'reload'>

const none: Result<ClassCard[]> = { ok: true, value: [] }

export function useSocialClasses(isTeacher = false): SocialClasses {
  const [state, setState] = useState<State>({ loaded: false, mine: [], discover: [], all: null, error: null, mineFailed: false })
  const [rev, setRev] = useState(0)
  useEffect(() => {
    let alive = true
    void Promise.all([
      fetchMyClasses(),
      isTeacher ? Promise.resolve(none) : fetchDiscoverClasses(),
      isTeacher ? fetchAllClasses() : Promise.resolve(null),
    ]).then(([m, d, a]) => {
      if (!alive) return
      const err = !m.ok ? m.message : !d.ok ? d.message : a && !a.ok ? a.message : null
      setState({
        loaded: true, mine: m.ok ? m.value : [], discover: d.ok ? d.value : [],
        all: a ? (a.ok ? a.value : []) : null, error: err, mineFailed: !m.ok,
      })
    })
    return () => { alive = false }
  }, [rev, isTeacher])
  const reload = useCallback(() => setRev(x => x + 1), [])
  return { ...state, reload }
}
