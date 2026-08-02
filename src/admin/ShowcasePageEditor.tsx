// ── Admin / Showcase Page Editor — Block-based page builder ──
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import type { ShowcaseCategory, ShowcasePage, ShowcasePageBlock } from '../showcase/types'
import {
  BLOCK_TYPES,
  BLOCK_TYPE_LABELS,
  BLOCK_TYPE_ICONS,
  defaultBlockData,
  type BlockType,
  type BlockData,
} from '../showcase/types'

interface Props {
  pageId?: string // undefined = new page
  onBack: () => void
}

export default function ShowcasePageEditor({ pageId, onBack }: Props) {
  const isNew = !pageId

  // Page fields
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [summary, setSummary] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [published, setPublished] = useState(false)
  const [featured, setFeatured] = useState(false)
  const [sortOrder, setSortOrder] = useState(0)
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDescription, setSeoDescription] = useState('')

  // Blocks
  const [blocks, setBlocks] = useState<ShowcasePageBlock[]>([])
  const [categories, setCategories] = useState<ShowcaseCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeBlockIndex, setActiveBlockIndex] = useState<number | null>(null)

  useEffect(() => {
    supabase.from('showcase_categories').select('*').eq('is_active', true).order('sort_order')
      .then(({ data }) => setCategories((data as ShowcaseCategory[]) || []))

    if (!isNew) {
      loadPage()
    } else {
      setBlocks([makeBlock('paragraph', 0)])
      setLoading(false)
    }
  }, [pageId])

  async function loadPage() {
    const { data: page } = await supabase.from('showcase_pages').select('*').eq('id', pageId).single()
    if (!page) { setError('Không tìm thấy trang'); setLoading(false); return }

    const p = page as ShowcasePage
    setTitle(p.title)
    setSlug(p.slug)
    setCategoryId(p.category_id)
    setSummary(p.summary || '')
    setCoverImage(p.cover_image || '')
    setPublished(p.published)
    setFeatured(p.featured)
    setSortOrder(p.sort_order)
    setSeoTitle(p.seo_title || '')
    setSeoDescription(p.seo_description || '')

    const { data: blk } = await supabase.from('showcase_page_blocks')
      .select('*').eq('page_id', pageId).order('sort_order')
    if (blk && blk.length > 0) {
      setBlocks(blk as ShowcasePageBlock[])
    } else {
      setBlocks([makeBlock('paragraph', 0)])
    }
    setLoading(false)
  }

  function makeBlock(type: BlockType, order: number): ShowcasePageBlock {
    return {
      id: crypto.randomUUID(),
      page_id: pageId || '',
      type,
      sort_order: order,
      data: defaultBlockData(type),
    }
  }

  function slugify(text: string) {
    return text.toLowerCase()
      .replace(/[đĐ]/g, 'd')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  function handleTitleChange(val: string) {
    setTitle(val)
    if (isNew) setSlug(slugify(val))
  }

  function reorderBlocks() {
    setBlocks(prev => prev.map((b, i) => ({ ...b, sort_order: i })))
  }

  function addBlock(type: BlockType, afterIndex: number) {
    const newBlock = makeBlock(type, afterIndex + 1)
    const updated = [...blocks]
    updated.splice(afterIndex + 1, 0, newBlock)
    setBlocks(updated)
    reorderBlocks()
    setActiveBlockIndex(afterIndex + 1)
  }

  function removeBlock(index: number) {
    if (blocks.length <= 1) return
    const updated = blocks.filter((_, i) => i !== index)
    setBlocks(updated)
    reorderBlocks()
  }

  function moveBlock(index: number, direction: 'up' | 'down') {
    const newIdx = direction === 'up' ? index - 1 : index + 1
    if (newIdx < 0 || newIdx >= blocks.length) return
    const updated = [...blocks]
    ;[updated[index], updated[newIdx]] = [updated[newIdx], updated[index]]
    setBlocks(updated)
    reorderBlocks()
  }

  function updateBlockData(index: number, data: BlockData) {
    const updated = [...blocks]
    updated[index] = { ...updated[index], data }
    setBlocks(updated)
  }

  function updateBlockType(index: number, type: BlockType) {
    const updated = [...blocks]
    updated[index] = { ...updated[index], type, data: defaultBlockData(type) }
    setBlocks(updated)
  }

  async function save() {
    if (!title.trim()) { setError('Vui lòng nhập tiêu đề'); return }
    setSaving(true)
    setError('')

    const pagePayload = {
      title,
      slug: slug || slugify(title),
      category_id: categoryId,
      summary: summary || null,
      cover_image: coverImage || null,
      published,
      featured,
      sort_order: sortOrder,
      seo_title: seoTitle || null,
      seo_description: seoDescription || null,
      updated_at: new Date().toISOString(),
    }

    let savedPageId = pageId

    if (isNew) {
      const { data, error: insertErr } = await supabase
        .from('showcase_pages')
        .insert(pagePayload)
        .select('id')
        .single()
      if (insertErr) { setError(insertErr.message); setSaving(false); return }
      savedPageId = data.id
    } else {
      const { error: updateErr } = await supabase
        .from('showcase_pages')
        .update(pagePayload)
        .eq('id', pageId)
      if (updateErr) { setError(updateErr.message); setSaving(false); return }
    }

    // Save blocks
    const finalPageId = savedPageId!
    // Delete existing blocks
    await supabase.from('showcase_page_blocks').delete().eq('page_id', finalPageId)
    // Insert blocks
    const blockPayloads = blocks.map((b, i) => ({
      page_id: finalPageId,
      type: b.type,
      sort_order: i,
      data: b.data,
    }))
    const { error: blockErr } = await supabase.from('showcase_page_blocks').insert(blockPayloads)
    if (blockErr) { setError(blockErr.message); setSaving(false); return }

    setSaving(false)
    onBack()
  }

  if (loading) return <div className="spe-loading">Đang tải...</div>

  return (
    <div className="spe-root">
      <style>{CSS}</style>

      <div className="spe-header">
        <button className="spe-back" onClick={onBack}>← Trang</button>
        <h2 className="spe-title">{isNew ? 'Trang mới' : 'Sửa trang'}</h2>
        <button className="spe-save-btn" onClick={save} disabled={saving}>
          {saving ? 'Đang lưu...' : 'Lưu'}
        </button>
      </div>

      {error && <div className="spe-error">{error}</div>}

      <div className="spe-body">
        {/* ── Page Fields ── */}
        <section className="spe-section">
          <h3 className="spe-section-title">Thông tin trang</h3>

          <div className="spe-field-row">
            <label className="spe-field spe-field-grow">
              <span className="spe-label">Tiêu đề *</span>
              <input value={title} onChange={e => handleTitleChange(e.target.value)} placeholder="Tiêu đề trang" />
            </label>
            <label className="spe-field">
              <span className="spe-label">Slug</span>
              <input value={slug} onChange={e => setSlug(e.target.value)} placeholder="tieu-de-trang" />
            </label>
          </div>

          <div className="spe-field-row">
            <label className="spe-field">
              <span className="spe-label">Danh mục</span>
              <select value={categoryId || ''} onChange={e => setCategoryId(e.target.value || null)}>
                <option value="">(không có)</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="spe-field">
              <span className="spe-label">Thứ tự</span>
              <input type="number" value={sortOrder} onChange={e => setSortOrder(parseInt(e.target.value) || 0)} />
            </label>
          </div>

          <label className="spe-field">
            <span className="spe-label">Tóm tắt</span>
            <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={2} placeholder="Mô tả ngắn..." />
          </label>

          <label className="spe-field">
            <span className="spe-label">Ảnh bìa (URL)</span>
            <input value={coverImage} onChange={e => setCoverImage(e.target.value)} placeholder="https://..." />
          </label>

          <div className="spe-field-row spe-toggles">
            <label className="spe-check-label">
              <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} />
              Xuất bản
            </label>
            <label className="spe-check-label">
              <input type="checkbox" checked={featured} onChange={e => setFeatured(e.target.checked)} />
              ⭐ Nổi bật
            </label>
          </div>
        </section>

        {/* ── SEO ── */}
        <section className="spe-section">
          <h3 className="spe-section-title">SEO</h3>
          <div className="spe-field-row">
            <label className="spe-field spe-field-grow">
              <span className="spe-label">SEO Title</span>
              <input value={seoTitle} onChange={e => setSeoTitle(e.target.value)} placeholder="Tiêu đề SEO (để trống = dùng tiêu đề)" />
            </label>
          </div>
          <label className="spe-field">
            <span className="spe-label">SEO Description</span>
            <textarea value={seoDescription} onChange={e => setSeoDescription(e.target.value)} rows={2} placeholder="Mô tả SEO" />
          </label>
        </section>

        {/* ── Content Blocks ── */}
        <section className="spe-section">
          <h3 className="spe-section-title">Nội dung</h3>
          <p className="spe-hint">Thêm, sắp xếp và chỉnh sửa các khối nội dung. Nhấn vào khối để mở rộng.</p>

          <div className="spe-blocks">
            {blocks.map((block, idx) => (
              <div key={block.id} className={`spe-block ${activeBlockIndex === idx ? 'spe-block-active' : ''}`}>
                {/* Block toolbar */}
                <div className="spe-block-toolbar">
                  <div className="spe-block-left">
                    <span className="spe-block-icon">{BLOCK_TYPE_ICONS[block.type]}</span>
                    <select
                      className="spe-block-type-select"
                      value={block.type}
                      onChange={e => updateBlockType(idx, e.target.value as BlockType)}
                    >
                      {BLOCK_TYPES.map(t => (
                        <option key={t} value={t}>{BLOCK_TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="spe-block-right">
                    <button className="spe-block-move" onClick={() => moveBlock(idx, 'up')} disabled={idx === 0} title="Lên">▲</button>
                    <button className="spe-block-move" onClick={() => moveBlock(idx, 'down')} disabled={idx === blocks.length - 1} title="Xuống">▼</button>
                    <button className="spe-block-del" onClick={() => removeBlock(idx)} title="Xoá khối">×</button>
                  </div>
                </div>

                {/* Block content (expanded) */}
                <div className="spe-block-body">
                  <BlockFields
                    blockType={block.type}
                    data={block.data}
                    onChange={data => updateBlockData(idx, data)}
                  />
                </div>

                {/* Add block button */}
                <div className="spe-block-add-row">
                  <button className="spe-add-block-btn" onClick={() => addBlock('paragraph', idx)} title="Thêm khối mới">+</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Bottom save bar */}
      <div className="spe-bottom-bar">
        <button className="spe-cancel-btn" onClick={onBack}>Huỷ</button>
        <button className="spe-save-btn spe-save-btn-lg" onClick={save} disabled={saving}>
          {saving ? 'Đang lưu...' : isNew ? 'Tạo trang' : 'Lưu thay đổi'}
        </button>
      </div>
    </div>
  )
}

// ── Block type-specific field editor ──
function BlockFields({ blockType, data, onChange }: {
  blockType: BlockType
  data: BlockData
  onChange: (data: BlockData) => void
}) {
  switch (blockType) {
    case 'heading': return <HeadingFields data={data as any} onChange={onChange} />
    case 'paragraph': return <ParagraphFields data={data as any} onChange={onChange} />
    case 'image': return <ImageFields data={data as any} onChange={onChange} />
    case 'gallery': return <GalleryFields data={data as any} onChange={onChange} />
    case 'youtube': return <YouTubeFields data={data as any} onChange={onChange} />
    case 'video': return <VideoFields data={data as any} onChange={onChange} />
    case 'quote': return <QuoteFields data={data as any} onChange={onChange} />
    case 'divider': return <DividerFields />
    case 'pdf': return <PdfFields data={data as any} onChange={onChange} />
    case 'button': return <ButtonFields data={data as any} onChange={onChange} />
    case 'embed': return <EmbedFields data={data as any} onChange={onChange} />
    case 'callout': return <CalloutFields data={data as any} onChange={onChange} />
    default: return <div className="spe-block-unknown">Unknown block type</div>
  }
}

// ── Block field components ──

function HeadingFields({ data, onChange }: { data: { level?: number; text?: string }; onChange: (d: any) => void }) {
  return (
    <div className="spe-bf">
      <div className="spe-bf-row">
        <select value={data.level || 2} onChange={e => onChange({ ...data, level: parseInt(e.target.value) })} className="spe-bf-small">
          <option value={1}>H1</option>
          <option value={2}>H2</option>
          <option value={3}>H3</option>
          <option value={4}>H4</option>
        </select>
        <input className="spe-bf-input" value={data.text || ''} onChange={e => onChange({ ...data, text: e.target.value })} placeholder="Tiêu đề..." />
      </div>
    </div>
  )
}

function ParagraphFields({ data, onChange }: { data: { text?: string }; onChange: (d: any) => void }) {
  return (
    <div className="spe-bf">
      <textarea className="spe-bf-textarea" value={data.text || ''} onChange={e => onChange({ ...data, text: e.target.value })} placeholder="Nội dung đoạn văn..." rows={4} />
    </div>
  )
}

function ImageFields({ data, onChange }: { data: { url?: string; alt?: string; caption?: string; width?: string }; onChange: (d: any) => void }) {
  return (
    <div className="spe-bf">
      <input className="spe-bf-input" value={data.url || ''} onChange={e => onChange({ ...data, url: e.target.value })} placeholder="URL ảnh..." />
      <div className="spe-bf-row">
        <input className="spe-bf-input" value={data.alt || ''} onChange={e => onChange({ ...data, alt: e.target.value })} placeholder="Alt text..." />
        <input className="spe-bf-input" value={data.caption || ''} onChange={e => onChange({ ...data, caption: e.target.value })} placeholder="Chú thích..." />
      </div>
      <select value={data.width || 'full'} onChange={e => onChange({ ...data, width: e.target.value })} className="spe-bf-small">
        <option value="full">Toàn bề rộng</option>
        <option value="contained">Thu nhỏ</option>
      </select>
    </div>
  )
}

function GalleryFields({ data, onChange }: { data: { images?: { url: string; alt?: string; caption?: string }[]; layout?: string }; onChange: (d: any) => void }) {
  const images = data.images || []
  return (
    <div className="spe-bf">
      <select value={data.layout || 'grid'} onChange={e => onChange({ ...data, layout: e.target.value })} className="spe-bf-small">
        <option value="grid">Lưới</option>
        <option value="masonry">Masonry (2 cột)</option>
        <option value="carousel">Carousel (1 cột)</option>
      </select>
      {images.map((img, i) => (
        <div key={i} className="spe-bf-gallery-item">
          <input className="spe-bf-input" value={img.url} onChange={e => {
            const imgs = [...images]; imgs[i] = { ...imgs[i], url: e.target.value }
            onChange({ ...data, images: imgs })
          }} placeholder="URL ảnh..." />
          <button className="spe-bf-remove-sm" onClick={() => {
            const imgs = images.filter((_, j) => j !== i)
            onChange({ ...data, images: imgs })
          }}>×</button>
        </div>
      ))}
      <button className="spe-bf-add-btn" onClick={() => {
        onChange({ ...data, images: [...images, { url: '', alt: '', caption: '' }] })
      }}>+ Thêm ảnh</button>
    </div>
  )
}

function YouTubeFields({ data, onChange }: { data: { videoId?: string; caption?: string }; onChange: (d: any) => void }) {
  return (
    <div className="spe-bf">
      <input className="spe-bf-input" value={data.videoId || ''} onChange={e => onChange({ ...data, videoId: e.target.value })} placeholder="YouTube Video ID..." />
      <input className="spe-bf-input" value={data.caption || ''} onChange={e => onChange({ ...data, caption: e.target.value })} placeholder="Chú thích..." />
    </div>
  )
}

function VideoFields({ data, onChange }: { data: { url?: string; caption?: string; poster?: string }; onChange: (d: any) => void }) {
  return (
    <div className="spe-bf">
      <input className="spe-bf-input" value={data.url || ''} onChange={e => onChange({ ...data, url: e.target.value })} placeholder="URL video (mp4)..." />
      <input className="spe-bf-input" value={data.caption || ''} onChange={e => onChange({ ...data, caption: e.target.value })} placeholder="Chú thích..." />
      <input className="spe-bf-input" value={data.poster || ''} onChange={e => onChange({ ...data, poster: e.target.value })} placeholder="URL ảnh poster..." />
    </div>
  )
}

function QuoteFields({ data, onChange }: { data: { text?: string; author?: string; style?: string }; onChange: (d: any) => void }) {
  return (
    <div className="spe-bf">
      <textarea className="spe-bf-textarea" value={data.text || ''} onChange={e => onChange({ ...data, text: e.target.value })} placeholder="Nội dung trích dẫn..." rows={3} />
      <div className="spe-bf-row">
        <input className="spe-bf-input" value={data.author || ''} onChange={e => onChange({ ...data, author: e.target.value })} placeholder="Tác giả..." />
        <select value={data.style || 'default'} onChange={e => onChange({ ...data, style: e.target.value })} className="spe-bf-small">
          <option value="default">Mặc định</option>
          <option value="large">Lớn</option>
        </select>
      </div>
    </div>
  )
}

function DividerFields() {
  return <div className="spe-bf"><span className="spe-bf-hint">Đường phân cách — không có trường dữ liệu.</span></div>
}

function PdfFields({ data, onChange }: { data: { url?: string; title?: string }; onChange: (d: any) => void }) {
  return (
    <div className="spe-bf">
      <input className="spe-bf-input" value={data.url || ''} onChange={e => onChange({ ...data, url: e.target.value })} placeholder="URL PDF..." />
      <input className="spe-bf-input" value={data.title || ''} onChange={e => onChange({ ...data, title: e.target.value })} placeholder="Tiêu đề..." />
    </div>
  )
}

function ButtonFields({ data, onChange }: { data: { text?: string; url?: string; style?: string; openInNewTab?: boolean }; onChange: (d: any) => void }) {
  return (
    <div className="spe-bf">
      <input className="spe-bf-input" value={data.text || ''} onChange={e => onChange({ ...data, text: e.target.value })} placeholder="Nhãn nút..." />
      <input className="spe-bf-input" value={data.url || ''} onChange={e => onChange({ ...data, url: e.target.value })} placeholder="URL..." />
      <div className="spe-bf-row">
        <select value={data.style || 'primary'} onChange={e => onChange({ ...data, style: e.target.value })} className="spe-bf-small">
          <option value="primary">Primary</option>
          <option value="secondary">Secondary</option>
          <option value="outline">Outline</option>
        </select>
        <label className="spe-check-label">
          <input type="checkbox" checked={data.openInNewTab || false} onChange={e => onChange({ ...data, openInNewTab: e.target.checked })} />
          Tab mới
        </label>
      </div>
    </div>
  )
}

function EmbedFields({ data, onChange }: { data: { html?: string; caption?: string }; onChange: (d: any) => void }) {
  return (
    <div className="spe-bf">
      <textarea className="spe-bf-textarea" value={data.html || ''} onChange={e => onChange({ ...data, html: e.target.value })} placeholder="Mã nhúng (iframe, HTML)..." rows={4} />
      <input className="spe-bf-input" value={data.caption || ''} onChange={e => onChange({ ...data, caption: e.target.value })} placeholder="Chú thích..." />
    </div>
  )
}

function CalloutFields({ data, onChange }: { data: { icon?: string; text?: string; color?: string }; onChange: (d: any) => void }) {
  return (
    <div className="spe-bf">
      <div className="spe-bf-row">
        <input className="spe-bf-small" value={data.icon || '💡'} onChange={e => onChange({ ...data, icon: e.target.value })} placeholder="Icon..." style={{ width: 60 }} />
        <select value={data.color || 'default'} onChange={e => onChange({ ...data, color: e.target.value })} className="spe-bf-small">
          <option value="default">Mặc định</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="success">Success</option>
          <option value="danger">Danger</option>
        </select>
      </div>
      <textarea className="spe-bf-textarea" value={data.text || ''} onChange={e => onChange({ ...data, text: e.target.value })} placeholder="Nội dung callout..." rows={3} />
    </div>
  )
}

// ── Styles ──
const CSS = `
.spe-root { font-family: 'Be Vietnam Pro', system-ui, sans-serif; background: #F2EEE7; min-height: 100dvh; }
.spe-loading { text-align: center; padding: 60px; color: #8A8499; }

.spe-header {
  position: sticky; top: 0; z-index: 30; background: rgba(242,238,231,0.95);
  backdrop-filter: blur(10px); border-bottom: 1px solid #E4DED4;
  display: flex; align-items: center; gap: 16px; padding: 12px 20px;
  padding-top: max(env(safe-area-inset-top, 0px), 12px);
}
.spe-back { background: none; border: none; color: #4338CA; font-size: 14px; font-weight: 500; cursor: pointer; padding: 0; }
.spe-back:hover { text-decoration: underline; }
.spe-title { font-size: 18px; font-weight: 700; color: #211C32; margin: 0; flex: 1; }
.spe-save-btn { padding: 8px 18px; background: #4338CA; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
.spe-save-btn:hover { background: #352BA3; }
.spe-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.spe-error { margin: 12px 20px 0; padding: 10px 14px; background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; border-radius: 8px; font-size: 13px; }

.spe-body { max-width: 800px; margin: 0 auto; padding: 24px 20px 100px; }

.spe-section {
  background: #fff; border: 1px solid #E4DED4; border-radius: 12px; padding: 24px; margin-bottom: 20px;
}
.spe-section-title { font-size: 15px; font-weight: 700; color: #211C32; margin: 0 0 16px; }
.spe-hint { font-size: 13px; color: #8A8499; margin: 0 0 16px; }

.spe-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px; }
.spe-field:last-child { margin-bottom: 0; }
.spe-field-grow { flex: 1; }
.spe-label { font-size: 12px; font-weight: 600; color: #5A5470; }
.spe-field input[type="text"],
.spe-field input[type="number"],
.spe-field textarea,
.spe-field select {
  padding: 9px 12px; border: 1px solid #E4DED4; border-radius: 8px;
  font-size: 14px; font-family: inherit; box-sizing: border-box;
}
.spe-field input:focus, .spe-field textarea:focus, .spe-field select:focus {
  outline: none; border-color: #4338CA;
}
.spe-field textarea { resize: vertical; min-height: 60px; }
.spe-field select { background: #fff; cursor: pointer; }

.spe-field-row { display: flex; gap: 14px; }
.spe-toggles { gap: 20px; }
.spe-check-label { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #211C32; cursor: pointer; }
.spe-check-label input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; }

/* ── Blocks ── */
.spe-blocks { display: flex; flex-direction: column; gap: 4px; }

.spe-block {
  border: 1px solid #E4DED4; border-radius: 10px; overflow: hidden;
  transition: border-color .15s;
}
.spe-block:hover { border-color: #C4BED4; }
.spe-block-active { border-color: #4338CA; }

.spe-block-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 10px; background: #FAF9F7; gap: 8px;
}
.spe-block-left { display: flex; align-items: center; gap: 8px; }
.spe-block-icon { font-size: 14px; color: #8A8499; }
.spe-block-type-select {
  padding: 4px 8px; border: 1px solid #E4DED4; border-radius: 6px;
  font-size: 12px; font-family: inherit; background: #fff; cursor: pointer;
  color: #5A5470;
}

.spe-block-right { display: flex; gap: 4px; }
.spe-block-move {
  width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;
  background: none; border: 1px solid #E4DED4; border-radius: 6px;
  font-size: 10px; cursor: pointer; color: #8A8499; padding: 0;
}
.spe-block-move:hover:not(:disabled) { background: #F2EEE7; color: #5A5470; }
.spe-block-move:disabled { opacity: 0.4; cursor: not-allowed; }
.spe-block-del {
  width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;
  background: none; border: 1px solid #FECACA; border-radius: 6px;
  font-size: 14px; cursor: pointer; color: #DC2626; padding: 0; line-height: 1;
}
.spe-block-del:hover { background: #FEF2F2; }

.spe-block-body { padding: 14px; }

.spe-block-add-row { display: flex; justify-content: center; padding: 8px 0; }
.spe-add-block-btn {
  width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
  background: #fff; border: 1px dashed #C4BED4; border-radius: 50%;
  font-size: 16px; cursor: pointer; color: #8A8499; padding: 0; line-height: 1;
  transition: all .15s;
}
.spe-add-block-btn:hover { border-color: #4338CA; color: #4338CA; background: #EEEBFB; }

/* Block field sub-form */
.spe-bf { display: flex; flex-direction: column; gap: 10px; }
.spe-bf-row { display: flex; gap: 10px; align-items: center; }
.spe-bf-input {
  flex: 1; padding: 8px 10px; border: 1px solid #E4DED4; border-radius: 6px;
  font-size: 13px; font-family: inherit; box-sizing: border-box;
}
.spe-bf-input:focus { outline: none; border-color: #4338CA; }
.spe-bf-textarea {
  padding: 8px 10px; border: 1px solid #E4DED4; border-radius: 6px;
  font-size: 13px; font-family: inherit; resize: vertical; min-height: 60px;
}
.spe-bf-textarea:focus { outline: none; border-color: #4338CA; }
.spe-bf-small {
  padding: 8px 10px; border: 1px solid #E4DED4; border-radius: 6px;
  font-size: 13px; font-family: inherit; background: #fff; cursor: pointer;
}
.spe-bf-hint { font-size: 13px; color: #8A8499; font-style: italic; }
.spe-bf-add-btn {
  padding: 6px 12px; background: none; border: 1px dashed #C4BED4; border-radius: 6px;
  font-size: 12px; cursor: pointer; color: #4338CA; font-family: inherit;
}
.spe-bf-add-btn:hover { background: #EEEBFB; border-color: #4338CA; }
.spe-bf-gallery-item { display: flex; gap: 8px; align-items: center; }
.spe-bf-remove-sm {
  width: 26px; height: 26px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  background: none; border: 1px solid #FECACA; border-radius: 6px;
  font-size: 14px; cursor: pointer; color: #DC2626; padding: 0;
}
.spe-bf-remove-sm:hover { background: #FEF2F2; }
.spe-block-unknown { font-size: 13px; color: #DC2626; }

/* Bottom bar */
.spe-bottom-bar {
  position: fixed; bottom: 0; left: 0; right: 0;
  background: #fff; border-top: 1px solid #E4DED4;
  padding: 12px 20px; display: flex; gap: 12px; justify-content: flex-end;
  padding-bottom: max(env(safe-area-inset-bottom, 0px), 12px);
  z-index: 30;
}
.spe-cancel-btn { padding: 10px 20px; background: none; border: 1px solid #E4DED4; border-radius: 8px; font-size: 14px; cursor: pointer; font-family: inherit; color: #5A5470; }
.spe-save-btn-lg { padding: 10px 24px; font-size: 14px; }

@media (max-width: 640px) {
  .spe-field-row { flex-direction: column; }
  .spe-section { padding: 18px; }
  .spe-body { padding: 16px 12px 100px; }
}
`
