// Thẻ "Bài giảng nên xem" trong nhận xét của Thầy. CHỈ là tham chiếu + link sang Kho:
// quyền xem do Kho quyết định khi mở (Social không proxy, không tự cấp quyền).
import { BookOpen, ExternalLink } from 'lucide-react'
import { formatTimecode, khoVideoHref, type ResourceRef } from '../../comments/commentModel'

export default function ResourceCard({ res, onRemove }: { res: ResourceRef; onRemove?: () => void }) {
  const href = khoVideoHref(res)
  const title = res.title || 'Bài giảng trong Kho'
  const at = res.startSeconds ? formatTimecode(res.startSeconds) : null
  return (
    <div className="cs-res">
      <span className="cs-res-icon" aria-hidden="true"><BookOpen size={18} /></span>
      <div className="cs-res-text">
        <span className="cs-res-kicker">Bài giảng nên xem</span>
        <span className="cs-res-title">{title}</span>
        {at && <span className="cs-res-time">Từ {at}</span>}
        {res.excerpt && (
          <blockquote className="cs-res-excerpt" title="Trích đoạn do Thầy chọn">“{res.excerpt}”</blockquote>
        )}
      </div>
      {onRemove ? (
        <button type="button" className="cs-res-remove" onClick={onRemove} aria-label={`Bỏ đính kèm ${title}`}>Bỏ</button>
      ) : href ? (
        <a className="cs-res-open" href={href} target="_blank" rel="noopener noreferrer"
          aria-label={`${at ? 'Xem đoạn này' : 'Xem bài giảng'}: ${title}${at ? ' từ ' + at : ''}`}>
          {at ? 'Xem đoạn này' : 'Xem bài giảng'} <ExternalLink size={14} />
        </a>
      ) : null}
    </div>
  )
}
