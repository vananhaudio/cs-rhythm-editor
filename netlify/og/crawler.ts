// ── Universal OG — nhận diện crawler xem trước liên kết (CHỈ dùng cho route TeamLab song) ──
// Mục tiêu: người dùng bình thường đi thẳng proxy TeamLab (không đọc body, không gọi RPC); chỉ crawler mạng xã hội mới qua adapter.
// Matcher nhỏ, theo token trong User-Agent. FAIL-SAFE: UA trống / quá dài / không có token → KHÔNG phải crawler.
// Nhận nhầm một trình duyệt là crawler chỉ tốn một lượt RPC (kết quả vẫn là HTML TeamLab đúng, lỗi → fail closed);
// bỏ sót crawler chỉ làm preview về thẻ TeamLab mặc định. Cả hai đều không làm hỏng trang.
// Meta (Facebook / Messenger / Instagram) dùng facebookexternalhit; 'zalo': chưa có tài liệu UA chính thức của crawler Zalo —
// token này khớp cả trình duyệt trong app Zalo (vô hại, xem trên) và là best-effort cho crawler Zalo.
export const SOCIAL_CRAWLER_TOKENS = [
  'facebookexternalhit', 'facebot', 'twitterbot', 'linkedinbot', 'zalo',
  'telegrambot', 'whatsapp', 'slackbot', 'discordbot',
] as const

export function isSocialCrawler(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.length > 512) return false
  const ua = userAgent.toLowerCase()
  return SOCIAL_CRAWLER_TOKENS.some(t => ua.includes(t))
}
