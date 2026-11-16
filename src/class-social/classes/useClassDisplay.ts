// Logo khóa học + lịch học cho Chat Lớp: đọc class_schedule (weekday/start_time/duration_minutes/main_course_id) và
// edu_courses (id, code, image_url) MỘT lần/phiên, cache theo mã lớp. Cùng nguồn logo với /me/classes (PR #71).
// Lỗi → bảng rỗng (hàng lớp hiện nốt nhạc, không lịch); lỗi không cache.
import { useEffect, useState } from 'react'
import { formatClassSchedule, toCourseLogoMap } from './classModel'

export type ClassDisplay = { logo: string | null; code: string | null; schedule: string | null }
export type ClassDisplayMap = ReadonlyMap<string, ClassDisplay>

export function buildClassDisplayMap(classes: unknown, courses: unknown): ClassDisplayMap {
  const logoById = new Map<string, string>(), codeById = new Map<string, string>()
  for (const [id, url] of toCourseLogoMap((Array.isArray(courses) ? courses : []).map(c => ({ code: c?.id, image_url: c?.image_url })))) logoById.set(id, url)
  for (const c of Array.isArray(courses) ? courses : []) if (c && typeof c.id === 'string' && typeof c.code === 'string' && c.code.trim()) codeById.set(c.id, c.code.trim())
  const m = new Map<string, ClassDisplay>()
  for (const r of Array.isArray(classes) ? classes : []) {
    if (!r || typeof r.id !== 'string') continue
    m.set(r.id.toLowerCase(), {
      logo: (typeof r.main_course_id === 'string' && logoById.get(r.main_course_id)) || null,
      code: (typeof r.main_course_id === 'string' && codeById.get(r.main_course_id)) || null,
      schedule: formatClassSchedule(r.weekday, r.start_time, r.duration_minutes),
    })
  }
  return m
}

const EMPTY: ClassDisplayMap = new Map()
let cached: ClassDisplayMap | null = null
let pending: Promise<ClassDisplayMap> | null = null

function load(): Promise<ClassDisplayMap> {
  if (cached) return Promise.resolve(cached)
  pending ??= import('../../supabase').then(async ({ supabase }) => {
    const [cls, crs] = await Promise.all([
      supabase.from('class_schedule').select('id,main_course_id,weekday,start_time,duration_minutes'),
      supabase.from('edu_courses').select('id,code,image_url'),
    ])
    if (cls.error) throw cls.error
    return (cached = buildClassDisplayMap(cls.data, crs.error ? [] : crs.data))
  }).catch(() => EMPTY).finally(() => { pending = null })
  return pending
}

/** Nạp sớm (song song với danh sách hội thoại) để logo/lịch có sẵn khi hàng lớp hiện, không đợi sau RPC danh sách. */
export const prefetchClassDisplay = (): void => { void load() }

export function useClassDisplay(): ClassDisplayMap {
  const [map, setMap] = useState<ClassDisplayMap>(cached ?? EMPTY)
  useEffect(() => {
    let live = true
    if (!cached) load().then(m => { if (live) setMap(m) })
    return () => { live = false }
  }, [])
  return map
}
