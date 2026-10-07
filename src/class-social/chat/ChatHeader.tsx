import { ArrowLeft } from 'lucide-react'
import { Avatar } from '../ui'

/** Đầu khung hội thoại: ← (chỉ hiện trên điện thoại) + avatar + tên (bấm → trang cá nhân) */
export default function ChatHeader({ name, avatarUrl, isTeacher, onBack, onOpenProfile }: {
  name: string | null
  avatarUrl: string | null
  isTeacher?: boolean
  onBack: () => void
  onOpenProfile?: () => void
}) {
  return (
    <header className="cs-chat-head">
      <button type="button" className="cs-icon-btn cs-chat-back" onClick={onBack} aria-label="Quay lại danh sách trò chuyện">
        <ArrowLeft size={22} aria-hidden="true" />
      </button>
      {name == null
        ? <div className="cs-skeleton" style={{ width: 160, height: 18 }} aria-label="Đang tải" />
        : (
          <button type="button" className="cs-chat-peer" onClick={onOpenProfile} disabled={!onOpenProfile} aria-label={`Trang cá nhân của ${name}`}>
            <Avatar name={name} url={avatarUrl} size={40} />
            <span className="cs-chat-peer-name">{name}{isTeacher && <span className="cs-post-role"> · Giáo viên</span>}</span>
          </button>
        )}
    </header>
  )
}
