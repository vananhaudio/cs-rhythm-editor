// Chọn / tạo nhanh tag kiến thức (CHỈ hiện với Thầy). Gõ "nhịp" → thấy #Nhịp;
// chưa có → "+ Tạo #Nhịp". Chống trùng khác hoa/thường ở cả client lẫn DB (unique lower(name)).
import { useEffect, useRef, useState } from 'react'
import { findTag, normalizeTagName, type Tag } from '../../comments/commentModel'
import { loadCommentsApi } from '../../comments/lazyApi'

export default function TagPicker({ selected, onAdd, onClose }: {
  selected: Tag[]
  onAdd: (t: Tag) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Tag[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const req = useRef(0)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    const id = ++req.current
    const t = setTimeout(() => {
      void loadCommentsApi().then(api => api.searchTags(q)).then(r => {
        if (id !== req.current) return
        if (r.ok) { setResults(r.value); setError(null) } else setError(r.message)
      })
    }, 180)
    return () => clearTimeout(t)
  }, [q])

  const normalized = normalizeTagName(q)
  const exact = normalized ? findTag(results, normalized) : undefined
  const isSelected = (t: Tag) => selected.some(s => s.id === t.id)

  const create = async () => {
    if (!normalized || busy) return
    setBusy(true); setError(null)
    const r = await (await loadCommentsApi()).createTag(normalized)
    setBusy(false)
    if (!r.ok) { setError(r.message); return }
    onAdd(r.value); setQ('')
  }

  return (
    <div className="cs-picker" role="group" aria-label="Gắn tag kiến thức">
      <div className="cs-picker-head">
        <input ref={inputRef} className="cs-input cs-input-sm" placeholder="Tìm hoặc tạo tag, vd: nhịp"
          value={q} maxLength={60} onChange={e => setQ(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Escape') { e.stopPropagation(); onClose() }
            if (e.key === 'Enter') {
              e.preventDefault()
              if (exact) { if (!isSelected(exact)) onAdd(exact); setQ('') } else void create()
            }
          }} />
        <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm" onClick={onClose}>Xong</button>
      </div>
      <div className="cs-picker-list">
        {results.filter(t => !isSelected(t)).map(t => (
          <button key={t.id} type="button" className="cs-tag cs-tag-btn" onClick={() => onAdd(t)}>#{t.name}</button>
        ))}
        {normalized && !exact && (
          <button type="button" className="cs-tag cs-tag-new" onClick={() => void create()} disabled={busy}>
            {busy ? 'Đang tạo…' : `+ Tạo #${normalized}`}
          </button>
        )}
        {!normalized && q.trim() !== '' && <span className="cs-picker-hint">Tên tag chưa hợp lệ.</span>}
        {results.length === 0 && !q && <span className="cs-picker-hint">Chưa có tag nào — gõ để tạo tag đầu tiên.</span>}
      </div>
      {error && <p className="cs-form-error" role="alert">{error}</p>}
    </div>
  )
}
