import { useEffect } from 'react'
import YouTubeLesson from './YouTubeLesson'

// Trang player YouTube hosted tại /ytplayer?v=<id> — capability chung cho vỏ native:
// WKWebView origin capacitor:// bị YouTube từ chối embed (Error 153, referer không https),
// nên native nhúng TRANG NÀY (origin https của web app) và trang này mới nhúng YouTube.
// Mọi sự kiện YouTube widget API (onReady/infoDelivery/onError) được FORWARD NGUYÊN VẸN
// lên window cha, nên YouTubeLesson phía native nhận ready/ended/error y như embed trực tiếp.
export default function YtPlayerPage() {
  const id = new URLSearchParams(window.location.search).get('v') ?? ''

  useEffect(() => {
    if (window.parent === window) return  // mở trực tiếp, không ai để forward
    const h = (ev: MessageEvent) => {
      // Chỉ forward sự kiện từ player YouTube nhúng trong trang này
      if (typeof ev.origin === 'string' && ev.origin.includes('youtube.com')) {
        window.parent.postMessage(ev.data, '*')
      }
    }
    window.addEventListener('message', h)
    return () => window.removeEventListener('message', h)
  }, [])

  if (!id) return <div style={{ minHeight: '100vh', background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>Thiếu mã video (?v=)</div>
  return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center' }}>
      <YouTubeLesson videoId={id} style={{ width: '100%' }} />
    </div>
  )
}
