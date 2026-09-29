// Học sinh Trả bài / Hỏi bài NGAY TẠI BÀI ĐANG HỌC. Không chọn khoá/bài/lớp — server đã biết từ lessonId
// và tự đóng dấu danh tính. Chỉ cần: loại (theo cấu hình bài), video (tuỳ chọn), nội dung, và lần đầu: ai được xem.
// Lỗi → GIỮ nguyên chữ đang gõ; chống gửi đúp.
import { useMemo, useRef, useState } from 'react'
import ExternalMediaView from '../class-social/media/ExternalMediaView'
import { MEDIA_ERROR_TEXT, parseExternalMedia } from '../class-social/media/parseExternalMedia'
import { submitStudentEvent } from './ltApi'
import { MAX_EVENT_BODY, VISIBILITY_HINT, VISIBILITY_LABEL, checkBody, type StudentKind, type Visibility } from './ltModel'

const KIND_TEXT: Record<StudentKind, { title: string; placeholder: string; send: string }> = {
  submission: {
    title: 'Trả bài',
    placeholder: 'Ví dụ: Em gửi phần thực hành bài này, Thầy xem giúp em đoạn đầu đã đều nhịp chưa ạ.',
    send: 'Gửi bài',
  },
  question: {
    title: 'Hỏi bài',
    placeholder: 'Bạn đang vướng ở đâu trong bài này? Viết câu hỏi cho Thầy.',
    send: 'Gửi câu hỏi',
  },
}

export default function StudentComposer({ lessonId, kinds, initialKind, isNewThread, onSent, onCancel, sendEvent = submitStudentEvent }: {
  lessonId: string
  /** loại được phép theo cấu hình bài (server vẫn kiểm lại) */
  kinds: StudentKind[]
  initialKind: StudentKind
  /** lần gửi đầu tiên → cho chọn Cộng đồng học tập / Chỉ Thầy */
  isNewThread: boolean
  onSent: (threadId: string) => void
  onCancel?: () => void
  sendEvent?: typeof submitStudentEvent
}) {
  const [kind, setKind] = useState<StudentKind>(kinds.includes(initialKind) ? initialKind : kinds[0])
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('community')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  const parsed = useMemo(() => (url.trim() ? parseExternalMedia(url) : null), [url])
  const media = parsed?.ok ? parsed.media : null
  const urlError = parsed && !parsed.ok ? MEDIA_ERROR_TEXT[parsed.error] : null
  const text = KIND_TEXT[kind]

  const submit = async () => {
    if (inFlight.current) return
    if (urlError) { setError(urlError); return }
    const chk = checkBody(body, !!media)
    if (!chk.ok) { setError(chk.error); return }
    inFlight.current = true; setSending(true); setError(null)
    const r = await sendEvent({ lessonId, kind, body: chk.body, mediaUrl: url, visibility: isNewThread ? visibility : undefined })
    inFlight.current = false; setSending(false)
    if (!r.ok) { setError(r.message); return }
    setBody(''); setUrl('')
    onSent(r.value.threadId)
  }

  return (
    <form className="lt-compose" onSubmit={e => { e.preventDefault(); void submit() }} noValidate aria-label={text.title}>
      <h3>{text.title}</h3>
      {kinds.length > 1 && (
        <div className="lt-seg" role="group" aria-label="Bạn muốn">
          {kinds.map(k => (
            <button key={k} type="button" aria-pressed={k === kind} onClick={() => setKind(k)} disabled={sending}>{KIND_TEXT[k].title}</button>
          ))}
        </div>
      )}
      <label className="lt-field">
        <span>Video / liên kết {kind === 'submission' ? 'phần thực hành' : 'minh hoạ'} <small>(không bắt buộc)</small></span>
        <input className="lt-input" type="url" inputMode="url" autoComplete="off" autoCapitalize="off" spellCheck={false}
          placeholder="Dán liên kết YouTube, TikTok hoặc Facebook" value={url} maxLength={2100}
          onChange={e => { setUrl(e.target.value); if (error) setError(null) }} disabled={sending} aria-invalid={!!urlError} />
      </label>
      {urlError && <p className="lt-error" role="alert">{urlError}</p>}
      {media && <ExternalMediaView media={media} title="Xem trước video" />}
      <label className="lt-field">
        <span>Nội dung</span>
        <textarea className="lt-input" rows={4} maxLength={MAX_EVENT_BODY} placeholder={text.placeholder}
          value={body} onChange={e => { setBody(e.target.value); if (error) setError(null) }} disabled={sending} />
      </label>
      {isNewThread && (
        <fieldset className="lt-vis" style={{ border: 'none', margin: 0, padding: 0 }}>
          <legend className="lt-field" style={{ padding: 0, marginBottom: 4 }}>Ai được xem cuộc trao đổi này?</legend>
          {(['community', 'private'] as Visibility[]).map(v => (
            <label key={v}>
              <input type="radio" name={`lt-vis-${lessonId}`} value={v} checked={visibility === v} onChange={() => setVisibility(v)} disabled={sending} />
              <span>{VISIBILITY_LABEL[v]}<small>{VISIBILITY_HINT[v]}</small></span>
            </label>
          ))}
        </fieldset>
      )}
      {error && <p className="lt-error" role="alert">{error}</p>}
      <div className="lt-compose-foot">
        {onCancel && <button type="button" className="lt-btn is-ghost" onClick={onCancel} disabled={sending}>Huỷ</button>}
        <button type="submit" className="lt-btn is-primary" disabled={sending || (!body.trim() && !media)} aria-busy={sending}>
          {sending ? 'Đang gửi…' : text.send}
        </button>
      </div>
    </form>
  )
}
