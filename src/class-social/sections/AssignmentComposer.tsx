// Soạn "Trả bài": VIDEO bài tập (bắt buộc, đối tượng chính) + Ghi chú cho Thầy (tuỳ chọn).
// Trả bài là nhiệm vụ học tập, không phải status. Học sinh CHỈ dán link —
// Class tự nhận diện YouTube/TikTok/Facebook, hiện xem trước, rồi đăng.
// Desktop: hộp thoại; mobile: sheet toàn màn hình (CSS).
import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Upload, X } from 'lucide-react'
import ExternalMediaView from '../media/ExternalMediaView'
import { PROVIDER_LABEL, type ExternalMedia } from '../media/parseExternalMedia'
import { MAX_BODY, checkAssignmentDraft } from '../posts/postModel'
import { createAssignmentPost } from '../posts/postsApi'
import type { ClassIdentity } from '../useClassSession'
import { Avatar } from '../ui'

function recognizedText(m: ExternalMedia): string {
  if (m.provider === 'tiktok' && m.shortLink) {
    return 'Đã nhận diện link TikTok rút gọn — bài sẽ hiện nút mở video. Dán link đầy đủ (tiktok.com/@…/video/…) để xem ngay trong Class.'
  }
  if (m.provider === 'facebook') return 'Đã nhận diện Facebook — bài sẽ hiện thẻ mở video trên Facebook.'
  if (m.provider === 'external_link') return 'Liên kết khác — bài sẽ hiện thẻ mở liên kết.'
  return `Đã nhận diện video ${PROVIDER_LABEL[m.provider]}.`
}

export default function AssignmentComposer({ me, onClose, onPosted }: {
  me: ClassIdentity
  onClose: () => void
  onPosted: () => void
}) {
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('')
  const [urlTouched, setUrlTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const urlRef = useRef<HTMLInputElement>(null)

  const check = useMemo(() => checkAssignmentDraft({ body, url }), [body, url])
  const media = check.ok ? check.media : null
  const showVideoError = !check.ok && !!check.videoError && urlTouched && url.trim() !== ''

  useEffect(() => { urlRef.current?.focus() }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !inFlight.current) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async () => {
    if (inFlight.current) return               // chặn bấm đúp
    setUrlTouched(true)
    if (!check.ok) return
    inFlight.current = true
    setSubmitting(true)
    setError(null)
    const r = await createAssignmentPost(check.insert)
    inFlight.current = false
    setSubmitting(false)
    if (!r.ok) { setError(r.message); return }
    onPosted()
  }

  const remaining = MAX_BODY - body.length
  return (
    <>
      <div className="cs-dialog-backdrop" onClick={() => { if (!inFlight.current) onClose() }} />
      <div className="cs-composer-modal" role="dialog" aria-modal="true" aria-labelledby="cs-assign-title">
        <header className="cs-composer-modal-head">
          <h2 id="cs-assign-title"><Upload size={19} /> Trả bài</h2>
          <button type="button" className="cs-icon-btn" onClick={onClose} disabled={submitting} aria-label="Đóng">
            <X size={20} />
          </button>
        </header>

        <form className="cs-composer-modal-body" onSubmit={e => { e.preventDefault(); void submit() }} noValidate>
          <div className="cs-composer-author">
            <Avatar name={me.name} url={me.avatarUrl} size={38} />
            <span>{me.name}</span>
          </div>

          <label className="cs-field">
            <span className="cs-field-label">Video bài tập</span>
            <input ref={urlRef} className="cs-input" type="url" inputMode="url" autoComplete="off" autoCapitalize="off" spellCheck={false}
              placeholder="Dán liên kết YouTube, TikTok hoặc Facebook"
              value={url} maxLength={2100}
              onChange={e => setUrl(e.target.value)}
              onBlur={() => setUrlTouched(true)}
              onPaste={() => setUrlTouched(true)}
              aria-invalid={showVideoError}
              aria-describedby="cs-video-status"
              disabled={submitting} />
            <span id="cs-video-status" className={'cs-field-status' + (showVideoError ? ' is-error' : media ? ' is-ok' : '')} aria-live="polite">
              {showVideoError ? (check.ok ? '' : check.videoError)
                : media ? <><CheckCircle2 size={15} /> {recognizedText(media)}</>
                : null}
            </span>
          </label>

          {media && (
            <div className="cs-composer-preview">
              <ExternalMediaView media={media} title="Xem trước video bài tập" />
            </div>
          )}

          <label className="cs-field">
            <span className="cs-field-label">Ghi chú cho Thầy <span className="cs-field-optional">(không bắt buộc)</span></span>
            <textarea className="cs-input cs-textarea" rows={3}
              placeholder="Ví dụ: Em gửi bài này Thầy xem giúp. Đoạn 1:20 em chưa chắc nhịp, Thầy góp ý giúp em ạ."
              value={body} maxLength={MAX_BODY} onChange={e => setBody(e.target.value)} disabled={submitting} />
            {remaining < 200 && <span className="cs-field-hint">Còn {remaining} ký tự</span>}
          </label>

          {error && <p className="cs-form-error" role="alert">{error}</p>}

          <footer className="cs-composer-modal-foot">
            <button type="button" className="cs-btn cs-btn-ghost" onClick={onClose} disabled={submitting}>Huỷ</button>
            <button type="submit" className="cs-btn cs-btn-primary" disabled={submitting || !check.ok} aria-busy={submitting}>
              {submitting ? 'Đang gửi…' : 'Trả bài'}
            </button>
          </footer>
        </form>
      </div>
    </>
  )
}
