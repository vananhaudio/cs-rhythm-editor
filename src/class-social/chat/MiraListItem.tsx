// Mục "Mira" ghim đầu danh sách Trò chuyện (chỉ hiện khi cờ build + pilot cho phép). Dùng lại kiểu dáng .cs-chat-item.
// V3: nếu Mira đang có lời mời chờ, dòng xem trước hiện lời mời + chấm báo (chỉ đọc lời mời đang chờ, không tạo mới).
import { useEffect, useState } from 'react'
import MiraAvatar from './MiraAvatar'
import { MIRA_NAME } from './miraApi'
import { pendingInvitation } from './miraInviteApi'

export default function MiraListItem({ active, onSelect }: { active: boolean; onSelect: () => void }) {
  const [invite, setInvite] = useState<string | null>(null)
  useEffect(() => { let a = true; void pendingInvitation().then(v => { if (a) setInvite(v?.text ?? null) }); return () => { a = false } }, [])
  return (
    <ul className="cs-chat-items">
      <li>
        <button type="button" className={'cs-chat-item' + (active ? ' is-active' : '')} aria-current={active ? 'true' : undefined}
          aria-label={invite ? 'Mira, trợ lý học tập, có lời mời mới' : 'Mira, trợ lý học tập'} onClick={onSelect}>
          <MiraAvatar size={48} />
          <span className="cs-chat-item-text">
            <span className="cs-chat-item-top"><span className="cs-chat-item-name">{MIRA_NAME}</span><span className="cs-chat-item-tag">Trợ lý</span></span>
            <span className="cs-chat-item-bottom">
              <span className="cs-chat-item-preview" data-testid="mira-list-preview">{invite ?? 'Hỏi bài học, luyện tập hôm nay…'}</span>
              {invite && <span className="cs-nav-badge cs-chat-item-badge" aria-hidden="true" data-testid="mira-list-dot">1</span>}
            </span>
          </span>
        </button>
      </li>
    </ul>
  )
}
