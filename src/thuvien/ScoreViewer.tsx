import { useEffect, useState } from 'react'
import type { ScorePage } from '../musicxml-beats/renderer/types.ts'
import { updateLibraryMetadata } from './masterLibrary.ts'
import type { LibraryItem } from './masterLibrary.ts'
import { pageSrc, renderPagesForView, ZOOM_STEPS } from './viewScore.ts'
import type { Zoom } from './viewScore.ts'

type Heading = { title: string; composer: string | null }

// PostgREST `.single()` không thấy dòng nào → đường dẫn `?bai=` trỏ tới bản không tồn tại.
const NOT_FOUND = /PGRST116|coerce the result to a single|no\) rows|not found/i
const readable = (error: unknown) => {
  const message = error instanceof Error ? error.message : ''
  if (NOT_FOUND.test(message)) return 'Không tìm thấy bản nhạc này trong thư viện.'
  return message || 'Không mở được bản nhạc.'
}
type State =
  | { kind: 'loading'; step: string }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; pages: ScorePage[] }

/**
 * Xem một bản trong `musicxml_library`. Chỉ đọc: lấy XML qua `getMasterCopySource`
 * (đã kiểm SHA-256 + kích thước + parse) rồi khắc bằng renderer của Nhịp Phách.
 */
export default function ScoreViewer({ id, initial, onClose, onSaved }: {
  id: string
  initial: Heading | null
  onClose: () => void
  onSaved: (item: LibraryItem) => void
}) {
  const [heading, setHeading] = useState<Heading | null>(initial)
  const [editing, setEditing] = useState(false)
  const [state, setState] = useState<State>({ kind: 'loading', step: 'Đang tải bản nhạc…' })
  const [zoom, setZoom] = useState<Zoom>(100)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    let destroy: (() => void) | undefined
    ;(async () => {
      try {
        const { getMasterCopySource } = await import('../nhipphach/masterCopy.ts')
        const source = await getMasterCopySource(id)
        if (!active) return
        setHeading({ title: source.title, composer: source.composer })
        setState({ kind: 'loading', step: 'Đang dựng bản nhạc…' })
        const { createAnnotatedScoreRenderer } = await import('../musicxml-beats/renderer/verovioAdapter.ts')
        const renderer = await createAnnotatedScoreRenderer()
        destroy = () => renderer.destroy()
        if (!active) return destroy()
        // Nhường một khung hình để chữ "Đang dựng…" kịp hiện trước lượt khắc đồng bộ.
        await new Promise(resolve => requestAnimationFrame(() => resolve(null)))
        if (!active) return
        const pages = renderPagesForView(renderer, source.musicxmlText)
        if (active) setState({ kind: 'ready', pages })
      } catch (error) {
        if (active) setState({ kind: 'error', message: readable(error) })
      }
    })()
    return () => { active = false; destroy?.() }
  }, [id, attempt])

  const step = (delta: 1 | -1) => {
    const next = ZOOM_STEPS[ZOOM_STEPS.indexOf(zoom) + delta]
    if (next) setZoom(next)
  }

  return <article className="tv-view" aria-busy={state.kind === 'loading'}>
    <header className="tv-view-head">
      <button type="button" className="tv-back" onClick={onClose}>← Thư viện</button>
      <div className="tv-view-title">
        <h1>{heading?.title ?? 'Bản nhạc'}</h1>
        {heading?.composer && <p>{heading.composer}</p>}
      </div>
      {heading && !editing && state.kind !== 'loading' && <div className="tv-actions">
        <button type="button" className="tv-edit" onClick={() => setEditing(true)}>Sửa thông tin</button>
        {/* Cùng tab, chỉ mang id: Nhịp Phách tự đọc + kiểm bản gốc và tự sao chép. */}
        <a className="tv-np" href={`/nhipphach?master=${encodeURIComponent(id)}`}>Đưa vào Nhịp &amp; Phách</a>
      </div>}
    </header>
    {editing && heading && <MetadataForm id={id} heading={heading} onCancel={() => setEditing(false)}
      onSaved={item => { setHeading({ title: item.title, composer: item.composer }); setEditing(false); onSaved(item) }} />}
    {state.kind === 'loading' && <p className="tv-view-note" aria-live="polite">{state.step}</p>}
    {state.kind === 'error' && <div className="tv-view-note tv-view-error" role="alert">
      <p>{state.message}</p>
      <button type="button" onClick={() => { setState({ kind: 'loading', step: 'Đang tải bản nhạc…' }); setAttempt(n => n + 1) }}>Thử lại</button>
    </div>}
    {state.kind === 'ready' && <>
      <div className="tv-zoom" aria-label="Cỡ hiển thị">
        <button type="button" onClick={() => step(-1)} disabled={zoom === ZOOM_STEPS[0]} aria-label="Thu nhỏ">−</button>
        <span>{zoom}%</span>
        <button type="button" onClick={() => step(1)} disabled={zoom === ZOOM_STEPS[ZOOM_STEPS.length - 1]} aria-label="Phóng to">+</button>
        <span className="tv-zoom-pages">{state.pages.length} trang</span>
      </div>
      <div className="tv-pages">
        {state.pages.map(page => <figure key={page.number} className="tv-page" style={{ width: `${zoom}%` }}>
          <img src={pageSrc(page.svg)} alt={`Trang ${page.number} — ${heading?.title ?? 'bản nhạc'}`}
            style={{ aspectRatio: `${page.width} / ${page.height}` }} />
          {state.pages.length > 1 && <figcaption>Trang {page.number}</figcaption>}
        </figure>)}
      </div>
    </>}
  </article>
}

/** Chỉ sửa Tên bài / Tác giả. Bản nhạc (XML + mã kiểm tra) không bao giờ được gửi đi. */
function MetadataForm({ id, heading, onCancel, onSaved }: {
  id: string
  heading: Heading
  onCancel: () => void
  onSaved: (item: LibraryItem) => void
}) {
  const [title, setTitle] = useState(heading.title)
  const [composer, setComposer] = useState(heading.composer ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (busy || !title.trim()) return
    setBusy(true)
    setError('')
    try { onSaved(await updateLibraryMetadata(id, title, composer)) }
    catch (err) { setError(err instanceof Error ? err.message : 'Không lưu được thông tin bản nhạc.') }
    finally { setBusy(false) }
  }

  return <form className="tv-meta" aria-label="Sửa thông tin bản nhạc" onSubmit={event => { event.preventDefault(); void save() }}>
    <label>Tên bài<input value={title} onChange={event => setTitle(event.target.value)} required autoFocus /></label>
    <label>Tác giả<input value={composer} onChange={event => setComposer(event.target.value)} placeholder="Để trống nếu chưa rõ" /></label>
    {error && <p className="tv-meta-error" role="alert">{error}</p>}
    <div className="tv-meta-actions">
      <button type="submit" disabled={busy || !title.trim()}>{busy ? 'Đang lưu…' : 'Lưu'}</button>
      <button type="button" onClick={onCancel} disabled={busy}>Hủy</button>
    </div>
  </form>
}
