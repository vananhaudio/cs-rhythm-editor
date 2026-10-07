// TeamLab Public Song — /teamlab/song/<public_slug>. Nguồn: RPC công khai teamlab_public_song (chỉ bài ĐÃ XUẤT BẢN;
// slug sai / chưa xuất bản / đã gỡ → NULL → thẻ mặc định, KHÔNG có chữ nào của bài).
// Ảnh: cover Team → ảnh đại diện Team → ảnh mặc định TeamLab (đều là ảnh có sẵn, không tạo ảnh mới).
// Chỉ chạy cho crawler: edge function og-teamlab.ts cổng bằng crawler.ts.
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

export const teamlabSongAdapter = defineAdapter<string>({
  type: 'teamlab-song',
  match(path) {
    if (!path.startsWith('/teamlab/song/')) return null
    const slug = path.slice('/teamlab/song/'.length)
    return SLUG_RE.test(slug) && slug.length <= 60 ? slug : null
  },
  async load(slug, ctx) {
    const d = await ctx.rpc('teamlab_public_song', { p_slug: slug }) as {
      slug?: unknown; title?: unknown; band?: { name?: unknown } | null; project?: { name?: unknown; cover_path?: unknown; avatar_path?: unknown } | null
    } | null
    const title = str(d?.title)
    if (!d || !title || d.slug !== slug) return null
    const band = str(d.band?.name)
    const team = str(d.project?.name)
    return publicMeta({
      title: `${title} · ${band || team || 'TeamLab'}`,
      description: team ? `Nghe bản thu của ${team} trên TeamLab.` : 'Nghe bản thu trên TeamLab.',
      image: teamImage(d.project?.cover_path, COVER_PATH) ?? teamImage(d.project?.avatar_path, AVATAR_PATH) ?? `${ctx.origin}/teamlab/og-image.png`,
      canonicalUrl: canonicalUrl(ctx.origin, `/teamlab/song/${slug}`),
    })
  },
})
