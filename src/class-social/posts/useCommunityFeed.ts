// Trạng thái một dòng bài (feed Cộng đồng / tường cá nhân): trang đầu, "Xem thêm", tải lại sau khi đăng bài.
import { fetchScopedFeedPage } from './postsApi'
import type { FeedScope } from './feedScope'
import { usePostsFeed, type PageFetcher } from './usePostsFeed'

export { usePostsFeed, type FeedState, type PageFetcher } from './usePostsFeed'

// Một hàm tải CỐ ĐỊNH cho mỗi góc nhìn → usePostsFeed coi đổi góc nhìn = đổi nguồn (tải lại, bỏ kết quả cũ về muộn)
const SCOPED_FETCHERS: Record<FeedScope, PageFetcher> = {
  for_you: c => fetchScopedFeedPage('for_you', c),
  // "Lớp của tôi" KHÔNG còn là dòng feed lọc: MeHome hiện bảng lớp (MyClassesBoard, hoạt động từ social_class_activity)
  my_classes: async () => ({ ok: true, value: { posts: [], hasMore: false } }),
  friends: c => fetchScopedFeedPage('friends', c),
}

/** Feed /me: bài Social + câu chuyện học tập — theo góc nhìn (mặc định Dành cho bạn = social_feed). */
export function useCommunityFeed(scope: FeedScope = 'for_you') {
  return usePostsFeed(SCOPED_FETCHERS[scope])
}

