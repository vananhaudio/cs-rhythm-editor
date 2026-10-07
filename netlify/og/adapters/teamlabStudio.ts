// TeamLab Studio (phòng thu của MỘT bài) — /teamlab/band/<slug>/room/studio/<teamId>. Xem trước theo ĐÚNG thực thể đang được chia sẻ: BÀI.
// Nguồn DUY NHẤT: RPC công khai teamlab_public_workspace_song(p_slug, p_song_id) — tự kiểm Team công khai + bài THUỘC Team đó (chống đổi id)
// và chỉ trả tên bài + dữ liệu công khai của Team. Edge KHÔNG đọc bảng riêng tư. Không take, không thành viên, không Band con, không tiến độ.
// RPC trả NULL (Team riêng tư / chưa công khai / bài thuộc Team khác / id lạ) → adapter nhường (fallthrough) cho `teamlabBand`:
//   Team công khai → thẻ của Team; còn lại → thẻ TeamLab mặc định. Không bao giờ lộ metadata bài ngoài điều kiện của RPC.
// Canonical: bài ĐÃ XUẤT BẢN → /teamlab/song/<song_slug> (URL chia sẻ công khai sẵn có của đúng bài đó); chưa xuất bản → chính URL Studio
// (thực thể được chia sẻ), để thẻ không nói "Team" trong khi nội dung nói "Bài".
import { defineAdapter, SLUG_RE, UUID_RE } from '../adapter.ts'
import { publicMeta, str } from '../contract.ts'
import { canonicalUrl } from '../render.ts'
import { teamPreviewImage } from './teamlabBand.ts'

type Key = { slug: string; songId: string }

export const teamlabStudioAdapter = defineAdapter<Key>({
  type: 'teamlab-studio',
  fallthrough: true,
  match(path) {
    if (!path.startsWith('/teamlab/band/')) return null
    const segs = path.slice('/teamlab/band/'.length).split('/')
    if (segs.length !== 4 || segs[1] !== 'room' || segs[2] !== 'studio') return null
    const [slug, , , songId] = segs
    if (!SLUG_RE.test(slug) || slug.length > 60 || !UUID_RE.test(songId)) return null
    return { slug, songId: songId.toLowerCase() }
  },
  async load({ slug, songId }, ctx) {
    const d = await ctx.rpc('teamlab_public_workspace_song', { p_slug: slug, p_song_id: songId }) as {
      title?: unknown; song_slug?: unknown; published?: unknown; project?: { name?: unknown; slug?: unknown; cover_path?: unknown; avatar_path?: unknown } | null
    } | null
    const title = str(d?.title)
    const team = str(d?.project?.name)
    if (!d || !title || !team || d.project?.slug !== slug) return null
    const songSlug = d.published === true && typeof d.song_slug === 'string' && SLUG_RE.test(d.song_slug) && d.song_slug.length <= 60 ? d.song_slug : null
    return publicMeta({
      title: `${title} · ${team}`,
      description: songSlug ? `Nghe bản thu của ${team} trên TeamLab.` : `Phòng tập của ${team} trên TeamLab.`,
      image: teamPreviewImage(d.project?.cover_path, d.project?.avatar_path, ctx.origin),
      canonicalUrl: canonicalUrl(ctx.origin, songSlug ? `/teamlab/song/${songSlug}` : `/teamlab/band/${slug}/room/studio/${songId}`),
    })
  },
})
