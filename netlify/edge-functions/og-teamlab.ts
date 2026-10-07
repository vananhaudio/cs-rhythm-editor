// ── Netlify Edge Function: thẻ chia sẻ cho TeamLab Public Song — CHỈ /teamlab/song/* ──
// og.ts vẫn loại trừ /teamlab/* (site khác qua proxy) — hàm này là ngoại lệ HẸP, tách riêng để không nới exclusion.
// Người dùng bình thường: context.next() trả thẳng (không đọc body, không RPC). Chỉ crawler xem trước liên kết
// (netlify/og/crawler.ts) mới qua handler Universal OG (adapter teamlabSong → RPC công khai → regex thay thẻ meta).
// UA không chắc chắn → coi như người thường (fail-safe: PublicSongPage luôn chạy bình thường).
import { isSocialCrawler } from '../og/crawler.ts'
import ogHandler from './og.ts'

export default async function handler(req: Request, context: { next: () => Promise<Response> }) {
  if (!isSocialCrawler(req.headers.get('user-agent'))) return context.next()
  return ogHandler(req, context)
}

export const config = {
  path: '/teamlab/song/*',
  onError: 'bypass',
}
