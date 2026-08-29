// ── /story — Tạp chí "1001 Câu chuyện cùng Guitar" ──
// Magazine layout with content blocks: Featured, Latest, Topics
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
  featured?: boolean
}

interface Category {
  id: string
  name: string
  slug: string
}

const TOPIC_LABELS: Record<string, string> = {
  'ban-be': 'Bạn bè',
  'band': 'Band',
  'bat-dau-hoc-guitar': 'Bắt đầu học Guitar',
  'bieu-dien': 'Biểu diễn',
  'dai-hoi-guitar': 'Đại hội Guitar',
  'dong-luc': 'Động lực',
  'gia-dinh': 'Gia đình',
  'nguoi-thay': 'Người thầy',
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

function StoryImg({ img }: { img: string | null }) {
  if (!img) {
    return (
      <div className="sh-card-img-placeholder">
        <span className="sh-card-img-icon">🎸</span>
      </div>
    )
  }
  return (
    <img
      src={img}
      alt=""
      className="sh-card-img"
      loading="lazy"
      onError={(e) => {
        const el = e.currentTarget
        el.style.display = 'none'
        const wrap = el.parentElement
        if (wrap) {
          const ph = document.createElement('div')
          ph.className = 'sh-card-img-placeholder'
          const icon = document.createElement('span')
          icon.className = 'sh-card-img-icon'
          icon.textContent = '🎸'
          ph.appendChild(icon)
          wrap.appendChild(ph)
        }
      }}
    />
  )
}

// ── Story Card ──
function StoryCard({ story }: { story: Story }) {
  const img = firstPhoto(story.photos)
  return (
    <a href={`/story/${story.slug || story.id}`} className="sh-card">
      <div className="sh-card-img-wrap">
        <StoryImg img={img} />
      </div>
      <div className="sh-card-body">
        {story.topic && TOPIC_LABELS[story.topic] && (
          <span className="sh-card-topic">{TOPIC_LABELS[story.topic]}</span>
        )}
        <h3 className="sh-card-title">{story.title}</h3>
        <div className="sh-card-meta">
          <span className="sh-card-author">{story.pen_name || 'Ẩn danh'}</span>
          <span className="sh-card-sep">·</span>
          <span className="sh-card-date">{story.published_at ? fmtDate(story.published_at) : ''}</span>
        </div>
      </div>
    </a>
  )
}

// ── Section Header ──
function SectionHead({ icon, title, href }: { icon: string; title: string; href?: string }) {
  return (
    <div className="sh-section-head">
      <h2 className="sh-section-heading">
        <span className="sh-section-icon">{icon}</span> {title}
      </h2>
      {href && (
        <a href={href} className="sh-section-more">Xem tất cả →</a>
      )}
    </div>
  )
}

// ── Component ──
export default function StoryHomePage() {
  const [featured, setFeatured] = useState<Story[]>([])
  const [latest, setLatest] = useState<Story[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  // Học viên vào từ app (đã đăng nhập) cần lối quay lại cổng học; khách vãng lai thì không hiện.
  const [dangNhap, setDangNhap] = useState(false)
  useEffect(() => { supabase.auth.getSession().then(({ data }) => setDangNhap(!!data.session)) }, [])

  useEffect(() => {
    let cancelled = false

    Promise.all([
      // Featured stories
      supabase.from('stories')
        .select('id, title, slug, pen_name, photos, published_at, topic, featured')
        .eq('status', 'published').eq('featured', true)
        .order('published_at', { ascending: false }).limit(5),
      // Latest stories
      supabase.from('stories')
        .select('id, title, slug, pen_name, photos, published_at, topic, featured')
        .eq('status', 'published')
        .order('published_at', { ascending: false }).limit(8),
      // Categories (new table — graceful fallback if not exists)
      supabase.from('categories').select('id, name, slug').order('name'),
    ]).then(([featRes, latestRes, catRes]) => {
      if (cancelled) return
      setFeatured((featRes.data as Story[]) || [])
      setLatest((latestRes.data as Story[]) || [])
      setCategories((catRes.data as Category[]) || [])
      setLoading(false)
    }).catch(() => {
      // Fallback: categories table may not exist yet
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="sh-root">
        <style>{CSS}</style>
        <div className="sh-loading">Đang tải...</div>
      </div>
    )
  }

  // Deduplicate: featured stories excluded from latest
  const featuredIds = new Set(featured.map(s => s.id))
  const latestFiltered = latest.filter(s => !featuredIds.has(s.id))

  return (
    <div className="sh-root">
      <style>{CSS}</style>

      {/* Nav */}
      <nav className="sh-nav">
        <div className="sh-nav-inner">
          <a href="/story" className="sh-brand">
            <img src="/logo-green.svg" alt="" className="sh-brand-mark" />
            <span className="sh-brand-full">1001 Câu chuyện cùng Guitar</span>
            <span className="sh-brand-short">1001 Câu chuyện</span>
          </a>
          <div className="sh-nav-actions">
            {/* Đường về app luôn hiện — GUEST cũng phải thoát được (native không có nút back).
                ?return= cho phép quay đúng ngữ cảnh đã mở story (Home hay Tôi). */}
            <a href={(() => { try { const r = new URLSearchParams(window.location.search).get('return'); if (r && r.startsWith('/')) return r } catch { /**/ } return dangNhap ? '/me' : '/start' })()} className="sh-nav-back">← <span className="sh-nav-back-full">Về app</span><span className="sh-nav-back-short">App</span></a>
            <a href="/story/write" className="sh-nav-cta">Kể chuyện</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="sh-hero">
        <div className="sh-hero-inner">
          <h1 className="sh-hero-title">1001 Câu chuyện cùng Guitar</h1>
          <blockquote className="sh-motto">
            Nếu câu chuyện của bạn có thể giúp được một ai đó, hãy kể lại nhé.
          </blockquote>
          <p className="sh-hero-desc">
            Tạp chí lưu giữ những câu chuyện thật của cộng đồng Guitar.
          </p>
        </div>
      </header>

      <div className="sh-content">
        {/* ⭐ Featured */}
        {featured.length > 0 && (
          <section className="sh-section">
            <div className="sh-section-inner">
              <SectionHead icon="⭐" title="Câu chuyện nổi bật" />
              <div className="sh-story-grid sh-featured">
                {featured.map(s => <StoryCard key={s.id} story={s} />)}
              </div>
            </div>
          </section>
        )}

        {/* 🔥 Latest */}
        <section className="sh-section">
          <div className="sh-section-inner">
            <SectionHead icon="🔥" title="Mới xuất bản" />
            <div className="sh-story-grid">
              {latestFiltered.slice(0, 6).map(s => <StoryCard key={s.id} story={s} />)}
            </div>
          </div>
        </section>

        {/* 💡 For Change — from Supabase categories */}
        {categories.length > 0 && (
          <section className="sh-section">
            <div className="sh-section-inner">
              <SectionHead icon="💡" title="For Change" />
              <p className="sh-section-desc">Sau khi đọc xong, Ban biên tập mong người đọc sẽ thay đổi điều gì?</p>
              <div className="sh-topics">
                {categories.map(c => (
                  <a key={c.id} href={`/story/topic/${c.slug}`} className="sh-topic-chip">
                    {c.name}
                  </a>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 💡 For Change — fallback */}
        {categories.length === 0 && (
          <section className="sh-section">
            <div className="sh-section-inner">
              <SectionHead icon="💡" title="For Change" />
              <p className="sh-section-desc">Sau khi đọc xong, Ban biên tập mong người đọc sẽ thay đổi điều gì?</p>
              <div className="sh-topics">
                {Object.entries(TOPIC_LABELS).slice(0, 8).map(([slug, name]) => (
                  <a key={slug} href={`/story/topic/${slug}`} className="sh-topic-chip">
                    {name}
                  </a>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 🔍 Search placeholder */}
        <section className="sh-section">
          <div className="sh-section-inner">
            <SectionHead icon="🔍" title="Tìm kiếm" />
            <div className="sh-search-placeholder">
              <p>Tìm kiếm câu chuyện theo từ khóa, tác giả, hoặc chủ đề.</p>
              <div className="sh-search-box">
                <input type="text" placeholder="Tìm câu chuyện..." className="sh-search-input" disabled />
                <button className="sh-search-btn" disabled>🔍</button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* CTA */}
      <section className="sh-invitation">
        <div className="sh-section-inner sh-invitation-inner">
          <p className="sh-invite-q">Bạn cũng có một câu chuyện?</p>
          <blockquote className="sh-invite-motto">
            Nếu câu chuyện của bạn có thể giúp được một ai đó, hãy kể lại nhé.
          </blockquote>
          <a href="/story/write" className="sh-invite-btn">Vào Phòng viết →</a>
        </div>
      </section>

      {/* Footer */}
      <footer className="sh-footer">
        <div className="sh-footer-inner">
          <div className="sh-footer-links">
            <a href="/story">Tạp chí</a>
            <span className="sh-footer-sep">·</span>
            <a href="/story/write">Phòng viết</a>
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

// ── Styles ──
const CSS = `
.sh-root {
  min-height: 100dvh;
  background: #F2EEE7;
  color: #211C32;
  font-family: 'Be Vietnam Pro', system-ui, sans-serif;
  line-height: 1.55;
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
}

/* Nav */
.sh-nav {
  border-bottom: 1px solid #E4DED4;
  background: rgba(242,238,231,0.9);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  position: sticky; top: 0; z-index: 40;
  /* chừa tai thỏ / thanh trạng thái trên iPhone (app Capacitor dùng viewport-fit=cover) */
  padding-top: env(safe-area-inset-top, 0px);
}
.sh-nav-inner {
  max-width: 1024px; margin: 0 auto; padding: 12px 20px;
  display: flex; align-items: center; justify-content: space-between;
}
.sh-brand {
  display: flex; align-items: center; gap: 10px;
  text-decoration: none; color: #211C32; font-weight: 800; font-size: 15px;
}
.sh-brand-mark { width: 28px; height: 28px; }
.sh-nav-actions { display: flex; gap: 12px; }
.sh-nav-cta {
  text-decoration: none; color: #fff; background: #4338CA;
  font-size: 13px; font-weight: 600; padding: 8px 16px; border-radius: 8px;
  transition: background .15s;
}
.sh-nav-cta:hover { background: #352BA3; }
.sh-nav-back {
  text-decoration: none; color: #4338CA; background: transparent;
  border: 1px solid #D3CEE8; border-radius: 8px;
  font-size: 13px; font-weight: 600; padding: 8px 12px; white-space: nowrap;
}
.sh-nav-back:hover { background: #EEEBFB; }
.sh-nav-back-short { display: none; }
.sh-brand-short { display: none; }
.sh-nav-cta, .sh-nav-back { white-space: nowrap; }

/* Hero */
.sh-hero { border-bottom: 1px solid #E4DED4; }
.sh-hero-inner {
  max-width: 720px; margin: 0 auto; padding: 48px 20px 48px; text-align: center;
}
.sh-hero-title { font-size: 42px; font-weight: 800; line-height: 1.1; letter-spacing: -1px; color: #211C32; margin: 0 0 16px; }
.sh-motto {
  margin: 0 0 16px; padding: 10px 0 10px 16px;
  border-left: 3px solid #C9711E; color: #C9711E;
  font-size: 17px; font-weight: 600; font-style: italic; text-align: left; display: inline-block;
}
.sh-hero-desc { font-size: 16px; color: #5A5470; margin: 0; }

/* Content */
.sh-content { padding-bottom: 40px; }

/* Section */
.sh-section { padding: 36px 20px; }
.sh-section + .sh-section { border-top: 1px solid #E4DED4; }
.sh-section-inner { max-width: 1024px; margin: 0 auto; }
.sh-section-head {
  display: flex; align-items: baseline; justify-content: space-between;
  margin-bottom: 20px;
}
.sh-section-heading {
  font-size: 22px; font-weight: 700; color: #211C32; margin: 0;
  display: flex; align-items: center; gap: 8px;
}
.sh-section-icon { font-size: 20px; }
.sh-section-more {
  text-decoration: none; font-size: 14px; font-weight: 500; color: #4338CA;
  transition: color .12s;
}
.sh-section-more:hover { color: #352BA3; }

/* Story Grid */
.sh-story-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}
.sh-featured .sh-card {
  border-color: #C9711E;
  background: #FFFBF5;
}

/* Card */
.sh-card {
  display: block; text-decoration: none; color: inherit;
  background: #FFFFFF; border: 1px solid #E4DED4; border-radius: 14px;
  overflow: hidden; transition: box-shadow .15s, transform .15s;
}
.sh-card:hover {
  box-shadow: 0 8px 28px -14px rgba(33,28,50,.16);
  transform: translateY(-2px);
}
.sh-card-img-wrap {
  aspect-ratio: 3 / 2; overflow: hidden; background: #F2EEE7;
}
.sh-card-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.sh-card-img-placeholder {
  width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #EEEBFB 0%, #E4DED4 100%);
}
.sh-card-img-icon { font-size: 40px; opacity: 0.35; }
.sh-card-body { padding: 16px 18px 18px; }
.sh-card-topic {
  display: inline-block; font-size: 11px; font-weight: 600; color: #4338CA;
  background: #EEEBFB; padding: 2px 8px; border-radius: 6px; margin-bottom: 8px;
  text-transform: uppercase; letter-spacing: 0.3px;
}
.sh-card-title {
  font-size: 16px; font-weight: 700; color: #211C32; line-height: 1.4;
  margin: 0 0 8px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.sh-card-meta { font-size: 12.5px; color: #8A8499; display: flex; align-items: center; gap: 6px; }
.sh-card-author { font-weight: 500; color: #5A5470; }
.sh-card-sep { color: #C4BED4; }
.sh-card-date { color: #8A8499; }

/* Topics */
.sh-topics { display: flex; flex-wrap: wrap; gap: 10px; }
.sh-topic-chip {
  display: inline-flex; text-decoration: none;
  padding: 8px 16px; border-radius: 10px; font-size: 14px; font-weight: 500;
  background: #FFFFFF; border: 1px solid #E4DED4; color: #5A5470;
  transition: border-color .12s, color .12s, background .12s;
}
.sh-topic-chip:hover { border-color: #4338CA; color: #4338CA; background: #F8F6FF; }

/* Search */
.sh-search-placeholder { text-align: center; padding: 24px 0; }
.sh-search-placeholder p { font-size: 14px; color: #8A8499; margin: 0 0 14px; }
.sh-search-box { display: flex; max-width: 400px; margin: 0 auto; gap: 8px; }
.sh-search-input {
  flex: 1; padding: 10px 16px; border: 1px solid #E4DED4; border-radius: 10px;
  font-size: 14px; font-family: inherit; background: #FFFFFF; color: #8A8499;
}
.sh-search-btn {
  padding: 10px 16px; border: 1px solid #E4DED4; border-radius: 10px;
  background: #FFFFFF; cursor: not-allowed; font-size: 16px;
}

/* Loading */
.sh-loading { text-align: center; padding: 80px 20px; color: #8A8499; }

/* Invitation */
.sh-invitation {
  text-align: center; border-top: 1px solid #E4DED4; border-bottom: 1px solid #E4DED4;
  background: #FFFFFF; padding: 56px 20px;
}
.sh-invitation-inner { text-align: center; }
.sh-invite-q { font-size: 16px; font-weight: 600; color: #C9711E; margin: 0 0 12px; }
.sh-invite-motto { font-size: 16px; font-style: italic; color: #5A5470; margin: 0 auto 24px; max-width: 500px; line-height: 1.6; border: none; padding: 0; }
.sh-invite-btn {
  display: inline-flex; align-items: center; gap: 8px; font-weight: 600; font-size: 15px;
  border-radius: 12px; padding: 13px 22px; cursor: pointer; border: none;
  font-family: inherit; text-decoration: none;
  background: #4338CA; color: #fff; transition: background .15s;
}
.sh-invite-btn:hover { background: #352BA3; }

/* Footer */
.sh-footer { padding: 32px 20px; background: #F2EEE7; }
.sh-footer-inner { max-width: 1024px; margin: 0 auto; text-align: center; }
.sh-footer-links { display: flex; align-items: center; justify-content: center; gap: 16px; flex-wrap: wrap; margin-bottom: 12px; }
.sh-footer-links a { text-decoration: none; color: #5A5470; font-size: 14px; font-weight: 500; }
.sh-footer-links a:hover { color: #4338CA; }
.sh-footer-sep { color: #C4BED4; font-size: 12px; }
.sh-footer-copy { font-size: 13px; color: #8A8499; }

/* Responsive */
@media (max-width: 640px) {
  /* nav hẹp: rút "Về app" → "App", tiêu đề nhỏ lại để 2 nút vẫn đủ chỗ */
  .sh-nav-back-full { display: none; }
  .sh-nav-back-short { display: inline; }
  .sh-nav-back, .sh-nav-cta { padding: 8px 10px; font-size: 12.5px; }
  .sh-nav-actions { gap: 6px; flex-shrink: 0; }
  .sh-brand { font-size: 13.5px; min-width: 0; }
  .sh-brand-full { display: none; }
  .sh-brand-short { display: inline; }
  .sh-hero-inner { padding: 36px 16px 32px; }
  .sh-hero-title { font-size: 30px; }
  .sh-motto { font-size: 15px; }
  .sh-story-grid { grid-template-columns: 1fr; gap: 14px; }
  .sh-section-head { flex-direction: column; gap: 8px; align-items: flex-start; }
  .sh-section { padding: 28px 16px; }
  .sh-topics { gap: 8px; }
  .sh-topic-chip { padding: 6px 12px; font-size: 13px; }
  .sh-invitation { padding: 40px 16px; }
  .sh-invite-btn { width: 100%; justify-content: center; }
}
`
