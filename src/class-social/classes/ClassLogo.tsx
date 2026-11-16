// Ô logo khóa học dùng chung (dòng lớp /me, danh sách + tiêu đề Chat Lớp): ảnh contain; thiếu logo → nốt nhạc mặc định.
import { Music } from 'lucide-react'

export default function ClassLogo({ url, size }: { url: string | null; size?: number }) {
  return (
    <span className="cs-classrow-logo" aria-hidden="true" style={size ? { width: size, height: size } : undefined}>
      {url ? <img src={url} alt="" loading="lazy" decoding="async" /> : <Music size={size ? Math.round(size * 0.45) : 20} />}
    </span>
  )
}
