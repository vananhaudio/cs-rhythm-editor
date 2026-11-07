// Ô bình luận dưới mỗi bài. Học sinh: chỉ viết (plain text, giao lưu tự nhiên).
// Thầy: thêm "+ Gắn thẻ" và "+ Đính kèm bài giảng" (server vẫn kiểm quyền — học sinh gửi
// tag/đính kèm sẽ bị RLS chặn). Lỗi → GIỮ nguyên chữ đang gõ; chống gửi đúp.
import { useState } from 'react'
import { BookOpen, Hash } from 'lucide-react'
import { MAX_COMMENT, checkCommentBody, type ResourceRef, type Tag } from '../../comments/commentModel'
import { loadCommentsApi } from '../../comments/lazyApi'
import type { ClassIdentity } from '../../useClassSession'
import { Avatar } from '../../ui'
import KhoResourcePicker from './KhoResourcePicker'
import ResourceCard from './ResourceCard'
import TagPicker from './TagPicker'
import { CommentInputBox, revealComment, useCommentSubmit } from './ComposerInput'

export default function CommentComposer({ postId, me, onSent, parentId = null, replyingTo, onCancel }: {
  postId: string
  me: ClassIdentity
  onSent: () => Promise<unknown> | void
  /** Trả lời: id bình luận được trả lời trực tiếp (p_parent_id) + tên hiển thị "Đang trả lời …". */
  parentId?: string | null
  replyingTo?: string
  onCancel?: () => void
}) {
  const [tags, setTags] = useState<Tag[]>([])
  const [resources, setResources] = useState<ResourceRef[]>([])
  const [picker, setPicker] = useState<'tags' | 'kho' | null>(null)
  const teacher = me.isTeacher

  // Hành vi gửi dùng chung với ô bình luận thread/TeamLab (ComposerInput). Lỗi → giữ chữ + tag + đính kèm để gửi lại.
  const state = useCommentSubmit({
    check: checkCommentBody,
    run: async body => {
      const { addComment } = await loadCommentsApi()
      const r = await addComment({ postId, body, parentId, tagIds: teacher ? tags.map(t => t.id) : [], resources: teacher ? resources : [] })
      if (!r.ok) return r.message
      setTags([]); setResources([]); setPicker(null)
      await onSent()
      if (!parentId) revealComment(r.value.id)
      return null
    },
  })
  const sending = state.sending
  const id = parentId ? `cs-reply-input-${parentId}` : `cs-cmt-input-${postId}`
  const isReply = !!parentId

  return (
    <div className={'cs-cmt-composer' + (isReply ? ' is-reply' : '')}>
      <Avatar name={me.name} url={me.avatarUrl} size={32} />
      <form className="cs-cmt-form" onSubmit={e => { e.preventDefault(); void state.submit() }}
        onKeyDown={e => { if (e.key === 'Escape' && isReply && onCancel) { e.preventDefault(); onCancel() } }}>
        {isReply && (
          <p className="cs-replying" id={`${id}-to`}>
            Đang trả lời <strong>{replyingTo}</strong>
            {onCancel && <>{' · '}<button type="button" className="cs-link-btn cs-cmt-cancel" onClick={onCancel}>Huỷ</button></>}
          </p>
        )}
        <label htmlFor={id} className="cs-sr-only">{isReply ? `Trả lời ${replyingTo}` : teacher ? 'Nhận xét hoặc bình luận' : 'Viết bình luận'}</label>
        <CommentInputBox id={id} label={isReply ? 'Gửi trả lời' : 'Gửi bình luận'} autoFocus={isReply} maxLength={MAX_COMMENT} state={state}
          placeholder={isReply ? `Trả lời ${replyingTo}…` : teacher ? 'Viết nhận xét…' : 'Viết bình luận...'} />

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
      </form>
      {teacher && picker === 'kho' && (
        <KhoResourcePicker onClose={() => setPicker(null)}
          onAttach={r => { setResources(rs => [...rs, r].slice(0, 5)); setPicker(null) }} />
      )}
    </div>
  )
}
