// Chỗ cắm phần TƯƠNG TÁC của bài trả (nút Trả bài + trạng thái) — chỉ màn học trong /me cung cấp.
// Không có (trang công khai /solo01, Admin xem trước, app overlay) → bài trả hiện TĨNH. Khi in: phần cắm bị ẩn.
import { createContext, type ReactNode } from 'react'
import type { CheckpointSection } from './lessonTypes'

export const CheckpointSlot = createContext<((cp: CheckpointSection) => ReactNode) | null>(null)
