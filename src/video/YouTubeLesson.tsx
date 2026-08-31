// ── YouTube dùng chung cho bài học ───────────────────────────────────────────
// Một nguồn duy nhất cho: (1) trích video ID từ MỌI dạng link, (2) dựng URL
// embed chuẩn WKWebView (playsinline + enablejsapi), (3) player nhận sự kiện
// thật (ready/playing/paused/ended/error) qua postMessage — mẫu đã chạy ổn
// trong app ở ChordStrumPlayer. KHÔNG dùng timer giả để đoán "xem xong".
import { useEffect, useRef, useState } from 'react'

// Nhận MỌI dạng link YouTube → video ID 11 ký tự, hoặc null nếu không phải YouTube.
// Hỗ trợ: watch?v= (mọi thứ tự tham số), youtu.be/, /embed/, /shorts/, /live/, /v/, ID trần.
export function getYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null
  const u = url.trim()
  let m: RegExpMatchArray | null
  if ((m = u.match(/[?&]v=([\w-]{11})/))) return m[1]
  if ((m = u.match(/youtu\.be\/([\w-]{11})/))) return m[1]
  if ((m = u.match(/\/(?:embed|shorts|live|v)\/([\w-]{11})/))) return m[1]
  if (/^[\w-]{11}$/.test(u)) return u
  return null
}

// URL embed chuẩn: playsinline (bắt buộc cho WKWebView), enablejsapi (nhận sự kiện), rel=0.
export function buildEmbedUrl(id: string): string {
  return `https://www.youtube.com/embed/${id}?${new URLSearchParams({
    enablejsapi: '1', playsinline: '1', rel: '0',
  })}`
}

const YT_ALLOW = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'

// Vỏ native (origin capacitor://) bị YouTube từ chối embed trực tiếp (Error 153 — referer
// không phải https). Giải pháp chung: nhúng trang player hosted /ytplayer của web app
// (origin https hợp lệ); trang đó forward nguyên sự kiện YouTube lên parent nên
// onReady/onEnded/watchdog phía dưới chạy y hệt. Trên web thường → embed trực tiếp.
const NATIVE = !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
const HOSTED_PLAYER_ORIGIN = 'https://timming.vananhaudio.com'
function playerSrc(id: string): string {
  // nofail=1: trong WKWebView, sự kiện widget postMessage không truyền tin cậy giữa các tầng
  // iframe → trang hosted cũng phải tắt watchdog (YouTube tự hiện lỗi của nó nếu có).
  return NATIVE ? `${HOSTED_PLAYER_ORIGIN}/ytplayer?v=${id}&nofail=1` : buildEmbedUrl(id)
}

type Props = {
  url?: string | null        // link bất kỳ (được normalize) …
  videoId?: string | null    // … hoặc ID sẵn
  title?: string
  onEnded?: () => void       // gọi ĐÚNG 1 lần khi video phát tới hết (state ENDED thật của YouTube)
  style?: React.CSSProperties
  noWatchdog?: boolean       // trang /ytplayer nhúng trong vỏ native: sự kiện không tin cậy → tắt màn lỗi
}

// Player bài học: iframe + widget API postMessage.
// - onEnded chỉ bắn khi YouTube trả playerState === 0 (ENDED) — không phải mở bài, play, hay 50%.
// - Lỗi tải (mạng/video bị chặn nhúng) → thông báo rõ + nút "Thử lại", không ô đen câm.
export default function YouTubeLesson({ url, videoId, title, onEnded, style, noWatchdog }: Props) {
  const id = videoId && /^[\w-]{11}$/.test(videoId) ? videoId : getYouTubeId(videoId ?? url)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [gen, setGen] = useState(0)            // đổi key để reload iframe khi "Thử lại"
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const endedRef = useRef(false)
  const onEndedRef = useRef(onEnded); onEndedRef.current = onEnded

  useEffect(() => { setReady(false); setFailed(false); endedRef.current = false }, [id, gen])

  // Nghe sự kiện từ ĐÚNG iframe này (lọc theo ev.source — nhiều player cùng trang không lẫn nhau)
  useEffect(() => {
    if (!id) return
    const h = (ev: MessageEvent) => {
      if (ev.source !== iframeRef.current?.contentWindow) return
      let d: Record<string, unknown>
      try { d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data } catch { return }
      if (!d || typeof d !== 'object') return
      if (d.event === 'onReady') setReady(true)
      if (d.event === 'onError') {
        console.warn('[YouTubeLesson] player error', d.info, 'video:', id)
        setFailed(true)
      }
      const info = (d.info ?? {}) as Record<string, unknown>
      const st = typeof d.info === 'number' ? d.info : info.playerState
      if (typeof st === 'number') {
        if (st !== -1) setReady(true)          // có state nghĩa là player sống
        if (st === 0 && !endedRef.current) {   // 0 = ENDED
          endedRef.current = true
          console.info('[YouTubeLesson] ended:', id)
          onEndedRef.current?.()
        }
      }
    }
    window.addEventListener('message', h)
    return () => window.removeEventListener('message', h)
  }, [id, gen])

  // Watchdog: iframe load xong mà player không lên tiếng trong 8s → coi là lỗi, cho thử lại.
  // NATIVE: WKWebView không chuyển postMessage từ iframe https về parent capacitor:// →
  // không có sự kiện để canh. Trang /ytplayer load xong = coi như sẵn sàng (không màn lỗi oan);
  // onEnded trở thành best-effort trên native (bản store cũ video còn không phát được).
  const armWatchdog = () => {
    if (NATIVE || noWatchdog) { setReady(true); return }
    const w = iframeRef.current?.contentWindow
    const listen = () => w?.postMessage(JSON.stringify({ event: 'listening' }), '*')
    setTimeout(listen, 400); setTimeout(listen, 1200)
    setTimeout(() => setFailed(f => f || !readyRef.current), 8000)
  }
  const readyRef = useRef(false); readyRef.current = ready

  if (!id) return (
    <div style={{ aspectRatio: '16/9', background: '#111', color: 'rgba(255,255,255,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 'inherit', ...style }}>
      <div style={{ fontSize: 28 }}>🎬</div>
      <div style={{ fontSize: 14 }}>Video chưa được thêm vào bài học này.</div>
    </div>
  )

  return (
    <div style={{ position: 'relative', aspectRatio: '16/9', background: '#000', ...style }}>
      <iframe key={gen} ref={iframeRef} src={playerSrc(id)} title={title || 'Video bài học'}
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        allow={YT_ALLOW} allowFullScreen onLoad={armWatchdog} />
      {failed && !ready && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Không tải được video.</div>
          <button onClick={() => setGen(g => g + 1)}
            style={{ background: '#fff', color: '#111', border: 'none', borderRadius: 10, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Thử lại
          </button>
        </div>
      )}
    </div>
  )
}
