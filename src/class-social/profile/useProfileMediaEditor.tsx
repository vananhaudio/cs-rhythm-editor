// Đổi ảnh đại diện / ảnh bìa: chọn ảnh → kiểm tra + thu nhỏ → XEM TRƯỚC → Lưu.
// pick(kind) phải được gọi TRONG sự kiện bấm (trình duyệt chỉ mở hộp chọn tệp khi có thao tác người dùng).
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Camera, X } from 'lucide-react'
import type { ClassIdentity } from '../useClassSession'
import { PREPARE_ERROR_TEXT, prepareImage, type ImageKind } from './imageFile'
import { saveAvatar, saveCover } from './profileApi'

type Draft = { kind: ImageKind; blob: Blob; previewUrl: string }
export type IdentityPatch = Partial<Pick<ClassIdentity, 'avatarUrl' | 'coverUrl'>>

const TITLE: Record<ImageKind, string> = { avatar: 'Đổi ảnh đại diện', cover: 'Đổi ảnh bìa' }

export function useProfileMediaEditor(me: ClassIdentity, onChanged: (p: IdentityPatch) => void) {
  const avatarInput = useRef<HTMLInputElement>(null)
  const coverInput = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  /** Ảnh đại diện nằm ở hồ sơ học sinh (edu_students) — tài khoản không có hồ sơ học sinh thì chưa đổi được. */
  const canEditAvatar = !!me.studentId
  const pick = useCallback((kind: ImageKind) => {
    if (kind === 'avatar' && !canEditAvatar) return
    setError(null)
    ;(kind === 'avatar' ? avatarInput : coverInput).current?.click()
  }, [canEditAvatar])

  const close = useCallback(() => {
    if (inFlight.current) return
    setDraft(d => { if (d) URL.revokeObjectURL(d.previewUrl); return null })
    setError(null)
  }, [])

  useEffect(() => {
    if (!draft) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [draft, close])

  const onFile = async (kind: ImageKind, file: File | undefined) => {
    if (!file) return
    setPreparing(true); setError(null)
    const r = await prepareImage(file, kind)
    setPreparing(false)
    if (!r.ok) { setDraft(null); setError(PREPARE_ERROR_TEXT[r.error]); return }
    setDraft({ kind, blob: r.blob, previewUrl: r.previewUrl })
  }

  const save = async () => {
    if (!draft || inFlight.current) return
    inFlight.current = true; setSaving(true); setError(null)
    const r = draft.kind === 'avatar'
      ? await saveAvatar(me.studentId as string, draft.blob)
      : await saveCover(me.userId, draft.blob)
    inFlight.current = false; setSaving(false)
    if (!r.ok) { setError(r.message); return }     // giữ ảnh xem trước để thử lại
    onChanged(draft.kind === 'avatar' ? { avatarUrl: r.value } : { coverUrl: r.value })
    URL.revokeObjectURL(draft.previewUrl)
    setDraft(null)
  }

  const element: ReactNode = (
    <>
      {(['avatar', 'cover'] as const).map(kind => (
        <input key={kind} ref={kind === 'avatar' ? avatarInput : coverInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
          hidden onChange={e => { void onFile(kind, e.target.files?.[0]); e.currentTarget.value = '' }} />
      ))}
      {(preparing || (error && !draft)) && (
        <div className="cs-toast" role={error ? 'alert' : 'status'}>
          {preparing ? 'Đang chuẩn bị ảnh…' : error}
          {error && <button type="button" className="cs-toast-x" onClick={() => setError(null)} aria-label="Đóng"><X size={16} /></button>}
        </div>
      )}
      {draft && (
        <>
          <div className="cs-dialog-backdrop" onClick={close} />
          <div className="cs-media-dialog" role="dialog" aria-modal="true" aria-labelledby="cs-media-title">
            <header className="cs-composer-modal-head">
              <h2 id="cs-media-title"><Camera size={19} /> {TITLE[draft.kind]}</h2>
              <button type="button" className="cs-icon-btn" onClick={close} disabled={saving} aria-label="Đóng"><X size={20} /></button>
            </header>
            <div className="cs-media-dialog-body">
              {draft.kind === 'avatar'
                ? <img className="cs-preview-avatar" src={draft.previewUrl} alt="Ảnh đại diện mới" />
                : <img className="cs-preview-cover" src={draft.previewUrl} alt="Ảnh bìa mới" />}
              <p className="cs-media-hint">
                {draft.kind === 'avatar'
                  ? 'Ảnh đại diện dùng chung cho App học và Cộng đồng.'
                  : 'Ảnh bìa hiển thị ở đầu trang của bạn trong Cộng đồng.'}
              </p>
              {error && <p className="cs-form-error" role="alert">{error}</p>}
            </div>
            <footer className="cs-composer-modal-foot cs-media-dialog-foot">
              <button type="button" className="cs-btn cs-btn-ghost" onClick={close} disabled={saving}>Huỷ</button>
              <button type="button" className="cs-btn cs-btn-primary" onClick={() => void save()} disabled={saving} aria-busy={saving}>
                {saving ? 'Đang lưu…' : 'Lưu'}
              </button>
            </footer>
          </div>
        </>
      )}
    </>
  )

  return { pick, canEditAvatar, busy: preparing || saving, element }
}
