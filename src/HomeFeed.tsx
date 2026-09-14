import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import YouTubeLesson, { getYouTubeId } from './video/YouTubeLesson'

// ─────────────────────────────────────────────────────────────────────────────
// Bản tin hôm nay — content feed SERVER-DRIVEN (bảng home_feed_items, db/home_feed_v2.sql).
// App chỉ chứa renderer chung theo `type` + `open_mode`; nội dung 100% từ backend.
// KHÔNG hardcode nội dung/URL nghiệp vụ ở đây. KHÔNG renderer riêng cho một bài cụ thể.
// Overlay in-app: position fixed + inset (KHÔNG dvh — WKWebView iframe bug, xem memory).
// ─────────────────────────────────────────────────────────────────────────────

export type HomeFeedItem = {
  id: string
  type: 'article' | 'video' | 'image' | 'document' | 'link' | 'announcement' | 'course' | 'event'
  kicker: string
  title: string
  summary: string
  icon: string
  tone: string
  thumbnail_url: string | null
  content_url: string | null
  content_data: Record<string, unknown>
  open_mode: 'in_app' | 'native' | 'external'
  expires_at?: string | null
}

// Mặc định hiển thị theo type khi item không tự khai icon/tone/kicker
export const FEED_TYPE_META: Record<HomeFeedItem['type'], { label: string; icon: string; tone: string }> = {
  article:      { label: 'Bài viết',   icon: '📖', tone: '#7C3AED' },
  video:        { label: 'Video',      icon: '🎥', tone: '#DC2626' },
  image:        { label: 'Hình ảnh',   icon: '🖼️', tone: '#0891B2' },
  document:     { label: 'Tài liệu',   icon: '📄', tone: '#0F766E' },
  link:         { label: 'Liên kết',   icon: '🔗', tone: '#4338CA' },
  announcement: { label: 'Thông báo',  icon: '📢', tone: '#EA580C' },
  course:       { label: 'Khóa học',   icon: '🎓', tone: '#15803D' },
  event:        { label: 'Sự kiện',    icon: '🗓️', tone: '#B45309' },
}

// Mở ra ngoài app: WKWebView KHÔNG mở '_blank' (im lặng không phản ứng) — phải '_system'.
// Cùng quy ước với openExternal trong MobileStudentPortal / live/LivePages.
const openExternal = (u: string) => { try { window.open(u, '_system') } catch { window.open(u, '_blank') } }

// Nội dung chữ đăng thẳng từ Admin (không cần trang web riêng): content_data.body
export function feedBody(item: HomeFeedItem): string {
  const b = item.content_data?.body
  return typeof b === 'string' ? b.trim() : ''
}

// ── Fetch + cache (localStorage) ─────────────────────────────────────────────
const CACHE_KEY = 'tva_home_feed_cache_v2'
const STALE_MS = 5 * 60 * 1000
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000   // cache quá cũ thì thà hiện "đang tải"

// Item trong cache có thể đã hết hạn kể từ lúc lưu — server đã lọc, cache thì không.
function notExpired(it: HomeFeedItem) {
  return !it.expires_at || new Date(it.expires_at) > new Date()
}

function readCache(): HomeFeedItem[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed.at === 'number' && Date.now() - parsed.at > CACHE_MAX_AGE_MS) return null
    return Array.isArray(parsed.items) ? (parsed.items as HomeFeedItem[]).filter(notExpired) : null
  } catch { return null }
}

export function useHomeFeed() {
  const [items, setItems] = useState<HomeFeedItem[] | null>(() => readCache())
  const [error, setError] = useState(false)
  const [stale, setStale] = useState(false)   // đang xem bản đã lưu vì fetch lỗi
  const lastFetch = useRef(0)

  const refresh = async () => {
    lastFetch.current = Date.now()
    const { data, error: err } = await supabase.from('home_feed_items')
      .select('id,type,kicker,title,summary,icon,tone,thumbnail_url,content_url,content_data,open_mode,expires_at')
      .eq('published', true)
      .lte('published_at', new Date().toISOString())
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('sort_order', { ascending: true })
      .order('published_at', { ascending: false })
    if (err || !data) {
      if (!items) setError(true)
      else setStale(true)          // có cache → vẫn hiện, nhưng nói rõ là bản đã lưu
      return
    }
    setError(false); setStale(false)
    setItems(data as HomeFeedItem[])
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ items: data, at: Date.now() })) } catch { /* đầy quota → bỏ cache */ }
  }

  useEffect(() => {
    refresh()
    // Quay lại app (Capacitor resume / đổi tab) → refresh nếu dữ liệu đã cũ
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFetch.current > STALE_MS) refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { items, error, stale, refresh }
}

