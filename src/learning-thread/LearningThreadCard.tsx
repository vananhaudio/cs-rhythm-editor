// Thẻ "câu chuyện học tập" trên Feed / Tường (/me). MỘT thread = MỘT thẻ; không bung toàn bộ event.
// AI · ĐANG HỌC GÌ (danh tính lịch sử) · BÀI NÀO · CHUYỆN GÌ VỪA XẢY RA · TRẠNG THÁI → [Xem cuộc trao đổi].
// Component lá (không import CSS) — CSS .lt-* nạp ở container (MeHome / ProfilePage qua ./styles).
import { relativeTime } from '../class-social/posts/postModel'
import { Avatar, PersonLink } from '../class-social/ui'
import { VISIBILITY_LABEL, identityLine, lessonLine } from './ltModel'
import { originBadge, storyLine, type ThreadCard } from './feedModel'
import { StatusChip } from './ThreadView'

export default function LearningThreadCard({ card, now, onOpenThread, onOpenProfile }: {
  card: ThreadCard
  now?: Date
  onOpenThread?: (threadId: string) => void
  onOpenProfile?: (userId: string) => void
}) {
  const badge = originBadge(card)
  const story = storyLine(card)
  const learner = card.learner
  const avatar = <Avatar name={learner.name} url={learner.avatarUrl} size={42} />
  return (
    <article className="cs-card cs-post lt-feed-card" aria-label={`${badge.label} của ${learner.name}: ${card.identity.lesson.title}`}>
      <header className="cs-post-head">
        {learner.userId ? <PersonLink userId={learner.userId} onOpen={onOpenProfile} label={`Trang cá nhân của ${learner.name}`}>{avatar}</PersonLink> : avatar}
        <div className="cs-post-meta">
          <div className="cs-post-line">
            {learner.userId
              ? <PersonLink userId={learner.userId} onOpen={onOpenProfile} label={`Trang cá nhân của ${learner.name}`} className="cs-post-author">{learner.name}</PersonLink>
              : <span className="cs-post-author">{learner.name}</span>}
            <span className="lt-feed-identity">{identityLine(card.identity)}</span>
            {card.visibility === 'private' && <span className="cs-post-audience">{VISIBILITY_LABEL.private}</span>}
          </div>
          <time className="cs-post-time" dateTime={card.lastEventAt}>{relativeTime(card.lastEventAt, now)}</time>
        </div>
      </header>
      <div className="lt-feed-body">
        <div className="lt-feed-kind">{badge.icon} {badge.label}</div>
        <div className="lt-feed-lesson">{lessonLine(card.identity)}</div>
        {story && (
          <p className="lt-feed-story">
            <b>{story.actor.name}</b> {story.text}
          </p>
        )}
        {story?.resourceNote && <p className="lt-feed-note">📘 {story.resourceNote}</p>}
        <div className="lt-feed-foot">
          <StatusChip status={card.status} />
          {onOpenThread && (
            <button type="button" className="lt-btn is-primary lt-feed-open" onClick={() => onOpenThread(card.id)}>Xem cuộc trao đổi</button>
          )}
        </div>
      </div>
    </article>
  )
}
