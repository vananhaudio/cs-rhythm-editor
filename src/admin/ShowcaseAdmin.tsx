// ── Admin / Showcase — Navigation hub ──
import { useState } from 'react'
import ShowcaseCategories from './ShowcaseCategories'
import ShowcasePagesList from './ShowcasePagesList'
import ShowcasePageEditor from './ShowcasePageEditor'

type Tab = 'nav' | 'pages' | 'editor' | 'categories'

export default function ShowcaseAdmin({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('nav')
  const [editPageId, setEditPageId] = useState<string | undefined>()

  if (tab === 'pages') {
    return (
      <ShowcasePagesList
        onBack={() => setTab('nav')}
        onNew={() => { setEditPageId(undefined); setTab('editor') }}
        onEdit={id => { setEditPageId(id); setTab('editor') }}
      />
    )
  }

  if (tab === 'editor') {
    return (
      <ShowcasePageEditor
        pageId={editPageId}
        onBack={() => setTab('pages')}
      />
    )
  }

  if (tab === 'categories') {
    return <ShowcaseCategories onBack={() => setTab('nav')} />
  }

  // NAV
  return (
    <div className="sa-root">
      <style>{CSS}</style>

      <div className="sa-header">
        <button className="sa-close" onClick={onClose}>← Admin</button>
        <h1 className="sa-title">Showcase</h1>
      </div>

      <div className="sa-nav-grid">
        <button className="sa-nav-card" onClick={() => setTab('pages')}>
          <span className="sa-nav-icon">📄</span>
          <span className="sa-nav-label">Trang</span>
          <span className="sa-nav-desc">Quản lý tất cả trang nội dung</span>
        </button>
        <button className="sa-nav-card" onClick={() => setTab('categories')}>
          <span className="sa-nav-icon">📁</span>
          <span className="sa-nav-label">Danh mục</span>
          <span className="sa-nav-desc">Quản lý danh mục phân loại</span>
        </button>
      </div>

      <div className="sa-preview">
        <p className="sa-preview-hint">Trang công khai: <a href="/showcase" target="_blank">/showcase</a></p>
      </div>
    </div>
  )
}

const CSS = `
.sa-root { max-width: 600px; margin: 0 auto; padding: 32px 20px; font-family: 'Be Vietnam Pro', system-ui, sans-serif; }
.sa-header { margin-bottom: 32px; }
.sa-close { background: none; border: none; color: #4338CA; font-size: 14px; font-weight: 500; cursor: pointer; padding: 0; margin-bottom: 8px; }
.sa-close:hover { text-decoration: underline; }
.sa-title { font-size: 28px; font-weight: 800; color: #211C32; margin: 0; }

.sa-nav-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.sa-nav-card {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 32px 20px; background: #fff; border: 1px solid #E4DED4; border-radius: 14px;
  cursor: pointer; font-family: inherit; text-align: center;
  transition: border-color .15s, box-shadow .15s;
}
.sa-nav-card:hover { border-color: #4338CA; box-shadow: 0 4px 20px rgba(67,56,202,0.1); }
.sa-nav-icon { font-size: 36px; }
.sa-nav-label { font-size: 16px; font-weight: 700; color: #211C32; }
.sa-nav-desc { font-size: 12px; color: #8A8499; line-height: 1.5; }

.sa-preview { margin-top: 32px; text-align: center; }
.sa-preview-hint { font-size: 13px; color: #8A8499; }
.sa-preview-hint a { color: #4338CA; font-weight: 500; }

@media (max-width: 480px) {
  .sa-nav-grid { grid-template-columns: 1fr; }
}
`
