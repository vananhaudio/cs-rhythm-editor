// Mục "Mira · học viên" ở đầu danh sách Trò chuyện — CHỈ render khi cha xác định là Owner (admin); quyền thật do RPC mira_owner_* quyết.
import { ChevronRight } from 'lucide-react'
import MiraAvatar from '../chat/MiraAvatar'

export default function MiraOwnerEntry({ onOpen }: { onOpen: () => void }) {
  return (
    <ul className="cs-chat-items">
      <li>
        <button type="button" className="cs-chat-item" data-testid="mira-owner-entry" aria-label="Mira, hội thoại học viên (chỉ Owner)" onClick={onOpen}>
          <MiraAvatar size={48} />
          <span className="cs-chat-item-text">
            <span className="cs-chat-item-top"><span className="cs-chat-item-name">Mira · học viên</span><span className="cs-chat-item-tag">Owner</span></span>
            <span className="cs-chat-item-bottom"><span className="cs-chat-item-preview">Xem học viên đã trò chuyện với Mira</span></span>
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </li>
    </ul>
  )
}
