// Nạp lớp gọi Supabase cho bình luận CHỈ khi người dùng thao tác (gửi, xoá, ẩn, tìm/tạo tag).
// Component bình luận vì thế render được mà không kéo Supabase theo (test render, SSR).
type CommentsApi = typeof import('./commentsApi')
let loader: () => Promise<CommentsApi> = () => import('./commentsApi')
export const loadCommentsApi = () => loader()
/** Chỉ cho test: thay lớp API bằng bản giả (tests chạy ngoài Vite nên không nạp được client Supabase thật). */
export function __setCommentsApiLoader(l: (() => Promise<CommentsApi>) | null) { loader = l ?? (() => import('./commentsApi')) }
