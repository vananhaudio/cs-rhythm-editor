// Hàng "Chat Band" của tab Ban Nhạc — thuần trình bày (không supabase) để test được.
import { ChevronRight, MessageCircle } from 'lucide-react'
import { bandRoomsOfTeam, type ConversationItem } from '../class-social/chat/chatModel'
import type { MyBand } from '../class-social/mybands/myBandsModel'

/** Hàng "Chat Band" của một Team: mỗi nhóm chat khớp Team → một hàng mở thẳng phòng; chưa tải được → về Trò chuyện; tải xong mà không có nhóm → hàng khoá (không tạo phòng). */
export function chatRows(b: MyBand, rooms: ConversationItem[] | null, onOpenBandChat: (id: string) => void, onOpenChat: () => void) {
  const icon = <span className="cm-row-ic" aria-hidden="true"><MessageCircle /></span>
  if (rooms === null) {
    return (
      <li>
        <button type="button" className="cm-row" onClick={onOpenChat}>
          {icon}
          <span className="cm-row-body"><div className="cm-row-t">Chat Band</div><div className="cm-row-s">Mở Trò chuyện để xem nhóm chat của Band</div></span>
          <ChevronRight className="cm-row-chev" aria-hidden="true" />
        </button>
      </li>
    )
  }
  const mine = bandRoomsOfTeam(rooms, b.id)
  if (mine.length === 0) {
    return (
      <li>
        <div className="cm-row" aria-disabled="true">
          {icon}
          <span className="cm-row-body"><div className="cm-row-t">Chat Band</div><div className="cm-row-s">Band này chưa có nhóm chat</div></span>
        </div>
      </li>
    )
  }
  return mine.map(r => (
    <li key={r.id}>
      <button type="button" className="cm-row" onClick={() => onOpenBandChat(r.id)}>
        {icon}
        <span className="cm-row-body">
          <div className="cm-row-t">{mine.length > 1 ? `Chat ${r.name}` : 'Chat Band'}</div>
          <div className="cm-row-s">{r.unread > 0 ? `${r.unread} tin chưa đọc` : r.readOnly ? 'Chỉ xem' : 'Nhóm chat của Ban Nhạc'}</div>
        </span>
        <ChevronRight className="cm-row-chev" aria-hidden="true" />
      </button>
    </li>
  ))
}
