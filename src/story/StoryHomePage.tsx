// ── /story/home — PO1: Home "1001 Câu chuyện" ──
// Magazine-style home. Read stories. Start telling yours.
// No draft status. No "continue writing". No AI. No dashboard.
// Design tokens đồng bộ với /story (StoryLandingPage).
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

// ── Types ──
interface Story {
  id: string
  title: string
  slug: string | null
  pen_name: string | null
  photos: { url: string; caption?: string }[] | null
  published_at: string
  topic: string | null
}

// ── Helpers ──
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function firstPhoto(photos: { url: string }[] | null): string | null {
  if (!photos || !Array.isArray(photos) || photos.length === 0) return null
  return photos[0]?.url ?? null
}

// ── Component ──
export default function StoryHomePage() {
  const [publishedStories, setPublishedStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    supabase
      .from('stories')
      .select('id, title, slug, pen_name, photos, published_at, topic')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (!cancelled) {
          setPublishedStories((data as Story[]) || [])
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [])

  // ── Render ──
  return (
    <div className="sh-root">
      <style>{CSS}</style>

      {/* ── Nav ── */}
      <nav className="sh-nav">
        <div className="sh-nav-inner">
          <a href="/story/home" className="sh-brand">
            <img src="/logo-green.svg" alt="" className="sh-brand-mark" />
            <span>1001 Câu chuyện cùng Guitar</span>
          </a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <header className="sh-hero">
        <div className="sh-hero-inner">
          <h1 className="sh-hero-title">1001 Câu chuyện cùng Guitar</h1>
          <blockquote className="sh-motto">
            <strong>Nếu câu chuyện của bạn có thể giúp được một ai đó, hãy kể lại nhé.</strong>
          </blockquote>
          <p className="sh-hero-desc">
            1001 Câu chuyện cùng Guitar là nơi lưu giữ những câu chuyện thật của những người yêu guitar.
          </p>
          <p className="sh-hero-note">
            Những câu chuyện được kể lại để truyền cảm hứng cho những người đến sau.
          </p>
        </div>
      </header>

      {/* ── CTA: Kể câu chuyện của bạn ── */}
      <section className="sh-section sh-section-cta">
        <div className="sh-section-inner">
          <a href="/story/tell" className="sh-new-story-cta">
            <span className="sh-new-story-icon">✍️</span>
            <span className="sh-new-story-label">Kể câu chuyện của bạn</span>
          </a>
        </div>
      </section>

      {/* ── Những câu chuyện mới ── */}
      <section className="sh-section sh-section-stories">
        <div className="sh-section-inner">
          <h2 className="sh-section-heading">
            <span className="sh-section-icon">📖</span> Những câu chuyện mới
          </h2>

          {loading ? (
            <div className="sh-loading">Đang tải câu chuyện...</div>
          ) : publishedStories.length === 0 ? (
            <div className="sh-empty">
              <p className="sh-empty-icon">📭</p>
              <p className="sh-empty-title">Chưa có câu chuyện nào được xuất bản</p>
              <p className="sh-empty-desc">
                Hãy là người đầu tiên kể câu chuyện của mình.
              </p>
            </div>
          ) : (
            <div className="sh-story-grid">
              {publishedStories.map((story) => {
                const img = firstPhoto(story.photos)
                return (
                  <a
                    key={story.id}
                    href={`/story/${story.slug || story.id}`}
                    className="sh-story-card"
                  >
                    <div className="sh-story-card-img-wrap">
                      {img ? (
                        <img src={img} alt="" className="sh-story-card-img" loading="lazy" />
                      ) : (
                        <div className="sh-story-card-img-placeholder">
                          <span className="sh-story-card-img-icon">🎸</span>
                        </div>
                      )}
                    </div>
                    <div className="sh-story-card-body">
                      <h3 className="sh-story-card-title">{story.title}</h3>
                      <div className="sh-story-card-meta">
                        <span className="sh-story-card-author">
                          {story.pen_name || 'Ẩn danh'}
                        </span>
                        <span className="sh-story-card-sep">·</span>
                        <span className="sh-story-card-date">
                          {story.published_at ? fmtDate(story.published_at) : ''}
                        </span>
                      </div>
                    </div>
                  </a>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="sh-footer">
        <div className="sh-footer-inner">
          <div className="sh-footer-links">
            <a href="/story#loi-ngo">Về dự án</a>
            <span className="sh-footer-sep">·</span>
            <a href="/story#loi-ngo">Lời ngỏ</a>
            <span className="sh-footer-sep">·</span>
            <a href="/story#vi-sao">Giới thiệu</a>
            <span className="sh-footer-sep">·</span>
            <a href="/story">Điều khoản</a>
            <span className="sh-footer-sep">·</span>
            <a href="https://zalo.me/vananhguitarist" target="_blank" rel="noopener">Liên hệ</a>
          </div>
          <div className="sh-footer-copy">
            © 2026 Thầy Văn Anh Guitar — 1001 Câu chuyện cùng Guitar
          </div>
        </div>
      </footer>
    </div>
  )
}

// ── Styles — đồng bộ token với /story ──
const CSS = `
/* ── Root ── */
.sh-root {
  min-height: 100dvh;
  background: #F2EEE7;
  color: #211C32;
  font-family: 'Be Vietnam Pro', system-ui, sans-serif;
  line-height: 1.55;
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
}

/* ── Nav ── */
.sh-nav {
  border-bottom: 1px solid #E4DED4;
  background: rgba(242,238,231,0.9);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  z-index: 40;
}
.sh-nav-inner {
  max-width: 960px;
  margin: 0 auto;
  padding: 12px 20px;
  display: flex;
  align-items: center;
}
.sh-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: #211C32;
  font-weight: 800;
  font-size: 15px;
}
.sh-brand-mark {
  width: 28px;
  height: 28px;
}

/* ── Hero ── */
.sh-hero {
  border-bottom: 1px solid #E4DED4;
}
.sh-hero-inner {
  max-width: 720px;
  margin: 0 auto;
  padding: 48px 20px 44px;
  text-align: center;
}
.sh-hero-title {
  font-size: 42px;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -1px;
  color: #211C32;
  margin: 0 0 20px;
}
.sh-motto {
  margin: 0 0 22px;
  padding: 10px 0 10px 16px;
  border-left: 3px solid #C9711E;
  color: #C9711E;
  font-size: 17px;
  font-weight: 600;
  font-style: italic;
  line-height: 1.55;
  display: inline-block;
  text-align: left;
}
.sh-motto strong {
  font-weight: 700;
  font-style: normal;
  color: #C9711E;
}
.sh-hero-desc {
  font-size: 17px;
  color: #5A5470;
  margin: 0 auto 10px;
  line-height: 1.6;
  max-width: 580px;
}
.sh-hero-note {
  font-size: 14px;
  color: #8A8499;
  margin: 0;
  line-height: 1.7;
}

/* ── Sections ── */
.sh-section {
  padding: 40px 20px;
}
.sh-section-inner {
  max-width: 960px;
  margin: 0 auto;
}
.sh-section-heading {
  font-size: 30px;
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -.5px;
  color: #211C32;
  margin: 0 0 24px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.sh-section-icon {
  font-size: 26px;
}

/* ── CTA ── */
.sh-section-cta {
  border-bottom: 1px solid #E4DED4;
}

.sh-new-story-cta {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  background: #FFFFFF;
  border: 1.5px dashed #D3CEE8;
  border-radius: 12px;
  text-decoration: none;
  transition: border-color .15s, background .15s;
  cursor: pointer;
}
.sh-new-story-cta:hover {
  border-color: #4338CA;
  background: #EEEBFB;
}
.sh-new-story-icon {
  font-size: 32px;
}
.sh-new-story-label {
  font-size: 18px;
  font-weight: 600;
  color: #4338CA;
}

/* ── Story Grid ── */
.sh-story-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}

.sh-story-card {
  display: block;
  text-decoration: none;
  color: inherit;
  background: #FFFFFF;
  border: 1px solid #E4DED4;
  border-radius: 16px;
  overflow: hidden;
  transition: box-shadow .15s, transform .15s;
}
.sh-story-card:hover {
  box-shadow: 0 12px 32px -16px rgba(33,28,50,.18);
  transform: translateY(-2px);
}

/* Card image */
.sh-story-card-img-wrap {
  aspect-ratio: 3 / 2;
  overflow: hidden;
  background: #F2EEE7;
}
.sh-story-card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.sh-story-card-img-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #EEEBFB 0%, #E4DED4 100%);
}
.sh-story-card-img-icon {
  font-size: 40px;
  opacity: 0.35;
}

/* Card body */
.sh-story-card-body {
  padding: 18px 20px 20px;
}
.sh-story-card-title {
  font-size: 16.5px;
  font-weight: 700;
  color: #211C32;
  line-height: 1.4;
  margin: 0 0 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.sh-story-card-meta {
  font-size: 12.5px;
  color: #8A8499;
  display: flex;
  align-items: center;
  gap: 6px;
}
.sh-story-card-author {
  font-weight: 500;
  color: #5A5470;
}
.sh-story-card-sep {
  color: #C4BED4;
}
.sh-story-card-date {
  color: #8A8499;
}

/* ── Loading / Empty ── */
.sh-loading {
  text-align: center;
  padding: 48px 0;
  color: #8A8499;
  font-size: 15px;
}
.sh-empty {
  text-align: center;
  padding: 48px 20px;
}
.sh-empty-icon {
  font-size: 40px;
  margin: 0 0 12px;
}
.sh-empty-title {
  font-size: 17px;
  font-weight: 600;
  color: #5A5470;
  margin: 0 0 6px;
}
.sh-empty-desc {
  font-size: 14px;
  color: #8A8499;
  margin: 0;
}

/* ── Footer ── */
.sh-footer {
  border-top: 1px solid #E4DED4;
  padding: 32px 20px;
}
.sh-footer-inner {
  max-width: 960px;
  margin: 0 auto;
  text-align: center;
}
.sh-footer-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.sh-footer-links a {
  text-decoration: none;
  color: #5A5470;
  font-size: 14px;
  font-weight: 500;
  transition: color .15s;
}
.sh-footer-links a:hover { color: #4338CA; }
.sh-footer-sep {
  color: #C4BED4;
  font-size: 12px;
}
.sh-footer-copy {
  font-size: 13px;
  color: #8A8499;
}

/* ── Responsive: mobile ── */
@media (max-width: 640px) {
  .sh-hero-inner {
    padding: 36px 16px 32px;
  }
  .sh-hero-title {
    font-size: 32px;
  }
  .sh-motto {
    font-size: 16px;
  }
  .sh-hero-desc {
    font-size: 15px;
  }
  .sh-story-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  .sh-section-heading {
    font-size: 24px;
  }
  .sh-new-story-cta {
    padding: 32px 16px;
  }
}
`
