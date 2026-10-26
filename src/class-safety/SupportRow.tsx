// Mục "Hỗ trợ & liên hệ" CỐ ĐỊNH (không phụ thuộc mạng/server): chỉ dùng liên hệ chính thức đã có trong repo.
import { ChevronRight, LifeBuoy, Mail, MessageCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { PRIVACY_URL, REPORT_RESPONSE_HOURS, SUPPORT_EMAIL, SUPPORT_ZALO_URL } from './model'

function Item({ icon, title, hint, href }: { icon: ReactNode; title: string; hint?: string; href: string }) {
  return (
    <li>
      <a className="cm-row" href={href} {...(href.startsWith('https') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        <span className="cm-row-ic" aria-hidden="true">{icon}</span>
        <span className="cm-row-body"><div className="cm-row-t">{title}</div>{hint && <div className="cm-row-s">{hint}</div>}</span>
        <ChevronRight className="cm-row-chev" aria-hidden="true" />
      </a>
    </li>
  )
}

export default function SupportRow() {
  return (
    <>
      <h2 className="cm-h2">Hỗ trợ & liên hệ</h2>
      <ul className="cm-list">
        <Item icon={<MessageCircle />} title="Nhắn Thầy qua Zalo" hint={`Báo cáo được xử lý trong ${REPORT_RESPONSE_HOURS} giờ`} href={SUPPORT_ZALO_URL} />
        <Item icon={<Mail />} title="Gửi email hỗ trợ" hint={SUPPORT_EMAIL} href={`mailto:${SUPPORT_EMAIL}`} />
        <Item icon={<LifeBuoy />} title="Chính sách bảo mật" href={PRIVACY_URL} />
      </ul>
    </>
  )
}
