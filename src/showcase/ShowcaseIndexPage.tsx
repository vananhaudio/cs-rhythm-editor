// ── /showcase — Public index: Pages grouped by Category ──
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

interface Category {
  id: string
  name: string
  slug: string
  sort_order: number
}

interface PageItem {
  id: string
  title: string
  slug: string
  summary: string | null
  cover_image: string | null
  featured: boolean
  sort_order: number
  created_at: string
}

interface CategoryGroup {
  category: Category
  pages: PageItem[]
}

export default function ShowcaseIndexPage() {
  const [groups, setGroups] = useState<CategoryGroup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      // Load categories
      const { data: cats } = await supabase
        .from('showcase_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')

      if (!cats || cancelled) { setLoading(false); return }

      // Load pages per category (limit 5 each)
      const groupsData: CategoryGroup[] = await Promise.all(
        (cats as Category[]).map(async (cat) => {
          const { data: pages } = await supabase
            .from('showcase_pages')
            .select('id, title, slug, summary, cover_image, featured, sort_order, created_at')
            .eq('category_id', cat.id)
            .eq('published', true)
            .order('sort_order')
            .order('created_at', { ascending: false })
            .limit(5)
          return { category: cat, pages: (pages as PageItem[]) || [] }
        })
      )

      if (!cancelled) {
        setGroups(groupsData.filter(g => g.pages.length > 0))
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="si-root">
        <style>{CSS}</style>
        <div className="si-loading">Đang tải...</div>
      </div>
    )
  }

  return (
    <div className="si-root">
      <style>{CSS}</style>

      {/* Nav */}
      <nav className="si-nav">
        <div className="si-nav-inner">
          <a href="/" className="si-brand">
            <img src="/logo-green.svg" alt="" className="si-brand-mark" />
            <span className="si-brand-text">class.vananhaudio.com</span>
          </a>
        </div>
      </nav>

      {/* Hero */}
      <header className="si-hero">
        <div className="si-hero-inner">
          <h1 className="si-hero-title">Showcase</h1>
          <p className="si-hero-desc">
            Kiến thức, quy trình và câu chuyện đồng hành cùng Guitar.
          </p>
        </div>
      </header>

      {/* Category sections */}
      <div className="si-content">
        {groups.length === 0 && (
          <section className="si-section">
            <div className="si-section-inner">
              <p className="si-empty">Chưa có nội dung nào được xuất bản.</p>
            </div>
          </section>
        )}

        {groups.map(group => (
          <section key={group.category.id} className="si-section">
            <div className="si-section-inner">
              <div className="si-section-head">
                <h2 className="si-section-title">{group.category.name}</h2>
              </div>

              <div className="si-pages">
                {group.pages.map(page => (
                  <a key={page.id} href={`/showcase/${page.slug}`} className="si-page-card">
                    {page.cover_image && (
                      <div className="si-page-img-wrap">
                        <img src={page.cover_image} alt="" loading="lazy" className="si-page-img"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none' }} />
                      </div>
                    )}
                    <div className="si-page-body">
                      <h3 className="si-page-title">
                        {page.featured && <span className="si-feat-star">⭐ </span>}
                        {page.title}
                      </h3>
                      {page.summary && <p className="si-page-summary">{page.summary}</p>}
                    </div>
                  </a>
                ))}
              </div>

              {/* "Xem tất cả" - shown when there are more than 5? Or just as a navigation hint. 
                  We don't have a separate category listing page currently, so skip for now. */}
            </div>
          </section>
        ))}
      </div>

      {/* Footer */}
      <footer className="si-footer">
        <div className="si-footer-inner">
          <div className="si-footer-copy">© 2026 Thầy Văn Anh Guitar</div>
        </div>
      </footer>
    </div>
  )
}

const CSS = `
.si-root { min-height: 100dvh; background: #F2EEE7; color: #211C32; font-family: 'Be Vietnam Pro', system-ui, sans-serif; line-height: 1.55; font-size: 16px; -webkit-font-smoothing: antialiased; }

.si-nav { border-bottom: 1px solid #E4DED4; background: rgba(242,238,231,0.9); backdrop-filter: blur(10px); position: sticky; top: 0; z-index: 40; padding-top: env(safe-area-inset-top, 0px); }
.si-nav-inner { max-width: 1024px; margin: 0 auto; padding: 12px 20px; display: flex; align-items: center; }
.si-brand { display: flex; align-items: center; gap: 10px; text-decoration: none; color: #211C32; font-weight: 700; font-size: 14px; }
.si-brand-mark { width: 26px; height: 26px; }
.si-brand-text { color: #5A5470; }

.si-hero { border-bottom: 1px solid #E4DED4; }
.si-hero-inner { max-width: 720px; margin: 0 auto; padding: 48px 20px; text-align: center; }
.si-hero-title { font-size: 36px; font-weight: 800; letter-spacing: -0.5px; margin: 0 0 12px; color: #211C32; }
.si-hero-desc { font-size: 16px; color: #5A5470; margin: 0; }

.si-content { padding-bottom: 40px; }

.si-section { padding: 32px 20px; }
.si-section + .si-section { border-top: 1px solid #E4DED4; }
.si-section-inner { max-width: 800px; margin: 0 auto; }
.si-section-head { margin-bottom: 16px; }
.si-section-title { font-size: 20px; font-weight: 700; color: #211C32; margin: 0; }

.si-pages { display: flex; flex-direction: column; gap: 8px; }
.si-empty { text-align: center; color: #8A8499; font-size: 15px; padding: 40px 0; }

.si-page-card {
  display: flex; gap: 16px; text-decoration: none; color: inherit;
  padding: 14px 18px; background: #fff; border: 1px solid #E4DED4;
  border-radius: 12px; transition: border-color .15s, box-shadow .15s;
  align-items: center;
}
.si-page-card:hover { border-color: #C4BED4; box-shadow: 0 4px 16px rgba(33,28,50,0.08); }

.si-page-img-wrap { flex-shrink: 0; width: 64px; height: 48px; border-radius: 8px; overflow: hidden; }
.si-page-img { width: 100%; height: 100%; object-fit: cover; }

.si-page-body { flex: 1; min-width: 0; }
.si-page-title { font-size: 15px; font-weight: 600; color: #211C32; margin: 0; line-height: 1.4; }
.si-feat-star { font-size: 14px; }
.si-page-summary { font-size: 13px; color: #8A8499; margin: 4px 0 0; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

.si-footer { padding: 32px 20px; text-align: center; }
.si-footer-inner { max-width: 800px; margin: 0 auto; }
.si-footer-copy { font-size: 13px; color: #8A8499; }

.si-loading { text-align: center; padding: 80px 20px; color: #8A8499; }

@media (max-width: 640px) {
  .si-hero-inner { padding: 32px 16px; }
  .si-hero-title { font-size: 28px; }
  .si-section { padding: 24px 16px; }
  .si-page-card { padding: 12px 14px; gap: 12px; }
  .si-page-img-wrap { width: 52px; height: 40px; }
}
`
