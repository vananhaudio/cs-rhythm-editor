// "Chỉnh sửa trang cá nhân" (V1): ảnh đại diện + tên hiển thị của CHÍNH MÌNH, lưu vào hồ sơ dùng chung với App học
// (edu_students.avatar_url / display_name — cùng pipeline ảnh 'avatars' của useProfileMediaEditor). Không bio, không SĐT…
import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { ClassIdentity } from '../useClassSession'
import { Avatar } from '../ui'
import { PREPARE_ERROR_TEXT, prepareImage } from './imageFile'
import { saveAvatar, saveDisplayName } from './profileApi'
import { MAX_DISPLAY_NAME, checkDisplayName } from './profileEdit'
import type { IdentityPatch } from './useProfileMediaEditor'

export default function ProfileEditDialog({ me, onClose, onSaved }: {
  me: ClassIdentity
  onClose: () => void
  onSaved: (p: IdentityPatch) => void
}) {
  const [name, setName] = useState(me.name)
  const [photo, setPhoto] = useState<{ blob: Blob; previewUrl: string } | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const busy = saving || preparing

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.previewUrl) }, [photo])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setPreparing(true); setError(null)
    const r = await prepareImage(file, 'avatar')
    setPreparing(false)
    if (!r.ok) { setError(PREPARE_ERROR_TEXT[r.error]); return }   // giữ nguyên tên đang nhập
    setPhoto(r)
  }

  const check = checkDisplayName(name)
  const nameChanged = check.ok && check.name !== me.name
  const dirty = nameChanged || !!photo

  const save = async () => {
    if (busy || !me.studentId) return
    if (!check.ok) { setError(check.error); return }
    if (!dirty) { onClose(); return }
    setSaving(true); setError(null)
    const patch: IdentityPatch = {}
    if (photo) {
      const r = await saveAvatar(me.studentId, photo.blob)
      if (!r.ok) { setSaving(false); setError(r.message); return }
      patch.avatarUrl = r.value
      setPhoto(null)   // ảnh đã lưu — nếu bước tên lỗi thì bấm Lưu lại chỉ còn lưu tên
    }
    if (nameChanged) {
      const r = await saveDisplayName(me.studentId, check.name)
      if (!r.ok) { setSaving(false); if (patch.avatarUrl) onSaved(patch); setError(r.message); return }
      patch.name = r.value
    }
    setSaving(false)
    onSaved(patch)
    onClose()
  }

  return (
    <>
      <div className="cs-dialog-backdrop" onClick={() => { if (!saving) onClose() }} />
      <div className="cs-media-dialog cs-profile-edit" role="dialog" aria-modal="true" aria-labelledby="cs-profile-edit-title">
        <header className="cs-composer-modal-head">
          <h2 id="cs-profile-edit-title">Chỉnh sửa trang cá nhân</h2>
          <button type="button" className="cs-icon-btn" onClick={onClose} disabled={saving} aria-label="Đóng"><X size={20} /></button>
        </header>
        <form className="cs-profile-edit-body" onSubmit={e => { e.preventDefault(); void save() }} noValidate>
          <div className="cs-field">
            <span className="cs-field-label">Ảnh đại diện</span>
            <div className="cs-profile-edit-avatar">
              {photo
                ? <img className="cs-preview-avatar" src={photo.previewUrl} alt="Ảnh đại diện mới" />
                : <Avatar name={check.ok ? check.name : me.name} url={me.avatarUrl} size={112} />}
              <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm" onClick={() => fileRef.current?.click()} disabled={busy}>
                {preparing ? 'Đang chuẩn bị ảnh…' : 'Đổi ảnh'}
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif" hidden
                onChange={e => { void onFile(e.target.files?.[0]); e.currentTarget.value = '' }} />
            </div>
          </div>
          <label className="cs-field">
            <span className="cs-field-label">Tên hiển thị</span>
            <input className="cs-input" type="text" value={name} maxLength={MAX_DISPLAY_NAME + 20} autoComplete="name"
              onChange={e => { setName(e.target.value); setError(null) }} disabled={saving} aria-invalid={!check.ok} />
            <span className="cs-field-hint">Tên hiện với bạn bè, lớp và Thầy — dùng chung với App học.</span>
          </label>
          {error && <p className="cs-form-error" role="alert">{error}</p>}
          <footer className="cs-composer-modal-foot cs-media-dialog-foot">
            <button type="button" className="cs-btn cs-btn-ghost" onClick={onClose} disabled={saving}>Huỷ</button>
            <button type="submit" className="cs-btn cs-btn-primary" disabled={busy || !check.ok} aria-busy={saving}>
              {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
            </button>
          </footer>
        </form>
      </div>
    </>
  )
}