// ── Overlay in-app (browser/viewer) — tái dụng khuôn Tool Overlay ────────────
// Không có cách nào đáng tin để biết iframe cross-origin nhúng được hay không:
// onError gần như không bao giờ bắn, và Chrome/Safari vẫn bắn onLoad khi trang bị
// X-Frame-Options chặn (⇒ khung TRẮNG mà app tưởng là đã mở xong). Vì vậy:
//   · watchdog cho trường hợp không bắn gì cả (treo ở "Đang mở..."),
//   · nút "Mở ngoài" LUÔN hiện trên header cho mọi item có URL — lối thoát không
//     phụ thuộc việc đoán đúng trạng thái.
const FRAME_TIMEOUT_MS = 10000

function FeedOverlay({ item, primary, onClose }: { item: HomeFeedItem; primary: string; onClose: () => void }) {
  const [frameState, setFrameState] = useState<'loading' | 'ready' | 'error'>('loading')
  const url = item.content_url ?? ''
  const body = feedBody(item)
  const isText = !url && !!body            // thông báo/bài viết đăng chữ thẳng từ Admin
  const isImage = item.type === 'image'
  // Video YouTube → renderer chung YouTubeLesson (tự xử lý vỏ native qua /ytplayer hosted).
  const ytId = item.type === 'video' ? getYouTubeId(url) : null
  const needsFrame = !isText && !isImage && !ytId
  const src = url

  useEffect(() => {
    if (!needsFrame || frameState !== 'loading') return
    const t = setTimeout(() => setFrameState('error'), FRAME_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [needsFrame, frameState])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: '#000', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', paddingTop: 'max(12px, env(safe-area-inset-top))', background: primary, flexShrink: 0 }}>
        <button onClick={onClose}
          style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 12, minWidth: 72, minHeight: 44, padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 16, color: '#fff', cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit', fontWeight: 600 }}>
          ✕ <span style={{ fontSize: 14 }}>Đóng</span>
        </button>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 16, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
        {!!url && !isText && (
          <button onClick={() => openExternal(url)} title="Mở ngoài app"
            style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 12, minHeight: 44, padding: '0 12px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}>
            Mở ngoài ↗
          </button>
        )}
      </div>

      {/* Vùng nội dung: position relative để lớp phủ trạng thái neo theo ĐÚNG vùng này,
          không phụ thuộc chiều cao header (header co giãn theo safe-area-inset-top). */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', minHeight: 0, background: '#000' }}>
        {isText ? (
          <div style={{ flex: 1, overflow: 'auto', background: '#fff', padding: '20px 18px', paddingBottom: 'max(20px, env(safe-area-inset-bottom))', textAlign: 'left' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#111827', lineHeight: 1.3, marginBottom: 6 }}>{item.title}</div>
            {item.summary && <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 14 }}>{item.summary}</div>}
            {body.split(/\n{2,}/).map((para, i) => (
              <p key={i} style={{ fontSize: 15.5, lineHeight: 1.65, color: '#1F2937', margin: '0 0 14px', whiteSpace: 'pre-wrap' }}>{para}</p>
            ))}
          </div>
        ) : isImage ? (
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={url} alt={item.title} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
        ) : ytId ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#000' }}>
            <YouTubeLesson videoId={ytId} title={item.title} style={{ width: '100%' }} />
          </div>
        ) : (
          <>
            <iframe
              key={frameState === 'loading' ? src + ':retry' : src}
              src={src}
              style={{ flex: 1, border: 'none', width: '100%' }}
              allow="fullscreen; autoplay; encrypted-media"
              title={item.title}
              onLoad={() => setFrameState('ready')}
              onError={() => setFrameState('error')}
            />
            {frameState !== 'ready' && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: frameState === 'error' ? '#111827' : '#000', color: '#fff', padding: 24, textAlign: 'center' }}>
                {frameState === 'error' ? (
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Không mở được trong app.</div>
                    <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 14 }}>Nội dung này có thể cần mở bằng trình duyệt.</div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button onClick={() => setFrameState('loading')}
                        style={{ background: 'rgba(255,255,255,.15)', color: '#fff', border: 'none', borderRadius: 12, padding: '11px 16px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44 }}>Thử lại</button>
                      <button onClick={() => openExternal(src)}
                        style={{ background: '#fff', color: '#111827', border: 'none', borderRadius: 12, padding: '11px 16px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44 }}>Mở ngoài app</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Đang mở...</div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Section "Bản tin hôm nay" — danh sách card + xử lý mở theo open_mode ─────
export function HomeFeedSection({ palette, onOpenNative, style }: {
  palette: { surface: string; surface2: string; t1: string; t2: string; t3: string; p1: string; shadow: string }
  onOpenNative?: (route: string, title: string) => void
  style?: React.CSSProperties
}) {
  const { items, error, stale, refresh } = useHomeFeed()
  const [openItem, setOpenItem] = useState<HomeFeedItem | null>(null)

  // Có đích để mở không? (URL, route native, hoặc nội dung chữ đăng thẳng)
  const canOpen = (it: HomeFeedItem) => !!it.content_url || it.open_mode === 'native' || !!feedBody(it)

  const open = (it: HomeFeedItem) => {
    if (!canOpen(it)) return
    if (it.open_mode === 'external' && it.content_url) { openExternal(it.content_url); return }
    if (it.open_mode === 'native' && it.content_url) {
      const route = it.content_url
      if (onOpenNative) onOpenNative(route, it.title)
      else window.location.href = route
      return
    }
    setOpenItem(it)  // in_app (URL nhúng hoặc nội dung chữ) → overlay
  }

  return (
    <section style={{ margin: '26px 18px 0', ...style }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 17, fontWeight: 900, color: palette.t1, textAlign: 'left' }}>Bản tin hôm nay</div>
        {stale && (
          <button onClick={refresh} style={{ background: 'transparent', border: 'none', padding: 0, fontSize: 12, fontWeight: 700, color: palette.t3, cursor: 'pointer', fontFamily: 'inherit' }}>
            Bản đã lưu · Làm mới
          </button>
        )}
      </div>
      {items === null && !error && (
        <div style={{ background: palette.surface, borderRadius: 18, boxShadow: palette.shadow, padding: 18, color: palette.t3, fontSize: 13, textAlign: 'center' }}>Đang tải bản tin...</div>
      )}
      {items === null && error && (
        <div style={{ background: palette.surface, borderRadius: 18, boxShadow: palette.shadow, padding: 18, textAlign: 'center' }}>
          <div style={{ color: palette.t2, fontSize: 13, marginBottom: 10 }}>Chưa tải được bản tin.</div>
          <button onClick={refresh} style={{ background: palette.surface2, border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: palette.t1, cursor: 'pointer', fontFamily: 'inherit' }}>Thử lại</button>
        </div>
      )}
      {items !== null && items.length === 0 && (
        <div style={{ background: palette.surface, borderRadius: 18, boxShadow: palette.shadow, padding: 18, color: palette.t3, fontSize: 13, textAlign: 'center' }}>Chưa có bản tin nào hôm nay.</div>
      )}
      {items !== null && items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map(it => {
            const meta = FEED_TYPE_META[it.type] ?? FEED_TYPE_META.link
            const tone = it.tone || meta.tone
            const icon = it.icon || meta.icon
            const kicker = it.kicker || meta.label
            const clickable = canOpen(it)
            return (
              <div key={it.id}
                onClick={() => open(it)}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                onKeyDown={clickable ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(it) } }) : undefined}
                style={{ background: palette.surface, borderRadius: 18, boxShadow: palette.shadow, overflow: 'hidden', display: 'flex', alignItems: 'stretch', textAlign: 'left', cursor: clickable ? 'pointer' : 'default' }}>
                <div style={{ width: 92, flexShrink: 0, background: it.thumbnail_url ? '#111' : `linear-gradient(135deg, ${tone}, ${tone}bb)`, display: 'grid', placeItems: 'center', fontSize: 30, overflow: 'hidden' }}>
                  {it.thumbnail_url
                    ? <img src={it.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : icon}
                </div>
                <div style={{ flex: 1, minWidth: 0, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 900, color: tone, textTransform: 'uppercase', letterSpacing: '.04em' }}>{kicker}</div>
                  <div style={{ fontSize: 14.5, fontWeight: 900, color: palette.t1, lineHeight: 1.25, marginTop: 3, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}>{it.title}</div>
                  {it.summary && <div style={{ fontSize: 12.5, color: palette.t2, marginTop: 4, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}>{it.summary}</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {openItem && <FeedOverlay item={openItem} primary={palette.p1} onClose={() => setOpenItem(null)} />}
    </section>
  )
}
