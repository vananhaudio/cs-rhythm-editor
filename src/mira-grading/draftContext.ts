// Nháp nhận xét từ Mira, đã qua kiểm (iframe/origin/thread/độ dài) ở DockView. Đi qua React context tới ô "Thầy phản hồi"
// của ĐÚNG bài đang mở — không qua mạng, không ghi dữ liệu: chỉ điền chữ vào ô soạn trên trình duyệt của Thầy.
import { createContext, useContext } from 'react'

export type MiraDraft = { threadId: string; text: string; n: number }   // n tăng mỗi lần có nháp mới (kể cả cùng nội dung)

export type MiraDraftState = { draft: MiraDraft | null; handled: (n: number) => void }   // handled: ô soạn đã nhận nháp n → bỏ khỏi hàng chờ
export const MiraDraftContext = createContext<MiraDraftState>({ draft: null, handled: () => {} })

/** Nháp đang chờ cho đúng thread này; thread khác → null (nháp của bài cũ không bao giờ lọt sang bài mới). */
export function useMiraDraftFor(threadId: string): { draft: MiraDraft | null; handled: (n: number) => void } {
  const { draft, handled } = useContext(MiraDraftContext)
  return { draft: draft && draft.threadId.toLowerCase() === threadId.toLowerCase() ? draft : null, handled }
}
