// Thích · Bình luận trên trang đọc truyện. DÙNG CHUNG thành phần và dữ liệu của Feed (khoá 'story', stories.id)
// → số và bình luận ở Feed và ở đây là một. Quyền thấy / chặn / kiểm duyệt do server quyết.
import { useEffect, useState } from 'react'
import '../class-social/classSocial.css'
import './storyEngagement.css'
import { useClassSession, type ClassIdentity } from '../class-social/useClassSession'
import LikeBar from '../class-social/likes/LikeBar'
import TargetComments from '../class-social/sections/comments/TargetComments'
import { ensureCommentCount, useCommentCount } from '../class-social/comments/commentCountStore'

function Social({ storyId, me }: { storyId: string; me: ClassIdentity }) {
  const [open, setOpen] = useState(true)
  const count = useCommentCount('story', storyId)
  useEffect(() => { ensureCommentCount('story', storyId) }, [storyId])
  return (
    <div className="cs-root sd-social">
      <LikeBar kind="story" id={storyId} comment={{ count: count ?? 0, open, onToggle: () => setOpen(o => !o) }} />
      {open && <TargetComments kind="story" id={storyId} me={me} />}
    </div>
  )
}

export default function StoryEngagement({ storyId }: { storyId: string }) {
  const session = useClassSession()
  if (session.status === 'ready') return <Social storyId={storyId} me={session.me} />
  if (session.status === 'signed-out') {
    return <p className="sd-social-guest"><a href="/me">Đăng nhập</a> để thích và bình luận câu chuyện này.</p>
  }
  return null
}
