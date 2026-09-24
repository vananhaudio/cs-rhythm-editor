// Một bình luận. Nhận xét của Thầy: badge THẦY + nền tím rất nhẹ + tag + bài giảng đính kèm.
// Không đổi thứ tự bình luận theo vai trò. Nội dung plain text (React escape, pre-wrap).
import type { Comment } from '../../comments/commentModel'
import { relativeTime } from '../../posts/postModel'
import { Avatar, MoreMenu } from '../../ui'
import ResourceCard from './ResourceCard'

export default function CommentItem({ c, canModerate, now, onDelete, onModerate }: {
  c: Comment
  canModerate: boolean
  now?: Date
  onDelete: (c: Comment) => void
  onModerate: (c: Comment, hidden: boolean) => void
}) {
  const teacher = c.author.isTeacher
  const menu = [
    ...(c.isMine ? [{ label: 'Xoá bình luận', danger: true, onSelect: () => onDelete(c) }] : []),
    ...(canModerate && !c.isMine ? [{ label: c.isHidden ? 'Bỏ ẩn bình luận' : 'Ẩn bình luận', onSelect: () => onModerate(c, !c.isHidden) }] : []),
  ]
  return (
    <li className={'cs-cmt' + (teacher ? ' is-teacher' : '') + (c.isHidden ? ' is-hidden' : '')}>
      <Avatar name={c.author.name} url={c.author.avatarUrl} size={34} />
      <div className="cs-cmt-main">
        <div className="cs-cmt-bubble">
          <div className="cs-cmt-head">
            <span className="cs-cmt-author">{c.author.name}</span>
            {teacher && <span className="cs-cmt-badge" title="Nhận xét của giáo viên">Thầy</span>}
            {c.isHidden && <span className="cs-cmt-hidden">Đã ẩn · học sinh không thấy</span>}
          </div>
          <p className="cs-cmt-body">{c.body}</p>
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
        <div className="cs-cmt-meta">
          <time dateTime={c.createdAt}>{relativeTime(c.createdAt, now)}</time>
          <MoreMenu label="Tuỳ chọn bình luận" items={menu} />
        </div>
      </div>
    </li>
  )
}
