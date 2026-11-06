// Một bình luận. Nhận xét của Thầy: badge THẦY + nền tím rất nhẹ + tag + bài giảng đính kèm.
// Không đổi thứ tự bình luận theo vai trò. Nội dung plain text (React escape, pre-wrap).
import type { Comment } from '../../comments/commentModel'
import { relativeTime } from '../../posts/postModel'
import { Avatar, MoreMenu, PersonLink } from '../../ui'
import CommentAuthorLine from './CommentAuthorLine'
import ResourceCard from './ResourceCard'
import ExpandableText from '../ExpandableText'
import { Composer } from './TargetComments'
import SafetyMenu from '../../../class-safety/SafetyMenu'
import { useIsBlocked } from '../../../class-safety/blockedStore'

export default function CommentItem({ c, canModerate, now, onDelete, onModerate, onOpenProfile, editing, onEdit, onEditDone, saveEdit }: {
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
  if (blocked && !c.isMine) return null
  const menu = [
    ...(c.isMine && onEdit ? [{ label: 'Sửa bình luận', onSelect: onEdit }] : []),
    ...(c.isMine ? [{ label: 'Xoá bình luận', danger: true, onSelect: () => onDelete(c) }] : []),
    ...(canModerate && !c.isMine ? [{ label: c.isHidden ? 'Bỏ ẩn bình luận' : 'Ẩn bình luận', onSelect: () => onModerate(c, !c.isHidden) }] : []),
  ]
  return (
    <li className={'cs-cmt' + (teacher ? ' is-teacher' : '') + (c.isHidden ? ' is-hidden' : '')} data-comment-id={c.id}>
      <PersonLink userId={c.author.userId} onOpen={onOpenProfile} label={`Trang cá nhân của ${c.author.name}`}>
        <Avatar name={c.author.name} url={c.author.avatarUrl} size={32} />
      </PersonLink>
      <div className="cs-cmt-main">
        {editing && saveEdit ? (
          <Composer idBase={`cs-edit-${c.id}`} placeholder="Sửa bình luận…" initial={c.body} submitLabel="Lưu bình luận" me={null} autoFocus
            onSubmit={async b => { const e = await saveEdit(b); if (!e) onEditDone?.(); return e }} onCancel={onEditDone} />
        ) : (
        <div className="cs-cmt-bubble">
          <CommentAuthorLine userId={c.author.userId} name={c.author.name} isTeacher={teacher} hidden={c.isHidden} onOpenProfile={onOpenProfile} />
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
          {c.isMine
            ? <MoreMenu label="Tuỳ chọn bình luận" items={menu} />
            : <SafetyMenu label="Tuỳ chọn bình luận" kind="comment" targetId={c.id} userId={c.author.userId} userName={c.author.name} extraItems={menu} />}
        </div>
      </div>
    </li>
  )
}
