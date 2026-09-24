// ─────────────────────────────────────────────────────────────────────────────
// Chuẩn hoá + kiểm tra link video ngoài (YouTube / TikTok / Facebook / link khác).
// Hàm THUẦN, không đụng DOM/mạng. CHỈ nhận URL — không nhận HTML/iframe/script.
// embedUrl luôn do Class TỰ DỰNG từ ID đã kiểm tra — không bao giờ lấy nguyên chuỗi người dùng.
// Được dùng CẢ khi soạn bài lẫn khi hiển thị (parse lại media_url đã lưu).
// ─────────────────────────────────────────────────────────────────────────────

export type MediaProvider = 'youtube' | 'tiktok' | 'facebook' | 'external_link'

export type ExternalMedia = {
  provider: MediaProvider
  originalUrl: string
  canonicalUrl: string
  externalId?: string
  embedUrl?: string
  canEmbed: boolean
  aspect: 'landscape' | 'portrait'
  /** TikTok link rút gọn (vm./vt./t/…): không có ID nên chỉ hiện thẻ mở video */
  shortLink?: boolean
}

export type MediaError =
  | 'empty' | 'too_long' | 'html' | 'invalid' | 'scheme' | 'credentials' | 'host'
  | 'youtube_not_video' | 'tiktok_not_video' | 'facebook_not_video'

export type ParseResult = { ok: true; media: ExternalMedia } | { ok: false; error: MediaError }

export const MAX_URL_LENGTH = 2048

