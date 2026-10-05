// Landing — trang giới thiệu riêng của SPA (vd /solo01) ĐẠI DIỆN cho một entity đã có dữ liệu.
// Gắn landing → entity khai ở routes.ts (LANDINGS, cùng chỗ phân loại route SPA). Chữ + ảnh lấy từ ENTITY:
//   course  → edu_courses theo code: tên, mô tả; ảnh image_url → thumbnail_url → mặc định; công khai khi status ≠ off
//   program → lớp mới nhất đang công khai của class_schedule.program_code (chuỗi ảnh Lớp)
// Landing không gắn entity (vd /thuvien) KHÔNG có ở đây → thẻ mặc định Class.
import { defineAdapter, first } from '../adapter.ts'
import { courseImageCandidates, hidden, publicMeta, resolveOgImage, SITE, str } from '../contract.ts'
import { canonicalUrl } from '../render.ts'
import { LANDINGS, type Landing } from '../routes.ts'
import { classDescription, classTitle, loadProgram } from './classes.ts'

type CourseRow = { name?: unknown; description?: unknown; showcase_desc?: unknown; outcome?: unknown
  image_url?: unknown; thumbnail_url?: unknown; status?: unknown; visibility?: unknown }

export const landingAdapter = defineAdapter<{ landing: Landing; path: string }>({
  type: 'landing',
  match(path) {
    const landing = LANDINGS.find(l => path === l.path || path.startsWith(l.path + '/'))
    return landing ? { landing, path } : null
  },
  async load({ landing, path }, ctx) {
    const url = canonicalUrl(ctx.origin, path)
    const r = landing.resource
    if (r.type === 'course') {
      const c = await first<CourseRow>(ctx,
        `/rest/v1/edu_courses?select=name,description,showcase_desc,outcome,image_url,thumbnail_url,status,visibility&code=eq.${encodeURIComponent(r.code)}&limit=1`)
      if (!c) return null
      if (str(c.status) === 'off' || (str(c.visibility) && str(c.visibility) !== 'visible')) return hidden('private', url)
      const name = str(c.name)
      return publicMeta({
        title: `${name} | ${SITE}`,
        description: str(c.description) || str(c.showcase_desc) || str(c.outcome) || `Khoá ${name} — học guitar cùng Thầy Văn Anh.`,
        image: resolveOgImage(courseImageCandidates(c)), canonicalUrl: url,
      })
    }
    const cls = await loadProgram(ctx, r.code)
    if (!cls) return null
    return publicMeta({ title: `${classTitle(cls.name)} · ${SITE}`, description: classDescription(cls.name), image: cls.image, canonicalUrl: url })
  },
})
