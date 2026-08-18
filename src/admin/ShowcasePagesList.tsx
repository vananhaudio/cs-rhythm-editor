// ── Admin / Showcase Pages List ──
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import type { ShowcasePage, ShowcaseCategory } from '../showcase/types'

interface Props {
  onBack: () => void
  onNew: () => void
  onEdit: (id: string) => void
}

export default function ShowcasePagesList({ onBack, onNew, onEdit }: Props) {
  const [pages, setPages] = useState<ShowcasePage[]>([])
  const [categories, setCategories] = useState<ShowcaseCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterFeatured, setFilterFeatured] = useState<string>('all')

  const loadPages = useCallback(async () => {
    let query = supabase.from('showcase_pages').select('*').order('sort_order').order('created_at', { ascending: false })

    if (filterCat) query = query.eq('category_id', filterCat)
    if (filterStatus === 'published') query = query.eq('published', true)
    if (filterStatus === 'draft') query = query.eq('published', false)
    if (filterFeatured === 'yes') query = query.eq('featured', true)
    if (filterFeatured === 'no') query = query.eq('featured', false)
    if (search) query = query.ilike('title', `%${search}%`)

    const { data } = await query
    setPages((data as ShowcasePage[]) || [])
    setLoading(false)
  }, [search, filterCat, filterStatus, filterFeatured])

  useEffect(() => {
    Promise.all([
      supabase.from('showcase_categories').select('*').order('sort_order'),
    ]).then(([catRes]) => {
      setCategories((catRes.data as ShowcaseCategory[]) || [])
    })
  }, [])

  useEffect(() => { loadPages() }, [loadPages])

  async function togglePublished(page: ShowcasePage) {
    await supabase.from('showcase_pages').update({ published: !page.published }).eq('id', page.id)
    loadPages()
  }

  async function toggleFeatured(page: ShowcasePage) {
    await supabase.from('showcase_pages').update({ featured: !page.featured }).eq('id', page.id)
    loadPages()
  }

  async function removePage(id: string) {
    if (!confirm('Xoá trang này? Hành động này không thể hoàn tác.')) return
    await supabase.from('showcase_page_blocks').delete().eq('page_id', id)
    await supabase.from('showcase_pages').delete().eq('id', id)
    loadPages()
  }

  function catName(id: string | null) {
    if (!id) return '—'
    return categories.find(c => c.id === id)?.name || '—'
  }

  if (loading) return <div className="spl-loading">Đang tải...</div>

  return (
    <div className="spl-root">
      <style>{CSS}</style>

      <div className="spl-header">
        <button className="spl-back" onClick={onBack}>← Showcase</button>
        <h2 className="spl-title">Trang</h2>
        <button className="spl-new-btn" onClick={onNew}>+ Trang mới</button>
      </div>

      {/* Filters */}
      <div className="spl-filters">
        <input
          className="spl-search"
          type="text"
          placeholder="Tìm kiếm..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="spl-select" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">Tất cả danh mục</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="spl-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">Tất cả trạng thái</option>
          <option value="published">Đã xuất bản</option>
          <option value="draft">Bản nháp</option>
        </select>
        <select className="spl-select" value={filterFeatured} onChange={e => setFilterFeatured(e.target.value)}>
          <option value="all">Tất cả</option>
          <option value="yes">Nổi bật</option>
          <option value="no">Thường</option>
        </select>
      </div>

      {/* Table */}
      <div className="spl-table-wrap">
        <table className="spl-table">
          <thead>
            <tr>
              <th>Tiêu đề</th>
              <th>Danh mục</th>
              <th>#</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pages.length === 0 && (
              <tr><td colSpan={5} className="spl-empty">Chưa có trang nào</td></tr>
            )}
            {pages.map(p => (
              <tr key={p.id}>
                <td>
                  <div className="spl-page-title">{p.title}</div>
                  <div className="spl-page-slug">/{p.slug}</div>
                </td>
                <td className="spl-cat-cell">{catName(p.category_id)}</td>
                <td className="spl-order-cell">{p.sort_order}</td>
                <td>
                  <div className="spl-badges">
                    {p.published
                      ? <span className="spl-badge-pub">Xuất bản</span>
                      : <span className="spl-badge-draft">Nháp</span>}
                    {p.featured && <span className="spl-badge-feat">⭐ Nổi bật</span>}
                  </div>
                </td>
                <td className="spl-actions">
                  <button className="spl-action-btn" onClick={() => onEdit(p.id)}>Sửa</button>
                  <button className="spl-action-btn spl-action-sm" onClick={() => togglePublished(p)}>
                    {p.published ? 'Huỷ XB' : 'Xuất bản'}
                  </button>
                  <button className="spl-action-btn spl-action-sm" onClick={() => toggleFeatured(p)}>
                    {p.featured ? 'Bỏ NB' : '⭐'}
                  </button>
                  <button className="spl-action-btn spl-action-del" onClick={() => removePage(p.id)}>Xoá</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="spl-count">{pages.length} trang</div>
    </div>
  )
}

const CSS = `
.spl-root { max-width: 1100px; margin: 0 auto; padding: 32px 20px; font-family: 'Be Vietnam Pro', system-ui, sans-serif; }
.spl-loading { text-align: center; padding: 60px; color: #71717A; }
.spl-header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
.spl-back { background: none; border: none; color: #2D6A4F; font-size: 14px; font-weight: 500; cursor: pointer; padding: 0; }
.spl-back:hover { text-decoration: underline; }
.spl-title { font-size: 22px; font-weight: 700; color: #18181B; margin: 0; flex: 1; }
.spl-new-btn { padding: 8px 16px; background: #2D6A4F; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
.spl-new-btn:hover { background: #245A42; }

.spl-filters { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
.spl-search { flex: 1; min-width: 180px; padding: 9px 12px; border: 1px solid #E4E4E7; border-radius: 8px; font-size: 13px; font-family: inherit; }
.spl-search:focus { outline: none; border-color: #2D6A4F; }
.spl-select { padding: 9px 12px; border: 1px solid #E4E4E7; border-radius: 8px; font-size: 13px; font-family: inherit; background: #fff; cursor: pointer; min-width: 140px; }

.spl-table-wrap { overflow-x: auto; }
.spl-table { width: 100%; border-collapse: collapse; }
.spl-table th { text-align: left; padding: 10px 12px; font-size: 12px; font-weight: 600; color: #71717A; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #E4E4E7; white-space: nowrap; }
.spl-table td { padding: 12px; border-bottom: 1px solid #F4F4F5; vertical-align: middle; }
.spl-table tr:hover td { background: #FAF9F7; }
.spl-page-title { font-weight: 600; color: #18181B; font-size: 14px; }
.spl-page-slug { font-size: 12px; color: #71717A; font-family: monospace; margin-top: 2px; }
.spl-cat-cell { font-size: 13px; color: #52525B; white-space: nowrap; }
.spl-order-cell { font-size: 13px; color: #71717A; }
.spl-empty { text-align: center; color: #71717A; padding: 32px; font-size: 14px; }
.spl-count { font-size: 12px; color: #71717A; margin-top: 12px; text-align: right; }

.spl-badges { display: flex; gap: 6px; flex-wrap: wrap; }
.spl-badge-pub { font-size: 11px; padding: 2px 8px; background: #F0FDF4; color: #16A34A; border-radius: 4px; font-weight: 600; }
.spl-badge-draft { font-size: 11px; padding: 2px 8px; background: #F4F4F5; color: #71717A; border-radius: 4px; font-weight: 600; }
.spl-badge-feat { font-size: 11px; padding: 2px 8px; background: #FFFBF5; color: #C9711E; border-radius: 4px; font-weight: 600; }

.spl-actions { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.spl-action-btn { padding: 5px 10px; background: none; border: 1px solid #CFE3D6; border-radius: 6px; color: #2D6A4F; font-size: 11px; cursor: pointer; font-family: inherit; white-space: nowrap; }
.spl-action-btn:hover { background: #E9F3EC; }
.spl-action-sm { border-color: #E4E4E7; color: #52525B; }
.spl-action-del { border-color: #FECACA; color: #DC2626; }
.spl-action-del:hover { background: #FEF2F2; }
`
