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
import { isLikeKind, likeKey, parseSummary } from "../../src/class-social/likes/likeModel";
import { isCommentKind } from "../../src/class-social/comments/targetCommentModel";
import { resizedImage, retryOriginal, storyImageProps } from "../../src/story/coverImage";
import { POSITION_TTL_MS, anchorIndex, consumeResume, readPosition, requestResume, savePosition } from "../../src/class-social/feedReturn";
import { mergeMyStories } from "../../src/story/myStories";
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

test("giao diện thẻ: liên kết tới trang đọc; thanh Thích · Bình luận chung của Feed, đúng khoá story + stories.id", () => {
  const [e] = toFeedEntries([row(1)]);
  const html = renderToStaticMarkup(<FeedEntryCard entry={e} />);
  assert.match(html, /href="\/story\/chuyen-1\?return=%2Fme"/); assert.match(html, /1001 Câu Chuyện/);
  assert.match(html, /data-kind="story"/); assert.match(html, /Thích/); assert.match(html, /Bình luận/);
  // nút nằm NGOÀI liên kết đọc truyện
  assert.ok(html.indexOf("</a>") < html.indexOf("cs-likebar"));
  // /me/stories (không footer) giữ nguyên thẻ đã duyệt
  assert.doesNotMatch(renderToStaticMarkup(<StoryCard card={card(2)} variant="list" />), /cs-likebar/);
  assert.match(renderToStaticMarkup(<StoryCard card={card(2)} variant="today" />), /Câu chuyện hôm nay/);
});

test("Thích/Bình luận: 'story' là loại mục hợp lệ trong cùng kho với Feed", () => {
  assert.equal(isLikeKind("story"), true); assert.equal(isCommentKind("story"), true); assert.equal(isCommentKind("post"), false);
  assert.equal(parseSummary([{ target_kind: "story", target_id: ID(1), like_count: 2, liked: true }]).get(likeKey("story", ID(1)))!.count, 2);
});

const COVER = "https://abc.supabase.co/storage/v1/object/public/story-photos/stories/a.png";
test("ảnh Story: thu nhỏ khi tải, giữ tỉ lệ, cùng một asset; ảnh nguồn khác giữ nguyên", () => {
  assert.equal(resizedImage(COVER, 480), "https://abc.supabase.co/storage/v1/render/image/public/story-photos/stories/a.png?width=480&resize=contain&quality=72");
  assert.match(resizedImage(COVER + "?v=2", 480), /a\.png\?v=2&width=480&resize=contain/);
  const p = storyImageProps(COVER, "card");
  assert.match(p.srcSet!, / 480w, .* 800w, .* 1200w$/); assert.ok(p.sizes);
  for (const other of ["https://x/a.png", "https://abc.supabase.co/storage/v1/object/public/lessons/a.png", COVER.replace(".png", ".gif")]) {
    assert.deepEqual(storyImageProps(other, "card"), { src: other }); assert.equal(resizedImage(other, 480), other);
  }
});

test("ảnh Story lỗi dịch vụ thu nhỏ → quay về đúng ảnh gốc MỘT lần", () => {
  const attrs: Record<string, string> = { src: resizedImage(COVER, 800), srcset: "x 1w", sizes: "1px" };
  const img = { dataset: {} as Record<string, string>, getAttribute: (k: string) => attrs[k] ?? null, removeAttribute: (k: string) => { delete attrs[k]; }, set src(v: string) { attrs.src = v; } } as unknown as HTMLImageElement;
  assert.equal(retryOriginal(img, COVER), true); assert.deepEqual(attrs, { src: COVER });
  assert.equal(retryOriginal(img, COVER), false);
});

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } }; };
test("vị trí cuộn: đúng tài khoản, còn hạn; chỉ khôi phục khi thật sự quay lại, dùng một lần", () => {
  const s = mem(); const pos = { owner: "u1", key: "p:1", offset: 12, y: 900, count: 40, at: 1_000_000 };
  savePosition("home:for_you", pos, s);
  assert.deepEqual(readPosition("home:for_you", "u1", 1_000_100, s), pos);
  assert.equal(readPosition("home:for_you", "u2", 1_000_100, s), null);
  assert.equal(readPosition("home:friends", "u1", 1_000_100, s), null);
  assert.equal(readPosition("home:for_you", "u1", 1_000_000 + POSITION_TTL_MS + 1, s), null);
  assert.equal(consumeResume(5000, s, () => false), false);          // bấm menu Trang chủ → không khôi phục
  requestResume(5000, s);
  assert.equal(consumeResume(6000, s, () => false), true); assert.equal(consumeResume(6001, s, () => false), false);
  requestResume(5000, s); assert.equal(consumeResume(5000 + 61_000, s, () => false), false);   // cờ cũ không dùng
  assert.equal(consumeResume(1, s, () => true), true);               // Back/Forward của trình duyệt
  assert.equal(anchorIndex([-300, 20, 400, 900]), 2); assert.equal(anchorIndex([]), -1);
});

