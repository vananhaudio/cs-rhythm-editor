// TeamLab Public Band — /teamlab/band/<public_slug>. Nguồn: RPC công khai teamlab_public_band (chỉ Team đang lên Home và công khai;
// slug sai / không đủ điều kiện → NULL → thẻ mặc định, KHÔNG có chữ nào của Band). Ảnh: cover Team → ảnh đại diện Team → ảnh mặc định TeamLab.
// Chỉ chạy cho crawler: edge function og-teamlab.ts cổng bằng crawler.ts. Không liên quan route Class /band/* (adapter `band`, dữ liệu Class).
import { defineAdapter, SLUG_RE } from '../adapter.ts'
import { publicMeta, str } from '../contract.ts'
import { canonicalUrl } from '../render.ts'

const TEAM_IMAGE_BASE = 'https://wojmdilyflffvdtpovmq.supabase.co/storage/v1/object/public/teamlab-team-avatars'
// Cùng dạng khoá với TeamLab (src/lib/teamProfile.ts): <project uuid>/cover-….jpg và <project uuid>/<tên>.jpg
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const COVER_PATH = new RegExp(`^${UUID}/cover-[A-Za-z0-9._-]{1,74}\\.jpg$`)
const AVATAR_PATH = new RegExp(`^${UUID}/[A-Za-z0-9._-]{1,80}\\.jpg$`)

const teamImage = (path: unknown, re: RegExp): string | null =>
  typeof path === 'string' && re.test(path) ? `${TEAM_IMAGE_BASE}/${path}` : null

export const teamlabBandAdapter = defineAdapter<string>({
  type: 'teamlab-band',
  match(path) {
    if (!path.startsWith('/teamlab/band/')) return null
    const slug = path.slice('/teamlab/band/'.length)
    return SLUG_RE.test(slug) && slug.length <= 60 ? slug : null
  },
  async load(slug, ctx) {
    const d = await ctx.rpc('teamlab_public_band', { p_slug: slug }) as {
      slug?: unknown; name?: unknown; description?: unknown; cover_path?: unknown; avatar_path?: unknown
    } | null
    const name = str(d?.name)
    if (!d || !name || d.slug !== slug) return null
    const slogan = str(d.description)
    return publicMeta({
      title: `${name} · TeamLab`,
      description: slogan || `Các bài đã xuất bản của ${name} trên TeamLab.`,
      image: teamImage(d.cover_path, COVER_PATH) ?? teamImage(d.avatar_path, AVATAR_PATH) ?? `${ctx.origin}/teamlab/og-image.png`,
      canonicalUrl: canonicalUrl(ctx.origin, `/teamlab/band/${slug}`),
    })
  },
})
