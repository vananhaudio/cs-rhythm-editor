/**
 * Render bình luận / nhận xét của Thầy (react-dom/server).
 */
import test from "node:test";
import assert from "node:assert/strict";
// Như tests/tuner: file test nằm ngoài tsconfig.app.json → JSX classic, cần React trong scope
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CommentsSection from "../../src/class-social/sections/comments/CommentsSection";
import CommentItem from "../../src/class-social/sections/comments/CommentItem";
import PostCard from "../../src/class-social/sections/PostCard";
import { toComment, type CommentRow } from "../../src/class-social/comments/commentModel";
import { toFeedPosts, type FeedRow } from "../../src/class-social/posts/postModel";
import type { ClassIdentity } from "../../src/class-social/useClassSession";
void React;

const NOW = new Date("2026-09-24T10:00:00Z");
const me = (isTeacher: boolean): ClassIdentity => ({
  role: isTeacher ? "teacher" : "student", userId: "me", studentId: isTeacher ? null : "s", name: isTeacher ? "Thầy Văn Anh" : "Lan Anh",
  email: null, avatarUrl: null, level: null, enrolledAt: null, htMember: false, isTeacher, coverUrl: null,
});
const crow = (o: Partial<CommentRow>): CommentRow => ({
  id: "c1", post_id: "p1", parent_comment_id: null, body: "Đoạn này em cũng hay bị nhanh 😄", created_at: "2026-09-24T09:50:00Z",
  updated_at: "2026-09-24T09:50:00Z", author_user_id: "u2", author_name: "Lan Anh", author_avatar_url: null, author_role: "student",
  is_mine: false, is_hidden: false, tags: [], resources: [], post_comment_count: 2, ...o,
});
const teacherRow = crow({
  id: "c2", author_user_id: "t1", author_name: "Thầy Văn Anh", author_role: "teacher", created_at: "2026-09-24T09:55:00Z",
  body: "Đoạn 1:24 em đang vào bass sớm.\nEm tập chậm lại ở 70 BPM rồi tăng dần.",
  tags: [{ id: 1, name: "Nhịp" }, { id: 2, name: "Bass" }],
  resources: [{ id: "r1", resource_type: "kho_video", resource_id: "wbgyiKG6big", title: "Cách giữ bass đúng phách trong Bolero", start_seconds: 222, excerpt: "Giữ bass đúng phách 1 và 3." }],
});
const noop = async () => {};
const section = (isTeacher: boolean, items = [toComment(crow({}))!, toComment(teacherRow)!], total = 2) => renderToStaticMarkup(
  <CommentsSection postId="p1" total={total} me={me(isTeacher)} now={NOW} onRefresh={noop} onExpand={noop}
    state={{ items, total, expanded: false, loading: false, error: null }} />);

