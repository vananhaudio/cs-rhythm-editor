// Home /me — ô chia sẻ âm nhạc nhẹ: [avatar] "Chia sẻ điều gì về âm nhạc…" + vài gợi ý nhỏ.
// DÙNG LẠI bài 'status' của tường (checkWallDraft/createWallPost) — không hệ bài đăng thứ hai. Bài chỉ bạn bè + Thầy xem
// (đúng luật Bạn bè + Tường); hiện ngay trên Home của mình và bạn bè (social_feed "Dành cho bạn").
// Trả bài có cấu trúc nên bắt đầu từ ĐÚNG bài trong App học; "Trả bài bằng link video" (hệ cũ) chỉ còn là lối phụ.
import { useMemo, useRef, useState } from 'react'
import { Link2, Lock, Upload } from 'lucide-react'
import ExternalMediaView from '../media/ExternalMediaView'
import { MAX_BODY, checkWallDraft } from '../posts/postModel'
import { createWallPost } from '../posts/postsApi'
import type { ClassIdentity } from '../useClassSession'
import { Avatar, PersonLink } from '../ui'
import AssignmentComposer from './AssignmentComposer'
import { SHARE_PROMPTS } from '../posts/sharePrompts'


export default function HomeComposer({ me, onPosted, onOpenProfile }: {
  me: ClassIdentity
  onPosted: () => void
  onOpenProfile?: (userId: string) => void
}) {
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('')
  const [open, setOpen] = useState(false)
  const [showLink, setShowLink] = useState(false)
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const inFlight = useRef(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const check = useMemo(() => checkWallDraft({ body, url }), [body, url])
  const empty = !body.trim() && !url.trim()
  const fieldError = !check.ok && touched && !empty ? (check.videoError ?? check.bodyError) : undefined

  const prompt = (prefix: string) => {
    setOpen(true)
    setBody(b => (b.trim() ? b : prefix))
    requestAnimationFrame(() => { const t = inputRef.current; if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length) } })
  }

  const submit = async () => {
    if (inFlight.current) return
    setTouched(true)
    if (!check.ok) return
    inFlight.current = true; setSubmitting(true); setError(null)
    const r = await createWallPost(check.insert)
    inFlight.current = false; setSubmitting(false)
    if (!r.ok) { setError(r.message); return }
    setBody(''); setUrl(''); setShowLink(false); setTouched(false); setOpen(false)
    onPosted()
  }

  return (
    <section className="cs-card cs-share" aria-label="Chia sẻ về âm nhạc">
      <form onSubmit={e => { e.preventDefault(); void submit() }} noValidate>
        <div className="cs-share-row">
          <PersonLink userId={me.userId} onOpen={onOpenProfile} label="Trang cá nhân của tôi">
            <Avatar name={me.name} url={me.avatarUrl} size={40} />
          </PersonLink>
          <textarea ref={inputRef} className={'cs-share-input' + (open ? ' is-open' : '')} rows={open ? 3 : 1} aria-label="Chia sẻ điều gì về âm nhạc"
            placeholder="Chia sẻ điều gì về âm nhạc…" value={body} maxLength={MAX_BODY}
            onFocus={() => setOpen(true)} onChange={e => setBody(e.target.value)} disabled={submitting} />
        </div>
        {open && showLink && (
          <input className="cs-input cs-wall-link" type="url" inputMode="url" autoComplete="off" autoCapitalize="off" spellCheck={false}
            placeholder="Dán liên kết YouTube, TikTok hoặc Facebook" aria-label="Liên kết video"
            value={url} maxLength={2100} onChange={e => setUrl(e.target.value)} onBlur={() => setTouched(true)} disabled={submitting} />
        )}
        {open && check.ok && check.media && (
          <div className="cs-composer-preview"><ExternalMediaView media={check.media} title="Xem trước video" /></div>
        )}
        {fieldError && <p className="cs-field-status is-error" role="alert">{fieldError}</p>}
        {error && <p className="cs-form-error" role="alert">{error}</p>}
        <div className="cs-share-prompts">
          {SHARE_PROMPTS.map(p => (
            <button key={p.label} type="button" className="cs-share-chip" onClick={() => prompt(p.prefix)} disabled={submitting}>
              <span aria-hidden="true">{p.icon}</span> {p.label}
            </button>
          ))}
          {open && !showLink && (
            <button type="button" className="cs-share-chip" onClick={() => setShowLink(true)} disabled={submitting}>
              <Link2 size={14} /> Link video
            </button>
          )}
        </div>
        {open && (
          <div className="cs-share-foot">
            <span className="cs-wall-audience"><Lock size={13} strokeWidth={2.4} aria-hidden="true" />Bạn bè và Thầy xem được</span>
            <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm" onClick={() => { setOpen(false); setShowLink(false) }} disabled={submitting}>Để sau</button>
            <button type="submit" className="cs-btn cs-btn-primary cs-btn-sm" disabled={submitting || empty} aria-busy={submitting}>
              {submitting ? 'Đang đăng…' : 'Đăng'}
            </button>
          </div>
        )}
      </form>
      <button type="button" className="cs-share-legacy" onClick={() => setAssignOpen(true)}>
        <Upload size={14} aria-hidden="true" /> Trả bài bằng link video
      </button>
      {assignOpen && <AssignmentComposer me={me} onClose={() => setAssignOpen(false)} onPosted={() => { setAssignOpen(false); onPosted() }} />}
    </section>
  )
}
