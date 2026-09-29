// Một mục trong dòng hoạt động (/me Feed, Tường): bài Social → PostCard; câu chuyện học tập → LearningThreadCard.
// Hai loại cùng dòng nhưng KHÁC nghĩa: Learning Thread không phải class_posts (không bình luận/kiểm duyệt ở đây —
// xem sâu và phản hồi tại /me/t/<id>).
import { isThreadEntry, type FeedEntry } from '../posts/postModel'
import LearningThreadCard from '../../learning-thread/LearningThreadCard'
import PostCard, { type PostSocial } from './PostCard'

export default function FeedEntryCard({ entry, now, social }: { entry: FeedEntry; now?: Date; social?: PostSocial }) {
  if (isThreadEntry(entry)) {
    return <LearningThreadCard card={entry.card} now={now} onOpenThread={social?.onOpenThread} onOpenProfile={social?.onOpenProfile} />
  }
  return <PostCard post={entry} now={now} social={social} />
}
