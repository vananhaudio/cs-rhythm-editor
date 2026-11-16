// Ô logo khóa học dùng chung (dòng lớp /me, Home, danh sách + tiêu đề Chat Lớp): ảnh contain;
// chưa có logo → mã khóa trên nền màu ổn định (lớp chưa gắn khóa: viết tắt tên lớp).
import { classBadge } from './classModel'

export default function ClassLogo({ url, size = 44, courseCode, name }: {
  url: string | null; size?: number; courseCode?: string | null; name?: string | null
}) {
  const b = url ? null : classBadge(courseCode, name)
  return (
    <span className="cs-classrow-logo" aria-hidden="true"
      style={{ width: size, height: size, ...(b ? { background: `hsl(${b.hue} 70% 91%)`, borderColor: `hsl(${b.hue} 45% 80%)`, color: `hsl(${b.hue} 60% 26%)` } : null) }}>
      {url
        ? <img src={url} alt="" loading="lazy" decoding="async" />
        : <span className="cs-classrow-logo-text" style={{ fontSize: Math.round(size * (b!.label.length > 3 ? 0.27 : 0.33)) }}>{b!.label}</span>}
    </span>
  )
}
