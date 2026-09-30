// Thẻ "câu chuyện học tập" trên Feed / Tường (/me). MỘT thread = MỘT thẻ; không bung toàn bộ event.
// Đọc 2–4 giây là hiểu: AI (+ danh tính ngắn, nhỏ) · ❓/🎸 LOẠI · BÀI NÀO · (Thầy vừa làm gì) · TRẠNG THÁI → [Xem cuộc trao đổi].
// Ngữ cảnh sâu (khoá, lớp đầy đủ) nằm ở /me/t/<id>. Component lá (không import CSS) — CSS .lt-* nạp ở container.
import { relativeTime } from '../class-social/posts/postModel'
import { Avatar, PersonLink } from '../class-social/ui'
import { VISIBILITY_LABEL, identityLine, moduleLabel } from './ltModel'
import { originBadge, storyLine, type ThreadCard } from './feedModel'
import { StatusChip } from './ThreadView'
import { IdentityBadges } from '../class-social/identity/IdentityBadges'

export default function LearningThreadCard({ card, now, onOpenThread, onOpenProfile, inClass = false }: {
  card: ThreadCard
  now?: Date
  onOpenThread?: (threadId: string) => void
  onOpenProfile?: (userId: string) => void
  /** Trong trang lớp: bỏ nhãn danh tính (đã rõ lớp) — không lặp mã lớp */
  inClass?: boolean
}) {
  const badge = originBadge(card)
  const story = storyLine(card)
  // Lượt đầu của chính người học đã rõ qua tên + nhãn loại → chỉ kể khi Thầy vừa phản hồi hoặc học sinh trả lại bài
  const showStory = !!story && (card.lastEvent?.authorRole === 'teacher' || card.lastEvent?.isResubmission === true)
  const learner = card.learner
  const module = moduleLabel(card.identity.module.name)
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
            <IdentityBadges userId={learner.userId} />
            {card.visibility === 'private' && <span className="cs-post-audience">{VISIBILITY_LABEL.private}</span>}
          </div>
          <div className="cs-post-sub">
            <time className="cs-post-time" dateTime={card.lastEventAt}>{relativeTime(card.lastEventAt, now)}</time>
            {!inClass && <><span aria-hidden="true">·</span><span className="lt-feed-identity">{identityLine(card.identity)}</span></>}
          </div>
        </div>
      </header>
      <div className="lt-feed-body">
        <div className={'lt-feed-kind is-' + (card.firstKind ?? 'submission')}><span aria-hidden="true">{badge.icon}</span> {badge.label}</div>
        <div className="lt-feed-lesson">{card.identity.lesson.title}</div>
        {module && <div className="lt-feed-module">{module}</div>}
        {showStory && story && (
          <p className="lt-feed-story">
            <span className="lt-feed-actor">{story.actor.name}</span> {story.text}
          </p>
        )}
        {story?.resourceNote && <p className="lt-feed-note">📘 {story.resourceNote}</p>}
        <div className="lt-feed-foot">
          <StatusChip status={card.status} social />
          {onOpenThread && (
            <button type="button" className="lt-btn lt-feed-open" onClick={() => onOpenThread(card.id)}>Xem cuộc trao đổi</button>
          )}
        </div>
      </div>
    </article>
  )
}
