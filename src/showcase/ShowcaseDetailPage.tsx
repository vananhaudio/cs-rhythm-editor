// ── /showcase/:slug — Page detail, renders blocks dynamically ──
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import type { ShowcasePage, ShowcasePageBlock, ShowcaseCategory } from './types'
import BlockRenderer, { BLOCK_RENDERER_CSS } from './BlockRenderer'

interface PageData extends ShowcasePage {
  category: ShowcaseCategory | null
  blocks: ShowcasePageBlock[]
}

export default function ShowcaseDetailPage() {
  const [page, setPage] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [navPages, setNavPages] = useState<{ id: string; title: string; slug: string }[]>([])

  useEffect(() => {
    const slug = window.location.pathname.replace('/showcase/', '').replace(/\/$/, '')
    if (!slug) { setNotFound(true); setLoading(false); return }

    let cancelled = false

    async function load() {
      // Load page
      const { data: pageData, error } = await supabase
        .from('showcase_pages')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .single()

      if (error || !pageData || cancelled) {
        setNotFound(true)
        setLoading(false)
        return
      }

      const p = pageData as ShowcasePage

      // Load category
      const { data: cat } = await supabase
        .from('showcase_categories')
        .select('*')
        .eq('id', p.category_id)
        .maybeSingle()

      // Load blocks
      const { data: blks } = await supabase
        .from('showcase_page_blocks')
        .select('*')
        .eq('page_id', p.id)
        .order('sort_order')

      // Load sibling pages for navigation
      const { data: siblings } = await supabase
        .from('showcase_pages')
        .select('id, title, slug')
        .eq('category_id', p.category_id)
        .eq('published', true)
        .order('sort_order')

      if (!cancelled) {
        setPage({
          ...p,
          category: (cat as ShowcaseCategory) || null,
          blocks: (blks as ShowcasePageBlock[]) || [],
        })
        setNavPages((siblings as { id: string; title: string; slug: string }[]) || [])
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  // Inject SEO meta
  useEffect(() => {
    if (page) {
      const title = page.seo_title || page.title
      document.title = title
      const metaDesc = document.querySelector('meta[name="description"]')
      if (metaDesc) {
        metaDesc.setAttribute('content', page.seo_description || page.summary || title)
      }
    }
  }, [page])

  if (loading) {
    return (
      <div className="sd-root">
        <style>{CSS}</style>
        <div className="sd-loading">Đang tải...</div>
      </div>
    )
  }

  if (notFound || !page) {
    return (
      <div className="sd-root">
        <style>{CSS}</style>
        <nav className="sd-nav">
          <div className="sd-nav-inner">
            <a href="/showcase" className="sd-back">← Showcase</a>
          </div>
        </nav>
        <div className="sd-notfound">
          <p className="sd-nf-icon">📄</p>
          <h2>Không tìm thấy trang</h2>
          <p>Trang này không tồn tại hoặc chưa được xuất bản.</p>
          <a href="/showcase" className="sd-nf-link">Về Showcase</a>
        </div>
      </div>
    )
  }

  const currentIdx = navPages.findIndex(p => p.id === page.id)
  const prevPage = currentIdx > 0 ? navPages[currentIdx - 1] : null
  const nextPage = currentIdx < navPages.length - 1 ? navPages[currentIdx + 1] : null

  return (
    <div className="sd-root">
      <style>{CSS}</style>

      {/* Nav */}
      <nav className="sd-nav">
        <div className="sd-nav-inner">
          <a href="/showcase" className="sd-back">← Showcase</a>
          {page.category && <span className="sd-nav-cat">{page.category.name}</span>}
        </div>
      </nav>

      {/* Article */}
      <article className="sd-article">
        {/* Category badge */}
        {page.category && (
          <div className="sd-cat-badge">{page.category.name}</div>
        )}

        {/* Header */}
        <header className="sd-header">
          <h1 className="sd-title">{page.title}</h1>
          {page.summary && <p className="sd-summary">{page.summary}</p>}
          <div className="sd-meta">
            {page.featured && <span className="sd-feat-badge">⭐ Nổi bật</span>}
            <span className="sd-date">
              {new Date(page.updated_at || page.created_at).toLocaleDateString('vi-VN', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </span>
          </div>
        </header>

        {/* Cover Image */}
        {page.cover_image && (
          <div className="sd-cover">
            <img
              src={page.cover_image}
              alt={page.title}
              className="sd-cover-img"
              onError={(e) => { (e.target as HTMLElement).style.display = 'none' }}
            />
          </div>
        )}

        {/* Content Blocks */}
        <div className="sd-blocks">
          {page.blocks.length === 0 && (
            <p className="sd-empty-blocks">Chưa có nội dung.</p>
          )}
          {page.blocks.map(block => (
            <BlockRenderer key={block.id} block={block} />
          ))}
        </div>

        {/* Prev / Next navigation */}
        {(prevPage || nextPage) && (
          <nav className="sd-page-nav">
            {prevPage && (
              <a href={`/showcase/${prevPage.slug}`} className="sd-pn-prev">
                <span className="sd-pn-label">← Trước</span>
                <span className="sd-pn-title">{prevPage.title}</span>
              </a>
            )}
            <span className="sd-pn-spacer" />
            {nextPage && (
              <a href={`/showcase/${nextPage.slug}`} className="sd-pn-next">
                <span className="sd-pn-label">Sau →</span>
                <span className="sd-pn-title">{nextPage.title}</span>
              </a>
            )}
          </nav>
        )}
      </article>

      {/* Footer */}
      <footer className="sd-footer">
        <div className="sd-footer-inner">
          <div className="sd-footer-links">
            <a href="/showcase">Showcase</a>
            <span className="sd-f-sep">·</span>
            <a href="https://zalo.me/vananhguitarist" target="_blank" rel="noopener">Liên hệ</a>
          </div>
          <div className="sd-footer-copy">© 2026 Thầy Văn Anh Guitar</div>
        </div>
      </footer>
    </div>
  )
}

const CSS = `
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
  padding-top: env(safe-area-inset-top, 0px);
}
.sd-nav-inner {
  max-width: 800px; margin: 0 auto; padding: 12px 20px;
  display: flex; align-items: center; justify-content: space-between;
}
.sd-back { text-decoration: none; color: #5A5470; font-size: 14px; font-weight: 500; }
.sd-back:hover { color: #4338CA; }
.sd-nav-cat { font-size: 12px; color: #8A8499; font-weight: 500; background: #fff; padding: 3px 10px; border-radius: 6px; border: 1px solid #E4DED4; }

.sd-article { max-width: 800px; margin: 0 auto; padding: 40px 20px 60px; }

.sd-cat-badge {
  display: inline-block; font-size: 12px; font-weight: 600; color: #4338CA;
  background: #EEEBFB; padding: 4px 12px; border-radius: 8px; margin-bottom: 16px;
  text-transform: uppercase; letter-spacing: 0.5px;
}

.sd-header { margin-bottom: 32px; }
.sd-title { font-size: 34px; font-weight: 800; line-height: 1.2; letter-spacing: -0.5px; color: #211C32; margin: 0 0 12px; }
.sd-summary { font-size: 18px; color: #5A5470; line-height: 1.6; margin: 0 0 12px; }
.sd-meta { font-size: 13px; color: #8A8499; display: flex; align-items: center; gap: 10px; }
.sd-feat-badge { font-size: 11px; color: #C9711E; background: #FFFBF5; padding: 2px 8px; border-radius: 4px; font-weight: 600; }
.sd-date { color: #8A8499; }

.sd-cover { margin-bottom: 32px; border-radius: 14px; overflow: hidden; }
.sd-cover-img { width: 100%; display: block; }

.sd-blocks { }
.sd-empty-blocks { text-align: center; color: #8A8499; padding: 32px; font-style: italic; }

/* Page navigation */
.sd-page-nav { display: flex; gap: 12px; margin-top: 48px; padding-top: 24px; border-top: 1px solid #E4DED4; }
.sd-pn-prev, .sd-pn-next {
  flex: 1; text-decoration: none; padding: 14px 16px; border-radius: 10px;
  background: #fff; border: 1px solid #E4DED4; transition: border-color .15s;
  display: flex; flex-direction: column; gap: 4px;
}
.sd-pn-prev { text-align: left; }
.sd-pn-next { text-align: right; }
.sd-pn-prev:hover, .sd-pn-next:hover { border-color: #4338CA; }
.sd-pn-spacer { flex: 1; display: none; }
.sd-pn-label { font-size: 12px; color: #8A8499; font-weight: 500; }
.sd-pn-title { font-size: 14px; font-weight: 600; color: #211C32; }

.sd-footer { padding: 32px 20px; }
.sd-footer-inner { max-width: 800px; margin: 0 auto; text-align: center; }
.sd-footer-links { display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 10px; }
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

/* Include block renderer styles */
${BLOCK_RENDERER_CSS}

@media (max-width: 640px) {
  .sd-title { font-size: 26px; }
  .sd-summary { font-size: 16px; }
  .sd-article { padding: 24px 16px 48px; }
  .sd-page-nav { flex-direction: column; }
}
`
