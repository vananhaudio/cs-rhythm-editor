// ── /story/:slug — Trang đọc câu chuyện ──
// Hiển thị nội dung đầy đủ của một câu chuyện đã xuất bản.
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

interface StoryDetail {
  title: string
  pen_name: string | null
  location: string | null
  content: string
  photos: { url: string; caption?: string }[] | null
  published_at: string
  topic: string | null
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function StoryDetailPage() {
  const [story, setStory] = useState<StoryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const slug = window.location.pathname.replace('/story/', '')
    if (!slug) { setNotFound(true); setLoading(false); return }

    supabase
      .from('stories')
      .select('title, pen_name, location, content, photos, published_at, topic')
      .eq('slug', slug)
      .eq('status', 'published')
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setNotFound(true) }
        else { setStory(data as StoryDetail) }
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="sd-root">
        <style>{CSS}</style>
        <div className="sd-loading">Đang tải...</div>
      </div>
    )
  }

  if (notFound || !story) {
    return (
      <div className="sd-root">
        <style>{CSS}</style>
        <nav className="sd-nav"><div className="sd-nav-inner"><a href="/story" className="sd-back">← Tạp chí</a></div></nav>
        <div className="sd-notfound">
          <p className="sd-nf-icon">📄</p>
          <h2>Không tìm thấy câu chuyện</h2>
          <p>Câu chuyện này không tồn tại hoặc chưa được xuất bản.</p>
          <a href="/story" className="sd-nf-link">Về Tạp chí</a>
        </div>
      </div>
    )
  }

  return (
    <div className="sd-root">
      <style>{CSS}</style>

      {/* Nav */}
      <nav className="sd-nav">
        <div className="sd-nav-inner">
          <a href="/story" className="sd-back">← Tạp chí</a>
          <a href="/story/write" className="sd-cta">Vào Phòng viết</a>
        </div>
      </nav>

      {/* Article */}
      <article className="sd-article">
        <header className="sd-header">
          <h1 className="sd-title">{story.title}</h1>
          <div className="sd-meta">
            <span className="sd-author">{story.pen_name || 'Ẩn danh'}</span>
            {story.location && <><span className="sd-sep">·</span><span>{story.location}</span></>}
            <span className="sd-sep">·</span>
            <span>{story.published_at ? fmtDate(story.published_at) : ''}</span>
          </div>
        </header>

        {/* Photos */}
        {story.photos && Array.isArray(story.photos) && story.photos.length > 0 && (
          <div className="sd-photos">
            {story.photos.map((p, i) => (
              <img key={i} src={p.url} alt={p.caption || ''} className="sd-photo" />
            ))}
          </div>
        )}

        {/* Content */}
        <div className="sd-content">
          {story.content.split('\n').map((p, i) => (
            p.trim() ? <p key={i}>{p}</p> : <br key={i} />
          ))}
        </div>

        {/* Back to magazine */}
        <div className="sd-back-cta">
          <a href="/story" className="sd-back-link">← Về Tạp chí</a>
        </div>
      </article>

      {/* Footer */}
      <footer className="sd-footer">
        <div className="sd-footer-inner">
          <div className="sd-footer-links">
            <a href="/story">Tạp chí</a>
            <span className="sd-f-sep">·</span>
            <a href="/story/write">Phòng viết</a>
            <span className="sd-f-sep">·</span>
            <a href="https://zalo.me/vananhguitarist" target="_blank" rel="noopener">Liên hệ</a>
          </div>
          <div className="sd-footer-copy">© 2026 Thầy Văn Anh Guitar — 1001 Câu chuyện cùng Guitar</div>
        </div>
      </footer>
    </div>
  )
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap');

.sd-root {
  min-height: 100dvh;
  background: #F2EEE7;
  color: #211C32;
  font-family: 'Be Vietnam Pro', system-ui, sans-serif;
  line-height: 1.7;
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
}

.sd-nav {
  border-bottom: 1px solid #E4DED4;
  background: rgba(242,238,231,0.9);
  backdrop-filter: blur(10px);
  position: sticky; top: 0; z-index: 40;
}
.sd-nav-inner {
  max-width: 720px; margin: 0 auto; padding: 12px 20px;
  display: flex; align-items: center; justify-content: space-between;
}
.sd-back {
  text-decoration: none; color: #5A5470; font-size: 14px; font-weight: 500;
}
.sd-back:hover { color: #4338CA; }
.sd-cta {
  text-decoration: none; color: #4338CA; font-size: 13px; font-weight: 600;
  padding: 6px 14px; border: 1px solid #D3CEE8; border-radius: 8px;
}
.sd-cta:hover { background: #EEEBFB; }

.sd-article { max-width: 720px; margin: 0 auto; padding: 40px 20px 60px; }

.sd-header { margin-bottom: 32px; }
.sd-title {
  font-size: 32px; font-weight: 800; line-height: 1.2; letter-spacing: -0.5px;
  color: #211C32; margin: 0 0 12px;
}
.sd-meta { font-size: 14px; color: #8A8499; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.sd-author { font-weight: 600; color: #5A5470; }
.sd-sep { color: #C4BED4; }

.sd-photos { margin-bottom: 32px; display: flex; flex-direction: column; gap: 12px; }
.sd-photo { width: 100%; border-radius: 12px; display: block; }

.sd-content p { margin: 0 0 1.2em; font-size: 17px; color: #211C32; line-height: 1.8; }
.sd-content p:last-child { margin-bottom: 0; }

.sd-back-cta { text-align: center; padding: 24px 0 0; border-top: 1px solid #E4DED4; margin-top: 40px; }
.sd-back-link {
  text-decoration: none; color: #5A5470; font-size: 15px; font-weight: 500;
}
.sd-back-link:hover { color: #4338CA; }

.sd-footer { padding: 32px 20px; background: #F2EEE7; }
.sd-footer-inner { max-width: 720px; margin: 0 auto; text-align: center; }
.sd-footer-links { display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap; margin-bottom: 10px; }
.sd-footer-links a { text-decoration: none; color: #5A5470; font-size: 13px; font-weight: 500; }
.sd-footer-links a:hover { color: #4338CA; }
.sd-f-sep { color: #C4BED4; font-size: 11px; }
.sd-footer-copy { font-size: 12px; color: #8A8499; }

.sd-loading { text-align: center; padding: 80px 20px; color: #8A8499; }

.sd-notfound { text-align: center; padding: 80px 20px; }
.sd-nf-icon { font-size: 48px; margin: 0 0 12px; }
.sd-notfound h2 { font-size: 20px; font-weight: 700; color: #211C32; margin: 0 0 8px; }
.sd-notfound p { color: #5A5470; font-size: 15px; margin: 0 0 20px; }
.sd-nf-link { text-decoration: none; color: #4338CA; font-weight: 600; font-size: 15px; }

@media (max-width: 640px) {
  .sd-title { font-size: 26px; }
  .sd-content p { font-size: 16px; }
  .sd-article { padding: 28px 16px 48px; }
}
`;
