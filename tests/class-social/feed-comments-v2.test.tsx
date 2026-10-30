import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildThread, checkTargetBody, commentCountLabel, commentErrorText, countComments, isCommentKind, toTargetComment, type TargetCommentRow } from "../../src/class-social/comments/targetCommentModel";
import { __peekCount, __resetCountStore, __setCountsApi, ensureCommentCount, setCommentCount } from "../../src/class-social/comments/commentCountStore";
import type { TargetCommentsApi } from "../../src/class-social/comments/targetCommentsApi";
import LikeBar from "../../src/class-social/likes/LikeBar";
import FeedEntryCard from "../../src/class-social/sections/FeedEntryCard";
import TargetComments from "../../src/class-social/sections/comments/TargetComments";
import { toPublicationEntry } from "../../src/class-social/posts/postModel";
void React;

const ID = "aaaaaaaa-0000-4000-8000-000000000001";
const row = (id: string, over: Partial<TargetCommentRow> = {}): TargetCommentRow => ({
  id, parent_comment_id: null, body: "xin chào", created_at: "2026-10-30T10:00:00Z", edited_at: null, author_user_id: "u1",
  author_name: "An", author_avatar_url: null, author_role: null, is_mine: false, is_hidden: false, ...over,
});
const tick = (ms = 5) => new Promise(r => setTimeout(r, ms));

test("model: buildThread hai tầng — trả lời gắn đúng cha, mồ côi bị bỏ, trả lời của trả lời bị bỏ", () => {
  const n = buildThread([row("a"), row("b", { parent_comment_id: "a" }), row("c"), row("d", { parent_comment_id: "zzz" }), row("e", { parent_comment_id: "b" }), row("f", { parent_comment_id: "a" })]);
  assert.deepEqual(n.map(x => x.comment.id), ["a", "c"]);
  assert.deepEqual(n[0].replies.map(r => r.id), ["b", "f"], "thứ tự cũ → mới giữ nguyên");
  assert.equal(countComments(n), 4);
  assert.equal(toTargetComment({ ...row("x"), author_name: "  " })!.author.name, "Thành viên Class");
  assert.equal(toTargetComment({ ...row("x"), author_user_id: "" }), null);
  assert.equal(toTargetComment({ ...row("x"), edited_at: "2026-10-30T11:00:00Z" })!.edited, true);
});

test("model: kiểm nội dung, kiểu mục, nhãn đếm, thông báo lỗi", () => {
  assert.equal(checkTargetBody("   ").ok, false);
  assert.equal(checkTargetBody("x".repeat(2001)).ok, false);
  const ok = checkTargetBody("  hi\r\nthere ");
  assert.ok(ok.ok && ok.body === "hi\nthere");
  assert.ok(isCommentKind("learning_thread") && isCommentKind("teamlab_publication") && !isCommentKind("post"));
  assert.equal(commentCountLabel(0), "Bình luận"); assert.equal(commentCountLabel(3), "Bình luận (3)");
  assert.match(commentErrorText(undefined, undefined, false), /Không có mạng/);
  assert.match(commentErrorText("UGC01", "ugc_blocked", true), /quy tắc cộng đồng/);
  assert.match(commentErrorText("42501", "FEED_NOT_VISIBLE", true), /không còn khả dụng/);
  assert.match(commentErrorText(undefined, "boom", true), /Thử lại/);
});

test("count store: gộp lô một lần; setCommentCount cập nhật; lỗi mạng không ghi số", async () => {
  __resetCountStore(); const calls: number[] = [];
  const api = { async counts(items: { kind: string; id: string }[]) { calls.push(items.length); return { ok: true as const, value: new Map([[`learning_thread:${ID}`, 4]]) }; } } as unknown as TargetCommentsApi;
  __setCountsApi(api);
  ensureCommentCount("learning_thread", ID); ensureCommentCount("teamlab_publication", "aaaaaaaa-0000-4000-8000-000000000002"); ensureCommentCount("learning_thread", ID);
  await tick(20);
  assert.deepEqual(calls, [2]);
  assert.equal(__peekCount("learning_thread", ID), 4);
  setCommentCount("learning_thread", ID, 5); assert.equal(__peekCount("learning_thread", ID), 5);
  __resetCountStore(); __setCountsApi({ async counts() { return { ok: false as const, message: "" }; } } as unknown as TargetCommentsApi);
  ensureCommentCount("learning_thread", ID); await tick(20);
  assert.equal(__peekCount("learning_thread", ID), undefined);
  __setCountsApi(null); __resetCountStore();
});

test("UI: LikeBar có nút Bình luận chỉ khi được truyền hành động; hiển thị số lượt thích · bình luận", () => {
  const only = renderToStaticMarkup(<LikeBar kind="learning_thread" id={ID} />);
  assert.ok(!/Bình luận/.test(only), "không có hành động → không nút giả");
  const html = renderToStaticMarkup(<LikeBar kind="learning_thread" id={ID} comment={{ count: 3, open: true, onToggle: () => {} }} />);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /3 bình luận/);
  assert.ok((html.match(/<button/g) ?? []).length === 2, "đúng hai nút: Thích, Bình luận");
  assert.ok(!/Chia sẻ/.test(html), "Chia sẻ chưa có → không hiện (Lát 3)");
});

test("UI: thẻ TeamLab có thanh Thích + Bình luận; chưa mở thì không nạp khu bình luận", () => {
  const e = toPublicationEntry({ publication_id: ID, project_id: "11111111-2222-4333-8444-555555555555", slug: "bai-a", title: "Bài A", band_name: "B", project_name: "P" }, "2026-10-13T09:00:00Z")!;
  const html = renderToStaticMarkup(<FeedEntryCard entry={e} />);
  assert.match(html, /cs-likebar/); assert.match(html, /Bình luận/);
  assert.ok(!/cs-target-cmts/.test(html), "khu bình luận chỉ nạp khi bấm");
});

test("UI: TargetComments render khi chưa có dữ liệu — trạng thái tải, không lỗi, có ô viết khi đã đăng nhập", () => {
  const me = { userId: "u1", name: "An", avatarUrl: null, isTeacher: false } as never;
  const html = renderToStaticMarkup(<TargetComments kind="teamlab_publication" id={ID} me={me} />);
  assert.match(html, /Đang tải bình luận/);
  assert.match(html, /Viết bình luận/);
  assert.match(renderToStaticMarkup(<TargetComments kind="learning_thread" id={ID} me={null} />), /Đang tải/);
  assert.ok(!/cs-cmt-composer/.test(renderToStaticMarkup(<TargetComments kind="learning_thread" id={ID} me={null} />)), "khách: không ô viết");
});
