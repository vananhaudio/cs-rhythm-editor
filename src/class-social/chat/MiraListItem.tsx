// Mục "Mira" ghim đầu danh sách Trò chuyện (chỉ hiện khi cờ build + pilot cho phép). Dùng lại kiểu dáng .cs-chat-item.
import MiraAvatar from './MiraAvatar'
import { MIRA_NAME } from './miraApi'

export default function MiraListItem({ active, onSelect }: { active: boolean; onSelect: () => void }) {
  return (
    <ul className="cs-chat-items">
      <li>
        <button type="button" className={'cs-chat-item' + (active ? ' is-active' : '')} aria-current={active ? 'true' : undefined}
          aria-label="Mira, trợ lý học tập" onClick={onSelect}>
          <MiraAvatar size={48} />
          <span className="cs-chat-item-text">
            <span className="cs-chat-item-top"><span className="cs-chat-item-name">{MIRA_NAME}</span><span className="cs-chat-item-tag">Trợ lý</span></span>
            <span className="cs-chat-item-bottom"><span className="cs-chat-item-preview">Hỏi bài học, luyện tập hôm nay…</span></span>
          </span>
        </button>
      </li>
    </ul>
  )
}
