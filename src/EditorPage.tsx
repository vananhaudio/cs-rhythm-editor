// ── /editor — Ban biên tập ──
import { useState } from 'react'
import { MOCK_STORIES, STATUS_LABELS, type Story } from './data/stories'

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const STATUS_FILTERS = [
  { key: 'submitted', label: '📥 Chờ đọc' },
  { key: 'editing', label: '📝 Đang biên tập' },
  { key: 'waiting_author', label: '📨 Chờ tác giả duyệt' },
  { key: 'published', label: '🌱 Đã xuất bản' },
  { key: 'archived', label: '📦 Lưu trữ' },
] as const

export default function EditorPage() {
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [selected, setSelected] = useState<Story | null>(null)

  const filtered = activeFilter
    ? MOCK_STORIES.filter((s: Story) => s.status === activeFilter)
    : MOCK_STORIES

  return (
    <div className="ed-root">
      <style>{CSS}</style>

      {/* Header */}
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
        {/* Sidebar */}
        <aside className="ed-sidebar">
          <nav className="ed-nav">
            <button
              className={`ed-nav-item ${!activeFilter ? 'ed-nav-active' : ''}`}
              onClick={() => setActiveFilter(null)}
            >
              Tất cả
            </button>
            {STATUS_FILTERS.map(f => (
              <button
                key={f.key}
                className={`ed-nav-item ${activeFilter === f.key ? 'ed-nav-active' : ''}`}
                onClick={() => setActiveFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main */}
        <main className="ed-main">
          <div className="ed-toolbar">
            <span className="ed-count">{filtered.length} câu chuyện</span>
          </div>

          <div className="ed-list">
            {filtered.map((story: Story) => (
              <Card key={story.id} story={story} onClick={() => setSelected(story)} />
            ))}
          </div>
        </main>

        {/* Detail Panel */}
        {selected && (
          <aside className="ed-detail">
            <div className="ed-detail-header">
              <button className="ed-detail-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="ed-detail-body">
              <StatusBadge status={selected.status} />
              <h2 className="ed-detail-title">{selected.title}</h2>
              <div className="ed-detail-meta">
                <span>{selected.author}</span>
                <span className="ed-card-sep">·</span>
                <span>{fmtDate(selected.submittedAt)}</span>
              </div>
              <div className="ed-detail-content">
                {selected.content.split('\n').map((p, i) => (
                  p.trim() ? <p key={i}>{p}</p> : <br key={i} />
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}

// ── Card ──
function Card({ story, onClick }: { story: Story; onClick: () => void }) {
  return (
    <article className="ed-card" onClick={onClick}>
      <div className="ed-card-body">
        <h2 className="ed-card-title">{story.title}</h2>
        <div className="ed-card-meta">
          <span className="ed-card-author">{story.author}</span>
          <span className="ed-card-sep">·</span>
          <span className="ed-card-date">{fmtDate(story.submittedAt)}</span>
        </div>
        <div className="ed-card-status">
          <StatusBadge status={story.status} />
        </div>
      </div>
      <div className="ed-card-arrow">→</div>
    </article>
  )
}

// ── Status Badge ──
function StatusBadge({ status }: { status: Story['status'] }) {
  return (
    <span className={`ed-badge ed-badge-${status}`}>
      <span className="ed-badge-dot" />
      {STATUS_LABELS[status]}
    </span>
  )
}

// ── Styles ──
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

.ed-root {
  min-height: 100dvh;
  background: #F9F8F6;
  color: #1A1A1A;
  font-family: 'Inter', system-ui, sans-serif;
  line-height: 1.5;
  font-size: 15px;
  -webkit-font-smoothing: antialiased;
}

/* Header */
.ed-header {
  background: #FFFFFF;
  border-bottom: 1px solid #E5E0D8;
}
.ed-header-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 28px 24px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.ed-title {
  font-size: 28px;
  font-weight: 700;
  color: #1A1A1A;
  margin: 0 0 4px;
  letter-spacing: -0.3px;
}
.ed-subtitle {
  font-size: 14px;
  color: #8C8C8C;
  margin: 0;
}
.ed-mag-link {
  text-decoration: none;
  color: #6B6B6B;
  font-size: 13px;
  font-weight: 500;
  padding: 6px 14px;
  border: 1px solid #E5E0D8;
  border-radius: 6px;
  white-space: nowrap;
  transition: background .15s, color .15s;
}
.ed-mag-link:hover {
  background: #F5F2ED;
  color: #1A1A1A;
}

/* Body */
.ed-body {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  gap: 0;
  min-height: calc(100dvh - 100px);
}

/* Sidebar */
.ed-sidebar {
  width: 220px;
  flex-shrink: 0;
  border-right: 1px solid #E5E0D8;
  background: #FFFFFF;
  padding: 20px 0;
}
.ed-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ed-nav-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 10px 20px;
  border: none;
  background: none;
  font-family: inherit;
  font-size: 14px;
  color: #5C5C5C;
  cursor: pointer;
  transition: background .12s, color .12s;
  border-left: 3px solid transparent;
}
.ed-nav-item:hover {
  background: #F5F2ED;
  color: #1A1A1A;
}
.ed-nav-active {
  background: #F5F2ED;
  color: #1A1A1A;
  font-weight: 600;
  border-left-color: #8B7355;
}

/* Main */
.ed-main {
  flex: 1;
  padding: 24px;
  background: #F9F8F6;
}
.ed-toolbar {
  margin-bottom: 16px;
}
.ed-count {
  font-size: 13px;
  color: #8C8C8C;
  font-weight: 500;
}
.ed-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Card */
.ed-card {
  display: flex;
  align-items: center;
  background: #FFFFFF;
  border: 1px solid #EBE5DB;
  border-radius: 8px;
  padding: 18px 20px;
  cursor: pointer;
  transition: box-shadow .15s, border-color .15s;
}
.ed-card:hover {
  border-color: #D4C9B8;
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
}
.ed-card-body {
  flex: 1;
  min-width: 0;
}
.ed-card-title {
  font-size: 16px;
  font-weight: 600;
  color: #1A1A1A;
  margin: 0 0 6px;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ed-card-meta {
  font-size: 13px;
  color: #8C8C8C;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}
.ed-card-author {
  font-weight: 500;
  color: #5C5C5C;
}
.ed-card-sep {
  color: #C4BEB4;
}
.ed-card-date {
  color: #8C8C8C;
}
.ed-card-arrow {
  font-size: 16px;
  color: #C4BEB4;
  flex-shrink: 0;
  margin-left: 12px;
  transition: color .15s, transform .15s;
}
.ed-card:hover .ed-card-arrow {
  color: #8B7355;
  transform: translateX(2px);
}

/* Badge */
.ed-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: 12px;
}
.ed-badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ed-badge-submitted {
  background: #F0EDE6;
  color: #8B7355;
}
.ed-badge-submitted .ed-badge-dot {
  background: #A68A61;
}

.ed-badge-editing {
  background: #EDF2F7;
  color: #4A6FA5;
}
.ed-badge-editing .ed-badge-dot {
  background: #4A6FA5;
}

.ed-badge-waiting_author {
  background: #FDF2E9;
  color: #B7791F;
}
.ed-badge-waiting_author .ed-badge-dot {
  background: #B7791F;
}

.ed-badge-published {
  background: #EDF7EE;
  color: #3C7A42;
}
.ed-badge-published .ed-badge-dot {
  background: #3C7A42;
}

.ed-badge-archived {
  background: #F2F2F2;
  color: #8C8C8C;
}
.ed-badge-archived .ed-badge-dot {
  background: #8C8C8C;
}

/* Detail Panel */
.ed-detail {
  width: 420px;
  flex-shrink: 0;
  border-left: 1px solid #E5E0D8;
  background: #FFFFFF;
  overflow-y: auto;
  max-height: calc(100dvh - 100px);
  position: sticky;
  top: 0;
}
.ed-detail-header {
  display: flex;
  justify-content: flex-end;
  padding: 12px 16px;
  border-bottom: 1px solid #F0EDE6;
}
.ed-detail-close {
  background: none;
  border: none;
  font-size: 18px;
  color: #8C8C8C;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background .12s, color .12s;
}
.ed-detail-close:hover {
  background: #F5F2ED;
  color: #1A1A1A;
}
.ed-detail-body {
  padding: 20px 24px 40px;
}
.ed-detail-title {
  font-size: 22px;
  font-weight: 700;
  color: #1A1A1A;
  margin: 12px 0 8px;
  line-height: 1.3;
  letter-spacing: -0.2px;
}
.ed-detail-meta {
  font-size: 13px;
  color: #8C8C8C;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 20px;
}
.ed-detail-content {
  font-size: 15px;
  line-height: 1.8;
  color: #3A3A3A;
}
.ed-detail-content p {
  margin: 0 0 1.2em;
}
.ed-detail-content p:last-child {
  margin-bottom: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .ed-header-inner {
    padding: 20px 16px;
    flex-direction: column;
    gap: 12px;
  }
  .ed-title { font-size: 24px; }
  .ed-body {
    flex-direction: column;
  }
  .ed-sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid #E5E0D8;
    padding: 0;
  }
  .ed-nav {
    flex-direction: row;
    overflow-x: auto;
    padding: 8px 12px;
    gap: 4px;
  }
  .ed-nav-item {
    padding: 8px 14px;
    font-size: 13px;
    border-left: none;
    border-bottom: 2px solid transparent;
    white-space: nowrap;
  }
  .ed-nav-active {
    border-left-color: transparent;
    border-bottom-color: #8B7355;
  }
  .ed-main { padding: 16px; }
  .ed-card { padding: 14px 16px; }
  .ed-detail {
    width: 100%;
    max-height: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 100;
    border-left: none;
  }
}
`
