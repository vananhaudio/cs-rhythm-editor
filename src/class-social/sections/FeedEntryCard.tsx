// Một mục trong dòng hoạt động (/me Feed, Tường): bài Social → PostCard; câu chuyện học tập → LearningThreadCard;
// bài TeamLab đã xuất bản → PublicationCard.
// Hai loại cùng dòng nhưng KHÁC nghĩa: Learning Thread không phải class_posts (không bình luận/kiểm duyệt ở đây —
// xem sâu và phản hồi tại /me/t/<id>).
import { isPublicationEntry, isThreadEntry, type FeedEntry } from '../posts/postModel'
import LearningThreadCard from '../../learning-thread/LearningThreadCard'
import PostCard, { type PostSocial } from './PostCard'
import PublicationCard from './PublicationCard'
import LikeBar from '../likes/LikeBar'

export default function FeedEntryCard({ entry, now, social }: { entry: FeedEntry; now?: Date; social?: PostSocial }) {
  if (isPublicationEntry(entry)) return <PublicationCard entry={entry} now={now} footer={<LikeBar kind="teamlab_publication" id={entry.id} />} />
  if (isThreadEntry(entry)) {
    return <LearningThreadCard card={entry.card} now={now} onOpenThread={social?.onOpenThread} onOpenProfile={social?.onOpenProfile} inClass={social?.threadContext === 'class'}
      footer={<LikeBar kind="learning_thread" id={entry.id} />} />
  }
  return <PostCard post={entry} now={now} social={social} footer={<LikeBar kind="post" id={entry.id} />} />
}
