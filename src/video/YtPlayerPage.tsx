import YouTubeLesson from './YouTubeLesson'

// Trang player YouTube hosted tại /ytplayer?v=<id> — dùng làm renderer video cho app native:
// WKWebView origin capacitor:// bị YouTube từ chối embed (Error 153, referer không phải https),
// nên native nhúng TRANG NÀY (origin https của web app) và trang này mới nhúng YouTube.
// Đây là capability chung cho mọi video YouTube, không gắn với bài cụ thể nào.
export default function YtPlayerPage() {
  const id = new URLSearchParams(window.location.search).get('v') ?? ''
  if (!id) return <div style={{ minHeight: '100vh', background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>Thiếu mã video (?v=)</div>
  return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center' }}>
      <YouTubeLesson videoId={id} style={{ width: '100%' }} />
    </div>
  )
}
