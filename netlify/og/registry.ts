// ── Universal OG — Registry: URL → adapter đầu tiên khớp → ShareMeta ──
// URL → Registry → Resource Adapter → ShareMeta → Renderer (render.ts) → không có / private / lỗi → thẻ mặc định Class.
// Thêm loại resource mới = thêm MỘT adapter vào ADAPTERS + phân loại route ở routes.ts. Không khai từng URL.
import type { Adapter, Ctx } from './adapter.ts'
import type { ShareMeta } from './contract.ts'
import { bandAdapter } from './adapters/band.ts'
import { classAdapter, sessionAdapter } from './adapters/classPages.ts'
import { landingAdapter } from './adapters/landing.ts'
import { profileAdapter } from './adapters/profile.ts'
import { showcaseAdapter } from './adapters/showcase.ts'
import { storyAdapter } from './adapters/story.ts'
import { teamlabSongAdapter } from './adapters/teamlabSong.ts'
import { toolAdapter } from './adapters/tool.ts'
import { canonicalUrl } from './render.ts'

/** Thứ tự = ưu tiên. tool (dò theo dữ liệu, nhận mọi path một đoạn) luôn cuối. */
export const ADAPTERS: readonly Adapter[] = [
  storyAdapter, showcaseAdapter, bandAdapter, sessionAdapter, classAdapter, profileAdapter, landingAdapter, teamlabSongAdapter, toolAdapter,
]

export type Resolution = {
  /** loại resource, hoặc 'page' nếu không adapter nào nhận */
  type: string
  /** null = thẻ mặc định Class */
  meta: ShareMeta | null
  canonicalUrl: string
  /** chẩn đoán (header x-og-fn): '<type>:public|private|not_found' hoặc 'page' */
  note: string
}

export function normalizePath(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/'
}

/** Lỗi mạng / dữ liệu / quá giờ → throw; edge bắt và trả thẻ mặc định (fail closed). */
export async function resolveShare(url: URL, ctx: Ctx): Promise<Resolution> {
  const path = normalizePath(url.pathname)
  const pageUrl = canonicalUrl(ctx.origin, path)
  for (const a of ADAPTERS) {
    const key = a.match(path, url.searchParams)
    if (key === null) continue
    const meta = await a.load(key, ctx)
    if (!meta) {
      if (a.fallthrough) continue
      return { type: a.type, meta: null, canonicalUrl: pageUrl, note: `${a.type}:not_found` }
    }
    return { type: a.type, meta, canonicalUrl: meta.canonicalUrl, note: `${a.type}:${meta.visibility}` }
  }
  return { type: 'page', meta: null, canonicalUrl: pageUrl, note: 'page' }
}
