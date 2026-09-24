// Nạp lớp gọi Supabase cho bình luận CHỈ khi người dùng thao tác (gửi, xoá, ẩn, tìm/tạo tag).
// Component bình luận vì thế render được mà không kéo Supabase theo (test render, SSR).
export const loadCommentsApi = () => import('./commentsApi')
