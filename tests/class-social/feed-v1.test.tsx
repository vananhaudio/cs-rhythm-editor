// Feed V1 — ba góc nhìn "Dành cho bạn · Lớp · Bạn bè" (/ME UX V1: "Lớp" — không nhầm với trang Lớp của tôi): model URL, tab, trạng thái trống, API gọi đúng RPC.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FEED_EMPTY, FEED_SCOPES, scopeFromSearch, searchForScope } from "../../src/class-social/posts/feedScope";
import FeedTabs from "../../src/class-social/sections/FeedTabs";
import CommunityFeed from "../../src/class-social/sections/CommunityFeed";

void React;

test("ba góc nhìn đúng thứ tự + nhãn; mặc định Dành cho bạn", () => {
  assert.deepEqual(FEED_SCOPES.map(s => s.label), ["Dành cho bạn", "Lớp", "Bạn bè"]);
  assert.equal(scopeFromSearch(""), "for_you");
  assert.equal(scopeFromSearch("?feed=classes"), "my_classes");
  assert.equal(scopeFromSearch("?feed=friends"), "friends");
  assert.equal(scopeFromSearch("?feed=everything"), "for_you", "giá trị lạ → mặc định");
  assert.equal(scopeFromSearch("?tab=hoc"), "for_you", "không đụng ?tab= (chuyển hướng App học)");
});

test("đổi góc nhìn chỉ đổi ?feed=, giữ tham số khác; Dành cho bạn = URL sạch", () => {
  assert.equal(searchForScope("", "friends"), "?feed=friends");
  assert.equal(searchForScope("?feed=friends", "my_classes"), "?feed=classes");
  assert.equal(searchForScope("?feed=classes", "for_you"), "");
  assert.equal(searchForScope("?x=1&feed=classes", "for_you"), "?x=1");
});

test("tab: nút thật, đúng MỘT tab aria-pressed, không đếm số", () => {
  const h = renderToStaticMarkup(<FeedTabs scope="my_classes" onChange={() => {}} />);
  assert.equal((h.match(/<button type="button"/g) || []).length, 3);
  assert.equal((h.match(/aria-pressed="true"/g) || []).length, 1);
  assert.match(h, /aria-pressed="true">Lớp</);
  assert.equal(/\(\d+\)/.test(h), false, "V1 không hiện số đếm");
});

test("trạng thái trống theo góc nhìn: nhẹ, có lối đi tiếp", () => {
  const ready = { status: "ready" as const, posts: [], hasMore: false, loadingMore: false, moreError: null };
  const mc = renderToStaticMarkup(<CommunityFeed state={ready} onRetry={() => {}} onLoadMore={() => {}}
    empty={FEED_EMPTY.my_classes} emptyAction={<button type="button">Xem các lớp của tôi</button>} />);
  assert.match(mc, /Chưa có hoạt động mới từ các lớp của bạn\./);
  assert.match(mc, /Xem các lớp của tôi/);
  assert.match(mc, /cs-empty is-quiet/);
  const fr = renderToStaticMarkup(<CommunityFeed state={ready} onRetry={() => {}} onLoadMore={() => {}} empty={FEED_EMPTY.friends} />);
  assert.match(fr, /Chưa có hoạt động mới từ bạn bè\./);
  assert.match(fr, /Kết bạn với những người cùng học/);
});

test("API: Dành cho bạn gọi ĐÚNG social_feed (không đổi); hai góc nhìn kia gọi social_feed_scoped — client không gửi quyền", () => {
  const api = readFileSync("src/class-social/posts/postsApi.ts", "utf8");
  assert.match(api, /if \(scope === 'for_you'\) return fetchSocialFeedPage\(cursor\)/);
  const scoped = api.slice(api.indexOf("export async function fetchScopedFeedPage"), api.indexOf("/** Trả bài"));
  assert.match(scoped, /rpc\('social_feed_scoped', \{\s*p_scope: scope,\s*p_before:[^,]+,\s*p_before_key:[^,]+,\s*p_limit: FEED_PAGE,\s*\}\)/);
  assert.equal(/user_id|p_friend|p_class|is_teacher|auth\./.test(scoped.replace(/\/\/.*$/gm, "")), false, "không gửi danh tính / quyền từ client");
  const hook = readFileSync("src/class-social/posts/useCommunityFeed.ts", "utf8");
  assert.match(hook, /usePostsFeed\(scope === 'my_classes' \? classesFetch : SCOPED_FETCHERS\[scope\]\)/, "mỗi góc nhìn một hàm tải ổn định → đổi tab = đổi nguồn, bỏ kết quả về muộn");
  assert.match(hook, /useCallback<PageFetcher>\([\s\S]*?\[ids\]\)/, "tab Lớp: hàm tải ổn định theo danh sách lớp");
});
