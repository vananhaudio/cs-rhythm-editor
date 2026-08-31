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

// Origin web production của chính app — capability config cho renderer hosted (/ytplayer)
// khi chạy trong vỏ native (bundled, origin capacitor:// không nhúng YouTube được).
const HOSTED_WEB_ORIGIN = 'https://timming.vananhaudio.com'

// ── Fetch + cache (localStorage) ─────────────────────────────────────────────
const CACHE_KEY = 'tva_home_feed_cache_v2'
const STALE_MS = 5 * 60 * 1000

function readCache(): HomeFeedItem[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed.items) ? parsed.items : null
  } catch { return null }
}

export function useHomeFeed() {
  const [items, setItems] = useState<HomeFeedItem[] | null>(() => readCache())
  const [error, setError] = useState(false)
  const lastFetch = useRef(0)

  const refresh = async () => {
    lastFetch.current = Date.now()
    const { data, error: err } = await supabase.from('home_feed_items')
      .select('id,type,kicker,title,summary,icon,tone,thumbnail_url,content_url,content_data,open_mode')
      .eq('published', true)
      .lte('published_at', new Date().toISOString())
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('sort_order', { ascending: true })
      .order('published_at', { ascending: false })
    if (err || !data) { if (!items) setError(true); return }
    setError(false)
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

  return { items, error, refresh }
}

// ── Overlay in-app (browser/viewer) — tái dụng khuôn Tool Overlay ────────────
function FeedOverlay({ item, primary, onClose }: { item: HomeFeedItem; primary: string; onClose: () => void }) {
  const [frameState, setFrameState] = useState<'loading' | 'ready' | 'error'>('loading')
  const url = item.content_url ?? ''
  const isImage = item.type === 'image'
  // Video YouTube: origin capacitor:// bị YouTube chặn embed (Error 153, referer không phải https)
  // → native nhúng trang player hosted /ytplayer của web app; web render trực tiếp YouTubeLesson.
  const ytId = item.type === 'video' ? getYouTubeId(url) : null
  const isNative = !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
  const src = ytId && isNative ? `${HOSTED_WEB_ORIGIN}/ytplayer?v=${ytId}` : url
  const useDirectYt = !!ytId && !isNative
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: '#000', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', paddingTop: 'max(12px, env(safe-area-inset-top))', background: primary, flexShrink: 0 }}>
        <button onClick={onClose}
          style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 12, minWidth: 72, minHeight: 44, padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 16, color: '#fff', cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit', fontWeight: 600 }}>
          ✕ <span style={{ fontSize: 14 }}>Đóng</span>
        </button>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 16, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
      </div>
      {isImage ? (
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={url} alt={item.title} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </div>
      ) : useDirectYt ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#000' }}>
          <YouTubeLesson videoId={ytId!} title={item.title} style={{ width: '100%' }} />
        </div>
      ) : (
        <>
          {frameState !== 'ready' && (
            <div style={{ position: 'absolute', inset: '68px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: frameState === 'error' ? '#111827' : '#000', color: '#fff', zIndex: 1, padding: 24, textAlign: 'center' }}>
              {frameState === 'error' ? (
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Không mở được nội dung.</div>
                  <button onClick={() => setFrameState('loading')} style={{ background: '#fff', color: '#111827', border: 'none', borderRadius: 12, padding: '10px 16px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Thử lại</button>
                </div>
              ) : (
                <div style={{ fontSize: 15, fontWeight: 700 }}>Đang mở...</div>
              )}
            </div>
          )}
          <iframe
            key={frameState === 'loading' ? src + ':retry' : src}
            src={src}
            style={{ flex: 1, border: 'none', width: '100%' }}
            allow="fullscreen; autoplay; encrypted-media"
            title={item.title}
            onLoad={() => setFrameState('ready')}
            onError={() => setFrameState('error')}
          />
        </>
      )}
    </div>
  )
}

// ── Section "Bản tin hôm nay" — danh sách card + xử lý mở theo open_mode ─────
export function HomeFeedSection({ palette, onOpenNative }: {
  palette: { surface: string; surface2: string; t1: string; t2: string; t3: string; p1: string; shadow: string }
  onOpenNative?: (route: string, title: string) => void
}) {
  const { items, error, refresh } = useHomeFeed()
  const [openItem, setOpenItem] = useState<HomeFeedItem | null>(null)

  const open = (it: HomeFeedItem) => {
    if (!it.content_url && it.open_mode !== 'native') return  // thông báo thuần, không có đích
    if (it.open_mode === 'external') { window.open(it.content_url ?? '', '_blank'); return }
    if (it.open_mode === 'native') {
      const route = it.content_url ?? ''
      if (onOpenNative) onOpenNative(route, it.title)
      else window.location.href = route
      return
    }
    setOpenItem(it)  // in_app → overlay
  }

  return (
    <section style={{ margin: '26px 18px 0' }}>
      <div style={{ fontSize: 17, fontWeight: 900, color: palette.t1, marginBottom: 12, textAlign: 'left' }}>Bản tin hôm nay</div>
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
            const clickable = !!it.content_url || it.open_mode === 'native'
            return (
              <div key={it.id} onClick={() => open(it)}
                style={{ background: palette.surface, borderRadius: 18, boxShadow: palette.shadow, overflow: 'hidden', display: 'flex', alignItems: 'stretch', textAlign: 'left', cursor: clickable ? 'pointer' : 'default' }}>
                <div style={{ width: 92, flexShrink: 0, background: it.thumbnail_url ? '#111' : `linear-gradient(135deg, ${tone}, ${tone}bb)`, display: 'grid', placeItems: 'center', fontSize: 30, overflow: 'hidden' }}>
                  {it.thumbnail_url
                    ? <img src={it.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : icon}
                </div>
                <div style={{ flex: 1, minWidth: 0, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 900, color: tone, textTransform: 'uppercase', letterSpacing: '.04em' }}>{kicker}</div>
                  <div style={{ fontSize: 14.5, fontWeight: 900, color: palette.t1, lineHeight: 1.25, marginTop: 3, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}>{it.title}</div>
                  {it.summary && <div style={{ fontSize: 12.5, color: palette.t2, marginTop: 4, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 1, overflow: 'hidden' }}>{it.summary}</div>}
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
