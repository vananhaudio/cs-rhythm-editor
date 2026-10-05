// Ảnh bìa của entity (Band / Công cụ / Lớp) — Entity Cover V1 (db/entity_cover_v1_setup.sql).
// Tải lên qua entityImage.ts (bucket course-logos SẴN CÓ, như logo khoá trong CourseEditorContent).
// Đây là ảnh của entity: giao diện và thẻ chia sẻ (netlify/og) cùng đọc một cột, không có trường "OG thumbnail".
import { useRef, useState } from 'react'
import { uploadEntityImage } from './entityImage'

/**
 * Ô ảnh: xem trước + Tải ảnh / Đổi ảnh / Gỡ ảnh. onChange nhận URL mới (null = gỡ) và tự lưu;
 * trả về thông báo lỗi (string) hoặc null nếu xong.
 */
export default function EntityImageField({ value, prefix, onChange, label = 'Ảnh bìa', hint }: {
  value: string | null
  prefix: string
  onChange: (url: string | null) => Promise<string | null | void> | string | null | void
  label?: string
  hint?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const apply = async (url: string | null) => {
    const r = await onChange(url)
    if (typeof r === 'string') setError(r)
  }
  const pick = async (file: File | undefined) => {
    if (!file) return
    setBusy(true); setError(null)
    try { await apply(await uploadEntityImage(prefix, file)) } catch (e) { setError('Lỗi tải ảnh: ' + (e as Error).message) }
    setBusy(false)
    if (input.current) input.current.value = ''
  }

  return (
    <div className="entity-image-field" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ width: 120, height: 63, borderRadius: 8, overflow: 'hidden', background: '#F4F4F5', border: '1px solid #E4E4E7',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, color: '#A1A1AA' }}>
        {value ? <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 'Chưa có ảnh'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        {hint && <div style={{ fontSize: 12, color: '#71717A' }}>{hint}</div>}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" disabled={busy} onClick={() => input.current?.click()}
            style={{ border: '1px solid #2D6A4F', color: '#2D6A4F', background: '#fff', borderRadius: 8, padding: '5px 12px', fontSize: 13, fontWeight: 600, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit' }}>
            {busy ? 'Đang tải…' : value ? 'Đổi ảnh' : 'Tải ảnh'}
          </button>
          {value && !busy && (
            <button type="button" onClick={() => { setError(null); void apply(null) }}
              style={{ border: '1px solid #E4E4E7', color: '#52525B', background: '#fff', borderRadius: 8, padding: '5px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Gỡ ảnh
            </button>
          )}
        </div>
        {error && <div role="alert" style={{ fontSize: 12, color: '#DC2626' }}>{error}</div>}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg" hidden onChange={e => void pick(e.target.files?.[0])} />
    </div>
  )
}
