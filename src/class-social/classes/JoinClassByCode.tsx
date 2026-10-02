// /me/classes — "Nhập mã lớp của bạn": gõ mã Thầy gửi → xem đúng lớp → Tham gia. Mã được server resolve
// (class_join_preview / class_join); người tham gia luôn là tài khoản đang đăng nhập. Không gửi user/lớp/nhóm.
import { useState, type FormEvent } from 'react'
import { KeyRound } from 'lucide-react'
import { joinClassByCode, previewJoinClass, type JoinPreview } from './classesApi'
import { classStatusLabel } from './classModel'

export default function JoinClassByCode({ onJoined }: { onJoined: (classId: string) => void }) {
  const [code, setCode] = useState('')
  const [preview, setPreview] = useState<JoinPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const look = async (e: FormEvent) => {
    e.preventDefault()
    if (!code.trim() || busy) return
    setBusy(true); setError(null); setPreview(null)
    const r = await previewJoinClass(code.trim())
    setBusy(false)
    if (r.ok) setPreview(r.value); else setError(r.message)
  }
  const join = async () => {
    if (!preview || busy) return
    setBusy(true); setError(null)
    const r = await joinClassByCode(code.trim())
    setBusy(false)
    if (!r.ok) { setError(r.message); return }
    setCode(''); setPreview(null)
    onJoined(r.value.classId)
  }

  return (
    <section className="cs-card cs-join-class" aria-labelledby="cs-join-title">
      <h2 id="cs-join-title" className="cs-feed-title"><KeyRound size={17} aria-hidden="true" /> Nhập mã lớp của bạn</h2>
      <p className="cs-section-hint">Thầy gửi mã tham gia khi xếp bạn vào lớp. Nhập mã để lớp hiện ngay trong Lớp của tôi.</p>
      <form className="cs-join-row" onSubmit={e => void look(e)}>
        <input className="cs-input" value={code} onChange={e => { setCode(e.target.value.toUpperCase()); setPreview(null); setError(null) }}
          placeholder="VD: K7PM-3QXD" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={16}
          aria-label="Mã lớp" />
        <button type="submit" className="cs-btn cs-btn-soft" disabled={busy || !code.trim()}>{busy && !preview ? 'Đang kiểm tra…' : 'Xem lớp'}</button>
      </form>
      {error && <p className="cs-form-error" role="alert">{error}</p>}
      {preview && (
        <div className="cs-join-preview" role="status">
          <div className="cs-class-tile-name">{preview.name}</div>
          <div className="cs-class-tile-meta">
            {[preview.code, preview.course?.name, preview.schedule, classStatusLabel(preview.status)].filter(Boolean).join(' · ')}
          </div>
          <div className="cs-section-hint">{preview.memberCount} học viên đang trong lớp</div>
          {preview.alreadyMember
            ? <button type="button" className="cs-btn cs-btn-soft" onClick={() => onJoined(preview.classId)}>Bạn đã ở trong lớp này — Mở lớp</button>
            : <button type="button" className="cs-btn cs-btn-primary" onClick={() => void join()} disabled={busy}>{busy ? 'Đang tham gia…' : 'Tham gia lớp'}</button>}
        </div>
      )}
    </section>
  )
}
