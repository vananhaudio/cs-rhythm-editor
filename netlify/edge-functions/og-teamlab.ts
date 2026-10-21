// ── Netlify Edge Function: thẻ chia sẻ cho TeamLab Public Song + Public Band — CHỈ /teamlab/song/* và /teamlab/band/* (gồm /teamlab/band/<slug>/room…) ──
// og.ts vẫn loại trừ /teamlab/* (site khác qua proxy) — hàm này là ngoại lệ HẸP, tách riêng để không nới exclusion.
// KHÔNG đoán User-Agent (thống nhất với og.ts / Universal OG): người và crawler nhận CÙNG HTML đã gắn thẻ OG của Band/Bài.
// Trước đây cổng allowlist crawler làm mọi crawler ngoài danh sách (Zalo không có UA chính thức, Viber, Skype, Line, Applebot…)
// nhận thẻ TeamLab mặc định. Lỗi/quá giờ/không phải resource công khai → thẻ mặc định, SPA chạy như cũ (og.ts fail closed).
// SEO: TeamLab là site riêng → renderShareMeta (KHÔNG chèn canonical của Class; xem tests/og/seoIsolation.test.ts).
import { shareHandler } from './og.ts'
import { renderShareMeta } from '../og/render.ts'

export default function handler(req: Request, context: { next: (request?: Request) => Promise<Response> }) {
  return shareHandler(req, context, renderShareMeta)
}

export const config = {
  path: ['/teamlab/song/*', '/teamlab/band/*'],
  onError: 'bypass',
}
