import { useEffect } from 'react'
import YouTubeLesson from './YouTubeLesson'

// Trang player YouTube hosted tại /ytplayer?v=<id> — capability chung cho vỏ native:
// WKWebView origin capacitor:// bị YouTube từ chối embed (Error 153, referer không https),
// nên native nhúng TRANG NÀY (origin https của web app) và trang này mới nhúng YouTube.
// Mọi sự kiện YouTube widget API (onReady/infoDelivery/onError) được FORWARD NGUYÊN VẸN
// lên window cha, nên YouTubeLesson phía native nhận ready/ended/error y như embed trực tiếp.
export default function YtPlayerPage() {
  const params = new URLSearchParams(window.location.search)
  const id = params.get('v') ?? ''
  const noFail = params.get('nofail') === '1'

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
      {noFail ? (
        // Vỏ native: nhúng qua youtube-nocookie (privacy-enhanced) — bộ kiểm ancestor/referer
        // của player thường ít gắt hơn khi tổ tiên trên cùng là scheme app (capacitor://).
        <div style={{ position: 'relative', aspectRatio: '16/9', background: '#000', width: '100%' }}>
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0`}
            title="Video"
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            allow="fullscreen; autoplay; encrypted-media"
            allowFullScreen
          />
        </div>
      ) : (
        <YouTubeLesson videoId={id} style={{ width: '100%' }} />
      )}
    </div>
  )
}
