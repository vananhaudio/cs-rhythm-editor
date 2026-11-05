// Mira "đang chuẩn bị hoạt động": CHỈ hiển thị lời chào + trạng thái. KHÔNG gọi mạng, KHÔNG có ô soạn, KHÔNG gửi gì tới AI.
// (Chưa có backend AI, chưa có đồng ý, chưa có pilot.) Hiện cho admin khi build có VITE_MIRA_STUDENT_PREVIEW=1 — xem miraApi.miraPreviewVisible.
import ChatHeader from './ChatHeader'
import MiraAvatar from './MiraAvatar'
import MiraGreeting from './MiraGreeting'
import { MIRA_NAME } from './miraApi'

export default function MiraPreparingView({ onBack }: { onBack: () => void }) {
  return (
    <>
      <ChatHeader name={MIRA_NAME} avatarUrl={null} avatar={<MiraAvatar size={40} />} onBack={onBack} tag="Trợ lý AI học tập · đang chuẩn bị hoạt động" />
      <div className="cs-chat-scroll-wrap">
        <div className="cs-chat-scroll" role="log" aria-label="Mira đang chuẩn bị hoạt động">
          <MiraGreeting />
        </div>
      </div>
      <div className="cs-chat-locked" data-testid="mira-preparing" role="status">
        <p><b>Mira đang chuẩn bị hoạt động.</b></p>
        <p>Hiện chưa trả lời câu hỏi và chưa nhận bất kỳ dữ liệu nào. Mục này chỉ hiển thị cho quản trị viên.</p>
      </div>
    </>
  )
}
