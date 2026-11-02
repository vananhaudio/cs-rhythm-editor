// Một mục trong dòng hoạt động (/me Feed, Tường): bài Social → PostCard; câu chuyện học tập → LearningThreadCard;
// bài TeamLab đã xuất bản → PublicationCard. Mỗi thẻ có thanh tương tác (Thích · Bình luận) dùng chung — Feed Likes V1 / Comments V2.
import { useEffect, useState } from 'react'
import { isLessonClipEntry, isPublicationEntry, isThreadEntry, type FeedEntry } from '../posts/postModel'
import LearningThreadCard from '../../learning-thread/LearningThreadCard'
import PostCard, { type PostSocial } from './PostCard'
import PublicationCard from './PublicationCard'
import LessonClipCard from './LessonClipCard'
import LikeBar from '../likes/LikeBar'
import TargetComments from './comments/TargetComments'
import { ensureCommentCount, useCommentCount } from '../comments/commentCountStore'
import type { CommentKind } from '../comments/targetCommentModel'

/** Thread / publication: nút Bình luận mở khu bình luận NGAY dưới thanh (không che trình phát — nằm dưới thẻ). */
function TargetActions({ kind, id, social, now }: { kind: CommentKind; id: string; social?: PostSocial; now?: Date }) {
  const [open, setOpen] = useState(false)
  const count = useCommentCount(kind, id)
  useEffect(() => { ensureCommentCount(kind, id) }, [kind, id])
  return (
    <>
      <LikeBar kind={kind} id={id} comment={{ count: count ?? 0, open, onToggle: () => setOpen(o => !o) }} />
      {open && <TargetComments kind={kind} id={id} me={social?.me ?? null} now={now} onOpenProfile={social?.onOpenProfile} />}
    </>
  )
}

export default function FeedEntryCard({ entry, now, social }: { entry: FeedEntry; now?: Date; social?: PostSocial }) {
  // Ôn nhanh: nội dung của Thầy, không tác giả/UGC → KHÔNG có Thích/Bình luận/Báo cáo (feed_likes/feed_comments không có kind này).
  if (isLessonClipEntry(entry)) return <LessonClipCard entry={entry} now={now} />
  if (isPublicationEntry(entry)) return <PublicationCard entry={entry} now={now} footer={<TargetActions kind="teamlab_publication" id={entry.id} social={social} now={now} />} />
  if (isThreadEntry(entry)) {
    return <LearningThreadCard card={entry.card} now={now} onOpenThread={social?.onOpenThread} onOpenProfile={social?.onOpenProfile} inClass={social?.threadContext === 'class'}
      footer={<TargetActions kind="learning_thread" id={entry.id} social={social} now={now} />} />
  }
  // Bài Social: khu bình luận có SẴN ngay dưới bài → nút Bình luận đưa con trỏ vào ô viết (chỉ khi có ô — tức đã đăng nhập vào Class).
  const total = social?.comments[entry.id]?.total ?? entry.commentCount
  const focus = () => { const el = document.getElementById(`cs-cmt-input-${entry.id}`); el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }); (el as HTMLTextAreaElement | null)?.focus() }
  return <PostCard post={entry} now={now} social={social}
    footer={<LikeBar kind="post" id={entry.id} comment={social ? { count: total, open: false, onToggle: focus } : undefined} />} />
}
