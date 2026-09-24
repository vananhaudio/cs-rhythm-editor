/**
 * Render feed thật (react-dom/server): rỗng, một/nhiều bài, tác giả, media nhúng / thẻ link,
 * nội dung là plain text (HTML bị escape), không có nút tương tác giả.
 */
import test from "node:test";
import assert from "node:assert/strict";
// Như tests/tuner: file test nằm ngoài tsconfig.app.json → JSX classic, cần React trong scope
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CommunityFeed from "../../src/class-social/sections/CommunityFeed";
import PostCard from "../../src/class-social/sections/PostCard";
import ExternalMediaView from "../../src/class-social/media/ExternalMediaView";
import { parseExternalMedia } from "../../src/class-social/media/parseExternalMedia";
import { toFeedPosts, type FeedRow } from "../../src/class-social/posts/postModel";

void React;
const NOW = new Date("2026-09-24T10:00:00Z");
const row = (o: Partial<FeedRow>): FeedRow => ({
  id: "p1", type: "assignment", body: "Em trả bài", media_type: "external_video", media_provider: "youtube",
  media_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", external_media_id: "dQw4w9WgXcQ",
  created_at: "2026-09-24T09:55:00Z", updated_at: "2026-09-24T09:55:00Z",
  author_user_id: "u1", author_name: "Nguyễn Văn Nam", author_avatar_url: null, author_role: "student",
  author_ht_member: false, is_mine: false, ...o,
});
const feed = (state: Parameters<typeof CommunityFeed>[0]["state"]) =>
  renderToStaticMarkup(<CommunityFeed state={state} onRetry={() => {}} onLoadMore={() => {}} />);

test("Feed rỗng → trạng thái trống nhẹ, KHÔNG có nút mở App học", () => {
  const html = feed({ status: "ready", posts: [], hasMore: false, loadingMore: false, moreError: null });
  assert.match(html, /Chưa có bài học tập nào/);
  assert.match(html, /Khi thành viên trả bài, hoạt động sẽ xuất hiện tại đây\./);
  assert.ok(!/App học|href=/.test(html));
});

test("Feed lỗi → câu thân thiện + Thử lại; đang tải → skeleton", () => {
  const html = feed({ status: "error", message: "Chưa tải được hoạt động của cộng đồng." });
  assert.match(html, /Chưa tải được hoạt động của cộng đồng\./);
  assert.match(html, /Thử lại/);
  assert.match(feed({ status: "loading" }), /cs-skeleton/);
});

test("Một bài YouTube: avatar/tên, nhãn TRẢ BÀI, thời gian, nội dung, iframe nocookie không autoplay", () => {
  const [p] = toFeedPosts([row({})]);
  const html = renderToStaticMarkup(<PostCard post={p} now={NOW} />);
  assert.match(html, /Nguyễn Văn Nam/);
  assert.match(html, /cs-post-type is-assignment">Trả bài</);   // CSS in hoa → "TRẢ BÀI"
  assert.match(html, /5 phút trước/);
  assert.match(html, /Em trả bài/);
  assert.match(html, /<iframe src="https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?rel=0&amp;playsinline=1"/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"/);
  assert.ok(!/autoplay=1/.test(html));
  assert.match(html, /cs-media-frame is-landscape/);
});

test("Nhiều bài, nhiều tác giả, mới nhất trước; không nút reaction/comment/share giả", () => {
  const posts = toFeedPosts([
    row({ id: "a", author_name: "An", created_at: "2026-09-24T08:00:00Z" }),
    row({ id: "b", author_name: "Bình", created_at: "2026-09-24T09:00:00Z", media_url: "https://www.tiktok.com/@b/video/7301234567890123456" }),
    row({ id: "c", author_name: "Thầy Văn Anh", author_role: "teacher", created_at: "2026-09-24T09:30:00Z", media_url: "https://www.facebook.com/reel/987654321098" }),
  ]);
  const html = feed({ status: "ready", posts, hasMore: true, loadingMore: false, moreError: null });
  const order = ["Thầy Văn Anh", "Bình", "An"].map(n => html.indexOf(`cs-post-author">${n}<`));
  assert.ok(order.every(i => i > 0) && order[0] < order[1] && order[1] < order[2], JSON.stringify(order));
  assert.match(html, /Giáo viên/);
  assert.match(html, /tiktok\.com\/player\/v1\/7301234567890123456\?autoplay=0/);
  assert.match(html, /cs-media-frame is-portrait/);           // TikTok dọc, không ép 16:9
  assert.match(html, /Xem thêm/);                              // trang tiếp theo có thật
  for (const fake of ["Thích", "Bình luận", "Chia sẻ", "lượt xem"]) assert.ok(!html.includes(fake), fake);
});

test("Facebook / TikTok rút gọn / link khác → thẻ mở nội dung gốc, mở tab mới an toàn, không iframe", () => {
  for (const [url, label] of [
    ["https://www.facebook.com/reel/987654321098", "Mở trên Facebook"],
    ["https://vm.tiktok.com/ZMabc123/", "Mở trên TikTok"],
    ["https://drive.google.com/file/d/abc/view", "Mở liên kết"],
  ] as const) {
    const r = parseExternalMedia(url);
    assert.ok(r.ok);
    if (!r.ok) continue;
    const html = renderToStaticMarkup(<ExternalMediaView media={r.media} title="t" />);
    assert.ok(!html.includes("<iframe"), url);
    assert.match(html, new RegExp(label));
    assert.match(html, /target="_blank" rel="noopener noreferrer nofollow ugc"/);
    assert.match(html, new RegExp(`href="${r.media.canonicalUrl.replace(/[.?]/g, "\\$&")}"`));
  }
});

test("Nội dung là plain text: HTML bị escape, giữ xuống dòng; URL dài không phá layout", () => {
  const [p] = toFeedPosts([row({
    body: '<img src=x onerror="alert(1)"><script>alert(2)</script>\nDòng 2',
    media_url: "https://example.org/" + "a".repeat(300),
  })]);
  const html = renderToStaticMarkup(<PostCard post={p} now={NOW} />);
  assert.ok(!html.includes("<script>") && !html.includes("<img src=x"));
  assert.match(html, /&lt;script&gt;alert\(2\)&lt;\/script&gt;\nDòng 2/);
  assert.match(html, /cs-media-card-url/);                     // CSS: ellipsis
});
