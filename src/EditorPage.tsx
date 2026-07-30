// ── /editorial — Ban biên tập ──
import { useState, useEffect, useCallback } from 'react'
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
  photos?: { url: string; caption?: string }[] | null
  // Đôi nét về người kể (Ban biên tập xem/sửa)
  author_full_name?: string | null
  author_age?: number | null
  author_hometown?: string | null
  author_living_in?: string | null
  author_job?: string | null
  author_bio?: string | null
  author_portrait_url?: string | null
  consent_bio_publish?: boolean | null
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

  // ── Nhập bài gửi qua Zalo (Ban biên tập tự đẩy lên) ──
  const [showNew, setShowNew] = useState(false)
  const [nTitle, setNTitle] = useState('')
  const [nAuthor, setNAuthor] = useState('')
  const [nLocation, setNLocation] = useState('')
  const [nContent, setNContent] = useState('')
  const [nSaving, setNSaving] = useState(false)
  const [nMsg, setNMsg] = useState('')
  const createStory = async () => {
    if (!nTitle.trim() || !nContent.trim()) { setNMsg('Cần có tiêu đề và nội dung.'); return }
    setNSaving(true); setNMsg('')
    try {
      const { data, error } = await supabase.functions.invoke('story-ai', {
        body: {
          admin_key: 'st-1001-adm-7x9k2', action: 'admin_insert_story',
          status: 'submitted',                       // vào tab "Chờ đọc", chưa lên Tạp chí
          title: nTitle.trim(), content: nContent.trim(),
          pen_name: nAuthor.trim(), author_name: nAuthor.trim(),
          location: nLocation.trim(),
        },
      })
      if (!error && data?.ok) {
        setNMsg('')
        setShowNew(false)
        setNTitle(''); setNAuthor(''); setNLocation(''); setNContent('')
        setTab('inbox'); setActiveFilter('submitted')
        load()
      } else setNMsg('Lỗi: ' + (data?.error || 'Không tạo được bài'))
    } catch (e: any) { setNMsg('Lỗi: ' + e.message) }
    setNSaving(false)
  }
  const [selected, setSelected] = useState<Story | null>(null)
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch all stories via edge function (bypasses RLS)
  const load = useCallback(() => {
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
        photos: s.photos ?? null,
        author_full_name: s.author_full_name ?? null,
        author_age: s.author_age ?? null,
        author_hometown: s.author_hometown ?? null,
        author_living_in: s.author_living_in ?? null,
        author_job: s.author_job ?? null,
        author_bio: s.author_bio ?? null,
        author_portrait_url: s.author_portrait_url ?? null,
        consent_bio_publish: s.consent_bio_publish ?? false,
      }))
      setStories(mapped)
      setLoading(false)
    })
  }, [])
  useEffect(() => { load() }, [load])

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
          <div className="ed-head-actions">
            <button className="ed-new-btn" onClick={() => setShowNew(true)}>✍️ Nhập bài gửi qua Zalo</button>
            <a href="/story" className="ed-mag-link">← Tạp chí</a>
          </div>
        </div>
      </header>

      {showNew && (
        <div className="ed-new-overlay" onClick={() => !nSaving && setShowNew(false)}>
          <div className="ed-new-card" onClick={e => e.stopPropagation()}>
            <h2 className="ed-new-title">Nhập bài gửi qua Zalo</h2>
            <p className="ed-new-sub">
              Bài sẽ vào mục <b>📥 Chờ đọc</b> — chọn chủ đề và ảnh bìa rồi mới xuất bản,
              đi đúng luồng như bài học viên tự gửi.
            </p>
            <input className="ed-bio-input ed-new-full" placeholder="Tiêu đề câu chuyện"
              value={nTitle} onChange={e => setNTitle(e.target.value)} />
            <div className="ed-bio-grid" style={{ marginTop: 8 }}>
              <input className="ed-bio-input" placeholder="Tên người kể (hoặc bút danh)"
                value={nAuthor} onChange={e => setNAuthor(e.target.value)} />
              <input className="ed-bio-input" placeholder="Địa phương (không bắt buộc)"
                value={nLocation} onChange={e => setNLocation(e.target.value)} />
            </div>
            <textarea className="ed-edit-textarea" style={{ marginTop: 8 }} rows={12}
              placeholder="Dán nội dung câu chuyện nhận được qua Zalo vào đây…"
              value={nContent} onChange={e => setNContent(e.target.value)} />
            {nMsg && <div className="ed-new-msg">{nMsg}</div>}
            <div className="ed-new-actions">
              <button className="ed-pub-quick-btn" disabled={nSaving} onClick={createStory}>
                {nSaving ? 'Đang tạo…' : '＋ Tạo bài, đưa vào Chờ đọc'}
              </button>
              <button className="ed-edit-btn" disabled={nSaving} onClick={() => setShowNew(false)}>Hủy</button>
            </div>
          </div>
        </div>
      )}

      <div className="ed-body">
        <aside className="ed-sidebar">
          <nav className="ed-nav">
            <div className="ed-nav-section">Hộp thư</div>
            <button className={`ed-nav-item ${tab === 'inbox' && !activeFilter ? 'ed-nav-active' : ''}`}
              onClick={() => { setTab('inbox'); setActiveFilter(null) }}>
              <span>Tất cả</span>
              {stories.length > 0 && <span className="ed-nav-count">{stories.length}</span>}
            </button>
            {STATUS_FILTERS.map(f => {
              const n = stories.filter(s => s.status === f.key).length
              return (
                <button key={f.key}
                  className={`ed-nav-item ${tab === 'inbox' && activeFilter === f.key ? 'ed-nav-active' : ''}`}
                  onClick={() => { setTab('inbox'); setActiveFilter(f.key) }}>
                  <span>{f.label}</span>
                  {n > 0 && <span className={`ed-nav-count ${f.key === 'submitted' ? 'ed-nav-count-hot' : ''}`}>{n}</span>}
                </button>
              )
            })}
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
            : <InboxView stories={filtered} onSelect={setSelected} selectedId={selected?.id} />
          )}
          {tab === 'categories' && <CategoriesView />}
          {tab === 'series' && <SeriesView />}
        </main>

        {tab === 'inbox' && selected && (
          <DetailPanel story={selected} onClose={() => setSelected(null)} onUpdate={() => {}} />
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════
// INBOX VIEW
// ══════════════════════════════════════════
function InboxView({ stories, onSelect, selectedId }: {
  stories: Story[]; onSelect: (s: Story) => void; selectedId?: string | null
}) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'new' | 'old'>('new')

  const kw = q.trim().toLowerCase()
  const list = stories
    .filter(s => !kw || s.title.toLowerCase().includes(kw) || (s.author || '').toLowerCase().includes(kw))
    .slice()
    .sort((a, b) => {
      const d = new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      return sort === 'new' ? d : -d
    })

  return (
    <>
      <div className="ed-toolbar">
        <input className="ed-search" value={q} onChange={e => setQ(e.target.value)}
          placeholder="Tìm theo tiêu đề hoặc tên người kể…" aria-label="Tìm câu chuyện" />
        <button className="ed-sort" onClick={() => setSort(v => v === 'new' ? 'old' : 'new')}
          title="Đổi thứ tự">{sort === 'new' ? '↓ Mới nhất' : '↑ Cũ nhất'}</button>
      </div>
      <div className="ed-count-row">
        {kw ? `${list.length} / ${stories.length} câu chuyện` : `${stories.length} câu chuyện`}
      </div>
      <div className="ed-list">
        {list.length === 0 && <div className="ed-empty">Không có câu chuyện nào khớp.</div>}
        {list.map(story => {
          const hasPhoto = !!(story.photos && story.photos.length > 0)
          const hasBio = !!story.author_bio
          return (
            <article key={story.id}
              className={`ed-card ${selectedId === story.id ? 'ed-card-on' : ''}`}
              onClick={() => onSelect(story)}>
              <div className="ed-card-body">
                <h2 className="ed-card-title">{story.title}</h2>
                <div className="ed-card-meta">
                  <span className="ed-card-author">{story.author}</span>
                  <span className="ed-card-sep">·</span>
                  <span className="ed-card-date">{fmtDate(story.submittedAt)}</span>
                </div>
                <div className="ed-card-tags">
                  <StatusBadge status={story.status} />
                  {hasPhoto && <span className="ed-tag" title="Đã có ảnh">🖼 ảnh</span>}
                  {hasBio && (
                    <span className={`ed-tag ${story.consent_bio_publish ? 'ed-tag-on' : 'ed-tag-warn'}`}
                      title={story.consent_bio_publish ? 'Đôi nét về người kể đang hiện' : 'Có đôi nét nhưng chưa bật hiển thị'}>
                      🙂 đôi nét{story.consent_bio_publish ? '' : ' (ẩn)'}
                    </span>
                  )}
                </div>
              </div>
              <div className="ed-card-arrow">→</div>
            </article>
          )
        })}
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
function DetailPanel({ story, onClose, onUpdate }: { story: Story; onClose: () => void; onUpdate?: () => void }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(story.title)
  const [editContent, setEditContent] = useState(story.content)
  const [saving, setSaving] = useState(false)
  const handleSaveEdit = async () => {
    setSaving(true)
    try {
      const { data, error } = await supabase.functions.invoke('story-ai', {
        body: { admin_key: 'st-1001-adm-7x9k2', action: 'admin_update_story', story_id: story.id, title: editTitle, content: editContent },
      })
      console.log('Save result:', { data, error, storyId: story.id })
      if (!error && data?.ok) {
        story.title = editTitle
        story.content = editContent
        setIsEditing(false)
        if (onUpdate) onUpdate()
      } else {
        setStatusMsg('Lỗi: ' + (data.error || 'Không thể lưu'))
      }
    } catch (e: any) {
      setStatusMsg('Lỗi: ' + e.message)
    }
    setSaving(false)
  }

  const hasConversation = story.conversation && story.conversation.length > 0
  const hasContent = story.content && story.content.trim().length > 0
  const [showPublish, setShowPublish] = useState(false)
  const [fluxPrompt, setFluxPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [useStudentPhoto, setUseStudentPhoto] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [published, setPublished] = useState(false)

  // ── Đôi nét về người kể — Ban biên tập bổ sung/sửa (kể cả bài đã xuất bản) ──
  const st = story as any
  const [bioOpen, setBioOpen] = useState(false)
  const [bioName, setBioName] = useState('')
  const [bioAge, setBioAge] = useState('')
  const [bioHometown, setBioHometown] = useState('')
  const [bioLivingIn, setBioLivingIn] = useState('')
  const [bioJob, setBioJob] = useState('')
  const [bioText, setBioText] = useState('')
  const [bioPortrait, setBioPortrait] = useState('')
  const [bioShow, setBioShow] = useState(false)
  const [bioSaving, setBioSaving] = useState(false)
  useEffect(() => {
    setBioName(st.author_full_name ?? '')
    setBioAge(st.author_age != null ? String(st.author_age) : '')
    setBioHometown(st.author_hometown ?? '')
    setBioLivingIn(st.author_living_in ?? '')
    setBioJob(st.author_job ?? '')
    setBioText(st.author_bio ?? '')
    setBioPortrait(st.author_portrait_url ?? '')
    setBioShow(!!st.consent_bio_publish)
  }, [story.id])   // eslint-disable-line react-hooks/exhaustive-deps

  const saveBio = async () => {
    setBioSaving(true); setStatusMsg('')
    try {
      const { data, error } = await supabase.functions.invoke('story-ai', {
        body: {
          admin_key: 'st-1001-adm-7x9k2', action: 'admin_update_story', story_id: story.id,
          author_full_name: bioName.trim() || null,
          author_age: bioAge.trim() || null,
          author_hometown: bioHometown.trim() || null,
          author_living_in: bioLivingIn.trim() || null,
          author_job: bioJob.trim() || null,
          author_bio: bioText.trim() || null,
          author_portrait_url: bioPortrait.trim() || null,
          consent_bio_publish: bioShow,
        },
      })
      if (!error && data?.ok) {
        setStatusMsg('Đã lưu phần Đôi nét về người kể.')
        if (onUpdate) onUpdate()
      } else setStatusMsg('Lỗi: ' + (data?.error || 'Không lưu được'))
    } catch (e: any) { setStatusMsg('Lỗi: ' + e.message) }
    setBioSaving(false)
  }

  // ── Chủ đề (categories) — bắt buộc chọn ít nhất 1 khi xuất bản ──
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    supabase.from('categories').select('*').order('name')
      .then(({ data }) => { if (data) setAllCategories(data as Category[]) })
      .then(undefined, () => {})
  }, [])
  // Nạp sẵn chủ đề ĐANG gắn của bài — nếu không, bấm Lưu sẽ xoá sạch chủ đề cũ
  useEffect(() => {
    let alive = true
    supabase.from('story_categories').select('category_id').eq('story_id', story.id)
      .then(({ data }) => {
        if (!alive || !data) return
        setSelectedCategoryIds(new Set(data.map((r: { category_id: string }) => r.category_id)))
      }, () => {})
    return () => { alive = false }
  }, [story.id])

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // Check if story has existing photos from student
  const studentPhotos = (story as any).photos as { url: string; caption?: string }[] | null | undefined
  const hasStudentPhoto = studentPhotos && studentPhotos.length > 0

  const handleGenerate = async () => {
    if (!fluxPrompt.trim()) return
    setGenerating(true)
    setStatusMsg('Đang tạo ảnh FLUX...')
    try {
      const res = await fetch('https://wojmdilyflffvdtpovmq.supabase.co/functions/v1/publish-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_image', prompt: fluxPrompt }),
      })
      const data = await res.json()
      if (data.ok && data.url) {
        setPreviewUrl(data.url)
        setStatusMsg('Ảnh đã tạo xong! Nhấn Xuất bản để lưu.')
      } else {
        setStatusMsg('Lỗi: ' + (data.error || 'Không thể tạo ảnh'))
      }
    } catch (e: any) {
      setStatusMsg('Lỗi: ' + e.message)
    }
    setGenerating(false)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadedFile(file)
    setUseStudentPhoto(false)
    // Preview local file
    const reader = new FileReader()
    reader.onload = (ev) => setPreviewUrl(ev.target?.result as string)
    reader.readAsDataURL(file)
    setStatusMsg('Ảnh đã chọn. Nhấn Xuất bản để lưu.')
  }

  const handlePublish = async () => {
    setPublishing(true)
    setStatusMsg('Đang xuất bản...')
    try {
      const payload: any = { action: 'publish', story_id: story.id, category_ids: [...selectedCategoryIds] }

      if (useStudentPhoto && hasStudentPhoto) {
        payload.use_existing_photo = true
      } else if (uploadedFile) {
        const b64 = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve((reader.result as string).split(',')[1])
          reader.readAsDataURL(uploadedFile)
        })
        payload.image_base64 = b64
      } else if (previewUrl && !previewUrl.startsWith('data:')) {
        // Replicate URL - need to re-download in edge function via prompt
        payload.prompt = fluxPrompt || 'Warm editorial photo of a person with acoustic guitar, natural lighting, photorealistic'
      }

      const res = await fetch('https://wojmdilyflffvdtpovmq.supabase.co/functions/v1/publish-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.ok) {
        setStatusMsg(`Đã xuất bản! Số thứ tự: #${data.story_number}`)
        setPublished(true)
      } else {
        setStatusMsg('Lỗi: ' + (data.error || 'Không thể xuất bản'))
      }
    } catch (e: any) {
      setStatusMsg('Lỗi: ' + e.message)
    }
    setPublishing(false)
  }

  return (
    <aside className="ed-detail">
      <div className="ed-detail-header">
        <button className="ed-detail-close" onClick={onClose}>✕</button>
      </div>
      <div className="ed-detail-body">
        <StatusBadge status={story.status} />
        <div className="ed-detail-title-row">
          {isEditing ? (
            <input className="ed-edit-input ed-edit-title" value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Tiêu đề" />
          ) : (
            <h2 className="ed-detail-title">{story.title}</h2>
          )}
          <button className="ed-edit-btn" onClick={() => { if (isEditing) handleSaveEdit(); else { setEditTitle(story.title); setEditContent(story.content); setIsEditing(true); setStatusMsg('') } }} disabled={saving}>
            {isEditing ? (saving ? 'Đang lưu…' : '✓ Lưu') : '✏️ Sửa'}
          </button>
          {statusMsg && <span className="ed-status-msg" style={statusMsg.includes('Lỗi') ? {color:'#C53030'} : {color:'#3C7A42'}}>{statusMsg}</span>}
          {isEditing && (
            <button className="ed-edit-btn ed-edit-cancel" onClick={() => setIsEditing(false)}>Hủy</button>
          )}
        </div>
        <div className="ed-detail-meta">
          <span>{story.author}</span>
          <span className="ed-card-sep">·</span>
          <span>{fmtDate(story.submittedAt)}</span>
        </div>

        {/* Bản gốc — conversation */}
        {hasConversation && (
          <div className="ed-section">
            <h3 className="ed-section-title">📝 Bản gốc (lời kể)</h3>
            <div className="ed-convo-list">
              {story.conversation!.filter(m => m.role === 'user' && m.text !== '[STUCK_BUTTON]').map((m, i) => (
                <div key={i} className="ed-convo-msg">
                  <p>{m.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bản đã biên tập — content */}
        {hasContent && (
          <div className="ed-section">
            <h3 className="ed-section-title">📄 Bản đã biên tập</h3>
            {isEditing ? (
              <textarea className="ed-edit-textarea" value={editContent} onChange={e => setEditContent(e.target.value)} rows={12} />
            ) : (
              <div className="ed-detail-content">
                {story.content.split('\n').map((p, i) => (
                  p.trim() ? <p key={i}>{p}</p> : <br key={i} />
                ))}
              </div>
            )}
          </div>
        )}

        {!hasConversation && !hasContent && (
          <p className="ed-empty">Chưa có nội dung</p>
        )}

        {/* ── Trạng thái ── */}
        {(story.status as string) === 'published' || published ? (
          <div className="ed-section ed-pub-done-wrap">
            <div className="ed-pub-done">✅ Đã xuất bản trên Tạp chí</div>
            <span className="ed-pub-hint">Sau khi Lưu, refresh Tạp chí để thấy nội dung mới.</span>
          </div>
        ) : null}

        {/* ── Sửa bài ĐÃ XUẤT BẢN: gắn lại chủ đề + Đôi nét về người kể ── */}
        {((story.status as string) === 'published' || published) && (
          <>
            {allCategories.length > 0 && (
              <div className="ed-section">
                <h3 className="ed-section-title">📚 Gắn lại chủ đề</h3>
                <p style={{fontSize:13,color:'#8C8C8C',margin:'0 0 12px'}}>Chọn chủ đề rồi bấm Lưu — áp dụng ngay cho bài đã xuất bản.</p>
                <div className="ed-cat-grid">
                  {allCategories.map(c => (
                    <button key={c.id} type="button"
                      className={`ed-cat-chip ${selectedCategoryIds.has(c.id) ? 'ed-cat-on' : ''}`}
                      onClick={() => toggleCategory(c.id)}>
                      {selectedCategoryIds.has(c.id) ? '✓ ' : ''}{c.name}
                    </button>
                  ))}
                </div>
                <button className="ed-edit-btn" style={{marginTop:12}} disabled={bioSaving} onClick={async () => {
                  setBioSaving(true); setStatusMsg('')
                  try {
                    const { data, error } = await supabase.functions.invoke('story-ai', {
                      body: { admin_key: 'st-1001-adm-7x9k2', action: 'admin_update_story',
                              story_id: story.id, category_ids: [...selectedCategoryIds] },
                    })
                    if (!error && data?.ok) { setStatusMsg('Đã cập nhật chủ đề.'); if (onUpdate) onUpdate() }
                    else setStatusMsg('Lỗi: ' + (data?.error || 'Không lưu được'))
                  } catch (e: any) { setStatusMsg('Lỗi: ' + e.message) }
                  setBioSaving(false)
                }}>💾 Lưu chủ đề</button>
              </div>
            )}

            <div className="ed-section">
              <h3 className="ed-section-title">
                🙂 Đôi nét về người kể
                <button className="ed-edit-btn" style={{marginLeft:10,fontSize:12}}
                  onClick={() => setBioOpen(o => !o)}>{bioOpen ? 'Thu gọn' : 'Mở ra sửa'}</button>
              </h3>
              {!bioOpen ? (
                <p style={{fontSize:13,color:'#8C8C8C',margin:0}}>
                  {st.author_bio ? (st.consent_bio_publish ? '✅ Đang hiện ở cuối bài' : '⚠️ Đã có nội dung nhưng CHƯA bật hiển thị') : 'Chưa có — bấm "Mở ra sửa" để bổ sung.'}
                </p>
              ) : (
                <>
                  <p style={{fontSize:13,color:'#8C8C8C',margin:'0 0 12px'}}>
                    Bổ sung giúp người kể (khi đã được họ đồng ý). Ban biên tập được sửa câu chữ, không đổi nội dung họ chia sẻ.
                  </p>
                  <div className="ed-bio-grid">
                    <input className="ed-bio-input" placeholder="Họ và tên" value={bioName} onChange={e => setBioName(e.target.value)} />
                    <input className="ed-bio-input" placeholder="Tuổi" value={bioAge} inputMode="numeric" onChange={e => setBioAge(e.target.value.replace(/\D/g, ''))} />
                    <input className="ed-bio-input" placeholder="Quê quán" value={bioHometown} onChange={e => setBioHometown(e.target.value)} />
                    <input className="ed-bio-input" placeholder="Nơi đang sinh sống" value={bioLivingIn} onChange={e => setBioLivingIn(e.target.value)} />
                    <input className="ed-bio-input" placeholder="Nghề nghiệp" value={bioJob} onChange={e => setBioJob(e.target.value)} />
                    <input className="ed-bio-input" placeholder="Link ảnh chân dung (nếu có)" value={bioPortrait} onChange={e => setBioPortrait(e.target.value)} />
                  </div>
                  <textarea className="ed-edit-textarea" style={{marginTop:10}} rows={4} value={bioText}
                    onChange={e => setBioText(e.target.value)} placeholder="Đoạn giới thiệu về người kể…" />
                  <label className="ed-bio-check">
                    <input type="checkbox" checked={bioShow} onChange={e => setBioShow(e.target.checked)} />
                    <span>Hiện khối này ở cuối bài viết — <b>chỉ bật khi người kể đã đồng ý công khai</b></span>
                  </label>
                  <button className="ed-edit-btn" disabled={bioSaving} onClick={saveBio}>
                    {bioSaving ? 'Đang lưu…' : '💾 Lưu Đôi nét về người kể'}
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {/* ── Chọn chủ đề (bắt buộc khi xuất bản) ── */}
        {(story.status as string) !== 'published' && !published && allCategories.length > 0 && (
          <div className="ed-section">
            <h3 className="ed-section-title">📚 Chọn chủ đề <span style={{color:'#C53030',fontWeight:400}}>*</span></h3>
            <p style={{fontSize:13,color:'#8C8C8C',margin:'0 0 12px'}}>Chọn ít nhất một chủ đề cho câu chuyện trước khi xuất bản.</p>
            <div className="ed-cat-grid">
              {allCategories.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className={`ed-cat-chip ${selectedCategoryIds.has(c.id) ? 'ed-cat-on' : ''}`}
                  onClick={() => toggleCategory(c.id)}
                >
                  {selectedCategoryIds.has(c.id) ? '✓ ' : ''}{c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Xuất bản nhanh ── */}
        {(story.status as string) !== 'published' && !published && (
          <div className="ed-section ed-quick-pub">
            <button className="ed-pub-quick-btn" disabled={publishing || selectedCategoryIds.size === 0} onClick={async () => {
              if (selectedCategoryIds.size === 0) { setStatusMsg('Vui lòng chọn ít nhất một chủ đề.'); return }
              setPublishing(true)
              setStatusMsg('Đang xuất bản...')
              try {
                const { data, error } = await supabase.functions.invoke('story-ai', {
                  body: { admin_key: 'st-1001-adm-7x9k2', action: 'admin_publish', story_id: story.id, category_ids: [...selectedCategoryIds] },
                })
                if (!error && data?.ok) {
                  setStatusMsg(`Đã xuất bản! Số #${data.story_number} — hiện trên Tạp chí ngay.`)
                  setPublished(true)
                  story.status = 'published'
                } else {
                  setStatusMsg('Lỗi: ' + (data.error || 'Không thể xuất bản'))
                }
              } catch (e) { setStatusMsg('Lỗi: ' + (e as Error).message) }
              setPublishing(false)
            }}>
              {publishing ? 'Đang xuất bản...' : '🚀 Xuất bản ngay'}
            </button>
            <span className="ed-pub-hint">Câu chuyện sẽ hiện trên Tạp chí ngay lập tức.</span>
          </div>
        )}

        {/* ── Xuất bản (có ảnh) ── */}
        {(story.status as string) !== 'published' && !published && (
          <div className="ed-section">
            <h3 className="ed-section-title">🚀 Xuất bản</h3>

            {!showPublish ? (
              <button className="ed-pub-btn" onClick={() => setShowPublish(true)}>
                Mở công cụ xuất bản
              </button>
            ) : (
              <>
                {/* Ảnh của học sinh */}
                {hasStudentPhoto && (
                  <div className="ed-pub-block">
                    <label className="ed-pub-label">
                      <input type="checkbox" checked={useStudentPhoto} onChange={e => { setUseStudentPhoto(e.target.checked); if (e.target.checked) { setUploadedFile(null); setPreviewUrl(null) } }} />
                      {' '}Dùng ảnh của học sinh
                    </label>
                    {useStudentPhoto && (
                      <img src={studentPhotos![0].url} alt="" className="ed-pub-preview" />
                    )}
                  </div>
                )}

                {/* Upload ảnh */}
                {!useStudentPhoto && (
                  <div className="ed-pub-block">
                    <label className="ed-pub-label">📤 Tải ảnh lên</label>
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="ed-pub-file" />
                    {uploadedFile && <span className="ed-pub-filename">{uploadedFile.name}</span>}
                  </div>
                )}

                {/* FLUX generate */}
                {!useStudentPhoto && !uploadedFile && (
                  <div className="ed-pub-block">
                    <label className="ed-pub-label">🤖 AI tạo ảnh FLUX</label>
                    <textarea
                      className="ed-pub-textarea"
                      rows={3}
                      placeholder="Mô tả ảnh minh họa...&#10;VD: Một người đàn ông trung niên ngồi chơi guitar bên cửa sổ, ánh chiều ấm áp..."
                      value={fluxPrompt}
                      onChange={e => setFluxPrompt(e.target.value)}
                    />
                    <button className="ed-pub-btn-sm" onClick={handleGenerate} disabled={generating || !fluxPrompt.trim()}>
                      {generating ? '⏳ Đang tạo...' : '🤖 Tạo ảnh'}
                    </button>
                  </div>
                )}

                {/* Preview */}
                {previewUrl && (
                  <div className="ed-pub-block">
                    <label className="ed-pub-label">🖼️ Xem trước</label>
                    <img src={previewUrl} alt="Preview" className="ed-pub-preview" />
                  </div>
                )}

                {/* Status */}
                {statusMsg && <p className="ed-pub-status">{statusMsg}</p>}

                {/* Publish button */}
                <button
                  className="ed-pub-btn ed-pub-btn-primary"
                  onClick={handlePublish}
                  disabled={publishing || selectedCategoryIds.size === 0}
                >
                  {publishing ? '⏳ Đang xuất bản...' : (selectedCategoryIds.size === 0 ? '⚠️ Cần chọn chủ đề' : '✅ Xuất bản')}
                </button>
              </>
            )}
          </div>
        )}

        {published && (
          <div className="ed-section">
            <p className="ed-pub-status" style={{color:'#3C7A42'}}>{statusMsg}</p>
          </div>
        )}
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

.ed-body { max-width:1560px; margin:0 auto; display:flex; min-height:calc(100dvh - 100px); }
/* Trang biên tập là công cụ đọc–sửa: chữ luôn căn trái, không kế thừa
   text-align:center của trang cha (làm cả nội dung bài bị căn giữa). */
.ed-root, .ed-root * { text-align:left; }
.ed-root .ed-toolbar, .ed-root .ed-count-row { text-align:left; }
/* Danh sách co được để bảng chi tiết không tràn khỏi màn hình hẹp */
.ed-main { flex:1; min-width:0; }

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
.ed-card { display:flex; align-items:center; background:#FFFFFF; border:1px solid #EBE5DB; border-radius:8px; padding:14px 16px; cursor:pointer; transition:box-shadow .15s,border-color .15s; }
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
.ed-detail { width:min(560px, 42vw); min-width:380px; flex-shrink:0; border-left:1px solid #E5E0D8; background:#FFFFFF; overflow-y:auto; max-height:calc(100dvh - 100px); position:sticky; top:0; }
.ed-detail-header { display:flex; justify-content:flex-end; padding:12px 16px; border-bottom:1px solid #F0EDE6; }
.ed-detail-close { background:none; border:none; font-size:18px; color:#8C8C8C; cursor:pointer; padding:4px 8px; border-radius:4px; transition:background .12s,color .12s; }
.ed-detail-close:hover { background:#F5F2ED; color:#1A1A1A; }
.ed-detail-body { padding:20px 24px 40px; }
.ed-detail-title { font-size:22px; font-weight:700; color:#1A1A1A; margin:12px 0 8px; line-height:1.3; letter-spacing:-0.2px; }
.ed-detail-title-row { display:flex; align-items:flex-start; gap:8px; margin:12px 0 8px; }
.ed-detail-title-row .ed-detail-title { flex:1; margin:0; }
.ed-edit-input { font-family:inherit; font-size:15px; padding:6px 10px; border:1px solid #D4C9B8; border-radius:6px; outline:none; width:100%; }
.ed-edit-input:focus { border-color:#8B7355; }
.ed-edit-title { font-size:22px; font-weight:700; }
.ed-edit-textarea { width:100%; font-family:inherit; font-size:15px; line-height:1.7; padding:12px; border:1px solid #D4C9B8; border-radius:8px; outline:none; resize:vertical; min-height:200px; }
.ed-edit-textarea:focus { border-color:#8B7355; }
.ed-edit-btn { padding:6px 14px; border:1px solid #D4C9B8; border-radius:6px; background:#fff; font-family:inherit; font-size:13px; cursor:pointer; white-space:nowrap; transition:background .12s; }
.ed-edit-btn:hover { background:#F5F2ED; }
.ed-edit-btn:disabled { opacity:0.5; cursor:default; }
.ed-edit-cancel { color:#8C8C8C; }
.ed-status-msg { display:block; font-size:13px; margin-top:6px; }
.ed-detail-meta { font-size:13px; color:#8C8C8C; display:flex; align-items:center; gap:6px; margin-bottom:20px; }
.ed-detail-content { font-size:15px; line-height:1.8; color:#3A3A3A; }
.ed-detail-content p { margin:0 0 1.2em; }
.ed-detail-content p:last-child { margin-bottom:0; }
.ed-section { margin-top:24px; padding-top:20px; border-top:1px solid #F0EDE6; }
.ed-section:first-of-type { margin-top:0; padding-top:0; border-top:none; }
.ed-section-title { font-size:14px; font-weight:600; color:#8C8C8C; margin:0 0 14px; text-transform:uppercase; letter-spacing:0.3px; }
.ed-convo-list { display:flex; flex-direction:column; gap:12px; }
.ed-convo-msg { padding:14px 16px; background:#F9F8F6; border-radius:10px; border:1px solid #F0EDE6; }
.ed-convo-msg p { font-size:15px; line-height:1.6; color:#3A3A3A; margin:0; }
.ed-empty { color:#8C8C8C; font-style:italic; }

/* Publish tools */
.ed-pub-quick-btn { width:100%; padding:14px; background:#8B7355; color:#fff; border:none; border-radius:8px; font-family:inherit; font-size:16px; font-weight:600; cursor:pointer; transition:opacity .15s; }
.ed-pub-quick-btn:hover { opacity:0.9; }
.ed-pub-quick-btn:disabled { opacity:0.5; cursor:default; }
/* Thanh công cụ danh sách */
.ed-toolbar { display:flex; gap:8px; align-items:center; margin-bottom:10px; }
.ed-search { flex:1; min-width:0; padding:10px 14px; border:1px solid #E0D9CE; border-radius:9px; font-size:14px; font-family:inherit; outline:none; background:#fff; }
.ed-search:focus { border-color:#8B7355; }
.ed-sort { background:#fff; border:1px solid #E0D9CE; border-radius:9px; padding:10px 13px; font-size:13.5px; font-family:inherit; color:#5C5C5C; cursor:pointer; white-space:nowrap; }
.ed-sort:hover { border-color:#D4C9B8; }
.ed-count-row { font-size:12.5px; color:#9C9384; margin-bottom:10px; }
.ed-card-on { border-color:#8B7355 !important; box-shadow:0 2px 14px rgba(139,115,85,.14); }
.ed-card-tags { display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-top:8px; }
.ed-tag { font-size:11.5px; padding:3px 8px; border-radius:999px; background:#F3F0EA; color:#6E6455; white-space:nowrap; }
.ed-tag-on { background:#EDF7EE; color:#3C7A42; }
.ed-tag-warn { background:#FFF4E5; color:#B4690E; }
/* Đếm bài ở thanh bên */
.ed-nav-item { display:flex !important; align-items:center; justify-content:space-between; gap:8px; }
.ed-nav-count { font-size:11.5px; font-weight:600; color:#8C8477; background:#F0ECE4; border-radius:999px; padding:1px 8px; }
.ed-nav-count-hot { background:#4F46E5; color:#fff; }
/* Ô nhập trong bảng chi tiết: chặn tràn khỏi lưới */
.ed-bio-input, .ed-edit-textarea, .ed-edit-input { box-sizing:border-box; min-width:0; max-width:100%; }
.ed-head-actions { display:flex; align-items:center; gap:12px; }
.ed-new-btn { background:#4F46E5; color:#fff; border:none; border-radius:8px; padding:9px 16px; font-size:14px; font-weight:600; font-family:inherit; cursor:pointer; white-space:nowrap; }
.ed-new-overlay { position:fixed; inset:0; background:rgba(24,24,27,.55); z-index:2500; display:flex; align-items:flex-start; justify-content:center; padding:32px 16px; overflow-y:auto; }
.ed-new-card { background:#fff; border-radius:14px; padding:24px; width:100%; max-width:680px; }
.ed-new-title { font-size:20px; font-weight:700; margin:0 0 6px; }
.ed-new-sub { font-size:13.5px; color:#8C8C8C; margin:0 0 16px; line-height:1.5; }
.ed-new-full { width:100%; box-sizing:border-box; }
.ed-new-msg { background:#FEECEC; color:#C53030; border-radius:8px; padding:9px 12px; font-size:13.5px; margin-top:10px; }
.ed-new-actions { display:flex; gap:10px; align-items:center; margin-top:14px; }
.ed-bio-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.ed-bio-input { padding:9px 11px; border:1px solid #E0E0E0; border-radius:8px; font-size:14px; font-family:inherit; outline:none; }
.ed-bio-input:focus { border-color:#4F46E5; }
.ed-bio-check { display:flex; gap:9px; align-items:flex-start; margin:12px 0; font-size:13.5px; color:#3F3F46; line-height:1.45; cursor:pointer; }
@media (max-width:560px){ .ed-bio-grid { grid-template-columns:1fr; } }
.ed-pub-done { font-size:15px; color:#3C7A42; font-weight:600; text-align:center; padding:12px; background:#EDF7EE; border-radius:8px; margin-bottom:8px; }
.ed-pub-hint { display:block; text-align:center; font-size:12px; color:#8C8C8C; margin-top:8px; }
.ed-quick-pub { padding:16px 0; border-bottom:1px solid #EBE5DB; margin-bottom:8px; }
.ed-pub-btn { display:inline-flex; align-items:center; gap:6px; padding:10px 20px; border:1px solid #E5E0D8; border-radius:8px; background:#FFF; color:#5C5C5C; font-size:14px; font-weight:500; cursor:pointer; font-family:inherit; transition:background .12s,border-color .12s; }
.ed-pub-btn:hover { background:#F5F2ED; border-color:#D4C9B8; }
.ed-pub-btn-primary { background:#4338CA; color:#FFF; border-color:#4338CA; font-weight:600; width:100%; justify-content:center; margin-top:12px; }
.ed-pub-btn-primary:hover { background:#352BA3; border-color:#352BA3; }
.ed-pub-btn-primary:disabled { opacity:.5; cursor:not-allowed; }
.ed-pub-btn-sm { padding:8px 14px; border:1px solid #E5E0D8; border-radius:6px; background:#FFF; color:#5C5C5C; font-size:13px; cursor:pointer; font-family:inherit; margin-top:8px; }
.ed-pub-btn-sm:hover { background:#F5F2ED; }
.ed-pub-btn-sm:disabled { opacity:.5; cursor:not-allowed; }
.ed-pub-block { margin-bottom:16px; }
.ed-pub-label { display:flex; align-items:center; gap:6px; font-size:13px; font-weight:600; color:#5C5C5C; margin-bottom:8px; }
.ed-pub-textarea { width:100%; padding:10px; border:1px solid #E5E0D8; border-radius:8px; font-size:13px; font-family:inherit; resize:vertical; background:#FAF9F7; box-sizing:border-box; }
.ed-pub-textarea:focus { outline:none; border-color:#4338CA; }
.ed-pub-file { font-size:13px; margin-top:4px; }
.ed-pub-filename { display:block; font-size:12px; color:#8C8C8C; margin-top:4px; }
.ed-pub-preview { width:100%; border-radius:10px; margin-top:8px; border:1px solid #E5E0D8; }
.ed-pub-status { font-size:13px; color:#5C5C5C; margin:8px 0; padding:8px 12px; background:#F5F2ED; border-radius:6px; }

/* Category chips */
.ed-cat-grid { display:flex; flex-wrap:wrap; gap:8px; }
.ed-cat-chip { padding:8px 14px; border:1.5px solid #E5E0D8; border-radius:10px; background:#FFF; color:#5C5C5C; font-size:13px; font-weight:500; cursor:pointer; font-family:inherit; transition:all .12s; }
.ed-cat-chip:hover { border-color:#8B7355; color:#1A1A1A; background:#F9F8F6; }
.ed-cat-on { border-color:#4338CA; background:#EEF2FF; color:#4338CA; font-weight:600; }
.ed-cat-on:hover { border-color:#352BA3; background:#E0E7FF; }

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
