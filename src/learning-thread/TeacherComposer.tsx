// Thầy phản hồi một thread: viết nhận xét / trả lời, tuỳ chọn kết luận "Cần làm lại" hoặc "Đạt".
// Thẻ kiến thức + bài giảng Kho dùng lại picker của Social (chỉ khi allowKho — Kho proxy chỉ có trên class.*).
// Quyền thật do server kiểm (lt_respond chỉ chạy với teacher/admin).
import { useRef, useState } from 'react'
import { BookOpen, Hash } from 'lucide-react'
import type { ResourceRef, Tag } from '../class-social/comments/commentModel'
import ResourceCard from '../class-social/sections/comments/ResourceCard'
import TagPicker from '../class-social/sections/comments/TagPicker'
import KhoResourcePicker from '../class-social/sections/comments/KhoResourcePicker'
import { MEDIA_ERROR_TEXT, parseExternalMedia } from '../class-social/media/parseExternalMedia'
import { respondAsTeacher } from './ltApi'
import { MAX_EVENT_BODY, checkBody, teacherKind, type ThreadEvent, type Verdict } from './ltModel'

export default function TeacherComposer({ threadId, events, allowKho, onSent, respond = respondAsTeacher }: {
  threadId: string
  events: Pick<ThreadEvent, 'authorRole' | 'kind'>[]
  allowKho: boolean
  onSent: () => void
  respond?: typeof respondAsTeacher
}) {
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('')
  const [tags, setTags] = useState<Tag[]>([])
  const [resources, setResources] = useState<ResourceRef[]>([])
  const [picker, setPicker] = useState<'tags' | 'kho' | null>(null)
  const [sending, setSending] = useState<Verdict | 'none' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  const send = async (verdict: Verdict | null) => {
    if (inFlight.current) return
    const parsed = url.trim() ? parseExternalMedia(url) : null
    if (parsed && !parsed.ok) { setError(MEDIA_ERROR_TEXT[parsed.error]); return }
    const chk = checkBody(body, !!parsed)
    if (!chk.ok) { setError(chk.error); return }
    inFlight.current = true; setSending(verdict ?? 'none'); setError(null)
    const r = await respond({
      threadId, kind: teacherKind(verdict, events), body: chk.body, verdict, mediaUrl: url,
      tagIds: tags.map(t => t.id), resources,
    })
    inFlight.current = false; setSending(null)
    if (!r.ok) { setError(r.message); return }
    setBody(''); setUrl(''); setTags([]); setResources([]); setPicker(null)
    onSent()
  }

  const busy = sending !== null
  return (
    <div className="lt-compose" aria-label="Thầy phản hồi">
      <h3>Thầy phản hồi</h3>
      <label className="lt-field">
        <span>Nhận xét / trả lời</span>
        <textarea className="lt-input" rows={4} maxLength={MAX_EVENT_BODY} value={body} disabled={busy}
          placeholder="Nhận xét phần thực hành hoặc trả lời câu hỏi của học sinh…"
          onChange={e => { setBody(e.target.value); if (error) setError(null) }} />
      </label>
      <label className="lt-field">
        <span>Video minh hoạ <small>(không bắt buộc)</small></span>
        <input className="lt-input" type="url" inputMode="url" autoComplete="off" spellCheck={false} value={url} disabled={busy}
          placeholder="Dán liên kết YouTube…" onChange={e => { setUrl(e.target.value); if (error) setError(null) }} />
      </label>
      {allowKho && (
        <>
          {(tags.length > 0 || resources.length > 0) && (
            <div className="cs-cmt-attached">
              {tags.length > 0 && (
                <ul className="cs-tags" aria-label="Thẻ đã chọn">
                  {tags.map(t => (
                    <li key={t.id}><button type="button" className="cs-tag cs-tag-btn" onClick={() => setTags(ts => ts.filter(x => x.id !== t.id))}>#{t.name} ✕</button></li>
                  ))}
                </ul>
              )}
              {resources.map((r, i) => <ResourceCard key={r.resourceId + i} res={r} onRemove={() => setResources(rs => rs.filter((_, j) => j !== i))} />)}
            </div>
          )}
          <div className="cs-cmt-tools">
            <button type="button" className="cs-tool-btn" aria-expanded={picker === 'tags'} disabled={busy || tags.length >= 10}
              onClick={() => setPicker(p => (p === 'tags' ? null : 'tags'))}><Hash size={15} /> Gắn thẻ</button>
            <button type="button" className="cs-tool-btn" disabled={busy || resources.length >= 5} onClick={() => setPicker('kho')}>
              <BookOpen size={15} /> Đính kèm bài giảng
            </button>
          </div>
          {picker === 'tags' && (
            <TagPicker selected={tags} onClose={() => setPicker(null)} onAdd={t => setTags(ts => (ts.some(x => x.id === t.id) ? ts : [...ts, t].slice(0, 10)))} />
          )}
          {picker === 'kho' && (
            <KhoResourcePicker onClose={() => setPicker(null)} onAttach={r => { setResources(rs => [...rs, r].slice(0, 5)); setPicker(null) }} />
          )}
        </>
      )}
      {error && <p className="lt-error" role="alert">{error}</p>}
      <div className="lt-compose-foot">
        <button type="button" className="lt-btn is-primary" disabled={busy || !body.trim()} onClick={() => void send(null)}>
          {sending === 'none' ? 'Đang gửi…' : 'Gửi phản hồi'}
        </button>
        <button type="button" className="lt-btn is-warn-soft" disabled={busy || !body.trim()} onClick={() => void send('retry')}>
          {sending === 'retry' ? 'Đang gửi…' : 'Cần làm lại'}
        </button>
        <button type="button" className="lt-btn is-ok-soft" disabled={busy || !body.trim()} onClick={() => void send('pass')}>
          {sending === 'pass' ? 'Đang gửi…' : 'Đạt'}
        </button>
      </div>
      <p className="lt-note">"Đạt" chỉ ghi kết quả vào cuộc trao đổi — chưa tự hoàn thành bài hay mở bài tiếp theo.</p>
    </div>
  )
}
