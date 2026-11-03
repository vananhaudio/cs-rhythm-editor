// Thầy phản hồi một thread: viết nhận xét / trả lời, tuỳ chọn kết luận "Cần làm lại" hoặc "Đạt".
// Thẻ kiến thức + bài giảng Kho dùng lại picker của Social (chỉ khi allowKho — Kho proxy chỉ có trên class.*).
// Quyền thật do server kiểm (lt_respond chỉ chạy với teacher/admin).
import { useEffect, useRef, useState } from 'react'
import { BookOpen, Hash } from 'lucide-react'
import type { ResourceRef, Tag } from '../class-social/comments/commentModel'
import ResourceCard from '../class-social/sections/comments/ResourceCard'
import TagPicker from '../class-social/sections/comments/TagPicker'
import KhoResourcePicker from '../class-social/sections/comments/KhoResourcePicker'
import { MEDIA_ERROR_TEXT, parseExternalMedia } from '../class-social/media/parseExternalMedia'
import { respondAsTeacher } from './ltApi'
import { MAX_EVENT_BODY, checkBody, teacherKind, type ThreadEvent, type Verdict } from './ltModel'

export default function TeacherComposer({ threadId, events, allowKho, onSent, respond = respondAsTeacher, isCheckpoint = false, miraDraft = null, onMiraDraftHandled }: {
  threadId: string
  events: Pick<ThreadEvent, 'authorRole' | 'kind'>[]
  allowKho: boolean
  onSent: () => void
  respond?: typeof respondAsTeacher
  /** bài trả checkpoint trong giáo trình lớp: Đạt đủ bài bắt buộc → server hoàn thành buổi + mở buổi kế */
  isCheckpoint?: boolean
  /** Nháp từ Mira (đã kiểm ở khung Mira). CHỈ điền vào ô soạn; không tự gửi. n đổi = có nháp mới. */
  miraDraft?: { n: number; text: string } | null
  /** Ô soạn đã nhận nháp n (điền hoặc đang chờ xác nhận) → nơi giữ nháp bỏ nó đi, remount không điền lại */
  onMiraDraftHandled?: (n: number) => void
}) {
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('')
  const [tags, setTags] = useState<Tag[]>([])
  const [resources, setResources] = useState<ResourceRef[]>([])
  const [picker, setPicker] = useState<'tags' | 'kho' | null>(null)
  const [sending, setSending] = useState<Verdict | 'none' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  // Nháp Mira: ô trống → điền ngay; ô đã có chữ → hỏi xác nhận (Giữ nguyên / Thay). Không bao giờ gọi respond().
  const [pending, setPending] = useState<string | null>(null)
  const [fromMira, setFromMira] = useState(false)
  const bodyRef = useRef(body)
  useEffect(() => { bodyRef.current = body }, [body])
  const taRef = useRef<HTMLTextAreaElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const seenDraft = useRef(0)
  const show = () => {   // đưa Thầy về ô phản hồi: cuộn vào giữa màn hình + đặt con trỏ
    boxRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    taRef.current?.focus({ preventScroll: true })
  }
  const applyDraft = (text: string) => { setBody(text); setError(null); setPending(null); setFromMira(true); show() }
  useEffect(() => {
    if (!miraDraft || miraDraft.n === seenDraft.current) return
    seenDraft.current = miraDraft.n
    if (inFlight.current) { onMiraDraftHandled?.(miraDraft.n); return }   // đang gửi: không đụng vào ô
    onMiraDraftHandled?.(miraDraft.n)
    if (!bodyRef.current.trim()) applyDraft(miraDraft.text)
    else { setPending(miraDraft.text); show() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miraDraft])

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
    setBody(''); setUrl(''); setTags([]); setResources([]); setPicker(null); setPending(null); setFromMira(false)
    onSent()
  }

  const busy = sending !== null
  return (
    <div className="lt-compose" aria-label="Thầy phản hồi" ref={boxRef}>
      <h3>Thầy phản hồi</h3>
      <label className="lt-field">
        <span>Nhận xét / trả lời</span>
        <textarea ref={taRef} className="lt-input" rows={4} maxLength={MAX_EVENT_BODY} value={body} disabled={busy}
          placeholder="Nhận xét phần thực hành hoặc trả lời câu hỏi của học sinh…"
          onChange={e => { setBody(e.target.value); setFromMira(false); if (error) setError(null) }} />
      </label>
      {pending !== null && (
        <div className="lt-note" role="alertdialog" aria-label="Thay nội dung bằng nháp của Mira">
          <p style={{ margin: '0 0 6px' }}>Ô phản hồi đang có chữ. Thay bằng nháp vừa nhận từ Mira?</p>
          <div className="lt-actions">
            <button type="button" className="lt-btn is-primary" onClick={() => applyDraft(pending)}>Thay bằng nháp của Mira</button>
            <button type="button" className="lt-btn is-ghost" onClick={() => { setPending(null); taRef.current?.focus({ preventScroll: true }) }}>Giữ nguyên</button>
          </div>
        </div>
      )}
      {fromMira && pending === null && <p className="lt-note" role="status">Đã điền nháp từ Mira. Thầy xem lại và sửa; chưa gửi cho học viên.</p>}
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
      <p className="lt-note">{isCheckpoint
        ? '"Đạt" ghi kết quả bài trả này. Khi mọi bài trả bắt buộc của buổi đã Đạt, buổi được hoàn thành và buổi tiếp theo tự mở cho học viên.'
        : '"Đạt" chỉ ghi kết quả vào cuộc trao đổi — chưa tự hoàn thành bài hay mở bài tiếp theo.'}</p>
    </div>
  )
}
