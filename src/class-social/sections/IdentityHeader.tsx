// Phần đầu của /me: ảnh bìa + avatar chồng lên bìa + tên + thông tin ngắn (dữ liệu thật).
// Là header của HOME, không phải trang profile riêng. Bìa thấp để feed lộ ra sớm.
// Chưa có / lỗi ảnh bìa → bìa mặc định tím (không bao giờ hiện ảnh vỡ).
import { useState } from 'react'
import { Camera, Users } from 'lucide-react'
import type { ClassIdentity } from '../useClassSession'
import { levelLabel, monthYear } from '../format'
import { safeImageUrl } from '../media/safeImageUrl'
import type { ImageKind } from '../profile/imageFile'
import { Avatar } from '../ui'

export default function IdentityHeader({ me, canEditAvatar = false, onEdit }: {
  me: ClassIdentity
  canEditAvatar?: boolean
  onEdit?: (kind: ImageKind) => void
}) {
  const level = levelLabel(me.level)
  const since = monthYear(me.enrolledAt)
  const facts = [
    me.role === 'teacher' ? 'Giáo viên' : null,
    level,
    since ? 'Tham gia ' + since : null,
  ].filter(Boolean) as string[]
  const cover = safeImageUrl(me.coverUrl)
  const [coverBroken, setCoverBroken] = useState<string | null>(null)
  const showCover = cover && coverBroken !== cover

  return (
    <section className="cs-card cs-identity" aria-label="Không gian của tôi">
      <div className={'cs-cover' + (showCover ? ' has-image' : '')}>
        {showCover && <img className="cs-cover-img" src={cover} alt="" onError={() => setCoverBroken(cover)} />}
        {onEdit && (
          <button type="button" className="cs-cover-edit" onClick={() => onEdit('cover')} aria-label="Đổi ảnh bìa">
            <Camera size={16} strokeWidth={2.2} /><span>Đổi ảnh bìa</span>
          </button>
        )}
      </div>
      <div className="cs-identity-body">
        <div className="cs-identity-avatar-wrap">
          <Avatar className="cs-identity-avatar" name={me.name} url={safeImageUrl(me.avatarUrl)} size={124} />
          {onEdit && canEditAvatar && (
            <button type="button" className="cs-avatar-edit" onClick={() => onEdit('avatar')} aria-label="Đổi ảnh đại diện" title="Đổi ảnh đại diện">
              <Camera size={17} strokeWidth={2.2} />
            </button>
          )}
        </div>
        <div className="cs-identity-text">
          <h1 className="cs-identity-name">{me.name}</h1>
          <div className="cs-identity-community">
            <Users size={15} strokeWidth={2.2} />
            <span>Cộng Đồng Hành Trình Guitar</span>
          </div>
          {(me.htMember || facts.length > 0) && (
            <div className="cs-identity-facts">
              {me.htMember && <span className="cs-badge">Lớp Hành trình</span>}
              {facts.map(f => <span key={f}>{f}</span>)}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
