// Ô bình luận dưới mỗi bài. Học sinh: chỉ viết (plain text, giao lưu tự nhiên).
// Thầy: thêm "+ Gắn thẻ" và "+ Đính kèm bài giảng" (server vẫn kiểm quyền — học sinh gửi
// tag/đính kèm sẽ bị RLS chặn). Lỗi → GIỮ nguyên chữ đang gõ; chống gửi đúp.
import { useRef, useState } from 'react'
import { BookOpen, Hash, SendHorizontal } from 'lucide-react'
import { MAX_COMMENT, checkCommentBody, type ResourceRef, type Tag } from '../../comments/commentModel'
import { loadCommentsApi } from '../../comments/lazyApi'
import type { ClassIdentity } from '../../useClassSession'
import { Avatar } from '../../ui'
import KhoResourcePicker from './KhoResourcePicker'
import ResourceCard from './ResourceCard'
import TagPicker from './TagPicker'

export default function CommentComposer({ postId, me, onSent }: {
  postId: string
  me: ClassIdentity
  onSent: () => Promise<unknown> | void
}) {
  const [body, setBody] = useState('')
  const [tags, setTags] = useState<Tag[]>([])
  const [resources, setResources] = useState<ResourceRef[]>([])
  const [picker, setPicker] = useState<'tags' | 'kho' | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const teacher = me.isTeacher

  const submit = async () => {
    if (inFlight.current) return
    const chk = checkCommentBody(body)
    if (!chk.ok) { setError(chk.error); return }
    inFlight.current = true; setSending(true); setError(null)
    const { addComment } = await loadCommentsApi()
    const r = await addComment({ postId, body: chk.body, tagIds: teacher ? tags.map(t => t.id) : [], resources: teacher ? resources : [] })
    inFlight.current = false; setSending(false)
    if (!r.ok) { setError(r.message); return }          // giữ nguyên nội dung để gửi lại
    setBody(''); setTags([]); setResources([]); setPicker(null)
    await onSent()
  }

  const id = `cs-cmt-input-${postId}`
  return (
    <div className="cs-cmt-composer">
      <Avatar name={me.name} url={me.avatarUrl} size={34} />
      <form className="cs-cmt-form" onSubmit={e => { e.preventDefault(); void submit() }}>
        <label htmlFor={id} className="cs-sr-only">{teacher ? 'Nhận xét hoặc bình luận' : 'Viết bình luận'}</label>
        <div className="cs-cmt-inputwrap">
          <textarea id={id} className="cs-cmt-input" rows={1} maxLength={MAX_COMMENT}
            placeholder={teacher ? 'Viết nhận xét…' : 'Viết bình luận...'}
            value={body} disabled={sending}
            onChange={e => { setBody(e.target.value); if (error) setError(null) }}
            onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 180) + 'px' }}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submit() } }} />
          <button type="submit" className="cs-cmt-send" disabled={sending || !body.trim()} aria-label="Gửi bình luận">
            <SendHorizontal size={18} />
          </button>
        </div>

        {teacher && (tags.length > 0 || resources.length > 0) && (
          <div className="cs-cmt-attached">
            {tags.length > 0 && (
              <ul className="cs-tags" aria-label="Tag đã chọn">
                {tags.map(t => (
                  <li key={t.id}>
                    <button type="button" className="cs-tag cs-tag-btn" aria-label={`Bỏ tag ${t.name}`}
                      onClick={() => setTags(ts => ts.filter(x => x.id !== t.id))}>#{t.name} ✕</button>
                  </li>
                ))}
              </ul>
            )}
            {resources.map((r, i) => (
              <ResourceCard key={r.resourceId + i} res={r} onRemove={() => setResources(rs => rs.filter((_, j) => j !== i))} />
            ))}
          </div>
        )}

        {teacher && (
          <div className="cs-cmt-tools">
            <button type="button" className="cs-tool-btn" aria-expanded={picker === 'tags'}
              onClick={() => setPicker(p => p === 'tags' ? null : 'tags')} disabled={sending || tags.length >= 10}>
              <Hash size={15} /> Gắn thẻ
            </button>
            <button type="button" className="cs-tool-btn" onClick={() => setPicker('kho')} disabled={sending || resources.length >= 5}>
              <BookOpen size={15} /> Đính kèm bài giảng
            </button>
          </div>
        )}
        {teacher && picker === 'tags' && (
          <TagPicker selected={tags} onClose={() => setPicker(null)}
            onAdd={t => setTags(ts => ts.some(x => x.id === t.id) ? ts : [...ts, t].slice(0, 10))} />
        )}
        {error && <p className="cs-form-error" role="alert">{error}</p>}
      </form>
      {teacher && picker === 'kho' && (
        <KhoResourcePicker onClose={() => setPicker(null)}
          onAttach={r => { setResources(rs => [...rs, r].slice(0, 5)); setPicker(null) }} />
      )}
    </div>
  )
}
