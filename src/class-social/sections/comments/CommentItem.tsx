// Một bình luận. Nhận xét của Thầy: badge THẦY + nền tím rất nhẹ + tag + bài giảng đính kèm.
// Không đổi thứ tự bình luận theo vai trò. Nội dung plain text (React escape, pre-wrap).
import type { ReactNode } from 'react'
import type { Comment } from '../../comments/commentModel'
import { relativeTime } from '../../posts/postModel'
import { Avatar, MoreMenu, PersonLink } from '../../ui'
import ResourceCard from './ResourceCard'
import { IdentityBadges } from '../../identity/IdentityBadges'
import ExpandableText from '../ExpandableText'
import { Composer } from './TargetComments'
import SafetyMenu from '../../../class-safety/SafetyMenu'
import { useIsBlocked } from '../../../class-safety/blockedStore'

export default function CommentItem({ c, canModerate, now, onDelete, onModerate, onOpenProfile, editing, onEdit, onEditDone, saveEdit, isReply, replyToName, orphan, onReply, children }: {
  isReply?: boolean
  /** Trả lời một câu trả lời: tên người được phản hồi (từ dữ liệu parent, không nằm trong nội dung). */
  replyToName?: string | null
  /** Bình luận gốc của nhóm này chưa được tải. */
  orphan?: boolean
  onReply?: (c: Comment) => void
  /** Phần dưới bình luận (danh sách trả lời + ô trả lời) — nằm trong cùng mục. */
  children?: ReactNode
  editing?: boolean
  onEdit?: () => void
  onEditDone?: () => void
  saveEdit?: (body: string) => Promise<string | null>
  c: Comment
  onOpenProfile?: (userId: string) => void
  canModerate: boolean
  now?: Date
  onDelete: (c: Comment) => void
  onModerate: (c: Comment, hidden: boolean) => void
}) {
  const teacher = c.author.isTeacher
  const blocked = useIsBlocked(c.author.userId)
  if (blocked && !c.isMine) {
    // Giữ nguyên hành vi ẩn người bị chặn, nhưng không làm mất các trả lời của người khác bên dưới.
    return children ? <li className="cs-cmt-blockednote"><p className="cs-cmts-empty">Bình luận của người bạn đã chặn.</p>{children}</li> : null
  }
  const menu = [
    ...(c.isMine && onEdit ? [{ label: 'Sửa bình luận', onSelect: onEdit }] : []),
    ...(c.isMine ? [{ label: 'Xoá bình luận', danger: true, onSelect: () => onDelete(c) }] : []),
    ...(canModerate && !c.isMine ? [{ label: c.isHidden ? 'Bỏ ẩn bình luận' : 'Ẩn bình luận', onSelect: () => onModerate(c, !c.isHidden) }] : []),
  ]
  return (
    <li className={'cs-cmt-node'} data-comment-id={c.id}>
    <div className={'cs-cmt' + (teacher ? ' is-teacher' : '') + (c.isHidden ? ' is-hidden' : '') + (isReply ? ' is-reply' : '')}>
      <PersonLink userId={c.author.userId} onOpen={onOpenProfile} label={`Trang cá nhân của ${c.author.name}`}>
        <Avatar name={c.author.name} url={c.author.avatarUrl} size={32} />
      </PersonLink>
      <div className="cs-cmt-main">
        {editing && saveEdit ? (
          <Composer idBase={`cs-edit-${c.id}`} placeholder="Sửa bình luận…" initial={c.body} submitLabel="Lưu bình luận" me={null} autoFocus
            onSubmit={async b => { const e = await saveEdit(b); if (!e) onEditDone?.(); return e }} onCancel={onEditDone} />
        ) : (
        <div className="cs-cmt-bubble">
          {(replyToName || orphan) && (
            <p className="cs-replyto">{replyToName ? <>↪ Trả lời <strong>{replyToName}</strong></> : 'Trả lời một bình luận không hiển thị ở đây'}</p>
          )}
          <div className="cs-cmt-head">
            <PersonLink userId={c.author.userId} onOpen={onOpenProfile} label={`Trang cá nhân của ${c.author.name}`} className="cs-cmt-author">
              {c.author.name}
            </PersonLink>
            {teacher ? <span className="cs-cmt-badge" title="Nhận xét của giáo viên">Thầy</span> : <IdentityBadges userId={c.author.userId} max={1} />}
            {c.isHidden && <span className="cs-cmt-hidden">Đã ẩn · học sinh không thấy</span>}
          </div>
          <ExpandableText text={c.body} className="cs-cmt-body" lines={4} />
          {c.tags.length > 0 && (
            <ul className="cs-tags" aria-label="Tag kiến thức">
              {c.tags.map(t => <li key={t.id} className="cs-tag">#{t.name}</li>)}
            </ul>
          )}
          {c.resources.length > 0 && (
            <div className="cs-res-list">
              {c.resources.map(r => <ResourceCard key={r.id} res={r} />)}
            </div>
          )}
        </div>
        )}
        <div className="cs-cmt-meta">
          <time dateTime={c.createdAt}>{relativeTime(c.createdAt, now)}</time>
          {onReply && !c.isHidden && <button type="button" className="cs-link-btn cs-cmt-reply" onClick={() => onReply(c)}>Trả lời</button>}
          {c.isMine
            ? <MoreMenu label="Tuỳ chọn bình luận" items={menu} />
            : <SafetyMenu label="Tuỳ chọn bình luận" kind="comment" targetId={c.id} userId={c.author.userId} userName={c.author.name} extraItems={menu} />}
        </div>
      </div>
    </div>
    {children}
    </li>
  )
}