test("Nhận xét của Thầy: badge THẦY, nền nổi bật nhẹ, tag, thẻ bài giảng có mốc + link Kho", () => {
  const html = renderToStaticMarkup(<CommentItem c={toComment(teacherRow)!} canModerate={false} now={NOW} onDelete={() => {}} onModerate={() => {}} />);
  assert.match(html, /cs-cmt is-teacher/);
  assert.match(html, /cs-cmt-badge[^>]*>Thầy</);
  assert.match(html, /#Nhịp/); assert.match(html, /#Bass/);
  assert.match(html, /Bài giảng nên xem/);
  assert.match(html, /Cách giữ bass đúng phách trong Bolero/);
  assert.match(html, /Từ 03:42/);
  assert.match(html, /href="\/khobaigiang\/video\/wbgyiKG6big\?t=222"/);
  assert.match(html, /Xem đoạn này/);
  assert.match(html, /“Giữ bass đúng phách 1 và 3\.”/);
  assert.match(html, /vào bass sớm\.\nEm tập chậm/);            // giữ xuống dòng (pre-wrap)
  assert.ok(!/<a[^>]*href="#|javascript:/.test(html), "không link chết");
});

test("Bình luận học sinh: không badge, tag là thẻ tĩnh (không link giả), escape HTML", () => {
  const c = toComment(crow({ body: '<img src=x onerror="alert(1)">Chào cả nhà', tags: [{ id: 9, name: "Nhịp" }] }))!;
  const html = renderToStaticMarkup(<CommentItem c={c} canModerate={false} now={NOW} onDelete={() => {}} onModerate={() => {}} />);
  assert.ok(!html.includes("cs-cmt-badge"));
  assert.ok(!html.includes("<img src=x"));
  assert.match(html, /&lt;img src=x/);
  assert.match(html, /<li class="cs-tag">#Nhịp<\/li>/);
});

test("Menu ⋯: tác giả thấy Xoá; người khác (học sinh) không có menu; Thầy thấy Ẩn — chỉ khi mở menu", () => {
  const mine = renderToStaticMarkup(<CommentItem c={toComment(crow({ is_mine: true }))!} canModerate={false} now={NOW} onDelete={() => {}} onModerate={() => {}} />);
  assert.match(mine, /aria-label="Tuỳ chọn bình luận"/);
  const other = renderToStaticMarkup(<CommentItem c={toComment(crow({}))!} canModerate={false} now={NOW} onDelete={() => {}} onModerate={() => {}} />);
  assert.ok(!other.includes("Tuỳ chọn bình luận"), "học sinh không thấy quyền kiểm duyệt");
  const mod = renderToStaticMarkup(<CommentItem c={toComment(crow({}))!} canModerate={true} now={NOW} onDelete={() => {}} onModerate={() => {}} />);
  assert.match(mod, /aria-label="Tuỳ chọn bình luận"/);
  const hidden = renderToStaticMarkup(<CommentItem c={toComment(crow({ is_hidden: true }))!} canModerate={true} now={NOW} onDelete={() => {}} onModerate={() => {}} />);
  assert.match(hidden, /Đã ẩn · học sinh không thấy/);
});

test("Khu bình luận: học sinh chỉ có ô 'Viết bình luận...', KHÔNG có công cụ Thầy", () => {
  const html = section(false);
  assert.match(html, /placeholder="Viết bình luận\.\.\."/);
  assert.ok(!html.includes("Gắn thẻ") && !html.includes("Đính kèm bài giảng"));
  // thứ tự CŨ → MỚI: học sinh (9:50) trước Thầy (9:55)
  assert.ok(html.indexOf("Lan Anh") < html.indexOf("Thầy Văn Anh"));
});

test("Khu bình luận: Thầy thấy 'Gắn thẻ' + 'Đính kèm bài giảng'", () => {
  const html = section(true);
  assert.match(html, /placeholder="Viết nhận xét…"/);
  assert.match(html, /Gắn thẻ/); assert.match(html, /Đính kèm bài giảng/);
});

test("Khu bình luận: rỗng → chỉ ô viết; còn bình luận cũ → 'Xem thêm bình luận (N)'", () => {
  const empty = section(false, [], 0);
  assert.ok(!empty.includes("cs-cmt-list") && !empty.includes("Xem thêm bình luận"));
  const more = section(false, [toComment(crow({}))!], 5);
  assert.match(more, /Xem thêm bình luận \(4\)/);
});

test("Thẻ bài: Thầy có menu ⋯ (Ẩn bài), học sinh không; bài đã ẩn có nhãn; nhãn Ghi chú cho Thầy, không có chữ 'Nội dung'", () => {
  const row: FeedRow = {
    id: "p1", type: "assignment", body: "Em trả bài Tìm em câu ví sông Lam.", media_type: "external_video", media_provider: "youtube",
    media_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", external_media_id: "dQw4w9WgXcQ", created_at: "2026-09-24T09:00:00Z",
    updated_at: "2026-09-24T09:00:00Z", author_user_id: "u1", author_name: "Nguyễn Văn Nam", author_avatar_url: null, author_role: "student",
    author_ht_member: false, is_mine: false, is_hidden: false, comment_count: 0,
  };
  const social = (t: boolean) => ({ me: me(t), comments: {}, onRefreshComments: noop, onExpandComments: noop, onModeratePost: () => {} });
  const [p] = toFeedPosts([row]);
  const st = renderToStaticMarkup(<PostCard post={p} now={NOW} social={social(false)} />);
  const th = renderToStaticMarkup(<PostCard post={p} now={NOW} social={social(true)} />);
  assert.ok(!st.includes("Tuỳ chọn bài")); assert.match(th, /aria-label="Tuỳ chọn bài"/);
  assert.match(st, /Ghi chú cho Thầy/); assert.ok(!st.includes("Nội dung"));
  assert.ok(st.indexOf("cs-post-media") < st.indexOf("cs-post-note"), "video trước, ghi chú sau");
  const [h] = toFeedPosts([{ ...row, is_hidden: true }]);
  assert.match(renderToStaticMarkup(<PostCard post={h} now={NOW} social={social(true)} />), /Bài đã bị ẩn — học sinh không thấy bài này\./);
});
