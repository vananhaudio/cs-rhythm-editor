// ── Admin / Showcase Categories — Simple CRUD ──
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import type { ShowcaseCategory } from '../showcase/types'

export default function ShowcaseCategories({ onBack }: { onBack: () => void }) {
  const [categories, setCategories] = useState<ShowcaseCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<ShowcaseCategory | null>(null)
  const [form, setForm] = useState({ name: '', slug: '', sort_order: 0, is_active: true })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadCategories() }, [])

  async function loadCategories() {
    const { data } = await supabase.from('showcase_categories').select('*').order('sort_order')
    setCategories((data as ShowcaseCategory[]) || [])
    setLoading(false)
  }

  function startEdit(cat: ShowcaseCategory) {
    setEditing(cat)
    setForm({ name: cat.name, slug: cat.slug, sort_order: cat.sort_order, is_active: cat.is_active })
  }

  function startNew() {
    setEditing(null)
    setForm({ name: '', slug: '', sort_order: categories.length + 1, is_active: true })
  }

  function slugify(text: string) {
    return text.toLowerCase()
      .replace(/[đĐ]/g, 'd')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    const slug = form.slug || slugify(form.name)

    if (editing) {
      await supabase.from('showcase_categories').update({
        name: form.name, slug, sort_order: form.sort_order, is_active: form.is_active,
      }).eq('id', editing.id)
    } else {
      await supabase.from('showcase_categories').insert({
        name: form.name, slug, sort_order: form.sort_order, is_active: form.is_active,
      })
    }
    setEditing(null)
    setSaving(false)
    loadCategories()
  }

  async function remove(id: string) {
    if (!confirm('Xoá danh mục này?')) return
    await supabase.from('showcase_categories').delete().eq('id', id)
    loadCategories()
  }

  if (loading) return <div className="sc-loading">Đang tải...</div>

  return (
    <div className="sc-root">
      <style>{CSS}</style>
      <div className="sc-header">
        <button className="sc-back" onClick={onBack}>← Showcase</button>
        <h2 className="sc-title">Danh mục</h2>
        <button className="sc-add-btn" onClick={startNew}>+ Danh mục mới</button>
      </div>

      {/* Form */}
      {(editing !== undefined || !editing) && form.name !== undefined && editing === null ? null : null}
      {(editing !== null || (editing === null && form.name === '')) && (
        <div className="sc-form-overlay" onClick={() => setEditing(null)}>
          <div className="sc-form" onClick={e => e.stopPropagation()}>
            <h3>{editing ? 'Sửa danh mục' : 'Danh mục mới'}</h3>
            <label>
              Tên
              <input
                value={form.name}
                onChange={e => {
                  const name = e.target.value
                  setForm(f => ({
                    ...f,
                    name,
                    slug: editing ? f.slug : slugify(name),
                  }))
                }}
                placeholder="Tên danh mục"
                autoFocus
              />
            </label>
            <label>
              Slug
              <input
                value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                placeholder="ten-danh-muc"
              />
            </label>
            <label>
              Thứ tự
              <input
                type="number"
                value={form.sort_order}
                onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
              />
            </label>
            <label className="sc-check-label">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
              />
              Kích hoạt
            </label>
            <div className="sc-form-actions">
              <button className="sc-cancel-btn" onClick={() => setEditing(null)}>Huỷ</button>
              <button className="sc-save-btn" onClick={save} disabled={saving}>
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div className="sc-list">
        {categories.length === 0 && (
          <div className="sc-empty">Chưa có danh mục nào. Nhấn "+ Danh mục mới" để tạo.</div>
        )}
        {categories.map(cat => (
          <div key={cat.id} className={`sc-row ${!cat.is_active ? 'sc-inactive' : ''}`}>
            <div className="sc-row-info">
              <span className="sc-row-name">{cat.name}</span>
              <span className="sc-row-slug">/{cat.slug}</span>
              <span className="sc-row-order">#{cat.sort_order}</span>
              {!cat.is_active && <span className="sc-badge-inactive">Ẩn</span>}
            </div>
            <div className="sc-row-actions">
              <button className="sc-edit-btn" onClick={() => startEdit(cat)}>Sửa</button>
              <button className="sc-del-btn" onClick={() => remove(cat.id)}>Xoá</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const CSS = `
.sc-root { max-width: 720px; margin: 0 auto; padding: 32px 20px; font-family: 'Be Vietnam Pro', system-ui, sans-serif; }
.sc-loading { text-align: center; padding: 60px; color: #71717A; }
.sc-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
.sc-back { background: none; border: none; color: #2D6A4F; font-size: 14px; font-weight: 500; cursor: pointer; padding: 0; }
.sc-back:hover { text-decoration: underline; }
.sc-title { font-size: 22px; font-weight: 700; color: #18181B; margin: 0; flex: 1; }
.sc-add-btn { padding: 8px 16px; background: #2D6A4F; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
.sc-add-btn:hover { background: #245A42; }

.sc-list { display: flex; flex-direction: column; gap: 8px; }
.sc-empty { text-align: center; padding: 40px; color: #71717A; font-size: 14px; }
.sc-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background: #fff; border: 1px solid #E4E4E7; border-radius: 10px; gap: 12px; }
.sc-row:hover { border-color: #D4D4D8; }
.sc-inactive { opacity: 0.6; }
.sc-row-info { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-width: 0; }
.sc-row-name { font-weight: 600; color: #18181B; font-size: 15px; }
.sc-row-slug { font-size: 13px; color: #71717A; font-family: monospace; }
.sc-row-order { font-size: 12px; color: #D4D4D8; }
.sc-badge-inactive { font-size: 11px; padding: 2px 8px; background: #FEF2F2; color: #DC2626; border-radius: 4px; font-weight: 600; }
.sc-row-actions { display: flex; gap: 8px; flex-shrink: 0; }
.sc-edit-btn { padding: 6px 12px; background: none; border: 1px solid #CFE3D6; border-radius: 6px; color: #2D6A4F; font-size: 12px; cursor: pointer; font-family: inherit; }
.sc-edit-btn:hover { background: #E9F3EC; }
.sc-del-btn { padding: 6px 12px; background: none; border: 1px solid #FECACA; border-radius: 6px; color: #DC2626; font-size: 12px; cursor: pointer; font-family: inherit; }
.sc-del-btn:hover { background: #FEF2F2; }

/* Form overlay */
.sc-form-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
.sc-form { background: #fff; border-radius: 16px; padding: 28px; width: 100%; max-width: 440px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
.sc-form h3 { margin: 0 0 20px; font-size: 18px; font-weight: 700; color: #18181B; }
.sc-form label { display: block; margin-bottom: 14px; font-size: 13px; font-weight: 600; color: #52525B; }
.sc-form input[type="text"],
.sc-form input[type="number"] { width: 100%; padding: 10px 12px; border: 1px solid #E4E4E7; border-radius: 8px; font-size: 14px; margin-top: 4px; box-sizing: border-box; font-family: inherit; }
.sc-form input:focus { outline: none; border-color: #2D6A4F; }
.sc-check-label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.sc-check-label input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; }
.sc-form-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }
.sc-cancel-btn { padding: 8px 16px; background: none; border: 1px solid #E4E4E7; border-radius: 8px; font-size: 13px; cursor: pointer; font-family: inherit; color: #52525B; }
.sc-save-btn { padding: 8px 16px; background: #2D6A4F; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
.sc-save-btn:hover { background: #245A42; }
.sc-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
`
