// Một bài đăng trong feed cộng đồng. Chưa có reaction/share → KHÔNG render nút giả.
// Nội dung là plain text: React tự escape, xuống dòng giữ bằng CSS (pre-wrap).
import ExternalMediaView from '../media/ExternalMediaView'
import { POST_TYPE_LABEL, relativeTime, type FeedPost } from '../posts/postModel'
import type { PostComments } from '../comments/useFeedComments'
import type { ClassIdentity } from '../useClassSession'
import { Avatar, MoreMenu } from '../ui'
import CommentsSection from './comments/CommentsSection'

export type PostSocial = {
  me: ClassIdentity | null
  comments: Record<string, PostComments>
  onRefreshComments: (postId: string) => Promise<unknown>
  onExpandComments: (postId: string) => Promise<unknown>
  onModeratePost: (post: FeedPost, hidden: boolean) => void
}

export default function PostCard({ post, now, social }: { post: FeedPost; now?: Date; social?: PostSocial }) {
  const { author } = post
  const when = new Date(post.createdAt)
  const canModerate = !!social?.me?.isTeacher
  return (
    <article className={'cs-card cs-post' + (post.isHidden ? ' is-hidden' : '')} aria-label={`${POST_TYPE_LABEL[post.type]} của ${author.name}`}>
      <header className="cs-post-head">
        <Avatar name={author.name} url={author.avatarUrl} size={42} />
        <div className="cs-post-meta">
          <div className="cs-post-line">
            <span className="cs-post-author">{author.name}</span>
            {author.isTeacher && <span className="cs-post-role">Giáo viên</span>}
            <span className={`cs-post-type is-${post.type}`}>{POST_TYPE_LABEL[post.type]}</span>
          </div>
          <time className="cs-post-time" dateTime={post.createdAt}
            title={Number.isNaN(when.getTime()) ? undefined : when.toLocaleString('vi-VN')}>
            {relativeTime(post.createdAt, now)}
          </time>
        </div>
        {canModerate && social && (
          <MoreMenu label="Tuỳ chọn bài" items={[{
            label: post.isHidden ? 'Bỏ ẩn bài' : 'Ẩn bài',
            onSelect: () => social.onModeratePost(post, !post.isHidden),
          }]} />
        )}
      </header>
      {post.isHidden && <p className="cs-post-hidden">Bài đã bị ẩn — học sinh không thấy bài này.</p>}
      {/* Trả bài: VIDEO là đối tượng chính, ghi chú cho Thầy đi kèm */}
      {post.media && (
        <div className="cs-post-media">
          <ExternalMediaView media={post.media} title={`Video ${POST_TYPE_LABEL[post.type].toLowerCase()} của ${author.name}`} />
        </div>
      )}
      {post.body && (
        <div className="cs-post-note">
          {post.type === 'assignment' && <span className="cs-post-note-label">Ghi chú cho Thầy</span>}
          <p className="cs-post-body">{post.body}</p>
        </div>
      )}
      {social && (
        <CommentsSection postId={post.id} total={post.commentCount} state={social.comments[post.id]} me={social.me} now={now}
          onRefresh={social.onRefreshComments} onExpand={social.onExpandComments} />
      )}
    </article>
  )
}
