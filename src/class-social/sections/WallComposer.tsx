// Đăng lên tường của chính mình — kiểu "Bạn đang nghĩ gì?". Bài CHỈ bạn bè (và Thầy) xem được;
// không vào feed Cộng đồng. Link video là tuỳ chọn (cùng bộ nhận diện YouTube/TikTok/Facebook).
import { useMemo, useRef, useState } from 'react'
import { Link2, Lock } from 'lucide-react'
import ExternalMediaView from '../media/ExternalMediaView'
import { MAX_BODY, checkWallDraft } from '../posts/postModel'
import { createWallPost } from '../posts/postsApi'
import type { ClassIdentity } from '../useClassSession'
import { Avatar } from '../ui'

export default function WallComposer({ me, onPosted }: { me: ClassIdentity; onPosted: () => void }) {
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('')
  const [showLink, setShowLink] = useState(false)
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  const check = useMemo(() => checkWallDraft({ body, url }), [body, url])
  const empty = !body.trim() && !url.trim()
  const fieldError = !check.ok && touched && !empty ? (check.videoError ?? check.bodyError) : undefined

  const submit = async () => {
    if (inFlight.current) return
    setTouched(true)
    if (!check.ok) return
    inFlight.current = true
    setSubmitting(true)
    setError(null)
    const r = await createWallPost(check.insert)
    inFlight.current = false
    setSubmitting(false)
    if (!r.ok) { setError(r.message); return }
    setBody(''); setUrl(''); setShowLink(false); setTouched(false)
    onPosted()
  }

  return (
    <section className="cs-card cs-wall-composer" aria-label="Đăng lên tường">
      <form onSubmit={e => { e.preventDefault(); void submit() }} noValidate>
        <div className="cs-wall-composer-row">
          <Avatar name={me.name} url={me.avatarUrl} size={40} />
          <textarea className="cs-input cs-textarea cs-wall-input" rows={2} aria-label="Nội dung bài viết"
            placeholder={`${me.name} ơi, bạn đang nghĩ gì?`} value={body} maxLength={MAX_BODY}
            onChange={e => setBody(e.target.value)} disabled={submitting} />
        </div>
        {showLink && (
          <input className="cs-input cs-wall-link" type="url" inputMode="url" autoComplete="off" autoCapitalize="off" spellCheck={false}
            placeholder="Dán liên kết YouTube, TikTok hoặc Facebook" aria-label="Liên kết video"
            value={url} maxLength={2100} onChange={e => setUrl(e.target.value)} onBlur={() => setTouched(true)} disabled={submitting} />
        )}
        {check.ok && check.media && (
          <div className="cs-composer-preview"><ExternalMediaView media={check.media} title="Xem trước video" /></div>
        )}
        {fieldError && <p className="cs-field-status is-error" role="alert">{fieldError}</p>}
        {error && <p className="cs-form-error" role="alert">{error}</p>}
        <div className="cs-wall-composer-foot">
          <span className="cs-wall-audience"><Lock size={13} strokeWidth={2.4} aria-hidden="true" />Chỉ bạn bè và Thầy xem được</span>
          {!showLink && (
            <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm" onClick={() => setShowLink(true)} disabled={submitting}>
              <Link2 size={15} /> Link video
            </button>
          )}
          <button type="submit" className="cs-btn cs-btn-primary cs-btn-sm" disabled={submitting || empty} aria-busy={submitting}>
            {submitting ? 'Đang đăng…' : 'Đăng'}
          </button>
        </div>
      </form>
    </section>
  )
}