test("vị trí cuộn: chỉ lưu khoá mục + toạ độ, không lưu nội dung", () => {
  const src = readFileSync("src/class-social/useFeedReturn.ts", "utf8");
  assert.match(src, /savePosition\(cur\.id, \{ owner: cur\.owner, key: cur\.keys\[i\] \?\? null, offset: [^}]*y: window\.scrollY, count: cur\.count, at: Date\.now\(\) \}\)/);
});

test("Phòng viết: ghép bài đã đăng của mình, không trùng, mới sửa lên trước", () => {
  const own = [{ id: "a", title: "A", status: "telling", updated_at: "2026-09-01", conversation: [1] }, { id: "b", title: "B", status: "unpublished", updated_at: "2026-08-01", conversation: null }];
  const out = mergeMyStories(own, [{ id: "c", title: "C", status: "published", updated_at: "2026-09-15" }, { id: "a", title: "A", status: "published", updated_at: "2026-09-02" }]);
  assert.deepEqual(out.map(x => x.id), ["c", "a", "b"]); assert.deepEqual(out.map(x => x.conversation), [[], [1], []]);
});

test("migration Feed: không trả mã người dùng, hội thoại, Zalo; lọc chặn trong truy vấn; hàm thẻ không gọi trực tiếp được", () => {
  const sql = readFileSync("db/story_feed_v1_setup.sql", "utf8");
  const fn = sql.slice(sql.indexOf("function public.story_feed_card"), sql.indexOf("revoke all on function public.story_feed_card"));
  assert.doesNotMatch(fn, /user_id|conversation|zalo/);
  assert.equal(sql.match(/class_ugc_pair_blocked\(auth\.uid\(\), (st|s)\.user_id\)/g)!.length, 3);
  assert.match(sql, /revoke all on function public\.story_feed_card\(uuid\) from public, anon, authenticated;/);
  assert.doesNotMatch(readFileSync("db/story_feed_v1_rollback.sql", "utf8"), /stories_own|story_private|grant select/);
});

test("bản vá riêng tư: lọc chặn theo chủ bài thật; không cấp bảng kín cho client; tính năng hoàn tác không đụng bản vá", () => {
  const p = readFileSync("db/story_privacy_v1_setup.sql", "utf8");
  assert.equal(p.match(/class_ugc_pair_blocked\(auth\.uid\(\), public\.story_owner_id\((st|s)\.id\)\)/g)!.length, 3);
  assert.doesNotMatch(p, /class_ugc_pair_blocked\(auth\.uid\(\), (st|s)\.user_id\)/);
  assert.match(p, /revoke all on function public\.story_owner_id\(uuid\) from public, anon, authenticated;/);
  const back = readFileSync("db/story_engagement_v1_rollback.sql", "utf8");
  assert.doesNotMatch(back, /story_private|stories_seal|user_id drop|grant select|delete from public\.feed_likes\s*;|drop table|drop constraint/);
  assert.match(readFileSync("db/story_feed_v1_setup.sql", "utf8"), /đã có story_privacy_v1/);
});
