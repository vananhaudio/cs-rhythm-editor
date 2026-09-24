/**
 * Domain bài đăng: kiểm tra bản nháp Trả bài, lỗi thân thiện, dựng feed, thời gian tương đối.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  checkAssignmentDraft, normalizeBody, friendlyError, toFeedPost, toFeedPosts, mergePosts, relativeTime,
  MAX_BODY, type FeedRow,
} from "../../src/class-social/posts/postModel.ts";

const YT = "https://youtu.be/dQw4w9WgXcQ?si=x";

test("Trả bài: không có video → từ chối (kể cả có nội dung)", () => {
  const r = checkAssignmentDraft({ body: "", url: "" });
  assert.equal(r.ok, false);
  const r2 = checkAssignmentDraft({ body: "Em trả bài ạ", url: "" });
  assert.equal(r2.ok, false);
  if (!r2.ok) assert.equal(r2.videoError, "Hãy dán liên kết video bài tập.");
});

test("Trả bài: video hợp lệ (nội dung tuỳ chọn) → insert đúng P1, URL đã chuẩn hoá, KHÔNG có author", () => {
  const r = checkAssignmentDraft({ body: "  Em trả bài Thành phố buồn ạ.\r\n\r\n\r\n\r\n\r\nCảm ơn thầy  ", url: YT });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.insert, {
    type: "assignment", body: "Em trả bài Thành phố buồn ạ.\n\n\nCảm ơn thầy",
    media_type: "external_video", media_provider: "youtube",
    media_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", external_media_id: "dQw4w9WgXcQ",
  });
  assert.equal("author_user_id" in r.insert, false, "tác giả do DB lấy từ auth.uid()");
  assert.ok(checkAssignmentDraft({ body: "", url: YT }).ok, "nội dung không bắt buộc");
});

test("Trả bài: video lỗi → từ chối với câu tiếng Việt", () => {
  const r = checkAssignmentDraft({ body: "x", url: "javascript:alert(1)" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.videoError, "Chỉ nhận liên kết bắt đầu bằng https://");
  const r2 = checkAssignmentDraft({ body: "x", url: "https://www.youtube.com/@kenh" });
  if (!r2.ok) assert.match(r2.videoError!, /chưa phải một video/);
});

test("Trả bài: ghi chú cho Thầy tối đa 2000 ký tự", () => {
  assert.ok(checkAssignmentDraft({ body: "a".repeat(MAX_BODY), url: YT }).ok);
  const r = checkAssignmentDraft({ body: "a".repeat(MAX_BODY + 1), url: YT });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.bodyError, "Ghi chú tối đa 2000 ký tự.");
  assert.equal(normalizeBody("\n\n  x \n"), "x");
});

test("Lỗi → câu tiếng Việt, không lộ lỗi thô", () => {
  assert.equal(friendlyError({ message: "TypeError: Failed to fetch" }, "post"), "Không có kết nối mạng. Kiểm tra mạng rồi thử lại.");
  assert.equal(friendlyError({ message: "anything" }, "feed", false), "Không có kết nối mạng. Kiểm tra mạng rồi thử lại.");
  assert.equal(friendlyError({ code: "PGRST301", message: "JWT expired" }, "post"), "Phiên đăng nhập đã hết hạn. Hãy tải lại trang và đăng nhập lại.");
  assert.equal(friendlyError({ status: 401, message: "x" }, "feed"), "Phiên đăng nhập đã hết hạn. Hãy tải lại trang và đăng nhập lại.");
  assert.equal(friendlyError({ code: "42501", message: 'new row violates row-level security policy for table "class_posts"' }, "post"), "Tài khoản của bạn chưa gửi được trong Class.");
  assert.equal(friendlyError({ code: "23514", message: 'violates check constraint "class_posts_media_url_check"' }, "post"), "Nội dung chưa hợp lệ. Hãy kiểm tra lại rồi gửi.");
  assert.equal(friendlyError({ code: "XX000", message: "internal" }, "post"), "Chưa gửi được. Hãy thử lại.");
  assert.equal(friendlyError({ code: "PGRST202", message: "function class_feed not found" }, "feed"), "Chưa tải được hoạt động của cộng đồng.");
  for (const m of ["class_posts", "PGRST", "JWT", "violates"]) {
    assert.ok(!friendlyError({ code: "PGRST301", message: "JWT class_posts violates" }, "post").includes(m));
  }
});

const row = (o: Partial<FeedRow>): FeedRow => ({
  id: "p1", type: "assignment", body: "Em trả bài", media_type: "external_video", media_provider: "youtube",
  media_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", external_media_id: "dQw4w9WgXcQ",
  created_at: "2026-09-24T03:00:00.000000+00:00", updated_at: "2026-09-24T03:00:00+00:00",
  author_user_id: "u1", author_name: "Nguyễn Văn Nam", author_avatar_url: null, author_role: "student",
  author_ht_member: true, is_mine: false, ...o,
});

test("Feed: rỗng → []; một bài → đúng tác giả + media parse LẠI từ URL", () => {
  assert.deepEqual(toFeedPosts([]), []);
  const [p] = toFeedPosts([row({})]);
  assert.equal(p.author.name, "Nguyễn Văn Nam");
  assert.equal(p.author.htMember, true);
  assert.equal(p.media?.provider, "youtube");
  assert.equal(p.media?.embedUrl, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&playsinline=1");
});

test("Feed: nhiều bài → mới nhất trước; hàng hỏng bị bỏ; gộp trang bỏ trùng", () => {
  const posts = toFeedPosts([
    row({ id: "a", created_at: "2026-09-24T01:00:00Z" }),
    row({ id: "c", created_at: "2026-09-24T03:00:00Z" }),
    row({ id: "bad", type: "free_text" }),
    row({ id: "b", created_at: "2026-09-24T02:00:00Z" }),
  ]);
  assert.deepEqual(posts.map(p => p.id), ["c", "b", "a"]);
  const more = toFeedPosts([row({ id: "a", created_at: "2026-09-24T01:00:00Z" }), row({ id: "z", created_at: "2026-09-23T01:00:00Z" })]);
  assert.deepEqual(mergePosts(posts, more).map(p => p.id), ["c", "b", "a", "z"]);
});

test("Feed: KHÔNG tin provider/ID lưu trong DB — media dựng lại từ media_url", () => {
  // DB ghi provider youtube + ID lạ, nhưng URL thật là link ngoài → hiển thị thẻ link, không iframe
  const p = toFeedPost(row({ media_provider: "youtube", external_media_id: "attackerId1", media_url: "https://evil.test/x" }))!;
  assert.equal(p.media?.provider, "external_link");
  assert.equal(p.media?.canEmbed, false);
  // URL hỏng/nguy hiểm trong DB → không media
  assert.equal(toFeedPost(row({ media_url: "javascript:alert(1)" }))!.media, null);
});

test("Feed: tên rỗng → 'Thành viên Class'; avatar không phải https bị bỏ; giáo viên", () => {
  const p = toFeedPost(row({ author_name: "  ", author_avatar_url: "javascript:alert(1)", author_role: "teacher" }))!;
  assert.equal(p.author.name, "Thành viên Class");
  assert.equal(p.author.avatarUrl, null);
  assert.equal(p.author.isTeacher, true);
  assert.equal(toFeedPost(row({ author_avatar_url: "https://cdn.example.test/a.png" }))!.author.avatarUrl, "https://cdn.example.test/a.png");
});

test("Thời gian tương đối", () => {
  const now = new Date("2026-09-24T10:00:00Z");
  assert.equal(relativeTime("2026-09-24T09:59:30Z", now), "Vừa xong");
  assert.equal(relativeTime("2026-09-24T09:55:00Z", now), "5 phút trước");
  assert.equal(relativeTime("2026-09-24T07:00:00Z", now), "3 giờ trước");
  assert.equal(relativeTime("2026-09-23T09:00:00Z", now), "Hôm qua");
  assert.equal(relativeTime("2026-09-20T09:00:00Z", now), "4 ngày trước");
  assert.equal(relativeTime("2026-10-01T00:00:00Z", now), "Vừa xong");   // giờ máy lệch → không âm
  assert.equal(relativeTime("không phải ngày", now), "");
});
