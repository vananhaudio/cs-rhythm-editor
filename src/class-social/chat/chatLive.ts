// "Đường truyền" cập nhật của Trò chuyện. V1a = POLLING nhẹ; giao diện + hook chỉ biết interface ChatLive,
// nên sau này thay bằng realtime (cùng interface) KHÔNG phải viết lại UI/hook/data model.
//   • tab ẩn → dừng hẳn; quay lại tab / focus → tải ngay một lần
//   • không bao giờ chồng hai lượt gọi; lỗi → giãn nhịp (×2, tối đa 60 s) rồi tự hồi
//   • hội thoại đang mở chỉ hỏi tin MỚI (seq > đã có), không bao giờ tải lại cả lịch sử
import { fetchConversations, fetchMessages, fetchSystemSummary, fetchUnreadCount } from './chatApi'
import type { Result } from '../posts/postsApi'
import type { ChatMessage, ConversationItem, SystemSummary } from './chatModel'
import { POLL_MS, startPolling, type Unsubscribe } from './polling'

export type { Unsubscribe }

export interface ChatLive {
  watchUnread(onCount: (n: number) => void): Unsubscribe
  watchList(onRows: (r: Result<ConversationItem[]>) => void): Unsubscribe
  /** Class 2.0: tóm tắt thông báo hệ thống (null = chưa dùng được, vd. DB chưa có tính năng → ẩn mục) */
  watchSystem?(onSummary: (s: SystemSummary | null) => void): Unsubscribe
  /** afterSeq() = seq lớn nhất mình đang có (đọc mới ở mỗi lượt) */
  watchConversation(id: string, afterSeq: () => number, onRows: (r: Result<ChatMessage[]>) => void): Unsubscribe
}

export const pollingLive: ChatLive = {
  watchUnread(onCount) {
    return startPolling(async () => {
      const r = await fetchUnreadCount()
      if (r.ok) onCount(r.value)
      return r.ok
    }, POLL_MS.unread)
  },
  watchList(onRows) {
    return startPolling(async () => {
      const r = await fetchConversations()
      onRows(r)
      return r.ok
    }, POLL_MS.list)
  },
  watchSystem(onSummary) {
    return startPolling(async () => {
      const r = await fetchSystemSummary()
      onSummary(r.ok ? r.value : null)
      return r.ok
    }, POLL_MS.unread)
  },
  watchConversation(id, afterSeq, onRows) {
    return startPolling(async () => {
      const r = await fetchMessages(id, { afterSeq: afterSeq(), limit: 100 })
      onRows(r)
      return r.ok
    }, POLL_MS.conversation)
  },
}
