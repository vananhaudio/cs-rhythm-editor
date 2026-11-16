// Logo khóa học cho dòng lớp /me: MỘT truy vấn edu_courses (code, image_url), cache cả phiên, dùng chung mọi dòng lớp.
// Lỗi/không có → bảng rỗng (dòng lớp hiện biểu tượng mặc định); lỗi không được cache để lần sau thử lại.
import { useEffect, useState } from 'react'
import { toCourseLogoMap, type CourseLogoMap } from './classModel'

const EMPTY: CourseLogoMap = new Map()
let cached: CourseLogoMap | null = null
let pending: Promise<CourseLogoMap> | null = null

function load(): Promise<CourseLogoMap> {
  if (cached) return Promise.resolve(cached)
  pending ??= import('../../supabase').then(async ({ supabase }) => {
    const { data, error } = await supabase.from('edu_courses').select('code,image_url').not('image_url', 'is', null)
    if (error) throw error
    return (cached = toCourseLogoMap(data))
  }).catch(() => EMPTY).finally(() => { pending = null })
  return pending
}

export function useCourseLogos(): CourseLogoMap {
  const [logos, setLogos] = useState<CourseLogoMap>(cached ?? EMPTY)
  useEffect(() => {
    let live = true
    if (!cached) load().then(m => { if (live) setLogos(m) })
    return () => { live = false }
  }, [])
  return logos
}
