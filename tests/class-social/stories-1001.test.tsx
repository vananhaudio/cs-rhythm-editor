import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { entryKey, isPostEntry, isStoryEntry, mergePosts, toFeedEntries, type MixedRow } from "../../src/class-social/posts/postModel";
import { placeTodayCard, safeReturnPath, storyHref, toStoryCard, type StoryCardData } from "../../src/class-social/stories/storyModel";
import StoryCard from "../../src/class-social/stories/StoryCard";
import FeedEntryCard from "../../src/class-social/sections/FeedEntryCard";
import { NAV_GROUPS } from "../../src/class-social/nav";
import { SECTION_PATHS, keepsPathForGuest, sectionFromPath, viewFromPath, viewPath } from "../../src/class-social/resolveMeRoute";
import { classifyRoute } from "../../netlify/og/routes";
void React;

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const raw = (n: number, extra: Record<string, unknown> = {}) => ({ story_id: ID(n), slug: `chuyen-${n}`, title: `Chuyện ${n}`, excerpt: "Trích", cover_url: "https://x/a.png", author_name: "Lan", published_at: "2026-09-01T00:00:00Z", story_number: n, ...extra });
const card = (n: number) => toStoryCard(raw(n)) as StoryCardData;
const row = (n: number): MixedRow => ({ kind: "story", sort_at: "2026-09-01T00:00:00Z", sort_key: `s:${ID(n)}`, post: raw(n), thread: null });

test("thẻ truyện: payload hỏng / đường dẫn lạ bị bỏ; tên email không bao giờ hiện; ảnh chỉ nhận https", () => {
  for (const bad of [null, {}, raw(1, { slug: "../admin" }), raw(1, { slug: "A B" }), raw(1, { story_id: "x" }), raw(1, { title: "  " })]) assert.equal(toStoryCard(bad), null);
  assert.equal(toStoryCard(raw(1, { author_name: "a@b.com" }))!.authorName, "Người kể chuyện");
  assert.equal(toStoryCard(raw(1, { author_name: null }))!.authorName, "Người kể chuyện");
  assert.equal(toStoryCard(raw(1, { cover_url: "javascript:alert(1)" }))!.coverUrl, null);
});

test("Feed: hàng story thành một mục, khoá 's:', không bị coi là bài viết, không trùng khi gộp trang", () => {
  const [e] = toFeedEntries([row(1)]);
  assert.ok(isStoryEntry(e)); assert.equal(entryKey(e), `s:${ID(1)}`); assert.equal(isPostEntry(e), false);
  assert.equal(mergePosts([e], toFeedEntries([row(1)])).length, 1);
});

type E = { k: string; s: string | null };
const posts = (...x: string[]): E[] => x.map(k => ({ k, s: k.startsWith("S") ? ID(Number(k.slice(1))) : null }));
const place = (e: E[], t: StoryCardData | null) => placeTodayCard(e, t, x => x.s).map(s => s.type === "today" ? "T" : s.entry.k).join(" ");

test("Câu chuyện hôm nay: sau bài thứ ba; ít bài thì ở cuối; không có bài thì không chèn", () => {
  assert.equal(place(posts("a", "b", "c", "d"), card(9)), "a b c T d");
  assert.equal(place(posts("a", "b"), card(9)), "a b T");
  assert.equal(place([], card(9)), "");
  assert.equal(place(posts("a", "b", "c", "d"), null), "a b c d");
});

test("Câu chuyện hôm nay: không trùng truyện trên dòng theo ngày; hai thẻ truyện không đứng liền", () => {
  assert.equal(place(posts("a", "S9", "b", "c", "d"), card(9)), "a b c T d");
  assert.equal(place(posts("a", "b", "c", "S1", "d", "e"), card(9)), "a b c S1 d T e");
  assert.equal(place(posts("a", "b", "S1", "c", "d"), card(9)), "a b S1 c T d");
  assert.equal(place(posts("a", "b", "c", "S1"), card(9)), "a b T c S1");   // phía sau hết chỗ → lùi lên
  assert.equal(place(posts("S1"), card(9)), "S1 T");                       // chỉ có một truyện: đành đứng cạnh
});

test("đường quay lại chỉ nhận đường nội bộ của /me; đường dẫn đã xuất bản giữ nguyên", () => {
  for (const ok of ["/me", "/me/stories", "/start"]) assert.equal(safeReturnPath(ok), ok);
  for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "/admin", "/me/../admin", "", null, 3]) assert.equal(safeReturnPath(bad), null);
  assert.equal(storyHref("chuyen-1"), "/story/chuyen-1");
  assert.equal(storyHref("chuyen-1", "/me/stories"), "/story/chuyen-1?return=%2Fme%2Fstories");
});

test("menu: 1001 Câu Chuyện ngay SAU Trang chủ trong nhóm Cộng đồng; các mục cũ giữ thứ tự", () => {
  const g = NAV_GROUPS.find(x => x.id === "community")!;
  assert.deepEqual(g.items.map(i => i.id), ["home", "stories", "friends", "chat", "band"]);
  assert.equal(g.items[1].label, "1001 Câu Chuyện");
});

test("route /me/stories: nhận đúng, giữ đường dẫn qua đăng nhập, đã phân loại ảnh xem trước", () => {
  assert.equal(SECTION_PATHS.stories, "/me/stories");
  assert.equal(sectionFromPath("/me/stories/"), "stories");
  const v = viewFromPath("/me/stories");
  assert.deepEqual(v, { kind: "section", section: "stories" }); assert.equal(viewPath(v), "/me/stories");
  assert.equal(keepsPathForGuest(v), true);
  assert.equal(keepsPathForGuest({ kind: "section", section: "friends" }), false);
  assert.equal(classifyRoute("/me/stories")?.kind, "private");
});

test("giao diện thẻ: liên kết tới trang đọc đã xuất bản; chưa có Thích/Bình luận (chờ Lát 3)", () => {
  const [e] = toFeedEntries([row(1)]);
  const html = renderToStaticMarkup(<FeedEntryCard entry={e} />);
  assert.match(html, /href="\/story\/chuyen-1\?return=%2Fme"/); assert.match(html, /1001 Câu Chuyện/); assert.doesNotMatch(html, /Thích|Bình luận/);
  assert.match(renderToStaticMarkup(<StoryCard card={card(2)} variant="today" />), /Câu chuyện hôm nay/);
});

test("migration Feed: không trả mã người dùng, hội thoại, Zalo; lọc chặn trong truy vấn; hàm thẻ không gọi trực tiếp được", () => {
  const sql = readFileSync("db/story_feed_v1_setup.sql", "utf8");
  const fn = sql.slice(sql.indexOf("function public.story_feed_card"), sql.indexOf("revoke all on function public.story_feed_card"));
  assert.doesNotMatch(fn, /user_id|conversation|zalo/);
  assert.equal(sql.match(/class_ugc_pair_blocked\(auth\.uid\(\), (st|s)\.user_id\)/g)!.length, 3);
  assert.match(sql, /revoke all on function public\.story_feed_card\(uuid\) from public, anon, authenticated;/);
  assert.doesNotMatch(readFileSync("db/story_feed_v1_rollback.sql", "utf8"), /stories_own|story_private|grant select/);
});
