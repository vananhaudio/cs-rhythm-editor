// Công cụ — mọi path MỘT đoạn trùng edu_tools.route. Không khai từng tool: thêm dòng edu_tools có route riêng
// (Admin → Công cụ) là link tự có preview. Route dùng chung nhiều dòng (vd /tap) → không xác định → mặc định.
// Công khai khi status ≠ 'off'. Ảnh: edu_tools.image_url → mặc định.
import { defineAdapter, type Ctx } from '../adapter.ts'
import { publicMeta, resolveOgImage, SITE, str } from '../contract.ts'
import { canonicalUrl } from '../render.ts'

export type ToolRow = { route?: unknown; name?: unknown; description?: unknown; image_url?: unknown; status?: unknown }

const TTL_MS = 60_000
let cache: { at: number; byRoute: Map<string, ToolRow[]> } | null = null
export const resetToolIndex = () => { cache = null }

/** Chỉ mục route → các dòng edu_tools; nạp một lần mỗi phút mỗi isolate. */
async function toolIndex(ctx: Ctx): Promise<Map<string, ToolRow[]>> {
  if (cache && ctx.now() - cache.at < TTL_MS) return cache.byRoute
  const rows = await ctx.get('/rest/v1/edu_tools?select=route,name,description,image_url,status')
  const byRoute = new Map<string, ToolRow[]>()
  for (const r of (Array.isArray(rows) ? rows : []) as ToolRow[]) {
    const route = str(r.route).replace(/\/+$/, '').toLowerCase()
    if (!/^\/[a-z0-9-]+$/.test(route)) continue
    byRoute.set(route, [...(byRoute.get(route) ?? []), r])
  }
  cache = { at: ctx.now(), byRoute }
  return byRoute
}

export const toolAdapter = defineAdapter<string>({
  type: 'tool',
  fallthrough: true,
  match(path) {
    return /^\/[a-z0-9-]+$/i.test(path) ? path.toLowerCase() : null
  },
  async load(route, ctx) {
    const rows = (await toolIndex(ctx)).get(route)
    if (!rows || rows.length !== 1 || str(rows[0].status) === 'off') return null
    const t = rows[0]
    const name = str(t.name)
    return publicMeta({
      title: `${name} | ${SITE}`,
      description: str(t.description) || `${name} — công cụ luyện guitar của lớp Thầy Văn Anh.`,
      image: resolveOgImage([t.image_url]),
      canonicalUrl: canonicalUrl(ctx.origin, route),
    })
  },
})
