// ── /editorial — Ban biên tập ──
import { useState, useEffect } from 'react'
import { supabase } from './supabase'

type Tab = 'inbox' | 'categories' | 'series'
type StoryStatus = 'telling' | 'drafting' | 'submitted' | 'editing' | 'published'

interface Story {
  id: string
  title: string
  author: string
  submittedAt: string
  status: StoryStatus
  content: string
  conversation?: { role: string; text: string; at: string }[]
}

interface Category {
  id: string; name: string; slug: string
}

interface Series {
  id: string; name: string; slug: string; description: string | null
}

const DB_STATUS_MAP: Record<string, StoryStatus> = {
  telling: 'telling',
  writing: 'telling',
  user_review: 'drafting',
  submitted: 'submitted',
  pending_publish: 'editing',
  published: 'published',
}

const STATUS_LABELS: Record<StoryStatus, string> = {
  telling: 'Đang kể',
  drafting: 'Chờ tác giả duyệt',
  submitted: 'Chờ đọc',
  editing: 'Đang biên tập',
  published: 'Đã xuất bản',
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const STATUS_FILTERS = [
  { key: 'telling', label: '✍️ Đang kể' },
  { key: 'drafting', label: '📝 Chờ tác giả duyệt' },
  { key: 'submitted', label: '📥 Chờ đọc' },
  { key: 'editing', label: '📋 Đang biên tập' },
  { key: 'published', label: '🌱 Đã xuất bản' },
] as const

// ══════════════════════════════════════════
export default function EditorPage() {
  const [tab, setTab] = useState<Tab>('inbox')
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [selected, setSelected] = useState<Story | null>(null)
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch all stories via edge function (bypasses RLS)
  useEffect(() => {
    supabase.functions.invoke('story-ai', {
      body: { action: 'list_all', admin_key: 'st-1001-adm-7x9k2' },
    }).then(({ data, error }) => {
      if (error || !data?.stories) { console.error('Editor fetch error:', error); setLoading(false); return }
      const mapped: Story[] = (data.stories || []).map((s: any) => ({
        id: s.id,
        title: s.title || 'Chưa có tiêu đề',
        author: s.pen_name || 'Ẩn danh',
        submittedAt: s.published_at || s.created_at || new Date().toISOString(),
        status: DB_STATUS_MAP[s.status] || 'telling',
        conversation: s.conversation || [],
        content: s.content || '',
      }))
      setStories(mapped)
      setLoading(false)
    })
  }, [])

  const filtered = activeFilter
    ? stories.filter(s => s.status === activeFilter)
    : stories

  return (
    <div className="ed-root">
      <style>{CSS}</style>

      <header className="ed-header">
        <div className="ed-header-inner">
          <div>
            <h1 className="ed-title">Ban biên tập</h1>
            <p className="ed-subtitle">Quản lý các câu chuyện được gửi từ cộng đồng.</p>
          </div>
          <a href="/story" className="ed-mag-link">← Tạp chí</a>
        </div>
      </header>

      <div className="ed-body">
        <aside className="ed-sidebar">
          <nav className="ed-nav">
            <div className="ed-nav-section">Hộp thư</div>
            <button className={`ed-nav-item ${tab === 'inbox' && !activeFilter ? 'ed-nav-active' : ''}`}
              onClick={() => { setTab('inbox'); setActiveFilter(null) }}>
              Tất cả
            </button>
            {STATUS_FILTERS.map(f => (
              <button key={f.key}
                className={`ed-nav-item ${tab === 'inbox' && activeFilter === f.key ? 'ed-nav-active' : ''}`}
                onClick={() => { setTab('inbox'); setActiveFilter(f.key) }}>
                {f.label}
              </button>
            ))}
            <div className="ed-nav-section">Quản lý</div>
            <button className={`ed-nav-item ${tab === 'categories' ? 'ed-nav-active' : ''}`}
              onClick={() => { setTab('categories'); setActiveFilter(null); setSelected(null) }}>
              📚 Chủ đề
            </button>
            <button className={`ed-nav-item ${tab === 'series' ? 'ed-nav-active' : ''}`}
              onClick={() => { setTab('series'); setActiveFilter(null); setSelected(null) }}>
              📖 Series
            </button>
          </nav>
        </aside>

        <main className="ed-main">
          {tab === 'inbox' && (
            loading ? <div className="ed-count" style={{padding:20}}>Đang tải...</div>
            : <InboxView stories={filtered} onSelect={setSelected} />
          )}
          {tab === 'categories' && <CategoriesView />}
          {tab === 'series' && <SeriesView />}
        </main>

        {tab === 'inbox' && selected && (
          <DetailPanel story={selected} onClose={() => setSelected(null)} />
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════
// INBOX VIEW
// ══════════════════════════════════════════
function InboxView({ stories, onSelect }: { stories: Story[]; onSelect: (s: Story) => void }) {
  return (
    <>
      <div className="ed-toolbar">
        <span className="ed-count">{stories.length} câu chuyện</span>
      </div>
      <div className="ed-list">
        {stories.map(story => (
          <article key={story.id} className="ed-card" onClick={() => onSelect(story)}>
            <div className="ed-card-body">
              <h2 className="ed-card-title">{story.title}</h2>
              <div className="ed-card-meta">
                <span className="ed-card-author">{story.author}</span>
                <span className="ed-card-sep">·</span>
                <span className="ed-card-date">{fmtDate(story.submittedAt)}</span>
              </div>
              <StatusBadge status={story.status} />
            </div>
            <div className="ed-card-arrow">→</div>
          </article>
        ))}
      </div>
    </>
  )
}

// ══════════════════════════════════════════
// CATEGORIES VIEW
// ══════════════════════════════════════════
function CategoriesView() {
  const [cats, setCats] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('categories').select('*').order('name')
      .then(({ data }) => { setCats((data as Category[]) || []); setLoading(false) })
    // eslint-disable-next-line
    ;
  }, [])

  if (loading) return <div className="ed-count">Đang tải...</div>

  return (
    <>
      <div className="ed-toolbar">
        <span className="ed-count">{cats.length} chủ đề</span>
      </div>
      <div className="ed-list">
        {cats.map(c => (
          <div key={c.id} className="ed-card">
            <div className="ed-card-body">
              <h2 className="ed-card-title">{c.name}</h2>
              <div className="ed-card-meta">
                <code className="ed-slug">{c.slug}</code>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ══════════════════════════════════════════
// SERIES VIEW
// ══════════════════════════════════════════
function SeriesView() {
  const [list, setList] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('series').select('*').order('name')
      .then(({ data }) => { setList((data as Series[]) || []); setLoading(false) })
    // eslint-disable-next-line
    ;
  }, [])

  if (loading) return <div className="ed-count">Đang tải...</div>

  return (
    <>
      <div className="ed-toolbar">
        <span className="ed-count">{list.length} series</span>
      </div>
      <div className="ed-list">
        {list.map(s => (
          <div key={s.id} className="ed-card">
            <div className="ed-card-body">
              <h2 className="ed-card-title">{s.name}</h2>
              <div className="ed-card-meta">
                <code className="ed-slug">{s.slug}</code>
              </div>
              {s.description && <p className="ed-card-desc">{s.description}</p>}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ══════════════════════════════════════════
// DETAIL PANEL
// ══════════════════════════════════════════
function DetailPanel({ story, onClose }: { story: Story; onClose: () => void }) {
  return (
    <aside className="ed-detail">
      <div className="ed-detail-header">
        <button className="ed-detail-close" onClick={onClose}>✕</button>
      </div>
      <div className="ed-detail-body">
        <StatusBadge status={story.status} />
        <h2 className="ed-detail-title">{story.title}</h2>
        <div className="ed-detail-meta">
          <span>{story.author}</span>
          <span className="ed-card-sep">·</span>
          <span>{fmtDate(story.submittedAt)}</span>
        </div>
        <div className="ed-detail-content">
          {story.status === 'telling' && story.conversation ? (
            story.conversation.filter(m => m.role === 'user').map((m, i) => (
              <div key={i} className="ed-convo-msg">
                <span className="ed-convo-role">🧑 Người kể:</span>
                <p>{m.text}</p>
              </div>
            ))
          ) : story.content ? (
            story.content.split('\n').map((p, i) => (
              p.trim() ? <p key={i}>{p}</p> : <br key={i} />
            ))
          ) : (
            <p className="ed-empty">Chưa có nội dung</p>
          )}
        </div>
      </div>
    </aside>
  )
}

// ══════════════════════════════════════════
// STATUS BADGE
// ══════════════════════════════════════════
function StatusBadge({ status }: { status: Story['status'] }) {
  return (
    <span className={`ed-badge ed-badge-${status}`}>
      <span className="ed-badge-dot" />
      {STATUS_LABELS[status]}
    </span>
  )
}

// ══════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════
const CSS = `
.ed-root { min-height:100dvh; background:#F9F8F6; color:#1A1A1A; font-family:'Inter',system-ui,sans-serif; line-height:1.5; font-size:15px; -webkit-font-smoothing:antialiased; }

.ed-header { background:#FFFFFF; border-bottom:1px solid #E5E0D8; }
.ed-header-inner { max-width:1200px; margin:0 auto; padding:28px 24px; display:flex; align-items:flex-start; justify-content:space-between; }
.ed-title { font-size:28px; font-weight:700; color:#1A1A1A; margin:0 0 4px; letter-spacing:-0.3px; }
.ed-subtitle { font-size:14px; color:#8C8C8C; margin:0; }
.ed-mag-link { text-decoration:none; color:#6B6B6B; font-size:13px; font-weight:500; padding:6px 14px; border:1px solid #E5E0D8; border-radius:6px; white-space:nowrap; transition:background .15s,color .15s; }
.ed-mag-link:hover { background:#F5F2ED; color:#1A1A1A; }

.ed-body { max-width:1200px; margin:0 auto; display:flex; min-height:calc(100dvh - 100px); }

/* Sidebar */
.ed-sidebar { width:220px; flex-shrink:0; border-right:1px solid #E5E0D8; background:#FFFFFF; padding:16px 0; }
.ed-nav { display:flex; flex-direction:column; gap:2px; }
.ed-nav-section { font-size:11px; font-weight:600; color:#B0A89A; text-transform:uppercase; letter-spacing:0.6px; padding:16px 20px 6px; }
.ed-nav-item { display:block; width:100%; text-align:left; padding:9px 20px; border:none; background:none; font-family:inherit; font-size:14px; color:#5C5C5C; cursor:pointer; transition:background .12s,color .12s; border-left:3px solid transparent; }
.ed-nav-item:hover { background:#F5F2ED; color:#1A1A1A; }
.ed-nav-active { background:#F5F2ED; color:#1A1A1A; font-weight:600; border-left-color:#8B7355; }

/* Main */
.ed-main { flex:1; padding:24px; background:#F9F8F6; }
.ed-toolbar { margin-bottom:16px; }
.ed-count { font-size:13px; color:#8C8C8C; font-weight:500; }
.ed-list { display:flex; flex-direction:column; gap:8px; }

/* Card */
.ed-card { display:flex; align-items:center; background:#FFFFFF; border:1px solid #EBE5DB; border-radius:8px; padding:18px 20px; cursor:pointer; transition:box-shadow .15s,border-color .15s; }
.ed-card:hover { border-color:#D4C9B8; box-shadow:0 2px 12px rgba(0,0,0,0.04); }
.ed-card-body { flex:1; min-width:0; }
.ed-card-title { font-size:16px; font-weight:600; color:#1A1A1A; margin:0 0 6px; line-height:1.3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ed-card-meta { font-size:13px; color:#8C8C8C; display:flex; align-items:center; gap:6px; margin-bottom:8px; }
.ed-card-author { font-weight:500; color:#5C5C5C; }
.ed-card-sep { color:#C4BEB4; }
.ed-card-date { color:#8C8C8C; }
.ed-card-arrow { font-size:16px; color:#C4BEB4; flex-shrink:0; margin-left:12px; transition:color .15s,transform .15s; }
.ed-card:hover .ed-card-arrow { color:#8B7355; transform:translateX(2px); }
.ed-card-desc { font-size:13px; color:#8C8C8C; margin:4px 0 0; line-height:1.5; }
.ed-slug { font-size:12px; color:#8C8C8C; background:#F5F2ED; padding:1px 8px; border-radius:4px; font-family:monospace; }

/* Badge */
.ed-badge { display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:500; padding:3px 10px; border-radius:12px; }
.ed-badge-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
.ed-badge-submitted { background:#F0EDE6; color:#8B7355; } .ed-badge-submitted .ed-badge-dot { background:#A68A61; }
.ed-badge-editing { background:#EDF2F7; color:#4A6FA5; } .ed-badge-editing .ed-badge-dot { background:#4A6FA5; }
.ed-badge-waiting_author { background:#FDF2E9; color:#B7791F; } .ed-badge-waiting_author .ed-badge-dot { background:#B7791F; }
.ed-badge-telling { background:#F0F7FF; color:#4A6FA5; } .ed-badge-telling .ed-badge-dot { background:#4A6FA5; }
.ed-badge-drafting { background:#FDF2E9; color:#B7791F; } .ed-badge-drafting .ed-badge-dot { background:#B7791F; }

.ed-badge-published { background:#EDF7EE; color:#3C7A42; } .ed-badge-published .ed-badge-dot { background:#3C7A42; }
.ed-badge-archived { background:#F2F2F2; color:#8C8C8C; } .ed-badge-archived .ed-badge-dot { background:#8C8C8C; }

/* Detail Panel */
.ed-detail { width:420px; flex-shrink:0; border-left:1px solid #E5E0D8; background:#FFFFFF; overflow-y:auto; max-height:calc(100dvh - 100px); position:sticky; top:0; }
.ed-detail-header { display:flex; justify-content:flex-end; padding:12px 16px; border-bottom:1px solid #F0EDE6; }
.ed-detail-close { background:none; border:none; font-size:18px; color:#8C8C8C; cursor:pointer; padding:4px 8px; border-radius:4px; transition:background .12s,color .12s; }
.ed-detail-close:hover { background:#F5F2ED; color:#1A1A1A; }
.ed-detail-body { padding:20px 24px 40px; }
.ed-detail-title { font-size:22px; font-weight:700; color:#1A1A1A; margin:12px 0 8px; line-height:1.3; letter-spacing:-0.2px; }
.ed-detail-meta { font-size:13px; color:#8C8C8C; display:flex; align-items:center; gap:6px; margin-bottom:20px; }
.ed-detail-content { font-size:15px; line-height:1.8; color:#3A3A3A; }
.ed-detail-content p { margin:0 0 1.2em; }
.ed-detail-content p:last-child { margin-bottom:0; }
.ed-convo-msg { margin-bottom:16px; }
.ed-convo-role { font-size:12px; font-weight:600; color:#8C8C8C; display:block; margin-bottom:4px; }
.ed-convo-msg p { font-size:15px; line-height:1.6; color:#3A3A3A; margin:0; }
.ed-empty { color:#8C8C8C; font-style:italic; }

/* Responsive */
@media (max-width: 768px) {
  .ed-header-inner { padding:20px 16px; flex-direction:column; gap:12px; }
  .ed-title { font-size:24px; }
  .ed-body { flex-direction:column; }
  .ed-sidebar { width:100%; border-right:none; border-bottom:1px solid #E5E0D8; padding:0; }
  .ed-nav { flex-direction:row; overflow-x:auto; padding:8px 12px; gap:4px; }
  .ed-nav-section { display:none; }
  .ed-nav-item { padding:8px 14px; font-size:13px; border-left:none; border-bottom:2px solid transparent; white-space:nowrap; }
  .ed-nav-active { border-left-color:transparent; border-bottom-color:#8B7355; }
  .ed-main { padding:16px; }
  .ed-card { padding:14px 16px; }
  .ed-detail { width:100%; max-height:none; position:fixed; top:0; left:0; right:0; bottom:0; z-index:100; border-left:none; }
}
`