/** Thông báo tiếng Việt cho học sinh — không lộ chi tiết kỹ thuật. */
export const MEDIA_ERROR_TEXT: Record<MediaError, string> = {
  empty: 'Hãy dán liên kết video bài tập.',
  too_long: 'Liên kết quá dài. Hãy dán lại liên kết video.',
  html: 'Chỉ dán liên kết video, không dán mã nhúng.',
  invalid: 'Liên kết chưa đúng. Hãy sao chép lại liên kết video.',
  scheme: 'Chỉ nhận liên kết bắt đầu bằng https://',
  credentials: 'Liên kết này không hợp lệ.',
  host: 'Liên kết này không hợp lệ.',
  youtube_not_video: 'Đây là liên kết YouTube nhưng chưa phải một video.',
  tiktok_not_video: 'Đây là liên kết TikTok nhưng chưa phải một video.',
  facebook_not_video: 'Đây là liên kết Facebook nhưng chưa phải một bài/video.',
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/
const TIKTOK_ID = /^\d{8,25}$/
const FB_NUM_ID = /^\d{5,25}$/
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/

/** Khớp CHÍNH XÁC tên miền hoặc subdomain của nó — không dùng includes(). */
export function hostIs(host: string, domain: string): boolean {
  return host === domain || host.endsWith('.' + domain)
}

const segs = (path: string) => path.split('/').filter(Boolean)

function youtube(u: URL, originalUrl: string): ParseResult | null {
  const host = u.hostname
  if (!hostIs(host, 'youtube.com') && !hostIs(host, 'youtu.be') && !hostIs(host, 'youtube-nocookie.com')) return null
  const s = segs(u.pathname)
  let id: string | null = null
  let shorts = false
  if (hostIs(host, 'youtu.be')) id = s[0] ?? null
  else if (s[0] === 'watch') id = u.searchParams.get('v')
  else if (s[0] === 'shorts') { id = s[1] ?? null; shorts = true }
  else if (s[0] === 'embed' || s[0] === 'live' || s[0] === 'v') id = s[1] ?? null
  if (!id || !YT_ID.test(id)) return { ok: false, error: 'youtube_not_video' }
  return {
    ok: true,
    media: {
      provider: 'youtube', originalUrl, externalId: id,
      canonicalUrl: shorts ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`,
      // Chế độ bảo mật nâng cao (nocookie), không tự phát, không gợi ý video kênh khác
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1`,
      canEmbed: true,
      aspect: shorts ? 'portrait' : 'landscape',
    },
  }
}

function tiktok(u: URL, originalUrl: string): ParseResult | null {
  const host = u.hostname
  if (!hostIs(host, 'tiktok.com')) return null
  const s = segs(u.pathname)
  const short = host === 'vm.tiktok.com' || host === 'vt.tiktok.com' || (s[0] === 't' && !!s[1])
  if (short) {
    const code = (host === 'vm.tiktok.com' || host === 'vt.tiktok.com') ? s[0] : s[1]
    if (!code || !/^[A-Za-z0-9_-]{4,40}$/.test(code)) return { ok: false, error: 'tiktok_not_video' }
    return {
      ok: true,
      media: {
        provider: 'tiktok', originalUrl, canEmbed: false, aspect: 'portrait', shortLink: true,
        canonicalUrl: `https://${host}/${host.startsWith('v') ? code : 't/' + code}`,
      },
    }
  }
  let id: string | null = null
  if (s[0]?.startsWith('@') && (s[1] === 'video' || s[1] === 'photo')) id = s[2] ?? null
  else if (s[0] === 'v') id = (s[1] ?? '').replace(/\.html$/, '')
  else if (s[0] === 'embed') id = s[1] === 'v2' ? s[2] ?? null : s[1] ?? null
  else if (s[0] === 'player' && s[1] === 'v1') id = s[2] ?? null
  if (!id || !TIKTOK_ID.test(id)) return { ok: false, error: 'tiktok_not_video' }
  const user = s[0]?.startsWith('@') && /^@[A-Za-z0-9._]{1,40}$/.test(s[0]) ? s[0] : null
  return {
    ok: true,
    media: {
      provider: 'tiktok', originalUrl, externalId: id,
      canonicalUrl: user ? `https://www.tiktok.com/${user}/video/${id}` : `https://www.tiktok.com/video/${id}`,
      // TikTok Embed Player chính thức — mặc định không tự phát; tắt nhạc/mô tả/đề xuất
      embedUrl: `https://www.tiktok.com/player/v1/${id}?autoplay=0&music_info=0&description=0&rel=0`,
      canEmbed: true,
      aspect: 'portrait',
    },
  }
}

// Facebook: CHỈ hiện thẻ mở nội dung gốc (P1) — plugin nhúng cần SDK toàn cục và chỉ chạy với
// bài công khai, không biết trước được bài riêng tư. Giữ lại query cần thiết, bỏ tham số theo dõi.
const FB_KEEP_QUERY = ['v', 'story_fbid', 'id', 'fbid']
function facebook(u: URL, originalUrl: string): ParseResult | null {
  const host = u.hostname
  if (!hostIs(host, 'facebook.com') && !hostIs(host, 'fb.com') && !hostIs(host, 'fb.watch')) return null
  const s = segs(u.pathname)
  const blocked = ['login', 'login.php', 'help', 'privacy', 'policies', 'settings', 'groups', 'marketplace', 'events', 'pages', 'hashtag']
  if (s.length === 0 || blocked.includes(s[0])) return { ok: false, error: 'facebook_not_video' }
  if (hostIs(host, 'fb.watch')) {
    if (!/^[A-Za-z0-9_-]{4,40}$/.test(s[0])) return { ok: false, error: 'facebook_not_video' }
    return { ok: true, media: { provider: 'facebook', originalUrl, canonicalUrl: `https://fb.watch/${s[0]}/`, canEmbed: false, aspect: 'landscape' } }
  }
  const looksLikePost =
    s[0] === 'watch' || s[0] === 'reel' || s[0] === 'share' || s[0] === 'story.php' || s[0] === 'permalink.php' ||
    s[0] === 'video.php' || s[1] === 'videos' || s[1] === 'posts' || s[1] === 'reels'
  if (!looksLikePost) return { ok: false, error: 'facebook_not_video' }
  let id: string | undefined
  if (s[0] === 'reel' && FB_NUM_ID.test(s[1] ?? '')) id = s[1]
  else if (s[1] === 'videos') id = s.slice(2).find(x => FB_NUM_ID.test(x))
  else if (s[0] === 'watch' && FB_NUM_ID.test(u.searchParams.get('v') ?? '')) id = u.searchParams.get('v')!
  const q = new URLSearchParams()
  for (const k of FB_KEEP_QUERY) { const v = u.searchParams.get(k); if (v) q.set(k, v) }
  const path = '/' + s.join('/') + (u.pathname.endsWith('/') ? '/' : '')   // URL đã tự mã hoá từng đoạn
  return {
    ok: true,
    media: {
      provider: 'facebook', originalUrl, externalId: id, canEmbed: false, aspect: 'landscape',
      canonicalUrl: 'https://www.facebook.com' + path + (q.toString() ? '?' + q.toString() : ''),
    },
  }
}

export function parseExternalMedia(input: string): ParseResult {
  const originalUrl = (input ?? '').trim()
  if (!originalUrl) return { ok: false, error: 'empty' }
  if (originalUrl.length > MAX_URL_LENGTH) return { ok: false, error: 'too_long' }
  if (/[<>"'`]/.test(originalUrl) || /\s/.test(originalUrl)) {
    return { ok: false, error: /<\s*(iframe|script|blockquote|a|div)\b/i.test(originalUrl) ? 'html' : 'invalid' }
  }
  // Có scheme lạ (javascript:, data:, ftp:, …) → từ chối; không có scheme → coi là https://
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(originalUrl)?.[1]?.toLowerCase()
  if (scheme && scheme !== 'http' && scheme !== 'https' && !/^[a-z0-9.-]+:\d+/i.test(originalUrl)) {
    return { ok: false, error: 'scheme' }
  }
  const withScheme = scheme === 'http' || scheme === 'https' ? originalUrl : 'https://' + originalUrl.replace(/^\/+/, '')
  let u: URL
  try { u = new URL(withScheme) } catch { return { ok: false, error: 'invalid' } }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, error: 'scheme' }
  if (u.username || u.password) return { ok: false, error: 'credentials' }
  const host = u.hostname.toLowerCase().replace(/\.$/, '')
  if (!host.includes('.') || host === 'localhost' || host.endsWith('.localhost') || IPV4.test(host) || host.startsWith('[')) {
    return { ok: false, error: 'host' }
  }
  if (u.port && u.port !== '80' && u.port !== '443') return { ok: false, error: 'host' }
  u.hostname = host

  const known = youtube(u, originalUrl) ?? tiktok(u, originalUrl) ?? facebook(u, originalUrl)
  if (known) return known

  u.hash = ''
  const canonicalUrl = u.toString()
  if (canonicalUrl.length > MAX_URL_LENGTH) return { ok: false, error: 'too_long' }
  return { ok: true, media: { provider: 'external_link', originalUrl, canonicalUrl, canEmbed: false, aspect: 'landscape' } }
}

export const PROVIDER_LABEL: Record<MediaProvider, string> = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  external_link: 'Liên kết',
}
