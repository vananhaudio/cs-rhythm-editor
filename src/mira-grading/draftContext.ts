// Nháp nhận xét từ Mira, đã qua kiểm (iframe/origin/thread/độ dài) ở DockView. Đi qua React context tới ô "Thầy phản hồi"
// của ĐÚNG bài đang mở — không qua mạng, không ghi dữ liệu: chỉ điền chữ vào ô soạn trên trình duyệt của Thầy.
import { createContext, useContext } from 'react'

export type MiraDraft = { threadId: string; text: string; n: number }   // n tăng mỗi lần có nháp mới (kể cả cùng nội dung)

/** Ô soạn báo lại số phận của nháp n: received = đang chờ Thầy xác nhận thay · applied = ĐÃ điền vào ô · declined = không điền (Thầy giữ nguyên/đang gửi/bị nháp mới thay). */
export type DraftOutcome = 'received' | 'applied' | 'declined'
export type MiraDraftState = { draft: MiraDraft | null; report: (n: number, o: DraftOutcome) => void }
export const MiraDraftContext = createContext<MiraDraftState>({ draft: null, report: () => {} })

/** Nháp đang chờ cho đúng thread này; thread khác → null (nháp của bài cũ không bao giờ lọt sang bài mới). */
export function useMiraDraftFor(threadId: string): MiraDraftState {
  const { draft, report } = useContext(MiraDraftContext)
  return { draft: draft && draft.threadId.toLowerCase() === threadId.toLowerCase() ? draft : null, report }
}
